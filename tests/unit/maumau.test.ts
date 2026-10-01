import { describe, expect, it } from "vitest";
import { DECKS, fullDeck, type Card } from "@shared/cards/deck";
import { canPlay, type MauMauState } from "@shared/games/maumau/logic";
import { playerLimits, viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as MauMauState;

/** Die Regeltests nutzen das deutsche Blatt; das französische wird unten eigens geprüft */
function start(n = 3, options: Record<string, string | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora", "Emil"].slice(0, n)), { type: "selectGame", gameId: "maumau" });
  r = act(r, { type: "setOption", key: "deck", value: "de32" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
/** Hände, Ablage und Stapel gezielt festlegen */
function deal(r: RoomState, hands: Record<string, Card[]>, topCard: Card, pile: Card[] = ["schellen-K", "schellen-O", "schellen-9", "gruen-9"]): RoomState {
  const s: MauMauState = { ...g(r), hands, discard: [topCard], pile, curId: "p1", pendingDraw: 0, wish: null, drawn: null, dir: 1 };
  s.counts = Object.fromEntries(Object.entries(hands).map(([id, h]) => [id, h.length]));
  return { ...r, game: s };
}
const play = (r: RoomState, card: Card, extra: Record<string, unknown> = {}) => game(r, { type: "play", card, mau: true, ...extra });

describe("Aufbau", () => {
  it("teilt 5 Karten aus und deckt eine auf", () => {
    const s = g(start(3));
    expect(Object.values(s.hands).map((h) => h.length)).toEqual([5, 5, 5]);
    expect(s.discard).toHaveLength(1);
    expect(s.pile.length + 15 + 1).toBe(32);
    expect(new Set([...s.pile, ...s.discard, ...Object.values(s.hands).flat()]).size).toBe(32);
    expect(fullDeck(DECKS.fr32)).toHaveLength(32);
    expect(fullDeck(DECKS.fr52)).toHaveLength(52);
  });

  it("Spielerzahl je nach Blatt und Kartenzahl", () => {
    let r = act(roomWith(["A"]), { type: "selectGame", gameId: "maumau" });
    expect(() => act(r, { type: "start" })).toThrow(/mindestens 2/);
    expect(playerLimits(r)).toEqual({ min: 2, max: 5 }); // französisch, 32 Karten
    r = act(r, { type: "setOption", key: "hand", value: "6" });
    expect(playerLimits(r)).toEqual({ min: 2, max: 4 });
    r = act(r, { type: "setOption", key: "deck", value: "fr52" });
    expect(playerLimits(r)).toEqual({ min: 2, max: 7 });
  });

  it("französisches Blatt: Bube wünscht", () => {
    let r = act(roomWith(["Anna", "Ben"]), { type: "selectGame", gameId: "maumau" });
    r = act(r, { type: "start" });
    expect(g(r).deck).toBe("fr32");
    expect(g(r).discard[0]).toMatch(/^(kreuz|pik|herz|karo)-/);
    r = deal(r, { p1: ["kreuz-B", "herz-9"], p2: ["pik-7"] }, "herz-K");
    expect(() => play(r, "eichel-U" as Card)).toThrow(/nicht/);
    r = play(r, "kreuz-B", { wish: "karo" });
    expect(g(r).wish).toBe("karo");
    expect(() => act(roomWith(["x", "y"]), { type: "selectGame", gameId: "maumau" })).not.toThrow();
  });

  it("fremde Hände und der Stapel bleiben geheim", () => {
    const r = start(3);
    const v = g(viewRoom(r, "p2"));
    expect(Object.keys(v.hands)).toEqual(["p2"]);
    expect(v.pile).toEqual([]);
    expect(v.counts.p1).toBe(5);
    expect(v.pileCount).toBe(g(r).pile.length);
  });
});

describe("Legen", () => {
  it("Farbe oder Wert bedienen", () => {
    let r = deal(start(), { p1: ["rot-9", "gruen-K", "eichel-7"], p2: ["rot-A"], p3: ["gruen-8"] }, "rot-K");
    expect(() => play(r, "eichel-7")).toThrow(/passt nicht/);
    r = play(r, "gruen-K"); // gleicher Wert
    expect(g(r).curId).toBe("p2");
    expect(() => game(r, { type: "play", card: "rot-9" }, "p3")).toThrow(/Ben ist am Zug/); // p1 ist Host und dürfte für Ben spielen
  });

  it("7: zwei ziehen, stapelbar", () => {
    let r = deal(start(), { p1: ["rot-7", "gruen-K", "gruen-A"], p2: ["gruen-7", "rot-8"], p3: ["gruen-8", "eichel-9"] }, "rot-K", ["eichel-A", "eichel-K", "eichel-O", "eichel-10", "eichel-8", "schellen-7"]);
    r = play(r, "rot-7");
    expect(g(r).pendingDraw).toBe(2);
    expect(() => play(r, "rot-8")).toThrow(/ziehen/);
    r = play(r, "gruen-7");
    expect(g(r).pendingDraw).toBe(4);
    r = game(r, { type: "draw" });
    expect(g(r).hands.p3).toHaveLength(6);
    expect(g(r).curId).toBe("p1");
    expect(g(r).pendingDraw).toBe(0);
  });

  it("8: der Nächste setzt aus", () => {
    let r = deal(start(), { p1: ["rot-8", "gruen-K"], p2: ["rot-A"], p3: ["gruen-8"] }, "rot-K");
    r = play(r, "rot-8");
    expect(g(r).curId).toBe("p3");
  });

  it("Unter wünscht eine Farbe, Unter auf Unter nur mit Einstellung", () => {
    let r = deal(start(), { p1: ["eichel-U", "gruen-K"], p2: ["rot-U", "gruen-A", "schellen-9"], p3: ["gruen-8"] }, "rot-K");
    expect(() => play(r, "eichel-U")).toThrow(/Wünsch/);
    r = play(r, "eichel-U", { wish: "schellen" });
    expect(g(r).wish).toBe("schellen");
    expect(canPlay(g(r), "gruen-A", {})).toBe(false);
    expect(canPlay(g(r), "rot-U", {})).toBe(false);
    expect(canPlay(g(r), "rot-U", { unterOnUnter: true })).toBe(true);
    r = game(r, { type: "play", card: "schellen-9", mau: true });
    expect(g(r).wish).toBeNull();
  });

  it("9 dreht die Richtung, Ass nochmal – nur mit Einstellung", () => {
    let r = deal(start(3, { reverse9: true, againA: true }), { p1: ["rot-9", "rot-A", "gruen-K"], p2: ["rot-10"], p3: ["gruen-8"] }, "rot-K");
    r = play(r, "rot-A");
    expect(g(r).curId).toBe("p1");
    r = play(r, "rot-9");
    expect(g(r).dir).toBe(-1);
    expect(g(r).curId).toBe("p3");
  });

  it("„Mau“ vergessen kostet eine Karte", () => {
    let r = deal(start(), { p1: ["rot-9", "gruen-9"], p2: ["rot-A"], p3: ["gruen-8"] }, "rot-K");
    r = game(r, { type: "play", card: "rot-9" });
    expect(g(r).hands.p1).toHaveLength(2);
  });

  it("letzte Karte gewinnt", () => {
    let r = deal(start(), { p1: ["rot-9"], p2: ["rot-A"], p3: ["gruen-8"] }, "rot-K");
    r = play(r, "rot-9");
    expect(g(r).winnerId).toBe("p1");
    expect(() => game(r, { type: "draw" })).toThrow(/entschieden/);
  });
});

describe("Ziehen", () => {
  it("passt die gezogene Karte, darf nur sie gelegt werden", () => {
    let r = deal(start(), { p1: ["eichel-9", "gruen-A"], p2: ["rot-A"], p3: ["gruen-8"] }, "rot-K", ["rot-8"]);
    r = game(r, { type: "draw" });
    expect(g(r).drawn).toBe("rot-8");
    expect(g(r).curId).toBe("p1");
    expect(() => play(r, "gruen-A")).toThrow(/gezogene/);
    r = game(r, { type: "pass" });
    expect(g(r).curId).toBe("p2");
  });

  it("passt sie nicht: erst ansehen, dann selbst passen", () => {
    let r = deal(start(), { p1: ["eichel-9"], p2: ["rot-A"], p3: ["gruen-8"] }, "rot-K", ["eichel-8"]);
    r = game(r, { type: "draw" });
    expect(g(r).curId).toBe("p1");
    expect(g(r).drawn).toBe("eichel-8");
    expect(() => game(r, { type: "play", card: "eichel-8" })).toThrow();
    r = game(r, { type: "pass" });
    expect(g(r).curId).toBe("p2");
  });

  it("mit Automatik ist der Zug sofort vorbei, wenn sie nicht passt", () => {
    let r = deal(start(3, { autoPass: true }), { p1: ["eichel-9"], p2: ["rot-A"], p3: ["gruen-8"] }, "rot-K", ["eichel-8"]);
    r = game(r, { type: "draw" });
    expect(g(r).curId).toBe("p2");
  });

  it("leerer Stapel: Ablage wird gemischt", () => {
    let r = deal(start(), { p1: ["eichel-9"], p2: ["rot-A"], p3: ["gruen-8"] }, "rot-K", []);
    r = { ...r, game: { ...g(r), discard: ["gruen-7", "schellen-7", "rot-K"] } };
    r = game(r, { type: "draw" });
    expect(g(r).hands.p1).toHaveLength(2);
    expect(g(r).discard).toEqual(["rot-K"]);
  });

  it("ohne Karten gezogen geht es nicht zu passen", () => {
    const r = deal(start(), { p1: ["eichel-9"], p2: ["rot-A"], p3: ["gruen-8"] }, "rot-K");
    expect(() => game(r, { type: "pass" })).toThrow(/Erst ziehen/);
  });
});

describe("Spieler verlässt das Spiel", () => {
  it("bei zwei Spielern gewinnt der Verbleibende", () => {
    const r = act(start(2), { type: "removePlayer", id: "p2" });
    expect(g(r).winnerId).toBe("p1");
  });
});
