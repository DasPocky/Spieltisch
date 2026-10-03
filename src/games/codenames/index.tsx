import { codenames, TEAM_NAME, type CNAction, type CNState, type Team } from "@shared/games/codenames/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps, GameUI } from "@/games/types";
import { Section } from "@/platform/MenuSheet";
import { LogList } from "@/platform/PlayersHistory";
import { Board, COLOR } from "./Board";

/** Symbol: kleine Schlüsselkarte mit roten und blauen Feldern */
function Icon({ className }: { className?: string }) {
  const cells = ["#a8454f", "#4b72b0", "#cdc4ae", "#4b72b0", "#a8454f", "#cdc4ae", "#1b1e25", "#a8454f", "#4b72b0"];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="6" y="6" width="28" height="28" rx="5" fill="#fdfdfb" />
      {cells.map((c, i) => <rect key={i} x={9 + (i % 3) * 8} y={9 + Math.floor(i / 3) * 8} width="6.5" height="6.5" rx="1.5" fill={c} />)}
    </svg>
  );
}

function Rules() {
  return (
    <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
      <h3 className="font-semibold text-foreground">Worum geht's?</h3>
      <p className="mt-1.5">
        Zwei Teams, <b style={{ color: COLOR.rot }}>Rot</b> und <b style={{ color: COLOR.blau }}>Blau</b>. Auf dem Tisch liegen 25 Wörter. Nur die beiden
        <b className="text-foreground"> Chefs</b> wissen, welche Wörter zu ihrem Team gehören (Schlüsselkarte). Das Startteam hat 9 Karten, das andere 8, dazu 7 Passanten und ein Attentäter.
      </p>
      <h3 className="mt-4 font-semibold text-foreground">Ein Zug</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Der Chef des Teams am Zug sagt <b className="text-foreground">ein Wort und eine Zahl</b>, z. B. „Wasser 2“ – zwei Karten passen dazu. Das Wort darf keins vom Tisch sein.</li>
        <li>Die Agenten tippen nacheinander Wörter an – höchstens Zahl + 1.</li>
        <li>Eigene Farbe: weiterraten. Passant oder gegnerische Farbe: Zug vorbei (die gegnerische Karte zählt für die anderen).</li>
        <li><b className="text-foreground">Attentäter</b>: Das Team verliert sofort.</li>
        <li>Mindestens ein Wort muss geraten werden, danach darf man freiwillig aufhören („Zug beenden“).</li>
        <li>Die Zahl darf auch <b className="text-foreground">0</b> sein („keine Karte passt dazu“) oder <b className="text-foreground">∞</b> („mehrere, ich sage nicht wie viele“) – dann dürfen die Agenten beliebig oft raten.</li>
      </ol>
      <h3 className="mt-4 font-semibold text-foreground">Sieg</h3>
      <p className="mt-1.5">Wer zuerst alle eigenen Karten aufgedeckt hat, gewinnt – auch wenn das gegnerische Team die letzte Karte aus Versehen aufdeckt. Wer den Attentäter aufdeckt, verliert sofort.</p>
      <h3 className="mt-4 font-semibold text-foreground">Varianten</h3>
      <p className="mt-1.5">
        <b className="text-foreground">In der App:</b> Online sehen die Chefs die Farben am eigenen Handy, die Agenten tippen. An einem Gerät hält der Chef „Chef-Ansicht“ gedrückt, um die Farben kurz zu sehen.
        <br /><b className="text-foreground">Brettspiel-Hilfe:</b> Ihr spielt mit euren Wortkarten. Die App erzeugt nur die Schlüsselkarte (der farbige Rahmen zeigt das Startteam) – jedes Mal eine neue. Aufgedeckte Karten tippt ein Chef an, dann zählt die App mit.
      </p>
    </section>
  );
}

/** Menü: Team wechseln (z. B. wer später dazukommt) und Verlauf */
function MenuExtras({ game: s, me, act }: BoardProps<CNState, CNAction>) {
  const mine = me ? s.members[me] : undefined;
  return (
    <>
      {me && s.phase === "play" && !mine?.chief && (
        <Section title="Dein Team">
          <div className="grid grid-cols-2 gap-2">
            {(["rot", "blau"] as Team[]).map((t) => (
              <Button key={t} variant={mine?.team === t ? "default" : "secondary"} onClick={() => act({ type: "join", team: t, chief: false })}>Agent {TEAM_NAME[t]}</Button>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/** Verlauf für „Spieler & Verlauf“ */
function History({ game: s }: BoardProps<CNState, CNAction>) {
  return <LogList entries={s.log} />;
}

export const codenamesUI: GameUI<CNState, CNAction> = { logic: codenames, Icon, Board, Rules, MenuExtras, History };
