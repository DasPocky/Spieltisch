/**
 * Zeichnen & Raten – wer dran ist, sucht sich einen von drei Begriffen aus und zeichnet ihn am Handy,
 * die anderen raten. Zwei Arten zu raten (Einstellung):
 *  - „Laut rufen“ (Standard am Tisch): alle rufen, der Zeichner tippt an, wer es hatte.
 *  - „Tippen“: jeder schreibt seinen Tipp ins Handy, die App prüft (kleine Tippfehler zählen).
 * Die Striche liegen im Spielstand (kompakt kodiert), damit Fernseher und Handys sie live sehen.
 *
 * Zeit nur aus `ctx.now`. Den Begriff sehen nur der Zeichner und wer ihn schon erraten hat (Fernseher nie während des Zeichnens).
 */
import { shuffle } from "../../platform/random";
import { WATCH_ID } from "../../platform/protocol";
import { playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";
import { catsUpTo, LEVELS, levelOf, wordIds, wordText } from "../stirnraten/cards";

export type GuessMode = "rufen" | "tippen";
export type Phase = "pick" | "draw" | "reveal" | "over";

/** Ein Strich: Farbe (Index), Breite (1–4), Punkte als Text (je Punkt 4 Zeichen: x und y in 0–4095) */
export interface Stroke { c: number; w: number; p: string }
/** `near`: knapp daneben („fast“) oder ein Teil stimmt („teil“) – sieht nur, wer getippt hat (und wer den Begriff kennt) */
export interface Guess { by: string; text: string; ok: boolean; near?: Near }
export type Near = "fast" | "teil";
export interface Turn { drawer: string; word: string; solved: string[] }

export interface ZState {
  v: 1;
  mode: GuessMode;
  phase: Phase;
  order: string[];
  /** Züge insgesamt (Runden × Spieler) und der aktuelle */
  turns: number;
  turn: number;
  drawer: string | null;
  /** drei Begriffe zur Wahl (nur der Zeichner sieht sie) */
  choices: string[];
  /** gewählter Begriff (Kennung wie bei Stirnraten) */
  word: string | null;
  /** der Begriff als Lücken („_____ ____“) – die Länge ist kein Geheimnis */
  mask: string;
  startedAt: number | null;
  seconds: number;
  strokes: Stroke[];
  guesses: Guess[];
  /** wer es schon hat, in Reihenfolge */
  solved: string[];
  scores: Record<string, number>;
  /** schon gespielte Begriffe (kein Begriff zweimal) */
  used: string[];
  last: Turn | null;
  log: string[];
}

export type ZAction =
  | { type: "pick"; i: number }
  | { type: "stroke"; c: number; w: number; p: string }
  | { type: "undo" }
  | { type: "clear" }
  | { type: "guess"; text: string }
  /** Laut rufen: wer hatte es? (null: keiner) */
  | { type: "award"; to: string | null }
  /** Zeichner gibt auf / ist fertig */
  | { type: "done" }
  | { type: "timeUp" }
  | { type: "next" };

export const COLORS = ["#1f2937", "#e11d48", "#f97316", "#facc15", "#16a34a", "#0ea5e9", "#7c3aed", "#92400e", "#ffffff"] as const;
export const WIDTHS = [2, 5, 10, 22] as const;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** Grenzen gegen zu große Spielstände */
const MAX_POINTS_PER_STROKE = 400;
const MAX_INK = 160_000;
const MAX_STROKES = 1500;
const MAX_GUESSES = 40;
/** Punkte: wer es errät (früh mehr), der Zeichner je Ratenden */
export const POINTS = { guessMax: 100, guessMin: 40, drawer: 30, shout: 100, shoutDrawer: 60 } as const;

/** Punkte (0–1) kodieren: je Koordinate zwei Zeichen (0–4095) */
export function encodePoints(pts: [number, number][]): string {
  const q = (v: number) => Math.max(0, Math.min(4095, Math.round(v * 4095)));
  return pts.map(([x, y]) => [q(x), q(y)].map((n) => B64[n >> 6] + B64[n & 63]).join("")).join("");
}
export function decodePoints(p: string): [number, number][] {
  const out: [number, number][] = [];
  const v = (i: number) => ((B64.indexOf(p[i]) << 6) | B64.indexOf(p[i + 1])) / 4095;
  for (let i = 0; i + 3 < p.length; i += 4) out.push([v(i), v(i + 2)]);
  return out;
}
const validPoints = (p: unknown) => typeof p === "string" && p.length > 0 && p.length % 4 === 0 && p.length <= MAX_POINTS_PER_STROKE * 4 && [...p].every((ch) => B64.includes(ch));

/** Vergleich der Tipps: klein, Umlaute ausgeschrieben, nur Buchstaben und Ziffern */
export function normalizeGuess(t: string): string {
  return t.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
}
function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}
/** Richtig geraten? Kleine Tippfehler zählen (ab 5 Buchstaben einer, ab 9 zwei) */
export function matches(guess: string, word: string): boolean {
  const g = normalizeGuess(guess), w = normalizeGuess(word);
  if (!g || !w) return false;
  if (g === w) return true;
  const allowed = w.length >= 9 ? 2 : w.length >= 5 ? 1 : 0;
  return allowed > 0 && Math.abs(g.length - w.length) <= allowed && distance(g, w) <= allowed;
}

