import { useSyncExternalStore } from "react";

/** "simple": große Tasten, wenig Text. "full": alle Tasten und Infos. Gilt pro Gerät. */
export type ViewMode = "simple" | "full";

const KEY = "spieltisch:view";
const listeners = new Set<() => void>();

function read(): ViewMode {
  try { return localStorage.getItem(KEY) === "full" ? "full" : "simple"; } catch { return "simple"; }
}

let current: ViewMode = read();

export function setViewMode(mode: ViewMode) {
  current = mode;
  try { localStorage.setItem(KEY, mode); } catch { /* egal */ }
  listeners.forEach((l) => l());
}

export function useViewMode(): ViewMode {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
  );
}
