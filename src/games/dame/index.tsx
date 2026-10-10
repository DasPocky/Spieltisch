import type { RoomState } from "@shared/platform/room";
import { COLOR_NAME, dame, isKing, ownedBy, type DameAction, type DameState } from "@shared/games/dame/logic";
import type { GameUI } from "@/games/types";
import { ResignMenu } from "@/games/_board/Duel";
import { RuleBlock } from "@/games/_board/RuleBlock";
import { Board } from "./Board";
import { Icon } from "./Icon";



function Rules() {
  return (
    <>
      <RuleBlock title="Ziel">Schlag alle Steine deines Gegners – oder stell ihn so zu, dass er nicht mehr ziehen kann.</RuleBlock>
      <RuleBlock title="Aufbau">
        Gespielt wird nur auf den dunklen Feldern eines 8 × 8-Bretts (links unten liegt ein dunkles Feld). Jeder hat 12 Steine auf den drei Reihen vor sich.
        Weiß fängt an; bei „Nochmal“ tauscht ihr die Farben.
      </RuleBlock>
      <RuleBlock title="Ziehen">
        Ein Stein zieht ein Feld schräg nach vorn auf ein freies Feld. Tippe deinen Stein an, dann das Ziel.
      </RuleBlock>
      <RuleBlock title="Schlagen">
        Steht ein gegnerischer Stein schräg neben deinem und dahinter ist frei, springst du darüber und nimmst ihn vom Brett –
        <b> vorwärts und rückwärts</b>. Kannst du vom Landefeld aus weiter schlagen, musst du weiterspringen (Mehrfachschlag), bis nichts mehr geht.
        Tippe dazu jedes Landefeld der Reihe nach an. Geschlagene Steine verschwinden erst am Ende des Zuges und dürfen nicht zweimal übersprungen werden.
      </RuleBlock>
      <RuleBlock title="Schlagzwang">
        Kannst du schlagen, musst du schlagen. Hast du mehrere Möglichkeiten, darfst du frei wählen – du musst nicht die mit den meisten Steinen nehmen.
        Einen angefangenen Mehrfachschlag führst du aber zu Ende.
      </RuleBlock>
      <RuleBlock title="Dame">
        Erreicht ein Stein die hinterste Reihe und bleibt dort stehen, wird er zur <b>Dame</b> (mit Krone). Springt er beim Mehrfachschlag nur über die Reihe hinweg weiter, bleibt er ein Stein.
        Die Dame zieht schräg beliebig weit, vorwärts und rückwärts (<b>fliegende Dame</b>). Sie schlägt auch aus der Ferne: über genau einen gegnerischen Stein,
        hinter dem frei ist, und landet auf einem beliebigen freien Feld dahinter.
      </RuleBlock>
      <RuleBlock title="Ende">
        Verloren hat, wer keine Steine mehr hat oder nicht mehr ziehen kann. Im Menü kannst du aufgeben.
        Ziehen beide nur noch mit Damen hin und her, endet die Partie unentschieden, wenn je 25 Züge lang nichts geschlagen wurde (einstellbar).
      </RuleBlock>
      <RuleBlock title="Hausregeln">
        <b>Pusten</b>: Statt Schlagzwang darfst du auch normal ziehen. Hättest du schlagen können, darf dein Gegner vor seinem Zug den Stein, der hätte schlagen können, „wegpusten“ (antippen) – danach zieht er ganz normal.
        <br /><b>Freiwillig schlagen</b>: Kein Schlagzwang und kein Pusten.
        <br /><b>Damen nur ein Feld</b> (englische Art): Die Dame zieht und schlägt wie ein Stein, nur auch rückwärts.
        <br /><b>Steine schlagen nur vorwärts</b> (englische Art).
        <br /><b>10 × 10</b>: großes Brett mit je 20 Steinen auf vier Reihen, sonst gleiche Regeln.
      </RuleBlock>
      <RuleBlock title="Ein Handy, zwei Handys">
        Online sieht jeder seine Steine unten. Mit einem Handy dreht sich das Brett auf Wunsch zu dem, der dran ist (Einstellung „Brett für Schwarz drehen“).
        Die Spielhilfe zeigt, welche Steine ziehen können (rot: Schlagzwang) und wohin.
      </RuleBlock>
    </>
  );
}

const log = (s: DameState) => s.log;
const overview = (s: DameState, room: RoomState) => ({
  cols: ["Farbe", "Steine", "Damen"],
  rows: Object.fromEntries(room.players.map((p) => {
    const side = s.colors.indexOf(p.id);
    if (side < 0) return [p.id, ["–", 0, 0]];
    const own = s.board.filter((v) => ownedBy(v, side as 0 | 1));
    return [p.id, [COLOR_NAME[side], own.length, own.filter(isKing).length]];
  })),
  curId: s.winner !== null || s.draw ? null : s.colors[s.turn],
});

export const dameUI: GameUI<DameState, DameAction> = { logic: dame, Icon, Board, Rules, log, overview, MenuExtras: ResignMenu as never };
