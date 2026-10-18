import type { RoomState } from "@shared/platform/room";
import { COLOR_NAME, type VierState } from "@shared/games/vier/logic";
import type { TableModel } from "../../platform/table/model";

/** Vier gewinnt am Tisch: das Brett groß in der Mitte, Farbe an den Plätzen */
export function vierTable(room: RoomState): TableModel | null {
  const s = room.game as VierState;
  // Zeilen von oben nach unten; s.grid speichert je Spalte von unten nach oben
  const cells = Array.from({ length: s.rows }, (_, r) => Array.from({ length: s.cols }, (_, c) => s.grid[c][s.rows - 1 - r] ?? null));
  const flip = ([c, r]: [number, number]): [number, number] => [c, s.rows - 1 - r];
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.winner === null && !s.draw ? s.colors[s.turn] : null, n: s.n, log: s.log.slice(-6),
    notes: { [s.colors[0]]: COLOR_NAME[0], [s.colors[1]]: COLOR_NAME[1] },
    grid: { cells, colors: ["#d0453b", "#e8c13a"], last: s.last ? flip([s.last.c, s.last.r]) : null, line: s.line.map(flip) },
  };
}
