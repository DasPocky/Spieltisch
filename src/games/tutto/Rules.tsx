import { CARDS, DICE_RULES } from "@shared/games/tutto/logic";
import { cn } from "@/lib/utils";
import { CardFace } from "./CardFace";

/** Regelübersicht: Ablauf eines Zugs, Würfelwertung und alle Karten mit Bild und Erklärung. */
export function Rules({ focus }: { focus?: string }) {
  // Bonuskarten nur einmal zeigen
  const cards = CARDS.filter((c) => !c.id.startsWith("b") || c.id === "b300");
  const focusId = focus?.startsWith("b") ? "b300" : focus;

  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Wer zuerst das Spielziel erreicht (Standard 6.000 Punkte), gewinnt – oder sofort, wer mit dem Kleeblatt zweimal hintereinander ein Tutto schafft.
        </p>
        <h3 className="mt-4 font-semibold">So läuft ein Zug</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Karte ziehen, dann mit 6 Würfeln würfeln. Nach jedem Wurf legst du mindestens einen wertbaren Würfel beiseite und würfelst mit dem Rest weiter – oder hörst auf und schreibst die Punkte auf.
          Wirfst du nichts Wertbares, ist es eine <b className="text-foreground">Niete</b> und die Punkte des Zugs sind weg.
          Hast du alle 6 Würfel gewertet, ist das ein <b className="text-foreground">Tutto</b>.
        </p>
        <h3 className="mt-4 font-semibold">Würfelwertung</h3>
        <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          {DICE_RULES.map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Drei Gleiche zählen nur, wenn sie in einem Wurf fallen. 2, 3, 4 und 6 zählen einzeln nichts.</p>
        <h3 className="mt-4 font-semibold">In der App</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Mit <b className="text-foreground">echten Würfeln</b> tippst du nur die Würfelpunkte ein. Schaffst du ein Tutto, tippst du auf den hellen <b className="text-foreground">Tutto</b>-Knopf – den Kartenbonus rechnet die App dann selbst dazu und deckt (wenn eingestellt) gleich die nächste Karte auf. Mit dem <b className="text-foreground">App-Würfel</b> würfelt die App (online der Server, alle sehen denselben Wurf), prüft deine Auswahl und wertet die Karten automatisch.
        </p>
      </section>

      <ul className="mt-5 grid gap-3">
        {cards.map((c) => (
          <li key={c.id} data-focused={c.id === focusId}
            className={cn("flex scroll-mt-3 gap-4 rounded-2xl p-3.5", c.id === focusId ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
            <div className="@container aspect-[5/7] w-18 shrink-0 self-start"><CardFace card={c} /></div>
            <div className="min-w-0">
              <h4 className="font-bold">
                {c.id === "b300" ? "Bonus 200 – 600" : c.id === "fire" ? "Feuerwerk / Chance" : c.name}
                <span className="block text-xs font-normal text-muted-foreground">{c.id === "b300" ? "25×" : `${c.count}×`} im Stapel{c.promo ? " – Promokarte, in den Einstellungen zuschaltbar" : ""}</span>
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.id === "b300" ? c.help.replace("300", "200 bis 600") : c.help}</p>
              {c.id === "fire" && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">In vielen Runden heißt diese Karte „Chance“ – in den Einstellungen wählbar: Feuerwerk, Chance oder beide gemischt.</p>}
              {c.id === "pm" && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Fiese Hausregeln (Einstellung „Plus/Minus: wer verliert?“): <b className="text-foreground">Wählen</b> – du bestimmst, wer 1.000 verliert. <b className="text-foreground">Alle</b> – jeder andere verliert 1.000. <b className="text-foreground">Geteilt</b> – die anderen teilen sich −1.000.</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
