import type { RoomState } from "@shared/platform/room";
import { COLOR_NAME, vier, type VierAction, type VierState } from "@shared/games/vier/logic";
import type { GameUI } from "@/games/types";
import { ResignMenu } from "@/games/_board/Duel";
import { RuleBlock } from "@/games/_board/RuleBlock";
import { Board } from "./Board";
import { Icon } from "./Icon";



function Rules() {
  return (
    <>
      <RuleBlock title="Ziel">Bring vier Steine deiner Farbe in eine Reihe – waagerecht, senkrecht oder schräg.</RuleBlock>
      <RuleBlock title="So geht's">
        Das Brett steht senkrecht, 7 Spalten breit und 6 Reihen hoch. Ihr seid abwechselnd dran: Tippe eine Spalte an, dein Stein fällt bis ganz nach unten
        auf den untersten freien Platz. Volle Spalten gehen nicht mehr. Rot fängt an; bei „Nochmal“ tauscht ihr die Farben, so beginnt jeder mal.
      </RuleBlock>
      <RuleBlock title="Ende">
        Wer zuerst vier in einer Reihe hat, gewinnt – die Reihe leuchtet auf. Ist das Brett voll und keiner hat eine Reihe, ist es unentschieden.
        Im Menü kannst du aufgeben.
      </RuleBlock>
      <RuleBlock title="Einstellungen">
        Das Brett gibt es in 7 × 6 (klassisch), 8 × 7 und 9 × 7 – größere Bretter machen die Partie länger und offener.
        Die Spielhilfe zeigt dir, wenn du mit einem Stein gewinnen kannst oder dein Gegner gleich gewinnen würde.
      </RuleBlock>
    </>
  );
}

const log = (s: VierState) => s.log;
const overview = (s: VierState, room: RoomState) => ({
  cols: ["Farbe", "Steine"],
  rows: Object.fromEntries(room.players.map((p) => {
    const side = s.colors.indexOf(p.id);
    return [p.id, side < 0 ? ["–", 0] : [COLOR_NAME[side], s.grid.flat().filter((x) => x === side).length]];
  })),
  curId: s.winner !== null || s.draw ? null : s.colors[s.turn],
});

export const vierUI: GameUI<VierState, VierAction> = { logic: vier, Icon, Board, Rules, log, overview, MenuExtras: ResignMenu as never };
