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
import { reducedMotion, renderSettings, type Quality } from "@/lib/quality";
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
  const set = renderSettings(quality);
  const calm = reducedMotion();
  const before = new Set(box.children);
  const head = new TalkingHead(box, {
    ttsEndpoint: "",
    lipsyncModules: [],
    lipsyncLang: "de",
    cameraView: "mid",
    cameraRotateEnable: false,
    cameraZoomEnable: false,
    cameraPanEnable: false,
    modelPixelRatio: set.pixelRatio,
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
  const playMoment = (m: Moment) => {
    if (m === "hallo") head.playGesture("handup", 3);
    else if (m === "dran") { head.playGesture("index", 2.5); head.playGesture("yes", 1.5); }
    else if (m === "sieg") head.playGesture(current === "boese" ? "ok" : "thumbup", 3);
    else { head.playGesture(current === "boese" ? "thumbdown" : "shrug", 2.5); head.playGesture("no", 1.5); }
  };

  return {
    speak(text, durationMs) {
      // Wörter gleichmäßig nach Länge über die geschätzte Sprechdauer verteilen
      const words = text.split(/\s+/).filter(Boolean);
      const weights = words.map((w) => w.length + 2);
      const sum = weights.reduce((a, b) => a + b, 0);
      let acc = 0;
      const wtimes = weights.map((w) => { const t = (acc / sum) * durationMs; acc += w; return t; });
      const wdurations = weights.map((w) => (w / sum) * durationMs * 0.92);
      const ctx = head.audioCtx;
      const audio = ctx.createBuffer(1, Math.max(1, Math.ceil((ctx.sampleRate * durationMs) / 1000)), ctx.sampleRate);
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
      head.speakAudio({ audio, words, wtimes, wdurations }, { lipsyncLang: "de" });
    },
    word() { /* die Bibliothek hält ihren eigenen Takt */ },
    stopSpeaking() { head.stopSpeaking(); },
    setMood(m) { current = m; head.setMood(MOOD[m]); },
    gesture(m) {
      // Nach dem Sprechstart: die Bibliothek setzt beim Sprechen eigene Handbewegungen, die Geste soll gewinnen
      setTimeout(() => playMoment(m), 120);
    },
    resize() { head.onResize(); },
    dispose() {
      try { head.stop(); head.stopSpeaking(); head.resizeobserver?.disconnect(); head.clearThree(head.scene); head.renderer.dispose(); } catch { /* egal */ }
      for (const c of own) c.remove();
    },
  };
}
