/**
 * Bluff – Würfel-Bluffspiel mit verdeckten Bechern. Läuft im Browser (lokal) und im Durable Object (online).
 * Jeder würfelt verdeckt unter seinem Becher. Reihum wird angesagt „mindestens N Würfel zeigen X“ – über alle Becher.
 * Jede Ansage muss höher sein. Wer nicht erhöhen will, ruft „Bluff!“: alle decken auf, wer falschlag, verliert einen Würfel.
 * Einsen sind Joker (Hausregel). „Genau!“: stimmt die Ansage exakt, bekommt der Rufer einen Würfel zurück.
 * Wer keine Würfel mehr hat, ist raus; der Letzte gewinnt. Mit echten Würfeln führt die App Ansagen und Würfelzahl.
 */
import { rollDice } from "../../platform/random";
import { firstPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

const MAX_LOG = 80;

export interface Bid { by: string; count: number; face: number }

export interface BluffReveal {
  kind: "bluff" | "exact";
  /** wer gerufen hat */
  by: string;
  bid: Bid;
  /** so viele Würfel zählen wirklich (mit Jokern) */
  actual: number;
  /** alle Becher beim Aufdecken (leer bei echten Würfeln) */
  cups: Record<string, number[]>;
  /** Ansage hielt (mindestens so viele) */
  holds: boolean;
  /** verliert einen Würfel (null: niemand – „Genau!“ stimmte) */
  loser: string | null;
  /** bekommt einen Würfel zurück */
  gainer: string | null;
  /** Verlierer ist damit raus */
  out: boolean;
  /** danach ist die Partie entschieden */
  final: boolean;
}

export interface BluffState {
  v: 1;
  /** echte Würfel am Tisch – die App führt Ansagen und zählt die Würfel */
  table: boolean;
  phase: "bid" | "reveal" | "over";
  /** Würfel je Spieler (0 = raus) */
  count: Record<string, number>;
  /** Augen unter den Bechern – jeder sieht nur seinen eigenen */
  cups: Record<string, number[]>;
  /** ausgeschiedene Spieler in Reihenfolge */
  out: string[];
  /** in welcher Runde jemand ausgeschieden ist */
  outRound?: Record<string, number>;
  curId: string | null;
  /** Ansagen der laufenden Runde, älteste zuerst */
  bids: Bid[];
  reveal: BluffReveal | null;
  /** wer die nächste Runde beginnt (nach dem Aufdecken) */
  starter: string | null;
  round: number;
  log: string[];
  /** zählt Züge, damit die Oberfläche neu animieren kann */
  n: number;
  winnerId: string | null;
}

export type BluffAction =
  | { type: "bid"; count: number; face: number }
  /** „Bluff!“ – mit echten Würfeln sagt der Rufer nach dem Aufdecken, wie viele es wirklich sind */
  | { type: "doubt"; actual?: number }
  /** „Genau!“ */
  | { type: "exact"; actual?: number }
  | { type: "next" };

export const diceOf = (o: Options) => Math.min(6, Math.max(1, Math.round(Number(o.startDice) || 5)));
export const jokersOf = (o: Options) => o.jokers !== false;
export const exactOf = (o: Options) => o.exact !== false;

const FACE_PL = ["", "Einsen", "Zweien", "Dreien", "Vieren", "Fünfen", "Sechsen"];
const FACE_SG = ["", "Eins", "Zwei", "Drei", "Vier", "Fünf", "Sechs"];
/** „drei Fünfen“, „eine Sechs“ – zum Vorlesen und Anzeigen */
export const faceName = (face: number, count = 2) => (count === 1 ? FACE_SG[face] : FACE_PL[face]);
export const bidLabel = (b: { count: number; face: number }) => `${b.count} × ${faceName(b.face, b.count)}`;
const NUM = ["null", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
/** „drei Fünfen“ zum Vorlesen */
export const bidSpoken = (b: { count: number; face: number }) => `${NUM[b.count] ?? b.count} ${faceName(b.face, b.count)}`;

export const isAlive = (s: BluffState, id: string) => (s.count[id] ?? 0) > 0;
export const totalDice = (s: BluffState) => Object.values(s.count).reduce((t, n) => t + Math.max(0, n), 0);
export const lastBid = (s: BluffState): Bid | null => s.bids.at(-1) ?? null;

/** Zählt dieser Würfel für die Augenzahl? Mit Jokern zählt die Eins für alles (außer bei Ansagen auf Einsen ohnehin) */
export const matches = (d: number, face: number, jokers: boolean) => d === face || (jokers && d === 1);
export const countMatches = (dice: readonly number[], face: number, jokers: boolean) => dice.filter((d) => matches(d, face, jokers)).length;

/**
 * Ist `next` höher als `prev`? Mehr Würfel, oder gleich viele mit höherer Augenzahl.
 * Mit Jokern zählen Einsen doppelt so viel: auf Einsen wechseln reicht die halbe Anzahl (aufgerundet),
 * von Einsen zurück braucht es das Doppelte plus eins.
 */
export function isHigher(prev: { count: number; face: number }, next: { count: number; face: number }, jokers: boolean): boolean {
  if (jokers && (prev.face === 1 || next.face === 1)) {
    if (prev.face === 1 && next.face === 1) return next.count > prev.count;
    if (next.face === 1) return next.count >= Math.ceil(prev.count / 2);
    return next.count >= prev.count * 2 + 1;
  }
  return next.count > prev.count || (next.count === prev.count && next.face > prev.face);
}

/** Kleinste erlaubte Anzahl für eine Augenzahl (null: geht nicht) */
export function minCount(s: BluffState, face: number, options: Options): number | null {
  const jokers = jokersOf(options);
  const last = lastBid(s);
  const total = totalDice(s);
  let c: number;
  if (!last) {
    if (jokers && face === 1) return null;
    c = 1;
  } else {
    c = 1;
    while (c <= total && !isHigher(last, { count: c, face }, jokers)) c++;
  }
  return c <= total ? c : null;
}

/** Was darf der Spieler am Zug? */
export function turnOptions(s: BluffState, options: Options) {
  const last = lastBid(s);
  const raise = [1, 2, 3, 4, 5, 6].some((f) => minCount(s, f, options) !== null);
  return { bid: s.phase === "bid" && raise, doubt: s.phase === "bid" && !!last, exact: s.phase === "bid" && !!last && exactOf(options) };
}

/** Wahrscheinlichkeit, dass von `n` unbekannten Würfeln mindestens `k` mit Chance `p` passen */
export function atLeast(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let sum = 0, c = 1;
  for (let i = 0; i <= n; i++) {
    if (i > 0) c = (c * (n - i + 1)) / i;
    if (i >= k) sum += c * p ** i * (1 - p) ** (n - i);
  }
  return Math.min(1, sum);
}
/** … genau `k` */
export function exactly(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - i + 1)) / i;
  return c * p ** k * (1 - p) ** (n - k);
}

