import { describe, expect, it } from "vitest";
import { viewRoom } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { tableModel } from "../../src/platform/table/model";
import { act, roomWith } from "./helpers";

describe("Großer Tisch: Modell aus der Sicht ohne eigene Karten", () => {
  it("Lobby: kein Modell (leerer Tisch)", () => {
    expect(tableModel(roomWith(["Anna", "Ben"], "maumau"))).toBeNull();
  });

  for (const gameId of ["maumau", "uno"]) {
    it(`${gameId}: Stapel, Ablage, Kartenzahl und wer dran ist – ohne fremde Karten`, () => {
      const r = act(roomWith(["Anna", "Ben", "Cem"], gameId), { type: "start" });
      const seen = viewRoom(r, WATCH_ID);
      const m = tableModel(seen)!;
      expect(m).not.toBeNull();
      expect(Object.keys(m.counts).sort()).toEqual(["p1", "p2", "p3"]);
      expect(m.discard.length).toBeGreaterThan(0);
      expect(m.pile).toBeGreaterThan(0);
      expect(["p1", "p2", "p3"]).toContain(m.turn);
      // Die Sicht des Tischs enthält keine Handkarten
      expect(Object.keys((seen.game as { hands: object }).hands)).toEqual([]);
    });
  }

  it("Spiele ohne Tisch-Ansicht und echte Karten: kein Modell (Handy-Ansicht in der Mitte)", () => {
    expect(tableModel(act(roomWith(["Anna", "Ben"], "tutto"), { type: "start" }))).toBeNull();
    // Kniffel mit echten Würfeln: Augen unbekannt – kein Modell
    expect(tableModel(act(act(roomWith(["Anna", "Ben"], "kniffel"), { type: "setOption", key: "diceMode", value: "real" }), { type: "start" }))).toBeNull();
    const real = act(act(roomWith(["Anna", "Ben"], "maumau"), { type: "setOption", key: "mode", value: "table" }), { type: "start" });
    expect(tableModel(real)).toBeNull();
  });

  it("Würfel und Spielfeld: Kniffel zeigt Würfel und Punkte, Vier gewinnt das Brett von oben nach unten", () => {
    let k = act(roomWith(["Anna", "Ben"], "kniffel"), { type: "start" });
    const km = tableModel(k)!;
    expect(km.dice?.values).toEqual([]);
    expect(km.notes?.p1).toBe("0 Pkt.");
    k = act(k, { type: "game", action: { type: "roll" } });
    expect(tableModel(k)!.dice?.values).toHaveLength(5);
    expect(tableModel(k)!.dice?.note).toMatch(/noch 2 Würfe/);

    let v = act(roomWith(["Anna", "Ben"], "vier"), { type: "start" });
    v = act(v, { type: "game", action: { type: "drop", col: 3 } });
    const g = tableModel(v)!.grid!;
    expect(g.cells).toHaveLength(6);
    expect(g.cells[5][3]).toBe(0);
    expect(g.cells[0][3]).toBeNull();
    expect(g.last).toEqual([3, 5]);
  });
});

