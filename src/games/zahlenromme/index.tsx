import type { RoomState } from "@shared/platform/room";
import { zahlenromme, type ZrAction, type ZrState } from "@shared/games/zahlenromme/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Board } from "./Board";
import { Icon } from "./Icon";
import { TileFace } from "./Tile";

const B = ({ children }: { children: React.ReactNode }) => <b className="text-foreground">{children}</b>;
const Row = ({ tiles }: { tiles: string[] }) => (
  <span className="inline-flex gap-0.5 rounded-md bg-foreground/7 p-0.5 align-middle">{tiles.map((t) => <TileFace key={t} tile={t} className="w-6" />)}</span>
);

function Rules({ focus }: { focus?: string }) {
  return (
    <>
      <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
        <h3 className="font-semibold text-foreground">Ziel</h3>
        <p className="mt-1.5">Als Erster <B>alle Steine von der Bank</B> auf den Tisch legen. Wer das schafft, gewinnt die Runde.</p>
        <h3 className="mt-4 font-semibold text-foreground">Steine</h3>
        <p className="mt-1.5">
          106 Steine: die Zahlen <B>1 bis 13 in vier Farben</B>, jede doppelt, dazu <B>zwei Joker</B>. Jede Farbe hat ihr eigenes Zeichen –
          Rot ●, Blau ■, Gelb ▲, Schwarz ◆ –, so erkennt man sie auch ohne Farben. Jeder bekommt <B>14 Steine</B> auf seine Bank, der Rest ist der Pool.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">Kombinationen</h3>
        <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
          <li><B>Reihe:</B> mindestens drei aufeinanderfolgende Zahlen einer Farbe, z. B. <Row tiles={["r4a", "r5a", "r6a"]} /> – nach der 13 kommt keine 1.</li>
          <li><B>Gruppe:</B> drei oder vier gleiche Zahlen in verschiedenen Farben, z. B. <Row tiles={["r9a", "b9a", "s9a"]} />.</li>
          <li><B>Joker</B> vertreten jeden Stein: <Row tiles={["b7a", "J1", "b9a"]} />.</li>
        </ul>
        <h3 className="mt-4 font-semibold text-foreground">Erstes Auslegen</h3>
        <p className="mt-1.5">Beim ersten Mal brauchst du <B>mindestens 30 Punkte</B> in neuen Kombinationen, <B>nur aus eigenen Steinen</B> (Zahl = Punkte, der Joker zählt so viel wie der Stein, den er vertritt). Den Tisch darfst du dabei noch nicht umbauen. Die App zeigt die Summe oben an.</p>
        <h3 className="mt-4 font-semibold text-foreground">Danach: den Tisch umbauen</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Du darfst alles auf dem Tisch verändern: <B>anlegen</B>, Reihen <B>teilen</B>, Steine <B>verschieben</B>, einen <B>Joker austauschen</B> und gleich wieder verwenden.</li>
          <li>Am Ende deines Zugs muss <B>jede Kombination gültig</B> sein und du musst <B>mindestens einen eigenen Stein</B> gelegt haben. Steine vom Tisch dürfen nicht auf die Bank.</li>
          <li>Kannst oder willst du nicht legen, <B>ziehst du einen Stein</B>. Ist der Pool leer, passt du. Passen alle hintereinander, endet die Runde – wer am wenigsten übrig hat, gewinnt sie.</li>
        </ul>
        <h3 className="mt-4 font-semibold text-foreground">So geht's in der App</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Steine <B>antippen</B> (mehrere gleichzeitig), dann auf eine Kombination oder <B>„Neu“</B> tippen. Steine vom Tisch tippst du genauso an; eigene, die du in diesem Zug gelegt hast (Punkt oben rechts), dürfen zurück auf die Bank.</li>
          <li>Ungültige Kombinationen sind <B>rot</B> umrandet. <B>„Zurück“</B> setzt den Zug zurück, <B>„Fertig“</B> geht nur, wenn alles gültig ist.</li>
          <li>„nach Farbe“ / „nach Zahl“ sortiert die Bank. Der Tisch verkleinert sich von selbst, je mehr darauf liegt.</li>
        </ul>
        <h3 className="mt-4 font-semibold text-foreground" data-focused={focus === "house"}>Wertung und Einstellungen</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Wer die Runde gewinnt, bekommt die <B>Summe der Steine aller anderen</B>; jeder andere bekommt seine eigene Summe <B>abgezogen</B>. Ein Joker auf der Bank zählt <B>30</B>.</li>
          <li><B>Partie bis:</B> 1, 3 oder 5 Runden oder bis jemand 200 Punkte hat. Paket <B>„Kurz“</B>: eine Runde, <B>„Ohne Joker“</B>: 104 Steine.</li>
          <li><B>Zugzeit</B> (online): ist sie um, wird dein Zug zurückgesetzt und du ziehst einen Stein.</li>
        </ul>
        <p className="mt-3">An einem Handy für alle: Das Handy geht reihum, vor jedem Zug mit Sichtschutz. Wer nicht weiterkommt, für den zieht der Host einen Stein („Für … einen Stein ziehen“).</p>
      </section>
    </>
  );
}

function HeaderExtra({ game: s }: BoardProps<ZrState, ZrAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border" data-testid="header-pool">
      Pool <b className="text-foreground tabular-nums">{s.poolCount}</b>
    </span>
  );
}

const log = (s: ZrState) => s.log;
const overview = (s: ZrState, room: RoomState) => ({
  cols: ["Steine", "Punkte", "Ausgelegt"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.counts[p.id] ?? 0, s.scores[p.id] ?? 0, s.melded[p.id] ? "ja" : "–"]])),
  curId: s.phase === "play" ? s.curId : null,
});

export const zahlenrommeUI: GameUI<ZrState, ZrAction> = { logic: zahlenromme, Icon, Board, Rules, HeaderExtra, log, overview };
