/**
 * Skip-Bo – Karten 1 bis 12 der Reihe nach auf vier gemeinsame Ablagestapel legen; wer zuerst seinen Vorratsstapel los ist, gewinnt.
 * Zwei Varianten:
 *  - „app“: Karten in der App (online jeder am eigenen Handy, lokal mit Sichtschutz beim Weitergeben).
 *  - „table“: Ihr spielt mit echten Karten, die App ist der Punkteblock (Sieger: 25 + 5 je Vorratskarte der anderen).
 * Sichtbar für alle: oberste Vorratskarte, eigene Ablagen, Aufbaustapel. Geheim: Hände, Vorrat darunter, Nachziehstapel.
 */
import { shuffle } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

/** 1–12, 0 = Skip-Bo (Joker) */
export type SbCard = number;
export const JOKER = 0;
export type Mode = "app" | "table";
export type Source = { from: "hand"; card: SbCard } | { from: "stock" } | { from: "discard"; i: number };

export interface SbState {
  v: 1;
  mode: Mode;
  round: number;
  scores: Record<string, number>;
  phase: "play" | "roundEnd" | "over" | "enter";
  /** Vorrat je Spieler, oberste Karte zuletzt (view: nur die oberste) */
  stocks: Record<string, SbCard[]>;
  stockCounts: Record<string, number>;
  hands: Record<string, SbCard[]>;
  handCounts: Record<string, number>;
  /** vier eigene Ablagen je Spieler, offen */
  discards: Record<string, SbCard[][]>;
  /** vier gemeinsame Aufbaustapel */
  builds: SbCard[][];
  pile: SbCard[];
  pileCount: number;
  /** fertige Aufbaustapel, kommen gemischt zurück, wenn der Nachziehstapel leer ist */
  done: SbCard[];
  curId: string | null;
  roundWinner: string | null;
  lastRound: { winner: string; points: number } | null;
  n: number;
  log: string[];
  entries: Record<string, number | null>;
  tableWinner: string | null;
}

export type SbAction =
  | ({ type: "play"; to: number } & Source)
  | { type: "discard"; card: SbCard; to: number }
  | { type: "nextRound" }
  | { type: "enter"; player?: string; points: number | null }
  | { type: "setWinner"; player: string | null }
  | { type: "finishRound" };

interface Rules { mode: Mode; target: number; stock: number }
export function stockSize(o: Options, players: number): number {
  const n = Number(o.stock);
  return n >= 5 && n <= 30 ? n : players <= 4 ? 30 : 20;
}
export function rulesOf(o: Options, players: number): Rules {
  return {
    mode: o.mode === "table" ? "table" : "app",
    target: o.target === "500" ? 500 : 0,
    stock: stockSize(o, players),
  };
}

const MAX_LOG = 50;
const HAND = 5;
export const cardName = (c: SbCard) => (c === JOKER ? "Skip-Bo" : String(c));
/** Wert, der als Nächstes auf den Aufbaustapel gehört */
export const needs = (b: SbCard[]) => b.length + 1;
export const topOf = <T,>(xs: T[]): T | undefined => xs[xs.length - 1];

/** 162 Karten: je 12× die Zahlen 1–12, dazu 18 Skip-Bo */
export function buildDeck(): SbCard[] {
  const d: SbCard[] = [];
  for (let v = 1; v <= 12; v++) for (let i = 0; i < 12; i++) d.push(v);
  for (let i = 0; i < 18; i++) d.push(JOKER);
  return d;
}

const sortHand = (h: SbCard[]) => h.slice().sort((a, b) => (a === JOKER ? 99 : a) - (b === JOKER ? 99 : b));
const nameOf = (ctx: GameContext, id: string | null) => ctx.players.find((p) => p.id === id)?.name ?? "?";

