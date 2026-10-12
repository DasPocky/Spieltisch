/**
 * Würfel in echtem 3D (WebGL): abgerundete Körper, weiches Licht mit Spiegelung, echte Schatten, Kantenglättung
 * in voller Bildschirmauflösung. Ein `DiceView` zeichnet eine Szene in ein Canvas – den Wurf über den ganzen
 * Bildschirm oder die ruhenden Würfel in der Ablage. Gezeichnet wird nur, wenn sich etwas ändert.
 */
import {
  NeutralToneMapping, CanvasTexture, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Quaternion, Raycaster, Scene, ShadowMaterial, SRGBColorSpace,
  Vector2, Vector3, WebGLRenderer, Plane, type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Quat = [number, number, number, number];
export type Vec = [number, number, number];
export interface DieDraw { pos: Vec; quat: Quat; scale?: number; mark?: "held" | "hint" | null }

/** Farben je Look: Würfelkörper, Augen, die Eins; `sharp` = kantigere Würfel */
interface DieLook { face: string; edge: string; pip: string; one: string; sharp?: boolean }
const LOOKS: Record<string, DieLook> = {
  base: { face: "#ebe6dc", edge: "#d2cbbd", pip: "#0b1229", one: "#9c1229" },
  casino: { face: "#d81e2b", edge: "#a3121c", pip: "#ffffff", one: "#ffffff" },
  nacht: { face: "#3a2d7c", edge: "#241a55", pip: "#33dbf2", one: "#ff58ba" },
  arcade: { face: "#1d1d4a", edge: "#121234", pip: "#ffe14d", one: "#ff3d7f", sharp: true },
  spielbox: { face: "#ffffff", edge: "#e2e2e2", pip: "#111111", one: "#ef3e36", sharp: true },
  comic: { face: "#ffe01a", edge: "#e2c100", pip: "#111111", one: "#e8322b", sharp: true },
  bonbon: { face: "#ffb6d8", edge: "#f08fbe", pip: "#ffffff", one: "#7b4dd8" },
  siebziger: { face: "#ea7a40", edge: "#c4562a", pip: "#f7ead0", one: "#f7ead0" },
  klar: { face: "#f7f7f9", edge: "#e2e2e8", pip: "#111114", one: "#ff5a3c" },
};
function currentLook(): DieLook {
  const el = document.documentElement;
  const look = el.dataset.look ?? "";
  if (look === "aurora" && el.dataset.theme === "dark") return LOOKS.nacht;
  return LOOKS[look] ?? LOOKS.base;
}

/** Augen je Zahl im 3×3-Raster (Zeile, Spalte) */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]], 2: [[0, 2], [2, 0]], 3: [[0, 2], [1, 1], [2, 0]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};
/** Seiten in der Reihenfolge der Box-Geometrie (+x, −x, +y, −y, +z, −z) – Belegung wie in der Physik (FACES) */
const BOX_VALUES = [2, 5, 3, 4, 1, 6];