/** Wie wahrscheinlich stimmt die Ansage aus Sicht von `me` (eigene Würfel bekannt, fremde unbekannt)? */
export function bidChance(s: BluffState, me: string | null, bid: { count: number; face: number }, options: Options, exact = false) {
  const jokers = jokersOf(options);
  const mine = me ? s.cups[me] ?? [] : [];
  const have = countMatches(mine, bid.face, jokers);
  const unknown = totalDice(s) - mine.length;
  const p = jokers && bid.face !== 1 ? 1 / 3 : 1 / 6;
  return exact ? exactly(bid.count - have, unknown, p) : atLeast(bid.count - have, unknown, p);
}

/** Vorschlag für die Spielhilfe und die Bots: sicherste Erhöhung – oder zweifeln, wenn das besser ist */
export function suggest(s: BluffState, me: string, options: Options): { type: "bid"; count: number; face: number; chance: number } | { type: "doubt"; chance: number } {
  let best: { count: number; face: number; chance: number } | null = null;
  for (let face = 1; face <= 6; face++) {
    const c = minCount(s, face, options);
    if (c === null) continue;
    const chance = bidChance(s, me, { count: c, face }, options);
    if (!best || chance > best.chance + 1e-9 || (Math.abs(chance - best.chance) <= 1e-9 && face > best.face)) best = { count: c, face, chance };
  }
  const last = lastBid(s);
  const doubt = last ? 1 - bidChance(s, me, last, options) : 0;
  if (last && (!best || doubt > best.chance)) return { type: "doubt", chance: doubt };
  return { type: "bid", ...best! };
}

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "?";

