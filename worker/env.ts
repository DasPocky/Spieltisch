/** Bindungen und Secrets des Workers, dazu die Kurzwege zu den Durable Objects */
import type { GameRoom } from "./rooms";
import type { SiteSettings } from "./settings";
import type { ProfileStore } from "./profiles";
import type { GroupStore } from "./groups";
import type { RateLimit } from "./http";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  SETTINGS: DurableObjectNamespace<SiteSettings>;
  PROFILES: DurableObjectNamespace<ProfileStore>;
  GROUPS: DurableObjectNamespace<GroupStore>;
  /** Admin-Passwort – als Secret in Cloudflare gesetzt. Fehlt es, ist der Admin-Bereich aus. */
  ADMIN_PASSWORD?: string;
  /** Cloudflare Realtime (Sprach-/Videochat): App-ID und App-Token. Fehlen sie, ist der Chat aus. */
  REALTIME_APP_ID?: string;
  REALTIME_APP_TOKEN?: string;
  /** Nur für lokale Tests: SFU-Antworten simulieren statt Cloudflare zu fragen */
  REALTIME_FAKE?: string;
  /** Updates: Zeitpunkt fest vorgeben (now, round, idle, time, manual) – überschreibt die Admin-Einstellung */
  UPDATE_MODE?: string;
  /** Secret: damit meldet der Build neue Versionen an (/api/release) */
  RELEASE_SECRET?: string;
  /** Secret: Cloudflare-API-Token zum Freischalten wartender Versionen (Recht „Workers Scripts: Edit“) */
  DEPLOY_TOKEN?: string;
  /** Konto und Name dieses Workers bei Cloudflare (für das Freischalten) */
  CF_ACCOUNT_ID?: string;
  WORKER_NAME?: string;
  /** Globale Ratenbremse von Cloudflare für sicherheitsrelevante Wege (Profil-Schlüssel, Übertragung, PIN) */
  SENSITIVE?: RateLimit;
  /** R2-Speicher für größere Dateien (Fotos der Spieler). Fehlt er, sind Fotos aus. */
  FILES?: R2Bucket;
}

/** Kurzwege zu den Durable Objects */
export const settingsOf = (env: Env) => env.SETTINGS.get(env.SETTINGS.idFromName("site"));
export const profileOf = (env: Env, id: string) => env.PROFILES.get(env.PROFILES.idFromName(id));
export const transferOf = (env: Env, code: string) => env.PROFILES.get(env.PROFILES.idFromName(`transfer:${code}`));
export const groupOf = (env: Env, code: string) => env.GROUPS.get(env.GROUPS.idFromName(code));
