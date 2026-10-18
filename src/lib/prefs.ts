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
  /** Würfelspiele: wertbare Würfel farbig markieren (Standard aus – die Würfel sollen wie echte aussehen) */
  diceMarks: boolean;
  /** Lautstärken 0…1: Effekte (Karten, Würfel, „du bist dran“), Musik und Publikum (beides am großen Tisch) */
  volFx: number;
  volMusic: number;
  volCrowd: number;
}

/** Schalter unter den Einstellungen (ohne die Lautstärken) */
export type SwitchPref = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];
export type VolumePref = "volFx" | "volMusic" | "volCrowd";

const KEY = "spieltisch:prefs";
export const DEFAULT_PREFS: Prefs = { sound: true, vibration: true, announce: false, hints: true, diceMarks: false, volFx: 0.8, volMusic: 0.4, volCrowd: 0.6 };

function read(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<keyof Prefs, unknown>>;
    const p: Record<string, unknown> = { ...DEFAULT_PREFS };
    for (const k of Object.keys(p) as (keyof Prefs)[]) {
      const v = raw[k];
      if (typeof DEFAULT_PREFS[k] === "boolean" ? typeof v === "boolean" : typeof v === "number" && v >= 0 && v <= 1) p[k] = v;
    }
    return p as unknown as Prefs;
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

/** Änderungen verfolgen (außerhalb von React, z. B. Lautstärken der Töne) */
export function onPrefs(cb: () => void): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }

export function usePrefs(): Prefs {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}

/** Raum-Schalter des Hosts: Spielhilfen für alle im Raum aus */
export const RoomHints = createContext(true);

/** Spielhilfen anzeigen? Nur wenn sie im Profil an sind und der Raum sie erlaubt */
export function useHints(): boolean {
  return usePrefs().hints && useContext(RoomHints);
}
