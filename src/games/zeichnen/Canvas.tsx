import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { COLORS, decodePoints, encodePoints, WIDTHS, type Stroke } from "@shared/games/zeichnen/logic";
import { cn } from "@/lib/utils";

/** Seitenverhältnis des Blatts (Breite : Höhe) – überall gleich, damit Striche auf jedem Gerät gleich liegen */
export const PAPER = 4 / 3;

function paint(g: CanvasRenderingContext2D, w: number, h: number, strokes: Stroke[]) {
  g.fillStyle = "#fffdf8";
  g.fillRect(0, 0, w, h);
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const s of strokes) {
    const pts = decodePoints(s.p);
    if (!pts.length) continue;
    g.strokeStyle = COLORS[s.c] ?? COLORS[0];
    g.lineWidth = (WIDTHS[s.w] ?? WIDTHS[1]) * (w / 800);
    g.beginPath();
    g.moveTo(pts[0][0] * w, pts[0][1] * h);
    // ein einzelner Punkt wird ein Klecks
    if (pts.length === 1) g.lineTo(pts[0][0] * w + 0.01, pts[0][1] * h);
    for (const [x, y] of pts.slice(1)) g.lineTo(x * w, y * h);
    g.stroke();
  }
}

/**
 * Das Blatt: zeigt die Striche aus dem Spielstand. Mit `onStroke` kann man darauf malen – der Strich erscheint sofort
 * und geht in Stücken an das Spiel (alle 250 ms und beim Absetzen), damit alle live zusehen.
 */
export function Paper({ strokes, onStroke, color = 0, width = 1, className, label }: {
  strokes: Stroke[]; onStroke?: (s: Stroke) => void; color?: number; width?: number; className?: string; label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // eigener Strich, der noch unterwegs ist (bis er im Spielstand auftaucht)
  const pending = useRef<Stroke[]>([]);
  const live = useRef<[number, number][]>([]);
  const sent = useRef(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const { width: bw, height: bh } = el.getBoundingClientRect();
      const w = Math.floor(Math.min(bw, bh * PAPER)), h = Math.floor(w / PAPER);
      setSize((o) => (o.w === w && o.h === h ? o : { w, h }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const redraw = () => {
    const c = canvas.current;
    if (!c || !size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== size.w * dpr) { c.width = size.w * dpr; c.height = size.h * dpr; }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mine = live.current.length ? [{ c: color, w: width, p: encodePoints(live.current) }] : [];
    paint(g, size.w, size.h, [...strokes, ...pending.current, ...mine]);
  };
  // Bestätigte Striche: aus der Warteschlange nehmen
  useEffect(() => {
    if (pending.current.length) {
      const known = new Set(strokes.map((s) => s.p));
      pending.current = pending.current.filter((s) => !known.has(s.p));
    }
    redraw();
  });

  const point = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))];
  };
  const flush = (end: boolean) => {
    const pts = live.current;
    if (!onStroke || pts.length - sent.current < (end ? 1 : 2)) return;
    // ab dem letzten gesendeten Punkt weiter, damit die Linie durchgeht
    const part = pts.slice(Math.max(0, sent.current - 1));
    const stroke = { c: color, w: width, p: encodePoints(part.length ? part : pts) };
    pending.current.push(stroke);
    onStroke(stroke);
    sent.current = pts.length;
  };
  useEffect(() => {
    if (!onStroke) return;
    const t = setInterval(() => { if (live.current.length) flush(false); }, 250);
    return () => clearInterval(t);
  });

  return (
    <div ref={box} className={cn("flex min-h-0 items-center justify-center", className)}>
      <canvas ref={canvas} role="img" aria-label={label ?? "Zeichnung"} data-testid="paper" data-strokes={strokes.length}
        style={{ width: size.w, height: size.h, touchAction: "none" }}
        className={cn("rounded-2xl shadow-lg ring-1 ring-black/10", onStroke && "cursor-crosshair")}
        onPointerDown={onStroke ? (e) => { e.currentTarget.setPointerCapture(e.pointerId); live.current = [point(e)]; sent.current = 0; redraw(); } : undefined}
        onPointerMove={onStroke ? (e) => {
          if (!live.current.length) return;
          const p = point(e), q = live.current[live.current.length - 1];
          // nur echte Bewegung zählt (spart Daten)
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.004) return;
          live.current.push(p);
          if (live.current.length - sent.current >= 120) flush(false);
          redraw();
        } : undefined}
        onPointerUp={onStroke ? () => { flush(true); live.current = []; sent.current = 0; redraw(); } : undefined}
        onPointerCancel={onStroke ? () => { flush(true); live.current = []; sent.current = 0; } : undefined} />
    </div>
  );
}
