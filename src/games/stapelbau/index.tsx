import type { RoomState } from "@shared/platform/room";
import { stapelbau, type SbAction, type SbState } from "@shared/games/stapelbau/logic";
import type { GameUI } from "@/games/types";
import { Board } from "./Board";
import { Icon } from "./Icon";



function Rules() {
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Ziel</h3>
      <p className="mt-1.5">Als Erster den eigenen <b className="text-foreground">Vorrat</b> loswerden (30 Karten, ab 5 Spielern 20).</p>
      <h3 className="mt-4 font-semibold text-foreground">Karten</h3>
      <p className="mt-1.5">162 Karten: zwölfmal die Zahlen 1 bis 12 und 18 <b className="text-foreground">Joker</b>, die für jede Zahl stehen.</p>
      <h3 className="mt-4 font-semibold text-foreground">Ein Zug</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Hand auf fünf Karten auffüllen (macht die App).</li>
        <li>Karten auf die vier gemeinsamen <b className="text-foreground">Aufbaustapel</b> legen – jeder beginnt mit 1 und geht bis 12. Erlaubt sind Handkarten, die oberste Vorratskarte und die obersten Karten deiner Ablagen.</li>
        <li>Hand leer gespielt? Du ziehst fünf neue und machst weiter.</li>
        <li>Zum Schluss legst du eine Handkarte auf eine deiner <b className="text-foreground">vier Ablagen</b> – damit ist der Zug vorbei.</li>
      </ol>
      <p className="mt-2">Ist ein Aufbaustapel bei 12 angekommen, wird er weggelegt und später wieder eingemischt.</p>
      <h3 className="mt-4 font-semibold text-foreground">Bedienung</h3>
      <p className="mt-1.5">Erst die Karte antippen, dann den Stapel, auf den sie soll. Passende Stapel leuchten auf.</p>
      <h3 className="mt-4 font-semibold text-foreground">Varianten</h3>
      <p className="mt-1.5">
        <b className="text-foreground">In der App:</b> an einem Handy mit Sichtschutz oder online jeder am eigenen Handy.
        <br /><b className="text-foreground">Echte Karten:</b> ihr spielt mit euren eigenen Karten, die App zählt Punkte (Sieger: 25 + 5 je Vorratskarte der anderen).
      </p>
    </section>
  );
}


/** Verlauf und Spielerübersicht für „Spieler & Verlauf“ */
const log = (s: SbState) => (s.mode === "table" ? [] : s.log);
const overview = (s: SbState, room: RoomState) => s.mode === "table" ? null : ({
  cols: room.options.target === "500" ? ["Vorrat", "Hand", "Punkte"] : ["Vorrat", "Hand"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.stockCounts[p.id] ?? 0, s.handCounts[p.id] ?? 0, ...(room.options.target === "500" ? [s.scores[p.id] ?? 0] : [])]])),
  curId: s.phase === "play" ? s.curId : null,
});

export const stapelbauUI: GameUI<SbState, SbAction> = { logic: stapelbau, Icon, Board, Rules, log, overview };
