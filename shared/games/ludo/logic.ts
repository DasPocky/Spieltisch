/**
 * Spiellogik für Ludo – das klassische Kreuz-Brett mit 40 Feldern (bzw. 60 auf dem 6er-Brett).
 * Läuft im Browser (lokal) und im Durable Object (online). Zufall nur über shared/platform/random.
 *
 * Positionen je Figur, gezählt ab dem eigenen Startfeld (A-Feld):
 *   -1          = im Haus (B-Felder)
 *   0 … T-1     = auf der Laufbahn (0 = eigenes Startfeld, T = Länge der Laufbahn)
 *   T … T+3     = in den Zielfeldern (T = erstes, T+3 = hinterstes Zielfeld)
 */
import { rollDice } from "../../platform/random";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export const PIECES = 4;
/** Felder je Farbe auf der Laufbahn */
export const PER_COLOR = 10;
export const HOME = -1;
const MAX_LOG = 60;

export const COLOR_NAMES = ["Rot", "Blau", "Grün", "Gelb", "Lila", "Orange"] as const;

export interface Rules {
  /** Farben auf dem Brett: 4 oder 6 */
  board: 4 | 6;
  /** Original: eine Figur steht schon auf dem Startfeld. Hausregel: alle im Haus. */
  start: "one" | "home";
  /** Original: Startfeld räumen. Hausregeln: darf stehen bleiben / darf stehen bleiben und ist dort sicher. */
  startField: "clear" | "free" | "block";
  /** Hausregel: wer schlagen kann, muss schlagen */
  mustHit: boolean;
  /** Hausregel: auch rückwärts ziehen, um zu schlagen */
  backward: boolean;
  /** Hausregel: im Ziel über eigene Figuren springen */
  goalJump: boolean;
  /** Hausregel: auch mit einer 1 raus */
  outOn1: boolean;
  /** bis zum ersten Sieger oder bis alle Plätze vergeben sind */
  end: "first" | "all";
  dice: "app" | "real";
}

export function rulesOf(o: Options): Rules {
  return {
    board: o.board === "6" ? 6 : 4,
    start: o.start === "home" ? "home" : "one",
    startField: o.startField === "free" || o.startField === "block" ? o.startField : "clear",
    mustHit: o.mustHit === true,
    backward: o.backward === true,
    goalJump: o.goalJump === true,
    outOn1: o.outOn1 === true,
    end: o.end === "all" ? "all" : "first",
    dice: o.dice === "real" ? "real" : "app",
  };
}

export const trackLen = (board: number) => board * PER_COLOR;

/** Farben (Arme des Bretts) je Spielerzahl – möglichst gleichmäßig verteilt */
export function colorsFor(n: number, board: 4 | 6): number[] {
  if (board === 4) return n === 2 ? [0, 2] : [0, 1, 2, 3].slice(0, n);
  return ({ 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] } as Record<number, number[]>)[n] ?? [0, 1, 2, 3, 4, 5];
}

export interface LastMove {
  pid: string;
  piece: number;
  from: number;
  to: number;
  back?: boolean;
  /** geschlagene Figur */
  hit?: { pid: string; piece: number; from: number };
  /** zählt hoch, damit die Oberfläche neu animiert */
  n: number;
}

export interface LudoState {
  v: 1;
  board: 4 | 6;
  /** Farbe (Arm) je Spieler */
  color: Record<string, number>;
  pos: Record<string, number[]>;
  curId: string | null;
  /** gewürfelte Zahl, die noch gezogen werden muss (sonst null) */
  die: number | null;
  /** letzter Wurf (zum Anzeigen) und Zähler für die Würfel-Animation */
  shown: number | null;
  rolls: number;
  /** Würfe in diesem Zug ohne Figur im Spiel (bis zu drei Versuche) */
  tries: number;
  /** Platzierung: wer zuerst alle Figuren im Ziel hatte */
  places: string[];
  finished: boolean;
  last: LastMove | null;
  moves: number;
  log: string[];
}

export type LudoAction =
  | { type: "roll"; value?: number }
  | { type: "move"; piece: number; back?: boolean };

export interface Move {
  piece: number;
  from: number;
  to: number;
  back?: boolean;
  /** wen er schlägt */
  hit?: { pid: string; piece: number };
}

/** Globales Laufbahnfeld einer Figur (oder null, wenn im Haus oder Ziel) */
export function globalField(color: number, p: number, board: number): number | null {
  const T = trackLen(board);
  if (p < 0 || p >= T) return null;
  return (color * PER_COLOR + p) % T;
}

/** Wer steht auf einem Laufbahnfeld? */
function occupant(s: LudoState, g: number): { pid: string; piece: number } | null {
  for (const [pid, ps] of Object.entries(s.pos)) {
    const c = s.color[pid];
    for (let i = 0; i < ps.length; i++) if (globalField(c, ps[i], s.board) === g) return { pid, piece: i };
  }
  return null;
}

