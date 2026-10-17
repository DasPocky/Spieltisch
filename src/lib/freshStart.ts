/**
 * Frischer Start nach einem kompletten Neustart im Admin: Weicht die Neustart-Kennung des Servers von der ab,
 * die dieses Handy zuletzt gesehen hat, löscht die App einmal alle Daten auf dem Gerät und lädt neu.
 * Ohne Neustart im Admin passiert nichts.
 */
import type { SiteConfig } from "@shared/platform/access";
import { AVATAR_KEY } from "./profile";
import { NAME_KEY, ONBOARDED_KEY, readStr as get, wipeLocal, writeStr } from "./storage";

const EPOCH_KEY = "spieltisch:epoch";
/** Hinterlässt man diese, gilt das Gerät als benutzt (neue Geräte haben nichts zu löschen) */
const USED_KEYS = [NAME_KEY, ONBOARDED_KEY, AVATAR_KEY];
/** Zustand beim Öffnen der App – was danach (z. B. im Willkommen) gespeichert wird, zählt nicht */
const usedAtStart = typeof window !== "undefined" && USED_KEYS.some((k) => get(k) !== null);

/** Kennung merken, ohne etwas zu löschen (neues Gerät, oder der Admin selbst nach dem Neustart) */
export function rememberEpoch(epoch: string) {
  writeStr(EPOCH_KEY, epoch);
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
  wipeLocal();
  rememberEpoch(now);
  location.reload();
  return true;
}
