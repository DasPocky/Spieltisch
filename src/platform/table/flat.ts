/**
 * Einfacher flacher Tisch (ohne 3D): für schwache Geräte, ausgeschaltetes 3D oder wenn WebGL ausfällt.
 * Gleiche Schnittstelle wie die 3D-Szene (`TableScene`) und gleiche Anordnung – Holzrahmen, Filz, Stapel und Ablage
 * in der Mitte, verdeckte Hände vor den Plätzen; nur von oben gesehen und ohne Bewegung. Kartenbilder wie im 3D-Tisch.
 */
import { CARD_RATIO, drawBack, drawFace } from "./textures";
import type { TableDeck, TableModel } from "./model";
import type { FeltRect, TableScene } from "./scene";

const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };

export function createFlatScene(canvas: HTMLCanvasElement): TableScene {
  const g = canvas.getContext("2d")!;
  let width = 1, height = 1, dpr = 1;
  let model: TableModel | null = null;
  let seats: string[] = [];
  const faces = new Map<string, HTMLCanvasElement | null>();
  const backs = new Map<TableDeck, HTMLCanvasElement>();

  /** Tischfläche: Holz außen, Filz innen – Platz rundherum für die Schilder */
  const layout = () => {
    const mx = Math.max(90, width * 0.11), my = Math.max(80, height * 0.15);
    // Noch nicht ausgemessen (Breite 1): nichts Negatives entstehen lassen
    const wood = { x: mx, y: my, w: Math.max(1, width - 2 * mx), h: Math.max(1, height - 2 * my) };
    const r = Math.max(0, Math.min(wood.w, wood.h) * 0.04);
    const felt = { x: wood.x + r * 1.2, y: wood.y + r * 1.2, w: Math.max(1, wood.w - r * 2.4), h: Math.max(1, wood.h - r * 2.4) };
    return { wood, felt, r };
  };

  /** Punkt am Rand des Filzes: t einmal herum, 0 = vorn Mitte (wie im 3D-Tisch) */
  const onEdge = (t: number, x0: number, y0: number, w: number, h: number) => {
    const per = 2 * (w + h);
    let s = (((t % 1) + 1) % 1) * per;
    const legs: [number, number, number, number, number][] = [
      [w / 2, x0 + w / 2, y0 + h, -1, 0], [h, x0, y0 + h, 0, -1], [w, x0, y0, 1, 0], [h, x0 + w, y0, 0, 1], [w / 2, x0 + w, y0 + h, -1, 0],
    ];
    for (const [len, x, y, dx, dy] of legs) { if (s <= len) return { x: x + dx * s, y: y + dy * s }; s -= len; }
    return { x: x0 + w / 2, y: y0 + h };
  };

  const back = (d: TableDeck) => { let b = backs.get(d); if (!b) backs.set(d, (b = drawBack(d))); return b; };
  const face = (d: TableDeck, card: string) => {
    const key = `${d}:${card}`;
    if (!faces.has(key)) { faces.set(key, null); void drawFace(d, card).then((c) => { faces.set(key, c); draw(); }); }
    return faces.get(key) ?? back(d);
  };

  function card(img: HTMLCanvasElement, cx: number, cy: number, w: number, d: TableDeck, rot = 0, glow = false) {
    const h = w * CARD_RATIO[d];
    g.save(); g.translate(cx, cy); g.rotate(rot);
    g.shadowColor = glow ? "rgba(255,190,120,.9)" : "rgba(0,0,0,.35)"; g.shadowBlur = glow ? 24 : 8; g.shadowOffsetY = glow ? 0 : 3;
    g.drawImage(img, -w / 2, -h / 2, w, h);
    g.restore();
  }

  function draw() {
    if (width < 50 || height < 50) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    const { wood, felt, r } = layout();
    // Holz und Filz
    g.fillStyle = "#8a5a36"; g.beginPath(); g.roundRect(wood.x, wood.y, wood.w, wood.h, r * 2); g.fill();
    g.strokeStyle = "rgba(60,30,12,.5)"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "#2a7a72"; g.beginPath(); g.roundRect(felt.x, felt.y, felt.w, felt.h, r); g.fill();
    if (!model) return;
    const d = model.deck;
    const cw = Math.min(felt.w * 0.11, felt.h * 0.2);
    const cx = felt.x + felt.w / 2, cy = felt.y + felt.h / 2;
    const anchors = seats.map((_, i) => onEdge(i / Math.max(seats.length, 1), felt.x + cw * 1.2, felt.y + felt.h * 0.13, felt.w - cw * 2.4, felt.h * 0.74));

    // Verdeckte Hände vor den Plätzen (höchstens 10 sichtbar)
    seats.forEach((id, i) => {
      const n = Math.min(model!.counts[id] ?? 0, 10);
      const a = anchors[i];
      const ang = Math.atan2(a.x - cx, cy - a.y);
      for (let k = 0; k < n; k++) {
        const off = k - (n - 1) / 2;
        card(back(d), a.x + Math.cos(ang) * off * cw * 0.18, a.y + Math.sin(ang) * off * cw * 0.18, cw * 0.6, d, ang + off * 0.05, id === model!.turn && k === Math.floor(n / 2));
      }
    });

    const w = model.words;
    if (w) {
      // Lückensatz: schwarze Karte groß links, gelegte bzw. aufgedeckte Antworten rechts daneben
      card(face("schamlos", w.prompt), felt.x + felt.w * 0.24, cy, cw * 1.9, "schamlos", 0.03);
      if (!w.subs.length) {
        w.playedBy.forEach((id, i) => card(back("schamlos"), felt.x + felt.w * (0.48 + (i % 4) * 0.11), cy + (Math.floor(i / 4) - 0.5) * cw * 1.5, cw * 1.2, "schamlos", ((hash(id) % 21) - 10) / 80));
      } else {
        const n = w.subs.length, cols = n <= 4 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols);
        const cs = Math.min(cw * 1.3, (felt.w * 0.5) / (cols * 1.15));
        w.subs.forEach((cards, i) => {
          const x = felt.x + felt.w * 0.45 + (i % cols) * cs * 1.2, y = cy + (Math.floor(i / cols) - (rows - 1) / 2) * cs * CARD_RATIO.schamlos * 1.08;
          cards.forEach((c, k) => card(face("schamlos", c), x + k * cs * 0.45, y + k * cs * 0.08, cs, "schamlos", 0, w.pick === i));
        });
      }
      return;
    }

    // Stapel und Ablage in der Mitte
    if (model.pile > 0) for (let k = 0; k < Math.min(4, Math.ceil(model.pile / 10)); k++) card(back(d), cx - cw * 0.9 - k * 1.5, cy - k * 1.5, cw, d, 0.04);
    model.discard.forEach((c, i) => card(face(d, c), cx + cw * 0.6 + ((hash(c + i) % 7) - 3) * 2, cy + ((hash(c) >> 3) % 7 - 3) * 2, cw, d, ((hash(c + i) >> 6) % 41 - 20) / 100));
  }

  return {
    update(m, s) { model = m; seats = s; draw(); },
    resize(w, h) {
      width = Math.max(1, w); height = Math.max(1, h); dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      draw();
    },
    seatPoints() {
      const { wood } = layout();
      return seats.map((_, i) => onEdge(i / Math.max(seats.length, 1), wood.x - 40, wood.y - 45, wood.w + 80, wood.h + 90));
    },
    feltRect(): FeltRect { const { felt } = layout(); return { ...felt }; },
    dispose() { faces.clear(); backs.clear(); },
  };
}
