/**
 * Skyjo – jeder hat 12 Karten (3 Reihen × 4 Spalten), anfangs verdeckt. Ziel: möglichst wenige Punkte.
 * Zwei Varianten:
 *  - „app“: Karten liegen in der App (lokal an einem Gerät oder online jeder am eigenen Handy).
 *    Geheim ist nur, was verdeckt liegt – das weiß auch der Besitzer nicht.
 *  - „table“: Ihr spielt mit echten Karten, die App ist der Punkteblock (Verdopplung, Ziel 100).
 */
import { shuffle } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export type Mode = "app" | "table";
/** Eine Karte im Raster: Wert (null = verdeckt und unbekannt – so sieht es der Client) */
export interface Cell { v: number | null; up: boolean }

export interface RoundResult { points: Record<string, number>; ender: string | null; doubled: boolean }

export interface SkState {
  v: 1;
  mode: Mode;
  target: number;
  round: number;
  scores: Record<string, number>;
  rounds: RoundResult[];
  phase: "flip" | "turn" | "roundEnd" | "over" | "enter";
  // --- app ---
  deck: number[];
  deckCount: number;
  discard: number[];
  /** 12 Plätze, null = Spalte abgeräumt */
  grids: Record<string, (Cell | null)[]>;
  curId: string | null;
  drawn: number | null;
  drawnFrom: "deck" | "discard" | null;
  /** abgelegte Karte vom Stapel: jetzt eine verdeckte Karte umdrehen */
  mustFlip: boolean;
  ender: string | null;
  /** wer nach dem Aufdecken des Beenders noch einmal dran ist */
  lastTurns: string[];
  /** wer die nächste Runde beginnt */
  nextStarter: string | null;
  // --- table ---
  entries: Record<string, number | null>;
  tableEnder: string | null;
  log: string[];
}

export type SkAction =
  | { type: "flipStart"; player?: string; i: number }
  | { type: "draw"; from: "deck" | "discard" }
  | { type: "swap"; i: number }
  | { type: "discardDrawn" }
  | { type: "flip"; i: number }
  | { type: "nextRound" }
  | { type: "enter"; player?: string; points: number | null }
  | { type: "setEnder"; player: string | null }
  | { type: "finishRound" }
  | { type: "undoRound" };

const CELLS = 12;
const COLS = 4;
const MAX_LOG = 40;
export const modeOf = (o: Options): Mode => (o.mode === "table" ? "table" : "app");

/** 150 Karten: je 5× −2, 10× −1, 15× 0, je 10× 1 bis 12 */
export function buildDeck(): number[] {
  const d: number[] = [];
  for (let i = 0; i < 5; i++) d.push(-2);
  for (let i = 0; i < 10; i++) d.push(-1);
  for (let i = 0; i < 15; i++) d.push(0);
  for (let v = 1; v <= 12; v++) for (let i = 0; i < 10; i++) d.push(v);
  return d;
}

const log = (s: SkState, line: string) => { s.log.push(line); if (s.log.length > MAX_LOG) s.log.shift(); };
const nameOf = (ctx: GameContext, id: string | null) => ctx.players.find((p) => p.id === id)?.name ?? "?";

/** Summe der offenen Karten (für den Start und die Anzeige) */
export const visibleSum = (grid: (Cell | null)[]) => grid.reduce((t, c) => t + (c?.up && c.v !== null ? c.v : 0), 0);
export const allUp = (grid: (Cell | null)[]) => grid.every((c) => c === null || c.up);

function draw(s: SkState): number {
  if (!s.deck.length) {
    // Stapel leer: Ablage (bis auf die oberste) mischen
    const top = s.discard.pop();
    s.deck = shuffle(s.discard);
    s.discard = top === undefined ? [] : [top];
  }
  const v = s.deck.pop();
  if (v === undefined) throw new GameError("Keine Karten mehr.");
  return v;
}

function deal(s: SkState, players: Player[]) {
  s.deck = shuffle(buildDeck());
  s.discard = [];
  s.grids = {};
  for (const p of players) s.grids[p.id] = Array.from({ length: CELLS }, () => ({ v: s.deck.pop()!, up: false }));
  s.discard.push(s.deck.pop()!);
  s.phase = "flip";
  s.curId = null;
  s.drawn = null;
  s.drawnFrom = null;
  s.mustFlip = false;
  s.ender = null;
  s.lastTurns = [];
}

function setup(ctx: GameContext): SkState {
  const s: SkState = {
    v: 1, mode: modeOf(ctx.options), target: Number(ctx.options.target) || 100, round: 1,
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])), rounds: [], phase: "flip",
    deck: [], deckCount: 0, discard: [], grids: {}, curId: null, drawn: null, drawnFrom: null, mustFlip: false,
    ender: null, lastTurns: [], nextStarter: null, entries: {}, tableEnder: null, log: [],
  };
  if (s.mode === "table") { s.phase = "enter"; s.entries = Object.fromEntries(ctx.players.map((p) => [p.id, null])); }
  else deal(s, ctx.players);
  return s;
}

