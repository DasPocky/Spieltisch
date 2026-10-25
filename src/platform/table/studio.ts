/**
 * Showstudio in 3D: Bühne mit großer Leinwand hinten, je Spieler ein Pult im Bogen davor, Lichtleisten und Scheinwerfer.
 * Wer dran ist, steht im Spotlicht, die Kamera fährt sanft zu ihm. Was auf der Leinwand läuft (Tisch, Lobby, Siegerehrung),
 * legt die Seite in HTML darüber (`screenRect`); Namen und Bilder stehen an den Pulten (`podiumPoints`).
 * Bewegung nur, wenn reduzierte Bewegung aus ist – sonst ein ruhiges Standbild, das sich nur bei Änderungen neu zeichnet.
 */
import {
  ACESFilmicToneMapping, AdditiveBlending, BoxGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PointLight, Scene, SpotLight, SRGBColorSpace, TorusGeometry,
  Vector3, WebGLRenderer, type Light, type Material,
} from "three";
import { frameMeter, reducedMotion, renderSettings, type Quality } from "@/lib/quality";
import type { FeltRect } from "./scene";

export interface StudioScene {
  /** Pulte für diese Spieler (Reihenfolge wie am Tisch); `turn`: wer im Spotlicht steht */
  update(seats: string[], turn: string | null): void;
  resize(width: number, height: number): void;
  /** Bildschirmpunkte (CSS-Pixel) oben an den Pulten – dort stehen Bild, Name und Punkte */
  podiumPoints(): { x: number; y: number }[];
  /** Rechteck der Leinwand (CSS-Pixel) – dort zeigt die Seite das Spielgeschehen */
  screenRect(): FeltRect;
  dispose(): void;
}

/** Farben der Pulte (Leuchtstreifen) – warm und klar unterscheidbar */
export const PODIUM_COLORS = ["#ff7a59", "#3ec1b4", "#f2c14e", "#9b7bff", "#ff5fa2", "#5fb0ff", "#8bd450", "#ff9f40"];

const SCREEN_W = 7.2, SCREEN_H = 4.05, SCREEN_Y = 3.1, SCREEN_Z = -3.2;
const ARC_R = 4.6, ARC_Z = -2.2, POD_H = 0.95;

/** Pulte im flachen Bogen vor der Leinwand, von links nach rechts */
function podiumAnchors(n: number): [number, number][] {
  if (n <= 0) return [];
  const spread = Math.min(1.25, 0.24 * (n - 1) + 0.2);
  return Array.from({ length: n }, (_, i) => {
    const a = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
    return [Math.sin(a) * ARC_R, ARC_Z + Math.cos(a) * ARC_R];
  });
}

/** Geometrien und Materialien unter `root` freigeben (Lichter: ihre Schattenkarten) */
function free(root: Object3D) {
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as Material[]) mat.dispose();
    }
    if ((o as Light).isLight) (o as Light).dispose();
  });
}

/** Nur in der Entwicklung: Grafikspeicher aller Bühnen zusammen (auch schon geschlossener) – für den Speicher-Test */
const studioInfos: { geometries: number; textures: number }[] = [];
if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __studioMemory?: () => { geometries: number; textures: number; studios: number } }).__studioMemory = () => ({
  geometries: studioInfos.reduce((n, m) => n + m.geometries, 0), textures: studioInfos.reduce((n, m) => n + m.textures, 0), studios: studioInfos.length,
});

