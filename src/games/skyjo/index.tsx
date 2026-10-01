import type { RoomState } from "@shared/platform/room";
import { skyjo, type SkAction, type SkState } from "@shared/games/skyjo/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Section } from "@/platform/MenuSheet";
import { Board, cardColor } from "./Board";

/** Symbol: drei aufgefächerte Skyjo-Karten */
function Icon({ className }: { className?: string }) {
  const cards: [number, number][] = [[-2, -14], [5, 0], [12, 14]];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {cards.map(([v, r], i) => (
        <g key={i} transform={`rotate(${r} 20 30)`}>
          <rect x="13" y="7" width="14" height="20" rx="3" fill={cardColor(v).bg} stroke="#fdfdfb" strokeWidth="1.2" />
          <text x="20" y="21" textAnchor="middle" fontSize="8" fontWeight="800" fill={cardColor(v).fg}>{v}</text>
        </g>
      ))}
    </svg>
  );
}

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
        Hat jemand alle Karten offen, ist jeder andere noch genau einmal dran. Dann werden alle Karten aufgedeckt und zusammengezählt.
        Wer die Runde beendet hat, aber <b className="text-foreground">nicht allein am wenigsten</b> Punkte hat, zahlt seine Punkte doppelt (nur bei Plus-Punkten).
      </p>
      <h3 className="mt-4 font-semibold text-foreground">Varianten</h3>
      <p className="mt-1.5">
        <b className="text-foreground">In der App:</b> an einem Handy für alle oder online jeder am eigenen Handy – offene Karten sehen alle, verdeckte niemand.
        <br /><b className="text-foreground">Echte Karten:</b> ihr spielt mit eurem Skyjo, die App ist der Punkteblock. Online trägt jeder seine Punkte selbst ein.
      </p>
    </section>
  );
}

function MenuExtras({ game: s }: BoardProps<SkState, SkAction>) {
  return (
    <Section title="Verlauf">
      {s.log.length ? <ul className="grid gap-1 text-sm">{s.log.slice().reverse().map((l, i) => <li key={i} className="border-b border-border py-1.5">{l}</li>)}</ul>
        : <p className="text-sm text-muted-foreground">Noch nichts passiert.</p>}
    </Section>
  );
}

/** Verlauf und Spielerübersicht für „Spieler & Verlauf“ */
const log = (s: SkState) => (s.mode === "table" ? [] : s.log);
const overview = (s: SkState, room: RoomState) => s.mode === "table" ? null : ({
  cols: ["Offen", "Gesamt"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [(s.grids[p.id] ?? []).reduce((a, c) => a + (c?.up && c.v !== null ? c.v : 0), 0), s.scores[p.id] ?? 0]])),
  curId: s.phase === "turn" ? s.curId : null,
});

export const skyjoUI: GameUI<SkState, SkAction> = { logic: skyjo, Icon, Board, Rules, MenuExtras, log, overview };
