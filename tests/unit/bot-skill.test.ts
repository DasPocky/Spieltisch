import { describe, expect, it } from "vitest";
import type { VierState } from "@shared/games/vier/logic";
import { chooseBotMove, seeded, type BotLevel } from "@shared/platform/botSkill";
import { roomGame, viewRoom } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

const start = (gameId: string, names = ["A", "B"]) => act(act(roomWith(names, gameId), { type: "selectGame", gameId }, "p1"), { type: "start" }, "p1");

/** Eine Partie zwischen zwei Bots – gibt die Gewinner zurück */
function duel(gameId: string, levels: Record<string, BotLevel>, seed: string): string[] {
  let r = start(gameId);
  for (let i = 0; i < 2000 && !roomGame(r).isOver(r.game); i++) {
    const cur = roomGame(r).currentPlayerId(r.game);
    const ids = cur ? [cur] : r.players.map((p) => p.id);
    let moved = false;
    for (const id of ids) {
      const m = chooseBotMove(r, id, levels[id], true, `${seed}:${i}`);
      if (m) { r = m.next; moved = true; break; }
    }
    if (!moved) break;
  }
  return (roomGame(r).results?.(r.game, { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0, round: r.round }) ?? []).filter((x) => x.won).map((x) => x.id);
}

describe("Bots mit Spielstärke", () => {
  it("Startwert-Zufall ist wiederholbar", () => {
    const a = seeded("x"), b = seeded("x"), c = seeded("y");
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(c()).not.toBe(xs[0]);
  });

  it("dieselbe Lage und derselbe Startwert ergeben denselben Zug", () => {
    const r = start("maumau");
    const cur = roomGame(r).currentPlayerId(r.game)!;
    const m1 = chooseBotMove(r, cur, "mittel", true, "s1");
    const m2 = chooseBotMove(r, cur, "mittel", true, "s1");
    expect(m1?.action).toEqual(m2?.action);
  });

  it("Vier in einer Reihe (schwer): nimmt den Sieg und blockt den des anderen", () => {
    let r = start("vier");
    const [x, o] = (r.game as VierState).colors;
    // x: Spalten 0,1,2 · o: Spalten 6,6 – x ist dran und gewinnt mit Spalte 3
    for (const [who, col] of [[x, 0], [o, 6], [x, 1], [o, 6], [x, 2], [o, 5]] as const) r = game(r, { type: "drop", col }, who);
    expect(chooseBotMove(r, x, "schwer", true, "t")?.action).toEqual({ type: "game", action: { type: "drop", col: 3 } });
    // Andere Lage: o droht mit Spalte 3 zu gewinnen, x muss blocken
    r = start("vier");
    const [x2, o2] = (r.game as VierState).colors;
    for (const [who, col] of [[x2, 6], [o2, 0], [x2, 6], [o2, 1], [x2, 5], [o2, 2]] as const) r = game(r, { type: "drop", col }, who);
    expect(chooseBotMove(r, x2, "schwer", true, "t")?.action).toEqual({ type: "game", action: { type: "drop", col: 3 } });
  });

  it("bewertet nur mit der eigenen Sicht: fremde Hände sind für den Bot verdeckt", () => {
    const r = start("maumau");
    const v = viewRoom(r, "p1").game as { hands: Record<string, string[]> };
    expect(v.hands.p2 ?? []).toHaveLength(0);
  });

  it("Schwer schlägt Zufall bei Vier in einer Reihe deutlich", () => {
    let strong = 0;
    for (let k = 0; k < 20; k++) {
      // abwechselnd anfangen
      const levels: Record<string, BotLevel> = k % 2 ? { p1: "schwer", p2: "zufall" } : { p1: "zufall", p2: "schwer" };
      const w = duel("vier", levels, `v${k}`);
      if (w.length === 1 && levels[w[0]] === "schwer") strong++;
    }
    expect(strong).toBeGreaterThanOrEqual(16);
  });

  it("Schwer gewinnt bei Mau-Mau öfter als Zufall", () => {
    let strong = 0, games = 0;
    for (let k = 0; k < 40; k++) {
      const levels: Record<string, BotLevel> = k % 2 ? { p1: "schwer", p2: "zufall" } : { p1: "zufall", p2: "schwer" };
      const w = duel("maumau", levels, `m${k}`);
      if (w.length === 1) { games++; if (levels[w[0]] === "schwer") strong++; }
    }
    expect(games).toBeGreaterThan(30);
    expect(strong / games).toBeGreaterThan(0.6);
  });
});

describe("Bots ohne Bewertung", () => {
  it("Spiele ohne Spielstärke enden trotzdem (kein Hin und Her in derselben Lage)", async () => {
    const { playBot } = await import("@shared/platform/botSkill");
    let r = start("alles");
    r = { ...r, bots: ["p1", "p2"], botLevels: { p1: "mittel", p2: "schwer" } };
    const seen = new Set<string>();
    for (let i = 0; i < 300 && !roomGame(r).isOver(r.game); i++) {
      const cur = roomGame(r).currentPlayerId(r.game)!;
      const m = playBot(r, cur, false);
      if (!m) break;
      r = m.next;
      seen.add(cur);
    }
    // beide sind mindestens einmal drangekommen – keiner hängt in einer Schleife
    expect(seen.size).toBe(2);
  });
});

describe("Abnahme: Bots", () => {
  it.each([["maumau", [2, 3, 4]], ["eins", [2, 3, 4]], ["vier", [2]], ["fuenfwuerfel", [2, 3]]] as const)("%s: jede Stufe, nur erlaubte Züge, jede Partie endet", (gameId, counts) => {
    for (const level of ["zufall", "leicht", "mittel", "schwer"] as BotLevel[]) {
      for (const n of counts) {
        let r = start(gameId, ["A", "B", "C", "D"].slice(0, n));
        // Eins!: eine Runde reicht (sonst bis 500 Punkte)
        if (gameId === "eins") r = { ...r, options: { ...r.options, target: "round" } };
        let i = 0;
        for (; i < 3000 && !roomGame(r).isOver(r.game); i++) {
          const cur = roomGame(r).currentPlayerId(r.game)!;
          const m = chooseBotMove(r, cur, level, true, `${level}:${n}:${i}`);
          expect(m, `${level}/${n}: kein Zug bei ${i}`).toBeTruthy();
          // derselbe Zug, frisch über die Regeln geschickt: wird angenommen
          r = act(r, m!.action, cur);
        }
        expect(roomGame(r).isOver(r.game), `${level}/${n} endet`).toBe(true);
      }
    }
  }, 60_000);
});
