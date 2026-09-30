import { useCallback, useEffect, useRef, useState } from "react";
import type { CallPeer, ClientMessage } from "@shared/platform/protocol";
import { credsKey, readJSON, type RoomCreds } from "@/lib/storage";

/**
 * Sprach-/Videochat über Cloudflare Realtime (SFU). Jedes Handy hat genau eine Verbindung zum SFU:
 * Es lädt eigenes Mikro/Kamera hoch („local“ Tracks) und holt die Spuren der anderen ab („remote“ Tracks).
 * Wer welche Spuren hat, verteilt der Spielraum (CallPeer). Alle SFU-Anfragen laufen über unseren Worker,
 * der das geheime App-Token hält und prüft, dass nur Mitspieler dieses Raums mitmachen.
 */
export type CallPhase = "off" | "joining" | "on";

interface Pulled { peer: string; session: string; track: string; mid: string | null }

const ICE = [{ urls: "stun:stun.cloudflare.com:3478" }];
const name = (kind: string) => `${kind}-${crypto.randomUUID().slice(0, 12)}`;

let enabledCache: Promise<boolean> | null = null;
/** Ist der Chat auf dem Server eingerichtet? (einmal pro Seitenaufruf gefragt) */
export function callEnabled(): Promise<boolean> {
  enabledCache ??= fetch("/api/call").then((r) => r.json()).then((d: { enabled?: boolean }) => !!d.enabled).catch(() => false);
  return enabledCache;
}

