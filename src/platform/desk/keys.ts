import { useEffect, useRef } from "react";

/**
 * Tastatur am Rechner für ein Spiel: ein Handler für die ganze Seite, Eingaben in Textfeldern (Chat) bleiben unberührt.
 * Der Handler darf sich bei jedem Zeichnen ändern – angemeldet wird nur einmal.
 */
export function useDeskKeys(onKey: (e: KeyboardEvent) => void) {
  const latest = useRef(onKey);
  latest.current = onKey;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      latest.current(e);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
}
