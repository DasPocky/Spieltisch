/**
 * Spielerprofile ohne Registrierung: Jedes Gerät bekommt eine zufällige Profil-ID (wie ein geheimer Schlüssel).
 * Damit führt der Server eine kleine Statistik pro Spiel. Wer die ID kennt, kann das Profil auf ein
 * anderes Gerät übernehmen – deshalb wird sie nur dem Besitzer gezeigt.
 */
import { ROOM_CODE_ALPHABET } from "./protocol";

export const PROFILE_ID_LENGTH = 16;
export const PROFILE_ID_RE = /^[A-HJ-NP-Z2-9]{16}$/;
export const MAX_RECENT = 30;

export interface GameStats {
  played: number;
  won: number;
  /** höchste Punktzahl (bei Spielen mit Punkten) */
  best?: number;
  /** Summe der Punkte – für den Durchschnitt */
  total?: number;
  /** wie viele Partien Punkte hatten */
  scored?: number;
}

export interface RecentGame {
  gameId: string;
  at: number;
  won: boolean;
  score?: number;
  players: number;
  online: boolean;
}

export interface ProfileStats {
  name: string;
  createdAt: number;
  games: Record<string, GameStats>;
  recent: RecentGame[];
}

export const emptyStats = (now: number): ProfileStats => ({ name: "", createdAt: now, games: {}, recent: [] });

/** Neue Profil-ID: 16 Zeichen aus 32 (80 Bit Zufall), ohne Verwechslungsgefahr 0/O/1/I */
export function makeProfileId(): string {
  const bytes = new Uint8Array(PROFILE_ID_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

/** Zum Anzeigen in Vierergruppen: ABCD-EFGH-JKLM-NPQR */
export const formatProfileId = (id: string) => id.match(/.{1,4}/g)?.join("-") ?? id;
/** Eingabe säubern: Bindestriche, Leerzeichen, Kleinbuchstaben egal */
export const parseProfileId = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Ein Ergebnis in die Statistik aufnehmen (reine Funktion – Server und Tests nutzen sie) */
export function addResult(stats: ProfileStats, r: RecentGame): ProfileStats {
  const s = structuredClone(stats);
  const g = (s.games[r.gameId] ??= { played: 0, won: 0 });
  g.played++;
  if (r.won) g.won++;
  if (typeof r.score === "number" && Number.isFinite(r.score)) {
    g.best = Math.max(g.best ?? r.score, r.score);
    g.total = (g.total ?? 0) + r.score;
    g.scored = (g.scored ?? 0) + 1;
  }
  s.recent.unshift(r);
  if (s.recent.length > MAX_RECENT) s.recent.length = MAX_RECENT;
  return s;
}

/** Eingaben vom Client prüfen (lokale Partien melden ihr Ergebnis selbst) */
export function sanitizeResult(x: unknown, gameIds: readonly string[], now: number): RecentGame | null {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  if (typeof o.gameId !== "string" || !gameIds.includes(o.gameId)) return null;
  const players = Number(o.players);
  const score = o.score === undefined || o.score === null ? undefined : Number(o.score);
  if (!Number.isInteger(players) || players < 1 || players > 20) return null;
  if (score !== undefined && (!Number.isFinite(score) || Math.abs(score) > 1_000_000)) return null;
  return { gameId: o.gameId, at: now, won: o.won === true, score, players, online: false };
}
