/**
 * Flip 7 – Drück-dein-Glück-Kartenspiel. Klassisch oder „Voll fies“ (angelehnt an „Flip 7: Voll fies!“).
 * Alle Karten liegen offen, der Server zieht. Reihum: noch eine Karte („Hit“) oder aufhören („Stay“).
 * Eine doppelte Zahl heißt: raus ohne Punkte. Sieben verschiedene Zahlen: +15 und die Runde endet sofort.
 */
import { shuffle } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

/**
 * Kartencodes: "n:5" Zahl, "n:13L" Glücks-13, "n:7U" Unglücks-7,
 * "a:freeze" | "a:flip3" | "a:second" | "a:flip4" | "a:one" | "a:swap" | "a:steal" | "a:discard" Aktionen,
 * "m:+4" | "m:x2" | "m:-2" | "m:/2" Modifikatoren.
 */
export type F7Card = string;

export type Variant = "classic" | "fies";

export interface Line {
  nums: F7Card[];
  mods: F7Card[];
  second: boolean;
  status: "active" | "stayed" | "bust" | "frozen" | "done";
  flip7: boolean;
}

export type Pending =
  /** Wer die Karte gezogen hat, wählt ein Ziel */
  | { kind: "target"; card: F7Card; by: string }
  /** Tauschen: zwei offene Zahlenkarten wählen */
  | { kind: "swap"; card: F7Card; by: string }
  /** Klauen / Abwerfen: eine offene Karte wählen */
  | { kind: "pickCard"; card: F7Card; by: string };

export interface F7State {
  v: 1;
  variant: Variant;
  target: number;
  deck: F7Card[];
  deckCount: number;
  discard: F7Card[];
  scores: Record<string, number>;
  round: number;
  dealerId: string | null;
  lines: Record<string, Line>;
  /** Wer ist beim Austeilen noch dran (erste Karte)? */
  dealQueue: string[];
  curId: string | null;
  pending: Pending | null;
  /** Aktionen, die nach „Flip 3/4“ noch ausgeführt werden */
  queued: { card: F7Card; by: string }[];
  lastRound: { round: number; points: Record<string, number>; flip7: string | null } | null;
  winners: string[];
  log: string[];
  n: number;
}

export type F7Action =
  | { type: "hit" }
  | { type: "stay" }
  | { type: "target"; target: string }
  | { type: "pick"; owner: string; index: number }
  | { type: "swap"; a: { owner: string; index: number }; b: { owner: string; index: number } };

const MAX_LOG = 40;
const isNum = (c: F7Card) => c.startsWith("n:");
const isAction = (c: F7Card) => c.startsWith("a:");
const isMod = (c: F7Card) => c.startsWith("m:");
/** Zahlenwert einer Zahlenkarte */
export const numValue = (c: F7Card) => parseInt(c.slice(2), 10);

export const CARD_NAME: Record<string, string> = {
  "a:freeze": "Einfrieren", "a:flip3": "Flip 3", "a:second": "Zweite Chance", "a:flip4": "Flip 4", "a:one": "Nur noch eine!",
  "a:swap": "Tauschen", "a:steal": "Klauen", "a:discard": "Abwerfen", "n:13L": "Glücks-13", "n:7U": "Unglücks-7",
};
export const cardLabel = (c: F7Card) => CARD_NAME[c] ?? (isMod(c) ? c.slice(2).replace("x", "×").replace("/", "÷") : String(numValue(c)));

export function buildDeck(variant: Variant): F7Card[] {
  const d: F7Card[] = [];
  const top = variant === "fies" ? 13 : 12;
  for (let n = 1; n <= top; n++) for (let i = 0; i < n; i++) d.push(`n:${n}`);
  d.push("n:0");
  if (variant === "classic") {
    for (const a of ["freeze", "flip3", "second"]) for (let i = 0; i < 3; i++) d.push(`a:${a}`);
    for (const m of ["+2", "+4", "+6", "+8", "+10", "x2"]) d.push(`m:${m}`);
  } else {
    d.push("n:13L", "n:7U");
    for (const a of ["one", "flip4", "swap", "steal", "discard"]) for (let i = 0; i < 2; i++) d.push(`a:${a}`);
    for (const m of ["-2", "-4", "-6", "-8", "/2", "+4", "+8", "x2"]) d.push(`m:${m}`);
  }
  return d;
}

const variantOf = (o: Options): Variant => (o.variant === "fies" ? "fies" : "classic");

/** Verschiedene Zahlen in der Reihe (Glücks-13 zählt wie eine 13) */
function uniqueNums(line: Line): Set<number> {
  return new Set(line.nums.map(numValue));
}

