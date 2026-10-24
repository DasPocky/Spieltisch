import type { ReactNode } from "react";
import type { RoomState } from "@shared/platform/room";
import { LIDS, schocken, type ShAction, type ShState } from "@shared/games/schocken/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Die } from "@/platform/Die";
import { Board } from "./Board";
import { Icon } from "./Icon";

const P = ({ children }: { children: ReactNode }) => <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>;
const B = ({ children }: { children: ReactNode }) => <b className="text-foreground">{children}</b>;
const Dice = ({ v }: { v: number[] }) => (
  <span className="flex h-7 shrink-0 gap-0.5" aria-hidden="true">{v.map((x, i) => <Die key={i} value={x} className="size-7" />)}</span>
);

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <P>Keine Deckel sammeln. In der Mitte liegen {LIDS} Deckel. Jede Runde bekommt der Spieler mit dem <B>niedrigsten Wurf</B> Deckel – wie viele, bestimmt der <B>höchste Wurf</B>. Wer alle {LIDS} hat, verliert die Hälfte.</P>
        <h3 className="mt-4 font-semibold">So läuft eine Runde</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Der <B>Beginner</B> würfelt mit drei Würfeln – bis zu dreimal. Wie oft er würfelt, gilt für alle: Hört er nach einem Wurf auf, darf jeder nur einmal.</li>
          <li>Zwischen den Würfen darfst du Würfel <B>herauslegen</B> (antippen) und nur die anderen neu würfeln. Herausgelegte Würfel kannst du auch wieder zurücknehmen.</li>
          <li>Mit <B>Stehen lassen</B> gibst du weiter. Haben alle gewürfelt, wird gewertet.</li>
          <li>Gleicher Wurf: Wer <B>weniger Würfe</B> gebraucht hat, liegt vorn, sonst wer früher dran war.</li>
          <li>Der Verlierer der Runde beginnt die nächste.</li>
        </ol>
      </section>

      <h3 className="mt-5 mb-2 font-semibold">Rangfolge – von hoch nach niedrig</h3>
      <ul className="grid gap-2">
        {[
          { v: [1, 1, 1], t: "Schock aus", d: "Drei Einsen – der Verlierer bekommt sofort alle Deckel und verliert die Hälfte." },
          { v: [1, 1, 6], t: "Schock 6 bis Schock 2", d: "Zwei Einsen und eine Zahl: so viele Deckel, wie die Zahl zeigt (Schock 6 = 6 Deckel)." },
          { v: [4, 4, 4], t: "General", d: "Drei Gleiche – 3 Deckel. Sechser-General schlägt Fünfer-General." },
          { v: [3, 4, 5], t: "Straße", d: "Drei aufeinanderfolgende Zahlen – 2 Deckel. 4-5-6 ist die höchste." },
          { v: [6, 5, 3], t: "Zahl", d: "Alles andere – 1 Deckel. Gelesen von hoch nach niedrig: 653 schlägt 652. Der kleinste Wurf ist 221." },
        ].map((x) => (
          <li key={x.t} className="glass flex items-center gap-3 rounded-xl p-3"><Dice v={x.v} /><div><b>{x.t}</b><p className="text-sm text-muted-foreground">{x.d}</p></div></li>
        ))}
      </ul>

      <section className="glass mt-5 rounded-2xl p-4">
        <h3 className="font-semibold">Deckel verteilen</h3>
        <P>Solange Deckel in der Mitte liegen, bekommt der Verlierer sie <B>aus der Mitte</B>. Ist die Mitte leer, gibt der <B>Gewinner der Runde</B> seine Deckel ab. Wer dann keine Deckel hat, ist für diese Hälfte raus und sicher.</P>
        <h3 className="mt-4 font-semibold">Hälften und Finale</h3>
        <P>Wer alle {LIDS} Deckel hat, verliert die Hälfte. Danach beginnt die <B>zweite Hälfte</B> mit allen. Verliert derselbe beide, hat er die Partie verloren – sonst spielen die beiden im <B>Finale</B> gegeneinander. Einstellbar: nur eine Hälfte (Paket „Kurz“).</P>
        <h3 className="mt-4 font-semibold">Hausregel: Sechsen drehen</h3>
        <P>Liegen zwei Sechsen und du darfst noch würfeln, kannst du sie zu <B>einer Eins drehen</B>: Die Eins bleibt draußen, die andere Sechs kommt zurück in den Becher und du musst weiterwürfeln. Im Paket „Kneipe“ an, sonst aus.</P>
        <h3 className="mt-4 font-semibold">Mit echten Würfeln</h3>
        <P>Ihr würfelt mit Becher am Tisch, die App zählt die Deckel: Wer beginnt, tippt nach der Runde ein, wer den höchsten und wer den niedrigsten Wurf hatte und was der höchste war.</P>
      </section>
    </>
  );
}

function HeaderExtra({ game: s }: BoardProps<ShState, ShAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border">
      {s.half === 3 ? <b className="text-foreground">Finale</b> : <>Hälfte <b className="text-foreground tabular-nums">{s.half}</b>/{s.halves}</>}
    </span>
  );
}

const log = (s: ShState) => s.log;
const overview = (s: ShState, room: RoomState) => ({
  cols: ["Deckel", "gesamt"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.members.includes(p.id) ? s.lids[p.id] ?? 0 : "–", s.taken[p.id] ?? 0]])),
  curId: s.phase === "roll" ? s.curId : null,
});

export const schockenUI: GameUI<ShState, ShAction> = { logic: schocken, Icon, Board, Rules, HeaderExtra, log, overview };
