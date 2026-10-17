/**
 * Eigenes Profil auf diesem Gerät: zufällige ID + Name, gespeichert im Browser (localStorage).
 * Ein Cookie ist dafür nicht nötig – die ID reist beim Beitritt und bei lokalen Ergebnissen einfach mit.
 * Dazu kommt ein geheimer Geräteschlüssel (`key`): Nur wer ihn hat, darf das Profil lesen, ändern, löschen oder übertragen.
 * Die ID allein reicht dafür nicht. Ein neues Handy bekommt seinen Schlüssel über den Übertragungs-Code.
 */
import { makeProfileId, PROFILE_ID_RE, PROFILE_KEY_RE, type ProfileStats, type RecentGame } from "@shared/platform/profile";
import { defaultAvatar, sanitizeAvatar, type Avatar } from "@shared/platform/group";
import { KEY_PREFIX, NAME_KEY, readJSON, remove, wipeLocal, writeJSON } from "./storage";

const KEY = "spieltisch:profile";

export interface LocalProfile { id: string; key: string }

const newKey = () => {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

/** Profil holen – beim ersten Aufruf wird eines angelegt (ältere Profile bekommen hier ihren Geräteschlüssel) */
export function myProfile(): LocalProfile {
  const saved = readJSON<Partial<LocalProfile>>(KEY);
  if (saved?.id && PROFILE_ID_RE.test(saved.id)) {
    if (saved.key && PROFILE_KEY_RE.test(saved.key)) return saved as LocalProfile;
    const p = { id: saved.id, key: newKey() };
    writeJSON(KEY, p);
    return p;
  }
  const p = { id: makeProfileId(), key: newKey() };
  writeJSON(KEY, p);
  return p;
}

/** Kopfzeile, mit der sich dieses Gerät als Besitzer des Profils ausweist */
export const profileHeaders = (): Record<string, string> => ({ "x-profile-key": myProfile().key });

/** Profil von einem anderen Gerät übernehmen (die Statistik liegt auf dem Server). Ohne Schlüssel: den eigenen behalten. */
export function adoptProfile(id: string, key?: string) {
  writeJSON(KEY, { id, key: key && PROFILE_KEY_RE.test(key) ? key : myProfile().key });
}

/** Neues, leeres Profil (das alte bleibt auf dem Server, bis es abläuft oder gelöscht wird) */
export function resetProfile() {
  remove(KEY);
  return myProfile();
}

export const AVATAR_KEY = "spieltisch:avatar";

/** Eigener Avatar – ohne Auswahl ein fester aus der Profil-ID */
export function myAvatar(): Avatar {
  return sanitizeAvatar(readJSON(AVATAR_KEY)) ?? defaultAvatar(myProfile().id);
}

/** Avatar merken (Gerät + Server-Profil) */
export async function saveAvatar(a: Avatar) {
  writeJSON(AVATAR_KEY, a);
  try { await fetch(`/api/profile/${myProfile().id}`, { method: "PUT", headers: { "content-type": "application/json", ...profileHeaders() }, body: JSON.stringify({ avatar: a }) }); } catch { /* offline */ }
}

/** Nach dem Übernehmen eines Profils: Avatar vom Server übernehmen (oder zurück auf den Standard) */
export function setLocalAvatar(a: Avatar | null | undefined) {
  if (a) writeJSON(AVATAR_KEY, a); else remove(AVATAR_KEY);
}

export const myName = () => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } };

export async function fetchStats(id = myProfile().id): Promise<ProfileStats | null> {
  try {
    const res = await fetch(`/api/profile/${id}`, { cache: "no-store", headers: profileHeaders() });
    return res.ok ? ((await res.json()) as ProfileStats) : null;
  } catch { return null; }
}

export async function saveName(name: string) {
  try { await fetch(`/api/profile/${myProfile().id}`, { method: "PUT", headers: { "content-type": "application/json", ...profileHeaders() }, body: JSON.stringify({ name }) }); } catch { /* offline */ }
}

export async function deleteProfile() {
  try { await fetch(`/api/profile/${myProfile().id}`, { method: "DELETE", headers: profileHeaders() }); } catch { /* offline */ }
  resetProfile();
}

/** Einmal-Code zum Übertragen aufs neue Handy (15 Minuten gültig) */
export async function createTransfer(): Promise<{ code: string; until: number } | null> {
  try {
    const res = await fetch(`/api/profile/${myProfile().id}/transfer`, { method: "POST", headers: profileHeaders() });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

/** Code einlösen: liefert die Profil-ID des alten Handys und einen eigenen Schlüssel für dieses Gerät */
export async function redeemTransfer(code: string): Promise<{ id?: string; key?: string; error?: string }> {
  try {
    const res = await fetch(`/api/transfer/${code}`, { method: "POST" });
    const data = (await res.json()) as { id?: string; key?: string; error?: string };
    return res.ok && data.id && PROFILE_ID_RE.test(data.id) ? { id: data.id, key: data.key } : { error: data.error ?? "Das hat nicht geklappt." };
  } catch { return { error: "Keine Verbindung zum Server." }; }
}

/** Alle Daten dieses Geräts als Datei (Profil, Name, Avatar, Gruppen, Spielstände, Einstellungen) */
export function exportData(): string {
  const data: Record<string, string> = {};
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(KEY_PREFIX)) data[k] = localStorage.getItem(k) ?? "";
  } catch { /* egal */ }
  return JSON.stringify({ app: "spieltisch", v: 1, at: Date.now(), data }, null, 1);
}

/** Datei von exportData einspielen – ersetzt die Daten dieses Geräts. false, wenn es keine Spieltisch-Datei ist. */
export function importData(text: string): boolean {
  let parsed: { app?: unknown; data?: unknown };
  try { parsed = JSON.parse(text); } catch { return false; }
  const data = parsed?.data;
  if (parsed?.app !== "spieltisch" || !data || typeof data !== "object") return false;
  const entries = Object.entries(data as Record<string, unknown>).filter(([k, v]) => k.startsWith(KEY_PREFIX) && typeof v === "string" && v.length < 500_000);
  const profile = entries.find(([k]) => k === KEY);
  try {
    if (!profile || !PROFILE_ID_RE.test((JSON.parse(profile[1] as string) as Partial<LocalProfile>)?.id ?? "")) return false;
    for (const k of Object.keys(localStorage)) if (k.startsWith(KEY_PREFIX)) localStorage.removeItem(k);
    for (const [k, v] of entries) localStorage.setItem(k, v as string);
  } catch { return false; }
  return true;
}

/** Lokale Partie: Ergebnis des Geräte-Besitzers melden */
export async function reportLocal(result: Omit<RecentGame, "at" | "online">) {
  try {
    await fetch(`/api/profile/${myProfile().id}/result`, { method: "POST", headers: { "content-type": "application/json", ...profileHeaders() }, body: JSON.stringify(result) });
  } catch { /* offline – dann eben ohne Statistik */ }
}

/** Alles auf diesem Gerät löschen: Profil (auch auf dem Server), Namen, Spielstände, Einstellungen */
export async function wipeAllData() {
  await deleteProfile();
  wipeLocal();
}

/** Darf dieses Gerät das Profil nutzen? (früherer Profil-Code: nur solange es noch keinem Gerät gehört) */
export async function canUseProfile(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/profile/${id}`, { cache: "no-store", headers: profileHeaders() });
    return res.ok;
  } catch { return false; }
}
