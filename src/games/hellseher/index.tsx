import type { RoomState } from "@shared/platform/room";
import { hellseher, type HsAction, type HsState } from "@shared/games/hellseher/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { MUTED } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { Board } from "./Board";
import { HsCardView } from "./Card";

/** Symbol: Kristallkugel mit Stern auf einem Sockel */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="18" r="11" fill={MUTED.blue} />
      <circle cx="16" cy="14" r="3" fill="#fdfdfb" opacity="0.35" />
      <path transform="translate(22 19) scale(4.5)" fill={MUTED.ochre} d="M0-1L.29-.4L.95-.31L.48.15L.59.81L0 .5L-.59.81L-.48.15L-.95-.31L-.29-.4Z" />
      <path d="M11 33H29L26 28H14Z" fill={MUTED.ink} stroke="#fdfdfb" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <b className="text-foreground">{children}</b>;

function Rules({ focus }: { focus?: string }) {
  return (
    <>
      <section className="glass rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground">
        <h3 className="font-semibold text-foreground">Ziel</h3>
        <p className="mt-1.5">Sag in jeder Runde genau voraus, wie viele Stiche du machst. Wer am Ende die meisten Punkte hat, gewinnt.</p>
        <h3 className="mt-4 font-semibold text-foreground">Karten</h3>
        <p className="mt-1.5">60 Karten: vier Farben (Blau, Rot, Grün, Gelb) mit 1 bis 13, dazu vier <B>Zauberer</B> (Z) und vier <B>Narren</B> (N).</p>
        <h3 className="mt-4 font-semibold text-foreground">Runden</h3>
        <p className="mt-1.5">
          In Runde 1 bekommt jeder 1 Karte, in Runde 2 zwei Karten und so weiter – bis alle Karten verteilt sind:
          zu dritt 20 Runden, zu viert 15, zu fünft 12, zu sechst 10. Der Geber wechselt jede Runde im Uhrzeigersinn.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">Trumpf</h3>
        <p className="mt-1.5">
          Nach dem Geben wird die nächste Karte aufgedeckt – ihre Farbe ist Trumpf. <B>Zauberer:</B> Der Geber schaut in seine Karten und bestimmt den Trumpf.
          <B> Narr:</B> Diese Runde gibt es keinen Trumpf. In der letzten Runde bleibt keine Karte übrig – ohne Trumpf.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">Ansagen</h3>
        <p className="mt-1.5">
          Reihum, links vom Geber beginnend, sagt jeder an, wie viele Stiche er machen will (0 ist erlaubt). Im Original darf die Summe der Ansagen
          genau der Kartenzahl entsprechen.
        </p>
        <h3 className="mt-4 font-semibold text-foreground">Spielen</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Links vom Geber spielt aus, danach immer der Gewinner des letzten Stichs.</li>
          <li><B>Farbe bedienen</B> ist Pflicht. Zauberer und Narren darfst du immer spielen, auch wenn du bedienen könntest. Trumpf musst du nicht stechen.</li>
          <li>Wird ein <B>Zauberer ausgespielt</B>, darf jeder beliebig spielen.</li>
          <li>Wird ein <B>Narr ausgespielt</B>, bestimmt die erste Farbkarte danach, was bedient wird.</li>
        </ul>
        <h3 className="mt-4 font-semibold text-foreground">Wer gewinnt den Stich?</h3>
        <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
          <li>Der <B>erste Zauberer</B>.</li>
          <li>Sonst der <B>höchste Trumpf</B>.</li>
          <li>Sonst die <B>höchste Karte der ausgespielten Farbe</B>.</li>
          <li>Liegen nur Narren, gewinnt der <B>erste Narr</B>.</li>
        </ol>
        <h3 className="mt-4 font-semibold text-foreground">Punkte</h3>
        <p className="mt-1.5">Genau getroffen: <B>20 + 10 je Stich</B>. Daneben: <B>−10 je Stich</B> Abweichung (zu viel oder zu wenig).</p>
        <p className="mt-1">Beispiel: 2 angesagt, 2 gemacht = 40. 2 angesagt, 0 gemacht = −20.</p>
        <h3 className="mt-4 font-semibold text-foreground" data-focused={focus === "house"}>Hausregeln (einstellbar)</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li><B>Ansagen dürfen nicht aufgehen:</B> Der Geber sagt als Letzter an und darf keine Zahl wählen, mit der die Summe der Ansagen genau der Kartenzahl entspricht – so liegt mindestens einer daneben.</li>
          <li><B>Verdeckt ansagen:</B> Alle sagen gleichzeitig an, ohne die anderen Ansagen zu kennen. Aufgedeckt wird, wenn alle fertig sind. (Dann gilt „nicht aufgehen“ nicht – es gibt keinen Letzten.)</li>
          <li><B>Spieldauer:</B> 10 Runden oder eine halbe Partie statt aller Runden.</li>
        </ul>
        <h3 className="mt-4 font-semibold text-foreground">Varianten</h3>
        <p className="mt-1.5">
          <B>In der App:</B> an einem Handy mit Sichtschutz beim Weitergeben oder online jeder am eigenen Handy.
          <br /><B>Echte Karten:</B> ihr spielt mit euren Karten, die App ist der Block. Pro Runde tragt ihr erst die Ansagen ein (die App zeigt, ob sie aufgehen),
          dann die gemachten Stiche – die Punkte rechnet sie selbst, der Geber rückt weiter.
        </p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Besondere Karten</h3>
      <ul className="grid gap-2">
        {[
          { card: "z-1", title: "Zauberer", text: "Gewinnt den Stich – der erste Zauberer schlägt alles, auch spätere Zauberer." },
          { card: "n-1", title: "Narr", text: "Verliert immer. Gut, um einen Stich loszuwerden. Nur wenn alle einen Narren spielen, gewinnt der erste." },
        ].map((x) => (
          <li key={x.card} className="glass flex gap-3 rounded-xl p-3">
            <HsCardView card={x.card} className="w-11 shrink-0 self-start" />
            <div><b>{x.title}</b><p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{x.text}</p></div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Verlauf für „Spieler & Verlauf“: Ansage/Stiche und Punkte je Runde */
function History({ room, game: s }: BoardProps<HsState, HsAction>) {
  if (!s.history.length) return <p className="text-sm text-muted-foreground">Noch keine Runde gewertet.</p>;
  const players = room.players;
  return (
    <div className="no-scrollbar overflow-x-auto" data-testid="history">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1.5 pr-2 text-left font-normal">Runde</th>
            {players.map((p) => <th key={p.id} className="max-w-[5rem] truncate px-1 py-1.5 text-right font-semibold">{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {s.history.slice().reverse().map((h) => (
            <tr key={h.round} className="border-t border-border">
              <td className="py-1.5 pr-2 text-muted-foreground">{h.round}</td>
              {players.map((p) => {
                const hit = h.bids[p.id] === h.tricks[p.id];
                return (
                  <td key={p.id} className="px-1 py-1.5 text-right">
                    <span className="text-xs text-muted-foreground">{h.bids[p.id] ?? "–"}/{h.tricks[p.id] ?? "–"} </span>
                    <b className={cn(hit ? "text-ok" : "text-destructive")}>{(h.points[p.id] ?? 0) > 0 ? "+" : ""}{h.points[p.id] ?? 0}</b>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">Ansage/Stiche und Punkte der Runde</p>
    </div>
  );
}

function HeaderExtra({ game: s }: BoardProps<HsState, HsAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border">
      Runde <b className="text-foreground tabular-nums">{s.round}</b>/{s.totalRounds}
    </span>
  );
}

const log = (s: HsState) => (s.mode === "table" ? [] : s.log);
const overview = (s: HsState, room: RoomState) => ({
  cols: ["Ansage", "Stiche", "Punkte"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [s.bids[p.id] ?? (s.bidIn[p.id] ? "✓" : "–"), s.mode === "table" ? (s.taken[p.id] ?? "–") : (s.tricks[p.id] ?? 0), s.scores[p.id] ?? 0]])),
  curId: s.phase === "bid" || s.phase === "play" || s.phase === "trump" ? s.curId : null,
});

export const hellseherUI: GameUI<HsState, HsAction> = { logic: hellseher, Icon, Board, Rules, History, HeaderExtra, log, overview };
