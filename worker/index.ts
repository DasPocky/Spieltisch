import { DurableObject } from "cloudflare:workers";
import { isGameId } from "../shared/games";
import { addPlayer, applyRoomAction, createRoom, viewRoom, type RoomState } from "../shared/platform/room";
import { GameError } from "../shared/platform/types";
import {
  PIN_RE, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROOM_CODE_RE,
  type ClientMessage, type RoomInfo, type ServerMessage,
} from "../shared/platform/protocol";

interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
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
  async init(pin: string, gameId: string): Promise<boolean> {
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

    if (msg.type === "action" && msg.action && typeof msg.action === "object") {
      try {
        this.room.state = applyRoomAction(this.room.state, msg.action, playerId);
      } catch (e) {
        this.send(ws, { type: "error", message: e instanceof GameError ? e.message : "Das ging gerade nicht." });
        return;
      }
      if (msg.action.type === "removePlayer") this.kick(msg.action.id);
      await this.persist();
      this.broadcast();
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code, reason); } catch { /* bereits geschlossen */ }
    this.broadcast();
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
    ws.serializeAttachment({ playerId } satisfies Attachment);
    await this.persist();
    this.send(ws, { type: "joined", playerId, token });
    this.broadcast();
  }

  private kick(playerId: string): void {
    if (!this.room) return;
    delete this.room.tokens[playerId];
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.playerId === playerId) {
        this.send(ws, { type: "error", code: "kicked", fatal: true, message: "Du wurdest aus dem Raum entfernt." });
        ws.serializeAttachment({ playerId: null } satisfies Attachment);
        try { ws.close(4403, "kicked"); } catch { /* egal */ }
      }
    }
  }

  private broadcast(): void {
    if (!this.room) return;
    const sockets = this.ctx.getWebSockets();
    const online = new Set<string>();
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.playerId && ws.readyState === WebSocket.OPEN) online.add(att.playerId);
    }
    const onlineList = [...online];
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att?.playerId) continue;
      this.send(ws, { type: "state", state: viewRoom(this.room.state, att.playerId), you: att.playerId, online: onlineList });
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

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    // Raum anlegen
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let body: { pin?: unknown; game?: unknown };
      try { body = await request.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
      const pin = String(body.pin ?? "");
      if (!PIN_RE.test(pin)) return json({ error: "Die PIN muss 4 bis 8 Ziffern haben." }, 400);
      if (!isGameId(body.game)) return json({ error: "Unbekanntes Spiel." }, 400);
      const gameId = body.game;

      for (let i = 0; i < 6; i++) {
        const code = makeCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await stub.init(pin, gameId)) return json({ code }, 201);
      }
      return json({ error: "Gerade ist kein Raumcode frei. Versuch es gleich nochmal." }, 503);
    }

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
