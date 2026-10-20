import { describe, expect, it } from "vitest";
import { GAME_MODES, modeAllowed, modeState, sanitizeModes, TABLE_GAMES } from "@shared/platform/modes";
import { GAMES } from "@shared/games";

describe("Spielweisen je Spiel", () => {
  it("nur bekannte Spiele und Spielweisen, nur Abweichungen werden gespeichert", () => {
    expect(sanitizeModes({ eins: { table: "beta", stage: "on" }, maumau: { table: "on" }, alles: { stage: "on" }, gibtsnicht: { table: "off" }, schamlos: { table: "quatsch" } }))
      .toEqual({ eins: { table: "beta", stage: "on" } });
  });
  it("Zustand: eingebaut, von der Verwaltung überschrieben, „none“ wenn das Spiel es nicht kann", () => {
    expect(modeState({}, "eins", "table")).toBe("on");
    expect(modeState({ eins: { table: "off" } }, "eins", "table")).toBe("off");
    expect(modeState({}, "fuenfwuerfel", "table")).toBe("on");
    expect(modeState({}, "fuenfwuerfel", "stage")).toBe("beta");
    expect(modeState({}, "werwolf", "stage")).toBe("none");
    expect(modeState({}, "eins", "stage")).toBe("beta");
    expect(modeState({}, "alles", "stage")).toBe("none");
  });
  it("Beta nur für Geräte der Verwaltung", () => {
    const m = { eins: { table: "beta" as const } };
    expect(modeAllowed(m, "eins", "table", false)).toBe(false);
    expect(modeAllowed(m, "eins", "table", true)).toBe(true);
    expect(modeAllowed({ eins: { table: "off" } }, "eins", "table", true)).toBe(false);
  });
  it("Tisch-Spiele sind echte Spiele", () => {
    expect(TABLE_GAMES).toEqual(["maumau", "eins", "schamlos", "fuenfwuerfel", "vier", "stapelbau", "himmelskarten", "zehnphasen", "glueckssieben", "decknamen", "alles", "maexchen", "dame", "muehle", "ludo", "fischen", "hellseher", "werwolf", "einenacht", "spion", "stirnraten"]);
    for (const id of Object.keys(GAME_MODES)) expect(id in GAMES).toBe(true);
  });
});
