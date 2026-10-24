/**
 * Kritzelpost – Stille Post mit Bildern. Jeder hat eine Kette (ein Heft). Schritt für Schritt wandern alle Hefte
 * gleichzeitig eins weiter: wer einen Satz bekommt, zeichnet ihn; wer eine Zeichnung bekommt, beschreibt sie.
 * Man sieht immer nur die Seite direkt davor. Am Ende blättert der Host das Album Kette für Kette auf.
 *
 * Zuteilung: feste Reihenfolge `order` (beim Start eingefroren), in Schritt k bearbeitet order[j] das Heft (j − k) mod n.
 * So schreibt jeder in Schritt 0 in sein eigenes Heft und bekommt es danach nie wieder – n Schritte, jeder einmal pro Heft.
 * Modi: „Normal“ (jeder beginnt mit einem eigenen Satz) und „Eisbrecher“ (alle zeichnen zuerst denselben vorgegebenen Satz).
 *
 * Zeit nur aus `ctx.now`. Vor dem Album sieht jeder nur die eigene Aufgabe (Vorgängerseite) und seinen Entwurf,
 * der Fernseher nur den Fortschritt. Im Album erscheinen die Seiten erst, wenn der Host dorthin blättert.
 */
import { shuffle } from "../../platform/random";
import { playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";
import { COLORS, WIDTHS, type Stroke } from "../zeichnen/logic";
import { SAETZE } from "./saetze";

export type { Stroke } from "../zeichnen/logic";
export type KMode = "normal" | "eisbrecher";
export type Kind = "text" | "draw";
export type Phase = "play" | "album" | "over";

/** Eine Seite im Heft. `by: null` = vom Spiel vorgegeben (Eisbrecher-Satz); `empty`: nichts abgegeben, `gone`: ausgestiegen */
export interface Page { by: string | null; kind: Kind; text?: string; strokes?: Stroke[]; empty?: true; gone?: true }

export interface KState {
  v: 1;
  mode: KMode;
  phase: Phase;
  /** Reihenfolge beim Start – bleibt fest, auch wenn jemand geht */
  order: string[];
  /** Namen beim Start (für das Album, auch von Ausgestiegenen) */
  names: Record<string, string>;
  /** wer ausgestiegen ist (wird übersprungen) */
  left: string[];
  /** Hefte: books[i] gehört order[i] */
  books: Page[][];
  /** Schritt (0 … turns − 1) und Schritte insgesamt */
  round: number;
  turns: number;
  /** wer in diesem Schritt fertig ist */
  done: string[];
  /** Entwürfe der Zeichnungen in diesem Schritt (geheim) */
  drafts: Record<string, Stroke[]>;
  startedAt: number | null;
  /** Sekunden je Schritt, 0 = ohne Uhr */
  seconds: number;
  /** Album: welches Heft, welche Seite */
  book: number;
  page: number;
  /** nur in der Sicht eines Spielers: seine Aufgabe (Vorgängerseite) und seine Abgabe in diesem Schritt */
  task?: Page | null;
  mine?: Page | null;
  log: string[];
}

export type KAction =
  /** `player`: nur an einem Handy für alle – für wen */
  | { type: "write"; text: string; player?: string }
  | { type: "stroke"; c: number; w: number; p: string; player?: string }
  | { type: "undo"; player?: string }
  | { type: "clear"; player?: string }
  | { type: "done"; player?: string }
  | { type: "timeUp" }
  /** Album blättern (Host) */
  | { type: "page"; dir: 1 | -1 };

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** Grenzen je Zeichnung (der ganze Spielstand bleibt so unter ~350 KB, auch mit 8 Spielern) */
export const MAX_TEXT = 100;
const MAX_POINTS_PER_STROKE = 400;
export const MAX_INK = 10_000;
const MAX_STROKES = 300;
export const CLOCKS = ["0", "60", "90", "120", "180"] as const;

const validPoints = (p: unknown) => typeof p === "string" && p.length > 0 && p.length % 4 === 0 && p.length <= MAX_POINTS_PER_STROKE * 4 && [...p].every((ch) => B64.includes(ch));
export const inkOf = (strokes: Stroke[]) => strokes.reduce((t, k) => t + k.p.length, 0);
export const modeOf = (o: Options): KMode => (o.mode === "eisbrecher" ? "eisbrecher" : "normal");
/** Seiten vor dem ersten Schritt (Eisbrecher: der vorgegebene Satz) */
export const offsetOf = (s: KState) => (s.mode === "eisbrecher" ? 1 : 0);
/** Was in Schritt k zu tun ist: Normal beginnt mit einem Satz, Eisbrecher mit einer Zeichnung */
export const kindAt = (s: KState, k = s.round): Kind => ((k + offsetOf(s)) % 2 === 0 ? "text" : "draw");
export const active = (s: KState) => s.order.filter((id) => !s.left.includes(id));
export const deadlineOf = (s: KState): number | null => (s.phase === "play" && s.startedAt !== null && s.seconds > 0 ? s.startedAt + s.seconds * 1000 : null);
/** Seiten je Heft am Ende */
export const pagesPer = (s: KState) => s.turns + offsetOf(s);
const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Welches Heft bearbeitet dieser Spieler in Schritt k? */
export function bookOf(s: KState, id: string, k = s.round): number {
  const j = s.order.indexOf(id);
  return j < 0 ? -1 : mod(j - k, s.order.length);
}

/** Aufgabe (Vorgängerseite) und eigene Abgabe in diesem Schritt – aus dem vollen Spielstand */
export function slotOf(s: KState, id: string): { task: Page | null; mine: Page | null } {
  if (!s.order.includes(id) || s.phase !== "play") return { task: null, mine: null };
  const b = s.books[bookOf(s, id)] ?? [];
  const at = offsetOf(s) + s.round;
  return { task: at > 0 ? b[at - 1] ?? null : null, mine: b[at] ?? null };
}

const nameOf = (s: KState, ctx: GameContext, id: string | null) => (id && s.names[id]) || playerName(ctx, id);

function stepLog(s: KState) {
  if (s.phase !== "play") return;
  const k = kindAt(s);
  s.log.push(`Schritt ${s.round + 1}/${s.turns}: ${k === "draw" ? "zeichnen" : s.round === 0 ? "Satz schreiben" : "beschreiben"}`);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

/** Schritt abschließen: wer nichts abgegeben hat, bekommt eine leere Seite (Zeichnung: der Entwurf zählt) */
function endRound(s: KState, ctx: GameContext) {
  const kind = kindAt(s);
  const at = offsetOf(s) + s.round;
  for (const id of s.order) {
    const b = s.books[bookOf(s, id)];
    if (b.length > at) continue;
    const draft = s.drafts[id] ?? [];
    const gone = s.left.includes(id);
    if (kind === "draw" && draft.length) b.push({ by: id, kind, strokes: draft });
    else b.push({ by: id, kind, empty: true, ...(gone ? { gone: true as const } : {}) });
  }
  s.done = [];
  s.drafts = {};
  s.round++;
  // Weniger als zwei sind noch dabei: gleich zum Album
  if (active(s).length < 2) s.turns = s.round;
  if (s.round >= s.turns) {
    s.phase = "album";
    s.book = 0;
    s.page = 0;
    s.startedAt = null;
    s.log.push("Das Album beginnt");
    return;
  }
  s.startedAt = s.seconds > 0 ? ctx.now : null;
  stepLog(s);
}

function checkRound(s: KState, ctx: GameContext) {
  if (s.phase === "play" && active(s).every((id) => s.done.includes(id))) endRound(s, ctx);
}

function setup(ctx: GameContext): KState {
  const order = ctx.players.map((p) => p.id);
  const mode = modeOf(ctx.options);
  const clock = Number(ctx.options.clock ?? 90);
  // An einem Handy für alle (Start ohne Spieler) gibt es keine Uhr – man reicht das Handy reihum
  const seconds = ctx.actorId === null ? 0 : CLOCKS.includes(String(clock) as never) ? clock : 90;
  const start = mode === "eisbrecher" ? shuffle([...SAETZE])[0] : null;
  const s: KState = {
    v: 1, mode, phase: "play", order, names: Object.fromEntries(ctx.players.map((p) => [p.id, p.name])), left: [],
    books: order.map(() => (start ? [{ by: null, kind: "text" as const, text: start }] : [])),
    round: 0, turns: order.length, done: [], drafts: {}, startedAt: seconds > 0 ? ctx.now : null, seconds, book: 0, page: 0, log: [],
  };
  stepLog(s);
  return s;
}

/** Wer handelt? Online man selbst, an einem Handy für alle der genannte Spieler */
function actor(s: KState, a: { player?: string }, ctx: GameContext): string {
  const id = ctx.actorId ?? (typeof a.player === "string" ? a.player : null);
  if (s.phase !== "play") throw new GameError("Gerade wird nicht gespielt.");
  if (!id || !s.order.includes(id) || s.left.includes(id)) throw new GameError("Du spielst nicht mit.");
  if (s.done.includes(id)) throw new GameError("Du bist schon fertig.");
  return id;
}

function apply(prev: KState, a: KAction, ctx: GameContext): KState {
  const s = structuredClone(prev);
  switch (a.type) {
    case "write": {
      const id = actor(s, a, ctx);
      if (kindAt(s) !== "text") throw new GameError("Jetzt wird gezeichnet.");
      const text = typeof a.text === "string" ? a.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "";
      const b = s.books[bookOf(s, id)];
      b.push(text ? { by: id, kind: "text", text } : { by: id, kind: "text", empty: true });
      s.done.push(id);
      checkRound(s, ctx);
      return s;
    }
    case "stroke": {
      const id = actor(s, a, ctx);
      if (kindAt(s) !== "draw") throw new GameError("Jetzt wird geschrieben.");
      if (!Number.isInteger(a.c) || a.c < 0 || a.c >= COLORS.length || !Number.isInteger(a.w) || a.w < 0 || a.w >= WIDTHS.length || !validPoints(a.p)) throw new GameError("Dieser Strich geht nicht.");
      const d = (s.drafts[id] ??= []);
      if (d.length >= MAX_STROKES || inkOf(d) + a.p.length > MAX_INK) throw new GameError("Das Blatt ist voll – lösch etwas.");
      d.push({ c: a.c, w: a.w, p: a.p });
      return s;
    }
    case "undo": {
      const id = actor(s, a, ctx);
      s.drafts[id]?.pop();
      return s;
    }
    case "clear": {
      const id = actor(s, a, ctx);
      delete s.drafts[id];
      return s;
    }
    case "done": {
      const id = actor(s, a, ctx);
      if (kindAt(s) !== "draw") throw new GameError("Schreib erst deinen Satz.");
      const draft = s.drafts[id] ?? [];
      s.books[bookOf(s, id)].push(draft.length ? { by: id, kind: "draw", strokes: draft } : { by: id, kind: "draw", empty: true });
      delete s.drafts[id];
      s.done.push(id);
      checkRound(s, ctx);
      return s;
    }
    case "timeUp": {
      const end = deadlineOf(s);
      if (end === null || ctx.now < end - 500) throw new GameError("Die Zeit läuft noch.");
      endRound(s, ctx);
      return s;
    }
    case "page": {
      if (s.phase !== "album") throw new GameError("Das Album ist noch nicht offen.");
      const per = pagesPer(s);
      if (a.dir === 1) {
        if (s.page + 1 < per) s.page++;
        else if (s.book + 1 < s.books.length) { s.book++; s.page = 0; }
        else { s.phase = "over"; s.log.push("Album zu Ende"); }
      } else if (a.dir === -1) {
        if (s.page > 0) s.page--;
        else if (s.book > 0) { s.book--; s.page = per - 1; }
      } else throw new GameError("Wohin blättern?");
      return s;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
}

/** Was in diesem Schritt fehlt (Namen) – für den Host-Knopf */
const missing = (s: KState) => active(s).filter((id) => !s.done.includes(id));

export const kritzelpost: GameLogic<KState, KAction> = {
  info: {
    id: "kritzelpost",
    name: "Kritzelpost",
    tagline: "Stille Post mit Bildern: Satz, Zeichnung, Satz – am Ende das Album.",
    category: "Party",
    minPlayers: 3,
    maxPlayers: 8,
    duration: "15 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: false,
  settings: [
    {
      key: "mode", label: "Modus", type: "choice", default: "normal",
      choices: [
        { value: "normal", label: "Normal", hint: "jeder beginnt mit einem eigenen Satz" },
        { value: "eisbrecher", label: "Eisbrecher", hint: "alle zeichnen zuerst denselben Satz" },
      ],
    },
    {
      key: "clock", label: "Zeit je Schritt", type: "choice", default: "90",
      choices: CLOCKS.map((c) => ({ value: c, label: c === "0" ? "Ohne Uhr" : `${c} s` })),
    },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt jeden Schritt an und liest das Album vor (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "page" ? "host" : ["write", "stroke", "undo", "clear", "done", "timeUp"].includes(a.type) ? "player" : null),
  currentPlayerId: () => null,
  isOver: (s) => s.phase === "over",
  // Keine Sieger – das Album ist der Spaß
  results: (s) => s.order.filter((id) => !s.left.includes(id)).map((id) => ({ id, won: false })),
  skipLabel(s, ctx) {
    if (s.phase === "play") {
      const m = missing(s);
      return m.length ? `Ohne ${m.map((id) => nameOf(s, ctx, id)).join(", ")} weiter` : null;
    }
    if (s.phase === "album") return "Weiterblättern";
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "play") endRound(s, ctx);
    else if (s.phase === "album") return apply(s, { type: "page", dir: 1 }, ctx);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!s.order.includes(id) || s.left.includes(id)) return s;
    s.left.push(id);
    if (s.phase !== "play") return s;
    s.log.push(`${nameOf(s, ctx, id)} ist ausgestiegen – seine Seiten bleiben leer`);
    if (active(s).length < 2) { endRound(s, ctx); return s; }
    checkRound(s, ctx);
    return s;
  },
  view(s, viewer) {
    if (viewer === null) return s;
    if (s.phase === "play") {
      // Nur die eigene Aufgabe, der eigene Entwurf und wer fertig ist – keine anderen Seiten
      const own = s.order.includes(viewer);
      const { task, mine } = slotOf(s, viewer);
      return { ...s, books: s.books.map(() => []), drafts: own && s.drafts[viewer] ? { [viewer]: s.drafts[viewer] } : {}, task, mine };
    }
    if (s.phase === "album") {
      // Nur bis zur aufgeschlagenen Seite – sonst verraten die Daten, was noch kommt
      return { ...s, drafts: {}, books: s.books.map((b, i) => (i < s.book ? b : i === s.book ? b.slice(0, s.page + 1) : [])) };
    }
    return { ...s, drafts: {} };
  },
};
