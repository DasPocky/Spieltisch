/**
 * Mau-Mau mit französischem oder deutschem Blatt – läuft im Browser (lokal) und im Durable Object (online).
 * Hausregeln sind Einstellungen. Die Hände der anderen und der Ziehstapel bleiben geheim (view).
 */
import { cardName, deckOf, deckSetting, DECKS, drawCards, isCardOf, isJack, rankOf, SUIT_NAME, shuffledDeck, sortHand, suitOf, type Card, type DeckId, type Suit } from "../../cards/deck";
import { shuffle } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { applyPad, isPadAction, newPad, padRemove, type Pad, type PadAction } from "../../platform/pad";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export interface MauMauState {
  v: 1;
  /** „table“: echte Karten, die App zählt nur Rundensiege */
  mode?: "app" | "table";
  pad?: Pad | null;
  /** Siege bis zum Gesamtsieg (echte Karten) */
  goal?: number;
  deck: DeckId;
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
  | PadAction
  | { type: "play"; card: Card; wish?: Suit; mau?: boolean }
  | { type: "draw" }
  | { type: "pass" };

interface Rules { stack7: boolean; skip8: boolean; reverse9: boolean; againA: boolean; unterOnUnter: boolean; mau: boolean; hand: number; deck: DeckId }

export function rulesOf(o: Options): Rules {
  return {
    stack7: o.stack7 !== false, skip8: o.skip8 !== false, reverse9: o.reverse9 === true, againA: o.againA === true,
    unterOnUnter: o.unterOnUnter === true, mau: o.mau !== false, hand: o.hand === "6" ? 6 : 5, deck: deckOf(o, "fr32").id,
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
  if (isJack(card)) return !isJack(t) || r.unterOnUnter;
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
  s.hands[id] = sortHand([...(s.hands[id] ?? []), ...got], DECKS[s.deck]);
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
  if (ctx.options.mode === "table") {
    return {
      v: 1, mode: "table", pad: newPad(ctx.players.map((p) => p.id)), goal: Number(ctx.options.goal) || 5, deck: r.deck, hands: {}, counts: {}, pile: [], pileCount: 0,
      discard: [], curId: null, dir: 1, wish: null, pendingDraw: 0, drawn: null, winnerId: null, n: 0, log: [],
    };
  }
  const deck = DECKS[r.deck];
  const pile = shuffledDeck(deck);
  const hands: Record<string, Card[]> = {};
  for (const p of ctx.players) hands[p.id] = sortHand(pile.splice(pile.length - r.hand, r.hand), deck);
  const s: MauMauState = {
    v: 1, deck: r.deck, hands, counts: {}, pile, pileCount: 0, discard: [pile.pop()!], curId: ctx.players[0]?.id ?? null, dir: 1,
    wish: null, pendingDraw: 0, drawn: null, winnerId: null, n: 0, log: [],
  };
  // Die aufgedeckte Startkarte wirkt auf den ersten Spieler
  const first = rankOf(top(s));
  if (first === "7") s.pendingDraw = 2;
  if (first === "8" && r.skip8) s.curId = step(ctx.players, s.curId, 1);
  sync(s);
  return s;
}

const APP = (o: Options) => o.mode !== "table";
const nameOf = (ctx: GameContext, id: string | null) => ctx.players.find((p) => p.id === id)?.name ?? "?";

function apply(prev: MauMauState, a: MauMauAction, ctx: GameContext): MauMauState {
  const s = structuredClone(prev);
  if (s.mode === "table") {
    if (!isPadAction(a) || !s.pad) throw new GameError("Mit echten Karten zählt die App nur die Siege.");
    if (s.winnerId) throw new GameError("Die Partie ist vorbei.");
    applyPad(s.pad, a, ctx);
    const champ = ctx.players.find((p) => (s.pad!.scores[p.id] ?? 0) >= (s.goal ?? 5));
    if (champ) s.winnerId = champ.id;
    return s;
  }
  if (isPadAction(a)) throw new GameError("Das geht nur mit echten Karten.");
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
      if (!isCardOf(DECKS[s.deck], a.card) || !hand.includes(a.card)) throw new GameError("Diese Karte hast du nicht.");
      if (s.drawn && a.card !== s.drawn) throw new GameError("Nach dem Ziehen darfst du nur die gezogene Karte legen.");
      if (!canPlay(s, a.card, ctx.options)) {
        throw new GameError(s.pendingDraw ? `Du musst ${s.pendingDraw} Karten ziehen${r.stack7 ? " oder eine Sieben legen" : ""}.` : s.wish ? "Das passt nicht – gewünscht ist eine andere Farbe." : "Die Karte passt nicht.");
      }
      const rank = rankOf(a.card);
      const jack = isJack(a.card);
      if (jack && (!a.wish || !DECKS[s.deck].suits.includes(a.wish))) throw new GameError("Wünsch dir eine Farbe.");
      hand.splice(hand.indexOf(a.card), 1);
      s.discard.push(a.card);
      s.wish = jack ? a.wish! : null;
      s.log.push(`${nameOf(ctx, me)}: ${cardName(a.card)}${jack ? ` – wünscht ${SUIT_NAME[a.wish!]}` : ""}`);
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
      if (got[0]) s.log.push(`${nameOf(ctx, me)} zieht eine Karte`);
      if (!got[0]) {
        s.log.push("Keine Karten mehr zum Ziehen");
        endTurn();
      } else if (canPlay(s, got[0], ctx.options) || ctx.options.autoPass !== true) {
        s.drawn = got[0];
      } else {
        endTurn();
      }
      sync(s);
      return s;
    }
    case "pass": {
      if (!s.drawn) throw new GameError("Erst ziehen, dann passen.");
      s.log.push(`${nameOf(ctx, me)} passt`);
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
    tagline: "Farbe oder Wert bedienen, Siebenen ziehen lassen, Buben wünschen – wer zuerst keine Karten hat, gewinnt.",
    category: "Karten",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "10–20 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  settings: [
    {
      key: "mode", label: "Karten", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "App mischt und teilt aus" },
        { value: "table", label: "Echte Karten", hint: "App zählt die Rundensiege" },
      ],
    },
    {
      key: "goal", label: "Gewonnen hat, wer zuerst …", type: "choice", default: "5", showIf: (o) => o.mode === "table",
      choices: [{ value: "3", label: "3 Siege" }, { value: "5", label: "5 Siege" }, { value: "10", label: "10 Siege" }],
    },
    { ...deckSetting("fr32"), showIf: APP },
    { key: "hand", showIf: APP, label: "Karten pro Spieler", type: "choice", default: "5", choices: [{ value: "5", label: "5 Karten" }, { value: "6", label: "6 Karten" }] },
    { key: "stack7", showIf: APP, group: "Hausregeln", label: "Siebenen stapeln", type: "toggle", default: true, hint: "üblich – 7 heißt zwei ziehen – wer selbst eine 7 hat, legt drauf und der Nächste zieht alles" },
    { key: "skip8", showIf: APP, group: "Hausregeln", label: "8: Nächster setzt aus", type: "toggle", default: true, hint: "üblich" },
    { key: "unterOnUnter", showIf: APP, group: "Hausregeln", label: "Bube auf Bube erlaubt", type: "toggle", default: false, hint: "im deutschen Blatt: Unter auf Unter" },
    { key: "reverse9", showIf: APP, group: "Hausregeln", label: "9: Richtungswechsel", type: "toggle", default: false },
    { key: "againA", showIf: APP, group: "Hausregeln", label: "Ass: nochmal legen", type: "toggle", default: false },
    { key: "autoPass", label: "Nach dem Ziehen automatisch weiter", type: "toggle", default: false, hint: "passt die gezogene Karte nicht, ist sofort der Nächste dran – sonst siehst du sie erst und tippst auf Passen", group: "Ablauf", inGame: true, showIf: APP },
    { key: "mau", showIf: APP, group: "Hausregeln", label: "„Mau“ sagen", type: "toggle", default: true, hint: "üblich – vor der vorletzten Karte, sonst eine Strafkarte" },
  ],
  /** Es muss nach dem Austeilen genug zum Ziehen bleiben */
  playerLimits: (o) => {
    const r = rulesOf(o);
    const size = DECKS[r.deck].suits.length * DECKS[r.deck].ranks.length;
    return { min: 2, max: Math.min(8, Math.floor((size - 7) / r.hand)) };
  },
  setup,
  apply,
  actionKind: (a) => (a.type === "play" || a.type === "draw" || a.type === "pass" ? "turn" : isPadAction(a) ? "host" : null),
  currentPlayerId: (s) => (s.winnerId ? null : s.curId),
  isOver: (s) => s.winnerId !== null,
  results: (s, ctx) => ctx.players.map((p) => ({ id: p.id, won: p.id === s.winnerId, ...(s.pad ? { score: s.pad.scores[p.id] ?? 0 } : {}) })),
  skipLabel: (s, ctx) => {
    if (s.mode === "table") return null;
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
    if (s.pad) { padRemove(s.pad, id); return s; }
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
