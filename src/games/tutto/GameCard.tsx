import { useEffect, useRef, useState } from "react";
import { CARD_BY_ID, type CardId } from "@shared/games/tutto/logic";
import { vibrate } from "@/lib/utils";
import { CardFace } from "./CardFace";

const reduceMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Die Tutto-Karte mit Umdreh-Animation. Zeigt immer die zuletzt gezogene Karte des Zugs. */
export function GameCard({ cards, turn, onDraw, disabled }: { cards: CardId[]; /** wechselt bei jedem neuen Zug */ turn: number; onDraw?: () => void; disabled?: boolean }) {
  const latest = cards.length ? cards[cards.length - 1] : null;
  const [shown, setShown] = useState<CardId | null>(latest);
  const [flipped, setFlipped] = useState(!!latest);
  // Neuer Zug oder neue Karte – auch wenn beim Spielerwechsel gleich wieder genau eine Karte offen liegt
  const sig = `${turn}:${cards.length}`;
  const prevSig = useRef(sig);

  useEffect(() => {
    const changed = sig !== prevSig.current;
    prevSig.current = sig;
    if (!changed) return;
    if (!latest) { setFlipped(false); return; }
    if (latest === "stop") vibrate([40, 50, 40]);
    if (flipped && !reduceMotion()) {
      setFlipped(false);
      const t = setTimeout(() => { setShown(latest); setFlipped(true); }, 420);
      return () => clearTimeout(t);
    }
    setShown(latest);
    const r = requestAnimationFrame(() => setFlipped(true));
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, latest]);

  const t = shown ? CARD_BY_ID[shown] : null;

  return (
    <button
      type="button"
      onClick={() => { if (!disabled) { vibrate(12); onDraw?.(); } }}
      disabled={disabled}
      aria-label={t && flipped ? `${t.name}. Tippen für die nächste Karte` : "Karte ziehen"}
      className="flip @container block aspect-[5/7] h-full max-h-[340px] min-h-[140px] max-w-full rounded-2xl outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.97] disabled:cursor-default"
    >
      <div className="flip-inner relative size-full" data-flipped={flipped}>
        <div className="flip-face card-back grid place-items-center rounded-[7cqw] border-[4cqw] border-paper shadow-[0_16px_36px_rgba(2,8,23,.55)]">
          <div className="flex -rotate-8 flex-col items-center gap-[3cqw]">
            <svg viewBox="0 0 10 10" className="size-[22cqw]" aria-hidden="true">
              <rect width="10" height="10" rx="2" fill="#fdfdfb" />
              {[[3, 3], [7, 3], [5, 5], [3, 7], [7, 7]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.95" fill="#1f437f" />)}
            </svg>
            <span className="text-[15cqw] leading-none font-bold tracking-tight text-paper">TUTTO</span>
          </div>
          {!disabled && <span className="absolute inset-x-0 bottom-[6cqw] text-center text-[6.5cqw] font-semibold text-paper/85">Tippen zum Ziehen</span>}
        </div>
        <div className="flip-face flip-front rounded-[7cqw] shadow-[0_16px_36px_rgba(2,8,23,.55)]">
          {t && <CardFace card={t} />}
        </div>
      </div>
    </button>
  );
}
