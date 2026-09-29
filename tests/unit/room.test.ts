import { describe, expect, it } from "vitest";
import { addPlayer, canPlayTurn, createRoom, sanitizeOption, viewRoom } from "@shared/platform/room";
import { GAME_IDS, getGame } from "@shared/games";
import type { TuttoState } from "@shared/games/tutto/logic";
import { act, game, roomWith } from "./helpers";

describe("Spieler & Host", () => {
  it("der erste Spieler wird Host", () => {
    const r = roomWith(["Anna", "Ben"]);
    expect(r.hostId).toBe("p1");
    expect(r.players.map((p) => p.name)).toEqual(["Anna", "Ben"]);
  });

  it("prüft Namen", () => {
    const r = roomWith(["Anna"]);
    expect(() => addPlayer(r, { id: "x", name: "  anna " })).toThrow(/spielt schon mit/);
    expect(() => addPlayer(r, { id: "x", name: "   " })).toThrow(/Namen/);
    expect(addPlayer(r, { id: "x", name: "  Ben   Bo  " }).players[1].name).toBe("Ben Bo");
  });

  it("begrenzt die Spielerzahl", () => {
    const r = roomWith(Array.from({ length: 12 }, (_, i) => `S${i}`));
    expect(() => addPlayer(r, { id: "x", name: "Zu viel" })).toThrow(/Maximal/);
  });

  it("Host-Aktionen nur für den Host", () => {
    const r = roomWith(["Anna", "Ben"]);
    expect(() => act(r, { type: "start" }, "p2")).toThrow(/nur der Host/);
    expect(() => act(r, { type: "setOption", key: "target", value: 3000 }, "p2")).toThrow(/nur der Host/);
    expect(() => act(r, { type: "removePlayer", id: "p1" }, "p2")).toThrow(/nur der Host/);
    expect(act(r, { type: "start" }, "p1").phase).toBe("playing");
  });

  it("Entfernen des Hosts gibt die Host-Rolle weiter", () => {
    const r = act(roomWith(["Anna", "Ben"]), { type: "removePlayer", id: "p1" });
    expect(r.hostId).toBe("p2");
  });

  it("Reihenfolge ändern", () => {
    const r = act(roomWith(["Anna", "Ben", "Cem"]), { type: "movePlayer", id: "p3", dir: -1 });
    expect(r.players.map((p) => p.id)).toEqual(["p1", "p3", "p2"]);
  });
});

describe("Phasen & Einstellungen", () => {
  it("Start, Neue Runde, Lobby", () => {
    let r = act(roomWith(["Anna"]), { type: "start" });
    expect(r.phase).toBe("playing");
    expect(r.round).toBe(1);
    r = act(r, { type: "restart" });
    expect(r.round).toBe(2);
    r = act(r, { type: "toLobby" });
    expect(r.phase).toBe("lobby");
    expect(r.game).toBeNull();
  });

  it("ohne Spieler kein Start", () => {
    expect(() => act(createRoom(), { type: "start" })).toThrow(/Mindestens/);
  });

  it("Einstellungen werden geprüft und begrenzt", () => {
    let r = roomWith(["Anna"]);
    r = act(r, { type: "setOption", key: "target", value: 123456 });
    expect(r.options.target).toBe(50000);
    r = act(r, { type: "setOption", key: "diceMode", value: "quatsch" });
    expect(r.options.diceMode).toBe("real");
    expect(() => act(r, { type: "setOption", key: "gibtsnicht", value: 1 })).toThrow();
    expect(sanitizeOption({ key: "t", label: "t", type: "toggle", default: false }, "true")).toBe(false);
  });

  it("Spielwechsel nur in der Lobby", () => {
    const r = act(roomWith(["Anna"]), { type: "start" });
    expect(() => act(r, { type: "selectGame", gameId: "tutto" })).toThrow(/Lobby/);
    expect(() => act(roomWith(["Anna"]), { type: "selectGame", gameId: "gibtsnicht" })).toThrow(/gibt es nicht/);
  });

  it("jedes Spiel hat gültige Grunddaten", () => {
    for (const id of GAME_IDS) {
      const g = getGame(id);
      expect(g.info.id).toBe(id);
      expect(g.info.minPlayers).toBeGreaterThanOrEqual(1);
      expect(g.info.maxPlayers).toBeGreaterThanOrEqual(g.info.minPlayers);
      for (const s of g.settings) expect(sanitizeOption(s, s.default)).toBe(s.default);
    }
  });
});

describe("Rechte bei Spielzügen", () => {
  const started = () => act(roomWith(["Anna", "Ben", "Cem"]), { type: "start" });

  it("Standard: nur wer dran ist (und der Host)", () => {
    const r = started();
    expect(canPlayTurn(r, "p1")).toBe(true); // Host
    const cur = (r.game as TuttoState).curId;
    const other = ["p2", "p3"].find((id) => id !== cur)!;
    expect(canPlayTurn(r, other)).toBe(false);
    expect(() => game(r, { type: "draw" }, other)).toThrow(/ist am Zug/);
  });

  it("„Alle“ und „Nur Host“", () => {
    let r = act(started(), { type: "setEntry", mode: "all" });
    expect(canPlayTurn(r, "p3")).toBe(true);
    expect(canPlayTurn(r, "fremd")).toBe(false);
    r = act(r, { type: "setEntry", mode: "host" });
    expect(canPlayTurn(r, "p2")).toBe(false);
    expect(() => game(r, { type: "draw" }, "p2")).toThrow(/nur der Host/);
    expect(canPlayTurn(r, "p1")).toBe(true);
  });

  it("Host-Aktionen des Spiels", () => {
    expect(() => game(started(), { type: "shuffle" }, "p2")).toThrow(/nur der Host/);
  });

  it("unbekannte oder kaputte Aktionen", () => {
    expect(() => game(started(), { type: "hack" })).toThrow(/Unbekannte/);
    expect(() => act(started(), { type: "game", action: null as never })).toThrow(/Ungültige/);
    expect(() => game(roomWith(["Anna"]), { type: "draw" })).toThrow(/nicht begonnen/);
  });
});

describe("Sicht pro Spieler", () => {
  it("die Reihenfolge des Kartenstapels bleibt geheim", () => {
    const r = act(roomWith(["Anna"]), { type: "start" });
    const pile = (r.game as TuttoState).pile;
    const seen = (viewRoom(r, "p1").game as TuttoState).pile;
    expect(seen).toEqual([...pile].sort());
    expect((r.game as TuttoState).pile).toBe(pile); // Original unverändert
  });
});
