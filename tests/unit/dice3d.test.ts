import { describe, expect, it } from "vitest";
import { FACES, flatness, labelFaces, seedOf, simulate, topValue } from "../../src/platform/dice3d/physics";

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

describe("3D-Würfel", () => {
  it("Grundbelegung wie echte Würfel: gegenüber 7, 1-2-3 rechtsdrehend", () => {
    for (const [a, v] of FACES) {
      const opp = FACES.find(([b]) => dot(a, b) === -1)!;
      expect(v + opp[1]).toBe(7);
    }
    const at = (v: number) => FACES.find(([, x]) => x === v)![0];
    expect(dot(cross(at(1), at(2)), at(3))).toBe(1);
  });

  it("Physik: die gewürfelte Zahl liegt oben, flach, Belegung bleibt echt", () => {
    let seed = 1;
    for (let r = 0; r < 120; r++) {
      const n = 1 + (r % 6);
      const values = Array.from({ length: n }, (_, i) => ((r * 7 + i * 3) % 6) + 1);
      const frames = simulate(n, Array(n).fill(null), seedOf(`wurf-${seed++}`), 3.4, 1.6);
      const last = frames.at(-1)!;
      last.forEach((p, i) => {
        expect(flatness(p)).toBeGreaterThan(0.99);
        const faces = labelFaces(p, values[i]);
        expect(topValue(p, faces)).toBe(values[i]);
        for (const f of faces) expect(faces.find((g) => dot(g.n, f.n) === -1)!.value + f.value).toBe(7);
        const at = (v: number) => faces.find((f) => f.value === v)!.n;
        expect(dot(cross(at(1), at(2)), at(3))).toBe(1);
        // Würfel bleiben im Tisch
        expect(Math.abs(p[0])).toBeLessThan(3.4);
        expect(Math.abs(p[2])).toBeLessThan(1.6);
      });
    }
  });

  it("Gehaltene Würfel bleiben exakt liegen", () => {
    const first = simulate(5, Array(5).fill(null), 42, 3.4, 1.6).at(-1)!;
    const rest = first.map((p, i) => (i < 2 ? p : null));
    const second = simulate(5, rest, 43, 3.4, 1.6).at(-1)!;
    expect(second[0]).toEqual(first[0]);
    expect(second[1]).toEqual(first[1]);
  });

  it("Gleicher Wurf-Schlüssel, gleiche Bahn (Neuladen sieht gleich aus)", () => {
    const a = simulate(3, [null, null, null], seedOf("x"), 3, 1.5).at(-1);
    const b = simulate(3, [null, null, null], seedOf("x"), 3, 1.5).at(-1);
    expect(a).toEqual(b);
  });
});
