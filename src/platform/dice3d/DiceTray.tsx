import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn, vibrate } from "@/lib/utils";
import { Die } from "../Die";
import type { Pose } from "./physics";
import { beginRoll, isRolling, setFlying, setThrow, takeThrow } from "./throw";
import "./dice3d.css";

type Physics = typeof import("./physics");
type Face = { n: [number, number, number]; t: [number, number, number]; value: number };
type Quat = [number, number, number, number];
/** Ein Würfel in der Anzeige: Lage (flach, nur gedreht), Beschriftung, kleiner Versatz für ein natürliches Bild */
type Placed = { q: Quat; faces: Face[]; jx: number; jz: number };

/** Augenbild je Zahl im 3×3-Raster (wie echte Würfel: 2, 3, 6 diagonal bzw. in Spalten) */
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** Licht von oben links vorn */
const LIGHT = (() => { const v = [-0.35, 0.85, 0.4]; const l = Math.hypot(...v); return v.map((x) => x / l); })();
/** Ausrollen abwarten, dann gleiten die Würfel in die Anzeige */
const REST_MS = 280, GLIDE_MS = 420;

let physics: Promise<Physics> | null = null;
const loadPhysics = () => (physics ??= import("./physics"));
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Plätze in der Anzeige: eine Reihe, bei wenig Höhe und vielen Würfeln zwei. Würfel i liegt immer auf Platz i. */
function layout(n: number, w: number, h: number): { px: number; slots: [number, number][] } {
  const gap = 1.32;
  let rows = 1, px = Math.min(46, h * 0.6, w / (n * gap + 0.9));
  if (n > 3) {
    const per = Math.ceil(n / 2), px2 = Math.min(46, h / 2.75, w / (per * gap + 0.9));
    if (px2 > px * 1.08) { rows = 2; px = px2; }
  }
  const slots: [number, number][] = [];
  const per = Math.ceil(n / rows);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / per), cnt = Math.min(per, n - r * per), j = i - r * per;
    slots.push([(j - (cnt - 1) / 2) * gap * px, rows === 1 ? 0 : (r - 0.5) * 1.3 * px]);
  }
  return { px: Math.max(14, px), slots };
}

/**
 * Würfel mit echter Physik: Bei jedem Wurf fliegen sie groß über den ganzen Bildschirm, prallen am Rand ab,
 * rollen aus und gleiten dann in die Anzeige – dort liegen sie flach und gut lesbar, gehaltene leuchten.
 * `rollKey` ändert sich bei jedem neuen Wurf – nur dann wird geworfen; neu geladen liegt alles still wie zuletzt.
 */
