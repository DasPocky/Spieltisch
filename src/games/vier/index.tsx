import type { RoomState } from "@shared/platform/room";
import { COLOR_NAME, vier, type VierAction, type VierState } from "@shared/games/vier/logic";
import type { GameUI } from "@/games/types";
import { ResignMenu } from "@/games/_board/Duel";
import { RuleBlock } from "@/games/_board/RuleBlock";
import { Board, DISC } from "./Board";

/** Symbol: blaues Gitter mit roten und gelben Steinen */
function Icon({ className }: { className?: string }) {
  const cells = [
    [0, 2, 1], [1, 2, 0], [2, 2, 0], [3, 2, 1],
    [1, 1, 1], [2, 1, 0], [3, 1, -1], [0, 1, -1],
    [2, 0, 1], [0, 0, -1], [1, 0, -1], [3, 0, -1],
  ];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="4" y="8" width="32" height="25" rx="4" fill="#2559c4" />
      {cells.map(([c, r, v]) => (
        <circle key={`${c}${r}`} cx={9.5 + c * 7} cy={28 - r * 7.2} r="2.7" fill={v === 0 ? DISC[0] : v === 1 ? DISC[1] : "#0b1f4a"} />
      ))}
    </svg>
  );
}

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
