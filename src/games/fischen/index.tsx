import type { RoomState } from "@shared/platform/room";
import { DECKS, RANK_PLURAL } from "@shared/cards/deck";
import { fischen, type FischenAction, type FischenState } from "@shared/games/fischen/logic";
import type { GameUI } from "@/games/types";
import { PlayingCard } from "@/platform/cards/PlayingCard";
import { Board } from "./Board";
import { Icon } from "./Icon";



function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Sammle Quartette – alle vier Karten eines Werts. Wer am Ende die meisten hat, gewinnt.</p>
        <h3 className="mt-4 font-semibold">So geht's</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Gespielt wird mit 52 Karten (13 Quartette) oder – einstellbar – mit 32 Karten, französisch oder deutsch. Jeder bekommt 7 Karten (ab 4 Spielern 5), der Rest ist der Teich.</li>
          <li>Wer dran ist, tippt oben einen Mitspieler an und unten einen Stapel aus der eigenen Hand: „Ben, hast du Könige?“ – <b className="text-foreground">man kann nur nach Werten fragen, die man selbst auf der Hand hat.</b></li>
          <li>Hat Ben Könige, muss er <b className="text-foreground">alle</b> abgeben, und du darfst weiterfragen.</li>
          <li>Hat er keine, heißt es <b className="text-foreground">„Geh fischen!“</b>: Du ziehst eine Karte aus dem Teich. Ist es genau der gefragte Wert, bist du nochmal dran (Einstellung). Sonst ist der linke Nachbar dran – oder, wenn so eingestellt, der Gefragte, der „Geh fischen!“ gesagt hat.</li>
          <li>Vier Gleiche werden sofort als Quartett abgelegt. Wer keine Karten mehr hat, zieht zu Beginn seines Zugs eine aus dem Teich.</li>
        </ol>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Alle Fragen sind öffentlich – merk dir, wer wonach gefragt hat!</p>
        <h3 className="mt-4 font-semibold">Mit echten Karten</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Ihr spielt mit eurem eigenen Kartenspiel am Tisch. Die App zeigt, wer dran ist, und zählt die Quartette:
          Liegt ein Quartett, tippt der Spieler am Zug den Wert an und wählt, wer es gelegt hat (auch Quartette, die schon beim Austeilen liegen).
          Heißt es „Geh fischen!“, tippt er auf <b className="text-foreground">Geh fischen – Zug vorbei</b>. Sind alle Quartette gelegt, zeigt die App den Sieger.
        </p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Die Quartette (52 Karten)</h3>
      <div className="grid grid-cols-5 gap-2">
        {DECKS.fr52.ranks.map((r) => (
          <div key={r} className="text-center text-xs text-muted-foreground">
            <PlayingCard card={`herz-${r}`} className="mx-auto w-11" />
            <div className="mt-1">{RANK_PLURAL[r]}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Spielerübersicht für „Spieler & Verlauf“ */
const overview = (s: FischenState, room: RoomState) => s.table ? null : ({
  cols: ["Karten", "Quartette"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.counts[p.id] ?? 0, s.quartets[p.id]?.length ?? 0]])),
  curId: s.finished ? null : s.curId,
});

export const fischenUI: GameUI<FischenState, FischenAction> = { logic: fischen, Icon, Board, Rules, overview };
