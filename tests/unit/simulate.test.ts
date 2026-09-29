/**
 * „Nichts bleibt hängen“: Zufalls-Bots spielen viele komplette Partien jedes Spiels.
 * In jedem Zustand muss es einen erlaubten Zug geben, jede Partie muss enden,
 * und außer GameError darf nichts geworfen werden. Karten dürfen nicht verloren gehen.
 */
import { describe, expect, it } from "vitest";
import { DECKS } from "@shared/cards/deck";
import { ALL_CATS, type KniffelState } from "@shared/games/kniffel/logic";
import type { FischenState } from "@shared/games/fischen/logic";
import type { MauMauState } from "@shared/games/maumau/logic";
import type { WerwolfState } from "@shared/games/werwolf/logic";
import { POINT_STEPS } from "@shared/games/tutto/logic";
import { applyRoomAction, roomGame, skipLabel, type RoomAction, type RoomState } from "@shared/platform/room";
import { GameError } from "@shared/platform/types";
import { act, roomWith } from "./helpers";

type Move = { action: RoomAction; actor: string | null };
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const g = (a: { type: string } & Record<string, unknown>): RoomAction => ({ type: "game", action: a });

function shuffleInPlace<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
  return xs;
}

/** Mögliche Züge je Spiel – bewusst großzügig, ungültige werden von der Logik abgelehnt */
function candidates(r: RoomState, online: boolean): Move[] {
  const ids = r.players.map((p) => p.id);
  const anyone = (a: RoomAction): Move[] => (online ? ids.map((id) => ({ action: a, actor: id })) : [{ action: a, actor: null }]);
  const moves: Move[] = [];
  const add = (a: { type: string } & Record<string, unknown>) => moves.push(...anyone(g(a)));
  switch (r.gameId) {
    case "tutto":
      ["draw", "roll", "book", "clearPts", "double", "clover"].forEach((type) => add({ type }));
      add({ type: "book", zero: true });
      for (let i = 0; i < 6; i++) add({ type: "toggleDie", i });
      add({ type: "addPts", delta: pick(POINT_STEPS) });
      break;
    case "kniffel": {
      const s = r.game as KniffelState;
      add({ type: "roll" });
      for (let i = 0; i < 5; i++) add({ type: "hold", i });
      for (const cat of ALL_CATS) for (const value of [0, 5, 10, 12, 20, 25, 30, 40, 50]) {
        add({ type: "score", cat, value });
        if (s.sheets && Math.random() < 0.1) add({ type: "score", cat, value, extra: true });
      }
      break;
    }
    case "maumau": {
      const s = r.game as MauMauState;
      const hand = s.hands[s.curId ?? ""] ?? [];
      for (const card of hand) add({ type: "play", card, wish: pick(DECKS[s.deck].suits), mau: Math.random() < 0.8 });
      add({ type: "draw" });
      add({ type: "pass" });
      break;
    }
    case "fischen":
      for (const target of ids) for (const rank of DECKS[(r.game as FischenState).deck].ranks) add({ type: "ask", target, rank });
      break;
    case "werwolf": {
      const s = r.game as WerwolfState;
      const alive = Object.keys(s.roles).filter((id) => s.alive[id]);
      const t = () => pick(alive.length ? alive : ids);
      ["ready", "startNight", "next", "closeVote"].forEach((type) => add({ type }));
      add({ type: "dog", wolf: Math.random() < 0.5 });
      add({ type: "infect", yes: Math.random() < 0.5 });
      add({ type: "raven", target: null });
      for (const a of alive) add({ type: "amor", a, b: pick(alive.filter((x) => x !== a)) });
      for (const target of alive) ["protect", "wolf", "wolf2", "see", "fox", "raven", "model", "suspect", "shoot", "vote", "lynch"].forEach((type) => add({ type, target }));
      add({ type: "witch", heal: Math.random() < 0.3, poison: Math.random() < 0.3 ? t() : null });
      add({ type: "witch", heal: false, poison: null });
      add({ type: "vote", target: "" });
      add({ type: "lynch", target: null });
      break;
    }
  }
  return moves;
}

