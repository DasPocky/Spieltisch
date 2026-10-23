import { describe, expect, it } from "vitest";
import { sanitizeOption } from "@shared/platform/room";
import { GAME_IDS, getGame } from "@shared/games";
import { changedRules, currentPreset, presetKeys, presetsOf } from "@shared/platform/presets";
import { act, roomWith } from "./helpers";

describe("Regelpakete", () => {
  it("jedes Paket nutzt echte Einstellungen mit gültigen Werten, weicht vom Standard ab und ist eindeutig erkennbar", () => {
    for (const id of GAME_IDS) {
      const logic = getGame(id);
      expect(logic.presets?.length ?? 0, id).toBeLessThanOrEqual(2);
      for (const p of logic.presets ?? []) {
        expect(Object.keys(p.options).length, `${id}/${p.id}`).toBeGreaterThan(0);
        for (const [k, v] of Object.entries(p.options)) {
          const def = logic.settings.find((d) => d.key === k);
          expect(def, `${id}/${p.id}: ${k}`).toBeDefined();
          expect(sanitizeOption(def!, v), `${id}/${p.id}: ${k}`).toBe(v);
          expect(v, `${id}/${p.id}: ${k} ist schon Standard`).not.toBe(def!.default);
          // Material und Ablauf bleiben unberührt
          expect(["mode", "dice", "diceMode", "cards", "narrator"], `${id}/${p.id}`).not.toContain(k);
        }
        expect(p.label.length, `${id}/${p.id}`).toBeLessThanOrEqual(11);
      }
      const r = roomWith(["Anna", "Ben"], id);
      expect(currentPreset(logic, r.options), id).toBe(presetsOf(logic).length ? "standard" : null);
      for (const p of presetsOf(logic)) {
        const s = act(r, { type: "setPreset", id: p.id });
        expect(currentPreset(logic, s.options), `${id}/${p.id}`).toBe(p.id);
      }
    }
  });

  it("Standard setzt alle Regeln zurück, Material bleibt", () => {
    let r = roomWith(["Anna", "Ben"], "eins");
    r = act(r, { type: "setOption", key: "mode", value: "table" });
    r = act(r, { type: "setPreset", id: "wild" });
    expect(r.options).toMatchObject({ stack: true, drawUntil: true, sevenZero: true, mode: "table" });
    r = act(r, { type: "setOption", key: "eins", value: false });
    expect(currentPreset(getGame("eins"), r.options)).toBeNull();
    expect(changedRules(getGame("eins"), r.options)).toBe(4);
    r = act(r, { type: "setPreset", id: "standard" });
    expect(r.options).toMatchObject({ stack: false, drawUntil: false, sevenZero: false, eins: true, target: "500", mode: "table" });
    expect(changedRules(getGame("eins"), r.options)).toBe(0);
  });

  it("nur Host, nur in der Lobby, nur bekannte Pakete", () => {
    const r = roomWith(["Anna", "Ben"], "ludo");
    expect(() => act(r, { type: "setPreset", id: "streng" }, "p2")).toThrow(/nur der Host/);
    expect(() => act(r, { type: "setPreset", id: "gibtsnicht" })).toThrow(/gibt es nicht/);
    expect(() => act(act(r, { type: "start" }), { type: "setPreset", id: "streng" })).toThrow(/Lobby/);
    expect(presetKeys(getGame("ludo"))).not.toContain("dice");
  });
});
