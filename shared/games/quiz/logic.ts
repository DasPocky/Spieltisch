/**
 * Quiz & Schätzen – alle beantworten dieselbe Frage am eigenen Handy, der Fernseher zeigt Frage, Uhr und Auflösung.
 * Drei Arten: Auswahl (vier Antworten), Schätzen (wer am nächsten liegt) und Ordnen (vier Begriffe in die richtige Reihenfolge).
 * An einem Handy für alle: die Frage wird vorgelesen bzw. gezeigt, alle rufen, danach tippt man an, wer richtig lag.
 *
 * Die Lösung und die Antworten der anderen stehen erst nach dem Auflösen in der Sicht (`view`). Zeit nur aus `ctx.now`.
 */
import { randomInt, shuffle } from "../../platform/random";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";
import { KATEGORIEN, KAT_BY_ID } from "./fragen";
import { isFolge, isZahl, type Frage } from "./fragen/typen";
import { mergedContent } from "../../platform/cardsets";

/** Kennung einer eigenen Frage (aus Kartensets): „x:<Nummer in own>“ */
export const OWN_CAT = "x";
/** So steht eine eigene Frage über der Frage */
export const OWN_KAT = { emoji: "✏️", name: "Eigene Frage" } as const;

export type Kind = "wahl" | "zahl" | "folge";
export type Phase = "ask" | "reveal" | "over";

/** Die Frage, wie sie auf dem Handy steht (ohne Lösung) */
export interface Shown { id: string; kind: Kind; text: string; cat: string; options: string[]; unit: string }
/** Antwort: Auswahl = Index, Schätzen = Zahl, Ordnen = Reihenfolge der angezeigten Begriffe */
export type Answer = number | number[];
export interface Result { points: Record<string, number>; key: number | number[]; answers: Record<string, Answer> }

export interface QState {
  v: 1;
  order: string[];
  phase: Phase;
  /** Fragen der Partie (Kennungen), die aktuelle ist `deck[idx]` */
  deck: string[];
  /** Fragen insgesamt (der Stapel selbst bleibt geheim) */
  total: number;
  idx: number;
  shown: Shown | null;
  /** Lösung: Auswahl = Index in `options`, Schätzen = Zahl, Ordnen = richtige Reihenfolge als Indizes in `options` */
  key: number | number[] | null;
  answers: Record<string, Answer>;
  /** wer schon geantwortet hat (öffentlich – die Antwort selbst nicht) */
  answered: string[];
  /** Tempo-Bonus je Antwort (erst beim Auflösen sichtbar und gezählt) */
  bonus: Record<string, number>;
  startedAt: number | null;
  seconds: number;
  scores: Record<string, number>;
  last: Result | null;
  local: boolean;
  /** eigene Fragen (aus Kartensets) – geheim wie der Stapel */
  own?: Frage[];
  log: string[];
}

export type QAction =
  | { type: "answer"; value: Answer }
  | { type: "reveal" }
  | { type: "timeUp" }
  | { type: "next" }
  /** Ein Handy für alle: wer hatte es richtig (bei Schätzen: wer lag am nächsten)? */
  | { type: "award"; ids: string[] };

export const POINTS = { right: 100, fast: 50, near: [100, 60, 30], exact: 50, slot: 25, local: 100 } as const;

export const KINDS: { id: Kind; name: string; hint: string }[] = [
  { id: "wahl", name: "Auswahl", hint: "vier Antworten, eine stimmt" },
  { id: "zahl", name: "Schätzen", hint: "wer am nächsten liegt" },
  { id: "folge", name: "Ordnen", hint: "vier Begriffe in die richtige Reihenfolge" },
];

const kindOf = (f: Frage): Kind => (isZahl(f) ? "zahl" : isFolge(f) ? "folge" : "wahl");
export const frageOf = (id: string, own: Frage[] = []): Frage | null => { const [c, n] = id.split(":"); return c === OWN_CAT ? own[Number(n)] ?? null : KAT_BY_ID[c]?.fragen[Number(n)] ?? null; };

