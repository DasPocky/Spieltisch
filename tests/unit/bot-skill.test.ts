import { describe, expect, it, vi } from "vitest";
import type { VierState } from "@shared/games/vier/logic";
import { allCaptures, type DameState } from "@shared/games/dame/logic";
import { chooseBotMove, seeded, type BotLevel } from "@shared/platform/botSkill";
import { botMove } from "@shared/platform/bots";
import { roomGame, viewRoom } from "@shared/platform/room";
import { act, game, roomWith } from "./helpers";

/** Mit Bots nur App-Würfel: echte Würfel tippt ein Mensch ein */
const BOT_OPTIONS: Record<string, Record<string, unknown>> = { alles: { diceMode: "app", target: 1000 }, stapelbau: { stock: "10" }, zehnphasen: { goal: "5" } };
const start = (gameId: string, names = ["A", "B"]) => {
  let r = act(roomWith(names, gameId), { type: "selectGame", gameId }, "p1");
  for (const [key, value] of Object.entries(BOT_OPTIONS[gameId] ?? {})) r = act(r, { type: "setOption", key, value: value as never }, "p1");
  return act(r, { type: "start" }, "p1");
};

/**
 * Eine Partie zwischen zwei Bots – gibt die Gewinner zurück. Ganz wiederholbar: auch Mischen, Austeilen und Würfeln
 * laufen über den Startwert (sonst schwankt das Ergebnis von Lauf zu Lauf, und ein roter Lauf ließe sich nicht nachspielen).
 */
