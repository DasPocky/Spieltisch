/**
 * Frischer Start nach einem kompletten Neustart im Admin: Weicht die Neustart-Kennung des Servers von der ab,
 * die dieses Handy zuletzt gesehen hat, löscht die App einmal alle Daten auf dem Gerät und lädt neu.
 * Ohne Neustart im Admin passiert nichts.
 */
import type { SiteConfig } from "@shared/platform/access";

const EPOCH_KEY = "spieltisch:epoch";
/** Hinterlässt man diese, gilt das Gerät als benutzt (neue Geräte haben nichts zu löschen) */
const USED_KEYS = ["spieltisch:name", "spieltisch:onboarded", "spieltisch:avatar"];

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
/** Zustand beim Öffnen der App – was danach (z. B. im Willkommen) gespeichert wird, zählt nicht */
const usedAtStart = typeof window !== "undefined" && USED_KEYS.some((k) => get(k) !== null);

/** Kennung merken, ohne etwas zu löschen (neues Gerät, oder der Admin selbst nach dem Neustart) */
export function rememberEpoch(epoch: string) {
  try { localStorage.setItem(EPOCH_KEY, epoch); } catch { /* egal */ }
}

/** Nach dem Laden der Einstellungen vom Server: true, wenn gerade gelöscht wurde (die Seite lädt dann neu) */
export function checkFreshStart(c: SiteConfig): boolean {
  // Ohne Kennung (noch nie neu gestartet, oder offline mit Standardwerten) bleibt alles, wie es ist
  const now = c.epoch;
  if (!now) return false;
  const seen = get(EPOCH_KEY);
  // Noch nie eine Kennung gesehen: nur löschen, wenn das Gerät schon benutzt wurde – neue Geräte merken sie sich nur
  const stale = seen === null ? usedAtStart : seen !== now;
  if (!stale) { if (seen !== now) rememberEpoch(now); return false; }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("spieltisch")) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch { /* ohne Speicher gibt es nichts zu löschen */ }
  rememberEpoch(now);
  location.reload();
  return true;
}
