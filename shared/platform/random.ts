/** Fairer Zufall aus `crypto.getRandomValues` – im Browser und im Worker gleich. */

/** Gleichverteilte Zufallszahl 0..n-1, ohne Modulo-Verzerrung (Verwerfungsmethode). */
export function randomInt(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 0x100000000) throw new RangeError("randomInt: n außerhalb des Bereichs");
  const limit = Math.floor(0x100000000 / n) * n;
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= limit);
  return a[0] % n;
}

/** Würfelt `count` sechsseitige Würfel. */
export function rollDice(count: number, sides = 6): number[] {
  return Array.from({ length: count }, () => randomInt(sides) + 1);
}

/** Mischt eine Kopie des Arrays (Fisher-Yates). */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const r = randomInt(i + 1);
    [a[i], a[r]] = [a[r], a[i]];
  }
  return a;
}
