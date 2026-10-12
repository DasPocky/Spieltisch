import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn, vibrate } from "@/lib/utils";
import { Die } from "../Die";
import type { Pose } from "./physics";
import type { DiceView, DieDraw, Quat } from "./gl";
import { beginRoll, isRolling, setFlying, setThrow, takeThrow } from "./throw";
import "./dice3d.css";

type Physics = typeof import("./physics");
type Gl = typeof import("./gl");
type Lib = { phys: Physics; gl: Gl | null };
/** Ein Würfel in der Ablage: Drehung (inkl. Beschriftung, flach liegend) und kleiner Versatz für ein natürliches Bild */
type Placed = { rq: Quat; jx: number; jz: number };

/** Ausrollen abwarten, dann gleiten die Würfel in die Ablage */
const REST_MS = 260, GLIDE_MS = 430;

let libs: Promise<Lib> | null = null;
/** Physik und 3D-Darstellung erst laden, wenn ein Würfelspiel offen ist */
const loadLibs = () => (libs ??= Promise.all([import("./physics"), import("./gl")]).then(([phys, gl]) => ({ phys, gl: gl.webglAvailable() ? gl : null })));
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/**
 * Die Wurf-Ebene über dem ganzen Bildschirm gibt es nur einmal: Sie wird beim ersten Wurf angelegt und danach
 * wiederverwendet – so ruckelt der Start eines Wurfs nicht, und das Handy hält nicht unnötig viele 3D-Kontexte.
 */
