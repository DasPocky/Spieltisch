/** Besitz eines Profils prüfen: Profil-ID plus Geräteschlüssel (Kopfzeile x-profile-key) */
import { PROFILE_KEY_RE } from "../shared/platform/profile";
import { Env, profileOf } from "./env";
import { countFail, limited } from "./http";

/** Weist sich die Anfrage mit dem Geräteschlüssel des Profils aus? (Fehlversuche werden gebremst) */
export async function ownsProfile(env: Env, id: string, request: Request): Promise<boolean> {
  const key = request.headers.get("x-profile-key") ?? "";
  if (!PROFILE_KEY_RE.test(key)) return false;
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  if (!(await limited(env.SENSITIVE, "profile-key", ip, 20))) return false;
  const ok = await profileOf(env, id).owns(key);
  if (!ok) countFail("profile-key", ip);
  return ok;
}