/** Drei gleiche offene Karten in einer Spalte kommen weg */
function clearColumns(s: SkState, id: string) {
  const g = s.grids[id];
  for (let c = 0; c < COLS; c++) {
    const col = [c, c + COLS, c + 2 * COLS].map((i) => g[i]);
    if (col.every((x) => x && x.up) && col.every((x) => x!.v === col[0]!.v)) {
      for (const i of [c, c + COLS, c + 2 * COLS]) { s.discard.push(g[i]!.v!); g[i] = null; }
      log(s, `Spalte mit drei ${col[0]!.v}ern abgeräumt`);
    }
  }
}

/** Punkte einer Runde: der Beender zahlt doppelt, wenn er nicht allein am wenigsten hat (und Plus hat) */
export function roundPoints(raw: Record<string, number>, ender: string | null): { points: Record<string, number>; doubled: boolean } {
  const points = { ...raw };
  let doubled = false;
  if (ender && ender in raw && raw[ender] > 0 && Object.entries(raw).some(([id, p]) => id !== ender && p <= raw[ender])) {
    points[ender] = raw[ender] * 2;
    doubled = true;
  }
  return { points, doubled };
}

function addRound(s: SkState, raw: Record<string, number>, ender: string | null, ctx: GameContext) {
  const { points, doubled } = roundPoints(raw, ender);
  for (const [id, p] of Object.entries(points)) s.scores[id] = (s.scores[id] ?? 0) + p;
  s.rounds.push({ points, ender, doubled });
  log(s, `Runde ${s.round}: ${ctx.players.map((p) => `${p.name} ${points[p.id] ?? 0}`).join(", ")}${doubled ? ` (${nameOf(ctx, ender)} doppelt)` : ""}`);
  if (Object.values(s.scores).some((v) => v >= s.target)) s.phase = "over";
}

function endRound(s: SkState, ctx: GameContext) {
  const raw: Record<string, number> = {};
  for (const p of ctx.players) {
    const g = s.grids[p.id];
    if (!g) continue;
    for (const c of g) if (c) c.up = true;
    raw[p.id] = g.reduce((t, c) => t + (c?.v ?? 0), 0);
  }
  s.curId = null;
  s.nextStarter = s.ender;
  addRound(s, raw, s.ender, ctx);
  if (s.phase !== "over") s.phase = "roundEnd";
}

/** Zug beenden: Aufdecken des Beenders erkennen, letzte Runde abwickeln */
function endTurn(s: SkState, ctx: GameContext) {
  const id = s.curId!;
  s.drawn = null;
  s.drawnFrom = null;
  s.mustFlip = false;
  clearColumns(s, id);
  if (s.ender) s.lastTurns = s.lastTurns.filter((x) => x !== id);
  else if (allUp(s.grids[id])) {
    s.ender = id;
    s.lastTurns = ctx.players.map((p) => p.id).filter((x) => x !== id && s.grids[x]);
    log(s, `${nameOf(ctx, id)} hat alle Karten offen – jeder ist noch einmal dran.`);
  }
  if (s.ender && !s.lastTurns.length) { endRound(s, ctx); return; }
  let next = nextPlayerId(ctx.players, id);
  for (let k = 0; k < ctx.players.length && next && (!s.grids[next] || (s.ender && !s.lastTurns.includes(next))); k++) next = nextPlayerId(ctx.players, next);
  s.curId = next;
}

/** Alle haben zwei Karten aufgedeckt: Wer die höchste Summe hat, beginnt (oder der Beender der letzten Runde) */
function maybeBegin(s: SkState, ctx: GameContext) {
  const ids = ctx.players.map((p) => p.id).filter((id) => s.grids[id]);
  if (!ids.every((id) => s.grids[id].filter((c) => c?.up).length >= 2)) return;
  let start = s.nextStarter && ids.includes(s.nextStarter) ? s.nextStarter : null;
  if (!start) {
    const best = Math.max(...ids.map((id) => visibleSum(s.grids[id])));
    start = ids.find((id) => visibleSum(s.grids[id]) === best)!;
  }
  s.phase = "turn";
  s.curId = start;
  log(s, `${nameOf(ctx, start)} beginnt.`);
}

const cellAt = (s: SkState, id: string, i: number) => {
  if (!Number.isInteger(i) || i < 0 || i >= CELLS) throw new GameError("Diese Karte gibt es nicht.");
  const c = s.grids[id]?.[i];
  if (!c) throw new GameError("Da liegt keine Karte mehr.");
  return c;
};

