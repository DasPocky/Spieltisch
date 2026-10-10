import type { RoomState } from "@shared/platform/room";
import { COLOR_NAME, count, muehle, type MuehleAction, type MuehleState } from "@shared/games/muehle/logic";
import type { GameUI } from "@/games/types";
import { ResignMenu } from "@/games/_board/Duel";
import { RuleBlock } from "@/games/_board/RuleBlock";
import { Board } from "./Board";
import { Icon } from "./Icon";



function Rules() {
  return (
    <>
      <RuleBlock title="Ziel">Nimm deinem Gegner so viele Steine, dass er nur noch zwei hat – oder schließe ihn ein, sodass er nicht mehr ziehen kann.</RuleBlock>
      <RuleBlock title="Das Brett">
        Drei ineinanderliegende Quadrate, in der Mitte jeder Seite verbunden – zusammen 24 Punkte. Jeder hat 9 Steine, Weiß fängt an.
        Bei „Nochmal“ tauscht ihr die Farben.
      </RuleBlock>
      <RuleBlock title="1. Setzen">
        Abwechselnd setzt ihr eure Steine einzeln auf freie Punkte, bis alle 18 auf dem Brett sind.
      </RuleBlock>
      <RuleBlock title="2. Ziehen">
        Danach zieht ihr abwechselnd einen eigenen Stein entlang einer Linie auf einen freien Nachbarpunkt. Tippe erst deinen Stein an, dann das Ziel.
      </RuleBlock>
      <RuleBlock title="3. Springen">
        Wer nur noch drei Steine hat, darf mit einem Stein auf jeden freien Punkt springen. (Abschaltbar – dann wird bis zum Schluss gezogen.)
      </RuleBlock>
      <RuleBlock title="Mühle">
        Drei eigene Steine in einer Linie sind eine <b>Mühle</b>. Wer eine Mühle schließt – beim Setzen, Ziehen oder Springen –, nimmt einen Stein des Gegners vom Brett.
        Steine, die selbst in einer Mühle stehen, sind geschützt; nur wenn alle gegnerischen Steine in Mühlen stehen, darf auch einer davon genommen werden.
        Eine Mühle zu öffnen und wieder zu schließen zählt jedes Mal neu.
      </RuleBlock>
      <RuleBlock title="Ende">
        Verloren hat, wer nach dem Setzen weniger als drei Steine hat oder nicht mehr ziehen kann. Im Menü kannst du aufgeben.
      </RuleBlock>
      <RuleBlock title="Einstellungen">
        <b>Unentschieden</b>: Im Original spielt ihr aus. Wer mag, stellt ein, dass die Partie nach 20 oder 50 Zügen je Spieler ohne Mühle unentschieden endet.
        <br /><b>Brett drehen</b>: Mit einem Handy dreht sich das Brett zu dem, der dran ist. Online sieht jeder seine Farbe unten.
        <br /><b>Spielhilfe</b>: zeigt, welche Steine ziehen können, wohin, und welche Steine du nach einer Mühle nehmen darfst.
      </RuleBlock>
    </>
  );
}

const log = (s: MuehleState) => s.log;
const overview = (s: MuehleState, room: RoomState) => ({
  cols: ["Farbe", "Brett", "Hand"],
  rows: Object.fromEntries(room.players.map((p) => {
    const i = s.colors.indexOf(p.id);
    if (i < 0) return [p.id, ["–", 0, 0]];
    const side = i as 0 | 1;
    return [p.id, [COLOR_NAME[side], count(s, side), s.hand[side]]];
  })),
  curId: s.winner !== null || s.draw ? null : s.colors[s.turn],
});

export const muehleUI: GameUI<MuehleState, MuehleAction> = { logic: muehle, Icon, Board, Rules, log, overview, MenuExtras: ResignMenu as never };
