/**
 * Moderator in 3D: lädt eine Figur (glTF), stellt sie ins Licht und hält sie lebendig –
 * Atmen, Blinzeln, Blicke, Mundbilder beim Sprechen, Gesichtsausdruck je Charakter und Gesten je Moment.
 *  - Mensch: Gesicht mit Mundbildern (Visemen) und Gesichtsformen, Gesten über das Skelett
 *  - Roboter: fertige Bewegungen (Winken, Ja, Nein, Tanzen …) und drei Gesichtsausdrücke
 * three.js wird nur geladen, wenn die Bühne gebraucht wird.
 */
import {
  AmbientLight, AnimationMixer, Bone, Box3, Clock, DirectionalLight, HemisphereLight, LoopOnce, Mesh, MeshBasicMaterial, CircleGeometry,
  Color, MeshStandardMaterial, PerspectiveCamera, Quaternion, Scene, SRGBColorSpace, Vector3, WebGLRenderer, type AnimationAction,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { reducedMotion, renderSettings, type Quality } from "@/lib/quality";
import type { Mood, Moment } from "./lines";
import { visemesOf, type Viseme } from "./visemes";

export type FigureKind = "mensch" | "roboter";
export const FIGURE_URL: Record<FigureKind, string> = { mensch: "/models/moderator/mensch.glb", roboter: "/models/moderator/roboter.glb" };

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

export async function createModeratorStage(canvas: HTMLCanvasElement, kind: FigureKind, quality: Quality, mood: Mood): Promise<ModeratorStage> {
  const set = renderSettings(quality);
  const calm = reducedMotion();
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

  // Rahmen: Mensch von der Brust aufwärts, Roboter ganz
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
  shadow.position.set(center.x, box.min.y + 0.001, center.z);
  shadow.scale.setScalar(Math.max(size.x, size.z) * 0.45);
  const focusY = kind === "mensch" ? box.min.y + size.y * 0.82 : box.min.y + size.y * 0.55;
  const span = kind === "mensch" ? size.y * 0.52 : size.y * 1.15;
  const target = new Vector3(center.x, focusY, center.z);
  const placeCamera = () => {
    const dist = span / 2 / Math.tan((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect * 1.25);
    camera.position.set(center.x, focusY + span * 0.04, center.z + dist);
    camera.lookAt(target);
  };

  // Gesichtsformen über alle Teile (Kopf, Zähne, Augen …) gemeinsam setzen
  const morphs: { mesh: Mesh; dict: Record<string, number> }[] = [];
  root.traverse((o) => { const m = o as Mesh; if (m.isMesh && m.morphTargetDictionary && m.morphTargetInfluences) morphs.push({ mesh: m, dict: m.morphTargetDictionary }); });
  const has = (name: string) => morphs.some((m) => name in m.dict);
  const shape = (name: string, v: number) => { for (const m of morphs) { const i = m.dict[name]; if (i !== undefined) m.mesh.morphTargetInfluences![i] = v; } };
  const bone = (name: string) => { let b: Bone | null = null; root.traverse((o) => { if (!b && (o as Bone).isBone && o.name === name) b = o as Bone; }); return b as Bone | null; };

  // ---------------- Zustand
  let current: Mood = mood;
  const clock = new Clock();
  let t = 0;
  let nextBlink = 1.5, blinkT = -1;
  let gazeT = 0, gaze = { x: 0, y: 0 }, gazeGoal = { x: 0, y: 0 };
  // Sprechen: Mundbilder je Wort, nach Zeit; Wort-Signale schieben auf das richtige Wort
  let speech: { words: Viseme[][]; starts: number[]; idx: number; t0: number; end: number } | null = null;
  const vis: Partial<Record<Viseme, number>> = {};
  // Geste: Name und Startzeit
  let gest: { m: Moment; t0: number } | null = null;

  // ---------------- Roboter: fertige Bewegungen
  let mixer: AnimationMixer | null = null;
  const actions: Record<string, AnimationAction> = {};
  let idle: AnimationAction | null = null;
  if (kind === "roboter" && gltf.animations.length) {
    mixer = new AnimationMixer(root);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    idle = actions.Idle ?? null;
    idle?.play();
    mixer.addEventListener("finished", () => { idle?.reset().fadeIn(0.4).play(); });
  }

  // ---------------- Mensch: Knochen für Haltung und Gesten
  const B = kind === "mensch" ? {
    spine: bone("Spine2"), neck: bone("Neck"), head: bone("Head"),
    lArm: bone("LeftArm"), rArm: bone("RightArm"), lFore: bone("LeftForeArm"), rFore: bone("RightForeArm"),
  } : null;
  const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
  const _q = new Quaternion(), _p = new Quaternion();
  /** Knochen um eine Achse der Welt drehen (unabhängig davon, wie der Knochen selbst liegt) */
  const turn = (b: Bone | null, axis: Vector3, ang: number) => {
    if (!b || !ang || !b.parent) return;
    b.parent.getWorldQuaternion(_p);
    _q.setFromAxisAngle(axis, ang);
    b.quaternion.premultiply(_p.clone().invert().multiply(_q).multiply(_p));
  };
  const rest = new Map<Bone, Quaternion>();
  if (B) {
    root.updateMatrixWorld(true);
    // Die Figur steht mit ausgestreckten Armen: Arme locker nach unten
    turn(B.lArm, Z, -1.25); turn(B.rArm, Z, 1.25);
    turn(B.lFore, X, -0.25); turn(B.rFore, X, -0.25);
    for (const b of Object.values(B)) if (b) rest.set(b, b.quaternion.clone());
    // Shirt ohne Aufdruck – einfarbig in einer Farbe der App
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if (/casualsuit/i.test(mat.name) && mat instanceof MeshStandardMaterial) { mat.map = null; mat.color = new Color("#2f6f6a"); mat.roughness = 0.85; mat.needsUpdate = true; }
      }
    });
  }

  /** Gesichtsausdruck je Charakter (Mensch: Gesichtsformen; Roboter: drei Ausdrücke) */
  const moodFace = (m: Mood, talking: boolean) => {
    if (kind === "roboter") {
      shape("Angry", m === "boese" ? 0.7 : 0);
      shape("Surprised", m === "frech" ? 0.35 : 0);
      shape("Sad", 0);
      return;
    }
    const smile = m === "charmant" ? 0.45 : m === "frech" ? 0.25 : 0;
    shape("mouthSmileLeft", talking ? smile * 0.5 : smile);
    shape("mouthSmileRight", talking ? (m === "frech" ? 0.05 : smile * 0.5) : m === "frech" ? 0.05 : smile);
    shape("browInnerUp", m === "charmant" ? 0.25 : 0);
    shape("browOuterUpLeft", m === "frech" ? 0.55 : 0);
    shape("browDownLeft", m === "boese" ? 0.6 : 0);
    shape("browDownRight", m === "boese" ? 0.6 : m === "frech" ? 0.25 : 0);
    shape("eyeSquintLeft", m === "boese" ? 0.35 : m === "frech" ? 0.2 : 0);
    shape("eyeSquintRight", m === "boese" ? 0.35 : 0);
    shape("mouthFrownLeft", m === "boese" ? 0.25 : 0);
    shape("mouthFrownRight", m === "boese" ? 0.25 : 0);
  };
  moodFace(current, false);

  const VISEMES: Viseme[] = ["aa", "E", "I", "O", "U", "PP", "FF", "SS", "CH", "DD", "nn", "kk", "RR"];

  // ---------------- Bild für Bild
  let raf = 0;
  const amp = calm ? 0.35 : 1;
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
    if (has("viseme_aa")) {
      for (const v of VISEMES) shape(`viseme_${v}`, (vis[v] ?? 0) * 0.85);
      shape("jawOpen", Math.max(vis.aa ?? 0, vis.O ?? 0, vis.E ?? 0) * 0.25);
    }

    // Mensch: Atmen, Kopf, Blick, Gesten
    if (B) {
      for (const [bn, q] of rest) bn.quaternion.copy(q);
      const breathe = Math.sin(t * 1.6) * 0.015 * amp;
      let nod = Math.sin(t * 0.7) * 0.03 * amp + (talking ? Math.sin(t * 5.3) * 0.03 * amp : 0);
      let shake = Math.sin(t * 0.43) * 0.07 * amp;
      const tilt = Math.sin(t * 0.31) * 0.03 * amp;
      // Arme schwingen leicht mit (sonst wirken sie wie angeklebt)
      let rArmZ = Math.sin(t * 0.9) * 0.02 * amp, lArmZ = -Math.sin(t * 0.8) * 0.02 * amp, rArmX = 0, rForeZ = 0, lForeZ = 0;
      if (gest) {
        const g = t - gest.t0, e = Math.min(1, g / 0.35) * Math.min(1, Math.max(0, (2.4 - g) / 0.5));
        if (gest.m === "hallo") { rArmZ -= 2.6 * e; rForeZ = (-0.9 + Math.sin(g * 9) * 0.45) * e; }
        else if (gest.m === "dran") { nod += Math.sin(g * 7) * 0.12 * e; rArmX = -1.0 * e; }
        else if (gest.m === "sieg") { rArmZ -= 2.9 * e; lArmZ += 2.9 * e; rForeZ = -0.35 * e; lForeZ = 0.35 * e; nod -= 0.1 * e; }
        else if (gest.m === "pech") { shake += Math.sin(g * 8) * 0.2 * e; nod += 0.12 * e; }
        if (g > 2.4) gest = null;
      }
      turn(B.spine, X, breathe);
      turn(B.neck, X, nod * 0.4); turn(B.neck, Y, shake * 0.4);
      turn(B.head, X, nod); turn(B.head, Y, shake); turn(B.head, Z, tilt);
      turn(B.rArm, Z, rArmZ); turn(B.rArm, X, rArmX); turn(B.lArm, Z, lArmZ);
      turn(B.rFore, Z, rForeZ); turn(B.lFore, Z, lForeZ);
      // Blicke: ab und zu woandershin, sonst zur Kamera
      gazeT -= dt;
      if (gazeT < 0) { gazeT = 1 + Math.random() * 2.5; gazeGoal = Math.random() < 0.6 ? { x: 0, y: 0 } : { x: (Math.random() - 0.5) * 0.8, y: (Math.random() - 0.5) * 0.4 }; }
      gaze.x += (gazeGoal.x - gaze.x) * Math.min(1, dt * 8); gaze.y += (gazeGoal.y - gaze.y) * Math.min(1, dt * 8);
      shape("eyeLookOutLeft", Math.max(0, -gaze.x)); shape("eyeLookInRight", Math.max(0, -gaze.x));
      shape("eyeLookInLeft", Math.max(0, gaze.x)); shape("eyeLookOutRight", Math.max(0, gaze.x));
      shape("eyeLookUpLeft", Math.max(0, gaze.y)); shape("eyeLookUpRight", Math.max(0, gaze.y));
      shape("eyeLookDownLeft", Math.max(0, -gaze.y)); shape("eyeLookDownRight", Math.max(0, -gaze.y));
    } else {
      // Roboter: beim Sprechen nickt der Kopf leicht, der Mund ist der „Überrascht“-Ausdruck
      const head = bone("Head");
      if (head && talking) head.rotation.x += Math.sin(t * 9) * 0.004;
      if (talking) shape("Surprised", Math.max(current === "frech" ? 0.35 : 0, (vis.aa ?? 0) * 0.6 + (vis.O ?? 0) * 0.6));
    }

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
      moodFace(current, true);
    },
    word() {
      // Die Stimme ist bei einem neuen Wort: Zeitplan auf dieses Wort ziehen
      if (!speech || speech.idx + 1 >= speech.starts.length) return;
      speech.idx++;
      speech.t0 = t - speech.starts[speech.idx];
    },
    stopSpeaking() { speech = null; moodFace(current, false); },
    setMood(m) { current = m; moodFace(m, !!speech); },
    gesture(m) {
      if (kind === "roboter") play(m === "hallo" ? "Wave" : m === "dran" ? "Yes" : m === "sieg" ? (current === "boese" ? "ThumbsUp" : "Dance") : "No");
      else gest = { m, t0: t };
      if (m === "pech" && kind === "roboter") { shape("Sad", 0.8); setTimeout(() => shape("Sad", 0), 2000); }
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
