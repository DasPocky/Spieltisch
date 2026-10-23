import { describe, expect, it } from "vitest";
import { BASE, stripBase, withBase } from "@shared/platform/base";

describe("Basispfad", () => {
  it("ohne Basispfad ändert sich nichts (heutiger Stand)", () => {
    expect(BASE).toBe("");
    expect(withBase("/api/config")).toBe("/api/config");
    expect(stripBase("/r/ABCDE")).toBe("/r/ABCDE");
  });

  it("mit Basispfad: davor und wieder weg, nie doppelt", () => {
    const b = "/spieltisch";
    expect(withBase("/api/config", b)).toBe("/spieltisch/api/config");
    expect(withBase("/", b)).toBe("/spieltisch/");
    expect(withBase("/spieltisch/r/ABCDE", b)).toBe("/spieltisch/r/ABCDE");
    expect(withBase("/spieltischabend", b)).toBe("/spieltisch/spieltischabend");
    expect(withBase("https://example.org/x", b)).toBe("https://example.org/x");
    expect(withBase("//cdn/x", b)).toBe("//cdn/x");
    expect(stripBase("/spieltisch/r/ABCDE", b)).toBe("/r/ABCDE");
    expect(stripBase("/spieltisch", b)).toBe("/");
    expect(stripBase("/spieltisch/", b)).toBe("/");
    expect(stripBase("/spieltischabend", b)).toBe("/spieltischabend");
    expect(stripBase("/r/ABCDE", b)).toBe("/r/ABCDE");
  });
});
