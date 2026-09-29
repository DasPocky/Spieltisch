import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { readJSON, writeJSON } from "@/lib/storage";

const HIDE_KEY = "spieltisch:install-hint";

/** Das Ereignis, mit dem Chrome/Android das Installieren anbietet */
interface InstallPrompt extends Event { prompt: () => Promise<void> }

let deferred: InstallPrompt | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallPrompt; });
}

const standalone = () =>
  typeof window !== "undefined" &&
  (matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Kleiner Hinweis auf der Startseite: Spieltisch als App auf den Home-Bildschirm legen.
 * Android/Chrome: Knopf zum Installieren. iPhone: kurze Anleitung über „Teilen“. Lässt sich wegklicken.
 */
export function InstallHint() {
  const [hidden, setHidden] = useState(() => standalone() || readJSON<boolean>(HIDE_KEY) === true);
  const [canPrompt, setCanPrompt] = useState(() => !!deferred);

  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); deferred = e as InstallPrompt; setCanPrompt(true); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  if (hidden || (!canPrompt && !isIOS())) return null;
  const hide = () => { writeJSON(HIDE_KEY, true); setHidden(true); };

  return (
    <div className="glass mt-3 flex shrink-0 items-center gap-2.5 rounded-2xl py-2 pr-1.5 pl-3 text-sm" data-testid="install-hint">
      {canPrompt ? (
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left font-semibold"
          onClick={async () => { await deferred?.prompt(); deferred = null; hide(); }}>
          <Download className="size-4 shrink-0 text-navy-300" />Als App auf den Home-Bildschirm
        </button>
      ) : (
        <span className="min-w-0 flex-1 leading-snug text-muted-foreground">
          Als App: <Share className="inline size-4 align-[-3px] text-navy-300" /> <b className="text-foreground">Teilen</b> → <b className="text-foreground">Zum Home-Bildschirm</b>
        </span>
      )}
      <button type="button" onClick={hide} aria-label="Hinweis ausblenden" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
