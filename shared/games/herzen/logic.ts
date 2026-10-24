/**
 * Herzen – Stichspiel mit französischem Blatt (52 Karten), 3–6 Spieler, klassisch zu viert. Ziel: möglichst wenig Punkte.
 * Jedes Herz zählt 1, die Pik-Dame 13. Vor jeder Runde gibt jeder drei Karten weiter (links, rechts, gegenüber, keine –
 * im Wechsel). Kreuz-Zwei spielt aus, Farbe bedienen ist Pflicht, Herz darf erst ausgespielt werden, wenn es „gebrochen“ ist.
 * Wer alle Strafkarten holt, „schießt den Mond“: er bekommt 0, alle anderen 26. Ende, sobald jemand das Ziel erreicht –
 * es gewinnt, wer am wenigsten hat.
 *
 * Läuft in der App (online jeder am eigenen Handy, an einem Handy mit Sichtschutz). Hände und Weitergabe bleiben geheim.
 */
import { DECKS, fullDeck, isCardOf, rankOf, suitOf, type Card, type Suit } from "../../cards/deck";
import { shuffle } from "../../platform/random";
import { dealerBefore, nextPlayerId, playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export type PassDir = "left" | "right" | "across" | "none";
export const DIR_NAME: Record<PassDir, string> = { left: "nach links", right: "nach rechts", across: "nach gegenüber", none: "keine" };

const DECK = DECKS.fr52;
export const START_CARD: Card = "kreuz-2";
export const QUEEN: Card = "pik-D";
/** Reihenfolge in der Hand: Farben abwechselnd schwarz/rot */
const HAND_SUITS: Suit[] = ["kreuz", "karo", "pik", "herz"];
export const rankValue = (c: Card) => DECK.ranks.indexOf(rankOf(c));
export const sortHand = (h: Card[]) => h.slice().sort((a, b) => HAND_SUITS.indexOf(suitOf(a)) - HAND_SUITS.indexOf(suitOf(b)) || rankValue(a) - rankValue(b));

/** Strafpunkte einer Karte */
export const cardPoints = (c: Card) => (c === QUEEN ? 13 : suitOf(c) === "herz" ? 1 : 0);
export const MOON = 26;

/** Damit alle gleich viele Karten haben: zu dritt ohne Karo-2, zu fünft auch ohne Pik-2, zu sechst auch ohne Karo-3 und Pik-3 */
export function removedFor(n: number): Card[] {
  if (n === 3) return ["karo-2"];
  if (n === 5) return ["karo-2", "pik-2"];
  if (n === 6) return ["karo-2", "pik-2", "karo-3", "pik-3"];
  return [];
}
export const deckFor = (n: number): Card[] => fullDeck(DECK).filter((c) => !removedFor(n).includes(c));

export interface Play { id: string; card: Card }
export interface RoundRecord {
  round: number;
  dir: PassDir;
  /** geholte Strafpunkte */
  taken: Record<string, number>;
  /** Punkte, die angerechnet wurden (nach „Mond“) */
  points: Record<string, number>;
  moon: string | null;
}

export interface HzState {
  v: 1;
  round: number;
  target: number;
  phase: "pass" | "play" | "roundEnd" | "over";
  /** gibt in dieser Runde (wandert reihum) */
  dealerId: string | null;
  dir: PassDir;
  hands: Record<string, Card[]>;
  counts: Record<string, number>;
  /** weggelegte Karten (für alle sichtbar, sie sind bekannt) */
  removed: Card[];
  /** gewählte Karten zum Weitergeben – andere sehen nur `passIn` */
  passing: Record<string, Card[] | null>;
  passIn: Record<string, boolean>;
  /** bekommene Karten (nur für den Empfänger sichtbar) */
  received: Record<string, Card[]>;
  trick: Play[];
  lastTrick: { plays: Play[]; winner: string; points: number } | null;
  /** gespielte Stiche der Runde */
  trickNo: number;
  heartsBroken: boolean;
  /** Strafpunkte dieser Runde (offen – am Tisch zählt man mit) */
  taken: Record<string, number>;
  tricks: Record<string, number>;
  scores: Record<string, number>;
  curId: string | null;
  history: RoundRecord[];
  log: string[];
  n: number;
}

export type HzAction =
  | { type: "pass"; cards: Card[]; player?: string }
  | { type: "play"; card: Card }
  | { type: "nextRound" };

export type PassMode = "cycle" | "left" | "none";
interface Rules { target: number; pass: PassMode; moon: boolean; firstPoints: boolean }
export function rulesOf(o: Options): Rules {
  return {
    target: o.target === "50" ? 50 : o.target === "150" ? 150 : 100,
    pass: o.pass === "left" || o.pass === "none" ? o.pass : "cycle",
    moon: o.moon !== false,
    firstPoints: o.firstPoints === true,
  };
}

/** Richtung der Runde: zu viert (und zu sechst) links, rechts, gegenüber, keine – sonst links, rechts, keine */
export function dirFor(round: number, n: number, o: Options): PassDir {
  const r = rulesOf(o);
  if (r.pass === "none") return "none";
  if (r.pass === "left") return "left";
  const cycle: PassDir[] = n % 2 === 0 ? ["left", "right", "across", "none"] : ["left", "right", "none"];
  return cycle[(round - 1) % cycle.length];
}

/** An wen gibt `id` seine Karten? (links = nächster Platz) */
export function passTarget(players: Player[], id: string, dir: PassDir): string {
  const i = players.findIndex((p) => p.id === id);
  const n = players.length;
  const k = dir === "left" ? 1 : dir === "right" ? n - 1 : dir === "across" ? Math.floor(n / 2) : 0;
  return players[(i + k) % n].id;
}

const MAX_LOG = 60;
const nameOf = playerName;
const cardText = (c: Card) => (c === QUEEN ? "Pik-Dame" : `${({ kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" } as Record<string, string>)[suitOf(c)]}-${({ B: "Bube", D: "Dame", K: "König", A: "Ass" } as Record<string, string>)[rankOf(c)] ?? rankOf(c)}`);
export const cardLabel = cardText;

export const leadSuit = (trick: Play[]): Suit | null => (trick.length ? suitOf(trick[0].card) : null);

/** Darf `card` gerade gespielt werden? Gibt den Grund zurück, warum nicht (oder null). */
export function whyNot(s: HzState, hand: Card[], card: Card, o: Options): string | null {
  if (!hand.includes(card)) return "Diese Karte hast du nicht.";
  const first = s.trickNo === 0;
  if (!s.trick.length) {
    if (first && hand.includes(START_CARD)) return card === START_CARD ? null : "Die Kreuz-Zwei spielt aus.";
    if (suitOf(card) === "herz" && !s.heartsBroken && hand.some((c) => suitOf(c) !== "herz")) return "Herz ist noch nicht gebrochen.";
    return null;
  }
  const lead = leadSuit(s.trick)!;
  if (suitOf(card) !== lead && hand.some((c) => suitOf(c) === lead)) return `Du musst ${({ kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" } as Record<string, string>)[lead]} bedienen.`;
  // Im ersten Stich keine Punkte – außer man hat nichts anderes
  if (first && !rulesOf(o).firstPoints && cardPoints(card) > 0 && hand.some((c) => cardPoints(c) === 0 && (suitOf(c) === lead || !hand.some((x) => suitOf(x) === lead)))) return "Im ersten Stich keine Punkte.";
  return null;
}
export const canPlay = (s: HzState, hand: Card[], card: Card, o: Options) => whyNot(s, hand, card, o) === null;

/** Wer gewinnt den Stich? Die höchste Karte der ausgespielten Farbe. */
export function trickWinner(trick: Play[]): string {
  const lead = leadSuit(trick);
  return trick.filter((p) => suitOf(p.card) === lead).reduce((a, b) => (rankValue(b.card) > rankValue(a.card) ? b : a)).id;
}

function sync(s: HzState) {
  s.counts = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length]));
  s.passIn = Object.fromEntries(Object.entries(s.passing).map(([id, p]) => [id, !!p]));
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

