/**
 * Raum und Materialien für den 3D-Tisch – alles aus Code, ohne Bilddateien:
 *  - lackiertes Holz mit Maserung (Farbe, Rauheit, Relief) und Klarlack
 *  - Spielfilz mit Fasern und Schimmer (wie echter Filz im Streiflicht)
 *  - Dielenboden mit Teppich unter dem Tisch, der Raum verliert sich im Dunkeln
 *  - Umgebungslicht (weiches Zimmerlicht), damit Holz, Karten und Würfel echt spiegeln
 */
import {
  CanvasTexture, Color, Fog, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, PMREMGenerator, RepeatWrapping, SRGBColorSpace,
  type Scene, type Texture, type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return { c, g: c.getContext("2d")! };
}

function tex(c: HTMLCanvasElement, repeat: [number, number], color: boolean, aniso: number): Texture {
  const t = new CanvasTexture(c);
  if (color) t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = aniso;
  return t;
}

/** Glatter Wert-Rauschen auf einem Gitter (für Maserung und Flecken) */
function noise2(w: number, h: number, cell: number): Float32Array {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const grid = Float32Array.from({ length: gw * gh }, () => rnd());
  const out = new Float32Array(w * h);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = x / cell, gy = y / cell, ix = Math.floor(gx), iy = Math.floor(gy), fx = s(gx - ix), fy = s(gy - iy);
    const a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1], c = grid[(iy + 1) * gw + ix], d = grid[(iy + 1) * gw + ix + 1];
    out[y * w + x] = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  return out;
}

/**
 * Holz: feine, lange Fasern entlang der Platte (leicht gewellt, mal dunkler, mal heller), dazu sanfte Farbwolken;
 * das Relief entsteht aus denselben Fasern. Die Platte hat Maße in Metern als Bildkoordinaten – `repeat` passt das an.
 */
export function woodMaterial(aniso: number): MeshPhysicalMaterial {
  const W = 2048, H = 1024;
  const col = canvas(W, H), bump = canvas(W, H);
  const cloud = noise2(W / 8, H / 8, 24);
  const ci = col.g.createImageData(W / 8, H / 8);
  const base = new Color("#8d5a34");
  for (let i = 0; i < cloud.length; i++) {
    const c = base.clone().multiplyScalar(0.86 + cloud[i] * 0.26);
    ci.data[i * 4] = c.r * 255; ci.data[i * 4 + 1] = c.g * 255; ci.data[i * 4 + 2] = c.b * 255; ci.data[i * 4 + 3] = 255;
  }
  // Farbwolken klein zeichnen, dann weich hochskalieren
  const small = canvas(W / 8, H / 8); small.g.putImageData(ci, 0, 0);
  col.g.imageSmoothingEnabled = true; col.g.drawImage(small.c, 0, 0, W, H);
  bump.g.fillStyle = "#808080"; bump.g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {
    const y = rnd() * H, dark = rnd() < 0.62, a = 0.03 + rnd() * 0.09, lw = 0.6 + rnd() * 2.2;
    const amp = 2 + rnd() * 6, freq = 300 + rnd() * 500, ph = rnd() * 7;
    const path = (g: CanvasRenderingContext2D) => {
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= W; x += 24) g.lineTo(x, y + Math.sin(x / freq + ph) * amp);
    };
    col.g.strokeStyle = dark ? `rgba(55,28,12,${a})` : `rgba(205,150,100,${a * 0.8})`; col.g.lineWidth = lw; path(col.g); col.g.stroke();
    bump.g.strokeStyle = dark ? `rgba(0,0,0,${a * 2.2})` : `rgba(255,255,255,${a})`; bump.g.lineWidth = lw; path(bump.g); bump.g.stroke();
  }
  // Platte ±2,6 m: ein Bild deckt sie ganz, die Bildkante liegt außerhalb (sonst sieht man in der Mitte eine Naht)
  const map = tex(col.c, [0.18, 0.36], true, aniso), relief = tex(bump.c, [0.18, 0.36], false, aniso);
  map.offset.set(0.5, 0.5); relief.offset.set(0.5, 0.5);
  return new MeshPhysicalMaterial({
    map, bumpMap: relief, bumpScale: 0.25,
    roughness: 0.48, clearcoat: 0.45, clearcoatRoughness: 0.25,
  });
}

