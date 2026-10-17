import { describe, expect, it } from "vitest";
import { GAME_MODES, modeAllowed, modeState, sanitizeModes, TABLE_GAMES } from "@shared/platform/modes";
import { GAMES } from "@shared/games";

describe("Spielweisen je Spiel", () => {
  it("nur bekannte Spiele und Spielweisen, nur Abweichungen werden gespeichert", () => {
    expect(sanitizeModes({ uno: { table: "beta", desk: "on" }, maumau: { table: "on" }, gibtsnicht: { table: "off" }, schamlos: { table: "quatsch" } }))
      .toEqual({ uno: { table: "beta" } });
  });
  it("Zustand: eingebaut, von der Verwaltung überschrieben, „none“ wenn das Spiel es nicht kann", () => {
    expect(modeState({}, "uno", "table")).toBe("on");
    expect(modeState({ uno: { table: "off" } }, "uno", "table")).toBe("off");
    expect(modeState({}, "kniffel", "table")).toBe("none");
    expect(modeState({}, "uno", "stage")).toBe("none");
  });
  it("Beta nur für Geräte der Verwaltung", () => {
    const m = { uno: { table: "beta" as const } };
    expect(modeAllowed(m, "uno", "table", false)).toBe(false);
    expect(modeAllowed(m, "uno", "table", true)).toBe(true);
    expect(modeAllowed({ uno: { table: "off" } }, "uno", "table", true)).toBe(false);
  });
  it("Tisch-Spiele sind echte Spiele", () => {
    expect(TABLE_GAMES).toEqual(["maumau", "uno", "schamlos"]);
    for (const id of Object.keys(GAME_MODES)) expect(id in GAMES).toBe(true);
  });
});
