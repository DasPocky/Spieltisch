/** Bindungen und Secrets des Workers, dazu die Kurzwege zu den Durable Objects */
import type { GameRoom } from "./rooms";
import type { SiteSettings } from "./settings";
import type { ProfileStore } from "./profiles";
import type { GroupStore } from "./groups";

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
}

/** Kurzwege zu den Durable Objects */
export const settingsOf = (env: Env) => env.SETTINGS.get(env.SETTINGS.idFromName("site"));
export const profileOf = (env: Env, id: string) => env.PROFILES.get(env.PROFILES.idFromName(id));
export const transferOf = (env: Env, code: string) => env.PROFILES.get(env.PROFILES.idFromName(`transfer:${code}`));
export const groupOf = (env: Env, code: string) => env.GROUPS.get(env.GROUPS.idFromName(code));
