import type { Avatar } from "./avatar";
import type { RoomAction, RoomState } from "./room";
import type { KnockView } from "./directory";
import type { BuildInfo } from "../build";

/**
 * Version des Nachrichtenformats zwischen Gerät und Server. Erhöhen, wenn alte Geräte neue Nachrichten nicht mehr
 * verstehen (oder umgekehrt) – dann laden Geräte mit anderer Version sofort neu statt an einem ruhigen Moment.
 * Weitere Versionen: Build (shared/build.ts), Raum-Schema (RoomState.v), Spielstand je Spiel (GameLogic.version) –
 * siehe docs/entwicklung.md, „Versionen und Updates“.
 */
export const PROTOCOL = 1;

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
export const PIN_RE = /^\d{4,8}$/;

export type ClientMessage =
  | { type: "join"; name?: string; pin?: string; playerId?: string; token?: string; /** Profil-ID für die Statistik (optional) */ profile?: string;
      /** Geräteschlüssel des Profils – ohne ihn zählt das Profil nicht */ profileKey?: string;
      /** Avatar und aktive Gruppe (optional) – die Gruppe bekommt das Ergebnis mit */ avatar?: Avatar; group?: string;
      /** Zufallswert je Beitritt: geht die Antwort verloren und das Handy versucht es nochmal, entsteht kein zweiter Spieler */ nonce?: string }
  /** `id`: eindeutig je Aktion – wird sie nach einem Abbruch nochmal geschickt, führt der Server sie nur einmal aus */
  | { type: "action"; action: RoomAction; id?: string }
  /** Host: fragt regelmäßig, wer noch da ist (stille Verbindungsabbrüche erkennen) */
  | { type: "presence" }
  /** Nur Host: Raum sofort und endgültig löschen */
  | { type: "closeRoom" }
  /** Host-Rolle übernehmen – nur, wenn der Host gerade nicht verbunden ist */
  | { type: "claimHost" }
  /** Sprach-/Videochat: eigene Sitzung und Spuren bekanntgeben (session null = verlassen) */
  | { type: "call"; session: string | null; audio?: string; video?: string; mic?: boolean; cam?: boolean }
  /** Text-Chat: Nachricht oder schnelle Reaktion (Emoji). `id` macht doppeltes Senden harmlos. */
  | { type: "chat"; id: string; text?: string; emoji?: string }
  /** Anklopfen beantworten: einlassen, ablehnen oder „Moment“ (nur der Host; dann vertritt ihn niemand) */
  | { type: "knock"; id: string; decision: "admit" | "deny" | "wait" }
  /** Großer Tisch: Bildschirm für alle meldet sich mit der Raum-PIN an und liest danach nur mit */
  | { type: "table"; pin: string };

/** Eine Chat-Nachricht im Raum */
export interface ChatMsg {
  id: string;
  from: string;
  at: number;
  text?: string;
  /** schnelle Reaktion statt Text */
  emoji?: string;
}
export const CHAT_MAX = 300;
export const CHAT_KEEP = 100;
/** Schnelle Reaktionen – bewusst wenige, gut für den Spieltisch */
export const CHAT_EMOJIS = ["👍", "😂", "😮", "😡", "🎉", "🍀", "🙈", "❤️"] as const;

/** Wer im Sprach-/Videochat ist und welche Spuren er beim SFU veröffentlicht hat */
export interface CallPeer {
  session: string;
  audio?: string;
  video?: string;
  mic: boolean;
  cam: boolean;
}

export const CALL_SESSION_RE = /^[A-Za-z0-9_-]{8,128}$/;
export const CALL_TRACK_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type ErrorCode = "bad_pin" | "locked" | "kicked" | "not_joined" | "rejected" | "closed" | "denied" | "no_answer";

export type ServerMessage =
  /** Gleich nach dem Verbinden: welche Version der Server hat und welches Protokoll er spricht */
  | { type: "hello"; build: BuildInfo; protocol: number }
  | { type: "joined"; playerId: string; token: string }
  | { type: "state"; state: RoomState; you: string; online: string[]; call?: Record<string, CallPeer>; /** wer gerade anklopft */ knocks?: KnockView[];
      /** Revision des Raums – ein Stand mit kleinerer Revision als der zuletzt gesehene ist veraltet */ rev?: number }
  /** An den Gast: PIN stimmt, jetzt wartet er auf Einlass (`wait`: so lange höchstens noch, ms) */
  | { type: "knocking"; wait: number }
  /** Aktion angekommen (oder schon früher ausgeführt) */
  | { type: "ack"; id: string; rev?: number }
  /** Chat: beim Beitreten die letzten Nachrichten, danach jeweils die neue */
  | { type: "chat"; messages: ChatMsg[]; append?: boolean }
  /** Nachricht der Verwaltung an alle im Raum */
  | { type: "notice"; text: string }
  | { type: "error"; message: string; code?: ErrorCode; fatal?: boolean; /** gehört zu dieser Aktion */ id?: string };

/** Herzschlag als reiner Text – der Server antwortet, ohne aufzuwachen */
export const PING = "ping";
export const PONG = "pong";
/** Gilt eine Verbindung als tot, wenn so lange kein Herzschlag kam (Server-Sicht) */
export const STALE_MS = 25_000;
export const ACTION_ID_RE = /^[A-Za-z0-9_-]{6,40}$/;

/** Antwort auf GET /api/rooms/:code */
export interface RoomInfo {
  exists: boolean;
  gameId?: string;
  /** Raumname und was gerade läuft – für das Beitrittsformular */
  name?: string;
  phase?: "lobby" | "playing";
  knock?: boolean;
}

// ---------- Verwaltung: Eingriffe in einen Raum ----------

/** Absender von Nachrichten der Verwaltung im Chat */
export const ADMIN_CHAT_ID = "@admin";
/** So sieht die Verwaltung beim Zuschauen den Raum: wie ein Gast ohne eigene Karten */
export const WATCH_ID = "@watch";
export const MAX_NOTICE = 200;
