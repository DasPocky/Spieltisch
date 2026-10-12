import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn, vibrate } from "@/lib/utils";
import { beginRoll, isRolling, setThrow, useRolling } from "./throw";

/** So lange halten für den kräftigsten Wurf */
const FULL_MS = 1100;

/**
 * Würfeln-Knopf mit Gefühl: kurz tippen wirft sanft, gedrückt halten lädt auf (Balken im Knopf), loslassen wirft.
 * Wischt man beim Loslassen nach links oder rechts, fliegen die Würfel in diese Richtung.
 */
export function RollButton({ onRoll, disabled, className, variant, children }: {
  onRoll: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "secondary";
  children: ReactNode;
}) {
  const start = useRef<{ t: number; x: number } | null>(null);
  const [charge, setCharge] = useState(0);
  const raf = useRef(0);
  // Solange ein Wurf unterwegs ist oder die Würfel fliegen: kein zweiter Wurf (Doppeltipp, ungeduldiges Nachtippen)
  const rolling = useRolling();
  const off = disabled || rolling;

  const down = (e: React.PointerEvent) => {
    if (off) return;
    start.current = { t: performance.now(), x: e.clientX };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const tick = () => {
      if (!start.current) return;
      const c = Math.min(1, (performance.now() - start.current.t) / FULL_MS);
      setCharge(c);
      if (c < 1) raf.current = requestAnimationFrame(tick);
      else vibrate(8);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const up = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    cancelAnimationFrame(raf.current);
    setCharge(0);
    if (!s || disabled || isRolling()) return;
    const held = Math.min(1, (performance.now() - s.t) / FULL_MS);
    const aim = Math.max(-1, Math.min(1, (e.clientX - s.x) / 80));
    setThrow({ power: 0.25 + held * 0.75, aim });
    vibrate(15);
    beginRoll();
    onRoll();
  };
  const cancel = () => { start.current = null; cancelAnimationFrame(raf.current); setCharge(0); };

  return (
    <Button size="lg" variant={variant} disabled={off} className={cn("relative touch-none overflow-hidden select-none", className)}
      onPointerDown={down} onPointerUp={up} onPointerCancel={cancel} onContextMenu={(e) => e.preventDefault()}
      // Tastatur und Screenreader: normaler Klick, sanfter Wurf
      onClick={(e) => { if (e.detail === 0 && !isRolling()) { setThrow({ power: 0.35, aim: 0 }); beginRoll(); onRoll(); } }}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 bg-white/30 transition-[width] duration-75" style={{ width: `${charge * 100}%` }} />
      <span className="relative flex items-center gap-2">{children}</span>
    </Button>
  );
}