const holderOf = (s: HzState, card: Card) => Object.keys(s.hands).find((id) => s.hands[id].includes(card)) ?? null;

/** Neue Runde: mischen, austeilen, Richtung festlegen */
function deal(s: HzState, ctx: GameContext) {
  const ids = ctx.players.map((p) => p.id);
  const deck = shuffle(deckFor(ids.length));
  const per = deck.length / ids.length;
  s.hands = Object.fromEntries(ids.map((id, i) => [id, sortHand(deck.slice(i * per, (i + 1) * per))]));
  s.removed = removedFor(ids.length);
  s.dir = dirFor(s.round, ids.length, ctx.options);
  s.passing = Object.fromEntries(ids.map((id) => [id, null]));
  s.received = {};
  s.trick = [];
  s.lastTrick = null;
  s.trickNo = 0;
  s.heartsBroken = false;
  s.taken = Object.fromEntries(ids.map((id) => [id, 0]));
  s.tricks = Object.fromEntries(ids.map((id) => [id, 0]));
  s.log.push(`Runde ${s.round}: ${s.dir === "none" ? "ohne Weitergeben" : `drei Karten ${DIR_NAME[s.dir]}`}`);
  if (s.dir === "none") startPlay(s, ctx);
  else { s.phase = "pass"; s.curId = null; }
}

