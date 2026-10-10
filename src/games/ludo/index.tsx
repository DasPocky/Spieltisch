import { COLOR_NAMES, HOME, inGoal, ludo, trackLen, type LudoAction, type LudoState } from "@shared/games/ludo/logic";
import type { GameUI } from "@/games/types";
import { Board } from "./Board";
import { Rules } from "./Rules";
import { Icon } from "./Icon";



export const ludoUI: GameUI<LudoState, LudoAction> = {
  logic: ludo,
  Icon,
  Board,
  Rules,
  log: (g) => g.log,
  overview: (g, room) => ({
    cols: ["Farbe", "Draußen", "Im Ziel"],
    rows: Object.fromEntries(room.players.filter((p) => g.pos[p.id]).map((p) => [p.id, [
      COLOR_NAMES[g.color[p.id]],
      g.pos[p.id].filter((x) => x !== HOME && x < trackLen(g.board)).length,
      inGoal(g, p.id),
    ]])),
    curId: g.curId,
  }),
};
