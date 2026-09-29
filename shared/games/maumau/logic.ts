/**
 * Mau-Mau mit deutschem Blatt – läuft im Browser (lokal) und im Durable Object (online).
 * Hausregeln sind Einstellungen. Die Hände der anderen und der Ziehstapel bleiben geheim (view).
 */
import { drawCards, isCard, rankOf, shuffledDeck, sortHand, suitOf, SUITS, type Card, type Suit } from "../../cards/german";
import { shuffle } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export interface MauMauState {
  v: 1;
  hands: Record<string, Card[]>;
  /** Anzahl Karten je Spieler (öffentlich) */
  counts: Record<string, number>;
  pile: Card[];
  pileCount: number;
  discard: Card[];
  curId: string | null;
  dir: 1 | -1;
  /** Gewünschte Farbe nach einem Unter */
  wish: Suit | null;
  /** Karten, die der Nächste wegen Siebenen ziehen muss */
  pendingDraw: number;
  /** In diesem Zug schon eine Karte gezogen – nur diese darf noch gelegt werden */
  drawn: Card | null;
  winnerId: string | null;
  /** zählt Züge, für Animationen */
  n: number;
  log: string[];
}

export type MauMauAction =
  | { type: "play"; card: Card; wish?: Suit; mau?: boolean }
  | { type: "draw" }
  | { type: "pass" };

interface Rules { stack7: boolean; skip8: boolean; reverse9: boolean; againA: boolean; unterOnUnter: boolean; mau: boolean; hand: number }

export function rulesOf(o: Options): Rules {
  return {
    stack7: o.stack7 !== false, skip8: o.skip8 !== false, reverse9: o.reverse9 === true, againA: o.againA === true,
    unterOnUnter: o.unterOnUnter === true, mau: o.mau !== false, hand: o.hand === "6" ? 6 : 5,
  };
}

const MAX_LOG = 50;
export const top = (s: MauMauState): Card => s.discard[s.discard.length - 1];
/** Farbe, die gerade bedient werden muss */
export const activeSuit = (s: MauMauState): Suit => s.wish ?? suitOf(top(s));

/** Darf diese Karte gerade gelegt werden? */
export function canPlay(s: MauMauState, card: Card, o: Options): boolean {
  const r = rulesOf(o);
  const t = top(s);
  if (s.pendingDraw > 0) return r.stack7 && rankOf(card) === "7";
  if (rankOf(card) === "U") return rankOf(t) !== "U" || r.unterOnUnter;
  if (s.wish) return suitOf(card) === s.wish;
  return suitOf(card) === suitOf(t) || rankOf(card) === rankOf(t);
}

function refill(s: MauMauState): Card[] {
  // Ablage bis auf die oberste Karte neu mischen
  if (s.discard.length <= 1) return [];
  const rest = s.discard.splice(0, s.discard.length - 1);
  s.log.push("Ablage wird neu gemischt");
  return shuffle(rest);
}

function give(s: MauMauState, id: string, n: number): Card[] {
  const got = drawCards(s.pile, n, () => refill(s));
  s.hands[id] = sortHand([...(s.hands[id] ?? []), ...got]);
  return got;
}

function sync(s: MauMauState) {
  s.counts = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length]));
  s.pileCount = s.pile.length;
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

/** Nächster Spieler in Spielrichtung */
function step(players: Player[], id: string | null, dir: 1 | -1): string | null {
  return nextPlayerId(dir === 1 ? players : players.slice().reverse(), id);
}

function setup(ctx: GameContext): MauMauState {
  const r = rulesOf(ctx.options);
  const pile = shuffledDeck();
  const hands: Record<string, Card[]> = {};
  for (const p of ctx.players) hands[p.id] = sortHand(pile.splice(pile.length - r.hand, r.hand));
  const s: MauMauState = {
    v: 1, hands, counts: {}, pile, pileCount: 0, discard: [pile.pop()!], curId: ctx.players[0]?.id ?? null, dir: 1,
    wish: null, pendingDraw: 0, drawn: null, winnerId: null, n: 0, log: [],
  };
  // Die aufgedeckte Startkarte wirkt auf den ersten Spieler
  const first = rankOf(top(s));
  if (first === "7") s.pendingDraw = 2;
  if (first === "8" && r.skip8) s.curId = step(ctx.players, s.curId, 1);
  sync(s);
  return s;
}

const nameOf = (ctx: GameContext, id: string | null) => ctx.players.find((p) => p.id === id)?.name ?? "?";

