/**
 * Wer bin ich – jeder hat eine geheime Figur (Persönlichkeit, Märchengestalt, Tier, Beruf), die alle anderen sehen, nur er selbst nicht.
 * Reihum stellt der Spieler am Zug laut eine Ja/Nein-Frage über sich, die anderen stimmen am Handy ab (Ja / Nein / Weiß nicht,
 * die Mehrheit zählt). Bei Ja (oder Weiß nicht) darf er weiterfragen – bis zur Grenze je Zug –, bei Nein ist der Nächste dran.
 * Raten darf er jederzeit: getippt und tippfehlertolerant geprüft (wie bei Zeichnen & Raten), sonst bestätigen die anderen.
 * Wer zuerst errät, bekommt die meisten Punkte. Ende, wenn alle erraten haben oder die Fragerunden aufgebraucht sind.
 *
 * Geheimhaltung: Die eigene Figur fehlt in der eigenen Sicht, Außenstehende und der Fernseher sehen keine Figuren
 * (erst bei der Auflösung). Der Notizblock ist privat. Zeit nur aus `ctx.now`.
 */
import { shuffle } from "../../platform/random";
import { playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";
import { matches, normalizeGuess } from "../zeichnen/logic";
import { KATEGORIEN, KATEGORIE_BY_ID } from "./figuren";

export type Phase = "write" | "ask" | "vote" | "guess" | "over";
/** Antwort auf eine Frage: Ja, Nein, Weiß nicht – beim Raten: ja = richtig, nein = falsch */
export type Answer = "ja" | "nein" | "egal";

export interface Note { q: string; a: Answer | null }
export interface LastResult {
  kind: "frage" | "raten";
  asker: string;
  text: string;
  result: Answer;
  counts: Record<Answer, number>;
}

export interface WbState {
  v: 1;
  phase: Phase;
  order: string[];
  names: Record<string, string>;
  left: string[];
  /** Figur und Kategorie je Spieler – in der eigenen Sicht fehlt die eigene */
  figures: Record<string, string>;
  cats: Record<string, string>;
  /** Gegenseitig vergeben: wer schreibt für wen, Entwürfe (nur der Schreiber sieht seinen) */
  mutual: boolean;
  writeFor: Record<string, string>;
  drafts: Record<string, string>;
  /** am Zug, Startplatz (für die Fragerunden), Runde, Fragen in diesem Zug */
  asker: string | null;
  start: number;
  lap: number;
  laps: number;
  asked: number;
  perTurn: number;
  follow: boolean;
  /** laufende Frage bzw. geratener Name und die Stimmen */
  question: string;
  guess: string;
  votes: Record<string, Answer>;
  voteAt: number | null;
  voteSecs: number;
  last: LastResult | null;
  /** erraten in dieser Reihenfolge, Punkte */
  solved: string[];
  scores: Record<string, number>;
  /** Notizblock je Spieler (privat) */
  notes: Record<string, Note[]>;
  /** Fragen gesamt (für Notizen ohne Text) */
  count: number;
  local: boolean;
  log: string[];
}

export type WbAction =
  /** Gegenseitig vergeben: Figur für den Nachbarn – `player` nur an einem Handy für alle */
  | { type: "write"; text: string; player?: string }
  /** Spieler am Zug: Frage stellen (Text freiwillig, gefragt wird laut) */
  | { type: "ask"; text?: string }
  /** Spieler am Zug: raten – getippt oder leer (laut gesagt, die anderen bestätigen) */
  | { type: "guess"; text?: string }
  /** Spieler am Zug: Zug beenden */
  | { type: "pass" }
  /** Abstimmen (Frage: ja/nein/egal, Raten: ja = richtig, nein = falsch) – an einem Handy für alle entscheidet das direkt */
  | { type: "vote"; a: Answer }
  /** Host setzt die Antwort */
  | { type: "decide"; a: Answer }
  | { type: "timeUp" }
  /** Notizblock: Zeile dazu bzw. löschen */
  | { type: "note"; text: string; a?: Answer | null; player?: string }
  | { type: "unnote"; i: number; player?: string };

export const MAX_TEXT = 60;
export const MAX_FIGURE = 40;
export const MAX_NOTES = 30;
export const VOTE_SECS = ["20", "30", "45", "60"] as const;
export const ANSWERS: Answer[] = ["ja", "nein", "egal"];
export const ANSWER_TEXT: Record<Answer, string> = { ja: "Ja", nein: "Nein", egal: "Weiß nicht" };

const catKey = (id: string) => `k_${id}`;
const clean = (t: unknown, max = MAX_TEXT) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, max) : "");
const isAnswer = (x: unknown): x is Answer => x === "ja" || x === "nein" || x === "egal";
const nameOf = (s: WbState, ctx: GameContext, id: string | null) => (id && s.names[id]) || playerName(ctx, id);

