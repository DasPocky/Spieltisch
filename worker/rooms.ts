/** Ein Durable Object pro Spielraum: Spieler, Spielstand, Chat, Anruf, Anklopfen, Bots und die Eingriffe der Verwaltung */
import { DurableObject } from "cloudflare:workers";
import { isGameId } from "../shared/games";
import { PROFILE_ID_RE } from "../shared/platform/profile";
import { GROUP_CODE_RE, randomCode, sanitizeAvatar } from "../shared/platform/group";
import { accessFor, withDefaults, type GameDefaults, type SiteConfig } from "../shared/platform/access";
import { emptyHealth, type AdminRoom, type FeatureKind, type HealthDelta, type StatKind } from "../shared/platform/admin";
import { addPlayer, applyRoomAction, cleanName, createRoom, inRoom, roomGame, migrateRoomState, upgradeRoom, viewRoom, type RoomState } from "../shared/platform/room";
import { GameError } from "../shared/platform/types";
import { BOT_PREFIX } from "../shared/platform/bots";
import { isBotLevel, playBot } from "../shared/platform/botSkill";
import { shuffle } from "../shared/platform/random";
import { fromBase64, PHOTO_MAX_B64, PHOTO_MAX_BYTES, photoType } from "../shared/platform/photo";
import {
  DEFAULT_ACCESS, HOST_AWAY_MS, KNOCK_DENY_MS, KNOCK_GRACE_MS, KNOCK_TIMEOUT_MS, LIFE_LABEL, LIFE_MS, lifeMs, mayAdmit, sanitizeAccess,
  type KnockView, type RoomAccess, type RoomCard,
} from "../shared/platform/directory";
import { PAIR_CODE_RE, PAIR_MS, PROTOCOL, ACTION_ID_RE, CALL_SESSION_RE, CALL_TRACK_RE, CHAT_MAX, PIN_RE, PING, PONG, STALE_MS, ROOM_CODE_RE, ADMIN_CHAT_ID, MAX_NOTICE, WATCH_ID, type ChatMsg, type ClientMessage, type RoomInfo, type ServerMessage } from "../shared/platform/protocol";
import { type AdminRoomAction, type AdminRoomDetail } from "../shared/platform/admin";
import { Env, settingsOf, groupOf } from "./env";
import { hashPin } from "./http";
import { BUILD } from "../shared/build";
import { parseClientMessage } from "../shared/platform/parse";

export type { RoomData, Knock, Attachment, ResultJob } from "./room/types";
import type { RoomData, Knock, Attachment, ResultJob } from "./room/types";
export { JOIN_RETRY_MS } from "./room/join";
import { joinedAs, rememberJoin, retryJoin } from "./room/join";
import { appendChat, chatMessage, getsChat } from "./room/chat";
import { resultJobs } from "./room/results";
/** Innerer Pfad, über den der Worker eine geprüfte Zuschauer-Verbindung der Verwaltung weiterreicht */
export const WATCH_PATH = "/__admin-watch";
/** Räume ohne Aktivität werden nach 48 Stunden gelöscht. */
export const ROOM_TTL_MS = 48 * 60 * 60 * 1000;
export const MAX_PIN_FAILS = 8;
export const LOCK_MS = 10 * 60 * 1000;
export const MAX_MESSAGE_BYTES = 4000;
/** Admin-Übersicht höchstens so oft nebenbei aktualisieren */
export const REPORT_MS = 30_000;
/** Ein Durable Object pro Spielraum. Hält den Spielstand und alle WebSocket-Verbindungen. */
export class GameRoom extends DurableObject<Env> {
  private room: RoomData | null = null;

  /** Wer beim letzten Senden online war – um stille Abbrüche nur bei Änderung zu melden */
  private lastOnline = "";
  /** Zeitpunkte der letzten Chat-Nachrichten je Spieler (Spam-Bremse, nur im Speicher) */
  private chatTimes: Record<string, number[]> = {};