/** Kategorien der Partie: Kinderquiz allein oder alle anderen (einzeln abschaltbar) */
export function katsFor(o: Options) {
  if (o.level === "kinder") return KATEGORIEN.filter((k) => k.stufe === "kinder");
  return KATEGORIEN.filter((k) => k.stufe !== "kinder" && o[`kat_${k.id}`] !== false);
}
const kindsFor = (o: Options): Kind[] => {
  const on = KINDS.filter((k) => o[`art_${k.id}`] !== false).map((k) => k.id);
  return on.length ? on : ["wahl"];
};

/**
 * Stapel der Partie: eigene Fragen zuerst (passende Arten), aufgefüllt mit eingebauten – bei „nur eigene“ nur diese.
 * Nie leer: Sind alle Kategorien abgewählt oder passt keine Frage zu den Arten, kommen alle Kategorien bzw. alle Arten dazu.
 */
export function buildDeck(o: Options, n: number, own: Frage[] = []): string[] {
  const kinds = kindsFor(o);
  const ownIds = shuffle(own.map((f, i) => (kinds.includes(kindOf(f)) ? `${OWN_CAT}:${i}` : null)).filter((x): x is string => !!x)).slice(0, n);
  if (o.own_only === true && ownIds.length) return ownIds;
  const pick = (kats: typeof KATEGORIEN, ks: Kind[]) => kats.flatMap((k) => k.fragen.map((f, i) => (ks.includes(kindOf(f)) ? `${k.id}:${i}` : null)).filter((x): x is string => !!x));
  let ids = pick(katsFor(o), kinds);
  if (!ids.length) ids = pick(katsFor({ ...o, ...Object.fromEntries(KATEGORIEN.map((k) => [`kat_${k.id}`, true])) }), kinds);
  if (!ids.length) ids = pick(katsFor(o).length ? katsFor(o) : KATEGORIEN.filter((k) => k.stufe !== "kinder"), KINDS.map((k) => k.id));
  return [...ownIds, ...shuffle(ids)].slice(0, n);
}

/** Lobby-Hinweis: Was die Einstellungen ergeben (z. B. alle Kategorien abgewählt) */
export function deckNote(o: Options): string | null {
  if (o.level === "kinder") return null;
  return katsFor(o).length ? null : "Keine Kategorie gewählt – es kommen Fragen aus allen.";
}

function show(s: QState, ctx: GameContext) {
  const id = s.deck[s.idx];
  const f = frageOf(id, s.own);
  s.answers = {};
  s.answered = [];
  s.bonus = {};
  s.startedAt = ctx.now;
  if (!f) { s.shown = null; s.key = null; return; }
  const cat = id.split(":")[0];
  if (isZahl(f)) {
    s.shown = { id, kind: "zahl", text: f[0], cat, options: [], unit: f[2] };
    s.key = f[1];
  } else if (isFolge(f)) {
    // angezeigt gemischt; die Lösung ist die Reihenfolge der Indizes
    const items = f[1];
    const perm = shuffle([0, 1, 2, 3]);
    s.shown = { id, kind: "folge", text: f[0], cat, options: perm.map((i) => items[i]), unit: "" };
    s.key = [0, 1, 2, 3].map((rank) => perm.indexOf(rank));
  } else {
    const opts = shuffle([f[1], f[2], f[3], f[4]]);
    s.shown = { id, kind: "wahl", text: f[0], cat, options: opts, unit: "" };
    s.key = opts.indexOf(f[1]);
  }
  s.phase = "ask";
}

/** Punkte der Frage: richtig (mit Tempo), am nächsten dran bzw. richtige Plätze */
function score(s: QState): Record<string, number> {
  const pts: Record<string, number> = {};
  const shown = s.shown;
  if (!shown || s.key === null) return pts;
  if (shown.kind === "wahl") {
    for (const id of s.order) if (s.answers[id] === s.key) pts[id] = POINTS.right;
  } else if (shown.kind === "folge") {
    const key = s.key as number[];
    for (const id of s.order) {
      const a = s.answers[id];
      if (Array.isArray(a)) pts[id] = a.filter((x, i) => x === key[i]).length * POINTS.slot;
    }
  } else {
    const key = s.key as number;
    const dist = s.order.filter((id) => typeof s.answers[id] === "number").map((id) => ({ id, d: Math.abs((s.answers[id] as number) - key) })).sort((a, b) => a.d - b.d);
    // Plätze nach Abstand – gleich nah teilt sich den Platz
    let place = 0;
    dist.forEach((x, i) => {
      if (i > 0 && x.d > dist[i - 1].d) place = i;
      const p = POINTS.near[place] ?? 0;
      if (p) pts[x.id] = p + (x.d === 0 ? POINTS.exact : 0);
    });
  }
  return pts;
}

