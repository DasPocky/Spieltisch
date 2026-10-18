/**
 * Menschlicher Moderator mit der Bibliothek „TalkingHead“ (MIT): natürliches Stehen mit Gewichtsverlagerung, Atmen,
 * Blickkontakt, Stimmungen, Handgesten und Mundbilder auf Deutsch. Die Stimme kommt vom Gerät; die Bibliothek bekommt
 * dazu Wörter mit geschätzten Zeiten und eine stille Tonspur gleicher Länge – so laufen Mund und Hände im Takt.
 */
import { TalkingHead } from "@met4citizen/talkinghead";
import { LipsyncDe } from "@met4citizen/talkinghead/modules/lipsync-de.mjs";
import { Color, MeshStandardMaterial, type Mesh, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { reducedMotion, type Quality } from "@/lib/quality";
import type { Mood, Moment } from "./lines";
import type { ModeratorStage } from "./stage3d";

// Unsere Figur ist mit Meshopt verkleinert – der Lader der Bibliothek kennt den Entpacker nicht von selbst
const proto = GLTFLoader.prototype as GLTFLoader & { spieltischMeshopt?: boolean };
if (!proto.spieltischMeshopt) {
  const load = proto.load;
  proto.load = function (this: GLTFLoader, ...args: Parameters<GLTFLoader["load"]>) { this.setMeshoptDecoder(MeshoptDecoder); return load.apply(this, args); };
  proto.spieltischMeshopt = true;
}

/** Charakter → Stimmung der Figur */
const MOOD: Record<Mood, string> = { charmant: "happy", frech: "neutral", boese: "angry" };

export async function createHumanStage(box: HTMLElement, url: string, quality: Quality, mood: Mood): Promise<ModeratorStage> {
  const calm = reducedMotion();
  const before = new Set(box.children);
  const head = new TalkingHead(box, {
    ttsEndpoint: "",
    lipsyncModules: [],
    lipsyncLang: "de",
    // Kopf bis Hüfte: Mund gut sichtbar, erhobene Hände bleiben im Bild
    cameraView: "upper",
    cameraDistance: 1.6,
    cameraY: 0.35,
    cameraRotateEnable: false,
    cameraZoomEnable: false,
    cameraPanEnable: false,
    // Eine Figur allein ist günstig: scharf zeichnen (Handys haben 2–3 Bildpunkte je Punkt)
    modelPixelRatio: quality === "einfach" ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 2),
    modelFPS: quality === "einfach" ? 24 : 30,
    modelMovementFactor: calm ? 0.4 : 1,
    avatarIdleEyeContact: 0.45,
    avatarSpeakingEyeContact: 0.75,
    avatarIdleHeadMove: calm ? 0.2 : 0.5,
    avatarSpeakingHeadMove: calm ? 0.3 : 0.6,
    lightAmbientIntensity: 1.3,
    lightDirectIntensity: 14,
  });
  // Nur was diese Bühne angelegt hat, gehört ihr (eine zweite Bühne kann im selben Kasten stehen)
  const own = [...box.children].filter((c) => !before.has(c));
  head.lipsync.de = new LipsyncDe();
  await head.showAvatar({ url, body: "F", avatarMood: MOOD[mood], lipsyncLang: "de" });
  // Shirt ohne Aufdruck – einfarbig in einer Farbe der App
  (head.scene as Object3D).traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (/casualsuit/i.test(mat.name) && mat instanceof MeshStandardMaterial) { mat.map = null; mat.color = new Color("#2f6f6a"); mat.roughness = 0.85; mat.needsUpdate = true; }
    }
  });
  if (import.meta.env.DEV) for (const c of own) (c as unknown as { head?: unknown }).head = head;
  let current = mood;
  // Sprechen: Plan der Mundbilder (Sekunden ab Start), eigener Takt
  let talk: { plan: { v: string; t: number; d: number; word: number }[]; t0: number; wordStarts: number[] } | null = null;
  let raf = 0, last = 0;
  // Mundbilder weich überblenden – direkt als Echtzeit-Werte (die überstimmen die Animationen der Bibliothek)
  const VIS = ["aa", "E", "I", "O", "U", "PP", "SS", "TH", "DD", "FF", "kk", "nn", "RR", "CH"];
  const level: Record<string, number> = {};
  const mt = head.mtAvatar as Record<string, { realtime: number | null; needsUpdate: boolean }>;
  const put = (v: string, x: number | null) => { const m = mt[`viseme_${v}`]; if (m) { m.realtime = x; m.needsUpdate = true; } };
  const mouth = (now: number) => {
    raf = 0;
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;
    const t = talk ? (performance.now() - talk.t0) / 1000 : 0;
    const end = talk?.plan.at(-1);
    if (talk && (!end || t > end.t + end.d + 0.2)) talk = null;
    const cur = talk?.plan.find((p) => t >= p.t && t < p.t + p.d);
    let open = false, jaw = 0;
    for (const v of VIS) {
      const want = cur && cur.v === v ? (v === "PP" || v === "FF" ? 0.95 : 0.8) : 0;
      level[v] = (level[v] ?? 0) + (want - (level[v] ?? 0)) * Math.min(1, dt * 22);
      if (level[v] > 0.01) open = true;
      put(v, talk || level[v] > 0.01 ? level[v] : null);
      if (v === "aa" || v === "O") jaw += level[v] * 0.45; else if (v === "E" || v === "I" || v === "U") jaw += level[v] * 0.2;
    }
    // Kiefer mit öffnen – sonst bewegen sich nur die Lippen und der Mund wirkt aus der Ferne still
    const j = mt.jawOpen;
    if (j) { j.realtime = talk || jaw > 0.01 ? Math.min(0.5, jaw) : null; j.needsUpdate = true; }
    if (talk || open) raf = requestAnimationFrame(mouth);
    else last = 0;
  };
  const playMoment = (m: Moment) => {
    if (m === "hallo") head.playGesture("handup", 3);
    else if (m === "dran") { head.playGesture("index", 2.5); head.playGesture("yes", 1.5); }
    else if (m === "sieg") head.playGesture(current === "boese" ? "ok" : "thumbup", 3);
    else { head.playGesture(current === "boese" ? "thumbdown" : "shrug", 2.5); head.playGesture("no", 1.5); }
  };

  return {
    speak(text, durationMs) {
      // Mundbilder selbst takten (unabhängig von der Tonausgabe – auf manchen Handys läuft die Bibliothek sonst stumm)
      const de = head.lipsync.de;
      const words = de.preProcessText(text).split(" ").filter(Boolean).map((w) => de.wordsToVisemes(w));
      const pause = 1.2; // Lücke zwischen Wörtern (in Viseme-Einheiten)
      const total = words.reduce((a, w) => a + (w.times.at(-1) ?? 0) + (w.durations.at(-1) ?? 0) + pause, 0) || 1;
      const k = durationMs / 1000 / total;
      const plan: { v: string; t: number; d: number; word: number }[] = [];
      let at = 0;
      words.forEach((w, i) => {
        w.visemes.forEach((v, j) => plan.push({ v, t: (at + w.times[j]) * k, d: w.durations[j] * k, word: i }));
        at += (w.times.at(-1) ?? 0) + (w.durations.at(-1) ?? 0) + pause;
      });
      talk = { plan, t0: performance.now(), wordStarts: words.map((_, i) => plan.find((p) => p.word === i)?.t ?? 0) };
      if (!raf) raf = requestAnimationFrame(mouth);
    },
    word() {
      // Die Stimme ist bei einem neuen Wort: Zeitplan auf dieses Wort ziehen
      if (!talk) return;
      const now = (performance.now() - talk.t0) / 1000;
      const next = talk.wordStarts.find((t) => t > now + 0.05);
      if (next !== undefined) talk.t0 -= (next - now) * 1000;
    },
    stopSpeaking() { talk = null; },
    setMood(m) { current = m; head.setMood(MOOD[m]); },
    gesture(m) {
      // Nach dem Sprechstart: die Bibliothek setzt beim Sprechen eigene Handbewegungen, die Geste soll gewinnen
      setTimeout(() => playMoment(m), 120);
    },
    resize() { head.onResize(); },
    dispose() {
      cancelAnimationFrame(raf);
      try { head.stop(); head.stopSpeaking(); head.resizeobserver?.disconnect(); head.clearThree(head.scene); head.renderer.dispose(); } catch { /* egal */ }
      for (const c of own) c.remove();
    },
  };
}