function draw(s: SbState, id: string, n: number) {
  const h = s.hands[id] ?? [];
  for (let i = 0; i < n; i++) {
    if (!s.pile.length && s.done.length) { s.pile = shuffle(s.done); s.done = []; s.log.push("Fertige Stapel werden neu gemischt"); }
    const c = s.pile.pop();
    if (c === undefined) break;
    h.push(c);
  }
  s.hands[id] = sortHand(h);
}

/** Zugbeginn: Hand auf fünf auffüllen */
function beginTurn(s: SbState, id: string | null) {
  s.curId = id;
  if (id && s.hands[id]) draw(s, id, HAND - s.hands[id].length);
}

function sync(s: SbState) {
  s.stockCounts = Object.fromEntries(Object.entries(s.stocks).map(([id, st]) => [id, st.length]));
  s.handCounts = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length]));
  s.pileCount = s.pile.length;
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

function deal(s: SbState, ctx: GameContext, starter: string | null) {
  const r = rulesOf(ctx.options, ctx.players.length);
  s.pile = shuffle(buildDeck());
  s.done = [];
  s.builds = [[], [], [], []];
  s.stocks = {}; s.hands = {}; s.discards = {};
  for (const p of ctx.players) {
    s.stocks[p.id] = s.pile.splice(s.pile.length - r.stock, r.stock);
    s.hands[p.id] = [];
    s.discards[p.id] = [[], [], [], []];
  }
  s.roundWinner = null;
  s.phase = "play";
  beginTurn(s, starter && ctx.players.some((p) => p.id === starter) ? starter : ctx.players[0]?.id ?? null);
}

function setup(ctx: GameContext): SbState {
  const r = rulesOf(ctx.options, ctx.players.length);
  const s: SbState = {
    v: 1, mode: r.mode, round: 1, scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])), phase: "play",
    stocks: {}, stockCounts: {}, hands: {}, handCounts: {}, discards: {}, builds: [[], [], [], []], pile: [], pileCount: 0, done: [],
    curId: null, roundWinner: null, lastRound: null, n: 0, log: [], entries: {}, tableWinner: null,
  };
  if (r.mode === "table") { s.phase = "enter"; s.entries = Object.fromEntries(ctx.players.map((p) => [p.id, null])); }
  else deal(s, ctx, null);
  sync(s);
  return s;
}

function winRound(s: SbState, ctx: GameContext, winner: string, points: number) {
  const r = rulesOf(ctx.options, ctx.players.length);
  s.scores[winner] = (s.scores[winner] ?? 0) + points;
  s.roundWinner = winner;
  s.lastRound = { winner, points };
  s.log.push(`${nameOf(ctx, winner)} gewinnt Runde ${s.round}${r.target ? ` (+${points})` : ""}`);
  s.phase = r.target === 0 || s.scores[winner] >= r.target ? "over" : "roundEnd";
}

/** Punkte für den Rundensieger: 25 + 5 je Karte, die in den anderen Vorräten übrig ist */
const roundPoints = (s: SbState, ctx: GameContext, winner: string) =>
  25 + 5 * ctx.players.reduce((t, p) => t + (p.id === winner ? 0 : s.stocks[p.id]?.length ?? 0), 0);

/** Darf `card` auf Aufbaustapel `b`? */
export const fits = (b: SbCard[], card: SbCard) => card === JOKER || card === needs(b);

