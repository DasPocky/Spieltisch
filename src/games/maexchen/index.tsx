import type { ReactNode } from "react";
import type { RoomState } from "@shared/platform/room";
import { labelOf, maexchen, MAEXCHEN, type MaexAction, type MaexState } from "@shared/games/maexchen/logic";
import type { GameUI } from "@/games/types";
import { Board, Pair } from "./Board";

/** Symbol: Würfelbecher, daneben Eins und Zwei – das Mäxchen */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M8 5 H24 L27 31 Q27 34 24 34 H8 Q5 34 5 31 Z" fill="#2c5aa6" transform="rotate(-10 16 20)" />
      <rect x="7" y="3.5" width="18" height="4" rx="2" fill="#86aee8" transform="rotate(-10 16 20)" />
      <rect x="20" y="15" width="13" height="13" rx="3" fill="#fdfdfb" transform="rotate(12 26.5 21.5)" />
      <circle cx="26.5" cy="21.5" r="1.7" fill="#a84a57" />
      <rect x="23" y="26" width="13" height="13" rx="3" fill="#bcd3f5" transform="rotate(-6 29.5 32.5)" />
      <g fill="#1f437f" transform="rotate(-6 29.5 32.5)"><circle cx="26.5" cy="29.5" r="1.5" /><circle cx="32.5" cy="35.5" r="1.5" /></g>
    </svg>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>;
const B = ({ children }: { children: ReactNode }) => <b className="text-foreground">{children}</b>;

function Rules() {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <P>Bluffen und durchschauen. Jeder hat ein paar Leben (Deckel, Standard 3). Wer falschliegt, verliert eins – wer keins mehr hat, scheidet aus. Wer als Letzter übrig bleibt, gewinnt.</P>
        <h3 className="mt-4 font-semibold">So läuft ein Zug</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Du würfelst mit zwei Würfeln <B>verdeckt</B> unter dem Becher und schaust allein nach.</li>
          <li>Dann sagst du einen Wert an, der <B>höher</B> ist als die Ansage vor dir – die Wahrheit oder gelogen. Ein gleicher Wert reicht nicht.</li>
          <li>Der Nächste entscheidet: <B>Glauben</B> – dann würfelt er selbst neu, schaut nach und muss wieder höher ansagen. Oder <B>Aufdecken</B>.</li>
          <li>Beim Aufdecken zählt, was unter dem Becher liegt: Ist es <B>mindestens so hoch</B> wie angesagt, verliert der Aufdeckende ein Leben, sonst der Ansager.</li>
          <li>Danach beginnt eine neue Runde ohne Ansage. Der Verlierer fängt an (ist er raus, sein Nachbar).</li>
        </ol>
      </section>

      <h3 className="mt-5 mb-2 font-semibold">Rangfolge – von hoch nach niedrig</h3>
      <ul className="grid gap-2">
        <li className="glass flex items-center gap-3 rounded-xl p-3"><Pair value={MAEXCHEN} className="h-8 shrink-0" /><div><b>Mäxchen (2 und 1)</b><p className="text-sm text-muted-foreground">schlägt alles. Nach einer Mäxchen-Ansage kann man nur noch aufdecken.</p></div></li>
        <li className="glass flex items-center gap-3 rounded-xl p-3"><Pair value={66} className="h-8 shrink-0" /><div><b>Pasche</b><p className="text-sm text-muted-foreground">Sechserpasch, Fünferpasch … bis Einerpasch – jeder Pasch schlägt jede Zahl.</p></div></li>
        <li className="glass flex items-center gap-3 rounded-xl p-3"><Pair value={65} className="h-8 shrink-0" /><div><b>Zahlen</b><p className="text-sm text-muted-foreground">Die höhere Ziffer steht vorn: 65, 64, 63 … 32, 31. Der kleinste Wurf ist 31.</p></div></li>
      </ul>

      <section className="glass mt-5 rounded-2xl p-4">
        <h3 className="font-semibold">Mäxchen kostet doppelt</h3>
        <P>Wer eine Mäxchen-Ansage aufdeckt und es liegt wirklich ein Mäxchen, verliert <B>2 Leben</B>. Lässt sich als Hausregel ausschalten – dann kostet es wie immer 1 Leben.</P>
        <h3 className="mt-4 font-semibold">Hausregel: blind weitergeben</h3>
        <P>Wer die Ansage glaubt, darf den Becher auch <B>ungesehen weitergeben</B>, ohne neu zu würfeln – muss aber trotzdem höher ansagen. Beim Aufdecken zählt dann der Wurf, der noch unter dem Becher liegt. Alle sehen, dass blind weitergegeben wurde. Lässt sich ausschalten.</P>
        <h3 className="mt-4 font-semibold">In der App</h3>
        <P>
          Die App würfelt verdeckt: Tippe auf den Becher, um deinen Wurf anzusehen – nur du siehst ihn. Online sieht jeder nur seinen eigenen Wurf, die Ansagen sehen alle.
          Spielt ihr mit einem Handy, gebt ihr es weiter; der Becher bleibt zu, bis der Richtige „Ich bin …“ getippt hat.
        </P>
        <h3 className="mt-4 font-semibold">Mit echten Würfeln</h3>
        <P>
          Ihr würfelt mit Becher und Würfeln am Tisch. Die App führt Ansagen und Leben: Wer dran ist, tippt seine Ansage ein (Glauben heißt einfach: höher ansagen).
          Wer aufdeckt, hebt den Becher und tippt <B>Stimmt</B> oder <B>Gelogen</B>.
        </P>
      </section>
    </>
  );
}

/** Verlauf für die Leiste über dem Spiel und „Spieler & Verlauf“ – nur Öffentliches */
const log = (s: MaexState) => s.events.map((e) => {
  if (e.t === "ann") return `${e.name}: ${labelOf(e.value)}${e.blind ? " (blind)" : ""}`;
  if (e.t === "skip") return `${e.name} übersprungen – neue Runde`;
  return `${e.byName} deckt auf: ${labelOf(e.value)} ${e.truth ? "stimmt" : "gelogen"} – ${e.loserName} ${e.out ? "ist raus" : `−${e.cost}`}`;
});

const overview = (s: MaexState, room: RoomState) => ({
  cols: ["Leben"],
  rows: Object.fromEntries(room.players.map((p) => [p.id, [(s.lives[p.id] ?? 0) > 0 ? s.lives[p.id] : "raus"]])),
  curId: s.over ? null : s.curId,
});

export const maexchenUI: GameUI<MaexState, MaexAction> = { logic: maexchen, Icon, Board, Rules, log, overview };
