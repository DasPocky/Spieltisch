/**
 * Fischen (Quartett) mit deutschem Blatt – läuft im Browser (lokal) und im Durable Object (online).
 * Wer dran ist, fragt einen Mitspieler nach einem Wert, den er selbst auf der Hand hat.
 * Hat der ihn, bekommt man alle Karten dieses Werts und darf weiterfragen – sonst heißt es „Geh fischen!“.
 * Vier Gleiche werden sofort als Quartett abgelegt. Wer am Ende die meisten Quartette hat, gewinnt.
 */
import { drawCards, rankOf, RANKS, shuffledDeck, sortHand, type Card, type Rank } from "../../cards/german";
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
}

export type FischenAction = { type: "ask"; target: string; rank: Rank };

const MAX_EVENTS = 30;

/** 2–3 Spieler bekommen 7 Karten, ab 4 Spielern 5 */
export const handSize = (players: number) => (players <= 3 ? 7 : 5);

/** Ränge, nach denen gefragt werden darf (die man selbst hat) */
export const askableRanks = (hand: Card[]): Rank[] => RANKS.filter((r) => hand.some((c) => rankOf(c) === r));

/** Legt vollständige Quartette ab und gibt sie zurück */
function layQuartets(s: FischenState, id: string): Rank[] {
  const laid: Rank[] = [];
  for (const r of RANKS) {
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

/**
 * Sorgt dafür, dass der Spieler am Zug fragen kann: Mit leerer Hand zieht er eine Karte.
 * Kann er gar nicht (Stapel leer), ist der Nächste dran. Sind alle Quartette gelegt, ist Schluss.
 */
function ensurePlayable(s: FischenState, players: Player[]) {
  for (let i = 0; i <= players.length; i++) {
    if (totalQuartets(s) === RANKS.length) { s.finished = true; return; }
    const id = s.curId;
    if (id && s.hands[id]) {
      if (!s.hands[id].length && s.pile.length) {
        s.hands[id] = sortHand([...s.hands[id], ...drawCards(s.pile, 1, () => [])]);
        layQuartets(s, id);
      }
      if (s.hands[id].length && players.some((p) => p.id !== id && (s.hands[p.id]?.length ?? 0) > 0)) return;
    }
    s.curId = nextPlayerId(players, s.curId);
  }
  s.finished = true;
}

function setup(ctx: GameContext): FischenState {
  const pile = shuffledDeck();
  const n = handSize(ctx.players.length);
  const s: FischenState = {
    v: 1, hands: {}, counts: {}, pile, pileCount: 0, quartets: {}, curId: ctx.players[0]?.id ?? null,
    events: [], fished: null, finished: false, n: 0,
  };
  for (const p of ctx.players) {
    s.hands[p.id] = sortHand(pile.splice(pile.length - n, n));
    s.quartets[p.id] = [];
    layQuartets(s, p.id);
  }
  ensurePlayable(s, ctx.players);
  sync(s);
  return s;
}

function apply(prev: FischenState, a: FischenAction, ctx: GameContext): FischenState {
  if (a.type !== "ask") throw new GameError("Unbekannte Aktion.");
  const s = structuredClone(prev);
  const me = s.curId;
  if (!me || !s.hands[me]) throw new GameError("Es ist niemand am Zug.");
  if (a.target === me || !s.hands[a.target]) throw new GameError("Frag einen Mitspieler.");
  if (!s.hands[a.target].length) throw new GameError("Diese Person hat keine Karten mehr.");
  if (!RANKS.includes(a.rank)) throw new GameError("Diesen Wert gibt es nicht.");
  if (!s.hands[me].some((c) => rankOf(c) === a.rank)) throw new GameError(`Du darfst nur nach Werten fragen, die du selbst hast.`);

  s.fished = null;
  s.n++;
  const given = s.hands[a.target].filter((c) => rankOf(c) === a.rank);
  const ev: FischenEvent = { askerId: me, targetId: a.target, rank: a.rank, got: given.length };
  let again: boolean;
  if (given.length) {
    s.hands[a.target] = s.hands[a.target].filter((c) => rankOf(c) !== a.rank);
    s.hands[me] = sortHand([...s.hands[me], ...given]);
    again = true;
  } else {
    // Geh fischen!
    const [card] = drawCards(s.pile, 1, () => []);
    if (card) {
      s.hands[me] = sortHand([...s.hands[me], card]);
      s.fished = card;
      ev.lucky = rankOf(card) === a.rank;
    }
    again = !!ev.lucky && ctx.options.luckyAgain !== false;
  }
  const laid = layQuartets(s, me);
  if (laid.length) ev.quartet = laid[laid.length - 1];
  s.events.push(ev);
  if (!again) s.curId = nextPlayerId(ctx.players, me);
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
    maxPlayers: 6,
    duration: "10–20 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  settings: [
    { key: "luckyAgain", label: "Glück beim Fischen: nochmal", type: "toggle", default: true, hint: "wer genau den gefragten Wert zieht, ist nochmal dran" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "ask" ? "turn" : null),
  currentPlayerId: (s) => (s.finished ? null : s.curId),
  isOver: (s) => s.finished,
  skipLabel: (s, ctx) => {
    const cur = ctx.players.find((p) => p.id === s.curId);
    return cur && !s.finished ? `Zug von ${cur.name} überspringen` : null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    s.fished = null;
    s.curId = nextPlayerId(ctx.players, s.curId);
    s.n++;
    ensurePlayable(s, ctx.players);
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
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
