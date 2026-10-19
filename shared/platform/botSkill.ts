/**
 * Spielstärke der Bots – getrennt vom Zufall und wiederholbar:
 *  - „zufall“: irgendein erlaubter Zug (die Testspieler der Verwaltung, die Simulation)
 *  - „leicht“, „mittel“, „schwer“: Züge werden bewertet; je stärker, desto öfter nimmt der Bot den besten
 * Der Würfel des Bots hängt nur an einem festen Startwert und dem, was er sieht – dieselbe Lage ergibt denselben Zug.
 * Bewertet wird ausschließlich mit der eigenen Sicht (`viewRoom`): fremde Karten und der Stapel bleiben geheim.
 * Ob ein Zug erlaubt ist, prüft die Spiel-Logik – das verrät nichts, was ein Mensch nicht auch ausprobieren könnte.
 */
import { DECKS, rankOf, suitOf, type Card } from "../cards/deck";
import type { MauMauState } from "../games/maumau/logic";
import { colorOf, COLORS, isWild, valueOf, type EinsCard, type EinsState } from "../games/eins/logic";
import type { VierState } from "../games/vier/logic";
import { botMove, candidates, type Move } from "./bots";
import { applyRoomAction, roomGame, viewRoom, type RoomAction, type RoomState } from "./room";
import { GameError } from "./types";

export type BotLevel = "zufall" | "leicht" | "mittel" | "schwer";
export const BOT_LEVELS: { value: BotLevel; label: string }[] = [
  { value: "leicht", label: "Leicht" }, { value: "mittel", label: "Mittel" }, { value: "schwer", label: "Schwer" }, { value: "zufall", label: "Zufall" },
];
export const isBotLevel = (x: unknown): x is BotLevel => BOT_LEVELS.some((l) => l.value === x);

/** Wie oft der Bot den besten Zug nimmt (sonst einen beliebigen erlaubten) */
const BEST_SHARE: Record<BotLevel, number> = { zufall: 0, leicht: 0.4, mittel: 0.75, schwer: 1 };

/** Kleiner, schneller Zufallsgenerator mit Startwert (mulberry32) */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Legal = { action: RoomAction; next: RoomState };
/** Bewertung eines erlaubten Zugs aus Sicht des Bots (höher ist besser) */
type Scorer = (view: RoomState, a: { type: string } & Record<string, unknown>, after: RoomState, me: string) => number;

const g = (m: Move) => (m.action.type === "game" ? m.action.action : null);

// ---------------------------------------------------------------- Mau-Mau

function scoreMaumau(view: RoomState, a: { type: string } & Record<string, unknown>, _after: RoomState, me: string): number {
  const s = view.game as MauMauState;
  const hand = s.hands[me] ?? [];
  if (a.type === "play") {
    const card = a.card as Card;
    const r = rankOf(card);
    let v = 10 + (a.mau ? 3 : 0);
    // Bube/Unter für später aufheben – außer er ist die letzte Karte
    if ((r === "U" || r === "B") && hand.length > 1) v -= 4;
    // Strafkarten und Aussetzen sind gut, wenn der Nächste fast fertig ist
    const fewest = Math.min(...Object.entries(s.counts).filter(([id]) => id !== me).map(([, n]) => n));
    if ((r === "7" || r === "8") && fewest <= 2) v += 4;
    // Wunschfarbe: die Farbe, von der man am meisten hat
    if (a.wish) v += hand.filter((c) => c !== card && suitOf(c) === a.wish).length;
    // Farbe behalten, von der man viele hat (damit man später noch legen kann)
    v -= hand.filter((c) => c !== card && suitOf(c) === suitOf(card)).length * 0.3;
    return v;
  }
  if (a.type === "draw") return s.drawn ? -20 : 0;
  if (a.type === "pass") return -1;
  return 0;
}

// ---------------------------------------------------------------- Eins!

function scoreEins(view: RoomState, a: { type: string } & Record<string, unknown>, _after: RoomState, me: string): number {
  const s = view.game as EinsState;
  const hand = s.hands[me] ?? [];
  const most = (skip?: string) => {
    const n: Record<string, number> = {};
    for (const c of hand) if (c !== skip) { const col = colorOf(c); if (col) n[col] = (n[col] ?? 0) + 1; }
    return n;
  };
  if (a.type === "play") {
    const card = a.card as EinsCard;
    let v = 10 + (a.eins ? 3 : 0);
    // Joker für später aufheben
    if (isWild(card) && hand.length > 2) v -= 5;
    const val = valueOf(card);
    const fewest = Math.min(...Object.entries(s.counts).filter(([id]) => id !== me).map(([, n]) => n));
    if ((val === "plus2" || val === "skip" || val === "plus4") && fewest <= 2) v += 4;
    if (a.color) v += (most(card)[a.color as string] ?? 0);
    return v;
  }
  if (a.type === "color") return most()[a.color as string] ?? 0;
  if (a.type === "doubt") return -2;
  if (a.type === "draw") return -3;
  return 0;
}

// ---------------------------------------------------------------- Vier in einer Reihe

/** Steht für die Farbe ein Gewinnzug bereit? (offenes Brett, keine Geheimnisse) */
function winsNext(room: RoomState, actor: string): boolean {
  const s = room.game as VierState;
  for (let col = 0; col < s.cols; col++) {
    try {
      const n = applyRoomAction(room, { type: "game", action: { type: "drop", col } }, actor);
      if ((n.game as VierState).winner !== null) return true;
    } catch (e) { if (!(e instanceof GameError)) throw e; }
  }
  return false;
}

