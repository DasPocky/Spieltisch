/**
 * Zahlen-Rommé – Legespiel mit 106 Zahlensteinen (1–13 in vier Farben, je doppelt, dazu zwei Joker), 2–4 Spieler.
 * Jeder hat 14 Steine auf seiner Bank. Gültig sind Reihen (mind. drei aufeinanderfolgende Zahlen einer Farbe, keine 1 nach
 * der 13) und Gruppen (drei oder vier gleiche Zahlen in verschiedenen Farben). Das erste Auslegen braucht mindestens 30
 * Punkte nur aus eigenen Steinen. Danach darf der ganze Tisch umgebaut werden – am Zugende muss alles gültig sein und
 * mindestens ein eigener Stein liegen, sonst zieht man einen Stein. Wer zuerst keine Steine mehr hat, gewinnt die Runde.
 *
 * Ein Zug entsteht auf dem eigenen Gerät (Entwurf) und wird als Ganzes geschickt: `commit` mit dem neuen Tisch.
 * Der Server prüft ihn vollständig (`checkTable`). Steine heißen z. B. „r7a“ (Farbe, Zahl, erstes/zweites Exemplar),
 * die Joker „J1“ und „J2“.
 */
import { shuffle } from "../../platform/random";
import { firstPlayerId, nextPlayerId, playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export type Tile = string;
export const COLORS = ["r", "b", "g", "s"] as const;
export type TileColor = (typeof COLORS)[number];
export const COLOR_NAME: Record<TileColor, string> = { r: "Rot", b: "Blau", g: "Gelb", s: "Schwarz" };
/** Steine je Spieler zu Beginn */
export const HAND = 14;
/** Mindestpunkte beim ersten Auslegen */
export const FIRST = 30;
/** Joker zählt in der Wertung so viel */
export const JOKER_POINTS = 30;
/** Höchstens so viele Runden, auch beim Spiel auf Punkte – jede Partie endet */
export const MAX_ROUNDS = 20;
/** Spielraum für „Zeit um“ (Uhren gehen leicht unterschiedlich) */
const GRACE = 1500;

export const isJoker = (t: Tile) => t[0] === "J";
export const colorOf = (t: Tile): TileColor | null => (isJoker(t) ? null : (t[0] as TileColor));
export const numOf = (t: Tile): number => (isJoker(t) ? 0 : parseInt(t.slice(1, -1), 10));
export const tilePoints = (t: Tile) => (isJoker(t) ? JOKER_POINTS : numOf(t));
export const handPoints = (ts: Tile[]) => ts.reduce((a, t) => a + tilePoints(t), 0);

/** Alle Steine (mit oder ohne Joker) */
export function fullSet(joker = true): Tile[] {
  const out: Tile[] = [];
  for (const c of COLORS) for (let n = 1; n <= 13; n++) for (const k of ["a", "b"]) out.push(`${c}${n}${k}`);
  if (joker) out.push("J1", "J2");
  return out;
}
const ALL = new Set(fullSet(true));
export const isTile = (x: unknown): x is Tile => typeof x === "string" && ALL.has(x);

/** „Rot 7“, „Joker“ */
export function tileName(t: Tile): string {
  return isJoker(t) ? "Joker" : `${COLOR_NAME[colorOf(t)!]} ${numOf(t)}`;
}

// ---------------------------------------------------------------- Kombinationen

export interface Meld {
  kind: "run" | "set";
  /** Steine in der Reihenfolge, in der sie liegen (Reihe aufsteigend, Joker an seiner Stelle) */
  tiles: Tile[];
  /** vertretener Wert je Stein (Joker: die Zahl, für die er steht) */
  values: number[];
  points: number;
}

const colorIdx = (t: Tile) => (isJoker(t) ? 9 : COLORS.indexOf(colorOf(t)!));

/** Reihe genau in dieser Reihenfolge? (Joker an ihrer Stelle) */
function runAsIs(tiles: Tile[]): Meld | null {
  const i = tiles.findIndex((t) => !isJoker(t));
  if (i < 0) return null;
  const c = colorOf(tiles[i]);
  const start = numOf(tiles[i]) - i;
  if (start < 1 || start + tiles.length - 1 > 13) return null;
  for (let k = 0; k < tiles.length; k++) {
    const t = tiles[k];
    if (isJoker(t)) continue;
    if (colorOf(t) !== c || numOf(t) !== start + k) return null;
  }
  const values = tiles.map((_, k) => start + k);
  return { kind: "run", tiles: tiles.slice(), values, points: values.reduce((a, b) => a + b, 0) };
}

/** Reihe in irgendeiner Anordnung: Lücken mit Jokern füllen, übrige Joker oben anlegen (bis 13), sonst unten */
function runAny(tiles: Tile[]): Meld | null {
  const reals = tiles.filter((t) => !isJoker(t));
  const jokers = tiles.filter(isJoker);
  if (!reals.length || tiles.length > 13) return null;
  const c = colorOf(reals[0]);
  if (reals.some((t) => colorOf(t) !== c)) return null;
  const nums = reals.map(numOf).sort((a, b) => a - b);
  for (let k = 1; k < nums.length; k++) if (nums[k] === nums[k - 1]) return null;
  const min = nums[0], max = nums[nums.length - 1];
  const span = max - min + 1;
  if (span > tiles.length) return null;
  const extra = tiles.length - span;
  const up = Math.min(extra, 13 - max);
  const start = min - (extra - up);
  if (start < 1) return null;
  const byNum = new Map(reals.map((t) => [numOf(t), t]));
  const js = jokers.slice();
  const out: Tile[] = [];
  for (let v = start; v < start + tiles.length; v++) out.push(byNum.get(v) ?? js.shift()!);
  return runAsIs(out);
}

/** Gruppe: gleiche Zahl, verschiedene Farben, drei oder vier Steine */
function setOf(tiles: Tile[]): Meld | null {
  if (tiles.length > 4) return null;
  const reals = tiles.filter((t) => !isJoker(t));
  if (!reals.length) return null;
  const n = numOf(reals[0]);
  if (reals.some((t) => numOf(t) !== n)) return null;
  if (new Set(reals.map(colorOf)).size !== reals.length) return null;
  const sorted = [...reals.sort((a, b) => colorIdx(a) - colorIdx(b)), ...tiles.filter(isJoker)];
  return { kind: "set", tiles: sorted, values: sorted.map(() => n), points: n * sorted.length };
}

/**
 * Ist das eine gültige Kombination? Eine Reihe, die genau so liegt, bleibt so (der Joker behält seine Stelle);
 * sonst die beste gültige Anordnung (bei zwei Möglichkeiten die mit mehr Punkten).
 */
export function analyze(tiles: Tile[]): Meld | null {
  if (!Array.isArray(tiles) || tiles.length < 3) return null;
  const asIs = runAsIs(tiles);
  if (asIs) return asIs;
  const run = runAny(tiles), set = setOf(tiles);
  if (run && set) return run.points > set.points ? run : set;
  return run ?? set;
}
export const isValidMeld = (tiles: Tile[]) => analyze(tiles) !== null;

/** Steine einer Kombination ordentlich hinlegen (gültig: in ihrer Anordnung, sonst nach Farbe und Zahl) */
export function normalize(tiles: Tile[]): Tile[] {
  const m = analyze(tiles);
  if (m) return m.tiles;
  return tiles.slice().sort((a, b) => colorIdx(a) - colorIdx(b) || numOf(a) - numOf(b) || a.localeCompare(b));
}

/** Bank sortieren: nach Farbe (dann Zahl) oder nach Zahl (dann Farbe); Joker zuletzt */
export function sortTiles(ts: Tile[], by: "color" | "num" = "color"): Tile[] {
  return ts.slice().sort((a, b) => {
    if (isJoker(a) !== isJoker(b)) return isJoker(a) ? 1 : -1;
    return by === "color"
      ? colorIdx(a) - colorIdx(b) || numOf(a) - numOf(b) || a.localeCompare(b)
      : numOf(a) - numOf(b) || colorIdx(a) - colorIdx(b) || a.localeCompare(b);
  });
}

// ---------------------------------------------------------------- Zustand

export interface Last {
  id: string;
  kind: "commit" | "draw" | "pass" | "time";
  /** gelegte eigene Steine */
  laid: number;
  /** erstes Auslegen in diesem Zug: so viele Punkte */
  first: number | null;
  /** Steine danach (fertig = 0) */
  left: number;
}

export interface RoundResult {
  round: number;
  winner: string | null;
  /** keiner kam raus (Pool leer, alle haben gepasst) */
  blocked: boolean;
  /** Punkte dieser Runde je Spieler */
  points: Record<string, number>;
  /** Steinsumme, die jeder noch hatte */
  rest: Record<string, number>;
}

export interface ZrState {
  v: 1;
  /** an einem Gerät gestartet (keine Zugzeit) */
  local: boolean;
  phase: "play" | "round" | "over";
  round: number;
  joker: boolean;
  /** wer die Runde begonnen hat (wandert je Runde) */
  starterId: string | null;
  hands: Record<string, Tile[]>;
  counts: Record<string, number>;
  /** Pool zum Ziehen (Sicht: leer) */
  pool: Tile[];
  poolCount: number;
  /** der Tisch: Reihen und Gruppen */
  table: Tile[][];
  /** schon das erste Mal ausgelegt */
  melded: Record<string, boolean>;
  curId: string | null;
  /** Ende der Zugzeit in ms (null: ohne) */
  deadline: number | null;
  scores: Record<string, number>;
  rounds: RoundResult[];
  /** wie oft hintereinander gepasst wurde (Pool leer) */
  passes: number;
  last: Last | null;
  /** zählt Züge */
  n: number;
  log: string[];
}

export type ZrAction =
  | { type: "commit"; table: Tile[][] }
  | { type: "draw" }
  | { type: "timeUp" }
  | { type: "next" };

export interface Rules { joker: boolean; end: { rounds: number } | { target: number }; think: number }
export function rulesOf(o: Options): Rules {
  const e = String(o.end ?? "3");
  const end = e.startsWith("p") ? { target: Math.max(50, parseInt(e.slice(1), 10) || 200) } : { rounds: Math.min(MAX_ROUNDS, Math.max(1, parseInt(e, 10) || 3)) };
  const think = String(o.think ?? "120") === "off" ? 0 : Math.max(10, parseInt(String(o.think ?? "120"), 10) || 120);
  return { joker: o.joker !== false, end, think };
}

const MAX_LOG = 60;
const nameOf = playerName;
const steine = (n: number) => (n === 1 ? "einen Stein" : `${n} Steine`);

function sync(s: ZrState) {
  s.counts = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length]));
  s.poolCount = s.pool.length;
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

