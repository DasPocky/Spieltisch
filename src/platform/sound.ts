import { onPrefs, prefs } from "@/lib/prefs";

/**
 * Töne – alles mit WebAudio erzeugt, ohne Audiodateien. Drei Kanäle mit eigener Lautstärke (Profil bzw. Tisch):
 *  - Effekte: Karte legen, ziehen, Würfel, „du bist dran“, Sieg
 *  - Musik: leise, ruhige Begleitung am großen Tisch (Lobby etwas lebhafter als während der Partie)
 *  - Publikum: Applaus, Jubel, „Oooh“, Lachen am großen Tisch
 * Alles bleibt dezent; ohne Erlaubnis (Einstellung „Töne“) oder ohne WebAudio passiert einfach nichts.
 */
export type Sound = "place" | "draw" | "dice" | "turn" | "win" | "error" | "bell";
export type Crowd = "applause" | "cheer" | "aww" | "laugh";
export type MusicMood = "lobby" | "play";

const VOLUME = 0.22;
const MUSIC_VOLUME = 0.16;
const CROWD_VOLUME = 0.3;
let ctx: AudioContext | null = null;
/** Effekte */
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let crowdBus: GainNode | null = null;
/** Echte Stimme (Ansagen) – eigene Spur, nicht vom Regler „Effekte“ abhängig */
let voiceBus: GainNode | null = null;

/** Lautstärke-Regler wirken quadratisch – so klingt die Mitte des Reglers auch nach Mitte */
const level = (v: number) => v * v;

function applyVolumes() {
  if (!ctx || !master || !musicBus || !crowdBus) return;
  const p = prefs(), t = ctx.currentTime, on = p.sound ? 1 : 0;
  master.gain.setTargetAtTime(VOLUME * level(p.volFx) * on + 1e-4, t, 0.05);
  musicBus.gain.setTargetAtTime(MUSIC_VOLUME * level(p.volMusic) * on + 1e-4, t, 0.3);
  crowdBus.gain.setTargetAtTime(CROWD_VOLUME * level(p.volCrowd) * on + 1e-4, t, 0.05);
}
let noiseBuf: AudioBuffer | null = null;
/** Zeitpunkt der letzten Berührung/Taste – Zug-Töne nur direkt nach eigener Eingabe */
let lastGesture = 0;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // Ein Begrenzer am Ende: auch alles zugleich wird nie zu laut
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -10; limit.ratio.value = 8;
      limit.connect(ctx.destination);
      master = ctx.createGain(); master.connect(limit);
      musicBus = ctx.createGain(); musicBus.connect(limit);
      crowdBus = ctx.createGain(); crowdBus.connect(limit);
      voiceBus = ctx.createGain(); voiceBus.gain.value = 0.95; voiceBus.connect(limit);
      applyVolumes();
      onPrefs(applyVolumes);
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
function env(c: AudioContext, at: number, dur: number, peak: number, attack = 0.005, out: AudioNode = master!): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(out);
  return g;
}

function tone(c: AudioContext, freq: number, at: number, dur: number, peak: number, type: OscillatorType = "sine", to?: number, attack?: number, out?: AudioNode) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  o.connect(env(c, at, dur, peak, attack, out));
  o.start(at);
  o.stop(at + dur + 0.02);
}

function hiss(c: AudioContext, at: number, dur: number, peak: number, freq: number, to?: number, attack?: number, q = 1.2, out?: AudioNode) {
  const s = c.createBufferSource();
  s.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, at);
  if (to) f.frequency.exponentialRampToValueAtTime(to, at + dur);
  s.connect(f);
  f.connect(env(c, at, dur, peak, attack, out));
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
  // Tischklingel: heller Schlag mit unharmonischen Obertönen, lang ausklingend
  bell: (c, t) => { tone(c, 1760, t, 1.3, 0.3, "sine", undefined, 0.002); tone(c, 1760 * 2.76, t, 0.6, 0.09, "sine", undefined, 0.002); tone(c, 1760 * 5.4, t, 0.25, 0.04, "sine", undefined, 0.002); hiss(c, t, 0.03, 0.3, 5000, undefined, 0.001, 2); },
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

// ---------------------------------------------------------------- Publikum

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Viele kleine Klatscher, dichter am Anfang, langsam ausklingend */
function claps(c: AudioContext, t: number, dur: number, density: number) {
  for (let at = t; at < t + dur; at += rand(0.004, 0.02) / density) {
    const fade = 1 - (at - t) / dur;
    if (Math.random() > fade * 1.1) continue;
    hiss(c, at, rand(0.02, 0.05), rand(0.15, 0.4) * fade, rand(900, 2600), undefined, 0.002, rand(1.5, 4), crowdBus!);
  }
}

/** Stimmen-Wolke: Rauschen durch zwei Formanten, deren Tonhöhe gleitet („Ooh“, „Aah“, „Wooo“) */
function voices(c: AudioContext, t: number, dur: number, peak: number, f1: [number, number], f2: [number, number]) {
  for (const [from, to, q] of [[f1[0], f1[1], 6], [f2[0], f2[1], 9]] as const) hiss(c, t, dur, peak, from, to, dur * 0.25, q, crowdBus!);
}

