import { useSyncExternalStore } from "react";

/** Kleiner gemeinsamer Zustand mit Hook – für Geräte-Einstellungen, die mehrere Stellen live mitbekommen sollen */
export function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const get = () => value;
  const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
  return {
    get,
    set(next: T) { value = next; listeners.forEach((l) => l()); },
    subscribe,
    use: (): T => useSyncExternalStore(subscribe, get),
  };
}
