import type { RoomState } from "@shared/platform/room";
import { skipbo, type SbAction, type SbState } from "@shared/games/skipbo/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Section } from "@/platform/MenuSheet";
import { MUTED } from "@/lib/palette";
import { Board } from "./Board";

/** Symbol: aufsteigende Karten 1, 2, 3 */
function Icon({ className }: { className?: string }) {
  const cards: [string, string, number][] = [["1", MUTED.blue, -12], ["5", MUTED.teal, 0], ["9", MUTED.red, 12]];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {cards.map(([v, c, r], i) => (
        <g key={i} transform={`rotate(${r} 20 32)`}>
          <rect x="13" y="7" width="14" height="20" rx="2.5" fill="#fdfdfb" stroke={MUTED.navy} strokeWidth="0.8" />
          <text x="20" y="21.5" textAnchor="middle" fontSize="10" fontWeight="800" fill={c}>{v}</text>
        </g>
      ))}
    </svg>
  );
}

function Rules() {
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Ziel</h3>
      <p className="mt-1.5">Als Erster den eigenen <b className="text-foreground">Vorrat</b> loswerden (30 Karten, ab 5 Spielern 20).</p>
      <h3 className="mt-4 font-semibold text-foreground">Karten</h3>
      <p className="mt-1.5">162 Karten: zwölfmal die Zahlen 1 bis 12 und 18 <b className="text-foreground">Skip-Bo</b>-Joker, die für jede Zahl stehen.</p>
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
        <br /><b className="text-foreground">Echte Karten:</b> ihr spielt mit eurem Skip-Bo, die App zählt Punkte (Sieger: 25 + 5 je Vorratskarte der anderen).
      </p>
    </section>
  );
}

function MenuExtras({ game }: BoardProps<SbState, SbAction>) {
  return (
    <Section title="Verlauf">
      {game.log.length ? <ul className="text-[0.95rem]">{game.log.slice().reverse().map((e, i) => <li key={i} className="border-b border-border py-2">{e}</li>)}</ul>
        : <p className="text-sm text-muted-foreground">Noch nichts Besonderes passiert.</p>}
    </Section>
  );
}

/** Verlauf und Spielerübersicht für „Spieler & Verlauf“ */
const log = (s: SbState) => (s.mode === "table" ? [] : s.log);
const overview = (s: SbState, room: RoomState) => s.mode === "table" ? null : ({
  cols: room.options.target === "500" ? ["Vorrat", "Hand", "Punkte"] : ["Vorrat", "Hand"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.stockCounts[p.id] ?? 0, s.handCounts[p.id] ?? 0, ...(room.options.target === "500" ? [s.scores[p.id] ?? 0] : [])]])),
  curId: s.phase === "play" ? s.curId : null,
});

export const skipboUI: GameUI<SbState, SbAction> = { logic: skipbo, Icon, Board, Rules, MenuExtras, log, overview };