export function useCall(code: string, me: string | null, peers: Record<string, CallPeer>, announce: (m: Extract<ClientMessage, { type: "call" }>) => void, silent: boolean) {
  const [phase, setPhase] = useState<CallPhase>("off");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [local, setLocal] = useState<MediaStream | null>(null);

  const pc = useRef<RTCPeerConnection | null>(null);
  const session = useRef<string | null>(null);
  const tracks = useRef<{ audio?: string; video?: string }>({});
  const pulled = useRef<Pulled[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /** SFU-Verhandlungen dürfen sich nicht überholen – alles läuft nacheinander */
  const run = useCallback(<T,>(fn: () => Promise<T>) => {
    const next = queue.current.then(fn, fn);
    queue.current = next.catch(() => {});
    return next;
  }, []);

  const api = useCallback(async (op: "new" | "tracks" | "renegotiate" | "close", payload?: unknown) => {
    const creds = readJSON<RoomCreds>(credsKey(code));
    const res = await fetch(`/api/rooms/${code}/call`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: creds?.playerId, token: creds?.token, op, session: session.current, payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? "Sprachchat nicht erreichbar.");
    return data as {
      sessionId?: string;
      sessionDescription?: RTCSessionDescriptionInit;
      requiresImmediateRenegotiation?: boolean;
      tracks?: { mid?: string; trackName?: string; sessionId?: string; errorCode?: string }[];
    };
  }, [code]);

  const micOn = mic && !silent;
  const say = useCallback((m: boolean, c: boolean) => {
    if (!session.current) return;
    announce({ type: "call", session: session.current, audio: tracks.current.audio, video: tracks.current.video, mic: m, cam: c });
  }, [announce]);

  /** Beitreten: Mikro (und optional Kamera) freigeben, Sitzung anlegen, eigene Spuren hochladen */
  const join = useCallback(async (video: boolean) => {
    if (phase !== "off") return;
    setPhase("joining"); setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: video ? { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" } : false,
      });
      const conn = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" });
      pc.current = conn;
      conn.ontrack = (e) => {
        const p = pulled.current.find((x) => x.mid === e.transceiver.mid);
        if (!p) return;
        setStreams((prev) => {
          const s = prev[p.peer] ?? new MediaStream();
          if (!s.getTracks().includes(e.track)) s.addTrack(e.track);
          return { ...prev, [p.peer]: s };
        });
      };
      await run(async () => {
        const created = await api("new");
        session.current = created.sessionId ?? null;
        if (!session.current) throw new Error("Keine Sitzung erhalten.");
        const trs = media.getTracks().map((t) => conn.addTransceiver(t, { direction: "sendonly" }));
        await conn.setLocalDescription(await conn.createOffer());
        const names = { audio: name("a"), video: video ? name("v") : undefined };
        const res = await api("tracks", {
          sessionDescription: { type: "offer", sdp: conn.localDescription!.sdp },
          tracks: trs.map((tr) => ({ location: "local", mid: tr.mid, trackName: tr.sender.track!.kind === "audio" ? names.audio : names.video })),
        });
        await conn.setRemoteDescription(res.sessionDescription!);
        tracks.current = names;
      });
      setLocal(media);
      setCam(video);
      setMic(true);
      setPhase("on");
    } catch (e) {
      leaveNow();
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Mikro/Kamera nicht erlaubt – bitte im Browser freigeben." : e instanceof Error ? e.message : "Sprachchat ging nicht.");
      setPhase("off");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, api, run]);

  const leaveNow = () => {
    pc.current?.close();
    pc.current = null;
    local?.getTracks().forEach((t) => t.stop());
    if (session.current) announce({ type: "call", session: null });
    session.current = null;
    pulled.current = [];
    tracks.current = {};
    setLocal(null);
    setStreams({});
  };
  const leave = useCallback(() => { leaveNow(); setPhase("off"); }, // eslint-disable-next-line react-hooks/exhaustive-deps
    [local, announce]);

  // Mikro/Kamera schalten (in der Werwolf-Nacht ist das Mikro zwangsweise aus)
  useEffect(() => {
    local?.getAudioTracks().forEach((t) => { t.enabled = micOn; });
    local?.getVideoTracks().forEach((t) => { t.enabled = cam; });
    if (phase === "on") say(micOn, cam);
  }, [local, micOn, cam, phase, say]);

  // Nach einem Verbindungsabbruch meldet sich das Handy wieder im Chat an
  useEffect(() => {
    if (phase === "on" && me && session.current && !peers[me]) say(micOn, cam);
  }, [phase, me, peers, micOn, cam, say]);

  // Spuren der anderen abholen (neue) bzw. vergessen (wer gegangen ist)
  useEffect(() => {
    const conn = pc.current;
    if (phase !== "on" || !conn || !me) return;
    const want: Omit<Pulled, "mid">[] = [];
    for (const [peer, p] of Object.entries(peers)) {
      if (peer === me) continue;
      for (const track of [p.audio, p.video]) if (track) want.push({ peer, session: p.session, track });
    }
    const key = (x: { session: string; track: string }) => `${x.session}/${x.track}`;
    const have = new Set(pulled.current.map(key));
    const add = want.filter((w) => !have.has(key(w)));
    const gone = pulled.current.filter((p) => !want.some((w) => key(w) === key(p)));
    if (gone.length) {
      pulled.current = pulled.current.filter((p) => !gone.includes(p));
      setStreams((prev) => {
        const next = { ...prev };
        for (const g of gone) if (!want.some((w) => w.peer === g.peer)) delete next[g.peer];
        return next;
      });
      const mids = gone.map((g) => g.mid).filter(Boolean);
      if (mids.length) void run(() => api("close", { tracks: mids.map((mid) => ({ mid })), force: true })).catch(() => {});
    }
    if (!add.length) return;
    void run(async () => {
      const entries = add.map((a) => ({ ...a, mid: null as string | null }));
      pulled.current.push(...entries);
      const res = await api("tracks", { tracks: add.map((a) => ({ location: "remote", sessionId: a.session, trackName: a.track })) });
      for (const t of res.tracks ?? []) {
        const e = entries.find((x) => x.session === t.sessionId && x.track === t.trackName);
        if (e && t.mid) e.mid = t.mid;
      }
      if (res.requiresImmediateRenegotiation && res.sessionDescription) {
        await conn.setRemoteDescription(res.sessionDescription);
        await conn.setLocalDescription(await conn.createAnswer());
        await api("renegotiate", { sessionDescription: { type: "answer", sdp: conn.localDescription!.sdp } });
      }
    }).catch(() => {
      // später nochmal versuchen, sobald sich die Teilnehmer ändern
      pulled.current = pulled.current.filter((p) => !add.some((a) => key(a) === key(p)));
    });
  }, [phase, peers, me, api, run]);

  // Raum verlassen: auch den Chat sauber beenden
  useEffect(() => () => { pc.current?.close(); }, []);

  return { phase, mic, cam, micOn, error, streams, local, join, leave, setMic, setCam };
}
