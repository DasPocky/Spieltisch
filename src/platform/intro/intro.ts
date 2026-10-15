/**
 * Was beim Start zu sehen ist: der Willkommensablauf (neues Gerät), die Begrüßung (bekanntes Gerät) oder nichts.
 * Entschieden wird einmal beim Laden der Seite.
 */
import { whenSiteConfig } from "@/hooks/useSiteConfig";
import { activeGroupCode, loadGroup } from "@/lib/group";
import { myName } from "@/lib/profile";
import { readJSON, writeJSON } from "@/lib/storage";
import { loadRooms } from "@/lib/rooms";

export const ONBOARDED_KEY = "spieltisch:onboarded";
const SEEN_KEY = "spieltisch:seen";
/** Für Tests: Begrüßung und Willkommen auch im automatisierten Browser zeigen */
export const TEST_INTRO_KEY = "spieltisch:test-intro";
/** Wer nur kurz weg war (App gewechselt, neu geladen), sieht keine Begrüßung */
const QUIET_MS = 5 * 60 * 1000;

export type IntroMode = "onboarding" | "welcome" | null;

/** Nur auf den Seiten der App-Hülle – wer einen Raum-Link öffnet, will gleich in den Raum */
const SHELL_PATH = /^\/(spiele|profil|gruppe|g\/[A-Za-z0-9]{6})?\/?$/;

function decide(): IntroMode {
  if (typeof window === "undefined") return null;
  // Automatisierte Tests sollen nicht an der Animation hängen (eigene Tests schalten sie gezielt ein)
  if (navigator.webdriver && !readJSON<boolean>(TEST_INTRO_KEY)) return null;
  if (!SHELL_PATH.test(location.pathname)) return null;
  const name = myName();
  if (!name && !readJSON<boolean>(ONBOARDED_KEY)) return "onboarding";
  if (!name) return null;
  const seen = readJSON<number>(SEEN_KEY) ?? 0;
  return Date.now() - seen > QUIET_MS ? "welcome" : null;
}

let mode: IntroMode | undefined;
export function introMode(): IntroMode {
  if (mode === undefined) mode = decide();
  return mode;
}

/** „Zuletzt gesehen“ mitschreiben, solange die App offen ist */
export function trackSeen() {
  const mark = () => writeJSON(SEEN_KEY, Date.now());
  mark();
  const t = setInterval(mark, 30_000);
  document.addEventListener("visibilitychange", mark);
  window.addEventListener("pagehide", mark);
  return () => { clearInterval(t); document.removeEventListener("visibilitychange", mark); window.removeEventListener("pagehide", mark); };
}

type Loader = () => Promise<unknown>;
const loaders: Loader[] = [
  () => whenSiteConfig(),
  () => { const c = activeGroupCode(); return c ? loadGroup(c) : Promise.resolve(); },
  () => (document.fonts?.ready ?? Promise.resolve()),
  () => loadRooms(),
];

/** Alles parallel laden; `onProgress` bekommt den Anteil 0…1. Fehler zählen als fertig – die Seiten laden selbst nach. */
export function boot(onProgress: (p: number) => void): Promise<void> {
  let done = 0;
  const all = loaders.map((l) => l().catch(() => null).finally(() => onProgress(++done / loaders.length)));
  return Promise.all(all).then(() => undefined);
}
