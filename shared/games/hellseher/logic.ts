/**
 * Hellseher – Stichspiel mit Ansagen (nach dem bekannten Prinzip mit Zauberern und Narren).
 * 60 Karten: vier Farben 1–13, vier Zauberer (Z, schlagen alles) und vier Narren (N, verlieren immer).
 * Runde n: jeder bekommt n Karten. Danach sagt jeder an, wie viele Stiche er macht – genau getroffen gibt
 * 20 + 10 je Stich, sonst −10 je Stich Abweichung.
 *
 * Zwei Varianten:
 *  - „app“: Karten in der App (online jeder am eigenen Handy, lokal mit Sichtschutz beim Weitergeben).
 *  - „table“: echte Karten, die App ist der Block (Ansagen und Stiche eintippen, sie rechnet).
 */
import { shuffle } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export type Suit = "r" | "b" | "g" | "y";
/** Karte als Text: "r-7", "y-13", Zauberer "z-1".."z-4", Narren "n-1".."n-4" */
export type HsCard = string;
export type Mode = "app" | "table";

export const SUITS: Suit[] = ["b", "r", "g", "y"];
export const SUIT_NAME: Record<Suit, string> = { r: "Rot", b: "Blau", g: "Grün", y: "Gelb" };

export const isWizard = (c: HsCard) => c.startsWith("z-");
export const isFool = (c: HsCard) => c.startsWith("n-");
export const suitOf = (c: HsCard): Suit | null => (isWizard(c) || isFool(c) ? null : (c[0] as Suit));
export const rankOf = (c: HsCard) => (isWizard(c) || isFool(c) ? 0 : Number(c.slice(2)));
export const cardLabel = (c: HsCard) => (isWizard(c) ? "Zauberer" : isFool(c) ? "Narr" : `${SUIT_NAME[suitOf(c)!]} ${rankOf(c)}`);

/** 60 Karten */
export function buildDeck(): HsCard[] {
  const d: HsCard[] = [];
  for (const s of SUITS) for (let v = 1; v <= 13; v++) d.push(`${s}-${v}`);
  for (let i = 1; i <= 4; i++) d.push(`z-${i}`, `n-${i}`);
  return d;
}

const ORDER = (c: HsCard) => (isWizard(c) ? 100 : isFool(c) ? -1 : SUITS.indexOf(suitOf(c)!) * 20 + rankOf(c));
const sortHand = (h: HsCard[]) => h.slice().sort((a, b) => ORDER(a) - ORDER(b));

export interface Play { id: string; card: HsCard }
export interface RoundRecord {
  round: number;
  cards: number;
  dealerId: string | null;
  bids: Record<string, number>;
  tricks: Record<string, number>;
  points: Record<string, number>;
}

export interface HsState {
  v: 1;
  mode: Mode;
  /** Hausregel verdeckte Ansage */
  secret: boolean;
  round: number;
  /** Rundenzahl der Partie (Original: 60 / Spielerzahl) */
  totalRounds: number;
  phase: "trump" | "bid" | "play" | "roundEnd" | "over" | "tableBid" | "tableTricks";
  dealerId: string | null;
  scores: Record<string, number>;
  // In der App
  hands: Record<string, HsCard[]>;
  counts: Record<string, number>;
  deck: HsCard[];
  deckCount: number;
  /** aufgedeckte Trumpfkarte (null: keine mehr übrig – letzte Runde) */
  trumpCard: HsCard | null;
  trump: Suit | null;
  /** Ansagen (null = noch offen; bei verdeckter Ansage sehen andere nur `bidIn`) */
  bids: Record<string, number | null>;
  bidIn: Record<string, boolean>;
  tricks: Record<string, number>;
  trick: Play[];
  lastTrick: { plays: Play[]; winner: string } | null;
  curId: string | null;
  /** Mit echten Karten: erreichte Stiche der Runde */
  taken: Record<string, number | null>;
  history: RoundRecord[];
  log: string[];
  n: number;
}

