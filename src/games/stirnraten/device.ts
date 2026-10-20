/**
 * Handy an der Stirn: Neigung erkennen, Bildschirm wach halten, die Erklärenden filmen.
 *
 * Neigung: Aus den Winkeln von `deviceorientation` (β, γ) ergibt sich, wohin der Bildschirm zeigt –
 * cos β · cos γ ist +1 zur Decke, −1 zum Boden, 0 bei aufrechtem Handy. Das gilt im Hoch- wie im Querformat.
 * Zum Boden kippen (Kopf nicken) heißt „erraten“, zur Decke „weiter“. Danach muss das Handy erst wieder
 * aufrecht stehen, bevor die nächste Neigung zählt.
 */
import { useEffect, useRef, useState } from "react";

type Tilt = "hit" | "pass";
const FIRE = 0.6;
const NEUTRAL = 0.35;

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

/** Erlaubnis für den Sensor (nur iPhone/iPad fragt) – muss aus einem Tipp heraus kommen */
export async function requestTilt(): Promise<boolean> {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return false;
  const ctor = window.DeviceOrientationEvent as OrientationCtor;
  if (typeof ctor.requestPermission !== "function") return true;
  try { return (await ctor.requestPermission()) === "granted"; } catch { return false; }
}

/** Neigung beobachten. `live`: Der Sensor liefert wirklich Werte (sonst Tippen anbieten). */
export function useTilt(enabled: boolean, onTilt: (t: Tilt) => void): { live: boolean } {
  const [live, setLive] = useState(false);
  const cb = useRef(onTilt);
  cb.current = onTilt;
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    // Erst zählen, wenn das Handy einmal aufrecht war – sonst löst das Hochnehmen gleich aus
    let armed = false;
    const on = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      setLive(true);
      const r = Math.PI / 180;
      const up = Math.cos(e.beta * r) * Math.cos(e.gamma * r);
      if (Math.abs(up) < NEUTRAL) { armed = true; return; }
      if (!armed) return;
      if (up < -FIRE) { armed = false; cb.current("hit"); }
      else if (up > FIRE) { armed = false; cb.current("pass"); }
    };
    window.addEventListener("deviceorientation", on);
    return () => window.removeEventListener("deviceorientation", on);
  }, [enabled]);
  return { live };
}

/** Bildschirm bleibt an, solange `on` */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    type Lock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } };
    let lock: Lock | null = null;
    let gone = false;
    const take = () => { nav.wakeLock?.request("screen").then((l) => { if (gone) void l.release(); else lock = l; }).catch(() => {}); };
    take();
    // Nach dem Zurückkehren in den Tab ist die Sperre weg – neu holen
    const vis = () => { if (document.visibilityState === "visible") take(); };
    document.addEventListener("visibilitychange", vis);
    return () => { gone = true; document.removeEventListener("visibilitychange", vis); void lock?.release().catch(() => {}); };
  }, [on]);
}

/** Querformat im Vollbild – wo der Browser es erlaubt (Android); sonst einfach nichts */
export async function landscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.("landscape");
  } catch { /* egal */ }
}

export function leaveLandscape() {
  try {
    (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  } catch { /* egal */ }
}

// ---------- Video der Runde (nur auf diesem Gerät) ----------
let lastVideo: { url: string; type: string; turn: number } | null = null;
const listeners = new Set<() => void>();

/** Letztes Video (für die Auswertung nach dem Zug) */
export function useLastVideo(turn: number) {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((n) => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return lastVideo && lastVideo.turn === turn ? lastVideo : null;
}

/**
 * Filmt mit der Frontkamera, solange `on` – am Stirn-Handy schaut sie auf die Erklärenden.
 * Klappt das nicht (keine Kamera, verweigert), läuft das Spiel einfach ohne Video weiter.
 */
export function useRoundVideo(on: boolean, turn: number): { recording: boolean } {
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (!on || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    let stop = false;
    let rec: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    const chunks: Blob[] = [];
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: true })
      .then((s) => {
        stream = s;
        if (stop) { s.getTracks().forEach((t) => t.stop()); return; }
        const type = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
        rec = new MediaRecorder(s, type ? { mimeType: type, videoBitsPerSecond: 900_000 } : undefined);
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          if (!chunks.length) return;
          if (lastVideo) URL.revokeObjectURL(lastVideo.url);
          const blob = new Blob(chunks, { type: rec?.mimeType || "video/webm" });
          lastVideo = { url: URL.createObjectURL(blob), type: blob.type, turn };
          listeners.forEach((l) => l());
        };
        rec.start(1000);
        setRecording(true);
      })
      .catch(() => {});
    return () => {
      stop = true;
      setRecording(false);
      try { if (rec && rec.state !== "inactive") rec.stop(); } catch { /* egal */ }
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on, turn]);
  return { recording };
}
