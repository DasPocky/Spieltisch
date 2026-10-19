/**
 * Kartenbilder für den 3D-Tisch: dieselben Farbsymbole und Eins-Karten wie am Handy, als Bild in ein Canvas gezeichnet.
 * Jede Karte entsteht nur einmal und bleibt im Speicher.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rankOf, RANK_NAME, suitOf, type Card } from "@shared/cards/deck";
import type { EinsCard } from "@shared/games/eins/logic";
import { SuitIcon, SUIT_COLOR } from "@/platform/cards/PlayingCard";
import { EinsCardView } from "@/games/eins/Board";
import { cardText } from "@shared/games/schamlos/cards";
import type { TableDeck, TableModel } from "./model";
import { pointXY } from "@shared/games/muehle/logic";
import { layout } from "@/games/ludo/geometry";
import { PALETTE } from "@/games/ludo/colors";

/** Seitenverhältnis wie am Handy: Spielkarten 5:8, Eins! 5:7 */
export const CARD_RATIO: Record<TableDeck, number> = { cards: 8 / 5, eins: 7 / 5, schamlos: 7 / 5, zahlen: 7 / 5 };
/** Breite der Kartenbilder in Pixeln – scharf auch auf 4K-Fernsehern */
const W = 768;

const PAPER = "#fdfdfb";
const FONT = `"Quicksand", "Nunito", system-ui, sans-serif`;

function canvas(deck: TableDeck) {
  const c = document.createElement("canvas");
  c.width = W; c.height = Math.round(W * CARD_RATIO[deck]);
  return c;
}

function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
}

