import { describe, expect, it } from "vitest";
import { pieceKey, pieces, validPiece } from "@shared/platform/voice";
import { fileType, assetPath } from "@shared/platform/files";

describe("Echte Stimme", () => {
  it("Bausteine: Namen und Zahlen einzeln (neutral), feste Teile in der Stimmung, Satzzeichen am Anfang weg", () => {
    expect(pieces("Anna, du bist dran – wir sind gespannt!", ["Anna", "Ben"], "froh")).toEqual([
      { kind: "name", text: "Anna", mood: "neutral" },
      { kind: "text", text: "du bist dran – wir sind gespannt!", mood: "froh" },
    ]);
    expect(pieces("Es gewinnt Ben mit 12 Punkten. Glückwunsch!", ["Ben"]).map((p) => p.text)).toEqual(["Es gewinnt", "Ben", "mit", "12", "Punkten.", "Glückwunsch!"]);
    // Name als Teil eines Worts zählt nicht
    expect(pieces("Benjamin ist dran.", ["Ben"]).map((p) => p.kind)).toEqual(["text"]);
    // Satzende nach einem Namen: längere Pause
    expect(pieces("Der Hochstapler war Anna. Weiter!", ["Anna"]).find((p) => p.kind === "name")?.end).toBe(true);
  });

  it("Schlüssel wie im Skript der GitHub-Aktion (Python)", async () => {
    expect(await pieceKey("neutral", "ist dran.")).toBe("87259376f45dfb45");
    expect(await pieceKey("froh", "du bist  dran – wir sind gespannt! ")).toBe("0028ea8be92fd23f");
    expect(await pieceKey("neutral", "Anna")).toBe("c11509df9f92c387");
  });

  it("Gemeldete Bausteine werden geprüft", () => {
    expect(validPiece({ mood: "neutral", text: " Kevin " })).toEqual({ mood: "neutral", text: "Kevin" });
    expect(validPiece({ mood: "laut", text: "Kevin" })).toBeNull();
    expect(validPiece({ mood: "neutral", text: "<script>" })).toBeNull();
    expect(validPiece({ mood: "neutral", text: "x".repeat(200) })).toBeNull();
  });

  it("R2-Ordner „stimme“: nur MP3 und JSON, Inhalt passt zur Endung", () => {
    expect(assetPath("stimme/cdc21a937e82d2e3.mp3")?.path).toBe("stimme/cdc21a937e82d2e3.mp3");
    expect(assetPath("stimme/x.exe")).toBeNull();
    const mp3 = new Uint8Array(100); mp3.set([0x49, 0x44, 0x33]);
    expect(fileType(mp3, "stimme/a.mp3")).toBe("audio/mpeg");
    expect(fileType(new Uint8Array(100), "stimme/a.mp3")).toBeNull();
    expect(fileType(new TextEncoder().encode('{"keys":[]}'), "stimme/index.json")).toBe("application/json");
    expect(fileType(new TextEncoder().encode("nope"), "stimme/index.json")).toBeNull();
  });
});