function startPlay(s: HzState, ctx: GameContext) {
  s.phase = "play";
  s.curId = holderOf(s, START_CARD);
  s.log.push(`${nameOf(ctx, s.curId)} hat die Kreuz-Zwei und spielt aus`);
}

function setup(ctx: GameContext): HzState {
  const r = rulesOf(ctx.options);
  const ids = ctx.players.map((p) => p.id);
  const s: HzState = {
    v: 1, round: 1, target: r.target, phase: "pass", dealerId: dealerBefore(ctx) ?? ids[0] ?? null, dir: "left",
    hands: {}, counts: {}, removed: [], passing: {}, passIn: {}, received: {}, trick: [], lastTrick: null, trickNo: 0, heartsBroken: false,
    taken: {}, tricks: {}, scores: Object.fromEntries(ids.map((id) => [id, 0])), curId: null, history: [], log: [], n: 0,
  };
  deal(s, ctx);
  sync(s);
  return s;
}

/** Alle haben gewählt: Karten tauschen, dann spielt die Kreuz-Zwei aus */
function exchange(s: HzState, ctx: GameContext) {
  const out: Record<string, Card[]> = {};
  for (const p of ctx.players) {
    const give = s.passing[p.id] ?? [];
    const to = passTarget(ctx.players, p.id, s.dir);
    s.hands[p.id] = s.hands[p.id].filter((c) => !give.includes(c));
    (out[to] ??= []).push(...give);
  }
  for (const p of ctx.players) {
    s.received[p.id] = sortHand(out[p.id] ?? []);
    s.hands[p.id] = sortHand([...s.hands[p.id], ...(out[p.id] ?? [])]);
  }
  s.passing = Object.fromEntries(ctx.players.map((p) => [p.id, null]));
  s.log.push(`Alle haben ${DIR_NAME[s.dir]} weitergegeben`);
  startPlay(s, ctx);
}

function checkPass(s: HzState, who: string, cards: unknown) {
  if (!Array.isArray(cards) || cards.length !== 3 || new Set(cards).size !== 3) throw new GameError("Wähle genau drei Karten.");
  for (const c of cards) if (!isCardOf(DECK, c) || !s.hands[who]?.includes(c)) throw new GameError("Diese Karte hast du nicht.");
}