export type HsAction =
  | { type: "trump"; suit: Suit }
  | { type: "bid"; bid: number }
  | { type: "secretBid"; player?: string; bid: number }
  | { type: "play"; card: HsCard }
  | { type: "nextRound" }
  // echte Karten
  | { type: "tBid"; player?: string; bid: number | null }
  | { type: "tTricks"; player?: string; n: number | null }
  | { type: "tBidsDone" }
  | { type: "tBack" }
  | { type: "tFinish" };

interface Rules { mode: Mode; noEven: boolean; secret: boolean; length: "all" | "10" | "half" }
export function rulesOf(o: Options): Rules {
  const secret = o.secret === true;
  return {
    mode: o.mode === "table" ? "table" : "app",
    secret,
    // Bei verdeckter Ansage gibt es keinen Letzten, der sie aufgehen lassen könnte
    noEven: o.noEven === true && !secret,
    length: o.length === "10" || o.length === "half" ? o.length : "all",
  };
}

/** Rundenzahl: Original 60 / Spielerzahl (3: 20, 4: 15, 5: 12, 6: 10) – kürzer per Einstellung */
export function roundsFor(n: number, o: Options): number {
  const full = Math.floor(60 / Math.max(1, n));
  const r = rulesOf(o);
  return Math.max(1, r.length === "10" ? Math.min(10, full) : r.length === "half" ? Math.ceil(full / 2) : full);
}

const MAX_LOG = 60;
const nameOf = (ctx: GameContext | { players: Player[] }, id: string | null | undefined) => ctx.players.find((p) => p.id === id)?.name ?? "?";

/** Reihenfolge ab links vom Geber (wer ansagt und den ersten Stich spielt) */
export function orderFrom(players: Player[], dealerId: string | null): string[] {
  const i = players.findIndex((p) => p.id === dealerId);
  return players.map((_, k) => players[(i + 1 + k) % players.length].id);
}

/** Welche Ansage wäre verboten (Hausregel „nicht aufgehen“)? Nur für den Letzten in der Reihe. */
export function forbiddenBid(s: HsState, players: Player[], o: Options, who: string): number | null {
  if (!rulesOf(o).noEven) return null;
  const order = orderFrom(players, s.dealerId);
  if (order[order.length - 1] !== who) return null;
  if (order.slice(0, -1).some((id) => s.bids[id] === null || s.bids[id] === undefined)) return null;
  const sum = order.slice(0, -1).reduce((t, id) => t + (s.bids[id] ?? 0), 0);
  const f = s.round - sum;
  return f >= 0 ? f : null;
}

/** Farbe, die bedient werden muss (null: frei) */
export function leadSuit(trick: Play[]): Suit | null {
  for (const p of trick) {
    if (isFool(p.card)) continue;
    if (isWizard(p.card)) return null;
    return suitOf(p.card);
  }
  return null;
}

/** Darf diese Karte gerade gespielt werden? */
export function canPlay(trick: Play[], hand: HsCard[], card: HsCard): boolean {
  if (!hand.includes(card)) return false;
  if (isWizard(card) || isFool(card)) return true;
  const lead = leadSuit(trick);
  if (!lead) return true;
  return suitOf(card) === lead || !hand.some((c) => suitOf(c) === lead);
}

/** Wer gewinnt den Stich? Erster Zauberer, sonst höchster Trumpf, sonst höchste angespielte Farbe; nur Narren: der erste */
export function trickWinner(trick: Play[], trump: Suit | null): string {
  const wiz = trick.find((p) => isWizard(p.card));
  if (wiz) return wiz.id;
  const best = (suit: Suit | null) => {
    if (!suit) return null;
    const xs = trick.filter((p) => suitOf(p.card) === suit);
    return xs.length ? xs.reduce((a, b) => (rankOf(b.card) > rankOf(a.card) ? b : a)) : null;
  };
  return (best(trump) ?? best(leadSuit(trick)) ?? trick[0]).id;
}

/** Punkte: genau getroffen 20 + 10 je Stich, sonst −10 je Stich Abweichung */
export const points = (bid: number, got: number) => (bid === got ? 20 + 10 * got : -10 * Math.abs(bid - got));

