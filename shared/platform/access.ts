/**
 * Admin-Freigaben: Der ganze Spieltisch und jedes Spiel einzeln kann an sein, hinter einem Zugangscode liegen oder aus sein.
 * Die Konfiguration liegt im Worker; die Clients bekommen sie ohne Geheimnisse über /api/config.
 */
import { DEFAULT_LOOK, isLook, type LookId } from "./looks";
import { sanitizeOption } from "./room";
import type { Options, SettingDef } from "./types";
import type { RoomCard, RoomLife } from "./directory";

export type Access = "on" | "code" | "off";

export interface SiteConfig {
  site: Access;
  games: Record<string, Access>;
  /** Hinweis für Besucher, z. B. „Heute Abend ab 20 Uhr wieder offen“ */
  message: string;
  /** Gibt es einen Zugangscode? (der Code selbst verlässt nie den Server) */
  hasCode: boolean;
  /** Standard-Einstellungen pro Spiel (vom Admin, ersetzen die eingebauten Standards) */
  defaults: GameDefaults;
  /** Hinweis-Banner auf der Startseite (leer: keins) */
  banner: string;
  /** Spiele mit „Neu“-Markierung */
  featured: string[];
  /** eigene Reihenfolge in der Spielauswahl (fehlende hinten in der eingebauten Reihenfolge) */
  order: string[];
  limits: SiteLimits;
  features: SiteFeatures;
  /** Wie lange vergangene Räume im Verlauf bleiben (Tage) */
  archiveDays: number;
  /** Aussehen der Seite */
  look: LookId;
  /** Kennung des letzten kompletten Neustarts (Admin hat alles gelöscht) – Handys mit älterer Kennung starten einmal frisch */
  epoch?: string;
}

export interface SiteLimits {
  /** Leere Räume verschwinden spätestens nach so vielen Stunden (Obergrenze für die Wahl des Hosts) */
  roomHours: number;
  /** höchstens so viele Leute pro Raum */
  maxPlayers: number;
  /** höchstens so viele offene Räume gleichzeitig (0: egal) */
  maxRooms: number;
}

export interface SiteFeatures {
  /** Online-Räume (aus: nur „Ein Handy für alle“) */
  online: boolean;
  /** Audio & Video in Online-Räumen */
  call: boolean;
  groups: boolean;
  /** Profile mit Statistik */
  profiles: boolean;
  /** „Ein Handy für alle“ (lokal spielen) – standardmäßig aus, der Fokus liegt auf Online */
  local: boolean;
  /** Offline-App: Seite und Spiele für unterwegs ohne Netz zwischenspeichern – standardmäßig aus */
  offline: boolean;
}

export const DEFAULT_LIMITS: SiteLimits = { roomHours: 168, maxPlayers: 20, maxRooms: 0 };
export const DEFAULT_FEATURES: SiteFeatures = { online: true, call: true, groups: true, profiles: true, local: false, offline: false };
export const DEFAULT_ARCHIVE_DAYS = 30;
export const MAX_BANNER = 200;

/** Was der Admin unter „Einstellungen“ speichert */
export type AccessConfig = Pick<SiteConfig, "site" | "games" | "message" | "banner" | "featured" | "order" | "limits" | "features" | "archiveDays" | "look">;

export const DEFAULT_CONFIG: SiteConfig = {
  site: "on", games: {}, message: "", hasCode: false, defaults: {},
  banner: "", featured: [], order: [], limits: DEFAULT_LIMITS, features: DEFAULT_FEATURES, archiveDays: DEFAULT_ARCHIVE_DAYS, look: DEFAULT_LOOK,
};
export const ACCESS_LEVELS: readonly Access[] = ["on", "code", "off"];
export const MAX_MESSAGE = 200;
export const ACCESS_CODE_RE = /^.{4,32}$/;

const isAccess = (x: unknown): x is Access => x === "on" || x === "code" || x === "off";

/** Nimmt nur gültige Werte an – alles andere fällt auf „an“ zurück */
export function sanitizeConfig(x: unknown, gameIds: readonly string[]): AccessConfig {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const games: Record<string, Access> = {};
  const g = (o.games && typeof o.games === "object" ? o.games : {}) as Record<string, unknown>;
  for (const id of gameIds) if (isAccess(g[id]) && g[id] !== "on") games[id] = g[id] as Access;
  const num = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const l = (o.limits && typeof o.limits === "object" ? o.limits : {}) as Record<string, unknown>;
  const f = (o.features && typeof o.features === "object" ? o.features : {}) as Record<string, unknown>;
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === "string" && gameIds.includes(id)))] : []);
  return {
    site: isAccess(o.site) ? o.site : "on",
    games,
    message: typeof o.message === "string" ? o.message.slice(0, MAX_MESSAGE) : "",
    banner: typeof o.banner === "string" ? o.banner.slice(0, MAX_BANNER) : "",
    featured: ids(o.featured),
    order: ids(o.order),
    limits: {
      roomHours: num(l.roomHours, 1, 24 * 14, DEFAULT_LIMITS.roomHours),
      maxPlayers: num(l.maxPlayers, 2, 20, DEFAULT_LIMITS.maxPlayers),
      maxRooms: num(l.maxRooms, 0, 500, DEFAULT_LIMITS.maxRooms),
    },
    features: Object.fromEntries((Object.keys(DEFAULT_FEATURES) as (keyof SiteFeatures)[]).map((k) => [k, typeof f[k] === "boolean" ? f[k] : DEFAULT_FEATURES[k]])) as unknown as SiteFeatures,
    archiveDays: num(o.archiveDays, 1, 365, DEFAULT_ARCHIVE_DAYS),
    look: isLook(o.look) ? o.look : DEFAULT_LOOK,
  };
}

