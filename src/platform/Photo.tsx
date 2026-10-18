import { useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shrinkPhoto } from "@/lib/photo";
import { cn } from "@/lib/utils";

/** Datei wählen (am Handy: Frontkamera), verkleinern, schicken – Fehler als kurze Meldung */
function usePhotoPick(onPhoto: (data: string) => void) {
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try { onPhoto(await shrinkPhoto(file)); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  return { busy, pick };
}

/** Eigenes Foto statt Tier: Kamera (vorn) oder Galerie, wird vorher verkleinert. Sehen nur Leute in diesem Raum. */
export function PhotoRow({ has, onPhoto }: { has: boolean; onPhoto: (data: string | null) => void }) {
  const { busy, pick } = usePhotoPick(onPhoto);
  return (
    <div className="grid gap-1.5" data-testid="photo-row">
      <div className="flex gap-2">
        <label className={cn("inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary font-semibold text-secondary-foreground ring-1 ring-inset ring-border transition focus-within:ring-[3px] focus-within:ring-ring", busy && "opacity-60")}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}{has ? "Neues Foto" : "Foto statt Tier"}
          <input type="file" accept="image/*" capture="user" className="sr-only" disabled={busy} data-testid="photo-input"
            onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {has && <Button variant="ghost" className="h-11" onClick={() => onPhoto(null)} aria-label="Foto entfernen"><Trash2 />Entfernen</Button>}
      </div>
      <p className="px-1 text-xs text-muted-foreground">Sehen nur die Leute in diesem Raum – endet der Raum, ist es weg.</p>
    </div>
  );
}

/** Kleiner Kamera-Knopf (z. B. auf der eigenen Kachel im Treffpunkt) */
export function PhotoButton({ onPhoto, className }: { onPhoto: (data: string) => void; className?: string }) {
  const { busy, pick } = usePhotoPick(onPhoto);
  return (
    <label className={cn("grid size-9 cursor-pointer place-items-center rounded-full bg-black/55 text-white transition focus-within:ring-[3px] focus-within:ring-ring", className)}
      title="Foto statt Tier" data-testid="photo-button">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
      <input type="file" accept="image/*" capture="user" className="sr-only" disabled={busy} aria-label="Foto statt Tier"
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
}