function push(s: BluffState, t: string) {
  s.log.push(t);
  if (s.log.length > MAX_LOG) s.log.shift();
}

/** Nächster Spieler im Kreis mit Würfeln (ohne `from` selbst) */
export function nextAlive(s: BluffState, players: Player[], from: string | null): string | null {
  const i = players.findIndex((p) => p.id === from);
  for (let k = 1; k <= players.length; k++) {
    const p = players[(i + k + players.length) % players.length];
    if (p.id !== from && isAlive(s, p.id)) return p.id;
  }
  return null;
}

/** Neue Runde: alle würfeln verdeckt neu, `starter` sagt zuerst an */
function newRound(s: BluffState, starter: string | null) {
  s.phase = "bid";
  s.bids = [];
  s.round++;
  s.curId = starter && isAlive(s, starter) ? starter : null;
  s.cups = {};
  for (const [id, n] of Object.entries(s.count)) if (n > 0) s.cups[id] = s.table ? [] : rollDice(n).sort((a, b) => a - b);
  s.n++;
}

function alive(s: BluffState, players: Player[]) {
  return players.filter((p) => isAlive(s, p.id));
}

function finish(s: BluffState, players: Player[]) {
  const left = alive(s, players);
  s.phase = "over";
  s.curId = null;
  s.winnerId = left.length === 1 ? left[0].id : left.sort((a, b) => (s.count[b.id] ?? 0) - (s.count[a.id] ?? 0))[0]?.id ?? null;
}

function setup(ctx: GameContext): BluffState {
  const n = diceOf(ctx.options);
  const s: BluffState = {
    v: 1, table: ctx.options.mode === "table", phase: "bid",
    count: Object.fromEntries(ctx.players.map((p) => [p.id, n])), cups: {}, out: [],
    curId: null, bids: [], reveal: null, starter: null, round: 0, log: [], n: 0, winnerId: null,
  };
  newRound(s, firstPlayerId(ctx));
  return s;
}

