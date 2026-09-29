import { describe, expect, it } from "vitest";
import { buildONDeck, resolveNight, type ONRole, type ONState } from "@shared/games/einenacht/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const g = (r: RoomState) => r.game as ONState;
function start(n: number, online = false, options: Record<string, unknown> = {}) {
  let r = roomWith(["Anna", "Ben", "Cem", "Dora", "Emil", "Finn"].slice(0, n), "einenacht");
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value: value as never });
  return act(r, { type: "start" }, online ? "p1" : null);
}
function withCards(r: RoomState, start: Record<string, ONRole>, center: ONRole[]): RoomState {
  return { ...r, game: { ...g(r), start, center } };
}
const w = (r: RoomState, a: Record<string, unknown> & { type: string }, actor: string | null = null) => game(r, a, actor);

describe("Eine Nacht", () => {
  it("Deck: Spieler + 3 Karten, Freimaurer zu zweit", () => {
    expect(buildONDeck(5, { seherin: true, freimaurer: true })).toHaveLength(8);
    expect(buildONDeck(5, { freimaurer: true }).filter((x) => x === "freimaurer")).toHaveLength(2);
    const s = g(start(4));
    expect(Object.keys(s.start)).toHaveLength(4);
    expect(s.center).toHaveLength(3);
  });

  it("Tausche in der richtigen Reihenfolge: Räuber, Unruhestifter, Betrunkener", () => {
    const s = g(start(4));
    const st: ONState = {
      ...s, start: { p1: "raeuber", p2: "werwolf", p3: "unruhestifter", p4: "betrunkener" }, center: ["seherin", "dorf", "gerber"],
      robber: "p2", trouble: ["p1", "p4"], drunk: 2,
    };
    const { cards, center } = resolveNight(st);
    // Räuber nimmt Werwolf → p1 Werwolf, p2 Räuber; Unruhestifter tauscht p1<->p4 → p1 Betrunkener, p4 Werwolf; Betrunkener (Startrolle bei p4) tauscht mit Mitte 2
    expect(cards).toEqual({ p1: "betrunkener", p2: "raeuber", p3: "unruhestifter", p4: "gerber" });
    expect(center[2]).toBe("werwolf");
  });

  it("online: alle handeln parallel, am Morgen wird aufgelöst; geheime Sicht", () => {
    let r = start(4, true);
    r = withCards(r, { p1: "seherin", p2: "werwolf", p3: "raeuber", p4: "dorf" }, ["werwolf", "dorf", "schlaflose"]);
    for (const id of ["p1", "p2", "p3", "p4"]) r = w(r, { type: "ready" }, id);
    expect(g(r).phase).toBe("night");
    const v4 = g(viewRoom(r, "p4"));
    expect(v4.start.p2).toBe("?");
    expect(v4.center).toEqual(["?", "?", "?"]);
    r = w(r, { type: "see", player: "p2" }, "p1");
    expect(g(viewRoom(r, "p1")).start.p2).toBe("werwolf");
    r = w(r, { type: "rob", target: "p2" }, "p3");
    expect(g(viewRoom(r, "p3")).final!.p3).toBe("werwolf");
    r = w(r, { type: "peek", i: 0 }, "p2");
    r = w(r, { type: "nightDone" }, "p4");
    expect(g(r).phase).toBe("day");
    expect(g(r).final).toMatchObject({ p2: "raeuber", p3: "werwolf" });
    // Abstimmung: p3 (jetzt Werwolf) stirbt → Dorf gewinnt
    for (const id of ["p1", "p2", "p4"]) r = w(r, { type: "vote", target: "p3" }, id);
    r = w(r, { type: "vote", target: "p1" }, "p3");
    expect(g(r).dead).toEqual(["p3"]);
    expect(g(r).winners).toEqual(["dorf"]);
  });

  it("jeder eine Stimme: niemand stirbt – dann gewinnen die Wölfe", () => {
    let r = start(3, true);
    r = withCards(r, { p1: "werwolf", p2: "dorf", p3: "dorf" }, ["dorf", "dorf", "werwolf"]);
    r = w(r, { type: "startNight" }, "p1");
    for (const id of ["p1", "p2", "p3"]) r = w(r, { type: "nightDone" }, id);
    r = w(w(w(r, { type: "vote", target: "p2" }, "p1"), { type: "vote", target: "p3" }, "p2"), { type: "vote", target: "p1" }, "p3");
    expect(g(r).dead).toEqual([]);
    expect(g(r).winners).toEqual(["werwolf"]);
  });

  it("Gerber gewinnt, wenn er stirbt; Jäger nimmt jemanden mit", () => {
    let r = start(4, true);
    r = withCards(r, { p1: "gerber", p2: "jaeger", p3: "werwolf", p4: "dorf" }, ["dorf", "dorf", "dorf"]);
    r = w(r, { type: "startNight" }, "p1");
    for (const id of ["p1", "p2", "p3", "p4"]) r = w(r, { type: "nightDone" }, id);
    r = w(r, { type: "vote", target: "p3" }, "p2");
    r = w(w(r, { type: "vote", target: "p2" }, "p1"), { type: "vote", target: "p2" }, "p3");
    r = w(r, { type: "vote", target: "p1" }, "p4");
    expect(g(r).dead.sort()).toEqual(["p2", "p3"]);
    expect(g(r).winners).toEqual(["dorf"]);
  });

  it("Betrunkener muss tauschen; lokal Schritt für Schritt", () => {
    let r = start(3);
    r = withCards(r, { p1: "betrunkener", p2: "werwolf", p3: "dorf" }, ["seherin", "dorf", "dorf"]);
    r = w(r, { type: "startNight" });
    while (g(r).phase === "night") {
      const step = g(r).pending[0];
      if (step === "betrunkener") {
        expect(() => w(r, { type: "next" })).toThrow(/tauschen/);
        r = w(r, { type: "drunk", i: 0 });
      }
      r = w(r, { type: "next" });
    }
    expect(g(r).final!.p1).toBe("seherin");
    r = w(r, { type: "lynch", targets: ["p2"] });
    expect(g(r).winners).toEqual(["dorf"]);
  });
});
