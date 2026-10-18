import { describe, expect, it } from "vitest";
import { visemesOf } from "../../src/platform/moderator/visemes";

describe("Mundbilder aus deutschen Wörtern", () => {
  it("Vokale, Lippen- und Zischlaute", () => {
    expect(visemesOf("Mama")).toEqual(["PP", "aa", "PP", "aa"]);
    expect(visemesOf("Schön!")).toEqual(["CH", "O", "nn"]);
    expect(visemesOf("Spiel")).toEqual(["SS", "PP", "I", "E", "DD"]);
  });
  it("ohne Buchstaben: Ruhe", () => {
    expect(visemesOf("–")).toEqual(["sil"]);
  });
});
