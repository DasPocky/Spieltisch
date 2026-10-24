import { describe, expect, it } from "vitest";
import { cleanSetData, cleanSetName, kindOfGame, mergedContent, MAX_ITEMS, ORPHAN_AGE_MS, orphanImages, SetError, setImages, type GameContent } from "@shared/platform/cardsets";
import { act, game, roomWith } from "./helpers";
import { readBody, readBytes } from "../../worker/http";
import type { SchamlosState } from "@shared/games/schamlos/logic";
import type { CNState } from "@shared/games/decknamen/logic";
import type { ZState } from "@shared/games/zeichnen/logic";
import { buildDeck, deckNote, type QState } from "@shared/games/quiz/logic";
import { cardText } from "@shared/games/schamlos/cards";
import { wordText } from "@shared/games/stirnraten/cards";
import { viewRoom, type RoomState } from "@shared/platform/room";

const IMG = "bild:k/0123456789abcdef/abcdefghijklmnopqrst";
const content = (data: GameContent["sets"][number]["data"]): GameContent => ({ sets: [{ id: "abcdefabcdef", name: "Test", data }] });
/** Start mit eigenen Inhalten – so wie der Server sie vor dem Start in den Raum legt */
const startWith = (r: RoomState, c: GameContent) => act({ ...r, content: c }, { type: "start" }, "p1");

describe("Kartensets: Prüfung der Inhalte", () => {
  it("Name: Pflicht, gekürzt, Leerzeichen zusammengefasst", () => {
    expect(() => cleanSetName("   ")).toThrow(SetError);
    expect(cleanSetName("  Unsere   Runde ")).toBe("Unsere Runde");
    expect(cleanSetName("x".repeat(80))).toHaveLength(30);
  });

  it("Schamlos: schwarze Karten brauchen eine Lücke, höchstens drei; Doppelte fallen raus", () => {
    expect(() => cleanSetData("schamlos", { black: ["Ohne Lücke"] })).toThrow(/Lücke/);
    expect(() => cleanSetData("schamlos", { black: ["___ ___ ___ ___"] })).toThrow(/drei/);
    expect(() => cleanSetData("schamlos", {})).toThrow(/leer/);
    const d = cleanSetData("schamlos", { black: ["Wer ___?", "wer ___?"], white: ["Opa", "opa", "  Oma ", IMG, 3 as unknown as string] });
    expect(d.black).toEqual(["wer ___?"]);
    expect(d.white).toEqual(["opa", "Oma", IMG]);
  });

  it("Bilder: nur gültige Schlüssel, schwarze Karten nie als Bild", () => {
    const d = cleanSetData("schamlos", { black: [IMG, "Hallo ___"], white: ["bild:../../geheim", "bild:k/xyz/123"] });
    expect(d.black).toEqual(["Hallo ___"]);
    expect(d.white).toEqual([]);
    expect(cleanSetData("zeichnen", { words: [IMG, "Hund"] }).words).toEqual(["Hund"]);
    expect(setImages(cleanSetData("decknamen", { words: [IMG, "Hund"] }))).toEqual([IMG.slice(5)]);
  });

  it("Grenzen: höchstens 300 Einträge, Texte gekürzt, Unicode bleibt", () => {
    const words = Array.from({ length: 400 }, (_, i) => `Wort ${i} 🎲`);
    const d = cleanSetData("decknamen", { words });
    expect(d.words).toHaveLength(MAX_ITEMS);
    expect(d.words![0]).toBe("Wort 0 🎲");
    expect(cleanSetData("zeichnen", { words: ["ü".repeat(100)] }).words![0]).toHaveLength(40);
  });

  it("Quiz: nur gültige Fragen (vier verschiedene Antworten, endliche Zahl, vier Begriffe)", () => {
    const d = cleanSetData("quiz", { questions: [
      ["Hauptstadt?", "Berlin", "Bonn", "Köln", "Hamburg"],
      ["Doppelt?", "a", "a", "b", "c"],
      ["Wie hoch?", 8848, "m"],
      ["Unendlich?", Infinity, ""],
      ["Ordne!", ["eins", "zwei", "drei", "vier"]],
      ["Zu kurz", ["eins", "zwei"]],
      ["x", "a", "b", "c", "d"],
    ] as never });
    expect(d.questions!.map((q) => q[0])).toEqual(["Hauptstadt?", "Wie hoch?", "Ordne!"]);
    expect(() => cleanSetData("quiz", { questions: [] })).toThrow(SetError);
  });

  it("Art je Spiel, Inhalte mehrerer Sets zusammen", () => {
    expect(kindOfGame("schamlos")).toBe("schamlos");
    expect(kindOfGame("maumau")).toBeNull();
    const c: GameContent = { sets: [{ id: "a", name: "A", data: { words: ["x"] } }, { id: "b", name: "B", data: { words: ["y"], white: ["z"] } }] };
    expect(mergedContent(c)).toMatchObject({ words: ["x", "y"], white: ["z"] });
    expect(mergedContent(undefined).words).toEqual([]);
  });
});

