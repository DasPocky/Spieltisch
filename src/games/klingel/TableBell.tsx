import { useEffect, useRef, useState } from "react";
import type { TableModel } from "@/platform/table/model";
import { cn } from "@/lib/utils";
import { BellShape, CardBack, EmptySlot, FruitCard } from "./Fruit";

type Bell = NonNullable<TableModel["bell"]>;

/** Klingel in der Mitte des Tischs: wackelt bei jedem Klingeln, der Name steht kurz groß darauf */
export function FeltBell({ bell }: { bell: Bell }) {
  const [shown, setShown] = useState<Bell["ring"]>(null);
  const seen = useRef(bell.ring?.n ?? 0);
  useEffect(() => {
    const r = bell.ring;
    if (!r || r.n === seen.current) return;
    seen.current = r.n;
    setShown(r);
    const t = setTimeout(() => setShown(null), 2600);
    return () => { clearTimeout(t); };
  }, [bell.ring]);
  return (
    <div className="relative flex flex-col items-center gap-[2cqh]" data-testid="table-bell">
      <div key={shown?.n ?? 0} className={cn("drop-shadow-[0_10px_18px_rgb(0_0_0/0.45)]", shown && "bell-ring")}>
        <BellShape className={cn("h-[36cqh] w-auto", bell.pending && "animate-pulse")} down={!!shown || bell.pending} />
      </div>
      {shown && (
        <div className={cn("pop absolute top-[16cqh] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[2cqh] px-[4cqh] py-[1.5cqh] text-center whitespace-nowrap text-white shadow-xl", shown.ok ? "bg-[#3f9a4a]" : "bg-[#c2492e]")} data-testid="table-ring" data-ok={shown.ok}>
          <div className="text-[8cqh] leading-tight font-black">{shown.title}</div>
          <div className="text-[4cqh] font-semibold opacity-90">{shown.sub}</div>
        </div>
      )}
      {/* wer aufdeckt, zeigt der leuchtende Platz – kein Schild unter der Klingel, das die Karte vorn verdeckt */}
      <span className="sr-only" data-testid="table-bell-note">{bell.note}</span>
    </div>
  );
}

/**
 * Offene Karte vor dem Platz, auf dem Filz zwischen Platz und Klingel – groß, damit man sie vom Sofa aus zählt.
 * Daneben klein der verdeckte Stapel mit Anzahl.
 */
export function SeatFruit({ felt, seat, card, stock, name }: {
  felt: { x: number; y: number; w: number; h: number }; seat: { x: number; y: number }; card: string | null; stock: number; name: string;
}) {
  const cx = felt.x + felt.w / 2, cy = felt.y + felt.h / 2;
  const h = Math.min(190, felt.h * 0.3);
  const x = Math.min(felt.x + felt.w - h * 0.75, Math.max(felt.x + h * 0.75, cx + (seat.x - cx) * 0.62));
  const y = Math.min(felt.y + felt.h - h * 0.55, Math.max(felt.y + h * 0.55, cy + (seat.y - cy) * 0.62));
  return (
    <div className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-end gap-2" style={{ left: x, top: y }} data-testid="seat-fruit" aria-label={`${name}: ${card ? "offene Karte" : "noch keine Karte"}, ${stock} verdeckt`}>
      {card
        ? <FruitCard key={card} card={card} className="card-flip w-auto drop-shadow-[0_8px_14px_rgb(0_0_0/0.45)]" style={{ height: h }} />
        : <EmptySlot className="w-auto text-white/50" style={{ height: h }} />}
      {stock > 0 && (
        <div className="flex flex-col items-center gap-1">
          <CardBack className="w-auto" style={{ height: h * 0.42 }} />
          <span className="rounded-full bg-black/45 px-2 text-sm font-bold text-white tabular-nums">{stock}</span>
        </div>
      )}
    </div>
  );
}
