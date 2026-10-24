import { stadtlandfluss, active, type SlfAction, type SlfState } from "@shared/games/stadtlandfluss/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { LogList } from "@/platform/PlayersHistory";
import { Board } from "./Board";
import { Icon } from "./Icon";

function Rules() {
  const h = "mt-4 font-semibold text-foreground";
  const b = "text-foreground";
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Worum geht's?</h3>
      <p className="mt-1.5">Ein <b className={b}>Buchstabe</b> wird gezogen – und alle suchen gleichzeitig am eigenen Handy zu jeder Kategorie ein passendes Wort: eine Stadt mit K, ein Land mit K, einen Fluss mit K …</p>
      <h3 className={h}>Ablauf</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Der Buchstabe steht groß oben (Q, X und Y sind nur mit Einstellung dabei).</li>
        <li>Wer alle Felder hat, ruft <b className={b}>„Stopp!“</b> – den anderen bleibt ein kurzer Countdown. Spätestens die Rundenzeit beendet die Runde; der Host kann jederzeit Stopp rufen.</li>
        <li>Dann wird <b className={b}>Kategorie für Kategorie</b> ausgewertet: alle sehen alle Antworten. Mit dem <b className={b}>Daumen runter</b> lehnt ihr eine Antwort ab – die Mehrheit entscheidet, bei Gleichstand der Host. Falscher Anfangsbuchstabe zählt nicht.</li>
        <li>Nach der letzten Runde gewinnt, wer die meisten Punkte hat.</li>
      </ol>
      <h3 className={h}>Punkte je Kategorie</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li><b className={b}>20</b>: nur du hast eine gültige Antwort.</li>
        <li><b className={b}>10</b>: deine Antwort hat sonst keiner.</li>
        <li><b className={b}>5</b>: jemand hat dasselbe – Groß und klein egal, kleine Tippfehler zählen als gleich.</li>
        <li><b className={b}>0</b>: leer, abgelehnt oder falscher Buchstabe.</li>
      </ul>
      <h3 className={h}>Einstellungen</h3>
      <p className="mt-1.5">Runden, Zeit je Runde, Countdown nach dem Stopp, Kategorien zum An- und Abwählen und bis zu vier eigene (zusammen höchstens zehn). Pakete: <b className={b}>Kurz</b> (3 Runden, Stadt, Land, Fluss, Tier) und <b className={b}>Kinder</b> (Name, Tier, Essen, Obst & Gemüse, Gegenstand, Körperteil, Spielzeug, längerer Countdown).</p>
      <h3 className={h}>Nichts bleibt hängen</h3>
      <p className="mt-1.5">Wer bei Ablauf nicht fertig ist, gibt ab, was dasteht. Wer aussteigt, wird übersprungen. An einem Handy für alle geht es reihum ohne Uhr, abgelehnt wird gemeinsam per Tippen.</p>
      <h3 className={h}>Am Fernseher</h3>
      <p className="mt-1.5">Beim Schreiben nur der Buchstabe und wer fertig ist – keine Antworten. In der Auswertung die Antworten der Kategorie groß mit Punkten.</p>
    </section>
  );
}

function History({ game: s }: BoardProps<SlfState, SlfAction>) {
  return <LogList entries={s.log} />;
}

function HeaderExtra({ game: s }: BoardProps<SlfState, SlfAction>) {
  return <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border" data-testid="slf-round">Runde {Math.min(s.round + 1, s.rounds)}/{s.rounds}</span>;
}

export const stadtlandflussUI: GameUI<SlfState, SlfAction> = {
  logic: stadtlandfluss, Icon, Board, Rules, History, HeaderExtra,
  log: (s) => s.log,
  overview: (s) => ({
    cols: ["Punkte", ...s.history.map((h) => h.letter)],
    rows: Object.fromEntries(s.order.map((id) => [id, [active(s).includes(id) ? s.scores[id] ?? 0 : "ausgestiegen", ...s.history.map((h) => h.points[id] ?? 0)]])),
    curId: null,
  }),
};
