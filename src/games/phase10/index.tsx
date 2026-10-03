import type { RoomState } from "@shared/platform/room";
import { phase10, PHASES, needLabel, type P10Action, type P10State } from "@shared/games/phase10/logic";
import type { GameUI } from "@/games/types";
import { MUTED } from "@/lib/palette";
import { Board } from "./Board";

/** Symbol: Karte mit „10“ vor zwei Karten */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="7" y="9" width="15" height="21" rx="2.5" fill="#fdfdfb" stroke={MUTED.navy} strokeWidth="0.8" transform="rotate(-14 14 20)" />
      <rect x="18" y="9" width="15" height="21" rx="2.5" fill="#fdfdfb" stroke={MUTED.navy} strokeWidth="0.8" transform="rotate(12 26 20)" />
      <rect x="12.5" y="8" width="15" height="22" rx="2.5" fill="#fdfdfb" stroke={MUTED.navy} strokeWidth="0.8" />
      <text x="20" y="23" textAnchor="middle" fontSize="10" fontWeight="800" fill={MUTED.blue}>10</text>
    </svg>
  );
}

function Rules() {
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Ziel</h3>
      <p className="mt-1.5">Die zehn Phasen der Reihe nach schaffen. Wer als Erster Phase 10 schafft, gewinnt – schaffen es mehrere in derselben Runde, entscheiden die wenigsten Strafpunkte.</p>
      <h3 className="mt-4 font-semibold text-foreground">Die Phasen</h3>
      <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
        {PHASES.map((p, i) => <li key={i}>{p.map(needLabel).join(" + ")}</li>)}
      </ol>
      <p className="mt-2"><b className="text-foreground">Gleiche</b>: gleiche Zahl, Farbe egal. <b className="text-foreground">Folge</b>: aufsteigende Zahlen, Farbe egal. <b className="text-foreground">Farbe</b>: beliebige Zahlen einer Farbe.</p>
      <h3 className="mt-4 font-semibold text-foreground">Ein Zug</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Vom Stapel ziehen oder die oberste Ablage nehmen (außer Aussetzen).</li>
        <li>Wenn du kannst: deine Phase auslegen. Danach darfst du passende Karten bei allen ausgelegten Gruppen anlegen.</li>
        <li>Eine Karte ablegen. Mit <b className="text-foreground">Aussetzen</b> bestimmst du, wer einmal aussetzt – aber niemanden, der schon aussetzen muss (Aussetzen darf man nicht aufnehmen).</li>
      </ol>
      <p className="mt-2">Ein <b className="text-foreground">Joker</b> ersetzt jede Karte. Jede Gruppe braucht mindestens eine echte Karte.</p>
      <h3 className="mt-4 font-semibold text-foreground">Rundenende</h3>
      <p className="mt-1.5">Wer keine Karten mehr hat, beendet die Runde. Wer seine Phase liegen hat, macht nächste Runde mit der nächsten weiter. Handkarten sind Strafpunkte: 1–9 = 5, 10–12 = 10, Aussetzen 15, Joker 25.</p>
      <h3 className="mt-4 font-semibold text-foreground">Varianten</h3>
      <p className="mt-1.5">
        <b className="text-foreground">In der App:</b> an einem Handy mit Sichtschutz oder online jeder am eigenen Handy. „Phase finden“ sucht dir eine passende Auslage.
        <br /><b className="text-foreground">Echte Karten:</b> ihr spielt mit eurem Phase 10, die App merkt sich Phasen und Punkte.
      </p>
    </section>
  );
}


/** Verlauf und Spielerübersicht für „Spieler & Verlauf“ */
const log = (s: P10State) => (s.mode === "table" ? [] : s.log);
const overview = (s: P10State, room: RoomState) => s.mode === "table" ? null : ({
  cols: ["Phase", "Karten", "Punkte"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [`${Math.min(s.goal, s.phase[p.id] ?? 1)}${s.laid[p.id] ? " ✓" : ""}`, s.counts[p.id] ?? 0, s.scores[p.id] ?? 0]])),
  curId: s.step === "draw" || s.step === "play" ? s.curId : null,
});

export const phase10UI: GameUI<P10State, P10Action> = { logic: phase10, Icon, Board, Rules, log, overview };