/** Karten müssen erhalten bleiben (32 bzw. 52) */
function checkCards(r: RoomState) {
  if (r.gameId === "maumau") {
    const s = r.game as MauMauState;
    const all = [...s.pile, ...s.discard, ...Object.values(s.hands).flat()];
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(DECKS[s.deck].suits.length * DECKS[s.deck].ranks.length);
  }
  if (r.gameId === "fischen") {
    const s = r.game as FischenState;
    const n = s.pile.length + Object.values(s.hands).flat().length + Object.values(s.quartets).flat().length * 4;
    expect(n).toBe(DECKS[s.deck].suits.length * DECKS[s.deck].ranks.length);
  }
}

function playOut(start: RoomState, online: boolean, maxSteps = 4000) {
  let r = start;
  for (let step = 0; step < maxSteps; step++) {
    const logic = roomGame(r);
    if (r.phase !== "playing" || logic.isOver(r.game)) return { r, steps: step };
    // Ab und zu hängt jemand – dann überspringt der Host
    if (Math.random() < 0.02 && skipLabel(r)) {
      r = applyRoomAction(r, { type: "skip" }, online ? r.hostId : null);
      checkCards(r);
      continue;
    }
    let moved = false;
    const errors = new Set<string>();
    for (const m of shuffleInPlace(candidates(r, online))) {
      try {
        r = applyRoomAction(r, m.action, m.actor);
        moved = true;
        break;
      } catch (e) {
        if (!(e instanceof GameError)) throw e;
        errors.add(e.message);
      }
    }
    // Solange alle mitspielen, muss es immer einen erlaubten Zug geben
    if (!moved) throw new Error(`Festgefahren in ${r.gameId} (${[...errors].filter((m) => !m.includes("schon eingetragen")).slice(0, 20).join(" | ")}): ${JSON.stringify(r.game).slice(0, 800)}`);
    checkCards(r);
  }
  throw new Error(`${start.gameId}: Partie nach ${maxSteps} Schritten nicht beendet`);
}

function setupRoom(gameId: string, n: number, options: Record<string, unknown>, online: boolean) {
  const names = Array.from({ length: n }, (_, i) => `Spieler${i + 1}`);
  let r = roomWith(names, gameId);
  for (const [key, value] of Object.entries(options)) r = act(r, { type: "setOption", key, value: value as never });
  if (online && gameId !== "werwolf") r = act(r, { type: "setEntry", mode: "turn" });
  return act(r, { type: "start" }, online ? "p1" : null);
}

const SCENARIOS: [string, number, Record<string, unknown>][] = [
  ["tutto", 3, { target: 1000 }],
  ["tutto", 2, { target: 1000, diceMode: "app" }],
  ["kniffel", 3, {}],
  ["kniffel", 2, { diceMode: "real", extraKniffel: true }],
  ["maumau", 4, {}],
  ["maumau", 2, { reverse9: true, againA: true, unterOnUnter: true, stack7: false, deck: "de32" }],
  ["maumau", 7, { deck: "fr52", hand: "6" }],
  ["fischen", 2, {}],
  ["fischen", 5, { luckyAgain: false, deck: "de32" }],
  ["fischen", 8, { deck: "fr52" }],
  ["werwolf", 7, { seherin: true, hexe: true, jaeger: true, amor: true, beschuetzer: true }],
  ["werwolf", 5, { narrator: "human" }],
  ["werwolf", 20, {
    wolves: "3", seherin: true, hexe: true, jaeger: true, amor: true, beschuetzer: true, alter: true, dorfdepp: true, suendenbock: true,
    wildeskind: true, wolfshund: true, fuchs: true, baerenfuehrer: true, ritter: true, schwester: true, urwolf: true, grosserwolf: true, rabe: true,
  }],
];

describe("Nichts bleibt hängen – Zufallspartien", () => {
  for (const [gameId, n, options] of SCENARIOS) {
    for (const online of [false, true]) {
      it(`${gameId} · ${n} Spieler · ${online ? "online" : "lokal"} · ${JSON.stringify(options)}`, () => {
        for (let i = 0; i < 25; i++) {
          const { r } = playOut(setupRoom(gameId, n + (online && options.narrator === "human" ? 1 : 0), options, online), online);
          expect(roomGame(r).isOver(r.game)).toBe(true);
        }
      }, 120_000);
    }
  }
});
