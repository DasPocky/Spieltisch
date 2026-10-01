import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** QR-Code als SVG. Die kleine Bibliothek wird erst geladen, wenn ein Code gebraucht wird. */
export function QrCode({ value, className, label = "QR-Code" }: { value: string; className?: string; label?: string }) {
  const [path, setPath] = useState<{ d: string; n: number } | null>(null);
  useEffect(() => {
    let on = true;
    void import("qrcode-generator").then(({ default: qrcode }) => {
      const qr = qrcode(0, "M");
      qr.addData(value);
      qr.make();
      const n = qr.getModuleCount();
      let d = "";
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      if (on) setPath({ d, n });
    });
    return () => { on = false; };
  }, [value]);
  // Immer dunkel auf Weiß mit Rand – so lesen es alle Kameras, auch im dunklen Modus
  return (
    <div className={cn("aspect-square rounded-xl bg-white p-3", className)} role="img" aria-label={label} data-testid="qr">
      {path && (
        <svg viewBox={`0 0 ${path.n} ${path.n}`} className="size-full" shapeRendering="crispEdges">
          <path d={path.d} fill="#0f1a2e" />
        </svg>
      )}
    </div>
  );
}
