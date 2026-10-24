import type { RoomState } from "@shared/platform/room";
import { DIR_NAME, herzen, type HzAction, type HzState } from "@shared/games/herzen/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { cn } from "@/lib/utils";
import { PlayingCard } from "@/platform/cards/PlayingCard";
import { Board } from "./Board";
import { Icon } from "./Icon";

const B = ({ children }: { children: React.ReactNode }) => <b className="text-foreground">{children}</b>;

function Rules({ focus }: { focus?: string }) {
  return (
    <>
      <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
        <h3 className="font-semibold text-foreground">Ziel</h3>
        <p className="mt-1.5">Möglichst <B>wenig Punkte</B> sammeln. Sobald jemand 100 Punkte erreicht, ist Schluss – wer dann am wenigsten hat, gewinnt.</p>
        <h3 className="mt-4 font-semibold text-foreground">Karten</h3>
        <p className="mt-1.5">
          52 Karten, Ass ist hoch. Jeder bekommt gleich viele: zu viert 13. Zu dritt fällt die Karo-2 weg, zu fünft auch die Pik-2,
          zu sechst zusätzlich Karo-3 und Pik-3.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">Weitergeben</h3>
        <p className="mt-1.5">
          Vor jeder Runde gibt jeder <B>drei Karten</B> weiter – im Wechsel nach links, nach rechts, nach gegenüber und einmal gar nicht
          (bei ungerader Spielerzahl ohne „gegenüber“). Erst wenn alle gewählt haben, werden die Karten getauscht.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">Spielen</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Wer die <B>Kreuz-Zwei</B> hat, spielt sie aus. Danach spielt aus, wer den letzten Stich genommen hat.</li>
          <li><B>Farbe bedienen</B> ist Pflicht. Wer nicht bedienen kann, wirft eine beliebige Karte ab. Es gibt keinen Trumpf.</li>
          <li>Den Stich nimmt die <B>höchste Karte der ausgespielten Farbe</B>.</li>
          <li>Im <B>ersten Stich</B> dürfen keine Herzen und nicht die Pik-Dame fallen – außer man hat nichts anderes.</li>
          <li><B>Herz</B> darf erst ausgespielt werden, wenn Herz „gebrochen“ ist – also schon einmal abgeworfen wurde. Wer nur noch Herzen hat, darf trotzdem.</li>
        </ul>
        <h3 className="mt-4 font-semibold text-foreground">Punkte</h3>
        <p className="mt-1.5">Jedes Herz im Stich zählt <B>1 Punkt</B>, die <B>Pik-Dame 13</B>. Alle anderen Karten zählen nichts – zusammen gibt es 26 Punkte je Runde.</p>
        <h3 className="mt-4 font-semibold text-foreground" data-focused={focus === "house"}>Mond schießen</h3>
        <p className="mt-1.5">
          Wer in einer Runde <B>alle Herzen und die Pik-Dame</B> holt, „schießt den Mond“: Er bekommt 0 Punkte, alle anderen je 26. (Abschaltbar.)
        </p>
        <h3 className="mt-4 font-semibold text-foreground">Einstellungen</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li><B>Spielende</B> bei 50, 100 (Original) oder 150 Punkten.</li>
          <li><B>Weitergeben</B> im Wechsel, immer nach links oder nie.</li>
          <li><B>Punkte im ersten Stich</B> erlauben (Hausregel).</li>
        </ul>
        <p className="mt-3">An einem Handy für alle: Das Handy geht reihum, beim Weitergeben und vor jedem Zug mit Sichtschutz.</p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Strafkarten</h3>
      <ul className="grid gap-2">
        {[
          { card: "herz-A" as const, title: "Jedes Herz", text: "1 Punkt – egal ob Zwei oder Ass." },
          { card: "pik-D" as const, title: "Pik-Dame", text: "13 Punkte. Am besten schnell abwerfen, wenn du eine Farbe nicht bedienen kannst." },
        ].map((x) => (
          <li key={x.card} className="glass flex gap-3 rounded-xl p-3">
            <PlayingCard card={x.card} className="w-11 shrink-0 self-start" />
            <div><b>{x.title}</b><p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{x.text}</p></div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Verlauf: Punkte je Runde */
function History({ room, game: s }: BoardProps<HzState, HzAction>) {
  if (!s.history.length) return <p className="text-sm text-muted-foreground">Noch keine Runde gewertet.</p>;
  const players = room.players;
  return (
    <div className="no-scrollbar overflow-x-auto" data-testid="history">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1.5 pr-2 text-left font-normal">Runde</th>
            {players.map((p) => <th key={p.id} className="max-w-[5rem] truncate px-1 py-1.5 text-right font-semibold">{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {s.history.slice().reverse().map((h) => (
            <tr key={h.round} className="border-t border-border">
              <td className="py-1.5 pr-2 text-muted-foreground">{h.round} <span className="text-xs">{h.dir === "none" ? "–" : DIR_NAME[h.dir].replace("nach ", "")}</span></td>
              {players.map((p) => (
                <td key={p.id} className={cn("px-1 py-1.5 text-right font-bold", h.moon === p.id && "text-ok")}>{h.moon === p.id ? "Mond 0" : `+${h.points[p.id] ?? 0}`}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">Strafpunkte je Runde – wenig ist gut</p>
    </div>
  );
}

function HeaderExtra({ game: s }: BoardProps<HzState, HzAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border">
      bis <b className="text-foreground tabular-nums">{s.target}</b>
    </span>
  );
}

const log = (s: HzState) => s.log;
const overview = (s: HzState, room: RoomState) => ({
  cols: ["Runde", "Stiche", "Gesamt"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.taken[p.id] ?? 0, s.tricks[p.id] ?? 0, s.scores[p.id] ?? 0]])),
  curId: s.phase === "play" ? s.curId : null,
});

export const herzenUI: GameUI<HzState, HzAction> = { logic: herzen, Icon, Board, Rules, History, HeaderExtra, log, overview };
