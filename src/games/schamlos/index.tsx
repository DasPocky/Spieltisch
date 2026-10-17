import { schamlos, HAND, TIERS, type SchamlosAction, type SchamlosState } from "@shared/games/schamlos/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { LogList } from "@/platform/PlayersHistory";
import { Board } from "./Board";
import { Icon } from "./Icon";

function Rules() {
  const h = "mt-4 font-semibold text-foreground";
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Worum geht's?</h3>
      <p className="mt-1.5">
        Lückensätze frech füllen. Jede Runde ist jemand <b className="text-foreground">Zar</b> und deckt eine schwarze Karte mit Lücke auf.
        Alle anderen haben {HAND} weiße Karten auf der Hand und legen verdeckt die, die am besten – oder am schlimmsten – passt.
      </p>
      <h3 className={h}>Ablauf einer Runde</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Die schwarze Karte zeigt eine Lücke (manchmal zwei – dann legst du zwei Karten in der richtigen Reihenfolge).</li>
        <li>Jeder außer dem Zar wählt am eigenen Handy seine Antwort. An einem Gerät für alle geht das reihum mit Sichtschutz.</li>
        <li>Sind alle Antworten da, werden sie gemischt aufgedeckt. Der Zar liest alle Sätze laut vor und wählt den besten – ohne zu wissen, von wem er ist.</li>
        <li>Wer den Satz gelegt hat, bekommt einen Punkt. Alle ziehen auf {HAND} Karten nach, der nächste wird Zar.</li>
      </ol>
      <h3 className={h}>Stufen</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {TIERS.map((t) => <li key={t.value}><b className="text-foreground">{t.label}</b> – {t.hint}</li>)}
      </ul>
      <p className="mt-1.5">Höhere Stufen spielen die Karten der darunter mit. Die Stufe wählt der Host vor dem Start.</p>
      <h3 className={h}>Sieg</h3>
      <p className="mt-1.5">Wer zuerst die eingestellten Punkte hat (Standard 7), gewinnt.</p>
      <h3 className={h}>Großer Tisch</h3>
      <p className="mt-1.5">Läuft ein Laptop oder Fernseher als Tisch mit, steht die schwarze Karte groß in der Mitte und die Antworten werden dort aufgedeckt – gewählt wird weiter am Handy.</p>
    </section>
  );
}

function History({ game: s }: BoardProps<SchamlosState, SchamlosAction>) {
  return <LogList entries={s.log} />;
}

function HeaderExtra({ game: s }: BoardProps<SchamlosState, SchamlosAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border">
      {TIERS.find((t) => t.value === s.tier)?.label}
    </span>
  );
}

export const schamlosUI: GameUI<SchamlosState, SchamlosAction> = {
  logic: schamlos, Icon, Board, Rules, History, HeaderExtra,
  log: (s) => s.log,
  overview: (s) => ({ cols: ["Punkte"], rows: Object.fromEntries(Object.entries(s.scores).map(([id, n]) => [id, [n]])), curId: s.czar }),
};