/**
 * Grobe Schätzung für die Spielhilfe: Zauberer zählen sicher, hohe Trümpfe fast, Dreizehner in Fehlfarben manchmal.
 * Nutzt nur die eigene Hand und den offenen Trumpf.
 */
export function estimateBid(hand: HsCard[], trump: Suit | null, players: number): number {
  let e = 0;
  const trumps = trump ? hand.filter((c) => suitOf(c) === trump).length : 0;
  for (const c of hand) {
    if (isWizard(c)) e += 1;
    else if (isFool(c)) continue;
    else if (trump && suitOf(c) === trump) e += rankOf(c) >= 11 ? 0.9 : rankOf(c) >= 8 ? 0.55 : trumps >= 3 ? 0.35 : 0.15;
    else if (rankOf(c) === 13) e += players <= 4 ? 0.6 : 0.45;
    else if (rankOf(c) === 12) e += players <= 3 ? 0.35 : 0.2;
  }
  return Math.min(hand.length, Math.round(e));
}

function sync(s: HsState) {
  s.counts = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length]));
  s.deckCount = s.deck.length;
  s.bidIn = Object.fromEntries(Object.entries(s.bids).map(([id, b]) => [id, b !== null && b !== undefined]));
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

/** Neue Runde austeilen (oder bei echten Karten die Eingabe vorbereiten) */
function deal(s: HsState, ctx: GameContext) {
  const r = rulesOf(ctx.options);
  const ids = ctx.players.map((p) => p.id);
  s.bids = Object.fromEntries(ids.map((id) => [id, null]));
  s.tricks = Object.fromEntries(ids.map((id) => [id, 0]));
  s.taken = Object.fromEntries(ids.map((id) => [id, null]));
  s.trick = [];
  s.lastTrick = null;
  if (s.mode === "table") {
    s.hands = {};
    s.deck = [];
    s.trumpCard = null;
    s.trump = null;
    s.curId = null;
    s.phase = "tableBid";
    return;
  }
  const deck = shuffle(buildDeck());
  s.hands = {};
  const order = orderFrom(ctx.players, s.dealerId);
  for (const id of order) s.hands[id] = sortHand(deck.splice(deck.length - s.round, s.round));
  s.trumpCard = deck.pop() ?? null;
  s.deck = deck;
  s.trump = s.trumpCard ? suitOf(s.trumpCard) : null;
  s.log.push(`Runde ${s.round}: ${nameOf(ctx, s.dealerId)} gibt ${s.round === 1 ? "1 Karte" : `${s.round} Karten`}`);
  if (!s.trumpCard) s.log.push("Keine Karte übrig – ohne Trumpf");
  else if (isFool(s.trumpCard)) s.log.push("Narr aufgedeckt – ohne Trumpf");
  else if (!isWizard(s.trumpCard)) s.log.push(`Trumpf: ${SUIT_NAME[s.trump!]}`);
  if (s.trumpCard && isWizard(s.trumpCard)) {
    // Zauberer aufgedeckt: der Geber sieht seine Karten und bestimmt den Trumpf
    s.phase = "trump";
    s.curId = s.dealerId;
    s.log.push(`Zauberer aufgedeckt – ${nameOf(ctx, s.dealerId)} wählt Trumpf`);
  } else startBidding(s, ctx, r.secret);
}

function startBidding(s: HsState, ctx: GameContext, secret: boolean) {
  s.phase = "bid";
  s.curId = secret ? null : orderFrom(ctx.players, s.dealerId)[0];
}

function setup(ctx: GameContext): HsState {
  const r = rulesOf(ctx.options);
  const ids = ctx.players.map((p) => p.id);
  const s: HsState = {
    v: 1, mode: r.mode, secret: r.secret, round: 1, totalRounds: roundsFor(ids.length, ctx.options), phase: "bid",
    // Der Letzte gibt zuerst – so sagt der Erste zuerst an und spielt aus
    dealerId: ids[ids.length - 1] ?? null,
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    hands: {}, counts: {}, deck: [], deckCount: 0, trumpCard: null, trump: null,
    bids: {}, bidIn: {}, tricks: {}, trick: [], lastTrick: null, curId: null, taken: {}, history: [], log: [], n: 0,
  };
  deal(s, ctx);
  sync(s);
  return s;
}

