/**
 * Klingel – Reaktions-Kartenspiel für 2 bis 6. Jeder hat einen verdeckten Stapel Obstkarten (vier Sorten, je Karte 1–5 Früchte
 * einer Sorte). Reihum deckt jeder seine oberste Karte auf seinen offenen Stapel; es zählt nur die jeweils oberste offene Karte.
 * Liegen von einer Sorte genau fünf Früchte offen, haut man auf die Klingel: Wer zuerst richtig klingelt, bekommt alle offenen
 * Karten. Falsch geklingelt: an jeden Mitspieler eine Karte. Wer keine Karten mehr hat, ist raus. Gewonnen hat, wer am Ende alle
 * Karten hat – oder nach dem Zeitlimit die meisten.
 *
 * Wer zuerst klingelt, entscheidet online der Server: Das erste Klingeln öffnet ein kurzes Sammelfenster (`WINDOW_MS`), danach
 * gewinnt die kürzeste Reaktionszeit. Die misst jedes Handy selbst (vom Anzeigen der Lage bis zum Tippen) – so zählt die
 * Netzlaufzeit nicht. Damit niemand schummelt, liegt die Zeit immer zwischen dem, was der Server selbst gemessen hat, abzüglich
 * der größten erlaubten Laufzeit (`MAX_LAG`), und dem, was er gemessen hat; schneller als `MIN_RT` geht nicht.
 * Jede Lage hat eine Nummer (`seq`) – ein Klingeln zu einer alten Lage kommt zu spät und zählt nicht.
 *
 * Zeit nur aus `ctx.now`. Die verdeckten Stapel sieht niemand (in der Sicht nur ihre Größe).
 */
import { randomInt, shuffle } from "../../platform/random";
import { firstPlayerId, playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type PlayerResult } from "../../platform/types";

export const FRUITS = ["erdbeere", "banane", "pflaume", "birne"] as const;
export type Fruit = (typeof FRUITS)[number];
export const FRUIT_NAME: Record<Fruit, { one: string; many: string }> = {
  erdbeere: { one: "Erdbeere", many: "Erdbeeren" },
  banane: { one: "Banane", many: "Bananen" },
  pflaume: { one: "Pflaume", many: "Pflaumen" },
  birne: { one: "Birne", many: "Birnen" },
};
/** Karten je Sorte: so oft gibt es 1, 2, 3, 4 und 5 Früchte */
export const PER_COUNT = [5, 3, 3, 2, 1] as const;
export const DECK_SIZE = FRUITS.length * PER_COUNT.reduce((a, b) => a + b, 0);
/** Genau so viele Früchte einer Sorte müssen offen liegen */
export const TARGET = 5;

/** Sammelfenster nach dem ersten Klingeln (online) */
export const WINDOW_MS = 150;
/** schnellste Reaktion, die zählt */
export const MIN_RT = 120;
/** so viel Netzlaufzeit wird höchstens herausgerechnet */
export const MAX_LAG = 400;
/** ohne Takt: so lange wartet das Spiel auf den, der aufdecken muss, dann deckt es selbst auf */
export const TURN_MS = 8000;
/** nach einer Klingel kurz Luft holen, bevor im Takt weiter aufgedeckt wird */
export const RING_PAUSE_MS = 1500;
/** Sicherung gegen endlose Partien: spätestens nach so vielen Karten wird gezählt */
export const MAX_FLIPS = 1500;
export const PACES = { ruhig: 3000, normal: 2000, schnell: 1300 } as const;
export type Pace = keyof typeof PACES;
export const LIMITS = ["0", "5", "10", "15"] as const;

/** Karte als Text, z. B. „banane-3“ */
export type Card = `${Fruit}-${number}`;
export const fruitOf = (c: string): Fruit => c.slice(0, c.indexOf("-")) as Fruit;
export const countOf = (c: string): number => Number(c.slice(c.indexOf("-") + 1)) || 0;
const isCard = (c: unknown): c is Card => typeof c === "string" && FRUITS.includes(fruitOf(c)) && countOf(c) >= 1 && countOf(c) <= 5;

export interface Claim { id: string; /** gewertete Reaktionszeit in ms */ rt: number; /** Eingang beim Server */ at: number }

