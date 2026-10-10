import { HOME, PER_COLOR, trackLen } from "@shared/games/ludo/logic";

export type Pt = [number, number];

export interface Layout {
  /** halbe Kantenlänge des Bretts in Feldeinheiten (Mitte = 0,0) */
  half: number;
  /** Feldradius */
  r: number;
  track: Pt[];
  /** je Farbe: Zielfelder (erstes zuerst) */
  goal: Pt[][];
  /** je Farbe: Haus (B-Felder) */
  home: Pt[][];
}

const cache = new Map<number, Layout>();

/**
 * Das Brett als Stern mit `n` Armen. Bei 4 Armen ergibt das genau das klassische Kreuz auf einem 11×11-Raster:
 * Startfeld außen am Arm, vier Felder nach innen, um die Ecke, vier nach außen, über die Spitze.
 * Farbe 0 sitzt unten links, gezogen wird im Uhrzeigersinn. Mit `rot` sitzt stattdessen diese Farbe unten (eigene Farbe online).
 */
export function layout(n: 4 | 6, rot = 0): Layout {
  const key = n * 10 + rot;
  const hit = cache.get(key);
  if (hit) return hit;
  const corner = 1 / Math.tan(Math.PI / n); // innere Ecke zweier Arme
  const lane = Array.from({ length: 5 }, (_, i) => 5 - (i * (5 - corner)) / 4); // 5 … corner
  const base = n === 4 ? Math.PI / 2 : (2 * Math.PI) / 3; // Farbe 0: unten bzw. unten links
  const ang = (c: number) => base + ((c - rot) * 2 * Math.PI) / n;
  const at = (c: number, along: number, off: number): Pt => {
    const a = ang(c);
    const ux = Math.cos(a), uy = Math.sin(a);
    const vx = -uy, vy = ux; // 90° im Uhrzeigersinn
    return [round(along * ux + off * vx), round(along * uy + off * vy)];
  };
  const track: Pt[] = [];
  for (let c = 0; c < n; c++) {
    for (let i = 0; i < 5; i++) track.push(at(c, lane[i], 1));
    for (let i = 3; i >= 0; i--) track.push(at(c + 1, lane[i], -1));
    track.push(at(c + 1, 5, 0));
  }
  const goal = Array.from({ length: n }, (_, c) => [4, 3, 2, 1].map((a) => at(c, a, 0)));
  // Haus in der Ecke vor dem Startfeld: 2×2, an der Armrichtung ausgerichtet
  const home = Array.from({ length: n }, (_, c) => {
    const bis = ang(c) + Math.PI / n;
    const rr = n === 4 ? 4.5 * Math.SQRT2 : 4.45;
    const cx = rr * Math.cos(bis), cy = rr * Math.sin(bis);
    const a = n === 4 ? ang(c) : bis;
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    const d = n === 4 ? 0.5 : 0.47;
    return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([p, q]) => [round(cx + d * (p * ux + q * vx)), round(cy + d * (p * uy + q * vy))] as Pt);
  });
  const l: Layout = { half: 5.62, r: n === 4 ? 0.4 : 0.36, track, goal, home };
  cache.set(key, l);
  return l;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Wo steht eine Figur? */
export function pointOf(l: Layout, board: 4 | 6, color: number, p: number, piece: number): Pt {
  const T = trackLen(board);
  if (p === HOME) return l.home[color][piece];
  if (p >= T) return l.goal[color][Math.min(3, p - T)];
  return l.track[(color * PER_COLOR + p) % T];
}

/** Weg Feld für Feld (ohne Startpunkt) */
export function pathOf(from: number, to: number): number[] {
  if (from === HOME) return [to];
  const step = to > from ? 1 : -1;
  const out: number[] = [];
  for (let p = from + step; step > 0 ? p <= to : p >= to; p += step) out.push(p);
  return out;
}
