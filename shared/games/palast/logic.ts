/**
 * Palast – Ablegespiel mit französischem Blatt (52 Karten, ab 6 Spielern zwei Blätter), 2–8 Spieler.
 * Jeder hat drei verdeckte Tischkarten, darauf drei offene, dazu drei Handkarten; vor dem Start darf man Hand- und
 * offene Tischkarten tauschen. Reihum legt man eine oder mehrere gleiche Karten, gleich hoch oder höher als die oberste
 * Ablagekarte – wer nicht kann, nimmt den ganzen Ablagestapel auf. Nach dem Legen auf drei Handkarten nachziehen.
 * 2 = Neustart (alles darf darauf), 10 = Ablage wird verbrannt (gleicher Spieler nochmal), vier gleiche hintereinander
 * verbrennen ebenfalls, 7 = der Nächste legt 7 oder niedriger (abschaltbar). Ohne Hand und Stapel spielt man die offenen,
 * dann blind die verdeckten Tischkarten. Wer alle Karten los ist, ist raus – der Letzte hält die Palastwache.
 *
 * Kartenfarben spielen keine Rolle. Mit zwei Blättern gibt es jede Karte zweimal – Karten werden daher als Mehrfachmenge
 * behandelt (gleiche Strings sind gleichwertig).
 */