function startTurn(s: ZrState, ctx: GameContext, id: string | null) {
  s.curId = id;
  const think = rulesOf(ctx.options).think;
  s.deadline = !s.local && think > 0 && id ? ctx.now + think * 1000 : null;
}

function deal(s: ZrState, ctx: GameContext, starter: string | null) {
  const pool = shuffle(fullSet(s.joker));
  s.hands = Object.fromEntries(ctx.players.map((p) => [p.id, sortTiles(pool.splice(0, HAND))]));
  s.pool = pool;
  s.table = [];
  s.melded = Object.fromEntries(ctx.players.map((p) => [p.id, false]));
  s.passes = 0;
  s.last = null;
  s.phase = "play";
  s.starterId = starter;
  s.log.push(`Runde ${s.round}: ${nameOf(ctx, starter)} beginnt`);
  startTurn(s, ctx, starter);
  sync(s);
}

function setup(ctx: GameContext): ZrState {
  const joker = rulesOf(ctx.options).joker;
  const s: ZrState = {
    v: 1, local: ctx.actorId === null, phase: "play", round: 1, joker, starterId: null,
    hands: {}, counts: {}, pool: [], poolCount: 0, table: [], melded: {}, curId: null, deadline: null,
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])), rounds: [], passes: 0, last: null, n: 0, log: [],
  };
  deal(s, ctx, firstPlayerId(ctx));
  return s;
}

