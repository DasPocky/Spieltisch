import type { RoomState } from "@shared/platform/room";
import { flip7, type F7Action, type F7State } from "@shared/games/flip7/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Board, Tile } from "./Board";

/** Symbol: gefächerte Zahlenkarten mit der 7 vorn */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="6" y="9" width="15" height="22" rx="3" fill="#bcd3f5" transform="rotate(-16 13.5 20)" />
      <rect x="19" y="9" width="15" height="22" rx="3" fill="#86aee8" transform="rotate(16 26.5 20)" />
      <rect x="12.5" y="7" width="15" height="23" rx="3" fill="#fdfdfb" />
      <text x="20" y="24.5" textAnchor="middle" fontSize="14" fontWeight="800" fill="#1f437f">7</text>
    </svg>
  );
}

function HeaderExtra({ game }: BoardProps<F7State, F7Action>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border">
      <b className="text-foreground tabular-nums">{game.deckCount}</b> Karten{game.variant === "fies" && " · fies"}
    </span>
  );
}


const Row = ({ cards, title, text }: { cards: string[]; title: string; text: string }) => (
  <li className="glass flex gap-3 rounded-xl p-3">
    <div className="flex shrink-0 gap-1 self-start">{cards.map((c) => <Tile key={c} card={c} />)}</div>
    <div><b>{title}</b><p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p></div>
  </li>
);

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Wer am Ende einer Runde als Erster das Spielziel (Standard 200 Punkte) erreicht, gewinnt – bei mehreren die höchste Summe. Gleichstand an der Spitze: Es wird weitergespielt, bis einer allein vorn liegt.</p>
        <h3 className="mt-4 font-semibold">So geht's</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Jeder bekommt eine offene Karte. Dann entscheidet reihum jeder: <b className="text-foreground">Noch eine!</b> oder <b className="text-foreground">Aufhören</b>.</li>
          <li>Ziehst du eine Zahl, die schon vor dir liegt, bist du <b className="text-foreground">raus</b> – 0 Punkte in dieser Runde.</li>
          <li>Wer aufhört, bekommt die Summe seiner Zahlen plus Modifikatoren (×2 verdoppelt die Zahlen, dann kommen Plus und Minus dazu).</li>
          <li><b className="text-foreground">Flip 7:</b> Sieben verschiedene Zahlen bringen +15 und beenden die Runde sofort für alle.</li>
          <li>Die Runde endet, wenn niemand mehr aktiv ist. Dann gibt es die nächste Karte, und der Geber wechselt.</li>
        </ol>
        <h3 className="mt-4 font-semibold">Mit echten Karten</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Ihr spielt mit eurem Flip 7 am Tisch, die App ist der Punkteblock: Jeder trägt nach der Runde seine Punkte ein, der Host schließt ab. Wer das Ziel erreicht, beendet die Partie.</p>
        <p className="mt-2 text-sm text-muted-foreground">Der Stapel: von jeder Zahl so viele Karten, wie sie wert ist (zwölf 12er … eine 1), dazu eine 0.</p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Klassisch</h3>
      <ul className="grid gap-2">
        <Row cards={["a:freeze"]} title="Einfrieren" text="Du wählst einen aktiven Spieler (auch dich). Er muss sofort aufhören und behält seine Punkte." />
        <Row cards={["a:flip3"]} title="Flip 3" text="Ein aktiver Spieler (auch du) muss drei Karten ziehen. Aktionen, die dabei kommen, werden danach ausgeführt." />
        <Row cards={["a:second"]} title="Zweite Chance" text="Rettet dich einmal vor einer doppelten Zahl. Hast du schon eine, gibst du sie einem anderen aktiven Spieler." />
        <Row cards={["m:+4", "m:x2"]} title="Modifikatoren" text="+2 bis +10 und ×2 (verdoppelt nur die Zahlen)." />
      </ul>
      <h3 className="mt-5 mb-2 font-semibold">Voll fies <span className="text-xs font-normal text-muted-foreground">(Hausvariante)</span></h3>
      <p className="mb-2 text-sm leading-relaxed text-muted-foreground">Eigene Variante, angelehnt an „Flip 7: Voll fies!“ – Kartenverteilung und Details weichen vom Original ab. Keine zweite Chance, Zahlen bis 13 (dreizehn 13er).</p>
      <ul className="grid gap-2">
        <Row cards={["n:13L"]} title="Glücks-13" text="Mit ihr darfst du eine zweite 13 haben, ohne rauszufliegen." />
        <Row cards={["n:7U"]} title="Unglücks-7" text="Alles andere vor dir wird abgeworfen – nur die 7 bleibt liegen." />
        <Row cards={["a:one"]} title="Nur noch eine!" text="Ein aktiver Spieler muss genau noch eine Karte ziehen und ist danach fertig." />
        <Row cards={["a:flip4"]} title="Flip 4" text="Ein aktiver Spieler muss vier Karten ziehen – ohne Pause." />
        <Row cards={["a:swap"]} title="Tauschen" text="Tausche zwei offene Zahlenkarten zweier Spieler – auch eine eigene. Wer dadurch eine doppelte Zahl hat, fliegt raus." />
        <Row cards={["a:steal"]} title="Klauen" text="Nimm dir eine offene Karte eines anderen – doppelte Zahl heißt auch für dich: raus." />
        <Row cards={["a:discard"]} title="Abwerfen" text="Eine beliebige offene Karte auf dem Tisch kommt weg." />
        <Row cards={["m:-4", "m:/2"]} title="Minus und ÷2" text="Diese Karten verschenkst du an einen anderen aktiven Spieler. ÷2 halbiert seine Zahlen. Rundenpunkte und Stand können dadurch auch negativ werden." />
      </ul>
    </>
  );
}

/** Verlauf und Spielerübersicht für „Spieler & Verlauf“ */
const STATUS: Record<string, string> = { active: "spielt", stayed: "hört auf", bust: "raus", frozen: "eingefroren", done: "fertig" };
const log = (s: F7State) => (s.mode === "table" ? [] : s.log);
const overview = (s: F7State, room: RoomState) => s.mode === "table" ? null : ({
  cols: ["Runde", "Karten", "Gesamt"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [STATUS[s.lines[p.id]?.status ?? ""] ?? "–", s.lines[p.id]?.nums.length ?? 0, s.scores[p.id] ?? 0]])),
  curId: s.pending ? s.pending.by : s.curId,
});

export const flip7UI: GameUI<F7State, F7Action> = { logic: flip7, Icon, Board, Rules, HeaderExtra, log, overview };