describe("Kartensets im Raum", () => {
  it("setSets: nur der Host, höchstens sechs, ungültige Kennungen fallen raus, Inhalte nie in der Sicht", () => {
    let r = roomWith(["A", "B", "C"], "schamlos");
    expect(() => act(r, { type: "setSets", sets: [{ id: "abcdefabcdef", name: "X" }] }, "p2")).toThrow();
    expect(() => act(r, { type: "setSets", sets: Array.from({ length: 7 }, (_, i) => ({ id: `abcdefabcde${i}`, name: "X", kind: "schamlos" as const })) }, "p1")).toThrow(/sechs|6/);
    r = act(r, { type: "setSets", sets: [{ id: "abcdefabcdef", name: "  Mein   Set ", kind: "schamlos" }, { id: "abcdefabcdef", name: "doppelt" }, { id: "../x", name: "böse" }, { id: "zzzzzzzzzzzz", name: "Art?", kind: "x" as never }] }, "p1");
    expect(r.sets).toEqual([{ id: "abcdefabcdef", name: "Mein Set", kind: "schamlos" }, { id: "zzzzzzzzzzzz", name: "Art?" }]);
    // Sechs je Art – zusammen mit anderen Arten dürfen es mehr sein
    const six = (kind: "schamlos" | "quiz") => Array.from({ length: 6 }, (_, i) => ({ id: `${kind.slice(0, 1)}bcdefabcde${i}`, name: "X", kind }));
    expect(act(r, { type: "setSets", sets: [...six("schamlos"), ...six("quiz")] }, "p1").sets).toHaveLength(12);
    expect(viewRoom({ ...r, content: content({ white: ["geheim"] }) }, "p2").content).toBeUndefined();
    r = act(r, { type: "setSets", sets: [] }, "p1");
    expect(r.sets).toBeUndefined();
  });

  it("Schamlos: eigene Karten mischen sich ein, eigene schwarze Karten bleiben geheim", () => {
    const r = startWith(roomWith(["A", "B", "C"], "schamlos"), content({ black: ["Eigen ___"], white: ["Eigene Antwort"] }));
    const s = r.game as SchamlosState;
    expect(s.ownBlack).toEqual(["x:Eigen ___"]);
    expect([...s.whitePile, ...Object.values(s.hands).flat()]).toContain("x:Eigene Antwort");
    expect(cardText("x:Eigene Antwort")).toBe("Eigene Antwort");
    expect((viewRoom(r, "p2").game as SchamlosState).ownBlack).toEqual([]);
  });

  it("Schamlos: „Nur eigene“ nur, wenn genug Karten da sind", () => {
    const few = startWith(act(roomWith(["A", "B", "C"], "schamlos"), { type: "setOption", key: "own_only", value: true }, "p1"), content({ black: ["A ___"], white: ["a"] }));
    expect((few.game as SchamlosState).ownOnly).toBeUndefined();
    const black = Array.from({ length: 5 }, (_, i) => `Karte ${i} ___`), white = Array.from({ length: 40 }, (_, i) => `Weiß ${i}`);
    const many = startWith(act(roomWith(["A", "B", "C"], "schamlos"), { type: "setOption", key: "own_only", value: true }, "p1"), content({ black, white }));
    const s = many.game as SchamlosState;
    expect(s.ownOnly).toBe(true);
    expect([s.prompt, ...s.blackPile].every((c) => c.startsWith("x:"))).toBe(true);
    expect([...s.whitePile, ...Object.values(s.hands).flat()].every((c) => c.startsWith("x:"))).toBe(true);
  });

  it("Decknamen: eigene Wörter kommen aufs Brett, Liste nicht in der Sicht der Spieler", () => {
    const r = startWith(roomWith(["A", "B", "C", "D"], "decknamen"), content({ words: ["Eigenwort", IMG] }));
    const s = r.game as CNState;
    expect(s.words).toContain("Eigenwort");
    expect(s.words).toContain(IMG);
    expect((viewRoom(r, "p2").game as CNState).own).toEqual([]);
  });

  it("Zeichnen: eigene Begriffe zuerst zur Wahl, „Nur eigene“ ab drei, Liste geheim", () => {
    const r = startWith(roomWith(["A", "B", "C"], "zeichnen"), content({ words: ["Gartenzwerg", "Eiffelturm"] }));
    const s = r.game as ZState;
    expect(s.choices.map((w) => wordText(w))).toEqual(expect.arrayContaining(["Gartenzwerg", "Eiffelturm"]));
    expect(s.choices).toHaveLength(3);
    expect(s.ownOnly).toBeUndefined();
    expect((viewRoom(r, s.drawer === "p1" ? "p2" : "p1").game as ZState).own).toEqual([]);
    const only = startWith(act(roomWith(["A", "B"], "zeichnen"), { type: "setOption", key: "own_only", value: true }, "p1"), content({ words: ["Eins", "Zwei", "Drei"] }));
    const z = only.game as ZState;
    expect(z.ownOnly).toBe(true);
    expect(z.choices.map((w) => wordText(w)).sort()).toEqual(["Drei", "Eins", "Zwei"]);
    // Begriff wählen: Lücken passen zum eigenen Begriff, Raten klappt
    const drawer = z.drawer!;
    const picked = game(only, { type: "pick", i: z.choices.findIndex((w) => wordText(w) === "Zwei") }, drawer);
    expect((picked.game as ZState).mask).toBe("____");
  });

  it("Quiz: eigene Fragen zuerst, „Nur eigene“, Lösung und Liste geheim", () => {
    const qs = [["Eigene Frage eins?", "Ja", "Nein", "Vielleicht", "Nie"], ["Eigene Schätzfrage?", 42, "Stück"]] as never;
    const r = startWith(act(roomWith(["A", "B"], "quiz"), { type: "setOption", key: "own_only", value: true }, "p1"), content({ questions: qs }));
    const s = r.game as QState;
    expect(s.total).toBe(2);
    expect(s.deck.every((id) => id.startsWith("x:"))).toBe(true);
    expect(s.shown?.cat).toBe("x");
    const v = viewRoom(r, "p2").game as QState;
    expect(v.own).toEqual([]);
    expect(v.key).toBeNull();
    const mixed = startWith(roomWith(["A", "B"], "quiz"), content({ questions: qs }));
    const m = mixed.game as QState;
    expect(m.total).toBe(10);
    expect(m.deck.slice(0, 2).every((id) => id.startsWith("x:"))).toBe(true);
  });

  it("Quiz: nie ein leerer Stapel – alle Kategorien aus heißt: alle", () => {
    const off = { kat_allgemein: false, kat_geografie: false, kat_geschichte: false, kat_natur: false, kat_kultur: false, kat_sport: false, kat_essen: false, kat_wissenschaft: false, kat_sprache: false };
    expect(buildDeck(off, 10)).toHaveLength(10);
    expect(deckNote(off)).toMatch(/Keine Kategorie/);
    expect(deckNote({})).toBeNull();
  });
});