const texCache = new Map<string, Texture>();
/** Seitenbild in hoher Auflösung: leicht gewölbte Fläche, Augen als echte Mulden */
function faceTexture(look: DieLook, value: number, maxAniso: number): Texture {
  const key = `${look.face}${look.pip}${look.one}${value}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 512, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const bg = g.createRadialGradient(S * 0.35, S * 0.3, S * 0.05, S * 0.5, S * 0.5, S * 0.75);
  bg.addColorStop(0, look.face);
  bg.addColorStop(1, look.edge);
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  const one = value === 1;
  const r = S * (one ? 0.115 : 0.085);
  for (const [row, col] of PIPS[value]) {
    const x = S * (0.25 + col * 0.25), y = S * (0.25 + row * 0.25);
    const color = one ? look.one : look.pip;
    // Mulde: dunkler Rand oben links, Licht unten rechts im Inneren
    g.beginPath(); g.arc(x, y, r * 1.06, 0, Math.PI * 2); g.fillStyle = "rgba(0,0,0,0.18)"; g.fill();
    const pg = g.createRadialGradient(x + r * 0.3, y + r * 0.35, r * 0.1, x, y, r);
    pg.addColorStop(0, shade(color, 0.14));
    pg.addColorStop(0.6, color);
    pg.addColorStop(1, shade(color, -0.45));
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = pg; g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = maxAniso;
  texCache.set(key, t);
  return t;
}
/** Farbe heller (+) oder dunkler (−) */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.min(255, Math.max(0, amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

let glowTex: Texture | null = null;
function glowTexture(): Texture {
  if (glowTex) return glowTex;
  const S = 256, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.45, "rgba(255,255,255,0.75)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  glowTex = new CanvasTexture(c);
  return glowTex;
}

/** Grundfarbe der App für den Halten-Schein */
const primary = () => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#ff7a59";

/** Läuft WebGL nur in Software (kein Grafikchip, z. B. in manchen Testumgebungen oder sehr alten Geräten)? */
function isSoftware(r: WebGLRenderer): boolean {
  try {
    // Für Vorschaubilder: volle Qualität erzwingen
    if (localStorage.getItem("spieltisch:diceHQ") === "1") return false;
    const gl = r.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software|softpipe/i.test(name);
  } catch { return false; }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export class DiceView {
  readonly renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(28, 1, 0.1, 400);
  private dice: { mesh: Mesh; glow: Mesh }[] = [];
  private look = currentLook();
  private geo: RoundedBoxGeometry;
  private size = { w: 1, h: 1 };
  private sun: DirectionalLight;

  constructor(canvas: HTMLCanvasElement, private tilt = 10, fov = 28, shadowSize = 2048, keep = false) {
    this.camera.fov = fov;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: keep });
    // Ohne Grafikchip (Software-Grafik) einfacher zeichnen – sonst stockt alles; mit Grafikchip volle Schärfe
    const soft = isSoftware(this.renderer);
    this.renderer.setPixelRatio(soft ? 1 : Math.min(3, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.shadowMap.enabled = !soft;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    // Weiche Spiegelung wie in einem hellen Raum – macht die Würfel plastisch
    if (!soft) {
      const pm = new PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
    }
    this.scene.add(new HemisphereLight(0xffffff, 0x4a4438, 0.22));
    this.sun = new DirectionalLight(0xfffaf2, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.radius = 6;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);
    // Boden nur für den Schatten – sonst durchsichtig
    const floor = new Mesh(new PlaneGeometry(400, 400), new ShadowMaterial({ opacity: 0.32 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.geo = new RoundedBoxGeometry(1, 1, 1, 5, this.look.sharp ? 0.08 : 0.14);
  }

  /** Canvas-Größe in CSS-Pixeln und Maßstab (Pixel je Würfelkante am Boden) */
  resize(w: number, h: number, ppu: number) {
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    const cam = this.camera;
    cam.aspect = w / h;
    // So weit weg, dass die Bodenfläche genau das Canvas füllt; leicht von vorn geneigt
    const halfH = h / ppu / 2;
    const dist = halfH / Math.tan((cam.fov * Math.PI) / 360);
    const t = (this.tilt * Math.PI) / 180;
    cam.position.set(0, dist * Math.cos(t), dist * Math.sin(t));
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    // Schattenkamera deckt den ganzen Boden ab
    const span = Math.max(w, h) / ppu;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.near = 0.5; sc.far = dist * 3 + 40;
    sc.updateProjectionMatrix();
    // Licht schräg von links hinten: Oberseite hell, die zugewandten Seiten im Halbschatten – so wirken die Würfel plastisch
    this.sun.position.set(-span * 0.5, dist * 0.9 + 6, -span * 0.45);
    this.sun.target.position.set(0, 0, 0);
  }

  /** Würfel setzen (Anzahl, Lage, Markierung) – Meshes werden wiederverwendet */
  setDice(list: DieDraw[]) {
    const look = currentLook();
    if (look !== this.look) { this.look = look; this.clear(); }
    while (this.dice.length > list.length) this.removeLast();
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    for (let i = this.dice.length; i < list.length; i++) {
      const mats = BOX_VALUES.map((v) => new MeshStandardMaterial({ map: faceTexture(this.look, v, aniso), roughness: 0.55, metalness: 0, envMapIntensity: 0.16 }));
      const mesh = new Mesh(this.geo, mats);
      mesh.castShadow = true;
      const glow = new Mesh(new PlaneGeometry(1.9, 1.9), new MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, opacity: 0 }));
      glow.rotation.x = -Math.PI / 2;
      this.scene.add(glow, mesh);
      this.dice.push({ mesh, glow });
    }
    const col = primary();
    list.forEach((d, i) => {
      const { mesh, glow } = this.dice[i];
      const s = d.scale ?? 1;
      mesh.position.set(...d.pos);
      mesh.quaternion.set(...d.quat);
      mesh.scale.setScalar(s);
      glow.position.set(d.pos[0], 0.005, d.pos[2]);
      glow.scale.setScalar(s);
      const gm = glow.material as MeshBasicMaterial;
      gm.color.set(col);
      gm.opacity = d.mark === "held" ? 0.85 : d.mark === "hint" ? 0.35 : 0;
      glow.visible = !!d.mark;
      for (const m of mesh.material as MeshStandardMaterial[]) { m.emissive.set(col); m.emissiveIntensity = d.mark === "held" ? 0.12 : 0; }
    });
  }

  render() { this.renderer.render(this.scene, this.camera); }

  /** Bildschirmpunkt (CSS-Pixel im Canvas) dieses Punkts der Szene */
  project(p: Vec): [number, number] {
    const v = new Vector3(...p).project(this.camera);
    return [((v.x + 1) / 2) * this.size.w, ((1 - v.y) / 2) * this.size.h];
  }

  /** Punkt der Szene in Höhe `y`, der auf diesem Bildschirmpunkt (CSS-Pixel im Canvas) liegt */
  pointAt(x: number, y: number, height: number): Vec {
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2((x / this.size.w) * 2 - 1, -(y / this.size.h) * 2 + 1), this.camera);
    const hit = new Vector3();
    ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -height), hit);
    return [hit.x, hit.y, hit.z];
  }

  private removeLast() {
    const d = this.dice.pop()!;
    this.scene.remove(d.mesh, d.glow);
    for (const m of d.mesh.material as MeshStandardMaterial[]) m.dispose();
    d.glow.geometry.dispose();
    (d.glow.material as MeshBasicMaterial).dispose();
  }
  private clear() { while (this.dice.length) this.removeLast(); this.geo.dispose(); this.geo = new RoundedBoxGeometry(1, 1, 1, 5, this.look.sharp ? 0.08 : 0.14); }

  dispose() {
    this.clear();
    this.geo.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** Lage und Umbeschriftung zu einer Drehung zusammensetzen: erst `r` (Beschriftung), dann `q` (Lage) */
export function compose(q: Quat, r: Quat): Quat {
  const a = new Quaternion(...q).multiply(new Quaternion(...r));
  return [a.x, a.y, a.z, a.w];
}

/**
 * Ein gemeinsamer Zeichner für alle Ablagen: zeichnet unsichtbar und kopiert das Bild in das Canvas der Ablage.
 * So braucht keine Ablage einen eigenen 3D-Kontext (die kosten Zeit beim Anlegen und sind auf Handys begrenzt).
 */
let painter: DiceView | null = null;
const trayPainter = () => (painter ??= new DiceView(document.createElement("canvas"), 9, 14, 1024, true));

/** Ruhende Würfel in ein 2D-Canvas zeichnen; liefert die Bildschirmpunkte (CSS-Pixel) der gewünschten Stellen */
export function paintTray(target: HTMLCanvasElement, w: number, h: number, ppu: number, dice: DieDraw[], points: Vec[]): [number, number][] {
  const v = trayPainter();
  v.resize(w, h, ppu);
  v.setDice(dice);
  v.render();
  const src = v.renderer.domElement;
  if (target.width !== src.width || target.height !== src.height) { target.width = src.width; target.height = src.height; }
  const ctx = target.getContext("2d");
  if (ctx) { ctx.clearRect(0, 0, target.width, target.height); ctx.drawImage(src, 0, 0); }
  return points.map((p) => v.project(p));
}

/** Vorab aufwärmen (Licht, Spiegelung, Shader), damit der erste Wurf nicht hakt */
export function warm(view: DiceView) {
  view.resize(64, 64, 32);
  view.setDice([{ pos: [0, 0.5, 0], quat: [0, 0, 0, 1], mark: "held" }]);
  view.render();
  view.setDice([]);
  view.render();
}
export const warmTray = () => warm(trayPainter());
