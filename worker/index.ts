import { DurableObject } from "cloudflare:workers";
import { GAMES, isGameId } from "../shared/games";
import { addResult, emptyStats, PROFILE_ID_RE, sanitizeResult, type ProfileStats, type RecentGame } from "../shared/platform/profile";
import { ACCESS_CODE_RE, accessFor, DEFAULT_CONFIG, sanitizeConfig, type SiteConfig } from "../shared/platform/access";
import { addPlayer, applyRoomAction, cleanName, createRoom, roomGame, viewRoom, type RoomState } from "../shared/platform/room";
import { GameError } from "../shared/platform/types";
import {
  CALL_SESSION_RE, CALL_TRACK_RE, PIN_RE, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROOM_CODE_RE,
  type CallPeer, type ClientMessage, type RoomInfo, type ServerMessage,
} from "../shared/platform/protocol";

interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  SETTINGS: DurableObjectNamespace<SiteSettings>;
  PROFILES: DurableObjectNamespace<ProfileStore>;
  /** Admin-Passwort – als Secret in Cloudflare gesetzt. Fehlt es, ist der Admin-Bereich aus. */
  ADMIN_PASSWORD?: string;
  /** Cloudflare Realtime (Sprach-/Videochat): App-ID und App-Token. Fehlen sie, ist der Chat aus. */
  REALTIME_APP_ID?: string;
  REALTIME_APP_TOKEN?: string;
  /** Nur für lokale Tests: SFU-Antworten simulieren statt Cloudflare zu fragen */
  REALTIME_FAKE?: string;
}

interface RoomData {
  pinHash: string;
  salt: string;
  /** Raum mit Spielern, Einstellungen und Spielstand */
  state: RoomState;
  /** playerId → geheimer Token zum Wiederverbinden */
  tokens: Record<string, string>;
  fails: number;
  lockUntil: number;
  createdAt: number;
  /** Beim Anlegen wurde der Zugangscode genannt – dann dürfen auch Spiele hinter dem Code gewählt werden */
  unlocked?: boolean;
  /** playerId → Profil-ID (nur auf dem Server, nie an andere Spieler) */
  profiles?: Record<string, string>;
  /** Sprach-/Videochat: wer drin ist, und welche SFU-Sitzung wem gehört */
  call?: Record<string, CallPeer>;
  callSessions?: Record<string, string>;
}

interface Attachment {
  playerId: string | null;
}

/** Räume ohne Aktivität werden nach 48 Stunden gelöscht. */
const ROOM_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_PIN_FAILS = 8;
const LOCK_MS = 10 * 60 * 1000;
const MAX_MESSAGE_BYTES = 4000;

