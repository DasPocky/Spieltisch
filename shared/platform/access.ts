/**
 * Admin-Freigaben: Der ganze Spieltisch und jedes Spiel einzeln kann an sein, hinter einem Zugangscode liegen oder aus sein.
 * Die Konfiguration liegt im Worker; die Clients bekommen sie ohne Geheimnisse über /api/config.
 */
import { DEFAULT_LOOK, isLook, type LookId } from "./looks";
import { sanitizeOption } from "./room";
import type { Options, SettingDef } from "./types";
import { DEFAULT_UPDATE, sanitizeUpdate, type UpdateConfig } from "./update";
import { EMPTY_NEWS, sanitizeNews, type NewsOverrides } from "../news";

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
  /** Wann neue Versionen live gehen */
  update: UpdateConfig;
  /** „Was ist neu?“: ausgeblendete und geänderte Einträge */
  news: NewsOverrides;
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
export type AccessConfig = Pick<SiteConfig, "site" | "games" | "message" | "banner" | "featured" | "order" | "limits" | "features" | "archiveDays" | "look" | "update" | "news">;

export const DEFAULT_CONFIG: SiteConfig = {
  site: "on", games: {}, message: "", hasCode: false, defaults: {},
  banner: "", featured: [], order: [], limits: DEFAULT_LIMITS, features: DEFAULT_FEATURES, archiveDays: DEFAULT_ARCHIVE_DAYS, look: DEFAULT_LOOK,
  update: DEFAULT_UPDATE, news: EMPTY_NEWS,
};
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
    update: sanitizeUpdate(o.update),
    news: sanitizeNews(o.news),
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
