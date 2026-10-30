/**
 * Ankreuzspiel – Würfelspiel mit zwei weißen und vier farbigen Würfeln. Läuft im Browser (lokal) und im Durable Object (online).
 * Jeder hat ein Blatt mit vier Reihen: Rot und Gelb von 2 bis 12, Grün und Blau von 12 bis 2. Angekreuzt wird nur von links
 * nach rechts – übersprungene Felder bleiben leer. Wer dran ist, würfelt alle Würfel:
 *  1. Weiß: Alle (gleichzeitig) dürfen die Summe der beiden weißen Würfel in einer Reihe ankreuzen.
 *  2. Farbe: Nur wer dran ist, darf zusätzlich einen weißen und einen farbigen Würfel zusammenzählen und in dessen Reihe ankreuzen.
 * Kreuzt er in beiden Schritten nichts an, ist das ein Fehlwurf (−5). Das letzte Feld einer Reihe gibt es erst ab fünf Kreuzen,
 * dann ist die Reihe für alle abgeschlossen (das Schloss zählt als Kreuz) und ihr Würfel ist raus.
 * Ende bei zwei abgeschlossenen Reihen oder vier Fehlwürfen eines Spielers. Punkte je Reihe nach Dreieckszahlen.
 */
import { rollDice } from "../../platform/random";
import { firstPlayerId, playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export const CELLS = 11;
/** so viele Kreuze braucht eine Reihe, bevor ihr letztes Feld angekreuzt werden darf */
export const MIN_LOCK = 5;
export const MISS_POINTS = 5;
/** Online: kleine Toleranz für die Uhr der Handys */
const GRACE = 1500;
const MAX_LOG = 80;

export interface RowDef { key: string; name: string; asc: boolean; color: string; ink: string }
/** Die vier Reihen: Rot und Gelb aufsteigend, Grün und Blau absteigend */
export const ROWS: RowDef[] = [
  { key: "rot", name: "Rot", asc: true, color: "#c8453d", ink: "#ffffff" },
  { key: "gelb", name: "Gelb", asc: true, color: "#e3b23c", ink: "#3b2a07" },
  { key: "gruen", name: "Grün", asc: false, color: "#3f8a57", ink: "#ffffff" },
  { key: "blau", name: "Blau", asc: false, color: "#2f5fa8", ink: "#ffffff" },
];
/** Zahl im Feld `idx` dieser Reihe */
export const valueAt = (row: number, idx: number) => (ROWS[row].asc ? idx + 2 : 12 - idx);
export const idxOf = (row: number, n: number) => (ROWS[row].asc ? n - 2 : 12 - n);
/** Punkte für k Kreuze in einer Reihe: 1, 3, 6, 10 … 78 */
export const tri = (k: number) => (k * (k + 1)) / 2;

export interface AkSheet {
  /** angekreuzte Felder je Reihe (aufsteigend) */
  rows: number[][];
  /** Schloss angekreuzt (= selbst abgeschlossen) */
  locks: boolean[];
  misses: number;
}

export interface AkMark { id: string; row: number; n: number; color: boolean }
export interface AkTurn {
  by: string;
  dice: number[];
  marks: AkMark[];
  miss: boolean;
  /** in diesem Zug abgeschlossene Reihen */
  closed: number[];
}

export interface AkState {
  v: 1;
  /** ein Handy für alle: dann gehen die Weiß-Entscheidungen reihum, sonst gleichzeitig */
  local: boolean;
  phase: "roll" | "white" | "color" | "over";
  /** Sitzreihenfolge */
  order: string[];
  curId: string | null;
  /** Würfel: weiß, weiß, rot, gelb, grün, blau – 0 = Würfel ist raus (Reihe abgeschlossen) */
  dice: number[];
  sheets: Record<string, AkSheet>;
  /** abgeschlossene Reihen */
  closed: boolean[];
  /** Weiß-Entscheidung je Spieler: Reihe oder null (verzichtet); fehlt = überlegt noch */
  white: Record<string, number | null>;
  /** wer gar nicht konnte (automatisch verzichtet) */
  cannot: string[];
  /** online: bis wann alle Zeit für Weiß haben (ms) */
  deadline: number | null;
  /** Kreuze dieses Zugs */
  marks: AkMark[];
  /** zwischen Weiß und Farbe: in Weiß abgeschlossene Reihen (für die Zusammenfassung des Zugs) */
  lastClosed?: number[];
  /** der letzte fertige Zug (zum Anzeigen und Vorlesen) */
  last: AkTurn | null;
  turn: number;
  endReason: "closed" | "misses" | "left" | null;
  log: string[];
  /** zählt Würfe/Züge, damit die Oberfläche neu animieren kann */
  n: number;
  /** zählt jede Aktion – Bots mit festem Startwert drehen sich so nicht im Kreis */
  step: number;
}

export type AkAction =
  | { type: "roll" }
  /** Weiß: Summe der weißen Würfel in Reihe `row` ankreuzen (null = verzichten); lokal mit `player` */
  | { type: "white"; row: number | null; player?: string }
  /** Farbe: weiß + farbig, Zahl `n` in Reihe `row` (null = verzichten) */
  | { type: "color"; row: number | null; n?: number }
  /** online: Bedenkzeit ist um – wer noch überlegt, verzichtet */
  | { type: "timeUp" };

export const closeEndOf = (o: Options) => (o.closeEnd === "1" ? 1 : o.closeEnd === "3" ? 3 : 2);
export const maxMissesOf = (o: Options) => (o.misses === "3" ? 3 : o.misses === "5" ? 5 : 4);
export const thinkOf = (o: Options) => (o.think === "off" ? 0 : Number(o.think) > 0 ? Number(o.think) : 40);

const nameOf = (players: Player[], id: string | null | undefined) => playerName({ players }, id);
function push(s: AkState, line: string) {
  s.log.push(line);
  if (s.log.length > MAX_LOG) s.log.shift();
}
const blank = (): AkSheet => ({ rows: [[], [], [], []], locks: [false, false, false, false], misses: 0 });

/** Kreuze in einer Reihe (mit Schloss) */
export const crosses = (sh: AkSheet, row: number) => sh.rows[row].length + (sh.locks[row] ? 1 : 0);
export function rowPoints(sh: AkSheet, row: number) { return tri(crosses(sh, row)); }
export function totalOf(sh: AkSheet | undefined): number {
  if (!sh) return 0;
  return [0, 1, 2, 3].reduce((t, r) => t + rowPoints(sh, r), 0) - sh.misses * MISS_POINTS;
}
export const allCrosses = (sh: AkSheet | undefined) => (sh ? [0, 1, 2, 3].reduce((t, r) => t + crosses(sh, r), 0) : 0);
const lastIdx = (sh: AkSheet, row: number) => sh.rows[row].at(-1) ?? -1;

/** Darf dieses Blatt die Zahl n in dieser Reihe ankreuzen? Liefert den Grund, wenn nicht. */
export function whyNot(s: AkState, sh: AkSheet, row: number, n: number): string | null {
  if (!Number.isInteger(row) || row < 0 || row > 3) return "Diese Reihe gibt es nicht.";
  if (s.closed[row]) return `${ROWS[row].name} ist schon abgeschlossen.`;
  const idx = idxOf(row, n);
  if (!Number.isInteger(idx) || idx < 0 || idx >= CELLS) return "Diese Zahl gibt es in der Reihe nicht.";
  if (idx <= lastIdx(sh, row)) return "Angekreuzt wird nur von links nach rechts.";
  if (idx === CELLS - 1 && sh.rows[row].length < MIN_LOCK) return `Das letzte Feld gibt es erst ab ${MIN_LOCK} Kreuzen in der Reihe.`;
  return null;
}

export const whiteSum = (s: AkState) => (s.dice.length ? s.dice[0] + s.dice[1] : 0);

/** Weiß: in welchen Reihen ginge die Summe der weißen Würfel? */
export function whiteOptions(s: AkState, id: string): AkMark[] {
  const sh = s.sheets[id];
  if (!sh || !s.dice.length) return [];
  const n = whiteSum(s);
  return [0, 1, 2, 3].filter((row) => !whyNot(s, sh, row, n)).map((row) => ({ id, row, n, color: false }));
}

/** Farbe: weiß + farbig – je Reihe bis zu zwei Zahlen */
export function colorOptions(s: AkState, id: string): AkMark[] {
  const sh = s.sheets[id];
  if (!sh || !s.dice.length) return [];
  const out: AkMark[] = [];
  for (let row = 0; row < 4; row++) {
    const c = s.dice[2 + row];
    if (!c) continue;
    for (const n of new Set([s.dice[0] + c, s.dice[1] + c])) if (!whyNot(s, sh, row, n)) out.push({ id, row, n, color: true });
  }
  return out.sort((a, b) => a.row - b.row || idxOf(a.row, a.n) - idxOf(b.row, b.n));
}

/** Wer muss sich bei Weiß noch entscheiden? (ab dem Spieler am Zug reihum) */
export function pendingWhite(s: AkState): string[] {
  if (s.phase !== "white") return [];
  const i = Math.max(0, s.order.indexOf(s.curId ?? ""));
  return [...s.order.slice(i), ...s.order.slice(0, i)].filter((id) => !(id in s.white));
}

function cross(s: AkState, m: AkMark, players: Player[]): boolean {
  const sh = s.sheets[m.id];
  const idx = idxOf(m.row, m.n);
  sh.rows[m.row].push(idx);
  s.marks.push(m);
  const name = nameOf(players, m.id);
  push(s, `${name} kreuzt ${ROWS[m.row].name} ${m.n}${m.color ? " (Farbe)" : ""}`);
  if (idx !== CELLS - 1) return false;
  sh.locks[m.row] = true;
  push(s, `${name} schließt ${ROWS[m.row].name} ab`);
  return true;
}

function startTurn(s: AkState, id: string | null) {
  s.phase = "roll";
  s.curId = id;
  s.dice = [];
  s.white = {};
  s.cannot = [];
  s.deadline = null;
  s.marks = [];
}

const closedCount = (s: AkState) => s.closed.filter(Boolean).length;

function finish(s: AkState, reason: AkState["endReason"]) {
  s.phase = "over";
  s.endReason = reason;
  s.deadline = null;
}

/** Zug zu Ende: Fehlwurf? Ende? Sonst der Nächste */
function finishTurn(s: AkState, ctx: GameContext, justClosed: number[]) {
  const cur = s.curId!;
  const miss = !s.marks.some((m) => m.id === cur);
  if (miss && s.sheets[cur]) {
    s.sheets[cur].misses++;
    push(s, `${nameOf(ctx.players, cur)}: Fehlwurf (${s.sheets[cur].misses})`);
  }
  s.last = { by: cur, dice: [...s.dice], marks: [...s.marks], miss, closed: justClosed };
  s.turn++;
  s.n++;
  if (closedCount(s) >= closeEndOf(ctx.options)) return finish(s, "closed");
  if (Object.values(s.sheets).some((sh) => sh.misses >= maxMissesOf(ctx.options))) return finish(s, "misses");
  const i = s.order.indexOf(cur);
  startTurn(s, s.order[(i + 1) % s.order.length] ?? null);
}

/** Weiß ist entschieden: alle Kreuze gleichzeitig eintragen, dann Farbe für den Spieler am Zug */
function resolveWhite(s: AkState, ctx: GameContext) {
  const closedNow: number[] = [];
  for (const id of s.order) {
    const row = s.white[id];
    if (row === null || row === undefined) continue;
    if (cross(s, { id, row, n: whiteSum(s), color: false }, ctx.players)) closedNow.push(row);
  }
  for (const r of new Set(closedNow)) s.closed[r] = true;
  s.deadline = null;
  s.n++;
  if (closedCount(s) >= closeEndOf(ctx.options)) {
    finishTurn(s, ctx, [...new Set(closedNow)]);
    return;
  }
  s.phase = "color";
  s.white = {};
  // Ohne mögliche Farbe ist der Zug sofort vorbei
  if (!colorOptions(s, s.curId!).length) finishTurn(s, ctx, [...new Set(closedNow)]);
  else s.lastClosed = [...new Set(closedNow)];
}

function maybeResolve(s: AkState, ctx: GameContext) {
  if (s.phase === "white" && s.order.every((id) => id in s.white)) resolveWhite(s, ctx);
}

function roll(s: AkState, ctx: GameContext) {
  const fresh = rollDice(6);
  s.dice = fresh.map((d, i) => (i >= 2 && s.closed[i - 2] ? 0 : d));
  s.phase = "white";
  s.white = {};
  s.cannot = [];
  s.marks = [];
  for (const id of s.order) if (!whiteOptions(s, id).length) { s.white[id] = null; s.cannot.push(id); }
  const think = thinkOf(ctx.options);
  s.deadline = !s.local && think > 0 ? ctx.now + think * 1000 : null;
  s.n++;
  push(s, `${nameOf(ctx.players, s.curId)} würfelt: Weiß ${s.dice[0]} + ${s.dice[1]} = ${whiteSum(s)}`);
  maybeResolve(s, ctx);
}

function setup(ctx: GameContext): AkState {
  const order = ctx.players.map((p) => p.id);
  const s: AkState = {
    v: 1, local: ctx.actorId === null, phase: "roll", order, curId: null, dice: [],
    sheets: Object.fromEntries(order.map((id) => [id, blank()])), closed: [false, false, false, false],
    white: {}, cannot: [], deadline: null, marks: [], last: null, turn: 0, endReason: null, log: [], n: 0, step: 0,
  };
  startTurn(s, firstPlayerId(ctx));
  return s;
}

function apply(prev: AkState, a: AkAction, ctx: GameContext): AkState {
  if (prev.phase === "over") throw new GameError("Die Partie ist vorbei.");
  if (a.type === "timeUp") {
    if (prev.phase !== "white" || prev.deadline === null || ctx.now < prev.deadline - GRACE) return prev;
    const s = structuredClone(prev);
    s.step++;
    const open = pendingWhite(s);
    for (const id of open) s.white[id] = null;
    if (open.length) push(s, `Zeit um – ${open.map((id) => nameOf(ctx.players, id)).join(", ")} ${open.length === 1 ? "verzichtet" : "verzichten"}`);
    maybeResolve(s, ctx);
    return s;
  }
  const s = structuredClone(prev);
  s.step++;
  switch (a.type) {
    case "roll": {
      if (s.phase !== "roll") throw new GameError("Es ist schon gewürfelt.");
      roll(s, ctx);
      return s;
    }
    case "white": {
      if (s.phase !== "white") throw new GameError("Gerade wird nicht Weiß angekreuzt.");
      const who = a.player ?? ctx.actorId ?? pendingWhite(s)[0];
      if (!who || !s.sheets[who]) throw new GameError("Diesen Spieler gibt es nicht.");
      if (ctx.actorId !== null && who !== ctx.actorId) throw new GameError("Kreuze nur auf deinem eigenen Blatt an.");
      if (who in s.white) throw new GameError("Du hast dich schon entschieden.");
      if (a.row !== null) {
        const why = whyNot(s, s.sheets[who], a.row, whiteSum(s));
        if (why) throw new GameError(why);
      }
      s.white[who] = a.row;
      maybeResolve(s, ctx);
      return s;
    }
    case "color": {
      if (s.phase !== "color") throw new GameError(s.phase === "white" ? "Erst entscheiden alle über Weiß." : "Erst würfeln.");
      const cur = s.curId!;
      const closedNow = s.lastClosed ?? [];
      delete s.lastClosed;
      if (a.row === null) {
        finishTurn(s, ctx, closedNow);
        return s;
      }
      const n = a.n;
      const c = Number.isInteger(a.row) && a.row >= 0 && a.row <= 3 ? s.dice[2 + a.row] : 0;
      if (!c) throw new GameError("Dieser Würfel ist raus.");
      if (typeof n !== "number" || (n !== s.dice[0] + c && n !== s.dice[1] + c)) throw new GameError("Zähle einen weißen und den farbigen Würfel zusammen.");
      const why = whyNot(s, s.sheets[cur], a.row, n);
      if (why) throw new GameError(why);
      const closed = [...closedNow];
      if (cross(s, { id: cur, row: a.row, n, color: true }, ctx.players)) { s.closed[a.row] = true; closed.push(a.row); }
      finishTurn(s, ctx, closed);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

// ---------------------------------------------------------------- Strategie (Spielhilfe und Bots)

/** Wie viele Felder ließe dieses Kreuz leer? */
export const skipped = (s: AkState, m: AkMark) => idxOf(m.row, m.n) - lastIdx(s.sheets[m.id], m.row) - 1;

/** Ein Kreuz lohnt sich, wenn es kaum Felder überspringt – Schlösser immer, gegen Ende der Reihe großzügiger */
function worth(s: AkState, m: AkMark): number {
  const idx = idxOf(m.row, m.n);
  if (idx === CELLS - 1) return 100;
  const k = s.sheets[m.id].rows[m.row].length;
  // je Kreuz ungefähr so viele Punkte mehr, wie schon in der Reihe stehen; übersprungene Felder kosten Zukunft
  return k + 1 - skipped(s, m) * 2.6;
}

/** Bester Vorschlag für Weiß (null = verzichten) */
export function suggestWhite(s: AkState, id: string): number | null {
  const opts = whiteOptions(s, id).map((m) => ({ m, v: worth(s, m) })).sort((a, b) => b.v - a.v);
  const best = opts[0];
  if (!best) return null;
  // Wer dran ist, hat noch die Farbe – bleibt nichts Gutes, wäre es ein Fehlwurf: dann darf Weiß ruhig etwas kosten
  const bar = id === s.curId && !colorOptions(s, id).some((m) => skipped(s, m) <= 1) ? -3 : 0;
  return best.v >= bar ? best.m.row : null;
}

/** Bester Vorschlag für Farbe (null = verzichten) */
export function suggestColor(s: AkState, id: string): AkMark | null {
  const opts = colorOptions(s, id).map((m) => ({ m, v: worth(s, m) })).sort((a, b) => b.v - a.v);
  const best = opts[0];
  if (!best) return null;
  const has = s.marks.some((m) => m.id === id);
  const misses = s.sheets[id]?.misses ?? 0;
  // ohne Weiß-Kreuz droht ein Fehlwurf (−5): dann darf das Kreuz einiges kosten
  const bar = has ? 0 : misses >= 2 ? -40 : -9;
  return best.v >= bar ? best.m : null;
}

export const ankreuzspiel: GameLogic<AkState, AkAction> = {
  info: {
    id: "ankreuzspiel",
    name: "Ankreuzspiel",
    tagline: "Sechs Würfel, vier Farbreihen: von links nach rechts ankreuzen – und rechtzeitig Reihen abschließen.",
    category: "Würfel",
    minPlayers: 2,
    maxPlayers: 6,
    duration: "15–20 Min.",
  },
  version: 1,
  turnBased: true,
  joinMidGame: false,
  presets: [
    { id: "kurz", label: "Kurz", hint: "Ende nach 1 Reihe oder 3 Fehlwürfen", options: { closeEnd: "1", misses: "3" } },
    { id: "lang", label: "Lang", hint: "Ende nach 3 Reihen oder 5 Fehlwürfen", options: { closeEnd: "3", misses: "5" } },
  ],
  settings: [
    {
      key: "closeEnd", label: "Ende bei abgeschlossenen Reihen", type: "choice", default: "2", group: "Hausregeln",
      choices: [
        { value: "1", label: "Eine", hint: "kurze Partie" },
        { value: "2", label: "Zwei", hint: "wie im Original" },
        { value: "3", label: "Drei", hint: "lange Partie" },
      ],
    },
    {
      key: "misses", label: "Ende bei Fehlwürfen", type: "choice", default: "4", group: "Hausregeln",
      choices: [
        { value: "3", label: "Drei" },
        { value: "4", label: "Vier", hint: "wie im Original" },
        { value: "5", label: "Fünf" },
      ],
    },
    {
      key: "think", label: "Bedenkzeit für Weiß", type: "choice", default: "40", group: "Ablauf",
      choices: [
        { value: "20", label: "20 s" },
        { value: "40", label: "40 s" },
        { value: "90", label: "90 s" },
        { value: "off", label: "Ohne", hint: "der Host kann weiterschalten" },
      ],
    },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt Würfe, Kreuze und Fehlwürfe an (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "roll" || a.type === "color" ? "turn" : a.type === "white" || a.type === "timeUp" ? "player" : null),
  currentPlayerId: (s) => (s.phase === "roll" || s.phase === "color" ? s.curId : s.phase === "white" && s.local ? pendingWhite(s)[0] ?? null : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const ids = ctx.players.map((p) => p.id).filter((id) => s.sheets[id]);
    const best = Math.max(...ids.map((id) => totalOf(s.sheets[id])));
    return ids.map((id) => ({ id, won: totalOf(s.sheets[id]) === best, score: totalOf(s.sheets[id]) }));
  },
  skipLabel: (s, ctx) => {
    if (s.phase === "roll" && s.curId) return `Für ${nameOf(ctx.players, s.curId)} würfeln`;
    if (s.phase === "white") {
      const open = s.local ? pendingWhite(s).slice(0, 1) : pendingWhite(s);
      return open.length ? `Ohne ${open.map((id) => nameOf(ctx.players, id)).join(", ")} weiter` : null;
    }
    if (s.phase === "color" && s.curId) return `${nameOf(ctx.players, s.curId)}: keine Farbe`;
    return null;
  },
  skipTurn(prev, ctx) {
    if (prev.phase === "over") return prev;
    const s = structuredClone(prev);
    s.step++;
    if (s.phase === "roll") { push(s, `Für ${nameOf(ctx.players, s.curId)} gewürfelt`); roll(s, ctx); return s; }
    if (s.phase === "white") {
      const open = s.local ? pendingWhite(s).slice(0, 1) : pendingWhite(s);
      for (const id of open) s.white[id] = null;
      if (open.length) push(s, `${open.map((id) => nameOf(ctx.players, id)).join(", ")} übersprungen`);
      maybeResolve(s, ctx);
      return s;
    }
    if (s.phase === "color") {
      const closed = s.lastClosed ?? [];
      delete s.lastClosed;
      finishTurn(s, ctx, closed);
    }
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    if (prev.phase === "over") return prev;
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    const restCtx = { ...ctx, players: rest };
    const wasCur = s.curId === id;
    const i = s.order.indexOf(id);
    s.order = s.order.filter((x) => x !== id);
    delete s.sheets[id];
    delete s.white[id];
    s.cannot = s.cannot.filter((x) => x !== id);
    s.marks = s.marks.filter((m) => m.id !== id);
    if (rest.length < 2) { finish(s, "left"); return s; }
    if (wasCur) {
      // sein Zug fällt aus, der Nächste würfelt
      delete s.lastClosed;
      push(s, `${nameOf(ctx.players, id)} ist raus – ${nameOf(ctx.players, s.order[i % s.order.length])} ist dran`);
      startTurn(s, s.order[i % s.order.length]);
      s.n++;
      return s;
    }
    maybeResolve(s, restCtx);
    s.n++;
    return s;
  },
  botPause: (s) => (s.phase === "roll" && s.last ? 1600 : s.phase === "white" ? 900 : 600),
};

