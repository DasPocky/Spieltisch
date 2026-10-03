/**
 * Fischen (Quartett) mit französischem oder deutschem Blatt – läuft im Browser (lokal) und im Durable Object (online).
 * Wer dran ist, fragt einen Mitspieler nach einem Wert, den er selbst auf der Hand hat.
 * Hat der ihn, bekommt man alle Karten dieses Werts und darf weiterfragen – sonst heißt es „Geh fischen!“.
 * Vier Gleiche werden sofort als Quartett abgelegt. Wer am Ende die meisten Quartette hat, gewinnt.
 */
import { deckOf, deckSetting, DECKS, drawCards, rankOf, shuffledDeck, sortByRank, type Card, type DeckId, type Rank } from "../../cards/deck";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Player } from "../../platform/types";

export interface FischenEvent {
  askerId: string;
  targetId: string;
  rank: Rank;
  /** so viele Karten hat der Gefragte abgegeben (0 = „Geh fischen!“) */
  got: number;
  /** beim Fischen genau den gefragten Wert gezogen */
  lucky?: boolean;
  /** neu gelegtes Quartett */
  quartet?: Rank;
}

export interface FischenState {
  v: 1;
  deck: DeckId;
  hands: Record<string, Card[]>;
  counts: Record<string, number>;
  pile: Card[];
  pileCount: number;
  quartets: Record<string, Rank[]>;
  curId: string | null;
  /** die letzten Fragen – öffentlich, jeder darf mitdenken */
  events: FischenEvent[];
  /** zuletzt gefischte Karte des Spielers am Zug (nur für ihn sichtbar) */
  fished: Card | null;
  finished: boolean;
  n: number;
  /** Echte Karten auf dem Tisch – die App führt nur Zug, Quartette und Wertung */
  table?: boolean;
  /** Echte Karten: gelegte Quartette in Reihenfolge (zum Zurücknehmen) */
  laid?: { owner: string; rank: Rank }[];
}

export type FischenAction =
  | { type: "ask"; target: string; rank: Rank }
  /** Echte Karten: Quartett eintragen */
  | { type: "quartet"; rank: Rank; owner: string }
  /** Echte Karten: „Geh fischen!“ – der Zug geht weiter (an den Gefragten, falls so eingestellt) */
  | { type: "fish"; target?: string }
  /** Echte Karten: letztes Quartett zurücknehmen */
  | { type: "undo" };

const MAX_EVENTS = 30;

/** 2–3 Spieler bekommen 7 Karten, ab 4 Spielern 5 */
export const handSize = (players: number) => (players <= 3 ? 7 : 5);

/** Ränge, nach denen gefragt werden darf (die man selbst hat) */
export const askableRanks = (s: FischenState, hand: Card[]): Rank[] => DECKS[s.deck].ranks.filter((r) => hand.some((c) => rankOf(c) === r));

/** Legt vollständige Quartette ab und gibt sie zurück */
function layQuartets(s: FischenState, id: string): Rank[] {
  const laid: Rank[] = [];
  for (const r of DECKS[s.deck].ranks) {
    const same = s.hands[id].filter((c) => rankOf(c) === r);
    if (same.length === 4) {
      s.hands[id] = s.hands[id].filter((c) => rankOf(c) !== r);
      (s.quartets[id] ??= []).push(r);
      laid.push(r);
    }
  }
  return laid;
}

function sync(s: FischenState) {
  s.counts = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length]));
  s.pileCount = s.pile.length;
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
}

const totalQuartets = (s: FischenState) => Object.values(s.quartets).reduce((n, q) => n + q.length, 0);

/** Wer ist nach „Geh fischen!“ dran? Standard der linke Nachbar, als Variante der Gefragte. */
export const askedGoesNext = (options: GameContext["options"]) => options.afterFish === "asked";

/** Echte Karten: Werte, die noch nicht als Quartett liegen */
export const openRanks = (s: FischenState): Rank[] => {
  const done = new Set(Object.values(s.quartets).flat());
  return DECKS[s.deck].ranks.filter((r) => !done.has(r));
};

/**
 * Sorgt dafür, dass der Spieler am Zug fragen kann: Mit leerer Hand zieht er eine Karte.
 * Kann er gar nicht (Stapel leer), ist der Nächste dran. Sind alle Quartette gelegt, ist Schluss.
 */
