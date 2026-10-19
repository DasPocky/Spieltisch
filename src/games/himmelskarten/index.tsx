import type { RoomState } from "@shared/platform/room";
import { himmelskarten, type SkAction, type SkState } from "@shared/games/himmelskarten/logic";
import type { GameUI } from "@/games/types";
import { Board } from "./Board";
import { Icon } from "./Icon";



function Rules() {
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Ziel</h3>
      <p className="mt-1.5">Möglichst <b className="text-foreground">wenige Punkte</b>. Sobald jemand das Spielende (Standard 100) erreicht, gewinnt, wer am wenigsten hat.</p>
      <h3 className="mt-4 font-semibold text-foreground">Karten</h3>
      <p className="mt-1.5">150 Karten von −2 bis 12. Jeder bekommt 12 Karten verdeckt in 3 Reihen × 4 Spalten und deckt zu Beginn zwei davon auf. Wer die höchste Summe hat, beginnt (ab Runde 2: wer die letzte Runde beendet hat).</p>
      <h3 className="mt-4 font-semibold text-foreground">Ein Zug</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li><b className="text-foreground">Offene Karte nehmen</b> und gegen eine eigene Karte tauschen (offen oder verdeckt), oder</li>
        <li><b className="text-foreground">vom Stapel ziehen</b>: tauschen – oder ablegen und dafür eine verdeckte Karte umdrehen.</li>
        <li>Drei gleiche offene Karten in einer <b className="text-foreground">Spalte</b> kommen weg.</li>
      </ol>
      <h3 className="mt-4 font-semibold text-foreground">Rundenende</h3>
      <p className="mt-1.5">
        Hat jemand alle Karten offen, ist jeder andere noch genau einmal dran. Dann werden alle Karten aufgedeckt (drei Gleiche in einer Spalte fallen auch jetzt noch weg) und zusammengezählt.
        Wer die Runde beendet hat, aber <b className="text-foreground">nicht allein am wenigsten</b> Punkte hat, zahlt seine Punkte doppelt (nur bei Plus-Punkten).
      </p>
      <h3 className="mt-4 font-semibold text-foreground">Varianten</h3>
      <p className="mt-1.5">
        <b className="text-foreground">In der App:</b> an einem Handy für alle oder online jeder am eigenen Handy – offene Karten sehen alle, verdeckte niemand.
        <br /><b className="text-foreground">Echte Karten:</b> ihr spielt mit euren eigenen Karten, die App ist der Punkteblock. Online trägt jeder seine Punkte selbst ein.
      </p>
    </section>
  );
}


/** Verlauf und Spielerübersicht für „Spieler & Verlauf“ */
const log = (s: SkState) => (s.mode === "table" ? [] : s.log);
const overview = (s: SkState, room: RoomState) => s.mode === "table" ? null : ({
  cols: ["Offen", "Gesamt"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [(s.grids[p.id] ?? []).reduce((a, c) => a + (c?.up && c.v !== null ? c.v : 0), 0), s.scores[p.id] ?? 0]])),
  curId: s.phase === "turn" ? s.curId : null,
});

export const himmelskartenUI: GameUI<SkState, SkAction> = { logic: himmelskarten, Icon, Board, Rules, log, overview };
