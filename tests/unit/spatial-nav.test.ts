import { describe, expect, it } from "vitest";
import { nextInDirection } from "../../src/lib/spatialNav";

const rect = (left: number, top: number, w = 100, h = 40) => ({ left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
const el = (name: string) => ({ name }) as unknown as HTMLElement;

describe("Pfeiltasten-Steuerung", () => {
  // Raster: a b
  //         c d
  //             e (weit unten rechts)
  const a = el("a"), b = el("b"), c = el("c"), d = el("d"), e = el("e");
  const all = [{ el: a, r: rect(0, 0) }, { el: b, r: rect(200, 0) }, { el: c, r: rect(0, 100) }, { el: d, r: rect(200, 100) }, { el: e, r: rect(400, 400) }];
  const from = (x: HTMLElement) => all.find((i) => i.el === x)!.r;
  const others = (x: HTMLElement) => all.filter((i) => i.el !== x);

  it("springt in der gedrückten Richtung zum nächsten Element", () => {
    expect(nextInDirection(from(a), "ArrowRight", others(a))).toBe(b);
    expect(nextInDirection(from(a), "ArrowDown", others(a))).toBe(c);
    expect(nextInDirection(from(d), "ArrowLeft", others(d))).toBe(c);
    expect(nextInDirection(from(d), "ArrowUp", others(d))).toBe(b);
  });
  it("bevorzugt dieselbe Linie, und am Rand gibt es kein Ziel", () => {
    expect(nextInDirection(from(c), "ArrowRight", others(c))).toBe(d);
    expect(nextInDirection(from(a), "ArrowUp", others(a))).toBeNull();
    expect(nextInDirection(from(a), "ArrowLeft", others(a))).toBeNull();
  });
  it("ohne Fokus: das erste Element", () => {
    expect(nextInDirection(null, "ArrowDown", all)).toBe(a);
  });
});
