/**
 * Stadt-Land-Fluss – ein Buchstabe wird gezogen, alle füllen gleichzeitig am eigenen Handy die Kategorien.
 * Wer zuerst alles hat, ruft „Stopp!“ – dann bleibt den anderen ein kurzer Countdown (oder die Rundenzeit läuft ab).
 * Danach wird Kategorie für Kategorie ausgewertet: alle sehen die Antworten, die Mehrheit kann eine Antwort ablehnen
 * (Daumen runter, bei Gleichstand entscheidet der Host). Punkte: 20 als Einziger mit gültiger Antwort, 10 einzigartig,
 * 5 doppelt (tippfehlertolerant verglichen, wie bei Zeichnen & Raten), sonst 0.
 *
 * Zeit nur aus `ctx.now`. Beim Schreiben sieht jeder nur seine eigenen Antworten, der Fernseher nur, wer fertig ist.
 * In der Auswertung erscheinen die Antworten einer Kategorie erst, wenn sie dran ist.
 */
import { shuffle } from "../../platform/random";
import { playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";
import { matches, normalizeGuess } from "../zeichnen/logic";
import { KATEGORIEN, woerterOf } from "./woerter";

export type Phase = "write" | "review" | "score" | "over";

/** Bewertung einer Antwort: gültig, abgelehnt, falscher Anfangsbuchstabe, leer */
export type Mark = "ok" | "no" | "letter" | "empty";

export interface SlfState {
  v: 1;
  phase: Phase;
  order: string[];
  names: Record<string, string>;
  left: string[];
  cats: string[];
  /** Buchstaben, die gezogen werden können, und die schon gezogenen */
  pool: string[];
  used: string[];
  letter: string;
  rounds: number;
  /** Runde 0 … rounds − 1 */
  round: number;
  /** Antworten je Spieler (je Kategorie ein Eintrag) – beim Schreiben geheim */
  answers: Record<string, string[]>;
  /** wer mit Schreiben fertig ist */
  done: string[];
  /** Stopp gerufen: von wem (null = Host erzwang) und wann */
  stopBy: string | null;
  stopAt: number | null;
  /** Sekunden: Rundenzeit (0 = ohne) und Countdown nach dem Stopp */
  seconds: number;
  countdown: number;
  startedAt: number | null;
  /** Auswertung: welche Kategorie, wer wen ablehnt (Wähler → Autoren), Host-Entscheid bei Gleichstand */
  cat: number;
  votes: Record<string, string[]>;
  decided: Record<string, boolean>;
  /** fertig ausgewertet: Bewertung und Punkte je Spieler und Kategorie (diese Runde) */
  marks: Record<string, Mark[]>;
  points: Record<string, number[]>;
  scores: Record<string, number>;
  /** frühere Runden: Buchstabe und Punkte */
  history: { letter: string; points: Record<string, number> }[];
  local: boolean;
  log: string[];
}

export type SlfAction =
  /** Entwurf speichern (zählt, wenn die Zeit abläuft) – `player` nur an einem Handy für alle */
  | { type: "fill"; answers: string[]; player?: string }
  /** fertig abgeben – `stop`: alles ausgefüllt, „Stopp!“ für alle */
  | { type: "done"; answers: string[]; stop?: boolean; player?: string }
  | { type: "timeUp" }
  /** Host: Stopp für alle erzwingen */
  | { type: "forceStop" }
  /** Auswertung: Daumen runter (umschalten) für die Antwort von `target` */
  | { type: "vote"; target: string }
  /** Host bei Gleichstand (an einem Handy für alle: die Gruppe) – ablehnen oder gelten lassen */
  | { type: "decide"; target: string; reject: boolean }
  /** Host: nächste Kategorie, nächste Runde */
  | { type: "next" };

export const MAX_ANSWER = 40;
export const MAX_CATS = 10;
export const MAX_OWN = 4;
export const RARE = ["Q", "X", "Y"];
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const CLOCKS = ["0", "60", "90", "120", "180"] as const;
export const COUNTDOWNS = ["5", "10", "15", "30"] as const;
export const POINTS = { alone: 20, unique: 10, shared: 5 } as const;

const catKey = (id: string) => `k_${id}`;

/** Eigene Kategorien aus dem Einstellungstext (durch Komma getrennt) */
export function ownCats(o: Options): string[] {
  const raw = typeof o.own === "string" ? o.own : "";
  const out: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const name = part.replace(/\s+/g, " ").trim().slice(0, 20);
    if (name && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out.slice(0, MAX_OWN);
}

/** Kategorien dieser Partie: die gewählten eingebauten, dann die eigenen – höchstens 10, nie keine */
export function catsOf(o: Options): string[] {
  const built = KATEGORIEN.filter((k) => (o[catKey(k.id)] ?? !!k.on) === true).map((k) => k.name);
  const own = ownCats(o).filter((x) => !built.some((b) => b.toLowerCase() === x.toLowerCase()));
  const all = [...built, ...own].slice(0, MAX_CATS);
  return all.length ? all : KATEGORIEN.filter((k) => k.on).map((k) => k.name);
}

export const active = (s: SlfState) => s.order.filter((id) => !s.left.includes(id));
/** Wann der Schreibteil endet: Countdown nach dem Stopp oder Rundenzeit – das frühere */
export function deadlineOf(s: SlfState): number | null {
  if (s.phase !== "write") return null;
  const ends: number[] = [];
  if (s.stopAt !== null) ends.push(s.stopAt + s.countdown * 1000);
  if (s.startedAt !== null && s.seconds > 0) ends.push(s.startedAt + s.seconds * 1000);
  return ends.length ? Math.min(...ends) : null;
}

/** Passt der Anfangsbuchstabe? (Ä zählt als A usw.) */
export function startsWith(answer: string, letter: string): boolean {
  const n = normalizeGuess(answer);
  return !!n && n[0] === letter.toLowerCase();
}

/** Dieselbe Antwort? Groß/klein egal, kleine Tippfehler zählen (wie bei Zeichnen & Raten) */
export const same = (a: string, b: string) => matches(a, b) || matches(b, a);

const clean = (t: unknown) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER) : "");
const nameOf = (s: SlfState, ctx: GameContext, id: string | null) => (id && s.names[id]) || playerName(ctx, id);

