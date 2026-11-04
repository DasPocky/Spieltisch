/**
 * Doppelkopf – Stichspiel zu viert mit doppeltem Blatt (48 Karten: 9, Bube, Dame, König, 10, Ass in vier Farben, jede
 * Karte zweimal; ohne Neunen 40). Regeln nach verbreiteter Turnierordnung, vereinfacht:
 *  - Trumpf von hoch nach niedrig: Herz-10 (Dulle), die vier Damen, die vier Buben (je Kreuz, Pik, Herz, Karo), dann
 *    Karo-Ass, Karo-10, Karo-König, Karo-9. Fehlfarben Kreuz/Pik: A, 10, K, 9 – Herz: A, K, 9. Gleiche Karten: die erste sticht.
 *  - Parteien: Re hat die Kreuz-Damen („die Alten“), Kontra die anderen. Wer beide hat, spielt Hochzeit (der erste Stich
 *    eines anderen in den ersten drei macht ihn zum Partner, sonst spielt er allein) oder still allein.
 *  - Vorbehalte vor dem ersten Stich: gesund, Hochzeit oder Solo (Damen, Buben, Fleischlos, Farbe) – das erste Solo gilt.
 *  - Augen: Ass 11, Zehn 10, König 4, Dame 3, Bube 2, Neun 0 – zusammen 240. Re gewinnt mit 121.
 *  - Ansagen „Re“/„Kontra“ bis vor der zweiten eigenen Karte, Absagen „keine 90/60/30/schwarz“ je eine Karte später.
 *  - Wertung: gewonnen 1, gegen die Alten 1, Ansagen je 2, je Stufe (keine 90/60/30, schwarz) 1, Absagen je 1; dazu
 *    Doppelkopf (Stich mit 40 Augen), Fuchs gefangen, Karlchen (letzter Stich mit dem Kreuz-Buben). Solo zählt dreifach.
 *
 * Immer vier Plätze: Fehlen Mitspieler oder steigt jemand aus, spielt die App diese Plätze (Bots ohne Gerät).
 * Server-autoritativ, Hände und Vorbehalte geheim; wer zu welcher Partei gehört, steht erst fest, wenn es am Tisch klar ist.
 */
import { rankOf, suitOf, type Card, type Rank, type Suit } from "../../cards/deck";
import { shuffle } from "../../platform/random";
import { dealerBefore } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";

export const SEATS = 4;
export const DULLE: Card = "herz-10";
export const ALTE: Card = "kreuz-D";
export const FUCHS: Card = "karo-A";
export const KARLCHEN: Card = "kreuz-B";
const SUITS: Suit[] = ["kreuz", "pik", "herz", "karo"];
const RANKS: Rank[] = ["9", "10", "B", "D", "K", "A"];
const DAMEN: Card[] = ["kreuz-D", "pik-D", "herz-D", "karo-D"];
const BUBEN: Card[] = ["kreuz-B", "pik-B", "herz-B", "karo-B"];

export type SoloId = "dame" | "bube" | "fleischlos" | "kreuz" | "pik" | "herz" | "karo";
export const SOLOS: SoloId[] = ["dame", "bube", "fleischlos", "kreuz", "pik", "herz", "karo"];
export type Contract = "normal" | "hochzeit" | SoloId;
export type Reserve = "gesund" | "hochzeit" | SoloId;
export type Party = "re" | "kontra";
export const isSolo = (c: Contract | Reserve | null): c is SoloId => !!c && (SOLOS as string[]).includes(c);

export const SOLO_NAME: Record<SoloId, string> = {
  dame: "Damensolo", bube: "Bubensolo", fleischlos: "Fleischloser",
  kreuz: "Kreuz-Solo", pik: "Pik-Solo", herz: "Herz-Solo", karo: "Karo-Solo",
};
export const SOLO_HINT: Record<SoloId, string> = {
  dame: "nur Damen sind Trumpf", bube: "nur Buben sind Trumpf", fleischlos: "ohne Trumpf",
  kreuz: "Kreuz statt Karo ist Trumpf", pik: "Pik statt Karo ist Trumpf", herz: "Herz statt Karo ist Trumpf", karo: "Trumpf wie immer",
};
/** deutsche Bilder: Eichel, Grün, Rot, Schellen – Ober und Unter */
const DE_SUIT: Record<string, string> = { kreuz: "eichel", pik: "gruen", herz: "rot", karo: "schellen" };
const DE_RANK: Record<string, string> = { D: "O", B: "U" };
export const contractName = (c: Contract | null, o?: Options): string => {
  if (!c || c === "normal") return "Normalspiel";
  if (c === "hochzeit") return "Hochzeit";
  if (o?.pictures === "de" && (c === "kreuz" || c === "pik" || c === "herz" || c === "karo")) return `${({ kreuz: "Eichel", pik: "Grün", herz: "Rot", karo: "Schellen" })[c]}-Solo`;
  if (o?.pictures === "de" && (c === "dame" || c === "bube")) return c === "dame" ? "Obersolo" : "Untersolo";
  return SOLO_NAME[c];
};

/** Augen einer Karte */
export const AUGEN: Record<string, number> = { A: 11, "10": 10, K: 4, D: 3, B: 2, "9": 0 };
export const augenOf = (c: Card) => AUGEN[rankOf(c)] ?? 0;
export const sumAugen = (cs: Card[]) => cs.reduce((t, c) => t + augenOf(c), 0);
const FEHL_RANK: Record<string, number> = { A: 6, "10": 5, K: 4, D: 3, B: 2, "9": 1 };

/** Ansage-Stufen: 1 = Re/Kontra, 2 = keine 90, 3 = keine 60, 4 = keine 30, 5 = schwarz */
export const MAX_CALL = 5;
export const callName = (party: Party, level: number) => (level <= 1 ? (party === "re" ? "Re" : "Kontra") : ["", "", "keine 90", "keine 60", "keine 30", "schwarz"][level]);
const ABSAGE_NEED = [0, 0, 151, 181, 211];

// ---------------------------------------------------------------- Karten und Trumpf

