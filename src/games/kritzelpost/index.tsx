import { kritzelpost, type KAction, type KState } from "@shared/games/kritzelpost/logic";
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
      <p className="mt-1.5">Stille Post mit Bildern. Jeder hat eine <b className={b}>Kette</b>. Alle Ketten wandern gleichzeitig reihum: Wer einen Satz bekommt, <b className={b}>zeichnet</b> ihn – wer eine Zeichnung bekommt, <b className={b}>beschreibt</b> sie in einem Satz. Am Ende ist aus „Ein Pinguin verkauft Eis“ etwas ganz anderes geworden.</p>
      <h3 className={h}>Ablauf</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Jeder schreibt geheim einen Satz (die Glühbirne hat Ideen).</li>
        <li>Dann abwechselnd zeichnen und beschreiben – du siehst immer <b className={b}>nur die Seite direkt davor</b>.</li>
        <li>Es gibt so viele Schritte wie Spieler: jeder kommt in jeder Kette einmal dran und bekommt seine eigene erst im Album zurück.</li>
        <li>Zum Schluss blättert der Host das <b className={b}>Album</b> auf – Kette für Kette, Seite für Seite. Punkte gibt es keine, nur Gelächter.</li>
      </ol>
      <h3 className={h}>Modi</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li><b className={b}>Normal</b>: jeder beginnt mit einem eigenen Satz.</li>
        <li><b className={b}>Eisbrecher</b>: alle zeichnen zuerst denselben vorgegebenen Satz – spannend, wie verschieden das wird.</li>
      </ul>
      <h3 className={h}>Zeit und Aussteiger</h3>
      <p className="mt-1.5">Mit Uhr gibt jeder ab, was bis zum Ablauf dasteht – fehlt etwas, bleibt die Seite leer und es geht weiter. Wer aussteigt, wird übersprungen; der Host kann jederzeit „weiter“ sagen. An einem Handy für alle geht es reihum ohne Uhr.</p>
      <h3 className={h}>Am Fernseher</h3>
      <p className="mt-1.5">Vor dem Album zeigt der Fernseher nur, wer fertig ist – keine Sätze, keine Zeichnungen. Im Album die aufgeschlagene Seite groß.</p>
    </section>
  );
}

function History({ game: s }: BoardProps<KState, KAction>) {
  return <LogList entries={s.log} />;
}

function HeaderExtra({ game: s }: BoardProps<KState, KAction>) {
  const text = s.phase === "play" ? `Schritt ${s.round + 1}/${s.turns}` : s.phase === "over" ? "Album" : `Kette ${Math.min(s.book + 1, s.books.length)}/${s.books.length}`;
  return <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border">{text}</span>;
}

export const kritzelpostUI: GameUI<KState, KAction> = {
  logic: kritzelpost, Icon, Board, Rules, History, HeaderExtra,
  log: (s) => s.log,
  overview: (s) => ({ cols: ["Stand"], rows: Object.fromEntries(s.order.map((id) => [id, [s.left.includes(id) ? "ausgestiegen" : s.phase !== "play" ? "im Album" : s.done.includes(id) ? "fertig" : "dran"]])), curId: null }),
};
