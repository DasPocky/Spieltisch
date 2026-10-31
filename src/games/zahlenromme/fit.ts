import { useLayoutEffect, useState } from "react";

/** Maße einer Kombination relativ zur Steinbreite w: Abstand zwischen Steinen, Innenrand, Abstand zwischen Kombinationen */
export const GAP = 0.06, PAD = 0.14, GAP_X = 0.32, GAP_Y = 0.26, RATIO = 4 / 3;

/** Wie breit darf ein Stein höchstens sein, damit alle Kombinationen (Zeilen mit Umbruch) in W×H passen? */
export function fitWidth(lens: number[], W: number, H: number, max: number, min = 8): number {
  if (W <= 0 || H <= 0) return min;
  for (let w = max; w > min; w -= 0.5) {
    const gw = (n: number) => n * w + (n - 1) * GAP * w + 2 * PAD * w;
    const rowH = w * RATIO + 2 * PAD * w;
    let x = 0, rows = 1, ok = true;
    for (const n of lens) {
      const need = gw(n);
      if (need > W) { ok = false; break; }
      if (x > 0 && x + GAP_X * w + need > W) { rows++; x = need; } else x += (x > 0 ? GAP_X * w : 0) + need;
    }
    if (!ok) continue;
    if (rows * rowH + (rows - 1) * GAP_Y * w <= H) return w;
  }
  return min;
}

/** Größe eines Elements (ResizeObserver) – als Callback-Ref, damit auch später eingeblendete Elemente gemessen werden */
export function useSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [el]);
  return [setEl, size] as const;
}

/** Steine im Raster (Bank): größte Breite, bei der `n` Steine mit Abstand in W×H passen */
export function fitGrid(n: number, W: number, H: number, max: number, min = 10, gap = 4): number {
  if (W <= 0 || H <= 0 || n <= 0) return max;
  for (let w = max; w > min; w -= 0.5) {
    const per = Math.max(1, Math.floor((W + gap) / (w + gap)));
    const rows = Math.ceil(n / per);
    if (rows * w * RATIO + (rows - 1) * gap <= H) return w;
  }
  return min;
}