const TRUMP_CACHE = new Map<string, Card[]>();
/** Trümpfe von hoch nach niedrig */
export function trumpsOf(c: Contract | null): Card[] {
  const key = c ?? "normal";
  let t = TRUMP_CACHE.get(key);
  if (!t) {
    if (c === "dame") t = DAMEN;
    else if (c === "bube") t = BUBEN;
    else if (c === "fleischlos") t = [];
    else if (c === "kreuz" || c === "pik" || c === "herz") t = [DULLE, ...DAMEN, ...BUBEN, ...(["A", "10", "K", "9"] as const).map((r) => `${c}-${r}` as Card).filter((x) => x !== DULLE)];
    else t = [DULLE, ...DAMEN, ...BUBEN, "karo-A", "karo-10", "karo-K", "karo-9"];
    TRUMP_CACHE.set(key, t);
  }
  return t;
}
export const isTrump = (card: Card, c: Contract | null) => trumpsOf(c).includes(card);
/** „Farbe“ im Sinne des Bedienens: Trumpf oder die Fehlfarbe */
export const keyOf = (card: Card, c: Contract | null): string => (isTrump(card, c) ? "trumpf" : suitOf(card));
/** Stärke für Vergleiche innerhalb derselben Farbe bzw. im Trumpf (höher ist besser) */
export function power(card: Card, c: Contract | null): number {
  const t = trumpsOf(c);
  const i = t.indexOf(card);
  return i >= 0 ? 100 - i : FEHL_RANK[rankOf(card)] ?? 0;
}

export function deckOf(nines: boolean): Card[] {
  const out: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) if (nines || r !== "9") out.push(`${s}-${r}` as Card, `${s}-${r}` as Card);
  return out;
}
const isDkCard = (x: unknown): x is Card => typeof x === "string" && SUITS.includes(x.split("-")[0] as Suit) && RANKS.includes(x.split("-")[1] as Rank) && x.split("-").length === 2;

/** Hand ordnen: Trümpfe von hoch nach niedrig, dann Kreuz, Pik, Herz, Karo jeweils A, 10, K, D, B, 9 */
export function sortHand(h: Card[], c: Contract | null): Card[] {
  const t = trumpsOf(c);
  const rank = (x: Card) => {
    const i = t.indexOf(x);
    return i >= 0 ? i : 100 + SUITS.indexOf(suitOf(x)) * 10 + (10 - (FEHL_RANK[rankOf(x)] ?? 0));
  };
  return h.slice().sort((a, b) => rank(a) - rank(b));
}

