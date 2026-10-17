import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eye, Loader2, X } from "lucide-react";
import { WATCH_ID } from "@shared/platform/protocol";
import { Button } from "@/components/ui/button";
import { RoomScreen } from "@/platform/RoomScreen";
import { Boundary } from "@/platform/Boundary";
import { adminToken } from "@/lib/admin";
import { useWatch } from "@/hooks/useWatch";
import { gameName } from "./shared";

/** Vollbild über der Verwaltung: der Raum so, wie ihn ein Gast sieht – nichts lässt sich bedienen */
export function WatchView({ code, onClose }: { code: string; onClose: () => void }) {
  const { state, online, chat, status } = useWatch(`/api/admin/rooms/${code}/watch?t=${encodeURIComponent(adminToken() ?? "")}`);
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