function resolve(s: BluffState, kind: "bluff" | "exact", actualIn: number | undefined, ctx: GameContext) {
  const cur = s.curId!;
  const last = lastBid(s);
  if (!last) throw new GameError("Es gibt noch keine Ansage.");
  if (kind === "exact" && !exactOf(ctx.options)) throw new GameError("„Genau!“ ist ausgeschaltet.");
  const jokers = jokersOf(ctx.options);
  let actual: number;
  if (s.table) {
    if (typeof actualIn !== "number" || !Number.isInteger(actualIn) || actualIn < 0 || actualIn > totalDice(s)) throw new GameError("Wie viele Würfel zeigen die Augenzahl?");
    actual = actualIn;
  } else {
    actual = Object.values(s.cups).reduce((t, d) => t + countMatches(d, last.face, jokers), 0);
  }
  const holds = actual >= last.count;
  let loser: string | null = null, gainer: string | null = null;
  if (kind === "bluff") loser = holds ? cur : last.by;
  else if (actual === last.count) { if ((s.count[cur] ?? 0) < diceOf(ctx.options)) gainer = cur; }
  else loser = cur;
  if (loser) s.count[loser] = Math.max(0, (s.count[loser] ?? 0) - 1);
  if (gainer) s.count[gainer] = (s.count[gainer] ?? 0) + 1;
  const out = !!loser && s.count[loser] === 0;
  if (out && !s.out.includes(loser!)) { s.out.push(loser!); (s.outRound ??= {})[loser!] = s.round; }
  const final = alive(s, ctx.players).length <= 1;
  s.reveal = { kind, by: cur, bid: last, actual, cups: s.table ? {} : structuredClone(s.cups), holds, loser, gainer, out, final };
  s.starter = kind === "exact" && !loser ? cur : out ? nextAlive(s, ctx.players, loser) : loser;
  const who = nameOf(ctx.players, cur);
  const res = loser ? `${nameOf(ctx.players, loser)} ${out ? "ist raus" : "verliert einen Würfel"}` : gainer ? `${who} bekommt einen Würfel zurück` : `${who} hat schon alle Würfel`;
  push(s, `${who}: ${kind === "bluff" ? "Bluff!" : "Genau!"} – ${actual} × ${faceName(last.face, actual)} – ${res}`);
  s.phase = "reveal";
  s.curId = null;
  s.n++;
}

