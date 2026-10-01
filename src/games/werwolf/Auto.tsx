import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import type { Options } from "@shared/platform/types";
import type { Step } from "@shared/games/werwolf/logic";
import { Button } from "@/components/ui/button";
import { cn, vibrate } from "@/lib/utils";

/** Zeiten je Tempo: Rollen, Werwölfe, reine Info-Schritte (Sekunden), Diskussion (Minuten) */
const TEMPO = {
  slow: { role: 30, wolves: 45, info: 10, talk: 8 },
  normal: { role: 20, wolves: 30, info: 8, talk: 5 },
  fast: { role: 12, wolves: 20, info: 6, talk: 3 },
} as const;
export const tempoOf = (o: Options) => TEMPO[o.tempo === "slow" || o.tempo === "fast" ? o.tempo : "normal"];

/** Schritte, bei denen nur jemand die Augen öffnet und schaut (keine Eingabe) */
export const INFO_STEPS: Step[] = ["lovers", "schwestern", "verzaubert"];
/** Schritte, nach denen die Rolle ein Ergebnis lesen muss */
export const RESULT_STEPS: Step[] = ["seherin", "fuchs"];

export function stepSeconds(step: Step, o: Options) {
  const t = tempoOf(o);
  if (step === "sleep") return 2;
  if (INFO_STEPS.includes(step)) return t.info;
  return step === "werwolf" ? t.wolves : t.role;
}

/** Sekunden bis `deadline`, tickt viermal pro Sekunde; steht still, solange `paused` */
export function useCountdown(deadline: number | null, paused: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null || paused) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline, paused]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * Bestätigen durch kurzes Gedrückthalten – leise und sicher gegen Fehltipper, wenn das Handy in der Mitte liegt.
 * Tastatur (Enter/Leertaste) bestätigt sofort.
 */
export function HoldButton({ label, onDone, disabled, ms = 700 }: { label: string; onDone: () => void; disabled?: boolean; ms?: number }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => { setHolding(false); if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const start = () => {
    if (disabled) return;
    setHolding(true);
    timer.current = setTimeout(() => { stop(); vibrate(15); onDone(); }, ms);
  };
  useEffect(() => stop, []);
  return (
    <button type="button" disabled={disabled} aria-label={label} data-testid="hold"
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onDone(); } }}
      className={cn("relative h-12 shrink-0 touch-none overflow-hidden rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-50")}>
      <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${ms}ms linear` : "none" }} aria-hidden="true" />
      <span className="relative">{disabled ? label : `Gedrückt halten: ${label}`}</span>
    </button>
  );
}

/** Große Restzeit mit Hinweis kurz vor Schluss – nur Text, damit niemand hört, wo das Handy ist */
export function Clock({ left, total, note, paused, onPause, onSkip }: { left: number | null; total: number; note?: string; paused: boolean; onPause: () => void; onSkip?: () => void }) {
  const warn = left !== null && left <= 5 && !paused;
  return (
    <div className="flex shrink-0 items-center gap-3" data-testid="ww-clock">
      <div className="relative grid size-14 shrink-0 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-navy-900" />
          {left !== null && <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength={100}
            strokeDasharray={`${Math.min(100, (left / Math.max(1, total)) * 100)} 100`} className={cn("transition-[stroke-dasharray] duration-300", warn ? "text-destructive" : "text-ice")} />}
        </svg>
        <span className={cn("text-lg font-extrabold tabular-nums", warn && "text-destructive")} data-testid="ww-left">{left ?? "…"}</span>
      </div>
      <p className={cn("min-w-0 flex-1 text-sm leading-snug", warn ? "font-semibold text-destructive" : "text-muted-foreground")}>
        <span key={note} className="text-in inline-block">{paused ? "Angehalten." : note}</span>
      </p>
      <Button variant="secondary" size="icon" aria-label={paused ? "Weiterlaufen lassen" : "Anhalten"} onClick={onPause}>{paused ? <Play /> : <Pause />}</Button>
      {onSkip && <Button variant="ghost" size="icon" aria-label="Schritt überspringen" onClick={onSkip}><SkipForward /></Button>}
    </div>
  );
}
