import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn, vibrate } from "@/lib/utils";
import { Die } from "../Die";
import type { Pose } from "./physics";
import "./dice3d.css";

type Physics = typeof import("./physics");
type Face = { n: [number, number, number]; t: [number, number, number]; value: number };

/** Augenbild je Zahl im 3×3-Raster (wie echte Würfel: 2, 3, 6 diagonal bzw. in Spalten) */
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** Licht von oben links vorn */
const LIGHT = (() => { const v = [-0.35, 0.85, 0.4]; const l = Math.hypot(...v); return v.map((x) => x / l); })();

let physics: Promise<Physics> | null = null;
const loadPhysics = () => (physics ??= import("./physics"));
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Würfeltisch mit echten 3D-Würfeln: Sie fliegen aus der Hand auf den Tisch, prallen ab und rollen aus.
 * Gehaltene Würfel bleiben liegen (die anderen stoßen sich an ihnen) und leuchten.
 * `rollKey` ändert sich bei jedem neuen Wurf – nur dann wird geworfen; neu geladen liegt alles still wie zuletzt.
 */
export function DiceTray({ values, held, hint, rollKey, onToggle, canToggle, className, label = "Würfel", empty = "Tippe auf „Würfeln“" }: {
  values: number[];
  held?: boolean[];
  /** Spielhilfe: leiser Ring */
  hint?: boolean[];
  /** Text, solange keine Würfel liegen */
  empty?: string;
  rollKey: string;
  onToggle?: (i: number) => void;
  canToggle?: boolean;
  className?: string;
  label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [lib, setLib] = useState<Physics | null>(null);
  const sim = useRef<{ key: string; frames: Pose[][]; faces: Face[][]; poses: Pose[]; px: number } | null>(null);
  const [, redraw] = useState(0);
  const dieEls = useRef<(HTMLElement | null)[]>([]);
  // Beim Öffnen schon vorhandener Wurf (z. B. neu geladen): still hinlegen. Jeder spätere Wurf fliegt.
  const firstKey = useRef(values.length ? rollKey : null);
  const shadowEls = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => { void loadPhysics().then(setLib); }, []);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const n = values.length;
  // Würfelgröße: Der Tisch soll mindestens gut drei Würfel tief und acht breit sein, sonst stapeln sie sich
  const few = values.length <= 2;
  const px = size ? Math.min(44, Math.max(20, Math.min(size.w / (few ? 3.4 : 8.5), size.h / (few ? 2.4 : 3.3)))) : 36;

  // Neuer Wurf: Physik rechnen, Beschriftung so drehen, dass die gewürfelte Zahl oben landet
  useEffect(() => {
    if (!lib || !size || !n || sim.current?.key === rollKey && sim.current.faces.length === n) return;
    const prev = sim.current;
    // Hinten etwas Luft lassen: von schräg vorn gesehen ragen Würfel an der hinteren Bande sonst aus dem Bild
    const w = size.w / (2 * px) - 0.25, d = size.h / (2 * px) - 0.45;
    const rest = values.map((_, i) => (held?.[i] && prev && prev.poses[i] && prev.faces[i] ? prev.poses[i] : null));
    const frames = lib.simulate(n, rest, lib.seedOf(rollKey), w, d);
    const last = frames.at(-1)!;
    const faces = values.map((v, i) => (rest[i] && prev ? prev.faces[i] : lib.labelFaces(last[i], v)));
    const animate = rollKey !== firstKey.current && !reduced();
    sim.current = { key: rollKey, frames: animate ? frames : [last], faces, poses: last, px };
    redraw((x) => x + 1);
    if (animate) vibrate(12);
  }, [lib, size, rollKey, n, values, held, px]);

  // Abspielen
  useEffect(() => {
    const s = sim.current;
    if (!s) return;
    let k = 0, raf = 0;
    const draw = () => {
      const fr = s.frames[Math.min(k, s.frames.length - 1)];
      fr.forEach((p, i) => {
        const die = dieEls.current[i], sh = shadowEls.current[i];
        if (!die || !lib) return;
        const a = lib.axes(p);
        die.style.transform = `matrix3d(${a[0]},${a[1]},${a[2]},0,${a[3]},${a[4]},${a[5]},0,${a[6]},${a[7]},${a[8]},0,${p[0] * px},${p[1] * px},${p[2] * px},1)`;
        const h = Math.max(0, p[1] - 0.5);
        if (sh) {
          sh.style.transform = `translate3d(${(p[0] - LIGHT[0] * h * 0.9) * px}px,1px,${(p[2] - LIGHT[2] * h * 0.9) * px}px) rotateX(90deg) scale(${1 + h * 0.12})`;
          sh.style.opacity = String(Math.max(0.12, 0.8 - h * 0.2));
        }
        die.querySelectorAll<HTMLElement>("[data-n]").forEach((f) => {
          const nn = f.dataset.n!.split(",").map(Number) as [number, number, number];
          const w = lib.worldNormal(p, nn);
          const lit = w[0] * LIGHT[0] + w[1] * LIGHT[1] + w[2] * LIGHT[2];
          f.style.filter = `brightness(${(0.6 + 0.48 * Math.max(0, lit)).toFixed(3)})`;
        });
      });
      if (++k < s.frames.length) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  });

  const s = sim.current;
  const ready = !!(lib && s && s.faces.length === n);
  return (
    <div ref={box} role="group" aria-label={label} data-testid="dice-tray"
      className={cn("dice-tray relative overflow-hidden rounded-2xl", className)}>
      {!n && <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/75">{empty}</span>}
      {/* Bis die Physik geladen ist: flache Würfel in einer Reihe */}
      {n > 0 && !ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          {values.map((v, i) => (
            <button key={i} type="button" disabled={!canToggle} aria-pressed={!!held?.[i]} aria-label={`Würfel ${v}${held?.[i] ? ", gehalten" : ""}`}
              onClick={() => onToggle?.(i)} className="size-11 rounded-[22%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
              <Die value={v} className="size-full" mark={held?.[i] ? "selected" : hint?.[i] ? "hint" : undefined} />
            </button>
          ))}
        </div>
      )}
      {ready && (
        <div className="dice-scene" style={{ ["--px" as string]: `${px}px` }}>
          {values.map((_, i) => (
            <span key={`s${i}`} ref={(el) => { shadowEls.current[i] = el; }} className={cn("dice-shadow", held?.[i] && "held")} />
          ))}
          {values.map((v, i) => (
            <button key={i} type="button" ref={(el) => { dieEls.current[i] = el; }} disabled={!canToggle}
              aria-pressed={!!held?.[i]} aria-label={`Würfel ${v}${held?.[i] ? ", gehalten" : ""}`}
              onClick={() => { vibrate(6); onToggle?.(i); }}
              className={cn("die3d", held?.[i] && "held", !held?.[i] && hint?.[i] && "hint")}>
              <span className="die3d-core" style={{ transform: "rotateX(90deg)" }} />
              <span className="die3d-core" style={{ transform: "rotateY(90deg)" }} />
              <span className="die3d-core" />
              {s!.faces[i].map((f) => {
                const X = cross(f.t, f.n), d = px / 2;
                return (
                  <span key={f.value} data-n={f.n.join(",")} className={cn("die3d-face", f.value === 1 && "one")}
                    style={{ transform: `matrix3d(${X},0,${f.t},0,${f.n},0,${f.n[0] * d},${f.n[1] * d},${f.n[2] * d},1)` }}>
                    {Array.from({ length: 9 }, (_, c) => (PIPS[f.value].includes(c) ? <i key={c} /> : <b key={c} />))}
                  </span>
                );
              })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