function apply(prev: SkState, a: SkAction, ctx: GameContext): SkState {
  const s = structuredClone(prev);
  const actor = ctx.actorId;
  const local = actor === null;
  const isHost = local || actor === ctx.hostId;

  if (s.mode === "table") return applyTable(s, a, ctx, isHost);

  switch (a.type) {
    case "flipStart": {
      if (s.phase !== "flip") throw new GameError("Die Startkarten sind schon aufgedeckt.");
      const who = local ? a.player : actor;
      if (!who || !s.grids[who]) throw new GameError("Du spielst nicht mit.");
      const g = s.grids[who];
      if (g.filter((c) => c?.up).length >= 2) throw new GameError("Du hast schon zwei Karten aufgedeckt.");
      const c = cellAt(s, who, a.i);
      if (c.up) throw new GameError("Die Karte liegt schon offen.");
      c.up = true;
      maybeBegin(s, ctx);
      return s;
    }
    case "draw": {
      if (s.phase !== "turn") throw new GameError("Gerade zieht niemand.");
      if (s.drawn !== null || s.mustFlip) throw new GameError("Du hast schon gezogen.");
      if (a.from === "discard") {
        const v = s.discard.pop();
        if (v === undefined) throw new GameError("Die Ablage ist leer.");
        s.drawn = v; s.drawnFrom = "discard";
      } else { s.drawn = draw(s); s.drawnFrom = "deck"; }
      return s;
    }
    case "swap": {
      if (s.drawn === null) throw new GameError("Zieh zuerst eine Karte.");
      const c = cellAt(s, s.curId!, a.i);
      s.discard.push(c.v!);
      s.grids[s.curId!][a.i] = { v: s.drawn, up: true };
      endTurn(s, ctx);
      return s;
    }
    case "discardDrawn": {
      if (s.drawn === null || s.drawnFrom !== "deck") throw new GameError("Nur eine Karte vom Stapel darfst du ablegen.");
      s.discard.push(s.drawn);
      s.drawn = null;
      s.drawnFrom = null;
      if (s.grids[s.curId!].some((c) => c && !c.up)) s.mustFlip = true;
      else endTurn(s, ctx);
      return s;
    }
    case "flip": {
      if (!s.mustFlip) throw new GameError("Umdrehen darfst du nur, nachdem du die gezogene Karte abgelegt hast.");
      const c = cellAt(s, s.curId!, a.i);
      if (c.up) throw new GameError("Die Karte liegt schon offen.");
      c.up = true;
      endTurn(s, ctx);
      return s;
    }
    case "nextRound": {
      if (s.phase !== "roundEnd") throw new GameError("Die Runde läuft noch.");
      s.round++;
      deal(s, ctx.players);
      return s;
    }
    default:
      throw new GameError("Das geht nur mit echten Karten.");
  }
}

