import type { RoomState } from "@shared/platform/room";
import { COLOR_NAME, pointXY, type MuehleState } from "@shared/games/muehle/logic";
import type { TableModel } from "../../platform/table/model";
import { STONE_COLOR } from "../dame/table";

/** Punkt auf dem Brett in Brett-Koordinaten (Raster 0 … 6 → -0.88 … 0.88) */
const at = (i: number): [number, number] => { const [x, y] = pointXY(i); return [(x - 3) * 0.293, (y - 3) * 0.293]; };

/** Mühle am Tisch: Brett in der Mitte, noch zu setzende Steine links (Weiß) und rechts (Schwarz) daneben */
export function muehleTable(room: RoomState): TableModel | null {
  const s = room.game as MuehleState;
  const onBoard = s.board.flatMap((v, i) => (v === null ? [] : [{ x: at(i)[0], y: at(i)[1], color: STONE_COLOR[v], kind: "stone" as const }]));
  const hand = ([0, 1] as const).flatMap((side) => Array.from({ length: s.hand[side] }, (_, k) => ({
    x: side === 0 ? -1.22 : 1.22, y: -0.8 + k * 0.2, color: STONE_COLOR[side], kind: "stone" as const,
  })));
  const handTop = (side: 0 | 1): [number, number] => [side === 0 ? -1.22 : 1.22, -0.8 + s.hand[side] * 0.2];
  const mover = s.last && s.last.to !== null ? s.board[s.last.to] : null;
  const move = s.last && s.last.to !== null && mover !== null ? { from: s.last.from !== null ? at(s.last.from) : handTop(mover), to: at(s.last.to) } : null;
  const note = s.winner === null && !s.draw && s.remove ? `${COLOR_NAME[s.turn]} hat eine Mühle – nimmt einen Stein` : undefined;
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.winner === null && !s.draw ? s.colors[s.turn] : null, n: s.n, log: s.log.slice(-6),
    notes: { [s.colors[0]]: `${COLOR_NAME[0]} · ${s.hand[0]} zu setzen`, [s.colors[1]]: `${COLOR_NAME[1]} · ${s.hand[1]} zu setzen` },
    tabletop: { board: "muehle", pieces: [...onBoard, ...hand], move, note },
  };
}
