import type { ReactNode } from "react";
import type { RoomState } from "@shared/platform/room";
import { ROOMS, spurensuche, SUSPECTS, WEAPONS, type SpAction, type SpState } from "@shared/games/spurensuche/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Board } from "./Board";
import { Icon } from "./Icon";

const P = ({ children }: { children: ReactNode }) => <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>;
const B = ({ children }: { children: ReactNode }) => <b className="text-foreground">{children}</b>;

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <P>Im Landhaus ist ein Mord geschehen. Verdeckt liegen drei Karten: <B>wer</B>, <B>womit</B> und <B>wo</B>. Wer sie als Erster richtig nennt, gewinnt. Die übrigen Karten sind verteilt – jede Karte, die jemand hat, scheidet aus.</P>
        <h3 className="mt-4 font-semibold">Dein Zug</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li><B>Würfeln</B> (zwei Würfel) und höchstens so viele Felder durch die Flure ziehen – nicht schräg, nicht über andere Figuren. Ein Raum beendet den Zug.</li>
          <li>Aus einer <B>Ecke</B> führt ein <B>Geheimgang</B> (⇵) in die gegenüberliegende Ecke – statt zu würfeln.</li>
          <li>Im Raum äußerst du einen <B>Verdacht</B>: eine Person und ein Werkzeug, der Ort ist dieser Raum. Person und Werkzeug kommen in den Raum.</li>
          <li><B>Reihum</B> im Uhrzeigersinn: Der Erste, der eine der drei Karten hat, zeigt dir <B>genau eine</B> – nur dir. Wer keine hat, sagt es.</li>
          <li>Wurde deine Figur durch einen Verdacht in einen Raum geholt, darfst du dort im nächsten Zug ohne Würfeln verdächtigen.</li>
        </ol>
        <h3 className="mt-4 font-semibold">Anklage</h3>
        <P>Bist du sicher, klagst du in deinem Zug an. Richtig: gewonnen. Falsch: du scheidest aus, zeigst aber weiter Karten. Jeder hat nur <B>eine</B> Anklage.</P>
      </section>
      <section className="glass mt-5 rounded-2xl p-4">
        <h3 className="font-semibold">Die Karten</h3>
        <P><B>Wer:</B> {SUSPECTS.map((x) => x.name).join(", ")}.</P>
        <P><B>Womit:</B> {WEAPONS.map((x) => x.name).join(", ")}.</P>
        <P><B>Wo:</B> {ROOMS.map((x) => x.name).join(", ")}.</P>
        <h3 className="mt-4 font-semibold">In der App</h3>
        <P>Der <B>Notizblock</B> streicht deine eigenen und alle dir gezeigten Karten selbst; weitere Vermutungen markierst du mit ✗, ? oder ✓. Online sieht jeder nur seine Karten. An einem Handy für alle reicht ihr es weiter – auch zum Widerlegen. Hat jemand nur eine passende Karte, zeigt die App sie von selbst (abschaltbar).</P>
      </section>
    </>
  );
}

function HeaderExtra({ game: s }: BoardProps<SpState, SpAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border">
      <b className="text-foreground tabular-nums">{s.history.length}</b> {s.history.length === 1 ? "Verdacht" : "Verdachte"}
    </span>
  );
}

const log = (s: SpState) => s.log;
const overview = (s: SpState, room: RoomState) => ({
  cols: ["Figur", "Karten", ""],
  rows: Object.fromEntries(room.players.filter((p) => s.role[p.id]).map((p) => [p.id, [
    SUSPECTS.find((x) => x.id === s.role[p.id])?.short ?? "", s.hands[p.id]?.length ?? Math.round(18 / Object.keys(s.role).length), s.out.includes(p.id) ? "raus" : "",
  ]])),
  curId: s.phase === "over" ? null : s.curId,
});

export const spurensucheUI: GameUI<SpState, SpAction> = { logic: spurensuche, Icon, Board, Rules, HeaderExtra, log, overview };
