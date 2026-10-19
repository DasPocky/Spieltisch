/**
 * „Nichts bleibt hängen“: Zufalls-Bots spielen viele komplette Partien jedes Spiels.
 * In jedem Zustand muss es einen erlaubten Zug geben, jede Partie muss enden,
 * und außer GameError darf nichts geworfen werden. Karten dürfen nicht verloren gehen.
 */
import { describe, expect, it } from "vitest";
import { DECKS } from "@shared/cards/deck";
import type { FischenState } from "@shared/games/fischen/logic";
import type { MauMauState } from "@shared/games/maumau/logic";
import type { P10State } from "@shared/games/phase10/logic";
import type { SbState } from "@shared/games/skipbo/logic";
import type { UnoState } from "@shared/games/uno/logic";
import type { HsState } from "@shared/games/hellseher/logic";
import { candidates, shuffleInPlace } from "@shared/platform/bots";
import { applyRoomAction, roomGame, skipLabel, type RoomState } from "@shared/platform/room";
import { GameError } from "@shared/platform/types";
import { act, roomWith } from "./helpers";

/** Karten müssen erhalten bleiben (32 bzw. 52) */
function checkCards(r: RoomState) {
  if (r.gameId === "maumau" && (r.game as MauMauState).mode !== "table") {
    const s = r.game as MauMauState;
    const all = [...s.pile, ...s.discard, ...Object.values(s.hands).flat()];
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(DECKS[s.deck].suits.length * DECKS[s.deck].ranks.length);
  }
  if (r.gameId === "uno" && (r.game as UnoState).mode === "app") {
    const s = r.game as UnoState;
    expect(s.pile.length + s.discard.length + Object.values(s.hands).flat().length).toBe(108);
  }
  if (r.gameId === "skipbo" && (r.game as SbState).mode === "app") {
    const s = r.game as SbState;
    const n = s.pile.length + s.done.length + s.builds.flat().length + Object.values(s.hands).flat().length
      + Object.values(s.stocks).flat().length + Object.values(s.discards).flat(2).length;
    expect(n).toBe(162);
  }
  if (r.gameId === "phase10" && (r.game as P10State).mode === "app") {
    const s = r.game as P10State;
    const laid = Object.values(s.laid).flat().reduce((t, gr) => t + gr.cards.length, 0);
    expect(s.pile.length + s.discard.length + Object.values(s.hands).flat().length + laid).toBe(108);
  }
  if (r.gameId === "flip7") {
    const s = r.game as { deck: string[]; discard: string[]; lines: Record<string, { nums: string[]; mods: string[]; second: boolean }>; pending: { card: string } | null; queued: { card: string }[]; variant: string };
    const n = s.deck.length + s.discard.length + (s.pending ? 1 : 0) + s.queued.length
      + Object.values(s.lines).reduce((t, l) => t + l.nums.length + l.mods.length + (l.second ? 1 : 0), 0);
    expect(n).toBe(s.variant === "fies" ? 112 : 94);
  }
  if (r.gameId === "skyjo" && (r.game as { mode: string }).mode === "app") {
    const s = r.game as { deck: number[]; discard: number[]; drawn: number | null; grids: Record<string, ({ v: number } | null)[]> };
    const n = s.deck.length + s.discard.length + (s.drawn !== null ? 1 : 0) + Object.values(s.grids).flat().filter(Boolean).length;
    expect(n).toBe(150);
  }
  if (r.gameId === "hellseher" && (r.game as HsState).mode === "app") {
    const s = r.game as HsState;
    const all = [...s.deck, ...(s.trumpCard ? [s.trumpCard] : []), ...s.trick.map((p) => p.card), ...Object.values(s.hands).flat()];
    expect(new Set(all).size).toBe(all.length);
    // abgespielte Stiche liegen beiseite: Karten im Spiel = 60 − gespielte Stiche × Spieler
    const played = Object.values(s.tricks).reduce((t, n) => t + n, 0) * Object.keys(s.hands).length;
    expect(all.length + played).toBe(60);
  }
  if (r.gameId === "fischen" && !(r.game as FischenState).table) {
    const s = r.game as FischenState;
    const n = s.pile.length + Object.values(s.hands).flat().length + Object.values(s.quartets).flat().length * 4;
    expect(n).toBe(DECKS[s.deck].suits.length * DECKS[s.deck].ranks.length);
  }
}

