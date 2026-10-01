/**
 * Eigenes Profil auf diesem Gerät: zufällige ID + Name, gespeichert im Browser (localStorage).
 * Ein Cookie ist dafür nicht nötig – die ID reist beim Beitritt und bei lokalen Ergebnissen einfach mit.
 */
import { makeProfileId, PROFILE_ID_RE, type ProfileStats, type RecentGame } from "@shared/platform/profile";
import { defaultAvatar, sanitizeAvatar, type Avatar } from "@shared/platform/group";
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

const AVATAR_KEY = "spieltisch:avatar";

/** Eigener Avatar – ohne Auswahl ein fester aus der Profil-ID */
export function myAvatar(): Avatar {
  return sanitizeAvatar(readJSON(AVATAR_KEY)) ?? defaultAvatar(myProfile().id);
}

/** Avatar merken (Gerät + Server-Profil) */
export async function saveAvatar(a: Avatar) {
  writeJSON(AVATAR_KEY, a);
  try { await fetch(`/api/profile/${myProfile().id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ avatar: a }) }); } catch { /* offline */ }
}

/** Nach dem Übernehmen eines Profils: Avatar vom Server übernehmen (oder zurück auf den Standard) */
export function setLocalAvatar(a: Avatar | null | undefined) {
  if (a) writeJSON(AVATAR_KEY, a); else remove(AVATAR_KEY);
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

/** Einmal-Code zum Übertragen aufs neue Handy (15 Minuten gültig) */
export async function createTransfer(): Promise<{ code: string; until: number } | null> {
  try {
    const res = await fetch(`/api/profile/${myProfile().id}/transfer`, { method: "POST" });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

/** Code einlösen: liefert die Profil-ID des alten Handys */
export async function redeemTransfer(code: string): Promise<{ id?: string; error?: string }> {
  try {
    const res = await fetch(`/api/transfer/${code}`, { method: "POST" });
    const data = (await res.json()) as { id?: string; error?: string };
    return res.ok && data.id && PROFILE_ID_RE.test(data.id) ? { id: data.id } : { error: data.error ?? "Das hat nicht geklappt." };
  } catch { return { error: "Keine Verbindung zum Server." }; }
}

/** Alle Daten dieses Geräts als Datei (Profil, Name, Avatar, Gruppen, Spielstände, Einstellungen) */
export function exportData(): string {
  const data: Record<string, string> = {};
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("spieltisch:")) data[k] = localStorage.getItem(k) ?? "";
  } catch { /* egal */ }
  return JSON.stringify({ app: "spieltisch", v: 1, at: Date.now(), data }, null, 1);
}

/** Datei von exportData einspielen – ersetzt die Daten dieses Geräts. false, wenn es keine Spieltisch-Datei ist. */
export function importData(text: string): boolean {
  let parsed: { app?: unknown; data?: unknown };
  try { parsed = JSON.parse(text); } catch { return false; }
  const data = parsed?.data;
  if (parsed?.app !== "spieltisch" || !data || typeof data !== "object") return false;
  const entries = Object.entries(data as Record<string, unknown>).filter(([k, v]) => k.startsWith("spieltisch:") && typeof v === "string" && v.length < 500_000);
  const profile = entries.find(([k]) => k === KEY);
  try {
    if (!profile || !PROFILE_ID_RE.test((JSON.parse(profile[1] as string) as Partial<LocalProfile>)?.id ?? "")) return false;
    for (const k of Object.keys(localStorage)) if (k.startsWith("spieltisch:")) localStorage.removeItem(k);
    for (const [k, v] of entries) localStorage.setItem(k, v as string);
  } catch { return false; }
  return true;
}

/** Lokale Partie: Ergebnis des Geräte-Besitzers melden */
export async function reportLocal(result: Omit<RecentGame, "at" | "online">) {
  try {
    await fetch(`/api/profile/${myProfile().id}/result`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) });
  } catch { /* offline – dann eben ohne Statistik */ }
}

/** Alles auf diesem Gerät löschen: Profil (auch auf dem Server), Namen, Spielstände, Einstellungen */
export async function wipeAllData() {
  await deleteProfile();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("spieltisch")) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch { /* egal */ }
}
