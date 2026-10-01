import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { RoomAction, RoomState } from "@shared/platform/room";
import { PING, PONG, type CallPeer, type ClientMessage, type RoomInfo, type ServerMessage } from "@shared/platform/protocol";
import { credsKey, readJSON, remove, writeJSON, type RoomCreds } from "@/lib/storage";
import { myAvatar, myProfile } from "@/lib/profile";
import { activeGroupCode } from "@/lib/group";

export type RoomStatus = "checking" | "missing" | "needsJoin" | "connecting" | "ready" | "failed" | "closed";

export interface JoinData { name: string; pin: string }

/** Herzschlag alle paar Sekunden; kommt so lange gar nichts zurück, ist die Verbindung tot */
const PING_MS = 4000;
const DEAD_MS = 11_000;
/** So lange darf der Aufbau einer Verbindung dauern */
const OPEN_MS = 7000;
/** Kommt auf eine Aktion so lange keine Bestätigung, wird neu verbunden und nochmal geschickt */
const ACK_MS = 6000;
/** Ältere, nie angekommene Aktionen verwerfen – sie passen dann meist nicht mehr zum Spielstand */
const GIVE_UP_MS = 45_000;

const rid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);

interface Pending { id: string; msg: ClientMessage; created: number; sent: number | null }

/**
 * Verbindet sich per WebSocket mit einem Spielraum, tritt bei und hält den Spielstand aktuell.
 * Gemacht für wackeliges Handy-Netz:
 * - Herzschlag erkennt tote Verbindungen in Sekunden (statt nie), dann sofort neu verbinden.
 * - Aktionen kommen in einen Ausgang und werden nach dem Wiederverbinden nachgereicht.
 *   Jede hat eine ID – der Server führt sie auch bei doppeltem Senden nur einmal aus.
 * - Wird das Handy wieder aktiv oder ist das Netz zurück, wird sofort geprüft.
 */
