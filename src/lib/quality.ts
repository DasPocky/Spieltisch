/**
 * Grafik-Stufen für alles in 3D (Tisch, Würfel, später Bühne und Moderator):
 *  - „hoch“: volle Pixeldichte (bis 2×), weiche Schatten – scharf auch in 4K
 *  - „mittel“: etwas weniger Pixel, kleinere Schatten
 *  - „einfach“: 1× Pixel, keine Schatten
 *  - „flach“: kein 3D – ein einfacher flacher Tisch in derselben Anordnung
 * „Automatisch“ wählt nach Gerät (Grafikchip, Speicher, Kerne) und senkt die Stufe, wenn die gemessene Bildrate
 * zu niedrig ist. Im Profil lässt sich die Stufe festlegen. Reduzierte Bewegung (System-Einstellung) zählt mit.
 */
import { useSyncExternalStore } from "react";

export type Quality = "hoch" | "mittel" | "einfach" | "flach";
export type QualityPref = Quality | "auto";

export const QUALITIES: { value: QualityPref; label: string; hint: string }[] = [
  { value: "auto", label: "Automatisch", hint: "passt sich Gerät und Bildrate an" },
  { value: "hoch", label: "Hoch", hint: "scharf bis 4K, weiche Schatten" },
  { value: "mittel", label: "Mittel", hint: "etwas weniger Pixel" },
  { value: "einfach", label: "Einfach", hint: "ohne Schatten, schont den Akku" },
  { value: "flach", label: "Ohne 3D", hint: "einfacher flacher Tisch" },
];

const KEY = "spieltisch:quality";
/** Automatisch gesenkte Stufe (gilt bis zum Schließen des Tabs) */
const DROP_KEY = "spieltisch:qualityDrop";
const ORDER: Quality[] = ["hoch", "mittel", "einfach", "flach"];

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function qualityPref(): QualityPref {
  try { const v = localStorage.getItem(KEY); return QUALITIES.some((q) => q.value === v) ? (v as QualityPref) : "auto"; } catch { return "auto"; }
}

export function setQualityPref(v: QualityPref) {
  try { localStorage.setItem(KEY, v); sessionStorage.removeItem(DROP_KEY); } catch { /* egal */ }
  notify();
}

let gl: boolean | null = null;
/** Kann dieses Gerät WebGL (und läuft es nicht nur in Software)? */
export function webglOk(): boolean {
  if (gl !== null) return gl;
  try {
    const c = document.createElement("canvas");
    gl = !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch { gl = false; }
  return gl;
}

/** Startwert nach Gerät */
function guess(): Quality {
  if (!webglOk()) return "flach";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (mem <= 2 || cores <= 2) return "einfach";
  if (mem <= 4 || cores <= 4) return "mittel";
  return "hoch";
}

const lower = (a: Quality, b: Quality): Quality => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

/** Stufe, die gerade gilt */
export function quality(): Quality {
  const pref = qualityPref();
  if (pref !== "auto") return pref === "flach" || webglOk() ? pref : "flach";
  let q = guess();
  try { const d = sessionStorage.getItem(DROP_KEY) as Quality | null; if (d && ORDER.includes(d)) q = lower(q, d); } catch { /* egal */ }
  return q;
}

export function useQuality(): Quality {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, quality);
}

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Bildrate messen (während Bewegungen): bleibt sie unter ~24 Bildern pro Sekunde, wird – nur bei „Automatisch“ –
 * eine Stufe tiefer gewählt. Gibt eine Funktion zurück, die die Szene je gezeichnetem Bild aufruft.
 */
export function frameMeter(): (dtMs: number) => void {
  let slow = 0, total = 0;
  return (dt) => {
    if (qualityPref() !== "auto" || dt <= 0 || dt > 1000) return;
    total++;
    if (dt > 42) slow++;
    if (total >= 40) {
      if (slow / total > 0.5) {
        const next = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(quality()) + 1)];
        try { sessionStorage.setItem(DROP_KEY, next); } catch { /* egal */ }
        notify();
      }
      slow = 0; total = 0;
    }
  };
}

/** Einstellungen der 3D-Szene je Stufe */
export function renderSettings(q: Quality) {
  const dpr = window.devicePixelRatio || 1;
  return {
    pixelRatio: q === "hoch" ? Math.min(dpr, 2) : q === "mittel" ? Math.min(dpr, 1.25) : 1,
    shadows: q === "hoch" || q === "mittel",
    shadowSize: q === "hoch" ? 2048 : 1024,
    antialias: q !== "einfach",
  };
}
