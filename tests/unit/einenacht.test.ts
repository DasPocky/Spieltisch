import { describe, expect, it } from "vitest";
import { buildONDeck, resolveNight, type ONRole, type ONState } from "@shared/games/einenacht/logic";
import { viewRoom, type RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
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

  describe("Sieg nach Originalregeln", () => {
    /** Lokal ohne Tausch direkt in den Tag, dann die Toten eintragen */
    function verdict(cards: Record<string, ONRole>, center: ONRole[], dead: string[]) {
      let r = withCards(start(Object.keys(cards).length), cards, center);
      r = w(r, { type: "startNight" });
      while (g(r).phase === "night") r = w(r, { type: "next" });
      return g(w(r, { type: "lynch", targets: dead })).winners;
    }
    const noWolf = { p1: "guenstling", p2: "dorf", p3: "seherin", p4: "gerber" } as Record<string, ONRole>;
    const mid: ONRole[] = ["werwolf", "werwolf", "dorf"];

    it("keine Werwölfe unter den Spielern: Dorf gewinnt nur, wenn niemand stirbt", () => {
      expect(verdict(noWolf, mid, [])).toEqual(["dorf"]);
    });
    it("… stirbt jemand anderes, gewinnt der Günstling – auch wenn er selbst mitstirbt", () => {
      expect(verdict(noWolf, mid, ["p2"])).toEqual(["werwolf"]);
      expect(verdict(noWolf, mid, ["p1", "p2"])).toEqual(["werwolf"]);
    });
    it("… stirbt nur der Günstling, gewinnt niemand", () => {
      expect(verdict(noWolf, mid, ["p1"])).toEqual([]);
    });
    it("Gerber stirbt: nur er gewinnt – mit totem Werwolf auch das Dorf", () => {
      expect(verdict(noWolf, mid, ["p4", "p2"])).toEqual(["gerber"]);
      expect(verdict({ p1: "werwolf", p2: "dorf", p3: "gerber" }, ["dorf", "dorf", "dorf"], ["p3"])).toEqual(["gerber"]);
      expect(verdict({ p1: "werwolf", p2: "dorf", p3: "gerber" }, ["dorf", "dorf", "dorf"], ["p1", "p3"])).toEqual(["gerber", "dorf"]);
    });
    it("Günstling stirbt, kein Werwolf: die Werwölfe gewinnen trotzdem", () => {
      expect(verdict({ p1: "werwolf", p2: "guenstling", p3: "dorf" }, ["dorf", "dorf", "dorf"], ["p2"])).toEqual(["werwolf"]);
    });
  });
});

describe("Eine Nacht mit eigenen Karten", () => {
  it("App erzählt nur: Schritte aus den Einstellungen, Host trägt Gewinner ein", () => {
    let r = act(roomWith(["Anna", "Ben", "Cem"]), { type: "selectGame", gameId: "einenacht" });
    r = act(r, { type: "setOption", key: "cards", value: "own" });
    r = act(r, { type: "setOption", key: "schlaflose", value: true });
    r = act(r, { type: "start" }, "p1");
    const s = () => r.game as ONState;
    expect(s().own).toBe(true);
    r = game(r, { type: "startNight" }, "p1");
    expect(s().pending).toEqual(["sleep", "werwolf", "seherin", "raeuber", "unruhestifter", "schlaflose"]);
    expect(() => game(r, { type: "next" }, "p2")).toThrow(/Host/);
    while (s().phase === "night") r = game(r, { type: "next" }, "p1");
    expect(s().phase).toBe("day");
    expect(() => game(r, { type: "lynch", targets: ["p2"] }, "p1")).toThrow(/eigenen/);
    expect(() => game(r, { type: "settle", team: "dorf", winners: ["p1"] }, "p2")).toThrow();
    r = game(r, { type: "settle", team: "werwolf", winners: ["p2"] }, "p1");
    expect(s().phase).toBe("over");
    const res = getGame("einenacht").results!(r.game, { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0 });
    expect(res.filter((x) => x.won).map((x) => x.id)).toEqual(["p2"]);
  });
});

describe("Eine Nacht: Tempo", () => {
  it("„Eigene“ stellt die Nachtzeiten ein, die Diskussion bleibt bei „minutes“", async () => {
    const { tempoOf } = await import("@shared/games/werwolf/tempo");
    const keys = getGame("einenacht").settings.map((d) => d.key);
    expect(keys).toEqual(expect.arrayContaining(["tempo", "tRole", "tWolves", "tInfo", "minutes", "ambience"]));
    expect(keys).not.toContain("tTalk");
    const r = start(4, false, { tempo: "custom", tRole: 40, tWolves: 50, minutes: 7 });
    expect(tempoOf(r.options)).toMatchObject({ role: 40, wolves: 50, info: 8 });
    expect(g(r).minutes).toBe(7);
  });
});