function reveal(s: QState, ctx: GameContext) {
  if (s.phase !== "ask") return;
  const pts = s.local ? {} : score(s);
  // Tempo: wer bei Auswahl richtig und schnell war, bekommt bis zu 50 dazu
  for (const id of Object.keys(pts)) if (s.shown?.kind === "wahl") pts[id] += s.bonus[id] ?? 0;
  for (const [id, p] of Object.entries(pts)) s.scores[id] = (s.scores[id] ?? 0) + p;
  s.last = { points: pts, key: s.key ?? 0, answers: { ...s.answers } };
  s.phase = "reveal";
  s.startedAt = null;
  if (s.shown) s.log.push(`Frage ${s.idx + 1}: ${s.shown.text}`);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
  void ctx;
}

export const deadlineOf = (s: QState): number | null => (s.phase === "ask" && s.startedAt !== null ? s.startedAt + s.seconds * 1000 : null);

function setup(ctx: GameContext): QState {
  const order = ctx.players.map((p) => p.id);
  const n = Math.max(5, Math.min(Number(ctx.options.count) || 10, 30));
  const own = mergedContent(ctx.content).questions;
  const deck = buildDeck(ctx.options, n, own);
  const s: QState = {
    v: 1, order, phase: "ask", deck, total: deck.length, idx: 0, shown: null, key: null, answers: {}, answered: [], bonus: {}, startedAt: null,
    seconds: Math.max(10, Math.min(Number(ctx.options.seconds) || 20, 90)), scores: Object.fromEntries(order.map((id) => [id, 0])),
    last: null, local: false, log: [],
  };
  if (own.length) s.own = own;
  show(s, ctx);
  return s;
}

function validAnswer(s: QState, v: unknown): v is Answer {
  const k = s.shown?.kind;
  if (k === "wahl") return Number.isInteger(v) && (v as number) >= 0 && (v as number) < 4;
  if (k === "zahl") return typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e13;
  if (k === "folge") return Array.isArray(v) && v.length === 4 && new Set(v).size === 4 && v.every((x) => Number.isInteger(x) && x >= 0 && x < 4);
  return false;
}

function apply(prev: QState, a: QAction, ctx: GameContext): QState {
  const s = structuredClone(prev);
  const me = ctx.actorId;
  const host = me === null || me === ctx.hostId;
  if (me === null) s.local = true;
  switch (a.type) {
    case "answer": {
      if (s.phase !== "ask") throw new GameError("Die Frage ist schon aufgelöst.");
      if (me === null) throw new GameError("An einem Handy ruft ihr die Antworten.");
      // Später dazugekommen: ab jetzt dabei
      if (!s.order.includes(me)) {
        if (!ctx.players.some((p) => p.id === me)) throw new GameError("Du spielst nicht mit.");
        s.order.push(me);
        s.scores[me] = 0;
      }
      if (s.answered.includes(me)) throw new GameError("Du hast schon geantwortet.");
      if (!validAnswer(s, a.value)) throw new GameError("Diese Antwort geht nicht.");
      s.answers[me] = a.value;
      s.answered.push(me);
      // Tempo-Bonus bei Auswahl: sofort festhalten, solange die Zeit läuft
      if (s.shown?.kind === "wahl") {
        const end = deadlineOf(s) ?? ctx.now;
        const left = Math.max(0, Math.min(1, (end - ctx.now) / (s.seconds * 1000)));
        s.bonus[me] = Math.round((POINTS.fast * left) / 5) * 5;
      }
      if (s.order.every((id) => s.answered.includes(id))) reveal(s, ctx);
      return s;
    }
    case "reveal": {
      if (s.phase !== "ask") throw new GameError("Schon aufgelöst.");
      if (!host) throw new GameError("Auflösen kann der Host.");
      reveal(s, ctx);
      return s;
    }
    case "timeUp": {
      const end = deadlineOf(s);
      if (end === null || ctx.now < end - 500) throw new GameError("Die Zeit läuft noch.");
      reveal(s, ctx);
      return s;
    }
    case "award": {
      if (s.phase !== "reveal" || !s.local) throw new GameError("Punkte verteilt die App selbst.");
      if (!Array.isArray(a.ids) || a.ids.some((id) => !s.order.includes(id))) throw new GameError("Wer hatte es?");
      for (const id of new Set(a.ids)) s.scores[id] = (s.scores[id] ?? 0) + POINTS.local;
      s.last = { ...(s.last ?? { key: s.key ?? 0, answers: {} }), points: Object.fromEntries([...new Set(a.ids)].map((id) => [id, POINTS.local])) };
      next(s, ctx);
      return s;
    }
    case "next": {
      if (s.phase !== "reveal") throw new GameError("Erst auflösen.");
      next(s, ctx);
      return s;
    }
    default:
      throw new GameError("Unbekannter Zug.");
  }
}