/** Was zuletzt an der Klingel passiert ist – für Anzeige, Animation und Ansage */
export interface RingEvent {
  /** zählt hoch – neue Animation */
  n: number;
  by: string;
  ok: boolean;
  /** Karten bekommen (richtig) bzw. abgegeben (falsch) */
  cards: number;
  /** richtig: welche Sorte stand auf fünf, Reaktionszeit, wer auch geklingelt hat */
  fruit?: Fruit;
  rt?: number;
  also?: string[];
  /** falsch: an wen ging je eine Karte */
  to?: string[];
  /** dabei rausgeflogen */
  out?: string[];
}

export interface KlState {
  v: 1;
  phase: "play" | "over";
  order: string[];
  names: Record<string, string>;
  /** verdeckte Stapel, oberste Karte zuletzt – in der Sicht nur „?“ */
  stock: Record<string, string[]>;
  /** offene Stapel, oberste Karte zuletzt */
  open: Record<string, string[]>;
  curId: string | null;
  /** Nummer der Lage (ändert sich, sobald sich eine oberste offene Karte ändert) */
  seq: number;
  /** seit wann diese Lage offen liegt (Serverzeit) */
  shownAt: number;
  /** letzte Änderung (Serverzeit) – Handys rechnen Wartezeiten ab dem Empfang */
  at: number;
  /** wann von selbst aufgedeckt wird (Takt bzw. Wartezeit) */
  nextAt: number | null;
  /** Klingel gedrückt, Sammelfenster offen */
  ring: { until: number; claims: Claim[] } | null;
  /** auf dieser Lage schon falsch geklingelt */
  fouls: string[];
  last: RingEvent | null;
  events: number;
  /** raus (keine Karten mehr), in dieser Reihenfolge */
  out: string[];
  left: string[];
  auto: boolean;
  pace: number;
  limitAt: number | null;
  flips: number;
  local: boolean;
  winners: string[];
  /** Ende nach Zeit (dann zählen die meisten Karten) */
  timeUp: boolean;
  log: string[];
}

export type KlAction =
  /** oberste Karte aufdecken – `player` nur an einem Handy für alle (sonst wer dran ist) */
  | { type: "flip" }
  /** Klingel: zur Lage `seq`, `rt` = gemessene Reaktionszeit in ms; `player` an einem Handy für alle */
  | { type: "ring"; seq: number; rt?: number; player?: string }
  /** Fällige Zeit auslösen: Sammelfenster schließen, im Takt aufdecken, Zeitlimit */
  | { type: "tick" };

const nameOf = (s: KlState, ctx: GameContext, id: string | null | undefined) => (id && s.names[id]) || playerName(ctx, id);