/** Punkte der Reihe am Rundenende */
export function linePoints(line: Line): number {
  if (line.status === "bust") return 0;
  let sum = line.nums.reduce((t, c) => t + numValue(c), 0);
  if (line.mods.includes("m:x2")) sum *= 2;
  if (line.mods.includes("m:/2")) sum = Math.floor(sum / 2);
  for (const m of line.mods) if (/^m:[+-]\d+$/.test(m)) sum += parseInt(m.slice(2), 10);
  if (line.flip7) sum += 15;
  return Math.max(0, sum);
}

const nameOf = (ctx: GameContext, id: string) => ctx.players.find((p) => p.id === id)?.name ?? "?";
const log = (s: F7State, msg: string) => { s.log.push(msg); if (s.log.length > MAX_LOG) s.log.shift(); };
const activeIds = (s: F7State, players: Player[]) => players.map((p) => p.id).filter((id) => s.lines[id]?.status === "active");

function draw(s: F7State): F7Card | null {
  if (!s.deck.length) {
    s.deck = shuffle(s.discard);
    s.discard = [];
  }
  return s.deck.pop() ?? null;
}

function freshLine(): Line {
  return { nums: [], mods: [], second: false, status: "active", flip7: false };
}

function startRound(s: F7State, players: Player[]) {
  // Karten vom Tisch auf den Ablagestapel
  for (const l of Object.values(s.lines)) s.discard.push(...l.nums, ...l.mods, ...(l.second ? ["a:second"] : []));
  s.round++;
  s.dealerId = s.round === 1 ? players[players.length - 1]?.id ?? null : nextPlayerId(players, s.dealerId);
  s.lines = Object.fromEntries(players.map((p) => [p.id, freshLine()]));
  const order: string[] = [];
  let id = s.dealerId;
  for (let i = 0; i < players.length; i++) { id = nextPlayerId(players, id); if (id) order.push(id); }
  s.dealQueue = order;
  s.curId = null;
  // Offene oder zurückgelegte Aktionen (z. B. nach Flip 7 mitten in Flip 4) kommen auf den Ablagestapel
  if (s.pending) s.discard.push(s.pending.card);
  s.discard.push(...s.queued.map((q) => q.card));
  s.pending = null;
  s.queued = [];
}

function endRound(s: F7State, ctx: GameContext, flip7: string | null) {
  const points: Record<string, number> = {};
  for (const p of ctx.players) {
    const line = s.lines[p.id];
    if (!line) continue;
    points[p.id] = linePoints(line);
    s.scores[p.id] = (s.scores[p.id] ?? 0) + points[p.id];
  }
  s.lastRound = { round: s.round, points, flip7 };
  log(s, `Runde ${s.round} vorbei`);
  const best = Math.max(...ctx.players.map((p) => s.scores[p.id] ?? 0));
  if (best >= s.target) {
    s.winners = ctx.players.filter((p) => (s.scores[p.id] ?? 0) === best).map((p) => p.id);
    s.curId = null;
    s.pending = null;
    return;
  }
  startRound(s, ctx.players);
  advance(s, ctx);
}

/**
 * Nimmt eine Karte in die Reihe von `id` auf. Gibt false zurück, wenn die Runde dadurch endet (Flip 7).
 * `forced`: während Flip 3/4 – Aktionen werden zurückgelegt und danach ausgeführt.
 */
function receive(s: F7State, ctx: GameContext, id: string, card: F7Card, forced: boolean): boolean {
  const line = s.lines[id];
  if (isNum(card)) {
    const v = numValue(card);
    const has = line.nums.some((c) => numValue(c) === v);
    const lucky = v === 13 && (card === "n:13L" || line.nums.includes("n:13L")) && line.nums.filter((c) => numValue(c) === 13).length === 1;
    if (card === "n:7U") {
      // Unglücks-7: alles andere fliegt weg
      s.discard.push(...line.nums, ...line.mods);
      line.nums = [card];
      line.mods = [];
      log(s, `${nameOf(ctx, id)}: Unglücks-7 – alles andere ist weg`);
    } else if (has && !lucky) {
      if (line.second) {
        line.second = false;
        s.discard.push(card, "a:second");
        log(s, `${nameOf(ctx, id)}: doppelte ${v} – die zweite Chance rettet`);
        return true;
      }
      line.nums.push(card);
      line.status = "bust";
      log(s, `${nameOf(ctx, id)}: doppelte ${v} – raus!`);
      return true;
    } else line.nums.push(card);
    if (uniqueNums(line).size >= 7) {
      line.flip7 = true;
      log(s, `${nameOf(ctx, id)}: FLIP 7! +15`);
      endRound(s, ctx, id);
      return false;
    }
    return true;
  }
  if (isMod(card)) {
    // Voll fies: Minus und ÷2 bekommt ein anderer Spieler
    if (s.variant === "fies" && (card.startsWith("m:-") || card === "m:/2")) {
      const others = activeIds(s, ctx.players).filter((x) => x !== id);
      if (others.length) { s.pending = { kind: "target", card, by: id }; return true; }
    }
    line.mods.push(card);
    return true;
  }
  if (card === "a:second") {
    if (!line.second) { line.second = true; return true; }
    const others = activeIds(s, ctx.players).filter((x) => x !== id && !s.lines[x].second);
    if (others.length) s.pending = { kind: "target", card, by: id };
    else s.discard.push(card);
    return true;
  }
  if (isAction(card)) {
    if (forced) { s.queued.push({ card, by: id }); return true; }
    startAction(s, ctx, id, card);
    return true;
  }
  return true;
}

