import { describe, expect, it } from "vitest";
import { GAME_IDS, getGame } from "@shared/games";
import { fitsPlayers, fold, gameMatches, planDuration } from "../../src/lib/gameSearch";

const info = (id: string) => getGame(id).info;

describe("Spielsuche", () => {
  it("ignoriert Groß/klein, Umlaute und ß", () => {
    expect(fold("Mäxchen  STRASSE ß")).toBe("maxchen strasse ss");
    expect(gameMatches(info("maexchen"), "maxch")).toBe(true);
    expect(gameMatches(info("fuenfwuerfel"), "WÜRFEL")).toBe(true);
  });
  it("jedes Wort muss passen, leere Suche zeigt alles", () => {
    expect(GAME_IDS.every((id) => gameMatches(info(id), "  "))).toBe(true);
    expect(gameMatches(info("maumau"), "karten mau")).toBe(true);
    expect(gameMatches(info("maumau"), "karten würfel quatsch")).toBe(false);
  });
  it("findet nach Art", () => {
    const party = GAME_IDS.filter((id) => gameMatches(info(id), "party"));
    expect(party.length).toBeGreaterThan(2);
    expect(party.every((id) => info(id).category === "Party" || /party/i.test(info(id).tagline + info(id).name))).toBe(true);
  });
  it("Spielerzahl", () => {
    const g = info("vier");
    expect(fitsPlayers(g, g.minPlayers)).toBe(true);
    expect(fitsPlayers(g, g.maxPlayers + 1)).toBe(false);
  });
  it("Gesamtdauer", () => {
    const d = (...x: string[]) => planDuration(x.map((duration) => ({ ...info("alles"), duration })));
    expect(d("10 Min.", "15 Min.")).toBe("ca. 25 Min.");
    expect(d("10–20 Min.", "15 Min.")).toBe("ca. 25–35 Min.");
    expect(d("30–60 Min.", "45–90 Min.")).toBe("ca. 1,5–2,5 Std.");
    expect(d("30 Min.", "30 Min.")).toBe("ca. 1 Std.");
  });
});
