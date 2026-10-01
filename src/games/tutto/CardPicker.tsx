import { CARDS, CHANCE, type CardId, type CardType } from "@shared/games/tutto/logic";
import { Button } from "@/components/ui/button";
import { vibrate } from "@/lib/utils";
import { CardFace } from "./CardFace";

/** Echte Karten: Welche Karte liegt jetzt offen? Antippen, dann rechnet die App wie gewohnt. */
export function CardPicker({ torte, fireName = "fire", onPick, onClose }: { torte: boolean; fireName?: string; onPick: (c: CardId) => void; onClose: () => void }) {
  // Feuerwerk und Chance wirken gleich – je nach Einstellung eine oder beide zum Antippen
  const cards: CardType[] = CARDS.filter((c) => !c.promo || torte).flatMap((c) => c.id !== "fire" ? [c] : fireName === "chance" ? [CHANCE] : fireName === "both" ? [c, CHANCE] : [c]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-navy-950/70 backdrop-blur-sm" role="dialog" aria-label="Gezogene Karte wählen" onClick={onClose}>
      <div className="glass mx-auto w-full max-w-md rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-center font-semibold">Welche Karte hast du gezogen?</p>
        <div className="grid grid-cols-4 gap-2">
          {cards.map((c) => (
            <button key={c.name} type="button" aria-label={c.name} onClick={() => { vibrate(12); onPick(c.id); }}
              className="@container aspect-[5/7] rounded-[7%] outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring">
              <CardFace card={c} />
            </button>
          ))}
        </div>
        <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={onClose}>Abbrechen</Button>
      </div>
    </div>
  );
}