function pushLog(s: WbState, line: string) {
  s.log.push(line);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

/** gewählte Kategorien – nie keine */
export function catsOf(o: Options): string[] {
  const on = KATEGORIEN.filter((k) => o[catKey(k.id)] !== false).map((k) => k.id);
  return on.length ? on : KATEGORIEN.map((k) => k.id);
}

export const active = (s: WbState) => s.order.filter((id) => !s.left.includes(id));
export const open = (s: WbState) => active(s).filter((id) => !s.solved.includes(id));
/** Wer stimmt ab? Alle, die noch dabei sind, außer dem Fragenden */
export const voters = (s: WbState) => active(s).filter((id) => id !== s.asker);
export const deadlineOf = (s: WbState): number | null => ((s.phase === "vote" || s.phase === "guess") && s.voteAt !== null ? s.voteAt + s.voteSecs * 1000 : null);

export function counts(s: WbState): Record<Answer, number> {
  const c: Record<Answer, number> = { ja: 0, nein: 0, egal: 0 };
  for (const id of voters(s)) { const a = s.votes[id]; if (a) c[a]++; }
  return c;
}

/** Ergebnis der Frage-Abstimmung: früh, sobald eine Antwort die Mehrheit hat; sonst erst, wenn alle da sind (`force`: jetzt) */
export function questionResult(c: Record<Answer, number>, n: number, force = false): Answer | null {
  for (const a of ANSWERS) if (c[a] * 2 > n) return a;
  if (!force && c.ja + c.nein + c.egal < n) return null;
  if (c.ja > c.nein && c.ja >= c.egal) return "ja";
  if (c.nein > c.ja && c.nein >= c.egal) return "nein";
  return "egal";
}

/** Ergebnis beim Bestätigen: richtig nur mit Mehrheit, Gleichstand ist falsch */
export function guessResult(c: Record<Answer, number>, n: number, force = false): Answer | null {
  if (c.ja * 2 > n) return "ja";
  if (c.nein * 2 >= n) return "nein";
  if (!force && c.ja + c.nein + c.egal < n) return null;
  return c.ja > c.nein ? "ja" : "nein";
}

const STOP = new Set(["der", "die", "das", "von", "van", "da", "im", "und", "ii", "koenig", "kaiserin", "zauberer", "graf", "frau", "baron", "queen"]);
/** Richtig geraten? Ganzer Name oder ein markanter Teil („Einstein“), kleine Tippfehler zählen */
export function guessMatches(guess: string, figure: string): boolean {
  if (!normalizeGuess(guess)) return false;
  if (matches(guess, figure) || matches(figure, guess)) return true;
  const g = normalizeGuess(guess);
  const parts = figure.split(/[\s-]+/).filter((w) => normalizeGuess(w).length >= 4 && !STOP.has(normalizeGuess(w)));
  return parts.length > 1 && parts.some((w) => matches(guess, w) || normalizeGuess(w) === g);
}

/** Punkte für den nächsten, der errät: Erster so viele wie Spieler, dann einer weniger, mindestens 1 */
export const pointsFor = (s: WbState) => Math.max(1, s.order.length - s.solved.length);

/** Figuren aus den Kategorien verteilen (ohne Doppelte) */
function dealFigures(s: WbState, cats: string[], ids: string[]) {
  const taken = new Set(Object.values(s.figures).map(normalizeGuess));
  const pool = shuffle(cats.flatMap((c) => KATEGORIE_BY_ID[c].figuren.map((f) => ({ f, c: KATEGORIE_BY_ID[c].name }))).filter((x) => !taken.has(normalizeGuess(x.f))));
  for (const id of ids) {
    const x = pool.shift() ?? { f: "Gespenst", c: "Märchen & Sagen" };
    s.figures[id] = x.f;
    s.cats[id] = x.c;
  }
}

function setup(ctx: GameContext): WbState {
  const o = ctx.options;
  const order = ctx.players.map((p) => p.id);
  const n = order.length;
  const start = n ? (ctx.round ?? 0) % n : 0;
  const secs = String(o.voteSecs ?? "30");
  const s: WbState = {
    v: 1, phase: "ask", order, names: Object.fromEntries(ctx.players.map((p) => [p.id, p.name])), left: [],
    figures: {}, cats: {}, mutual: o.source === "gegenseitig", writeFor: {}, drafts: {},
    asker: order[start] ?? null, start, lap: 0, laps: Math.max(3, Math.min(30, Number(o.laps) || 10)), asked: 0,
    perTurn: Math.max(1, Math.min(5, Number(o.perTurn) || 3)), follow: o.follow !== false,
    question: "", guess: "", votes: {}, voteAt: null, voteSecs: VOTE_SECS.includes(secs as never) ? Number(secs) : 30,
    last: null, solved: [], scores: Object.fromEntries(order.map((id) => [id, 0])), notes: Object.fromEntries(order.map((id) => [id, []])),
    count: 0, local: ctx.actorId === null, log: [],
  };
  if (s.mutual) {
    s.phase = "write";
    order.forEach((id, i) => { s.writeFor[id] = order[(i + 1) % n]; });
    pushLog(s, "Jeder schreibt eine Figur für seinen Nachbarn");
  } else {
    dealFigures(s, catsOf(o), order);
    pushLog(s, `${nameOf(s, ctx, s.asker)} fängt an`);
  }
  return s;
}

/** Gegenseitig: fertig, wenn jeder, der noch dabei ist, seine Figur hat oder sein Schreiber ausgestiegen ist */
function checkWrite(s: WbState, ctx: GameContext, force = false) {
  if (s.phase !== "write") return;
  const writers = active(s).filter((w) => s.writeFor[w] && !s.left.includes(s.writeFor[w]));
  if (!force && writers.some((w) => !s.drafts[w])) return;
  const missing: string[] = [];
  for (const id of s.order) {
    const w = Object.keys(s.writeFor).find((x) => s.writeFor[x] === id);
    if (w && s.drafts[w] && !s.left.includes(w)) { s.figures[id] = s.drafts[w]; s.cats[id] = "Von " + nameOf(s, ctx, w); }
    else missing.push(id);
  }
  dealFigures(s, catsOf(ctx.options), missing);
  s.drafts = {};
  s.phase = "ask";
  s.asked = 0;
  if (!s.asker || s.left.includes(s.asker)) s.asker = open(s)[0] ?? null;
  pushLog(s, `Alle Figuren sind verteilt – ${nameOf(s, ctx, s.asker)} fängt an`);
  if (open(s).length === 0 || active(s).length < 2) finish(s);
}

function finish(s: WbState) {
  s.phase = "over";
  s.votes = {};
  s.voteAt = null;
  pushLog(s, "Auflösung");
}

/** Nächster, der noch rät – nach jedem vollen Durchgang zählt eine Fragerunde */
function nextTurn(s: WbState) {
  s.votes = {};
  s.voteAt = null;
  s.question = "";
  s.guess = "";
  s.asked = 0;
  const n = s.order.length;
  const cur = s.asker ? s.order.indexOf(s.asker) : s.start;
  if (open(s).length === 0 || active(s).length < 2) { finish(s); return; }
  for (let j = 1; j <= n; j++) {
    const k = (cur + j) % n;
    // wieder beim Startplatz: eine Fragerunde ist um
    if (k === s.start) {
      s.lap++;
      if (s.lap >= s.laps) { finish(s); return; }
    }
    const id = s.order[k];
    if (!s.left.includes(id) && !s.solved.includes(id)) { s.asker = id; s.phase = "ask"; return; }
  }
  finish(s);
}

/** Frage auswerten: notieren, weiterfragen oder Nächster */
function resolveQuestion(s: WbState, ctx: GameContext, a: Answer) {
  const asker = s.asker!;
  const c = counts(s);
  s.count++;
  const text = s.question || `Frage ${s.count}`;
  s.last = { kind: "frage", asker, text, result: a, counts: c };
  const notes = (s.notes[asker] ??= []);
  notes.push({ q: text, a });
  if (notes.length > MAX_NOTES) notes.splice(0, notes.length - MAX_NOTES);
  s.asked++;
  pushLog(s, `${nameOf(s, ctx, asker)}: ${s.question ? `„${s.question}“ – ` : ""}${ANSWER_TEXT[a]}`);
  s.votes = {};
  s.voteAt = null;
  s.question = "";
  if (a !== "nein" && s.follow && s.asked < s.perTurn) { s.phase = "ask"; return; }
  nextTurn(s);
}

function resolveGuess(s: WbState, ctx: GameContext, ok: boolean, c = counts(s)) {
  const asker = s.asker!;
  s.last = { kind: "raten", asker, text: s.guess, result: ok ? "ja" : "nein", counts: c };
  if (ok) {
    const pts = pointsFor(s);
    s.solved.push(asker);
    s.scores[asker] = (s.scores[asker] ?? 0) + pts;
    pushLog(s, `${nameOf(s, ctx, asker)} hat es: ${s.figures[asker]} (+${pts})`);
  } else {
    pushLog(s, `${nameOf(s, ctx, asker)} rät ${s.guess ? `„${s.guess}“` : "laut"} – falsch`);
  }
  nextTurn(s);
}

/** Abstimmung prüfen (früh entscheiden, wenn die Mehrheit steht; `force`: Zeit um oder Host) */
function checkVote(s: WbState, ctx: GameContext, force = false) {
  const n = voters(s).length;
  const c = counts(s);
  if (s.phase === "vote") {
    const a = questionResult(c, n, force);
    if (a) resolveQuestion(s, ctx, a);
  } else if (s.phase === "guess") {
    const a = guessResult(c, n, force);
    if (a) resolveGuess(s, ctx, a === "ja", c);
  }
}

function askerOnly(s: WbState, ctx: GameContext) {
  if (s.phase !== "ask") throw new GameError("Gerade wird nicht gefragt.");
  if (ctx.actorId !== null && ctx.actorId !== s.asker) throw new GameError("Du bist nicht dran.");
}

/** Notizblock: wessen? Online man selbst, an einem Handy für alle der genannte Spieler */
function noteOwner(s: WbState, a: { player?: string }, ctx: GameContext): string {
  const id = ctx.actorId ?? (typeof a.player === "string" ? a.player : s.asker);
  if (!id || !s.order.includes(id)) throw new GameError("Du spielst nicht mit.");
  return id;
}

function apply(prev: WbState, a: WbAction, ctx: GameContext): WbState {
  const s = structuredClone(prev);
  if (s.phase === "over") throw new GameError("Das Spiel ist aus.");
  switch (a.type) {
    case "write": {
      if (s.phase !== "write") throw new GameError("Die Figuren sind schon verteilt.");
      const id = ctx.actorId ?? (typeof a.player === "string" ? a.player : null);
      if (!id || !s.order.includes(id) || s.left.includes(id)) throw new GameError("Du spielst nicht mit.");
      const text = clean(a.text, MAX_FIGURE);
      if (!text) throw new GameError("Schreib eine Figur auf.");
      s.drafts[id] = text;
      checkWrite(s, ctx);
      return s;
    }
    case "ask": {
      askerOnly(s, ctx);
      s.question = clean(a.text);
      s.phase = "vote";
      s.votes = {};
      s.voteAt = ctx.now;
      return s;
    }
    case "guess": {
      askerOnly(s, ctx);
      s.guess = clean(a.text, MAX_FIGURE);
      s.votes = {};
      if (s.guess && guessMatches(s.guess, s.figures[s.asker!] ?? "")) { resolveGuess(s, ctx, true, { ja: 0, nein: 0, egal: 0 }); return s; }
      // nicht erkannt (oder laut geraten): die anderen bestätigen
      s.phase = "guess";
      s.voteAt = ctx.now;
      return s;
    }
    case "pass": {
      askerOnly(s, ctx);
      pushLog(s, `${nameOf(s, ctx, s.asker)} gibt weiter`);
      nextTurn(s);
      return s;
    }
    case "vote": {
      if (s.phase !== "vote" && s.phase !== "guess") throw new GameError("Gerade wird nicht abgestimmt.");
      if (!isAnswer(a.a) || (s.phase === "guess" && a.a === "egal")) throw new GameError("Unbekannte Antwort.");
      if (ctx.actorId === null) {
        // Ein Handy für alle: die Gruppe antwortet gemeinsam
        if (s.phase === "vote") resolveQuestion(s, ctx, a.a); else resolveGuess(s, ctx, a.a === "ja");
        return s;
      }
      if (!voters(s).includes(ctx.actorId)) throw new GameError(ctx.actorId === s.asker ? "Über dich stimmen die anderen ab." : "Du spielst nicht mit.");
      s.votes[ctx.actorId] = a.a;
      checkVote(s, ctx);
      return s;
    }
    case "decide": {
      if (s.phase !== "vote" && s.phase !== "guess") throw new GameError("Gerade wird nicht abgestimmt.");
      if (ctx.actorId !== null && ctx.actorId !== ctx.hostId) throw new GameError("Das entscheidet der Host.");
      if (!isAnswer(a.a)) throw new GameError("Unbekannte Antwort.");
      if (s.phase === "vote") resolveQuestion(s, ctx, a.a); else resolveGuess(s, ctx, a.a === "ja");
      return s;
    }
    case "timeUp": {
      const end = deadlineOf(s);
      if (end === null || ctx.now < end - 500) throw new GameError("Die Zeit läuft noch.");
      checkVote(s, ctx, true);
      return s;
    }
    case "note": {
      const id = noteOwner(s, a, ctx);
      const text = clean(a.text);
      if (!text) throw new GameError("Leere Notiz.");
      const notes = (s.notes[id] ??= []);
      if (notes.length >= MAX_NOTES) throw new GameError("Der Notizblock ist voll.");
      notes.push({ q: text, a: isAnswer(a.a) ? a.a : null });
      return s;
    }
    case "unnote": {
      const id = noteOwner(s, a, ctx);
      const notes = s.notes[id] ?? [];
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= notes.length) throw new GameError("Diese Notiz gibt es nicht.");
      notes.splice(a.i, 1);
      return s;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
}

const missingWriters = (s: WbState) => active(s).filter((w) => !s.drafts[w] && s.writeFor[w] && !s.left.includes(s.writeFor[w]));

export const werbinich: GameLogic<WbState, WbAction> = {
  info: {
    id: "werbinich",
    name: "Wer bin ich",
    tagline: "Alle sehen deine Figur, nur du nicht – frag dich mit Ja und Nein heran.",
    category: "Party",
    minPlayers: 3,
    maxPlayers: 10,
    duration: "20 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: false,
  presets: [
    { id: "kinder", label: "Kinder", hint: "Tiere und Märchen", options: { k_personen: false, k_berufe: false, voteSecs: "45" } },
    { id: "schnell", label: "Schnell", hint: "1 Frage je Zug, 6 Runden", options: { perTurn: 1, laps: 6, voteSecs: "20" } },
  ],
  settings: [
    {
      key: "source", label: "Figuren", type: "choice", default: "app",
      choices: [{ value: "app", label: "Aus der App", hint: "aus den Kategorien" }, { value: "gegenseitig", label: "Gegenseitig", hint: "jeder schreibt eine für den Nachbarn" }],
    },
    ...KATEGORIEN.map((k) => ({ key: catKey(k.id), label: k.name, type: "toggle" as const, default: true, group: "Kategorien", chip: true })),
    { key: "follow", label: "Bei Ja weiterfragen", type: "toggle", default: true, group: "Regeln", hint: "bei Nein ist der Nächste dran" },
    { key: "perTurn", label: "Fragen je Zug höchstens", type: "number", default: 3, min: 1, max: 5, step: 1, group: "Regeln", showIf: (o) => o.follow !== false },
    { key: "laps", label: "Fragerunden", type: "number", default: 10, min: 3, max: 30, step: 1, group: "Regeln" },
    { key: "voteSecs", label: "Zeit zum Abstimmen", type: "choice", default: "30", group: "Regeln", choices: VOTE_SECS.map((c) => ({ value: c, label: `${c} s` })) },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt an, wer fragt, die Antworten und die Auflösung (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (["write", "ask", "guess", "pass", "vote", "decide", "timeUp", "note", "unnote"].includes(a.type) ? "player" : null),
  currentPlayerId: (s) => (s.phase === "over" || s.phase === "write" ? null : s.asker),
  isOver: (s) => s.phase === "over",
  results: (s) => {
    const ids = active(s);
    const best = Math.max(0, ...ids.map((id) => s.scores[id] ?? 0));
    return ids.map((id) => ({ id, won: best > 0 && (s.scores[id] ?? 0) === best, score: s.scores[id] ?? 0 }));
  },
  skipLabel(s, ctx) {
    if (s.phase === "write") { const m = missingWriters(s); return m.length ? `Für ${m.map((id) => nameOf(s, ctx, id)).join(", ")} auslosen` : null; }
    if (s.phase === "ask") return `${nameOf(s, ctx, s.asker)} überspringen`;
    if (s.phase === "vote") return "Abstimmung beenden";
    if (s.phase === "guess") return "Raten werten";
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "write") checkWrite(s, ctx, true);
    else if (s.phase === "ask") { pushLog(s, `${nameOf(s, ctx, s.asker)} wird übersprungen`); nextTurn(s); }
    else if (s.phase === "vote" || s.phase === "guess") checkVote(s, ctx, true);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!s.order.includes(id) || s.left.includes(id) || s.phase === "over") return s;
    s.left.push(id);
    delete s.votes[id];
    pushLog(s, `${nameOf(s, ctx, id)} ist ausgestiegen`);
    if (s.phase === "write") { delete s.drafts[id]; checkWrite(s, ctx); return s; }
    if (s.asker === id) nextTurn(s);
    else if (open(s).length === 0 || active(s).length < 2) finish(s);
    else checkVote(s, ctx);
    return s;
  },
  botPause: (s) => (s.phase === "ask" ? 1500 : 0),
  view(s, viewer) {
    if (viewer === null || s.phase === "over") return s;
    const player = s.order.includes(viewer) && !s.left.includes(viewer);
    if (!player) return { ...s, figures: {}, cats: {}, drafts: {}, notes: {} };
    const hideOwn = !s.solved.includes(viewer);
    const strip = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).filter(([id]) => !hideOwn || id !== viewer));
    return {
      ...s, figures: strip(s.figures), cats: strip(s.cats),
      drafts: s.drafts[viewer] ? { [viewer]: s.drafts[viewer] } : {},
      notes: { [viewer]: s.notes[viewer] ?? [] },
    };
  },
};
