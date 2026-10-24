import { describe, expect, it } from "vitest";
import { sanitizeOption } from "@shared/platform/room";
import { GAME_IDS, getGame } from "@shared/games";
import { changedRules, currentPreset, presetKeys, presetsOf, presetValues } from "@shared/platform/presets";
import { addPlayer } from "@shared/platform/room";
import { autoWolves, buildDeck } from "@shared/games/werwolf/logic";
import { act, roomWith } from "./helpers";

describe("Regelpakete", () => {
  it("jedes Paket nutzt echte Einstellungen mit gültigen Werten, weicht vom Standard ab und ist eindeutig erkennbar", () => {
    for (const id of GAME_IDS) {
      const logic = getGame(id);
      expect(logic.presets?.length ?? 0, id).toBeLessThanOrEqual(2);
      for (const p of logic.presets ?? []) {
        if (!p.byPlayers) expect(Object.keys(p.options).length, `${id}/${p.id}`).toBeGreaterThan(0);
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
        expect(currentPreset(logic, s.options, s.players.length), `${id}/${p.id}`).toBe(p.id);
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

  it("gestaffelte Pakete: bei jeder Spielerzahl gültig und eindeutig, nie gleich Standard", () => {
    for (const id of GAME_IDS) {
      const logic = getGame(id);
      for (const p of logic.presets ?? []) {
        if (!p.byPlayers) continue;
        for (let n = logic.info.minPlayers; n <= logic.info.maxPlayers; n++) {
          const o = p.byPlayers(n);
          for (const [k, v] of Object.entries(o)) {
            const def = logic.settings.find((d) => d.key === k);
            expect(def, `${id}/${p.id}: ${k}`).toBeDefined();
            expect(sanitizeOption(def!, v), `${id}/${p.id}/${n}: ${k}`).toBe(v);
          }
          const values = presetValues(logic, p, n);
          expect(currentPreset(logic, values, n), `${id}/${p.id}/${n}`).toBe(p.id);
        }
      }
    }
  });

  it("Werwolf: Rollen nach Spielerzahl, Paket bleibt bei Beitritt und Abgang gewählt", () => {
    const ww = getGame("werwolf");
    const roles = (o: Record<string, unknown>) => ["seherin", "hexe", "jaeger", "amor"].filter((r) => o[r] === true);
    const at = (pid: string, n: number) => roles(presetValues(ww, ww.presets!.find((p) => p.id === pid)!, n));
    expect(at("einsteiger", 5)).toEqual([]);
    expect(at("einsteiger", 6)).toEqual(["seherin"]);
    expect(at("einsteiger", 7)).toEqual(["seherin", "hexe"]);
    expect(at("einsteiger", 12)).toEqual(["seherin", "hexe"]);
    expect(at("komplex", 5)).toEqual(["seherin", "jaeger"]);
    expect(at("komplex", 6)).toEqual(["seherin", "hexe", "jaeger"]);
    expect(at("komplex", 7)).toEqual(["seherin", "hexe", "jaeger", "amor"]);
    expect(at("komplex", 12)).toEqual(["seherin", "hexe", "jaeger", "amor"]);
    // Jede Staffel lässt sich wirklich spielen (Werwölfe automatisch)
    for (const pid of ["einsteiger", "komplex"]) for (let n = 5; n <= 20; n++) {
      const deck = buildDeck(n, { ...presetValues(ww, ww.presets!.find((p) => p.id === pid)!, n), wolves: "auto" });
      expect(deck.length, `${pid}/${n}`).toBe(n);
      expect(deck.filter((r) => r === "werwolf").length, `${pid}/${n}`).toBe(autoWolves(n));
    }

    let r = roomWith(["Anna", "Ben", "Cem", "Dana", "Eli"], "werwolf");
    r = act(r, { type: "setPreset", id: "komplex" });
    expect(roles(r.options)).toEqual(["seherin", "jaeger"]);
    for (const [i, name] of ["Fia", "Gus", "Hanna"].entries()) r = addPlayer(r, { id: `n${i}`, name });
    expect(roles(r.options)).toEqual(["seherin", "hexe", "jaeger", "amor"]);
    expect(currentPreset(ww, r.options, r.players.length)).toBe("komplex");
    r = act(act(r, { type: "removePlayer", id: "n2" }), { type: "removePlayer", id: "n1" });
    expect(roles(r.options)).toEqual(["seherin", "hexe", "jaeger"]);
    expect(currentPreset(ww, r.options, r.players.length)).toBe("komplex");
    // Selbst geändert: „Eigene“ bleibt, auch wenn jemand dazukommt
    r = act(r, { type: "setOption", key: "parity", value: true });
    expect(currentPreset(ww, r.options, r.players.length)).toBeNull();
    const n = changedRules(ww, r.options);
    r = addPlayer(r, { id: "n9", name: "Ida" });
    expect(currentPreset(ww, r.options, r.players.length)).toBeNull();
    expect(r.options.amor).toBe(false);
    expect(changedRules(ww, r.options)).toBe(n);
    // Standard bleibt Standard
    let s = act(roomWith(["Anna", "Ben", "Cem", "Dana", "Eli"], "werwolf"), { type: "setPreset", id: "standard" });
    s = addPlayer(s, { id: "x", name: "Xa" });
    expect(currentPreset(ww, s.options, s.players.length)).toBe("standard");
  });
});
