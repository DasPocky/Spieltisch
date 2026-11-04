import type { RoomState } from "@shared/platform/room";
import { doppelkopf, type DkAction, type DkState } from "@shared/games/doppelkopf/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { cn } from "@/lib/utils";
import { PlayingCard } from "@/platform/cards/PlayingCard";
import { Board } from "./Board";
import { recordName } from "./narration";
import { Icon } from "./Icon";

const B = ({ children }: { children: React.ReactNode }) => <b className="text-foreground">{children}</b>;
const H = ({ children, focus }: { children: React.ReactNode; focus?: boolean }) => <h3 className="mt-4 font-semibold text-foreground" data-focused={focus}>{children}</h3>;

function Rules({ focus }: { focus?: string }) {
  return (
    <>
      <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
        <h3 className="font-semibold text-foreground">Ziel</h3>
        <p className="mt-1.5">
          Zu viert, zwei gegen zwei: <B>Re</B> (wer eine Kreuz-Dame hat) gegen <B>Kontra</B>. Wer zu wem gehört, merkt man erst im Spiel.
          Re gewinnt mit <B>121 von 240 Augen</B>, sonst gewinnt Kontra. Nach allen Runden gewinnt, wer die meisten Punkte hat.
          Fehlen Mitspieler oder steigt jemand aus, spielt ein Bot den Platz.
        </p>
        <H>Karten</H>
        <p className="mt-1.5">48 Karten – 9, Bube, Dame, König, 10 und Ass in vier Farben, jede Karte <B>zweimal</B>. Jeder bekommt 12 (ohne Neunen 40 Karten, je 10).</p>
        <p className="mt-1.5">Augen: <B>Ass 11, Zehn 10, König 4, Dame 3, Bube 2, Neun 0</B>.</p>
        <H>Trumpf</H>
        <p className="mt-1.5">
          Von hoch nach niedrig: <B>Herz-10</B> („Dulle“), die Damen (Kreuz, Pik, Herz, Karo), die Buben (ebenso), dann Karo-Ass, Karo-10, Karo-König, Karo-9.
          Fehlfarben: Kreuz und Pik je Ass, 10, König, 9 – Herz nur Ass, König, 9.
          Liegen zwei gleiche Karten im Stich, sticht die <B>erste</B>.
        </p>
        <H>Spielen</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Links vom Geber spielt aus. Farbe bedienen ist Pflicht – Trumpf ist dabei eine eigene „Farbe“.</li>
          <li>Wer nicht bedienen kann, spielt frei: abwerfen oder mit Trumpf stechen.</li>
          <li>Den Stich nimmt der höchste Trumpf, sonst die höchste Karte der ausgespielten Farbe. Wer sticht, spielt aus.</li>
        </ul>
        <H focus={focus === "reserve"}>Vorbehalte</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Vor dem ersten Stich sagt jeder <B>gesund</B> oder <B>Vorbehalt</B>.</li>
          <li><B>Hochzeit</B>: Wer beide Kreuz-Damen hat, spielt mit dem, der als Erster einen der ersten drei Stiche macht. Macht er alle drei selbst, spielt er allein.</li>
          <li><B>Solo</B>: allein gegen drei. Damensolo (nur Damen Trumpf), Bubensolo (nur Buben), Fleischloser (kein Trumpf), Farbsolo Kreuz, Pik oder Herz (diese Farbe statt Karo) und Karo-Solo. Das erste angemeldete Solo gilt.</li>
          <li>Wer beide Kreuz-Damen hat und „gesund“ sagt, spielt still allein.</li>
        </ul>
        <H focus={focus === "calls"}>Ansagen</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li><B>Re</B> bzw. <B>Kontra</B>: bis vor der zweiten eigenen Karte. Wer ansagt, zeigt seine Partei.</li>
          <li><B>Absagen</B> danach je eine Karte später: „keine 90“, „keine 60“, „keine 30“, „schwarz“ (alle Stiche).</li>
          <li>Hat nur Kontra angesagt, gewinnt Re schon mit 120. Wer absagt, muss die Absage schaffen (z. B. „keine 90“: 151 Augen) – die anderen gewinnen dann schon mit 90.</li>
          <li>Bei der Hochzeit verschieben sich die Fristen um die Stiche bis zur Klärung.</li>
        </ul>
        <H focus={focus === "score"}>Abrechnung</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Gewonnen: 1 Punkt. Gegen die Alten (Kontra gewinnt, kein Solo): +1.</li>
          <li>Re oder Kontra angesagt: je +2. Jede Absage: +1.</li>
          <li>Gegner unter 90, unter 60, unter 30 Augen, ohne Stich (schwarz): je +1.</li>
          <li>Sonderpunkte (nicht im Solo): <B>Doppelkopf</B> – Stich mit 40 Augen, <B>Fuchs gefangen</B> – Karo-Ass der Gegner erbeutet, <B>Karlchen</B> – letzter Stich mit dem Kreuz-Buben.</li>
          <li>Die Gewinner bekommen den Spielwert, die Verlierer verlieren ihn. Ein Solist bekommt bzw. zahlt <B>dreifach</B>.</li>
        </ul>
        <H focus={focus === "house"}>Einstellungen</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li><B>Ohne Neunen</B>: 40 Karten, je 10 – Ansagen entsprechend früher.</li>
          <li><B>Einsteiger</B>: ohne Soli und ohne Absagen.</li>
          <li><B>Kartenbild</B> französisch oder deutsch (Eichel, Grün, Rot, Schellen – Ober und Unter statt Dame und Bube).</li>
          <li><B>Zugzeit</B> (online): ist sie um, spielt die App für dich.</li>
        </ul>
        <p className="mt-3">An einem Handy für alle: Das Handy geht reihum, vor jedem Zug mit Sichtschutz. Angesagt wird, wenn du dran bist.</p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Besondere Karten</h3>
      <ul className="grid gap-2">
        {[
          { card: "herz-10" as const, title: "Dulle (Herz-10)", text: "Der höchste Trumpf." },
          { card: "kreuz-D" as const, title: "Die Alten (Kreuz-Damen)", text: "Wer eine hat, spielt Re. Mit beiden: Hochzeit oder still allein." },
          { card: "karo-A" as const, title: "Fuchs (Karo-Ass)", text: "Fängt die andere Partei ihn im Stich, gibt es einen Sonderpunkt." },
          { card: "kreuz-B" as const, title: "Karlchen (Kreuz-Bube)", text: "Gewinnt er den letzten Stich: ein Sonderpunkt." },
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

/** Verlauf: Spiel und Punkte je Runde */
function History({ game: s }: BoardProps<DkState, DkAction>) {
  if (!s.history.length) return <p className="text-sm text-muted-foreground">Noch keine Runde gewertet.</p>;
  return (
    <div className="no-scrollbar overflow-x-auto" data-testid="history">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1.5 pr-2 text-left font-normal">Runde</th>
            {s.seats.map((id) => <th key={id} className="max-w-[5rem] truncate px-1 py-1.5 text-right font-semibold">{s.names[id]}</th>)}
          </tr>
        </thead>
        <tbody>
          {s.history.slice().reverse().map((h) => (
            <tr key={h.round} className="border-t border-border">
              <td className="py-1.5 pr-2 text-muted-foreground">{h.round} <span className="text-xs">{recordName(h)}{h.winner ? ` · ${h.winner === "re" ? "Re" : "Kontra"} ${h.augen[h.winner]}` : ""}</span></td>
              {s.seats.map((id) => (
                <td key={id} className={cn("px-1 py-1.5 text-right font-bold", (h.points[id] ?? 0) > 0 ? "text-ok" : (h.points[id] ?? 0) < 0 ? "text-destructive" : "")}>{(h.points[id] ?? 0) > 0 ? "+" : ""}{h.points[id] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeaderExtra({ game: s }: BoardProps<DkState, DkAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border">
      Runde <b className="text-foreground tabular-nums">{s.round}/{s.total}</b>
    </span>
  );
}

const log = (s: DkState) => s.log;
const overview = (s: DkState, room: RoomState) => ({
  cols: ["Stiche", "Gesamt"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.tricks.filter((t) => t.winner === p.id).length, s.scores[p.id] ?? 0]])),
  curId: s.phase === "play" || s.phase === "reserve" ? s.curId : null,
});

export const doppelkopfUI: GameUI<DkState, DkAction> = { logic: doppelkopf, Icon, Board, Rules, History, HeaderExtra, log, overview };