  /** Betriebskennzahlen seit der letzten Meldung */
  private healthDelta: HealthDelta = emptyHealth();
  /** Zuletzt gespeicherter Raumzustand (für die Revision) */
  private savedState: RoomState | null = null;
  /** Letzte Meldung an die Admin-Übersicht (gedrosselt) */
  private lastReport = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Herzschlag beantwortet Cloudflare direkt, ohne das Objekt aufzuwecken
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomData>("room")) ?? null;
      // Nach einem Update: laufende Partie mit ihrer alten Version weiterspielen, umrechnen oder sanft beenden
      if (this.room) {
        // Raum-Format prüfen und ggf. übernehmen (geht das nicht, bleibt der gespeicherte Stand unverändert)
        try { this.room.state = migrateRoomState(this.room.state); } catch { /* unverändert lassen */ }
        const up = upgradeRoom(this.room.state);
        if (up.room !== this.room.state) {
          this.room.state = up.room;
          await ctx.storage.put("room", this.room);
        }
        this.savedState = this.room.state;
      }
    });
  }

  /** Legt den Raum an. false, wenn der Code schon vergeben ist. */
  async init(pin: string, gameId: string, unlocked = false, code?: string, defaults?: GameDefaults, access: RoomAccess = DEFAULT_ACCESS, meet = false, test = false): Promise<boolean> {
    if (this.room) return false;
    const salt = crypto.randomUUID();
    const state = createRoom(gameId);
    state.access = access;
    // Jeder Raum ist auch Treffpunkt: ohne vorgewähltes Spiel geht es dort los
    if (meet) state.meet = true;
    // Standard-Einstellungen des Admins ersetzen die eingebauten
    state.options = withDefaults(roomGame(state).settings, state.options, defaults?.[state.gameId]);
    this.room = {
      pinHash: await hashPin(salt, pin),
      salt,
      state,
      tokens: {},
      fails: 0,
      lockUntil: 0,
      createdAt: Date.now(),
      unlocked,
      code: code && ROOM_CODE_RE.test(code) ? code : undefined,
      ...(test ? { test: true } : {}),
    };
    await this.persist(true);
    await this.count("rooms");
    if (access.visibility !== "all" || access.admission === "knock") await this.feature("private");
    return true;
  }

  /** Kurzinfo für die Admin-Übersicht, null wenn der Raum nicht (mehr) existiert */
  async summary(): Promise<AdminRoom | null> {
    const room = this.room;
    if (!room?.code) return null;
    const online = this.onlineIds();
    const card = this.makeCard(online);
    return {
      code: room.code,
      gameId: room.state.gameId,
      players: room.state.players.map((p) => ({ name: p.name, online: online.has(p.id) })),
      phase: room.state.phase,
      createdAt: room.createdAt,
      activeAt: room.updatedAt ?? room.createdAt,
      locked: Date.now() < room.lockUntil,
      card: card ?? undefined,
      groupCode: room.state.hostId ? room.groups?.[room.state.hostId] : undefined,
      life: room.state.access?.life,
    };
  }

  /** Raumkarte für den Start-Tab */
  private makeCard(online = this.onlineIds()): RoomCard | null {
    const room = this.room;
    if (!room?.code) return null;
    const s = room.state;
    const access = s.access ?? DEFAULT_ACCESS;
    const all = [...s.players, ...(s.bench ?? [])];
    return {
      code: room.code,
      name: access.name,
      host: s.players.find((p) => p.id === s.hostId)?.name,
      gameId: s.gameId,
      phase: s.phase,
      meet: s.phase === "lobby" && s.meet === true,
      players: all.map((p) => ({ name: p.name, avatar: s.avatars?.[p.id], online: online.has(p.id) })),
      online: all.filter((p) => online.has(p.id)).length,
      live: Object.keys(room.call ?? {}).some((id) => online.has(id)),
      visibility: access.visibility,
      admission: access.admission,
      permanent: access.life === "forever" || undefined,
      test: room.test || undefined,
      activeAt: room.updatedAt ?? room.createdAt,
    };
  }

  /** Karte für „Deine Räume“ – nur mit gültigem Zugang des Handys; null = Zugang ungültig (Raum vergessen) */
  async card(playerId: string, token: string): Promise<RoomCard | null> {
    const room = this.room;
    if (!room || !playerId || room.tokens[playerId] !== token || !inRoom(room.state, playerId)) return null;
    return this.makeCard();
  }

  /** Admin: Raum schließen – wie beim Host, alle bekommen die Meldung, alles wird gelöscht */
  async adminClose(): Promise<boolean> {
    if (!this.room) return false;
    await this.destroy("Der Raum wurde geschlossen.");
    return true;
  }

  /** Admin: Sperre nach falschen PINs aufheben */
  async adminUnlock(): Promise<boolean> {
    if (!this.room) return false;
    this.room.fails = 0;
    this.room.lockUntil = 0;
    await this.ctx.storage.put("room", this.room);
    await this.report(true);
    return true;
  }

  /** Admin: Einzelheiten für die Raum-Ansicht */
  async adminDetail(): Promise<AdminRoomDetail | null> {
    const room = this.room;
    if (!room?.code) return null;
    const s = room.state;
    // Bots sind immer da
    const online = new Set([...this.onlineIds(), ...(s.bots ?? [])]);
    return {
      code: room.code,
      gameId: s.gameId,
      phase: s.phase,
      access: s.access ?? DEFAULT_ACCESS,
      hostId: s.hostId,
      players: [
        ...s.players.map((p) => ({ id: p.id, name: p.name, online: online.has(p.id), ...(s.bots?.includes(p.id) ? { bot: true } : {}) })),
        ...(s.bench ?? []).map((p) => ({ id: p.id, name: p.name, online: online.has(p.id), bench: true, ...(s.bots?.includes(p.id) ? { bot: true } : {}) })),
      ],
      knocks: (room.knocks ?? []).filter((k) => !k.admitted).map((k) => k.name),
      locked: Date.now() < room.lockUntil,
      createdAt: room.createdAt,
      activeAt: room.updatedAt ?? room.createdAt,
      chat: room.chat?.length ?? 0,
      call: Object.keys(room.call ?? {}).filter((id) => online.has(id)).length,
      ...(room.test ? { test: true } : {}),
    };
  }

  /** Admin: in den Raum eingreifen – Nachricht, Einstellungen, Host, Spieler, Partie, PIN */
  async adminAct(a: AdminRoomAction): Promise<{ ok: boolean; error?: string; creds?: { playerId: string; token: string } }> {
    const room = this.room;
    if (!room) return { ok: false, error: "Den Raum gibt es nicht mehr." };
    const s = room.state;
    // Aktionen wie der Host ausführen – ohne Host (leerer Dauerraum) wie der erste Spieler
    const actor = s.hostId ?? s.players[0]?.id ?? "";
    try {
      switch (a.type) {
        case "message": {
          const text = String(a.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NOTICE);
          if (!text) return { ok: false, error: "Die Nachricht ist leer." };
          const m: ChatMsg = { id: crypto.randomUUID().replace(/-/g, "").slice(0, 20), from: ADMIN_CHAT_ID, at: Date.now(), text: text.slice(0, CHAT_MAX) };
          appendChat((room.chat ??= []), m);
          await this.persist();
          for (const ws of this.ctx.getWebSockets()) {
            const att = ws.deserializeAttachment() as Attachment | null;
            if (getsChat(att)) {
              this.send(ws, { type: "chat", messages: [m], append: true });
              if (att?.playerId) this.send(ws, { type: "notice", text });
            }
          }
          return { ok: true };
        }
        case "access": {
          const base = s.access ?? DEFAULT_ACCESS;
          const next = sanitizeAccess({ ...base, ...a.access }, base, true);
          // „Dauerraum“ aufheben: zurück auf eine normale Lebensdauer
          if (base.life === "forever" && a.access?.life && a.access.life !== "forever") next.life = sanitizeAccess({ life: a.access.life }).life;
          room.state = { ...s, access: next };
          // Kein Anklopfen mehr: wer vor der Tür steht, kommt herein, sobald er neu verbindet – bis dahin bleibt der Eintrag
          await this.persist(true);
          this.broadcast();
          return { ok: true };
        }
        case "host": {
          if (!s.players.some((p) => p.id === a.id)) return { ok: false, error: "Diesen Spieler gibt es nicht (mehr)." };
          room.state = { ...s, hostId: a.id };
          await this.persist(true);
          this.broadcast();
          return { ok: true };
        }
        case "kick": {
          room.state = applyRoomAction(s, { type: "removePlayer", id: a.id }, a.id === actor ? a.id : actor);
          this.kick(a.id);
          await this.persist(true);
          this.broadcast();
          return { ok: true };
        }
        case "lobby": {
          if (s.phase !== "playing") return { ok: true };
          room.state = applyRoomAction(s, { type: "toLobby" }, actor);
          await this.persist(true);
          this.broadcast();
          return { ok: true };
        }
        case "addBots": {
          const n = Math.max(1, Math.min(10, Math.floor(Number(a.n) || 1)));
          const hadHost = s.hostId;
          let next = s;
          const names = new Set([...s.players, ...(s.bench ?? [])].map((p) => p.name.toLowerCase()));
          for (let i = 0, k = 1; i < n; k++) {
            if (names.has(`bot ${k}`)) continue;
            const id = `${BOT_PREFIX}${crypto.randomUUID().slice(0, 8)}`;
            next = addPlayer(next, { id, name: `Bot ${k}` });
            next.bots = [...(next.bots ?? []), id];
            if (isBotLevel(a.level) && a.level !== "zufall") next.botLevels = { ...next.botLevels, [id]: a.level };
            names.add(`bot ${k}`);
            i++;
          }
          // Wer zuerst als Mensch hereinkommt, wird Host – nicht ein Bot
          if (!hadHost) next.hostId = null;
          room.state = next;
          room.test = true;
          await this.persist(true);
          this.broadcast();
          return { ok: true };
        }
        case "botMove": {
          if (!s.bots?.includes(a.id)) return { ok: false, error: "Das ist kein Testspieler." };
          if (!(await this.botStep(a.id))) return { ok: false, error: "Der Bot kann gerade nichts tun." };
          return { ok: true };
        }
        case "takeOver": {
          if (!s.bots?.includes(a.id)) return { ok: false, error: "Das ist kein Testspieler." };
          // Ab jetzt spielt das Admin-Gerät für ihn – er zieht nicht mehr von selbst
          room.state = { ...s, bots: s.bots.filter((id) => id !== a.id) };
          const token = crypto.randomUUID();
          room.tokens[a.id] = token;
          await this.persist(true);
          this.broadcast();
          return { ok: true, creds: { playerId: a.id, token } };
        }
        case "pin": {
          const pin = String(a.pin ?? "");
          if (!PIN_RE.test(pin)) return { ok: false, error: "Die PIN muss 4 bis 8 Ziffern haben." };
          room.pinHash = await hashPin(room.salt, pin);
          room.fails = 0;
          room.lockUntil = 0;
          await this.persist(true);
          return { ok: true };
        }
      }
    } catch (e) {
      return { ok: false, error: e instanceof GameError ? e.message : "Das ging gerade nicht." };
    }
    return { ok: false, error: "Unbekannte Aktion." };
  }

  async info(): Promise<RoomInfo> {
    if (!this.room) return { exists: false };
    const s = this.room.state;
    return { exists: true, gameId: s.gameId, name: s.access?.name, phase: s.phase, knock: s.access?.admission === "knock" || undefined };
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.room) return new Response("Raum nicht gefunden", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket erwartet", { status: 426 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    // Zuschauen der Verwaltung: nur über den inneren Pfad, den der Worker nach der Anmeldeprüfung nutzt
    const watch = new URL(request.url).pathname === WATCH_PATH;
    server.serializeAttachment({ playerId: null, ...(watch ? { watch: true } : {}) } satisfies Attachment);
    // Version des Servers: ist das Gerät älter, lädt es an einem ruhigen Moment neu
    this.send(server, { type: "hello", build: BUILD, protocol: PROTOCOL });
    if (watch) {
      this.send(server, { type: "chat", messages: this.room.chat ?? [] });
      this.sendWatch(server);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.room) {
      this.send(ws, { type: "error", message: "Den Raum gibt es nicht mehr.", code: "rejected", fatal: true });
      ws.close(4404, "gone");
      return;
    }
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    // Fotos dürfen größer sein (bis PHOTO_MAX_BYTES) – alles andere bleibt klein. Zu groß: Bescheid geben statt still verwerfen.
    if (text.length > (text.startsWith('{"type":"photo"') ? PHOTO_MAX_B64 + 100 : MAX_MESSAGE_BYTES)) {
      this.send(ws, { type: "error", message: "Das war zu groß." });
      return;
    }
    // Falls die automatische Antwort nicht greift (lokal), selbst antworten
    if (text === PING) { try { ws.send(PONG); } catch { /* weg */ } return; }

    // Zentral prüfen: Typen, Längen, erlaubte Werte (shared/platform/parse.ts)
    let msg: ClientMessage | null = null;
    try { msg = parseClientMessage(JSON.parse(text)); } catch { msg = null; }
    if (!msg) {
      this.healthDelta.bad++;
      this.send(ws, { type: "error", message: "Ungültige Nachricht." });
      return;
    }

    // Wer zuschaut, liest nur mit
    if ((ws.deserializeAttachment() as Attachment | null)?.watch) return;

    await this.expireKnocks();

    if (msg.type === "join") {
      await this.handleJoin(ws, msg);
      return;
    }
    if (msg.type === "table") {
      await this.handleTable(ws, msg);
      return;
    }

    const att = ws.deserializeAttachment() as Attachment | null;
    const playerId = att?.playerId;
    if (!playerId || !inRoom(this.room.state, playerId)) {
      this.send(ws, { type: "error", message: "Bitte tritt dem Raum zuerst bei.", code: "not_joined", fatal: true });
      return;
    }

    // Begleit-Handy koppeln: kurzer Einmal-Code für genau diesen Spieler
    if (msg.type === "pair") {
      const now = Date.now();
      const code = randomCode(8);
      const live = Object.entries(this.room.pairs ?? {}).filter(([, p]) => p.until > now);
      this.room.pairs = Object.fromEntries([...live, [code, { id: playerId, until: now + PAIR_MS }]].slice(-20));
      await this.ctx.storage.put("room", this.room);
      this.send(ws, { type: "paired", code, until: now + PAIR_MS });
      return;
    }

    // Fernbedienung: der Host steuert den Fernseher (Ton, Musik, Hand verdecken) – geht nur an die Tische
    if (msg.type === "remote") {
      if (playerId !== this.room.state.hostId) return;
      const by = this.room.state.players.find((p) => p.id === playerId)?.name ?? "";
      for (const w of this.ctx.getWebSockets()) {
        if ((w.deserializeAttachment() as Attachment | null)?.table) this.send(w, { type: "remote", cmd: msg.cmd, by });
      }
      return;
    }

    if (msg.type === "photo") {
      await this.setPhoto(ws, playerId, msg.data);
      return;
    }

    if (msg.type === "closeRoom") {
      if (playerId !== this.room.state.hostId) {
        this.send(ws, { type: "error", message: "Das darf nur der Host." });
        return;
      }
      await this.destroy("Der Host hat den Raum geschlossen.");
      return;
    }

    if (msg.type === "call") {
      const call = (this.room.call ??= {});
      const was = call[playerId];
      if (msg.session === null) delete call[playerId];
      else {
        // Nur Sitzungen, die dieser Spieler über unseren Server angelegt hat
        if (typeof msg.session !== "string" || !CALL_SESSION_RE.test(msg.session) || this.room.callSessions?.[msg.session] !== playerId) return;
        const track = (t: unknown) => (typeof t === "string" && CALL_TRACK_RE.test(t) ? t : undefined);
        call[playerId] = { session: msg.session, audio: track(msg.audio), video: track(msg.video), mic: msg.mic !== false, cam: msg.cam === true };
      }
      await this.persist();
      this.broadcast();
      const now = call[playerId];
      if (now && !was) await this.feature("call");
      if (now?.cam && !was?.cam) await this.feature("video");
      return;
    }

    if (msg.type === "chat") {
      const now = Date.now();
      // Bremse gegen Spam: höchstens 6 Nachrichten in 8 Sekunden je Spieler
      const times = (this.chatTimes[playerId] ??= []).filter((t) => now - t < 8000);
      if (times.length >= 6) { this.send(ws, { type: "error", message: "Nicht so schnell – kurz warten." }); return; }
      const chat = (this.room.chat ??= []);
      const m = chatMessage(msg, playerId, now, chat);
      if (!m) return;
      times.push(now);
      this.chatTimes[playerId] = times;
      appendChat(chat, m);
      await this.persist();
      for (const s of this.ctx.getWebSockets()) {
        const att = s.deserializeAttachment() as Attachment | null;
        if (getsChat(att)) this.send(s, { type: "chat", messages: [m], append: true });
        else if (att?.table && m.emoji) this.send(s, { type: "react", from: m.from, emoji: m.emoji });
      }
      await this.feature("chat");
      return;
    }

    if (msg.type === "presence") {
      // Nur melden, wenn sich etwas geändert hat (z. B. ein Handy still weggefallen ist)
      if ([...this.onlineIds()].sort().join() !== this.lastOnline) this.broadcast();
      // Raumverzeichnis frisch halten, solange jemand da ist
      await this.report(false);
      return;
    }

    if (msg.type === "knock") {
      await this.answerKnock(ws, playerId, msg);
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
      const id = typeof msg.id === "string" && ACTION_ID_RE.test(msg.id) ? msg.id : null;
      const seen = (this.room.seen ??= {});
      if (id && seen[playerId]?.includes(id)) {
        // Schon ausgeführt, nur die Bestätigung ging verloren
        this.send(ws, { type: "ack", id, rev: this.room.rev ?? 0 });
        this.sendState(ws, playerId);
        return;
      }
      const before = this.room.state;
      let config: SiteConfig | null = null;
      // Spielwechsel in der Lobby: Admin-Freigaben gelten auch hier
      if (msg.action.type === "selectGame" && isGameId(msg.action.gameId)) {
        config = await settingsOf(this.env).config();
        const access = accessFor(config, msg.action.gameId);
        if (access === "off" || (access === "code" && !this.room.unlocked)) {
          this.send(ws, { type: "error", message: access === "off" ? "Dieses Spiel ist gerade abgeschaltet." : "Dafür braucht ihr den Zugangscode.", id: id ?? undefined });
          return;
        }
      }
      try {
        this.room.state = applyRoomAction(this.room.state, msg.action, playerId);
        // Anderes Spiel gewählt: Standard-Einstellungen des Admins übernehmen
        const now = this.room.state;
        if (config && now.gameId !== before.gameId) now.options = withDefaults(roomGame(now).settings, now.options, config.defaults?.[now.gameId]);
      } catch (e) {
        // Kennzahl: welche Art von Zug abgelehnt wurde (Spielaktion mit ihrem Typ)
        const a = msg.action as { type: string; action?: { type?: unknown } };
        const kind = a.type === "game" && typeof a.action?.type === "string" ? `${this.room.state.gameId}:${a.action.type}` : a.type;
        this.healthDelta.rejected[kind.slice(0, 40)] = (this.healthDelta.rejected[kind.slice(0, 40)] ?? 0) + 1;
        this.send(ws, { type: "error", message: e instanceof GameError ? e.message : "Das ging gerade nicht.", id: id ?? undefined });
        return;
      }
      if (id) seen[playerId] = [...(seen[playerId] ?? []), id].slice(-30);
      if (msg.action.type === "removePlayer") this.kick(msg.action.id);
      const kind = msg.action.type;
      await this.persist(["start", "restart", "toLobby", "selectGame", "removePlayer"].includes(kind));
      if (id) this.send(ws, { type: "ack", id, rev: this.room.rev ?? 0 });
      this.broadcast();
      if (kind === "start" || kind === "restart") await this.count("started");
      // Früher nicht angekommene Ergebnisse nachreichen
      if (this.room.results?.length) await this.flushResults();
      await this.recordIfFinished(before);
    }
  }

  /** Partie gerade zu Ende gegangen: zählen und Ergebnisse in die Profile der Mitspieler schreiben */
  private async recordIfFinished(before: RoomState): Promise<void> {
    const room = this.room;
    const now = room?.state;
    if (!room || !now || now.phase !== "playing" || !now.game) return;
    const logic = roomGame(now);
    const was = before.phase === "playing" && before.game && before.gameId === now.gameId && before.round === now.round && logic.isOver(before.game);
    if (was || !logic.isOver(now.game)) return;
    await this.count("finished");
    // Testräume schreiben nichts in Profile und Gruppen
    if (room.test || !logic.results || !room.profiles) return;
    const ctx = { players: now.players, hostId: now.hostId, actorId: null, options: now.options, now: Date.now() };
    const jobs = resultJobs(room, now.gameId, now.round, logic.results(now.game, ctx), Date.now());
    // Erst merken, dann schreiben – was schiefgeht, versucht der Raum später nochmal
    room.results = [...(room.results ?? []), ...jobs].slice(-60);
    await this.ctx.storage.put("room", room);
    await this.flushResults();
  }

  /** Offene Ergebnisse an Profile und Gruppen schicken; was nicht ankommt, bleibt für den nächsten Versuch */
  private async flushResults(): Promise<void> {
    const room = this.room;
    if (!room?.results?.length) return;
    const left: ResultJob[] = [];
    for (const j of room.results) {
      try {
        if (j.kind === "profile") await this.env.PROFILES.get(this.env.PROFILES.idFromName(j.target)).record(j.entry, j.target, j.event);
        else await groupOf(this.env, j.target).recordOnline(j.gameId, j.entries, j.event);
      } catch {
        // höchstens einen Tag lang wiederholen – Statistik ist nur ein Extra
        if (Date.now() - j.since < 86_400_000) left.push(j);
      }
    }
    room.results = left.length ? left : undefined;
    await this.ctx.storage.put("room", room);
  }

  /** Avatar und Gruppe beim (Wieder-)Beitritt übernehmen. true, wenn sich etwas geändert hat. */
  private async applyExtras(playerId: string, msg: Extract<ClientMessage, { type: "join" }>): Promise<boolean> {
    // Erst nachfragen, dann ändern – während des Wartens kann sich der Raum schon geändert haben
    const pid = this.room?.profiles?.[playerId];
    const code = typeof msg.group === "string" && GROUP_CODE_RE.test(msg.group) ? msg.group : null;
    let member: string | null = null;
    if (code && pid) { try { member = await groupOf(this.env, code).memberOf(pid); } catch { /* egal */ } }
    const room = this.room;
    if (!room || !inRoom(room.state, playerId)) return false;
    const state = room.state;
    const before = JSON.stringify([state.avatars?.[playerId], state.members?.[playerId], room.groups?.[playerId]]);
    const avatar = sanitizeAvatar(msg.avatar);
    if (avatar) state.avatars = { ...state.avatars, [playerId]: avatar };
    if (member && code) {
      state.members = { ...state.members, [playerId]: member };
      room.groups = { ...room.groups, [playerId]: code };
    } else {
      if (state.members?.[playerId]) { state.members = { ...state.members }; delete state.members[playerId]; }
      if (room.groups?.[playerId]) delete room.groups[playerId];
    }
    return JSON.stringify([state.avatars?.[playerId], state.members?.[playerId], room.groups?.[playerId]]) !== before;
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code, reason); } catch { /* bereits geschlossen */ }
    // Ohne Verbindung auch raus aus dem Sprachchat (beim Wiederverbinden meldet sich das Handy neu an)
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.playerId && this.room?.call?.[att.playerId] && !this.onlineIds().has(att.playerId)) {
      delete this.room.call[att.playerId];
      await this.persist();
    }
    // Gast vor der Tür hat die Verbindung verloren: Eintrag bleibt kurz stehen (Funkloch), erst danach fällt er weg
    const gone = att?.knock ? this.room?.knocks?.find((k) => k.id === att.knock) : undefined;
    if (gone && !this.knockSocket(gone.id)) {
      gone.goneAt = Date.now();
      await this.persist();
    }
    this.broadcast(ws);
    // Raum ist leer geworden: ab jetzt läuft die Lebensdauer; Verzeichnis gleich Bescheid geben
    if (this.room && this.onlineIds().size === 0) {
      await this.scheduleEnd();
      await this.report(true);
    }
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

  /** Lebensdauer abgelaufen: Ist jemand da, verlängern – sonst den Raum löschen (Dauerräume bleiben). */
  async alarm(): Promise<void> {
    if (!this.room) return;
    if (this.room.results?.length) await this.flushResults();
    const ms = await this.lifeMs();
    if (ms === null) return;
    if (this.onlineIds().size > 0) { await this.ctx.storage.setAlarm(Date.now() + ms); return; }
    const life = this.room.state.access?.life;
    const label = life && life !== "forever" && ms === LIFE_MS[life] ? LIFE_LABEL[life] : `${Math.round(ms / 3_600_000)} Stunden`;
    await this.destroy(`Der Raum war ${label} leer und ist abgelaufen.`);
  }

  /** Letztes Foto je Spieler (Zeitpunkt) – höchstens eins alle paar Sekunden */
  private photoAt = new Map<string, number>();

  /**
   * Eigenes Foto setzen oder entfernen: nur für sich selbst, nur echte Bilddateien bis PHOTO_MAX_BYTES.
   * Gespeichert unter r/<Raum-Objekt>/<Zufall> – den Namen sehen nur Leute im Raum.
   */
  private async setPhoto(ws: WebSocket, playerId: string, data: string | null): Promise<void> {
    const room = this.room!;
    const bucket = this.env.FILES;
    if (!bucket) { this.send(ws, { type: "error", message: "Fotos sind gerade nicht möglich." }); return; }
    const now = Date.now();
    if (now - (this.photoAt.get(playerId) ?? 0) < 3000) { this.send(ws, { type: "error", message: "Einen Moment – gleich geht es wieder." }); return; }
    this.photoAt.set(playerId, now);
    const old = room.state.photos?.[playerId];
    let key: string | null = null;
    if (data !== null) {
      const bytes = fromBase64(data);
      const type = bytes ? photoType(bytes) : null;
      if (!bytes || !type || bytes.length > PHOTO_MAX_BYTES) { this.send(ws, { type: "error", message: "Das Bild ging nicht – bitte ein Foto (JPEG, PNG oder WebP) nehmen." }); return; }
      const rand = [...crypto.getRandomValues(new Uint8Array(20))].map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
      key = `r/${this.ctx.id.toString()}/${rand}`;
      try { await bucket.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: "private, max-age=31536000, immutable" } }); }
      catch { this.send(ws, { type: "error", message: "Das Foto konnte gerade nicht gespeichert werden." }); return; }
    }
    const photos = { ...room.state.photos };
    if (key) photos[playerId] = key; else delete photos[playerId];
    room.state = { ...room.state, photos };
    if (!Object.keys(photos).length) delete room.state.photos;
    await this.persist();
    this.broadcast();
    if (old) try { await bucket.delete(old); } catch { /* räumt das Raumende weg */ }
  }

  /** Alle Fotos dieses Raums aus R2 löschen */
  private async deletePhotos(): Promise<void> {
    const bucket = this.env.FILES;
    if (!bucket) return;
    try {
      const prefix = `r/${this.ctx.id.toString()}/`;
      for (let i = 0; i < 10; i++) {
        const list = await bucket.list({ prefix, limit: 500 });
        if (list.objects.length) await bucket.delete(list.objects.map((o) => o.key));
        if (!list.truncated) break;
      }
    } catch { /* nur ein Extra */ }
  }

  /** Alle rauswerfen und sämtliche gespeicherten Daten des Raums löschen. */
  private async destroy(message: string): Promise<void> {
    const code = this.room?.code;
    // Verlauf: Raum ist zu (Namen bleiben dort bis zur eingestellten Frist)
    if (code && this.room) { try { await settingsOf(this.env).roomEnded(code, this.room.createdAt); } catch { /* nur ein Extra */ } }
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, { type: "error", code: "closed", fatal: true, message });
      try { ws.close(4410, "closed"); } catch { /* egal */ }
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    await this.deletePhotos();
    this.room = null;
    if (code) try { await settingsOf(this.env).roomGone(code); } catch { /* Übersicht räumt beim Anzeigen selbst auf */ }
  }

  /** PIN prüfen – nach zu vielen Fehlversuchen ist der Raum eine Weile gesperrt. Meldet den Fehler selbst. */
  private async checkPin(ws: WebSocket, raw: unknown): Promise<boolean> {
    const room = this.room!;
    if (Date.now() < room.lockUntil) {
      this.send(ws, { type: "error", code: "locked", fatal: true, message: "Zu viele falsche PINs. Versuch es in ein paar Minuten nochmal." });
      return false;
    }
    const pin = String(raw ?? "");
    if (!PIN_RE.test(pin) || (await hashPin(room.salt, pin)) !== room.pinHash) {
      room.fails++;
      const locked = room.fails >= MAX_PIN_FAILS;
      if (locked) { room.lockUntil = Date.now() + LOCK_MS; room.fails = 0; }
      await this.persist(locked);
      this.send(ws, { type: "error", code: "bad_pin", fatal: true, message: "Die PIN stimmt nicht." });
      return false;
    }
    room.fails = 0;
    return true;
  }

  /** Großer Tisch: ein Bildschirm für alle meldet sich mit der PIN an und liest danach nur mit – wie die Verwaltung beim Zuschauen */
  private async handleTable(ws: WebSocket, msg: Extract<ClientMessage, { type: "table" }>): Promise<void> {
    if (!(await this.checkPin(ws, msg.pin))) return;
    ws.serializeAttachment({ playerId: null, watch: true, table: true } satisfies Attachment);
    // Kein Chatverlauf: der Tisch zeigt keinen Chat, und den Bildschirm sieht jeder im Raum
    this.sendWatch(ws);
    // Die Handys erfahren, dass es jetzt einen Fernseher gibt (Fernbedienung)
    this.broadcast();
  }

  private async handleJoin(ws: WebSocket, raw: Extract<ClientMessage, { type: "join" }>): Promise<void> {
    const room = this.room!;
    // Profil nur mit passendem Geräteschlüssel übernehmen (sonst könnte jeder fremde Statistiken füllen)
    let msg = raw;
    if (typeof msg.profile === "string" && !(msg.playerId && room.profiles?.[msg.playerId] === msg.profile)) {
      const ok = PROFILE_ID_RE.test(msg.profile) && typeof msg.profileKey === "string"
        && await this.env.PROFILES.get(this.env.PROFILES.idFromName(msg.profile)).owns(msg.profileKey).catch(() => false);
      if (!ok) msg = { ...msg, profile: undefined };
    }

    // Entfernt: Auch ein Wiederverbinden (oder derselbe Beitritt nochmal) bringt niemanden zurück –
    // sonst kommt ein Handy, das gerade neu verbindet, mit Name + PIN einfach wieder herein
    const nonceId = joinedAs(typeof msg.nonce === "string" ? room.joins?.[msg.nonce] : undefined);
    if ((msg.playerId && room.kicked?.includes(msg.playerId)) || (nonceId && room.kicked?.includes(nonceId))) {
      this.send(ws, { type: "error", code: "kicked", fatal: true, message: "Du wurdest aus dem Raum entfernt." });
      return;
    }

    // Begleit-Handy: mit gültigem Kopplungs-Code als zweites Gerät desselben Spielers (Code gilt nur einmal)
    // (Schon gekoppelt und mit Token unterwegs: normal wiederverbinden – der Code läuft nach fünf Minuten ab)
    const hasToken = !!(msg.playerId && msg.token && room.tokens[msg.playerId] === msg.token);
    if (typeof msg.pairCode === "string" && !hasToken) {
      const pair = PAIR_CODE_RE.test(msg.pairCode) ? room.pairs?.[msg.pairCode] : undefined;
      const now = Date.now();
      // Einmal eingelöst, gilt der Code nur noch für denselben Tab (Funkloch, doppelter Aufbau) – nicht für andere Geräte
      const other = pair?.usedBy !== undefined && pair.usedBy !== (msg.nonce ?? null);
      if (!pair || pair.until < now || other || !room.tokens[pair.id] || !inRoom(room.state, pair.id)) {
        this.send(ws, { type: "error", code: "rejected", fatal: true, message: "Der Kopplungs-Code ist abgelaufen. Lass dir am Rechner einen neuen zeigen." });
        return;
      }
      if (pair.usedBy === undefined) { pair.usedBy = msg.nonce ?? null; await this.ctx.storage.put("room", room); }
      ws.serializeAttachment({ playerId: pair.id, companion: true } satisfies Attachment);
      this.dropOldSockets(pair.id, ws);
      this.send(ws, { type: "joined", playerId: pair.id, token: room.tokens[pair.id] });
      this.send(ws, { type: "chat", messages: room.chat ?? [] });
      this.broadcast();
      return;
    }

    // Wiederverbinden mit Token (ohne PIN)
    if (msg.playerId && msg.token && room.tokens[msg.playerId] === msg.token
        && inRoom(room.state, msg.playerId)) {
      this.healthDelta.reconnects++;
      // Begleit-Handy bleibt Begleit-Handy (sonst würde es den Rechner desselben Spielers verdrängen)
      ws.serializeAttachment({ playerId: msg.playerId, ...(msg.companion ? { companion: true } : {}) } satisfies Attachment);
      this.dropOldSockets(msg.playerId, ws);
      let changed = false;
      if (typeof msg.profile === "string" && PROFILE_ID_RE.test(msg.profile) && room.profiles?.[msg.playerId] !== msg.profile) {
        (room.profiles ??= {})[msg.playerId] = msg.profile;
        changed = true;
      }
      if (await this.applyExtras(msg.playerId, msg)) changed = true;
      if (changed) await this.persist();
      this.send(ws, { type: "joined", playerId: msg.playerId, token: msg.token });
      this.send(ws, { type: "chat", messages: room.chat ?? [] });
      this.broadcast();
      return;
    }

    if (!(await this.checkPin(ws, msg.pin))) return;

    // Derselbe Beitritt nochmal (Antwort ging unterwegs verloren): keinen zweiten Spieler anlegen.
    // Nur kurz danach und nur mit richtiger PIN – eine bekannt gewordene Nonce ist kein Zugang.
    const nonce = typeof msg.nonce === "string" && ACTION_ID_RE.test(msg.nonce) ? msg.nonce : null;
    const again = retryJoin(room.joins, nonce, Date.now());
    if (again && room.tokens[again] && inRoom(room.state, again)) {
      ws.serializeAttachment({ playerId: again } satisfies Attachment);
      this.dropOldSockets(again, ws);
      this.send(ws, { type: "joined", playerId: again, token: room.tokens[again] });
      this.send(ws, { type: "chat", messages: room.chat ?? [] });
      this.broadcast();
      return;
    }

    // Grenze aus den Admin-Einstellungen
    try {
      const max = (await settingsOf(this.env).config()).limits.maxPlayers;
      if (room.state.players.length + (room.state.bench?.length ?? 0) >= max) {
        this.send(ws, { type: "error", code: "rejected", fatal: true, message: `Der Raum ist voll (höchstens ${max} Leute).` });
        return;
      }
    } catch { /* ohne Einstellungen gilt die eingebaute Grenze */ }

    // Einlass mit Anklopfen: erst prüfen, ob der Beitritt überhaupt ginge, dann vor der Tür warten.
    // Ist gerade niemand da, der öffnen könnte (z. B. der Ersteller selbst), reicht die PIN.
    if (room.state.access?.admission === "knock" && this.onlineIds().size > 0) {
      try { addPlayer(room.state, { id: "probe", name: msg.name ?? "" }); } catch (e) {
        this.send(ws, { type: "error", code: "rejected", fatal: true, message: e instanceof GameError ? e.message : "Beitritt nicht möglich." });
        return;
      }
      const profile = typeof msg.profile === "string" && PROFILE_ID_RE.test(msg.profile) ? msg.profile : undefined;
      const key = profile ?? cleanName(msg.name).toLowerCase();
      if ((room.denied?.[key] ?? 0) > Date.now()) {
        this.send(ws, { type: "error", code: "denied", fatal: true, message: "Du wurdest gerade nicht hereingelassen. Versuch es in einer Minute nochmal." });
        return;
      }
      const knocks = (room.knocks ??= []);
      // Dasselbe Handy klopft nochmal (neu verbunden): Eintrag behalten, nur die Verbindung tauschen
      const same = knocks.find((k) => (nonce && k.nonce === nonce) || (profile && k.profile === profile));
      // Während des Funklochs eingelassen: jetzt direkt hinein
      if (same?.admitted) {
        room.knocks = knocks.filter((k) => k !== same);
        await this.addMember(ws, { name: same.name, profile: same.profile, avatar: same.avatar, group: same.group, nonce: same.nonce });
        return;
      }
      if (same) delete same.goneAt;
      const knock: Knock = same ?? { id: crypto.randomUUID(), name: cleanName(msg.name), at: Date.now() };
      Object.assign(knock, { name: cleanName(msg.name), avatar: msg.avatar, profile, group: typeof msg.group === "string" ? msg.group : undefined, nonce: nonce ?? undefined });
      if (!same) knocks.push(knock);
      room.knocks = knocks.slice(-10);
      for (const other of this.ctx.getWebSockets()) {
        const a = other.deserializeAttachment() as Attachment | null;
        if (other !== ws && a?.knock === knock.id) { try { other.close(4001, "replaced"); } catch { /* egal */ } }
      }
      ws.serializeAttachment({ playerId: null, knock: knock.id } satisfies Attachment);
      await this.persist();
      this.send(ws, { type: "knocking", wait: Math.max(0, KNOCK_TIMEOUT_MS - (Date.now() - knock.at)) });
      this.broadcast();
      if (!same) await this.feature("knock");
      return;
    }

    await this.addMember(ws, { name: msg.name ?? "", profile: msg.profile, avatar: msg.avatar, group: msg.group, nonce });
  }

  /** Neuen Spieler anlegen und verbinden (direkt nach der PIN oder nach dem Einlassen) */
  private async addMember(ws: WebSocket, data: { name: string; profile?: unknown; avatar?: unknown; group?: unknown; nonce?: string | null }): Promise<boolean> {
    const room = this.room!;
    const playerId = crypto.randomUUID();
    const token = crypto.randomUUID();
    try {
      room.state = addPlayer(room.state, { id: playerId, name: data.name });
    } catch (e) {
      this.send(ws, { type: "error", code: "rejected", fatal: true, message: e instanceof GameError ? e.message : "Beitritt nicht möglich." });
      return false;
    }
    room.tokens[playerId] = token;
    await this.count("players");
    if (data.nonce) room.joins = rememberJoin(room.joins, data.nonce, playerId, Date.now());
    if (typeof data.profile === "string" && PROFILE_ID_RE.test(data.profile)) (room.profiles ??= {})[playerId] = data.profile;
    await this.applyExtras(playerId, { type: "join", avatar: data.avatar as never, group: data.group as never });
    ws.serializeAttachment({ playerId } satisfies Attachment);
    await this.persist(true);
    this.healthDelta.joins++;
    this.send(ws, { type: "joined", playerId, token });
    this.send(ws, { type: "chat", messages: room.chat ?? [] });
    this.broadcast();
    return true;
  }

  /** Verbindung des wartenden Gasts */
  private knockSocket(id: string): WebSocket | null {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.knock === id && ws.readyState === WebSocket.OPEN) return ws;
    }
    return null;
  }

  /** Anklopfen beantworten: Host immer; die anderen, wenn der Host weg ist oder 30 s nicht reagiert hat */
  private async answerKnock(ws: WebSocket, playerId: string, msg: Extract<ClientMessage, { type: "knock" }>): Promise<void> {
    const room = this.room!;
    const knock = room.knocks?.find((k) => k.id === msg.id);
    if (!knock) { this.send(ws, { type: "error", message: "Darum hat sich schon jemand gekümmert." }); this.sendState(ws, playerId); return; }
    const isHost = playerId === room.state.hostId;
    const hostOnline = this.hostPresent();
    if (msg.decision === "wait") {
      if (!isHost) return;
      knock.snoozed = true;
      await this.persist();
      this.broadcast();
      return;
    }
    if (!mayAdmit({ ago: Date.now() - knock.at, snoozed: knock.snoozed }, isHost, hostOnline)) {
      this.send(ws, { type: "error", message: "Das entscheidet gerade der Host." });
      return;
    }
    const guest = this.knockSocket(knock.id);
    // Gast gerade im Funkloch: Einlassen gilt, sobald er wieder verbunden ist
    if (msg.decision === "admit" && !guest && knock.goneAt) {
      knock.admitted = true;
      await this.persist();
      this.broadcast();
      return;
    }
    room.knocks = room.knocks!.filter((k) => k.id !== knock.id);
    if (msg.decision === "deny") {
      room.denied = Object.fromEntries([...Object.entries(room.denied ?? {}).filter(([, t]) => t > Date.now()), [knock.profile ?? knock.name.toLowerCase(), Date.now() + KNOCK_DENY_MS]].slice(-40));
      if (guest) {
        this.send(guest, { type: "error", code: "denied", fatal: true, message: "Du wurdest diesmal nicht hereingelassen." });
        guest.serializeAttachment({ playerId: null } satisfies Attachment);
        try { guest.close(4403, "denied"); } catch { /* egal */ }
      }
      await this.persist();
      this.broadcast();
      return;
    }
    if (!guest) {
      await this.persist();
      this.broadcast();
      this.send(ws, { type: "error", message: `${knock.name} ist nicht mehr da.` });
      return;
    }
    if (!(await this.addMember(guest, { name: knock.name, profile: knock.profile, avatar: knock.avatar, group: knock.group, nonce: knock.nonce }))) {
      await this.persist();
      this.broadcast();
    }
  }

  /** Wer zu lange vor der Tür steht, bekommt eine freundliche Absage – nichts bleibt hängen */
  private async expireKnocks(): Promise<void> {
    const room = this.room;
    if (!room?.knocks?.length) return;
    const now = Date.now();
    const old = room.knocks.filter((k) => now - k.at >= KNOCK_TIMEOUT_MS || (k.goneAt !== undefined && now - k.goneAt >= KNOCK_GRACE_MS));
    if (!old.length) return;
    room.knocks = room.knocks.filter((k) => !old.includes(k));
    for (const k of old) {
      const guest = this.knockSocket(k.id);
      if (!guest) continue;
      this.send(guest, { type: "error", code: "no_answer", fatal: true, message: "Gerade kann dich niemand hereinlassen. Versuch es später noch einmal." });
      guest.serializeAttachment({ playerId: null } satisfies Attachment);
      try { guest.close(4408, "timeout"); } catch { /* egal */ }
    }
    await this.persist();
    this.broadcast();
  }

  /** Eine neue Verbindung desselben Spielers ersetzt alte, halb tote Verbindungen */
  /** Ältere Verbindungen desselben Spielers schließen – das Begleit-Handy und der Rechner zählen getrennt */
  private dropOldSockets(playerId: string, keep: WebSocket): void {
    const companion = !!(keep.deserializeAttachment() as Attachment | null)?.companion;
    for (const other of this.ctx.getWebSockets()) {
      if (other === keep) continue;
      const att = other.deserializeAttachment() as Attachment | null;
      if (att?.playerId === playerId && !!att.companion === companion) { try { other.close(4001, "replaced"); } catch { /* schon zu */ } }
    }
  }

  private kick(playerId: string): void {
    if (!this.room) return;
    delete this.room.tokens[playerId];
    this.room.kicked = [...(this.room.kicked ?? []).filter((id) => id !== playerId), playerId].slice(-40);
    if (this.room.profiles) delete this.room.profiles[playerId];
    if (this.room.groups) delete this.room.groups[playerId];
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
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att?.playerId || ws.readyState !== WebSocket.OPEN) continue;
      // Handys schicken alle paar Sekunden einen Herzschlag. Bleibt er aus, ist die Verbindung tot – auch wenn sie noch „offen“ aussieht.
      const beat = this.ctx.getWebSocketAutoResponseTimestamp(ws);
      if (beat && now - beat.getTime() > STALE_MS) continue;
      online.add(att.playerId);
    }
    return online;
  }

  /** Wann der Host zuletzt verbunden war (nur im Speicher) */
  private hostSeenAt = 0;
  /** Host da – oder erst so kurz weg, dass es ein Funkloch sein kann */
  private hostPresent(): boolean {
    const host = this.room?.state.hostId;
    if (!host) return false;
    if (this.onlineIds().has(host)) { this.hostSeenAt = Date.now(); return true; }
    return Date.now() - this.hostSeenAt < HOST_AWAY_MS;
  }

  /** Spieler, deren Begleit-Handy gerade verbunden ist – ihr Rechner bietet dann „Karten nur am Handy“ an */
  private pairedIds(gone?: WebSocket): Set<string> {
    const ids = new Set<string>();
    for (const w of this.ctx.getWebSockets()) {
      if (w === gone) continue;
      const att = w.deserializeAttachment() as Attachment | null;
      if (att?.companion && att.playerId && w.readyState === WebSocket.OPEN) ids.add(att.playerId);
    }
    return ids;
  }

  /** Hängt gerade ein Großer Tisch (Fernseher) am Raum? Die Handys zeigen dann die Fernbedienung. */
  private hasTable(gone?: WebSocket): boolean {
    return this.ctx.getWebSockets().some((w) => w !== gone && (w.deserializeAttachment() as Attachment | null)?.table);
  }

  private broadcast(gone?: WebSocket): void {
    if (!this.room) return;
    const sockets = this.ctx.getWebSockets();
    const tv = this.hasTable(gone) || undefined;
    // Bots sind immer „da“ (für die Anzeige; die Lebensdauer des Raums hängt nur an echten Verbindungen)
    const onlineList = [...this.onlineIds(), ...(this.room.state.bots ?? [])];
    this.scheduleBots();
    if (this.room.state.hostId && onlineList.includes(this.room.state.hostId)) this.hostSeenAt = Date.now();
    this.lastOnline = [...onlineList].sort().join();
    const paired = this.pairedIds(gone);
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.watch) { this.sendWatch(ws, onlineList); continue; }
      if (!att?.playerId) continue;
      this.send(ws, { type: "state", state: viewRoom(this.room.state, att.playerId), you: att.playerId, online: onlineList, call: this.room.call ?? {}, knocks: this.knockViews(), rev: this.room.rev ?? 0, tv, paired: (!att.companion && paired.has(att.playerId)) || undefined });
    }
  }

  private knockViews(): KnockView[] | undefined {
    const now = Date.now();
    const list = (this.room?.knocks ?? []).filter((k) => !k.admitted)
      .map((k) => ({ id: k.id, name: k.name, avatar: sanitizeAvatar(k.avatar) ?? undefined, ago: now - k.at, snoozed: k.snoozed || undefined, away: k.goneAt !== undefined || undefined }));
    return list.length ? list : undefined;
  }

  private sendState(ws: WebSocket, playerId: string): void {
    if (!this.room) return;
    this.send(ws, { type: "state", state: viewRoom(this.room.state, playerId), you: playerId, online: [...this.onlineIds()], call: this.room.call ?? {}, knocks: this.knockViews(), rev: this.room.rev ?? 0, tv: this.hasTable() || undefined,
      paired: (!(ws.deserializeAttachment() as Attachment | null)?.companion && this.pairedIds().has(playerId)) || undefined });
  }

  /** Bots: kurz nach jeder Änderung zieht einer von ihnen, solange die Partie läuft und jemand zuschaut */
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private scheduleBots(): void {
    const s = this.room?.state;
    if (this.botTimer || !s?.bots?.length || s.phase !== "playing") return;
    // Ohne echte Verbindung ruhen die Bots – so bleibt ein leerer Testraum nicht ewig wach
    if (this.onlineIds().size === 0) return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      void (async () => {
        for (const id of shuffle(this.room?.state.bots ?? [])) if (await this.botStep(id)) return;
      })();
    }, 900 + Math.floor(Math.random() * 900));
  }

  /** Ein Zug eines Bots wie eine normale Aktion: speichern, zählen, allen schicken. false, wenn er nichts tun kann. */
  private async botStep(id: string): Promise<boolean> {
    const room = this.room;
    if (!room) return false;
    const before = room.state;
    const res = playBot(before, id, true, room.code ?? "");
    if (!res) return false;
    room.state = res.next;
    await this.persist();
    this.broadcast();
    await this.recordIfFinished(before);
    return true;
  }

  /** Für die Verwaltung: Sicht eines Gasts ohne eigene Karten, dazu wer online ist und wer klopft */
  private sendWatch(ws: WebSocket, online = [...this.onlineIds(), ...(this.room?.state.bots ?? [])]): void {
    if (!this.room) return;
    this.send(ws, { type: "state", state: viewRoom(this.room.state, WATCH_ID), you: WATCH_ID, online, call: this.room.call ?? {}, knocks: this.knockViews(), rev: this.room.rev ?? 0 });
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try { ws.send(JSON.stringify(msg)); } catch { /* Verbindung weg */ }
  }

  /** Speichern und die Lebensdauer neu starten. `important`: Übersicht sofort aktualisieren. */
  private async persist(important = false): Promise<void> {
    if (!this.room) return;
    this.room.updatedAt = Date.now();
    // Neuer Raumzustand (Spielzug, Beitritt, Einstellung …): Revision hochzählen
    if (this.room.state !== this.savedState) { this.room.rev = (this.room.rev ?? 0) + 1; this.savedState = this.room.state; }
    await this.ctx.storage.put("room", this.room);
    await this.scheduleEnd();
    await this.report(important);
  }

  /** Wecker für das Ende des Raums: Lebensdauer ab jetzt (Dauerräume ohne Wecker) */
  private async scheduleEnd(): Promise<void> {
    const ms = await this.lifeMs();
    if (ms === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Date.now() + ms);
  }

  /** Kurzinfo an Übersicht und Raumverzeichnis – sonst höchstens alle 30 Sekunden, außer der Raum wird leer bzw. wieder belebt */
  private lastCount = -1;
  private async report(force: boolean): Promise<void> {
    const info = await this.summary();
    if (!info) return;
    // Kennzahlen gebündelt mitschicken (nicht jede einzeln)
    const h = this.healthDelta;
    if ((h.reconnects || h.joins || h.bad || Object.keys(h.rejected).length) && (force || Date.now() - this.lastReport >= REPORT_MS)) {
      this.healthDelta = emptyHealth();
      if (!this.room?.test) try { await settingsOf(this.env).health(h); } catch { /* nur ein Extra */ }
    }
    const count = info.card?.online ?? 0;
    const flipped = (count === 0) !== (this.lastCount === 0);
    if (!force && !flipped && Date.now() - this.lastReport < REPORT_MS) return;
    this.lastReport = Date.now();
    this.lastCount = count;
    try { await settingsOf(this.env).roomReport(info); } catch { /* nur ein Extra */ }
  }

  /** Statistik: Raum angelegt, Partie gestartet oder beendet */
  private async count(kind: StatKind): Promise<void> {
    if (!this.room || this.room.test) return;
    try { await settingsOf(this.env).count(this.room.state.gameId, kind, this.room.code); } catch { /* nur ein Extra */ }
  }

  /** Statistik: eine Funktion wurde benutzt (Anruf, Kamera, Chat, Anklopfen, privater Raum) */
  private async feature(kind: FeatureKind): Promise<void> {
    if (!this.room || this.room.test) return;
    try { await settingsOf(this.env).feature(kind); } catch { /* nur ein Extra */ }
  }

  /** Obergrenze des Admins (alle paar Minuten neu gelesen) */
  private maxHours = ROOM_TTL_MS / 3_600_000;
  private maxAt = 0;
  /** Wie lange der Raum leer bestehen bleibt (ms), null = Dauerraum */
  private async lifeMs(): Promise<number | null> {
    if (Date.now() - this.maxAt > 5 * 60 * 1000) {
      try { this.maxHours = (await settingsOf(this.env).config()).limits.roomHours; } catch { /* alter Wert */ }
      this.maxAt = Date.now();
    }
    return lifeMs(this.room?.state.access, this.maxHours);
  }
}