/** Alle Züge, die die Regeln an sich erlauben – ohne Pflichten (Rausgehen, Startfeld räumen, Schlagzwang) */
function rawMoves(s: LudoState, pid: string, die: number, r: Rules): Move[] {
  const T = trackLen(s.board);
  const ps = s.pos[pid];
  const c = s.color[pid];
  if (!ps) return [];
  const out: Move[] = [];
  const ownAt = (p: number) => ps.some((q) => q === p);
  const target = (to: number): { ok: boolean; hit?: { pid: string; piece: number } } => {
    if (ownAt(to)) return { ok: false };
    if (to >= T) return { ok: true };
    const o = occupant(s, globalField(c, to, s.board)!);
    if (!o) return { ok: true };
    // Hausregel: auf dem eigenen Startfeld ist eine Figur sicher
    if (r.startField === "block" && s.pos[o.pid][o.piece] === 0) return { ok: false };
    return { ok: true, hit: o };
  };
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p === HOME) {
      if (die === 6 || (die === 1 && r.outOn1)) {
        const t = target(0);
        if (t.ok) out.push({ piece: i, from: HOME, to: 0, hit: t.hit });
      }
      continue;
    }
    const to = p + die;
    if (to <= T + 3) {
      // In den Zielfeldern nicht über eigene Figuren springen (Original)
      const jumps = !r.goalJump && ps.some((q, k) => k !== i && q >= T && q > p && q < to);
      const t = target(to);
      if (t.ok && !jumps) out.push({ piece: i, from: p, to, hit: t.hit });
    }
    // Hausregel: rückwärts ziehen, aber nur zum Schlagen und nicht hinter das eigene Startfeld
    if (r.backward && p < T && p - die >= 0) {
      const t = target(p - die);
      if (t.ok && t.hit) out.push({ piece: i, from: p, to: p - die, back: true, hit: t.hit });
    }
  }
  return out;
}

/** Die erlaubten Züge mit allen Pflichten */
export function legalMoves(s: LudoState, pid: string, die: number, r: Rules): Move[] {
  let ms = rawMoves(s, pid, die, r);
  const ps = s.pos[pid] ?? [];
  const atHome = ps.some((p) => p === HOME);
  // Mit einer 6 muss eine Figur raus, solange noch welche im Haus sind
  if (die === 6 && ms.some((m) => m.from === HOME)) ms = ms.filter((m) => m.from === HOME);
  // Startfeld räumen, solange noch Figuren im Haus warten – wenn die Figur dort ziehen kann
  else if (r.startField === "clear" && atHome) {
    const clear = ms.filter((m) => m.from === 0);
    if (clear.length) ms = clear;
  }
  if (r.mustHit && ms.some((m) => m.hit)) ms = ms.filter((m) => m.hit);
  return ms;
}

/** Bis zu dreimal würfeln: keine Figur auf der Laufbahn, und die im Ziel können nicht mehr weiter */
export function threeTries(s: LudoState, pid: string, r: Rules): boolean {
  const T = trackLen(s.board);
  const ps = s.pos[pid] ?? [];
  if (ps.some((p) => p >= 0 && p < T)) return false;
  for (let d = 1; d <= 5; d++) if (rawMoves(s, pid, d, r).some((m) => m.from !== HOME)) return false;
  return true;
}

export const inGoal = (s: LudoState, pid: string) => (s.pos[pid] ?? []).filter((p) => p >= trackLen(s.board)).length;
const isDone = (s: LudoState, pid: string) => inGoal(s, pid) === PIECES;

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "?";

function pushLog(s: LudoState, text: string) {
  s.log.push(text);
  if (s.log.length > MAX_LOG) s.log.shift();
}

/** Spieler, die noch mitspielen (Reihenfolge wie am Tisch) */
const active = (s: LudoState, players: Player[]) => players.filter((p) => s.pos[p.id] && !s.places.includes(p.id));

/** Der Nächste, der noch Figuren draußen hat */
function advance(s: LudoState, players: Player[]) {
  s.die = null;
  s.tries = 0;
  const act = active(s, players);
  if (act.length === 0) { s.curId = null; return; }
  const i = players.findIndex((p) => p.id === s.curId);
  for (let k = 1; k <= players.length; k++) {
    const p = players[(Math.max(i, 0) + k) % players.length];
    if (act.includes(p)) { s.curId = p.id; return; }
  }
  s.curId = act[0].id;
}

/** Partie vorbei? Erster Sieger reicht – oder alle Plätze sind vergeben. */
function checkEnd(s: LudoState, players: Player[], r: Rules) {
  const act = active(s, players);
  if ((r.end === "first" && s.places.length > 0) || act.length <= 1) {
    s.finished = true;
    s.curId = null;
    s.die = null;
  }
}

