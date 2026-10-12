import { useSyncExternalStore } from "react";
import type { Throw } from "./physics";

/**
 * Die Geste des Werfenden (Kraft, Richtung) für den nächsten Wurf merken. Der Würfeltisch holt sie ab,
 * sobald der neue Wurf ankommt. Die Geste ändert nur die Flugbahn – das Ergebnis bleibt fairer Zufall.
 */
let pending: { how: Throw; at: number } | null = null;

export function setThrow(how: Throw) {
  pending = { how, at: Date.now() };
}

/** Geste abholen (nur wenn frisch – ein Wurf vom anderen Handy kommt ohne) */
export function takeThrow(): Throw | null {
  const p = pending;
  pending = null;
  return p && Date.now() - p.at < 4000 ? p.how : null;
}

/**
 * Würfeln gesperrt, solange ein Wurf unterwegs ist: vom Tippen, bis die Antwort da ist, und solange die Würfel
 * fliegen. So würfelt ein Doppeltipp nicht zweimal, und niemand wirft nach, bevor er das Ergebnis gesehen hat.
 */
let waitUntil = 0;
let flying = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let timer: ReturnType<typeof setTimeout> | undefined;

/** Gerade getippt: bis der Wurf ankommt (höchstens ein paar Sekunden, falls er abgelehnt wird) */
export function beginRoll(ms = 2500) {
  waitUntil = Date.now() + ms;
  clearTimeout(timer);
  timer = setTimeout(emit, ms + 20);
  emit();
}

/** Der Würfeltisch meldet: Wurf angekommen und fliegt (true) bzw. liegt (false) */
export function setFlying(on: boolean) {
  flying = on;
  waitUntil = 0;
  emit();
}

export const isRolling = () => flying || Date.now() < waitUntil;

export function useRolling(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, isRolling, () => false);
}