/** SVG aus React-Markup als Bild laden */
function svgImage(markup: string): Promise<HTMLImageElement> {
  const start = markup.indexOf("<svg");
  const end = markup.lastIndexOf("</svg>") + 6;
  const svg = markup.slice(start, end).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

const suitImages = new Map<string, Promise<HTMLImageElement>>();
const suitImage = (suit: ReturnType<typeof suitOf>) => {
  let p = suitImages.get(suit);
  if (!p) suitImages.set(suit, (p = svgImage(renderToStaticMarkup(createElement(SuitIcon, { suit })))));
  return p;
};

/** Französische/deutsche Karte – Aufbau wie `PlayingCard` */
async function drawPlaying(card: Card): Promise<HTMLCanvasElement> {
  const c = canvas("cards");
  const g = c.getContext("2d")!;
  const w = c.width, h = c.height, u = w / 100;
  const suit = suitOf(card), rank = rankOf(card), color = SUIT_COLOR[suit];
  const face = rank === "U" || rank === "O" || rank === "B" || rank === "D" || rank === "K";
  const icon = await suitImage(suit);
  g.fillStyle = PAPER; rounded(g, 0, 0, w, h, 10 * u); g.fill();
  const corner = () => {
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "top";
    g.font = `700 ${26 * u}px ${FONT}`; g.fillText(rank, 17 * u, 5 * u);
    g.drawImage(icon, 7 * u, 33 * u, 20 * u, 20 * u);
  };
  corner();
  g.save(); g.translate(w, h); g.rotate(Math.PI); corner(); g.restore();
  const bx = 14 * u, by = 22 * u, bw = w - 28 * u, bh = h - 44 * u;
  if (face) {
    g.fillStyle = `${color}14`; rounded(g, bx, by, bw, bh, 6 * u); g.fill();
    g.strokeStyle = `${color}55`; g.lineWidth = 1.2 * u; g.stroke();
    const s = 34 * u;
    g.drawImage(icon, w / 2 - s / 2, h / 2 - s / 2 - 8 * u, s, s);
    g.fillStyle = color; g.font = `700 ${13 * u}px ${FONT}`; g.textBaseline = "top";
    g.fillText(RANK_NAME[rank].toUpperCase(), w / 2, h / 2 + s / 2 - 4 * u);
  } else {
    const s = (rank === "A" ? 58 : 44) * u;
    g.drawImage(icon, w / 2 - s / 2, h / 2 - s / 2, s, s);
  }
  return c;
}

/** Eins-Karte – das Bild von `EinsCardView` auf weißem Grund */
async function drawEins(card: EinsCard): Promise<HTMLCanvasElement> {
  const c = canvas("eins");
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff"; rounded(g, 0, 0, c.width, c.height, c.width * 0.12); g.fill();
  const img = await svgImage(renderToStaticMarkup(createElement(EinsCardView, { card })));
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Kleines Zeichen und Name unten auf einer Textkarte */
function brand(g: CanvasRenderingContext2D, u: number, h: number, color: string) {
  g.save(); g.fillStyle = color; g.translate(11 * u, h - 11 * u); g.rotate(-0.14);
  rounded(g, -2.5 * u, -2.5 * u, 5 * u, 5 * u, 1 * u); g.fill(); g.restore();
  g.fillStyle = color; g.font = `700 ${4.6 * u}px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle";
  g.fillText("Schamlos", 16 * u, h - 11 * u);
}

/** Text in Zeilen umbrechen; Schrift so groß wie möglich, damit er in den Kasten passt */
function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, start: number): { lines: string[]; size: number } {
  for (let size = start; size > 20; size -= 2) {
    g.font = `700 ${size}px ${FONT}`;
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > maxW && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length * size * 1.18 <= maxH && lines.every((l) => g.measureText(l).width <= maxW)) return { lines, size };
  }
  return { lines: [text], size: 20 };
}

/** Schamlos-Karte: schwarz mit Lücken bzw. weiß mit Antwort, große Schrift – lesbar aus der Entfernung */
async function drawWords(id: string): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const c = canvas("schamlos");
  const g = c.getContext("2d")!;
  const w = c.width, h = c.height, u = w / 100;
  const black = id.includes("-b-");
  g.fillStyle = black ? "#16171b" : "#fdfdfb"; rounded(g, 0, 0, w, h, 6 * u); g.fill();
  const text = cardText(id).replaceAll("___", "______");
  const { lines, size } = wrapText(g, text, w - 18 * u, h - 34 * u, 15 * u);
  g.fillStyle = black ? "#ffffff" : "#16171b"; g.textAlign = "left"; g.textBaseline = "top";
  lines.forEach((l, i) => g.fillText(l, 9 * u, 9 * u + i * size * 1.18));
  brand(g, u, h, black ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.35)");
  return c;
}

/** Rückseiten: Spielkarten im Marine-Muster, Eins! schwarz mit rotem Oval, Textkarten weiß mit Schriftzug */
export function drawBack(deck: TableDeck): HTMLCanvasElement {
  const c = canvas(deck);
  const g = c.getContext("2d")!;
  const w = c.width, h = c.height, u = w / 100;
  if (deck === "schamlos") {
    g.fillStyle = "#fdfdfb"; rounded(g, 0, 0, w, h, 6 * u); g.fill();
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.35); g.fillStyle = "rgba(22,23,27,.85)"; g.font = `700 ${17 * u}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("Schamlos", 0, 0); g.restore();
    return c;
  }
  if (deck === "eins") {
    g.fillStyle = "#ffffff"; rounded(g, 0, 0, w, h, 12 * u); g.fill();
    g.fillStyle = "#161616"; rounded(g, 5 * u, 5 * u, w - 10 * u, h - 10 * u, 9 * u); g.fill();
    // vier farbige Punkte im Quadrat (wie EinsBack)
    ["#d72600", "#ecd407", "#379711", "#0956bf"].forEach((col, i) => {
      g.fillStyle = col; g.strokeStyle = "#fff"; g.lineWidth = 2 * u;
      g.beginPath(); g.arc(w / 2 + (i % 2 ? 12 : -12) * u, h / 2 + (i < 2 ? -12 : 12) * u, 11 * u, 0, Math.PI * 2); g.fill(); g.stroke();
    });
    return c;
  }
  g.fillStyle = PAPER; rounded(g, 0, 0, w, h, (deck === "zahlen" ? 14 : 10) * u); g.fill();
  const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#2f6fb3"); grad.addColorStop(1, "#173a6b");
  g.fillStyle = grad; rounded(g, 5 * u, 5 * u, w - 10 * u, h - 10 * u, 6 * u); g.fill();
  g.save(); rounded(g, 5 * u, 5 * u, w - 10 * u, h - 10 * u, 6 * u); g.clip();
  g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 4 * u;
  for (let i = -h; i < w + h; i += 9 * u) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - h, h); g.stroke(); }
  g.restore();
  g.fillStyle = "rgba(255,255,255,.14)"; g.beginPath(); g.arc(w / 2, h / 2, 22 * u, 0, Math.PI * 2); g.fill();
  return c;
}

const faces = new Map<string, Promise<HTMLCanvasElement>>();

/** Vorderseite einer Karte (wird beim ersten Mal gezeichnet) */
export function drawFace(deck: TableDeck, card: string): Promise<HTMLCanvasElement> {
  const key = `${deck}:${card}`;
  let p = faces.get(key);
  if (!p) faces.set(key, (p = deck === "eins" ? drawEins(card as EinsCard) : deck === "schamlos" ? drawWords(card) : drawPlaying(card as Card)));
  return p;
}