// ---------------------------------------------------------------- Zug prüfen

export interface TableCheck {
  ok: boolean;
  /** Grund, wenn nicht ok */
  error: string | null;
  /** Indizes der ungültigen Kombinationen */
  bad: number[];
  /** eigene Steine, die dazukommen */
  laid: Tile[];
  /** erstes Auslegen: Punkte der neuen Kombinationen (sonst 0) */
  points: number;
  /** erstes Auslegen: liegt noch alles vom Tisch unverändert da? */
  untouched: boolean;
}

const keyOf = (g: Tile[]) => g.slice().sort().join(",");

/**
 * Prüft einen neuen Tisch für `me`: nur Steine vom Tisch und von der eigenen Bank, nichts vom Tisch zurück auf die Bank,
 * jede Kombination gültig, mindestens ein eigener Stein – und beim ersten Auslegen der alte Tisch unverändert und
 * mindestens 30 Punkte nur aus eigenen Steinen.
 */
export function checkTable(s: ZrState, me: string, table: unknown): TableCheck {
  const fail = (error: string, extra: Partial<TableCheck> = {}): TableCheck => ({ ok: false, error, bad: [], laid: [], points: 0, untouched: true, ...extra });
  if (!Array.isArray(table) || table.length > 80) return fail("Ungültiger Tisch.");
  const seen = new Set<Tile>();
  for (const g of table) {
    if (!Array.isArray(g) || !g.length || g.length > 13) return fail("Ungültiger Tisch.");
    for (const t of g) {
      if (!isTile(t) || seen.has(t)) return fail("Ungültiger Tisch.");
      seen.add(t);
    }
  }
  const groups = table as Tile[][];
  const hand = new Set(s.hands[me] ?? []);
  const old = s.table.flat();
  for (const t of old) if (!seen.has(t)) return fail("Steine vom Tisch dürfen nicht auf die Bank.");
  const oldSet = new Set(old);
  for (const t of seen) if (!oldSet.has(t) && !hand.has(t)) return fail("Diesen Stein hast du nicht.");
  const laid = [...seen].filter((t) => !oldSet.has(t));
  const bad = groups.flatMap((g, i) => (isValidMeld(g) ? [] : [i]));
  let points = 0, untouched = true;
  if (!s.melded[me]) {
    // erstes Auslegen: der alte Tisch bleibt, wie er ist – neue Kombinationen nur aus eigenen Steinen
    const left = new Map<string, number>();
    for (const g of s.table) left.set(keyOf(g), (left.get(keyOf(g)) ?? 0) + 1);
    for (const g of groups) {
      const k = keyOf(g);
      if ((left.get(k) ?? 0) > 0) { left.set(k, left.get(k)! - 1); continue; }
      if (g.some((t) => oldSet.has(t))) untouched = false;
      else points += analyze(g)?.points ?? 0;
    }
    if ([...left.values()].some((v) => v > 0)) untouched = false;
  }
  const res = { bad, laid, points, untouched };
  if (bad.length) return fail(bad.length === 1 ? "Eine Kombination ist ungültig." : `${bad.length} Kombinationen sind ungültig.`, res);
  if (!laid.length) return fail("Leg mindestens einen eigenen Stein – sonst zieh einen.", res);
  if (!s.melded[me]) {
    if (!untouched) return fail("Beim ersten Auslegen darfst du den Tisch noch nicht umbauen.", res);
    if (points < FIRST) return fail(`Erstes Auslegen: mindestens ${FIRST} Punkte (jetzt ${points}).`, res);
  }
  return { ok: true, error: null, ...res };
}

