import type { ReactNode } from "react";
import type { RoomState } from "@shared/platform/room";
import { bluff, totalDice, type BluffAction, type BluffState } from "@shared/games/bluff/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Die } from "@/platform/Die";
import { Board } from "./Board";
import { Icon } from "./Icon";

const P = ({ children }: { children: ReactNode }) => <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>;
const B = ({ children }: { children: ReactNode }) => <b className="text-foreground">{children}</b>;

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <P>Als Letzter noch Würfel haben. Jeder hat <B>fünf Würfel</B> verdeckt unter seinem Becher – nur du siehst deine. Wer falsch liegt, verliert einen Würfel; wer keinen mehr hat, ist raus.</P>
        <h3 className="mt-4 font-semibold">So läuft eine Runde</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Alle schütteln ihre Becher und schauen allein nach.</li>
          <li>Reihum sagt jeder an: „<B>Mindestens N Würfel zeigen X</B>“ – gezählt über <B>alle Becher</B> am Tisch, nicht nur deinen.</li>
          <li>Jede Ansage muss <B>höher</B> sein: mehr Würfel, oder gleich viele mit höherer Augenzahl (drei Vieren → drei Fünfen oder vier Zweien).</li>
          <li>Statt zu erhöhen rufst du <B>„Bluff!“</B>: Alle decken auf. Liegen weniger als angesagt, verliert der Ansager einen Würfel – sonst du.</li>
          <li>Der Verlierer beginnt die nächste Runde (ist er raus, sein Nachbar).</li>
        </ol>
      </section>

      <ul className="mt-5 grid gap-2">
        <li className="glass flex items-center gap-3 rounded-xl p-3"><Die value={1} className="size-8 shrink-0" /><div><b>Einsen sind Joker</b><p className="text-sm text-muted-foreground">Sie zählen für jede Augenzahl mit. Auf Einsen wechseln braucht nur die halbe Anzahl (aufgerundet: nach sieben Fünfen reichen vier Einsen), zurück das Doppelte plus eins. Mit Einsen eröffnet niemand. Paket „Ohne Joker“: Einsen zählen nur als Eins.</p></div></li>
        <li className="glass flex items-center gap-3 rounded-xl p-3"><Die value={6} className="size-8 shrink-0" /><div><b>„Genau!“</b><p className="text-sm text-muted-foreground">Glaubst du, die Ansage stimmt exakt? Liegen genau so viele, bekommst du einen Würfel zurück (höchstens bis zur Startzahl) – sonst verlierst du einen. Lässt sich ausschalten.</p></div></li>
      </ul>

      <section className="glass mt-5 rounded-2xl p-4">
        <h3 className="font-semibold">In der App</h3>
        <P>Tippe auf deinen Becher, um deine Würfel zu sehen – passende leuchten blau. Online sieht jeder nur seinen eigenen Becher. An einem Handy für alle gebt ihr es weiter; der Becher bleibt zu, bis der Richtige „Ich bin …“ getippt hat. Paket „Kurz“: drei Würfel je Spieler.</P>
        <h3 className="mt-4 font-semibold">Mit echten Würfeln</h3>
        <P>Ihr würfelt mit Bechern am Tisch, die App führt Ansagen und zählt die Würfel. Wer „Bluff!“ oder „Genau!“ ruft, tippt nach dem Aufdecken ein, wie viele passende Würfel liegen.</P>
      </section>
    </>
  );
}

function HeaderExtra({ game: s }: BoardProps<BluffState, BluffAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border">
      <b className="text-foreground tabular-nums">{totalDice(s)}</b> Würfel
    </span>
  );
}

const log = (s: BluffState) => s.log;
const overview = (s: BluffState, room: RoomState) => ({
  cols: ["Würfel"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [(s.count[p.id] ?? 0) > 0 ? s.count[p.id] : "raus"]])),
  curId: s.phase === "bid" ? s.curId : null,
});

export const bluffUI: GameUI<BluffState, BluffAction> = { logic: bluff, Icon, Board, Rules, HeaderExtra, log, overview };
