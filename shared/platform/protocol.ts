import type { RoomAction, RoomState } from "./room";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
export const PIN_RE = /^\d{4,8}$/;

export type ClientMessage =
  | { type: "join"; name?: string; pin?: string; playerId?: string; token?: string; /** Profil-ID für die Statistik (optional) */ profile?: string;
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
  | { type: "call"; session: string | null; audio?: string; video?: string; mic?: boolean; cam?: boolean };

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

export type ErrorCode = "bad_pin" | "locked" | "kicked" | "not_joined" | "rejected" | "closed";

export type ServerMessage =
  | { type: "joined"; playerId: string; token: string }
  | { type: "state"; state: RoomState; you: string; online: string[]; call?: Record<string, CallPeer> }
  /** Aktion angekommen (oder schon früher ausgeführt) */
  | { type: "ack"; id: string }
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
}
