/** Gemerkte Spiele – pro Gerät, für Spielauswahl und Partyabend-Planer */
import { useSyncExternalStore } from "react";
import { readJSON, writeJSON } from "./storage";

export const FAVORITES_KEY = "spieltisch:favorites";

const listeners = new Set<() => void>();
let current: string[] | null = null;

function load(): string[] {
  if (current) return current;
  const raw = readJSON<unknown>(FAVORITES_KEY);
  current = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  return current;
}

export function favorites(): string[] { return load(); }

/** Merken bzw. nicht mehr merken */
export function toggleFavorite(id: string) {
  const f = load();
  current = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
  writeJSON(FAVORITES_KEY, current);
  for (const l of listeners) l();
}

export function useFavorites(): string[] {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, load, load);
}

/** Gemerkte Spiele nach vorn, sonst bleibt die Reihenfolge */
export function favoritesFirst(ids: string[], fav: readonly string[]): string[] {
  return [...ids.filter((id) => fav.includes(id)), ...ids.filter((id) => !fav.includes(id))];
}