async function hashPin(salt: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Raumcode aus 32 Zeichen – 256 ist durch 32 teilbar, also keine Modulo-Verzerrung. */
function makeCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Ein Durable Object pro Spielraum. Hält den Spielstand und alle WebSocket-Verbindungen. */
export class GameRoom extends DurableObject<Env> {
  private room: RoomData | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomData>("room")) ?? null;
    });
  }

  /** Legt den Raum an. false, wenn der Code schon vergeben ist. */
  async init(pin: string, gameId: string, unlocked = false): Promise<boolean> {
    if (this.room) return false;
    const salt = crypto.randomUUID();
    this.room = {
      pinHash: await hashPin(salt, pin),
      salt,
      state: createRoom(gameId),
      tokens: {},
      fails: 0,
      lockUntil: 0,
      createdAt: Date.now(),
      unlocked,
    };
    await this.persist();
    return true;
  }

  async info(): Promise<RoomInfo> {
    return this.room ? { exists: true, gameId: this.room.state.gameId } : { exists: false };
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.room) return new Response("Raum nicht gefunden", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket erwartet", { status: 426 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.room) {
      this.send(ws, { type: "error", message: "Den Raum gibt es nicht mehr.", code: "rejected", fatal: true });
      ws.close(4404, "gone");
      return;
    }
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    if (text.length > MAX_MESSAGE_BYTES) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(text) as ClientMessage;
    } catch {
      this.send(ws, { type: "error", message: "Ungültige Nachricht." });
      return;
    }

    if (msg.type === "join") {
      await this.handleJoin(ws, msg);
      return;
    }

    const att = ws.deserializeAttachment() as Attachment | null;
    const playerId = att?.playerId;
    if (!playerId || !this.room.state.players.some((p) => p.id === playerId)) {
      this.send(ws, { type: "error", message: "Bitte tritt dem Raum zuerst bei.", code: "not_joined", fatal: true });
      return;
    }

    if (msg.type === "closeRoom") {
      if (playerId !== this.room.state.hostId) {
        this.send(ws, { type: "error", message: "Das darf nur der Host." });
        return;
      }
      await this.destroy("Der Host hat den Raum gelöscht.");
      return;
    }

    if (msg.type === "call") {
      const call = (this.room.call ??= {});
      if (msg.session === null) delete call[playerId];
      else {
        // Nur Sitzungen, die dieser Spieler über unseren Server angelegt hat
        if (typeof msg.session !== "string" || !CALL_SESSION_RE.test(msg.session) || this.room.callSessions?.[msg.session] !== playerId) return;
        const track = (t: unknown) => (typeof t === "string" && CALL_TRACK_RE.test(t) ? t : undefined);
        call[playerId] = { session: msg.session, audio: track(msg.audio), video: track(msg.video), mic: msg.mic !== false, cam: msg.cam === true };
      }
      await this.persist();
      this.broadcast();
      return;
    }

    if (msg.type === "claimHost") {
      const host = this.room.state.hostId;
      if (host === playerId) return;
      if (host && this.onlineIds().has(host)) {
        this.send(ws, { type: "error", message: "Der Host ist noch verbunden." });
        return;
      }
      this.room.state = { ...this.room.state, hostId: playerId };
      await this.persist();
      this.broadcast();
      return;
    }

    if (msg.type === "action" && msg.action && typeof msg.action === "object") {
      const before = this.room.state;
      // Spielwechsel in der Lobby: Admin-Freigaben gelten auch hier
      if (msg.action.type === "selectGame" && isGameId(msg.action.gameId)) {
        const access = accessFor(await settingsOf(this.env).config(), msg.action.gameId);
        if (access === "off" || (access === "code" && !this.room.unlocked)) {
          this.send(ws, { type: "error", message: access === "off" ? "Dieses Spiel ist gerade abgeschaltet." : "Dafür braucht ihr den Zugangscode." });
          return;
        }
      }
      try {
        this.room.state = applyRoomAction(this.room.state, msg.action, playerId);
      } catch (e) {
        this.send(ws, { type: "error", message: e instanceof GameError ? e.message : "Das ging gerade nicht." });
        return;
      }
      if (msg.action.type === "removePlayer") this.kick(msg.action.id);
      await this.persist();
      this.broadcast();
      await this.recordIfFinished(before);
    }
  }

  /** Partie gerade zu Ende gegangen: Ergebnisse in die Profile der Mitspieler schreiben */
  private async recordIfFinished(before: RoomState): Promise<void> {
    const room = this.room;
    const now = room?.state;
    if (!room || !now || now.phase !== "playing" || !now.game || !room.profiles) return;
    const logic = roomGame(now);
    const was = before.phase === "playing" && before.game && before.gameId === now.gameId && before.round === now.round && logic.isOver(before.game);
    if (was || !logic.isOver(now.game) || !logic.results) return;
    const ctx = { players: now.players, hostId: now.hostId, actorId: null, options: now.options, now: Date.now() };
    const results = logic.results(now.game, ctx);
    const players = results.length;
    await Promise.all(results.map(async (r) => {
      const pid = room.profiles?.[r.id];
      if (!pid) return;
      const entry: RecentGame = { gameId: now.gameId, at: Date.now(), won: r.won, score: r.score, players, online: true };
      try { await this.env.PROFILES.get(this.env.PROFILES.idFromName(pid)).record(entry); } catch { /* Statistik ist nur ein Extra */ }
    }));
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code, reason); } catch { /* bereits geschlossen */ }
    // Ohne Verbindung auch raus aus dem Sprachchat (beim Wiederverbinden meldet sich das Handy neu an)
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.playerId && this.room?.call?.[att.playerId] && !this.onlineIds().has(att.playerId)) {
      delete this.room.call[att.playerId];
      await this.persist();
    }
    this.broadcast();
  }

  /** Darf dieser Spieler den Sprachchat nutzen? Optional: gehört ihm die Sitzung? */
  async callAuth(playerId: string, token: string, session: string | null): Promise<boolean> {
    const room = this.room;
    if (!room || !playerId || room.tokens[playerId] !== token) return false;
    return session === null || room.callSessions?.[session] === playerId;
  }

  /** Neue SFU-Sitzung merken (höchstens eine Handvoll pro Spieler, alte fallen raus) */
  async callRegister(playerId: string, session: string): Promise<void> {
    if (!this.room) return;
    const map = (this.room.callSessions ??= {});
    const mine = Object.keys(map).filter((s) => map[s] === playerId);
    for (const old of mine.slice(0, Math.max(0, mine.length - 3))) delete map[old];
    map[session] = playerId;
    await this.persist();
  }

  /** Gehören alle Sitzungen zu diesem Raum? (man darf nur Spuren der eigenen Mitspieler abholen) */
  async callSessionsKnown(sessions: string[]): Promise<boolean> {
    const map = this.room?.callSessions ?? {};
    return sessions.every((s) => s in map);
  }

  async webSocketError(): Promise<void> {
    this.broadcast();
  }

  /** Läuft, wenn 48 h lang nichts passiert ist: Raum löschen. */
  async alarm(): Promise<void> {
    await this.destroy("Der Raum ist nach 48 Stunden ohne Aktivität abgelaufen.");
  }

  /** Alle rauswerfen und sämtliche gespeicherten Daten des Raums löschen. */
  private async destroy(message: string): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, { type: "error", code: "closed", fatal: true, message });
      try { ws.close(4410, "closed"); } catch { /* egal */ }
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.room = null;
  }

  private async handleJoin(ws: WebSocket, msg: Extract<ClientMessage, { type: "join" }>): Promise<void> {
    const room = this.room!;

    // Wiederverbinden mit Token (ohne PIN)
    if (msg.playerId && msg.token && room.tokens[msg.playerId] === msg.token
        && room.state.players.some((p) => p.id === msg.playerId)) {
      ws.serializeAttachment({ playerId: msg.playerId } satisfies Attachment);
      if (typeof msg.profile === "string" && PROFILE_ID_RE.test(msg.profile) && room.profiles?.[msg.playerId] !== msg.profile) {
        (room.profiles ??= {})[msg.playerId] = msg.profile;
        await this.persist();
      }
      this.send(ws, { type: "joined", playerId: msg.playerId, token: msg.token });
      this.broadcast();
      return;
    }

    if (Date.now() < room.lockUntil) {
      this.send(ws, { type: "error", code: "locked", fatal: true, message: "Zu viele falsche PINs. Versuch es in ein paar Minuten nochmal." });
      return;
    }

    const pin = String(msg.pin ?? "");
    if (!PIN_RE.test(pin) || (await hashPin(room.salt, pin)) !== room.pinHash) {
      room.fails++;
      if (room.fails >= MAX_PIN_FAILS) { room.lockUntil = Date.now() + LOCK_MS; room.fails = 0; }
      await this.persist();
      this.send(ws, { type: "error", code: "bad_pin", fatal: true, message: "Die PIN stimmt nicht." });
      return;
    }
    room.fails = 0;

    const playerId = crypto.randomUUID();
    const token = crypto.randomUUID();
    try {
      room.state = addPlayer(room.state, { id: playerId, name: msg.name ?? "" });
    } catch (e) {
      this.send(ws, { type: "error", code: "rejected", fatal: true, message: e instanceof GameError ? e.message : "Beitritt nicht möglich." });
      return;
    }
    room.tokens[playerId] = token;
    if (typeof msg.profile === "string" && PROFILE_ID_RE.test(msg.profile)) (room.profiles ??= {})[playerId] = msg.profile;
    ws.serializeAttachment({ playerId } satisfies Attachment);
    await this.persist();
    this.send(ws, { type: "joined", playerId, token });
    this.broadcast();
  }

  private kick(playerId: string): void {
    if (!this.room) return;
    delete this.room.tokens[playerId];
    if (this.room.profiles) delete this.room.profiles[playerId];
    if (this.room.call) delete this.room.call[playerId];
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.playerId === playerId) {
        this.send(ws, { type: "error", code: "kicked", fatal: true, message: "Du wurdest aus dem Raum entfernt." });
        ws.serializeAttachment({ playerId: null } satisfies Attachment);
        try { ws.close(4403, "kicked"); } catch { /* egal */ }
      }
    }
  }

  /** Spieler mit offener Verbindung */
  private onlineIds(): Set<string> {
    const online = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.playerId && ws.readyState === WebSocket.OPEN) online.add(att.playerId);
    }
    return online;
  }

  private broadcast(): void {
    if (!this.room) return;
    const sockets = this.ctx.getWebSockets();
    const onlineList = [...this.onlineIds()];
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att?.playerId) continue;
      this.send(ws, { type: "state", state: viewRoom(this.room.state, att.playerId), you: att.playerId, online: onlineList, call: this.room.call ?? {} });
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try { ws.send(JSON.stringify(msg)); } catch { /* Verbindung weg */ }
  }

  private async persist(): Promise<void> {
    if (!this.room) return;
    await this.ctx.storage.put("room", this.room);
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }
}

