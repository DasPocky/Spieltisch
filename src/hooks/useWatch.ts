import { useCallback, useEffect, useRef, useState } from "react";
import { PING, PONG, type CallPeer, type RemoteCmd, type ChatMsg, type ClientMessage, type ServerMessage } from "@shared/platform/protocol";
import type { RoomState } from "@shared/platform/room";
import { wsUrl } from "@/lib/storage";
import { noteServerBuild } from "@/lib/update";

export type WatchStatus = "connecting" | "live" | "closed";

/**
 * Zuschauen: eigene Verbindung, die nur liest – im Raum taucht niemand auf. Die Verwaltung meldet sich über die Adresse an,
 * der Große Tisch schickt nach dem Verbinden `hello` (PIN). Eine abgelehnte Anmeldung beendet das Zuschauen (`error`).
 */
export function useWatch(path: string, hello?: ClientMessage) {
  const [state, setState] = useState<RoomState | null>(null);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<WatchStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  /** Letzter Befehl der Fernbedienung (Großer Tisch); `n` zählt, damit gleiche Befehle hintereinander ankommen */
  const [remote, setRemote] = useState<{ cmd: RemoteCmd; by: string; n: number } | null>(null);
  /** Großer Tisch: Reaktionen der letzten Sekunden (Emoji am Platz) */
  const [reacts, setReacts] = useState<{ id: number; from: string; emoji: string }[]>([]);
  /** Videochat: wer welche Spuren hat (Großer Tisch zeigt die Videos an den Plätzen) */
  const [call, setCall] = useState<Record<string, CallPeer>>({});
  /** Großer Tisch: Schlüssel für den Videochat vom Server */
  const [tableKey, setTableKey] = useState<string | null>(null);
  const sock = useRef<WebSocket | null>(null);
  const tries = useRef(0);
  const first = useRef(hello);
  first.current = hello;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const connect = () => {
      ws = new WebSocket(wsUrl(path));
      sock.current = ws;
      ws.onopen = () => {
        tries.current = 0;
        if (first.current) ws?.send(JSON.stringify(first.current));
        ping = setInterval(() => { try { ws?.send(PING); } catch { /* egal */ } }, 4000);
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string" || ev.data === PONG) return;
        let msg: ServerMessage;
        try { msg = JSON.parse(ev.data) as ServerMessage; } catch { return; }
        if (msg.type === "hello") noteServerBuild(msg.build, msg.protocol);
        else if (msg.type === "state") { setState(msg.state); setOnline(new Set(msg.online)); setCall(msg.call ?? {}); setStatus("live"); }
        else if (msg.type === "tableKey") setTableKey(msg.key);
        else if (msg.type === "chat") setChat((prev) => (msg.append ? [...prev, ...msg.messages].slice(-100) : msg.messages));
        else if (msg.type === "react") {
          const id = Date.now() + Math.random();
          setReacts((r) => [...r.slice(-11), { id, from: msg.from, emoji: msg.emoji }]);
          setTimeout(() => setReacts((r) => r.filter((x) => x.id !== id)), 2600);
        }
        else if (msg.type === "remote") setRemote((r) => ({ cmd: msg.cmd, by: msg.by, n: (r?.n ?? 0) + 1 }));
        else if (msg.type === "error" && msg.fatal) { done = true; setError(msg.message); setStatus("closed"); }
      };
      ws.onclose = (ev) => {
        clearInterval(ping);
        if (done || ev.code === 4410 || ev.code === 4404) { setStatus("closed"); return; }
        // Funkloch oder Neustart: ruhig neu verbinden, nach ein paar Fehlschlägen aufgeben
        if (++tries.current > 6) { setStatus("closed"); return; }
        setStatus("connecting");
        retry = setTimeout(connect, Math.min(8000, 800 * 2 ** tries.current));
      };
    };
    connect();
    return () => {
      done = true;
      clearInterval(ping); clearTimeout(retry);
      if (ws) { ws.onclose = null; try { ws.close(); } catch { /* egal */ } }
    };
  }, [path]);

  /** Großer Tisch: Couch-Kamera im Videochat an- oder abmelden (der Server nimmt vom Tisch nur das an) */
  const announce = useCallback((m: Extract<ClientMessage, { type: "call" }>) => {
    try { if (sock.current?.readyState === WebSocket.OPEN) sock.current.send(JSON.stringify(m)); } catch { /* weg */ }
  }, []);

  return { state, online, chat, status, error, remote, reacts, call, tableKey, announce };
}
