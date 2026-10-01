import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Waagrechte Mitspieler-Leiste. Wer dran ist (`data-cur="true"`), wird sanft in die Mitte geholt –
 * auch bei vielen Spielern ist der aktuelle Spieler so immer zu sehen.
 */
export function PlayerRow({ children, className, label = "Mitspieler", group }: { children: ReactNode; className?: string; label?: string; group?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<Element | null>(null);
  useLayoutEffect(() => {
    const row = ref.current;
    const cur = row?.querySelector<HTMLElement>('[data-cur="true"]');
    if (!row || !cur || cur === last.current) return;
    const first = last.current === null;
    last.current = cur;
    if (row.scrollWidth <= row.clientWidth) return;
    const left = cur.offsetLeft - (row.clientWidth - cur.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: first ? "auto" : "smooth" });
  });
  return (
    <div ref={ref} role={group ? "group" : undefined} aria-label={label}
      className={cn("no-scrollbar relative -mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4 pt-1 pb-1.5", className)}>
      {children}
    </div>
  );
}
