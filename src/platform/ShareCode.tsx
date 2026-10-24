import { withBase } from "@shared/platform/base";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Raumcode groß anzeigen und Link teilen. Die PIN gehört bewusst nicht in den Link. `compact`: eine schmale Zeile (Lobby). */
export function ShareCode({ code, gameName, compact }: { code: string; gameName?: string; compact?: boolean }) {
  const url = `${location.origin}${withBase(`/r/${code}`)}`;
  const share = async () => {
    try {
      // Kurz und klar: wer einlädt, was gespielt wird, wie man reinkommt – die PIN sagt der Host selbst
      const text = `🎲 Spielst du mit${gameName ? ` ${gameName}` : ""}? Tipp auf den Link oder gib im Spieltisch den Raumcode ${code} ein. Die PIN bekommst du vom Host.`;
      if (navigator.share) { await navigator.share({ title: `Spieltisch – Raum ${code}`, text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast("Einladung kopiert");
    } catch { /* abgebrochen */ }
  };
  if (compact) return (
    <div className="glass flex items-center gap-3 rounded-2xl py-2 pr-2 pl-4" data-testid="invite-row">
      <div className="min-w-0 flex-1 truncate text-sm">
        <span className="text-muted-foreground">Raumcode </span>
        <span className="font-bold tracking-[0.18em] tabular-nums" data-testid="room-code">{code}</span>
      </div>
      <Button size="sm" variant="secondary" className="shrink-0" onClick={share}><Share2 />Einladen</Button>
    </div>
  );
  return (
    <div className="flex items-center justify-between gap-3 glass rounded-2xl px-4 py-3">
      <div>
        <div className="text-xs text-muted-foreground">Raumcode</div>
        <div className="text-2xl font-bold tracking-[0.18em] tabular-nums" data-testid="room-code">{code}</div>
      </div>
      <Button onClick={share}><Share2 />Einladen</Button>
    </div>
  );
}
