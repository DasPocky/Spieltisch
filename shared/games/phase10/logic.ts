/**
 * Phase 10 – zehn Phasen (Drillinge, Folgen, Farben) der Reihe nach schaffen.
 * Zwei Varianten:
 *  - „app“: Karten in der App (online jeder am eigenen Handy, lokal mit Sichtschutz beim Weitergeben).
 *  - „table“: Ihr spielt mit echten Karten, die App führt Phasen und Punkte.
 * Geheim: fremde Hände und der Nachziehstapel. Ausgelegte Gruppen sehen alle.
 */
import { shuffle } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Player } from "../../platform/types";

export type P10Color = "r" | "b" | "g" | "y";
/** "r-7" … "y-12", "W" (Joker), "S" (Aussetzen) */
export type P10Card = string;
export type Mode = "app" | "table";
export type Kind = "set" | "run" | "color";
export interface Need { kind: Kind; n: number }
export interface Group { kind: Kind; cards: P10Card[]; value?: number; color?: P10Color; lo?: number; hi?: number }

export const COLORS: P10Color[] = ["r", "b", "g", "y"];
export const COLOR_NAME: Record<P10Color, string> = { r: "Rot", b: "Blau", g: "Grün", y: "Gelb" };
export const PHASES: Need[][] = [
  [{ kind: "set", n: 3 }, { kind: "set", n: 3 }],
  [{ kind: "set", n: 3 }, { kind: "run", n: 4 }],
  [{ kind: "set", n: 4 }, { kind: "run", n: 4 }],
  [{ kind: "run", n: 7 }],
  [{ kind: "run", n: 8 }],
  [{ kind: "run", n: 9 }],
  [{ kind: "set", n: 4 }, { kind: "set", n: 4 }],
  [{ kind: "color", n: 7 }],
  [{ kind: "set", n: 5 }, { kind: "set", n: 2 }],
  [{ kind: "set", n: 5 }, { kind: "set", n: 3 }],
];
export const needLabel = (x: Need) => (x.kind === "set" ? `${x.n} Gleiche` : x.kind === "run" ? `Folge aus ${x.n}` : `${x.n} einer Farbe`);
export const phaseLabel = (i: number) => (PHASES[i - 1] ?? []).map(needLabel).join(" + ");

export interface P10State {
  v: 1;
  mode: Mode;
  round: number;
  /** aktuelle Phase je Spieler (1–10, 11 = alle geschafft) */
  phase: Record<string, number>;
  scores: Record<string, number>;
  step: "draw" | "play" | "roundEnd" | "over" | "enter";
  hands: Record<string, P10Card[]>;
  counts: Record<string, number>;
  pile: P10Card[];
  pileCount: number;
  discard: P10Card[];
  /** ausgelegte Gruppen je Spieler (nur wer seine Phase liegen hat) */
  laid: Record<string, Group[]>;
  skips: Record<string, number>;
  curId: string | null;
  dealer: string | null;
  lastRound: { points: Record<string, number>; done: string[] } | null;
  /** letzte Phase (10, bei der kurzen Partie 5) */
  goal: number;
  n: number;
  log: string[];
  // Punkteblock
  entries: Record<string, number | null>;
  done: Record<string, boolean>;
}

export type P10Action =
  | { type: "draw"; from: "pile" | "discard" }
  | { type: "lay"; groups: P10Card[][] }
  | { type: "hit"; card: P10Card; owner: string; g: number; end?: "lo" | "hi" }
  | { type: "discard"; card: P10Card; skip?: string }
  | { type: "nextRound" }
  | { type: "enter"; player?: string; points: number | null }
  | { type: "setDone"; player: string; done: boolean }
  | { type: "finishRound" };

const MAX_LOG = 50;
export const isWild = (c: P10Card) => c === "W";
export const isSkip = (c: P10Card) => c === "S";
export const valueOf = (c: P10Card) => (c.length > 1 ? Number(c.slice(2)) : 0);
export const colorOf = (c: P10Card) => (c.length > 1 ? (c[0] as P10Color) : null);
export const cardLabel = (c: P10Card) => (isWild(c) ? "Joker" : isSkip(c) ? "Aussetzen" : `${COLOR_NAME[colorOf(c)!]} ${valueOf(c)}`);
/** Strafpunkte: 1–9 = 5, 10–12 = 10, Aussetzen 15, Joker 25 */
export const cardPoints = (c: P10Card) => (isWild(c) ? 25 : isSkip(c) ? 15 : valueOf(c) >= 10 ? 10 : 5);