function apply(prev: BluffState, a: BluffAction, ctx: GameContext): BluffState {
  if (prev.phase === "over") throw new GameError("Die Partie ist vorbei.");
  const s = structuredClone(prev);
  if (a.type === "next") {
    if (s.phase !== "reveal") throw new GameError("Gerade wird angesagt.");
    if (s.reveal?.final || alive(s, ctx.players).length <= 1) { finish(s, ctx.players); s.n++; return s; }
    const starter = s.starter && isAlive(s, s.starter) ? s.starter : nextAlive(s, ctx.players, s.starter);
    newRound(s, starter);
    return s;
  }
  if (s.phase !== "bid") throw new GameError("Erst weiter zur nächsten Runde.");
  const cur = s.curId;
  if (!cur || !ctx.players.some((p) => p.id === cur)) throw new GameError("Gerade ist niemand dran.");
  switch (a.type) {
    case "bid": {
      const { count, face } = a;
      if (!Number.isInteger(face) || face < 1 || face > 6) throw new GameError("Diese Augenzahl gibt es nicht.");
      if (!Number.isInteger(count) || count < 1) throw new GameError("Mindestens ein Würfel.");
      if (count > totalDice(s)) throw new GameError(`Es liegen nur ${totalDice(s)} Würfel im Spiel.`);
      const last = lastBid(s);
      const jokers = jokersOf(ctx.options);
      if (!last && jokers && face === 1) throw new GameError("Mit Einsen darf niemand eröffnen – sie sind Joker.");
      if (last && !isHigher(last, { count, face }, jokers)) throw new GameError(`Du musst mehr als ${bidLabel(last)} ansagen.`);
      const bid = { by: cur, count, face };
      s.bids.push(bid);
      push(s, `${nameOf(ctx.players, cur)}: ${bidLabel(bid)}`);
      s.curId = nextAlive(s, ctx.players, cur);
      s.n++;
      return s;
    }
    case "doubt":
      resolve(s, "bluff", a.actual, ctx);
      return s;
    case "exact":
      resolve(s, "exact", a.actual, ctx);
      return s;
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/**
 * Rangliste: der Sieger (bzw. wer noch Würfel hat, nach Würfeln) vorn, danach in umgekehrter Ausscheide-Reihenfolge –
 * wer später rausfliegt, steht weiter vorn. Klare Plätze 1, 2, 3 …
 */
export function standings(s: BluffState, players: Player[]): { id: string; place: number; dice: number; outRound: number | null }[] {
  const outIdx = (id: string) => s.out.indexOf(id);
  return [...players]
    .sort((a, b) => Number(b.id === s.winnerId) - Number(a.id === s.winnerId) || (s.count[b.id] ?? 0) - (s.count[a.id] ?? 0) || outIdx(b.id) - outIdx(a.id))
    .map((p, i) => ({ id: p.id, place: i + 1, dice: Math.max(0, s.count[p.id] ?? 0), outRound: isAlive(s, p.id) ? null : s.outRound?.[p.id] ?? null }));
}

export const bluff: GameLogic<BluffState, BluffAction> = {
  info: {
    id: "bluff",
    name: "Bluff",
    tagline: "Würfel unterm Becher, Ansagen über alle – erhöhst du oder rufst du „Bluff!“?",
    category: "Würfel",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "15–30 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  presets: [
    { id: "kurz", label: "Kurz", hint: "3 Würfel je Spieler", options: { startDice: 3 } },
    { id: "ohnejoker", label: "Ohne Joker", hint: "Einsen zählen nur als Eins", options: { jokers: false } },
  ],
  settings: [
    {
      key: "mode", label: "Würfel", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "jeder sieht nur seinen Becher" },
        { value: "table", label: "Echte Würfel", hint: "Becher am Tisch, App führt Ansagen" },
      ],
    },
    { key: "startDice", label: "Würfel je Spieler", type: "number", default: 5, min: 1, max: 6, step: 1 },
    { key: "jokers", label: "Einsen sind Joker", type: "toggle", default: true, group: "Hausregeln", hint: "Einsen zählen für jede Augenzahl – Ansagen auf Einsen brauchen nur die halbe Anzahl" },
    { key: "exact", label: "„Genau!“ rufen", type: "toggle", default: true, group: "Hausregeln", hint: "Stimmt die Ansage exakt, bekommt der Rufer einen Würfel zurück – sonst verliert er einen" },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt Ansagen und Auflösung an (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "next" ? "player" : a.type === "bid" || a.type === "doubt" || a.type === "exact" ? "turn" : null),
  currentPlayerId: (s) => (s.phase === "bid" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const n = ctx.players.length;
    // Punkte nach Platz (Sieger n, Letzter 1) – so zählt auch, wer später ausgeschieden ist
    return standings(s, ctx.players).map((x) => ({ id: x.id, won: x.id === s.winnerId, score: n + 1 - x.place }));
  },
  skipLabel: (s, ctx) => (s.phase === "bid" && s.curId ? `${nameOf(ctx.players, s.curId)} überspringen (neu würfeln)` : null),
  skipTurn(prev, ctx) {
    if (prev.phase !== "bid" || !prev.curId) return prev;
    const s = structuredClone(prev);
    const id = s.curId!;
    push(s, `${nameOf(ctx.players, id)} übersprungen – alle würfeln neu`);
    newRound(s, nextAlive(s, ctx.players, id));
    s.round--;
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    if (prev.phase === "over") return prev;
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    const after = nextAlive(s, ctx.players, id);
    if (isAlive(s, id)) { s.out.push(id); (s.outRound ??= {})[id] = s.round; }
    s.count[id] = 0;
    delete s.cups[id];
    if (alive(s, rest).length <= 1) { finish(s, rest); s.n++; return s; }
    if (s.phase === "reveal") {
      if (s.starter === id) s.starter = after;
      return s;
    }
    if (s.curId === id || s.bids.some((b) => b.by === id)) {
      push(s, `${nameOf(ctx.players, id)} ist gegangen – alle würfeln neu`);
      newRound(s, s.curId === id ? after : s.curId);
      s.round--;
    }
    return s;
  },
  botPause: (s) => (s.phase === "reveal" ? 4500 : s.bids.length ? 900 : 300),
  /** Jeder sieht nur seinen eigenen Becher – aufgedeckt wird über `reveal` */
  view: (s, viewer) => (viewer === null ? s : { ...s, cups: s.cups[viewer] ? { [viewer]: s.cups[viewer] } : {} }),
};