export function createStudioScene(canvas: HTMLCanvasElement, quality: Quality = "hoch", onMove?: () => void): StudioScene {
  const q = renderSettings(quality);
  const renderer = new WebGLRenderer({ canvas, antialias: q.antialias, alpha: false });
  renderer.setPixelRatio(q.pixelRatio);
  renderer.shadowMap.enabled = q.shadows; renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor("#0b0716");
  if (import.meta.env.DEV) studioInfos.push(renderer.info.memory);
  const meter = frameMeter();
  const still = reducedMotion() || quality === "einfach";
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 16 / 9, 0.1, 80);

  // Boden: dunkel glänzend, darauf die runde Bühne mit Leuchtring
  const floor = new Mesh(new PlaneGeometry(60, 60), new MeshStandardMaterial({ color: "#120c22", roughness: 0.35, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const stage = new Mesh(new CylinderGeometry(7.4, 7.6, 0.24, 96), new MeshStandardMaterial({ color: "#2a1d44", roughness: 0.4, metalness: 0.3 }));
  stage.position.set(0, 0.12, -0.6); stage.receiveShadow = true; scene.add(stage);
  const ring = new Mesh(new TorusGeometry(7.5, 0.05, 12, 160), new MeshBasicMaterial({ color: "#ff7a59" }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.25, -0.6); scene.add(ring);

  // Rückwand mit Leinwand und Rahmen
  const wall = new Mesh(new PlaneGeometry(40, 16), new MeshStandardMaterial({ color: "#1a1030", roughness: 0.9 }));
  wall.position.set(0, 8, SCREEN_Z - 0.4); scene.add(wall);
  const frameMat = new MeshStandardMaterial({ color: "#3a2a5c", roughness: 0.3, metalness: 0.6 });
  const frameBox = new Mesh(new BoxGeometry(SCREEN_W + 0.4, SCREEN_H + 0.4, 0.2), frameMat);
  frameBox.position.set(0, SCREEN_Y, SCREEN_Z - 0.12); scene.add(frameBox);
  const screen = new Mesh(new PlaneGeometry(SCREEN_W, SCREEN_H), new MeshBasicMaterial({ color: "#0e2a2c" }));
  screen.position.set(0, SCREEN_Y, SCREEN_Z); scene.add(screen);

  // Lichtleisten an der Wand (senkrecht) und Punkte im Boden
  const strips: MeshBasicMaterial[] = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4;
    const mat = new MeshBasicMaterial({ color: PODIUM_COLORS[k * 2 % PODIUM_COLORS.length] });
    strips.push(mat);
    const bar = new Mesh(new BoxGeometry(0.12, 5.5 - k * 0.6, 0.06), mat);
    bar.position.set(side * (SCREEN_W / 2 + 1.0 + k * 0.9), 2.9 - k * 0.3, SCREEN_Z - 0.3); scene.add(bar);
  }

  // Licht: Grundlicht, zwei schwenkende Scheinwerfer, ein Spot für den, der dran ist
  scene.add(new HemisphereLight("#b9a6ff", "#1a0f22", 0.55));
  const fill = new PointLight("#ffd9b0", 18, 30); fill.position.set(0, 7, 6); scene.add(fill);
  const beams: { light: SpotLight; cone: Mesh; phase: number }[] = [];
  for (const [x, color, phase] of [[-6, "#ff7a59", 0], [6, "#3ec1b4", Math.PI]] as const) {
    const light = new SpotLight(color, 60, 26, 0.32, 0.6, 1.2);
    light.position.set(x, 9, 2); scene.add(light); scene.add(light.target);
    // sichtbarer Lichtkegel (leicht durchscheinend)
    const cone = new Mesh(new ConeGeometry(1.6, 9, 32, 1, true), new MeshBasicMaterial({ color, transparent: true, opacity: 0.07, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    scene.add(cone);
    beams.push({ light, cone, phase });
  }
  const spot = new SpotLight("#fff1dc", 0, 20, 0.28, 0.5, 1);
  spot.castShadow = q.shadows; spot.shadow.mapSize.set(q.shadowSize, q.shadowSize);
  spot.position.set(0, 10, 4); scene.add(spot); scene.add(spot.target);

  // Pulte
  const pods = new Group(); scene.add(pods);
  let seats: string[] = [];
  let turnIdx = -1;
  let anchors: [number, number][] = [];
  const podMats: MeshStandardMaterial[] = [];
  function buildPods() {
    // alte Pulte samt Geometrien und Materialien freigeben (Spielerwechsel)
    free(pods); pods.clear(); podMats.length = 0;
    anchors = podiumAnchors(seats.length);
    anchors.forEach(([x, z], i) => {
      const g = new Object3D();
      g.position.set(x, 0.24, z);
      g.lookAt(0, 0.24, 8);
      const body = new Mesh(new CylinderGeometry(0.55, 0.65, POD_H, 6), new MeshStandardMaterial({ color: "#2f2450", roughness: 0.35, metalness: 0.4 }));
      // flache Seite nach vorn – dort sitzt der Leuchtstreifen
      body.rotation.y = Math.PI / 6;
      body.position.y = POD_H / 2; body.castShadow = body.receiveShadow = true; g.add(body);
      const top = new Mesh(new CylinderGeometry(0.62, 0.58, 0.08, 6), new MeshStandardMaterial({ color: "#4a3a78", roughness: 0.3, metalness: 0.5 }));
      top.rotation.y = Math.PI / 6;
      top.position.y = POD_H + 0.04; g.add(top);
      const color = PODIUM_COLORS[i % PODIUM_COLORS.length];
      const glow = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 });
      podMats.push(glow);
      const stripe = new Mesh(new BoxGeometry(0.5, 0.12, 0.02), glow);
      stripe.position.set(0, POD_H * 0.62, 0.52); g.add(stripe);
      pods.add(g);
    });
  }

  let width = 1, height = 1;
  let camX = 0, camGoal = 0;
  function update(next: string[], turn: string | null) {
    if (next.join() !== seats.join()) { seats = next; buildPods(); }
    turnIdx = turn ? seats.indexOf(turn) : -1;
    podMats.forEach((m, i) => { m.emissiveIntensity = i === turnIdx ? 2.2 : 0.7; });
    if (turnIdx >= 0) {
      const [x, z] = anchors[turnIdx];
      spot.intensity = 140; spot.position.set(x * 0.6, 10, z + 3); spot.target.position.set(x, POD_H, z);
      camGoal = x * 0.18;
    } else { spot.intensity = 0; camGoal = 0; }
    if (still) camX = camGoal;
    fitCamera();
    render();
  }

  // ---------- Kamera ----------
  /** Kamera so, dass Leinwand und alle Pulte ins Bild passen (Abstand per Halbierung) */
  function fitCamera() {
    const target = new Vector3(camX * 0.5, 2.0, -1.6);
    const pts = [
      new Vector3(-SCREEN_W / 2 - 0.3, SCREEN_Y + SCREEN_H / 2 + 0.3, SCREEN_Z), new Vector3(SCREEN_W / 2 + 0.3, SCREEN_Y + SCREEN_H / 2 + 0.3, SCREEN_Z),
      ...anchors.flatMap(([x, z]) => [new Vector3(x - 0.9, 0, z + 0.7), new Vector3(x + 0.9, POD_H + 1.2, z)]),
    ];
    const fits = (d: number) => {
      camera.position.set(camX, 4.2, d);
      camera.lookAt(target);
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      return pts.every((p) => { const v = p.clone().project(camera); return Math.abs(v.x) <= 0.96 && Math.abs(v.y) <= 0.94; });
    };
    let lo = 4, hi = 40;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    fits(hi);
  }

  // ---------- Zeichnen ----------
  let raf = 0, last = 0, alive = true;
  const t0 = performance.now();
  function frame(now: number) {
    raf = 0;
    if (!alive) return;
    const t = (now - t0) / 1000;
    if (last) meter(now - last);
    last = now;
    if (!still) {
      // Scheinwerfer schwenken, Leisten pulsieren, Kamera wiegt sich leicht und folgt dem, der dran ist
      for (const b of beams) {
        const x = Math.sin(t * 0.35 + b.phase) * 4.5, z = -0.5 + Math.cos(t * 0.27 + b.phase) * 2;
        b.light.target.position.set(x, 0, z);
        const from = b.light.position, to = new Vector3(x, 0, z);
        b.cone.position.copy(from).lerp(to, 0.5);
        b.cone.lookAt(to); b.cone.rotateX(-Math.PI / 2);
      }
      strips.forEach((m, i) => { m.color.setStyle(PODIUM_COLORS[(i * 2 + Math.floor(t * 0.5)) % PODIUM_COLORS.length]); });
      // Kamerafahrt zu dem, der dran ist – die Seite rückt Schilder und Leinwand mit
      if (Math.abs(camGoal - camX) > 0.002) { camX += (camGoal - camX) * 0.06; fitCamera(); onMove?.(); }
    } else {
      for (const b of beams) { b.light.target.position.set(b.light.position.x * 0.3, 0, 0); b.cone.visible = false; }
    }
    renderer.render(scene, camera);
    // In Bewegung ~30 Bilder pro Sekunde reichen – so bleibt der Fernseher kühl
    if (!still) setTimeout(() => { if (alive && !raf) raf = requestAnimationFrame(frame); }, 1000 / 30);
  }
  function render() { if (!raf) raf = requestAnimationFrame(frame); }

  function resize(w: number, h: number) {
    width = Math.max(1, w); height = Math.max(1, h);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    fitCamera();
    render();
  }

  const toScreen = (v: Vector3) => { const p = v.clone().project(camera); return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height }; };
  function podiumPoints() {
    return anchors.map(([x, z]) => toScreen(new Vector3(x, POD_H + 0.6, z)));
  }
  function screenRect(): FeltRect {
    const tl = toScreen(new Vector3(-SCREEN_W / 2, SCREEN_Y + SCREEN_H / 2, SCREEN_Z)), br = toScreen(new Vector3(SCREEN_W / 2, SCREEN_Y - SCREEN_H / 2, SCREEN_Z));
    return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
  }

  return {
    update, resize, podiumPoints, screenRect,
    dispose() {
      alive = false; cancelAnimationFrame(raf);
      // erst alles in der Szene freigeben (Pulte, Bühne, Lichter mit Schattenkarten), dann den Zeichner samt Kontext
      free(scene); scene.clear();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
