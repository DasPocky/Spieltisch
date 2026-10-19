import { describe, expect, it } from "vitest";
import { viewRoom } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { tableModel } from "../../src/platform/table/model";
import { act, roomWith } from "./helpers";

describe("Großer Tisch: Modell aus der Sicht ohne eigene Karten", () => {
  it("Lobby: kein Modell (leerer Tisch)", () => {
    expect(tableModel(roomWith(["Anna", "Ben"], "maumau"))).toBeNull();
  });

  for (const gameId of ["maumau", "eins"]) {
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
    expect(tableModel(act(roomWith(["Anna", "Ben"], "alles"), { type: "start" }))).toBeNull();
    // Fünf Würfel mit echten Würfeln: Augen unbekannt – kein Modell
    expect(tableModel(act(act(roomWith(["Anna", "Ben"], "fuenfwuerfel"), { type: "setOption", key: "diceMode", value: "real" }), { type: "start" }))).toBeNull();
    const real = act(act(roomWith(["Anna", "Ben"], "maumau"), { type: "setOption", key: "mode", value: "table" }), { type: "start" });
    expect(tableModel(real)).toBeNull();
  });

  it("Würfel und Spielfeld: Fünf Würfel zeigt Würfel und Punkte, Vier in einer Reihe das Brett von oben nach unten", () => {
    let k = act(roomWith(["Anna", "Ben"], "fuenfwuerfel"), { type: "start" });
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

  it("Zahlenkarten: Stapelbau zeigt Aufbaustapel und Vorrat + Ablagen am Platz, Himmelskarten das Raster – nur Offenes", () => {
    const sb = viewRoom(act(roomWith(["Anna", "Ben"], "stapelbau"), { type: "start" }), WATCH_ID);
    const m = tableModel(sb)!;
    expect(m.piles?.map((p) => p.label)).toEqual(["Stapel 1", "Stapel 2", "Stapel 3", "Stapel 4", "Ziehen"]);
    expect(m.piles?.slice(0, 4).every((p) => p.top === null)).toBe(true);
    expect(m.boards?.p1.cells).toHaveLength(5);
    // oberste Vorratskarte offen, Ablagen anfangs leer
    expect(m.boards?.p1.cells[0]).not.toBeNull();
    expect(m.boards?.p1.cells.slice(1).every((c) => c === null)).toBe(true);
    expect(m.notes?.p1).toMatch(/^Vorrat \d+$/);

    const sk = viewRoom(act(roomWith(["Anna", "Ben"], "himmelskarten"), { type: "start" }), WATCH_ID);
    const h = tableModel(sk)!;
    expect(h.boards?.p1.cols).toBe(4);
    expect(h.boards?.p1.cells).toHaveLength(12);
    // am Anfang alles verdeckt – der Tisch kennt die Werte nicht
    expect(h.boards?.p1.cells.every((c) => c === "?")).toBe(true);
    expect(h.piles?.[1].top).not.toBeNull();
  });

  it("Zehn Phasen und Glückssieben: Stapel und Ablage in der Mitte, ausgelegte bzw. offene Karten am Platz", () => {
    const z = viewRoom(act(roomWith(["Anna", "Ben"], "zehnphasen"), { type: "start" }), WATCH_ID);
    const zm = tableModel(z)!;
    expect(zm.piles?.map((p) => p.label)).toEqual(["Ziehen", "Ablage"]);
    expect(zm.counts.p1).toBe(10);
    expect(zm.notes?.p1).toBe("Phase 1");
    // noch nichts ausgelegt
    expect(zm.boards).toEqual({});

    const g = viewRoom(act(roomWith(["Anna", "Ben", "Cem"], "glueckssieben"), { type: "start" }), WATCH_ID);
    const gm = tableModel(g)!;
    expect(gm.piles?.[0].label).toBe("Ziehen");
    expect(Object.keys(gm.notes ?? {})).toEqual(["p1", "p2", "p3"]);
  });
});