/** Kartenname zum Vorlesen und im Verlauf (mit deutschen Bildern: Eichel-Ober …) */
export function cardText(card: Card, o?: Options): string {
  if (card === DULLE && o?.pictures !== "de") return "Herz-Zehn";
  const s = suitOf(card), r = rankOf(card);
  if (o?.pictures === "de") {
    const suit = ({ kreuz: "Eichel", pik: "Grün", herz: "Rot", karo: "Schellen" } as Record<string, string>)[s];
    const rank = ({ D: "Ober", B: "Unter", K: "König", A: "Ass", "10": "Zehn", "9": "Neun" } as Record<string, string>)[r];
    return `${suit}-${rank}`;
  }
  const suit = ({ kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" } as Record<string, string>)[s];
  const rank = ({ D: "Dame", B: "Bube", K: "König", A: "Ass", "10": "Zehn", "9": "Neun" } as Record<string, string>)[r];
  return `${suit}-${rank}`;
}
/** Kartenbild: mit deutschen Bildern Eichel/Grün/Rot/Schellen, Ober/Unter */
export const shownCard = (card: Card, o?: Options): Card => (o?.pictures === "de" ? `${DE_SUIT[suitOf(card)]}-${DE_RANK[rankOf(card)] ?? rankOf(card)}` as Card : card);

// ---------------------------------------------------------------- Zustand

export interface Play { id: string; card: Card }
export interface TrickRec { plays: Play[]; winner: string; augen: number }
export interface Line { label: string; party: Party; pts: number }

export interface RoundRecord {
  round: number;
  contract: Contract;
  /** Solist bzw. Hochzeiter (allein oder mit Partner), sonst null */
  soloist: string | null;
  /** allein gegen drei (Solo, stilles Solo, Hochzeit ohne Partner) */
  alone: boolean;
  re: string[];
  augen: { re: number; kontra: number };
  calls: { re: number; kontra: number };
  winner: Party | null;
  lines: Line[];
  /** Wert aus Sicht von Re (negativ: Kontra bekommt) */
  value: number;
  points: Record<string, number>;
}

export interface DkState {
  v: 1;
  /** an einem Gerät gestartet (keine Zugzeit) */
  local: boolean;
  phase: "reserve" | "play" | "roundEnd" | "over";
  round: number;
  /** so viele Runden hat die Partie */
  total: number;
  /** vier Plätze in Sitzreihenfolge – auch die, die die App spielt */
  seats: string[];
  names: Record<string, string>;
  /** Plätze ohne Gerät (aufgefüllt oder ausgestiegen): die App spielt sie */
  ghosts: string[];
  dealerId: string;
  handSize: number;
  hands: Record<string, Card[]>;
  counts: Record<string, number>;
  /** öffentlich: gesund oder Vorbehalt (null: noch nicht gesagt) */
  said: Record<string, "gesund" | "vorbehalt" | null>;
  /** geheim (nur eigener): welcher Vorbehalt */
  reserves: Record<string, Reserve | null>;
  contract: Contract | null;
  /** Solist bzw. Hochzeiter (öffentlich), beim stillen Solo nur für ihn selbst */
  soloist: string | null;
  /** stilles Solo (beide Kreuz-Damen, gesund gesagt) – geheim */
  silent: boolean;
  /** wer Re ist – geheim bis zur Abrechnung */
  re: string[];
  /** was am Tisch schon klar ist (gespielte Kreuz-Dame, Ansage, Solo, Hochzeit) */
  revealed: Record<string, Party>;
  wedding: { by: string; partner: string | null; decided: boolean } | null;
  /** Stiche, nach denen die Parteien klar waren (Hochzeit: Ansagen verschieben sich) */
  clearAt: number;
  calls: { re: number; kontra: number };
  /** höchste Ansage je Spieler (für die Plätze) */
  callBy: Record<string, number>;
  trick: Play[];
  tricks: TrickRec[];
  curId: string | null;
  deadline: number | null;
  scores: Record<string, number>;
  history: RoundRecord[];
  log: string[];
  n: number;
}

export type DkAction =
  | { type: "reserve"; what: Reserve }
  | { type: "play"; card: Card }
  | { type: "call"; level: number; player?: string }
  | { type: "timeUp" }
  | { type: "nextRound" };

export interface Rules { total: number; nines: boolean; solos: boolean; absagen: boolean; specials: boolean; think: number }
export function rulesOf(o: Options): Rules {
  const total = [4, 8, 12, 20].includes(Number(o.rounds)) ? Number(o.rounds) : 8;
  const think = String(o.think ?? "off") === "off" ? 0 : Math.max(10, parseInt(String(o.think), 10) || 0);
  return { total, nines: o.nines !== false, solos: o.solos !== false, absagen: o.absagen !== false, specials: o.specials !== false, think };
}

const MAX_LOG = 80;
const GRACE = 1500;
export const BOT_NAMES = ["Lotte", "Hein", "Gerda", "Fritz"];
export const nameOf = (s: DkState, id: string | null | undefined) => (id ? s.names[id] ?? "?" : "?");
export const nextSeat = (s: DkState, id: string | null) => s.seats[(s.seats.indexOf(id ?? "") + 1) % s.seats.length];
const isLocal = (s: DkState) => s.local;

function sync(s: DkState) {
  s.counts = Object.fromEntries(s.seats.map((id) => [id, s.hands[id]?.length ?? 0]));
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

function startTurn(s: DkState, ctx: GameContext, id: string | null) {
  s.curId = id;
  const think = rulesOf(ctx.options).think;
  s.deadline = !isLocal(s) && think > 0 && id && !s.ghosts.includes(id) ? ctx.now + think * 1000 : null;
}

/** Neue Runde: mischen, austeilen, Vorbehalte ab dem Platz links vom Geber */
function deal(s: DkState, ctx: GameContext) {
  const r = rulesOf(ctx.options);
  const deck = shuffle(deckOf(r.nines));
  s.handSize = deck.length / SEATS;
  s.hands = Object.fromEntries(s.seats.map((id, i) => [id, sortHand(deck.slice(i * s.handSize, (i + 1) * s.handSize), "normal")]));
  s.said = Object.fromEntries(s.seats.map((id) => [id, null]));
  s.reserves = Object.fromEntries(s.seats.map((id) => [id, null]));
  s.contract = null;
  s.soloist = null;
  s.silent = false;
  s.re = [];
  s.revealed = {};
  s.wedding = null;
  s.clearAt = 0;
  s.calls = { re: 0, kontra: 0 };
  s.callBy = {};
  s.trick = [];
  s.tricks = [];
  s.phase = "reserve";
  s.log.push(`Runde ${s.round}: ${nameOf(s, s.dealerId)} gibt`);
  startTurn(s, ctx, nextSeat(s, s.dealerId));
}

function setup(ctx: GameContext): DkState {
  const humans = ctx.players.slice(0, SEATS);
  const seats = humans.map((p) => p.id);
  const names: Record<string, string> = Object.fromEntries(humans.map((p) => [p.id, p.name]));
  const ghosts: string[] = [];
  for (let i = 0; seats.length < SEATS; i++) {
    const id = `bot-${i + 1}`;
    seats.push(id);
    ghosts.push(id);
    names[id] = `${BOT_NAMES[i]} (Bot)`;
  }
  const s: DkState = {
    v: 1, local: ctx.actorId === null, phase: "reserve", round: 1, total: rulesOf(ctx.options).total, seats, names, ghosts,
    dealerId: dealerBefore({ players: humans, round: ctx.round }) ?? seats[SEATS - 1], handSize: 12,
    hands: {}, counts: {}, said: {}, reserves: {}, contract: null, soloist: null, silent: false, re: [], revealed: {}, wedding: null, clearAt: 0,
    calls: { re: 0, kontra: 0 }, callBy: {}, trick: [], tricks: [], curId: null, deadline: null,
    scores: Object.fromEntries(seats.map((id) => [id, 0])), history: [], log: [], n: 0,
  };
  deal(s, ctx);
  runGhosts(s, ctx);
  sync(s);
  return s;
}

// ---------------------------------------------------------------- Vorbehalte

/** Darf `id` diesen Vorbehalt anmelden? Grund, warum nicht (oder null) */
export function reserveWhyNot(s: DkState, id: string, what: unknown, o: Options): string | null {
  if (what === "gesund") return null;
  if (what === "hochzeit") return (s.hands[id] ?? []).filter((c) => c === ALTE).length === 2 ? null : "Hochzeit nur mit beiden Kreuz-Damen.";
  if (!(SOLOS as unknown[]).includes(what)) return "Diesen Vorbehalt gibt es nicht.";
  return rulesOf(o).solos ? null : "Soli sind ausgeschaltet.";
}

/** Alle haben gesagt: das erste Solo gilt, sonst Hochzeit, sonst Normalspiel */
function resolveReserves(s: DkState, ctx: GameContext) {
  const order = [...Array(SEATS)].map((_, i) => s.seats[(s.seats.indexOf(s.dealerId) + 1 + i) % SEATS]);
  const solo = order.find((id) => isSolo(s.reserves[id]));
  const wed = order.find((id) => s.reserves[id] === "hochzeit");
  const both = order.find((id) => (s.hands[id] ?? []).filter((c) => c === ALTE).length === 2);
  if (solo) {
    s.contract = s.reserves[solo] as SoloId;
    s.soloist = solo;
    s.re = [solo];
    for (const id of s.seats) s.revealed[id] = id === solo ? "re" : "kontra";
    s.log.push(`${nameOf(s, solo)} spielt ${contractName(s.contract, ctx.options)}`);
  } else if (wed) {
    s.contract = "hochzeit";
    s.soloist = wed;
    s.re = [wed];
    s.revealed[wed] = "re";
    s.wedding = { by: wed, partner: null, decided: false };
    s.log.push(`Hochzeit! ${nameOf(s, wed)} sucht einen Partner – wer zuerst einen Stich macht`);
  } else {
    s.contract = "normal";
    if (both) { s.silent = true; s.soloist = both; s.re = [both]; }
    else s.re = s.seats.filter((id) => (s.hands[id] ?? []).includes(ALTE));
    s.log.push("Alle gesund – Normalspiel");
  }
  for (const id of s.seats) s.hands[id] = sortHand(s.hands[id] ?? [], s.contract);
  s.phase = "play";
  startTurn(s, ctx, nextSeat(s, s.dealerId));
}

function doReserve(s: DkState, ctx: GameContext, id: string, what: Reserve) {
  s.reserves[id] = what;
  s.said[id] = what === "gesund" ? "gesund" : "vorbehalt";
  s.log.push(`${nameOf(s, id)}: ${what === "gesund" ? "gesund" : "Vorbehalt"}`);
  s.n++;
  if (s.seats.every((x) => s.said[x])) resolveReserves(s, ctx);
  else startTurn(s, ctx, nextSeat(s, id));
}

// ---------------------------------------------------------------- Spielen

export const leadKey = (s: Pick<DkState, "trick" | "contract">): string | null => (s.trick.length ? keyOf(s.trick[0].card, s.contract) : null);

/** Darf `card` gerade gespielt werden? Grund, warum nicht (oder null) */
export function whyNot(s: Pick<DkState, "trick" | "contract">, hand: Card[], card: Card): string | null {
  if (!hand.includes(card)) return "Diese Karte hast du nicht.";
  const lead = leadKey(s);
  if (!lead) return null;
  if (keyOf(card, s.contract) !== lead && hand.some((c) => keyOf(c, s.contract) === lead)) {
    return lead === "trumpf" ? "Du musst Trumpf bedienen." : `Du musst ${({ kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" } as Record<string, string>)[lead]} bedienen.`;
  }
  return null;
}
export const canPlay = (s: Pick<DkState, "trick" | "contract">, hand: Card[], card: Card) => whyNot(s, hand, card) === null;

/** Schlägt `a` die bisher beste Karte `b`? Gleiche Karten: die erste bleibt vorn */
export function beats(a: Card, b: Card, lead: string, c: Contract | null): boolean {
  const ta = isTrump(a, c), tb = isTrump(b, c);
  if (ta !== tb) return ta;
  if (!ta && suitOf(a) !== lead) return false;
  if (!ta && suitOf(b) !== lead) return true;
  return power(a, c) > power(b, c);
}
export function trickWinner(trick: Play[], c: Contract | null): string {
  const lead = keyOf(trick[0].card, c);
  let best = trick[0];
  for (const p of trick.slice(1)) if (beats(p.card, best.card, lead, c)) best = p;
  return best.id;
}

/** Hochzeit: der erste Stich eines anderen in den ersten drei macht ihn zum Partner */
function checkWedding(s: DkState, winner: string) {
  const w = s.wedding;
  if (!w || w.decided) return;
  if (winner !== w.by) {
    w.partner = winner;
    w.decided = true;
    s.re = [w.by, winner];
    s.clearAt = s.tricks.length;
    for (const id of s.seats) s.revealed[id] = s.re.includes(id) ? "re" : "kontra";
    s.log.push(`${nameOf(s, winner)} heiratet mit – Re sind ${nameOf(s, w.by)} und ${nameOf(s, winner)}`);
  } else if (s.tricks.length >= 3) {
    w.decided = true;
    s.clearAt = 3;
    for (const id of s.seats) s.revealed[id] = id === w.by ? "re" : "kontra";
    s.log.push(`Keiner heiratet mit – ${nameOf(s, w.by)} spielt allein`);
  }
}

function playCard(s: DkState, ctx: GameContext, me: string, card: Card) {
  const hand = s.hands[me];
  hand.splice(hand.indexOf(card), 1);
  s.trick.push({ id: me, card });
  if (card === ALTE && s.contract === "normal") s.revealed[me] = "re";
  s.n++;
  if (s.trick.length < SEATS) { startTurn(s, ctx, nextSeat(s, me)); return; }
  const w = trickWinner(s.trick, s.contract);
  const augen = sumAugen(s.trick.map((p) => p.card));
  s.tricks.push({ plays: s.trick, winner: w, augen });
  s.log.push(`${nameOf(s, w)} nimmt den Stich (${augen} Augen)`);
  s.trick = [];
  checkWedding(s, w);
  if (s.seats.every((id) => (s.hands[id] ?? []).length === 0)) { score(s, ctx); return; }
  startTurn(s, ctx, w);
}

// ---------------------------------------------------------------- Parteien und Ansagen

/** Partei eines Spielers aus der Wahrheit (nur Logik und Abrechnung) */
export const partyOf = (s: Pick<DkState, "re">, id: string): Party => (s.re.includes(id) ? "re" : "kontra");
/** Sind die Parteien schon bestimmt? (Hochzeit: erst nach dem Klärungsstich) */
export const partiesSet = (s: Pick<DkState, "wedding">) => !s.wedding || s.wedding.decided;

/**
 * Was `viewer` über die Parteien weiß: was am Tisch klar ist, die eigene Partei (aus der Hand und den eigenen
 * gespielten Karten) und was daraus folgt (zwei Re → der Rest Kontra und umgekehrt).
 */
export function knownParties(s: DkState, viewer: string | null): Record<string, Party> {
  const k: Record<string, Party> = { ...s.revealed };
  if (s.phase === "roundEnd" || s.phase === "over") return k;
  if (viewer && s.seats.includes(viewer) && s.contract && partiesSet(s)) {
    if (s.contract === "normal") {
      const played = s.tricks.flatMap((t) => t.plays).concat(s.trick).filter((p) => p.id === viewer && p.card === ALTE).length;
      const own = (s.hands[viewer] ?? []).filter((c) => c === ALTE).length + played;
      k[viewer] = own > 0 ? "re" : "kontra";
      // stilles Solo: wer beide hat, weiß, dass alle anderen Kontra sind
      if (own === 2) for (const id of s.seats) k[id] = id === viewer ? "re" : "kontra";
    }
  }
  if (s.contract === "normal" || s.contract === null) {
    const re = s.seats.filter((id) => k[id] === "re").length, ko = s.seats.filter((id) => k[id] === "kontra").length;
    if (re === 2) for (const id of s.seats) k[id] ??= "kontra";
    if (ko === 2) for (const id of s.seats) k[id] ??= "re";
  }
  return k;
}

/** Die eigene Partei – auch aus der eigenen Sicht (dort ist `re` leer, die Hand verrät sie) */
export const ownParty = (s: DkState, id: string): Party => knownParties(s, id)[id] ?? partyOf(s, id);

/** Bis zu welcher Kartenzahl darf diese Stufe noch angesagt werden? */
export const callDeadline = (s: Pick<DkState, "handSize" | "clearAt">, level: number) => s.handSize - level - s.clearAt;

/** Darf `id` Stufe `level` für seine Partei ansagen? Grund, warum nicht (oder null) */
export function callWhyNot(s: DkState, id: string, level: unknown, o: Options): string | null {
  if (s.phase !== "play") return "Angesagt wird während des Spiels.";
  if (!s.seats.includes(id)) return "Du spielst nicht mit.";
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > MAX_CALL) return "Diese Ansage gibt es nicht.";
  if (level > 1 && !rulesOf(o).absagen) return "Absagen sind ausgeschaltet.";
  if (!partiesSet(s)) return "Erst wenn die Hochzeit geklärt ist.";
  const party = ownParty(s, id);
  if (level <= s.calls[party]) return "Das ist schon angesagt.";
  if ((s.hands[id] ?? []).length < callDeadline(s, level)) return "Dafür ist es zu spät.";
  return null;
}
/** nächste mögliche Ansage für `id` (oder null) */
export function nextCall(s: DkState, id: string, o: Options): number | null {
  if (s.phase !== "play" || !s.seats.includes(id)) return null;
  const lv = s.calls[ownParty(s, id)] + 1;
  return callWhyNot(s, id, lv, o) === null ? lv : null;
}

function doCall(s: DkState, id: string, level: number) {
  const party = partyOf(s, id);
  s.calls[party] = level;
  s.callBy[id] = level;
  s.revealed[id] = party;
  s.n++;
  s.log.push(`${nameOf(s, id)} sagt ${level > 1 ? `${callName(party, level)} (${party === "re" ? "Re" : "Kontra"})` : callName(party, level)}`);
}

// ---------------------------------------------------------------- Abrechnung

type Need = { augen: number } | { all: true } | { one: true };
/** Was eine Partei braucht – abhängig von den eigenen und den fremden Ansagen */
export function needOf(calls: { re: number; kontra: number }, party: Party): Need {
  const own = calls[party], other = calls[party === "re" ? "kontra" : "re"];
  if (own >= 5) return { all: true };
  if (own >= 2) return { augen: ABSAGE_NEED[own] };
  if (other >= 5) return { one: true };
  if (other >= 2) return { augen: 241 - ABSAGE_NEED[other] };
  // ohne Absagen: Re 121, Kontra 120 – hat nur Kontra angesagt, umgekehrt
  const onlyOther = other >= 1 && own === 0;
  const base = party === "re" ? 121 : 120;
  return { augen: onlyOther ? 120 : own >= 1 && other === 0 ? 121 : base };
}
export const needText = (n: Need) => ("all" in n ? "alle Stiche" : "one" in n ? "einen Stich" : `${n.augen} Augen`);
const makes = (n: Need, augen: number, ownTricks: number, otherTricks: number) => ("all" in n ? otherTricks === 0 : "one" in n ? ownTricks > 0 : augen >= n.augen);

/** Abrechnung einer fertig gespielten Runde (rein, für Tests auch einzeln nutzbar) */
export function settle(s: Pick<DkState, "seats" | "re" | "tricks" | "calls" | "contract" | "soloist" | "silent" | "wedding" | "round">, specials = true): RoundRecord {
  const re = s.re;
  const party = (id: string): Party => (re.includes(id) ? "re" : "kontra");
  const augen = { re: 0, kontra: 0 }, tricks = { re: 0, kontra: 0 };
  for (const t of s.tricks) { augen[party(t.winner)] += t.augen; tricks[party(t.winner)]++; }
  const alone = re.length === 1;
  const solo = alone || isSolo(s.contract);
  const reMakes = makes(needOf(s.calls, "re"), augen.re, tricks.re, tricks.kontra);
  const koMakes = makes(needOf(s.calls, "kontra"), augen.kontra, tricks.kontra, tricks.re);
  const winner: Party | null = reMakes && !koMakes ? "re" : koMakes && !reMakes ? "kontra" : null;
  const lines: Line[] = [];
  if (winner) {
    const loser: Party = winner === "re" ? "kontra" : "re";
    lines.push({ label: "Gewonnen", party: winner, pts: 1 });
    if (winner === "kontra" && !solo) lines.push({ label: "Gegen die Alten", party: winner, pts: 1 });
    if (s.calls.re >= 1) lines.push({ label: "Re angesagt", party: winner, pts: 2 });
    if (s.calls.kontra >= 1) lines.push({ label: "Kontra angesagt", party: winner, pts: 2 });
    if (augen[loser] < 90) lines.push({ label: "Keine 90", party: winner, pts: 1 });
    if (augen[loser] < 60) lines.push({ label: "Keine 60", party: winner, pts: 1 });
    if (augen[loser] < 30) lines.push({ label: "Keine 30", party: winner, pts: 1 });
    if (tricks[loser] === 0) lines.push({ label: "Schwarz", party: winner, pts: 1 });
    for (const p of ["re", "kontra"] as Party[]) for (let lv = 2; lv <= s.calls[p]; lv++) {
      lines.push({ label: `${callName(p, lv)} abgesagt`.replace(/^k/, "K").replace(/^s/, "S"), party: winner, pts: 1 });
    }
  }
  if (specials && !solo) {
    const last = s.tricks[s.tricks.length - 1];
    for (const t of s.tricks) {
      const wp = party(t.winner);
      if (t.augen >= 40) lines.push({ label: "Doppelkopf", party: wp, pts: 1 });
      for (const p of t.plays) if (p.card === FUCHS && party(p.id) !== wp) lines.push({ label: "Fuchs gefangen", party: wp, pts: 1 });
    }
    if (last && last.plays.find((p) => p.id === last.winner)?.card === KARLCHEN) lines.push({ label: "Karlchen", party: party(last.winner), pts: 1 });
  }
  const value = lines.reduce((t, l) => t + (l.party === "re" ? l.pts : -l.pts), 0);
  const points: Record<string, number> = {};
  for (const id of s.seats) points[id] = party(id) === "re" ? (alone ? value * 3 : value) : -value;
  return {
    round: s.round, contract: s.contract ?? "normal", soloist: s.soloist, alone, re: [...re], augen, calls: { ...s.calls }, winner, lines, value, points,
  };
}

function score(s: DkState, ctx: GameContext) {
  const rec = settle(s, rulesOf(ctx.options).specials);
  // Stilles Solo und Hochzeit ohne Partner: jetzt für alle sichtbar
  for (const id of s.seats) s.revealed[id] = partyOf(s, id);
  for (const id of s.seats) s.scores[id] = (s.scores[id] ?? 0) + (rec.points[id] ?? 0);
  s.history.push(rec);
  const names = (p: Party) => s.seats.filter((id) => partyOf(s, id) === p).map((id) => nameOf(s, id)).join(" und ");
  s.log.push(rec.winner ? `${rec.winner === "re" ? "Re" : "Kontra"} (${names(rec.winner)}) gewinnt mit ${rec.augen[rec.winner]} Augen` : "Keine Partei hat ihre Absage geschafft");
  s.curId = null;
  s.deadline = null;
  s.phase = s.round >= s.total ? "over" : "roundEnd";
}

// ---------------------------------------------------------------- Strategie (Bots, Spielhilfe, Zugzeit, App-Plätze)

/** Karten, die `me` noch nicht gesehen hat (nicht in der Hand, noch nicht gespielt) */
export function unseen(s: DkState, me: string): Card[] {
  const out = deckOf(s.handSize === 12);
  const drop = (c: Card) => { const i = out.indexOf(c); if (i >= 0) out.splice(i, 1); };
  for (const c of s.hands[me] ?? []) drop(c);
  for (const t of s.tricks) for (const p of t.plays) drop(p.card);
  for (const p of s.trick) drop(p.card);
  return out;
}

const highs = (hand: Card[]) => hand.filter((c) => c === DULLE || c === "kreuz-D" || c === "pik-D").length;

/** Vorbehalt: Hochzeit mit beiden Kreuz-Damen, Solo bei sehr starker Hand, sonst gesund */
export function suggestReserve(s: DkState, me: string, o: Options): Reserve {
  const hand = s.hands[me] ?? [];
  const n = hand.length;
  if (rulesOf(o).solos) {
    const aces = hand.filter((c) => rankOf(c) === "A" && !isTrump(c, "dame")).length;
    const damen = hand.filter((c) => rankOf(c) === "D").length;
    const buben = hand.filter((c) => rankOf(c) === "B").length;
    if (damen >= Math.ceil(n / 2) || (damen >= n / 2 - 1 && aces >= 3)) return "dame";
    if (buben >= Math.ceil(n / 2) || (buben >= n / 2 - 1 && aces >= 3)) return "bube";
    let best: SoloId | null = null, top = 0;
    for (const c of ["kreuz", "pik", "herz"] as SoloId[]) {
      const t = hand.filter((x) => isTrump(x, c));
      const v = t.length + highs(t) * 0.5;
      if (t.length >= Math.ceil(n * 0.75) && highs(t) >= 3 && v > top) { top = v; best = c; }
    }
    if (best) return best;
  }
  if (hand.filter((c) => c === ALTE).length === 2) return "hochzeit";
  return "gesund";
}

/** Ansage: nur mit klar starker Hand (oder sicher genug Augen) – sonst null */
export function suggestCall(s: DkState, me: string, o: Options): number | null {
  const lv = nextCall(s, me, o);
  if (!lv) return null;
  const hand = s.hands[me] ?? [];
  const trumps = hand.filter((c) => isTrump(c, s.contract));
  const party = knownParties(s, me)[me];
  if (!party) return null;
  const aces = hand.filter((c) => rankOf(c) === "A" && !isTrump(c, s.contract)).length;
  const scale = s.handSize / 12;
  // schon sicher: eigene Partei hat genug Augen
  const mine = s.tricks.filter((t) => knownParties(s, me)[t.winner] === party).reduce((a, t) => a + t.augen, 0);
  if (lv === 1) {
    if (isSolo(s.contract) && s.soloist === me) return trumps.length >= 9 * scale && highs(trumps) >= 2 ? 1 : null;
    if (mine >= 121) return 1;
    if (trumps.length >= 7 * scale && highs(trumps) >= 3) return 1;
    if (trumps.length >= 6 * scale && highs(trumps) >= 2 && aces >= 2) return 1;
    return null;
  }
  if (lv === 2) {
    if (mine >= 151) return 2;
    if (trumps.length >= 9 * scale && highs(trumps) >= 4) return 2;
  }
  return null;
}

/**
 * Vorschlag für die nächste Karte – nur mit dem, was `me` sieht (eigene Hand, gespielte Karten, bekannte Parteien):
 * Fehl-Asse in der ersten Runde einer Farbe ausspielen, dem Partner Augen geben („schmieren“), gegnerische Stiche
 * billig übernehmen oder Augen sparen, den Fuchs nicht verschenken.
 */
export function suggestCard(s: DkState, me: string): Card | null {
  const hand = s.hands[me] ?? [];
  const ok = hand.filter((c) => canPlay(s, hand, c));
  if (!ok.length) return null;
  if (ok.length === 1) return ok[0];
  const c = s.contract;
  const k = knownParties(s, me);
  const mine = k[me];
  const friend = (id: string) => id === me || (!!mine && k[id] === mine);
  const cost = (x: Card) => augenOf(x) + (x === FUCHS && c !== "fleischlos" && isTrump(x, c) ? 8 : 0) + (isTrump(x, c) ? power(x, c) / 25 : 0);
  const cheap = (xs: Card[]) => xs.reduce((a, b) => (cost(b) < cost(a) ? b : a));
  const rest = unseen(s, me);
  // eine Karte ist „oben“, wenn keine ungesehene sie schlagen kann
  const top = (x: Card, lead: string) => !rest.some((u) => beats(u, x, lead, c));

  if (!s.trick.length) {
    // erste Runde einer Fehlfarbe: Ass ausspielen
    const led = new Set(s.tricks.map((t) => keyOf(t.plays[0].card, c)));
    const aces = ok.filter((x) => !isTrump(x, c) && rankOf(x) === "A" && !led.has(suitOf(x)));
    if (aces.length) return aces.reduce((a, b) => (hand.filter((h) => suitOf(h) === suitOf(b) && !isTrump(h, c)).length < hand.filter((h) => suitOf(h) === suitOf(a) && !isTrump(h, c)).length ? b : a));
    const trumps = ok.filter((x) => isTrump(x, c));
    const sure = trumps.filter((x) => top(x, "trumpf"));
    // Solist und starke Re-Hände ziehen Trumpf
    const pull = (s.soloist === me && isSolo(c)) || (trumps.length >= ok.length / 2 && mine === "re");
    if (pull && sure.length) return sure.reduce((a, b) => (power(b, c) < power(a, c) ? b : a));
    const fehl = ok.filter((x) => !isTrump(x, c));
    const sureFehl = fehl.filter((x) => top(x, suitOf(x)));
    if (sureFehl.length) return sureFehl.reduce((a, b) => (augenOf(b) > augenOf(a) ? b : a));
    if (pull && trumps.length) return cheap(trumps);
    if (fehl.length) return cheap(fehl);
    return cheap(ok);
  }

  const lead = leadKey(s)!;
  const w = trickWinner(s.trick, c);
  const wCard = s.trick.find((p) => p.id === w)!.card;
  const last = s.trick.length === SEATS - 1;
  const after = s.seats.slice(s.seats.indexOf(me) + 1).concat(s.seats.slice(0, s.seats.indexOf(me))).slice(0, SEATS - 1 - s.trick.length);
  const pot = sumAugen(s.trick.map((p) => p.card));
  const winning = ok.filter((x) => beats(x, wCard, lead, c));
  const partnerWins = w !== me && friend(w) && !!mine;
  // Der Partner liegt vorn und bleibt es (alle danach sind Partner oder seine Karte ist oben): Augen geben
  if (partnerWins && (last || after.every(friend) || top(wCard, lead))) {
    const nonTrump = ok.filter((x) => !isTrump(x, c));
    const pool = nonTrump.length ? nonTrump : ok.filter((x) => power(x, c) < 100 - 4 || !isTrump(x, c));
    const from = pool.length ? pool : ok;
    return from.reduce((a, b) => (augenOf(b) - (b === DULLE ? 20 : 0) > augenOf(a) - (a === DULLE ? 20 : 0) ? b : a));
  }
  if (winning.length && !partnerWins) {
    const sure = winning.filter((x) => last || after.every(friend) || top(x, lead));
    if (sure.length) {
      // billigste sichere Karte – als Letzter darf es ruhig eine mit Augen sein (Fehl)
      const best = sure.reduce((a, b) => (power(b, c) - (last ? augenOf(b) * 0.3 : 0) < power(a, c) - (last ? augenOf(a) * 0.3 : 0) ? b : a));
      if (pot + augenOf(best) >= 8 || !isTrump(best, c) || power(best, c) < 92) return best;
    }
    if (pot >= 14) return winning.reduce((a, b) => (power(b, c) > power(a, c) ? b : a));
  }
  // nicht zu gewinnen (oder nicht lohnend): möglichst wenig Augen abgeben
  const losers = ok.filter((x) => !beats(x, wCard, lead, c));
  return cheap(losers.length ? losers : ok);
}

/** Was die App für einen Platz tut (Bots ohne Gerät, „überspringen“, Zugzeit um) */
function autoMove(s: DkState, ctx: GameContext, id: string) {
  const view = viewFor(s, id);
  if (s.phase === "reserve") { doReserve(s, ctx, id, suggestReserve(view, id, ctx.options)); return; }
  if (s.phase === "play") {
    const card = suggestCard(view, id);
    if (card) playCard(s, ctx, id, card);
  }
}

/** Plätze ohne Gerät spielt die App sofort */
function runGhosts(s: DkState, ctx: GameContext) {
  for (let i = 0; i < 200 && (s.phase === "reserve" || s.phase === "play") && s.curId && s.ghosts.includes(s.curId); i++) autoMove(s, ctx, s.curId);
}

// ---------------------------------------------------------------- Züge

function apply(prev: DkState, a: DkAction, ctx: GameContext): DkState {
  if (prev.phase === "over") throw new GameError("Die Partie ist vorbei.");
  if (a.type === "timeUp") {
    // jedes Gerät meldet es – gezählt wird nur das erste, und nur wenn die Zeit wirklich um ist
    if ((prev.phase !== "play" && prev.phase !== "reserve") || !prev.curId || prev.deadline === null || ctx.now < prev.deadline - GRACE) return prev;
    const s = structuredClone(prev);
    s.log.push(`Zeit um – für ${nameOf(s, s.curId)} gespielt`);
    autoMove(s, ctx, s.curId!);
    runGhosts(s, ctx);
    sync(s);
    return s;
  }
  const s = structuredClone(prev);
  switch (a.type) {
    case "reserve": {
      if (s.phase !== "reserve" || !s.curId) throw new GameError("Vorbehalte sind schon gesagt.");
      const why = reserveWhyNot(s, s.curId, a.what, ctx.options);
      if (why) throw new GameError(why);
      doReserve(s, ctx, s.curId, a.what);
      break;
    }
    case "play": {
      if (s.phase !== "play" || !s.curId) throw new GameError("Gerade wird nicht gespielt.");
      if (!isDkCard(a.card)) throw new GameError("Diese Karte gibt es nicht.");
      const why = whyNot(s, s.hands[s.curId] ?? [], a.card);
      if (why) throw new GameError(why);
      playCard(s, ctx, s.curId, a.card);
      break;
    }
    case "call": {
      const who = a.player ?? ctx.actorId;
      if (!who || !s.seats.includes(who) || s.ghosts.includes(who)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (ctx.actorId !== null && who !== ctx.actorId) throw new GameError("Sag nur für dich selbst an.");
      const why = callWhyNot(s, who, a.level, ctx.options);
      if (why) throw new GameError(why);
      doCall(s, who, a.level);
      break;
    }
    case "nextRound": {
      if (s.phase !== "roundEnd") throw new GameError("Die Runde läuft noch.");
      s.round++;
      s.dealerId = nextSeat(s, s.dealerId);
      deal(s, ctx);
      break;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
  runGhosts(s, ctx);
  sync(s);
  return s;
}

/** Sicht eines Spielers: nur die eigene Hand, der eigene Vorbehalt; Re erst nach der Abrechnung */
export function viewFor(s: DkState, viewer: string | null): DkState {
  if (viewer === null) return s;
  const open = s.phase === "roundEnd" || s.phase === "over";
  const own = <T,>(m: Record<string, T>) => (viewer in m ? { [viewer]: m[viewer] } : {});
  const mineSilent = s.silent && s.soloist === viewer;
  return {
    ...s,
    hands: own(s.hands),
    reserves: Object.fromEntries(Object.keys(s.reserves).map((id) => [id, id === viewer ? s.reserves[id] : null])),
    re: open ? s.re : [],
    silent: open ? s.silent : mineSilent,
    soloist: s.silent && !open && !mineSilent ? null : s.soloist,
  };
}

/** Wer vorn liegt (Gleichstand: alle) */
export function leaders(s: DkState, ids: string[]): string[] {
  if (!ids.length) return [];
  const best = Math.max(...ids.map((id) => s.scores[id] ?? 0));
  return ids.filter((id) => (s.scores[id] ?? 0) === best);
}

export const doppelkopf: GameLogic<DkState, DkAction> = {
  info: {
    id: "doppelkopf",
    name: "Doppelkopf",
    tagline: "Zu viert mit doppeltem Blatt: Re gegen Kontra, Damen stechen, Füchse fangen, Ansagen wagen.",
    category: "Karten",
    minPlayers: 1,
    maxPlayers: 4,
    duration: "45–90 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  playerLimits: () => ({ min: 1, max: 4, note: "Immer zu viert – fehlende Plätze spielen Bots" }),
  presets: [
    { id: "ohneNeunen", label: "Ohne Neunen", hint: "40 Karten", options: { nines: false } },
    { id: "einsteiger", label: "Einsteiger", hint: "ohne Soli und Absagen", options: { solos: false, absagen: false } },
  ],
  settings: [
    {
      key: "rounds", label: "Partie über", type: "choice", default: "8",
      choices: [
        { value: "4", label: "4 Runden", hint: "jeder gibt einmal" },
        { value: "8", label: "8 Runden", hint: "jeder gibt zweimal" },
        { value: "12", label: "12 Runden" },
        { value: "20", label: "20 Runden", hint: "langer Abend" },
      ],
    },
    { key: "nines", label: "Mit Neunen", type: "toggle", default: true, hint: "48 Karten, je 12 – ohne Neunen 40 Karten, je 10", group: "Hausregeln" },
    { key: "solos", label: "Soli", type: "toggle", default: true, hint: "Damen-, Buben-, Fleischlos- und Farbsolo als Vorbehalt", group: "Hausregeln" },
    { key: "absagen", label: "Absagen", type: "toggle", default: true, hint: "„keine 90“, „keine 60“, „keine 30“, „schwarz“ nach Re bzw. Kontra", group: "Hausregeln" },
    { key: "specials", label: "Sonderpunkte", type: "toggle", default: true, hint: "Doppelkopf (40 Augen im Stich), Fuchs gefangen, Karlchen", group: "Hausregeln" },
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
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt Vorbehalte, Ansagen, Stiche und die Abrechnung an (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "play" || a.type === "reserve" ? "turn" : a.type === "call" || a.type === "nextRound" || a.type === "timeUp" ? "player" : null),
  currentPlayerId: (s) => (s.phase === "play" || s.phase === "reserve" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const ids = ctx.players.map((p) => p.id).filter((id) => s.seats.includes(id));
    const win = leaders(s, s.seats);
    return ids.map((id) => ({ id, won: win.includes(id), score: s.scores[id] ?? 0 }));
  },
  skipLabel: (s) => {
    if (s.phase === "roundEnd") return `Runde ${s.round + 1} geben`;
    if (s.phase === "reserve" && s.curId) return `Für ${nameOf(s, s.curId)} „gesund“ sagen`;
    if (s.phase === "play" && s.curId) return `Für ${nameOf(s, s.curId)} eine Karte spielen`;
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "roundEnd") {
      s.round++;
      s.dealerId = nextSeat(s, s.dealerId);
      deal(s, ctx);
    } else if (s.phase === "reserve" && s.curId) {
      s.log.push(`Für ${nameOf(s, s.curId)} gesagt`);
      doReserve(s, ctx, s.curId, "gesund");
    } else if (s.phase === "play" && s.curId) {
      const card = suggestCard(viewFor(s, s.curId), s.curId);
      if (card) { s.log.push(`Für ${nameOf(s, s.curId)} gespielt`); playCard(s, ctx, s.curId, card); }
    }
    runGhosts(s, ctx);
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!s.seats.includes(id) || s.ghosts.includes(id)) return s;
    s.ghosts.push(id);
    s.names[id] = `${s.names[id] ?? "?"} (Bot)`;
    if (s.phase !== "over") s.log.push(`${prev.names[id] ?? "?"} ist raus – ein Bot spielt den Platz weiter`);
    if (s.curId === id) s.deadline = null;
    runGhosts(s, ctx);
    sync(s);
    return s;
  },
  botPause: (s) => (s.phase === "roundEnd" ? 6000 : s.phase === "play" && !s.trick.length && s.tricks.length ? 1400 : s.phase === "play" && s.tricks.length === 0 && !s.trick.length ? 1200 : 0),
  view: viewFor,
};
