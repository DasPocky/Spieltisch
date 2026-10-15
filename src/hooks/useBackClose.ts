import { useEffect, useRef } from "react";

/** Welches Blatt gerade den Verlaufseintrag hält (0 = keines) */
let active = 0;
let seq = 0;

/**
 * Offenes Blatt per Zurück-Geste bzw. Zurück-Taste schließen wie in einer App:
 * Beim Öffnen kommt ein Eintrag in den Verlauf, „Zurück“ schließt das Blatt statt die Seite zu verlassen.
 * Wer aus dem Blatt heraus woanders hin will, navigiert mit `replace` – dann bleibt kein toter Eintrag zurück.
 */
export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const id = ++seq;
    if (!(history.state as { sheet?: boolean } | null)?.sheet) history.pushState({ ...(history.state ?? {}), sheet: true }, "");
    active = id;
    const on = () => { if (active === id) { active = 0; closeRef.current(); } };
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("popstate", on);
      if (active !== id) return;
      active = 0;
      // Verzögert: Öffnet sich gleich wieder ein Blatt (z. B. doppeltes Einhängen beim Entwickeln), bleibt der Eintrag
      setTimeout(() => { if (active === 0 && (history.state as { sheet?: boolean } | null)?.sheet) history.back(); }, 0);
    };
  }, [open]);
}
