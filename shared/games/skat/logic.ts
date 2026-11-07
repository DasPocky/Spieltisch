/**
 * Skat – Reizen, Skat aufnehmen oder Hand, Alleinspieler gegen zwei. Nach der offiziellen Skatordnung, vereinfacht:
 *  - 32 Karten (7 bis Ass in vier Farben), je 10, zwei in den Skat. Geber reihum; zu viert sitzt der Geber aus.
 *  - Reizen: Mittelhand sagt Vorhand (18, 20, 22, 23, 24, 27 …), Vorhand hält („ja“) oder passt; dann sagt Hinterhand
 *    dem Gewinner. Sagt niemand etwas, darf Vorhand 18 spielen. Passen alle: Ramsch (Hausregel) oder eingepasst.
 *  - Alleinspieler: Skat aufnehmen und zwei Karten drücken oder Hand spielen. Farbspiel (Karo 9, Herz 10, Pik 11, Kreuz 12),
 *    Grand (24), Null (23), Null Hand (35), Null ouvert (46), Null ouvert Hand (59). Aus der Hand: Schneider/Schwarz
 *    ansagen, offen spielen.
 *  - Trumpf: die Buben (Kreuz, Pik, Herz, Karo), im Farbspiel dazu die Trumpffarbe A, 10, K, D, 9, 8, 7. Null: kein Trumpf,
 *    Reihenfolge 7, 8, 9, 10, B, D, K, A.
 *  - Spielwert: (Spitzen + 1 + Hand + Schneider + angesagt + Schwarz + angesagt + offen) × Grundwert. Gewonnen mit 61 Augen.
 *    Überreizt: verloren mit dem nächsten Vielfachen des Grundwerts über dem Reizwert.
 *  - Liste (vereinfacht): gewonnen + Spielwert, verloren − 2 × Spielwert. Ramsch: wer die meisten Augen hat, verliert sie
 *    (Jungfrau verdoppelt, Durchmarsch +120).
 *
 * Immer drei aktive Plätze: Fehlen Mitspieler oder steigt jemand aus, spielt die App diese Plätze (Bots ohne Gerät).
 * Server-autoritativ: Hände und Skat geheim (offen gespielt: die Hand des Alleinspielers für alle).
 */
import { rankOf, suitOf, type Card, type Rank } from "../../cards/deck";
import { shuffle } from "../../platform/random";
import { dealerBefore } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";

export const SUITS = ["kreuz", "pik", "herz", "karo"] as const;
export type SkSuit = (typeof SUITS)[number];
const RANKS: Rank[] = ["7", "8", "9", "10", "B", "D", "K", "A"];
export const JACKS: Card[] = ["kreuz-B", "pik-B", "herz-B", "karo-B"];
/** Reihenfolge der Farbkarten (ohne Buben) von hoch nach niedrig */
const SUIT_ORDER: Rank[] = ["A", "10", "K", "D", "9", "8", "7"];
const NULL_ORDER: Rank[] = ["7", "8", "9", "10", "B", "D", "K", "A"];

export type Kind = SkSuit | "grand" | "null";
export const KINDS: Kind[] = ["karo", "herz", "pik", "kreuz", "grand", "null"];
/** Spielart für die Stichregeln (Ramsch: nur Buben Trumpf, wie Grand) */
export type Mode = Kind | "ramsch";
export const BASE: Record<Exclude<Kind, "null">, number> = { karo: 9, herz: 10, pik: 11, kreuz: 12, grand: 24 };
export const nullValue = (hand: boolean, ouvert: boolean) => (ouvert ? (hand ? 59 : 46) : hand ? 35 : 23);

/** Alle Reizwerte: jeder mögliche Spielwert ab 18 */
export const BIDS: number[] = (() => {
  const out = new Set<number>([23, 35, 46, 59]);
  for (const b of Object.values(BASE)) for (let m = 2; m <= 18; m++) if (b * m >= 18 && (b !== 24 || m <= 11)) out.add(b * m);
  return [...out].sort((a, b) => a - b);
})();
export const nextBid = (v: number) => BIDS.find((x) => x > v) ?? null;

export interface Game { kind: Kind; hand: boolean; schneider: boolean; schwarz: boolean; ouvert: boolean }

// ---------------------------------------------------------------- Namen

