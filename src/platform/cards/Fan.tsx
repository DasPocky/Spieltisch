import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kartenfächer für die Hand: Karten überlappen nur so viel wie nötig.
 * Wären sie zu eng (weniger als ~70 % sichtbar) und `rows` ist erlaubt, kommt die Hand in zwei Reihen –
 * wie man viele Karten auch am Tisch in zwei Reihen hält. Sonst wird notfalls seitlich gewischt.
 */
export function Fan({ children, count, className, minShow = 0.52, testId = "hand", rows = true }: {
  children: ReactNode; count: number; className?: string; minShow?: number; testId?: string;
  /** zwei Reihen erlauben, wenn eine zu eng wäre */
  rows?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ ml: number; two: boolean }>({ ml: 0, two: false });
  // Nur die erste Hand kommt gestaffelt herein – später gezogene Karten sofort
  const [deal, setDeal] = useState(1);
  useEffect(() => { const t = setTimeout(() => setDeal(0), 900); return () => clearTimeout(t); }, []);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const first = el.querySelector<HTMLElement>(".fan > *");
      if (!first || count < 2) { setLayout({ ml: 0, two: false }); return; }
      const w = first.offsetWidth;
      const free = el.clientWidth - 32; // Rand links und rechts
      const stepFor = (n: number) => (n < 2 ? w : Math.max(w * minShow, Math.min(w * 1.06, (free - w) / (n - 1))));
      const two = rows && count >= 8 && stepFor(count) < w * 0.7;
      const step = stepFor(two ? Math.ceil(count / 2) : count);
      setLayout({ ml: Math.round(step - w), two });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count, minShow, rows]);
  const items = Children.toArray(children);
  const style = { ["--fan-ml" as string]: `${layout.ml}px`, ["--deal" as string]: deal };
  const half = Math.ceil(items.length / 2);
  return (
    <div ref={box} className={cn("no-scrollbar -mx-4 flex flex-col items-stretch overflow-x-auto px-4 pt-3 pb-1", className)} data-testid={testId}>
      {layout.two ? (
        <>
          <div className="fan mx-auto flex items-end" style={style}>{items.slice(0, half)}</div>
          <div className="fan relative mx-auto -mt-7 flex items-end" style={style}>{items.slice(half)}</div>
        </>
      ) : (
        <div className="fan mx-auto flex items-end" style={style}>{items}</div>
      )}
    </div>
  );
}

/** Kleine Verzögerung je Karte, damit eine neue Hand nacheinander hereinkommt */
export const dealDelay = (i: number) => ({ animationDelay: `calc(var(--deal, 0) * ${Math.min(i, 10) * 35}ms)` });