const CROWD: Record<Crowd, (c: AudioContext, t: number) => void> = {
  applause: (c, t) => claps(c, t, 2.6, 1),
  cheer: (c, t) => { claps(c, t + 0.1, 3.2, 1.3); voices(c, t, 1.6, 0.5, [500, 750], [1100, 1500]); },
  aww: (c, t) => voices(c, t, 1.4, 0.55, [650, 380], [1050, 800]),
  // „Haha“ aus vielen Mündern: kurze Formant-Stöße, leicht versetzt
  laugh: (c, t) => {
    for (let v = 0; v < 5; v++) {
      const base = rand(550, 900), off = rand(0, 0.25);
      for (let k = 0; k < 5; k++) voices(c, t + off + k * rand(0.15, 0.2), 0.12, 0.3, [base, base * 0.9], [base * 1.8, base * 1.6]);
    }
  },
};

/** Publikum reagieren lassen – nie mit Fehler */
export function playCrowd(kind: Crowd, opts: { force?: boolean } = {}) {
  if (!opts.force && !prefs().sound) return;
  try {
    const c = audio();
    if (!c || !crowdBus) return;
    CROWD[kind](c, c.currentTime + 0.02);
  } catch { /* egal */ }
}

// ---------------------------------------------------------------- Musik

/** Ruhige Akkordfolge (Fmaj7 – Em7 – Dm7 – Cmaj7), je Akkord zwei Takte */
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

let music: { mood: MusicMood; timer: ReturnType<typeof setInterval>; next: number; step: number; out: GainNode } | null = null;

/** Ein Schritt (Achtel): Fläche zum Taktbeginn, Bass, in der Lobby ein leises Zupfen */
function musicStep(c: AudioContext, m: NonNullable<typeof music>, at: number) {
  const beat = 60 / (m.mood === "lobby" ? 84 : 72) / 2;
  const chord = CHORDS[Math.floor(m.step / 16) % CHORDS.length];
  const pos = m.step % 16;
  if (pos === 0) {
    // weiche Fläche über zwei Takte
    for (const n of chord) for (const det of [-4, 4]) {
      const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = hz(n); o.detune.value = det;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
      const g = c.createGain(); const len = beat * 16;
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.05, at + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, at + len + 0.4);
      o.connect(f); f.connect(g); g.connect(m.out); o.start(at); o.stop(at + len + 0.5);
    }
  }
  if (pos % 4 === 0) tone(c, hz(chord[0] - 12), at, beat * 3.5, pos === 0 ? 0.22 : 0.14, "sine", undefined, 0.02, m.out);
  if (m.mood === "lobby" && pos % 2 === 0 && Math.random() < 0.7) {
    const n = chord[(pos / 2 + Math.floor(m.step / 16)) % chord.length] + 12;
    tone(c, hz(n), at, beat * 2.5, 0.09, "triangle", undefined, 0.005, m.out);
  }
}

/**
 * Musik starten bzw. die Stimmung wechseln (sanft überblenden). Läuft nur, solange Töne an sind;
 * vorausgeplant in kleinen Schritten, damit ein kurz hängender Tab nicht stolpert.
 */
export function startMusic(mood: MusicMood) {
  if (music?.mood === mood) return;
  stopMusic();
  const c = audio();
  if (!c || !musicBus) return;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, c.currentTime); out.gain.linearRampToValueAtTime(1, c.currentTime + 2.5);
  out.connect(musicBus);
  const m = { mood, next: c.currentTime + 0.1, step: 0, out, timer: 0 as unknown as ReturnType<typeof setInterval> };
  m.timer = setInterval(() => {
    try {
      if (c.state !== "running" || !prefs().sound || prefs().volMusic === 0) { m.next = Math.max(m.next, c.currentTime + 0.1); return; }
      const beat = 60 / (mood === "lobby" ? 84 : 72) / 2;
      while (m.next < c.currentTime + 0.4) { musicStep(c, m, m.next); m.next += beat; m.step++; }
    } catch { /* egal */ }
  }, 150);
  music = m;
}

export function stopMusic() {
  if (!music || !ctx) { music = null; return; }
  const m = music; music = null;
  clearInterval(m.timer);
  try { m.out.gain.cancelScheduledValues(ctx.currentTime); m.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5); } catch { /* egal */ }
  setTimeout(() => { try { m.out.disconnect(); } catch { /* egal */ } }, 3000);
}

/** Läuft der Ton schon? (Fernseher: Browser erlauben Ton erst nach einem Klick) */
export const audioRunning = () => ctx?.state === "running";
/** Ton nach einem Klick freischalten */
export const unlockAudio = () => { audio(); };

/** Ausgang für die echte Stimme (null ohne WebAudio) */
export function voiceOut(): { ctx: AudioContext; out: GainNode } | null {
  const c = audio();
  return c && voiceBus ? { ctx: c, out: voiceBus } : null;
}