function apply(prev: SbState, a: SbAction, ctx: GameContext): SbState {
  const s = structuredClone(prev);
  const actor = ctx.actorId;
  const isHost = actor === null || actor === ctx.hostId;
  if (s.mode === "table") return applyTable(s, a, ctx, isHost);

  if (a.type === "nextRound") {
    if (s.phase !== "roundEnd") throw new GameError("Die Runde läuft noch.");
    s.round++;
    deal(s, ctx, s.roundWinner);
    sync(s);
    return s;
  }
  if (s.phase !== "play") throw new GameError("Die Runde ist vorbei.");
  const me = s.curId;
  if (!me || !s.hands[me]) throw new GameError("Es ist niemand am Zug.");
  const hand = s.hands[me];

  switch (a.type) {
    case "play": {
      const b = s.builds[a.to];
      if (!b) throw new GameError("Diesen Stapel gibt es nicht.");
      let card: SbCard | undefined;
      if (a.from === "hand") card = hand.includes(a.card) ? a.card : undefined;
      else if (a.from === "stock") card = topOf(s.stocks[me]);
      else if (a.from === "discard") card = topOf(s.discards[me]?.[a.i] ?? []);
      if (card === undefined) throw new GameError("Diese Karte hast du nicht.");
      if (!fits(b, card)) throw new GameError(`Auf diesen Stapel gehört eine ${needs(b)}.`);
      if (a.from === "hand") hand.splice(hand.indexOf(card), 1);
      else if (a.from === "stock") s.stocks[me].pop();
      else s.discards[me][a.i].pop();
      b.push(card);
      s.log.push(`${nameOf(ctx, me)} legt ${card === JOKER ? "Skip-Bo" : card} auf Stapel ${a.to + 1}${a.from === "stock" ? " (Vorrat)" : ""}`);
      if (b.length === 12) {
        s.done.push(...b);
        s.builds[a.to] = [];
        s.log.push(`${nameOf(ctx, me)} macht einen Stapel voll`);
      }
      if (s.stocks[me].length === 0) {
        winRound(s, ctx, me, roundPoints(s, ctx, me));
        sync(s);
        return s;
      }
      // Hand leer gespielt: fünf neue Karten, weiterspielen
      if (hand.length === 0) draw(s, me, HAND);
      sync(s);
      return s;
    }
    case "discard": {
      const d = s.discards[me]?.[a.to];
      if (!d) throw new GameError("Diese Ablage gibt es nicht.");
      const i = hand.indexOf(a.card);
      if (i < 0) {
        // Nichts mehr auf der Hand und nichts zu ziehen: Zug einfach beenden
        if (hand.length) throw new GameError("Diese Karte hast du nicht.");
      } else {
        hand.splice(i, 1);
        d.push(a.card);
        s.log.push(`${nameOf(ctx, me)} legt ${a.card === JOKER ? "Skip-Bo" : a.card} ab – Zug vorbei`);
      }
      s.n++;
      beginTurn(s, nextPlayerId(ctx.players, me));
      sync(s);
      return s;
    }
    default:
      throw new GameError("Das geht nur mit echten Karten.");
  }
}

