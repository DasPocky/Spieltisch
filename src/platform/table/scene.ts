/**
 * Großer Tisch in 3D: eckiger Holztisch mit Filzeinlage unter warmem Licht, schräg von vorn gesehen.
 * Stapel und Ablage liegen in der Mitte, vor jedem Platz die verdeckte Hand. Gezeichnet wird nur, wenn sich etwas ändert
 * (oder eine Karte gerade fliegt) – so bleibt der Rechner kühl.
 */
import {
  ACESFilmicToneMapping, BoxGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, DirectionalLight, ExtrudeGeometry, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, RepeatWrapping, Scene, Shape, SpotLight,
  SRGBColorSpace, Vector3, Vector2, WebGLRenderer, AdditiveBlending, TorusGeometry, Path, LatheGeometry, SphereGeometry, type Material, type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CARD_RATIO, drawBack, drawBoard, drawCard, drawContact, drawFace, drawLabel, drawPips, drawSign, drawSlot } from "./textures";
import type { TableDeck, TableModel } from "./model";
import { frameMeter, reducedMotion, renderSettings, type Quality } from "@/lib/quality";

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

export function createTableScene(canvas: HTMLCanvasElement, quality: Quality = "hoch"): TableScene {
  const q = renderSettings(quality);
  const renderer = new WebGLRenderer({ canvas, antialias: q.antialias, alpha: true });
  // Stufe „hoch“: volle Pixeldichte bis 2-fach – auf 4K-Fernsehern und Retina-Bildschirmen scharf
  renderer.setPixelRatio(q.pixelRatio);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  renderer.shadowMap.enabled = q.shadows; renderer.shadowMap.type = PCFSoftShadowMap;
  const meter = frameMeter();
  const still = reducedMotion();
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

  const hemi = new HemisphereLight("#ffe9c9", "#3a2414", 0.7);
  scene.add(hemi);
  const lamp = new SpotLight("#ffd9a0", 42, 16, 0.8, 0.6, 1.6);
  lamp.position.set(-0.4, 6, 0.6); lamp.castShadow = q.shadows; lamp.shadow.mapSize.set(q.shadowSize, q.shadowSize); lamp.shadow.bias = -0.0004;
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
  let last: { top: string | null; n: number; turn: string | null; seats: string[]; played: string[]; shown: number } = { top: null, n: -1, turn: null, seats: [], played: [], shown: 0 };
  /** Laufende Bewegungen: Karte fliegt (von → nach, mit Bogen) und dreht sich dabei ggf. um */
  /** `arc`: Höhe des Bogens, `spin`: Drehung um die Hochachse beim Anflug, `tumble`: Würfel kullert (dreht sich um alle Achsen) */
  type Fly = { arc?: number; spin?: number; tumble?: boolean };
  type Anim = { mesh: Mesh; from: Vector3; to: Vector3; rot: number; flip: boolean; start: number; ms: number; arc: number; spin: number; tumble: boolean };
  let anims: Anim[] = [];
  const fly = (mesh: Mesh, from: Vector3, delay = 0, flip = false, ms = 520, o: Fly = {}) => {
    // Reduzierte Bewegung: Karten liegen sofort da
    if (still) return;
    anims.push({ mesh, from, to: mesh.position.clone(), rot: mesh.rotation.y, flip, start: performance.now() + delay, ms,
      arc: o.arc ?? (flip ? 0.25 : 0.35), spin: o.spin ?? (flip ? 0 : 1.2), tumble: !!o.tumble });
    mesh.position.copy(from);
    if (flip) mesh.rotation.z = Math.PI;
  };

  const PILE_X = -0.75, DISCARD_X = 0.5;
  const discardPos = (i: number, card: string) => {
    const h = hash(card + i);
    return { pos: new Vector3(DISCARD_X + ((h % 7) - 3) * 0.012, SURFACE + 0.004 + i * 0.007, ((h >> 3) % 7 - 3) * 0.012), rot: ((h >> 6) % 41 - 20) / 100 };
  };

  function update(model: TableModel | null, seats: string[]) {
    live.clear();
    anims = [];
    anchors = seatAnchors(seats.length);
    glow.visible = false;
    if (!model) { lamp.intensity = 42; hemi.intensity = 0.7; fill.intensity = 0.25; last = { top: null, n: -1, turn: null, seats, played: [], shown: 0 }; render(); return; }
    deck = model.deck;
    // Nacht: Lampe gedimmt, kühles Licht von der Seite
    const night = !!model.night;
    lamp.intensity = night ? 14 : 42; hemi.intensity = night ? 0.25 : 0.7; fill.intensity = night ? 0.7 : 0.25;
    if (model.words) { updateWords(model, seats); return; }
    if (model.words5) { wordGrid(model.words5); return; }
    if (model.dice) { diceRow(model, seats); return; }
    if (model.grid) { board(model.grid, model.n); return; }
    if (model.tabletop) { tabletop(model, seats); return; }

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

    // Verdeckte Hände vor den Plätzen, zur Mitte gedreht – mit Auslage kleiner, damit davor Platz bleibt
    seats.forEach((id, i) => {
      hand(i, model.counts[id] ?? 0, deck, model.boards ? HAND_SMALL : 1);
      const [x, z] = anchors[i];
      if (id === model.turn) { glow.position.set(x * 0.92, SURFACE + 0.002, z * 0.92); glow.scale.setScalar(1); glow.visible = true; }
    });

    // Neue Karte auf der Ablage: fliegt vom Platz dessen, der eben dran war
    const from = last.turn ? seats.indexOf(last.turn) : -1;
    if (newest && topCard && topCard !== last.top && model.n > last.n && last.n >= 0 && from >= 0) {
      const [fx, fz] = anchors[from];
      fly(newest, new Vector3(fx * 0.92, SURFACE + 0.3, fz * 0.92));
    }
    if (model.sign) sign(model.sign);
    if (model.piles || model.boards) laid(model, seats, model.sign ? 0.3 : -0.06);
    last = { top: topCard, n: model.n, turn: model.turn, seats, played: [], shown: 0 };
    render();
  }

  /** Verdeckte Hand vor einem Platz */
  function hand(i: number, count: number, d: TableDeck, scale = 1) {
    const [x, z] = anchors[i];
    const ang = Math.atan2(x, z);
    const shown = Math.min(count, 10);
    for (let k = 0; k < shown; k++) {
      const off = k - (shown - 1) / 2;
      const m = cardMesh(d, null);
      m.scale.setScalar(scale);
      m.position.set(x * 0.92 + Math.cos(ang) * off * 0.09 * scale, SURFACE + 0.004 + k * 0.0065, z * 0.92 - Math.sin(ang) * off * 0.09 * scale);
      m.rotation.y = ang + off * 0.05;
      live.add(m);
    }
  }

  /**
   * Lückensatz-Spiel: schwarze Karte groß links, verdeckte Antworten fliegen von den Plätzen herein,
   * beim Aufdecken drehen sie sich der Reihe nach um; die gewählte Antwort hebt sich mit Lichtschein ab.
   */
  function updateWords(model: TableModel, seats: string[]) {
    const w = model.words!;
    const d: TableDeck = "schamlos";
    const black = cardMesh(d, w.prompt);
    black.scale.setScalar(1.9);
    black.position.set(-1.3, SURFACE + 0.006, 0.15); black.rotation.y = 0.05;
    live.add(black);
    seats.forEach((id, i) => hand(i, model.counts[id] ?? 0, d, 0.8));
    const czar = seats.indexOf(model.turn ?? "");
    if (czar >= 0) { const [x, z] = anchors[czar]; glow.position.set(x * 0.92, SURFACE + 0.002, z * 0.92); glow.visible = true; }

    const W = CARD_W * 1.5;
    if (!w.subs.length) {
      // Verdeckt gelegt: locker übereinander rechts neben der schwarzen Karte
      w.playedBy.forEach((id, i) => {
        const m = cardMesh(d, null);
        m.scale.setScalar(1.4);
        const h = hash(id);
        m.position.set(0.0 + (i % 4) * 0.5, SURFACE + 0.004 + i * 0.007, -0.15 + Math.floor(i / 4) * 0.5 + ((h % 5) - 2) * 0.02);
        m.rotation.y = ((h % 21) - 10) / 60;
        live.add(m);
        if (!last.played.includes(id) && last.n === model.n) {
          const from = seats.indexOf(id);
          if (from >= 0) { const [fx, fz] = anchors[from]; fly(m, new Vector3(fx * 0.92, SURFACE + 0.3, fz * 0.92)); }
        }
      });
      last = { top: null, n: model.n, turn: model.turn, seats, played: [...w.playedBy], shown: 0 };
      render();
      return;
    }

    // Aufgedeckt: Antworten in Reihen rechts, mehrteilige leicht überlappend
    const n = w.subs.length;
    const cols = n <= 4 ? n : Math.ceil(n / 2);
    const rows = Math.ceil(n / cols);
    const multi = w.subs.some((s) => s.length > 1);
    const step = (multi ? W * 1.55 : W) + 0.08;
    const scale = Math.min(1.5, 2.6 / (cols * step / 1.5));
    w.subs.forEach((cards, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x0 = -0.15 + col * step * scale / 1.5;
      const z0 = (row - (rows - 1) / 2) * (CARD_W * CARD_RATIO[d] * scale + 0.08);
      const win = w.pick === i;
      cards.forEach((c, k) => {
        const m = cardMesh(d, c);
        m.scale.setScalar(scale);
        m.position.set(x0 + k * W * 0.55 * scale / 1.5, SURFACE + 0.006 + k * 0.007 + (win ? 0.05 : 0), z0 + k * 0.06);
        m.rotation.y = ((hash(c) % 11) - 5) / 100;
        live.add(m);
        // Erstes Aufdecken dieser Runde: eine Karte nach der anderen umdrehen
        if (last.shown === 0) fly(m, m.position.clone().setY(SURFACE + 0.006), (i * cards.length + k) * 260, true, 420);
      });
      if (win) { glow.position.set(x0 + (cards.length - 1) * W * 0.28 * scale, SURFACE + 0.002, z0); glow.scale.setScalar(1.3); glow.visible = true; }
    });
    last = { top: null, n: model.n, turn: model.turn, seats, played: [...w.playedBy], shown: n };
    render();
  }


  // ---------- Zahlen- und Wortkarten: Stapel in der Mitte, Auslage am Platz, Wortraster ----------
  const contactTex = q.shadows ? null : new CanvasTexture(drawContact());
  const contactMat = contactTex && new MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: 0.7 });
  const contactGeo = new PlaneGeometry(1, 1);
  /** Ohne Schattenberechnung: ein weicher Fleck unter der Karte, damit sie aufliegt statt zu schweben */
  const contact = (x: number, z: number, w: number, d: number, rot: number) => {
    if (!contactMat) return;
    const m = new Mesh(contactGeo, contactMat);
    m.rotation.set(-Math.PI / 2, 0, rot); m.scale.set(w * 1.25, d * 1.18, 1); m.position.set(x, SURFACE + 0.0015, z);
    live.add(m);
  };
  const plainTex = (key: string, make: () => HTMLCanvasElement) => {
    let t = textures.get(key);
    if (!t) { t = new CanvasTexture(make()); t.colorSpace = SRGBColorSpace; t.anisotropy = aniso; textures.set(key, t); }
    return t;
  };
  const mats = new Map<string, MeshStandardMaterial>();
  /** Gemeinsames Material je Karte (Text + Farbe) – das Bild wird einmal gezeichnet */
  const cardMat = (kind: "num" | "word", text: string, tone: string | null) => {
    const key = `${kind}:${text}:${tone}`;
    let m = mats.get(key);
    if (m) return m;
    m = new MeshStandardMaterial({ roughness: 0.55, color: tone && kind === "word" ? tone : "#fbf7ef", transparent: true, alphaTest: 0.5 });
    mats.set(key, m);
    const mat = m;
    void drawCard(kind, text, tone).then((c) => {
      const t = plainTex(key, () => c);
      mat.map = t; mat.color.set("#ffffff"); mat.needsUpdate = true; render();
    });
    return m;
  };
  const numBack = () => {
    let m = mats.get("num:back");
    if (!m) mats.set("num:back", (m = new MeshStandardMaterial({ map: backTex("zahlen"), roughness: 0.5, transparent: true, alphaTest: 0.5 })));
    return m;
  };
  const numGeo = new BoxGeometry(1, 0.006, CARD_RATIO.zahlen);
  /** Zahlenkarte der Breite `w`; `cell` null = verdeckt */
  function numCard(cell: { text: string; tone?: string } | null, w: number, x: number, y: number, z: number, rot: number) {
    const front = cell ? cardMat("num", cell.text, cell.tone ?? null) : numBack();
    const m = new Mesh(numGeo, [edge, edge, front, numBack(), edge, edge]);
    m.scale.set(w, 1, w); m.position.set(x, y, z); m.rotation.y = rot; m.castShadow = m.receiveShadow = true;
    live.add(m);
    if (y < SURFACE + 0.02) contact(x, z, w, w * CARD_RATIO.zahlen, rot);
    return m;
  }
  /** Aufschrift auf dem Filz: Schrifthöhe `h`, höchstens `maxW` breit */
  function label(text: string, x: number, z: number, maxW: number, h = 0.085) {
    const t = plainTex(`label:${text}`, () => drawLabel(text));
    const img = t.image as HTMLCanvasElement;
    const w = Math.min(maxW, (h * 1.5 * img.width) / img.height);
    const m = new Mesh(new PlaneGeometry(w, (w * img.height) / img.width), new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, SURFACE + 0.002, z);
    live.add(m);
  }

  /** zuletzt gezeigte Karten (Stapel, Auslage, Wörter) – Neues fliegt herein oder dreht sich um */
  let seen = new Map<string, string>();
  const turnSeat = (seats: string[]) => { const i = last.turn ? seats.indexOf(last.turn) : -1; return i >= 0 ? anchors[i] : null; };
  const fresh = () => last.n >= 0;

  const NUM_W = 0.42, HAND_SMALL = 0.6, MARGIN = 0.05;
  const SEAT_X = (FELT_W - 0.5) / 2, SEAT_Z = (FELT_D - 0.35) / 2;

  /** Stapel in der Mitte und Auslagen vor den Plätzen */
  function laid(model: TableModel, seats: string[], pz = -0.06) {
    const prev = seen;
    seen = new Map();
    const from = turnSeat(seats);
    const flyIn = (m: Mesh, key: string, sig: string) => {
      const was = prev.get(key);
      seen.set(key, sig);
      if (!fresh() || was === sig) return;
      // Verdeckt → offen: umdrehen; sonst kommt die Karte vom Platz dessen, der eben dran war
      if (was === "?") fly(m, m.position.clone(), 0, true, 420);
      else if (from) fly(m, new Vector3(from[0] * 0.92, SURFACE + 0.3, from[1] * 0.92));
      else fly(m, m.position.clone().setY(SURFACE + 0.4));
    };

    // Mitte: Stapel nebeneinander, Aufschrift darunter
    const piles = model.piles ?? [];
    // Viele Stapel (z. B. ein Stich mit sechs Karten): schmaler, damit alle auf den Filz passen
    const pw = Math.min(NUM_W, (FELT_W - 0.4) / Math.max(1, piles.length) - 0.16);
    const step = pw + 0.16, pd = pw * CARD_RATIO.zahlen;
    const x0 = -((piles.length - 1) / 2) * step;
    piles.forEach((p, i) => {
      const x = x0 + i * step;
      const h = hash(p.label);
      if (p.top === "?") {
        numCard(null, pw, x, SURFACE + 0.004, pz, ((h % 9) - 4) / 90);
      } else if (p.top !== null) {
        // ein paar Karten darunter, leicht verschoben – wie ein echter Stapel
        if (!p.single) for (let k = 0; k < 3; k++) numCard({ text: p.top, tone: p.tone }, pw, x + ((h >> k) % 5 - 2) * 0.006, SURFACE + 0.003 + k * 0.006, pz + ((h >> (k + 3)) % 5 - 2) * 0.006, ((h >> (k + 6)) % 9 - 4) / 90);
        const top = numCard({ text: p.top, tone: p.tone }, pw, x, SURFACE + 0.003 + 3 * 0.006, pz, ((h % 7) - 3) / 120);
        flyIn(top, `pile:${i}`, `${p.top}:${p.tone}`);
      } else if (p.count !== undefined && p.count > 0) {
        const hgt = Math.max(0.006, Math.min(p.count, 60) * 0.0014);
        const block = new Mesh(new BoxGeometry(pw, hgt, pd), [edge, edge, numBack(), edge, edge, edge]);
        block.position.set(x, SURFACE + hgt / 2, pz); block.rotation.y = 0.03; block.castShadow = block.receiveShadow = true;
        live.add(block); contact(x, pz, pw, pd, 0.03);
      } else {
        const slot = new Mesh(new PlaneGeometry(pw, pd), new MeshBasicMaterial({ map: plainTex("slot", drawSlot), transparent: true, depthWrite: false }));
        slot.rotation.x = -Math.PI / 2; slot.position.set(x, SURFACE + 0.002, pz); live.add(slot);
      }
      label(p.count !== undefined ? `${p.label} · ${p.count}` : p.label, x, pz + pd / 2 + 0.09, step * 0.95);
    });
    const hx = piles.length ? -x0 + pw / 2 : 0, hz = piles.length ? pd / 2 + 0.06 : 0;

    // Auslage je Platz: zwischen Hand und Mitte, Ausrichtung immer zum Bildschirm (lesbar für alle)
    const bw = 0.3, bd = bw * CARD_RATIO.zahlen, gap = 0.035;
    seats.forEach((id, i) => {
      const board = model.boards?.[id];
      if (!board) return;
      const [ax, az] = anchors[i];
      const onX = Math.abs(ax) / SEAT_X >= Math.abs(az) / SEAT_Z - 1e-6;
      const handCards = (model.counts[id] ?? 0) > 0;
      const hd = CARD_W * CARD_RATIO[deck] * HAND_SMALL;
      // äußere Grenze: Filzrand bzw. Innenkante der Hand
      const outer = onX ? (handCards ? Math.abs(ax) * 0.92 - hd / 2 : FELT_W / 2) - MARGIN : (handCards ? Math.abs(az) * 0.92 - hd / 2 : FELT_D / 2) - MARGIN;
      // hinten mehr Abstand: von schräg vorn ragen die Stapel in der Mitte dorthin
      // Stapel liegen ggf. versetzt (pz); hinten mehr Abstand – von schräg vorn ragen sie dorthin, ein Aufsteller erst recht
      let inner = (onX ? hx : az > 0 ? hz + pz : hz - pz + 0.1) + MARGIN;
      if (model.sign && !onX && az < 0) inner = Math.max(inner, 0.85);
      const rows = Math.ceil(board.cells.length / board.cols);
      const W = board.cols * bw + (board.cols - 1) * gap, D = rows * bd + (rows - 1) * gap;
      // Breite entlang der Kante: bis zum nächsten Platz auf derselben Seite
      const side = anchors.filter(([x, z], k) => k !== i && (Math.abs(x) / SEAT_X >= Math.abs(z) / SEAT_Z - 1e-6) === onX && Math.sign(onX ? x : z) === Math.sign(onX ? ax : az));
      const along = onX ? FELT_D - 2 * MARGIN : FELT_W - 2 * MARGIN;
      const room = Math.min(along, ...side.map(([x, z]) => Math.abs(onX ? z - az : x - ax) - 0.08));
      const sc = Math.max(0.3, Math.min(1, (outer - inner) / (onX ? W : D), room / (onX ? D : W)));
      const w = W * sc, d = D * sc;
      const cx = onX ? Math.sign(ax) * (outer - w / 2) : Math.max(-FELT_W / 2 + MARGIN + w / 2, Math.min(FELT_W / 2 - MARGIN - w / 2, ax));
      const cz = onX ? Math.max(-FELT_D / 2 + MARGIN + d / 2, Math.min(FELT_D / 2 - MARGIN - d / 2, az)) : Math.sign(az) * (outer - d / 2);
      board.cells.forEach((cell, k) => {
        if (cell === null) return;
        const c = k % board.cols, r = Math.floor(k / board.cols);
        const h = hash(`${id}:${k}`);
        const m = numCard(cell === "?" ? null : cell, bw * sc, cx - w / 2 + (c * (bw + gap) + bw / 2) * sc, SURFACE + 0.004, cz - d / 2 + (r * (bd + gap) + bd / 2) * sc, ((h % 9) - 4) / 110);
        flyIn(m, `cell:${id}:${k}`, cell === "?" ? "?" : `${cell.text}:${cell.tone}`);
      });
    });
  }

  /** Wortraster (Decknamen): 25 Kartons, aufgedeckte bekommen ein Plättchen in der Teamfarbe obendrauf */
  function wordGrid(words: NonNullable<TableModel["words5"]>) {
    const prev = seen;
    seen = new Map();
    const rows = Math.ceil(words.cells.length / words.cols);
    const cw = 0.66, cd = cw * 0.625, gap = 0.07;
    const W = words.cols * cw + (words.cols - 1) * gap, D = rows * cd + (rows - 1) * gap;
    const sc = Math.min(1, (FELT_W - 0.3) / W, (FELT_D - 0.2) / D);
    const geo = new BoxGeometry(1, 0.008, 0.625);
    words.cells.forEach((cell, k) => {
      const c = k % words.cols, r = Math.floor(k / words.cols);
      const x = (-W / 2 + c * (cw + gap) + cw / 2) * sc, z = (-D / 2 + r * (cd + gap) + cd / 2) * sc;
      const h = hash(cell.text);
      const rot = ((h % 9) - 4) / 220;
      const card = new Mesh(geo, [edge, edge, cardMat("word", cell.text, null), edge, edge, edge]);
      card.scale.set(cw * sc, 1, cw * sc); card.position.set(x, SURFACE + 0.004, z); card.rotation.y = rot; card.castShadow = card.receiveShadow = true;
      live.add(card); contact(x, z, cw * sc, cd * sc, rot);
      if (!cell.tone) return;
      const tile = new Mesh(geo, [edge, edge, cardMat("word", cell.text, cell.tone), edge, edge, edge]);
      const trot = rot + ((h >> 4) % 9 - 4) / 70;
      tile.scale.set(cw * sc * 0.94, 1.6, cw * sc * 0.94); tile.position.set(x + ((h >> 8) % 5 - 2) * 0.008, SURFACE + 0.016, z); tile.rotation.y = trot;
      tile.castShadow = true; live.add(tile);
      const key = `word:${k}`;
      seen.set(key, cell.tone);
      // Gerade aufgedeckt: das Plättchen fällt von oben auf die Karte
      if (fresh() && prev.get(key) !== cell.tone) fly(tile, tile.position.clone().setY(SURFACE + 0.45), 0, false, 480);
    });
    last = { top: null, n: 0, turn: null, seats: last.seats, played: [], shown: 0 };
    render();
  }


  // ---------- Würfel und Spielbrett ----------
  const DIE = 0.3;
  const dieGeo = new RoundedBoxGeometry(DIE, DIE, DIE, 4, DIE * 0.16);
  const pipMats = new Map<number, MeshStandardMaterial>();
  const pip = (v: number) => {
    let m = pipMats.get(v);
    if (!m) pipMats.set(v, (m = new MeshStandardMaterial({ map: plainTex(`pips:${v}`, () => drawPips(v)), roughness: 0.35 })));
    return m;
  };
  // Seiten eines Würfels: oben die Augenzahl, gegenüber 7 minus diese – wie bei echten Würfeln
  const SIDES: Record<number, [number, number, number, number]> = { 1: [2, 5, 3, 4], 2: [1, 6, 3, 4], 3: [1, 6, 2, 5], 4: [1, 6, 2, 5], 5: [1, 6, 3, 4], 6: [2, 5, 3, 4] };
  function dieMesh(v: number) {
    const [a, b, c, d] = SIDES[v] ?? SIDES[1];
    const m = new Mesh(dieGeo, [pip(a), pip(b), pip(v), pip(7 - v), pip(c), pip(d)]);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /**
   * Würfel in der Mitte: gehaltene liegen vorn mit Lichtschein, neue Würfe kullern vom Platz dessen herein, der dran ist.
   * Mit Karten (Alles oder nichts) liegen Stapel und aufgedeckte Karte dahinter; mit Becher (Mäxchen) sind die Würfel verdeckt.
   */
  function diceRow(model: TableModel, seats: string[]) {
    const dice = model.dice!;
    const turn = seats.indexOf(model.turn ?? "");
    if (turn >= 0) { const [x, z] = anchors[turn]; glow.position.set(x * 0.92, SURFACE + 0.002, z * 0.92); glow.scale.setScalar(1); glow.visible = true; }
    const prev = seen;
    // Stapel legt `laid` (merkt sich ihre Karten selbst), die Würfel kommen dazu
    if (model.piles) laid({ ...model, boards: undefined }, seats, -0.72);
    else seen = new Map();
    const back = model.piles ? 0.26 : -0.12, front = model.piles ? 0.66 : 0.42;
    const n = dice.values.length || 5, step = DIE + (n > 5 ? 0.12 : 0.2);
    const from = turn >= 0 ? anchors[turn] : null;
    if (dice.cup) cup(prev.get("cup") !== String(dice.n) && fresh());
    seen.set("cup", String(dice.n));
    if (!dice.cup) dice.values.forEach((v, i) => {
      const x = (i - (n - 1) / 2) * step, held = !!dice.held[i];
      const h = hash(`${dice.n}:${i}`);
      const z = held ? front : back + ((h % 7) - 3) * 0.02;
      const m = dieMesh(v);
      m.position.set(x, SURFACE + DIE / 2, z); m.rotation.y = ((h >> 3) % 21 - 10) / 60;
      live.add(m); contact(x, z, DIE * 1.1, DIE * 1.1, m.rotation.y);
      if (held) {
        const ring = new Mesh(glow.geometry, glow.material); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(0.42); ring.position.set(x, SURFACE + 0.002, z); live.add(ring);
      }
      const key = `die:${i}`, sig = `${dice.n}:${v}:${held}`;
      seen.set(key, sig);
      if (!fresh() || prev.get(key) === sig || held || dice.still) return;
      // Neu gewürfelt: kullert herein
      const start = from ? new Vector3(from[0] * 0.7, SURFACE + 0.5, from[1] * 0.7) : new Vector3(x, SURFACE + 0.9, z - 0.6);
      fly(m, start, i * 70, false, 700, { arc: 0.3, spin: 2.5, tumble: true });
    });
    if (dice.note) label(dice.note, 0, model.piles ? 1.02 : 0.6, 3.4, 0.16);
    last = { top: null, n: model.n, turn: model.turn, seats, played: [], shown: 0 };
    render();
  }

  /** Würfelbecher (Leder, Öffnung nach unten); `shake`: wird gerade auf den Tisch geknallt */
  function cup(shake: boolean) {
    const leather = new MeshStandardMaterial({ color: "#5a2a1c", roughness: 0.75 });
    const rim = new MeshStandardMaterial({ color: "#c9a25e", roughness: 0.4, metalness: 0.3 });
    const body = new Mesh(new CylinderGeometry(0.3, 0.38, 0.55, 40), leather);
    body.position.set(0, SURFACE + 0.275, -0.05); body.castShadow = body.receiveShadow = true;
    const band = new Mesh(new CylinderGeometry(0.385, 0.385, 0.05, 40), rim);
    band.position.set(0, -0.24, 0); body.add(band);
    live.add(body); contact(0, -0.05, 0.85, 0.85, 0);
    if (shake) fly(body, body.position.clone().setY(SURFACE + 0.6), 0, false, 420, { arc: 0.15, spin: 0.8 });
  }

  const BOARD_TILT = 0.92;
  /**
   * Spielbrett (Vier in einer Reihe): steht schräg zurückgelehnt auf dem Tisch, zum Bildschirm gewandt – Steine stecken in den Löchern,
   * der neue fällt von oben in seine Spalte; die Gewinnreihe bekommt weiße Ringe.
   */
  function board(grid: NonNullable<TableModel["grid"]>, n: number) {
    const rows = grid.cells.length, cols = grid.cells[0]?.length ?? 0;
    const cell = Math.min(0.25, 2.0 / cols, 1.5 / rows), r = cell * 0.39;
    const W = cols * cell + cell * 0.4, H = rows * cell + cell * 0.4;
    const shape = roundedShape(W, H, cell * 0.25);
    for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
      const hole = new Path(); hole.absarc(-W / 2 + cell * 0.2 + (c + 0.5) * cell, -H / 2 + cell * 0.2 + (k + 0.5) * cell, r, 0, Math.PI * 2, true); shape.holes.push(hole);
    }
    const geo = new ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 18 });
    geo.translate(0, 0, -0.035);
    const frame = new Group();
    // Unterkante vorn auf dem Filz, oben nach hinten gelehnt (senkrecht zur Blickrichtung)
    frame.rotation.x = -(Math.PI / 2 - BOARD_TILT);
    frame.position.set(0, SURFACE + (H / 2) * Math.sin(BOARD_TILT) + 0.04, 0.9 - (H / 2) * Math.cos(BOARD_TILT));
    const blue = new MeshStandardMaterial({ color: "#2456a6", roughness: 0.4 });
    const plate = new Mesh(geo, blue); plate.castShadow = plate.receiveShadow = true; frame.add(plate);
    // Füße
    for (const sx of [-1, 1]) {
      const foot = new Mesh(new BoxGeometry(0.1, 0.06, 0.5), blue);
      foot.position.set(sx * (W / 2 - 0.05), -H / 2 - 0.02, 0.05); foot.rotation.x = Math.PI / 2 - BOARD_TILT; frame.add(foot);
    }
    const coinGeo = new CylinderGeometry(r * 0.96, r * 0.96, 0.05, 32);
    const coinMats = grid.colors.map((c) => new MeshStandardMaterial({ color: c, roughness: 0.35 }));
    const ringGeo = new TorusGeometry(r * 1.05, 0.012, 8, 40);
    const white = new MeshBasicMaterial({ color: "#ffffff" });
    grid.cells.forEach((row, rr) => row.forEach((v, c) => {
      if (v === null) return;
      const x = -W / 2 + cell * 0.2 + (c + 0.5) * cell, y = H / 2 - cell * 0.2 - (rr + 0.5) * cell;
      const coin = new Mesh(coinGeo, coinMats[v]); coin.rotation.x = Math.PI / 2; coin.position.set(x, y, 0); coin.castShadow = true; frame.add(coin);
      if (grid.line?.some(([lc, lr]) => lc === c && lr === rr)) { const ring = new Mesh(ringGeo, white); ring.position.set(x, y, 0.045); frame.add(ring); }
      // Neuer Stein: fällt von oben durch seine Spalte
      if (fresh() && n !== last.n && grid.last && grid.last[0] === c && grid.last[1] === rr) fly(coin, new Vector3(x, H / 2 + cell, 0), 0, false, 380 + rr * 40, { arc: 0, spin: 0 });
    }));
    live.add(frame);
    last = { top: null, n, turn: null, seats: last.seats, played: [], shown: 0 };
    render();
  }


  // ---------- Brettspiele: Dame, Mühle, Ludo ----------
  const BOARD = 2.2;
  const stoneMats = new Map<string, MeshStandardMaterial>();
  const stoneMat = (c: string) => {
    let m = stoneMats.get(c);
    if (!m) stoneMats.set(c, (m = new MeshStandardMaterial({ color: c, roughness: 0.38 })));
    return m;
  };
  const gold = new MeshStandardMaterial({ color: "#e3b53c", roughness: 0.3, metalness: 0.5 });
  // Pöppel: Fuß, Körper, Kragen – Kopf als Kugel obendrauf
  const pawnGeo = new LatheGeometry([[0, 0], [0.075, 0], [0.078, 0.02], [0.055, 0.04], [0.035, 0.12], [0.05, 0.135], [0.03, 0.15], [0, 0.15]].map(([x, y]) => new Vector2(x, y)), 28);
  const headGeo = new SphereGeometry(0.045, 20, 14);

  /** Brett flach in der Mitte, Steine bzw. Figuren darauf; der letzte Zug gleitet, der Würfel liegt rechts daneben */
  function tabletop(model: TableModel, seats: string[]) {
    const t = model.tabletop!;
    const prev = seen;
    seen = new Map();
    const turn = seats.indexOf(model.turn ?? "");
    if (turn >= 0) { const [x, z] = anchors[turn]; glow.position.set(x * 0.92, SURFACE + 0.002, z * 0.92); glow.scale.setScalar(1); glow.visible = true; }
    const top = new MeshStandardMaterial({ map: plainTex(`board:${t.board}`, () => drawBoard(t.board)), roughness: 0.6 });
    const slab = new Mesh(new BoxGeometry(BOARD, 0.06, BOARD), [wood, wood, top, wood, wood, wood]);
    const by = SURFACE + 0.03;
    slab.position.set(0, by, 0); slab.castShadow = slab.receiveShadow = true; live.add(slab);
    contact(0, 0, BOARD, BOARD, 0);
    const y0 = by + 0.03, half = BOARD / 2;
    const n = t.board === "dame:10" ? 10 : 8;
    const r = t.board.startsWith("dame") ? (BOARD / n) * 0.4 : 0.1;
    const moved = fresh() && prev.get("move") !== String(model.n);
    seen.set("move", String(model.n));
    for (const p of t.pieces) {
      const x = p.x * half, z = p.y * half;
      let m: Mesh;
      if (p.kind === "pawn") {
        m = new Mesh(pawnGeo, stoneMat(p.color));
        const head = new Mesh(headGeo, stoneMat(p.color)); head.position.y = 0.17; head.castShadow = true; m.add(head);
        m.position.set(x, y0, z);
      } else {
        const h = 0.045;
        m = new Mesh(new CylinderGeometry(r, r * 0.97, h, 36), stoneMat(p.color));
        m.position.set(x, y0 + h / 2, z);
        if (p.kind === "king") {
          const second = new Mesh(m.geometry, stoneMat(p.color)); second.position.y = h; second.castShadow = true; m.add(second);
          const crown = new Mesh(new TorusGeometry(r * 0.55, 0.012, 8, 30), gold); crown.rotation.x = Math.PI / 2; crown.position.y = h * 1.52; m.add(crown);
        }
      }
      m.castShadow = m.receiveShadow = true;
      live.add(m);
      contact(x, z, r * 2.2, r * 2.2, 0);
      // Wandern: Figur mit Kennung von ihrer alten Stelle, sonst der letzte Zug
      if (p.id) {
        const key = `p:${p.id}`, sig = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
        const was = prev.get(key);
        seen.set(key, sig);
        if (fresh() && was && was !== sig) { const [wx, wy] = was.split(",").map(Number); fly(m, new Vector3(wx * half, m.position.y, wy * half), 0, false, 520, { arc: 0.18, spin: 0 }); }
      } else if (moved && t.move && Math.abs(t.move.to[0] - p.x) < 1e-6 && Math.abs(t.move.to[1] - p.y) < 1e-6) {
        fly(m, new Vector3(t.move.from[0] * half, m.position.y, t.move.from[1] * half), 0, false, 520, { arc: 0.15, spin: 0 });
      }
    }
    if (t.die) {
      const v = t.die.value ?? 1;
      const d = dieMesh(v);
      d.position.set(half + 0.45, SURFACE + DIE / 2, 0.35); d.rotation.y = 0.3;
      if (t.die.value === null) d.visible = false;
      live.add(d);
      if (t.die.value !== null) contact(half + 0.45, 0.35, DIE * 1.1, DIE * 1.1, 0.3);
      const key = `die:${t.die.n}`;
      if (t.die.value !== null && fresh() && !prev.has(key)) fly(d, new Vector3(half + 0.2, SURFACE + 0.5, -0.4), 0, false, 650, { arc: 0.3, spin: 2.5, tumble: true });
      seen.set(key, "1");
    }
    last = { top: null, n: model.n, turn: model.turn, seats, played: [], shown: 0 };
    render();
  }


  // ---------- Aufsteller (Partyspiele) ----------
  let signTex: Texture | null = null;
  let signKey = "";
  /** Karton steht schräg in der Mitte, zum Bildschirm gewandt – Phase groß, Hinweis darunter */
  function sign(sg: NonNullable<TableModel["sign"]>) {
    const key = `${sg.title}|${sg.sub ?? ""}`;
    if (key !== signKey || !signTex) {
      signTex?.dispose();
      signTex = new CanvasTexture(drawSign(sg.title, sg.sub)); signTex.colorSpace = SRGBColorSpace; signTex.anisotropy = aniso;
      signKey = key;
    }
    const W = 2.0, H = W * 0.39;
    const face = new MeshStandardMaterial({ map: signTex, roughness: 0.7 });
    const board = new Mesh(new BoxGeometry(W, H, 0.03), [edge, edge, edge, edge, face, edge]);
    const group = new Group();
    group.rotation.x = -(Math.PI / 2 - BOARD_TILT);
    group.position.set(0, SURFACE + (H / 2) * Math.sin(BOARD_TILT) + 0.01, -0.32);
    board.castShadow = true; group.add(board);
    // Stütze hinten
    const prop = new Mesh(new BoxGeometry(0.5, H * 0.9, 0.02), edge);
    prop.position.set(0, -H * 0.05, -0.2); prop.rotation.x = 0.5; group.add(prop);
    live.add(group);
    contact(0, -0.25, W, 0.5, 0);
  }

  // ---------- Zeichnen ----------
  let raf = 0;
  let lastFrame = 0;
  function frame() {
    raf = 0;
    const now = performance.now();
    // Bildrate nur während Bewegungen messen (sonst steht die Szene)
    if (lastFrame && anims.length) meter(now - lastFrame);
    lastFrame = anims.length ? now : 0;
    for (const a of anims) {
      const t = Math.max(0, Math.min(1, (now - a.start) / a.ms));
      const e = 1 - (1 - t) ** 3;
      a.mesh.position.lerpVectors(a.from, a.to, e);
      a.mesh.position.y += Math.sin(Math.PI * t) * a.arc;
      a.mesh.rotation.y = a.rot + (1 - e) * a.spin;
      if (a.flip) a.mesh.rotation.z = Math.PI * (1 - e);
      if (a.tumble) { a.mesh.rotation.x = (1 - e) * Math.PI * 4; a.mesh.rotation.z = (1 - e) * Math.PI * 2; }
    }
    anims = anims.filter((a) => now - a.start < a.ms);
    renderer.render(scene, camera);
    if (anims.length) raf = requestAnimationFrame(frame);
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

export { webglOk } from "@/lib/quality";