const FR_NAME: Record<SkSuit, string> = { kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" };
const DE_NAME: Record<SkSuit, string> = { kreuz: "Eichel", pik: "Grün", herz: "Rot", karo: "Schellen" };
const DE_SUIT: Record<string, string> = { kreuz: "eichel", pik: "gruen", herz: "rot", karo: "schellen" };
const DE_RANK: Record<string, string> = { D: "O", B: "U" };
export const suitName = (s: SkSuit, o?: Options) => (o?.pictures === "de" ? DE_NAME : FR_NAME)[s];
export const kindName = (k: Kind | "ramsch", o?: Options) => (k === "grand" ? "Grand" : k === "null" ? "Null" : k === "ramsch" ? "Ramsch" : suitName(k, o));
/** „Herz Hand“, „Grand ouvert“, „Null ouvert Hand“ … */
export function gameName(g: Pick<Game, "kind" | "hand" | "schneider" | "schwarz" | "ouvert"> | null, o?: Options): string {
  if (!g) return "Reizen";
  const parts = [kindName(g.kind, o)];
  if (g.kind === "null") { if (g.ouvert) parts.push("ouvert"); if (g.hand) parts.push("Hand"); return parts.join(" "); }
  if (g.hand) parts.push("Hand");
  if (g.ouvert) parts.push("ouvert");
  else if (g.schwarz) parts.push("Schwarz angesagt");
  else if (g.schneider) parts.push("Schneider angesagt");
  return parts.join(" ");
}
export function cardText(card: Card, o?: Options): string {
  const s = suitOf(card) as SkSuit, r = rankOf(card);
  const rank = (o?.pictures === "de" ? { D: "Ober", B: "Unter" } : { D: "Dame", B: "Bube" }) as Record<string, string>;
  const name = ({ ...{ K: "König", A: "Ass", "10": "Zehn", "9": "Neun", "8": "Acht", "7": "Sieben" }, ...rank } as Record<string, string>)[r];
  return `${suitName(s, o)}-${name}`;
}
/** Kartenbild: mit deutschen Bildern Eichel/Grün/Rot/Schellen, Ober/Unter */
export const shownCard = (card: Card, o?: Options): Card => (o?.pictures === "de" ? `${DE_SUIT[suitOf(card)]}-${DE_RANK[rankOf(card)] ?? rankOf(card)}` as Card : card);
export const spitzenText = (n: number) => `${n >= 0 ? "mit" : "ohne"} ${Math.abs(n)}`;

// ---------------------------------------------------------------- Karten und Trumpf

export const AUGEN: Record<string, number> = { A: 11, "10": 10, K: 4, D: 3, B: 2, "9": 0, "8": 0, "7": 0 };
export const augenOf = (c: Card) => AUGEN[rankOf(c)] ?? 0;
export const sumAugen = (cs: Card[]) => cs.reduce((t, c) => t + augenOf(c), 0);

export function deck(): Card[] {
  return SUITS.flatMap((s) => RANKS.map((r) => `${s}-${r}` as Card));
}
const isSkCard = (x: unknown): x is Card => typeof x === "string" && x.split("-").length === 2 && (SUITS as readonly string[]).includes(x.split("-")[0]) && RANKS.includes(x.split("-")[1] as Rank);

const TRUMP_CACHE = new Map<string, Card[]>();
/** Trümpfe von hoch nach niedrig */
export function trumpsOf(m: Mode | null): Card[] {
  const key = m ?? "grand";
  let t = TRUMP_CACHE.get(key);
  if (!t) {
    if (m === "null") t = [];
    else if (m === "grand" || m === "ramsch" || m === null) t = JACKS;
    else t = [...JACKS, ...SUIT_ORDER.map((r) => `${m}-${r}` as Card)];
    TRUMP_CACHE.set(key, t);
  }
  return t;
}
export const isTrump = (c: Card, m: Mode | null) => trumpsOf(m).includes(c);
/** „Farbe“ im Sinne des Bedienens: Trumpf oder die Farbe */
export const keyOf = (c: Card, m: Mode | null): string => (isTrump(c, m) ? "trumpf" : suitOf(c));
/** Stärke innerhalb derselben Farbe bzw. im Trumpf (höher ist besser) */
export function power(c: Card, m: Mode | null): number {
  const i = trumpsOf(m).indexOf(c);
  if (i >= 0) return 100 - i;
  return m === "null" ? NULL_ORDER.indexOf(rankOf(c)) + 1 : 10 - SUIT_ORDER.indexOf(rankOf(c));
}
export function beats(a: Card, b: Card, lead: string, m: Mode | null): boolean {
  const ta = isTrump(a, m), tb = isTrump(b, m);
  if (ta !== tb) return ta;
  if (!ta && suitOf(a) !== lead) return false;
  if (!ta && suitOf(b) !== lead) return true;
  return power(a, m) > power(b, m);
}
export interface Play { id: string; card: Card }
export function trickWinner(trick: Play[], m: Mode | null): string {
  const lead = keyOf(trick[0].card, m);
  let best = trick[0];
  for (const p of trick.slice(1)) if (beats(p.card, best.card, lead, m)) best = p;
  return best.id;
}

/** Hand ordnen: Trümpfe von hoch nach niedrig, dann Kreuz, Pik, Herz, Karo (bei Null A … 7) */
export function sortHand(h: Card[], m: Mode | null): Card[] {
  const t = trumpsOf(m);
  const rank = (x: Card) => {
    const i = t.indexOf(x);
    return i >= 0 ? i : 100 + SUITS.indexOf(suitOf(x) as SkSuit) * 20 + (20 - power(x, m));
  };
  return h.slice().sort((a, b) => rank(a) - rank(b));
}

/** Spitzen: mit (positiv) bzw. ohne (negativ) – über die zwölf Karten des Alleinspielers */
export function spitzen(cards: Card[], kind: Exclude<Kind, "null">): number {
  const seq = trumpsOf(kind);
  const has = cards.includes(seq[0]);
  let n = 0;
  while (n < seq.length && cards.includes(seq[n]) === has) n++;
  return has ? n : -n;
}

// ---------------------------------------------------------------- Zustand

export interface TrickRec { plays: Play[]; winner: string; augen: number }
export interface Factor { label: string; n: number }
export interface RoundRecord {
  round: number;
  kind: Kind | "ramsch" | "eingepasst";
  declarer: string | null;
  bid: number;
  game: Game | null;
  /** Augen des Alleinspielers (mit Skat) */
  augen: number;
  tricks: number;
  spitzen: number;
  factors: Factor[];
  base: number;
  value: number;
  won: boolean;
  overbid: boolean;
  skat: Card[];
  /** Ramsch: Augen je Spieler, Verlierer, Jungfrauen, Durchmarsch */
  augenBy: Record<string, number>;
  losers: string[];
  virgins: string[];
  sweep: string | null;
  points: Record<string, number>;
}

export interface Bidding {
  /** 1: Mittelhand sagt Vorhand · 2: Hinterhand sagt dem Gewinner · 3: niemand hat gesagt – Vorhand darf 18 spielen */
  stage: 1 | 2 | 3;
  bidder: string;
  listener: string;
  value: number;
  asked: "bidder" | "listener";
}

export interface SkState {
  v: 1;
  local: boolean;
  phase: "bid" | "skat" | "discard" | "declare" | "play" | "roundEnd" | "over";
  round: number;
  total: number;
  /** alle Plätze (3 oder 4) in Sitzreihenfolge – auch die, die die App spielt */
  seats: string[];
  names: Record<string, string>;
  ghosts: string[];
  dealerId: string;
  /** Vorhand, Mittelhand, Hinterhand dieser Runde (zu viert sitzt der Geber aus) */
  active: string[];
  hands: Record<string, Card[]>;
  counts: Record<string, number>;
  /** der Skat – geheim; nach dem Drücken die gedrückten Karten (nur der Alleinspieler sieht sie) */
  skat: Card[];
  bidding: Bidding | null;
  /** öffentlich: zuletzt Gesagtes je Platz („18“, „ja“, „passe“) */
  said: Record<string, string>;
  declarer: string | null;
  bid: number;
  tookSkat: boolean;
  game: Game | null;
  ramsch: boolean;
  trick: Play[];
  tricks: TrickRec[];
  curId: string | null;
  deadline: number | null;
  scores: Record<string, number>;
  history: RoundRecord[];
  log: string[];
  /** wie viele Verlaufszeilen es insgesamt gab (der Verlauf selbst wird gekürzt) – fürs Vorlesen */
  logN: number;
  n: number;
}

export type SkAction =
  | { type: "bid"; value: number }
  | { type: "hold" }
  | { type: "pass" }
  | { type: "skat"; take: boolean }
  | { type: "discard"; cards: Card[] }
  | { type: "declare"; kind: Kind; schneider?: boolean; schwarz?: boolean; ouvert?: boolean }
  | { type: "play"; card: Card }
  | { type: "timeUp" }
  | { type: "nextRound" };

export interface Rules { total: number; ramsch: boolean; jungfrau: boolean; double: boolean; think: number }
export function rulesOf(o: Options): Rules {
  const total = [3, 6, 12, 24, 36].includes(Number(o.rounds)) ? Number(o.rounds) : 12;
  const think = String(o.think ?? "off") === "off" ? 0 : Math.max(10, parseInt(String(o.think), 10) || 0);
  return { total, ramsch: o.ramsch === true, jungfrau: o.jungfrau !== false, double: o.double !== false, think };
}

const MAX_LOG = 80;
const GRACE = 1500;
export const BOT_NAMES = ["Lotte", "Hein", "Gerda"];
export const nameOf = (s: SkState, id: string | null | undefined) => (id ? s.names[id] ?? "?" : "?");
export const nextSeat = (s: Pick<SkState, "seats">, id: string | null) => s.seats[(s.seats.indexOf(id ?? "") + 1) % s.seats.length];
/** Spielart für die Stichregeln */
export const modeOf = (s: Pick<SkState, "game" | "ramsch">): Mode | null => (s.ramsch ? "ramsch" : s.game?.kind ?? null);
/** Position im Reizen/Spiel: Vorhand, Mittelhand, Hinterhand */
export const POSITION = ["Vorhand", "Mittelhand", "Hinterhand"];
export const positionOf = (s: Pick<SkState, "active">, id: string) => POSITION[s.active.indexOf(id)] ?? "sitzt aus";

function addLog(s: SkState, line: string) {
  s.log.push(line);
  s.logN++;
}

function sync(s: SkState) {
  s.counts = Object.fromEntries(s.seats.map((id) => [id, s.hands[id]?.length ?? 0]));
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

function startTurn(s: SkState, ctx: GameContext, id: string | null) {
  s.curId = id;
  const think = rulesOf(ctx.options).think;
  s.deadline = !s.local && think > 0 && id && !s.ghosts.includes(id) ? ctx.now + think * 1000 : null;
}

/** Aktive Plätze: die drei nach dem Geber (zu dritt ist der Geber Hinterhand) */
export function activeFor(seats: string[], dealerId: string): string[] {
  const i = seats.indexOf(dealerId);
  return [1, 2, 3].map((k) => seats[(i + k) % seats.length]);
}

/** Neue Runde: mischen, je 10 Karten, zwei in den Skat; Mittelhand sagt Vorhand */
function deal(s: SkState, ctx: GameContext) {
  const cards = shuffle(deck());
  s.active = activeFor(s.seats, s.dealerId);
  s.hands = Object.fromEntries(s.seats.map((id) => [id, [] as Card[]]));
  s.active.forEach((id, i) => { s.hands[id] = sortHand(cards.slice(i * 10, i * 10 + 10), "grand"); });
  s.skat = cards.slice(30);
  s.said = {};
  s.declarer = null;
  s.bid = 0;
  s.tookSkat = false;
  s.game = null;
  s.ramsch = false;
  s.trick = [];
  s.tricks = [];
  s.phase = "bid";
  s.bidding = { stage: 1, bidder: s.active[1], listener: s.active[0], value: 0, asked: "bidder" };
  addLog(s, `Spiel ${s.round}: ${nameOf(s, s.dealerId)} gibt${s.seats.length > 3 ? " und sitzt aus" : ""}`);
  startTurn(s, ctx, s.active[1]);
}

function setup(ctx: GameContext): SkState {
  const humans = ctx.players.slice(0, 4);
  const seats = humans.map((p) => p.id);
  const names: Record<string, string> = Object.fromEntries(humans.map((p) => [p.id, p.name]));
  const ghosts: string[] = [];
  for (let i = 0; seats.length < 3; i++) {
    const id = `bot-${i + 1}`;
    seats.push(id);
    ghosts.push(id);
    names[id] = `${BOT_NAMES[i]} (Bot)`;
  }
  const s: SkState = {
    v: 1, local: ctx.actorId === null, phase: "bid", round: 1, total: rulesOf(ctx.options).total, seats, names, ghosts,
    dealerId: dealerBefore({ players: humans, round: ctx.round }) ?? seats[seats.length - 1], active: [],
    hands: {}, counts: {}, skat: [], bidding: null, said: {}, declarer: null, bid: 0, tookSkat: false, game: null, ramsch: false,
    trick: [], tricks: [], curId: null, deadline: null,
    scores: Object.fromEntries(seats.map((id) => [id, 0])), history: [], log: [], logN: 0, n: 0,
  };
  deal(s, ctx);
  runGhosts(s, ctx);
  sync(s);
  return s;
}

// ---------------------------------------------------------------- Reizen

/** Was `id` beim Reizen gerade tun darf */
export function bidOptions(s: Pick<SkState, "phase" | "bidding" | "curId">, id: string | null): { say: number | null; hold: boolean; pass: boolean } {
  const b = s.bidding;
  if (s.phase !== "bid" || !b || !id || s.curId !== id) return { say: null, hold: false, pass: false };
  if (b.asked === "listener") return { say: null, hold: true, pass: true };
  return { say: b.stage === 3 ? 18 : nextBid(b.value), hold: false, pass: true };
}

function winBid(s: SkState, ctx: GameContext, id: string, value: number) {
  s.bidding = null;
  s.declarer = id;
  s.bid = value;
  s.phase = "skat";
  addLog(s, `${nameOf(s, id)} spielt – gereizt bis ${value}`);
  startTurn(s, ctx, id);
}

function allPassed(s: SkState, ctx: GameContext) {
  s.bidding = null;
  if (rulesOf(ctx.options).ramsch) {
    s.ramsch = true;
    s.phase = "play";
    for (const id of s.active) s.hands[id] = sortHand(s.hands[id], "ramsch");
    addLog(s, "Alle passen – Ramsch!");
    startTurn(s, ctx, s.active[0]);
    return;
  }
  addLog(s, "Alle passen – eingepasst");
  const rec: RoundRecord = {
    round: s.round, kind: "eingepasst", declarer: null, bid: 0, game: null, augen: 0, tricks: 0, spitzen: 0, factors: [], base: 0, value: 0,
    won: false, overbid: false, skat: [...s.skat], augenBy: {}, losers: [], virgins: [], sweep: null, points: Object.fromEntries(s.seats.map((id) => [id, 0])),
  };
  finish(s, rec);
}

function doBid(s: SkState, ctx: GameContext, id: string, value: unknown) {
  const b = s.bidding!;
  if (b.asked !== "bidder") throw new GameError("Du hörst gerade – ja oder passe.");
  if (b.stage === 3) {
    if (value !== 18) throw new GameError("Vorhand spielt 18 oder passt.");
    s.said[id] = "18";
    addLog(s, `${nameOf(s, id)}: 18`);
    winBid(s, ctx, id, 18);
    return;
  }
  if (typeof value !== "number" || !BIDS.includes(value) || value <= b.value) throw new GameError("Diesen Reizwert gibt es hier nicht.");
  b.value = value;
  b.asked = "listener";
  s.said[id] = String(value);
  addLog(s, `${nameOf(s, id)}: ${value}`);
  startTurn(s, ctx, b.listener);
}

function doHold(s: SkState, ctx: GameContext, id: string) {
  const b = s.bidding!;
  if (b.asked !== "listener") throw new GameError("Du bist mit Sagen dran.");
  b.asked = "bidder";
  s.said[id] = "ja";
  addLog(s, `${nameOf(s, id)}: ja`);
  startTurn(s, ctx, b.bidder);
}

function doPass(s: SkState, ctx: GameContext, id: string) {
  const b = s.bidding!;
  s.said[id] = "passe";
  addLog(s, `${nameOf(s, id)}: passe`);
  if (b.stage === 3) { allPassed(s, ctx); return; }
  const winner = id === b.bidder ? b.listener : b.bidder;
  if (b.stage === 1) {
    s.bidding = { stage: 2, bidder: s.active[2], listener: winner, value: b.value, asked: "bidder" };
    startTurn(s, ctx, s.active[2]);
    return;
  }
  if (b.value > 0) { winBid(s, ctx, winner, b.value); return; }
  // niemand hat etwas gesagt: Vorhand darf 18 spielen
  s.bidding = { stage: 3, bidder: winner, listener: winner, value: 0, asked: "bidder" };
  startTurn(s, ctx, winner);
}

// ---------------------------------------------------------------- Skat, Drücken, Ansage

export function gameValueOf(g: Game, sp: number): number {
  if (g.kind === "null") return nullValue(g.hand, g.ouvert);
  return BASE[g.kind] * (Math.abs(sp) + 1 + (g.hand ? 1 : 0) + (g.schneider ? 2 : 0) + (g.schwarz ? 2 : 0) + (g.ouvert ? 1 : 0));
}

/** Darf der Alleinspieler das so ansagen? Grund, warum nicht (oder null) */
export function declareWhyNot(s: Pick<SkState, "tookSkat" | "bid">, g: Partial<Game> & { kind: unknown }): string | null {
  if (!(KINDS as unknown[]).includes(g.kind)) return "Diese Spielart gibt es nicht.";
  const hand = !s.tookSkat;
  if (g.kind === "null") {
    if (g.schneider || g.schwarz) return "Beim Null gibt es kein Schneider oder Schwarz.";
    const v = nullValue(hand, !!g.ouvert);
    if (v < s.bid) return `${gameName({ kind: "null", hand, ouvert: !!g.ouvert, schneider: false, schwarz: false })} ist nur ${v} wert – gereizt sind ${s.bid}.`;
    return null;
  }
  if ((g.schneider || g.schwarz || g.ouvert) && !hand) return "Ansagen nur beim Handspiel.";
  return null;
}

function normalized(s: SkState, a: { kind: Kind; schneider?: boolean; schwarz?: boolean; ouvert?: boolean }): Game {
  const hand = !s.tookSkat;
  const ouvert = !!a.ouvert;
  if (a.kind === "null") return { kind: "null", hand, schneider: false, schwarz: false, ouvert };
  const schwarz = !!a.schwarz || ouvert;
  return { kind: a.kind, hand, schneider: !!a.schneider || schwarz, schwarz, ouvert };
}

function doDeclare(s: SkState, ctx: GameContext, id: string, g: Game) {
  s.game = g;
  s.phase = "play";
  for (const x of s.active) s.hands[x] = sortHand(s.hands[x], g.kind);
  addLog(s, `${nameOf(s, id)} spielt ${gameName(g, ctx.options)}`);
  startTurn(s, ctx, s.active[0]);
}

// ---------------------------------------------------------------- Spielen

export const leadKey = (s: Pick<SkState, "trick" | "game" | "ramsch">): string | null => (s.trick.length ? keyOf(s.trick[0].card, modeOf(s)) : null);

export function whyNot(s: Pick<SkState, "trick" | "game" | "ramsch">, hand: Card[], card: Card): string | null {
  if (!hand.includes(card)) return "Diese Karte hast du nicht.";
  const lead = leadKey(s);
  if (!lead) return null;
  const m = modeOf(s);
  if (keyOf(card, m) !== lead && hand.some((c) => keyOf(c, m) === lead)) {
    return lead === "trumpf" ? "Du musst Trumpf bedienen." : `Du musst ${FR_NAME[lead as SkSuit]} bedienen.`;
  }
  return null;
}
export const canPlay = (s: Pick<SkState, "trick" | "game" | "ramsch">, hand: Card[], card: Card) => whyNot(s, hand, card) === null;

function playCard(s: SkState, ctx: GameContext, me: string, card: Card) {
  const hand = s.hands[me];
  hand.splice(hand.indexOf(card), 1);
  s.trick.push({ id: me, card });
  s.n++;
  if (s.trick.length < 3) { startTurn(s, ctx, s.active[(s.active.indexOf(me) + 1) % 3]); return; }
  const w = trickWinner(s.trick, modeOf(s));
  const augen = sumAugen(s.trick.map((p) => p.card));
  s.tricks.push({ plays: s.trick, winner: w, augen });
  addLog(s, `${nameOf(s, w)} nimmt den Stich (${augen} Augen)`);
  s.trick = [];
  // Null: sticht der Alleinspieler, ist das Spiel verloren
  if (s.game?.kind === "null" && w === s.declarer) { score(s, ctx); return; }
  if (s.active.every((id) => (s.hands[id] ?? []).length === 0)) { score(s, ctx); return; }
  startTurn(s, ctx, w);
}

// ---------------------------------------------------------------- Abrechnung

/** Abrechnung eines Spiels mit Alleinspieler (rein, für Tests einzeln nutzbar) */
export function settle(s: Pick<SkState, "round" | "declarer" | "bid" | "game" | "tricks" | "skat" | "hands" | "seats">, double = true): RoundRecord {
  const d = s.declarer!, g = s.game!;
  const own = s.tricks.filter((t) => t.winner === d);
  const augen = own.reduce((t, x) => t + x.augen, 0) + sumAugen(s.skat);
  const tricks = own.length;
  const factors: Factor[] = [];
  let value: number, won: boolean, base: number, sp = 0, overbid = false;
  if (g.kind === "null") {
    base = value = nullValue(g.hand, g.ouvert);
    won = tricks === 0;
  } else {
    const cards = [...s.tricks.flatMap((t) => t.plays).filter((p) => p.id === d).map((p) => p.card), ...(s.hands[d] ?? []), ...s.skat];
    sp = spitzen(cards, g.kind);
    base = BASE[g.kind];
    const schneider = augen >= 90 || augen <= 30;
    const schwarz = tricks === 10 || tricks === 0;
    factors.push({ label: spitzenText(sp), n: Math.abs(sp) }, { label: "Spiel", n: 1 });
    if (g.hand) factors.push({ label: "Hand", n: 1 });
    if (schneider || g.schneider) factors.push({ label: "Schneider", n: 1 });
    if (g.schneider) factors.push({ label: "Schneider angesagt", n: 1 });
    if (schwarz || g.schwarz) factors.push({ label: "Schwarz", n: 1 });
    if (g.schwarz) factors.push({ label: "Schwarz angesagt", n: 1 });
    if (g.ouvert) factors.push({ label: "Ouvert", n: 1 });
    value = base * factors.reduce((t, f) => t + f.n, 0);
    won = augen >= 61 && (!g.schneider || augen >= 90) && (!g.schwarz || tricks === 10);
    if (value < s.bid) {
      overbid = true;
      won = false;
      value = Math.ceil(s.bid / base) * base;
    }
  }
  const points = Object.fromEntries(s.seats.map((id) => [id, 0]));
  points[d] = won ? value : -value * (double ? 2 : 1);
  return {
    round: s.round, kind: g.kind, declarer: d, bid: s.bid, game: { ...g }, augen, tricks, spitzen: sp, factors, base, value, won, overbid,
    skat: [...s.skat], augenBy: {}, losers: [], virgins: [], sweep: null, points,
  };
}

/** Ramsch: wer die meisten Augen hat, verliert sie (Jungfrau: verdoppelt; Durchmarsch: +120). Der Skat geht an den letzten Stich. */
export function settleRamsch(s: Pick<SkState, "round" | "tricks" | "skat" | "seats" | "active">, jungfrau = true): RoundRecord {
  const augenBy: Record<string, number> = Object.fromEntries(s.active.map((id) => [id, 0]));
  const count: Record<string, number> = Object.fromEntries(s.active.map((id) => [id, 0]));
  for (const t of s.tricks) { augenBy[t.winner] += t.augen; count[t.winner]++; }
  const last = s.tricks.at(-1)?.winner;
  if (last) augenBy[last] += sumAugen(s.skat);
  const points = Object.fromEntries(s.seats.map((id) => [id, 0]));
  const sweep = s.active.find((id) => count[id] === s.tricks.length && s.tricks.length === 10) ?? null;
  let losers: string[] = [], virgins: string[] = [];
  if (sweep) points[sweep] = 120;
  else {
    const top = Math.max(...s.active.map((id) => augenBy[id]));
    losers = s.active.filter((id) => augenBy[id] === top);
    virgins = jungfrau ? s.active.filter((id) => count[id] === 0) : [];
    for (const id of losers) points[id] = -top * 2 ** virgins.length;
  }
  return {
    round: s.round, kind: "ramsch", declarer: null, bid: 0, game: null, augen: 0, tricks: 0, spitzen: 0, factors: [], base: 0,
    value: sweep ? 120 : losers.length ? -points[losers[0]] : 0, won: false, overbid: false, skat: [...s.skat], augenBy, losers, virgins, sweep, points,
  };
}

function finish(s: SkState, rec: RoundRecord) {
  for (const id of s.seats) s.scores[id] = (s.scores[id] ?? 0) + (rec.points[id] ?? 0);
  s.history.push(rec);
  s.curId = null;
  s.deadline = null;
  s.phase = s.round >= s.total ? "over" : "roundEnd";
}

function score(s: SkState, ctx: GameContext) {
  const r = rulesOf(ctx.options);
  if (s.ramsch) {
    const rec = settleRamsch(s, r.jungfrau);
    addLog(s, rec.sweep ? `Durchmarsch! ${nameOf(s, rec.sweep)} bekommt 120` : `${rec.losers.map((id) => nameOf(s, id)).join(" und ")} ${rec.losers.length > 1 ? "verlieren" : "verliert"} den Ramsch mit ${rec.augenBy[rec.losers[0]]} Augen`);
    finish(s, rec);
    return;
  }
  const rec = settle(s, r.double);
  const d = nameOf(s, s.declarer);
  addLog(s, `${d} ${rec.won ? "gewinnt" : "verliert"} ${gameName(s.game, ctx.options)}${rec.overbid ? " (überreizt)" : ""}: ${rec.points[s.declarer!] > 0 ? "+" : "−"}${Math.abs(rec.points[s.declarer!])}`);
  finish(s, rec);
}

// ---------------------------------------------------------------- Strategie (Bots, Spielhilfe, Zugzeit, App-Plätze)

const isJack = (c: Card) => rankOf(c) === "B";
const ofSuit = (cards: Card[], x: SkSuit) => cards.filter((c) => suitOf(c) === x && !isJack(c));

/** Einschätzung einer Hand für eine Spielart: über 0 lohnt es sich (ein Maß, keine Wahrscheinlichkeit) */
export function strength(cards: Card[], kind: Kind): number {
  if (kind === "null") {
    let risky = 0, riskySuits = 0;
    for (const x of SUITS) {
      const own = cards.filter((c) => suitOf(c) === x).map((c) => NULL_ORDER.indexOf(rankOf(c))).sort((a, b) => a - b);
      const bad = own.filter((r, k) => r > 2 * k).length;
      risky += bad;
      if (bad) riskySuits++;
    }
    return risky === 0 ? 3 : risky === 1 ? 0.6 : risky === 2 && riskySuits === 1 ? 0.1 : -2 - risky;
  }
  const has = (c: string) => cards.includes(c as Card);
  if (kind === "grand") {
    const jacks = cards.filter(isJack).length;
    let v = jacks * 1.5 + (has("kreuz-B") ? 0.8 : 0) + (has("pik-B") ? 0.4 : 0);
    for (const x of SUITS) {
      const own = ofSuit(cards, x);
      const a = own.some((c) => rankOf(c) === "A"), t = own.some((c) => rankOf(c) === "10");
      if (a) v += 1.5;
      if (a && t) v += 1 + Math.max(0, own.length - 2) * 0.4;
      if (t && !a && own.length <= 2) v -= 0.6;
    }
    return v - (jacks < 2 ? 3 : 0) - 8.5;
  }
  const trumps = cards.filter((c) => isTrump(c, kind));
  let v = trumps.length + (has("kreuz-B") ? 1 : 0) + (has("pik-B") ? 0.6 : 0) + (has("herz-B") ? 0.3 : 0) + (has("karo-B") ? 0.1 : 0);
  if (has(`${kind}-A`)) v += 0.4;
  if (has(`${kind}-10`)) v += 0.2;
  for (const x of SUITS) {
    if (x === kind) continue;
    const own = ofSuit(cards, x);
    const a = own.some((c) => rankOf(c) === "A"), t = own.some((c) => rankOf(c) === "10");
    if (!own.length) v += 0.5;
    if (a) v += 1;
    if (a && t) v += 0.7;
    if (t && !a && own.length === 1) v -= 0.6;
  }
  return v - 8;
}

/** Wert eines Spiels für die Planung (ohne Schneider) */
const planValue = (cards: Card[], kind: Kind, hand: boolean) => (kind === "null" ? nullValue(hand, false) : BASE[kind] * (Math.abs(spitzen(cards, kind)) + 1 + (hand ? 1 : 0)));

/** Bis wohin reizt diese Hand? (vor dem Skat: etwas mutiger, der Skat hilft meist) */
export function maxBid(hand: Card[]): number {
  let best = 0;
  for (const k of KINDS) {
    const m = strength(hand, k);
    if (m >= (k === "null" ? 0 : -1.8)) best = Math.max(best, planValue(hand, k, false));
  }
  return best;
}

export function suggestBid(s: SkState, me: string): SkAction {
  const o = bidOptions(s, me);
  const max = maxBid(s.hands[me] ?? []);
  if (o.hold) return s.bidding!.value <= max ? { type: "hold" } : { type: "pass" };
  if (o.say !== null && o.say <= max) return { type: "bid", value: o.say };
  return { type: "pass" };
}

interface Plan { kind: Kind; margin: number; value: number }
/** Beste Spielart für zehn Karten (dazu bekannte Skatkarten für die Spitzen) bei diesem Reizwert */
function bestPlan(hand: Card[], skat: Card[], bid: number, isHand: boolean): Plan {
  let best: Plan | null = null, fallback: Plan | null = null;
  for (const k of KINDS) {
    const margin = strength(hand, k);
    const value = planValue([...hand, ...skat], k, isHand);
    const p = { kind: k, margin, value };
    if (k !== "null" && (!fallback || value > fallback.value)) fallback = p;
    if (value < bid) continue;
    if (!best || margin > best.margin + 1e-9 || (Math.abs(margin - best.margin) <= 1e-9 && value > best.value)) best = p;
  }
  return best ?? fallback!;
}

/** Skat aufnehmen? Nur eine sehr starke Hand spielt Hand */
export function suggestSkat(s: SkState, me: string): boolean {
  const hand = s.hands[me] ?? [];
  const p = bestPlan(hand, [], s.bid, true);
  return !(p.margin >= 2.5 && p.value >= s.bid);
}

/** Welche zwei Karten drücken? Jede Wahl wird mit der besten Spielart der übrigen zehn bewertet; Augen im Skat zählen mit */
export function suggestDiscard(s: SkState, me: string): Card[] {
  const cards = s.hands[me] ?? [];
  let best: Card[] = cards.slice(-2), top = -Infinity;
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const pair = [cards[i], cards[j]];
    const rest = cards.filter((_, k) => k !== i && k !== j);
    const p = bestPlan(rest, pair, s.bid, false);
    let v = p.margin + (p.value >= s.bid ? 0 : -5);
    if (p.kind !== "null") v += sumAugen(pair) * 0.04 - pair.filter((c) => isTrump(c, p.kind)).length * 2;
    if (v > top + 1e-9) { top = v; best = pair; }
  }
  return best;
}

/** Spielart wählen: die stärkste, die den Reizwert erreicht (Null ouvert nur, wenn sie nötig und sicher ist) */
export function suggestGame(s: SkState, me: string): Game {
  const hand = s.hands[me] ?? [];
  const isHand = !s.tookSkat;
  const p = bestPlan(hand, isHand ? [] : s.skat, s.bid, isHand);
  if (p.kind === "null" || (p.value < s.bid && strength(hand, "null") >= 3)) {
    const ouvert = nullValue(isHand, false) < s.bid;
    if (nullValue(isHand, ouvert) >= s.bid) return { kind: "null", hand: isHand, schneider: false, schwarz: false, ouvert };
  }
  return { kind: p.kind === "null" ? "grand" : p.kind, hand: isHand, schneider: false, schwarz: false, ouvert: false };
}

/** Karten, die `me` noch nicht gesehen hat (bei anderen oder im Skat) */
export function unseen(s: SkState, me: string): Card[] {
  const seen = new Set<Card>([...(s.hands[me] ?? []), ...s.tricks.flatMap((t) => t.plays.map((p) => p.card)), ...s.trick.map((p) => p.card), ...(s.declarer === me ? s.skat : [])]);
  return deck().filter((c) => !seen.has(c));
}

/**
 * Vorschlag für die nächste Karte – nur mit dem, was `me` sieht: Trumpf ziehen als Alleinspieler, dem Partner Augen
 * geben („schmieren“), Stiche billig übernehmen, beim Null drunter bleiben, beim Ramsch Augen loswerden.
 */
export function suggestCard(s: SkState, me: string): Card | null {
  const hand = s.hands[me] ?? [];
  const ok = hand.filter((c) => canPlay(s, hand, c));
  if (!ok.length) return null;
  if (ok.length === 1) return ok[0];
  const m = modeOf(s);
  const lead = leadKey(s);
  const w = s.trick.length ? trickWinner(s.trick, m) : null;
  const wCard = w ? s.trick.find((p) => p.id === w)!.card : null;
  const byPower = (xs: Card[]) => xs.slice().sort((a, b) => power(a, m) - power(b, m));

  if (m === "null") {
    const decl = s.declarer === me;
    if (!lead) return byPower(ok)[0];
    const under = ok.filter((x) => !beats(x, wCard!, lead, m));
    if (decl) return under.length ? byPower(under).at(-1)! : byPower(ok).at(-1)!;
    const dPlayed = s.trick.some((p) => p.id === s.declarer);
    if (!dPlayed) return byPower(ok)[0];
    if (w === s.declarer) return under.length ? byPower(under).at(-1)! : byPower(ok)[0];
    return byPower(ok).at(-1)!;
  }

  if (m === "ramsch") {
    const cost = (x: Card) => augenOf(x) * 2 + power(x, m) / 10;
    if (!lead) return ok.reduce((a, b) => (cost(b) < cost(a) ? b : a));
    const losing = ok.filter((x) => !beats(x, wCard!, lead, m));
    if (losing.length) return losing.reduce((a, b) => (augenOf(b) + power(b, m) / 20 > augenOf(a) + power(a, m) / 20 ? b : a));
    return ok.reduce((a, b) => (augenOf(b) - power(b, m) / 20 < augenOf(a) - power(a, m) / 20 ? b : a));
  }

  const d = s.declarer;
  const friend = (id: string) => id === me || (me !== d && id !== d);
  const rest = unseen(s, me);
  const top = (x: Card, l: string) => !rest.some((u) => beats(u, x, l, m));
  const cost = (x: Card) => augenOf(x) + (isTrump(x, m) ? power(x, m) / 12 : 0);
  const cheap = (xs: Card[]) => xs.reduce((a, b) => (cost(b) < cost(a) ? b : a));

  if (!lead) {
    const trumps = ok.filter((x) => isTrump(x, m));
    const fehl = ok.filter((x) => !isTrump(x, m));
    const oppTrumps = rest.filter((x) => isTrump(x, m)).length;
    if (me === d && trumps.length && oppTrumps > 0) {
      const sure = trumps.filter((x) => top(x, "trumpf"));
      if (sure.length) return sure.reduce((a, b) => (power(b, m) < power(a, m) ? b : a));
      if (trumps.length >= 3) return cheap(trumps);
    }
    const sureFehl = fehl.filter((x) => top(x, suitOf(x)));
    if (sureFehl.length) return sureFehl.reduce((a, b) => (augenOf(b) > augenOf(a) ? b : a));
    if (fehl.length) {
      // Verteidiger: lieber eine kurze Farbe ohne Zehn anspielen
      const risk = (x: Card) => augenOf(x) * 2 + hand.filter((h) => !isTrump(h, m) && suitOf(h) === suitOf(x)).length;
      return fehl.reduce((a, b) => (risk(b) < risk(a) ? b : a));
    }
    return cheap(ok);
  }

  const trickOrder = s.active.slice(s.active.indexOf(s.trick[0].id)).concat(s.active.slice(0, s.active.indexOf(s.trick[0].id)));
  const after = trickOrder.slice(s.trick.length + 1);
  const last = !after.length;
  const pot = sumAugen(s.trick.map((p) => p.card));
  const winning = ok.filter((x) => beats(x, wCard!, lead, m));
  const partnerWins = w !== me && friend(w!);
  if (partnerWins && (last || after.every(friend) || top(wCard!, lead))) {
    // schmieren: viele Augen, aber keinen Buben
    const pool = ok.filter((x) => !isJack(x) && !(isTrump(x, m) && augenOf(x) >= 10 && !last));
    return (pool.length ? pool : ok).reduce((a, b) => (augenOf(b) - (isJack(b) ? 5 : 0) > augenOf(a) - (isJack(a) ? 5 : 0) ? b : a));
  }
  if (winning.length && !partnerWins) {
    const sure = winning.filter((x) => last || after.every(friend) || top(x, lead));
    if (sure.length) {
      const best = sure.reduce((a, b) => (power(b, m) - (last ? augenOf(b) * 0.3 : 0) < power(a, m) - (last ? augenOf(a) * 0.3 : 0) ? b : a));
      if (pot + augenOf(best) >= 4 || !isTrump(best, m) || power(best, m) < 98) return best;
    }
    if (pot >= 10) return winning.reduce((a, b) => (power(b, m) > power(a, m) ? b : a));
  }
  const losers = ok.filter((x) => !beats(x, wCard!, lead, m));
  return cheap(losers.length ? losers : ok);
}

/** Was die App für einen Platz tut (Bots ohne Gerät, Zugzeit um, Host übernimmt) */
function autoMove(s: SkState, ctx: GameContext, id: string) {
  const view = viewFor(s, id);
  if (s.phase === "bid") {
    const a = suggestBid(view, id);
    if (a.type === "bid") doBid(s, ctx, id, a.value);
    else if (a.type === "hold") doHold(s, ctx, id);
    else doPass(s, ctx, id);
  } else if (s.phase === "skat") takeOrHand(s, ctx, id, suggestSkat(view, id));
  else if (s.phase === "discard") doDiscard(s, ctx, id, suggestDiscard(view, id));
  else if (s.phase === "declare") doDeclare(s, ctx, id, suggestGame(view, id));
  else if (s.phase === "play") {
    const card = suggestCard(view, id);
    if (card) playCard(s, ctx, id, card);
  }
}

function takeOrHand(s: SkState, ctx: GameContext, id: string, take: boolean) {
  if (take) {
    s.tookSkat = true;
    s.hands[id] = sortHand([...s.hands[id], ...s.skat], "grand");
    s.skat = [];
    s.phase = "discard";
    addLog(s, `${nameOf(s, id)} nimmt den Skat`);
  } else {
    s.tookSkat = false;
    s.phase = "declare";
    addLog(s, `${nameOf(s, id)} spielt Hand`);
  }
  s.n++;
  startTurn(s, ctx, id);
}

function doDiscard(s: SkState, ctx: GameContext, id: string, cards: Card[]) {
  s.hands[id] = s.hands[id].filter((c) => !cards.includes(c));
  s.skat = [...cards];
  s.phase = "declare";
  addLog(s, `${nameOf(s, id)} hat gedrückt`);
  s.n++;
  startTurn(s, ctx, id);
}

/** Plätze ohne Gerät spielt die App sofort */
function runGhosts(s: SkState, ctx: GameContext) {
  for (let i = 0; i < 200 && s.phase !== "roundEnd" && s.phase !== "over" && s.curId && s.ghosts.includes(s.curId); i++) autoMove(s, ctx, s.curId);
}

// ---------------------------------------------------------------- Züge

function apply(prev: SkState, a: SkAction, ctx: GameContext): SkState {
  if (prev.phase === "over") throw new GameError("Die Partie ist vorbei.");
  if (a.type === "timeUp") {
    if (prev.phase === "roundEnd" || !prev.curId || prev.deadline === null || ctx.now < prev.deadline - GRACE) return prev;
    const s = structuredClone(prev);
    addLog(s, `Zeit um – für ${nameOf(s, s.curId)} entschieden`);
    autoMove(s, ctx, s.curId!);
    runGhosts(s, ctx);
    sync(s);
    return s;
  }
  const s = structuredClone(prev);
  const me = s.curId;
  switch (a.type) {
    case "bid":
    case "hold":
    case "pass": {
      if (s.phase !== "bid" || !s.bidding || !me) throw new GameError("Gerade wird nicht gereizt.");
      if (a.type === "bid") doBid(s, ctx, me, a.value);
      else if (a.type === "hold") doHold(s, ctx, me);
      else doPass(s, ctx, me);
      s.n++;
      break;
    }
    case "skat": {
      if (s.phase !== "skat" || !me) throw new GameError("Der Skat ist schon entschieden.");
      takeOrHand(s, ctx, me, a.take !== false);
      break;
    }
    case "discard": {
      if (s.phase !== "discard" || !me) throw new GameError("Gerade wird nicht gedrückt.");
      const cards = Array.isArray(a.cards) ? a.cards : [];
      if (cards.length !== 2 || cards[0] === cards[1] || !cards.every((c) => isSkCard(c) && s.hands[me].includes(c))) throw new GameError("Drücke genau zwei deiner Karten.");
      doDiscard(s, ctx, me, cards);
      break;
    }
    case "declare": {
      if (s.phase !== "declare" || !me) throw new GameError("Gerade wird nicht angesagt.");
      const why = declareWhyNot(s, a);
      if (why) throw new GameError(why);
      doDeclare(s, ctx, me, normalized(s, a));
      s.n++;
      break;
    }
    case "play": {
      if (s.phase !== "play" || !me) throw new GameError("Gerade wird nicht gespielt.");
      if (!isSkCard(a.card)) throw new GameError("Diese Karte gibt es nicht.");
      const why = whyNot(s, s.hands[me] ?? [], a.card);
      if (why) throw new GameError(why);
      playCard(s, ctx, me, a.card);
      break;
    }
    case "nextRound": {
      if (s.phase !== "roundEnd") throw new GameError("Die Runde läuft noch.");
      nextRound(s, ctx);
      break;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
  runGhosts(s, ctx);
  sync(s);
  return s;
}

function nextRound(s: SkState, ctx: GameContext) {
  s.round++;
  s.dealerId = nextSeat(s, s.dealerId);
  deal(s, ctx);
}

/** Ist die Hand des Alleinspielers offen (ouvert)? */
export const openHand = (s: Pick<SkState, "game" | "phase">) => !!s.game?.ouvert && (s.phase === "play" || s.phase === "roundEnd" || s.phase === "over");

/** Sicht eines Spielers: die eigene Hand (offen gespielt auch die des Alleinspielers), den Skat nur der Alleinspieler */
export function viewFor(s: SkState, viewer: string | null): SkState {
  if (viewer === null) return s;
  const done = s.phase === "roundEnd" || s.phase === "over";
  const hands: Record<string, Card[]> = {};
  if (viewer in s.hands) hands[viewer] = s.hands[viewer];
  if (openHand(s) && s.declarer) hands[s.declarer] = s.hands[s.declarer];
  return { ...s, hands, skat: done || (s.declarer === viewer && s.tookSkat) ? s.skat : [] };
}

export function leaders(s: SkState, ids: string[]): string[] {
  if (!ids.length) return [];
  const best = Math.max(...ids.map((id) => s.scores[id] ?? 0));
  return ids.filter((id) => (s.scores[id] ?? 0) === best);
}

export const skat: GameLogic<SkState, SkAction> = {
  info: {
    id: "skat",
    name: "Skat",
    tagline: "Reizen, Skat aufnehmen, allein gegen zwei: Farbspiel, Grand oder Null – mit Spitzen und Schneider.",
    category: "Karten",
    minPlayers: 1,
    maxPlayers: 4,
    duration: "45–90 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  playerLimits: () => ({ min: 1, max: 4, note: "Drei spielen – zu viert sitzt der Geber aus, fehlende Plätze spielen Bots" }),
  presets: [
    { id: "ramsch", label: "Mit Ramsch", hint: "alle passen → Ramsch", options: { ramsch: true } },
    { id: "einsteiger", label: "Einsteiger", hint: "Ramsch, verloren einfach", options: { ramsch: true, jungfrau: false, double: false } },
  ],
  settings: [
    {
      key: "rounds", label: "Partie über", type: "choice", default: "12",
      choices: [
        { value: "3", label: "3 Spiele", hint: "kurz" },
        { value: "6", label: "6 Spiele" },
        { value: "12", label: "12 Spiele", hint: "jeder gibt gleich oft" },
        { value: "24", label: "24 Spiele" },
        { value: "36", label: "36 Spiele", hint: "eine volle Liste" },
      ],
    },
    { key: "ramsch", label: "Ramsch", type: "toggle", default: false, hint: "Passen alle, wird Ramsch gespielt: wer die meisten Augen hat, verliert sie – sonst eingepasst", group: "Hausregeln" },
    { key: "jungfrau", label: "Jungfrau", type: "toggle", default: true, hint: "Ramsch: wer keinen Stich macht, verdoppelt die Minuspunkte", group: "Hausregeln" },
    { key: "double", label: "Verloren doppelt", type: "toggle", default: true, hint: "Verlorene Spiele zählen doppelt minus – sonst einfach", group: "Hausregeln" },
    {
      key: "pictures", label: "Kartenbild", type: "choice", default: "fr",
      choices: [
        { value: "fr", label: "Französisch", hint: "Kreuz, Pik, Herz, Karo" },
        { value: "de", label: "Deutsch", hint: "Eichel, Grün, Rot, Schellen" },
      ],
    },
    {
      key: "think", label: "Zugzeit", type: "choice", default: "off", group: "Ablauf",
      choices: [
        { value: "30", label: "30 Sek." },
        { value: "60", label: "1 Min." },
        { value: "120", label: "2 Min." },
        { value: "off", label: "Ohne", hint: "der Host kann weiterschalten" },
      ],
    },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt Reizen, Spiel, Stiche und die Abrechnung an (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "nextRound" || a.type === "timeUp" ? "player" : ["bid", "hold", "pass", "skat", "discard", "declare", "play"].includes(a.type) ? "turn" : null),
  currentPlayerId: (s) => (s.phase === "roundEnd" || s.phase === "over" ? null : s.curId),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const ids = ctx.players.map((p) => p.id).filter((id) => s.seats.includes(id));
    const win = leaders(s, s.seats);
    return ids.map((id) => ({ id, won: win.includes(id), score: s.scores[id] ?? 0 }));
  },
  skipLabel: (s) => {
    if (s.phase === "roundEnd") return `Spiel ${s.round + 1} geben`;
    if (!s.curId) return null;
    if (s.phase === "bid") return `Für ${nameOf(s, s.curId)} „passe“ sagen`;
    if (s.phase === "play") return `Für ${nameOf(s, s.curId)} eine Karte spielen`;
    return `Für ${nameOf(s, s.curId)} entscheiden`;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "roundEnd") nextRound(s, ctx);
    else if (s.phase === "bid" && s.curId) { addLog(s, `Für ${nameOf(s, s.curId)} gesagt`); doPass(s, ctx, s.curId); }
    else if (s.curId && s.phase !== "over") { addLog(s, `Für ${nameOf(s, s.curId)} entschieden`); autoMove(s, ctx, s.curId); }
    runGhosts(s, ctx);
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!s.seats.includes(id) || s.ghosts.includes(id)) return s;
    s.ghosts.push(id);
    s.names[id] = `${s.names[id] ?? "?"} (Bot)`;
    if (s.phase !== "over") addLog(s, `${prev.names[id] ?? "?"} ist raus – ein Bot spielt den Platz weiter`);
    if (s.curId === id) s.deadline = null;
    runGhosts(s, ctx);
    sync(s);
    return s;
  },
  botPause: (s) => (s.phase === "roundEnd" ? 6000 : s.phase === "play" && !s.trick.length && s.tricks.length ? 1400 : 0),
  view: viewFor,
};
