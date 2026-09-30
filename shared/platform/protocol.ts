import type { RoomAction, RoomState } from "./room";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
export const PIN_RE = /^\d{4,8}$/;

export type ClientMessage =
  | { type: "join"; name?: string; pin?: string; playerId?: string; token?: string; /** Profil-ID für die Statistik (optional) */ profile?: string }
  | { type: "action"; action: RoomAction }
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
  | { type: "error"; message: string; code?: ErrorCode; fatal?: boolean };

/** Antwort auf GET /api/rooms/:code */
export interface RoomInfo {
  exists: boolean;
  gameId?: string;
}
