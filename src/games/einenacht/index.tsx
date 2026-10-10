import { Moon, Sun } from "lucide-react";
import { einenacht, ON_ROLES, ON_SPECIALS, type ONAction, type ONState } from "@shared/games/einenacht/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Board } from "./Board";
import { RoleIcon } from "./RoleIcon";
import { Icon } from "./Icon";



function HeaderExtra({ game: s }: BoardProps<ONState, ONAction>) {
  const label = s.phase === "reveal" ? "Karten" : s.phase === "night" ? "Nacht" : s.phase === "day" ? "Tag" : "Ende";
  const Icon = s.phase === "night" ? Moon : s.phase === "day" ? Sun : null;
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border" data-testid="on-phase">
      {Icon && <Icon aria-hidden="true" className="size-4 text-ice" />}{label}
    </span>
  );
}

function Rules() {
  const roles = ["werwolf", ...ON_SPECIALS, "dorf"] as const;
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Worum geht's?</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Werwolf in zehn Minuten: Es gibt genau <b className="text-foreground">eine Nacht</b> und <b className="text-foreground">eine Abstimmung</b>. Jeder bekommt eine Karte, drei liegen verdeckt in der Mitte.
          Nachts werden Karten heimlich getauscht – am Morgen weiß also niemand sicher, wer er ist.
        </p>
        <h3 className="mt-4 font-semibold">Ablauf</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Karte ansehen. Online: am eigenen Handy. Lokal: Handy herumreichen.</li>
          <li>Nacht: Die Rollen erwachen in fester Reihenfolge (Werwölfe, Günstling, Freimaurer, Seherin, Räuber, Unruhestifter, Betrunkener, Schlaflose). Online handeln alle gleichzeitig, die Tausche passieren trotzdem in dieser Reihenfolge. (Die Doppelgängerin des Originals ist nicht dabei.)</li>
          <li>Tag: Diskussion mit Timer, dann zeigt jeder gleichzeitig auf einen anderen Spieler. Wer die meisten Stimmen hat, stirbt (bei Gleichstand alle). Hat niemand mehr als eine Stimme, stirbt niemand. Stirbt der Jäger, stirbt auch, auf wen er gezeigt hat.</li>
        </ol>
        <h3 className="mt-4 font-semibold">Sieg</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Es zählt die Karte, die man <b className="text-foreground">am Ende</b> hat. Stirbt mindestens ein Werwolf, gewinnt das Dorf – auch wenn dabei Dorfbewohner sterben. Stirbt keiner, gewinnen die Werwölfe (mit Günstling), außer der Gerber stirbt.
          Sind keine Werwölfe unter den Spielern, gewinnt das Dorf nur, wenn niemand stirbt; der Günstling gewinnt dann, wenn jemand anderes stirbt. Der Gerber gewinnt, wenn er stirbt.
        </p>
        <h3 className="mt-4 font-semibold">Mit eigenen Karten</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Ihr teilt eure echten Karten aus. Das Handy des Hosts liest die Nacht vor und schaltet von selbst weiter, damit alle die Augen zu lassen können. Danach laufen Timer und Abstimmung am Tisch; nach dem Aufdecken trägt der Host ein, wer gewonnen hat.</p>
      </section>
      <h3 className="mt-5 mb-2 font-semibold">Rollen</h3>
      <ul className="grid gap-2">
        {roles.map((r) => (
          <li key={r} className="glass rounded-xl px-3 py-2.5">
            <b><RoleIcon role={r} className="mr-1.5 text-ice" />{ON_ROLES[r].name}</b>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{ON_ROLES[r].help}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

export const einenachtUI: GameUI<ONState, ONAction> = { logic: einenacht, Icon, Board, Rules, HeaderExtra };