function apply(prev: MauMauState, a: MauMauAction, ctx: GameContext): MauMauState {
  const s = structuredClone(prev);
  const r = rulesOf(ctx.options);
  const me = s.curId;
  if (!me || !s.hands[me]) throw new GameError("Es ist niemand am Zug.");
  const hand = s.hands[me];
  const endTurn = (skip = false) => {
    s.drawn = null;
    s.curId = step(ctx.players, s.curId, s.dir);
    if (skip) s.curId = step(ctx.players, s.curId, s.dir);
    s.n++;
  };

  switch (a.type) {
    case "play": {
      if (!isCard(a.card) || !hand.includes(a.card)) throw new GameError("Diese Karte hast du nicht.");
      if (s.drawn && a.card !== s.drawn) throw new GameError("Nach dem Ziehen darfst du nur die gezogene Karte legen.");
      if (!canPlay(s, a.card, ctx.options)) {
        throw new GameError(s.pendingDraw ? `Du musst ${s.pendingDraw} Karten ziehen${r.stack7 ? " oder eine Sieben legen" : ""}.` : s.wish ? "Das passt nicht – gewünscht ist eine andere Farbe." : "Die Karte passt nicht.");
      }
      const rank = rankOf(a.card);
      if (rank === "U" && (!a.wish || !SUITS.includes(a.wish))) throw new GameError("Wünsch dir eine Farbe.");
      hand.splice(hand.indexOf(a.card), 1);
      s.discard.push(a.card);
      s.wish = rank === "U" ? a.wish! : null;
      if (hand.length === 0) {
        s.winnerId = me;
        s.log.push(`${nameOf(ctx, me)} hat keine Karten mehr – Mau-Mau!`);
        s.drawn = null;
        sync(s);
        return s;
      }
      if (hand.length === 1 && r.mau && !a.mau) {
        give(s, me, 1);
        s.log.push(`${nameOf(ctx, me)} hat „Mau“ vergessen und zieht eine Strafkarte`);
      }
      if (rank === "7") s.pendingDraw += 2;
      if (rank === "9" && r.reverse9) s.dir = s.dir === 1 ? -1 : 1;
      if (rank === "A" && r.againA) { s.drawn = null; s.n++; sync(s); return s; }
      endTurn(rank === "8" && r.skip8);
      sync(s);
      return s;
    }
    case "draw": {
      if (s.drawn) throw new GameError("Du hast schon gezogen – leg die Karte oder passe.");
      if (s.pendingDraw > 0) {
        const got = give(s, me, s.pendingDraw);
        s.log.push(`${nameOf(ctx, me)} zieht ${got.length} Karten`);
        s.pendingDraw = 0;
        endTurn();
        sync(s);
        return s;
      }
      const got = give(s, me, 1);
      if (!got[0]) {
        s.log.push("Keine Karten mehr zum Ziehen");
        endTurn();
      } else if (canPlay(s, got[0], ctx.options)) {
        s.drawn = got[0];
      } else {
        endTurn();
      }
      sync(s);
      return s;
    }
    case "pass": {
      if (!s.drawn) throw new GameError("Erst ziehen, dann passen.");
      endTurn();
      sync(s);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

export const maumau: GameLogic<MauMauState, MauMauAction> = {
  info: {
    id: "maumau",
    name: "Mau-Mau",
    tagline: "Farbe oder Wert bedienen, Siebenen ziehen lassen, Unter wünschen – wer zuerst keine Karten hat, gewinnt.",
    category: "Karten",
    minPlayers: 2,
    maxPlayers: 5,
    duration: "10–20 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  settings: [
    { key: "hand", label: "Karten pro Spieler", type: "choice", default: "5", choices: [{ value: "5", label: "5 Karten", hint: "2–5 Spieler" }, { value: "6", label: "6 Karten", hint: "2–4 Spieler" }] },
    { key: "stack7", label: "Siebenen stapeln", type: "toggle", default: true, hint: "7 heißt zwei ziehen – wer selbst eine 7 hat, legt drauf und der Nächste zieht alles" },
    { key: "skip8", label: "8: Nächster setzt aus", type: "toggle", default: true },
    { key: "unterOnUnter", label: "Unter auf Unter erlaubt", type: "toggle", default: false, hint: "sonst gilt: Unter auf Unter geht nicht" },
    { key: "reverse9", label: "9: Richtungswechsel", type: "toggle", default: false },
    { key: "againA", label: "Ass: nochmal legen", type: "toggle", default: false },
    { key: "mau", label: "„Mau“ sagen", type: "toggle", default: true, hint: "vor der vorletzten Karte, sonst eine Strafkarte" },
  ],
  playerLimits: (o) => (rulesOf(o).hand === 6 ? { min: 2, max: 4 } : { min: 2, max: 5 }),
  setup,
  apply,
  actionKind: (a) => (a.type === "play" || a.type === "draw" || a.type === "pass" ? "turn" : null),
  currentPlayerId: (s) => (s.winnerId ? null : s.curId),
  isOver: (s) => s.winnerId !== null,
  skipLabel: (s, ctx) => {
    const cur = ctx.players.find((p) => p.id === s.curId);
    return cur && !s.winnerId ? `Zug von ${cur.name} überspringen (zieht ${s.drawn ? "nichts mehr" : s.pendingDraw || 1})` : null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    const me = s.curId;
    if (!me || !s.hands[me]) return s;
    if (!s.drawn) {
      const n = s.pendingDraw || 1;
      give(s, me, n);
      s.pendingDraw = 0;
    }
    s.log.push(`${nameOf(ctx, me)} wurde übersprungen`);
    s.drawn = null;
    s.curId = step(ctx.players, me, s.dir);
    s.n++;
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    // Karten des Spielers kommen unter den Ziehstapel
    s.pile.unshift(...(s.hands[id] ?? []));
    delete s.hands[id];
    if (s.curId === id) {
      s.curId = step(ctx.players, id, s.dir);
      s.drawn = null;
    }
    const left = ctx.players.filter((p) => p.id !== id);
    if (left.length === 1 && !s.winnerId) s.winnerId = left[0].id;
    sync(s);
    return s;
  },
  // Fremde Hände und der Ziehstapel bleiben geheim
  view: (s, viewer) => (viewer === null ? s : { ...s, pile: [], hands: viewer in s.hands ? { [viewer]: s.hands[viewer] } : {} }),
};
