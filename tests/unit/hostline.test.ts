import { describe, expect, it } from "vitest";
import { cleanHostLine, hostPrompt, parseHostLine } from "../../shared/platform/hostline";

describe("KI-Sprüche des Moderators", () => {
  const r = parseHostLine({ moment: "sieg", mood: "frech", name: "Anna", game: "Mau-Mau" })!;

  it("prüft die Anfrage", () => {
    expect(r).toEqual({ moment: "sieg", mood: "frech", name: "Anna", game: "Mau-Mau" });
    expect(parseHostLine({ moment: "dran", mood: "frech", name: "Anna" })).toBeNull();
    expect(parseHostLine({ moment: "sieg", mood: "fies", name: "Anna" })).toBeNull();
    expect(parseHostLine({ moment: "sieg", mood: "frech" })).toBeNull();
    expect(parseHostLine({ moment: "hallo", mood: "charmant" })).not.toBeNull();
    expect(parseHostLine({ moment: "sieg", mood: "frech", name: "<b>Anna</b>{}" })?.name).toBe("bAnnab");
  });

  it("baut den Auftrag mit Charakter und Namen", () => {
    const p = hostPrompt(r);
    expect(p[0].content).toContain("frech");
    expect(p[1].content).toContain("Anna");
    expect(p[1].content).toContain("Mau-Mau");
  });

  it("säubert die Antwort und verwirft, was nicht passt", () => {
    expect(cleanHostLine("„Anna gewinnt – wer hätte das gedacht! 🎉“ Noch ein Satz.", r)).toBe("Anna gewinnt – wer hätte das gedacht!");
    expect(cleanHostLine("Glückwunsch an die Siegerin!", r)).toBeNull(); // ohne Namen
    expect(cleanHostLine("Anna, du Idiot, gewonnen.", r)).toBeNull();
    expect(cleanHostLine("Anna siegt, mehr unter www.beispiel.de.", r)).toBeNull();
    expect(cleanHostLine("Anna " + "sehr ".repeat(50) + "gut.", r)).toBeNull();
    expect(cleanHostLine(42, r)).toBeNull();
  });
});
