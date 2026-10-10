/**
 * Dame nach deutschen Regeln: 8×8, gespielt auf den dunklen Feldern, Weiß beginnt.
 * Steine ziehen ein Feld schräg vorwärts und schlagen vorwärts und rückwärts, es herrscht Schlagzwang
 * (welcher Schlag, darfst du wählen), Mehrfachschlagen muss zu Ende geführt werden.
 * Wer die gegnerische Grundreihe erreicht (und dort den Zug beendet), bekommt eine Dame – sie zieht beliebig weit.
 * Hausregeln: Pusten statt Schlagzwang, kurze Damen (englisch), Steine schlagen nur vorwärts.
 */
import { GameError, type GameContext, type Options } from "../../platform/types";
import { drawn, duelBase, duelGame, nameOf, other, pushLog, win, type DuelBase, type Side } from "../_board/duel";

export interface DameState extends DuelBase {
  size: number;
  /** Feld r * size + c (r = 0 unten, Grundreihe von Weiß): 0 leer, 1/2 weißer Stein/Dame, -1/-2 schwarz */
  board: number[];
  /** Pusten: Steine des Gegners, die eben nicht geschlagen haben, obwohl sie konnten */
  blow: number[];
  /** Züge (beide zusammen) nur mit Damen und ohne Schlagen – für die Remis-Regel */
  quiet: number;
  last: { from: number; path: number[]; caps: number[]; blown?: number } | null;
}

export type DameAction = { type: "move"; from: number; path: number[] } | { type: "blow"; at: number };

export interface Move { from: number; path: number[]; caps: number[] }

export const COLOR_NAME = ["Weiß", "Schwarz"] as const;

export interface DameRules { capture: "must" | "blow" | "free"; flying: boolean; back: boolean; draw: number }
export function rulesOf(o: Options): DameRules {
  return {
    capture: o.capture === "blow" || o.capture === "free" ? o.capture : "must",
    flying: o.flying !== false,
    back: o.back !== false,
    draw: Number(o.draw) || 0,
  };
}

export const sizeOf = (o: Options) => (o.size === "10" ? 10 : 8);
export const isDark = (size: number, i: number) => (Math.floor(i / size) + (i % size)) % 2 === 0;
export const ownedBy = (v: number, side: Side) => (side === 0 ? v > 0 : v < 0);
export const isKing = (v: number) => Math.abs(v) === 2;
export const squareName = (size: number, i: number) => `${"abcdefghij"[i % size]}${Math.floor(i / size) + 1}`;
export const moveName = (size: number, m: { from: number; path: number[]; caps: number[] }) =>
  [m.from, ...m.path].map((i) => squareName(size, i)).join(m.caps.length ? "×" : "–");

const DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
/** Vorwärts-Richtung in Zeilen */
const fwd = (side: Side) => (side === 0 ? 1 : -1);

/** Alle vollständigen Schlagfolgen des Steins auf `from` */
function capturesFrom(b: number[], size: number, from: number, r: DameRules): Move[] {
  const v = b[from];
  const side: Side = v > 0 ? 0 : 1;
  const king = isKing(v);
  const work = b.slice();
  work[from] = 0; // der Stein hat sein Feld verlassen
  const out: Move[] = [];
  const on = (row: number, col: number) => row >= 0 && row < size && col >= 0 && col < size;
  const dfs = (pos: number, path: number[], caps: number[]) => {
    let more = false;
    const pr = Math.floor(pos / size), pc = pos % size;
    for (const [dr, dc] of DIRS) {
      // Steine schlagen vorwärts – rückwärts nur mit der Regel
      if (!king && !r.back && dr !== fwd(side)) continue;
      let k = 1;
      if (king && r.flying) while (on(pr + dr * k, pc + dc * k) && work[(pr + dr * k) * size + pc + dc * k] === 0) k++;
      const vr = pr + dr * k, vc = pc + dc * k;
      if (!on(vr, vc)) continue;
      const victim = vr * size + vc;
      // Jeder Stein wird nur einmal übersprungen; geschlagene bleiben bis zum Zugende liegen
      if (caps.includes(victim) || work[victim] === 0 || ownedBy(work[victim], side)) continue;
      for (let m = k + 1; ; m++) {
        const lr = pr + dr * m, lc = pc + dc * m;
        if (!on(lr, lc) || work[lr * size + lc] !== 0) break;
        more = true;
        const land = lr * size + lc;
        dfs(land, [...path, land], [...caps, victim]);
        if (!(king && r.flying)) break; // Steine und kurze Damen landen direkt dahinter
      }
    }
    if (!more && path.length) out.push({ from, path, caps });
  };
  dfs(from, [], []);
  return out;
}