/** 108 Karten: je Farbe zweimal 1–12, 8 Joker, 4 Aussetzen */
export function buildDeck(): P10Card[] {
  const d: P10Card[] = [];
  for (const c of COLORS) for (let v = 1; v <= 12; v++) d.push(`${c}-${v}`, `${c}-${v}`);
  for (let i = 0; i < 8; i++) d.push("W");
  for (let i = 0; i < 4; i++) d.push("S");
  return d;
}
const ORDER = (c: P10Card) => (isWild(c) ? 200 : isSkip(c) ? 300 : valueOf(c) * 4 + COLORS.indexOf(colorOf(c)!));
export const sortHand = (h: P10Card[]) => h.slice().sort((a, b) => ORDER(a) - ORDER(b));

/** Prüft eine Gruppe gegen die Anforderung; liefert die gelegte Gruppe oder null */
export function makeGroup(cards: P10Card[], need: Need): Group | null {
  if (cards.length < need.n || cards.some(isSkip)) return null;
  const nat = cards.filter((c) => !isWild(c));
  if (!nat.length) return null;
  if (need.kind === "set") {
    const v = valueOf(nat[0]);
    return nat.every((c) => valueOf(c) === v) ? { kind: "set", cards, value: v } : null;
  }
  if (need.kind === "color") {
    const col = colorOf(nat[0])!;
    return nat.every((c) => colorOf(c) === col) ? { kind: "color", cards, color: col } : null;
  }
  const vals = nat.map(valueOf).sort((a, b) => a - b);
  if (new Set(vals).size !== vals.length || cards.length > 12) return null;
  const min = vals[0], max = vals[vals.length - 1];
  if (max - min + 1 > cards.length) return null;
  // Joker zuerst nach oben anlegen, was nicht passt, nach unten
  const hi = Math.min(12, min + cards.length - 1);
  const lo = hi - cards.length + 1;
  if (lo < 1 || lo > min) return null;
  return { kind: "run", cards, lo, hi };
}

/** Karte an eine liegende Gruppe anlegen? Liefert die neue Gruppe oder null */
export function extend(g: Group, card: P10Card, end?: "lo" | "hi"): Group | null {
  if (isSkip(card)) return null;
  const cards = [...g.cards, card];
  if (g.kind === "set") return isWild(card) || valueOf(card) === g.value ? { ...g, cards } : null;
  if (g.kind === "color") return isWild(card) || colorOf(card) === g.color ? { ...g, cards } : null;
  const lo = g.lo!, hi = g.hi!;
  if (isWild(card)) {
    if ((end ?? (hi < 12 ? "hi" : "lo")) === "hi") return hi < 12 ? { ...g, cards, hi: hi + 1 } : null;
    return lo > 1 ? { ...g, cards, lo: lo - 1 } : null;
  }
  const v = valueOf(card);
  if (v === hi + 1) return { ...g, cards, hi: v };
  if (v === lo - 1) return { ...g, cards, lo: v };
  return null;
}

/** Sucht in der Hand eine Möglichkeit, die Phase auszulegen (für „Phase finden“ und die Simulation) */
export function findPhase(hand: P10Card[], phase: number): P10Card[][] | null {
  const needs = PHASES[phase - 1];
  if (!needs) return null;
  const go = (i: number, rest: P10Card[]): P10Card[][] | null => {
    if (i === needs.length) return [];
    for (const g of candidates(rest, needs[i])) {
      const left = rest.slice();
      for (const c of g) left.splice(left.indexOf(c), 1);
      const more = go(i + 1, left);
      if (more) return [g, ...more];
    }
    return null;
  };
  return go(0, hand);
}

