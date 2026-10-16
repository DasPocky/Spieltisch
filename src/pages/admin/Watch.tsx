import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eye, Loader2, X } from "lucide-react";
import { PING, WATCH_ID, type ChatMsg, type ServerMessage } from "@shared/platform/protocol";
import type { RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { RoomScreen } from "@/platform/RoomScreen";
import { adminToken } from "./context";
import { gameName } from "./shared";

type WatchStatus = "connecting" | "live" | "closed";

/** Unsichtbar zuschauen: eigene Verbindung, die nur liest – im Raum taucht niemand auf */
function useWatch(code: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<WatchStatus>("connecting");
  const tries = useRef(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/api/admin/rooms/${code}/watch?t=${encodeURIComponent(adminToken() ?? "")}`);
      ws.onopen = () => {
        tries.current = 0;
        ping = setInterval(() => { try { ws?.send(PING); } catch { /* egal */ } }, 4000);
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string" || ev.data === "pong") return;
        let msg: ServerMessage;
        try { msg = JSON.parse(ev.data) as ServerMessage; } catch { return; }
        if (msg.type === "state") { setState(msg.state); setOnline(new Set(msg.online)); setStatus("live"); }
        else if (msg.type === "chat") setChat((prev) => (msg.append ? [...prev, ...msg.messages].slice(-100) : msg.messages));
        else if (msg.type === "error" && msg.fatal) { done = true; setStatus("closed"); }
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
  }, [code]);

  return { state, online, chat, status };
}

/** Vollbild über der Verwaltung: der Raum so, wie ihn ein Gast sieht – nichts lässt sich bedienen */
export function WatchView({ code, onClose }: { code: string; onClose: () => void }) {
  const { state, online, chat, status } = useWatch(code);
  // Über die ganze Seite (auch über die Tab-Leiste) – deshalb direkt in <body>
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="admin-watch">
      <div className="flex shrink-0 items-center gap-2 bg-primary/12 px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-sm font-semibold text-primary">
        <Eye className="size-4" />
        <span className="min-w-0 flex-1 truncate">Zuschauen · <span className="tracking-wider">{code}</span>{state ? ` · ${gameName(state.gameId)}` : ""}{status === "connecting" && state ? " · verbindet …" : ""}</span>
        <Button size="sm" variant="ghost" className="-mr-1 h-8 text-primary" onClick={onClose} aria-label="Zuschauen beenden"><X />Beenden</Button>
      </div>
      <div className="pointer-events-none relative flex min-h-0 flex-1 flex-col overflow-hidden select-none" inert>
        {status === "closed" && !state && <Center>Der Raum ist nicht (mehr) erreichbar.</Center>}
        {status === "closed" && state && <Center>Der Raum wurde geschlossen.</Center>}
        {status !== "closed" && !state && <Center><Loader2 className="mx-auto size-6 animate-spin" /></Center>}
        {status !== "closed" && state && (
          <Boundary fallback={<Center>Dieses Spiel lässt sich hier nicht anzeigen.</Center>}>
            <RoomScreen room={state} me={WATCH_ID} online={online} code={code} dispatch={() => undefined} onLeave={onClose} chat={{ messages: chat, say: () => undefined }} />
          </Boundary>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="grid flex-1 place-items-center p-6 text-center text-muted-foreground">{children}</div>;
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
