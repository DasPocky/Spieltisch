import { totalWords } from "@shared/games/stirnraten/cards";
import { erklaerspiel, OWN_MIN, STYLES, teamName, type ErkAction, type ErkState } from "@shared/games/erklaerspiel/logic";
import { THEMES } from "@shared/games/erklaerspiel/themes";
import type { BoardProps, GameUI } from "@/games/types";
import { Board } from "./Board";
import { Icon } from "./Icon";

function Rules() {
  const h = "mt-4 font-semibold text-foreground";
  const b = "text-foreground";
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Worum geht's?</h3>
      <p className="mt-1.5">
        Zwei bis vier <b className={b}>Teams</b> treten gegeneinander an. Reihum ist in jedem Team einer der <b className={b}>Erklärer</b>: Er sieht die Begriffe auf seinem Handy und
        erklärt sie seinem Team – <b className={b}>ohne das Wort oder Teile davon</b> zu sagen (bei „Fußball“ also weder „Fuß“ noch „Ball“). Das Team ruft, was es sein könnte.
      </p>
      <h3 className={h}>Ein Zug</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li>Die Uhr läuft (einstellbar, Standard 60 Sekunden). Erraten? <b className={b}>Richtig</b> tippen – sofort kommt der nächste Begriff.</li>
        <li>Zu schwer? <b className={b}>Weiter</b> überspringt den Begriff. Mit der Hausregel kostet das einen Punkt.</li>
        <li>Ist die Zeit um, endet der Zug von selbst. Der Begriff, der gerade offen war, zählt nicht.</li>
        <li>Danach sehen alle die Liste. Die <b className={b}>Gegner</b> (oder der Host) tippen einen Treffer an, wenn das Wort gefallen ist – er zählt dann nicht. Bestätigt, ist das nächste Team dran.</li>
        <li>Jeder erratene Begriff ist ein Punkt für das Team. Nach allen Zügen gewinnt das Team mit den meisten Punkten.</li>
      </ul>
      <h3 className={h}>Spielarten</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {(["erklaeren", "einwort", "pantomime"] as const).map((k) => <li key={k}><span aria-hidden="true">{STYLES[k].emoji}</span> <b className={b}>{STYLES[k].name}:</b> {STYLES[k].rule}</li>)}
        <li><b className={b}>Drei Runden:</b> Am Anfang kommt ein Topf mit Begriffen (Standard 30). Runde 1 wird erklärt, Runde 2 mit einem Wort, Runde 3 als Pantomime – immer mit <b className={b}>denselben Begriffen</b>.
          Übersprungene Begriffe kommen zurück in den Topf; eine Runde endet, wenn alle erraten sind.</li>
      </ul>
      <h3 className={h}>Teams</h3>
      <p className="mt-1.5">Die Spieler werden in ihrer Reihenfolge abwechselnd verteilt (in der Lobby mit „Mischen“ neu würfeln). Innerhalb des Teams wechselt der Erklärer jeden Zug.
        Ist jemand nicht da, wählt der Host im Menü „Jemand anderes erklärt“.</p>
      <h3 className={h}>Begriffe</h3>
      <p className="mt-1.5">Aus dem Begriffsvorrat von Stirnraten ({totalWords().toLocaleString("de-DE")} Begriffe), in Stufen und nach Themen wählbar: {THEMES.map((t) => t.name).join(", ")}.
        Eigene Kartensets von Zeichnen & Raten spielen mit (ab {OWN_MIN} Begriffen auch „Nur eigene“). Kein Begriff kommt in einer Partie doppelt.</p>
      <h3 className={h}>Geheim</h3>
      <p className="mt-1.5">Den Begriff sieht nur der Erklärer – und wenn eingestellt das gegnerische Team zur Kontrolle. Das ratende Team und der Fernseher sehen ihn nie, erst nach dem Zug die Liste.
        An einem Handy für alle geht das Handy an den Erklärer weiter.</p>
    </section>
  );
}

function HeaderExtra({ game: s }: BoardProps<ErkState, ErkAction>) {
  const label = s.phase === "over" ? "Ende" : s.variant === "drei" ? `Runde ${s.stage + 1}/3` : `Zug ${Math.min(s.turn + 1, s.turns)}/${s.turns}`;
  return <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border">{label}</span>;
}

export const erklaerspielUI: GameUI<ErkState, ErkAction> = {
  logic: erklaerspiel, Icon, Board, Rules, HeaderExtra,
  log: (s) => s.log,
  overview: (s) => ({
    cols: ["Team", "Punkte"],
    rows: Object.fromEntries(s.teams.flatMap((t, i) => t.map((id) => [id, [teamName(i).replace("Team ", ""), s.teamScores[i] ?? 0]]))),
    curId: s.explainer,
  }),
};