// ---------------------------------------------------------------- Ablauf

function nextTurn(s: ZrState, ctx: GameContext) {
  startTurn(s, ctx, nextPlayerId(ctx.players, s.curId));
}

/** Runde vorbei: Verlierer minus ihre Steinsumme, der Gewinner bekommt die Summe der anderen */
function endRound(s: ZrState, ctx: GameContext, winner: string | null, blocked: boolean) {
  const ids = ctx.players.map((p) => p.id);
  const rest = Object.fromEntries(ids.map((id) => [id, handPoints(s.hands[id] ?? [])]));
  if (blocked) {
    const min = Math.min(...ids.map((id) => rest[id]));
    winner = ids.find((id) => rest[id] === min) ?? null;
  }
  const points: Record<string, number> = {};
  for (const id of ids) points[id] = id === winner ? 0 : -rest[id];
  if (winner) points[winner] = ids.filter((id) => id !== winner).reduce((a, id) => a + rest[id], 0) - rest[winner];
  for (const id of ids) s.scores[id] = (s.scores[id] ?? 0) + points[id];
  s.rounds.push({ round: s.round, winner, blocked, points, rest });
  s.log.push(blocked ? `Pool leer, keiner kann mehr – ${nameOf(ctx, winner)} hat am wenigsten und gewinnt die Runde` : `${nameOf(ctx, winner)} hat keine Steine mehr und gewinnt Runde ${s.round}`);
  s.curId = null;
  s.deadline = null;
  const r = rulesOf(ctx.options);
  const top = Math.max(...ids.map((id) => s.scores[id] ?? 0));
  const done = "rounds" in r.end ? s.round >= r.end.rounds : top >= r.end.target || s.round >= MAX_ROUNDS;
  s.phase = done ? "over" : "round";
  if (done) s.log.push("Die Partie ist vorbei");
}