import { DECKS, fullDeck, isCardOf, rankOf, RANK_NAME, type Card, type Rank } from "../../cards/deck";
import { shuffle } from "../../platform/random";
import { dealerBefore, playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

const DECK = DECKS.fr52;
/** Reihenfolge der Werte: 2 ist die niedrigste, Ass die höchste */
export const RANKS: readonly Rank[] = DECK.ranks;
export const rankValue = (r: Rank) => RANKS.indexOf(r);
export const valueOf = (c: Card) => rankValue(rankOf(c));
/** Sonderkarten */
export const RESET: Rank = "2";
export const BURN: Rank = "10";
export const SEVEN: Rank = "7";
/** Karten je Stelle: verdeckt, offen, Hand */
export const PER = 3;

/**
 * Nichts darf hängen bleiben: Nach so vielen Zügen ohne Fortschritt (leerer Stapel, nichts verbrannt, keiner fertig)
 * wird die Ablage nach dem nächsten Legen verbrannt. Sonst kann z. B. eine Sieben endlos reihum aufgenommen werden.
 */
export const STALL_LIMIT = 45;

export const decksFor = (n: number) => (n > 5 ? 2 : 1);

export type Source = "hand" | "up" | "down";

export interface Last {
  id: string;
  kind: "play" | "take" | "blindFail";
  /** gelegte bzw. aufgedeckte Karten */
  cards: Card[];
  src: Source;
  /** Ablage verbrannt (10, vier gleiche oder nach zu vielen Zügen ohne Fortschritt) */
  burn: "ten" | "four" | "stall" | null;
  /** Anzahl aufgenommener Karten */
  took: number;
  /** danach raus (fertig) */
  out: boolean;
}

export interface PalastState {
  v: 1;
  phase: "swap" | "play" | "over";
  decks: number;
  dealerId: string | null;
  hands: Record<string, Card[]>;
  /** Handkarten je Spieler (öffentlich) */
  counts: Record<string, number>;
  /** offene Tischkarten (öffentlich) */
  up: Record<string, Card[]>;
  /** verdeckte Tischkarten je Platz – kennt niemand, auch der Besitzer nicht (Sicht: leer) */
  down: Record<string, (Card | null)[]>;
  /** welche verdeckten Plätze noch belegt sind (öffentlich) */
  downLeft: Record<string, boolean[]>;
  /** Nachziehstapel (Sicht: leer) */
  pile: Card[];
  pileCount: number;
  /** Ablage, die oberste zuletzt */
  discard: Card[];
  /** verbrannte Karten (aus dem Spiel) */
  burned: Card[];
  /** fertig mit Tauschen */
  ready: Record<string, boolean>;
  curId: string | null;
  /** Reihenfolge, in der die Spieler fertig wurden */
  out: string[];
  /** wer am Ende übrig bleibt (hält die Palastwache) */
  guard: string | null;
  last: Last | null;
  /** Züge ohne Fortschritt (Stapel leer, nichts verbrannt, keiner fertig) – siehe STALL_LIMIT */
  stall: number;
  /** zählt Züge */
  n: number;
  log: string[];
}

export type PalastAction =
  | { type: "arrange"; up: Card[]; player?: string }
  | { type: "ready"; player?: string }
  | { type: "play"; cards: Card[] }
  | { type: "blind"; i: number }
  | { type: "take" };

interface Rules { seven: boolean; four: boolean; swap: boolean }
export function rulesOf(o: Options): Rules {
  return { seven: o.seven !== false, four: o.four !== false, swap: o.swap !== false };
}

const MAX_LOG = 60;
const nameOf = playerName;
export const rankWord = (r: Rank) => RANK_NAME[r];
/** „2× Sieben“, „eine Dame“ */
export function cardsText(cards: Card[]): string {
  if (!cards.length) return "";
  const r = rankOf(cards[0]);
  return cards.length === 1 ? (r === "A" ? "ein Ass" : r === "B" ? "einen Buben" : r === "K" ? "einen König" : `eine ${rankWord(r)}`) : `${cards.length}× ${rankWord(r)}`;
}

/** Woher spielt `id` gerade? Hand, dann offene, dann verdeckte Tischkarten (null: fertig) */
export function sourceOf(s: PalastState, id: string): Source | null {
  if ((s.counts[id] ?? 0) > 0) return "hand";
  if ((s.up[id] ?? []).length) return "up";
  if ((s.downLeft[id] ?? []).some(Boolean)) return "down";
  return null;
}
export const cardsLeft = (s: PalastState, id: string) => (s.counts[id] ?? 0) + (s.up[id] ?? []).length + (s.downLeft[id] ?? []).filter(Boolean).length;

/** Was muss als Nächstes kommen? null = alles erlaubt; sonst Mindestwert bzw. bei der Sieben Höchstwert */
export function needOf(s: PalastState, o: Options): { min?: Rank; max?: Rank } | null {
  const top = s.discard[s.discard.length - 1];
  if (!top) return null;
  const r = rankOf(top);
  if (r === RESET) return null;
  if (r === SEVEN && rulesOf(o).seven) return { max: SEVEN };
  return { min: r };
}

/** Darf eine Karte dieses Werts gerade gelegt werden? 2 und 10 gehen immer. */
export function fits(s: PalastState, r: Rank, o: Options): boolean {
  if (r === RESET || r === BURN) return true;
  const need = needOf(s, o);
  if (!need) return true;
  if (need.max) return rankValue(r) <= rankValue(need.max);
  return rankValue(r) >= rankValue(need.min!);
}

/** Karten, aus denen `id` gerade legen darf */
export function sourceCards(s: PalastState, id: string): Card[] {
  const src = sourceOf(s, id);
  return src === "hand" ? s.hands[id] ?? [] : src === "up" ? s.up[id] ?? [] : [];
}

/** Gibt es einen erlaubten Zug aus Hand bzw. offenen Karten? */
export function canPlayAny(s: PalastState, id: string, o: Options): boolean {
  return sourceCards(s, id).some((c) => fits(s, rankOf(c), o));
}

/** Nimmt `cards` (Mehrfachmenge) aus `from` – false, wenn nicht alle da sind */
function takeOut(from: Card[], cards: Card[]): boolean {
  const rest = from.slice();
  for (const c of cards) {
    const i = rest.indexOf(c);
    if (i < 0) return false;
    rest.splice(i, 1);
  }
  from.length = 0;
  from.push(...rest);
  return true;
}

/** Wie viele gleiche Werte liegen oben auf der Ablage hintereinander? */
export function topRun(discard: Card[]): number {
  if (!discard.length) return 0;
  const r = rankOf(discard[discard.length - 1]);
  let k = 0;
  for (let i = discard.length - 1; i >= 0 && rankOf(discard[i]) === r; i--) k++;
  return k;
}

function sync(s: PalastState) {
  s.counts = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length]));
  s.downLeft = Object.fromEntries(Object.entries(s.down).map(([id, d]) => [id, d.map((c) => c !== null)]));
  s.pileCount = s.pile.length;
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

/** Hand nach Wert sortiert (Farbe zweitrangig) */
export const sortCards = (cs: Card[]) => cs.slice().sort((a, b) => valueOf(a) - valueOf(b) || a.localeCompare(b));

const active = (s: PalastState, players: Player[]) => players.filter((p) => !s.out.includes(p.id) && p.id !== s.guard);

/** Nächster Spieler, der noch Karten hat */
function nextActive(s: PalastState, players: Player[], from: string | null): string | null {
  const i = players.findIndex((p) => p.id === from);
  for (let k = 1; k <= players.length; k++) {
    const p = players[(i + k + players.length) % players.length];
    if (!s.out.includes(p.id) && p.id !== s.guard) return p.id;
  }
  return null;
}