interface SettingsData {
  config: Omit<SiteConfig, "hasCode">;
  codeHash: string | null;
  salt: string;
  fails: number;
  lockUntil: number;
}

/** Vergleich in konstanter Zeit – über die Hashes, damit die Länge nichts verrät */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([hashPin("cmp", a), hashPin("cmp", b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

const GAME_IDS = Object.keys(GAMES);
const ADMIN_MAX_FAILS = 8;

/** Ein einziges Durable Object mit den Admin-Einstellungen (Freigaben, Zugangscode, Hinweis). */
export class SiteSettings extends DurableObject<Env> {
  private data: SettingsData = { config: { ...DEFAULT_CONFIG }, codeHash: null, salt: crypto.randomUUID(), fails: 0, lockUntil: 0 };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<SettingsData>("settings");
      if (saved) this.data = saved;
    });
  }

  async config(): Promise<SiteConfig> {
    return { ...this.data.config, hasCode: !!this.data.codeHash };
  }

  async checkCode(code: string): Promise<boolean> {
    if (!this.data.codeHash) return false;
    return (await hashPin(this.data.salt, code)) === this.data.codeHash;
  }

  /** Admin: anmelden (ohne `update`) oder speichern. Nach zu vielen Fehlversuchen 10 Minuten Pause. */
  async admin(password: string, update?: { config: unknown; code?: string | null }): Promise<{ ok: boolean; error?: string; config?: SiteConfig }> {
    const secret = this.env.ADMIN_PASSWORD;
    if (!secret) return { ok: false, error: "Der Admin-Bereich ist nicht eingerichtet (ADMIN_PASSWORD fehlt)." };
    if (Date.now() < this.data.lockUntil) return { ok: false, error: "Zu viele Fehlversuche. Bitte in ein paar Minuten nochmal." };
    if (!(await sameSecret(password, secret))) {
      this.data.fails++;
      if (this.data.fails >= ADMIN_MAX_FAILS) { this.data.fails = 0; this.data.lockUntil = Date.now() + LOCK_MS; }
      await this.ctx.storage.put("settings", this.data);
      return { ok: false, error: "Falsches Passwort." };
    }
    this.data.fails = 0;
    if (update) {
      this.data.config = sanitizeConfig(update.config, GAME_IDS);
      if (update.code === null) this.data.codeHash = null;
      else if (typeof update.code === "string" && update.code) {
        if (!ACCESS_CODE_RE.test(update.code)) return { ok: false, error: "Der Zugangscode braucht 4 bis 32 Zeichen." };
        this.data.salt = crypto.randomUUID();
        this.data.codeHash = await hashPin(this.data.salt, update.code);
      }
    }
    await this.ctx.storage.put("settings", this.data);
    return { ok: true, config: await this.config() };
  }
}