function commit(s: ZrState, ctx: GameContext, me: string, table: unknown) {
  const c = checkTable(s, me, table);
  if (!c.ok) throw new GameError(c.error ?? "Ungültiger Zug.");
  const first = !s.melded[me];
  const laid = new Set(c.laid);
  s.hands[me] = s.hands[me].filter((t) => !laid.has(t));
  s.table = (table as Tile[][]).map(normalize);
  s.melded[me] = true;
  s.passes = 0;
  s.n++;
  const left = s.hands[me].length;
  s.last = { id: me, kind: "commit", laid: c.laid.length, first: first ? c.points : null, left };
  s.log.push(first ? `${nameOf(ctx, me)} legt zum ersten Mal aus: ${c.points} Punkte, ${steine(c.laid.length)}` : `${nameOf(ctx, me)} legt ${steine(c.laid.length)}`);
  sync(s);
  if (!left) { endRound(s, ctx, me, false); return; }
  nextTurn(s, ctx);
}

function draw(s: ZrState, ctx: GameContext, me: string, kind: "draw" | "time") {
  s.n++;
  if (s.pool.length) {
    s.hands[me] = sortTiles([...s.hands[me], s.pool.pop()!]);
    s.passes = 0;
    s.last = { id: me, kind, laid: 0, first: null, left: s.hands[me].length };
    s.log.push(kind === "time" ? `Zeit um – ${nameOf(ctx, me)} zieht einen Stein` : `${nameOf(ctx, me)} zieht einen Stein`);
  } else {
    s.passes++;
    s.last = { id: me, kind: kind === "time" ? "time" : "pass", laid: 0, first: null, left: s.hands[me].length };
    s.log.push(kind === "time" ? `Zeit um – ${nameOf(ctx, me)} passt (Pool leer)` : `${nameOf(ctx, me)} passt (Pool leer)`);
  }
  sync(s);
  if (!s.pool.length && s.passes >= ctx.players.length) { endRound(s, ctx, null, true); return; }
  nextTurn(s, ctx);
}