/** Ist nur noch einer übrig, hält er die Palastwache – die Partie ist aus */
function checkEnd(s: PalastState, ctx: GameContext): boolean {
  const left = active(s, ctx.players);
  if (left.length > 1) return false;
  s.guard = left[0]?.id ?? null;
  s.phase = "over";
  s.curId = null;
  if (s.guard) s.log.push(`${nameOf(ctx, s.guard)} hält die Palastwache`);
  return true;
}

function startPlay(s: PalastState, ctx: GameContext) {
  s.phase = "play";
  s.curId = nextActive(s, ctx.players, s.dealerId);
  s.log.push(`${nameOf(ctx, s.curId)} beginnt`);
}

function setup(ctx: GameContext): PalastState {
  const ids = ctx.players.map((p) => p.id);
  const decks = decksFor(ids.length);
  const deck = shuffle(Array.from({ length: decks }, () => fullDeck(DECK)).flat());
  const s: PalastState = {
    v: 1, phase: "swap", decks, dealerId: dealerBefore(ctx) ?? ids[0] ?? null,
    hands: {}, counts: {}, up: {}, down: {}, downLeft: {}, pile: [], pileCount: 0, discard: [], burned: [],
    ready: Object.fromEntries(ids.map((id) => [id, false])), curId: null, out: [], guard: null, last: null, stall: 0, n: 0, log: [],
  };
  for (const id of ids) {
    s.down[id] = deck.splice(0, PER);
    s.up[id] = sortCards(deck.splice(0, PER));
    s.hands[id] = sortCards(deck.splice(0, PER));
  }
  s.pile = deck;
  s.log.push(decks > 1 ? "Mit zwei Blättern gegeben" : "Gegeben");
  if (!rulesOf(ctx.options).swap) startPlay(s, ctx);
  sync(s);
  return s;
}

/** Hand auf drei auffüllen, solange der Stapel reicht */
function refill(s: PalastState, id: string) {
  const h = s.hands[id];
  while (h.length < PER && s.pile.length) h.push(s.pile.pop()!);
  s.hands[id] = sortCards(h);
}

/** Karten liegen auf der Ablage: verbrennen? fertig? wer ist dran? */
function afterLay(s: PalastState, ctx: GameContext, me: string, cards: Card[], src: Source) {
  const r = rankOf(cards[0]);
  const four = rulesOf(ctx.options).four && topRun(s.discard) >= 4;
  const drew = src === "hand" && s.pile.length > 0;
  s.stall = drew ? 0 : (s.stall ?? 0) + 1;
  const burn = r === BURN ? "ten" as const : four ? "four" as const : s.stall >= STALL_LIMIT ? "stall" as const : null;
  if (burn) s.stall = 0;
  if (src === "hand") refill(s, me);
  const what = cardsText(cards);
  if (burn) {
    s.burned.push(...s.discard);
    s.discard = [];
  }
  s.counts[me] = s.hands[me].length;
  sync(s);
  const done = cardsLeft(s, me) === 0;
  s.last = { id: me, kind: "play", cards, src, burn, took: 0, out: done };
  s.n++;
  s.log.push(`${nameOf(ctx, me)} legt ${what}${src === "up" ? " (offen)" : src === "down" ? " (blind)" : ""}${burn === "ten" ? " – verbrannt!" : burn === "four" ? " – vier gleiche, verbrannt!" : ""}`);
  if (burn === "stall") s.log.push("Die Ablage ist lange genug gewandert – sie wird verbrannt");
  if (done) {
    s.stall = 0;
    s.out.push(me);
    s.log.push(`${nameOf(ctx, me)} ist fertig – Platz ${s.out.length}`);
    if (checkEnd(s, ctx)) return;
    s.curId = nextActive(s, ctx.players, me);
    return;
  }
  // Nach dem Verbrennen legt derselbe Spieler noch einmal (nicht, wenn die Ablage nur zu lange gewandert ist)
  s.curId = burn && burn !== "stall" ? me : nextActive(s, ctx.players, me);
}

