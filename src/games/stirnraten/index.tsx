import { CATEGORIES, LEVELS, STYLES, totalWords } from "@shared/games/stirnraten/cards";
import { FUSE, IMPOSTOR_POINTS, LAPS, stirnraten, teamName, type StirnAction, type StirnState } from "@shared/games/stirnraten/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { LogList } from "@/platform/PlayersHistory";
import { Board } from "./Board";
import { Icon } from "./Icon";
import { roundOf } from "./parts";

function Rules({ focus }: { focus?: string }) {
  const h = "mt-4 font-semibold text-foreground";
  const b = "text-foreground";
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Worum geht's?</h3>
      <p className="mt-1.5">
        Wer dran ist, hält das Handy <b className={b}>an die Stirn</b> – Bildschirm nach außen. Er sieht den Begriff nicht, alle anderen schon und <b className={b}>erklären</b> ihn, ohne ihn (oder Teile davon) zu sagen.
        Wie viele Begriffe schafft man, bis die Uhr abläuft?
      </p>
      <h3 className={h}>Kippen</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li><b className={b}>Nicken</b> (Handy nach vorn kippen, Bildschirm zum Boden): erraten.</li>
        <li><b className={b}>Nach hinten kippen</b> (Bildschirm zur Decke): weiter, der Begriff zählt nicht.</li>
        <li>Danach das Handy wieder gerade halten. Ohne Sensor: rechts tippen = erraten, links = weiter.</li>
        <li>Nach dem Zug zeigt das Handy alle Begriffe – Fehler lassen sich antippen und korrigieren.</li>
      </ul>
      <h3 className={h} data-rule="variants" data-focused={focus === "variants" || undefined}>Varianten</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li><b className={b}>Klassisch:</b> reihum, jeder für sich – jeder erratene Begriff ist ein Punkt für den Ratenden.</li>
        <li><b className={b}>Teams</b> (2–8): Die Spieler werden abwechselnd verteilt. Das eigene Team erklärt, die Punkte gehen ans Team. Mit <b className={b}>Offener Runde</b> ist jede 4. Karte für alle: Wer zuerst richtig rät, holt den Punkt fürs eigene Team (nach dem Zug zuordnen).</li>
        <li><b className={b}>Bombe:</b> Wer die Bombe hält, erklärt dem Nächsten einen Begriff. Erraten? Antippen und weitergeben. Die Lunte brennt geheim {FUSE.min}–{FUSE.max} Sekunden – wer die Bombe beim Knall hält, bekommt sie angeschrieben. Wenigste Bomben gewinnt.</li>
        <li><b className={b}>Hochstapler</b> (ab 3): Alle sehen denselben Begriff, nur einer nicht – er kennt nur die Kategorie. Reihum sagt jeder ein Wort dazu ({LAPS} Runden), dann wird abgestimmt.
          Entlarvt: alle anderen +{IMPOSTOR_POINTS.group}, außer der Hochstapler errät den Begriff noch (+{IMPOSTOR_POINTS.guessed}). Unentdeckt: Hochstapler +{IMPOSTOR_POINTS.escaped}.</li>
      </ul>
      <h3 className={h}>Darstellung</h3>
      <p className="mt-1.5">Neben dem Erklären lassen sich weitere Arten einschalten – jede Karte zeigt dann, wie sie dargestellt wird:</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {STYLES.map((st) => <li key={st.id}><span aria-hidden="true">{st.emoji}</span> <b className={b}>{st.name}:</b> {st.hint}</li>)}
      </ul>
      <p className="mt-1.5">Manche Kategorien haben ihre Art fest: Tierlaute und Geräusche nur mit Lauten, Lieder nur summen, Tätigkeiten als Pantomime.</p>
      <h3 className={h}>Begriffe</h3>
      <p className="mt-1.5">
        {totalWords().toLocaleString("de-DE")} Begriffe in {CATEGORIES.length} Kategorien, in Stufen: {LEVELS.map((l) => `${l.name} (${l.hint})`).join(", ")}. Jede Stufe enthält die leichteren mit.
        Der Ratende wählt vor dem Zug eine Kategorie – oder Zufall bzw. bunt gemischt. Mit <b className={b}>Eigene</b> tippt ihr eigene Begriffe ein (wer rät, schaut weg). Kein Begriff kommt in einer Partie doppelt.
      </p>
      <h3 className={h}>Am Fernseher</h3>
      <p className="mt-1.5">Am Großen Tisch zeigt der Fernseher Uhr, Punkte, Teams und die Darstellungsart – aber nie den Begriff, denn der Ratende schaut mit. Nach dem Zug erscheint die Liste.</p>
      <h3 className={h}>Video der Runde</h3>
      <p className="mt-1.5">Wenn eingeschaltet, filmt das Stirn-Handy mit der Frontkamera die Erklärenden. Das Video bleibt nur auf diesem Gerät und lässt sich nach dem Zug ansehen oder speichern.</p>
    </section>
  );
}

function History({ game: s }: BoardProps<StirnState, StirnAction>) {
  return <LogList entries={s.log} />;
}

function HeaderExtra({ game: s }: BoardProps<StirnState, StirnAction>) {
  const { round, rounds } = roundOf(s);
  const label = s.phase === "over" ? "Ende" : s.variant === "bombe" || s.variant === "hochstapler" ? `Runde ${Math.min(s.turn + 1, s.turns)}/${s.turns}` : `Runde ${round}/${rounds}`;
  return <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border" data-testid="stirn-round">{label}</span>;
}

export const stirnratenUI: GameUI<StirnState, StirnAction> = {
  logic: stirnraten, Icon, Board, Rules, History, HeaderExtra,
  log: (s) => s.log,
  overview: (s) => (s.variant === "teams"
    ? { cols: ["Team", "Punkte"], rows: Object.fromEntries(s.teams.flatMap((t, i) => t.map((id) => [id, [teamName(i).replace("Team ", ""), s.teamScores[i] ?? 0]]))), curId: s.guesser }
    : s.variant === "bombe"
      ? { cols: ["Bomben"], rows: Object.fromEntries(s.order.map((id) => [id, [s.bombs[id] ?? 0]])), curId: s.holder }
      : { cols: ["Punkte"], rows: Object.fromEntries(s.order.map((id) => [id, [s.scores[id] ?? 0]])), curId: s.guesser }),
};