/**
 * Obergrenze gegen Endlosschleifen. Ludo mit 6 Spielern, Schlagzwang und „bis alle im Ziel“ ist von Natur aus lang
 * (gemessen an 574 Zufallspartien: Mittel ~4.600, längste ~14.000 Schritte) – die Grenze liegt deutlich darüber,
 * damit seltene lange Partien nicht als „hängt“ zählen. Ein echter Hänger endet nie und fällt weiter auf.
 */
function playOut(start: RoomState, online: boolean, maxSteps = 40000) {
  let r = start;
  for (let step = 0; step < maxSteps; step++) {
    const logic = roomGame(r);
    if (r.phase !== "playing" || logic.isOver(r.game)) return { r, steps: step };
    // Ab und zu hängt jemand – dann überspringt der Host
    if (Math.random() < 0.02 && skipLabel(r)) {
      try {
        r = applyRoomAction(r, { type: "skip" }, online ? r.hostId : null);
      } catch (e) {
        if (!(e instanceof GameError)) throw e; // z. B. „mindestens ein Werwolf“ – der Host muss erst zuordnen
      }
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
  throw new Error(`${start.gameId}: Partie nach ${maxSteps} Schritten nicht beendet: ${JSON.stringify(r.game).slice(0, 3000)}`);
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
  ["tutto", 3, { target: 1000, cards: "real" }],
  ["kniffel", 3, {}],
  ["kniffel", 2, { diceMode: "real", moreKniffel: "none" }],
  ["maumau", 4, {}],
  ["maumau", 2, { reverse9: true, againA: true, unterOnUnter: true, stack7: false, deck: "de32" }],
  ["maumau", 7, { deck: "fr52", hand: "6" }],
  ["schamlos", 3, {}],
  ["schamlos", 6, { set_schwarz: true }],
  ["uno", 2, {}],
  ["uno", 5, { stack: true, plus4: "any", uno: false, target: "round" }],
  ["uno", 8, { target: "round" }],
  ["uno", 4, { sevenZero: true, drawUntil: true, plus4: "strict" }],
  ["uno", 4, { mode: "table" }],
  ["skipbo", 2, {}],
  ["skipbo", 6, { stock: "10" }],
  ["skipbo", 5, { target: "500", stock: "10" }],
  ["skipbo", 4, { mode: "table", target: "500" }],
  ["phase10", 2, { goal: "5" }],
  ["phase10", 5, { goal: "5" }],
  ["phase10", 4, { mode: "table" }],
  ["flip7", 4, { mode: "table", target: 100 }],
  ["maumau", 3, { mode: "table", goal: "3" }],
  ["skyjo", 2, {}],
  ["skyjo", 6, { target: 60 }],
  ["skyjo", 4, { mode: "table" }],
  ["codenames", 4, {}],
  ["codenames", 7, {}],
  ["codenames", 2, { mode: "key" }],
  ["hellseher", 3, { length: "half" }],
  ["hellseher", 4, { noEven: true, length: "10" }],
  ["hellseher", 6, {}],
  ["hellseher", 5, { secret: true, length: "half" }],
  ["hellseher", 3, { mode: "table", noEven: true }],
  ["hellseher", 4, { mode: "table", secret: true, length: "half" }],
  ["fischen", 2, {}],
  ["fischen", 5, { luckyAgain: false, deck: "de32" }],
  ["fischen", 8, { deck: "fr52" }],
  ["fischen", 4, { afterFish: "asked" }],
  ["fischen", 3, { cards: "table", afterFish: "asked", deck: "fr32" }],
  ["werwolf", 7, { seherin: true, hexe: true, jaeger: true, amor: true, beschuetzer: true }],
  ["werwolf", 5, { narrator: "human" }],
  ["flip7", 3, { target: 100 }],
  ["flip7", 6, { variant: "fies", target: 100 }],
  ["einenacht", 9, { seherin: true, raeuber: true, unruhestifter: true, betrunkener: true, schlaflose: true, jaeger: true, gerber: true, guenstling: true, freimaurer: true }],
  ["einenacht", 3, { wolves: "1" }],
  ["einenacht", 5, { cards: "own", betrunkener: true }],
  ["maexchen", 2, {}],
  ["maexchen", 5, { lives: 6, blind: false }],
  ["maexchen", 10, { lives: 1, maexDouble: false }],
  ["maexchen", 4, { mode: "table", lives: 2 }],
  ["ludo", 2, {}],
  ["ludo", 4, { mustHit: true, startField: "block", backward: true }],
  ["ludo", 3, { dice: "real", start: "home", goalJump: true, outOn1: true, end: "all" }],
  ["ludo", 4, { startField: "free", end: "all" }],
  ["ludo", 6, { board: "6", end: "all", mustHit: true }],
  ["ludo", 5, { board: "6", start: "home" }],
  ["vier", 2, {}],
  ["vier", 2, { size: "9x7" }],
  ["muehle", 2, {}],
  ["muehle", 2, { jump: false, draw: "20" }],
  ["dame", 2, {}],
  ["dame", 2, { capture: "blow", flying: false, back: false, draw: "15" }],
  ["dame", 2, { capture: "free", size: "10" }],
  ["spion", 3, {}],
  ["spion", 6, { spies: "2", lastChance: true, verdict: "unanimous", rounds: 3 }],
  ["spion", 12, { scoring: "rounds", roles: false, pack_alltag: false, pack_urlaub: false, rounds: 4 }],
  ["spion", 4, { pack_alltag: false, pack_urlaub: false, pack_arbeit: false, pack_abenteuer: false, rounds: 2 }],
  ["werwolf", 9, { captain: true, tie: "runoff", aura: true, peaceful: true, selfHeal: false, hexe: true, jaeger: true, dieb: true, floetenspieler: true, engel: true, weisserwolf: true, wolves: "3" }],
  ["werwolf", 6, { cards: "own", captain: true, narrator: "human" }],
  ["werwolf", 20, {
    wolves: "3", seherin: true, hexe: true, jaeger: true, amor: true, beschuetzer: true, alter: true, dorfdepp: true, suendenbock: true,
    wildeskind: true, wolfshund: true, fuchs: true, baerenfuehrer: true, ritter: true, schwester: true, urwolf: true, grosserwolf: true, rabe: true, schlampe: true,
  }],
];

/** Partien je Szenario – für gründliche Läufe z. B. SIM_ROUNDS=200 npm test */
const ROUNDS = Number(process.env.SIM_ROUNDS) || 25;

describe("Nichts bleibt hängen – Zufallspartien", () => {
  for (const [gameId, n, options] of SCENARIOS) {
    for (const online of [false, true]) {
      it(`${gameId} · ${n} Spieler · ${online ? "online" : "lokal"} · ${JSON.stringify(options)}`, () => {
        for (let i = 0; i < ROUNDS; i++) {
          const { r } = playOut(setupRoom(gameId, n + (online && options.narrator === "human" ? 1 : 0), options, online), online);
          expect(roomGame(r).isOver(r.game)).toBe(true);
          // Ergebnis für die Statistik: nur echte Spieler, jeder höchstens einmal, meist ein Sieger
          const res = roomGame(r).results!(r.game, { players: r.players, hostId: r.hostId, actorId: null, options: r.options, now: 0 });
          const ids = r.players.map((p) => p.id);
          expect(res.every((x) => ids.includes(x.id))).toBe(true);
          expect(new Set(res.map((x) => x.id)).size).toBe(res.length);
        }
      }, 120_000 * Math.max(1, ROUNDS / 25));
    }
  }
});
