import { describe, expect, it } from "vitest";
import type { F7State } from "@shared/games/flip7/logic";
import type { MauMauState } from "@shared/games/maumau/logic";
import type { RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

function start(gameId: string, options: Record<string, string | number>, n = 3) {
  let r = act(roomWith(["Anna", "Ben", "Cem"].slice(0, n)), { type: "selectGame", gameId });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}

describe("Punkteblock mit echten Karten", () => {
  it("Flip 7: Punkte eintragen, nur eigene, Runde abschließen, zurücknehmen, Sieg ab Ziel", () => {
    let r = start("flip7", { mode: "table", target: 100 });
    const g = (x: RoomState) => x.game as F7State;
    expect(g(r).curId).toBeNull();
    expect(() => game(r, { type: "hit" })).toThrow(/Punkte/);
    r = game(r, { type: "padEnter", player: "p1", points: 40 });
    expect(() => game(r, { type: "padEnter", player: "p3", points: 5 }, "p2")).toThrow(/eigenen/);
    r = game(r, { type: "padEnter", points: 25 }, "p2");
    expect(() => game(r, { type: "padFinish" })).toThrow(/Cem/);
    r = game(r, { type: "padEnter", player: "p3", points: 0 });
    expect(() => game(r, { type: "padFinish" }, "p2")).toThrow(/Host/);
    r = game(r, { type: "padFinish" });
    expect(g(r).scores).toEqual({ p1: 40, p2: 25, p3: 0 });
    r = game(r, { type: "padUndo" });
    expect(g(r).scores.p1).toBe(0);
    expect(g(r).pad!.entries.p1).toBe(40);
    r = game(r, { type: "padFinish" });
    for (const [id, pts] of [["p1", 70], ["p2", 10], ["p3", 80]] as const) r = game(r, { type: "padEnter", player: id, points: pts });
    r = game(r, { type: "padFinish" });
    expect(g(r).winners).toEqual(["p1"]);
    expect(r.phase === "playing" && g(r).winners.length).toBeTruthy();
  });

  it("Mau-Mau: Rundensiege zählen bis zum Ziel", () => {
    let r = start("maumau", { mode: "table", goal: "3" }, 2);
    const g = (x: RoomState) => x.game as MauMauState;
    expect(() => game(r, { type: "draw" })).toThrow(/Siege/);
    expect(() => game(r, { type: "padWin", player: "p2" }, "p2")).toThrow();
    for (let i = 0; i < 2; i++) r = game(r, { type: "padWin", player: "p2" });
    r = game(r, { type: "padWin", player: "p1" });
    expect(g(r).winnerId).toBeNull();
    r = game(r, { type: "padWin", player: "p2" });
    expect(g(r).winnerId).toBe("p2");
  });
});
