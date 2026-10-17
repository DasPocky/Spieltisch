/**
 * Kartenbilder für den 3D-Tisch: dieselben Farbsymbole und Uno-Karten wie am Handy, als Bild in ein Canvas gezeichnet.
 * Jede Karte entsteht nur einmal und bleibt im Speicher.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rankOf, RANK_NAME, suitOf, type Card } from "@shared/cards/deck";
import type { UnoCard } from "@shared/games/uno/logic";
import { SuitIcon, SUIT_COLOR } from "@/platform/cards/PlayingCard";
import { UnoCardView } from "@/games/uno/Board";
import { cardText } from "@shared/games/schamlos/cards";
import type { TableDeck } from "./model";

/** Seitenverhältnis wie am Handy: Spielkarten 5:8, Uno 5:7 */
export const CARD_RATIO: Record<TableDeck, number> = { cards: 8 / 5, uno: 7 / 5, schamlos: 7 / 5 };
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

/** Uno-Karte – das Bild von `UnoCardView` auf weißem Grund */
async function drawUno(card: UnoCard): Promise<HTMLCanvasElement> {
  const c = canvas("uno");
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff"; rounded(g, 0, 0, c.width, c.height, c.width * 0.12); g.fill();
  const img = await svgImage(renderToStaticMarkup(createElement(UnoCardView, { card })));
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

/** Rückseiten: Spielkarten im Marine-Muster, Uno schwarz mit rotem Oval, Textkarten weiß mit Schriftzug */
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
  if (deck === "uno") {
    g.fillStyle = "#ffffff"; rounded(g, 0, 0, w, h, 12 * u); g.fill();
    g.fillStyle = "#161616"; rounded(g, 5 * u, 5 * u, w - 10 * u, h - 10 * u, 9 * u); g.fill();
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 6); g.fillStyle = "#d72600";
    g.beginPath(); g.ellipse(0, 0, 31 * u, 54 * u, 0, 0, Math.PI * 2); g.fill(); g.restore();
    return c;
  }
  g.fillStyle = PAPER; rounded(g, 0, 0, w, h, 10 * u); g.fill();
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
  if (!p) faces.set(key, (p = deck === "uno" ? drawUno(card as UnoCard) : deck === "schamlos" ? drawWords(card) : drawPlaying(card as Card)));
  return p;
}
