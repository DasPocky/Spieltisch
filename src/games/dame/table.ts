import type { RoomState } from "@shared/platform/room";
import { COLOR_NAME, isKing, type DameState } from "@shared/games/dame/logic";
import type { TableModel } from "../../platform/table/model";

export const STONE_COLOR = ["#f3ede0", "#2b2522"] as const;

/** Dame am Tisch: das Brett flach in der Mitte, Weiß vorn – der letzte Zug gleitet sichtbar */
export function dameTable(room: RoomState): TableModel | null {
  const s = room.game as DameState;
  const n = s.size;
  const at = (i: number): [number, number] => [-1 + ((i % n) + 0.5) * (2 / n), 1 - (Math.floor(i / n) + 0.5) * (2 / n)];
  const pieces = s.board.flatMap((v, i) => (v === 0 ? [] : [{ ...xy(at(i)), color: STONE_COLOR[v > 0 ? 0 : 1], kind: isKing(v) ? ("king" as const) : ("stone" as const) }]));
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.winner === null && !s.draw ? s.colors[s.turn] : null, n: s.n, log: s.log.slice(-6),
    notes: { [s.colors[0]]: COLOR_NAME[0], [s.colors[1]]: COLOR_NAME[1] },
    tabletop: { board: n === 10 ? "dame:10" : "dame:8", pieces, move: s.last ? { from: at(s.last.from), to: at(s.last.path.at(-1) ?? s.last.from) } : null },
  };
}

const xy = ([x, y]: [number, number]) => ({ x, y });
