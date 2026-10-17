/**
 * Großer Tisch in 3D: eckiger Holztisch mit Filzeinlage unter warmem Licht, schräg von vorn gesehen.
 * Stapel und Ablage liegen in der Mitte, vor jedem Platz die verdeckte Hand. Gezeichnet wird nur, wenn sich etwas ändert
 * (oder eine Karte gerade fliegt) – so bleibt der Rechner kühl.
 */
import {
  ACESFilmicToneMapping, BoxGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, DirectionalLight, ExtrudeGeometry, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, RepeatWrapping, Scene, Shape, SpotLight,
  SRGBColorSpace, Vector3, WebGLRenderer, AdditiveBlending, type Material, type Texture,
} from "three";
import { CARD_RATIO, drawBack, drawFace } from "./textures";
import type { TableDeck, TableModel } from "./model";

export interface FeltRect { x: number; y: number; w: number; h: number }

export interface TableScene {
  /** Partie zeigen (null: leerer Tisch, z. B. in der Lobby). `seats`: Spieler in Tischreihenfolge. */
  update(model: TableModel | null, seats: string[]): void;
  resize(width: number, height: number): void;
  /** Bildschirmpunkte (CSS-Pixel) der Plätze am Tischrand – dort stehen Name, Bild und Video */
  seatPoints(): { x: number; y: number }[];
  /** Größtes Rechteck (CSS-Pixel), das ganz auf dem Filz liegt – dort liegen Karten und Schilder in HTML */
  feltRect(): FeltRect;
  dispose(): void;
}

// Maße in Metern (ungefähr): Platte 5,2 × 3,3, Filz 4,5 × 2,6
const TOP_W = 5.2, TOP_D = 3.3, FELT_W = 4.5, FELT_D = 2.6;
const SURFACE = 0.06;
const CARD_W = 0.5;

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function texture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = 1): CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 16;
  return t;
}

