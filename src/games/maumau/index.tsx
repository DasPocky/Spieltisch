import type { RoomState } from "@shared/platform/room";
import { maumau, type MauMauAction, type MauMauState } from "@shared/games/maumau/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Board } from "./Board";
import { Rules } from "./Rules";
import { Icon } from "./Icon";



function HeaderExtra({ game }: BoardProps<MauMauState, MauMauAction>) {
  if (game.mode === "table") return null;
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border">
      <b className="text-foreground tabular-nums">{game.pileCount}</b><span className="max-[359px]:hidden"> im Stapel</span>
    </span>
  );
}


/** Verlauf und Spielerübersicht für „Spieler & Verlauf“ */
const log = (s: MauMauState) => (s.mode === "table" ? [] : s.log);
const overview = (s: MauMauState, room: RoomState) => s.mode === "table" ? null : ({
  cols: ["Karten"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.counts[p.id] ?? 0]])),
  curId: s.winnerId ? null : s.curId,
});

export const maumauUI: GameUI<MauMauState, MauMauAction> = { logic: maumau, Icon, Board, Rules, HeaderExtra, log, overview };
