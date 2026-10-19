import { useCallback, useEffect, useRef, useState } from "react";
import { TABLE_CALL_ID, type CallPeer, type ClientMessage } from "@shared/platform/protocol";
import { callEnabled } from "@/platform/call/useCall";

/** Ist der Videochat auf dem Server eingerichtet? (sonst gibt es am Tisch keine Video-Schalter) */
export function useCallReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => { let on = true; void callEnabled().then((r) => { if (on) setReady(r); }); return () => { on = false; }; }, []);
  return ready;
}

/**
 * Videochat am Großen Tisch – der Bildschirm ist kein Spieler, er meldet sich mit dem Tisch-Schlüssel vom Server an:
 *  - Videos an den Plätzen: holt nur die Bilder der Spieler mit Kamera ab (kein Ton – im Wohnzimmer hallt das sonst),
 *  - Couch-Kamera: die Kamera des Bildschirms schickt das Wohnzimmer zu den Online-Mitspielern (nur Bild).
 * Beides läuft über eigene SFU-Sitzungen und ist am Tisch abschaltbar.
 */
const ICE = [{ urls: "stun:stun.cloudflare.com:3478" }];
type Op = "new" | "tracks" | "renegotiate" | "close";
interface Res { sessionId?: string; sessionDescription?: RTCSessionDescriptionInit; requiresImmediateRenegotiation?: boolean; tracks?: { mid?: string; trackName?: string; sessionId?: string }[] }

function tableApi(code: string, key: string) {
  return async (op: Op, session: string | null, payload?: unknown): Promise<Res> => {
    const res = await fetch(`/api/rooms/${code}/call`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: TABLE_CALL_ID, token: key, op, session, payload }),
    });
    const data = (await res.json().catch(() => ({}))) as Res & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Videochat nicht erreichbar.");
    return data;
  };
}

