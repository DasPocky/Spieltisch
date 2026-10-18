/**
 * Moderator in 3D: lädt eine Figur (glTF), stellt sie ins Licht und hält sie lebendig –
 * Atmen, Blinzeln, Blicke, Mundbilder beim Sprechen, Gesichtsausdruck je Charakter und Gesten je Moment.
 *  - Mensch: Gesicht mit Mundbildern (Visemen) und Gesichtsformen, Gesten über das Skelett
 *  - Roboter: fertige Bewegungen (Winken, Ja, Nein, Tanzen …) und drei Gesichtsausdrücke
 * three.js wird nur geladen, wenn die Bühne gebraucht wird.
 */
import {
  AmbientLight, AnimationMixer, Bone, Box3, Clock, DirectionalLight, HemisphereLight, LoopOnce, Mesh, MeshBasicMaterial, CircleGeometry,
  PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer, type AnimationAction,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { renderSettings, type Quality } from "@/lib/quality";
import type { Mood, Moment } from "./lines";
import { visemesOf, type Viseme } from "./visemes";
import { assetUrl } from "@shared/platform/files";

export type FigureKind = "mensch" | "roboter";
/** Figuren liegen im Speicher (R2) – hochgeladen in der Verwaltung unter „Dateien“ */
export const FIGURE_URL: Record<FigureKind, string> = { mensch: assetUrl("moderator/mensch.glb"), roboter: assetUrl("moderator/roboter.glb") };

export interface ModeratorStage {
  /** Text sprechen lassen: Mundbilder laufen nach Schätzung, Wort-Signale der Stimme ziehen nach */
  speak(text: string, durationMs: number): void;
  /** Ein Wort wurde gesprochen (Signal der Stimme) */
  word(): void;
  stopSpeaking(): void;
  setMood(m: Mood): void;
  gesture(m: Moment): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

// ---------------------------------------------------------------- Bühne

/** Bühne für eine Figur in `box` – der Mensch über die Bibliothek (stageHuman.ts), der Roboter hier */
export async function createModeratorStage(box: HTMLElement, kind: FigureKind, quality: Quality, mood: Mood): Promise<ModeratorStage> {
  if (kind === "mensch") return (await import("./stageHuman")).createHumanStage(box, FIGURE_URL.mensch, quality, mood);
  const canvas = document.createElement("canvas");
  canvas.className = "absolute inset-0 size-full";
  box.replaceChildren(canvas);
  const set = renderSettings(quality);
  const renderer = new WebGLRenderer({ canvas, antialias: set.antialias, alpha: true, powerPreference: "low-power" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(set.pixelRatio);
  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 0.05, 50);

  scene.add(new HemisphereLight(0xfff4e6, 0x3a2a1a, 1.1));
  scene.add(new AmbientLight(0xffffff, 0.25));
  const key = new DirectionalLight(0xfff0dc, 2.2); key.position.set(1.5, 2.5, 3); scene.add(key);
  const rim = new DirectionalLight(0x9ec9ff, 1.2); rim.position.set(-2, 2, -2); scene.add(rim);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(FIGURE_URL[kind]);
  const root = gltf.scene;
  scene.add(root);

  // Weicher Schatten am Boden (ein Kreis – günstiger als echte Schatten)
  const shadow = new Mesh(new CircleGeometry(1, 32), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // Rahmen: die ganze Figur
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
  shadow.position.set(center.x, bounds.min.y + 0.001, center.z);
  shadow.scale.setScalar(Math.max(size.x, size.z) * 0.45);
  const focusY = bounds.min.y + size.y * 0.55;
  const span = size.y * 1.15;
  const target = new Vector3(center.x, focusY, center.z);
  const placeCamera = () => {
    const dist = span / 2 / Math.tan((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect * 1.25);
    camera.position.set(center.x, focusY + span * 0.04, center.z + dist);
    camera.lookAt(target);
  };

  // Gesichtsformen über alle Teile (Kopf, Zähne, Augen …) gemeinsam setzen
  const morphs: { mesh: Mesh; dict: Record<string, number> }[] = [];
  root.traverse((o) => { const m = o as Mesh; if (m.isMesh && m.morphTargetDictionary && m.morphTargetInfluences) morphs.push({ mesh: m, dict: m.morphTargetDictionary }); });
  const shape = (name: string, v: number) => { for (const m of morphs) { const i = m.dict[name]; if (i !== undefined) m.mesh.morphTargetInfluences![i] = v; } };
  const bone = (name: string) => { let b: Bone | null = null; root.traverse((o) => { if (!b && (o as Bone).isBone && o.name === name) b = o as Bone; }); return b as Bone | null; };

  // ---------------- Zustand
  let current: Mood = mood;
  const clock = new Clock();
  let t = 0;
  let nextBlink = 1.5, blinkT = -1;
  // Sprechen: Mundbilder je Wort, nach Zeit; Wort-Signale schieben auf das richtige Wort
  let speech: { words: Viseme[][]; starts: number[]; idx: number; t0: number; end: number } | null = null;
  const vis: Partial<Record<Viseme, number>> = {};

  // ---------------- Roboter: fertige Bewegungen
  let mixer: AnimationMixer | null = null;
  const actions: Record<string, AnimationAction> = {};
  let idle: AnimationAction | null = null;
  if (gltf.animations.length) {
    mixer = new AnimationMixer(root);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    idle = actions.Idle ?? null;
    idle?.play();
    mixer.addEventListener("finished", () => { idle?.reset().fadeIn(0.4).play(); });
  }

  /** Gesichtsausdruck je Charakter (drei Ausdrücke des Roboters) */
  const moodFace = (m: Mood) => {
    shape("Angry", m === "boese" ? 0.7 : 0);
    shape("Surprised", m === "frech" ? 0.35 : 0);
    shape("Sad", 0);
  };
  moodFace(current);

  const VISEMES: Viseme[] = ["aa", "E", "I", "O", "U", "PP", "FF", "SS", "CH", "DD", "nn", "kk", "RR"];

  // ---------------- Bild für Bild
  let raf = 0;
  const frame = () => {
    const dt = Math.min(0.05, clock.getDelta());
    t += dt;
    mixer?.update(dt);

    // Blinzeln
    if (t > nextBlink && blinkT < 0) { blinkT = 0; nextBlink = t + 2.5 + Math.random() * 3; }
    if (blinkT >= 0) {
      blinkT += dt;
      const v = blinkT < 0.07 ? blinkT / 0.07 : blinkT < 0.16 ? 1 - (blinkT - 0.07) / 0.09 : 0;
      shape("eyeBlinkLeft", v); shape("eyeBlinkRight", v);
      if (blinkT > 0.16) blinkT = -1;
    }

    // Sprechen: aktuelles Mundbild weich überblenden
    const talking = !!speech && t < speech.end;
    for (const v of VISEMES) vis[v] = (vis[v] ?? 0) * Math.pow(0.0005, dt);
    if (speech && talking) {
      const now = t - speech.t0;
      while (speech.idx + 1 < speech.starts.length && now >= speech.starts[speech.idx + 1]) speech.idx++;
      const w = speech.words[speech.idx];
      const wStart = speech.starts[speech.idx], wEnd = speech.starts[speech.idx + 1] ?? speech.end - speech.t0;
      const k = Math.min(w.length - 1, Math.floor(((now - wStart) / Math.max(0.05, wEnd - wStart)) * w.length));
      const v = w[Math.max(0, k)];
      if (v !== "sil") vis[v] = Math.min(1, (vis[v] ?? 0) + dt * 22);
    } else if (speech && !talking) speech = null;

    // Roboter: beim Sprechen nickt der Kopf leicht, der Mund ist der „Überrascht“-Ausdruck
    const head = bone("Head");
    if (head && talking) head.rotation.x += Math.sin(t * 9) * 0.004;
    if (talking) shape("Surprised", Math.max(current === "frech" ? 0.35 : 0, (vis.aa ?? 0) * 0.6 + (vis.O ?? 0) * 0.6));

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };

  const play = (name: string) => {
    if (!mixer || !actions[name]) return;
    const a = actions[name];
    a.reset(); a.setLoop(LoopOnce, 1); a.clampWhenFinished = false;
    idle?.fadeOut(0.25);
    a.fadeIn(0.25).play();
  };

  raf = requestAnimationFrame(frame);

  return {
    speak(text, durationMs) {
      const words = text.split(/\s+/).filter(Boolean);
      const total = Math.max(0.6, durationMs / 1000);
      const weights = words.map((w) => w.length + 2);
      const sum = weights.reduce((a, b) => a + b, 0);
      let acc = 0;
      const starts = weights.map((w) => { const s = (acc / sum) * total; acc += w; return s; });
      speech = { words: words.map(visemesOf), starts, idx: 0, t0: t, end: t + total };
      moodFace(current);
    },
    word() {
      // Die Stimme ist bei einem neuen Wort: Zeitplan auf dieses Wort ziehen
      if (!speech || speech.idx + 1 >= speech.starts.length) return;
      speech.idx++;
      speech.t0 = t - speech.starts[speech.idx];
    },
    stopSpeaking() { speech = null; moodFace(current); },
    setMood(m) { current = m; moodFace(m); },
    gesture(m) {
      play(m === "hallo" ? "Wave" : m === "dran" ? "Yes" : m === "sieg" ? (current === "boese" ? "ThumbsUp" : "Dance") : "No");
      if (m === "pech") { shape("Sad", 0.8); setTimeout(() => shape("Sad", 0), 2000); }
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      placeCamera();
    },
    dispose() {
      cancelAnimationFrame(raf);
      mixer?.stopAllAction();
      renderer.dispose();
      root.traverse((o) => { const m = o as Mesh; if (m.isMesh) { m.geometry.dispose(); const mat = m.material; (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose()); } });
    },
  };
}