function candidates(hand: P10Card[], need: Need): P10Card[][] {
  const wilds = hand.filter(isWild);
  const out: P10Card[][] = [];
  const nat = hand.filter((c) => !isWild(c) && !isSkip(c));
  const take = (xs: P10Card[]) => {
    const k = Math.min(xs.length, need.n);
    if (k >= 1 && need.n - k <= wilds.length) out.push([...xs.slice(0, k), ...wilds.slice(0, need.n - k)]);
  };
  if (need.kind === "set") for (let v = 1; v <= 12; v++) take(nat.filter((c) => valueOf(c) === v));
  if (need.kind === "color") for (const col of COLORS) take(nat.filter((c) => colorOf(c) === col));
  if (need.kind === "run") {
    for (let lo = 1; lo + need.n - 1 <= 12; lo++) {
      const g: P10Card[] = [];
      let w = 0;
      for (let v = lo; v < lo + need.n; v++) {
        const c = nat.find((x) => valueOf(x) === v);
        if (c) g.push(c); else { if (w >= wilds.length) break; g.push(wilds[w++]); }
      }
      if (g.length === need.n && g.some((c) => !isWild(c))) out.push(g);
    }
  }
  // wenige Joker zuerst
  return out.sort((a, b) => a.filter(isWild).length - b.filter(isWild).length);
}

const nameOf = (ctx: GameContext, id: string | null) => ctx.players.find((p) => p.id === id)?.name ?? "?";

function sync(s: P10State) {
  s.counts = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length]));
  s.pileCount = s.pile.length;
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

function refill(s: P10State) {
  if (s.pile.length || s.discard.length <= 1) return;
  s.pile = shuffle(s.discard.splice(0, s.discard.length - 1));
  s.log.push("Ablage wird neu gemischt");
}

function deal(s: P10State, ctx: GameContext) {
  s.pile = shuffle(buildDeck());
  s.hands = {}; s.laid = {}; s.skips = {};
  for (const p of ctx.players) s.hands[p.id] = sortHand(s.pile.splice(s.pile.length - 10, 10));
  let first = s.pile.pop()!;
  while (isSkip(first)) { s.pile.unshift(first); first = s.pile.pop()!; }
  s.discard = [first];
  s.dealer = s.dealer ? nextPlayerId(ctx.players, s.dealer) : ctx.players[ctx.players.length - 1]?.id ?? null;
  s.curId = nextPlayerId(ctx.players, s.dealer);
  s.step = "draw";
}

function setup(ctx: GameContext): P10State {
  const mode: Mode = ctx.options.mode === "table" ? "table" : "app";
  const s: P10State = {
    v: 1, mode, round: 1, phase: Object.fromEntries(ctx.players.map((p) => [p.id, 1])), scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    step: "draw", hands: {}, counts: {}, pile: [], pileCount: 0, discard: [], laid: {}, skips: {}, curId: null, dealer: null,
    lastRound: null, n: 0, log: [], entries: {}, done: {}, goal: ctx.options.goal === "5" ? 5 : 10,
  };
  if (mode === "table") { s.step = "enter"; resetEntries(s, ctx); }
  else deal(s, ctx);
  sync(s);
  return s;
}
function resetEntries(s: P10State, ctx: GameContext) {
  s.entries = Object.fromEntries(ctx.players.map((p) => [p.id, null]));
  s.done = Object.fromEntries(ctx.players.map((p) => [p.id, false]));
}

/** Wen darf man aussetzen lassen? Alle anderen ohne offenes Aussetzen, in Spielreihenfolge ab dem Nächsten */
export function skipTargets(s: P10State, players: Player[], me: string): string[] {
  const out: string[] = [];
  let id = nextPlayerId(players, me);
  for (let i = 0; i < players.length && id && id !== me; i++) {
    if (!((s.skips[id] ?? 0) > 0) && id in s.counts) out.push(id);
    id = nextPlayerId(players, id);
  }
  return out;
}