/** Eine Aktionskarte will ausgeführt werden: Wer sie gezogen hat, wählt das Ziel */
function startAction(s: F7State, ctx: GameContext, by: string, card: F7Card) {
  // Klauen geht nur bei anderen, Abwerfen bei allen – liegt nichts Passendes offen, verfällt die Karte
  const face = Object.entries(s.lines).some(([id, l]) => (card !== "a:steal" || id !== by) && (l.nums.length || l.mods.length));
  if (card === "a:swap") {
    const withNums = Object.keys(s.lines).filter((id) => s.lines[id].nums.length);
    if (withNums.length >= 2) s.pending = { kind: "swap", card, by }; else s.discard.push(card);
  } else if (card === "a:steal" || card === "a:discard") {
    if (face) s.pending = { kind: "pickCard", card, by }; else s.discard.push(card);
  } else if (activeIds(s, ctx.players).length) {
    s.pending = { kind: "target", card, by };
  } else s.discard.push(card);
}

/** Erzwungenes Ziehen (Flip 3/4, Nur noch eine) */
function forceDraw(s: F7State, ctx: GameContext, id: string, count: number): boolean {
  for (let i = 0; i < count; i++) {
    if (s.lines[id].status !== "active") break;
    const c = draw(s);
    if (!c) break;
    if (!receive(s, ctx, id, c, true)) return false;
    if (s.pending) break; // z. B. Minus-Karte an andere verteilen
  }
  return true;
}

/** Läuft von selbst weiter, bis jemand etwas entscheiden muss */
function advance(s: F7State, ctx: GameContext) {
  for (let guard = 0; guard < 500; guard++) {
    if (s.winners.length || s.pending) return;
    if (s.queued.length) {
      const q = s.queued.shift()!;
      if (s.lines[q.by]?.status === "active" || q.card === "a:swap" || q.card === "a:steal" || q.card === "a:discard") startAction(s, ctx, q.by, q.card);
      else s.discard.push(q.card);
      continue;
    }
    if (s.dealQueue.length) {
      const id = s.dealQueue.shift()!;
      if (s.lines[id]?.status !== "active") continue;
      const c = draw(s);
      if (!c) { s.dealQueue = []; continue; }
      if (!receive(s, ctx, id, c, false)) return;
      continue;
    }
    const active = activeIds(s, ctx.players);
    if (!active.length) { endRound(s, ctx, null); return; }
    if (!s.curId || !active.includes(s.curId)) {
      // Nächster aktiver Spieler (links vom Geber bzw. vom letzten)
      let id = s.curId ?? s.dealerId;
      for (let i = 0; i < ctx.players.length; i++) { id = nextPlayerId(ctx.players, id); if (id && active.includes(id)) break; }
      s.curId = id;
    }
    return;
  }
}

/** Nach einem Zug: der Nächste ist dran */
function passTurn(s: F7State, ctx: GameContext) {
  const active = activeIds(s, ctx.players);
  if (!active.length) { s.curId = null; return; }
  let id = s.curId;
  for (let i = 0; i < ctx.players.length; i++) { id = nextPlayerId(ctx.players, id); if (id && active.includes(id)) { s.curId = id; return; } }
}

function setup(ctx: GameContext): F7State {
  const variant = variantOf(ctx.options);
  const s: F7State = {
    v: 1, variant, target: Number(ctx.options.target) || 200, deck: shuffle(buildDeck(variant)), deckCount: 0, discard: [],
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])), round: 0, dealerId: null, lines: {}, dealQueue: [],
    curId: null, pending: null, queued: [], lastRound: null, winners: [], log: [], n: 0,
  };
  startRound(s, ctx.players);
  advance(s, ctx);
  s.deckCount = s.deck.length;
  return s;
}

