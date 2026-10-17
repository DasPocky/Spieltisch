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
    expect(tableModel(act(roomWith(["Anna", "Ben"], "kniffel"), { type: "start" }))).toBeNull();
    const real = act(act(roomWith(["Anna", "Ben"], "maumau"), { type: "setOption", key: "mode", value: "table" }), { type: "start" });
    expect(tableModel(real)).toBeNull();
  });
});