function pushLog(s: SlfState, line: string) {
  s.log.push(line);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

/** Wer darf die Antwort von `target` ablehnen? Alle anderen, die noch dabei sind */
export const votersFor = (s: SlfState, target: string) => active(s).filter((id) => id !== target);
/** Daumen runter für `target` in dieser Kategorie */
export const downFor = (s: SlfState, target: string) => votersFor(s, target).filter((v) => s.votes[v]?.includes(target)).length;

/** Stand einer Antwort in der laufenden Auswertung: ok, abgelehnt, Gleichstand (Host entscheidet), Buchstabe falsch, leer */
export function liveMark(s: SlfState, id: string, cat = s.cat): Mark | "tie" {
  const a = s.answers[id]?.[cat] ?? "";
  if (!a) return "empty";
  if (!startsWith(a, s.letter)) return "letter";
  if (s.local) return s.decided[id] === true ? "no" : "ok";
  const down = downFor(s, id), n = votersFor(s, id).length;
  if (down * 2 > n) return "no";
  if (down > 0 && down * 2 === n) return s.decided[id] === undefined ? "tie" : s.decided[id] ? "no" : "ok";
  return "ok";
}

/** Punkte einer Kategorie aus den Bewertungen: 20 allein gültig, 10 einzigartig, 5 mehrfach, sonst 0 */
export function scoreCategory(answers: Record<string, string>, marks: Record<string, Mark>): Record<string, number> {
  const ok = Object.keys(answers).filter((id) => marks[id] === "ok");
  const out: Record<string, number> = Object.fromEntries(Object.keys(answers).map((id) => [id, 0]));
  for (const id of ok) {
    if (ok.length === 1) out[id] = POINTS.alone;
    else out[id] = ok.some((o) => o !== id && same(answers[o], answers[id])) ? POINTS.shared : POINTS.unique;
  }
  return out;
}

function newRound(s: SlfState, ctx: GameContext) {
  let pool = s.pool.filter((l) => !s.used.includes(l));
  if (!pool.length) { s.used = []; pool = s.pool; }
  s.letter = shuffle(pool)[0];
  s.used.push(s.letter);
  s.phase = "write";
  s.answers = {};
  s.done = [];
  s.stopBy = null;
  s.stopAt = null;
  s.startedAt = s.seconds > 0 ? ctx.now : null;
  s.cat = 0;
  s.votes = {};
  s.decided = {};
  s.marks = {};
  s.points = {};
  pushLog(s, `Runde ${s.round + 1}: Buchstabe ${s.letter}`);
}

function setup(ctx: GameContext): SlfState {
  const o = ctx.options;
  const local = ctx.actorId === null;
  const clock = String(o.clock ?? "120");
  const cd = String(o.countdown ?? "10");
  const s: SlfState = {
    v: 1, phase: "write", order: ctx.players.map((p) => p.id), names: Object.fromEntries(ctx.players.map((p) => [p.id, p.name])), left: [],
    cats: catsOf(o), pool: ALPHABET.filter((l) => o.rare === true || !RARE.includes(l)), used: [], letter: "A",
    rounds: Math.max(1, Math.min(10, Number(o.rounds) || 5)), round: 0, answers: {}, done: [], stopBy: null, stopAt: null,
    // An einem Handy für alle geht es reihum ohne Uhr – jeder füllt nacheinander aus
    seconds: local ? 0 : CLOCKS.includes(clock as never) ? Number(clock) : 120,
    countdown: COUNTDOWNS.includes(cd as never) ? Number(cd) : 10,
    startedAt: null, cat: 0, votes: {}, decided: {}, marks: {}, points: {}, scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    history: [], local, log: [],
  };
  newRound(s, ctx);
  return s;
}

/** Schreiben beenden → Auswertung der ersten Kategorie; wer nichts hat, bekommt leere Felder */
function endWrite(s: SlfState) {
  for (const id of s.order) s.answers[id] = s.cats.map((_, i) => s.answers[id]?.[i] ?? "");
  s.phase = "review";
  s.cat = 0;
  s.votes = {};
  s.decided = {};
  s.startedAt = null;
  s.stopAt = null;
  pushLog(s, `Auswertung: ${s.cats[0]}`);
}

/** Kategorie abschließen: Bewertungen festschreiben, Punkte vergeben */
function finishCat(s: SlfState) {
  const answers: Record<string, string> = {};
  const marks: Record<string, Mark> = {};
  for (const id of s.order) {
    answers[id] = s.answers[id]?.[s.cat] ?? "";
    const m = s.left.includes(id) ? (answers[id] ? "no" : "empty") : liveMark(s, id);
    marks[id] = m === "tie" ? "ok" : m;
  }
  const pts = scoreCategory(answers, marks);
  for (const id of s.order) {
    (s.marks[id] ??= [])[s.cat] = marks[id];
    (s.points[id] ??= [])[s.cat] = pts[id];
  }
}

function next(s: SlfState, ctx: GameContext) {
  if (s.phase === "review") {
    finishCat(s);
    s.votes = {};
    s.decided = {};
    if (s.cat + 1 < s.cats.length) { s.cat++; pushLog(s, `Auswertung: ${s.cats[s.cat]}`); return; }
    const sum: Record<string, number> = {};
    for (const id of s.order) { sum[id] = (s.points[id] ?? []).reduce((a, b) => a + (b ?? 0), 0); s.scores[id] = (s.scores[id] ?? 0) + sum[id]; }
    s.history.push({ letter: s.letter, points: sum });
    s.phase = "score";
    const best = Math.max(0, ...active(s).map((id) => sum[id] ?? 0));
    pushLog(s, `Runde ${s.round + 1} (${s.letter}) – Bester: ${active(s).filter((id) => sum[id] === best).map((id) => nameOf(s, ctx, id)).join(", ")} mit ${best} Punkten`);
    return;
  }
  if (s.phase === "score") {
    if (s.round + 1 >= s.rounds || active(s).length < 2) { s.phase = "over"; pushLog(s, "Spiel zu Ende"); return; }
    s.round++;
    newRound(s, ctx);
    return;
  }
  throw new GameError("Gerade gibt es kein Weiter.");
}

/** Wer schreibt? Online man selbst, an einem Handy für alle der genannte Spieler */
function writer(s: SlfState, a: { player?: string }, ctx: GameContext): string {
  if (s.phase !== "write") throw new GameError("Gerade wird nicht geschrieben.");
  const id = ctx.actorId ?? (typeof a.player === "string" ? a.player : null);
  if (!id || !s.order.includes(id) || s.left.includes(id)) throw new GameError("Du spielst nicht mit.");
  if (s.done.includes(id)) throw new GameError("Du bist schon fertig.");
  return id;
}

const store = (s: SlfState, id: string, list: unknown) => {
  const arr = Array.isArray(list) ? list : [];
  s.answers[id] = s.cats.map((_, i) => clean(arr[i]));
};

function checkWrite(s: SlfState) {
  if (s.phase === "write" && active(s).every((id) => s.done.includes(id))) endWrite(s);
}

function apply(prev: SlfState, a: SlfAction, ctx: GameContext): SlfState {
  const s = structuredClone(prev);
  switch (a.type) {
    case "fill": {
      const id = writer(s, a, ctx);
      store(s, id, a.answers);
      return s;
    }
    case "done": {
      const id = writer(s, a, ctx);
      store(s, id, a.answers);
      if (a.stop) {
        if (s.answers[id].some((x) => !x)) throw new GameError("Für „Stopp!“ müssen alle Felder ausgefüllt sein.");
        if (s.stopAt === null) { s.stopAt = ctx.now; s.stopBy = id; pushLog(s, `${nameOf(s, ctx, id)} ruft Stopp!`); }
      }
      s.done.push(id);
      checkWrite(s);
      return s;
    }
    case "forceStop": {
      if (s.phase !== "write") throw new GameError("Gerade wird nicht geschrieben.");
      if (s.stopAt !== null) throw new GameError("Stopp läuft schon.");
      s.stopAt = ctx.now;
      s.stopBy = null;
      pushLog(s, "Der Host ruft Stopp!");
      return s;
    }
    case "timeUp": {
      const end = deadlineOf(s);
      if (end === null || ctx.now < end - 500) throw new GameError("Die Zeit läuft noch.");
      endWrite(s);
      return s;
    }
    case "vote": {
      if (s.phase !== "review") throw new GameError("Gerade wird nicht ausgewertet.");
      const me = ctx.actorId;
      if (me === null) {
        // Ein Handy für alle: die Gruppe entscheidet direkt
        if (!s.order.includes(a.target) || !(s.answers[a.target]?.[s.cat])) throw new GameError("Diese Antwort gibt es nicht.");
        s.decided[a.target] = !s.decided[a.target];
        return s;
      }
      if (!active(s).includes(me)) throw new GameError("Du spielst nicht mit.");
      if (a.target === me) throw new GameError("Die eigene Antwort kannst du nicht ablehnen.");
      if (!active(s).includes(a.target) || !(s.answers[a.target]?.[s.cat])) throw new GameError("Diese Antwort gibt es nicht.");
      const mine = (s.votes[me] ??= []);
      if (mine.includes(a.target)) s.votes[me] = mine.filter((x) => x !== a.target);
      else mine.push(a.target);
      // Gleichstand neu, sobald sich die Stimmen ändern
      delete s.decided[a.target];
      return s;
    }
    case "decide": {
      if (s.phase !== "review") throw new GameError("Gerade wird nicht ausgewertet.");
      if (!s.order.includes(a.target) || !(s.answers[a.target]?.[s.cat])) throw new GameError("Diese Antwort gibt es nicht.");
      if (ctx.actorId !== null && ctx.actorId !== ctx.hostId) throw new GameError("Das entscheidet der Host.");
      s.decided[a.target] = a.reject === true;
      return s;
    }
    case "next": {
      next(s, ctx);
      return s;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
}

/** Antworten eines Testspielers: passende Wörter aus den kleinen Listen, manchmal nichts */
export function botAnswers(s: SlfState, rnd: () => number = Math.random): string[] {
  return s.cats.map((c) => {
    const fit = woerterOf(c).filter((w) => startsWith(w, s.letter));
    return fit.length && rnd() < 0.8 ? fit[Math.floor(rnd() * fit.length)] : "";
  });
}

const missing = (s: SlfState) => active(s).filter((id) => !s.done.includes(id));

export const stadtlandfluss: GameLogic<SlfState, SlfAction> = {
  info: {
    id: "stadtlandfluss",
    name: "Stadt-Land-Fluss",
    tagline: "Ein Buchstabe, sechs Kategorien – wer ruft zuerst „Stopp!“?",
    category: "Party",
    minPlayers: 2,
    maxPlayers: 12,
    duration: "20 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: false,
  presets: [
    { id: "kurz", label: "Kurz", hint: "3 Runden, 4 Kategorien", options: { rounds: 3, k_name: false, k_beruf: false } },
    {
      id: "kinder", label: "Kinder", hint: "einfache Kategorien",
      options: { countdown: "30", ...Object.fromEntries(KATEGORIEN.filter((k) => !k.on !== !k.kinder).map((k) => [catKey(k.id), !!k.kinder])) },
    },
  ],
  settings: [
    { key: "rounds", label: "Runden", type: "number", default: 5, min: 1, max: 10, step: 1 },
    {
      key: "clock", label: "Zeit je Runde", type: "choice", default: "120",
      choices: CLOCKS.map((c) => ({ value: c, label: c === "0" ? "Ohne" : `${c} s` })),
    },
    {
      key: "countdown", label: "Nach dem Stopp", type: "choice", default: "10",
      choices: COUNTDOWNS.map((c) => ({ value: c, label: `${c} s` })),
    },
    ...KATEGORIEN.map((k) => ({ key: catKey(k.id), label: k.name, type: "toggle" as const, default: !!k.on, group: "Kategorien", chip: true })),
    { key: "own", label: "Eigene", type: "text", default: "", maxLength: 90, placeholder: "z. B. Promi, Gericht", hint: "bis 4, durch Komma getrennt (zusammen höchstens 10)", group: "Kategorien" },
    { key: "rare", label: "Seltene Buchstaben (Q, X, Y)", type: "toggle", default: false, group: "Hausregeln", hint: "sonst kommen sie nie dran" },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt Buchstaben, Stopp und Punkte an (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "next" || a.type === "forceStop" ? "host" : ["fill", "done", "timeUp", "vote", "decide"].includes(a.type) ? "player" : null),
  currentPlayerId: () => null,
  isOver: (s) => s.phase === "over",
  results: (s) => {
    const ids = active(s);
    const best = Math.max(0, ...ids.map((id) => s.scores[id] ?? 0));
    return ids.map((id) => ({ id, won: (s.scores[id] ?? 0) === best, score: s.scores[id] ?? 0 }));
  },
  skipLabel(s, ctx) {
    if (s.phase === "write") {
      if (s.stopAt === null && !s.local) return "Stopp für alle";
      const m = missing(s);
      return m.length ? `Ohne ${m.map((id) => nameOf(s, ctx, id)).join(", ")} auswerten` : null;
    }
    if (s.phase === "review") return s.cat + 1 < s.cats.length ? "Nächste Kategorie" : "Runde werten";
    if (s.phase === "score") return s.round + 1 >= s.rounds ? "Zum Ergebnis" : "Nächste Runde";
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "write") {
      if (s.stopAt === null && !s.local) { s.stopAt = ctx.now; s.stopBy = null; pushLog(s, "Der Host ruft Stopp!"); }
      else endWrite(s);
    } else if (s.phase === "review" || s.phase === "score") next(s, ctx);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!s.order.includes(id) || s.left.includes(id)) return s;
    s.left.push(id);
    pushLog(s, `${nameOf(s, ctx, id)} ist ausgestiegen`);
    delete s.votes[id];
    if (s.phase === "write") checkWrite(s);
    return s;
  },
  botPause: (s) => (s.phase === "review" ? 2500 : s.phase === "score" ? 4000 : 0),
  view(s, viewer) {
    if (viewer === null) return s;
    if (s.phase === "write") {
      // Nur die eigenen Antworten – von den anderen nur, wer fertig ist
      return { ...s, answers: s.order.includes(viewer) && s.answers[viewer] ? { [viewer]: s.answers[viewer] } : {} };
    }
    if (s.phase === "review") {
      // Antworten nur bis zur aktuellen Kategorie
      return { ...s, answers: Object.fromEntries(Object.entries(s.answers).map(([id, a]) => [id, a.map((x, i) => (i <= s.cat ? x : ""))])) };
    }
    return s;
  },
};
