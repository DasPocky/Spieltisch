import { afterEach, describe, expect, it, vi } from "vitest";
import { randomInt, rollDice, shuffle } from "@shared/platform/random";

afterEach(() => vi.restoreAllMocks());

describe("randomInt", () => {
  it("bleibt im Bereich 0..n-1", () => {
    for (const n of [1, 2, 3, 6, 7, 56, 1000]) {
      for (let i = 0; i < 500; i++) {
        const x = randomInt(n);
        expect(Number.isInteger(x) && x >= 0 && x < n).toBe(true);
      }
    }
  });

  it("verwirft Werte oberhalb der Grenze statt Modulo-Verzerrung", () => {
    // n = 3: Grenze ist 4294967295, der Höchstwert wird verworfen
    const values = [0xffffffff, 5];
    const spy = vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(arr: T): T => {
      (arr as unknown as Uint32Array)[0] = values.shift()!;
      return arr;
    });
    expect(randomInt(3)).toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("ist ungefähr gleichverteilt (Chi-Quadrat)", () => {
    const n = 6, rounds = 60000, counts = new Array(n).fill(0);
    for (let i = 0; i < rounds; i++) counts[randomInt(n)]++;
    const e = rounds / n;
    const chi = counts.reduce((s, c) => s + (c - e) ** 2 / e, 0);
    expect(chi).toBeLessThan(25); // 5 Freiheitsgrade, p ≈ 0,0001
  });

  it("lehnt ungültige Bereiche ab", () => {
    expect(() => randomInt(0)).toThrow();
    expect(() => randomInt(1.5)).toThrow();
  });
});

describe("rollDice / shuffle", () => {
  it("würfelt 1 bis 6", () => {
    const d = rollDice(600);
    expect(d).toHaveLength(600);
    expect(new Set(d)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("mischt ohne Karten zu verlieren", () => {
    const items = Array.from({ length: 56 }, (_, i) => i);
    const s = shuffle(items);
    expect(s).not.toBe(items);
    expect([...s].sort((a, b) => a - b)).toEqual(items);
  });
});
