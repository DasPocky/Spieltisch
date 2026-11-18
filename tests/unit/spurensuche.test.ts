import { describe, expect, it } from "vitest";
import {
  ALL_CARDS, botPlan, candidatesFor, cellPos, DOORS, isRoom, matching, PASSAGES, rCard, reachable, roomOf, roomPos, ROOMS, sCard, spurensuche, STARTS,
  SUSPECTS, wCard, WEAPONS, type SpAction, type SpState,
} from "@shared/games/spurensuche/logic";
import type { GameContext, Player } from "@shared/platform/types";

const players: Player[] = ["Anna", "Ben", "Cem", "Dora"].map((name, i) => ({ id: `p${i}`, name } as Player));
const ctx = (n = 4, actorId: string | null = null): GameContext => ({ players: players.slice(0, n), hostId: "p0", actorId, options: {}, now: 0, round: 0 });
const start = (n = 4) => spurensuche.setup(ctx(n));
const act = (s: SpState, a: SpAction, actor: string | null = null, n = 4) => spurensuche.apply(s, a, ctx(n, actor));

/** Feste Lösung und Hände setzen */
function rig(s: SpState, hands: Record<string, string[]>, solution = { suspect: "doktor", weapon: "gift", room: 4 }): SpState {
  const t = structuredClone(s);
  t.hands = hands;
  t.solution = solution;
  return t;
}