function playCards(s: PalastState, ctx: GameContext, me: string, cards: Card[]) {
  const src = sourceOf(s, me);
  if (src === null) throw new GameError("Du hast keine Karten mehr.");
  if (src === "down") throw new GameError("Jetzt deckst du eine verdeckte Karte auf.");
  if (!Array.isArray(cards) || !cards.length || cards.length > 8) throw new GameError("Wähle eine oder mehrere gleiche Karten.");
  for (const c of cards) if (!isCardOf(DECK, c)) throw new GameError("Diese Karte gibt es nicht.");
  const r = rankOf(cards[0]);
  if (cards.some((c) => rankOf(c) !== r)) throw new GameError("Nur gleiche Werte zusammen legen.");
  if (!fits(s, r, ctx.options)) {
    const need = needOf(s, ctx.options);
    throw new GameError(need?.max ? "Auf die Sieben nur 7 oder niedriger." : `Nur ${rankWord(need!.min!)} oder höher.`);
  }
  const from = src === "hand" ? s.hands[me] : s.up[me];
  if (!takeOut(from, cards)) throw new GameError(src === "hand" ? "Diese Karten hast du nicht." : "Diese Karten liegen nicht offen bei dir.");
  s.discard.push(...cards);
  afterLay(s, ctx, me, cards, src);
}

function blind(s: PalastState, ctx: GameContext, me: string, i: number) {
  if (sourceOf(s, me) !== "down") throw new GameError("Erst Hand und offene Karten ausspielen.");
  const slots = s.down[me];
  if (!Number.isInteger(i) || i < 0 || i >= slots.length || slots[i] === null) throw new GameError("Dort liegt keine Karte.");
  const card = slots[i]!;
  slots[i] = null;
  if (fits(s, rankOf(card), ctx.options)) {
    s.discard.push(card);
    afterLay(s, ctx, me, [card], "down");
    return;
  }
  // Passt nicht: die aufgedeckte Karte und die ganze Ablage auf die Hand
  const took = s.discard.length + 1;
  s.hands[me] = sortCards([...s.hands[me], ...s.discard, card]);
  s.discard = [];
  s.stall = (s.stall ?? 0) + 1;
  s.last = { id: me, kind: "blindFail", cards: [card], src: "down", burn: null, took, out: false };
  s.n++;
  s.log.push(`${nameOf(ctx, me)} deckt ${cardsText([card])} auf – passt nicht, nimmt ${took} Karten`);
  sync(s);
  s.curId = nextActive(s, ctx.players, me);
}

function take(s: PalastState, ctx: GameContext, me: string) {
  const src = sourceOf(s, me);
  if (src === "down") throw new GameError("Deck eine verdeckte Karte auf.");
  if (!s.discard.length) throw new GameError("Die Ablage ist leer – leg eine Karte.");
  if (canPlayAny(s, me, ctx.options)) throw new GameError("Du kannst legen – aufnehmen nur, wenn nichts passt.");
  const took = s.discard.length;
  s.hands[me] = sortCards([...s.hands[me], ...s.discard]);
  s.discard = [];
  s.stall = (s.stall ?? 0) + 1;
  s.last = { id: me, kind: "take", cards: [], src: src ?? "hand", burn: null, took, out: false };
  s.n++;
  s.log.push(`${nameOf(ctx, me)} nimmt den Stapel auf (${took} ${took === 1 ? "Karte" : "Karten"})`);
  sync(s);
  s.curId = nextActive(s, ctx.players, me);
}

function arrange(s: PalastState, who: string, up: unknown) {
  if (!Array.isArray(up) || up.length !== s.up[who].length) throw new GameError("Lege genau drei Karten offen.");
  for (const c of up) if (!isCardOf(DECK, c)) throw new GameError("Diese Karte gibt es nicht.");
  const pool = [...s.hands[who], ...s.up[who]];
  if (!takeOut(pool, up as Card[])) throw new GameError("Diese Karten hast du nicht.");
  s.up[who] = sortCards(up as Card[]);
  s.hands[who] = sortCards(pool);
}

