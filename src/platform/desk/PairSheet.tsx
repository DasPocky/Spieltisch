import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { QrCode } from "@/platform/QrCode";

/**
 * Am Rechner: Handy als Begleiter koppeln – QR-Code mit einem kurzen Einmal-Code (5 Minuten).
 * Das Handy wird zweites Gerät desselben Spielers: Kamera und Mikro, Chat, die eigenen Karten.
 */
export function PairButton({ code, onPair, pairing }: { code: string; onPair: () => void; pairing: { code: string; until: number } | null }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!open) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [open]);
  const valid = pairing && pairing.until > now;
  // Beim Öffnen und nach Ablauf einen frischen Code holen (nur eine Anfrage, bis die Antwort da ist)
  const asked = useRef(0);
  useEffect(() => {
    if (!open || valid || Date.now() - asked.current < 5000) return;
    asked.current = Date.now();
    onPair();
  }, [open, valid, onPair]);
  const link = valid ? `${location.origin}/r/${code}#pair=${pairing!.code}` : "";
  const left = valid ? Math.ceil((pairing!.until - now) / 1000) : 0;
  return (
    <>
      <Button variant="secondary" size="sm" className="hidden lg:inline-flex" data-testid="pair-open" onClick={() => setOpen(true)}><Smartphone className="size-4" />Handy koppeln</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Handy als Begleiter</SheetTitle>
            <SheetDescription>Scanne den Code mit dem Handy: Es wird zur Kamera und zum Mikro, zeigt den Chat und – wenn du magst – deine Karten.</SheetDescription>
          </SheetHeader>
          <div className="grid place-items-center gap-3 px-5 pt-2 pb-6" data-testid="pair-sheet">
            {valid ? (
              <>
                <div className="rounded-2xl bg-white p-3"><QrCode value={link} className="size-56" label="QR-Code zum Koppeln" /></div>
                <p className="text-sm text-muted-foreground">Gilt noch {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} Minuten und nur einmal.</p>
                <code className="hidden" data-testid="pair-link">{link}</code>
              </>
            ) : <p className="text-muted-foreground">Code wird erstellt …</p>}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
