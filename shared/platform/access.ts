/**
 * Admin-Freigaben: Der ganze Spieltisch und jedes Spiel einzeln kann an sein, hinter einem Zugangscode liegen oder aus sein.
 * Die Konfiguration liegt im Worker; die Clients bekommen sie ohne Geheimnisse über /api/config.
 */
import { sanitizeOption } from "./room";
import type { Options, SettingDef } from "./types";

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
}

/** Was der Admin unter „Freigaben“ speichert */
export type AccessConfig = Pick<SiteConfig, "site" | "games" | "message">;

export const DEFAULT_CONFIG: SiteConfig = { site: "on", games: {}, message: "", hasCode: false, defaults: {} };
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
  return {
    site: isAccess(o.site) ? o.site : "on",
    games,
    message: typeof o.message === "string" ? o.message.slice(0, MAX_MESSAGE) : "",
  };
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
}

// ---------- Admin: Statistik ----------

export type StatKind = "rooms" | "started" | "finished" | "local";
export type StatCounts = Partial<Record<StatKind, number>>;
export const STAT_KINDS: readonly StatKind[] = ["rooms", "started", "finished", "local"];
export const STAT_WEEKS = 12;

export interface SiteStats {
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

/** Zählt ein Ereignis in der Woche von `now` und insgesamt; alte Wochen fallen raus */
export function countStat(prev: SiteStats, gameId: string, kind: StatKind, now: number): SiteStats {
  const week = isoWeek(now);
  const bump = (c: StatCounts | undefined): StatCounts => ({ ...c, [kind]: (c?.[kind] ?? 0) + 1 });
  const weeks = prev.weeks.some((w) => w.week === week) ? prev.weeks : [{ week, games: {} }, ...prev.weeks];
  return {
    since: prev.since,
    totals: { ...prev.totals, [gameId]: bump(prev.totals[gameId]) },
    weeks: weeks
      .map((w) => (w.week === week ? { week, games: { ...w.games, [gameId]: bump(w.games[gameId]) } } : w))
      .sort((a, b) => (a.week < b.week ? 1 : -1))
      .slice(0, STAT_WEEKS),
  };
}

/** Summe über alle Spiele */
export function sumStats(games: Record<string, StatCounts>): Required<StatCounts> {
  const s = { rooms: 0, started: 0, finished: 0, local: 0 };
  for (const c of Object.values(games)) for (const k of STAT_KINDS) s[k] += c[k] ?? 0;
  return s;
}
