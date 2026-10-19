/**
 * Kamera am großen Tisch – wie bei einer Fernsehübertragung:
 *  - Grundansicht je Spiel: ein Bereich des Tisches (ganzer Tisch, Brett, Würfel, Wortraster) füllt das Bild
 *  - kurz heranfahren, wenn etwas passiert (Wurf, ausgespielte Karte) – danach zurück
 *  - Partyspiele am Fernseher: die Kamera dreht sich zu dem, der dran ist
 *  - frei bewegen: ziehen dreht, Rad/zwei Finger zoomen, Doppelklick stellt zurück; die Einstellung merkt sich das Gerät
 * Bewegungen gleiten weich; gezeichnet wird nur, solange sich etwas bewegt.
 */
import { PerspectiveCamera, Vector3 } from "three";
import { readJSON, writeJSON } from "@/lib/storage";

export interface Rect { x0: number; z0: number; x1: number; z1: number }
interface View { tx: number; tz: number; dist: number; pitch: number; yaw: number }

/** Eigene Einstellung des Geräts: Drehung, Neigung, Nähe (bezogen auf die Grundansicht) */
interface Adjust { yaw: number; pitch: number; zoom: number }
const KEY = "spieltisch:tableCam";
/** Ereignis „Ansicht zurücksetzen“ (Knopf am Fernseher) */
export const RESET_VIEW = "spieltisch:resetView";
const PITCH = 0.92;
const NONE: Adjust = { yaw: 0, pitch: PITCH, zoom: 1 };

export interface CameraRig {
  /** Grundansicht: dieser Bereich füllt das Bild, von der Seite `yaw` aus gesehen (0 = von vorn) */
  setHome(rect: Rect, yaw?: number): void;
  /** Kurz heranfahren und nach `ms` zurück */
  focus(rect: Rect, ms: number): void;
  resize(): void;
  /** Ein Bild weiter – true, solange sich die Kamera noch bewegt */
  step(now: number): boolean;
  dispose(): void;
}

/** Bereich mindestens so groß (um die Mitte) – sonst fehlt der Tisch drumherum und es wirkt wie eine Lupe */
function atLeast(r: Rect, w: number, d: number): Rect {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const hw = Math.max(w, r.x1 - r.x0) / 2, hd = Math.max(d, r.z1 - r.z0) / 2;
  return { x0: cx - hw, z0: cz - hd, x1: cx + hw, z1: cz + hd };
}

export function createCameraRig(camera: PerspectiveCamera, canvas: HTMLCanvasElement, request: () => void): CameraRig {
  let adj: Adjust = { ...NONE, ...readJSON<Partial<Adjust>>(KEY) };
  let home: { rect: Rect; yaw: number } = { rect: { x0: -3, z0: -2, x1: 3, z1: 2 }, yaw: 0 };
  let focusRect: Rect | null = null, focusUntil = 0;
  let cur: View | null = null, goal: View | null = null, last = 0;
  const probe = new PerspectiveCamera();

  /** Abstand, bei dem der Bereich (samt etwas Höhe) gerade ins Bild passt */
  function fit(rect: Rect, yaw: number, pitch: number): View {
    const tx = (rect.x0 + rect.x1) / 2, tz = (rect.z0 + rect.z1) / 2;
    const pts = [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1]].flatMap(([x, z]) => [new Vector3(x, 0, z), new Vector3(x, 0.15, z)]);
    probe.fov = camera.fov; probe.aspect = camera.aspect; probe.near = camera.near; probe.far = camera.far; probe.updateProjectionMatrix();
    const fits = (d: number) => {
      place(probe, { tx, tz, dist: d, pitch, yaw });
      return pts.every((p) => { const v = p.clone().project(probe); return v.z < 1 && Math.abs(v.x) <= 0.94 && Math.abs(v.y) <= 0.92; });
    };
    let lo = 0.3, hi = 40;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    return { tx, tz, dist: hi, pitch, yaw };
  }

  function place(cam: PerspectiveCamera, v: View) {
    const h = Math.cos(v.pitch) * v.dist;
    cam.position.set(v.tx + Math.sin(v.yaw) * h, Math.sin(v.pitch) * v.dist, v.tz + Math.cos(v.yaw) * h);
    cam.lookAt(v.tx, 0, v.tz);
    cam.updateMatrixWorld();
  }

  /** Ziel neu bestimmen: Heranfahren (solange es gilt) oder Grundansicht, jeweils mit der eigenen Einstellung */
  function retarget(now = performance.now()) {
    const zoomed = focusRect && now < focusUntil;
    const yaw = home.yaw + adj.yaw;
    const v = fit(zoomed ? focusRect! : home.rect, yaw, adj.pitch);
    goal = { ...v, dist: v.dist * (zoomed ? 1 : adj.zoom) };
    if (!cur) { cur = { ...goal }; place(camera, cur); }
    request();
  }

  // ---------- Frei bewegen ----------
  const save = () => writeJSON(KEY, adj);
  let drag: { x: number; y: number; id: number } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const down = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; }
    canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) zoomBy(pinch / d);
      pinch = d;
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = { ...drag, x: e.clientX, y: e.clientY };
    adj = { ...adj, yaw: adj.yaw - dx * 0.006, pitch: Math.min(1.45, Math.max(0.3, adj.pitch + dy * 0.004)) };
    focusUntil = 0;
    retarget();
  };
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (drag?.id === e.pointerId) drag = null;
    save();
  };
  const zoomBy = (f: number) => {
    adj = { ...adj, zoom: Math.min(1.8, Math.max(0.35, adj.zoom * f)) };
    focusUntil = 0;
    retarget();
  };
  const wheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0012)); save(); };
  const reset = () => { adj = { ...NONE }; save(); retarget(); };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("dblclick", reset);
  window.addEventListener(RESET_VIEW, reset);

  return {
    setHome(rect, yaw = 0) {
      home = { rect: atLeast(rect, 2.6, 1.7), yaw };
      retarget();
    },
    focus(rect, ms) {
      focusRect = rect; focusUntil = performance.now() + ms;
      retarget();
    },
    resize() { retarget(); if (goal) { cur = { ...goal }; place(camera, cur); } },
    step(now) {
      if (!cur || !goal) return false;
      // Heranfahren vorbei: zurück zur Grundansicht
      if (focusRect && now >= focusUntil) { focusRect = null; retarget(now); }
      // echte Zeit: auf langsamen Geräten (wenige Bilder) ist die Kamera trotzdem nach etwa einer Sekunde da
      const dt = last ? Math.min(1500, now - last) : 16;
      last = now;
      const k = 1 - Math.exp(-dt / 260);
      let dyaw = goal.yaw - cur.yaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      cur = {
        tx: cur.tx + (goal.tx - cur.tx) * k, tz: cur.tz + (goal.tz - cur.tz) * k, dist: cur.dist + (goal.dist - cur.dist) * k,
        pitch: cur.pitch + (goal.pitch - cur.pitch) * k, yaw: cur.yaw + dyaw * k,
      };
      place(camera, cur);
      const moving = Math.abs(goal.tx - cur.tx) + Math.abs(goal.tz - cur.tz) + Math.abs(goal.dist - cur.dist) + Math.abs(goal.pitch - cur.pitch) + Math.abs(dyaw) > 0.002;
      if (!moving) { cur = { ...goal }; place(camera, cur); last = 0; }
      // Während des Heranfahrens weiterzeichnen, damit die Rückfahrt pünktlich startet
      return moving || (!!focusRect && now < focusUntil + 50);
    },
    dispose() {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("dblclick", reset);
      window.removeEventListener(RESET_VIEW, reset);
    },
  };
}