function stepsFrom(b: number[], size: number, from: number, r: DameRules): Move[] {
  const v = b[from];
  const side: Side = v > 0 ? 0 : 1;
  const king = isKing(v);
  const out: Move[] = [];
  const fr = Math.floor(from / size), fc = from % size;
  for (const [dr, dc] of DIRS) {
    if (!king && dr !== fwd(side)) continue;
    for (let k = 1; ; k++) {
      const row = fr + dr * k, col = fc + dc * k;
      if (row < 0 || row >= size || col < 0 || col >= size || b[row * size + col] !== 0) break;
      out.push({ from, path: [row * size + col], caps: [] });
      if (!(king && r.flying)) break;
    }
  }
  return out;
}

export function allCaptures(s: DameState, o: Options, side: Side = s.turn): Move[] {
  const r = rulesOf(o);
  return s.board.flatMap((v, i) => (ownedBy(v, side) ? capturesFrom(s.board, s.size, i, r) : []));
}

/** Alle erlaubten Züge (bei Schlagzwang nur Schläge, wenn es welche gibt) */
export function legalMoves(s: DameState, o: Options, side: Side = s.turn): Move[] {
  const r = rulesOf(o);
  const caps = allCaptures(s, o, side);
  if (caps.length && r.capture === "must") return caps;
  return [...caps, ...s.board.flatMap((v, i) => (ownedBy(v, side) ? stepsFrom(s.board, s.size, i, r) : []))];
}

export function initialBoard(size: number): number[] {
  const rows = size / 2 - 1;
  return Array.from({ length: size * size }, (_, i) => {
    const row = Math.floor(i / size);
    if (!isDark(size, i)) return 0;
    return row < rows ? 1 : row >= size - rows ? -1 : 0;
  });
}

/** Nach einem Zug oder Pusten: Hat der Gegner noch Steine und Züge? */
function checkEnd(s: DameState, ctx: GameContext, loser: Side) {
  const name = nameOf(ctx, s.colors[loser]);
  if (!s.board.some((v) => ownedBy(v, loser))) {
    win(s, other(loser), `${name} hat keine Steine mehr`);
    pushLog(s, `${name} hat keine Steine mehr`);
    return true;
  }
  if (!legalMoves(s, ctx.options, loser).length) {
    win(s, other(loser), `${name} kann nicht mehr ziehen`);
    pushLog(s, `${name} kann nicht mehr ziehen`);
    return true;
  }
  return false;
}

const same = (a: number[], b: unknown) => Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