/** Punkteblock: Sieger antippen, die anderen tragen ihre übrigen Vorratskarten ein */
function applyTable(s: SbState, a: SbAction, ctx: GameContext, isHost: boolean): SbState {
  const actor = ctx.actorId;
  if (s.phase === "over") throw new GameError("Die Partie ist vorbei.");
  switch (a.type) {
    case "enter": {
      const who = a.player ?? actor;
      if (!who || !ctx.players.some((p) => p.id === who)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (actor !== null && who !== actor && !isHost) throw new GameError("Trag nur deine eigenen Karten ein.");
      if (a.points !== null && (!Number.isInteger(a.points) || a.points < 0 || a.points > 30)) throw new GameError("Zwischen 0 und 30 Karten.");
      s.entries[who] = a.points;
      return s;
    }
    case "setWinner": {
      if (a.player !== null && !ctx.players.some((p) => p.id === a.player)) throw new GameError("Diesen Spieler gibt es nicht.");
      s.tableWinner = a.player;
      if (a.player) s.entries[a.player] = 0;
      return s;
    }
    case "finishRound": {
      if (!isHost) throw new GameError("Die Runde schließt der Host ab.");
      const w = s.tableWinner;
      if (!w) throw new GameError("Wer hat die Runde gewonnen?");
      const missing = ctx.players.filter((p) => p.id !== w && (s.entries[p.id] === null || s.entries[p.id] === undefined));
      if (missing.length) throw new GameError(`Es fehlen noch Karten: ${missing.map((p) => p.name).join(", ")}.`);
      const left = ctx.players.reduce((t, p) => t + (p.id === w ? 0 : s.entries[p.id] ?? 0), 0);
      winRound(s, ctx, w, 25 + 5 * left);
      if ((s.phase as SbState["phase"]) !== "over") { s.phase = "enter"; s.round++; s.entries = Object.fromEntries(ctx.players.map((p) => [p.id, null])); s.tableWinner = null; }
      return s;
    }
    default:
      throw new GameError("Mit echten Karten tragt ihr nur die Punkte ein.");
  }
}

export function leaders(s: SbState, players: Player[]): string[] {
  const best = Math.max(...players.map((p) => s.scores[p.id] ?? 0));
  return players.filter((p) => (s.scores[p.id] ?? 0) === best).map((p) => p.id);
}

export const skipbo: GameLogic<SbState, SbAction> = {
  info: {
    id: "skipbo",
    name: "Skip-Bo",
    tagline: "Von 1 bis 12 aufbauen – wer zuerst seinen Vorrat los ist, gewinnt.",
    category: "Karten",
    minPlayers: 2,
    maxPlayers: 6,
    duration: "20–45 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  settings: [
    {
      key: "mode", label: "Karten", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "App mischt und verteilt" },
        { value: "table", label: "Echte Karten", hint: "App ist der Punkteblock" },
      ],
    },
    {
      key: "target", label: "Spieldauer", type: "choice", default: "round",
      choices: [
        { value: "round", label: "Eine Runde", hint: "wer zuerst den Vorrat los ist" },
        { value: "500", label: "Bis 500", hint: "25 + 5 je Restkarte" },
      ],
    },
    {
      key: "stock", label: "Vorrat", type: "choice", default: "auto",
      choices: [
        { value: "auto", label: "Normal", hint: "30, ab 5 Spielern 20" },
        { value: "20", label: "20 Karten" },
        { value: "10", label: "10 Karten", hint: "kurze Runde" },
      ],
    },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "play" || a.type === "discard" ? "turn" : "player"),
  currentPlayerId: (s) => (s.phase === "play" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const win = rulesOf(ctx.options, ctx.players.length).target === 0 && s.roundWinner ? [s.roundWinner] : leaders(s, ctx.players);
    return ctx.players.map((p) => ({ id: p.id, won: win.includes(p.id), score: s.scores[p.id] ?? 0 }));
  },
  skipLabel: (s, ctx) => (s.phase === "play" && s.curId ? `Zug von ${nameOf(ctx, s.curId)} überspringen` : null),
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase !== "play" || !s.curId) return s;
    s.log.push(`Zug von ${nameOf(ctx, s.curId)} übersprungen`);
    s.n++;
    beginTurn(s, nextPlayerId(ctx.players, s.curId));
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    // Karten des Gehenden kommen unter den Nachziehstapel
    if (s.hands[id]) s.pile.unshift(...s.hands[id], ...(s.stocks[id] ?? []), ...(s.discards[id] ?? []).flat());
    delete s.hands[id]; delete s.stocks[id]; delete s.discards[id];
    delete s.entries[id];
    if (s.tableWinner === id) s.tableWinner = null;
    const rest = ctx.players.filter((p) => p.id !== id);
    if (s.curId === id) beginTurn(s, nextPlayerId(ctx.players, id));
    if (s.phase === "play" && rest.length === 1) winRound(s, { ...ctx, players: rest }, rest[0].id, 0);
    sync(s);
    return s;
  },
  view: (s, viewer) => (viewer === null ? s : {
    ...s,
    pile: [],
    done: [],
    stocks: Object.fromEntries(Object.entries(s.stocks).map(([id, st]) => [id, st.length ? [st[st.length - 1]] : []])),
    hands: viewer in s.hands ? { [viewer]: s.hands[viewer] } : {},
  }),
};
