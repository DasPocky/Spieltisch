import type { RoomState } from "@shared/platform/room";
import { skat, type SkAction, type SkState } from "@shared/games/skat/logic";
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
          Drei spielen: Wer am höchsten reizt, spielt als <B>Alleinspieler</B> gegen die anderen beiden und braucht <B>61 von 120 Augen</B>.
          Nach allen Spielen der Liste gewinnt, wer die meisten Punkte hat. Zu viert sitzt der Geber aus; fehlende Plätze spielen Bots.
        </p>
        <H>Karten</H>
        <p className="mt-1.5">32 Karten – 7 bis Ass in vier Farben. Jeder bekommt 10, zwei liegen verdeckt im <B>Skat</B>.</p>
        <p className="mt-1.5">Augen: <B>Ass 11, Zehn 10, König 4, Dame 3, Bube 2</B>, 9, 8, 7 zählen nichts.</p>
        <H focus={focus === "bid"}>Reizen</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Links vom Geber sitzt <B>Vorhand</B>, dann Mittelhand und Hinterhand.</li>
          <li><B>Mittelhand sagt Vorhand</B> Reizwerte: 18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40 … Vorhand sagt „ja“ oder „passe“.</li>
          <li>Danach <B>sagt Hinterhand dem Gewinner</B>. Wer zuletzt übrig bleibt, wird Alleinspieler.</li>
          <li>Sagt niemand etwas, darf Vorhand 18 spielen. Passen alle: neu geben (mit Ramsch: es wird geramscht).</li>
          <li>Reize nur so hoch, wie dein Spiel wert ist – sonst bist du <B>überreizt</B>.</li>
        </ul>
        <H focus={focus === "game"}>Skat und Spielansage</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Der Alleinspieler nimmt den Skat auf und <B>drückt</B> zwei Karten (deren Augen zählen für ihn) – oder spielt <B>Hand</B>.</li>
          <li><B>Farbspiel</B>: Karo 9, Herz 10, Pik 11, Kreuz 12. <B>Grand</B>: 24, nur Buben sind Trumpf. <B>Null</B>: keinen Stich machen – Null 23, Null Hand 35, Null ouvert 46, Null ouvert Hand 59.</li>
          <li>Beim Handspiel darf man <B>Schneider</B> oder <B>Schwarz</B> ansagen oder <B>ouvert</B> (offen) spielen.</li>
        </ul>
        <H>Spielen</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Vorhand spielt aus. Farbe bedienen ist Pflicht – die Buben gehören zum Trumpf, nicht zu ihrer Farbe.</li>
          <li>Trumpf von hoch nach niedrig: <B>Kreuz-, Pik-, Herz-, Karo-Bube</B>, dann im Farbspiel Ass, 10, König, Dame, 9, 8, 7 der Trumpffarbe.</li>
          <li>Andere Farben: Ass, 10, König, Dame, 9, 8, 7. Beim Null gibt es keinen Trumpf: Ass, König, Dame, Bube, 10, 9, 8, 7.</li>
        </ul>
        <H focus={focus === "score"}>Spielwert und Abrechnung</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li><B>Spitzen</B>: wie viele Buben (im Farbspiel weiter mit Ass, 10 … der Trumpffarbe) ohne Lücke von oben – „mit 2“ oder „ohne 3“. Der Skat zählt mit.</li>
          <li>Spielwert = (Spitzen + 1 Spiel + Hand + Schneider + Schneider angesagt + Schwarz + Schwarz angesagt + ouvert) × Grundwert.</li>
          <li><B>Schneider</B>: eine Seite hat höchstens 30 Augen. <B>Schwarz</B>: eine Seite hat keinen Stich.</li>
          <li>Gewonnen: + Spielwert. Verloren: − doppelter Spielwert. <B>Überreizt</B>: verloren mit dem nächsten Vielfachen des Grundwerts über dem Reizwert.</li>
          <li><B>Ramsch</B> (Hausregel): Buben sind Trumpf, jeder für sich. Wer die meisten Augen hat, verliert sie; der Skat geht an den letzten Stich. Wer keinen Stich macht, ist <B>Jungfrau</B> – das verdoppelt. Alle Stiche: Durchmarsch, +120.</li>
        </ul>
        <H focus={focus === "house"}>Einstellungen</H>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li><B>Mit Ramsch</B>: passen alle, wird geramscht. <B>Einsteiger</B>: mit Ramsch ohne Jungfrau, verlorene Spiele zählen nur einfach.</li>
          <li><B>Kartenbild</B> französisch oder deutsch (Eichel, Grün, Rot, Schellen – Ober und Unter statt Dame und Bube).</li>
          <li><B>Zugzeit</B> (online): ist sie um, entscheidet die App für dich.</li>
        </ul>
        <p className="mt-3">An einem Handy für alle: Das Handy geht reihum, vor jedem Zug mit Sichtschutz.</p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Die Buben</h3>
      <ul className="grid gap-2">
        {[
          { card: "kreuz-B" as const, title: "Kreuz-Bube", text: "Der höchste Trumpf – in jedem Spiel außer Null." },
          { card: "karo-B" as const, title: "Karo-Bube", text: "Der kleinste Bube, sticht aber jede Farbkarte." },
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

/** Liste: Spiel und Punkte je Spiel */
function History({ game: s, room }: BoardProps<SkState, SkAction>) {
  if (!s.history.length) return <p className="text-sm text-muted-foreground">Noch kein Spiel gewertet.</p>;
  return (
    <div className="no-scrollbar overflow-x-auto" data-testid="history">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1.5 pr-2 text-left font-normal">Spiel</th>
            {s.seats.map((id) => <th key={id} className="max-w-[5rem] truncate px-1 py-1.5 text-right font-semibold">{s.names[id]}</th>)}
          </tr>
        </thead>
        <tbody>
          {s.history.slice().reverse().map((h) => (
            <tr key={h.round} className="border-t border-border">
              <td className="py-1.5 pr-2 text-muted-foreground">{h.round} <span className="text-xs">{recordName(h, room.options)}{h.declarer ? ` · ${s.names[h.declarer]}` : ""}</span></td>
              {s.seats.map((id) => (
                <td key={id} className={cn("px-1 py-1.5 text-right font-bold", (h.points[id] ?? 0) > 0 ? "text-ok" : (h.points[id] ?? 0) < 0 ? "text-destructive" : "")}>{h.points[id] ? `${h.points[id] > 0 ? "+" : ""}${h.points[id]}` : "·"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeaderExtra({ game: s }: BoardProps<SkState, SkAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border">
      Spiel <b className="text-foreground tabular-nums">{s.round}/{s.total}</b>
    </span>
  );
}

const log = (s: SkState) => s.log;
const overview = (s: SkState, room: RoomState) => ({
  cols: ["Stiche", "Gesamt"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.tricks.filter((t) => t.winner === p.id).length, s.scores[p.id] ?? 0]])),
  curId: s.phase === "roundEnd" || s.phase === "over" ? null : s.curId,
});

export const skatUI: GameUI<SkState, SkAction> = { logic: skat, Icon, Board, Rules, History, HeaderExtra, log, overview };