function pushLog(s: KlState, line: string) {
  s.log.push(line);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

export const cardsOf = (s: KlState, id: string) => (s.stock[id]?.length ?? 0) + (s.open[id]?.length ?? 0);
/** noch im Spiel (nicht raus, nicht ausgestiegen) */
export const active = (s: KlState) => s.order.filter((id) => !s.out.includes(id) && !s.left.includes(id));
export const topOf = (s: KlState, id: string): string | null => s.open[id]?.at(-1) ?? null;

/** Früchte je Sorte auf den obersten offenen Karten */
export function fruitTotals(s: Pick<KlState, "order" | "open" | "out" | "left">): Record<Fruit, number> {
  const t: Record<Fruit, number> = { erdbeere: 0, banane: 0, pflaume: 0, birne: 0 };
  for (const id of s.order) {
    if (s.out.includes(id) || s.left.includes(id)) continue;
    const c = s.open[id]?.at(-1);
    if (c && isCard(c)) t[fruitOf(c)] += countOf(c);
  }
  return t;
}
/** Welche Sorte steht gerade auf genau fünf? (null: Klingeln wäre falsch) */
export function readyFruit(s: Pick<KlState, "order" | "open" | "out" | "left">): Fruit | null {
  const t = fruitTotals(s);
  return FRUITS.find((f) => t[f] === TARGET) ?? null;
}

/**
 * Gewertete Reaktionszeit: was das Handy gemessen hat, aber nie schneller als `MIN_RT`, nie langsamer als der Server selbst
 * gemessen hat (`elapsed` = Eingang minus Aufdecken) und nie mehr als `MAX_LAG` darunter.
 */
export function judgedTime(rt: unknown, elapsed: number): number {
  const lo = Math.max(MIN_RT, elapsed - MAX_LAG);
  const hi = Math.max(lo, elapsed);
  const r = typeof rt === "number" && Number.isFinite(rt) ? rt : hi;
  return Math.round(Math.min(hi, Math.max(lo, r)));
}

/** Wer gewinnt das Klingeln? Kürzeste Zeit, bei Gleichstand wer zuerst ankam – ist auch das gleich, entscheidet das Los */
export function bestClaim(claims: Claim[]): Claim | null {
  if (!claims.length) return null;
  const best = Math.min(...claims.map((c) => c.rt));
  const fast = claims.filter((c) => c.rt === best);
  const first = Math.min(...fast.map((c) => c.at));
  const tied = fast.filter((c) => c.at === first);
  return tied[tied.length > 1 ? randomInt(tied.length) : 0];
}

export function newDeck(): string[] {
  const cards: string[] = [];
  for (const f of FRUITS) PER_COUNT.forEach((times, i) => { for (let k = 0; k < times; k++) cards.push(`${f}-${i + 1}`); });
  return cards;
}

/** Ab dem Startspieler reihum austeilen (bei Rest bekommen die ersten eine Karte mehr) */
export function deal(order: string[], start: string | null): Record<string, string[]> {
  const deck = shuffle(newDeck());
  const n = order.length;
  const from = Math.max(0, start ? order.indexOf(start) : 0);
  const stock: Record<string, string[]> = Object.fromEntries(order.map((id) => [id, []]));
  deck.forEach((c, i) => { stock[order[(from + i) % n]].push(c); });
  return stock;
}

const paceOf = (o: Options) => PACES[(String(o.pace) in PACES ? String(o.pace) : "normal") as Pace];
const limitOf = (o: Options) => (LIMITS.includes(String(o.limit) as never) ? Number(o.limit) : 10);

function setup(ctx: GameContext): KlState {
  const o = ctx.options;
  const order = ctx.players.map((p) => p.id);
  const start = firstPlayerId(ctx);
  const auto = o.auto === true;
  const pace = paceOf(o);
  const limit = limitOf(o);
  const s: KlState = {
    v: 1, phase: "play", order, names: Object.fromEntries(ctx.players.map((p) => [p.id, p.name])),
    stock: deal(order, start), open: Object.fromEntries(order.map((id) => [id, []])),
    curId: start, seq: 1, shownAt: ctx.now, at: ctx.now,
    nextAt: ctx.now + (auto ? pace + RING_PAUSE_MS : TURN_MS),
    ring: null, fouls: [], last: null, events: 0, out: [], left: [],
    auto, pace, limitAt: limit > 0 ? ctx.now + limit * 60_000 : null, flips: 0,
    local: ctx.actorId === null, winners: [], timeUp: false, log: [],
  };
  pushLog(s, `${nameOf(s, ctx, start)} deckt zuerst auf`);
  return s;
}

/** neue Lage: Nummer hoch, Uhr neu, Fehlklingler vergessen */
function newLayout(s: KlState, now: number) {
  s.seq++;
  s.shownAt = now;
  s.fouls = [];
}

/** Wer deckt als Nächstes auf? Der nächste im Spiel nach `from` (oder `from` selbst), der noch verdeckte Karten hat. */
function nextFlipper(s: KlState, from: string | null, includeSelf: boolean): string | null {
  const ids = active(s);
  if (!ids.length) return null;
  const n = s.order.length;
  const i = from ? s.order.indexOf(from) : -1;
  for (let k = includeSelf ? 0 : 1; k <= n; k++) {
    const id = s.order[(((i + k) % n) + n) % n];
    if (ids.includes(id) && (s.stock[id]?.length ?? 0) > 0) return id;
  }
  return null;
}

/** Niemand hat mehr verdeckte Karten: alle drehen ihren offenen Stapel um */
function turnOver(s: KlState, now: number) {
  for (const id of active(s)) {
    s.stock[id] = [...(s.open[id] ?? [])].reverse();
    s.open[id] = [];
  }
  newLayout(s, now);
  pushLog(s, "Alle drehen ihren offenen Stapel um");
}

function setTurn(s: KlState, from: string | null, includeSelf: boolean, now: number) {
  let next = nextFlipper(s, from, includeSelf);
  if (!next && active(s).length > 1) { turnOver(s, now); next = nextFlipper(s, from, includeSelf); }
  s.curId = next;
}

function schedule(s: KlState, now: number, pause = 0) {
  s.nextAt = s.phase === "play" ? now + (s.auto ? s.pace : TURN_MS) + pause : null;
}

/** Wer keine Karten mehr hat, ist raus. Gibt die Neuen zurück. */
function checkOut(s: KlState, ctx: GameContext): string[] {
  const gone = active(s).filter((id) => cardsOf(s, id) === 0);
  for (const id of gone) { s.out.push(id); pushLog(s, `${nameOf(s, ctx, id)} hat keine Karten mehr und ist raus`); }
  return gone;
}

/** Ende: einer hat alle Karten (bzw. als Einziger noch welche) – oder nach Zeit die meisten */
function checkOver(s: KlState, ctx: GameContext, force = false) {
  const ids = active(s);
  if (!force && ids.length > 1) return;
  const best = Math.max(0, ...ids.map((id) => cardsOf(s, id)));
  s.winners = ids.filter((id) => cardsOf(s, id) === best);
  s.phase = "over";
  s.ring = null;
  s.nextAt = null;
  s.curId = null;
  if (s.winners.length) pushLog(s, `${s.winners.map((id) => nameOf(s, ctx, id)).join(" und ")} ${s.winners.length > 1 ? "gewinnen" : "gewinnt"}`);
}

function finishByTime(s: KlState, ctx: GameContext, why: string) {
  s.timeUp = true;
  pushLog(s, why);
  checkOver(s, ctx, true);
}

function flip(s: KlState, ctx: GameContext, id: string) {
  const card = s.stock[id]?.pop();
  if (!card) throw new GameError("Du hast keine verdeckten Karten mehr.");
  s.open[id].push(card);
  s.flips++;
  newLayout(s, ctx.now);
  s.ring = null;
  setTurn(s, id, false, ctx.now);
  schedule(s, ctx.now);
  if (s.flips >= MAX_FLIPS) finishByTime(s, ctx, `${MAX_FLIPS} Karten aufgedeckt – es wird gezählt`);
}

/** Sammelfenster zu: der Schnellste bekommt alle offenen Karten */
function settle(s: KlState, ctx: GameContext) {
  const ring = s.ring;
  if (!ring) return;
  s.ring = null;
  const win = bestClaim(ring.claims);
  if (!win) return;
  const fruit = readyFruit(s) ?? undefined;
  const pile = shuffle(s.order.flatMap((id) => s.open[id] ?? []));
  for (const id of s.order) s.open[id] = [];
  // unter den eigenen verdeckten Stapel
  s.stock[win.id] = [...pile, ...(s.stock[win.id] ?? [])];
  newLayout(s, ctx.now);
  const out = checkOut(s, ctx);
  s.last = {
    n: ++s.events, by: win.id, ok: true, cards: pile.length, fruit, rt: win.rt,
    also: ring.claims.filter((c) => c.id !== win.id).map((c) => c.id), ...(out.length ? { out } : {}),
  };
  pushLog(s, `${nameOf(s, ctx, win.id)} klingelt zuerst und bekommt ${pile.length} Karten`);
  checkOver(s, ctx);
  if (s.phase !== "play") return;
  // Wer gewonnen hat, deckt als Nächstes auf
  setTurn(s, win.id, true, ctx.now);
  schedule(s, ctx.now, s.auto ? RING_PAUSE_MS : 0);
}

/** Falsch geklingelt: an jeden Mitspieler eine Karte (erst verdeckte, dann von unten aus dem offenen Stapel) */
function penalty(s: KlState, ctx: GameContext, id: string) {
  const to: string[] = [];
  let changed = false;
  for (const other of active(s)) {
    if (other === id) continue;
    let card = s.stock[id]?.pop();
    if (!card && s.open[id]?.length) {
      // die oberste offene Karte erst zuletzt – sonst ändert sich die Lage
      card = s.open[id].shift();
      if (!s.open[id].length) changed = true;
    }
    if (!card) break;
    s.stock[other] = [card, ...(s.stock[other] ?? [])];
    to.push(other);
  }
  s.fouls.push(id);
  const out = checkOut(s, ctx);
  if (changed) newLayout(s, ctx.now);
  s.last = { n: ++s.events, by: id, ok: false, cards: to.length, to, ...(out.length ? { out } : {}) };
  pushLog(s, `${nameOf(s, ctx, id)} klingelt falsch und gibt ${to.length === 1 ? "eine Karte" : `${to.length} Karten`} ab`);
  checkOver(s, ctx);
  if (s.phase !== "play") return;
  if (!s.curId || !active(s).includes(s.curId) || !s.stock[s.curId]?.length) setTurn(s, s.curId, true, ctx.now);
}

/** Ist das Sammelfenster zu? Lokal sofort, online nach `WINDOW_MS` oder sobald alle geklingelt haben. */
const windowDone = (s: KlState, now: number) => !!s.ring && (s.local || now >= s.ring.until || active(s).every((id) => s.ring!.claims.some((c) => c.id === id)));

function ringer(s: KlState, a: { player?: unknown }, ctx: GameContext): string {
  const id = ctx.actorId ?? (typeof a.player === "string" ? a.player : null);
  if (!id || !s.order.includes(id)) throw new GameError("Du spielst nicht mit.");
  if (!active(s).includes(id)) throw new GameError("Du bist schon raus.");
  return id;
}

function apply(prev: KlState, a: KlAction, ctx: GameContext): KlState {
  if (prev.phase === "over") throw new GameError("Das Spiel ist aus.");
  const s = structuredClone(prev);
  s.at = ctx.now;
  switch (a.type) {
    case "flip": {
      if (s.ring) {
        if (!windowDone(s, ctx.now)) throw new GameError("Erst die Klingel abwarten.");
        settle(s, ctx);
        // die Lage hat sich geändert – wer jetzt dran ist, deckt neu auf
        return s;
      }
      if (!s.curId) throw new GameError("Gerade deckt niemand auf.");
      flip(s, ctx, s.curId);
      return s;
    }
    case "ring": {
      if (s.ring && windowDone(s, ctx.now)) { settle(s, ctx); return s; }
      const id = ringer(s, a, ctx);
      // zu einer alten Lage: zu spät, zählt nicht
      if (!Number.isInteger(a.seq) || a.seq !== s.seq) return prev;
      if (s.ring) {
        if (s.ring.claims.some((c) => c.id === id)) return prev;
        s.ring.claims.push({ id, rt: judgedTime(a.rt, ctx.now - s.shownAt), at: ctx.now });
        if (windowDone(s, ctx.now)) settle(s, ctx);
        return s;
      }
      if (s.fouls.includes(id)) throw new GameError("Du hast hier schon falsch geklingelt.");
      if (!readyFruit(s)) { penalty(s, ctx, id); return s; }
      s.ring = { until: ctx.now + WINDOW_MS, claims: [{ id, rt: judgedTime(a.rt, ctx.now - s.shownAt), at: ctx.now }] };
      if (windowDone(s, ctx.now)) settle(s, ctx);
      return s;
    }
    case "tick": {
      if (s.ring) {
        if (!windowDone(s, ctx.now) && ctx.now < s.ring.until - 20) return prev;
        settle(s, ctx);
        return s;
      }
      if (s.limitAt !== null && ctx.now >= s.limitAt - 200) { finishByTime(s, ctx, "Die Zeit ist um – es wird gezählt"); return s; }
      if (s.nextAt !== null && ctx.now >= s.nextAt - 150 && s.curId) { flip(s, ctx, s.curId); return s; }
      return prev;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
}

/**
 * Rangliste am Ende: wer noch dabei ist, nach Karten (gleich viele teilen sich den Platz), dahinter die Ausgeschiedenen –
 * wer später rausgeflogen ist, steht weiter vorn.
 */
export function standings(s: KlState): { id: string; place: number; cards: number; out: boolean }[] {
  const alive = active(s).sort((a, b) => cardsOf(s, b) - cardsOf(s, a));
  const rows: { id: string; place: number; cards: number; out: boolean }[] = [];
  alive.forEach((id, i) => {
    const prev = rows[i - 1];
    rows.push({ id, place: prev && prev.cards === cardsOf(s, id) ? prev.place : i + 1, cards: cardsOf(s, id), out: false });
  });
  for (const id of [...s.out].reverse()) if (!s.left.includes(id)) rows.push({ id, place: rows.length + 1, cards: 0, out: true });
  return rows;
}

/** Ergebnis: Sieger, Punkte = Karten am Ende */
function results(s: KlState): PlayerResult[] {
  return s.order.filter((id) => !s.left.includes(id)).map((id) => ({ id, won: s.winners.includes(id), score: cardsOf(s, id) }));
}

export const klingel: GameLogic<KlState, KlAction> = {
  info: {
    id: "klingel",
    name: "Klingel",
    tagline: "Genau fünf gleiche Früchte? Schnell auf die Klingel!",
    category: "Karten",
    minPlayers: 2,
    maxPlayers: 6,
    duration: "10 Min.",
  },
  version: 1,
  turnBased: true,
  joinMidGame: false,
  presets: [
    { id: "takt", label: "Im Takt", hint: "deckt alle 2 s auf", options: { auto: true } },
    { id: "schnell", label: "Schnell", hint: "alle 1,3 s, 5 Min.", options: { auto: true, pace: "schnell", limit: "5" } },
  ],
  settings: [
    { key: "auto", label: "Automatisch aufdecken", type: "toggle", default: false, group: "Regeln", hint: "die App deckt im Takt für alle auf" },
    {
      key: "pace", label: "Takt", type: "choice", default: "normal", group: "Regeln", showIf: (o) => o.auto === true,
      choices: [{ value: "ruhig", label: "Ruhig", hint: "3 s" }, { value: "normal", label: "Normal", hint: "2 s" }, { value: "schnell", label: "Schnell", hint: "1,3 s" }],
    },
    { key: "limit", label: "Zeitlimit", type: "choice", default: "10", group: "Regeln", choices: LIMITS.map((v) => ({ value: v, label: v === "0" ? "Ohne" : `${v} Min.`, hint: v === "0" ? "bis einer alle hat" : "dann zählen die Karten" })) },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt an, wer klingelt und wer raus ist (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "flip" ? "turn" : a.type === "ring" || a.type === "tick" ? "player" : null),
  currentPlayerId: (s) => (s.phase === "play" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s) => results(s),
  skipLabel(s, ctx) {
    if (s.phase !== "play") return null;
    if (s.ring) return "Klingel auswerten";
    return s.curId ? `Für ${nameOf(s, ctx, s.curId)} aufdecken` : null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    s.at = ctx.now;
    if (s.phase !== "play") return s;
    if (s.ring) settle(s, ctx);
    else if (s.curId) flip(s, ctx, s.curId);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!s.order.includes(id) || s.left.includes(id) || s.phase !== "play") return s;
    s.at = ctx.now;
    s.left.push(id);
    pushLog(s, `${nameOf(s, ctx, id)} ist ausgestiegen`);
    if (s.ring) { s.ring.claims = s.ring.claims.filter((c) => c.id !== id); if (!s.ring.claims.length) s.ring = null; }
    // seine offene Karte zählt nicht mehr
    if (s.open[id]?.length) newLayout(s, ctx.now);
    checkOver(s, ctx);
    if (s.phase !== "play") return s;
    if (s.ring && windowDone(s, ctx.now)) settle(s, ctx);
    if (s.phase === "play" && (s.curId === id || !s.curId)) { setTurn(s, id, false, ctx.now); schedule(s, ctx.now); }
    return s;
  },
  view(s, viewer) {
    if (viewer === null) return s;
    return { ...s, stock: Object.fromEntries(Object.entries(s.stock).map(([id, xs]) => [id, xs.map(() => "?")])) };
  },
};