/** Spiele in der vom Admin gewählten Reihenfolge */
export function orderGames<T extends string>(ids: readonly T[], order: readonly string[]): T[] {
  const first = order.filter((id): id is T => ids.includes(id as T));
  return [...first, ...ids.filter((id) => !first.includes(id))];
}

/** Was gilt für ein Spiel? Der strengere Wert von Spieltisch und Spiel gewinnt. */
export function accessFor(config: Pick<SiteConfig, "site" | "games">, gameId?: string): Access {
  const game = gameId ? config.games[gameId] ?? "on" : "on";
  if (config.site === "off" || game === "off") return "off";
  if (config.site === "code" || game === "code") return "code";
  return "on";
}

// ---------- Standard-Einstellungen pro Spiel ----------

/** Vom Admin gesetzte Standardwerte: Spiel → Einstellung → Wert (nur Abweichungen vom eingebauten Standard) */
export type GameDefaults = Record<string, Options>;

/** Nimmt nur bekannte Spiele und Einstellungen an, prüft jeden Wert und lässt eingebaute Standards weg */
export function sanitizeDefaults(x: unknown, settingsOf: (gameId: string) => SettingDef[] | undefined): GameDefaults {
  const out: GameDefaults = {};
  if (!x || typeof x !== "object") return out;
  for (const [gameId, raw] of Object.entries(x as Record<string, unknown>)) {
    const defs = settingsOf(gameId);
    if (!defs || !raw || typeof raw !== "object") continue;
    const o: Options = {};
    for (const def of defs) {
      if (!Object.hasOwn(raw, def.key)) continue;
      const v = sanitizeOption(def, (raw as Record<string, unknown>)[def.key]);
      if (v !== def.default) o[def.key] = v;
    }
    if (Object.keys(o).length) out[gameId] = o;
  }
  return out;
}

/** Standardwerte des Admins über die eingebauten legen (nur bekannte Einstellungen, geprüft) */
export function withDefaults(settings: SettingDef[], options: Options, defaults: Options | undefined): Options {
  if (!defaults) return options;
  const o = { ...options };
  for (const def of settings) if (Object.hasOwn(defaults, def.key)) o[def.key] = sanitizeOption(def, defaults[def.key]);
  return o;
}

// ---------- Admin: Räume ----------

/** Kurzinfo zu einem offenen Online-Raum für die Admin-Übersicht */
export interface AdminRoom {
  code: string;
  gameId: string;
  players: { name: string; online: boolean }[];
  phase: "lobby" | "playing";
  createdAt: number;
  /** letzte Änderung (danach läuft die 48-Stunden-Frist) */
  activeAt: number;
  /** wegen zu vieler falscher PINs gesperrt */
  locked: boolean;
  /** Raumkarte für den Start-Tab (Name, Host, Avatare, Sichtbarkeit …) */
  card?: RoomCard;
  /** Gruppe des Hosts – nur für „Sichtbar für Gruppe“, geht nie an Besucher */
  groupCode?: string;
  /** Lebensdauer, wenn leer – Dauerräume verschwinden nie aus der Übersicht */
  life?: RoomLife;
}

// ---------- Admin: Statistik ----------

export type StatKind = "rooms" | "started" | "finished" | "local" | "players";
export type StatCounts = Partial<Record<StatKind, number>>;
export const STAT_KINDS: readonly StatKind[] = ["rooms", "started", "finished", "local", "players"];
export const STAT_WEEKS = 12;

/** So viele Tage Tagesstatistik */
export const STAT_DAYS = 60;

/** Gezählte Funktionen: Anruf beigetreten, Kamera an, Chat-Nachricht, Anklopfen, Gruppe angelegt, privater Raum */
export type FeatureKind = "call" | "video" | "chat" | "knock" | "group" | "private";
export const FEATURE_KINDS: readonly FeatureKind[] = ["call", "video", "chat", "knock", "group", "private"];
export type FeatureCounts = Partial<Record<FeatureKind, number>>;

export interface StatDay {
  day: string;
  games: Record<string, StatCounts>;
  /** Gestartete Partien nach Wochentag und Stunde (deutsche Zeit): Schlüssel „<0–6, Mo = 0>-<0–23>“ */
  slots?: Record<string, number>;
  features?: FeatureCounts;
}

