import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shrinkPhoto } from "@/lib/photo";

/**
 * Selfie am Fernseher: die Kamera des Bildschirms (Laptop, Fernseher mit Kamera) nimmt ein Foto für einen Platz auf –
 * ohne Profil und ohne Handy. Vorschau, „Auslösen“ zählt 3-2-1, das Bild wird verkleinert wie beim Handy-Foto.
 * Ohne Kamera oder ohne Erlaubnis: kurze Meldung, „Schließen“ führt immer heraus.
 */
export function TableCamera({ name, onShot, onClose }: { name: string; onShot: (data: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  // Rückmeldungen ändern sich bei jedem Zeichnen der Seite – der Countdown soll davon nicht neu starten
  const cb = useRef({ onShot, onClose });
  cb.current = { onShot, onClose };

  useEffect(() => {
    let live: MediaStream | null = null;
    let gone = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("none");
        live = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
        if (gone) { live.getTracks().forEach((t) => t.stop()); return; }
        setStream(live);
      } catch (e) {
        setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Die Kamera ist nicht erlaubt – bitte im Browser freigeben." : "An diesem Bildschirm gibt es keine Kamera.");
      }
    })();
    return () => { gone = true; live?.getTracks().forEach((t) => t.stop()); };
  }, []);

  useEffect(() => { if (video.current && stream) video.current.srcObject = stream; }, [stream]);

  // Countdown: bei 0 auslösen
  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(() => {
      if (count > 1) { setCount(count - 1); return; }
      setCount(0);
      const v = video.current;
      if (!v || !v.videoWidth) { setError("Kein Bild von der Kamera."); return; }
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      const g = c.getContext("2d")!;
      // Spiegelbild wie in der Vorschau
      g.translate(c.width, 0); g.scale(-1, 1);
      g.drawImage(v, 0, 0);
      c.toBlob((blob) => {
        if (!blob) { setError("Das Foto ging nicht."); return; }
        shrinkPhoto(blob).then((data) => { cb.current.onShot(data); cb.current.onClose(); }, (e: Error) => setError(e.message));
      }, "image/jpeg", 0.9);
    }, 1000);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") cb.current.onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-6" role="dialog" aria-label={`Foto für ${name}`} data-testid="table-camera">
      <div className="paper-note grid w-full max-w-xl gap-4 p-6">
        <h2 className="text-2xl font-bold">Foto für {name}</h2>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#2b2118]">
          {stream && <video ref={video} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" data-testid="table-camera-video" />}
          {!stream && !error && <p className="absolute inset-0 grid place-items-center text-[#f7ecd6]">Kamera startet …</p>}
          {error && <p role="alert" className="absolute inset-0 grid place-items-center p-6 text-center font-semibold text-[#f7ecd6]">{error}</p>}
          {count > 0 && <span className="absolute inset-0 grid place-items-center text-9xl font-bold text-white drop-shadow-lg" data-testid="table-camera-count">{count}</span>}
        </div>
        <p className="text-sm text-[#6b5640]">Sehen nur die Leute in diesem Raum – endet der Raum, ist das Foto weg.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}><X className="size-4" />{error ? "Schließen" : "Abbrechen"}</Button>
          {!error && <Button className="flex-1" autoFocus disabled={!stream || count > 0} onClick={() => setCount(3)} data-testid="table-camera-shoot"><Camera className="size-4" />Auslösen</Button>}
        </div>
      </div>
    </div>
  );
}
