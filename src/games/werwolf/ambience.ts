import { useEffect } from "react";

/**
 * Nachtgeräusche: leiser Wind (gefiltertes Rauschen) und ab und zu Grillen – alles mit WebAudio erzeugt,
 * keine Dateien. Läuft die ganze Nacht gleich laut auf dem erzählenden Handy, damit es nichts verrät.
 * Während vorgelesen wird, wird es leiser. Wirft nie.
 */

const LEVEL = 0.5;
const DUCK = 0.2;
const FADE_IN = 3;
const FADE_OUT = 2.5;

type Sound = { ctx: AudioContext; master: GainNode; stop: () => void };
let sound: Sound | null = null;
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

/** Rauschen (leicht „rosa“ geglättet), als Schleife */
function noise(c: AudioContext) {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 3.5; }
  // Ränder angleichen, damit die Schleife nicht knackt
  for (let i = 0; i < 2000; i++) d[len - 1 - i] *= i / 2000;
  return buf;
}

function start(): Sound | null {
  const c = context();
  if (!c) return null;
  try {
    const master = c.createGain();
    master.gain.value = 0;
    master.connect(c.destination);

    // Wind: Rauschen durch einen langsam wandernden Tiefpass
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    lp.Q.value = 0.7;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = c.createGain();
    depth.gain.value = 180;
    lfo.connect(depth).connect(lp.frequency);
    const wind = c.createGain();
    wind.gain.value = 0.35;
    src.connect(lp).connect(wind).connect(master);
    src.start();
    lfo.start();

    // Grillen: kurze, hohe Zirp-Folgen in zufälligen Abständen
    const chirp = () => {
      try {
        const t0 = c.currentTime + 0.05;
        const f = 4200 + Math.random() * 600;
        const pulses = 3 + Math.floor(Math.random() * 3);
        const osc = c.createOscillator();
        osc.frequency.value = f;
        const g = c.createGain();
        g.gain.value = 0;
        for (let i = 0; i < pulses; i++) {
          const t = t0 + i * 0.07;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.025, t + 0.012);
          g.gain.linearRampToValueAtTime(0, t + 0.04);
        }
        osc.connect(g).connect(master);
        osc.start(t0);
        osc.stop(t0 + pulses * 0.07 + 0.05);
      } catch { /* egal */ }
    };
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => { chirp(); if (Math.random() < 0.4) setTimeout(chirp, 250); timer = setTimeout(loop, 1500 + Math.random() * 4500); };
    timer = setTimeout(loop, 2000);

    // Leiser, solange vorgelesen wird
    let stopping = false;
    let ducked = false;
    const duck = setInterval(() => {
      try {
        const speaking = "speechSynthesis" in window && speechSynthesis.speaking;
        if (speaking === ducked || sound?.master !== master || stopping) return;
        ducked = speaking;
        const v = master.gain.value;
        master.gain.cancelScheduledValues(c.currentTime);
        master.gain.setValueAtTime(v, c.currentTime);
        master.gain.setTargetAtTime(speaking ? DUCK : LEVEL, c.currentTime, 0.25);
      } catch { /* egal */ }
    }, 200);

    const stop = () => {
      if (stopping) return;
      stopping = true;
      clearTimeout(timer);
      clearInterval(duck);
      try {
        const now = c.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + FADE_OUT);
        src.stop(now + FADE_OUT + 0.1);
        lfo.stop(now + FADE_OUT + 0.1);
        setTimeout(() => { try { master.disconnect(); } catch { /* egal */ } }, (FADE_OUT + 0.3) * 1000);
      } catch { /* egal */ }
    };

    const now = c.currentTime;
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(LEVEL, now + FADE_IN);
    return { ctx: c, master, stop };
  } catch { return null; }
}

/**
 * Nachtgeräusche auf diesem Gerät: `enabled` – Einstellung an und dieses Handy erzählt,
 * `night` – gerade ist Nacht (Ein- und Ausblenden beim Wechsel).
 */
export function useAmbience(enabled: boolean, night: boolean) {
  // Browser spielen erst nach einer Berührung: bei jeder Berührung den Kontext anlegen bzw. fortsetzen
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => { context(); };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [enabled]);
  const on = enabled && night;
  useEffect(() => {
    if (!on) return;
    sound?.stop();
    sound = start();
    const mine = sound;
    return () => { mine?.stop(); if (sound === mine) sound = null; };
  }, [on]);
}