/** Runde werten: Mond schießen, Punkte anrechnen, Ende prüfen */
function score(s: HzState, ctx: GameContext) {
  const r = rulesOf(ctx.options);
  const moon = r.moon ? ctx.players.find((p) => (s.taken[p.id] ?? 0) === MOON)?.id ?? null : null;
  const rec: RoundRecord = { round: s.round, dir: s.dir, taken: { ...s.taken }, points: {}, moon };
  for (const p of ctx.players) {
    const pts = moon ? (p.id === moon ? 0 : MOON) : (s.taken[p.id] ?? 0);
    rec.points[p.id] = pts;
    s.scores[p.id] = (s.scores[p.id] ?? 0) + pts;
  }
  s.history.push(rec);
  s.log.push(moon ? `${nameOf(ctx, moon)} schießt den Mond – alle anderen bekommen 26` : `Runde ${s.round} gewertet`);
  s.curId = null;
  s.phase = ctx.players.some((p) => (s.scores[p.id] ?? 0) >= s.target) ? "over" : "roundEnd";
}

function playCard(s: HzState, ctx: GameContext, me: string, card: Card) {
  const hand = s.hands[me];
  hand.splice(hand.indexOf(card), 1);
  s.trick.push({ id: me, card });
  if (suitOf(card) === "herz" && !s.heartsBroken) { s.heartsBroken = true; s.log.push("Herz ist gebrochen!"); }
  s.n++;
  if (s.trick.length < ctx.players.length) { s.curId = nextPlayerId(ctx.players, me); return; }
  const w = trickWinner(s.trick);
  const pts = s.trick.reduce((t, p) => t + cardPoints(p.card), 0);
  s.taken[w] = (s.taken[w] ?? 0) + pts;
  s.tricks[w] = (s.tricks[w] ?? 0) + 1;
  s.lastTrick = { plays: s.trick, winner: w, points: pts };
  s.log.push(`${nameOf(ctx, w)} nimmt den Stich${pts ? ` (${pts} ${pts === 1 ? "Punkt" : "Punkte"}${s.trick.some((p) => p.card === QUEEN) ? ", mit der Pik-Dame" : ""})` : ""}`);
  s.trick = [];
  s.trickNo++;
  s.curId = w;
  if (Object.values(s.hands).every((h) => h.length === 0)) score(s, ctx);
}