function apply(prev: ZrState, a: ZrAction, ctx: GameContext): ZrState {
  if (prev.phase === "over") throw new GameError("Die Partie ist vorbei.");
  if (a.type === "timeUp") {
    // jedes Gerät meldet es – gezählt wird nur das erste, und nur wenn die Zeit wirklich um ist
    if (prev.phase !== "play" || !prev.curId || prev.deadline === null || ctx.now < prev.deadline - GRACE) return prev;
    const s = structuredClone(prev);
    draw(s, ctx, s.curId!, "time");
    return s;
  }
  const s = structuredClone(prev);
  switch (a.type) {
    case "commit":
    case "draw": {
      if (s.phase !== "play" || !s.curId) throw new GameError("Gerade ist niemand am Zug.");
      if (a.type === "commit") commit(s, ctx, s.curId, a.table);
      else draw(s, ctx, s.curId, "draw");
      break;
    }
    case "next": {
      if (s.phase !== "round") throw new GameError("Die Runde läuft noch.");
      s.round++;
      deal(s, ctx, nextPlayerId(ctx.players, s.starterId));
      break;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
  sync(s);
  return s;
}

/** Rangfolge nach Gesamtpunkten */
export function standings(s: ZrState, players: Player[]): { id: string; score: number }[] {
  return players.map((p) => ({ id: p.id, score: s.scores[p.id] ?? 0 })).sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- Vorschläge (Bots, Spielhilfe)

/** Bausteine einer möglichen Kombination: „r7“ (Farbe + Zahl) oder „J“ */
type Slot = string;
const slotOf = (t: Tile) => (isJoker(t) ? "J" : t.slice(0, -1));

/** Alle Kombinationen, die sich aus diesen Steinen bilden ließen (als Bausteine) */
function candidates(counts: Map<Slot, number>): Slot[][] {
  const jokers = counts.get("J") ?? 0;
  const has = (c: string, n: number) => (counts.get(`${c}${n}`) ?? 0) > 0;
  const out: Slot[][] = [];
  for (const c of COLORS) {
    for (let a = 1; a <= 11; a++) {
      let missing = 0;
      for (let b = a; b <= 13; b++) {
        if (!has(c, b)) missing++;
        if (missing > jokers) break;
        const len = b - a + 1;
        if (len < 3) continue;
        // Reihen ganz aus Jokern an einem Ende lohnen nicht – mindestens das erste und letzte Feld echt oder Lücke gefüllt
        const slots: Slot[] = [];
        for (let v = a; v <= b; v++) slots.push(has(c, v) ? `${c}${v}` : "J");
        if (slots.filter((x) => x !== "J").length >= 2 || len === 3) out.push(slots);
      }
    }
  }
  for (let n = 1; n <= 13; n++) {
    const cs = COLORS.filter((c) => has(c, n));
    const subsets = (k: number): string[][] => {
      const res: string[][] = [];
      const rec = (i: number, cur: string[]) => {
        if (cur.length === k) { res.push(cur.slice()); return; }
        for (let j = i; j < cs.length; j++) { cur.push(cs[j]); rec(j + 1, cur); cur.pop(); }
      };
      rec(0, []);
      return res;
    };
    for (let k = 1; k <= 4; k++) for (const sub of subsets(k)) for (let j = 0; j <= Math.min(jokers, 4 - k); j++) {
      if (k + j < 3) continue;
      if (j > 0 && k < 2) continue;
      out.push([...sub.map((c) => `${c}${n}`), ...Array(j).fill("J")]);
    }
  }
  return out;
}

function pointsOfSlots(slots: Slot[]): number {
  let j = 0;
  const tiles = slots.map((x) => (x === "J" ? `J${++j}` : `${x}a`));
  return analyze(tiles)?.points ?? 0;
}

/** Suchgrenze für `bestMelds` – hält Bots und Spielhilfe auch bei großer Bank schnell */
const SEARCH_NODES = 4000;

/**
 * Beste Auswahl getrennter Kombinationen aus der Bank. `first`: möglichst viele Punkte (erstes Auslegen);
 * sonst möglichst viele Steine, dabei Joker sparen.
 */
export function bestMelds(hand: Tile[], first: boolean): { groups: Tile[][]; points: number; tiles: number } {
  const counts = new Map<Slot, number>();
  for (const t of hand) counts.set(slotOf(t), (counts.get(slotOf(t)) ?? 0) + 1);
  const cands = candidates(counts).map((slots) => {
    const need = new Map<Slot, number>();
    for (const x of slots) need.set(x, (need.get(x) ?? 0) + 1);
    const jokers = need.get("J") ?? 0;
    const points = pointsOfSlots(slots);
    return { slots, need: [...need], points, value: first ? points * 10 - jokers : slots.length * 1000 - jokers * 300 + points };
  }).filter((c) => c.points > 0);
  // große Kombinationen zuerst (findet gute Lösungen früh)
  cands.sort((a, b) => b.value - a.value);
  let best = { pick: [] as number[], value: 0 };
  let nodes = 0;
  const pick: number[] = [];
  const rec = (from: number, value: number) => {
    if (++nodes > SEARCH_NODES) return;
    if (value > best.value) best = { pick: pick.slice(), value };
    for (let i = from; i < cands.length; i++) {
      const c = cands[i];
      if (c.need.some(([k, n]) => (counts.get(k) ?? 0) < n)) continue;
      for (const [k, n] of c.need) counts.set(k, counts.get(k)! - n);
      pick.push(i);
      rec(i, value + c.value);
      pick.pop();
      for (const [k, n] of c.need) counts.set(k, counts.get(k)! + n);
      if (nodes > SEARCH_NODES) return;
    }
  };
  rec(0, 0);
  // Bausteine in echte Steine übersetzen
  const pool = hand.slice();
  const groups = best.pick.map((i) => cands[i].slots.map((x) => {
    const k = pool.findIndex((t) => slotOf(t) === x);
    return pool.splice(k, 1)[0];
  })).map(normalize);
  return { groups, points: groups.reduce((a, g) => a + (analyze(g)?.points ?? 0), 0), tiles: groups.reduce((a, g) => a + g.length, 0) };
}

/** Einzelne Steine an den Tisch anlegen (auch eine lange Reihe teilen) – gibt den neuen Tisch und die übrigen Steine zurück */
export function layOff(table: Tile[][], hand: Tile[]): { table: Tile[][]; hand: Tile[] } {
  const t = table.map((g) => g.slice());
  let rest = hand.slice();
  let changed = true;
  while (changed && rest.length) {
    changed = false;
    // Joker nur, wenn sonst nichts mehr auf der Bank liegt
    const order = rest.filter((x) => !isJoker(x)).length ? rest.filter((x) => !isJoker(x)) : rest;
    for (const tile of order) {
      let done = false;
      for (let i = 0; i < t.length && !done; i++) {
        const tryG = normalize([...t[i], tile]);
        if (isValidMeld(tryG)) { t[i] = tryG; done = true; continue; }
        // in der Mitte einer langen Reihe: teilen (3-4-5-6-7 + 5 → 3-4-5 und 5-6-7)
        const m = analyze(t[i]);
        if (m?.kind === "run" && !isJoker(tile) && colorOf(tile) === colorOf(m.tiles.find((x) => !isJoker(x))!)) {
          const k = m.values.indexOf(numOf(tile));
          if (k >= 2 && m.tiles.length - k >= 3) {
            const a = m.tiles.slice(0, k + 1).slice(0, k), b = m.tiles.slice(k);
            const left = [...a, tile];
            if (isValidMeld(left) && isValidMeld(b)) { t.splice(i, 1, normalize(left), normalize(b)); done = true; }
          }
        }
      }
      if (done) { rest = rest.filter((x) => x !== tile); changed = true; break; }
    }
  }
  return { table: t, hand: rest };
}

/**
 * Vorschlag für den Zug von `me`: neue Kombinationen aus der Bank, danach (wenn schon ausgelegt) einzelne Steine anlegen.
 * null: nichts möglich – Stein ziehen. `simple`: nur auslegen, nicht anlegen.
 */
export function suggestPlay(s: ZrState, me: string, simple = false): { table: Tile[][]; laid: number } | null {
  const hand = s.hands[me] ?? [];
  if (!hand.length) return null;
  const first = !s.melded[me];
  const best = bestMelds(hand, first);
  if (first) {
    if (best.points < FIRST) return null;
    return { table: [...s.table.map((g) => g.slice()), ...best.groups], laid: best.tiles };
  }
  let table = [...s.table.map((g) => g.slice()), ...best.groups];
  let laid = best.tiles;
  if (!simple) {
    const used = new Set(best.groups.flat());
    const r = layOff(table, hand.filter((t) => !used.has(t)));
    laid += hand.length - used.size - r.hand.length;
    table = r.table;
  }
  if (!laid) return null;
  return { table, laid };
}

export const zahlenromme: GameLogic<ZrState, ZrAction> = {
  info: {
    id: "zahlenromme",
    name: "Zahlen-Rommé",
    tagline: "Zahlensteine in Reihen und Gruppen legen, den ganzen Tisch umbauen – wer zuerst alle los ist, gewinnt.",
    category: "Karten",
    minPlayers: 2,
    maxPlayers: 4,
    duration: "30–60 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  presets: [
    { id: "ohneJoker", label: "Ohne Joker", hint: "104 Steine", options: { joker: false } },
    { id: "kurz", label: "Kurz", hint: "eine Runde", options: { end: "1" } },
  ],
  settings: [
    {
      key: "end", label: "Partie bis", type: "choice", default: "3", group: "Hausregeln",
      choices: [
        { value: "1", label: "1 Runde" },
        { value: "3", label: "3 Runden" },
        { value: "5", label: "5 Runden" },
        { value: "p200", label: "200 Punkte", hint: "wer zuerst 200 Punkte hat" },
      ],
    },
    { key: "joker", label: "Joker", type: "toggle", default: true, hint: "Zwei Joker im Spiel – sie vertreten jeden Stein und zählen 30 Minuspunkte", group: "Hausregeln" },
    {
      key: "think", label: "Zugzeit", type: "choice", default: "120", group: "Ablauf",
      choices: [
        { value: "60", label: "1 Min." },
        { value: "120", label: "2 Min." },
        { value: "180", label: "3 Min." },
        { value: "off", label: "Ohne", hint: "der Host kann weiterschalten" },
      ],
    },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt an, wer dran ist, was gelegt wird und wer die Runde gewinnt (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "commit" || a.type === "draw" ? "turn" : a.type === "timeUp" || a.type === "next" ? "player" : null),
  currentPlayerId: (s) => (s.phase === "play" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const top = Math.max(...ctx.players.map((p) => s.scores[p.id] ?? 0));
    return ctx.players.map((p) => ({ id: p.id, won: (s.scores[p.id] ?? 0) === top, score: s.scores[p.id] ?? 0 }));
  },
  skipLabel: (s, ctx) => {
    if (s.phase === "round") return "Nächste Runde starten";
    if (s.phase === "play" && s.curId) return `Für ${nameOf(ctx, s.curId)} einen Stein ziehen`;
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "round") {
      s.round++;
      deal(s, ctx, nextPlayerId(ctx.players, s.starterId));
    } else if (s.phase === "play" && s.curId) {
      s.log.push(`Für ${nameOf(ctx, s.curId)} gezogen`);
      draw(s, ctx, s.curId, "draw");
    }
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    const rctx = { ...ctx, players: rest };
    // Seine Steine kommen zurück in den Pool
    if (s.phase !== "over") s.pool = shuffle([...s.pool, ...(s.hands[id] ?? [])]);
    for (const m of [s.hands, s.melded, s.scores]) delete (m as Record<string, unknown>)[id];
    if (s.phase === "over") { sync(s); return s; }
    s.log.push(`${nameOf(ctx, id)} ist raus – die Steine kommen zurück in den Pool`);
    if (s.starterId === id) s.starterId = nextPlayerId(ctx.players, id) === id ? rest[0]?.id ?? null : nextPlayerId(ctx.players, id);
    if (rest.length < 2) { s.phase = "over"; s.curId = null; s.deadline = null; sync(s); return s; }
    if (s.phase === "play" && s.curId === id) {
      const i = ctx.players.findIndex((p) => p.id === id);
      startTurn(s, rctx, ctx.players[(i + 1) % ctx.players.length].id);
    }
    s.passes = 0;
    sync(s);
    return s;
  },
  botPause: (s) => (s.last?.kind === "commit" ? 1200 : 0),
  view: (s, viewer) => {
    if (viewer === null) return s;
    const own = viewer in s.hands ? { [viewer]: s.hands[viewer] } : {};
    return { ...s, hands: own, pool: [] };
  },
};
