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

/**
 * Die angenehmste deutsche Stimme, die das Gerät hat: natürliche/Premium-Stimmen zuerst,
 * dann bekannte gute (Google, Anna, Helena …), sonst irgendeine deutsche.
 */
function bestVoice(): SpeechSynthesisVoice | null {
  try {
    const de = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("de"));
    if (!de.length) return null;
    const score = (v: SpeechSynthesisVoice) =>
      (/natural|neural|premium|enhanced|online/i.test(v.name) ? 8 : 0) +
      (/google|anna|helena|petra|katja|marlene|vicki|amala/i.test(v.name) ? 4 : 0) +
      (v.lang === "de-DE" ? 2 : 0) + (v.localService ? 0 : 1);
    return de.sort((a, b) => score(b) - score(a))[0];
  } catch { return null; }
}

/** Grobe Sprechdauer, falls das Gerät kein Ende meldet */
const estimate = (text: string) => 900 + text.length * 70;

/**
 * Liest `text` ruhig vor – Satz für Satz mit kleinen Pausen – und meldet, wann alles gesagt ist.
 * Ohne Sprachausgabe wird kurz gewartet, damit Abläufe gleich getaktet bleiben.
 */
export function speak(text: string): Promise<void> {
  if (!text) return Promise.resolve();
  if (!speechSupported() || current === false) return new Promise((r) => setTimeout(r, Math.min(estimate(text), 2500)));
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
    const guard = setTimeout(finish, estimate(text) + 3000);
    try {
      speechSynthesis.cancel();
      const voice = bestVoice();
      const parts = text.match(/[^.!?…]+[.!?…]*/g)?.map((p) => p.trim()).filter(Boolean) ?? [text];
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.lang = "de-DE";
        if (voice) u.voice = voice;
        u.rate = 0.92;
        u.pitch = 0.95;
        if (i === parts.length - 1) { u.onend = finish; u.onerror = finish; }
        speechSynthesis.speak(u);
      });
    } catch { finish(); }
  });
}

/** Liest `text` vor, sobald er sich ändert. */
export function useSpeak(text: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !text || !speechSupported()) return;
    void speak(text);
  }, [text, enabled]);
}
