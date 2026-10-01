import { useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";

/** true erst, wenn `on` länger als `ms` anhält – kurze Wackler sollen nicht flackern */
function useDelayed(on: boolean, ms: number) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) { setShown(false); return; }
    const t = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return shown;
}

/** Zeigt ruhig an, wenn die Verbindung wackelt oder ein Zug noch unterwegs ist */
export function ConnectionBar({ reconnecting, pending }: { reconnecting: boolean; pending: number }) {
  const lost = useDelayed(reconnecting, 1200);
  const slow = useDelayed(pending > 0 && !reconnecting, 900);
  if (lost) {
    return (
      <div role="status" className="text-in mb-2 flex shrink-0 items-center gap-2 rounded-xl bg-destructive/12 px-3 py-2 text-sm text-destructive">
        <WifiOff className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 leading-snug">Verbindung wackelt – wird wiederhergestellt.{pending > 0 && " Dein Zug wird nachgereicht."}</span>
        <Loader2 className="size-4 shrink-0 animate-spin" />
      </div>
    );
  }
  if (slow) {
    return (
      <div role="status" className="text-in pointer-events-none fixed top-[calc(0.75rem+env(safe-area-inset-top))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground/85 px-3 py-1 text-xs font-semibold text-background shadow-lg">
        <Loader2 className="size-3.5 animate-spin" />Wird gesendet …
      </div>
    );
  }
  return null;
}