describe("Anfragen: Größe vor dem Einlesen begrenzt", () => {
  const req = (body: string | Uint8Array<ArrayBuffer>, headers: Record<string, string> = {}) => new Request("https://x/", { method: "POST", body, headers });

  it("Rohdaten über der Grenze: null, auch ohne Content-Length", async () => {
    expect(await readBytes(req(new Uint8Array(10)), 10)).toHaveLength(10);
    expect(await readBytes(req(new Uint8Array(11)), 10)).toBeNull();
    expect(await readBytes(req("x", { "content-length": "999999" }), 10)).toBeNull();
    const stream = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < 5; i++) c.enqueue(new Uint8Array(4)); c.close(); } });
    expect(await readBytes(new Request("https://x/", { method: "POST", body: stream, duplex: "half" } as RequestInit), 12)).toBeNull();
  });

  it("JSON: Grenze in Zeichen, Umlaute zählen einfach", async () => {
    expect(await readBody(req(JSON.stringify({ a: "ä".repeat(50) })), 60)).toEqual({ a: "ä".repeat(50) });
    expect(await readBody(req(JSON.stringify({ a: "x".repeat(100) })), 60)).toBeNull();
    expect(await readBody(req("[1]"))).toBeNull();
  });
});

describe("Kartensets: verwaiste Bilder", () => {
  const DIR = "k/0123456789abcdef";
  const key = (r: string) => `${DIR}/${r.padEnd(20, "a")}`;
  const now = 10 * ORPHAN_AGE_MS;
  const old = now - ORPHAN_AGE_MS - 1;

  it("nur ungenutzte und alte Bilder aus dem eigenen Ordner", () => {
    const objs = [
      { key: key("benutzt"), uploaded: old },
      { key: key("verwaist"), uploaded: old },
      { key: key("frisch"), uploaded: now - 1000 },
      { key: key("grenze"), uploaded: now - ORPHAN_AGE_MS },
    ];
    expect(orphanImages(objs, [key("benutzt")], DIR, now)).toEqual([key("verwaist"), key("grenze")]);
    // Mit Schrägstrich am Ende gleich
    expect(orphanImages(objs, [key("benutzt")], `${DIR}/`, now)).toEqual([key("verwaist"), key("grenze")]);
  });

  it("fremde Ordner, ähnliche Präfixe und seltsame Schlüssel bleiben unberührt", () => {
    const objs = [
      { key: "k/fedcba9876543210/" + "a".repeat(20), uploaded: old },
      { key: `${DIR}0/${"a".repeat(20)}`, uploaded: old },
      { key: `${DIR}/zu-kurz`, uploaded: old },
      { key: `assets/${"a".repeat(20)}`, uploaded: old },
    ];
    expect(orphanImages(objs, [], DIR, now)).toEqual([]);
  });

  it("ungültiger Ordner löscht nichts", () => {
    const objs = [{ key: key("x"), uploaded: old }];
    expect(orphanImages(objs, [], "k", now)).toEqual([]);
    expect(orphanImages(objs, [], "", now)).toEqual([]);
    expect(orphanImages(objs, [], "k/0123", now)).toEqual([]);
  });

  it("Bilder aus Sets zählen als benutzt (auch in Kopien)", () => {
    const a = { white: [`bild:${key("eins")}`, "Text"] }, b = { words: [`bild:${key("eins")}`, `bild:${key("zwei")}`] };
    const used = [...setImages(a), ...setImages(b)];
    const objs = ["eins", "zwei", "drei"].map((r) => ({ key: key(r), uploaded: old }));
    expect(orphanImages(objs, used, DIR, now)).toEqual([key("drei")]);
  });
});
