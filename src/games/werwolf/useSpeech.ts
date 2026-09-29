import { useEffect, useSyncExternalStore } from "react";

const KEY = "spieltisch:werwolf:speech";
const listeners = new Set<() => void>();
function read(): boolean | null {
  try { const v = localStorage.getItem(KEY); return v === null ? null : v === "1"; } catch { return null; }
}
let current = read();

export function setSpeech(on: boolean) {
  current = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* egal */ }
  if (!on) try { speechSynthesis.cancel(); } catch { /* nicht unterstützt */ }
  listeners.forEach((l) => l());
}

/** Vorlesen an/aus (pro Gerät), mit Standardwert je Modus */
export function useSpeechEnabled(fallback: boolean): boolean {
  const v = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
  return v ?? fallback;
}

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Liest `text` vor, sobald er sich ändert. */
export function useSpeak(text: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !text || !speechSupported()) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "de-DE";
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch { /* egal */ }
  }, [text, enabled]);
}
