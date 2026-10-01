import { createContext, useContext, useSyncExternalStore } from "react";

/** Persönliche Einstellungen fürs Spielen – nur auf diesem Gerät */
export interface Prefs {
  /** dezente Töne bei Zügen, „du bist dran“ und Sieg */
  sound: boolean;
  /** kurzes Vibrieren */
  vibration: boolean;
  /** „X ist dran“ vorlesen */
  announce: boolean;
  /** Spielhilfen: spielbare Karten/Züge hervorheben */
  hints: boolean;
}

const KEY = "spieltisch:prefs";
export const DEFAULT_PREFS: Prefs = { sound: true, vibration: true, announce: false, hints: true };

function read(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<keyof Prefs, unknown>>;
    const p = { ...DEFAULT_PREFS };
    for (const k of Object.keys(p) as (keyof Prefs)[]) if (typeof raw[k] === "boolean") p[k] = raw[k];
    return p;
  } catch { return { ...DEFAULT_PREFS }; }
}

let current = read();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Aktueller Stand (auch außerhalb von React, z. B. für Töne) */
export const prefs = (): Prefs => current;

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  current = { ...current, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* egal */ }
  notify();
}

// Andere Tabs desselben Geräts
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY || e.key === null) { current = read(); notify(); } });
}

export function usePrefs(): Prefs {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}

/** Raum-Schalter des Hosts: Spielhilfen für alle im Raum aus */
export const RoomHints = createContext(true);

/** Spielhilfen anzeigen? Nur wenn sie im Profil an sind und der Raum sie erlaubt */
export function useHints(): boolean {
  return usePrefs().hints && useContext(RoomHints);
}