/** Videos der Spieler (nur wer die Kamera an hat) – `on`: am Tisch eingeschaltet */
export function useSeatVideos(code: string, key: string | null, peers: Record<string, CallPeer>, on: boolean): Record<string, MediaStream> {
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const conn = useRef<{ pc: RTCPeerConnection; session: string; pulled: { peer: string; key: string; mid: string | null }[] } | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const run = useCallback((fn: () => Promise<unknown>) => { queue.current = queue.current.then(fn, fn).catch(() => {}); }, []);

  const want = on && key ? Object.entries(peers).filter(([id, p]) => id !== TABLE_CALL_ID && p.cam && p.video).map(([peer, p]) => ({ peer, session: p.session, track: p.video!, key: `${p.session}/${p.video}` })) : [];
  const wantKey = want.map((w) => w.key).sort().join();

  useEffect(() => {
    if (!key) return;
    const api = tableApi(code, key);
    run(async () => {
      // Niemand mit Kamera (oder ausgeschaltet): Sitzung schließen
      if (!want.length) {
        conn.current?.pc.close(); conn.current = null; setStreams({});
        return;
      }
      if (!conn.current) {
        const pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" });
        const created = await api("new", null);
        if (!created.sessionId) { pc.close(); return; }
        const c = { pc, session: created.sessionId, pulled: [] as { peer: string; key: string; mid: string | null }[] };
        pc.ontrack = (e) => {
          const p = c.pulled.find((x) => x.mid === e.transceiver.mid);
          if (p) setStreams((prev) => ({ ...prev, [p.peer]: new MediaStream([e.track]) }));
        };
        conn.current = c;
      }
      const c = conn.current;
      const gone = c.pulled.filter((p) => !want.some((w) => w.key === p.key));
      if (gone.length) {
        c.pulled = c.pulled.filter((p) => !gone.includes(p));
        setStreams((prev) => { const next = { ...prev }; for (const g of gone) delete next[g.peer]; return next; });
        const mids = gone.map((g) => g.mid).filter(Boolean);
        if (mids.length) await api("close", c.session, { tracks: mids.map((mid) => ({ mid })), force: true }).catch(() => {});
      }
      const add = want.filter((w) => !c.pulled.some((p) => p.key === w.key));
      if (!add.length) return;
      const entries = add.map((a) => ({ peer: a.peer, key: a.key, mid: null as string | null }));
      c.pulled.push(...entries);
      try {
        const res = await api("tracks", c.session, { tracks: add.map((a) => ({ location: "remote", sessionId: a.session, trackName: a.track })) });
        for (const t of res.tracks ?? []) {
          const e = entries.find((x) => x.key === `${t.sessionId}/${t.trackName}`);
          if (e && t.mid) e.mid = t.mid;
        }
        if (res.requiresImmediateRenegotiation && res.sessionDescription) {
          await c.pc.setRemoteDescription(res.sessionDescription);
          await c.pc.setLocalDescription(await c.pc.createAnswer());
          await api("renegotiate", c.session, { sessionDescription: { type: "answer", sdp: c.pc.localDescription!.sdp } });
        }
      } catch {
        // beim nächsten Wechsel nochmal versuchen
        c.pulled = c.pulled.filter((p) => !entries.includes(p));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, key, wantKey, run]);

  useEffect(() => () => { conn.current?.pc.close(); conn.current = null; }, []);
  return streams;
}

/** Couch-Kamera: die Kamera des Bildschirms ins Gespräch schicken (nur Bild) – an/aus am Tisch */
export function useCouchCam(code: string, key: string | null, announce: (m: Extract<ClientMessage, { type: "call" }>) => void) {
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const live = useRef<{ session: string; track: string } | null>(null);

  const stop = useCallback(() => {
    pc.current?.close(); pc.current = null;
    setLocal((s) => { s?.getTracks().forEach((t) => t.stop()); return null; });
    if (live.current) announce({ type: "call", session: null });
    live.current = null;
  }, [announce]);

  const start = useCallback(async () => {
    if (!key || pc.current || busy) return;
    setBusy(true); setError(null);
    let media: MediaStream | null = null;
    try {
      media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio: false });
      const api = tableApi(code, key);
      const conn = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" });
      pc.current = conn;
      const created = await api("new", null);
      if (!created.sessionId) throw new Error("Keine Sitzung erhalten.");
      const tr = conn.addTransceiver(media.getVideoTracks()[0], { direction: "sendonly" });
      await conn.setLocalDescription(await conn.createOffer());
      const track = `couch-${crypto.randomUUID().slice(0, 12)}`;
      const res = await api("tracks", created.sessionId, { sessionDescription: { type: "offer", sdp: conn.localDescription!.sdp }, tracks: [{ location: "local", mid: tr.mid, trackName: track }] });
      await conn.setRemoteDescription(res.sessionDescription!);
      live.current = { session: created.sessionId, track };
      announce({ type: "call", session: created.sessionId, video: track, mic: false, cam: true });
      setLocal(media);
    } catch (e) {
      media?.getTracks().forEach((t) => t.stop());
      pc.current?.close(); pc.current = null;
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Die Kamera ist nicht erlaubt." : e instanceof DOMException ? "An diesem Bildschirm gibt es keine Kamera." : (e as Error).message);
    }
    setBusy(false);
  }, [code, key, busy, announce]);

  // Neu verbunden (neuer Schlüssel): wieder anmelden
  useEffect(() => { if (live.current && key) announce({ type: "call", session: live.current.session, video: live.current.track, mic: false, cam: true }); }, [key, announce]);
  // Tisch verlassen: Verbindung zu, Kamera aus
  const cam = useRef<MediaStream | null>(null);
  cam.current = local;
  useEffect(() => () => { pc.current?.close(); cam.current?.getTracks().forEach((t) => t.stop()); }, []);
  return { on: !!local, local, busy, error, start, stop };
}
