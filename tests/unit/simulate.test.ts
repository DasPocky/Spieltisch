/**
 * „Nichts bleibt hängen“: Zufalls-Bots spielen viele komplette Partien jedes Spiels.
 * In jedem Zustand muss es einen erlaubten Zug geben, jede Partie muss enden,
 * und außer GameError darf nichts geworfen werden. Karten dürfen nicht verloren gehen.
 */
import { describe, expect, it } from "vitest";
import { DECKS } from "@shared/cards/deck";
import type { FischenState } from "@shared/games/fischen/logic";
import type { MauMauState } from "@shared/games/maumau/logic";
import type { HzState } from "@shared/games/herzen/logic";
import type { P10State } from "@shared/games/zehnphasen/logic";
import type { SbState } from "@shared/games/stapelbau/logic";
import type { EinsState } from "@shared/games/eins/logic";
import type { HsState } from "@shared/games/hellseher/logic";
import { DECK_SIZE, type KlState } from "@shared/games/klingel/logic";
import { candidates, shuffleInPlace } from "@shared/platform/bots";
import { applyRoomAction, roomGame, skipLabel, viewRoom, type RoomState } from "@shared/platform/room";
import { WATCH_ID } from "@shared/platform/protocol";
import { tableModel } from "../../src/platform/table/model";
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
  if (r.gameId === "eins" && (r.game as EinsState).mode === "app") {
    const s = r.game as EinsState;
    expect(s.pile.length + s.discard.length + Object.values(s.hands).flat().length).toBe(108);
  }
  if (r.gameId === "stapelbau" && (r.game as SbState).mode === "app") {
    const s = r.game as SbState;
    const n = s.pile.length + s.done.length + s.builds.flat().length + Object.values(s.hands).flat().length
      + Object.values(s.stocks).flat().length + Object.values(s.discards).flat(2).length;
    expect(n).toBe(162);
  }
  if (r.gameId === "zehnphasen" && (r.game as P10State).mode === "app") {
    const s = r.game as P10State;
    const laid = Object.values(s.laid).flat().reduce((t, gr) => t + gr.cards.length, 0);
    expect(s.pile.length + s.discard.length + Object.values(s.hands).flat().length + laid).toBe(108);
  }
  if (r.gameId === "glueckssieben") {
    const s = r.game as { deck: string[]; discard: string[]; lines: Record<string, { nums: string[]; mods: string[]; second: boolean }>; pending: { card: string } | null; queued: { card: string }[]; variant: string };
    const n = s.deck.length + s.discard.length + (s.pending ? 1 : 0) + s.queued.length
      + Object.values(s.lines).reduce((t, l) => t + l.nums.length + l.mods.length + (l.second ? 1 : 0), 0);
    expect(n).toBe(s.variant === "fies" ? 112 : 94);
  }
  if (r.gameId === "himmelskarten" && (r.game as { mode: string }).mode === "app") {
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
  if (r.gameId === "herzen") {
    const s = r.game as HzState;
    const all = [...s.trick.map((p) => p.card), ...Object.values(s.hands).flat()];
    expect(new Set(all).size).toBe(all.length);
    // gespielte Stiche liegen beiseite
    const played = Object.values(s.tricks).reduce((t, n) => t + n, 0) * Object.keys(s.hands).length;
    if (s.phase === "play") expect(all.length + played).toBe(52 - s.removed.length);
  }
  if (r.gameId === "klingel") {
    const s = r.game as KlState;
    const all = [...Object.values(s.stock), ...Object.values(s.open)].flat();
    expect(all.length).toBe(DECK_SIZE);
  }
  if (r.gameId === "fischen" && !(r.game as FischenState).table) {
    const s = r.game as FischenState;
    const n = s.pile.length + Object.values(s.hands).flat().length + Object.values(s.quartets).flat().length * 4;
    expect(n).toBe(DECKS[s.deck].suits.length * DECKS[s.deck].ranks.length);
  }
}

/**
 * Großer Tisch: in jedem Zustand lässt sich die Sicht des Fernsehers zeichnen – wer dran ist, sitzt am Tisch,
 * und Plätze gibt es nur für Mitspieler. (Was der Fernseher nicht sehen darf, nimmt schon `view` heraus.)
 */