function apply(prev: F7State, a: F7Action, ctx: GameContext): F7State {
  const s = structuredClone(prev);
  s.n++;
  const me = s.pending ? s.pending.by : s.curId;
  if (!me) throw new GameError("Gerade ist niemand dran.");
  const valid = (owner: string, index: number, numsOnly: boolean) => {
    const l = s.lines[owner];
    if (!l || !Number.isInteger(index) || index < 0) return false;
    return numsOnly ? index < l.nums.length : index < l.nums.length + l.mods.length;
  };

  switch (a.type) {
    case "hit":
    case "stay": {
      if (s.pending) throw new GameError("Erst die Aktionskarte ausführen.");
      const line = s.lines[me];
      if (a.type === "stay") {
        line.status = "stayed";
        log(s, `${nameOf(ctx, me)} hört auf (${linePoints(line)} Punkte)`);
        passTurn(s, ctx);
        advance(s, ctx);
      } else {
        const c = draw(s);
        if (!c) throw new GameError("Keine Karten mehr.");
        const goOn = receive(s, ctx, me, c, false);
        if (goOn) {
          if (!s.pending) passTurn(s, ctx);
          advance(s, ctx);
        }
      }
      break;
    }
    case "target": {
      const p = s.pending;
      if (!p || p.kind !== "target") throw new GameError("Gerade gibt es kein Ziel zu wählen.");
      const t = a.target;
      const tl = s.lines[t];
      if (!tl) throw new GameError("Diese Person spielt nicht mit.");
      const card = p.card;
      if (card === "a:second") {
        if (t === p.by || tl.status !== "active" || tl.second) throw new GameError("Gib die zweite Chance einem anderen aktiven Spieler ohne eine.");
        tl.second = true;
      } else if (isMod(card)) {
        if (t === p.by || tl.status !== "active") throw new GameError("Gib die Karte einem anderen aktiven Spieler.");
        tl.mods.push(card);
        log(s, `${nameOf(ctx, p.by)} gibt ${nameOf(ctx, t)} ${cardLabel(card)}`);
      } else {
        if (tl.status !== "active") throw new GameError("Nur aktive Spieler.");
        log(s, `${nameOf(ctx, p.by)}: ${cardLabel(card)} → ${nameOf(ctx, t)}`);
        s.discard.push(card);
        s.pending = null;
        if (card === "a:freeze") { tl.status = "frozen"; }
        else if (card === "a:flip3" || card === "a:flip4") {
          if (!forceDraw(s, ctx, t, card === "a:flip3" ? 3 : 4)) { s.deckCount = s.deck.length; return s; }
        } else if (card === "a:one") {
          if (!forceDraw(s, ctx, t, 1)) { s.deckCount = s.deck.length; return s; }
          if (tl.status === "active") tl.status = "done";
        }
      }
      if (s.pending === p) s.pending = null;
      if (!s.pending) {
        if (s.curId === p.by && !s.dealQueue.length && s.lines[p.by]) passTurn(s, ctx);
        advance(s, ctx);
      }
      break;
    }
    case "pick": {
      const p = s.pending;
      if (!p || p.kind !== "pickCard") throw new GameError("Gerade gibt es keine Karte zu wählen.");
      if (!valid(a.owner, a.index, false)) throw new GameError("Diese Karte gibt es nicht.");
      const from = s.lines[a.owner];
      const isN = a.index < from.nums.length;
      const card = isN ? from.nums[a.index] : from.mods[a.index - from.nums.length];
      if (p.card === "a:steal") {
        if (a.owner === p.by) throw new GameError("Klau bei jemand anderem.");
        if (isN) from.nums.splice(a.index, 1); else from.mods.splice(a.index - from.nums.length, 1);
        s.pending = null;
        log(s, `${nameOf(ctx, p.by)} klaut ${cardLabel(card)} von ${nameOf(ctx, a.owner)}`);
        if (s.lines[p.by].status === "active") receive(s, ctx, p.by, card, true);
        else if (isN) s.lines[p.by].nums.push(card); else s.lines[p.by].mods.push(card);
      } else {
        if (isN) from.nums.splice(a.index, 1); else from.mods.splice(a.index - from.nums.length, 1);
        s.discard.push(card);
        s.pending = null;
        log(s, `${nameOf(ctx, p.by)} wirft ${cardLabel(card)} von ${nameOf(ctx, a.owner)} ab`);
      }
      s.discard.push(p.card);
      if (!s.winners.length && s.round === prev.round) {
        if (!s.pending) {
          if (s.curId === p.by && !s.dealQueue.length) passTurn(s, ctx);
          advance(s, ctx);
        }
      }
      break;
    }
    case "swap": {
      const p = s.pending;
      if (!p || p.kind !== "swap") throw new GameError("Gerade gibt es nichts zu tauschen.");
      if (!valid(a.a.owner, a.a.index, true) || !valid(a.b.owner, a.b.index, true)) throw new GameError("Wähle zwei Zahlenkarten.");
      if (a.a.owner === a.b.owner) throw new GameError("Zwei Karten von verschiedenen Spielern.");
      const la = s.lines[a.a.owner], lb = s.lines[a.b.owner];
      [la.nums[a.a.index], lb.nums[a.b.index]] = [lb.nums[a.b.index], la.nums[a.a.index]];
      log(s, `${nameOf(ctx, p.by)} tauscht Karten von ${nameOf(ctx, a.a.owner)} und ${nameOf(ctx, a.b.owner)}`);
      // Doppelte Zahl nach dem Tausch: raus
      for (const l of [la, lb]) {
        const vals = l.nums.map(numValue);
        const dup = vals.some((v, i) => vals.indexOf(v) !== i && !(v === 13 && l.nums.includes("n:13L") && vals.filter((x) => x === 13).length === 2));
        if (dup && l.status === "active") l.status = "bust";
      }
      s.discard.push(p.card);
      s.pending = null;
      if (s.curId === p.by && !s.dealQueue.length) passTurn(s, ctx);
      advance(s, ctx);
      break;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
  s.deckCount = s.deck.length;
  return s;
}

export const flip7: GameLogic<F7State, F7Action> = {
  info: {
    id: "flip7",
    name: "Flip 7",
    tagline: "Noch eine Karte oder aufhören? Doppelte Zahl heißt raus – sieben verschiedene bringen den Bonus.",
    category: "Karten",
    minPlayers: 3,
    maxPlayers: 18,
    duration: "20 Min.",
  },
  version: 1,
  turnBased: true,
  joinMidGame: false,
  settings: [
    {
      key: "variant", label: "Variante", type: "choice", default: "classic",
      choices: [
        { value: "classic", label: "Klassisch", hint: "Einfrieren, Flip 3, zweite Chance" },
        { value: "fies", label: "Voll fies", hint: "bis 13, Klauen, Tauschen, Minus" },
      ],
    },
    { key: "target", label: "Spielziel", type: "number", default: 200, min: 100, max: 500, step: 50 },
  ],
  setup,
  apply,
  actionKind: (a) => (["hit", "stay", "target", "pick", "swap"].includes(a.type) ? "turn" : null),
  currentPlayerId: (s) => (s.winners.length ? null : s.pending ? s.pending.by : s.curId),
  isOver: (s) => s.winners.length > 0,
  results: (s, ctx) => ctx.players.map((p) => ({ id: p.id, won: s.winners.includes(p.id), score: s.scores[p.id] ?? 0 })),
  skipLabel: (s, ctx) => {
    const id = s.pending ? s.pending.by : s.curId;
    const p = ctx.players.find((x) => x.id === id);
    return p && !s.winners.length ? (s.pending ? `Karte von ${p.name} verfallen lassen` : `${p.name} hört auf`) : null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.pending) { s.discard.push(s.pending.card); s.pending = null; }
    else if (s.curId) { s.lines[s.curId].status = "stayed"; passTurn(s, ctx); }
    advance(s, ctx);
    s.deckCount = s.deck.length;
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    if (s.lines[id]) { s.discard.push(...s.lines[id].nums, ...s.lines[id].mods, ...(s.lines[id].second ? ["a:second" as F7Card] : [])); delete s.lines[id]; }
    s.dealQueue = s.dealQueue.filter((x) => x !== id);
    s.discard.push(...s.queued.filter((q) => q.by === id).map((q) => q.card));
    s.queued = s.queued.filter((q) => q.by !== id);
    if (s.pending?.by === id) { s.discard.push(s.pending.card); s.pending = null; }
    if (s.curId === id) { s.curId = null; }
    if (s.dealerId === id) s.dealerId = null;
    if (rest.length) advance(s, { ...ctx, players: rest });
    s.deckCount = s.deck.length;
    return s;
  },
  // Der Stapel bleibt geheim, man sieht nur die Anzahl
  view: (s) => ({ ...s, deck: [] }),
};