/** Holzmaserung und Filzrauschen – aus Code, ohne Bilddateien */
function woodTexture() {
  return texture(2048, 2048, (g) => {
    g.fillStyle = "#8a5a36"; g.fillRect(0, 0, 2048, 2048);
    for (let i = 0; i < 520; i++) {
      const y = rnd() * 2048;
      g.strokeStyle = `rgba(${rnd() < 0.5 ? "60,30,12" : "190,130,80"},${0.05 + rnd() * 0.12})`; g.lineWidth = 1 + rnd() * 5;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 2048; x += 32) g.lineTo(x, y + Math.sin(x / 280 + i) * 10 + (rnd() - 0.5) * 3);
      g.stroke();
    }
  }, 2);
}
function feltTexture() {
  return texture(1024, 1024, (g) => {
    g.fillStyle = "#2a7a72"; g.fillRect(0, 0, 1024, 1024);
    const d = g.getImageData(0, 0, 1024, 1024);
    for (let i = 0; i < d.data.length; i += 4) { const n = (rnd() - 0.5) * 14; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
    g.putImageData(d, 0, 0);
  }, 4);
}

function roundedShape(w: number, d: number, r: number) {
  const s = new Shape(); const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function slab(w: number, d: number, r: number, depth: number, bevel: number, mat: Material) {
  const g = new ExtrudeGeometry(roundedShape(w, d, r), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  const m = new Mesh(g, mat); m.castShadow = m.receiveShadow = true;
  return m;
}

/** Punkt am Rand eines Rechtecks: t läuft einmal herum, 0 = vorn Mitte, im Uhrzeigersinn (von oben gesehen) */
function onRect(t: number, w: number, d: number): [number, number] {
  const per = 2 * (w + d);
  let s = (((t % 1) + 1) % 1) * per;
  // vorn Mitte → nach links …
  const legs: [number, number, number, number, number][] = [
    [w / 2, 0, d / 2, -1, 0], [d, -w / 2, d / 2, 0, -1], [w, -w / 2, -d / 2, 1, 0], [d, w / 2, -d / 2, 0, 1], [w / 2, w / 2, d / 2, -1, 0],
  ];
  for (const [len, x, z, dx, dz] of legs) {
    if (s <= len) return [x + dx * s, z + dz * s];
    s -= len;
  }
  return [0, d / 2];
}

/** Plätze gleichmäßig um den Tisch verteilt – der erste vorn in der Mitte */
function seatAnchors(n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => onRect(i / Math.max(n, 1), FELT_W - 0.5, FELT_D - 0.35));
}

const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };

export function createTableScene(canvas: HTMLCanvasElement): TableScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  // Volle Pixeldichte bis 2-fach – auf 4K-Fernsehern und Retina-Bildschirmen scharf
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const aniso = renderer.capabilities.getMaxAnisotropy();
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();

  const wood = new MeshStandardMaterial({ map: woodTexture(), roughness: 0.45, color: "#c79a72" });
  const felt = new MeshStandardMaterial({ map: feltTexture(), roughness: 0.95 });
  const top = slab(TOP_W, TOP_D, 0.25, 0.16, 0.04, wood); top.position.y = -0.16; scene.add(top);
  const cloth = slab(FELT_W, FELT_D, 0.1, 0.02, 0.004, felt); cloth.position.y = 0.036; scene.add(cloth);
  for (const [x, z] of [[-2.3, -1.4], [2.3, -1.4], [-2.3, 1.4], [2.3, 1.4]]) {
    const leg = new Mesh(new CylinderGeometry(0.09, 0.07, 1.6, 20), wood); leg.position.set(x, -1, z); leg.castShadow = true; scene.add(leg);
  }
  const floor = new Mesh(new PlaneGeometry(30, 30), new MeshStandardMaterial({ color: "#2a1a0e", roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.8; floor.receiveShadow = true; scene.add(floor);

  scene.add(new HemisphereLight("#ffe9c9", "#3a2414", 0.7));
  const lamp = new SpotLight("#ffd9a0", 42, 16, 0.8, 0.6, 1.6);
  lamp.position.set(-0.4, 6, 0.6); lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -0.0004;
  scene.add(lamp, lamp.target);
  const fill = new DirectionalLight("#9fc7ff", 0.25); fill.position.set(4, 3, 5); scene.add(fill);

  const camera = new PerspectiveCamera(36, 1.27, 0.1, 60);
  let width = 1, height = 1;

  // ---------- Karten ----------
  const edge = new MeshStandardMaterial({ color: "#f3ede2", roughness: 0.6 });
  const textures = new Map<string, Texture>();
  let deck: TableDeck = "cards";
  const backTex = (d: TableDeck) => {
    const key = `back:${d}`;
    let t = textures.get(key);
    if (!t) { t = new CanvasTexture(drawBack(d)); t.colorSpace = SRGBColorSpace; t.anisotropy = aniso; t.generateMipmaps = true; textures.set(key, t); }
    return t;
  };
  const faceMat = (d: TableDeck, card: string) => {
    const mat = new MeshStandardMaterial({ roughness: 0.5, transparent: true, alphaTest: 0.5, map: backTex(d) });
    void drawFace(d, card).then((c) => {
      const key = `${d}:${card}`;
      let t = textures.get(key);
      if (!t) { t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = aniso; t.generateMipmaps = true; textures.set(key, t); }
      mat.map = t; mat.needsUpdate = true; render();
    });
    return mat;
  };
  const cardGeo = (d: TableDeck) => new BoxGeometry(CARD_W, 0.006, CARD_W * CARD_RATIO[d]);
  function cardMesh(d: TableDeck, face: string | null) {
    const back = new MeshStandardMaterial({ map: backTex(d), roughness: 0.5, transparent: true, alphaTest: 0.5 });
    const front = face ? faceMat(d, face) : back;
    const m = new Mesh(cardGeo(d), [edge, edge, front, back, edge, edge]);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  const live = new Group(); scene.add(live);
  const glow = new Mesh(new CircleGeometry(0.55, 48), new MeshBasicMaterial({ color: "#ffd2a0", transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.visible = false; scene.add(glow);

  let anchors: [number, number][] = [];
  let last: { top: string | null; n: number; turn: string | null; seats: string[] } = { top: null, n: -1, turn: null, seats: [] };
  let flying: { mesh: Mesh; from: Vector3; to: Vector3; rot: number; start: number } | null = null;

  const PILE_X = -0.75, DISCARD_X = 0.5;
  const discardPos = (i: number, card: string) => {
    const h = hash(card + i);
    return { pos: new Vector3(DISCARD_X + ((h % 7) - 3) * 0.012, SURFACE + 0.004 + i * 0.007, ((h >> 3) % 7 - 3) * 0.012), rot: ((h >> 6) % 41 - 20) / 100 };
  };

  function update(model: TableModel | null, seats: string[]) {
    live.clear();
    anchors = seatAnchors(seats.length);
    glow.visible = false;
    if (!model) { last = { top: null, n: -1, turn: null, seats }; render(); return; }
    deck = model.deck;

    // Stapel: ein Block, so hoch wie die Karten
    if (model.pile > 0) {
      const h = Math.max(0.006, Math.min(model.pile, 40) * 0.0035);
      const pile = new Mesh(new BoxGeometry(CARD_W, h, CARD_W * CARD_RATIO[deck]), [edge, edge, new MeshStandardMaterial({ map: backTex(deck), roughness: 0.5 }), edge, edge, edge]);
      pile.position.set(PILE_X, SURFACE + h / 2, 0); pile.rotation.y = 0.04; pile.castShadow = pile.receiveShadow = true; live.add(pile);
    }

    // Ablage: die obersten Karten leicht verdreht übereinander
    const topCard = model.discard.at(-1) ?? null;
    let newest: Mesh | null = null;
    model.discard.forEach((card, i) => {
      const m = cardMesh(deck, card);
      const { pos, rot } = discardPos(i, card);
      m.position.copy(pos); m.rotation.y = rot; live.add(m);
      if (i === model.discard.length - 1) newest = m;
    });

    // Verdeckte Hände vor den Plätzen, zur Mitte gedreht
    seats.forEach((id, i) => {
      const count = model.counts[id] ?? 0;
      const [x, z] = anchors[i];
      const ang = Math.atan2(x, z);
      const shown = Math.min(count, 10);
      for (let k = 0; k < shown; k++) {
        const off = (k - (shown - 1) / 2);
        const m = cardMesh(deck, null);
        m.position.set(x * 0.92 + Math.cos(ang) * off * 0.09, SURFACE + 0.004 + k * 0.0065, z * 0.92 - Math.sin(ang) * off * 0.09);
        m.rotation.y = ang + off * 0.05;
        live.add(m);
      }
      if (id === model.turn) { glow.position.set(x * 0.92, SURFACE + 0.002, z * 0.92); glow.visible = true; }
    });

    // Neue Karte auf der Ablage: fliegt vom Platz dessen, der eben dran war
    const from = last.turn ? seats.indexOf(last.turn) : -1;
    if (newest && topCard && topCard !== last.top && model.n > last.n && last.n >= 0 && from >= 0) {
      const [fx, fz] = anchors[from];
      const mesh: Mesh = newest;
      flying = { mesh, from: new Vector3(fx * 0.92, SURFACE + 0.3, fz * 0.92), to: mesh.position.clone(), rot: mesh.rotation.y, start: performance.now() };
    }
    last = { top: topCard, n: model.n, turn: model.turn, seats };
    render();
  }

  // ---------- Zeichnen ----------
  let raf = 0;
  function frame() {
    raf = 0;
    if (flying) {
      const t = Math.min(1, (performance.now() - flying.start) / 520);
      const e = 1 - (1 - t) ** 3;
      flying.mesh.position.lerpVectors(flying.from, flying.to, e);
      flying.mesh.position.y += Math.sin(Math.PI * t) * 0.35;
      flying.mesh.rotation.y = flying.rot + (1 - e) * 1.2;
      if (t >= 1) { flying.mesh.position.copy(flying.to); flying.mesh.rotation.y = flying.rot; flying = null; }
    }
    renderer.render(scene, camera);
    if (flying) raf = requestAnimationFrame(frame);
  }
  function render() { if (!raf) raf = requestAnimationFrame(frame); }

  /**
   * Kamera so nah wie möglich: der Tisch samt Plätzen am Rand füllt die Fläche – auf breiten wie auf hohen Bildschirmen.
   * Schräg von vorn (wie am Tisch sitzend), Abstand per Halbierung gesucht.
   */
  function fitCamera() {
    const pitch = 0.92; // ~53° über dem Tisch
    const mx = TOP_W / 2 + 0.55, mz = TOP_D / 2 + 0.75;
    const corners = [[-mx, -mz], [mx, -mz], [-mx, mz], [mx, mz]].map(([x, z]) => new Vector3(x, 0.1, z));
    const target = new Vector3(0, 0, 0.15);
    const fits = (d: number) => {
      camera.position.set(0, Math.sin(pitch) * d, Math.cos(pitch) * d + target.z);
      camera.lookAt(target);
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      return corners.every((c) => { const v = c.clone().project(camera); return Math.abs(v.x) <= 0.97 && Math.abs(v.y) <= 0.95; });
    };
    let lo = 2, hi = 30;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    fits(hi);
  }

  function resize(w: number, h: number) {
    width = Math.max(1, w); height = Math.max(1, h);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    fitCamera();
    render();
  }

  function seatPoints() {
    return anchors.map(([x, z]) => {
      // vor der Tischkante, in Richtung des Platzes – so verdeckt das Schild keine Karten
      const s = Math.min((TOP_W / 2 + 0.45) / Math.max(Math.abs(x), 0.01), (TOP_D / 2 + 0.55) / Math.max(Math.abs(z), 0.01));
      const v = new Vector3(x * s, 0.1, z * s).project(camera);
      return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
    });
  }

  function feltRect(): FeltRect {
    // Von schräg vorn ist der Filz ein Trapez: hinten schmaler. Das Rechteck nimmt die hintere Breite.
    const p = (x: number, z: number) => { const v = new Vector3(x, SURFACE, z).project(camera); return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height }; };
    const inset = 0.12;
    const tl = p(-FELT_W / 2 + inset, -FELT_D / 2 + inset), tr = p(FELT_W / 2 - inset, -FELT_D / 2 + inset), bl = p(-FELT_W / 2 + inset, FELT_D / 2 - inset);
    return { x: tl.x, y: tl.y, w: tr.x - tl.x, h: bl.y - tl.y };
  }

  return {
    update, resize, seatPoints, feltRect,
    dispose() {
      cancelAnimationFrame(raf);
      for (const t of textures.values()) t.dispose();
      renderer.dispose();
    },
  };
}

/** Kann dieses Gerät WebGL? Sonst zeigt der Tisch die Partie wie am Handy. */
export function webglOk(): boolean {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") ?? c.getContext("webgl")); } catch { return false; }
}