/** Spielfilz: feine Fasern (Relief), leichte Wolken in der Farbe, samtiger Schimmer im Streiflicht */
export function feltMaterial(aniso: number, color = "#24786c"): MeshPhysicalMaterial {
  const S = 512;
  const cloud = noise2(S, S, 96), fiber = noise2(S, S, 2);
  const col = canvas(S, S), bump = canvas(S, S);
  const ci = col.g.createImageData(S, S), bi = bump.g.createImageData(S, S);
  const base = new Color(color);
  for (let i = 0; i < S * S; i++) {
    const v = 0.9 + (cloud[i] - 0.5) * 0.16 + (fiber[i] - 0.5) * 0.1;
    ci.data[i * 4] = Math.min(255, base.r * 255 * v); ci.data[i * 4 + 1] = Math.min(255, base.g * 255 * v); ci.data[i * 4 + 2] = Math.min(255, base.b * 255 * v); ci.data[i * 4 + 3] = 255;
    const b = 128 + (fiber[i] - 0.5) * 120 + (rnd() - 0.5) * 50;
    bi.data[i * 4] = bi.data[i * 4 + 1] = bi.data[i * 4 + 2] = b; bi.data[i * 4 + 3] = 255;
  }
  col.g.putImageData(ci, 0, 0); bump.g.putImageData(bi, 0, 0);
  return new MeshPhysicalMaterial({
    map: tex(col.c, [3, 3], true, aniso), bumpMap: tex(bump.c, [7, 7], false, aniso), bumpScale: 0.35,
    roughness: 0.92, sheen: 1, sheenColor: base.clone().lerp(new Color("#bfe8dc"), 0.55), sheenRoughness: 0.6,
  });
}

/** Dielenboden: Bretter in leicht wechselnden Tönen mit Fugen */
function floorTexture(aniso: number): Texture {
  const { c, g } = canvas(1024, 1024);
  const rows = 8, h = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 400;
    while (x < 1024) {
      const len = 300 + rnd() * 400;
      const tone = 38 + rnd() * 18;
      g.fillStyle = `rgb(${tone + 22},${tone + 8},${tone - 6})`;
      g.fillRect(x, r * h, len, h);
      for (let k = 0; k < 18; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`; g.lineWidth = 1 + rnd() * 2;
        const yy = r * h + rnd() * h; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + len, yy + (rnd() - 0.5) * 6); g.stroke();
      }
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(x, r * h, 3, h);
      x += len;
    }
    g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, r * h, 1024, 3);
  }
  return tex(c, [6, 6], true, aniso);
}

/** Teppich unter dem Tisch: gedecktes Rot mit Bordüre und feinem Muster */
function rugTexture(aniso: number): Texture {
  const { c, g } = canvas(1024, 768);
  g.fillStyle = "#4a1d1a"; g.fillRect(0, 0, 1024, 768);
  // Wolliger Flor: feines Rauschen, kaum sichtbar
  const img = g.getImageData(0, 0, 1024, 768);
  for (let i = 0; i < img.data.length; i += 4) { const v = (rnd() - 0.5) * 14; img.data[i] += v; img.data[i + 1] += v * 0.7; img.data[i + 2] += v * 0.6; }
  g.putImageData(img, 0, 0);
  g.strokeStyle = "#9a7b48"; g.lineWidth = 12; g.strokeRect(40, 40, 944, 688);
  g.strokeStyle = "#252c3e"; g.lineWidth = 26; g.strokeRect(76, 76, 872, 616);
  g.strokeStyle = "rgba(154,123,72,.55)"; g.lineWidth = 4; g.strokeRect(106, 106, 812, 556);
  g.fillStyle = "rgba(154,123,72,.28)";
  for (let x = 140; x < 900; x += 60) for (const y of [140, 628]) { g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y); g.lineTo(x, y + 12); g.lineTo(x - 12, y); g.fill(); }
  const t = tex(c, [1, 1], true, aniso); t.wrapS = t.wrapT = 1001; // ClampToEdge
  return t;
}

/**
 * Raum um den Tisch: Umgebungslicht, Boden, Teppich, Nebel ins Dunkle. `floorY`: Höhe des Bodens.
 * Gibt die neuen Meshes zurück (zum Aufräumen bleibt alles an der Szene).
 */
export function furnishRoom(scene: Scene, renderer: WebGLRenderer, floorY: number, aniso: number) {
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.32;
  scene.fog = new Fog("#120b07", 9, 20);

  const floor = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ map: floorTexture(aniso), roughness: 0.62 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; floor.receiveShadow = true;
  const rug = new Mesh(new PlaneGeometry(7.6, 5.7), new MeshStandardMaterial({ map: rugTexture(aniso), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = floorY + 0.01; rug.receiveShadow = true;
  scene.add(floor, rug);
  return { env };
}
