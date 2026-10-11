import { describe, expect, it } from "vitest";
import { getGame } from "@shared/games";
import { freshPile } from "@shared/games/tutto/logic";
import { defaultOptions } from "@shared/platform/room";
import { randomInt, shuffle } from "@shared/platform/random";

/** Chi-Quadrat gegen Gleichverteilung; Grenze großzügig (p ≈ 0,001), damit der Test nicht zufällig scheitert */
function chi(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0), e = total / counts.length;
  return counts.reduce((s, c) => s + (c - e) ** 2 / e, 0);
}
const CRIT: Record<number, number> = { 5: 20.5, 4: 18.5, 24: 51.2 }; // Freiheitsgrade → kritischer Wert

describe("Fairer Zufall", () => {
  it("Würfel (randomInt) gleichverteilt", () => {
    const c = Array(6).fill(0);
    for (let i = 0; i < 60000; i++) c[randomInt(6)]++;
    expect(chi(c)).toBeLessThan(CRIT[5]);
  });

  it("Mischen: jede Karte landet gleich oft an jeder Stelle, alle Reihenfolgen gleich häufig", () => {
    const pos = Array.from({ length: 5 }, () => Array(5).fill(0));
    const perms = new Map<string, number>();
    for (let i = 0; i < 48000; i++) {
      const a = shuffle([0, 1, 2, 3, 4]);
      a.forEach((v, p) => pos[v][p]++);
      if (i < 24000) { const k = a.slice(0, 4).join(""); perms.set(k, (perms.get(k) ?? 0) + 1); }
    }
    for (const row of pos) expect(chi(row)).toBeLessThan(CRIT[4]);
    // 4 Elemente aus 5: 120 Reihenfolgen – keine darf fehlen
    expect(perms.size).toBe(120);
  });

  it("Tutto-Stapel: gleiche Karten hintereinander nur so oft wie bei echtem Mischen", () => {
    const pile = freshPile({});
    const n = pile.length;
    const counts = new Map<string, number>();
    for (const c of pile) counts.set(c, (counts.get(c) ?? 0) + 1);
    // Erwartete Paare gleicher Nachbarn bei zufälliger Reihenfolge: Σ c(c−1) / N
    const expected = [...counts.values()].reduce((s, c) => s + c * (c - 1), 0) / n;
    let pairs = 0;
    const R = 4000;
    for (let r = 0; r < R; r++) { const p = freshPile({}); for (let i = 1; i < p.length; i++) if (p[i] === p[i - 1]) pairs++; }
    expect(Math.abs(pairs / R - expected) / expected).toBeLessThan(0.06);
  });

  it("Startspieler/Geber wandert reihum – jede Partie fängt jemand anderes an", () => {
    const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
    const games = ["uno", "maumau", "skipbo", "fischen", "kniffel", "tutto", "maexchen", "ludo", "phase10", "flip7", "hellseher"];
    for (const id of games) {
      const g = getGame(id);
      const starts = new Set<string>();
      for (let round = 0; round < 4; round++) {
        // Startkarten wie „Aussetzen“ verschieben den Ersten – daher je Partie der häufigste Anfänger aus 15 Versuchen
        const tally = new Map<string, number>();
        for (let k = 0; k < 15; k++) {
          const s = g.setup({ players, hostId: "a", actorId: null, options: defaultOptions(g.settings), now: 0, round }) as Record<string, unknown>;
          const who = String(s.dealerId ?? s.dealer ?? s.curId);
          tally.set(who, (tally.get(who) ?? 0) + 1);
        }
        starts.add([...tally].sort((x, y) => y[1] - x[1])[0][0]);
      }
      expect(starts.size, id).toBe(4);
    }
  });
});
