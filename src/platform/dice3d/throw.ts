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
