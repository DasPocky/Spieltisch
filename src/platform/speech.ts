import { useEffect, useRef, useSyncExternalStore } from "react";

const KEY = "spieltisch:werwolf:speech";
const VOICE_KEY = "spieltisch:voice";
const RATE_KEY = "spieltisch:voice-rate";
const listeners = new Set<() => void>();
function read(): boolean | null {
  try { const v = localStorage.getItem(KEY); return v === null ? null : v === "1"; } catch { return null; }
}
let current = read();
const notify = () => listeners.forEach((l) => l());

export function setSpeech(on: boolean) {
  current = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* egal */ }
  if (!on) try { speechSynthesis.cancel(); } catch { /* nicht unterstützt */ }
  notify();
}

/** Vorlesen an/aus (pro Gerät), mit Standardwert je Modus */
export function useSpeechEnabled(fallback: boolean): boolean {
  const v = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
  return v ?? fallback;
}

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/* ── Stimmen ─────────────────────────────────────────────────────────────── */

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  try { voices = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("de")); notify(); } catch { /* egal */ }
}
if (speechSupported()) {
  loadVoices();
  // Viele Geräte liefern die Stimmen erst nach einem Moment – sonst spräche die schlechte Standardstimme
  try { speechSynthesis.addEventListener("voiceschanged", loadVoices); } catch { /* alt */ }
  // iOS spricht erst nach einer ersten Berührung: einmal still „freischalten“
  const unlock = () => {
    try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch { /* egal */ }
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
}

/** Wie gut klingt eine Stimme vermutlich? Natürliche/erweiterte Stimmen zuerst (iOS, Android, Edge, Chrome) */
function quality(v: SpeechSynthesisVoice) {
  return (/natural|neural|premium|erweitert|enhanced|online/i.test(v.name) ? 10 : 0)
    + (/network/i.test(v.name) ? 6 : 0)
    + (/google/i.test(v.name) ? 4 : 0)
    + (/anna|helena|petra|katja|amala|vicki|seraphina|marlene|conrad|martin|yannick/i.test(v.name) ? 3 : 0)
    + (v.lang === "de-DE" ? 2 : 0)
    + (v.localService ? 0 : 1);
}

/** Deutsche Stimmen des Geräts, die besten zuerst */
export function germanVoices(): SpeechSynthesisVoice[] {
  return voices.slice().sort((a, b) => quality(b) - quality(a));
}
export function useVoices(): SpeechSynthesisVoice[] {
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => voices);
  return germanVoices();
}
export function chosenVoice(): string | null { try { return localStorage.getItem(VOICE_KEY); } catch { return null; } }
export function setVoice(uri: string | null) {
  try { if (uri) localStorage.setItem(VOICE_KEY, uri); else localStorage.removeItem(VOICE_KEY); } catch { /* egal */ }
  notify();
}
export type Rate = "calm" | "normal" | "quick";
export function voiceRate(): Rate { try { const v = localStorage.getItem(RATE_KEY); return v === "calm" || v === "quick" ? v : "normal"; } catch { return "normal"; } }
export function setVoiceRate(r: Rate) { try { localStorage.setItem(RATE_KEY, r); } catch { /* egal */ } notify(); }
const RATE: Record<Rate, number> = { calm: 0.9, normal: 1, quick: 1.12 };

function pickVoice(): SpeechSynthesisVoice | null {
  const all = germanVoices();
  const want = chosenVoice();
  return all.find((v) => v.voiceURI === want) ?? all[0] ?? null;
}

/** Grobe Sprechdauer, falls das Gerät kein Ende meldet */
const estimate = (text: string) => 900 + text.length * 70;

/**
 * Liest `text` vor – Satz für Satz mit natürlichen Pausen – und meldet, wann alles gesagt ist.
 * Ohne Sprachausgabe wird kurz gewartet, damit Abläufe gleich getaktet bleiben.
 */
export function speak(text: string, opts: { force?: boolean } = {}): Promise<void> {
  if (!text.trim()) return Promise.resolve();
  if (!speechSupported() || (current === false && !opts.force)) return new Promise((r) => setTimeout(r, Math.min(estimate(text), 2500)));
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
    const guard = setTimeout(finish, estimate(text) + 3000);
    try {
      speechSynthesis.cancel();
      const voice = pickVoice();
      const parts = text.match(/[^.!?…]+[.!?…]*/g)?.map((p) => p.trim()).filter(Boolean) ?? [text];
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.lang = voice?.lang ?? "de-DE";
        if (voice) u.voice = voice;
        u.rate = RATE[voiceRate()];
        u.pitch = 1;
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

/**
 * Countdown ansagen – nicht jede Sekunde, nur an Wegmarken: „Noch eine Minute“, „30 Sekunden“,
 * dann 5, 4, 3, 2, 1. Gilt für alle Timer, sofern das Gerät sprechen darf.
 */
export function useSpokenCountdown(left: number | null, enabled: boolean, total?: number) {
  const said = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || left === null || left === said.current) return;
    const text = left === 60 && (total ?? 61) > 60 ? "Noch eine Minute."
      : left === 30 && (total ?? 31) > 30 ? "Noch 30 Sekunden."
      : left >= 1 && left <= 5 ? String(left) : "";
    if (!text) return;
    said.current = left;
    void speak(text);
  }, [left, enabled, total]);
}