function scoreVier(view: RoomState, a: { type: string } & Record<string, unknown>, after: RoomState, me: string): number {
  if (a.type !== "drop") return -100;
  const s = view.game as VierState;
  const n = after.game as VierState;
  const col = a.col as number;
  if (n.winner !== null) return 1000;
  const other = s.colors.find((id) => id !== me) ?? me;
  // Darf der andere danach gewinnen? Dann nur, wenn es sowieso nicht zu verhindern ist
  let v = winsNext(after, other) ? -500 : 0;
  // Den Gewinnzug des anderen blocken: Zug, nach dem er keinen mehr hat, während er vorher einen hatte
  if (winsNext({ ...view, game: { ...s, turn: (1 - s.turn) as 0 | 1 } }, other) && v === 0) v += 200;
  // Mitte ist stärker
  v -= Math.abs(col - (s.cols - 1) / 2) * 2;
  return v;
}

const SCORERS: Record<string, Scorer> = { maumau: scoreMaumau, eins: scoreEins, vier: scoreVier };

type A = { type: string } & Record<string, unknown>;
/** Alle sinnvollen Züge – ohne Zufall, damit dieselbe Lage denselben Zug ergibt */
const MOVES: Record<string, (view: RoomState, me: string) => A[]> = {
  maumau: (view, me) => {
    const s = view.game as MauMauState;
    const out: A[] = [{ type: "draw" }, { type: "pass" }];
    for (const card of s.hands[me] ?? []) for (const wish of DECKS[s.deck].suits) for (const mau of [true, false]) out.push({ type: "play", card, wish, mau });
    return out;
  },
  eins: (view, me) => {
    const s = view.game as EinsState;
    const out: A[] = [{ type: "draw" }, { type: "pass" }, { type: "doubt" }, { type: "nextRound" }, { type: "finishRound" }, ...COLORS.map((color) => ({ type: "color", color }))];
    for (const card of s.hands[me] ?? []) for (const color of COLORS) for (const eins of [true, false]) {
      for (const target of card.endsWith("-7") ? view.players.map((p) => p.id) : [undefined]) out.push({ type: "play", card, color, eins, target });
    }
    return out;
  },
  vier: (view) => Array.from({ length: (view.game as VierState).cols }, (_, col) => ({ type: "drop", col })),
};

/** Kann dieses Spiel Züge bewerten? (sonst spielen alle Stufen wie „zufall“) */
export const hasSkill = (gameId: string) => gameId in SCORERS;

/**
 * Zug eines Bots mit Spielstärke. `seed` macht ihn wiederholbar (z. B. Raum + Runde).
 * Gibt null zurück, wenn der Bot gerade nichts tun kann.
 */
export function chooseBotMove(room: RoomState, botId: string, level: BotLevel, online: boolean, seed = ""): Legal | null {
  if (room.phase !== "playing" || !room.game || roomGame(room).isOver(room.game)) return null;
  const view = viewRoom(room, botId);
  // Würfel des Bots: fester Startwert + nur das, was er sieht
  const rnd = seeded(`${seed}|${botId}|${room.round}|${JSON.stringify(view.game)}`);
  const own = MOVES[room.gameId];
  const moves: Move[] = own
    ? own(view, botId).map((a) => ({ action: { type: "game", action: a }, actor: online ? botId : null }))
    : candidates(room, online).filter((m) => (online ? m.actor === botId : true));
  const legal: Legal[] = [];
  const seen = new Set<string>();
  for (const m of moves) {
    const key = JSON.stringify(m.action);
    if (seen.has(key)) continue;
    seen.add(key);
    try { legal.push({ action: m.action, next: applyRoomAction(room, m.action, online ? botId : null) }); } catch (e) { if (!(e instanceof GameError)) throw e; }
  }
  if (!legal.length) return null;
  const scorer = SCORERS[room.gameId];
  if (!scorer || rnd() >= BEST_SHARE[level]) return legal[Math.floor(rnd() * legal.length)];
  let best: Legal[] = [], top = -Infinity;
  for (const l of legal) {
    const a = g({ action: l.action, actor: botId });
    const v = a ? scorer(view, a as { type: string } & Record<string, unknown>, viewRoom(l.next, botId), botId) : -Infinity;
    if (v > top + 1e-9) { top = v; best = [l]; } else if (Math.abs(v - top) <= 1e-9) best.push(l);
  }
  return best[Math.floor(rnd() * best.length)];
}

/** Zug eines Bots mit der Stärke, die der Raum für ihn kennt (ohne Angabe: zufällig wie die Testspieler) */
export function playBot(room: RoomState, botId: string, online: boolean, seed = ""): { action: RoomAction; next: RoomState } | null {
  const level = room.botLevels?.[botId];
  // Spiele ohne Bewertung: echter Zufall (ein fester Startwert ließe den Bot in derselben Lage immer gleich ziehen –
  // z. B. einen Würfel endlos an- und abwählen)
  if (!level || level === "zufall" || !hasSkill(room.gameId)) return botMove(room, botId, online);
  if (!online && room.phase === "playing" && room.game && roomGame(room).currentPlayerId(room.game) !== botId) return null;
  return chooseBotMove(room, botId, level, online, seed);
}