/** Nächster Spieler, Aussetzer werden übersprungen */
function advance(s: P10State, ctx: GameContext) {
  let id = nextPlayerId(ctx.players, s.curId);
  for (let i = 0; i < ctx.players.length && id && (s.skips[id] ?? 0) > 0; i++) {
    s.skips[id]--;
    s.log.push(`${nameOf(ctx, id)} setzt aus`);
    id = nextPlayerId(ctx.players, id);
  }
  s.curId = id;
  s.step = "draw";
  s.n++;
}

/** Rundenende: wer seine Phase liegen hat, rückt vor; Handkarten zählen als Strafpunkte */
function endRound(s: P10State, ctx: GameContext, points: Record<string, number>, done: string[]) {
  for (const p of ctx.players) {
    s.scores[p.id] = (s.scores[p.id] ?? 0) + (points[p.id] ?? 0);
    if (done.includes(p.id)) s.phase[p.id] = Math.min(s.goal + 1, (s.phase[p.id] ?? 1) + 1);
  }
  s.lastRound = { points, done };
  s.log.push(`Runde ${s.round} vorbei`);
  s.step = ctx.players.some((p) => s.phase[p.id] > s.goal) ? "over" : "roundEnd";
}
function finishAppRound(s: P10State, ctx: GameContext, winner: string) {
  s.log.push(`${nameOf(ctx, winner)} ist raus`);
  const points = Object.fromEntries(ctx.players.map((p) => [p.id, (s.hands[p.id] ?? []).reduce((t, c) => t + cardPoints(c), 0)]));
  endRound(s, ctx, points, ctx.players.filter((p) => s.laid[p.id]).map((p) => p.id));
}

/** Alle liegen und jede Gruppe ist eine volle Folge 1–12: niemand kann mehr anlegen oder rauskommen */
function deadEnd(s: P10State, ctx: GameContext): boolean {
  return ctx.players.every((p) => s.laid[p.id]) && Object.values(s.laid).flat().every((g) => g.kind === "run" && g.lo === 1 && g.hi === 12);
}
function checkDeadEnd(s: P10State, ctx: GameContext) {
  if ((s.step !== "draw" && s.step !== "play") || !deadEnd(s, ctx)) return;
  s.log.push("Niemand kann mehr anlegen – Runde vorbei");
  const points = Object.fromEntries(ctx.players.map((p) => [p.id, (s.hands[p.id] ?? []).reduce((t, c) => t + cardPoints(c), 0)]));
  endRound(s, ctx, points, ctx.players.map((p) => p.id));
}

function removeCards(hand: P10Card[], cards: P10Card[]): boolean {
  const h = hand.slice();
  for (const c of cards) { const i = h.indexOf(c); if (i < 0) return false; h.splice(i, 1); }
  hand.splice(0, hand.length, ...h);
  return true;
}