describe("Spurensuche: Aufbau", () => {
  it("21 Karten: drei in der Lösung, der Rest verteilt, niemand hat eine Lösungskarte", () => {
    for (const n of [3, 4, 5, 6]) {
      const ps = Array.from({ length: n }, (_, i) => ({ id: `x${i}`, name: `S${i}` } as Player));
      const s = spurensuche.setup({ players: ps, hostId: "x0", actorId: null, options: {}, now: 0 });
      const all = Object.values(s.hands).flat();
      expect(all.length).toBe(18);
      expect(new Set([...all, sCard(s.solution!.suspect), wCard(s.solution!.weapon), rCard(s.solution!.room)])).toEqual(new Set(ALL_CARDS));
      const sizes = Object.values(s.hands).map((h) => h.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      // alle sechs Figuren stehen auf ihren Startfeldern, jedes Werkzeug in einem anderen Raum
      SUSPECTS.forEach((x, i) => expect(s.token[x.id]).toBe(cellPos(...STARTS[i])));
      expect(new Set(Object.values(s.weaponAt)).size).toBe(WEAPONS.length);
    }
  });
  it("Türen liegen auf Flurfeldern direkt neben ihrem Raum", () => {
    DOORS.forEach((doors) => doors.forEach(([r, c]) => expect(isRoom(cellPos(r, c))).toBe(false)));
  });
});

describe("Spurensuche: Bewegung", () => {
  it("Vom Startfeld: mit 2 Schritten nur Flur, mit genug Schritten auch Räume; der Startraum zählt nicht", () => {
    const s = start();
    const few = reachable(s, "graefin", 2);
    expect([...few.keys()].some(isRoom)).toBe(false);
    const many = reachable(s, "graefin", 12);
    expect([...many.keys()].filter(isRoom).length).toBeGreaterThan(0);
    // aus einem Raum heraus: über die Türen, aber nicht zurück in denselben Raum
    const t = structuredClone(s);
    t.token.graefin = roomPos(4);
    const out = reachable(t, "graefin", 12);
    expect(out.has(roomPos(4))).toBe(false);
    expect(out.has(roomPos(1))).toBe(true);
  });
  it("Figuren im Flur versperren den Weg", () => {
    const s = start();
    const t = structuredClone(s);
    // Gräfin steht auf (0,6); der einzige Weg führt über (1,6)
    t.token.kapitaen = cellPos(1, 6);
    expect(reachable(t, "graefin", 12).size).toBe(0);
  });
  it("Würfeln, ziehen, Raum betreten → Verdacht; im Flur → Zug beenden", () => {
    let s = start();
    const cur = s.curId!;
    const me = s.role[cur];
    s = act(s, { type: "roll" });
    expect(s.dice).toHaveLength(2);
    if (s.phase === "moving") {
      const total = s.dice!.reduce((a, b) => a + b, 0);
      const reach = reachable(s, me, total);
      const cell = [...reach.keys()].find((p) => !isRoom(p))!;
      const after = act(s, { type: "move", to: cell });
      expect(after.phase).toBe("after");
      expect(() => act(s, { type: "move", to: cellPos(10, 10) })).toThrow();
      const next = act(after, { type: "end" });
      expect(next.curId).not.toBe(cur);
      expect(next.phase).toBe("move");
    }
  });
  it("Geheimgang: von Ecke zu Ecke, danach Verdacht", () => {
    let s = start();
    const me = s.role[s.curId!];
    s = structuredClone(s);
    s.token[me] = roomPos(0);
    s = act(s, { type: "passage" });
    expect(s.token[me]).toBe(roomPos(PASSAGES[0]));
    expect(s.phase).toBe("suggest");
    const t = structuredClone(s);
    t.phase = "move";
    t.token[me] = roomPos(4);
    expect(() => act(t, { type: "passage" })).toThrow();
  });
});

describe("Spurensuche: Verdacht und Widerlegen", () => {
  const hands = {
    p0: ["s:graefin", "w:brief", "r:lesezimmer", "r:galerie"],
    p1: ["s:kapitaen", "w:schal", "r:turm", "r:jagdzimmer"],
    p2: ["s:rosa", "w:stock", "r:gewaechshaus", "r:weinkeller", "w:gartenschere"],
    p3: ["s:gaertner", "s:koechin", "w:schuerhaken", "r:gesindestube", "r:rauchersalon"],
  };
  function inRoom(room: number) {
    let s = rig(start(), hands);
    s = structuredClone(s);
    s.curId = "p0";
    s.token[s.role.p0] = roomPos(room);
    s.phase = "suggest";
    return s;
  }
  it("Figur und Werkzeug kommen in den Raum, die geholte Figur darf nächstes Mal bleiben", () => {
    let s = inRoom(2);
    s = act(s, { type: "suggest", suspect: s.role.p1, weapon: "gift" });
    expect(s.token[s.role.p1]).toBe(roomPos(2));
    expect(s.weaponAt.gift).toBe(2);
    expect(s.summoned).toContain("p1");
  });
  it("Reihum: der Erste mit einer passenden Karte zeigt – eine passende wird automatisch gezeigt", () => {
    let s = inRoom(2); // Turmzimmer: p1 hat r:turm
    s = act(s, { type: "suggest", suspect: "doktor", weapon: "gift" });
    expect(s.phase).toBe("after");
    expect(s.seen.p0).toEqual([{ card: "r:turm", by: "p1", n: s.n }]);
    expect(s.history.at(-1)!.shownBy).toBe("p1");
    expect(s.history.at(-1)!.passed).toEqual([]);
  });
  it("Mehrere passende: der Widerlegende wählt; wer nichts hat, wird als „konnte nicht“ notiert", () => {
    let s = inRoom(5); // Jagdzimmer: p1 hat r:jagdzimmer + s:kapitaen
    s = act(s, { type: "suggest", suspect: "kapitaen", weapon: "gift" });
    expect(s.phase).toBe("refute");
    expect(s.refuterId).toBe("p1");
    expect(spurensuche.currentPlayerId(s)).toBe("p1");
    expect(() => act(s, { type: "show", card: "r:turm" }, "p1")).toThrow();
    expect(() => act(s, { type: "show", card: "s:kapitaen" }, "p2")).toThrow();
    s = act(s, { type: "show", card: "s:kapitaen" }, "p1");
    expect(s.seen.p0.at(-1)!.card).toBe("s:kapitaen");

    let t = inRoom(4); // Kaminhalle: niemand hat r:kaminhalle; doktor/gift auch nicht (Lösung)
    t = act(t, { type: "suggest", suspect: "doktor", weapon: "gift" });
    expect(t.phase).toBe("after");
    expect(t.history.at(-1)!.shownBy).toBeNull();
    expect(t.history.at(-1)!.passed).toEqual(["p1", "p2", "p3"]);
  });
  it("Sicht: fremde Hände, Lösung und fremde gezeigte Karten bleiben geheim", () => {
    let s = inRoom(2);
    s = act(s, { type: "suggest", suspect: "doktor", weapon: "gift" });
    const v2 = spurensuche.view!(s, "p2");
    expect(v2.solution).toBeNull();
    expect(Object.keys(v2.hands)).toEqual(["p2"]);
    expect(v2.seen.p0).toBeUndefined();
    expect(v2.lastShown!.card).toBeNull();
    expect(spurensuche.view!(s, "p0").lastShown!.card).toBe("r:turm");
    expect(spurensuche.view!(s, "p1").lastShown!.card).toBe("r:turm");
  });
});

describe("Spurensuche: Anklage", () => {
  it("Richtig gewinnt sofort", () => {
    let s = rig(start(), { p0: [], p1: [], p2: [], p3: [] });
    s = structuredClone(s); s.curId = "p0"; s.phase = "move";
    s = act(s, { type: "accuse", suspect: "doktor", weapon: "gift", room: 4 });
    expect(s.phase).toBe("over");
    expect(s.winnerId).toBe("p0");
    expect(spurensuche.results!(s, ctx()).find((r) => r.id === "p0")!.won).toBe(true);
  });
  it("Falsch scheidet aus, zeigt aber weiter Karten; alle falsch → niemand gewinnt", () => {
    let s = rig(start(), { p0: ["r:turm"], p1: [], p2: [], p3: [] });
    s = structuredClone(s); s.curId = "p0"; s.phase = "move";
    s = act(s, { type: "accuse", suspect: "doktor", weapon: "gift", room: 0 });
    expect(s.out).toEqual(["p0"]);
    expect(s.curId).toBe("p1");
    // p1 verdächtigt im Turmzimmer: p0 (raus) widerlegt trotzdem
    s = structuredClone(s); s.token[s.role.p1] = roomPos(2); s.phase = "suggest";
    s = act(s, { type: "suggest", suspect: "doktor", weapon: "gift" });
    expect(s.history.at(-1)!.shownBy).toBe("p0");
    for (const id of ["p1", "p2", "p3"]) {
      s = structuredClone(s); s.curId = id; s.phase = "move";
      s = act(s, { type: "accuse", suspect: "graefin", weapon: "gift", room: 4 });
    }
    expect(s.phase).toBe("over");
    expect(s.winnerId).toBeNull();
  });
});

describe("Spurensuche: nichts bleibt hängen", () => {
  it("Überspringen: beim Widerlegen zeigt die App die erste passende Karte, sonst ist der Nächste dran", () => {
    let s = rig(start(), { p0: [], p1: ["s:kapitaen", "r:jagdzimmer"], p2: [], p3: [] });
    s = structuredClone(s); s.curId = "p0"; s.token[s.role.p0] = roomPos(5); s.phase = "suggest";
    s = act(s, { type: "suggest", suspect: "kapitaen", weapon: "gift" });
    expect(spurensuche.skipLabel!(s, ctx())).toContain("Karte zeigen");
    s = spurensuche.skipTurn!(s, ctx());
    expect(s.phase).toBe("after");
    s = spurensuche.skipTurn!(s, ctx());
    expect(s.curId).toBe("p1");
  });
  it("Wer geht, gibt seine Karten weiter; ist er dran, ist der Nächste dran", () => {
    let s = start();
    const cur = s.curId!;
    s = spurensuche.onPlayerRemoved!(s, cur, ctx());
    expect(s.role[cur]).toBeUndefined();
    expect(s.curId).not.toBe(cur);
    expect(Object.values(s.hands).flat().length).toBe(18);
  });
  it("Bots spielen ganze Partien zu Ende – jeder Zug ist erlaubt", () => {
    for (let game = 0; game < 30; game++) {
      const n = 3 + (game % 4);
      const ps = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot${i}` } as Player));
      const c = (actorId: string | null): GameContext => ({ players: ps, hostId: "b0", actorId, options: {}, now: 0 });
      let s = spurensuche.setup(c(null));
      let steps = 0;
      while (s.phase !== "over" && steps < 4000) {
        const id = spurensuche.currentPlayerId(s)!;
        const plan = botPlan(spurensuche.view!(s, id), id);
        expect(plan.length, `Phase ${s.phase}`).toBeGreaterThan(0);
        s = spurensuche.apply(s, plan[0], c(id));
        steps++;
      }
      expect(s.phase).toBe("over");
      expect(s.winnerId).not.toBeNull();
    }
  });
  it("Bots werten aus, wer nichts zeigen konnte: niemand widerlegt und ich habe nichts davon → Lösung", () => {
    let s = rig(start(), { p0: ["s:graefin"], p1: ["s:kapitaen"], p2: ["s:rosa"], p3: ["s:gaertner"] });
    s = structuredClone(s); s.curId = "p0"; s.token[s.role.p0] = roomPos(4); s.phase = "suggest";
    s = act(s, { type: "suggest", suspect: "doktor", weapon: "gift" });
    expect(s.history.at(-1)!.shownBy).toBeNull();
    const c = candidatesFor(spurensuche.view!(s, "p0"), "p0");
    expect(c).toEqual({ suspects: ["doktor"], weapons: ["gift"], rooms: [4] });
    expect(botPlan(spurensuche.view!(s, "p0"), "p0")[0]).toEqual({ type: "accuse", suspect: "doktor", weapon: "gift", room: 4 });
  });
  it("Bots klagen erst an, wenn sie sicher sind", () => {
    const s = start();
    const id = s.curId!;
    const c = candidatesFor(s, id);
    expect(c.suspects.length + c.weapons.length + c.rooms.length).toBeGreaterThan(3);
    expect(botPlan(spurensuche.view!(s, id), id).some((a) => a.type === "accuse")).toBe(false);
    expect(matching(s, id, { suspect: "x", weapon: "y", room: 0 }).every((c2) => c2 === rCard(0))).toBe(true);
    expect(roomOf(roomPos(3))).toBe(3);
    expect(ROOMS.length).toBe(9);
  });
});
