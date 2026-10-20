import { POINTS, zeichnen, type ZAction, type ZState } from "@shared/games/zeichnen/logic";
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
      <p className="mt-1.5">Reihum zeichnet einer einen Begriff am Handy, die anderen raten. Wer dran ist, sucht sich einen von <b className={b}>drei Begriffen</b> aus – Buchstaben und Zahlen malen ist nicht erlaubt.</p>
      <h3 className={h}>Raten</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li><b className={b}>Laut rufen</b> (am Tisch): Alle rufen ihre Tipps. Wer zeichnet, tippt an, wer es zuerst hatte – der bekommt {POINTS.shout} Punkte, der Zeichner {POINTS.shoutDrawer}.</li>
        <li><b className={b}>Ins Handy tippen</b>: Jeder schreibt seine Tipps, die App prüft sie (kleine Tippfehler zählen). Wer früh rät, bekommt mehr ({POINTS.guessMin}–{POINTS.guessMax}), der Zeichner {POINTS.drawer} je Ratenden. Haben alle es, ist das Bild vorbei.</li>
      </ul>
      <h3 className={h}>Am Fernseher</h3>
      <p className="mt-1.5">Der Fernseher zeigt das Bild groß und live, dazu Uhr und Lücken – den Begriff erst, wenn das Bild vorbei ist.</p>
      <h3 className={h}>Begriffe</h3>
      <p className="mt-1.5">Aus den Stirnraten-Kategorien, die sich malen lassen – in Stufen von Kinder bis Ab 18. Kein Begriff kommt in einer Partie doppelt.</p>
    </section>
  );
}

function History({ game: s }: BoardProps<ZState, ZAction>) {
  return <LogList entries={s.log} />;
}

function HeaderExtra({ game: s }: BoardProps<ZState, ZAction>) {
  return <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border">Bild {Math.min(s.turn + 1, s.turns)}/{s.turns}</span>;
}

export const zeichnenUI: GameUI<ZState, ZAction> = {
  logic: zeichnen, Icon, Board, Rules, History, HeaderExtra,
  log: (s) => s.log,
  overview: (s) => ({ cols: ["Punkte"], rows: Object.fromEntries(s.order.map((id) => [id, [s.scores[id] ?? 0]])), curId: s.drawer }),
};