export function DiceTray({ values, held, hint, rollKey, onToggle, canToggle, onThrow, className, label = "Würfel", empty = "Tippe auf „Würfeln“" }: {
  /** Würfeln per Wischen nach oben über die Anzeige (nur wer gerade würfeln darf) */
  onThrow?: () => void;
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
  const placed = useRef<{ key: string; dice: Placed[] } | null>(null);
  /** Wurf in der Luft: welche Würfel fliegen, ihre Bahn und die Größe auf dem Bildschirm */
  const [flight, setFlight] = useState<{ key: string; idx: number[]; frames: Pose[][]; px: number } | null>(null);
  const [gliding, setGliding] = useState(false);
  const [, redraw] = useState(0);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const trayDice = useRef<(HTMLElement | null)[]>([]);
  const airDice = useRef<(HTMLElement | null)[]>([]);
  const airShadows = useRef<(HTMLElement | null)[]>([]);
  const airLayers = useRef<(HTMLElement | null)[]>([]);
  // Beim Öffnen schon vorhandener Wurf (z. B. neu geladen): still hinlegen. Jeder spätere Wurf fliegt.
  const firstKey = useRef(values.length ? rollKey : null);

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
  const { px, slots } = layout(Math.max(1, n), size?.w ?? 300, size?.h ?? 100);

  // Neuer Wurf: Physik auf dem ganzen Bildschirm rechnen, Beschriftung so drehen, dass die gewürfelte Zahl oben landet
  useEffect(() => {
    if (!lib || !n || (placed.current?.key === rollKey && placed.current.dice.length === n)) return;
    const prev = placed.current;
    const keep = values.map((_, i) => !!(held?.[i] && prev?.dice[i] && prev.dice.length === n));
    const seed = lib.seedOf(rollKey);
    const animate = rollKey !== firstKey.current && !reduced() && typeof window !== "undefined";
    const idx = values.map((_, i) => i).filter((i) => !keep[i]);
    const jitter = (i: number, k: number) => ((((seed >>> (i * 3 + k)) & 15) / 15) - 0.5) * 0.14;
    const dice: Placed[] = [];
    let frames: Pose[][] = [];
    let big = 0;
    if (animate && idx.length) {
      const W = window.innerWidth, H = window.innerHeight;
      big = Math.round(Math.min(76, Math.max(42, Math.min(W / 6.5, H / 11))));
      frames = lib.simulate(idx.length, idx.map(() => null), seed, W / (2 * big) - 0.2, H / (2 * big) - 0.4, takeThrow() ?? undefined);
    }
    const last = frames.at(-1);
    values.forEach((v, i) => {
      if (keep[i]) { dice.push(prev!.dice[i]); return; }
      const k = idx.indexOf(i);
      const pose: Pose = last ? last[k] : lib.restingPose(seed + i * 101);
      dice.push({ q: [pose[3], pose[4], pose[5], pose[6]], faces: lib.labelFaces(pose, v), jx: jitter(i, 0), jz: jitter(i, 1) });
    });
    placed.current = { key: rollKey, dice };
    if (last) {
      setFlight({ key: rollKey, idx, frames, px: big });
      setGliding(false);
      setFlying(true);
      vibrate(12);
    } else {
      setFlight(null);
      setFlying(false);
      redraw((x) => x + 1);
    }
  }, [lib, rollKey, n, values, held]);

  // Flug abspielen, kurz liegen lassen, dann in die Anzeige gleiten
  useEffect(() => {
    if (!flight || !lib) return;
    let k = 0, raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const draw = () => {
      const fr = flight.frames[Math.min(k, flight.frames.length - 1)];
      fr.forEach((p, j) => {
        const die = airDice.current[j], sh = airShadows.current[j], layer = airLayers.current[j];
        if (!die) return;
        die.style.transform = poseMatrix(lib, p, flight.px);
        shade(lib, die, p);
        // Wer weiter vorn (unten auf dem Bildschirm) liegt, wird zuletzt gezeichnet
        if (layer) layer.style.zIndex = String(Math.round(p[2] * 10 + 1000));
        const h = Math.max(0, p[1] - 0.5);
        if (sh) {
          sh.style.transform = `translate3d(${(p[0] - LIGHT[0] * h * 0.9) * flight.px}px,1px,${(p[2] - LIGHT[2] * h * 0.9) * flight.px}px) rotateX(90deg) scale(${1 + h * 0.12})`;
          sh.style.opacity = String(Math.max(0.1, 0.7 - h * 0.15));
        }
      });
      if (++k < flight.frames.length) { raf = requestAnimationFrame(draw); return; }
      timers.push(setTimeout(glide, REST_MS));
    };
    const glide = () => {
      flight.idx.forEach((i, j) => {
        const from = airDice.current[j]?.getBoundingClientRect(), to = trayDice.current[i]?.getBoundingClientRect(), layer = airLayers.current[j];
        if (!from || !to || !layer || !from.width) return;
        const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
        layer.style.transformOrigin = `${cx}px ${cy}px`;
        layer.style.transform = `translate(${to.left + to.width / 2 - cx}px, ${to.top + to.height / 2 - cy}px) scale(${to.width / from.width})`;
      });
      setGliding(true);
      timers.push(setTimeout(() => { setFlight(null); setGliding(false); setFlying(false); }, GLIDE_MS));
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, [flight, lib]);

  // Wird die Anzeige mitten im Flug abgebaut (Zug vorbei, Seite verlassen): Sperre wieder lösen
  const flyingNow = !!flight;
  useEffect(() => (flyingNow ? () => setFlying(false) : undefined), [flyingNow]);

  // Die ruhenden Würfel in der Anzeige: Lage und Licht setzen
  useLayoutEffect(() => {
    const pd = placed.current;
    if (!lib || !pd) return;
    pd.dice.forEach((d, i) => {
      const el = trayDice.current[i];
      const slot = slots[i];
      if (!el || !slot) return;
      const p: Pose = [slot[0] / px + d.jx, 0.5, slot[1] / px + d.jz, ...d.q];
      el.style.transform = poseMatrix(lib, p, px);
      shade(lib, el, p);
    });
  });

  const pd = placed.current;
  const ready = !!(lib && pd && pd.dice.length === n && pd.key === rollKey);
  const inAir = new Set(flight?.idx ?? []);
  return (
    <div ref={box} role="group" aria-label={label} data-testid="dice-tray"
      className={cn("dice-tray relative overflow-hidden", onThrow && "touch-none", className)}
      // Wischen nach oben wirft: je schneller, desto kräftiger; schräg gewischt fliegen sie schräg
      onPointerDown={onThrow ? (e) => { swipe.current = { x: e.clientX, y: e.clientY, t: performance.now() }; } : undefined}
      onPointerUp={onThrow ? (e) => {
        const s0 = swipe.current;
        swipe.current = null;
        if (!s0 || isRolling()) return;
        const dy = s0.y - e.clientY, dx = e.clientX - s0.x, dt = Math.max(16, performance.now() - s0.t);
        if (dy < 40 || dy < Math.abs(dx)) return;
        setThrow({ power: Math.min(1, Math.max(0.25, dy / dt / 2.2)), aim: Math.max(-1, Math.min(1, dx / dy)) });
        vibrate(15);
        beginRoll();
        onThrow();
      } : undefined}>
      {!n && <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{empty}</span>}
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
          {values.map((_, i) => slots[i] && (
            <span key={`s${i}`} className={cn("dice-shadow", held?.[i] && "held", inAir.has(i) && "opacity-0")}
              style={{ transform: `translate3d(${slots[i][0] + pd!.dice[i].jx * px}px,1px,${slots[i][1] + pd!.dice[i].jz * px}px) rotateX(90deg)` }} />
          ))}
          {values.map((v, i) => (
            <button key={i} type="button" ref={(el) => { trayDice.current[i] = el; }} disabled={!canToggle}
              aria-pressed={!!held?.[i]} aria-label={`Würfel ${v}${held?.[i] ? ", gehalten" : ""}`}
              onClick={() => { vibrate(6); onToggle?.(i); }}
              className={cn("die3d", held?.[i] && "held", !held?.[i] && hint?.[i] && "hint", inAir.has(i) && "opacity-0")}>
              <span role="img" aria-label={`Würfel ${v}`} className="sr-only" />
              <DieBody faces={pd!.dice[i].faces} px={px} />
            </button>
          ))}
        </div>
      )}
      {flight && ready && createPortal(
        <div className={cn("dice-air", gliding && "gliding")} aria-hidden="true">
          {flight.idx.map((i, j) => (
            <div key={`${flight.key}-${i}`} ref={(el) => { airLayers.current[j] = el; }} className="dice-air-layer">
              <div className="dice-scene dice-air-scene" style={{ ["--px" as string]: `${flight.px}px` }}>
                <span ref={(el) => { airShadows.current[j] = el; }} className="dice-shadow" />
                <span ref={(el) => { airDice.current[j] = el; }} className="die3d">
                  <DieBody faces={pd!.dice[i].faces} px={flight.px} />
                </span>
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Würfelkörper: Kern gegen Durchscheinen, dazu die sechs beschrifteten Seiten */
function DieBody({ faces, px }: { faces: Face[]; px: number }) {
  return (
    <>
      <span className="die3d-core" style={{ transform: "rotateX(90deg)" }} />
      <span className="die3d-core" style={{ transform: "rotateY(90deg)" }} />
      <span className="die3d-core" />
      {faces.map((f) => {
        const X = cross(f.t, f.n), d = px / 2;
        return (
          <span key={f.value} data-n={f.n.join(",")} className={cn("die3d-face", f.value === 1 && "one")}
            style={{ transform: `matrix3d(${X},0,${f.t},0,${f.n},0,${f.n[0] * d},${f.n[1] * d},${f.n[2] * d},1)` }}>
            {Array.from({ length: 9 }, (_, c) => (PIPS[f.value].includes(c) ? <i key={c} /> : <b key={c} />))}
          </span>
        );
      })}
    </>
  );
}

function poseMatrix(lib: Physics, p: Pose, px: number) {
  const a = lib.axes(p);
  return `matrix3d(${a[0]},${a[1]},${a[2]},0,${a[3]},${a[4]},${a[5]},0,${a[6]},${a[7]},${a[8]},0,${p[0] * px},${p[1] * px},${p[2] * px},1)`;
}

/** Seiten je nach Lage zum Licht heller oder dunkler */
function shade(lib: Physics, die: HTMLElement, p: Pose) {
  die.querySelectorAll<HTMLElement>("[data-n]").forEach((f) => {
    const nn = f.dataset.n!.split(",").map(Number) as [number, number, number];
    const w = lib.worldNormal(p, nn);
    const lit = w[0] * LIGHT[0] + w[1] * LIGHT[1] + w[2] * LIGHT[2];
    f.style.filter = `brightness(${(0.6 + 0.48 * Math.max(0, lit)).toFixed(3)})`;
  });
}