/** Runde werten und Verlauf anlegen */
function score(s: HsState, ctx: GameContext, got: Record<string, number>) {
  const rec: RoundRecord = { round: s.round, cards: s.round, dealerId: s.dealerId, bids: {}, tricks: {}, points: {} };
  for (const p of ctx.players) {
    const bid = s.bids[p.id] ?? 0;
    const n = got[p.id] ?? 0;
    const pts = points(bid, n);
    rec.bids[p.id] = bid;
    rec.tricks[p.id] = n;
    rec.points[p.id] = pts;
    s.scores[p.id] = (s.scores[p.id] ?? 0) + pts;
  }
  s.history.push(rec);
  const hit = ctx.players.filter((p) => rec.bids[p.id] === rec.tricks[p.id]).map((p) => p.name);
  s.log.push(`Runde ${s.round} gewertet${hit.length ? ` – getroffen: ${hit.join(", ")}` : " – keiner hat getroffen"}`);
}

function advance(s: HsState, ctx: GameContext) {
  if (s.round >= s.totalRounds) { s.phase = "over"; s.curId = null; return; }
  s.round++;
  s.dealerId = nextPlayerId(ctx.players, s.dealerId);
  deal(s, ctx);
}

function allBid(s: HsState, ctx: GameContext) {
  return ctx.players.every((p) => s.bids[p.id] !== null && s.bids[p.id] !== undefined);
}

function afterBid(s: HsState, ctx: GameContext) {
  if (allBid(s, ctx)) {
    const sum = ctx.players.reduce((t, p) => t + (s.bids[p.id] ?? 0), 0);
    s.log.push(`Angesagt: ${ctx.players.map((p) => `${p.name} ${s.bids[p.id]}`).join(", ")} (${sum} von ${s.round})`);
    s.phase = "play";
    s.curId = orderFrom(ctx.players, s.dealerId)[0];
  } else if (s.curId) {
    s.curId = nextPlayerId(ctx.players, s.curId);
  }
}

function checkBid(bid: unknown, s: HsState) {
  if (typeof bid !== "number" || !Number.isInteger(bid) || bid < 0 || bid > s.round) throw new GameError(`Ansage zwischen 0 und ${s.round}.`);
}

function playCard(s: HsState, ctx: GameContext, me: string, card: HsCard) {
  const hand = s.hands[me];
  hand.splice(hand.indexOf(card), 1);
  s.trick.push({ id: me, card });
  const active = ctx.players.filter((p) => s.hands[p.id]);
  if (s.trick.length < active.length) {
    s.curId = nextPlayerId(active, me);
    return;
  }
  const w = trickWinner(s.trick, s.trump);
  s.tricks[w] = (s.tricks[w] ?? 0) + 1;
  s.lastTrick = { plays: s.trick, winner: w };
  s.log.push(`${nameOf(ctx, w)} gewinnt den Stich (${cardLabel(s.trick.find((p) => p.id === w)!.card)})`);
  s.trick = [];
  s.curId = w;
  if (Object.values(s.hands).every((h) => h.length === 0)) {
    score(s, ctx, s.tricks);
    s.phase = "roundEnd";
    s.curId = null;
  }
}

