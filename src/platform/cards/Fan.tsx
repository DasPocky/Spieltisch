import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kartenhand als Fächer: Die Überlappung passt sich der Breite an – wenige Karten liegen locker nebeneinander,
 * viele rücken zusammen, aber von jeder bleibt die Ecke mit dem Wert sichtbar. Reicht der Platz nicht, scrollt die Hand.
 * Beim Ziehen und Ausspielen gleiten die übrigen Karten sanft an ihren neuen Platz.
 */
export function Fan({ children, count, className, minShow = 0.52, testId = "hand" }: {
  children: ReactNode; count: number; className?: string; minShow?: number; testId?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [ml, setMl] = useState(0);
  // Nur die erste Hand kommt gestaffelt herein – später gezogene Karten sofort
  const [deal, setDeal] = useState(1);
  useEffect(() => { const t = setTimeout(() => setDeal(0), 900); return () => clearTimeout(t); }, []);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const first = el.querySelector<HTMLElement>(":scope > div > *");
      if (!first || count < 2) { setMl(0); return; }
      const w = first.offsetWidth;
      const free = el.clientWidth - 32; // Rand links und rechts
      const step = Math.max(w * minShow, Math.min(w * 1.06, (free - w) / (count - 1)));
      setMl(Math.round(step - w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count, minShow]);
  return (
    <div ref={box} className={cn("no-scrollbar -mx-4 flex items-end overflow-x-auto px-4 pt-3 pb-1", className)} data-testid={testId}>
      <div className="fan mx-auto flex items-end" style={{ ["--fan-ml" as string]: `${ml}px`, ["--deal" as string]: deal }}>{children}</div>
    </div>
  );
}

/** Kleine Verzögerung je Karte, damit eine neue Hand nacheinander hereinkommt */
export const dealDelay = (i: number) => ({ animationDelay: `calc(var(--deal, 0) * ${Math.min(i, 10) * 35}ms)` });