function duel(gameId: string, levels: Record<string, BotLevel>, seed: string): string[] {
  const rand = seeded(`deal:${seed}`);
  const spy = vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(arr: T): T => {
    const v = arr as unknown as Uint8Array | Uint32Array;
    const max = v instanceof Uint8Array ? 256 : 4294967296;
    for (let i = 0; i < v.length; i++) v[i] = Math.floor(rand() * max);
    return arr;
  });
  // feste Uhr: Fristen (Zugzeit) stehen im Zustand und fließen in den Bot-Zufall ein
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  try { return play(gameId, levels, seed); } finally { spy.mockRestore(); clock.mockRestore(); }
}
function play(gameId: string, levels: Record<string, BotLevel>, seed: string): string[] {
  let r = start(gameId, Object.keys(levels).map((_, i) => "ABCD"[i]));
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
  it("Eine ganze Partie ist mit demselben Startwert wiederholbar (Austeilen eingeschlossen)", () => {
    const levels: Record<string, BotLevel> = { p1: "schwer", p2: "zufall", p3: "zufall" };
    const a = duel("hellseher", levels, "wdh1"), b = duel("hellseher", levels, "wdh1");
    expect(b).toEqual(a);
    const deal = (seed: string) => { const rand = seeded(`deal:${seed}`); return [rand(), rand()]; };
    expect(deal("x")).toEqual(deal("x"));
  }, 60_000);

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

describe("Bots mit Spielstärke: Brett- und Würfelspiele", () => {
  /** Anteil der entschiedenen Partien, die „schwer“ gegen „zufall“ gewinnt */
  function share(gameId: string, n: number) {
    let strong = 0, games = 0;
    for (let k = 0; k < n; k++) {
      // Hellseher und Glückssieben brauchen drei: einer stark, zwei zufällig (Zufall gewänne jede dritte)
      const levels: Record<string, BotLevel> = gameId === "hellseher" || gameId === "glueckssieben"
        ? (k % 3 === 0 ? { p1: "schwer", p2: "zufall", p3: "zufall" } : k % 3 === 1 ? { p1: "zufall", p2: "schwer", p3: "zufall" } : { p1: "zufall", p2: "zufall", p3: "schwer" })
        : k % 2 ? { p1: "schwer", p2: "zufall" } : { p1: "zufall", p2: "schwer" };
      const w = duel(gameId, levels, `${gameId}${k}`);
      if (w.length === 1) { games++; if (levels[w[0]] === "schwer") strong++; }
    }
    return { strong, games };
  }
  // Feste Partien (Startwert je Partie): das Ergebnis ist bei jedem Lauf gleich. Gemessen mit 150 zufälligen Partien
  // gewinnt Hellseher „schwer“ 143 (95 %) – mit zufälligem Austeilen fiel er bei 9 Partien rund jeden 14. Lauf unter 80 %.
  it.each([["dame", 10, 0.8], ["muehle", 10, 0.8], ["ludo", 80, 0.55], ["fuenfwuerfel", 10, 0.9], ["alles", 40, 0.6], ["maexchen", 30, 0.6], ["fischen", 400, 0.52], ["hellseher", 9, 0.8], ["stapelbau", 10, 0.8], ["himmelskarten", 10, 0.8], ["glueckssieben", 30, 0.5], ["zehnphasen", 10, 0.8], ["palast", 30, 0.7], ["zahlenromme", 40, 0.65]] as const)("%s: schwer schlägt Zufall deutlich", (gameId, n, min) => {
    const { strong, games } = share(gameId, n);
    expect(games).toBeGreaterThanOrEqual(n * 0.6);
    expect(strong / games).toBeGreaterThanOrEqual(min);
  }, 300_000);

  it("Dame (schwer): schlägt lieber, als einen Stein herzuschenken", () => {
    const r = start("dame");
    const s = r.game as DameState;
    const me = s.colors[s.turn];
    const m = chooseBotMove(r, me, "schwer", true, "d")!;
    // Eröffnung: kein Zug, nach dem der Gegner sofort schlagen kann
    const after = m.next.game as DameState;
    expect(allCaptures(after, r.options).length).toBe(0);
  });
});

describe("Bots ohne Bewertung", () => {
  it("Spiele ohne Spielstärke enden trotzdem (kein Hin und Her in derselben Lage)", async () => {
    const { playBot } = await import("@shared/platform/botSkill");
    // echte Würfel (Standard): keine Bewertung möglich
    let r = act(act(roomWith(["A", "B"], "alles"), { type: "selectGame", gameId: "alles" }, "p1"), { type: "start" }, "p1");
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
  it.each([["maumau", [2, 3, 4]], ["eins", [2, 3, 4]], ["vier", [2]], ["fuenfwuerfel", [2, 3]], ["dame", [2]], ["muehle", [2]], ["ludo", [2, 4]], ["alles", [2, 3]], ["maexchen", [2, 4]], ["fischen", [2, 4]], ["hellseher", [3]], ["herzen", [3, 4]], ["palast", [2, 4]], ["zahlenromme", [2, 4]], ["schocken", [2, 4]], ["bluff", [2, 4]], ["ankreuzspiel", [2, 4]], ["stapelbau", [2, 3]], ["himmelskarten", [2, 4]], ["glueckssieben", [3, 4]], ["zehnphasen", [2, 4]]] as const)("%s: jede Stufe, nur erlaubte Züge, jede Partie endet", (gameId, counts) => {
    for (const level of ["zufall", "leicht", "mittel", "schwer"] as BotLevel[]) {
      for (const n of counts) {
        let r = start(gameId, ["A", "B", "C", "D"].slice(0, n));
        // Eins!: eine Runde reicht (sonst bis 500 Punkte)
        if (gameId === "eins") r = { ...r, options: { ...r.options, target: "round" } };
        let i = 0;
        // Alles oder nichts bis 1000 mit Zufallszügen: meist unter 1000 Züge, selten über 3000
        const limit = gameId === "alles" ? 20_000 : 3000;
        for (; i < limit && !roomGame(r).isOver(r.game); i++) {
          // verdeckte Ansage (Hellseher): niemand ist „dran“, jeder sagt für sich an
          const cur = roomGame(r).currentPlayerId(r.game);
          let m: ReturnType<typeof botMove> = null, who = "";
          for (const id of cur ? [cur] : r.players.map((p) => p.id)) {
            // „zufall“ spielt wie die Testspieler der Verwaltung (playBot → botMove)
            m = level === "zufall" ? botMove(r, id, true) : chooseBotMove(r, id, level, true, `${level}:${n}:${i}`);
            if (m) { who = id; break; }
          }
          expect(m, `${level}/${n}: kein Zug bei ${i}`).toBeTruthy();
          // derselbe Zug, frisch über die Regeln geschickt: wird angenommen
          r = act(r, m!.action, who);
        }
        expect(roomGame(r).isOver(r.game), `${level}/${n} endet`).toBe(true);
      }
    }
  }, 60_000);
});