function apply(prev: PalastState, a: PalastAction, ctx: GameContext): PalastState {
  const s = structuredClone(prev);
  if (s.phase === "over") throw new GameError("Die Partie ist vorbei.");
  const actor = ctx.actorId;
  switch (a.type) {
    case "arrange":
    case "ready": {
      if (s.phase !== "swap") throw new GameError("Getauscht wird nur vor dem Start.");
      const who = a.player ?? actor;
      if (!who || !(who in s.hands)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (actor !== null && who !== actor) throw new GameError("Tausch nur deine eigenen Karten.");
      if (s.ready[who]) throw new GameError("Du bist schon fertig.");
      if (a.type === "arrange") arrange(s, who, a.up);
      else {
        s.ready[who] = true;
        if (ctx.players.every((p) => s.ready[p.id])) { s.log.push("Alle haben getauscht"); startPlay(s, ctx); }
      }
      break;
    }
    case "play":
    case "blind":
    case "take": {
      if (s.phase !== "play" || !s.curId) throw new GameError("Gerade wird nicht gespielt.");
      if (a.type === "play") playCards(s, ctx, s.curId, a.cards);
      else if (a.type === "blind") blind(s, ctx, s.curId, a.i);
      else take(s, ctx, s.curId);
      break;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
  sync(s);
  return s;
}

/** Plätze: zuerst fertig = Platz 1, wer übrig bleibt (Palastwache) zuletzt */
export function standings(s: PalastState, players: Player[]): { id: string; place: number; guard: boolean; left: number }[] {
  const ids = players.map((p) => p.id);
  const order = [...s.out.filter((id) => ids.includes(id)),
    ...players.filter((p) => !s.out.includes(p.id) && p.id !== s.guard).sort((a, b) => cardsLeft(s, a.id) - cardsLeft(s, b.id)).map((p) => p.id),
    ...(s.guard && ids.includes(s.guard) ? [s.guard] : [])];
  return order.map((id, i) => ({ id, place: i + 1, guard: id === s.guard, left: cardsLeft(s, id) }));
}

// ---------------------------------------------------------------- Vorschläge (Bots, Spielhilfe, Host übernimmt)

/** Wie stark ist eine Karte? 2 und 10 sind die besten, dann Ass bis 3 */
export function strength(c: Card): number {
  const r = rankOf(c);
  return r === BURN ? 14 : r === RESET ? 13 : valueOf(c);
}

/** Vorschlag zum Tauschen: die drei stärksten Karten offen hinlegen */
export function suggestUp(hand: Card[], up: Card[]): Card[] {
  return sortCards([...hand, ...up].sort((a, b) => strength(b) - strength(a)).slice(0, up.length));
}

export type Move = { type: "play"; cards: Card[] } | { type: "blind"; i: number } | { type: "take" };

/**
 * Vorschlag für den Zug: die niedrigste passende normale Karte (alle gleichen zusammen), Sonderkarten spät.
 * Eine 10 lohnt sich auf einem großen Stapel, eine 2 nur, wenn sonst nichts geht.
 */
export function suggestMove(s: PalastState, me: string, o: Options): Move | null {
  const src = sourceOf(s, me);
  if (!src) return null;
  if (src === "down") {
    return { type: "blind", i: Math.max(0, (s.downLeft[me] ?? []).findIndex(Boolean)) };
  }
  const from = sourceCards(s, me);
  const ok = from.filter((c) => fits(s, rankOf(c), o));
  if (!ok.length) return { type: "take" };
  const all = (r: Rank) => from.filter((c) => rankOf(c) === r);
  const normal = ok.filter((c) => rankOf(c) !== RESET && rankOf(c) !== BURN);
  // Solange nachgezogen wird, gehen hohe Karten nicht verloren – die niedrigste passende zuerst
  if (normal.length) {
    const low = normal.reduce((a, b) => (valueOf(b) < valueOf(a) ? b : a));
    // großer Stapel und eine 10 zur Hand: lieber verbrennen als eine hohe Karte opfern
    const ten = ok.find((c) => rankOf(c) === BURN);
    if (ten && s.discard.length >= 6 && valueOf(low) >= rankValue("B")) return { type: "play", cards: all(BURN) };
    return { type: "play", cards: all(rankOf(low)) };
  }
  const ten = ok.find((c) => rankOf(c) === BURN);
  const two = ok.find((c) => rankOf(c) === RESET);
  // Eine 10 auf einen kleinen Stapel ist Verschwendung – dann lieber die 2 (der Nächste muss wieder klein anfangen)
  if (two && (!ten || s.discard.length < 4)) return { type: "play", cards: [two] };
  return { type: "play", cards: [ten ?? two!] };
}

/** Alle sinnvollen Züge des Spielers am Zug (je Wert eine bis alle Karten) */
export function legalMoves(s: PalastState, me: string, o: Options): Move[] {
  const src = sourceOf(s, me);
  if (!src) return [];
  if (src === "down") return (s.downLeft[me] ?? []).flatMap((x, i) => (x ? [{ type: "blind" as const, i }] : []));
  const from = sourceCards(s, me);
  const out: Move[] = [];
  for (const r of RANKS) {
    const cs = from.filter((c) => rankOf(c) === r);
    if (!cs.length || !fits(s, r, o)) continue;
    for (let k = 1; k <= cs.length; k++) out.push({ type: "play", cards: cs.slice(0, k) });
  }
  if (!out.length) out.push({ type: "take" });
  return out;
}

export const palast: GameLogic<PalastState, PalastAction> = {
  info: {
    id: "palast",
    name: "Palast",
    tagline: "Gleich hoch oder höher legen, mit der 10 verbrennen – wer zuletzt Karten hat, hält die Palastwache.",
    category: "Karten",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "15–30 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  presets: [
    { id: "ohneSieben", label: "Ohne Sieben", hint: "7 ist eine normale Karte", options: { seven: false } },
    { id: "schnell", label: "Schnell", hint: "ohne Tauschen", options: { swap: false } },
  ],
  settings: [
    { key: "seven", label: "Sieben", type: "toggle", default: true, hint: "Auf eine 7 darf nur 7 oder niedriger gelegt werden", group: "Hausregeln" },
    { key: "four", label: "Vier gleiche verbrennen", type: "toggle", default: true, hint: "Liegen vier gleiche Werte hintereinander oben, wird die Ablage verbrannt", group: "Hausregeln" },
    { key: "swap", label: "Tauschen vor dem Start", type: "toggle", default: true, hint: "Hand- und offene Tischkarten dürfen vor Spielbeginn getauscht werden", group: "Hausregeln" },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt an, wer dran ist, was gelegt wird, Verbrennen und wer fertig ist (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "play" || a.type === "blind" || a.type === "take" ? "turn" : a.type === "arrange" || a.type === "ready" ? "player" : null),
  currentPlayerId: (s) => (s.phase === "play" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const n = ctx.players.length;
    return standings(s, ctx.players).map((x) => ({ id: x.id, won: x.place === 1, score: n + 1 - x.place }));
  },
  skipLabel: (s, ctx) => {
    if (s.phase === "swap") {
      const open = ctx.players.filter((p) => !s.ready[p.id]).map((p) => p.name);
      return open.length ? `Für ${open.join(", ")} fertig melden` : null;
    }
    if (s.phase === "play" && s.curId) return `Für ${nameOf(ctx, s.curId)} ziehen`;
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "swap") {
      const open = ctx.players.filter((p) => !s.ready[p.id]);
      for (const p of open) s.ready[p.id] = true;
      if (open.length) s.log.push(`Für ${open.map((p) => p.name).join(", ")} fertig gemeldet`);
      s.log.push("Alle haben getauscht");
      startPlay(s, ctx);
    } else if (s.phase === "play" && s.curId) {
      const me = s.curId;
      const m = suggestMove(s, me, ctx.options);
      if (m) {
        s.log.push(`Für ${nameOf(ctx, me)} gezogen`);
        if (m.type === "play") playCards(s, ctx, me, m.cards);
        else if (m.type === "blind") blind(s, ctx, me, m.i);
        else take(s, ctx, me);
      }
    }
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    // Seine Karten gehen aus dem Spiel
    if (s.phase !== "over") s.burned.push(...(s.hands[id] ?? []), ...(s.up[id] ?? []), ...((s.down[id] ?? []).filter(Boolean) as Card[]));
    for (const m of [s.hands, s.up, s.down, s.ready]) delete (m as Record<string, unknown>)[id];
    if (s.phase === "over") { sync(s); return s; }
    s.out = s.out.filter((x) => x !== id);
    const rctx = { ...ctx, players: rest };
    s.log.push(`${nameOf(ctx, id)} ist raus – die Karten gehen aus dem Spiel`);
    if (s.dealerId === id) s.dealerId = rest[0]?.id ?? null;
    if (s.phase === "swap") {
      if (rest.length < 2) { s.phase = "over"; s.curId = null; s.guard = null; sync(s); return s; }
      if (rest.every((p) => s.ready[p.id])) startPlay(s, rctx);
      sync(s);
      return s;
    }
    sync(s);
    if (checkEnd(s, rctx)) { sync(s); return s; }
    if (s.curId === id) s.curId = nextActive(s, ctx.players, id);
    sync(s);
    return s;
  },
  botPause: (s) => (s.last?.burn ? 1500 : s.last?.kind === "take" || s.last?.kind === "blindFail" ? 1200 : 0),
  view: (s, viewer) => {
    if (viewer === null) return s;
    const own = viewer in s.hands ? { [viewer]: s.hands[viewer] } : {};
    return { ...s, hands: own, down: {}, pile: [] };
  },
};
