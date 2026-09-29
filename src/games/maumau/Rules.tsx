import { SUITS } from "@shared/cards/german";
import { GermanCard } from "@/platform/cards/GermanCard";
import { cn } from "@/lib/utils";

const SPECIAL = [
  { card: "rot-7", title: "Sieben: zwei ziehen", text: "Der Nächste zieht zwei Karten. Mit „Siebenen stapeln“ darf er stattdessen selbst eine Sieben legen – dann zieht der Übernächste vier, und so weiter.", opt: false },
  { card: "gruen-8", title: "Acht: aussetzen", text: "Der nächste Spieler setzt eine Runde aus (abschaltbar).", opt: false },
  { card: "eichel-U", title: "Unter: Farbe wünschen", text: "Der Unter passt auf jede Karte. Wer ihn legt, wünscht sich eine Farbe, die der Nächste bedienen muss. Unter auf Unter geht nur mit der Einstellung.", opt: false },
  { card: "schellen-9", title: "Neun: Richtungswechsel", text: "Die Spielrichtung dreht sich um.", opt: true },
  { card: "rot-A", title: "Ass: nochmal", text: "Wer ein Ass legt, ist gleich noch einmal dran.", opt: true },
] as const;

/** Regelseite Mau-Mau mit Sonderkarten */
export function Rules({ focus }: { focus?: string }) {
  return (
    <>
      <section className="glass rounded-2xl p-4">
        <h3 className="font-semibold">Ziel</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Wer zuerst alle Karten abgelegt hat, gewinnt.</p>
        <h3 className="mt-4 font-semibold">So geht's</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Gespielt wird mit dem deutschen Blatt (32 Karten: Eichel, Grün, Rot, Schellen; 7 bis Ass). Jeder bekommt 5 (oder 6) Karten, eine wird aufgedeckt.
          Reihum legt jeder eine Karte, die in <b className="text-foreground">Farbe oder Wert</b> zur obersten passt. Wer nicht kann oder will, zieht eine Karte – passt sie, darf er sie sofort legen, sonst ist der Nächste dran.
        </p>
        <h3 className="mt-4 font-semibold">„Mau“</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Bevor du deine vorletzte Karte legst, tippst du auf <b className="text-foreground">Mau!</b>. Vergessen? Dann gibt es eine Strafkarte.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          {SUITS.map((s) => <GermanCard key={s} card={`${s}-A`} className="w-14" />)}
        </div>
      </section>

      <h3 className="mt-5 mb-2 font-semibold">Sonderkarten</h3>
      <ul className="grid gap-2">
        {SPECIAL.map((x) => (
          <li key={x.card} data-focused={focus === x.card} className={cn("flex gap-3 rounded-xl p-3", focus === x.card ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass")}>
            <GermanCard card={x.card} className="w-12 shrink-0 self-start" />
            <div>
              <b>{x.title}</b>{x.opt && <span className="ml-1.5 text-xs text-muted-foreground">(Einstellung)</span>}
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{x.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
