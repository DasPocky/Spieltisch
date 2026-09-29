import { DECKS, RANK_NAME, SUIT_NAME, type Card, type DeckId } from "@shared/cards/deck";
import { cn } from "@/lib/utils";
import { PlayingCard } from "./PlayingCard";

/** Drei typische Karten je Blatt, leicht aufgefächert */
const PREVIEW: Record<DeckId, Card[]> = {
  fr32: ["herz-7", "pik-B", "karo-A"],
  fr52: ["herz-2", "pik-B", "karo-A"],
  de32: ["rot-7", "eichel-U", "schellen-A"],
};

/**
 * Auswahl des Kartenspiels mit Bild: So sieht man sofort, welches Blatt gemeint ist.
 * Darunter steht, was genau drin ist – jeder Wert gibt es viermal (einmal je Farbe).
 */
export function DeckPicker({ label, value, options, editable, onChange }: {
  label: string;
  value: string;
  options: readonly { value: string; label: string; hint?: string }[];
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const deck = DECKS[(value in DECKS ? value : options[0].value) as DeckId];
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <div className="grid gap-1 rounded-xl bg-navy-950/50 p-1 ring-1 ring-inset ring-border" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = value === o.value;
          const cards = PREVIEW[o.value as DeckId] ?? [];
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} disabled={!editable} onClick={() => !on && onChange(o.value)}
              className={cn("flex flex-col items-center rounded-lg px-1 pt-2.5 pb-2 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                on ? "bg-navy-600 shadow-md" : "text-muted-foreground")}>
              <span className="relative mb-1.5 flex h-12 justify-center" aria-hidden="true">
                {cards.map((c, i) => (
                  <PlayingCard key={c} card={c} className={cn("w-7.5", i > 0 && "-ml-4", !on && "opacity-70")} />
                ))}
              </span>
              <span className="max-w-full text-sm leading-tight font-semibold break-words">{o.label}</span>
              {o.hint && <span className="mt-0.5 text-xs leading-tight text-muted-foreground">{o.hint}</span>}
              {DECKS[o.value as DeckId] && (
                <span className="text-xs leading-tight text-muted-foreground">
                  {RANK_NAME[DECKS[o.value as DeckId].ranks[0]]} bis Ass
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 px-1 text-xs leading-snug text-muted-foreground" data-testid="deck-info">
        {deck.suits.map((s) => SUIT_NAME[s]).join(", ")} · {deck.ranks.map((r) => RANK_NAME[r]).join(", ")} –
        jeder Wert <b className="text-foreground">4×</b> (einmal je Farbe), also {deck.ranks.length} Vierergruppen.
      </p>
    </div>
  );
}
