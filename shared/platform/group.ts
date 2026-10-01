/**
 * Feste Gruppen (Spielerunden): Name, Mitglieder mit Avatar und eine Bestenliste je Spiel.
 * Beitritt mit Gruppencode bzw. Einladungslink – ohne Passwort, jedes Mitglied darf alles (einfaches Vertrauensmodell).
 * Mitglieder haben eine eigene, öffentliche Mitglieds-ID. Die Profil-ID bleibt auf dem Server.
 */
import { ROOM_CODE_ALPHABET } from "./protocol";
import { cleanName } from "./room";

export const GROUP_CODE_LENGTH = 6;
export const GROUP_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const MEMBER_ID_RE = /^[A-HJ-NP-Z2-9]{8}$/;
export const MAX_MEMBERS = 30;
export const MAX_GROUP_NAME = 20;
/** Höchstens so viele Spieler in einem gemeldeten Ergebnis */
export const MAX_RESULT_PLAYERS = 20;

// ----- Avatare -----

/** Gedämpfte Farben, die auf hellem und dunklem Grund funktionieren */
export const AVATAR_COLORS = [
  "#c96a72", "#cf8a5c", "#c4a457", "#97a55a", "#68a57b", "#5c9e95",
  "#5aa0bd", "#5b80c6", "#7a74c6", "#a173bd", "#c674a0", "#7f8ba1",
] as const;
export const AVATAR_EMOJIS = [
  "🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵",
  "🐔", "🐧", "🦉", "🐙", "🦄", "🐝", "🐢", "🐳", "😎", "🤓", "🥳", "🤠",
] as const;

export interface Avatar {
  /** Index in AVATAR_COLORS */
  color: number;
  /** Index in AVATAR_EMOJIS */
  emoji: number;
}

/** Avatar aus Eingaben prüfen – null, wenn es keiner ist */
export function sanitizeAvatar(x: unknown): Avatar | null {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const { color, emoji } = o;
  if (!Number.isInteger(color) || !Number.isInteger(emoji)) return null;
  if ((color as number) < 0 || (color as number) >= AVATAR_COLORS.length) return null;
  if ((emoji as number) < 0 || (emoji as number) >= AVATAR_EMOJIS.length) return null;
  return { color: color as number, emoji: emoji as number };
}

/** Fester Start-Avatar aus einer ID (jedes Gerät hat so gleich einen eigenen) */
export function defaultAvatar(seed: string): Avatar {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return { color: h % AVATAR_COLORS.length, emoji: (h >>> 8) % AVATAR_EMOJIS.length };
}

// ----- Gruppe -----

export interface GroupMember {
  id: string;
  name: string;
  avatar: Avatar;
  joinedAt: number;
}

export interface WinStats { played: number; won: number }

/** Was Mitglieder von einer Gruppe sehen (ohne Profil-IDs) */
export interface GroupView {
  code: string;
  name: string;
  createdAt: number;
  members: GroupMember[];
  /** Mitglieds-ID → Spiel → Partien und Siege */
  stats: Record<string, Record<string, WinStats>>;
  /** eigene Mitglieds-ID */
  you: string;
}

/** Nicht-Mitglieder (Einladungslink) sehen nur Name und Größe */
export interface GroupPreview {
  code: string;
  name: string;
  count: number;
  full: boolean;
}

/** Gruppe auf dem Server: zusätzlich Profil-ID → Mitglieds-ID */
export interface GroupData extends Omit<GroupView, "you"> {
  keys: Record<string, string>;
}

/** Zufällige Zeichen aus dem Raumcode-Alphabet (32 Zeichen – ohne Modulo-Verzerrung) */
export function randomCode(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

export const cleanGroupName = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_GROUP_NAME);

export function newGroup(code: string, name: string, now: number): GroupData {
  return { code, name: cleanGroupName(name) || "Unsere Runde", createdAt: now, members: [], stats: {}, keys: {} };
}