const settingsOf = (env: Env) => env.SETTINGS.get(env.SETTINGS.idFromName("site"));

/** Ein Durable Object pro Profil: Name und Statistik. Ohne Aktivität nach einem Jahr gelöscht. */
const PROFILE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export class ProfileStore extends DurableObject<Env> {
  private stats: ProfileStats | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.stats = (await ctx.storage.get<ProfileStats>("stats")) ?? null; });
  }

  async get(): Promise<ProfileStats> {
    return this.stats ?? emptyStats(Date.now());
  }

  async record(entry: RecentGame): Promise<ProfileStats> {
    this.stats = addResult(this.stats ?? emptyStats(Date.now()), entry);
    await this.save();
    return this.stats;
  }

  async rename(name: string): Promise<ProfileStats> {
    this.stats = { ...(this.stats ?? emptyStats(Date.now())), name: cleanName(name) };
    await this.save();
    return this.stats;
  }

  async remove(): Promise<void> {
    this.stats = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  async alarm(): Promise<void> { await this.remove(); }

  private async save() {
    await this.ctx.storage.put("stats", this.stats);
    await this.ctx.storage.setAlarm(Date.now() + PROFILE_TTL_MS);
  }
}

const profileOf = (env: Env, id: string) => env.PROFILES.get(env.PROFILES.idFromName(id));

