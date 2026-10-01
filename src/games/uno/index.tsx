import type { RoomState } from "@shared/platform/room";
import { uno, type UnoAction, type UnoState } from "@shared/games/uno/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Section } from "@/platform/MenuSheet";
import { MUTED } from "@/lib/palette";
import { Board, UnoCardView } from "./Board";

/** Symbol: zwei aufgefächerte Karten in gedämpften Farben */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="7" y="8" width="16" height="23" rx="3" fill={MUTED.blue} stroke="#fdfdfb" strokeWidth="1.2" transform="rotate(-12 15 20)" />
      <rect x="17" y="8" width="16" height="23" rx="3" fill={MUTED.red} stroke="#fdfdfb" strokeWidth="1.2" transform="rotate(10 25 20)" />
      <text x="25" y="24" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fdfdfb" transform="rotate(10 25 20)">+2</text>
    </svg>
  );
}

const SPECIAL = [
  { card: "b-skip", title: "Aussetzen", text: "Der Nächste ist nicht dran." },
  { card: "g-rev", title: "Richtungswechsel", text: "Die Spielrichtung dreht sich. Zu zweit wirkt die Karte wie Aussetzen." },
  { card: "r-plus2", title: "+2", text: "Der Nächste zieht zwei Karten und setzt aus." },
  { card: "w-wild", title: "Farbwahl", text: "Passt immer. Du bestimmst die Farbe, die als Nächstes bedient werden muss." },
  { card: "w-plus4", title: "+4", text: "Farbwahl – und der Nächste zieht vier und setzt aus. Nur erlaubt, wenn du die gefragte Farbe nicht hast (abschaltbar)." },
] as const;

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
        <h3 className="font-semibold text-foreground">Ziel</h3>
        <p className="mt-1.5">Als Erster alle Karten loswerden. Bei „Bis 500“ bekommt der Rundensieger die Kartenpunkte der anderen (Zahl = Wert, Aktion 20, Schwarz 50) – wer zuerst 500 hat, gewinnt.</p>
        <h3 className="mt-4 font-semibold text-foreground">So geht's</h3>
        <p className="mt-1.5">
          108 Karten, jeder bekommt 7. Leg eine Karte, die in <b className="text-foreground">Farbe oder Zahl/Symbol</b> zur obersten passt.
          Kannst oder willst du nicht, ziehst du eine – passt sie, darfst du sie gleich legen, sonst ist der Nächste dran.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">„Uno!“</h3>
        <p className="mt-1.5">Bevor du deine vorletzte Karte legst, tippst du auf <b className="text-foreground">Uno!</b>. Vergessen: zwei Strafkarten.</p>
        <h3 className="mt-4 font-semibold text-foreground">Varianten</h3>
        <p className="mt-1.5">
          <b className="text-foreground">In der App:</b> an einem Handy mit Sichtschutz beim Weitergeben oder online jeder am eigenen Handy.
          <br /><b className="text-foreground">Echte Karten:</b> ihr spielt mit eurem Uno, die App ist der Punkteblock.
        </p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Sonderkarten</h3>
      <ul className="grid gap-2">
        {SPECIAL.map((x) => (
          <li key={x.card} className="glass flex gap-3 rounded-xl p-3">
            <UnoCardView card={x.card} className="w-11 shrink-0 self-start" />
            <div><b>{x.title}</b><p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{x.text}</p></div>
          </li>
        ))}
      </ul>
    </>
  );
}

function MenuExtras({ game }: BoardProps<UnoState, UnoAction>) {
  return (
    <Section title="Verlauf">
      {game.log.length ? <ul className="text-[0.95rem]">{game.log.slice().reverse().map((e, i) => <li key={i} className="border-b border-border py-2">{e}</li>)}</ul>
        : <p className="text-sm text-muted-foreground">Noch nichts passiert.</p>}
    </Section>
  );
}

/** Verlauf und Spielerübersicht für „Spieler & Verlauf“ */
const log = (s: UnoState) => (s.mode === "table" ? [] : s.log);
const overview = (s: UnoState, room: RoomState) => s.mode === "table" ? null : ({
  cols: room.options.target === "round" ? ["Karten"] : ["Karten", "Punkte"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, room.options.target === "round" ? [s.counts[p.id] ?? 0] : [s.counts[p.id] ?? 0, s.scores[p.id] ?? 0]])),
  curId: s.phase === "play" ? s.curId : null,
});

export const unoUI: GameUI<UnoState, UnoAction> = { logic: uno, Icon, Board, Rules, MenuExtras, log, overview };
