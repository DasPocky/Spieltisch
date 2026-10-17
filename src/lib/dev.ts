import { isAdminDevice } from "./admin";
import { readJSON, writeJSON } from "./storage";
import { createStore } from "./store";

/**
 * Entwickler-Modus – je Admin-Gerät einschaltbar. Hält Diagnose-Anzeige, Netz-Simulation und Vorschau-Schalter.
 * Auf anderen Geräten ist er immer aus, egal was gespeichert ist.
 */
export interface DevSettings {
  on: boolean;
  /** Diagnose-Anzeige über allem */
  overlay: boolean;
  /** künstliche Verzögerung für Nachrichten im Raum (ms) */
  delay: number;
  /** Vorschau-Funktionen, die nur auf diesem Gerät an sind */
  previews: string[];
}

export const DEV_KEY = "spieltisch:dev";
const OFF: DevSettings = { on: false, overlay: false, delay: 0, previews: [] };

function load(): DevSettings {
  return { ...OFF, ...readJSON<Partial<DevSettings>>(DEV_KEY) };
}

const store = createStore<DevSettings>(load());
/** Gilt nur auf Admin-Geräten */
const effective = (s: DevSettings) => (s.on && isAdminDevice() ? s : OFF);
export const dev = (): DevSettings => effective(store.get());

export function setDev(patch: Partial<DevSettings>) {
  const next = { ...store.get(), ...patch };
  writeJSON(DEV_KEY, next);
  store.set(next);
}

export const useDev = (): DevSettings => effective(store.use());

/**
 * Vorschau-Funktionen: noch nicht für alle freigegeben, nur auf Admin-Geräten zuschaltbar.
 * Neue Funktion hier eintragen und im Code mit `preview("id")` abfragen.
 */
export const PREVIEWS: { id: string; name: string; desc: string }[] = [];
export const preview = (id: string) => dev().previews.includes(id);

// ---------- Netz simulieren (nur Räume) ----------

/** Bis wann ein künstliches Funkloch dauert */
let downUntil = 0;
const netListeners = new Set<() => void>();
export function simulateGap(ms: number) {
  downUntil = Date.now() + ms;
  netListeners.forEach((l) => l());
}
export const netDown = () => Date.now() < downUntil;
export const netDownUntil = () => downUntil;
export function onNetChange(l: () => void) { netListeners.add(l); return () => { netListeners.delete(l); }; }

// ---------- Diagnose ----------

/** Werte, die die Diagnose-Anzeige zeigt (der Raum trägt sie ein) */
export const diag = { rtt: null as number | null, socket: "–", lastMessage: 0, room: "" };