function ensurePlayable(s: FischenState, players: Player[]) {
  for (let i = 0; i <= players.length; i++) {
    if (totalQuartets(s) === DECKS[s.deck].ranks.length) { s.finished = true; return; }
    const id = s.curId;
    if (id && s.hands[id]) {
      if (!s.hands[id].length && s.pile.length) {
        s.hands[id] = sortByRank([...s.hands[id], ...drawCards(s.pile, 1, () => [])], DECKS[s.deck]);
        layQuartets(s, id);
      }
      if (s.hands[id].length && players.some((p) => p.id !== id && (s.hands[p.id]?.length ?? 0) > 0)) return;
    }
    s.curId = nextPlayerId(players, s.curId);
  }
  s.finished = true;
}

function setup(ctx: GameContext): FischenState {
  const deck = deckOf(ctx.options, "fr52");
  if (ctx.options.cards === "table") {
    return {
      v: 1, deck: deck.id, hands: {}, counts: {}, pile: [], pileCount: 0, curId: ctx.players[0]?.id ?? null,
      quartets: Object.fromEntries(ctx.players.map((p) => [p.id, []])), events: [], fished: null, finished: false, n: 0, table: true, laid: [],
    };
  }
  const pile = shuffledDeck(deck);
  const n = handSize(ctx.players.length);
  const s: FischenState = {
    v: 1, deck: deck.id, hands: {}, counts: {}, pile, pileCount: 0, quartets: {}, curId: ctx.players[0]?.id ?? null,
    events: [], fished: null, finished: false, n: 0,
  };
  for (const p of ctx.players) {
    s.hands[p.id] = sortByRank(pile.splice(pile.length - n, n), deck);
    s.quartets[p.id] = [];
    layQuartets(s, p.id);
  }
  ensurePlayable(s, ctx.players);
  sync(s);
  return s;
}