export const dame = duelGame<DameState, DameAction>({
  info: {
    id: "dame",
    name: "Dame",
    tagline: "Schräg ziehen, gegnerische Steine überspringen und eine Dame bekommen – nach deutschen Regeln.",
    category: "Brett",
    minPlayers: 2,
    maxPlayers: 2,
    duration: "15–30 Min.",
  },
  version: 1,
  settings: [
    {
      key: "size", label: "Brett", type: "choice", default: "8",
      choices: [
        { value: "8", label: "8 × 8", hint: "deutsch, 12 Steine" },
        { value: "10", label: "10 × 10", hint: "international, 20 Steine" },
      ],
    },
    {
      key: "capture", label: "Schlagen", type: "choice", default: "must", group: "Hausregeln",
      choices: [
        { value: "must", label: "Schlagzwang", hint: "Original" },
        { value: "blow", label: "Pusten", hint: "nicht geschlagen? Gegner darf den Stein wegnehmen" },
        { value: "free", label: "Freiwillig", hint: "Schlagen ist erlaubt, nicht Pflicht" },
      ],
    },
    { key: "flying", label: "Damen ziehen beliebig weit", type: "toggle", default: true, hint: "Original (fliegende Dame) – aus: nur ein Feld wie im englischen Spiel", group: "Hausregeln" },
    { key: "back", label: "Steine schlagen auch rückwärts", type: "toggle", default: true, hint: "Original – aus: Steine schlagen nur vorwärts (englisch)", group: "Hausregeln" },
    {
      key: "draw", label: "Unentschieden", type: "choice", default: "25", group: "Hausregeln",
      choices: [
        { value: "0", label: "Nie", hint: "ihr spielt aus oder gebt auf" },
        { value: "15", label: "15 Züge", hint: "je Spieler nur Damen, nichts geschlagen" },
        { value: "25", label: "25 Züge", hint: "je Spieler nur Damen, nichts geschlagen (Turnierregel)" },
      ],
    },
    { key: "turnBoard", label: "Brett für Schwarz drehen", type: "toggle", default: false, inGame: true, hint: "nur bei einem Handy: das Brett dreht sich zu dem, der dran ist", group: "Ein Handy für alle" },
  ],
  actions: ["move", "blow"],
  setup(ctx) {
    const size = sizeOf(ctx.options);
    return { ...duelBase(ctx), size, board: initialBoard(size), blow: [], quiet: 0, last: null };
  },
  moves: (s, o) => legalMoves(s, o).map((m) => ({ type: "move" as const, from: m.from, path: m.path })),
  play(s, a, ctx) {
    const r = rulesOf(ctx.options);
    const side = s.turn;
    const who = nameOf(ctx, s.colors[side]);
    if (a.type === "blow") {
      if (!s.blow.includes(a.at)) throw new GameError("Diesen Stein darfst du nicht wegpusten.");
      s.board[a.at] = 0;
      s.blow = [];
      s.n++;
      s.last = { from: a.at, path: [], caps: [], blown: a.at };
      pushLog(s, `${who} pustet ${squareName(s.size, a.at)} weg`);
      if (checkEnd(s, ctx, other(side))) return;
      // Kann man nach dem Pusten selbst nicht mehr ziehen, ist die Partie verloren
      checkEnd(s, ctx, side);
      return;
    }
    if (a.type !== "move") throw new GameError("Unbekannte Aktion.");
    const all = legalMoves(s, ctx.options);
    const m = all.find((x) => x.from === a.from && same(x.path, a.path));
    if (!m) {
      const v = s.board[a.from];
      if (!Number.isInteger(a.from) || v === undefined || !ownedBy(v, side)) throw new GameError("Das ist nicht dein Stein.");
      if (r.capture === "must" && all.some((x) => x.caps.length)) {
        const partial = all.some((x) => x.from === a.from && Array.isArray(a.path) && a.path.length < x.path.length && a.path.every((p, i) => p === x.path[i]));
        throw new GameError(partial ? "Weiterschlagen – der Zug ist noch nicht fertig." : "Schlagzwang: Du musst schlagen.");
      }
      throw new GameError("So darf dieser Stein nicht ziehen.");
    }
    // Pusten: Wer schlagen konnte, es aber nicht tut, riskiert den Stein
    const could = r.capture === "blow" && !m.caps.length ? [...new Set(allCaptures(s, ctx.options).map((x) => x.from))] : [];
    const v = s.board[m.from];
    const to = m.path[m.path.length - 1];
    s.board[m.from] = 0;
    for (const c of m.caps) s.board[c] = 0;
    const lastRow = side === 0 ? s.size - 1 : 0;
    const crowned = !isKing(v) && Math.floor(to / s.size) === lastRow;
    s.board[to] = crowned ? v * 2 : v;
    s.blow = could.map((i) => (i === m.from ? to : i));
    s.quiet = isKing(v) && !m.caps.length ? s.quiet + 1 : 0;
    s.n++;
    s.last = { from: m.from, path: m.path, caps: m.caps };
    pushLog(s, `${who}: ${moveName(s.size, m)}${crowned ? " – Dame!" : ""}`);
    s.turn = other(side);
    if (checkEnd(s, ctx, s.turn)) return;
    if (r.draw && s.quiet >= r.draw * 2) {
      drawn(s, `${r.draw} Züge je Spieler nur mit Damen und ohne Schlagen`);
      pushLog(s, "Unentschieden");
    }
  },
});