const REALTIME_API = "https://rtc.live.cloudflare.com/v1/apps";
const MAX_CALL_BODY = 64_000;

type CallOp = "new" | "tracks" | "renegotiate" | "close";

/**
 * Leitet eine Chat-Anfrage an das Cloudflare-SFU weiter. Das App-Token bleibt auf dem Server;
 * der Raum prüft Token des Spielers, Besitz der Sitzung und dass abgeholte Spuren aus diesem Raum stammen.
 */
async function handleCall(request: Request, env: Env, code: string): Promise<Response> {
  if (!env.REALTIME_APP_ID || !env.REALTIME_APP_TOKEN) return json({ error: "Der Sprachchat ist nicht eingerichtet." }, 503);
  if (!ROOM_CODE_RE.test(code)) return json({ error: "Ungültiger Raumcode." }, 400);
  const text = await request.text();
  if (text.length > MAX_CALL_BODY) return json({ error: "Zu groß." }, 413);
  let body: { playerId?: unknown; token?: unknown; op?: unknown; session?: unknown; payload?: unknown };
  try { body = JSON.parse(text); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
  const op = body.op as CallOp;
  if (!["new", "tracks", "renegotiate", "close"].includes(op)) return json({ error: "Unbekannt." }, 400);
  const session = op === "new" ? null : typeof body.session === "string" && CALL_SESSION_RE.test(body.session) ? body.session : undefined;
  if (session === undefined) return json({ error: "Ungültige Sitzung." }, 400);

  const room = env.ROOMS.get(env.ROOMS.idFromName(code));
  if (!(await room.callAuth(String(body.playerId ?? ""), String(body.token ?? ""), session))) return json({ error: "Nicht erlaubt." }, 403);

  const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as { tracks?: { location?: string; sessionId?: string }[] };
  if (op === "tracks") {
    const remote = (payload.tracks ?? []).filter((t) => t.location === "remote").map((t) => String(t.sessionId ?? ""));
    if (remote.length && !(await room.callSessionsKnown(remote))) return json({ error: "Nicht erlaubt." }, 403);
  }

  if (env.REALTIME_FAKE === "1") {
    const data = fakeSfu(op, payload);
    if (op === "new") await room.callRegister(String(body.playerId), data.sessionId as string);
    return json(data);
  }

  const base = `${REALTIME_API}/${env.REALTIME_APP_ID}/sessions`;
  const target = op === "new" ? `${base}/new` : op === "tracks" ? `${base}/${session}/tracks/new` : op === "renegotiate" ? `${base}/${session}/renegotiate` : `${base}/${session}/tracks/close`;
  const res = await fetch(target, {
    method: op === "new" || op === "tracks" ? "POST" : "PUT",
    headers: { authorization: `Bearer ${env.REALTIME_APP_TOKEN}`, "content-type": "application/json" },
    body: op === "new" ? undefined : JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { sessionId?: string };
  if (op === "new" && res.ok && data.sessionId) await room.callRegister(String(body.playerId), data.sessionId);
  return json(data, res.status);
}

/** Test-SFU: antwortet wie Cloudflare Realtime, ohne Medien zu übertragen (nur mit REALTIME_FAKE=1) */
function fakeSfu(op: CallOp, payload: { tracks?: { location?: string; sessionId?: string; trackName?: string; mid?: string }[] }): Record<string, unknown> {
  const tracks = payload.tracks ?? [];
  if (op === "new") return { sessionId: crypto.randomUUID().replace(/-/g, "") };
  if (op === "tracks" && tracks.some((t) => t.location === "remote")) {
    return {
      requiresImmediateRenegotiation: true,
      ...(() => {
        const out = tracks.map((t) => ({ sessionId: t.sessionId, trackName: t.trackName, mid: crypto.randomUUID().slice(0, 6) }));
        // Die Test-Gegenstelle liest die Kennungen aus dem SDP und meldet dafür Spuren
        return { tracks: out, sessionDescription: { type: "offer", sdp: `v=0 fake mids=${out.map((t) => t.mid).join(",")}` } };
      })(),
    };
  }
  if (op === "tracks") return { sessionDescription: { type: "answer", sdp: "v=0 fake" }, tracks: tracks.map((t) => ({ trackName: t.trackName, mid: t.mid })) };
  return {};
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    // Freigaben für alle (ohne Geheimnisse)
    if (url.pathname === "/api/config" && request.method === "GET") return json(await settingsOf(env).config());

    // Zugangscode prüfen
    if (url.pathname === "/api/access" && request.method === "POST") {
      let body: { code?: unknown };
      try { body = await request.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
      const ok = typeof body.code === "string" && await settingsOf(env).checkCode(body.code);
      return json({ ok }, ok ? 200 : 403);
    }

    // Profil: Statistik lesen, Namen setzen, lokale Partie eintragen, löschen
    const prof = url.pathname.match(/^\/api\/profile\/([A-Z0-9]+)(\/result)?$/);
    if (prof) {
      const id = prof[1];
      if (!PROFILE_ID_RE.test(id)) return json({ error: "Ungültiges Profil." }, 400);
      const store = profileOf(env, id);
      if (prof[2] && request.method === "POST") {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
        const entry = sanitizeResult(body, GAME_IDS, Date.now());
        if (!entry) return json({ error: "Ungültiges Ergebnis." }, 400);
        return json(await store.record(entry));
      }
      if (!prof[2] && request.method === "GET") return json(await store.get());
      if (!prof[2] && request.method === "PUT") {
        let body: { name?: unknown };
        try { body = await request.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
        return json(await store.rename(String(body.name ?? "")));
      }
      if (!prof[2] && request.method === "DELETE") { await store.remove(); return json({ ok: true }); }
    }

    // Admin: anmelden oder Einstellungen speichern
    if (url.pathname === "/api/admin" && request.method === "POST") {
      let body: { password?: unknown; config?: unknown; code?: unknown };
      try { body = await request.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
      const update = body.config === undefined ? undefined : { config: body.config, code: body.code === null ? null : typeof body.code === "string" ? body.code : undefined };
      const res = await settingsOf(env).admin(String(body.password ?? ""), update);
      return json(res, res.ok ? 200 : 403);
    }

    // Raum anlegen
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let body: { pin?: unknown; game?: unknown; access?: unknown };
      try { body = await request.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
      const pin = String(body.pin ?? "");
      if (!PIN_RE.test(pin)) return json({ error: "Die PIN muss 4 bis 8 Ziffern haben." }, 400);
      if (!isGameId(body.game)) return json({ error: "Unbekanntes Spiel." }, 400);
      const gameId = body.game;

      // Admin-Freigabe: abgeschaltet oder nur mit Zugangscode
      const settings = settingsOf(env);
      const access = accessFor(await settings.config(), gameId);
      if (access === "off") return json({ error: "Dieses Spiel ist gerade abgeschaltet." }, 403);
      const unlocked = typeof body.access === "string" && await settings.checkCode(body.access);
      if (access === "code" && !unlocked) return json({ error: "Dafür braucht ihr den Zugangscode.", code: "access" }, 403);

      for (let i = 0; i < 6; i++) {
        const code = makeCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await stub.init(pin, gameId, unlocked)) return json({ code }, 201);
      }
      return json({ error: "Gerade ist kein Raumcode frei. Versuch es gleich nochmal." }, 503);
    }

    // Sprach-/Videochat eingerichtet?
    if (url.pathname === "/api/call" && request.method === "GET") return json({ enabled: !!(env.REALTIME_APP_ID && env.REALTIME_APP_TOKEN) });

    // Sprach-/Videochat: Anfragen an Cloudflare Realtime weiterreichen – nur für Mitspieler des Raums
    const callMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/call$/);
    if (callMatch && request.method === "POST") return handleCall(request, env, callMatch[1]);

    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(\/ws)?$/);
    if (match) {
      const code = match[1];
      if (!ROOM_CODE_RE.test(code)) return json({ error: "Ungültiger Raumcode." }, 400);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));

      if (match[2]) return stub.fetch(request); // WebSocket
      if (request.method === "GET") return json(await stub.info());
    }

    return json({ error: "Nicht gefunden." }, 404);
  },
} satisfies ExportedHandler<Env>;
