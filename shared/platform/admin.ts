/**
 * Verwaltung: Typen und Regeln, die Server und Admin-Seiten teilen –
 * Räume in der Übersicht und Eingriffe, Statistik, Verlauf und Verzeichnis, Löschen.
 */
import type { RoomAccess, RoomCard, RoomLife } from "./directory";

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

// ---------- Admin: Eingriffe in einen Raum ----------

export type AdminRoomAction =
  | { type: "message"; text: string }
  | { type: "access"; access: Partial<RoomAccess> }
  | { type: "host"; id: string }
  | { type: "kick"; id: string }
  | { type: "lobby" }
  | { type: "pin"; pin: string }
  /** Entwickler-Modus: Testspieler dazu, einen sofort ziehen lassen, einen übernehmen */
  | { type: "addBots"; n: number }
  | { type: "botMove"; id: string }
  | { type: "takeOver"; id: string };

/** Einzelheiten eines Raums für die Verwaltung */
export interface AdminRoomDetail {
  code: string;
  gameId: string;
  phase: "lobby" | "playing";
  access: RoomAccess;
  hostId: string | null;
  players: { id: string; name: string; online: boolean; bench?: boolean; bot?: boolean }[];
  knocks: string[];
  locked: boolean;
  createdAt: number;
  activeAt: number;
  chat: number;
  call: number;
  /** Testraum (mit Bots) – unsichtbar unter „Offene Räume“, zählt nicht in der Statistik */
  test?: boolean;
}

/** Betriebskennzahlen eines Tages (ohne Inhalte): Verbindungen, abgelehnte Züge nach Art, kaputte Nachrichten */
export interface HealthDay {
  day: string;
  /** Beitritte mit gespeichertem Zugang (Wiederverbinden nach Funkloch, Neuladen, Update) */
  reconnects: number;
  joins: number;
  /** abgelehnte Spielzüge je Aktionstyp */
  rejected: Record<string, number>;
  /** ungültige Nachrichten (kaputt, falsche Felder) */
  bad: number;
}
export type HealthDelta = Omit<HealthDay, "day">;
export const emptyHealth = (): HealthDelta => ({ reconnects: 0, joins: 0, rejected: {}, bad: 0 });
export const HEALTH_DAYS = 14;

/** Zähler zusammenführen (neuester Tag zuerst, höchstens HEALTH_DAYS) */
export function addHealth(days: HealthDay[], d: HealthDelta, now: number): HealthDay[] {
  const day = new Date(now).toISOString().slice(0, 10);
  const list = days[0]?.day === day ? days : [{ day, ...emptyHealth() }, ...days];
  const t = { ...list[0], rejected: { ...list[0].rejected } };
  t.reconnects += d.reconnects; t.joins += d.joins; t.bad += d.bad;
  for (const [k, n] of Object.entries(d.rejected)) t.rejected[k] = (t.rejected[k] ?? 0) + n;
  return [t, ...list.slice(1)].slice(0, HEALTH_DAYS);
}