/**
 * Nah dran? „fast“: nur wenige Buchstaben falsch (ab 5 Buchstaben zwei, bei langen Wörtern gut ein Viertel);
 * „teil“: ein Wort eines mehrteiligen Begriffs, ein Teil eines zusammengesetzten Worts (ab 4 Buchstaben)
 * oder der Begriff steckt im Tipp („Hundehütte“ bei „Hund“).
 */
export function closeness(guess: string, word: string): Near | null {
  const g = normalizeGuess(guess), w = normalizeGuess(word);
  if (!g || !w || matches(guess, word)) return null;
  const near = Math.max(w.length >= 5 ? 2 : 1, Math.round(w.length * 0.28));
  if (w.length >= 3 && Math.abs(g.length - w.length) <= near && distance(g, w) <= near) return "fast";
  const parts = word.split(/[\s-]+/).map(normalizeGuess).filter((x) => x.length >= 3);
  if (parts.length > 1 && parts.some((x) => x === g || matches(guess, x))) return "teil";
  if (g.length >= 4 && w.includes(g)) return "teil";
  if (w.length >= 3 && g.includes(w)) return "teil";
  return null;
}

/**
 * Begriffe zum Zeichnen: aus den Stirnraten-Kategorien die, die sich malen lassen (ohne Länder, Namen,
 * Redewendungen, Lieder, Geräusche, Pantomime-Tätigkeiten und Slang).
 */
const NOT_DRAWABLE = new Set(["f-laender", "f-staedte", "f-geschichte", "f-redewendungen", "f-gefuehle", "f-deutsch", "g-jugend", "g-genres", "g-peinlich"]);
export const drawableCats = (o: Options) => catsUpTo(levelOf(o.level)).filter((c) => !c.style && !NOT_DRAWABLE.has(c.id));

export const modeOf = (o: Options): GuessMode => (o.guess === "tippen" ? "tippen" : "rufen");
export const deadlineOf = (s: ZState): number | null => (s.phase === "draw" && s.startedAt !== null ? s.startedAt + s.seconds * 1000 : null);
const nameOf = (ctx: GameContext, id: string | null) => playerName(ctx, id);
export const inkOf = (s: ZState) => s.strokes.reduce((t, k) => t + k.p.length, 0);

/** Begriff als Lücken: Buchstaben als _, Leerzeichen und Bindestriche bleiben */
export const maskOf = (word: string) => word.replace(/[\p{L}\p{N}]/gu, "_");

function newChoices(s: ZState, o: Options): string[] {
  const pool = drawableCats(o).flatMap(wordIds);
  const fresh = shuffle(pool.filter((w) => !s.used.includes(w)));
  return (fresh.length >= 3 ? fresh : shuffle(pool)).slice(0, 3);
}

function startTurn(s: ZState, ctx: GameContext) {
  s.drawer = s.order[s.turn % Math.max(1, s.order.length)] ?? null;
  s.choices = newChoices(s, ctx.options);
  s.word = null;
  s.mask = "";
  s.startedAt = null;
  s.strokes = [];
  s.guesses = [];
  s.solved = [];
  s.phase = "pick";
}

function reveal(s: ZState, ctx: GameContext) {
  if (s.phase !== "draw" && s.phase !== "pick") return;
  if (s.drawer && s.word) {
    s.last = { drawer: s.drawer, word: s.word, solved: [...s.solved] };
    const text = wordText(s.word);
    s.log.push(s.solved.length
      ? `${nameOf(ctx, s.drawer)} zeichnete „${text}“ – erraten von ${s.solved.map((id) => nameOf(ctx, id)).join(", ")}`
      : `${nameOf(ctx, s.drawer)} zeichnete „${text}“ – keiner hat's erraten`);
    if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
  }
  s.phase = "reveal";
  s.startedAt = null;
}

function nextTurn(s: ZState, ctx: GameContext) {
  s.turn++;
  if (s.turn >= s.turns || s.order.length < 2) { s.phase = "over"; s.drawer = null; return; }
  startTurn(s, ctx);
}

