import { describe, expect, it } from "vitest";
import { GAME_IDS } from "@shared/games";
import { formerGameId, renameStored, renamedGameId } from "@shared/games/renamed";

describe("Umbenannte Spiele: gespeicherte Daten von früher", () => {
  const old = (id: (typeof GAME_IDS)[number]) => formerGameId(id)!;
  it("jede frühere Kennung führt zu einem heutigen Spiel, heutige bleiben", () => {
    for (const id of ["eins", "stapelbau", "zehnphasen", "decknamen", "himmelskarten", "glueckssieben", "fuenfwuerfel", "alles"] as const) {
      expect(renamedGameId(old(id))).toBe(id);
      expect(GAME_IDS).toContain(id);
    }
    expect(renamedGameId("maumau")).toBe("maumau");
  });
  it("Statistik, Einstellungen und Profile: Schlüssel und Werte übernommen, Standard-Einstellungen mit heutigen Feldern", () => {
    const stored = {
      totals: { [old("alles")]: { local: 3 }, maumau: { local: 1 } },
      config: { order: [old("eins"), "maumau"], modes: { [old("fuenfwuerfel")]: { table: "on" } } },
      recent: [{ gameId: old("glueckssieben"), won: true }],
      defaults: { [old("eins")]: { [old("eins")]: false, target: "round" } },
    };
    const r = renameStored(stored);
    expect(r.totals).toEqual({ alles: { local: 3 }, maumau: { local: 1 } });
    expect(r.config).toEqual({ order: ["eins", "maumau"], modes: { fuenfwuerfel: { table: "on" } } });
    expect(r.recent[0].gameId).toBe("glueckssieben");
    expect(r.defaults).toEqual({ eins: { eins: false, target: "round" } });
  });
  it("ohne frühere Kennungen: dasselbe Objekt, nichts kopiert", () => {
    const x = { totals: { maumau: { local: 1 } } };
    expect(renameStored(x)).toBe(x);
  });
});