/** Größte Schrift, mit der `text` in `maxW` passt */
function fit(g: CanvasRenderingContext2D, text: string, maxW: number, start: number, weight = 700) {
  let size = start;
  for (; size > 12; size -= 2) { g.font = `${weight} ${size}px ${FONT}`; if (g.measureText(text).width <= maxW) break; }
  return size;
}

/** Zahlenkarte (Stapelbau, Himmelskarten, Zehn Phasen, Glückssieben): weißes Feld, Farbe als Rand und Zahl – wie am Handy, mit kleiner Ecke */
async function drawNum(text: string, tone: string): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const c = canvas("zahlen");
  const g = c.getContext("2d")!;
  const w = c.width, h = c.height, u = w / 100;
  g.fillStyle = "#fbf7ef"; rounded(g, 0, 0, w, h, 14 * u); g.fill();
  g.strokeStyle = tone; g.lineWidth = 7 * u; rounded(g, 5 * u, 5 * u, w - 10 * u, h - 10 * u, 10 * u); g.stroke();
  g.fillStyle = tone; g.textAlign = "center"; g.textBaseline = "middle";
  fit(g, text, 70 * u, 62 * u); g.fillText(text, w / 2, h / 2 + 2 * u);
  g.font = `700 ${15 * u}px ${FONT}`; g.fillText(text, 17 * u, 19 * u);
  g.save(); g.translate(w, h); g.rotate(Math.PI); g.fillText(text, 17 * u, 19 * u); g.restore();
  return c;
}

/** Wortkarte (Decknamen): heller Karton, Wort groß, oben klein und kopfüber für die Gegenseite; aufgedeckt in der Teamfarbe */
async function drawWordCard(text: string, tone: string | null): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const c = document.createElement("canvas");
  c.width = 640; c.height = 400;
  const g = c.getContext("2d")!;
  const w = c.width, h = c.height, u = w / 100;
  const word = text.toUpperCase();
  g.fillStyle = tone ?? "#f3ead8"; rounded(g, 0, 0, w, h, 6 * u); g.fill();
  g.fillStyle = tone ? "rgba(255,255,255,.16)" : "#fffaf0"; rounded(g, 5 * u, 34 * u, w - 10 * u, 28 * u, 3 * u); g.fill();
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = tone ? "#ffffff" : "#2b2118";
  fit(g, word, 84 * u, 15 * u); g.fillText(word, w / 2, 48.5 * u);
  g.save(); g.translate(w / 2, 18 * u); g.rotate(Math.PI); g.globalAlpha = 0.45;
  fit(g, word, 60 * u, 7 * u, 600); g.fillText(word, 0, 0); g.restore();
  return c;
}

/** Vorderseite einer Zahlen- oder Wortkarte (wird beim ersten Mal gezeichnet) */
export function drawCard(kind: "num" | "word", text: string, tone: string | null): Promise<HTMLCanvasElement> {
  const key = `${kind}:${text}:${tone}`;
  let p = faces.get(key);
  if (!p) faces.set(key, (p = kind === "num" ? drawNum(text, tone ?? "#8a6f4e") : drawWordCard(text, tone)));
  return p;
}

/** Aufschrift auf dem Filz (z. B. „Ablage“): helle Schrift auf durchsichtigem Grund, so breit wie der Text */
export function drawLabel(text: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const g0 = c.getContext("2d")!;
  g0.font = `700 64px ${FONT}`;
  c.width = Math.ceil(g0.measureText(text).width + 24); c.height = 96;
  const g = c.getContext("2d")!;
  g.font = `700 64px ${FONT}`; g.fillStyle = "rgba(255,255,255,.82)"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, c.width / 2, 50);
  return c;
}

/** Leerer Platz für einen Stapel: gestrichelter Rahmen */
export function drawSlot(): HTMLCanvasElement {
  const c = canvas("zahlen");
  const g = c.getContext("2d")!;
  const u = c.width / 100;
  g.setLineDash([9 * u, 6 * u]); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 3.5 * u;
  rounded(g, 3 * u, 3 * u, c.width - 6 * u, c.height - 6 * u, 12 * u); g.stroke();
  return c;
}

/** Weicher Schatten unter einer Karte (ohne Schattenberechnung) */
export function drawContact(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return c;
}

