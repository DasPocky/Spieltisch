/**
 * Admin-Freigaben: Der ganze Spieltisch und jedes Spiel einzeln kann an sein, hinter einem Zugangscode liegen oder aus sein.
 * Die Konfiguration liegt im Worker; die Clients bekommen sie ohne Geheimnisse über /api/config.
 */
export type Access = "on" | "code" | "off";

export interface SiteConfig {
  site: Access;
  games: Record<string, Access>;
  /** Hinweis für Besucher, z. B. „Heute Abend ab 20 Uhr wieder offen“ */
  message: string;
  /** Gibt es einen Zugangscode? (der Code selbst verlässt nie den Server) */
  hasCode: boolean;
}

export const DEFAULT_CONFIG: SiteConfig = { site: "on", games: {}, message: "", hasCode: false };
export const ACCESS_LEVELS: readonly Access[] = ["on", "code", "off"];
export const MAX_MESSAGE = 200;
export const ACCESS_CODE_RE = /^.{4,32}$/;

const isAccess = (x: unknown): x is Access => x === "on" || x === "code" || x === "off";

/** Nimmt nur gültige Werte an – alles andere fällt auf „an“ zurück */
export function sanitizeConfig(x: unknown, gameIds: readonly string[]): Omit<SiteConfig, "hasCode"> {
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
