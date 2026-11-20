import { useEffect, useRef } from "react";

/** Welches Blatt gerade den Verlaufseintrag hält (0 = keines) */
let active = 0;
let seq = 0;
/** Ein Blatt hat beim Schließen „Zurück“ ausgelöst, das noch nicht angekommen ist */
let backPending = false;
if (typeof window !== "undefined") window.addEventListener("popstate", () => { backPending = false; });

const ensureEntry = () => {
  if (!(history.state as { sheet?: boolean } | null)?.sheet) history.pushState({ ...(history.state ?? {}), sheet: true }, "");
};

/**
 * Offenes Blatt per Zurück-Geste bzw. Zurück-Taste schließen wie in einer App:
 * Beim Öffnen kommt ein Eintrag in den Verlauf, „Zurück“ schließt das Blatt statt die Seite zu verlassen.
 * Wer aus dem Blatt heraus woanders hin will, navigiert mit `replace` – dann bleibt kein toter Eintrag zurück.
 * Öffnet sich ein Blatt, während das Zurück des vorigen noch unterwegs ist, schließt dieses es nicht:
 * Es wird übergangen und der Eintrag neu gesetzt.
 */
export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const id = ++seq;
    let skip = backPending;
    if (!skip) ensureEntry();
    active = id;
    const on = () => {
      if (skip) { skip = false; if (active === id) ensureEntry(); return; }
      if (active === id) { active = 0; closeRef.current(); }
    };
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("popstate", on);
      if (active !== id) return;
      active = 0;
      // Verzögert: Öffnet sich gleich wieder ein Blatt (z. B. doppeltes Einhängen beim Entwickeln), bleibt der Eintrag
      setTimeout(() => {
        if (active === 0 && (history.state as { sheet?: boolean } | null)?.sheet) { backPending = true; history.back(); }
      }, 0);
    };
  }, [open]);
}