function next(s: QState, ctx: GameContext) {
  s.idx++;
  if (s.idx >= s.deck.length) { s.phase = "over"; s.shown = null; return; }
  show(s, ctx);
}

export const quiz: GameLogic<QState, QAction> = {
  info: {
    id: "quiz",
    name: "Quiz & Schätzen",
    tagline: "Alle antworten gleichzeitig – wählen, schätzen, ordnen.",
    category: "Party",
    minPlayers: 1,
    maxPlayers: 30,
    duration: "15 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: true,
  settings: [
    { key: "count", label: "Fragen", type: "number", default: 10, min: 5, max: 30, step: 5 },
    { key: "seconds", label: "Zeit je Frage (s)", type: "number", default: 20, min: 10, max: 90, step: 5 },
    {
      key: "level", label: "Fragen für", type: "choice", default: "alle",
      choices: [{ value: "alle", label: "Alle", hint: "Erwachsene und Familien" }, { value: "kinder", label: "Kinder", hint: "leicht, ab 6" }],
    },
    ...KINDS.map((k) => ({ key: `art_${k.id}`, label: k.name, type: "toggle" as const, default: true, group: "Arten", hint: k.hint, chip: true })),
    ...KATEGORIEN.filter((k) => k.stufe !== "kinder").map((k) => ({
      key: `kat_${k.id}`, label: `${k.emoji} ${k.name}`, type: "toggle" as const, default: true, group: "Kategorien", chip: true,
      showIf: (o: Options) => o.level !== "kinder",
    })),
    { key: "own_only", label: "Nur eigene Fragen", hint: "statt der eingebauten Fragen", type: "toggle", default: false, group: "Kartensets" },
  ],
  setup,
  apply,
  actionKind: (a) => (["answer", "reveal", "timeUp", "next", "award"].includes(a.type) ? "player" : null),
  currentPlayerId: () => null,
  isOver: (s) => s.phase === "over",
  results: (s) => {
    const max = Math.max(...s.order.map((id) => s.scores[id] ?? 0));
    return s.order.map((id) => ({ id, won: (s.scores[id] ?? 0) === max, score: s.scores[id] ?? 0 }));
  },
  skipLabel: (s) => (s.phase === "ask" ? "Auflösen" : s.phase === "reveal" ? "Nächste Frage" : null),
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "ask") reveal(s, ctx);
    else if (s.phase === "reveal") next(s, ctx);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    s.order = s.order.filter((x) => x !== id);
    delete s.scores[id];
    delete s.answers[id];
    s.answered = s.answered.filter((x) => x !== id);
    if (s.phase === "ask" && s.order.length && s.order.every((x) => s.answered.includes(x))) reveal(s, ctx);
    return s;
  },
  view(s, viewer) {
    if (s.phase !== "ask") return { ...s, deck: [], ...(s.own ? { own: [] } : {}) };
    // Während der Frage: keine Lösung, nur die eigene Antwort
    const own = viewer && s.answers[viewer] !== undefined ? { [viewer]: s.answers[viewer] } : {};
    return { ...s, deck: [], key: null, answers: own, bonus: {}, ...(s.own ? { own: [] } : {}) };
  },
};

/** Zufällige Antwort (Bots) */
export function randomAnswer(s: QState): Answer | null {
  const k = s.shown?.kind;
  if (k === "wahl") return randomInt(4);
  if (k === "folge") return shuffle([0, 1, 2, 3]);
  if (k === "zahl") return randomInt(1000);
  return null;
}