function apply(prev: HzState, a: HzAction, ctx: GameContext): HzState {
  const s = structuredClone(prev);
  if (s.phase === "over") throw new GameError("Die Partie ist vorbei.");
  const actor = ctx.actorId;
  switch (a.type) {
    case "pass": {
      if (s.phase !== "pass") throw new GameError("Gerade wird nicht weitergegeben.");
      const who = a.player ?? actor;
      if (!who || !(who in s.hands)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (actor !== null && who !== actor) throw new GameError("Gib nur deine eigenen Karten weiter.");
      if (s.passing[who]) throw new GameError("Du hast schon weitergegeben.");
      checkPass(s, who, a.cards);
      s.passing[who] = a.cards.slice();
      if (ctx.players.every((p) => s.passing[p.id])) exchange(s, ctx);
      break;
    }
    case "play": {
      if (s.phase !== "play" || !s.curId) throw new GameError("Gerade wird nicht gespielt.");
      const why = whyNot(s, s.hands[s.curId] ?? [], a.card, ctx.options);
      if (why) throw new GameError(why);
      playCard(s, ctx, s.curId, a.card);
      break;
    }
    case "nextRound": {
      if (s.phase !== "roundEnd") throw new GameError("Die Runde läuft noch.");
      s.round++;
      s.dealerId = nextPlayerId(ctx.players, s.dealerId);
      deal(s, ctx);
      break;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
  sync(s);
  return s;
}

/** Wer am wenigsten hat, gewinnt (Gleichstand: alle) */
export function leaders(s: HzState, players: Player[]): string[] {
  if (!players.length) return [];
  const best = Math.min(...players.map((p) => s.scores[p.id] ?? 0));
  return players.filter((p) => (s.scores[p.id] ?? 0) === best).map((p) => p.id);
}

/** Wie gefährlich ist eine Karte auf der Hand? (zum Weitergeben: die drei gefährlichsten) */
function danger(c: Card, hand: Card[]): number {
  const spades = hand.filter((x) => suitOf(x) === "pik").length;
  if (c === QUEEN) return spades >= 5 ? 20 : 100;
  if (suitOf(c) === "pik" && rankValue(c) > rankValue(QUEEN)) return spades >= 5 ? 10 : 80;
  const short = hand.filter((x) => suitOf(x) === suitOf(c)).length <= 2 ? 6 : 0;
  return rankValue(c) * (suitOf(c) === "herz" ? 4 : 3) + short;
}
/** Vorschlag zum Weitergeben (Bots, „überspringen“): die drei gefährlichsten Karten */
export const suggestPass = (hand: Card[]): Card[] => hand.slice().sort((a, b) => danger(b, hand) - danger(a, hand)).slice(0, 3);

/**
 * Vorschlag für die nächste Karte: unter dem Stich bleiben, wenn es geht; sonst so hoch wie nötig.
 * Abwerfen: Pik-Dame, dann hohe Pik, dann Herz, dann die höchste Karte. Ausspielen: niedrig.
 */
export function suggestCard(s: HzState, hand: Card[], o: Options): Card | null {
  const ok = hand.filter((c) => canPlay(s, hand, c, o));
  if (!ok.length) return null;
  if (ok.length === 1) return ok[0];
  const hi = (xs: Card[]) => xs.reduce((a, b) => (rankValue(b) > rankValue(a) ? b : a));
  const lo = (xs: Card[]) => xs.reduce((a, b) => (rankValue(b) < rankValue(a) ? b : a));
  if (!s.trick.length) {
    // Pik niedrig ausspielen lockt die Dame – nur wenn man sie nicht selbst hat
    const safe = ok.filter((c) => suitOf(c) !== "herz" && !(suitOf(c) === "pik" && rankValue(c) >= rankValue(QUEEN)));
    return lo(safe.length ? safe : ok);
  }
  const lead = leadSuit(s.trick)!;
  const follow = ok.filter((c) => suitOf(c) === lead);
  if (follow.length) {
    const top = s.trick.filter((p) => suitOf(p.card) === lead).reduce((a, b) => (rankValue(b.card) > rankValue(a.card) ? b : a)).card;
    const under = follow.filter((c) => rankValue(c) < rankValue(top) && c !== QUEEN);
    if (under.length) return hi(under);
    const last = s.trick.length === Object.keys(s.counts).length - 1;
    const pts = s.trick.reduce((t, p) => t + cardPoints(p.card), 0);
    const noQueen = follow.filter((c) => c !== QUEEN);
    // Als Letzter ohne Punkte im Stich: die höchste loswerden – sonst so niedrig wie möglich
    return last && pts === 0 ? hi(noQueen.length ? noQueen : follow) : lo(noQueen.length ? noQueen : follow);
  }
  if (ok.includes(QUEEN)) return QUEEN;
  const bigSpades = ok.filter((c) => suitOf(c) === "pik" && rankValue(c) > rankValue(QUEEN));
  if (bigSpades.length) return hi(bigSpades);
  const hearts = ok.filter((c) => suitOf(c) === "herz");
  if (hearts.length) return hi(hearts);
  return hi(ok);
}

export const herzen: GameLogic<HzState, HzAction> = {
  info: {
    id: "herzen",
    name: "Herzen",
    tagline: "Stiche vermeiden: jedes Herz kostet, die Pik-Dame richtig – oder du schießt den Mond.",
    category: "Karten",
    minPlayers: 3,
    maxPlayers: 6,
    duration: "30–60 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  presets: [
    { id: "kurz", label: "Kurz", hint: "bis 50 Punkte", options: { target: "50" } },
    { id: "locker", label: "Locker", hint: "ohne Weitergeben", options: { pass: "none", firstPoints: true } },
  ],
  settings: [
    {
      key: "target", label: "Spielende", type: "choice", default: "100",
      choices: [
        { value: "100", label: "100 Punkte", hint: "wie im Original" },
        { value: "50", label: "50 Punkte", hint: "kürzere Partie" },
        { value: "150", label: "150 Punkte", hint: "lange Partie" },
      ],
    },
    {
      key: "pass", label: "Weitergeben", type: "choice", default: "cycle",
      choices: [
        { value: "cycle", label: "Im Wechsel", hint: "links, rechts, gegenüber, keine" },
        { value: "left", label: "Immer links", hint: "jede Runde drei Karten" },
        { value: "none", label: "Nie", hint: "gleich losspielen" },
      ],
    },
    { key: "moon", label: "Mond schießen", type: "toggle", default: true, hint: "Wer alle Herzen und die Pik-Dame holt, bekommt 0 – alle anderen 26", group: "Hausregeln" },
    { key: "firstPoints", label: "Punkte im ersten Stich", type: "toggle", default: false, hint: "Herz und Pik-Dame dürfen schon im ersten Stich fallen", group: "Hausregeln" },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt Weitergeben, Ausspielen, „Herz gebrochen“ und die Wertung an (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "play" ? "turn" : a.type === "pass" || a.type === "nextRound" ? "player" : null),
  currentPlayerId: (s) => (s.phase === "play" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const win = leaders(s, ctx.players);
    return ctx.players.map((p) => ({ id: p.id, won: win.includes(p.id), score: s.scores[p.id] ?? 0 }));
  },
  skipLabel: (s, ctx) => {
    if (s.phase === "pass") {
      const open = ctx.players.filter((p) => !s.passIn[p.id]).map((p) => p.name);
      return open.length ? `Für ${open.join(", ")} weitergeben` : null;
    }
    if (s.phase === "play" && s.curId) return `Für ${nameOf(ctx, s.curId)} eine Karte spielen`;
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "pass") {
      const open = ctx.players.filter((p) => !s.passing[p.id]);
      for (const p of open) s.passing[p.id] = suggestPass(s.hands[p.id] ?? []);
      if (open.length) s.log.push(`Für ${open.map((p) => p.name).join(", ")} weitergegeben`);
      exchange(s, ctx);
    } else if (s.phase === "play" && s.curId) {
      const c = suggestCard(s, s.hands[s.curId] ?? [], ctx.options);
      if (c) { s.log.push(`Für ${nameOf(ctx, s.curId)} gespielt`); playCard(s, ctx, s.curId, c); }
    }
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    for (const m of [s.scores, s.passing, s.taken, s.tricks, s.hands, s.received]) delete (m as Record<string, unknown>)[id];
    if (s.phase === "over") { sync(s); return s; }
    if (rest.length < 3) {
      s.log.push(`${nameOf(ctx, id)} ist raus – zu zweit geht Herzen nicht, die Partie endet`);
      s.phase = "over"; s.curId = null; sync(s); return s;
    }
    if (s.dealerId === id) s.dealerId = nextPlayerId(rest, rest[0].id);
    if (s.phase !== "roundEnd") {
      s.log.push(`${nameOf(ctx, id)} ist raus – Runde ${s.round} wird neu gegeben`);
      deal(s, { ...ctx, players: rest });
    }
    sync(s);
    return s;
  },
  botPause: (s) => (s.phase === "roundEnd" ? 3500 : s.phase === "play" && !s.trick.length && s.lastTrick ? 1200 : 0),
  view: (s, viewer) => {
    if (viewer === null) return s;
    const own = <T,>(m: Record<string, T>) => (viewer in m ? { [viewer]: m[viewer] } : {});
    return { ...s, hands: own(s.hands), received: own(s.received), passing: Object.fromEntries(Object.keys(s.passing).map((id) => [id, id === viewer ? s.passing[id] : null])) };
  },
};
