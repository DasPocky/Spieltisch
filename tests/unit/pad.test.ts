import { describe, expect, it } from "vitest";
import type { F7State } from "@shared/games/glueckssieben/logic";
import type { MauMauState } from "@shared/games/maumau/logic";
import { planStatus, skipBlockedPlan, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

function start(gameId: string, options: Record<string, string | number>, n = 3) {
  let r = act(roomWith(["Anna", "Ben", "Cem"].slice(0, n)), { type: "selectGame", gameId });
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value });
  return act(r, { type: "start" });
}

describe("Punkteblock mit echten Karten", () => {
  it("Glückssieben: Punkte eintragen, nur eigene, Runde abschließen, zurücknehmen, Sieg ab Ziel", () => {
    let r = start("glueckssieben", { mode: "table", target: 100 });
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

describe("Spielabend", () => {
  const finishGlueckssieben = (r: RoomState, pts: [string, number][]) => {
    for (const [id, p] of pts) r = game(r, { type: "padEnter", player: id, points: p });
    return game(r, { type: "padFinish" });
  };

  it("zählt Siege über Partien und Spiele, Rücknahme des Endes zählt nicht", () => {
    let r = start("glueckssieben", { mode: "table", target: 100 });
    r = finishGlueckssieben(r, [["p1", 120], ["p2", 10], ["p3", 0]]);
    expect(r.evening?.wins).toEqual({ p1: 1, p2: 0, p3: 0 });
    expect(r.evening?.log.map((x) => x.gameId)).toEqual(["glueckssieben"]);
    // Ende zurücknehmen: zählt nicht mehr, neu beenden zählt einmal
    r = act(r, { type: "undo" });
    expect(r.evening?.wins.p1).toBe(0);
    expect(r.evening?.log).toHaveLength(0);
    r = game(r, { type: "padFinish" });
    expect(r.evening?.wins.p1).toBe(1);
    // Nochmal: zweite Partie, Ben gewinnt
    r = act(r, { type: "restart" });
    r = finishGlueckssieben(r, [["p1", 0], ["p2", 130], ["p3", 0]]);
    expect(r.evening?.wins).toEqual({ p1: 1, p2: 1, p3: 0 });
    // Anderes Spiel: Wertung bleibt
    r = act(act(r, { type: "toLobby" }), { type: "selectGame", gameId: "fuenfwuerfel" });
    expect(r.evening?.log).toHaveLength(2);
    // Gäste dürfen nicht zurücksetzen, Host schon
    expect(() => act(r, { type: "resetEvening" }, "p2")).toThrow(/Host/);
    r = act(r, { type: "resetEvening" });
    expect(r.evening).toBeUndefined();
  });

  it("Partyabend: Plan legt das erste Spiel fest, nach jeder Partie steht das nächste bereit, am Ende ist er durch", () => {
    let r = roomWith(["Anna", "Ben", "Cem"]);
    expect(() => act(r, { type: "setPlan", games: ["glueckssieben", "fuenfwuerfel"] }, "p2")).toThrow(/Host/);
    expect(() => act(r, { type: "setPlan", games: ["gibtsnicht"] })).toThrow();
    r = act(r, { type: "setPlan", games: ["glueckssieben", "maumau"] });
    expect(r.gameId).toBe("glueckssieben");
    expect(planStatus(r.evening)).toMatchObject({ played: 0, next: "glueckssieben", done: false });
    for (const [key, value] of Object.entries({ mode: "table", target: 100 })) r = act(r, { type: "setOption", key, value });
    r = act(r, { type: "start" });
    r = finishGlueckssieben(r, [["p1", 0], ["p2", 120], ["p3", 0]]);
    expect(planStatus(r.evening)).toMatchObject({ played: 1, next: "maumau" });
    // Ende zurücknehmen: zählt auch für den Plan nicht
    r = act(r, { type: "undo" });
    expect(planStatus(r.evening)?.played).toBe(0);
    r = game(r, { type: "padFinish" });
    // Zurück in die Lobby: das nächste Spiel ist schon gewählt
    r = act(r, { type: "toLobby" });
    expect(r.gameId).toBe("maumau");
    r = act(r, { type: "setOption", key: "mode", value: "table" });
    r = act(r, { type: "start" });
    for (let i = 0; i < 10 && !(r.game as MauMauState).winnerId; i++) r = game(r, { type: "padWin", player: "p1" });
    expect(planStatus(r.evening)).toMatchObject({ played: 2, next: null, done: true });
    expect(r.evening?.wins).toEqual({ p1: 1, p2: 1, p3: 0 });
    // Plan beenden: Wertung bleibt
    r = act(act(r, { type: "toLobby" }), { type: "setPlan", games: null });
    expect(planStatus(r.evening)).toBeNull();
    expect(r.evening?.log).toHaveLength(2);
  });

  it("Partyabend: eine Partie außerhalb des Plans zählt weder für den Abend noch für den Plan, ihr Rückgängig nimmt nichts weg", () => {
    let r = roomWith(["Anna", "Ben", "Cem"]);
    r = act(r, { type: "setPlan", games: ["glueckssieben", "maumau"] });
    for (const [key, value] of Object.entries({ mode: "table", target: 100 })) r = act(r, { type: "setOption", key, value });
    r = act(r, { type: "start" });
    r = finishGlueckssieben(r, [["p1", 120], ["p2", 0], ["p3", 0]]);
    expect(planStatus(r.evening)).toMatchObject({ played: 1, next: "maumau" });
    // Zwischendurch etwas anderes als geplant (nochmal Glückssieben statt Mau-Mau): zählt nicht
    r = act(act(r, { type: "toLobby" }), { type: "selectGame", gameId: "glueckssieben" });
    for (const [key, value] of Object.entries({ mode: "table", target: 100 })) r = act(r, { type: "setOption", key, value });
    r = act(r, { type: "start" });
    r = finishGlueckssieben(r, [["p1", 0], ["p2", 130], ["p3", 0]]);
    expect(r.evening?.wins).toEqual({ p1: 1, p2: 0, p3: 0 });
    expect(r.evening?.log).toHaveLength(1);
    expect(planStatus(r.evening)?.played).toBe(1);
    // Rückgängig des ungeplanten Endes: die geplante Partie davor bleibt gezählt
    r = act(r, { type: "undo" });
    expect(r.evening?.log).toHaveLength(1);
    expect(r.evening?.wins.p1).toBe(1);
    expect(planStatus(r.evening)?.played).toBe(1);
  });

  it("Partyabend: abgeschaltete Spiele im Plan werden übersprungen, das nächste freie steht bereit", () => {
    let r = roomWith(["Anna", "Ben", "Cem"]);
    r = act(r, { type: "setPlan", games: ["glueckssieben", "maumau", "fuenfwuerfel"] });
    const s = structuredClone(r);
    expect(skipBlockedPlan(s, (g) => g !== "glueckssieben" && g !== "maumau")).toEqual(["glueckssieben", "maumau"]);
    expect(planStatus(s.evening)).toMatchObject({ played: 2, next: "fuenfwuerfel" });
    expect(s.gameId).toBe("fuenfwuerfel");
    // Alles frei: nichts passiert; alles gesperrt: Plan ist durch, nichts hängt
    expect(skipBlockedPlan(structuredClone(r), () => true)).toEqual([]);
    const all = structuredClone(r);
    skipBlockedPlan(all, () => false);
    expect(planStatus(all.evening)?.done).toBe(true);
  });
});