function checkTable(r: RoomState) {
  const m = tableModel(viewRoom(r, WATCH_ID));
  if (!m) return;
  const ids = new Set(r.players.map((p) => p.id));
  if (m.turn) expect(ids.has(m.turn), `${r.gameId}: dran ist ${m.turn}`).toBe(true);
  for (const id of Object.keys(m.counts)) expect(ids.has(id), `${r.gameId}: Kartenzahl für ${id}`).toBe(true);
  for (const id of Object.keys(m.boards ?? {})) expect(ids.has(id), `${r.gameId}: Auslage für ${id}`).toBe(true);
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
    checkTable(r);
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
  ["alles", 3, { target: 1000 }],
  ["alles", 2, { target: 1000, diceMode: "app" }],
  ["alles", 3, { target: 1000, cards: "real" }],
  ["fuenfwuerfel", 3, {}],
  ["fuenfwuerfel", 2, { diceMode: "real", morePasch: "none" }],
  ["maumau", 4, {}],
  ["maumau", 2, { reverse9: true, againA: true, unterOnUnter: true, stack7: false, deck: "de32" }],
  ["maumau", 7, { deck: "fr52", hand: "6" }],
  ["schamlos", 3, {}],
  ["schamlos", 6, { set_schwarz: true }],
  ["stirnraten", 3, { rounds: 1, catMode: "mix" }],
  ["stirnraten", 5, { variant: "teams", teams: 2, rounds: 1, open: true, style_pantomime: true }],
  ["stirnraten", 4, { variant: "bombe", rounds: 2 }],
  ["stirnraten", 5, { variant: "hochstapler", rounds: 2, level: "kinder" }],
  ["zeichnen", 3, { rounds: 1 }],
  ["zeichnen", 4, { rounds: 2, guess: "tippen", level: "kinder" }],
  ["quiz", 3, { count: 10 }],
  ["kritzelpost", 3, {}],
  ["stadtlandfluss", 3, { rounds: 2 }],
  ["werbinich", 3, { laps: 4 }],
  ["werbinich", 5, { source: "gegenseitig", follow: false, laps: 3 }],
  ["stadtlandfluss", 6, { rounds: 1, clock: "0", rare: true, own: "Promi, Gericht" }],
  ["kritzelpost", 6, { mode: "eisbrecher", clock: "0" }],
  ["quiz", 1, { count: 5, level: "kinder" }],
  ["quiz", 5, { count: 15, art_wahl: false }],
  ["eins", 2, {}],
  ["eins", 5, { stack: true, plus4: "any", eins: false, target: "round" }],
  ["eins", 8, { target: "round" }],
  ["eins", 4, { sevenZero: true, drawUntil: true, plus4: "strict" }],
  ["eins", 4, { mode: "table" }],
  ["stapelbau", 2, {}],
  ["stapelbau", 6, { stock: "10" }],
  ["stapelbau", 5, { target: "500", stock: "10" }],
  ["stapelbau", 4, { mode: "table", target: "500" }],
  ["zehnphasen", 2, { goal: "5" }],
  ["zehnphasen", 5, { goal: "5" }],
  ["zehnphasen", 4, { mode: "table" }],
  ["glueckssieben", 4, { mode: "table", target: 100 }],
  ["maumau", 3, { mode: "table", goal: "3" }],
  ["himmelskarten", 2, {}],
  ["himmelskarten", 6, { target: 60 }],
  ["himmelskarten", 4, { mode: "table" }],
  ["decknamen", 4, {}],
  ["decknamen", 7, {}],
  ["decknamen", 2, { mode: "key" }],
  ["hellseher", 3, { length: "half" }],
  ["hellseher", 4, { noEven: true, length: "10" }],
  ["hellseher", 6, {}],
  ["hellseher", 5, { secret: true, length: "half" }],
  ["hellseher", 3, { mode: "table", noEven: true }],
  ["hellseher", 4, { mode: "table", secret: true, length: "half" }],
  ["erklaerspiel", 4, {}],
  ["erklaerspiel", 7, { teams: 3, minus: true, control: false }],
  ["erklaerspiel", 6, { variant: "drei", words: 10 }],
  ["erklaerspiel", 5, { variant: "pantomime", rounds: 1 }],
  ["schocken", 2, {}],
  ["schocken", 5, { sixes: true }],
  ["schocken", 10, { length: "half" }],
  ["schocken", 4, { mode: "table" }],
  ["herzen", 4, {}],
  ["klingel", 2, {}],
  ["klingel", 4, { auto: true, pace: "schnell" }],
  ["klingel", 6, { limit: "0" }],
  ["herzen", 3, { target: "50", moon: false }],
  ["herzen", 5, { pass: "left", firstPoints: true }],
  ["herzen", 6, { pass: "none", target: "50" }],
  ["fischen", 2, {}],
  ["fischen", 5, { luckyAgain: false, deck: "de32" }],
  ["fischen", 8, { deck: "fr52" }],
  ["fischen", 4, { afterFish: "asked" }],
  ["fischen", 3, { cards: "table", afterFish: "asked", deck: "fr32" }],
  ["werwolf", 7, { seherin: true, hexe: true, jaeger: true, amor: true, beschuetzer: true }],
  ["werwolf", 5, { narrator: "human" }],
  ["glueckssieben", 3, { target: 100 }],
  ["glueckssieben", 6, { variant: "fies", target: 100 }],
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