function setup(ctx: GameContext): LudoState {
  const r = rulesOf(ctx.options);
  const colors = colorsFor(ctx.players.length, r.board);
  const s: LudoState = {
    v: 1, board: r.board, color: {}, pos: {}, curId: ctx.players[0]?.id ?? null, die: null, shown: null, rolls: 0, tries: 0,
    places: [], finished: false, last: null, moves: 0, log: [],
  };
  ctx.players.forEach((p, i) => {
    s.color[p.id] = colors[i] ?? i;
    // Original: eine Figur steht gleich auf dem Startfeld
    s.pos[p.id] = r.start === "one" ? [0, HOME, HOME, HOME] : [HOME, HOME, HOME, HOME];
  });
  return s;
}

function apply(prev: LudoState, a: LudoAction, ctx: GameContext): LudoState {
  if (prev.finished) throw new GameError("Die Partie ist vorbei.");
  const r = rulesOf(ctx.options);
  const s = structuredClone(prev);
  const pid = s.curId;
  if (!pid || !s.pos[pid]) throw new GameError("Es ist niemand am Zug.");
  const who = nameOf(ctx.players, pid);

  switch (a.type) {
    case "roll": {
      if (s.die !== null) throw new GameError(`Erst ziehen – du hast eine ${s.die}.`);
      let value: number;
      if (r.dice === "real") {
        value = Number(a.value);
        if (!Number.isInteger(value) || value < 1 || value > 6) throw new GameError("Tippe eine Zahl von 1 bis 6.");
      } else {
        if (a.value !== undefined) throw new GameError("Die App würfelt.");
        value = rollDice(1)[0];
      }
      const tryMode = threeTries(s, pid, r);
      s.shown = value;
      s.rolls++;
      s.tries++;
      const ms = legalMoves(s, pid, value, r);
      if (ms.length) { s.die = value; return s; }
      if (value === 6) {
        pushLog(s, `${who} würfelt eine 6, kann aber nicht ziehen – nochmal.`);
        s.tries = 0;
      } else if (tryMode && s.tries < 3) {
        // noch ein Versuch – Log erst nach dem letzten
      } else {
        pushLog(s, tryMode ? `${who} hat dreimal keine 6.` : `${who} würfelt eine ${value} – kein Zug möglich.`);
        advance(s, ctx.players);
      }
      return s;
    }
    case "move": {
      if (s.die === null) throw new GameError("Erst würfeln.");
      if (!Number.isInteger(a.piece) || a.piece < 0 || a.piece >= PIECES) throw new GameError("Diese Figur gibt es nicht.");
      const ms = legalMoves(s, pid, s.die, r);
      const m = ms.find((x) => x.piece === a.piece && !!x.back === !!a.back)
        ?? (a.back === undefined ? ms.find((x) => x.piece === a.piece) : undefined);
      if (!m) {
        const any = rawMoves(s, pid, s.die, r).some((x) => x.piece === a.piece);
        throw new GameError(any ? whyNot(s, pid, s.die, r) : "Diese Figur kann so nicht ziehen.");
      }
      const die = s.die;
      s.pos[pid][m.piece] = m.to;
      s.moves++;
      s.last = { pid, piece: m.piece, from: m.from, to: m.to, back: m.back, n: s.moves };
      let text = m.from === HOME ? `${who} kommt raus` : m.to >= trackLen(s.board) && m.from < trackLen(s.board) ? `${who} zieht ins Ziel` : `${who} zieht ${m.back ? `${die} zurück` : die}`;
      if (m.hit) {
        s.last.hit = { pid: m.hit.pid, piece: m.hit.piece, from: s.pos[m.hit.pid][m.hit.piece] };
        s.pos[m.hit.pid][m.hit.piece] = HOME;
        text += ` und schlägt ${nameOf(ctx.players, m.hit.pid)}`;
      }
      pushLog(s, text + ".");
      s.die = null;
      if (isDone(s, pid)) {
        s.places.push(pid);
        pushLog(s, `${who} hat alle Figuren im Ziel – Platz ${s.places.length}!`);
        checkEnd(s, ctx.players, r);
        if (!s.finished) advance(s, ctx.players);
        return s;
      }
      // Bei einer 6 nochmal würfeln
      if (die === 6) s.tries = 0;
      else advance(s, ctx.players);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/** Kurze Begründung, warum eine an sich mögliche Figur gerade nicht darf */
function whyNot(s: LudoState, pid: string, die: number, r: Rules): string {
  const raw = rawMoves(s, pid, die, r);
  const atHome = (s.pos[pid] ?? []).some((p) => p === HOME);
  if (die === 6 && raw.some((m) => m.from === HOME)) return "Mit der 6 muss eine Figur raus.";
  if (r.startField === "clear" && atHome && raw.some((m) => m.from === 0)) return "Erst das Startfeld räumen.";
  if (r.mustHit) return "Schlagzwang – du musst schlagen.";
  return "Diese Figur darf gerade nicht ziehen.";
}

export const ludo: GameLogic<LudoState, LudoAction> = {
  info: {
    id: "ludo",
    name: "Ludo",
    tagline: "Der Klassiker auf dem Kreuz-Brett: raus mit der 6, rumlaufen, schlagen – und ärgern.",
    category: "Brett",
    minPlayers: 2,
    maxPlayers: 6,
    duration: "30–60 Min.",
  },
  version: 1,
  turnBased: true,
  joinMidGame: false,
  playerLimits: (o) => ({ min: 2, max: rulesOf(o).board, note: rulesOf(o).board === 4 ? "5–6 Spieler: Brett auf „6 Farben“ stellen" : undefined }),
  settings: [
    {
      key: "dice", label: "Würfel", type: "choice", default: "app",
      choices: [
        { value: "app", label: "App-Würfel", hint: "die App würfelt" },
        { value: "real", label: "Echter Würfel", hint: "Zahl eintippen" },
      ],
    },
    {
      key: "board", label: "Brett", type: "choice", default: "4",
      choices: [
        { value: "4", label: "4 Farben", hint: "2–4 Spieler, 40 Felder" },
        { value: "6", label: "6 Farben", hint: "bis 6 Spieler, 60 Felder" },
      ],
    },
    {
      key: "end", label: "Spielende", type: "choice", default: "first",
      choices: [
        { value: "first", label: "Erster gewinnt", hint: "Schluss beim ersten Sieger" },
        { value: "all", label: "Alle Plätze", hint: "weiter bis Platz 2, 3 …" },
      ],
    },
    {
      key: "start", label: "Aufstellung", type: "choice", default: "one", group: "Hausregeln",
      choices: [
        { value: "one", label: "Eine draußen", hint: "Original: eine steht schon auf dem Startfeld" },
        { value: "home", label: "Alle im Haus", hint: "erst mit einer 6 raus" },
      ],
    },
    {
      key: "startField", label: "Startfeld", type: "choice", default: "clear", group: "Hausregeln",
      choices: [
        { value: "clear", label: "Räumen", hint: "Original: sofort weiterziehen" },
        { value: "free", label: "Stehen lassen", hint: "darf stehen bleiben" },
        { value: "block", label: "Blockieren", hint: "darf stehen bleiben und ist dort sicher" },
      ],
    },
    { key: "mustHit", label: "Schlagzwang", type: "toggle", default: false, hint: "wer schlagen kann, muss schlagen", group: "Hausregeln" },
    { key: "backward", label: "Rückwärts schlagen", type: "toggle", default: false, hint: "die Augenzahl auch zurück ziehen, um zu schlagen", group: "Hausregeln" },
    { key: "goalJump", label: "Im Ziel überspringen", type: "toggle", default: false, hint: "über eigene Figuren im Ziel springen", group: "Hausregeln" },
    { key: "outOn1", label: "Auch mit 1 raus", type: "toggle", default: false, hint: "eine 1 bringt ebenfalls eine Figur aufs Startfeld", group: "Hausregeln" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "roll" || a.type === "move" ? "turn" : null),
  currentPlayerId: (s) => (s.finished ? null : s.curId),
  isOver: (s) => s.finished,
  results: (s, ctx) => {
    const ids = ctx.players.map((p) => p.id).filter((id) => s.pos[id]);
    const winner = s.places[0] ?? (ids.length === 1 ? ids[0] : null);
    return ids.map((id) => ({ id, won: id === winner, score: inGoal(s, id) }));
  },
  skipLabel: (s, ctx) => (s.finished || !s.curId ? null : `Zug von ${nameOf(ctx.players, s.curId)} überspringen`),
  skipTurn(prev, ctx) {
    if (prev.finished) return prev;
    const s = structuredClone(prev);
    pushLog(s, `${nameOf(ctx.players, s.curId)} setzt aus.`);
    advance(s, ctx.players);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    if (!prev.pos[id] || prev.finished) return prev;
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    if (s.curId === id) advance(s, ctx.players);
    delete s.pos[id];
    delete s.color[id];
    s.places = s.places.filter((p) => p !== id);
    if (s.last && (s.last.pid === id || s.last.hit?.pid === id)) s.last = null;
    pushLog(s, `${nameOf(ctx.players, id)} hat das Spiel verlassen.`);
    if (s.curId === id) s.curId = null;
    checkEnd(s, rest, rulesOf(ctx.options));
    if (!s.finished && !s.curId) advance(s, rest);
    return s;
  },
};