function apply(prev: HsState, a: HsAction, ctx: GameContext): HsState {
  const s = structuredClone(prev);
  if (s.phase === "over") throw new GameError("Die Partie ist vorbei.");
  if (s.mode === "table") { applyTable(s, a, ctx); sync(s); return s; }
  const r = rulesOf(ctx.options);
  const actor = ctx.actorId;
  switch (a.type) {
    case "trump": {
      if (s.phase !== "trump") throw new GameError("Der Trumpf steht schon fest.");
      if (!SUITS.includes(a.suit)) throw new GameError("Wähle eine Farbe.");
      s.trump = a.suit;
      s.log.push(`${nameOf(ctx, s.dealerId)} wählt Trumpf ${SUIT_NAME[a.suit]}`);
      startBidding(s, ctx, r.secret);
      break;
    }
    case "bid": {
      if (s.phase !== "bid" || !s.curId) throw new GameError(s.phase === "bid" ? "Ihr sagt gleichzeitig an." : "Gerade wird nicht angesagt.");
      checkBid(a.bid, s);
      const f = forbiddenBid(s, ctx.players, ctx.options, s.curId);
      if (f === a.bid) throw new GameError(`${a.bid} geht nicht – die Ansagen dürfen nicht aufgehen.`);
      s.bids[s.curId] = a.bid;
      s.log.push(`${nameOf(ctx, s.curId)} sagt ${a.bid} an`);
      afterBid(s, ctx);
      break;
    }
    case "secretBid": {
      if (s.phase !== "bid" || s.curId) throw new GameError("Gerade wird nicht verdeckt angesagt.");
      const who = a.player ?? actor;
      if (!who || !(who in s.hands)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (actor !== null && who !== actor) throw new GameError("Sag nur für dich selbst an.");
      if (s.bids[who] !== null && s.bids[who] !== undefined) throw new GameError("Du hast schon angesagt.");
      checkBid(a.bid, s);
      s.bids[who] = a.bid;
      afterBid(s, ctx);
      break;
    }
    case "play": {
      if (s.phase !== "play" || !s.curId) throw new GameError("Gerade wird nicht gespielt.");
      const hand = s.hands[s.curId] ?? [];
      if (!hand.includes(a.card)) throw new GameError("Diese Karte hast du nicht.");
      if (!canPlay(s.trick, hand, a.card)) throw new GameError(`Du musst ${SUIT_NAME[leadSuit(s.trick)!]} bedienen.`);
      playCard(s, ctx, s.curId, a.card);
      s.n++;
      break;
    }
    case "nextRound": {
      if (s.phase !== "roundEnd") throw new GameError("Die Runde läuft noch.");
      advance(s, ctx);
      break;
    }
    default:
      throw new GameError("Das geht nur mit echten Karten.");
  }
  sync(s);
  return s;
}

/** Block für echte Karten: erst Ansagen, dann Stiche eintragen – die App rechnet */
function applyTable(s: HsState, a: HsAction, ctx: GameContext) {
  const actor = ctx.actorId;
  const isHost = actor === null || actor === ctx.hostId;
  const who = (p?: string) => {
    const id = p ?? actor;
    if (!id || !ctx.players.some((x) => x.id === id)) throw new GameError("Diesen Spieler gibt es nicht.");
    if (!isHost && id !== actor) throw new GameError("Trag nur deine eigenen Zahlen ein.");
    return id;
  };
  const num = (n: number | null) => {
    if (n !== null && (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > s.round)) throw new GameError(`Zahl zwischen 0 und ${s.round}.`);
  };
  switch (a.type) {
    case "tBid": {
      if (s.phase !== "tableBid") throw new GameError("Die Ansagen stehen schon.");
      const id = who(a.player);
      num(a.bid);
      s.bids[id] = a.bid;
      return;
    }
    case "tBidsDone": {
      if (s.phase !== "tableBid") throw new GameError("Die Ansagen stehen schon.");
      if (!isHost) throw new GameError("Weiter geht es beim Host.");
      const missing = ctx.players.filter((p) => s.bids[p.id] === null || s.bids[p.id] === undefined);
      if (missing.length) throw new GameError(`Es fehlen noch Ansagen: ${missing.map((p) => p.name).join(", ")}.`);
      const sum = ctx.players.reduce((t, p) => t + (s.bids[p.id] ?? 0), 0);
      if (rulesOf(ctx.options).noEven && sum === s.round) throw new GameError("Die Ansagen gehen auf – der Geber muss anders ansagen.");
      s.phase = "tableTricks";
      return;
    }
    case "tBack": {
      if (s.phase !== "tableTricks") throw new GameError("Es wird gerade angesagt.");
      if (!isHost) throw new GameError("Zurück geht es beim Host.");
      s.phase = "tableBid";
      return;
    }
    case "tTricks": {
      if (s.phase !== "tableTricks") throw new GameError("Erst alle Ansagen eintragen.");
      const id = who(a.player);
      num(a.n);
      s.taken[id] = a.n;
      return;
    }
    case "tFinish": {
      if (s.phase !== "tableTricks") throw new GameError("Erst alle Ansagen eintragen.");
      if (!isHost) throw new GameError("Die Runde schließt der Host ab.");
      const missing = ctx.players.filter((p) => s.taken[p.id] === null || s.taken[p.id] === undefined);
      if (missing.length) throw new GameError(`Es fehlen noch Stiche: ${missing.map((p) => p.name).join(", ")}.`);
      const sum = ctx.players.reduce((t, p) => t + (s.taken[p.id] ?? 0), 0);
      if (sum !== s.round) throw new GameError(`Es gab ${s.round} ${s.round === 1 ? "Stich" : "Stiche"}, eingetragen sind ${sum}.`);
      score(s, ctx, Object.fromEntries(ctx.players.map((p) => [p.id, s.taken[p.id] ?? 0])));
      advance(s, ctx);
      return;
    }
    default:
      throw new GameError("Mit echten Karten tragt ihr nur Ansagen und Stiche ein.");
  }
}

export function leaders(s: HsState, players: Player[]): string[] {
  if (!players.length) return [];
  const best = Math.max(...players.map((p) => s.scores[p.id] ?? 0));
  return players.filter((p) => (s.scores[p.id] ?? 0) === best).map((p) => p.id);
}

/** Erste erlaubte Karte (für „überspringen“) */
const firstPlayable = (s: HsState, id: string) => (s.hands[id] ?? []).find((c) => canPlay(s.trick, s.hands[id], c));

/** Trumpf für einen abwesenden Geber: die Farbe, von der er am meisten hat */
function bestSuit(hand: HsCard[]): Suit {
  return SUITS.slice().sort((a, b) => hand.filter((c) => suitOf(c) === b).length - hand.filter((c) => suitOf(c) === a).length)[0];
}

export const hellseher: GameLogic<HsState, HsAction> = {
  info: {
    id: "hellseher",
    name: "Hellseher",
    tagline: "Sag voraus, wie viele Stiche du machst – Zauberer gewinnen, Narren nie.",
    category: "Karten",
    minPlayers: 3,
    maxPlayers: 6,
    duration: "45–90 Min.",
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
        { value: "table", label: "Echte Karten", hint: "App ist der Block" },
      ],
    },
    {
      key: "length", label: "Spieldauer", type: "choice", default: "all",
      choices: [
        { value: "all", label: "Original", hint: "bis alle Karten verteilt sind" },
        { value: "10", label: "10 Runden", hint: "höchstens bis Runde 10" },
        { value: "half", label: "Halbe Partie", hint: "halb so viele Runden" },
      ],
    },
    { key: "noEven", label: "Ansagen dürfen nicht aufgehen", type: "toggle", default: false, hint: "Der Geber sagt zuletzt an und darf die Summe nicht auf die Kartenzahl bringen", group: "Hausregeln", showIf: (o) => o.secret !== true },
    { key: "secret", label: "Verdeckt ansagen", type: "toggle", default: false, hint: "Alle sagen gleichzeitig an, aufgedeckt wird zusammen", group: "Hausregeln" },
  ],
  setup,
  apply,
  actionKind: (a) => (["trump", "bid", "play"].includes(a.type) ? "turn" : ["secretBid", "nextRound", "tBid", "tTricks", "tBidsDone", "tBack", "tFinish"].includes(a.type) ? "player" : null),
  currentPlayerId: (s) => (s.phase === "bid" || s.phase === "play" || s.phase === "trump" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const win = leaders(s, ctx.players);
    return ctx.players.map((p) => ({ id: p.id, won: win.includes(p.id), score: s.scores[p.id] ?? 0 }));
  },
  skipLabel: (s, ctx) => {
    if (s.mode === "table") return null;
    if (s.phase === "trump") return `Für ${nameOf(ctx, s.dealerId)} Trumpf wählen`;
    if (s.phase === "bid" && s.curId) return `Für ${nameOf(ctx, s.curId)} 0 ansagen`;
    if (s.phase === "bid") {
      const open = ctx.players.filter((p) => !s.bidIn[p.id]).map((p) => p.name);
      return open.length ? `Für ${open.join(", ")} 0 ansagen` : null;
    }
    if (s.phase === "play" && s.curId) return `Für ${nameOf(ctx, s.curId)} eine Karte spielen`;
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.mode === "table") return s;
    if (s.phase === "trump" && s.dealerId) {
      s.trump = bestSuit(s.hands[s.dealerId] ?? []);
      s.log.push(`Trumpf für ${nameOf(ctx, s.dealerId)} gewählt: ${SUIT_NAME[s.trump]}`);
      startBidding(s, ctx, rulesOf(ctx.options).secret);
    } else if (s.phase === "bid" && s.curId) {
      // 0 – oder 1, falls 0 verboten ist
      const bid = forbiddenBid(s, ctx.players, ctx.options, s.curId) === 0 ? 1 : 0;
      s.bids[s.curId] = bid;
      s.log.push(`Für ${nameOf(ctx, s.curId)} angesagt: ${bid}`);
      afterBid(s, ctx);
    } else if (s.phase === "bid") {
      for (const p of ctx.players) if (s.bids[p.id] === null || s.bids[p.id] === undefined) s.bids[p.id] = 0;
      s.log.push("Fehlende Ansagen: 0");
      afterBid(s, ctx);
    } else if (s.phase === "play" && s.curId) {
      const c = firstPlayable(s, s.curId);
      if (c) { s.log.push(`Für ${nameOf(ctx, s.curId)} gespielt`); playCard(s, ctx, s.curId, c); s.n++; }
    }
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    delete s.scores[id];
    delete s.bids[id];
    delete s.taken[id];
    delete s.tricks[id];
    delete s.hands[id];
    if (s.phase === "over") { sync(s); return s; }
    const c2 = { ...ctx, players: rest };
    if (rest.length < 2) { s.phase = "over"; s.curId = null; sync(s); return s; }
    // Die laufende Runde wird mit den Übrigen neu gegeben
    s.totalRounds = Math.max(s.round, Math.min(s.totalRounds, Math.floor(60 / rest.length)));
    if (s.round > Math.floor(60 / rest.length)) { s.phase = "over"; s.curId = null; sync(s); return s; }
    if (s.dealerId === id || !rest.some((p) => p.id === s.dealerId)) {
      const i = ctx.players.findIndex((p) => p.id === id);
      s.dealerId = ctx.players[(i - 1 + ctx.players.length) % ctx.players.length].id;
      if (s.dealerId === id) s.dealerId = rest[0].id;
    }
    if (s.phase !== "roundEnd" && s.mode === "app") {
      s.log.push(`${nameOf(ctx, id)} ist raus – Runde ${s.round} wird neu gegeben`);
      deal(s, c2);
    }
    sync(s);
    return s;
  },
  view: (s, viewer) => {
    if (viewer === null) return s;
    // Verdeckte Ansage: fremde Ansagen erst, wenn alle angesagt haben
    const hideBids = (s.phase === "bid" && !s.curId) || (s.phase === "tableBid" && s.secret && Object.values(s.bids).some((b) => b === null));
    const bids = hideBids ? Object.fromEntries(Object.entries(s.bids).map(([id, b]) => [id, id === viewer ? b : null])) : s.bids;
    return { ...s, deck: [], bids, hands: viewer in s.hands ? { [viewer]: s.hands[viewer] } : {} };
  },
};
