import { useEffect, useState } from "react";
import { isAdminDevice } from "./admin";

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
let current: DevSettings = load();
const listeners = new Set<() => void>();

function load(): DevSettings {
  try { return { ...OFF, ...(JSON.parse(localStorage.getItem(DEV_KEY) ?? "{}") as Partial<DevSettings>) }; } catch { return OFF; }
}

/** Gilt nur auf Admin-Geräten */
export const dev = (): DevSettings => (current.on && isAdminDevice() ? current : OFF);

export function setDev(patch: Partial<DevSettings>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(DEV_KEY, JSON.stringify(current)); } catch { /* egal */ }
  listeners.forEach((l) => l());
}

export function useDev(): DevSettings {
  const [s, set] = useState(dev);
  useEffect(() => {
    const l = () => set(dev());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return s;
}

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
