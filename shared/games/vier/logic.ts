/**
 * Vier in einer Reihe: Steine fallen in Spalten, wer zuerst vier in einer Reihe hat
 * (waagerecht, senkrecht oder diagonal), gewinnt. Volles Brett ohne Reihe: unentschieden.
 */
import { GameError, type GameContext, type Options } from "../../platform/types";
import { drawn, duelBase, duelGame, nameOf, other, pushLog, win, type DuelBase, type Side } from "../_board/duel";

export interface VierState extends DuelBase {
  cols: number;
  rows: number;
  /** Je Spalte die Steine von unten nach oben (Farbe 0 oder 1) */
  grid: Side[][];
  /** Zuletzt gefallener Stein */
  last: { c: number; r: number } | null;
  /** Felder der Gewinnreihe(n) als [Spalte, Zeile] */
  line: [number, number][];
}

export type VierAction = { type: "drop"; col: number };

export const COLOR_NAME = ["Rot", "Gelb"] as const;

export const SIZES: Record<string, [number, number]> = { "7x6": [7, 6], "8x7": [8, 7], "9x7": [9, 7] };
export const sizeOf = (o: Options): [number, number] => SIZES[String(o.size)] ?? SIZES["7x6"];

const DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];

const at = (s: VierState, c: number, r: number): Side | undefined => (c >= 0 && c < s.cols ? s.grid[c][r] : undefined);

/** Alle Felder in Reihen von mindestens vier durch (c, r) */
export function linesThrough(s: VierState, c: number, r: number): [number, number][] {
  const me = at(s, c, r);
  if (me === undefined) return [];
  const out: [number, number][] = [];
  for (const [dc, dr] of DIRS) {
    const cells: [number, number][] = [[c, r]];
    for (const sign of [1, -1]) {
      for (let k = 1; ; k++) {
        const x = c + sign * dc * k, y = r + sign * dr * k;
        if (at(s, x, y) !== me) break;
        cells.push([x, y]);
      }
    }
    if (cells.length >= 4) out.push(...cells.filter(([x, y]) => !out.some(([a, b]) => a === x && b === y)));
  }
  return out;
}

export const canDrop = (s: VierState, col: number) => Number.isInteger(col) && col >= 0 && col < s.cols && s.grid[col].length < s.rows;

/** Spalten, in denen `side` sofort gewinnen würde (für die Spielhilfe) */
export function winningCols(s: VierState, side: Side): number[] {
  const out: number[] = [];
  for (let c = 0; c < s.cols; c++) {
    if (!canDrop(s, c)) continue;
    const t = { ...s, grid: s.grid.map((col, i) => (i === c ? [...col, side] : col)) };
    if (linesThrough(t, c, s.grid[c].length).length) out.push(c);
  }
  return out;
}

export const vier = duelGame<VierState, VierAction>({
  info: {
    id: "vier",
    name: "Vier in einer Reihe",
    tagline: "Steine in die Spalten fallen lassen – wer zuerst vier in einer Reihe hat, gewinnt.",
    category: "Brett",
    minPlayers: 2,
    maxPlayers: 2,
    duration: "5–10 Min.",
  },
  version: 1,
  settings: [
    {
      key: "size", label: "Brett", type: "choice", default: "7x6",
      choices: [
        { value: "7x6", label: "7 × 6", hint: "klassisch" },
        { value: "8x7", label: "8 × 7", hint: "größer" },
        { value: "9x7", label: "9 × 7", hint: "noch größer" },
      ],
    },
  ],
  actions: ["drop"],
  setup(ctx: GameContext): VierState {
    const [cols, rows] = sizeOf(ctx.options);
    return { ...duelBase(ctx), cols, rows, grid: Array.from({ length: cols }, () => []), last: null, line: [] };
  },
  moves: (s) => Array.from({ length: s.cols }, (_, col) => ({ type: "drop" as const, col })).filter((a) => canDrop(s, a.col)),
  play(s, a, ctx) {
    if (a.type !== "drop") throw new GameError("Unbekannte Aktion.");
    if (!canDrop(s, a.col)) throw new GameError(Number.isInteger(a.col) && a.col >= 0 && a.col < s.cols ? "Diese Spalte ist voll." : "Diese Spalte gibt es nicht.");
    const side = s.turn;
    const r = s.grid[a.col].length;
    s.grid[a.col].push(side);
    s.last = { c: a.col, r };
    s.n++;
    const who = nameOf(ctx, s.colors[side]);
    pushLog(s, `${who} (${COLOR_NAME[side]}): Spalte ${a.col + 1}`);
    const line = linesThrough(s, a.col, r);
    if (line.length) {
      s.line = line;
      win(s, side, "hat vier in einer Reihe");
      pushLog(s, `${who} hat vier in einer Reihe`);
      return;
    }
    if (s.grid.every((col) => col.length >= s.rows)) {
      drawn(s, "Das Brett ist voll – keiner hat vier in einer Reihe");
      pushLog(s, "Brett voll – unentschieden");
      return;
    }
    s.turn = other(side);
  },
});
