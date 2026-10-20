import { describe, expect, it } from "vitest";
import { decodePoints, drawableCats, encodePoints, matches, type ZState } from "@shared/games/zeichnen/logic";
import { wordText } from "@shared/games/stirnraten/cards";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as ZState;
function start(n = 3, options: Record<string, string | number | boolean> = {}) {
  let r = act(roomWith(["Anna", "Ben", "Cem", "Dora"].slice(0, n)), { type: "selectGame", gameId: "zeichnen" });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}
const drawer = (r: RoomState) => g(r).drawer!;
const guessers = (r: RoomState) => g(r).order.filter((id) => id !== drawer(r));

describe("Zeichnen & Raten", () => {
  it("Striche: Punkte kodieren und wiederherstellen (auf 1/4095 genau)", () => {
    const pts: [number, number][] = [[0, 0], [0.5, 0.25], [1, 1]];
    const back = decodePoints(encodePoints(pts));
    back.forEach(([x, y], i) => { expect(x).toBeCloseTo(pts[i][0], 3); expect(y).toBeCloseTo(pts[i][1], 3); });
  });

  it("Tipps: Groß/klein, Umlaute und kleine Tippfehler zählen – ganz andere Wörter nicht", () => {
    expect(matches("hund", "Hund")).toBe(true);
    expect(matches("Kühlschrank", "Kuehlschrank")).toBe(true);
    expect(matches("Schmeterling", "Schmetterling")).toBe(true);
    expect(matches("Hand", "Hund")).toBe(false);
    expect(matches("Katze", "Hund")).toBe(false);
  });

  it("Nur malbare Begriffe: keine Lieder, Geräusche, Pantomime oder Länder", () => {
    const ids = drawableCats({ level: "ab18" }).map((c) => c.id);
    expect(ids).not.toContain("k-lieder");
    expect(ids).not.toContain("f-laender");
    expect(ids).toContain("k-tiere");
  });

  it("Ablauf „rufen“: Begriff wählen, malen, wer es hatte bekommt Punkte, dann das nächste Bild", () => {
    let r = start(3);
    expect(g(r).phase).toBe("pick");
    const d = drawer(r);
    // Die Auswahl sieht nur, wer zeichnet
    expect(g(viewRoom(r, d)).choices).toHaveLength(3);
    expect(g(viewRoom(r, guessers(r)[0])).choices).toEqual([]);
    r = game(r, { type: "pick", i: 0 }, d);
    expect(g(r).phase).toBe("draw");
    r = game(r, { type: "stroke", c: 1, w: 2, p: encodePoints([[0.1, 0.1], [0.5, 0.5]]) }, d);
    expect(g(r).strokes).toHaveLength(1);
    // Nur wer zeichnet, malt
    expect(() => game(r, { type: "stroke", c: 1, w: 2, p: encodePoints([[0, 0]]) }, guessers(r)[0])).toThrow();
    // Begriff: Zeichner ja, Ratende und Fernseher nur als Lücken
    expect(g(viewRoom(r, d)).word).not.toBeNull();
    expect(g(viewRoom(r, guessers(r)[0])).word).toBeNull();
    expect(g(viewRoom(r, WATCH_ID)).word).toBeNull();
    expect(g(viewRoom(r, WATCH_ID)).mask).toMatch(/_/);
    const winner = guessers(r)[0];
    r = game(r, { type: "award", to: winner }, d);
    expect(g(r).phase).toBe("reveal");
    expect(g(r).scores[winner]).toBe(100);
    expect(g(r).scores[d]).toBe(60);
    expect(g(viewRoom(r, WATCH_ID)).word).not.toBeNull();
    r = game(r, { type: "next" }, winner);
    expect(g(r).phase).toBe("pick");
    expect(drawer(r)).not.toBe(d);
  });

  it("Ablauf „tippen“: falscher Tipp sichtbar, richtiger bleibt geheim; haben alle es, ist das Bild vorbei", () => {
    let r = start(3, { guess: "tippen" });
    const d = drawer(r);
    r = game(r, { type: "pick", i: 0 }, d);
    const word = wordText(g(r).word);
    const [a, b] = guessers(r);
    r = game(r, { type: "guess", text: "zzzz" }, a);
    expect(g(r).guesses.at(-1)).toMatchObject({ by: a, ok: false });
    r = game(r, { type: "guess", text: word }, a);
    expect(g(r).solved).toEqual([a]);
    expect(g(r).scores[a]).toBeGreaterThanOrEqual(40);
    // b sieht nicht, was a richtig getippt hat – a sieht jetzt den Begriff
    expect(g(viewRoom(r, b)).guesses.at(-1)!.text).toBe("");
    expect(g(viewRoom(r, a)).word).not.toBeNull();
    expect(() => game(r, { type: "guess", text: "noch was" }, a)).toThrow();
    r = game(r, { type: "guess", text: word }, b);
    expect(g(r).phase).toBe("reveal");
    expect(g(r).last?.solved).toEqual([a, b]);
  });

  it("Zeit um: erst nach Ablauf; nichts bleibt hängen (Host überspringt jede Phase)", () => {
    let r = start(2, { seconds: 30 });
    r = game(r, { type: "pick", i: 1 }, drawer(r));
    expect(() => game(r, { type: "timeUp" }, guessers(r)[0])).toThrow();
    for (let i = 0; i < 6 && g(r).phase !== "over"; i++) r = act(r, { type: "skip" }, "p1");
    expect(["pick", "draw", "reveal", "over"]).toContain(g(r).phase);
  });

  it("Wer zeichnet, geht: das Bild wird aufgelöst, die Partie läuft weiter", () => {
    let r = start(3);
    const d = drawer(r);
    r = game(r, { type: "pick", i: 0 }, d);
    r = act(r, { type: "removePlayer", id: d });
    expect(["reveal", "pick"]).toContain(g(r).phase);
    expect(g(r).order).not.toContain(d);
  });
});
