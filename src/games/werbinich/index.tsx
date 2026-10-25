import { KATEGORIEN } from "@shared/games/werbinich/figuren";
import { active, werbinich, type WbAction, type WbState } from "@shared/games/werbinich/logic";
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
      <p className="mt-1.5">Jeder bekommt eine <b className={b}>geheime Figur</b>. Alle anderen sehen sie auf ihrem Handy – nur du nicht. Mit Ja/Nein-Fragen findest du heraus, wer du bist.</p>
      <h3 className={h}>Ablauf</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Wer dran ist, stellt <b className={b}>laut eine Frage über sich</b>, z. B. „Bin ich ein Tier?“ (eintippen geht auch, dann steht sie im Notizblock).</li>
        <li>Die anderen stimmen am Handy ab: <b className={b}>Ja, Nein oder Weiß nicht</b>. Die Mehrheit zählt, bei Gleichstand zwischen Ja und Nein gilt „Weiß nicht“.</li>
        <li>Bei <b className={b}>Ja</b> (und Weiß nicht) darfst du weiterfragen – bis zur Grenze je Zug. Bei <b className={b}>Nein</b> ist der Nächste dran.</li>
        <li><b className={b}>Raten</b> geht jederzeit in deinem Zug: tippe den Namen ein – kleine Tippfehler und der markante Teil („Einstein“) zählen. Erkennt die App ihn nicht oder rätst du laut, bestätigen die anderen. Falsch geraten: der Nächste ist dran.</li>
        <li>Wer erraten hat, sieht seine Figur und hilft weiter beim Abstimmen.</li>
      </ol>
      <h3 className={h}>Punkte und Ende</h3>
      <p className="mt-1.5">Wer zuerst errät, bekommt so viele Punkte, wie Spieler mitspielen, der Nächste einen weniger (mindestens 1). Das Spiel endet, wenn alle erraten haben oder die Fragerunden um sind – dann werden alle Figuren aufgelöst.</p>
      <h3 className={h}>Figuren</h3>
      <p className="mt-1.5">{KATEGORIEN.map((k) => `${k.name} (${k.figuren.length})`).join(", ")} – als Chips an- und abwählbar. Oder <b className={b}>Gegenseitig</b>: jeder schreibt geheim eine Figur für seinen Nachbarn. Pakete: <b className={b}>Kinder</b> (Tiere und Märchen, mehr Zeit) und <b className={b}>Schnell</b> (eine Frage je Zug, 6 Runden).</p>
      <h3 className={h}>Notizblock</h3>
      <p className="mt-1.5">Jede Antwort landet in deinem Notizblock, eigene Notizen kannst du dazuschreiben. Nur du siehst ihn.</p>
      <h3 className={h}>Nichts bleibt hängen</h3>
      <p className="mt-1.5">Die Abstimmung hat eine Zeitgrenze, danach zählen die Stimmen, die da sind. Der Host kann eine Antwort setzen, die Abstimmung beenden oder jemanden überspringen; wer aussteigt, wird übersprungen.</p>
      <h3 className={h}>Ein Handy für alle</h3>
      <p className="mt-1.5">Das Handy zeigt immer nur die Figur dessen, der dran ist – und nur, solange jemand den Knopf hält (der Fragende schaut weg). Die Gruppe tippt die Antwort gemeinsam ein.</p>
      <h3 className={h}>Am Fernseher</h3>
      <p className="mt-1.5">Wer fragt, die Frage, die Abstimmung live und wer schon erraten hat – aber nie eine Figur, denn der Fragende schaut mit. Am Ende die Auflösung.</p>
    </section>
  );
}

function History({ game: s }: BoardProps<WbState, WbAction>) {
  return <LogList entries={s.log} />;
}

function HeaderExtra({ game: s }: BoardProps<WbState, WbAction>) {
  const n = Math.min(s.lap + 1, s.laps);
  return (
    <span className="rounded-full bg-secondary px-2.5 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border" data-testid="wbi-round" aria-label={`Runde ${n} von ${s.laps}`}>
      <span className="max-[430px]:hidden">Runde </span><b className="text-foreground tabular-nums">{n}</b>/{s.laps}
    </span>
  );
}

export const werbinichUI: GameUI<WbState, WbAction> = {
  logic: werbinich, Icon, Board, Rules, History, HeaderExtra,
  log: (s) => s.log,
  overview: (s) => ({
    cols: ["Punkte"],
    rows: Object.fromEntries(s.order.map((id) => [id, [active(s).includes(id) ? s.scores[id] ?? 0 : "ausgestiegen"]])),
    curId: s.asker,
  }),
};
