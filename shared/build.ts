/** Stand des Codes, beim Bauen eingesetzt (vite.config.ts) – Commit, Zweig und Bauzeit */
export interface BuildInfo { sha: string; branch: string; time: string }

declare const __BUILD__: BuildInfo | undefined;

export const BUILD: BuildInfo = typeof __BUILD__ !== "undefined" ? __BUILD__ : { sha: "dev", branch: "", time: "" };

/** Öffentliches Repository – sein main-Zweig ist, was live gehen soll */
export const REPO = "DasPocky/Spieltisch";

/** Kostenloses Kontingent für Worker-Anfragen pro Tag */
export const FREE_REQUESTS = 100_000;

/** Antwort von /api/admin/status */
export interface ServerStatus {
  build: BuildInfo;
  now: number;
  services: { realtime: boolean; realtimeFake: boolean; password: boolean };
  /** Worker-Anfragen heute (UTC), ungefähr – gezählt seit `since` */
  requests: { day: string; count: number; since: number };
  rooms: number;
  connections: number;
}
