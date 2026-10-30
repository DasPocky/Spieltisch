import { useEffect, useState, type ReactNode } from "react";
import type { RoomState } from "@shared/platform/room";
import { cardsOf, DECK_SIZE, klingel, MAX_FLIPS, PER_COUNT, type KlAction, type KlState } from "@shared/games/klingel/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Board } from "./Board";
import { BellShape, FruitCard } from "./Fruit";
import { Icon } from "./Icon";

const P = ({ children }: { children: ReactNode }) => <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>;
const B = ({ children }: { children: ReactNode }) => <b className="text-foreground">{children}</b>;

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Worum geht's?</h3>
        <P>Alle Karten sammeln. Jeder bekommt einen <B>verdeckten Stapel</B> Obstkarten – {DECK_SIZE} Karten mit Erdbeeren, Bananen, Pflaumen und Birnen, auf jeder 1 bis 5 Früchte einer Sorte (je Sorte {PER_COUNT.map((n, i) => `${n}× ${i + 1}`).join(", ")}).</P>
        <h3 className="mt-4 font-semibold">So geht's</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Reihum deckt jeder seine oberste Karte auf seinen <B>offenen Stapel</B>. Es zählt immer nur die <B>oberste offene Karte</B> jedes Spielers.</li>
          <li>Liegen von einer Sorte <B>genau fünf Früchte</B> offen (zusammengezählt über alle obersten Karten), hau auf die <B>Klingel</B>.</li>
          <li>Wer zuerst richtig klingelt, bekommt <B>alle offenen Karten</B> unter seinen Stapel und deckt als Nächstes auf.</li>
          <li><B>Falsch geklingelt</B> (keine Sorte steht auf genau fünf): Du gibst jedem Mitspieler eine Karte ab.</li>
          <li>Wer keine Karten mehr hat, ist <B>raus</B>. Hat niemand mehr verdeckte Karten, dreht jeder seinen offenen Stapel um.</li>
        </ol>
      </section>
      <div className="mt-4 flex items-center justify-center gap-2" aria-label="Beispiel: drei Bananen und zwei Bananen – genau fünf, also klingeln">
        <FruitCard card="banane-3" className="h-24" label={false} />
        <span className="text-2xl font-bold">+</span>
        <FruitCard card="banane-2" className="h-24" label={false} />
        <span className="text-2xl font-bold">+</span>
        <FruitCard card="erdbeere-4" className="h-24" label={false} />
        <span className="text-2xl font-bold">=</span>
        <BellShape className="h-16" />
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">Fünf Bananen – schnell klingeln! (Die vier Erdbeeren zählen nicht.)</p>
      <section className="glass mt-4 rounded-2xl p-4">
        <h3 className="font-semibold">Ende</h3>
        <P>Gewonnen hat, wer am Ende <B>alle Karten</B> hat. Mit Zeitlimit (5, 10 oder 15 Minuten) gewinnt danach, wer die <B>meisten Karten</B> hat. Spätestens nach {MAX_FLIPS} aufgedeckten Karten wird gezählt.</P>
        <h3 className="mt-4 font-semibold">Wer war schneller?</h3>
        <P>Online misst jedes Handy selbst, wie schnell du nach dem Aufdecken tippst – so zählt das Netz nicht. Der Server wartet nach dem ersten Klingeln einen Wimpernschlag auf die anderen und gibt die Karten dem Schnellsten. Zu schnelle oder unmögliche Zeiten zählen nicht.</P>
        <h3 className="mt-4 font-semibold">Im Takt</h3>
        <P>Mit <B>Automatisch aufdecken</B> deckt die App reihum für alle auf – ruhig, normal oder schnell. Ohne Takt deckt die App selbst auf, wenn jemand zu lange wartet. Pakete: <B>Im Takt</B> (alle 2 Sekunden) und <B>Schnell</B> (gut jede Sekunde, 5 Minuten).</P>
        <h3 className="mt-4 font-semibold">Ein Handy für alle</h3>
        <P>Das Handy liegt in der Mitte. Jeder hat eine Zone am Rand – die gegenüber stehen auf dem Kopf. Zum Klingeln tippst du in deine Zone oder auf die große Klingel (zählt für den, der am nächsten sitzt). Mehrere Finger gleichzeitig gehen, der erste zählt. Aufdecken: auf den eigenen Stapel tippen.</P>
        <h3 className="mt-4 font-semibold">Am Fernseher</h3>
        <P>Die offenen Karten liegen groß an den Plätzen, die Klingel in der Mitte – wer klingelt, steht groß darauf.</P>
      </section>
    </>
  );
}

function HeaderExtra({ game: s }: BoardProps<KlState, KlAction>) {
  const [now, setNow] = useState(() => Date.now());
  const on = s.limitAt !== null && s.phase === "play";
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); };
  }, [on]);
  if (!on) return null;
  const left = Math.max(0, Math.round((s.limitAt! - s.at - (now - recvOf(s))) / 1000));
  return (
    <span className="rounded-full bg-secondary px-2.5 py-1 text-sm whitespace-nowrap tabular-nums text-muted-foreground ring-1 ring-inset ring-border" data-testid="kl-clock" role="timer"
      aria-label={`noch ${Math.floor(left / 60)} Minuten ${left % 60} Sekunden`}>
      <b className="text-foreground">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</b>
    </span>
  );
}

/** Empfangszeit je Stand (am Handy) – die Restzeit läuft ab dem Empfang, nicht nach der Handy-Uhr */
const recvSeen = new WeakMap<KlState, number>();
const recvByAt = new Map<number, number>();
function recvOf(s: KlState): number {
  let t = recvSeen.get(s);
  if (t === undefined) {
    t = recvByAt.get(s.at) ?? Date.now();
    recvByAt.set(s.at, t);
    if (recvByAt.size > 50) recvByAt.delete(recvByAt.keys().next().value!);
    recvSeen.set(s, t);
  }
  return t;
}

const log = (s: KlState) => s.log;
const overview = (s: KlState, room: RoomState) => ({
  cols: ["Karten"],
  rows: Object.fromEntries(room.players.filter((p) => s.order.includes(p.id)).map((p) => [p.id, [s.left.includes(p.id) ? "ausgestiegen" : s.out.includes(p.id) ? "raus" : cardsOf(s, p.id)]])),
  curId: s.phase === "play" ? s.curId : null,
});

export const klingelUI: GameUI<KlState, KlAction> = { logic: klingel, Icon, Board, Rules, HeaderExtra, log, overview };