/** Echte Karten: Quartette eintragen, Zug weitergeben, zurücknehmen */
function applyTable(prev: FischenState, a: FischenAction, ctx: GameContext): FischenState {
  const s = structuredClone(prev);
  s.laid ??= [];
  s.n++;
  switch (a.type) {
    case "quartet": {
      if (!ctx.players.some((p) => p.id === a.owner)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (!openRanks(s).includes(a.rank)) throw new GameError("Dieses Quartett liegt schon.");
      (s.quartets[a.owner] ??= []).push(a.rank);
      s.laid.push({ owner: a.owner, rank: a.rank });
      if (!openRanks(s).length) s.finished = true;
      return s;
    }
    case "fish": {
      const target = a.target && a.target !== s.curId && ctx.players.some((p) => p.id === a.target) ? a.target : null;
      s.curId = askedGoesNext(ctx.options) && target ? target : nextPlayerId(ctx.players, s.curId);
      return s;
    }
    case "undo": {
      const last = s.laid.pop();
      if (!last) throw new GameError("Es gibt nichts zum Zurücknehmen.");
      const q = s.quartets[last.owner] ?? [];
      const i = q.lastIndexOf(last.rank);
      if (i >= 0) q.splice(i, 1);
      s.finished = false;
      return s;
    }
    default:
      throw new GameError("Mit echten Karten fragt ihr am Tisch – die App zählt nur die Quartette.");
  }
}

function apply(prev: FischenState, a: FischenAction, ctx: GameContext): FischenState {
  if (prev.table) return applyTable(prev, a, ctx);
  if (a.type !== "ask") throw new GameError("Das geht nur mit echten Karten.");
  const s = structuredClone(prev);
  const me = s.curId;
  if (!me || !s.hands[me]) throw new GameError("Es ist niemand am Zug.");
  if (a.target === me || !s.hands[a.target]) throw new GameError("Frag einen Mitspieler.");
  if (!s.hands[a.target].length) throw new GameError("Diese Person hat keine Karten mehr.");
  if (!DECKS[s.deck].ranks.includes(a.rank)) throw new GameError("Diesen Wert gibt es nicht.");
  if (!s.hands[me].some((c) => rankOf(c) === a.rank)) throw new GameError(`Du darfst nur nach Werten fragen, die du selbst hast.`);

  s.fished = null;
  s.n++;
  const given = s.hands[a.target].filter((c) => rankOf(c) === a.rank);
  const ev: FischenEvent = { askerId: me, targetId: a.target, rank: a.rank, got: given.length };
  let again: boolean;
  if (given.length) {
    s.hands[a.target] = s.hands[a.target].filter((c) => rankOf(c) !== a.rank);
    s.hands[me] = sortByRank([...s.hands[me], ...given], DECKS[s.deck]);
    again = true;
  } else {
    // Geh fischen!
    const [card] = drawCards(s.pile, 1, () => []);
    if (card) {
      s.hands[me] = sortByRank([...s.hands[me], card], DECKS[s.deck]);
      s.fished = card;
      ev.lucky = rankOf(card) === a.rank;
    }
    again = !!ev.lucky && ctx.options.luckyAgain !== false;
  }
  const laid = layQuartets(s, me);
  if (laid.length) ev.quartet = laid[laid.length - 1];
  s.events.push(ev);
  // Standard: der linke Nachbar – als Variante macht der Gefragte weiter (wenn er noch Karten hat)
  if (!again) s.curId = askedGoesNext(ctx.options) && s.hands[a.target]?.length ? a.target : nextPlayerId(ctx.players, me);
  ensurePlayable(s, ctx.players);
  sync(s);
  return s;
}

/** Wer hat die meisten Quartette? */
export function leaders(s: FischenState, players: Player[]): string[] {
  const best = Math.max(...players.map((p) => s.quartets[p.id]?.length ?? 0));
  return players.filter((p) => (s.quartets[p.id]?.length ?? 0) === best).map((p) => p.id);
}

export const fischen: GameLogic<FischenState, FischenAction> = {
  info: {
    id: "fischen",
    name: "Fischen",
    tagline: "Frag nach Karten, die du selbst hast, und sammle Quartette – oder geh fischen!",
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
      key: "cards", label: "Karten", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "App mischt und verteilt" },
        { value: "table", label: "🃏 Echte Karten", hint: "App zählt Quartette" },
      ],
    },
    deckSetting("fr52"),
    {
      key: "afterFish", label: "Nach „Geh fischen!“ ist dran", type: "choice", default: "next", inGame: true, group: "Hausregeln",
      choices: [
        { value: "next", label: "Der Nächste", hint: "Original – im Uhrzeigersinn" },
        { value: "asked", label: "Der Gefragte", hint: "wer „Nein“ sagte" },
      ],
    },
    { key: "luckyAgain", label: "Glück beim Fischen: nochmal", type: "toggle", default: true, hint: "Original – wer genau den gefragten Wert zieht, ist nochmal dran", group: "Hausregeln", showIf: (o) => o.cards !== "table" },
  ],
  /** 32 Karten reichen für 6, 52 Karten für 8 Spieler */
  playerLimits: (o) => ({ min: 2, max: deckOf(o, "fr52").ranks.length > 8 ? 8 : 6 }),
  setup,
  apply,
  actionKind: (a) => (["ask", "quartet", "fish", "undo"].includes(a.type) ? "turn" : null),
  currentPlayerId: (s) => (s.finished ? null : s.curId),
  isOver: (s) => s.finished,
  results: (s, ctx) => {
    const win = leaders(s, ctx.players);
    return ctx.players.map((p) => ({ id: p.id, won: win.includes(p.id), score: s.quartets[p.id]?.length ?? 0 }));
  },
  skipLabel: (s, ctx) => {
    const cur = ctx.players.find((p) => p.id === s.curId);
    return cur && !s.finished ? `Zug von ${cur.name} überspringen` : null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    s.fished = null;
    s.curId = nextPlayerId(ctx.players, s.curId);
    s.n++;
    if (!s.table) ensurePlayable(s, ctx.players);
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (s.table) {
      // Seine Quartette werden wieder frei, damit die Partie trotzdem enden kann
      delete s.quartets[id];
      s.laid = (s.laid ?? []).filter((x) => x.owner !== id);
      if (s.curId === id) s.curId = nextPlayerId(ctx.players, id);
      if (ctx.players.filter((p) => p.id !== id).length < 2) s.finished = true;
      return s;
    }
    s.pile.unshift(...(s.hands[id] ?? []));
    delete s.hands[id];
    const rest = ctx.players.filter((p) => p.id !== id);
    if (s.curId === id) { s.curId = nextPlayerId(ctx.players, id); s.fished = null; }
    if (rest.length < 2) s.finished = true;
    else ensurePlayable(s, rest);
    sync(s);
    return s;
  },
  view: (s, viewer) => (viewer === null ? s : {
    ...s,
    pile: [],
    hands: viewer in s.hands ? { [viewer]: s.hands[viewer] } : {},
    fished: viewer === s.events.at(-1)?.askerId ? s.fished : null,
  }),
};
