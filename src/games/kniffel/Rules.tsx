import { CATS, EXTRA_KNIFFEL, LOWER, UPPER, UPPER_BONUS, UPPER_BONUS_AT, type Cat } from "@shared/games/kniffel/logic";
import { cn } from "@/lib/utils";

const POINTS: Record<Cat, string> = {
  ones: "Anzahl × 1", twos: "Anzahl × 2", threes: "Anzahl × 3", fours: "Anzahl × 4", fives: "Anzahl × 5", sixes: "Anzahl × 6",
  three: "Summe aller Augen", four: "Summe aller Augen", full: "25", small: "30", large: "40", kniffel: "50", chance: "Summe aller Augen",
};

const EXAMPLE: Partial<Record<Cat, string>> = {
  three: "z. B. 4 4 4 2 6 → 20", four: "z. B. 3 3 3 3 5 → 17", full: "z. B. 2 2 5 5 5",
  small: "1-2-3-4, 2-3-4-5 oder 3-4-5-6", large: "1-2-3-4-5 oder 2-3-4-5-6", kniffel: "z. B. 6 6 6 6 6",
  chance: "jeder Wurf – gut als Notnagel", threes: "z. B. 3 3 3 1 5 → 9",
};

/** Regelübersicht Kniffel: Ablauf, Block oben/unten, Bonus und Extra-Kniffel. */
export function Rules({ focus }: { focus?: string }) {
  const row = (c: Cat) => (
    <li key={c} data-focused={c === focus}
      className={cn("scroll-mt-3 rounded-xl px-3 py-2.5", c === focus ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
      <div className="flex items-baseline justify-between gap-3">
        <b>{CATS[c].name}</b>
        <span className="text-sm font-semibold tabular-nums text-navy-200">{POINTS[c]}</span>
      </div>
      <p className="text-sm text-muted-foreground">{CATS[c].hint}{EXAMPLE[c] && ` · ${EXAMPLE[c]}`}</p>
    </li>
  );

  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Jeder füllt seinen Block mit 13 Feldern. Wer am Ende die meisten Punkte hat, gewinnt.
        </p>
        <h3 className="mt-4 font-semibold">So läuft ein Zug</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Du würfelst mit 5 Würfeln bis zu <b className="text-foreground">dreimal</b>. Nach jedem Wurf darfst du beliebige Würfel liegen lassen („halten“) und den Rest neu werfen.
          Danach trägst du den Wurf in <b className="text-foreground">ein freies Feld</b> ein. Passt nichts, musst du ein Feld <b className="text-foreground">streichen</b> (0 Punkte). Jedes Feld gibt es nur einmal.
        </p>
      </section>

      <h3 className="mt-5 mb-2 font-semibold">Oberer Teil</h3>
      <ul className="grid gap-2">{UPPER.map(row)}</ul>
      <p className="mt-2 rounded-xl bg-ice/10 px-3 py-2.5 text-sm text-ice">
        <b>Bonus +{UPPER_BONUS}</b>, wenn der obere Teil zusammen mindestens {UPPER_BONUS_AT} Punkte hat (das sind je drei Gleiche).
      </p>

      <h3 className="mt-5 mb-2 font-semibold">Unterer Teil</h3>
      <ul className="grid gap-2">{LOWER.map(row)}</ul>

      <section className="glass mt-5 rounded-2xl p-4">
        <h3 className="font-semibold">Extra-Kniffel (Einstellung)</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Ist die Einstellung an und steht im Kniffel-Feld schon 50, bringt jeder weitere Kniffel <b className="text-foreground">+{EXTRA_KNIFFEL} Bonus</b>.
          Zusätzlich darfst du ihn als Joker für Full House, kleine oder große Straße mit voller Punktzahl eintragen. Ohne die Einstellung gilt die klassische Regel: kein Bonus.
        </p>
        <h3 className="mt-4 font-semibold">In der App</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Mit dem <b className="text-foreground">App-Würfel</b> würfelt die App (online der Server, alle sehen denselben Wurf) und zeigt bei jedem freien Feld, was der Wurf bringen würde.
          Mit <b className="text-foreground">echten Würfeln</b> ist die App euer Block: Feld antippen, Wert wählen, eintragen. Tippe oben auf einen Namen, um seinen Block anzusehen.
        </p>
      </section>
    </>
  );
}
