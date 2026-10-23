import { KATEGORIEN } from "@shared/games/quiz/fragen";
import { deckNote, KINDS, POINTS, quiz, type QAction, type QState } from "@shared/games/quiz/logic";
import type { RoomState } from "@shared/platform/room";
import type { BoardProps, GameUI } from "@/games/types";
import { LogList } from "@/platform/PlayersHistory";
import { Board } from "./Board";
import { Icon } from "./Icon";

function Rules() {
  const h = "mt-4 font-semibold text-foreground";
  const b = "text-foreground";
  const total = KATEGORIEN.reduce((t, k) => t + k.fragen.length, 0);
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Worum geht's?</h3>
      <p className="mt-1.5">Alle beantworten dieselbe Frage gleichzeitig am eigenen Handy – der Fernseher zeigt Frage, Uhr und Auflösung. Wer am Ende die meisten Punkte hat, gewinnt.</p>
      <h3 className={h}>Drei Arten</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {KINDS.map((k) => <li key={k.id}><b className={b}>{k.name}:</b> {k.hint}.</li>)}
      </ul>
      <h3 className={h}>Punkte</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li><b className={b}>Auswahl:</b> richtig {POINTS.right}, wer schneller ist, bis zu {POINTS.fast} dazu.</li>
        <li><b className={b}>Schätzen:</b> am nächsten {POINTS.near[0]}, dann {POINTS.near[1]} und {POINTS.near[2]} – genau getroffen +{POINTS.exact}.</li>
        <li><b className={b}>Ordnen:</b> {POINTS.slot} je Begriff am richtigen Platz.</li>
        <li><b className={b}>An einem Handy:</b> Frage zeigen, alle rufen, auflösen – dann antippen, wer richtig lag ({POINTS.local}).</li>
      </ul>
      <h3 className={h}>Fragen</h3>
      <p className="mt-1.5">{total.toLocaleString("de-DE")} eigene Fragen in {KATEGORIEN.length} Kategorien: {KATEGORIEN.map((k) => `${k.emoji} ${k.name}`).join(", ")}. Kategorien und Arten lassen sich einzeln abschalten.</p>
    </section>
  );
}

function History({ game: s }: BoardProps<QState, QAction>) {
  return <LogList entries={s.log} />;
}

function HeaderExtra({ game: s }: BoardProps<QState, QAction>) {
  return <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border">{s.phase === "over" ? "Ende" : `Frage ${Math.min(s.idx + 1, s.total)}/${s.total}`}</span>;
}

/** Lobby: Hinweis, wenn die Auswahl so keine Fragen ergäbe (die App nimmt dann alle Kategorien) */
function SettingsExtra({ room }: { room: RoomState }) {
  const note = deckNote(room.options);
  return note ? <p role="status" className="rounded-xl bg-ice/15 px-3 py-2 text-sm" data-testid="quiz-deck-note">{note}</p> : null;
}

export const quizUI: GameUI<QState, QAction> = {
  logic: quiz, Icon, Board, Rules, History, HeaderExtra, SettingsExtra,
  log: (s) => s.log,
  overview: (s) => ({ cols: ["Punkte"], rows: Object.fromEntries(s.order.map((id) => [id, [s.scores[id] ?? 0]])) }),
};
