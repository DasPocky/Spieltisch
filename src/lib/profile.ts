/**
 * Eigenes Profil auf diesem Gerät: zufällige ID + Name, gespeichert im Browser (localStorage).
 * Ein Cookie ist dafür nicht nötig – die ID reist beim Beitritt und bei lokalen Ergebnissen einfach mit.
 */
import { makeProfileId, PROFILE_ID_RE, type ProfileStats, type RecentGame } from "@shared/platform/profile";
import { NAME_KEY, readJSON, remove, writeJSON } from "./storage";

const KEY = "spieltisch:profile";

export interface LocalProfile { id: string }

/** Profil holen – beim ersten Aufruf wird eines angelegt */
export function myProfile(): LocalProfile {
  const saved = readJSON<LocalProfile>(KEY);
  if (saved && PROFILE_ID_RE.test(saved.id)) return saved;
  const p = { id: makeProfileId() };
  writeJSON(KEY, p);
  return p;
}

/** Profil von einem anderen Gerät übernehmen (die Statistik liegt auf dem Server) */
export function adoptProfile(id: string) {
  writeJSON(KEY, { id });
}

/** Neues, leeres Profil (das alte bleibt auf dem Server, bis es abläuft oder gelöscht wird) */
export function resetProfile() {
  remove(KEY);
  return myProfile();
}

export const myName = () => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } };

export async function fetchStats(id = myProfile().id): Promise<ProfileStats | null> {
  try {
    const res = await fetch(`/api/profile/${id}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as ProfileStats) : null;
  } catch { return null; }
}

export async function saveName(name: string) {
  try { await fetch(`/api/profile/${myProfile().id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }); } catch { /* offline */ }
}

export async function deleteProfile() {
  try { await fetch(`/api/profile/${myProfile().id}`, { method: "DELETE" }); } catch { /* offline */ }
  resetProfile();
}

/** Lokale Partie: Ergebnis des Geräte-Besitzers melden */
export async function reportLocal(result: Omit<RecentGame, "at" | "online">) {
  try {
    await fetch(`/api/profile/${myProfile().id}/result`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) });
  } catch { /* offline – dann eben ohne Statistik */ }
}
