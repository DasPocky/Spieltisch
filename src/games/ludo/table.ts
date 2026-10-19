import type { RoomState } from "@shared/platform/room";
import { COLOR_NAMES, PIECES, type LudoState } from "@shared/games/ludo/logic";
import type { TableModel } from "../../platform/table/model";
import { layout, pointOf } from "./geometry";
import { PALETTE } from "./colors";

/** Ludo am Tisch: das Brett flach in der Mitte, Figuren stehen darauf und laufen weiter, der Würfel liegt daneben */
export function ludoTable(room: RoomState): TableModel | null {
  const s = room.game as LudoState;
  const L = layout(s.board, 0);
  const pieces = room.players.flatMap((p) => {
    const color = s.color[p.id];
    if (color === undefined) return [];
    return (s.pos[p.id] ?? []).slice(0, PIECES).map((pos, k) => {
      const [x, y] = pointOf(L, s.board, color, pos, k);
      return { x: x / L.half, y: y / L.half, color: PALETTE[color].fill, kind: "pawn" as const, id: `${p.id}:${k}` };
    });
  });
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.finished ? null : s.curId, n: s.moves, log: s.log.slice(-6),
    notes: Object.fromEntries(room.players.map((p) => [p.id, s.places.includes(p.id) ? `${COLOR_NAMES[s.color[p.id]] ?? ""} · Platz ${s.places.indexOf(p.id) + 1}` : COLOR_NAMES[s.color[p.id]] ?? ""])),
    tabletop: { board: s.board === 6 ? "ludo:6" : "ludo:4", pieces, die: { value: s.shown, n: s.rolls } },
  };
}