export function useRoom(code: string, join: JoinData | null, attempt: number) {
  const [status, setStatus] = useState<RoomStatus>("checking");
  const [state, setState] = useState<RoomState | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [call, setCall] = useState<Record<string, CallPeer>>({});
  const [pending, setPending] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const outbox = useRef<Pending[]>([]);
  const flushRef = useRef<() => void>(() => {});
  const hostRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let joined = false;
    let lastSeen = Date.now();
    let opening = 0;
    // Gleicher Wert für alle Versuche dieses Beitritts – so entsteht nie ein zweiter Spieler
    const nonce = rid();

    const syncPending = () => setPending(outbox.current.length);

    /** Verbindung sofort verwerfen (ohne auf ein „close“ zu warten, das bei toten Verbindungen nie kommt) */
    const kill = (reconnectIn: number) => {
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
        try { ws.close(); } catch { /* egal */ }
      }
      wsRef.current = null;
      joined = false;
      for (const p of outbox.current) p.sent = null;
      if (stopped) return;
      setStatus((s) => (s === "ready" ? "connecting" : s));
      clearTimeout(timer);
      timer = setTimeout(connect, reconnectIn);
    };

    const flush = () => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !joined) return;
      const now = Date.now();
      const stale = outbox.current.filter((p) => now - p.created > GIVE_UP_MS);
      if (stale.length) {
        outbox.current = outbox.current.filter((p) => !stale.includes(p));
        toast("Ein Zug kam wegen der Verbindung nicht an – bitte nochmal.");
      }
      for (const p of outbox.current) {
        if (p.sent !== null) continue;
        try { ws.send(JSON.stringify(p.msg)); p.sent = now; } catch { /* beim nächsten Mal */ }
      }
      syncPending();
    };
    flushRef.current = flush;

    const connect = () => {
      if (stopped) return;
      clearTimeout(timer);
      setStatus((s) => (s === "ready" || s === "checking" ? "connecting" : s));
      const proto = location.protocol === "https:" ? "wss" : "ws";
      let ws: WebSocket;
      try { ws = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws`); }
      catch { timer = setTimeout(connect, 1500); return; }
      wsRef.current = ws;
      opening = Date.now();
      joined = false;

      ws.onopen = () => {
        retry = 0;
        lastSeen = Date.now();
        const creds = readJSON<RoomCreds>(credsKey(code));
        // Mit gespeichertem Zugang wiederverbinden; Name und PIN nur als Rückfall
        const msg: ClientMessage = { type: "join", ...(join ?? {}), ...(creds ?? {}), nonce, profile: myProfile().id, avatar: myAvatar(), group: activeGroupCode() ?? undefined };
        ws.send(JSON.stringify(msg));
      };

      ws.onmessage = (ev) => {
        lastSeen = Date.now();
        if (ev.data === PONG) return;
        let msg: ServerMessage;
        try { msg = JSON.parse(ev.data as string) as ServerMessage; } catch { return; }
        if (msg.type === "joined") {
          writeJSON(credsKey(code), { playerId: msg.playerId, token: msg.token } satisfies RoomCreds);
          setMe(msg.playerId);
        } else if (msg.type === "state") {
          setState(msg.state);
          setMe(msg.you);
          hostRef.current = msg.state.hostId === msg.you;
          setOnline(new Set(msg.online));
          setCall(msg.call ?? {});
          setStatus("ready");
          setError(null);
          if (!joined) { joined = true; flush(); }
        } else if (msg.type === "ack") {
          outbox.current = outbox.current.filter((p) => p.id !== msg.id);
          syncPending();
        } else if (msg.type === "error") {
          if (msg.id) { outbox.current = outbox.current.filter((p) => p.id !== msg.id); syncPending(); }
          if (msg.fatal) {
            stopped = true;
            if (msg.code === "bad_pin" || msg.code === "kicked" || msg.code === "not_joined" || msg.code === "closed") remove(credsKey(code));
            outbox.current = [];
            syncPending();
            setError(msg.message);
            setStatus(msg.code === "closed" ? "closed" : msg.code === "bad_pin" || msg.code === "rejected" || msg.code === "not_joined" ? "needsJoin" : "failed");
            ws.close();
          } else {
            toast(msg.message);
          }
        }
      };

      ws.onclose = () => { if (wsRef.current === ws) kill(Math.min(5000, 400 * 2 ** retry++)); };
      ws.onerror = () => { /* onclose folgt */ };
    };

    // Wächter: tote oder hängende Verbindungen erkennen, Herzschlag senden, Aktionen ohne Antwort neu schicken
    const watch = setInterval(() => {
      if (stopped) return;
      const ws = wsRef.current;
      const now = Date.now();
      if (!ws) return;
      if (ws.readyState === WebSocket.CONNECTING && now - opening > OPEN_MS) { kill(0); return; }
      if (ws.readyState !== WebSocket.OPEN) return;
      if (now - lastSeen > DEAD_MS) { kill(0); return; }
      if (outbox.current.some((p) => p.sent !== null && now - p.sent > ACK_MS)) { kill(0); return; }
      try { ws.send(PING); } catch { kill(0); }
    }, PING_MS);

    // Host fragt ab und zu nach, wer noch da ist – so fällt ein still verschwundenes Handy auf
    const presence = setInterval(() => {
      const ws = wsRef.current;
      if (hostRef.current && joined && ws?.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "presence" } satisfies ClientMessage)); } catch { /* egal */ }
      }
    }, 15_000);

    /** Handy wieder aktiv / Netz zurück: sofort prüfen statt auf den nächsten Versuch zu warten */
    const wake = () => {
      if (stopped || document.visibilityState === "hidden") return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) { retry = 0; kill(0); return; }
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(PING); } catch { kill(0); return; }
        // Kommt nicht gleich etwas zurück, war die Verbindung im Hintergrund gestorben
        const before = lastSeen;
        setTimeout(() => { if (!stopped && wsRef.current === ws && lastSeen === before) kill(0); }, 2500);
      }
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);

    (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(`/api/rooms/${code}`, { signal: ctrl.signal });
        clearTimeout(t);
        const data = (await res.json()) as RoomInfo;
        if (stopped) return;
        if (!data.exists) { remove(credsKey(code)); setStatus("missing"); return; }
        if (data.gameId) setGameId(data.gameId);
      } catch {
        // offline oder langsam? dann trotzdem versuchen
      }
      if (stopped) return;
      if (!join && !readJSON<RoomCreds>(credsKey(code))) { setStatus("needsJoin"); return; }
      setStatus("connecting");
      connect();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(watch);
      clearInterval(presence);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      const ws = wsRef.current;
      if (ws) { ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close(); } catch { /* egal */ } }
      wsRef.current = null;
    };
  }, [code, join, attempt]);

  /** Aktion in den Ausgang – geht sofort raus oder nach dem Wiederverbinden */
  const send = useCallback((action: RoomAction) => {
    // Doppeltipp: dieselbe Aktion kurz hintereinander nur einmal. Später gleiche Aktionen (z. B. „Weiter“
    // der Automatik) sind gewollt und gehen raus, auch wenn die vorige noch auf Bestätigung wartet.
    const key = JSON.stringify(action);
    const now = Date.now();
    if (outbox.current.some((p) => p.msg.type === "action" && now - p.created < 700 && JSON.stringify(p.msg.action) === key)) return;
    const id = rid();
    outbox.current.push({ id, msg: { type: "action", action, id }, created: Date.now(), sent: null });
    setPending(outbox.current.length);
    flushRef.current();
  }, []);
  const post = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else toast("Keine Verbindung – einen Moment.");
  }, []);
  const closeRoom = useCallback(() => post({ type: "closeRoom" }), [post]);
  const claimHost = useCallback(() => post({ type: "claimHost" }), [post]);
  /** Sprachchat an-/abmelden – still, ohne Hinweis, falls die Verbindung gerade weg ist */
  const announceCall = useCallback((msg: Extract<ClientMessage, { type: "call" }>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  return { status, state, me, online, error, gameId: state?.gameId ?? gameId, send, closeRoom, claimHost, call, announceCall, pending };
}
