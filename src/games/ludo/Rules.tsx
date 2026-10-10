import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const Sec = ({ id, focus, title, children }: { id?: string; focus?: string; title: string; children: ReactNode }) => (
  <section data-focused={!!id && id === focus} className={cn("scroll-mt-3 rounded-2xl p-4", id && id === focus ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
    <h3 className="font-semibold">{title}</h3>
    <div className="mt-1.5 grid gap-1.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const HOUSE: [string, string][] = [
  ["Aufstellung: Alle im Haus", "Keine Figur steht am Anfang draußen – jede kommt erst mit einer 6 heraus. So spielen es die meisten Familien."],
  ["Startfeld: Stehen lassen", "Eine Figur auf dem eigenen Startfeld muss nicht sofort weiter. Sie kann dort aber geschlagen werden."],
  ["Startfeld: Blockieren", "Wie „Stehen lassen“, zusätzlich ist die Figur auf ihrem Startfeld sicher: Niemand darf darauf ziehen (überspringen geht)."],
  ["Schlagzwang", "Kannst du eine fremde Figur schlagen, musst du es tun. Bei mehreren Möglichkeiten wählst du. Rausgehen mit der 6 und das Räumen des Startfelds gehen trotzdem vor."],
  ["Rückwärts schlagen", "Du darfst die Augenzahl auch rückwärts ziehen – aber nur, wenn du damit eine fremde Figur schlägst, und nie hinter dein Startfeld zurück."],
  ["Im Ziel überspringen", "In den Zielfeldern darfst du über eigene Figuren springen. Ohne diese Regel muss jede Figur genau passend einziehen und darf keine eigene überspringen."],
  ["Auch mit 1 raus", "Neben der 6 bringt auch eine 1 eine Figur aufs Startfeld (du darfst, musst aber nicht). Nochmal würfeln gibt es nur bei der 6."],
];

/** Regelseite Ludo: Original-Ablauf und die Hausregeln aus den Einstellungen */
export function Rules({ focus }: { focus?: string }) {
  return (
    <div className="grid gap-3">
      <Sec title="Ziel">
        <p>Jeder hat vier Figuren einer Farbe. Wer als Erster alle vier einmal ums Brett in seine vier <b className="text-foreground">Zielfelder</b> gebracht hat, gewinnt.
          Mit der Einstellung „Alle Plätze“ spielen die anderen weiter um Platz 2, 3 …</p>
      </Sec>
      <Sec title="Aufstellung und Start">
        <p>Drei Figuren warten im <b className="text-foreground">Haus</b> (B-Felder in der Ecke), die vierte steht schon auf dem farbigen <b className="text-foreground">Startfeld</b> (A-Feld) – so steht es in der Originalanleitung.
          Gewürfelt wird reihum im Uhrzeigersinn; gezogen wird auch im Uhrzeigersinn.</p>
      </Sec>
      <Sec id="six" focus={focus} title="Die 6">
        <p>Wer eine <b className="text-foreground">6</b> würfelt, muss eine Figur aus dem Haus auf sein Startfeld setzen, solange noch eine im Haus ist und das Startfeld nicht von einer eigenen Figur besetzt ist. Steht dort eine fremde, wird sie geschlagen.</p>
        <p>Nach einer 6 würfelst du <b className="text-foreground">nochmal</b> – auch mehrmals hintereinander.</p>
      </Sec>
      <Sec title="Startfeld räumen">
        <p>Solange noch Figuren im Haus sind, muss das Startfeld sofort wieder frei gemacht werden: Die Figur dort zieht mit dem nächsten Wurf weiter. Geht das nicht (eigene Figur im Weg), darfst du eine andere ziehen.</p>
      </Sec>
      <Sec id="three" focus={focus} title="Dreimal würfeln">
        <p>Hast du keine Figur auf der Laufbahn (alle im Haus oder im Ziel ganz hinten aufgerückt), darfst du <b className="text-foreground">bis zu dreimal</b> würfeln, um eine 6 zu bekommen.</p>
      </Sec>
      <Sec title="Ziehen und Schlagen">
        <p>Du ziehst eine Figur genau so viele Felder weit, wie der Würfel zeigt. Über andere Figuren darfst du auf der Laufbahn springen. Auf ein Feld mit einer eigenen Figur darfst du nicht.</p>
        <p>Landest du auf einer fremden Figur, ist sie <b className="text-foreground">geschlagen</b> und muss zurück ins Haus. Schlagen ist im Original keine Pflicht (Hausregel „Schlagzwang“).</p>
        <p>Kann keine Figur ziehen, verfällt der Wurf.</p>
      </Sec>
      <Sec title="Ins Ziel">
        <p>Nach einer Runde biegt die Figur in die eigenen Zielfelder ein. Sie muss <b className="text-foreground">genau passend</b> einziehen, darf nicht über das letzte Zielfeld hinaus und im Ziel keine eigene Figur überspringen. Im Ziel darf sie mit passendem Wurf noch aufrücken.</p>
      </Sec>
      <Sec title="In der App">
        <p>Mit dem <b className="text-foreground">App-Würfel</b> würfelt die App (online der Server, alle sehen denselben Wurf). Mit <b className="text-foreground">echtem Würfel</b> würfelst du am Tisch und tippst die Zahl an – die App prüft die Züge.</p>
        <p>Tippe die Figur an, die ziehen soll. Mit eingeschalteten <b className="text-foreground">Spielhilfen</b> leuchten die erlaubten Figuren, und das Zielfeld ist markiert (rot: dort schlägst du). Online bewegt jeder seine eigene Farbe.</p>
      </Sec>
      <h3 className="mt-2 font-semibold">Hausregeln (Einstellungen)</h3>
      <ul className="grid gap-2">
        {HOUSE.map(([t, d]) => (
          <li key={t} className="glass rounded-xl px-3 py-2.5"><b>{t}</b><p className="text-sm text-muted-foreground">{d}</p></li>
        ))}
      </ul>
      <Sec title="6 Farben">
        <p>Für 5 oder 6 Spieler gibt es ein Brett mit sechs Armen und 60 Feldern. Es gelten dieselben Regeln.</p>
      </Sec>
    </div>
  );
}