function apply(prev: P10State, a: P10Action, ctx: GameContext): P10State {
  const s = structuredClone(prev);
  const actor = ctx.actorId;
  const isHost = actor === null || actor === ctx.hostId;
  if (s.mode === "table") return applyTable(s, a, ctx, isHost);

  if (a.type === "nextRound") {
    if (s.step !== "roundEnd") throw new GameError("Die Runde läuft noch.");
    s.round++;
    deal(s, ctx);
    sync(s);
    return s;
  }
  if (s.step !== "draw" && s.step !== "play") throw new GameError("Die Runde ist vorbei.");
  const me = s.curId;
  if (!me || !s.hands[me]) throw new GameError("Es ist niemand am Zug.");
  const hand = s.hands[me];

  if (a.type === "draw") {
    if (s.step !== "draw") throw new GameError("Du hast schon gezogen.");
    if (a.from === "discard") {
      const t = s.discard[s.discard.length - 1];
      if (!t) throw new GameError("Die Ablage ist leer.");
      if (isSkip(t)) throw new GameError("Eine Aussetzen-Karte darf man nicht aufnehmen.");
      hand.push(s.discard.pop()!);
      s.log.push(`${nameOf(ctx, me)} nimmt ${cardLabel(t)} von der Ablage`);
    } else {
      refill(s);
      const c = s.pile.pop();
      if (c) hand.push(c);
      s.log.push(`${nameOf(ctx, me)} zieht vom Stapel`);
    }
    s.hands[me] = sortHand(hand);
    s.step = "play";
    sync(s);
    return s;
  }
  if (s.step !== "play") throw new GameError("Erst ziehen.");

  switch (a.type) {
    case "lay": {
      if (s.laid[me]) throw new GameError("Deine Phase liegt schon.");
      const needs = PHASES[(s.phase[me] ?? 1) - 1];
      if (!Array.isArray(a.groups) || a.groups.length !== needs.length) throw new GameError(`Phase ${s.phase[me]}: ${phaseLabel(s.phase[me])}.`);
      const groups: Group[] = [];
      for (let i = 0; i < needs.length; i++) {
        const g = Array.isArray(a.groups[i]) ? makeGroup(a.groups[i].map(String), needs[i]) : null;
        if (!g) throw new GameError(`Gruppe ${i + 1} passt nicht: ${needLabel(needs[i])}.`);
        groups.push(g);
      }
      if (!removeCards(hand, a.groups.flat())) throw new GameError("Diese Karten hast du nicht.");
      s.laid[me] = groups;
      s.log.push(`${nameOf(ctx, me)} legt Phase ${s.phase[me]} aus`);
      if (!hand.length) finishAppRound(s, ctx, me);
      else checkDeadEnd(s, ctx);
      sync(s);
      return s;
    }
    case "hit": {
      if (!s.laid[me]) throw new GameError("Anlegen geht erst, wenn deine Phase liegt.");
      const g = s.laid[a.owner]?.[a.g];
      if (!g) throw new GameError("Diese Gruppe gibt es nicht.");
      if (!hand.includes(a.card)) throw new GameError("Diese Karte hast du nicht.");
      const ng = extend(g, a.card, a.end);
      if (!ng) throw new GameError("Die Karte passt da nicht.");
      removeCards(hand, [a.card]);
      s.laid[a.owner][a.g] = ng;
      s.log.push(`${nameOf(ctx, me)} legt ${cardLabel(a.card)} an`);
      if (!hand.length) finishAppRound(s, ctx, me);
      else checkDeadEnd(s, ctx);
      sync(s);
      return s;
    }
    case "discard": {
      if (!removeCards(hand, [a.card])) throw new GameError("Diese Karte hast du nicht.");
      s.discard.push(a.card);
      if (!isSkip(a.card)) s.log.push(`${nameOf(ctx, me)} legt ${cardLabel(a.card)} ab`);
      if (isSkip(a.card)) {
        // Wer schon aussetzen muss, bekommt kein zweites Aussetzen (höchstens eins vor sich)
        const free = skipTargets(s, ctx.players, me);
        if (a.skip && a.skip !== me && ctx.players.some((p) => p.id === a.skip) && !free.includes(a.skip)) throw new GameError(`${nameOf(ctx, a.skip)} setzt schon aus.`);
        const target = a.skip && free.includes(a.skip) ? a.skip : free[0];
        if (target) { s.skips[target] = 1; s.log.push(`${nameOf(ctx, me)} lässt ${nameOf(ctx, target)} aussetzen`); }
        else s.log.push(`${nameOf(ctx, me)} legt Aussetzen ab – alle anderen setzen schon aus`);
      }
      if (!hand.length) finishAppRound(s, ctx, me);
      else advance(s, ctx);
      sync(s);
      return s;
    }
    default:
      throw new GameError("Das geht nur mit echten Karten.");
  }
}

