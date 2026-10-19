import type { RoomState } from "@shared/platform/room";
import { eins, type EinsAction, type EinsState } from "@shared/games/eins/logic";
import type { GameUI } from "@/games/types";
import { Board, EinsCardView } from "./Board";
import { Icon } from "./Icon";



const SPECIAL = [
  { card: "b-skip", title: "Aussetzen", text: "Der Nächste ist nicht dran." },
  { card: "g-rev", title: "Richtungswechsel", text: "Die Spielrichtung dreht sich. Zu zweit wirkt die Karte wie Aussetzen." },
  { card: "r-plus2", title: "+2", text: "Der Nächste zieht zwei Karten und setzt aus. Stapeln ist im Original nicht erlaubt (Hausregel)." },
  { card: "w-wild", title: "Farbwahl", text: "Passt immer. Du bestimmst die Farbe, die als Nächstes bedient werden muss." },
  { card: "w-plus4", title: "+4", text: "Farbwahl – und der Nächste zieht vier und setzt aus. Erlaubt ist sie nur, wenn du keine Karte in der gefragten Farbe hast. Bluffen geht trotzdem: Der Nächste darf anzweifeln. Hattest du die Farbe, ziehst du 4 statt ihm – sonst zieht er 6 und setzt aus." },
] as const;

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
        <h3 className="font-semibold text-foreground">Ziel</h3>
        <p className="mt-1.5">Als Erster alle Karten loswerden. Bei „Bis 500“ bekommt der Rundensieger die Kartenpunkte der anderen (Zahl = Wert, Aktion 20, Schwarz 50) – wer zuerst 500 hat, gewinnt.</p>
        <h3 className="mt-4 font-semibold text-foreground">So geht's</h3>
        <p className="mt-1.5">
          108 Karten, jeder bekommt 7. Leg eine Karte, die in <b className="text-foreground">Farbe oder Zahl/Symbol</b> zur obersten passt.
          Kannst oder willst du nicht, ziehst du eine – passt sie, darfst du sie gleich legen, sonst ist der Nächste dran.
        </p>
        <p className="mt-1.5">
          Die <b className="text-foreground">Startkarte</b> wirkt auf den Ersten: Aussetzen und +2 treffen ihn, bei Richtungswechsel beginnt der Spieler vor ihm und es geht andersherum, bei Farbwahl bestimmt er die Farbe. Eine +4 wird zurückgemischt.
          Endet die Runde mit +2 oder +4, zieht der Nächste trotzdem – die Karten zählen mit.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">„Eins!“</h3>
        <p className="mt-1.5">Bevor du deine vorletzte Karte legst, tippst du auf <b className="text-foreground">Eins!</b>. Vergessen: zwei Strafkarten.</p>
        <h3 className="mt-4 font-semibold text-foreground">Hausregeln (einstellbar)</h3>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          <li><b className="text-foreground">Ziehkarten stapeln:</b> +2 auf +2, +4 auf jede Ziehkarte – der Letzte zieht alles.</li>
          <li><b className="text-foreground">Ziehen, bis es passt:</b> statt nur einer Karte.</li>
          <li><b className="text-foreground">7-0:</b> Mit einer 7 tauschst du deine Hand mit jemandem, bei einer 0 geben alle ihre Hand in Spielrichtung weiter.</li>
          <li><b className="text-foreground">+4:</b> nur ohne passende Farbe (kein Bluff) oder immer.</li>
        </ul>
        <h3 className="mt-4 font-semibold text-foreground">Varianten</h3>
        <p className="mt-1.5">
          <b className="text-foreground">In der App:</b> an einem Handy mit Sichtschutz beim Weitergeben oder online jeder am eigenen Handy.
          <br /><b className="text-foreground">Echte Karten:</b> ihr spielt mit euren eigenen Karten, die App ist der Punkteblock.
        </p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Sonderkarten</h3>
      <ul className="grid gap-2">
        {SPECIAL.map((x) => (
          <li key={x.card} className="glass flex gap-3 rounded-xl p-3">
            <EinsCardView card={x.card} className="w-11 shrink-0 self-start" />
            <div><b>{x.title}</b><p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{x.text}</p></div>
          </li>
        ))}
      </ul>
    </>
  );
}


/** Verlauf und Spielerübersicht für „Spieler & Verlauf“ */
const log = (s: EinsState) => (s.mode === "table" ? [] : s.log);
const overview = (s: EinsState, room: RoomState) => s.mode === "table" ? null : ({
  cols: room.options.target === "round" ? ["Karten"] : ["Karten", "Punkte"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, room.options.target === "round" ? [s.counts[p.id] ?? 0] : [s.counts[p.id] ?? 0, s.scores[p.id] ?? 0]])),
  curId: s.phase === "play" ? s.curId : null,
});

export const einsUI: GameUI<EinsState, EinsAction> = { logic: eins, Icon, Board, Rules, log, overview };