/** Mitglied aufnehmen bzw. Name/Avatar aktualisieren. Gibt die Mitglieds-ID zurück. */
export function upsertMember(g: GroupData, profileId: string, name: unknown, avatar: unknown, now: number, makeId = () => randomCode(8)): string {
  const clean = cleanName(name);
  if (!clean) throw new Error("Bitte gib einen Namen ein.");
  const av = sanitizeAvatar(avatar) ?? defaultAvatar(profileId);
  const known = g.keys[profileId];
  const m = known ? g.members.find((x) => x.id === known) : undefined;
  if (m) { m.name = clean; m.avatar = av; return m.id; }
  if (g.members.length >= MAX_MEMBERS) throw new Error(`Eine Gruppe hat höchstens ${MAX_MEMBERS} Mitglieder.`);
  let id = makeId();
  while (g.members.some((x) => x.id === id)) id = makeId();
  g.members.push({ id, name: clean, avatar: av, joinedAt: now });
  g.keys[profileId] = id;
  return id;
}

/** Mitglied entfernen (samt Statistik) */
export function removeMember(g: GroupData, memberId: string): boolean {
  const i = g.members.findIndex((m) => m.id === memberId);
  if (i < 0) return false;
  g.members.splice(i, 1);
  delete g.stats[memberId];
  for (const [pid, mid] of Object.entries(g.keys)) if (mid === memberId) delete g.keys[pid];
  return true;
}

export interface GroupResult { gameId: string; players: { id: string; won: boolean }[] }

/** Lokales Ergebnis prüfen: bekanntes Spiel, nur Mitglieder, jeder höchstens einmal */
export function sanitizeGroupResult(x: unknown, gameIds: readonly string[], memberIds: readonly string[]): GroupResult | null {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  if (typeof o.gameId !== "string" || !gameIds.includes(o.gameId)) return null;
  if (!Array.isArray(o.players) || !o.players.length || o.players.length > MAX_RESULT_PLAYERS) return null;
  const seen = new Set<string>();
  const players: GroupResult["players"] = [];
  for (const p of o.players as unknown[]) {
    const q = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    if (typeof q.id !== "string" || !memberIds.includes(q.id) || seen.has(q.id)) return null;
    seen.add(q.id);
    players.push({ id: q.id, won: q.won === true });
  }
  return { gameId: o.gameId, players };
}

/** Ergebnis eintragen: Partie für alle, Sieg für die Gewinner */
export function addGroupResult(g: GroupData, r: GroupResult): void {
  for (const p of r.players) {
    if (!g.members.some((m) => m.id === p.id)) continue;
    const s = ((g.stats[p.id] ??= {})[r.gameId] ??= { played: 0, won: 0 });
    s.played++;
    if (p.won) s.won++;
  }
}

export interface BoardRow { member: GroupMember; played: number; won: number; rate: number }

/** Bestenliste – über alle Spiele (gameId null) oder für ein Spiel. Erst Siege, dann Quote, dann weniger Partien. */
export function leaderboard(g: Pick<GroupView, "members" | "stats">, gameId: string | null): BoardRow[] {
  return g.members.map((member) => {
    const games = g.stats[member.id] ?? {};
    const list = gameId === null ? Object.values(games) : games[gameId] ? [games[gameId]] : [];
    const played = list.reduce((n, s) => n + s.played, 0);
    const won = list.reduce((n, s) => n + s.won, 0);
    return { member, played, won, rate: played ? won / played : 0 };
  }).sort((a, b) => b.won - a.won || b.rate - a.rate || a.played - b.played || a.member.name.localeCompare(b.member.name, "de"));
}

/** Spiele, die in der Gruppe schon gespielt wurden – meistgespielte zuerst */
export function playedGames(g: Pick<GroupView, "stats">): string[] {
  const count: Record<string, number> = {};
  for (const games of Object.values(g.stats)) for (const [id, s] of Object.entries(games)) count[id] = (count[id] ?? 0) + s.played;
  return Object.keys(count).filter((id) => count[id] > 0).sort((a, b) => count[b] - count[a]);
}

/** Sicht eines Mitglieds */
export function viewGroup(g: GroupData, memberId: string): GroupView {
  const { keys: _keys, ...rest } = g;
  return { ...structuredClone(rest), you: memberId };
}

export function previewGroup(g: GroupData): GroupPreview {
  return { code: g.code, name: g.name, count: g.members.length, full: g.members.length >= MAX_MEMBERS };
}