/** Echte Karten: Punkte pro Runde eintragen, Beender wählen, Runde abschließen */
function applyTable(s: SkState, a: SkAction, ctx: GameContext, isHost: boolean): SkState {
  const actor = ctx.actorId;
  switch (a.type) {
    case "enter": {
      const who = a.player ?? actor;
      if (!who || !ctx.players.some((p) => p.id === who)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (actor !== null && who !== actor && !isHost) throw new GameError("Trag nur deine eigenen Punkte ein.");
      if (s.phase !== "enter") throw new GameError("Die Partie ist vorbei.");
      if (a.points !== null && (!Number.isInteger(a.points) || a.points < -30 || a.points > 150)) throw new GameError("Punkte zwischen −30 und 150.");
      s.entries[who] = a.points;
      return s;
    }
    case "setEnder": {
      if (s.phase !== "enter") throw new GameError("Die Partie ist vorbei.");
      if (a.player !== null && !ctx.players.some((p) => p.id === a.player)) throw new GameError("Diesen Spieler gibt es nicht.");
      s.tableEnder = a.player;
      return s;
    }
    case "finishRound": {
      if (!isHost) throw new GameError("Die Runde schließt der Host ab.");
      if (s.phase !== "enter") throw new GameError("Die Partie ist vorbei.");
      const missing = ctx.players.filter((p) => s.entries[p.id] === null || s.entries[p.id] === undefined);
      if (missing.length) throw new GameError(`Es fehlen noch Punkte: ${missing.map((p) => p.name).join(", ")}.`);
      const raw = Object.fromEntries(ctx.players.map((p) => [p.id, s.entries[p.id]!]));
      addRound(s, raw, s.tableEnder, ctx);
      if ((s.phase as SkState["phase"]) !== "over") { s.round++; s.entries = Object.fromEntries(ctx.players.map((p) => [p.id, null])); s.tableEnder = null; }
      return s;
    }
    case "undoRound": {
      if (!isHost) throw new GameError("Das darf nur der Host.");
      const last = s.rounds.pop();
      if (!last) throw new GameError("Es gibt noch keine Runde.");
      for (const [id, p] of Object.entries(last.points)) s.scores[id] = (s.scores[id] ?? 0) - p;
      s.entries = Object.fromEntries(ctx.players.map((p) => [p.id, null]));
      s.tableEnder = null;
      if (s.phase === "enter") s.round--;
      s.phase = "enter";
      return s;
    }
    default:
      throw new GameError("Mit echten Karten tragt ihr nur die Punkte ein.");
  }
}

/** Wer hat die wenigsten Punkte? */
export function leaders(s: SkState, players: Player[]): string[] {
  const best = Math.min(...players.map((p) => s.scores[p.id] ?? 0));
  return players.filter((p) => (s.scores[p.id] ?? 0) === best).map((p) => p.id);
}

export const skyjo: GameLogic<SkState, SkAction> = {
  info: {
    id: "skyjo",
    name: "Skyjo",
    tagline: "Karten tauschen, Spalten abräumen – wer am wenigsten Punkte hat, gewinnt.",
    category: "Karten",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "30 Min.",
  },
  version: 1,
  turnBased: true,
  joinMidGame: false,
  settings: [
    {
      key: "mode", label: "Karten", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "App mischt und teilt aus" },
        { value: "table", label: "🃏 Echte Karten", hint: "App ist der Punkteblock" },
      ],
    },
    { key: "target", label: "Spielende ab", type: "number", default: 100, min: 50, max: 300, step: 10 },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "draw" || a.type === "swap" || a.type === "discardDrawn" || a.type === "flip" ? "turn" : "player"),
  currentPlayerId: (s) => (s.phase === "turn" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const win = leaders(s, ctx.players);
    // Keine Punktzahl für die Statistik: bei Skyjo sind wenige Punkte gut, „Bestwert“ wäre irreführend
    return ctx.players.map((p) => ({ id: p.id, won: win.includes(p.id) }));
  },
  skipLabel: (s, ctx) => {
    if (s.phase === "flip") {
      const slow = ctx.players.filter((p) => s.grids[p.id] && s.grids[p.id].filter((c) => c?.up).length < 2);
      return slow.length ? `Startkarten für ${slow.map((p) => p.name).join(", ")} aufdecken` : null;
    }
    return s.phase === "turn" && s.curId ? `Zug von ${nameOf(ctx, s.curId)} erledigen` : null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "flip") {
      for (const p of ctx.players) {
        const g = s.grids[p.id];
        while (g && g.filter((c) => c?.up).length < 2) { const i = g.findIndex((c) => c && !c.up); if (i < 0) break; g[i]!.up = true; }
      }
      maybeBegin(s, ctx);
      return s;
    }
    if (s.phase !== "turn" || !s.curId) return s;
    // Automatisch: gezogene Karte ablegen und eine verdeckte umdrehen
    if (s.drawn !== null) { s.discard.push(s.drawn); s.drawn = null; s.drawnFrom = null; }
    const g = s.grids[s.curId];
    const hidden = g.findIndex((c) => c && !c.up);
    if (hidden >= 0) g[hidden]!.up = true;
    log(s, `Zug von ${nameOf(ctx, s.curId)} übersprungen.`);
    endTurn(s, ctx);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (s.grids[id]) { s.discard.unshift(...s.grids[id].filter((c): c is Cell => !!c).map((c) => c.v!)); delete s.grids[id]; }
    delete s.entries[id];
    s.lastTurns = s.lastTurns.filter((x) => x !== id);
    if (s.ender === id) { s.ender = null; s.lastTurns = []; }
    const rest = ctx.players.filter((p) => p.id !== id);
    if (s.curId === id) {
      s.drawn = null; s.drawnFrom = null; s.mustFlip = false;
      s.curId = nextPlayerId(ctx.players, id);
      if (s.curId === id) s.curId = rest[0]?.id ?? null;
    }
    if (s.phase === "flip") maybeBegin(s, { ...ctx, players: rest });
    if (rest.length < 2 && s.phase !== "enter") s.phase = "over";
    return s;
  },
  // Verdeckte Karten kennt niemand – auch der Besitzer nicht. Die Reihenfolge des Stapels bleibt geheim.
  view: (s) => ({
    ...s,
    deck: [],
    deckCount: s.deck.length,
    grids: Object.fromEntries(Object.entries(s.grids).map(([id, g]) => [id, g.map((c) => (c ? { v: c.up ? c.v : null, up: c.up } : null))])),
  }),
};
