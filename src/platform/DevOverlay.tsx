import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bug } from "lucide-react";
import { BUILD } from "@shared/build";
import { diag, netDown, netDownUntil, useDev } from "@/lib/dev";

/** Entwickler-Modus: kleine Diagnose-Anzeige oben links – Netz, Raum-Verbindung, Antwortzeit, Version, Fenster */
export function DevOverlay() {
  const d = useDev();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!d.overlay) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [d.overlay]);
  if (!d.overlay) return null;
  const gap = netDown() ? Math.ceil((netDownUntil() - Date.now()) / 1000) : 0;
  const net = gap ? `Funkloch ${gap} s` : navigator.onLine ? "online" : "offline";
  const age = diag.lastMessage ? Math.round((Date.now() - diag.lastMessage) / 1000) : null;
  return createPortal(
    <div className="pointer-events-none fixed top-[max(0.25rem,env(safe-area-inset-top))] left-1 z-[100] max-w-[60vw] rounded-lg bg-black/70 px-2 py-1 font-mono text-[10px] leading-tight text-white" data-testid="dev-overlay" aria-hidden>
      <div className="flex items-center gap-1 font-semibold"><Bug className="size-3" />{BUILD.sha.slice(0, 7)} · {window.innerWidth}×{window.innerHeight}</div>
      <div>Netz: <span className={gap || !navigator.onLine ? "text-red-300" : "text-green-300"}>{net}</span>{d.delay ? ` · +${d.delay} ms` : ""}</div>
      {diag.room && <div>Raum {diag.room}: {diag.socket}{diag.rtt !== null ? ` · ${diag.rtt} ms` : ""}{age !== null ? ` · vor ${age} s` : ""}</div>}
      <div className="truncate">{location.pathname}</div>
    </div>,
    document.body,
  );
}