let air: { root: HTMLDivElement; view: DiceView } | null = null;
function airLayer(gl: Gl) {
  if (air && document.body.contains(air.root)) return air;
  const root = document.createElement("div");
  root.className = "dice-air";
  root.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  root.append(canvas);
  document.body.append(root);
  air = { root, view: new gl.DiceView(canvas, 12, 30) };
  return air;
}
/** Nach dem Laden in einer ruhigen Sekunde beide Zeichner vorbereiten – der erste Wurf startet dann ohne Hänger */
let warmed = false;
function warmUp(gl: Gl) {
  if (warmed) return;
  warmed = true;
  const idle = (cb: () => void) => ("requestIdleCallback" in window ? window.requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 300));
  idle(() => { gl.warmTray(); idle(() => gl.warm(airLayer(gl).view)); });
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Plätze in der Ablage: eine Reihe, bei wenig Höhe und vielen Würfeln zwei. Würfel i liegt immer auf Platz i. */
function layout(n: number, w: number, h: number): { px: number; slots: [number, number][] } {
  const gap = 1.45;
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
 * Würfel mit echter Physik in echtem 3D: Bei jedem Wurf fliegen sie groß über den ganzen Bildschirm, prallen am
 * Rand ab, rollen aus und gleiten dann in die Ablage – dort liegen sie flach und gut lesbar, gehaltene leuchten.
 * `rollKey` ändert sich bei jedem neuen Wurf – nur dann wird geworfen; neu geladen liegt alles still wie zuletzt.
 */
export function DiceTray({ values, held, hint, rollKey, onToggle, canToggle, onThrow, still, className, label = "Würfel", empty = "Tippe auf „Würfeln“" }: {
  /** Nur anzeigen, nie werfen – z. B. wenn am Tisch mit echten Würfeln gewürfelt und die Zahl eingetippt wurde */
  still?: boolean;
  /** Würfeln per Wischen nach oben über die Ablage (nur wer gerade würfeln darf) */
  onThrow?: () => void;
  values: number[];
  held?: boolean[];
  /** Spielhilfe: leiser Schein */
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
  const trayCanvas = useRef<HTMLCanvasElement>(null);
  /** Bildschirmstellen der ruhenden Würfel in der Ablage (für die antippbaren Flächen und das Hineingleiten) */
  const [spots, setSpots] = useState<[number, number][]>([]);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [lib, setLib] = useState<Lib | null>(null);
  const placed = useRef<{ key: string; dice: Placed[] } | null>(null);
  /** Wurf in der Luft: welche Würfel fliegen, ihre Bahn, Beschriftungsdrehung und Größe auf dem Bildschirm */
  const [flight, setFlight] = useState<{ key: string; idx: number[]; frames: Pose[][]; rs: Quat[]; px: number } | null>(null);
  const [, redraw] = useState(0);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  // Beim Öffnen schon vorhandener Wurf (z. B. neu geladen): still hinlegen. Jeder spätere Wurf fliegt.
  const firstKey = useRef(values.length ? rollKey : null);

  useEffect(() => { void loadLibs().then(setLib); }, []);
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
  const gl = lib?.gl ?? null;
  const hasDice = n > 0;

  useEffect(() => { if (gl) warmUp(gl); }, [gl]);

  // Neuer Wurf: Physik auf dem ganzen Bildschirm rechnen, Drehung so wählen, dass die gewürfelte Zahl oben landet
  useEffect(() => {
    if (!lib || !n || (placed.current?.key === rollKey && placed.current.dice.length === n)) return;
    const { phys } = lib;
    const prev = placed.current;
    const keep = values.map((_, i) => !!(held?.[i] && prev?.dice[i] && prev.dice.length === n));
    const seed = phys.seedOf(rollKey);
    const animate = !!lib.gl && !still && rollKey !== firstKey.current && !reduced();
    const idx = values.map((_, i) => i).filter((i) => !keep[i]);
    const jitter = (i: number, k: number) => ((((seed >>> (i * 3 + k)) & 15) / 15) - 0.5) * 0.14;
    let frames: Pose[][] = [];
    let big = 0;
    if (animate && idx.length) {
      const W = window.innerWidth, H = window.innerHeight;
      big = Math.round(Math.min(78, Math.max(44, Math.min(W / 6.3, H / 10.5))));
      frames = phys.simulate(idx.length, idx.map(() => null), seed, W / (2 * big) - 0.2, H / (2 * big) - 0.4, takeThrow() ?? undefined);
    }
    const last = frames.at(-1);
    const rs: Quat[] = [];
    const dice: Placed[] = values.map((v, i) => {
      if (keep[i]) return prev!.dice[i];
      const k = idx.indexOf(i);
      const pose: Pose = last ? last[k] : phys.restingPose(seed + i * 101);
      const r = phys.labelQuat(pose, v);
      rs[k] = r;
      const q: Quat = [pose[3], pose[4], pose[5], pose[6]];
      return { rq: lib.gl ? lib.gl.compose(q, r) : q, jx: jitter(i, 0), jz: jitter(i, 1) };
    });
    placed.current = { key: rollKey, dice };
    if (last) {
      setFlight({ key: rollKey, idx, frames, rs, px: big });
      setFlying(true);
      vibrate(12);
    } else {
      setFlight(null);
      setFlying(false);
      redraw((x) => x + 1);
    }
  }, [lib, rollKey, n, values, held, still]);

  const pd = placed.current;
  const ready = !!(lib && pd && pd.dice.length === n && pd.key === rollKey);
  const inAir = new Set(flight?.idx ?? []);
  /** Lage eines ruhenden Würfels in der Ablage */
  const restAt = (i: number): [number, number, number] | null => {
    const d = pd?.dice[i], slot = slots[i];
    return d && slot ? [slot[0] / px + d.jx, 0.5, slot[1] / px + d.jz] : null;
  };

  // Ablage zeichnen: ruhende Würfel auf ihren Plätzen (fliegende kommen erst nach der Landung dazu)
  useLayoutEffect(() => {
    const c = trayCanvas.current;
    if (!gl || !c || !size || !ready || !pd) return;
    const list: DieDraw[] = [];
    pd.dice.forEach((d, i) => {
      const at = restAt(i);
      if (inAir.has(i) || !at) return;
      list.push({ pos: at, quat: d.rq, mark: held?.[i] ? "held" : hint?.[i] ? "hint" : null });
    });
    const pts = gl.paintTray(c, size.w, size.h, px, list, values.map((_, i) => restAt(i) ?? [0, 0.5, 0]));
    if (pts.some((p, i) => !spots[i] || Math.abs(p[0] - spots[i][0]) > 0.5 || Math.abs(p[1] - spots[i][1]) > 0.5) || pts.length !== spots.length) setSpots(pts);
  });

  // Flug abspielen, kurz liegen lassen, dann in die Ablage gleiten
  useEffect(() => {
    if (!flight || !gl) return;
    const W = window.innerWidth, H = window.innerHeight;
    const { root, view } = airLayer(gl);
    view.resize(W, H, flight.px);
    view.setDice([]);
    view.render();
    root.classList.remove("gliding");
    root.classList.add("on");
    let k = 0, raf = 0, start = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const poseOf = (p: Pose, j: number): DieDraw => ({ pos: [p[0], p[1], p[2]], quat: gl.compose([p[3], p[4], p[5], p[6]], flight.rs[j]) });
    const last = flight.frames.at(-1)!;
    let targets: { pos: [number, number, number]; s: number }[] = [];
    // Ziel je Würfel: sein Platz in der Ablage, auf den Bildschirm umgerechnet
    const aim = () => {
      const rect = box.current?.getBoundingClientRect();
      const s = px / flight.px;
      return flight.idx.map((i, j) => {
        const sp = spotsRef.current[i];
        if (!rect || !sp) return { pos: [last[j][0], last[j][1], last[j][2]] as [number, number, number], s: 1 };
        return { pos: view.pointAt(rect.left + sp[0], rect.top + sp[1], 0.5 * s), s };
      });
    };
    let t0 = 0;
    const fly = (now: number) => {
      // Nach der Uhr abspielen (Physik rechnet 60 Bilder/s) – langsame Geräte überspringen Bilder, statt nachzuhängen
      t0 ||= now;
      k = Math.min(flight.frames.length - 1, Math.floor(((now - t0) / 1000) * 60));
      view.setDice(flight.frames[k].map(poseOf));
      view.render();
      if (k < flight.frames.length - 1) { raf = requestAnimationFrame(fly); return; }
      timers.push(setTimeout(() => { root.classList.add("gliding"); raf = requestAnimationFrame(glide); }, REST_MS));
    };
    const glide = (now: number) => {
      if (!start) { start = now; targets = aim(); }
      const t = ease(Math.min(1, (now - start) / GLIDE_MS));
      view.setDice(last.map((p, j) => {
        const to = targets[j];
        return { ...poseOf(p, j), pos: [p[0] + (to.pos[0] - p[0]) * t, p[1] + (to.pos[1] - p[1]) * t, p[2] + (to.pos[2] - p[2]) * t], scale: 1 + (to.s - 1) * t };
      }));
      view.render();
      if (t < 1) { raf = requestAnimationFrame(glide); return; }
      root.classList.remove("on", "gliding");
      setFlight(null); setFlying(false);
    };
    raf = requestAnimationFrame(fly);
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); root.classList.remove("on", "gliding"); };
    // Plätze und Größe der Ablage bleiben während eines Wurfs gleich – nur ein neuer Wurf startet neu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight, gl]);

  // Wird die Ablage mitten im Flug abgebaut (Zug vorbei, Seite verlassen): Sperre wieder lösen
  const flyingNow = !!flight;
  useEffect(() => (flyingNow ? () => setFlying(false) : undefined), [flyingNow]);

  /** Antippbare Fläche genau über dem gezeichneten Würfel */
  const spot = (i: number): [number, number] => spots[i] ?? [(size?.w ?? 0) / 2 + (slots[i]?.[0] ?? 0), (size?.h ?? 0) / 2 + (slots[i]?.[1] ?? 0)];

  return (
    <div ref={box} role="group" aria-label={label} data-testid="dice-tray"
      className={cn("dice-tray relative", onThrow && "touch-none", className)}
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
      {hasDice && gl && <canvas ref={trayCanvas} className="pointer-events-none absolute inset-0 size-full" aria-hidden="true" />}
      {/* Ohne 3D (oder bis es geladen ist): flache Würfel in einer Reihe */}
      {hasDice && (!ready || !gl) && (
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          {values.map((v, i) => (
            <button key={i} type="button" disabled={!canToggle} aria-pressed={!!held?.[i]} aria-label={`Würfel ${v}${held?.[i] ? ", gehalten" : ""}`}
              onClick={() => onToggle?.(i)} className="size-11 rounded-[22%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
              <span role="img" aria-label={`Würfel ${v}`} className="sr-only" />
              <Die value={v} className="size-full" mark={held?.[i] ? "selected" : hint?.[i] ? "hint" : undefined} />
            </button>
          ))}
        </div>
      )}
      {ready && gl && values.map((v, i) => {
        const [x, y] = spot(i);
        return (
          <button key={i} type="button" disabled={!canToggle} aria-pressed={!!held?.[i]} aria-label={`Würfel ${v}${held?.[i] ? ", gehalten" : ""}`}
            onClick={() => { vibrate(6); onToggle?.(i); }}
            className="absolute rounded-[24%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            style={{ left: x, top: y, width: px * 1.15, height: px * 1.15, marginLeft: -px * 0.575, marginTop: -px * 0.575 }}>
            <span role="img" aria-label={`Würfel ${v}`} className="sr-only" />
          </button>
        );
      })}
    </div>
  );
}
