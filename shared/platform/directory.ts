/**
 * Raumverzeichnis: wer einen Raum sehen darf, wie man hineinkommt, wie lange er leer bestehen bleibt –
 * und die Kurzinfo („Raumkarte“), die Start-Tab und Admin-Übersicht davon zeigen.
 */
import { sanitizeAvatar, type Avatar } from "./avatar";

/** Wer den Raum in „Offene Räume“ sieht */
export type Visibility = "all" | "group" | "none";
/** Wie man hineinkommt: nur PIN oder PIN und Anklopfen */
export type Admission = "pin" | "knock";
/** Wie lange ein leerer Raum bestehen bleibt; „forever“ nur für Dauerräume des Admins */
export type RoomLife = "hour" | "day" | "week" | "forever";

export const VISIBILITIES: readonly Visibility[] = ["all", "group", "none"];
export const ADMISSIONS: readonly Admission[] = ["pin", "knock"];
export const HOST_LIVES: readonly Exclude<RoomLife, "forever">[] = ["hour", "day", "week"];

export const LIFE_MS: Record<Exclude<RoomLife, "forever">, number> = { hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000 };
export const LIFE_LABEL: Record<RoomLife, string> = { hour: "1 Stunde", day: "1 Tag", week: "1 Woche", forever: "dauerhaft" };
export const VISIBILITY_LABEL: Record<Visibility, string> = { all: "Alle", group: "Gruppe", none: "Niemand" };
export const ADMISSION_LABEL: Record<Admission, string> = { pin: "PIN", knock: "PIN und Anklopfen" };

export const MAX_ROOM_NAME = 24;

/** Einstellungen des Raums, die der Host jederzeit ändern kann (Dauerräume: Lebensdauer bleibt) */
export interface RoomAccess {
  /** frei wählbarer Name, z. B. „Donnerstagsrunde“ */
  name?: string;
  visibility: Visibility;
  admission: Admission;
  life: RoomLife;
}

export const DEFAULT_ACCESS: RoomAccess = { visibility: "all", admission: "pin", life: "hour" };

export const cleanRoomName = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_ROOM_NAME);

/** Eingaben prüfen; `forever` nur, wenn ausdrücklich erlaubt (Admin) bzw. schon so (Dauerraum bleibt Dauerraum) */
export function sanitizeAccess(raw: unknown, base: RoomAccess = DEFAULT_ACCESS, allowForever = false): RoomAccess {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T) => (list.includes(v as T) ? (v as T) : fallback);
  const name = o.name === undefined ? base.name : cleanRoomName(o.name) || undefined;
  const life: RoomLife = base.life === "forever" && !allowForever ? "forever"
    : allowForever && o.life === "forever" ? "forever"
    : pick(o.life, HOST_LIVES, base.life === "forever" ? "hour" : base.life);
  return {
    ...(name ? { name } : {}),
    visibility: pick(o.visibility, VISIBILITIES, base.visibility),
    admission: pick(o.admission, ADMISSIONS, base.admission),
    life,
  };
}

/** Wie lange ein leerer Raum bleibt (ms), null = für immer. `maxHours`: Obergrenze des Admins */
export function lifeMs(access: RoomAccess | undefined, maxHours: number): number | null {
  const cap = maxHours * 3_600_000;
  if (!access) return cap;
  if (access.life === "forever") return null;
  return Math.min(LIFE_MS[access.life], cap);
}

/** Kurzinfo eines Raums für den Start-Tab */
export interface RoomCard {
  code: string;
  name?: string;
  host?: string;
  gameId: string;
  phase: "lobby" | "playing";
  /** Nur Treffpunkt (kein Spiel ausgesucht bzw. Treffpunkt-Ansicht) */
  meet: boolean;
  players: { name: string; avatar?: Avatar; online: boolean }[];
  /** gerade verbunden */
  online: number;
  /** jemand per Video oder Sprache drin */
  live: boolean;
  visibility: Visibility;
  admission: Admission;
  /** Dauerraum des Admins */
  permanent?: boolean;
  /** Testraum mit Bots (Entwickler-Modus) – erscheint nie unter „Offene Räume“ */
  test?: boolean;
  activeAt: number;
  /** Gehört zur eigenen Gruppe (nur bei „Offene Räume“) */
  group?: boolean;
}

/** Karte aus fremden Daten wieder lesbar machen (Antwort des Servers ist geprüft, aber sicher ist sicher) */
export function sanitizeCard(raw: unknown): RoomCard | null {
  const o = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!o || typeof o.code !== "string" || typeof o.gameId !== "string") return null;
  const players = Array.isArray(o.players) ? o.players.slice(0, 20).map((p) => {
    const q = (p ?? {}) as Record<string, unknown>;
    return { name: String(q.name ?? "").slice(0, 16), avatar: sanitizeAvatar(q.avatar) ?? undefined, online: q.online === true };
  }) : [];
  return {
    code: o.code, gameId: o.gameId,
    name: typeof o.name === "string" ? cleanRoomName(o.name) || undefined : undefined,
    host: typeof o.host === "string" ? o.host.slice(0, 16) : undefined,
    phase: o.phase === "playing" ? "playing" : "lobby",
    meet: o.meet === true, players, online: Number(o.online) || 0, live: o.live === true,
    visibility: VISIBILITIES.includes(o.visibility as Visibility) ? (o.visibility as Visibility) : "all",
    admission: o.admission === "knock" ? "knock" : "pin",
    permanent: o.permanent === true, activeAt: Number(o.activeAt) || 0, group: o.group === true,
  };
}

/** Anklopfen: so lange wartet ein Gast höchstens, danach darf jeder im Raum einlassen, wenn der Host nicht reagiert */
export const KNOCK_TIMEOUT_MS = 2 * 60_000;
export const KNOCK_DELEGATE_MS = 30_000;
/** Abgelehnt: so lange kein neues Anklopfen */
export const KNOCK_DENY_MS = 60_000;
/** Funkloch beim Gast: so lange bleibt sein Anklopfen stehen (und ein Einlassen gilt beim Wiederverbinden) */
export const KNOCK_GRACE_MS = 20_000;
/** Funkloch beim Host: erst nach so langer Zeit ohne Verbindung dürfen die anderen für ihn entscheiden */
export const HOST_AWAY_MS = 15_000;

/** Wer gerade anklopft (für alle im Raum sichtbar) */
export interface KnockView {
  id: string;
  name: string;
  avatar?: Avatar;
  /** seit so vielen ms (zum Zeitpunkt des Sendens) */
  ago: number;
  /** Host hat „Moment“ gesagt – dann entscheidet nur er */
  snoozed?: boolean;
  /** Verbindung des Gasts ist gerade kurz weg */
  away?: boolean;
}

/** Darf diese Person über ein Anklopfen entscheiden? `hostOnline`: verbunden oder erst kurz weg (HOST_AWAY_MS) */
export function mayAdmit(k: Pick<KnockView, "ago" | "snoozed">, isHost: boolean, hostOnline: boolean): boolean {
  if (isHost) return true;
  if (!hostOnline) return true;
  return !k.snoozed && k.ago >= KNOCK_DELEGATE_MS;
}
