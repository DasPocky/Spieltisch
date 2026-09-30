import { rankOf, RANK_NAME, suitOf, SUIT_NAME, type Card, type Suit } from "@shared/cards/deck";
import { cn } from "@/lib/utils";

export const SUIT_COLOR: Record<Suit, string> = {
  // gedämpft: Rot ist ein ruhiges Weinrot, Schwarz ein tiefes Blauschwarz
  eichel: "#7a5a3a", gruen: "#4f7560", rot: "#a8454f", schellen: "#b39a5c",
  kreuz: "#1b1e25", pik: "#1b1e25", herz: "#a8454f", karo: "#a8454f",
};

/** Farbsymbole beider Blätter */
export function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  const c = SUIT_COLOR[suit];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {suit === "herz" && <path d="M12 21 C 5 15.5, 2 12, 2 8.2 A 4.8 4.8 0 0 1 12 6 A 4.8 4.8 0 0 1 22 8.2 C 22 12, 19 15.5, 12 21 Z" fill={c} />}
      {suit === "karo" && <path d="M12 2 L 20 12 L 12 22 L 4 12 Z" fill={c} />}
      {suit === "pik" && <path d="M12 2 C 9 6, 3 9.5, 3 14 A 4.4 4.4 0 0 0 10.6 16.8 L 9 21.5 H 15 L 13.4 16.8 A 4.4 4.4 0 0 0 21 14 C 21 9.5, 15 6, 12 2 Z" fill={c} />}
      {suit === "kreuz" && (
        <g fill={c}>
          <circle cx="12" cy="7" r="4.3" /><circle cx="6.8" cy="13.6" r="4.3" /><circle cx="17.2" cy="13.6" r="4.3" />
          <path d="M11 11 H 13 L 14.5 21.5 H 9.5 Z" />
        </g>
      )}
      {suit === "rot" && <path d="M12 21 C 5 15.5, 2 12, 2 8.2 A 4.8 4.8 0 0 1 12 6 A 4.8 4.8 0 0 1 22 8.2 C 22 12, 19 15.5, 12 21 Z" fill={c} />}
      {suit === "gruen" && (
        <g>
          <path d="M12 2 C 19 6, 20 13, 12 21 C 4 13, 5 6, 12 2 Z" fill={c} />
          <path d="M12 5 V 22" stroke="#fdfdfb" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <path d="M12 10 L 8.5 7.5 M12 10 L 15.5 7.5 M12 14 L 8 11.5 M12 14 L 16 11.5" stroke="#fdfdfb" strokeWidth="0.9" strokeLinecap="round" opacity="0.55" />
        </g>
      )}
      {suit === "eichel" && (
        <g>
          <ellipse cx="12" cy="14.5" rx="5.2" ry="6.8" fill={c} />
          <path d="M5.2 10.5 C 5.2 6.5, 18.8 6.5, 18.8 10.5 C 18.8 12, 5.2 12, 5.2 10.5 Z" fill="#5a3a12" />
          <path d="M12 3 V 7" stroke="#5a3a12" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="15" r="1.1" fill="#fdfdfb" opacity="0.4" />
        </g>
      )}
      {suit === "schellen" && (
        <g>
          <circle cx="12" cy="13" r="7.5" fill={c} />
          <path d="M4.8 11.5 H 19.2" stroke="#a8323f" strokeWidth="2.2" />
          <circle cx="12" cy="16.2" r="1.6" fill="#3a2a0a" />
          <path d="M12 16.2 V 20" stroke="#3a2a0a" strokeWidth="1.2" />
          <circle cx="12" cy="4.6" r="1.6" fill={c} />
        </g>
      )}
    </svg>
  );
}



/** Vorderseite einer Spielkarte (französisch oder deutsch). Größe über die Breite des Elternelements (Container-Einheiten). */
export function PlayingCard({ card, className, dim }: { card: Card; className?: string; dim?: boolean }) {
  const suit = suitOf(card);
  const rank = rankOf(card);
  const color = SUIT_COLOR[suit];
  const face = rank === "U" || rank === "O" || rank === "B" || rank === "D" || rank === "K";
  return (
    <div className={cn("@container aspect-[5/8] select-none", className)} role="img" aria-label={`${SUIT_NAME[suit]}-${RANK_NAME[rank]}`}>
      <div className={cn("relative size-full overflow-hidden rounded-[10cqw] bg-paper shadow-[0_6px_14px_rgba(2,8,23,.45)] ring-1 ring-black/10 transition", dim && "brightness-[0.55] saturate-50")}>
        <div className="absolute top-[5cqw] left-[7cqw] flex flex-col items-center leading-none" style={{ color }}>
          <span className="text-[26cqw] font-extrabold tracking-tighter">{rank}</span>
          <SuitIcon suit={suit} className="mt-[2cqw] size-[20cqw]" />
        </div>
        <div className="absolute right-[7cqw] bottom-[5cqw] flex rotate-180 flex-col items-center leading-none" style={{ color }}>
          <span className="text-[26cqw] font-extrabold tracking-tighter">{rank}</span>
          <SuitIcon suit={suit} className="mt-[2cqw] size-[20cqw]" />
        </div>
        <div className="absolute inset-[22cqw_14cqw] grid place-items-center rounded-[6cqw]" style={{ background: face ? `${color}14` : undefined, boxShadow: face ? `inset 0 0 0 1.2cqw ${color}55` : undefined }}>
          {face ? (
            <div className="flex flex-col items-center" style={{ color }}>
              <SuitIcon suit={suit} className="size-[34cqw]" />
              <span className="mt-[2cqw] text-[13cqw] font-bold tracking-wide uppercase">{RANK_NAME[rank]}</span>
            </div>
          ) : <SuitIcon suit={suit} className={rank === "A" ? "size-[58cqw]" : "size-[44cqw]"} />}
        </div>
      </div>
    </div>
  );
}

/** Rückseite im Marine-Design */
export function CardBack({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("@container relative aspect-[5/8]", className)}>
      <div className="card-back grid size-full place-items-center rounded-[10cqw] border-[5cqw] border-paper shadow-[0_6px_14px_rgba(2,8,23,.45)]">{children}</div>
    </div>
  );
}
