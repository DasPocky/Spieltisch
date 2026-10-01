import { prefs } from "@/lib/prefs";

/**
 * Kleine, leise Töne – mit WebAudio erzeugt, ohne Audiodateien.
 * Alles bleibt dezent; ohne Erlaubnis (Einstellung „Töne“) oder ohne WebAudio passiert einfach nichts.
 */
export type Sound = "place" | "draw" | "dice" | "turn" | "win" | "error";

const VOLUME = 0.22;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
/** Zeitpunkt der letzten Berührung/Taste – Zug-Töne nur direkt nach eigener Eingabe */
let lastGesture = 0;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

if (typeof window !== "undefined") {
  // iOS spielt erst nach einer Berührung: dabei einmal freischalten
  const gesture = () => { lastGesture = Date.now(); if (ctx?.state !== "running" && prefs().sound) audio(); };
  window.addEventListener("pointerdown", gesture, { capture: true, passive: true });
  window.addEventListener("keydown", gesture, { capture: true, passive: true });
}

/** Kam gerade eine eigene Eingabe? (nicht Timer oder automatische Züge) */
export const userGesture = (ms = 1200) => Date.now() - lastGesture < ms;

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** Hüllkurve: schnell an, weich aus */
function env(c: AudioContext, at: number, dur: number, peak: number, attack = 0.005): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(master!);
  return g;
}

function tone(c: AudioContext, freq: number, at: number, dur: number, peak: number, type: OscillatorType = "sine", to?: number, attack?: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  o.connect(env(c, at, dur, peak, attack));
  o.start(at);
  o.stop(at + dur + 0.02);
}

function hiss(c: AudioContext, at: number, dur: number, peak: number, freq: number, to?: number, attack?: number, q = 1.2) {
  const s = c.createBufferSource();
  s.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, at);
  if (to) f.frequency.exponentialRampToValueAtTime(to, at + dur);
  s.connect(f);
  f.connect(env(c, at, dur, peak, attack));
  s.start(at, Math.random() * 0.2);
  s.stop(at + dur + 0.02);
}

const SOUNDS: Record<Sound, (c: AudioContext, t: number) => void> = {
  // Karte auf den Tisch: kurzes „Tapp“
  place: (c, t) => { hiss(c, t, 0.06, 0.5, 2200, 1200); tone(c, 170, t, 0.07, 0.35, "sine", 110); },
  // Karte ziehen: leises Wischen
  draw: (c, t) => hiss(c, t, 0.16, 0.35, 900, 3200, 0.05, 0.8),
  // Würfel: ein paar kleine Klacker
  dice: (c, t) => {
    let at = t;
    for (let i = 0; i < 6; i++) {
      hiss(c, at, 0.03, 0.45 - i * 0.05, 2600 + Math.random() * 1600, undefined, 0.002, 3);
      at += 0.03 + Math.random() * 0.05;
    }
  },
  // Du bist dran: weicher Zweiklang
  turn: (c, t) => { tone(c, 880, t, 0.6, 0.22, "sine", undefined, 0.01); tone(c, 1318.5, t + 0.09, 0.7, 0.16, "sine", undefined, 0.01); },
  // Gewonnen: kurzes Arpeggio
  win: (c, t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.1, i === 3 ? 0.8 : 0.28, 0.2, "triangle", undefined, 0.01)),
  // Fehler: tiefes, weiches „Blip“
  error: (c, t) => tone(c, 240, t, 0.16, 0.25, "sine", 170, 0.01),
};

/** Spielt einen Ton – nie mit Fehler. `force` für die Probe in den Einstellungen. */
export function playSound(sound: Sound, opts: { force?: boolean } = {}) {
  if (!opts.force && !prefs().sound) return;
  try {
    const c = audio();
    if (!c || !master) return;
    SOUNDS[sound](c, c.currentTime + 0.01);
  } catch { /* egal */ }
}
