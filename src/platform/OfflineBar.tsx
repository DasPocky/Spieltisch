import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

/** Kein Netz: schmaler Hinweis oben – lokale Spiele laufen weiter, nur Online-Räume brauchen Netz */
export function OfflineBar() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" data-testid="offline-bar" title="„Ein Handy für alle“ geht weiter, Online-Räume erst wieder mit Netz"
      className="pointer-events-none fixed inset-x-0 top-[calc(0.25rem+env(safe-area-inset-top))] z-50 flex justify-center">
      <span className="flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background shadow-lg">
        <WifiOff className="size-3.5" aria-hidden="true" />Kein Netz · lokal spielen geht
      </span>
    </div>
  );
}
