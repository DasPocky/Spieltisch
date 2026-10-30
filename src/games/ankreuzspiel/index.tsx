import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import type { RoomState } from "@shared/platform/room";
import { allCrosses, ankreuzspiel, closeEndOf, MIN_LOCK, MISS_POINTS, ROWS, totalOf, tri, type AkAction, type AkState } from "@shared/games/ankreuzspiel/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Die } from "@/platform/Die";
import { Board } from "./Board";
import { Icon } from "./Icon";
import { ROW_TINTS, WHITE } from "./dice";

const P = ({ children }: { children: ReactNode }) => <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>;
const B = ({ children }: { children: ReactNode }) => <b className="text-foreground">{children}</b>;

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <P>Möglichst viele Kreuze in möglichst wenigen Reihen sammeln. Jeder hat ein Blatt mit vier Reihen: <B>Rot</B> und <B>Gelb</B> von 2 bis 12, <B>Grün</B> und <B>Blau</B> von 12 bis 2. Angekreuzt wird immer <B>von links nach rechts</B> – was du überspringst, bleibt für immer leer.</P>
        <div className="mt-3 flex items-center gap-1" aria-hidden="true">
          <Die value={3} tint={WHITE} className="size-7" /><Die value={5} tint={WHITE} className="size-7" />
          {ROW_TINTS.map((t, i) => <Die key={i} value={[2, 6, 4, 1][i]} tint={t} className="size-7" />)}
        </div>
        <h3 className="mt-4 font-semibold">So läuft ein Zug</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Wer dran ist, würfelt alle sechs Würfel: zwei weiße und je einen in den vier Farben.</li>
          <li><B>Weiß für alle:</B> Jeder darf gleichzeitig die Summe der beiden weißen Würfel in <B>einer</B> Reihe seiner Wahl ankreuzen – oder verzichten.</li>
          <li><B>Farbe nur für den Spieler am Zug:</B> Danach darf er zusätzlich einen weißen und einen farbigen Würfel zusammenzählen und die Summe in der Reihe dieser Farbe ankreuzen.</li>
          <li>Kreuzt er in beiden Schritten nichts an, ist das ein <B>Fehlwurf</B> ({MISS_POINTS} Minuspunkte). Die anderen bekommen nie einen Fehlwurf.</li>
        </ol>
      </section>

      <section className="glass mt-5 rounded-2xl p-4">
        <h3 className="flex items-center gap-1.5 font-semibold"><Lock className="size-4" />Reihe abschließen</h3>
        <P>Das letzte Feld einer Reihe (12 bei Rot und Gelb, 2 bei Grün und Blau) darfst du erst ankreuzen, wenn du schon <B>mindestens {MIN_LOCK} Kreuze</B> in der Reihe hast. Dann kreuzt du auch das Schloss an – es zählt als weiteres Kreuz. Die Reihe ist damit <B>für alle abgeschlossen</B> und ihr Würfel ist raus. Wer im selben Wurf mit Weiß dieselbe Reihe abschließt, bekommt das Schloss ebenfalls.</P>
        <h3 className="mt-4 font-semibold">Ende</h3>
        <P>Die Partie endet sofort, wenn <B>zwei Reihen abgeschlossen</B> sind oder jemand seinen <B>vierten Fehlwurf</B> hat. Pakete: „Kurz“ (eine Reihe oder drei Fehlwürfe), „Lang“ (drei Reihen oder fünf Fehlwürfe).</P>
        <h3 className="mt-4 font-semibold">Punkte</h3>
        <P>Je Reihe zählen die Kreuze (mit Schloss) nach Dreieckszahlen – jedes weitere Kreuz bringt mehr:</P>
        <div className="mt-2 grid grid-cols-6 gap-1 text-center text-xs tabular-nums">
          {Array.from({ length: 12 }, (_, k) => (
            <div key={k} className="rounded-lg bg-secondary py-1"><div className="text-muted-foreground">{k + 1}✕</div><b>{tri(k + 1)}</b></div>
          ))}
        </div>
        <P>Alle vier Reihen zusammen, minus {MISS_POINTS} je Fehlwurf. Wer am meisten hat, gewinnt.</P>
        <h3 className="mt-4 font-semibold">Online</h3>
        <P>Bei Weiß entscheiden alle gleichzeitig am eigenen Handy. Wer nicht innerhalb der Bedenkzeit wählt, verzichtet für diesen Wurf. Der Host kann im Menü auch sofort weiterschalten.</P>
      </section>
    </>
  );
}

function HeaderExtra({ game: s, room }: BoardProps<AkState, AkAction>) {
  const closed = s.closed.filter(Boolean).length;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border" aria-label={`${closed} von ${closeEndOf(room.options)} Reihen abgeschlossen`}>
      <Lock className="size-3.5" /><b className="text-foreground tabular-nums">{closed}</b>/{closeEndOf(room.options)}
      {ROWS.map((r, i) => s.closed[i] && <i key={r.key} className="size-2.5 rounded-full" style={{ background: r.color }} />)}
    </span>
  );
}

const log = (s: AkState) => s.log;
const overview = (s: AkState, room: RoomState) => ({
  cols: ["Punkte", "Kreuze", "Fehlwürfe"],
  rows: Object.fromEntries(room.players.map((p) => {
    const sh = s.sheets[p.id];
    return [p.id, sh ? [totalOf(sh), allCrosses(sh), sh.misses] : ["–", "–", "–"]];
  })),
  curId: s.phase === "over" ? null : s.curId,
});

export const ankreuzspielUI: GameUI<AkState, AkAction> = { logic: ankreuzspiel, Icon, Board, Rules, HeaderExtra, log, overview };