function setup(ctx: GameContext): ZState {
  const order = shuffle(ctx.players.map((p) => p.id));
  const rounds = Math.max(1, Math.min(Number(ctx.options.rounds) || 2, 10));
  const s: ZState = {
    v: 1, mode: modeOf(ctx.options), phase: "pick", order, turns: rounds * order.length, turn: 0, drawer: null, choices: [], word: null, mask: "",
    startedAt: null, seconds: Math.max(30, Math.min(Number(ctx.options.seconds) || 80, 240)), strokes: [], guesses: [], solved: [],
    scores: Object.fromEntries(order.map((id) => [id, 0])), used: [], last: null, log: [],
  };
  startTurn(s, ctx);
  return s;
}

function apply(prev: ZState, a: ZAction, ctx: GameContext): ZState {
  const s = structuredClone(prev);
  const local = ctx.actorId === null;
  const me = ctx.actorId;
  const host = local || me === ctx.hostId;
  const drawerActs = local || me === s.drawer || host;
  switch (a.type) {
    case "pick": {
      if (s.phase !== "pick") throw new GameError("Der Begriff steht schon.");
      if (!drawerActs) throw new GameError(`${nameOf(ctx, s.drawer)} sucht den Begriff aus.`);
      const w = s.choices[a.i];
      if (!Number.isInteger(a.i) || !w) throw new GameError("Welchen Begriff?");
      s.word = w;
      s.mask = maskOf(wordText(w));
      s.used.push(w);
      s.choices = [];
      s.phase = "draw";
      s.startedAt = ctx.now;
      return s;
    }
    case "stroke": {
      if (s.phase !== "draw") throw new GameError("Gerade wird nicht gezeichnet.");
      if (!local && me !== s.drawer) throw new GameError("Nur wer zeichnet, malt.");
      if (!Number.isInteger(a.c) || a.c < 0 || a.c >= COLORS.length || !Number.isInteger(a.w) || a.w < 0 || a.w >= WIDTHS.length || !validPoints(a.p)) throw new GameError("Dieser Strich geht nicht.");
      if (s.strokes.length >= MAX_STROKES || inkOf(s) + a.p.length > MAX_INK) throw new GameError("Das Blatt ist voll – lösch etwas.");
      s.strokes.push({ c: a.c, w: a.w, p: a.p });
      return s;
    }
    case "undo": {
      if (s.phase !== "draw" || (!local && me !== s.drawer)) throw new GameError("Nur wer zeichnet, kann zurücknehmen.");
      s.strokes.pop();
      return s;
    }
    case "clear": {
      if (s.phase !== "draw" || (!local && me !== s.drawer)) throw new GameError("Nur wer zeichnet, kann löschen.");
      s.strokes = [];
      return s;
    }
    case "guess": {
      if (s.phase !== "draw" || s.mode !== "tippen") throw new GameError("Gerade wird nicht getippt.");
      if (local || !me || !s.order.includes(me) || me === s.drawer) throw new GameError("Du zeichnest gerade.");
      if (s.solved.includes(me)) throw new GameError("Du hast es schon.");
      const text = typeof a.text === "string" ? a.text.trim().slice(0, 40) : "";
      if (!text) throw new GameError("Was ist es?");
      const ok = !!s.word && matches(text, wordText(s.word));
      const near = !ok && s.word ? closeness(text, wordText(s.word)) : null;
      s.guesses.push(near ? { by: me, text, ok, near } : { by: me, text, ok });
      if (s.guesses.length > MAX_GUESSES) s.guesses.splice(0, s.guesses.length - MAX_GUESSES);
      if (ok) {
        // Wer früh rät, bekommt mehr
        const end = deadlineOf(s) ?? ctx.now;
        const left = Math.max(0, Math.min(1, (end - ctx.now) / (s.seconds * 1000)));
        const pts = Math.round((POINTS.guessMin + (POINTS.guessMax - POINTS.guessMin) * left) / 10) * 10;
        s.scores[me] = (s.scores[me] ?? 0) + pts;
        if (s.drawer) s.scores[s.drawer] = (s.scores[s.drawer] ?? 0) + POINTS.drawer;
        s.solved.push(me);
        if (s.order.filter((id) => id !== s.drawer).every((id) => s.solved.includes(id))) reveal(s, ctx);
      }
      return s;
    }
    case "award": {
      if (s.phase !== "draw") throw new GameError("Gerade wird nicht gezeichnet.");
      if (!drawerActs) throw new GameError(`${nameOf(ctx, s.drawer)} sagt, wer es hatte.`);
      if (a.to !== null) {
        if (typeof a.to !== "string" || !s.order.includes(a.to) || a.to === s.drawer) throw new GameError("Wer hatte es?");
        if (!s.solved.includes(a.to)) {
          s.solved.push(a.to);
          s.scores[a.to] = (s.scores[a.to] ?? 0) + POINTS.shout;
          if (s.drawer) s.scores[s.drawer] = (s.scores[s.drawer] ?? 0) + POINTS.shoutDrawer;
        }
      }
      reveal(s, ctx);
      return s;
    }
    case "done": {
      if (s.phase !== "draw") throw new GameError("Gerade wird nicht gezeichnet.");
      if (!drawerActs) throw new GameError("Nur wer zeichnet, beendet.");
      reveal(s, ctx);
      return s;
    }
    case "timeUp": {
      const end = deadlineOf(s);
      if (end === null || ctx.now < end - 500) throw new GameError("Die Zeit läuft noch.");
      reveal(s, ctx);
      return s;
    }
    case "next": {
      if (s.phase !== "reveal") throw new GameError("Erst den Begriff zeigen.");
      nextTurn(s, ctx);
      return s;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
}

export const zeichnen: GameLogic<ZState, ZAction> = {
  info: {
    id: "zeichnen",
    name: "Zeichnen & Raten",
    tagline: "Einer malt am Handy, alle raten – laut oder per Tipp.",
    category: "Party",
    minPlayers: 2,
    maxPlayers: 16,
    duration: "20 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: false,
  settings: [
    {
      key: "guess", label: "Raten", type: "choice", default: "rufen",
      choices: [
        { value: "rufen", label: "Laut rufen", hint: "wer zeichnet, tippt an, wer es hatte" },
        { value: "tippen", label: "Ins Handy tippen", hint: "die App prüft die Tipps" },
      ],
    },
    { key: "seconds", label: "Zeit zum Zeichnen (s)", type: "number", default: 80, min: 30, max: 240, step: 10 },
    { key: "rounds", label: "Runden", type: "number", default: 2, min: 1, max: 10, step: 1 },
    {
      key: "level", label: "Begriffe", type: "choice", default: "familie",
      choices: LEVELS.map((l) => ({ value: l.id, label: l.name, hint: l.hint })),
    },
  ],
  setup,
  apply,
  actionKind: (a) => (["pick", "stroke", "undo", "clear", "guess", "award", "done", "timeUp", "next"].includes(a.type) ? "player" : null),
  currentPlayerId: (s) => (s.phase === "pick" || s.phase === "draw" || s.phase === "reveal" ? s.drawer : null),
  isOver: (s) => s.phase === "over",
  results: (s) => {
    const max = Math.max(...s.order.map((id) => s.scores[id] ?? 0));
    return s.order.map((id) => ({ id, won: (s.scores[id] ?? 0) === max, score: s.scores[id] ?? 0 }));
  },
  skipLabel: (s) => (s.phase === "pick" ? "Begriff auslosen" : s.phase === "draw" ? "Zeichnen beenden" : s.phase === "reveal" ? "Weiter" : null),
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "pick") { s.word = s.choices[0] ?? null; s.mask = maskOf(wordText(s.word)); if (s.word) s.used.push(s.word); s.choices = []; s.phase = "draw"; s.startedAt = ctx.now; }
    else if (s.phase === "draw") reveal(s, ctx);
    else if (s.phase === "reveal") nextTurn(s, ctx);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!s.order.includes(id)) return s;
    const wasDrawer = s.drawer === id;
    s.order = s.order.filter((x) => x !== id);
    delete s.scores[id];
    s.solved = s.solved.filter((x) => x !== id);
    // Züge des Gegangenen fallen weg (je Runde einer weniger)
    const rounds = Math.round(prev.turns / Math.max(1, prev.order.length));
    s.turns = rounds * s.order.length;
    if (s.phase === "over") return s;
    if (s.order.length < 2) { s.phase = "over"; s.drawer = null; return s; }
    if (wasDrawer) {
      if (s.phase === "draw") { reveal(s, ctx); return s; }
      if (s.phase === "pick") { s.turn = Math.min(s.turn, s.turns - 1); startTurn(s, ctx); return s; }
    }
    // Tippen: haben jetzt alle verbliebenen Ratenden es? Dann aufdecken
    if (s.phase === "draw" && s.mode === "tippen" && s.order.filter((x) => x !== s.drawer).every((x) => s.solved.includes(x))) reveal(s, ctx);
    return s;
  },
  view(s, viewer) {
    const knows = viewer === null || s.phase === "reveal" || s.phase === "over" || (viewer !== WATCH_ID && (viewer === s.drawer || s.solved.includes(viewer)));
    return {
      ...s,
      choices: viewer === null || viewer === s.drawer ? s.choices : [],
      word: knows ? s.word : null,
      // Richtige Tipps der anderen verraten den Begriff nicht, „nah dran“ sieht nur, wer getippt hat
      guesses: s.guesses.map((g) => {
        if (knows || g.by === viewer) return g;
        if (g.ok) return { ...g, text: "" };
        if (g.near) { const { near: _, ...rest } = g; return rest; }
        return g;
      }),
      used: [],
    };
  },
};