export interface SiteStats {
  /** Neuester Tag zuerst (YYYY-MM-DD, UTC), höchstens STAT_DAYS */
  days?: StatDay[];
  /** Neueste Woche zuerst, höchstens STAT_WEEKS */
  weeks: { week: string; games: Record<string, StatCounts> }[];
  totals: Record<string, StatCounts>;
  /** seit wann gezählt wird */
  since: number;
}

export const emptySiteStats = (now: number): SiteStats => ({ weeks: [], totals: {}, since: now });

/** ISO-Kalenderwoche, z. B. „2026-W40“ (Woche mit dem Donnerstag entscheidet über das Jahr) */
export function isoWeek(ms: number): string {
  const d = new Date(ms);
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wd = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - wd);
  const year = day.getUTCFullYear();
  const week = Math.ceil(((day.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

const BERLIN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", hourCycle: "h23" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Wochentag (Mo = 0) und Stunde in deutscher Zeit, als Schlüssel „3-20“ */
export function slotOf(ms: number): string {
  const parts = BERLIN.formatToParts(new Date(ms));
  const wd = WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Mon");
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return `${Math.max(0, wd)}-${h}`;
}

/** Tag von `now` vorne anlegen (falls neu), ändern, sortieren und kürzen */
function withDay(prev: SiteStats, now: number, change: (d: StatDay) => StatDay): StatDay[] {
  const day = new Date(now).toISOString().slice(0, 10);
  const prevDays = prev.days ?? [];
  const days = prevDays.some((d) => d.day === day) ? prevDays : [{ day, games: {} }, ...prevDays];
  return days.map((d) => (d.day === day ? change(d) : d)).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, STAT_DAYS);
}

/** Zählt die Nutzung einer Funktion am Tag von `now` */
export function countFeature(prev: SiteStats, kind: FeatureKind, now: number): SiteStats {
  if (!FEATURE_KINDS.includes(kind)) return prev;
  return { ...prev, days: withDay(prev, now, (d) => ({ ...d, features: { ...d.features, [kind]: (d.features?.[kind] ?? 0) + 1 } })) };
}

/** Zählt ein Ereignis in der Woche von `now` und insgesamt; alte Wochen fallen raus */
export function countStat(prev: SiteStats, gameId: string, kind: StatKind, now: number): SiteStats {
  const week = isoWeek(now);
  const day = new Date(now).toISOString().slice(0, 10);
  const bump = (c: StatCounts | undefined): StatCounts => ({ ...c, [kind]: (c?.[kind] ?? 0) + 1 });
  const weeks = prev.weeks.some((w) => w.week === week) ? prev.weeks : [{ week, games: {} }, ...prev.weeks];
  // Spitzenzeiten: gestartete Partien (online und lokal)
  const slot = kind === "started" || kind === "local" ? slotOf(now) : null;
  return {
    since: prev.since,
    totals: { ...prev.totals, [gameId]: bump(prev.totals[gameId]) },
    weeks: weeks
      .map((w) => (w.week === week ? { week, games: { ...w.games, [gameId]: bump(w.games[gameId]) } } : w))
      .sort((a, b) => (a.week < b.week ? 1 : -1))
      .slice(0, STAT_WEEKS),
    days: withDay(prev, now, (d) => ({
      ...d,
      day,
      games: { ...d.games, [gameId]: bump(d.games[gameId]) },
      ...(slot ? { slots: { ...d.slots, [slot]: (d.slots?.[slot] ?? 0) + 1 } } : {}),
    })),
  };
}

/** Summe über alle Spiele */
export function sumStats(games: Record<string, StatCounts>): Required<StatCounts> {
  const s = { rooms: 0, started: 0, finished: 0, local: 0, players: 0 };
  for (const c of Object.values(games)) for (const k of STAT_KINDS) s[k] += c[k] ?? 0;
  return s;
}

// ---------- Admin: Verlauf und Verzeichnis ----------

/** Ein Online-Raum im Verlauf („wer war da“) – bleibt `archiveDays` nach der letzten Aktivität */
export interface ArchivedRoom {
  code: string;
  createdAt: number;
  lastAt: number;
  /** gespielte Spiele (Reihenfolge des ersten Starts) */
  games: string[];
  /** alle Namen, die im Raum waren */
  players: string[];
  /** gestartete Partien */
  partien: number;
  /** geschlossen oder abgelaufen */
  endedAt?: number;
}

export interface DirGroup { code: string; name: string; members: number; createdAt: number; lastAt: number }
export interface DirProfile { id: string; name: string; games: number; createdAt: number; lastAt: number }

/** Was der Admin auf einmal löschen kann */
export type WipeKind = "rooms" | "archive" | "stats" | "groups" | "profiles" | "settings";
export const WIPE_KINDS: readonly WipeKind[] = ["rooms", "archive", "stats", "groups", "profiles", "settings"];