/** Punkteblock: Strafpunkte eintragen, abhaken wer seine Phase geschafft hat */
function applyTable(s: P10State, a: P10Action, ctx: GameContext, isHost: boolean): P10State {
  const actor = ctx.actorId;
  if (s.step === "over") throw new GameError("Die Partie ist vorbei.");
  const check = (who: string | undefined) => {
    if (!who || !ctx.players.some((p) => p.id === who)) throw new GameError("Diesen Spieler gibt es nicht.");
    if (actor !== null && who !== actor && !isHost) throw new GameError("Trag nur deine eigenen Punkte ein.");
    return who;
  };
  switch (a.type) {
    case "enter": {
      const who = check(a.player ?? actor ?? undefined);
      if (a.points !== null && (!Number.isInteger(a.points) || a.points < 0 || a.points > 500 || a.points % 5 !== 0)) throw new GameError("Punkte in Fünferschritten, 0 bis 500.");
      s.entries[who] = a.points;
      return s;
    }
    case "setDone": {
      const who = check(a.player);
      s.done[who] = !!a.done;
      return s;
    }
    case "finishRound": {
      if (!isHost) throw new GameError("Die Runde schließt der Host ab.");
      const missing = ctx.players.filter((p) => s.entries[p.id] === null || s.entries[p.id] === undefined);
      if (missing.length) throw new GameError(`Es fehlen noch Punkte: ${missing.map((p) => p.name).join(", ")}.`);
      endRound(s, ctx, Object.fromEntries(ctx.players.map((p) => [p.id, s.entries[p.id] ?? 0])), ctx.players.filter((p) => s.done[p.id]).map((p) => p.id));
      if ((s.step as P10State["step"]) !== "over") { s.step = "enter"; s.round++; resetEntries(s, ctx); }
      return s;
    }
    default:
      throw new GameError("Mit echten Karten tragt ihr nur Phasen und Punkte ein.");
  }
}

/** Sieger: wer die weiteste Phase hat, bei Gleichstand die wenigsten Punkte */
export function leaders(s: P10State, players: Player[]): string[] {
  const top = Math.max(...players.map((p) => s.phase[p.id] ?? 1));
  const best = players.filter((p) => (s.phase[p.id] ?? 1) === top);
  const low = Math.min(...best.map((p) => s.scores[p.id] ?? 0));
  return best.filter((p) => (s.scores[p.id] ?? 0) === low).map((p) => p.id);
}

export const phase10: GameLogic<P10State, P10Action> = {
  info: {
    id: "phase10",
    name: "Phase 10",
    tagline: "Zehn Phasen aus Drillingen, Folgen und Farben – wer schafft sie zuerst?",
    category: "Karten",
    minPlayers: 2,
    maxPlayers: 6,
    duration: "45–90 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  settings: [
    {
      key: "mode", label: "Karten", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "App mischt und verteilt" },
        { value: "table", label: "Echte Karten", hint: "App führt Phasen und Punkte" },
      ],
    },
    {
      key: "goal", label: "Länge", type: "choice", default: "10",
      choices: [
        { value: "10", label: "Alle 10 Phasen" },
        { value: "5", label: "Kurz", hint: "nur Phase 1–5" },
      ],
    },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "draw" || a.type === "lay" || a.type === "hit" || a.type === "discard" ? "turn" : "player"),
  currentPlayerId: (s) => (s.step === "draw" || s.step === "play" ? s.curId : null),
  isOver: (s) => s.step === "over",
  results: (s, ctx) => {
    const win = leaders(s, ctx.players);
    return ctx.players.map((p) => ({ id: p.id, won: win.includes(p.id), score: s.scores[p.id] ?? 0 }));
  },
  skipLabel: (s, ctx) => ((s.step === "draw" || s.step === "play") && s.curId ? `Zug von ${nameOf(ctx, s.curId)} überspringen` : null),
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if ((s.step !== "draw" && s.step !== "play") || !s.curId) return s;
    s.log.push(`Zug von ${nameOf(ctx, s.curId)} übersprungen`);
    advance(s, ctx);
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (s.hands[id]) s.pile.unshift(...s.hands[id]);
    // Ausgelegte Karten bleiben liegen (andere haben evtl. angelegt) – sie verlassen das Spiel
    delete s.hands[id]; delete s.skips[id];
    delete s.entries[id]; delete s.done[id];
    if (s.curId === id && (s.step === "draw" || s.step === "play")) advance(s, ctx);
    if (s.dealer === id) s.dealer = null;
    const rest = ctx.players.filter((p) => p.id !== id);
    if ((s.step === "draw" || s.step === "play") && rest.length === 1) { s.step = "over"; }
    sync(s);
    return s;
  },
  view: (s, viewer) => (viewer === null ? s : { ...s, pile: [], hands: viewer in s.hands ? { [viewer]: s.hands[viewer] } : {} }),
};