/** Würfelseite: elfenbeinfarben, dunkle Augen (die Ecken rundet der Würfel selbst) */
export function drawPips(v: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, 256, 256);
  const at: Record<number, [number, number][]> = {
    1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  g.fillStyle = "#1f1a16";
  for (const [x, y] of at[v] ?? []) { g.beginPath(); g.arc(128 + x * 64, 128 + y * 64, v === 1 ? 30 : 24, 0, Math.PI * 2); g.fill(); }
  return c;
}

/**
 * Spielbrett von oben (Dame, Mühle, Ludo) – Brett-Koordinaten -1 … 1 füllen das ganze Bild.
 * Dieselben Farben wie am Handy.
 */
export function drawBoard(kind: NonNullable<TableModel["tabletop"]>["board"]): HTMLCanvasElement {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const px = (v: number) => ((v + 1) / 2) * S;
  if (kind.startsWith("dame")) {
    const n = kind === "dame:10" ? 10 : 8, cell = S / n;
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
      // Feld r (0 = vorn, Grundreihe von Weiß), dunkel wie im Spiel
      g.fillStyle = (r + col) % 2 === 0 ? "#9a6a44" : "#efdcb8";
      g.fillRect(col * cell, (n - 1 - r) * cell, cell, cell);
    }
    g.strokeStyle = "#5e3b22"; g.lineWidth = 10; g.strokeRect(5, 5, S - 10, S - 10);
    return c;
  }
  if (kind === "muehle") {
    g.fillStyle = "#dcb47e"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(120,80,40,${0.04 + Math.random() * 0.06})`; g.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * S; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S / 3, y + 8, (2 * S) / 3, y - 8, S, y + 3); g.stroke();
    }
    const at = (i: number) => { const [x, y] = pointXY(i); return [px((x - 3) * 0.293), px((y - 3) * 0.293)]; };
    g.strokeStyle = "#5b3a1e"; g.lineWidth = 9; g.lineCap = "round";
    for (let ring = 0; ring < 3; ring++) {
      g.beginPath();
      for (let k = 0; k <= 8; k++) { const [x, y] = at(ring * 8 + (k % 8)); if (k) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
    for (const k of [1, 3, 5, 7]) { const [x1, y1] = at(k), [x2, y2] = at(16 + k); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    g.fillStyle = "#5b3a1e";
    for (let i = 0; i < 24; i++) { const [x, y] = at(i); g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill(); }
    return c;
  }
  // Ludo: Kreuz bzw. Stern mit Laufbahn, Zielfeldern und Häusern
  const n = kind === "ludo:6" ? 6 : 4;
  const L = layout(n, 0);
  const u = (v: number) => px(v / L.half);
  g.fillStyle = "#f3e2b4"; g.fillRect(0, 0, S, S);
  g.strokeStyle = "#c9a96a"; g.lineWidth = 6; g.strokeRect(14, 14, S - 28, S - 28);
  g.strokeStyle = "#5a4a2c"; g.lineWidth = 7;
  g.beginPath(); L.track.forEach(([x, y], i) => (i ? g.lineTo(u(x), u(y)) : g.moveTo(u(x), u(y)))); g.closePath(); g.stroke();
  const field = ([x, y]: [number, number], fill: string, stroke = "#2a2418") => {
    g.beginPath(); g.arc(u(x), u(y), (L.r / L.half) * (S / 2), 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 5; g.strokeStyle = stroke; g.stroke();
  };
  L.track.forEach((pt, i) => field(pt, i % 10 === 0 ? PALETTE[i / 10].fill : "#fffdf6"));
  L.goal.forEach((gl, col) => gl.forEach((pt) => field(pt, PALETTE[col].light, PALETTE[col].dark)));
  L.home.forEach((hs, col) => hs.forEach((pt) => field(pt, PALETTE[col].light, PALETTE[col].dark)));
  g.beginPath(); g.arc(S / 2, S / 2, (0.45 / L.half) * (S / 2), 0, Math.PI * 2); g.fillStyle = "#c9a96a"; g.fill();
  return c;
}

/** Aufsteller (Partyspiele): heller Karton mit Rand, Phase groß, Hinweis darunter */
export function drawSign(title: string, sub?: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 400;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f7ecd6"; rounded(g, 0, 0, 1024, 400, 36); g.fill();
  g.strokeStyle = "#8a6f4e"; g.lineWidth = 8; rounded(g, 18, 18, 988, 364, 26); g.stroke();
  g.fillStyle = "#2b2118"; g.textAlign = "center"; g.textBaseline = "middle";
  fit(g, title, 900, 128); g.fillText(title, 512, sub ? 160 : 200);
  if (sub) { g.fillStyle = "#6b5a46"; fit(g, sub, 900, 56, 600); g.fillText(sub, 512, 295); }
  return c;
}
