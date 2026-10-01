import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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
 * Richtzeit für einen Schritt, ohne Automatik (Spielleiter oder online): zeigt die Restzeit
 * und kurz vor Schluss einen Hinweis. `deadline` in ms (Server- bzw. Gerätezeit).
 */
export function Timer({ deadline, label, warnAt = 10, className }: { deadline: number | null; label: string; warnAt?: number; className?: string }) {
  const left = useCountdown(deadline, false);
  if (left === null) return null;
  const warn = left <= warnAt;
  const mmss = left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : `${left} s`;
  return (
    <div className={cn("flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm ring-1 ring-inset", warn ? "bg-destructive/15 text-destructive ring-destructive/40" : "bg-navy-950/40 text-muted-foreground ring-border", className)} data-testid="timer">
      <span key={warn ? "w" : "n"} className="text-in">{left === 0 ? "Zeit ist um" : warn ? `Achtung – ${label}` : label}</span>
      <b className="tabular-nums">{mmss}</b>
    </div>
  );
}
