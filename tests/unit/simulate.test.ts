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
import { extend as p10Extend, findPhase, type P10State } from "@shared/games/phase10/logic";
import { fits as sbFits, type SbState } from "@shared/games/skipbo/logic";
import { canPlay as unoCanPlay, COLORS, type UnoState } from "@shared/games/uno/logic";
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
      ["draw", "roll", "book", "clearPts", "tutto"].forEach((type) => add({ type }));
      add({ type: "book", zero: true });
      add({ type: "draw", card: pick(["b200", "b300", "b500", "x2", "fire", "street", "pm", "stop", "stop", "clover"]) });
      {
        // Würfel antippen: bevorzugt wertbare, damit die Partien in vernünftiger Zeit enden
        const d = (r.game as { dice: { roll: number[]; sel: boolean[] } | null }).dice;
        for (let i = 0; i < 6; i++) {
          add({ type: "toggleDie", i });
          if (d && (d.roll[i] === 1 || d.roll[i] === 5) && !d.sel[i]) for (let k = 0; k < 3; k++) add({ type: "toggleDie", i });
        }
      }
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
    case "uno": {
      const s = r.game as UnoState;
      const hand = s.hands[s.curId ?? ""] ?? [];
      for (const card of hand) add({ type: "play", card, color: pick(COLORS), uno: Math.random() < 0.9 });
      // Wie echte Spieler: meist legen, wenn etwas passt – sonst wachsen die Hände endlos
      if (s.phase !== "play" || !hand.some((c) => unoCanPlay(s, c, r.options, hand)) || Math.random() < 0.1) add({ type: "draw" });
      ["pass", "nextRound", "finishRound"].forEach((type) => add({ type }));
      for (const id of ids) add({ type: "enter", player: id, points: Math.floor(Math.random() * 120) });
      add({ type: "setWinner", player: pick(ids) });
      break;
    }
    case "skipbo": {
      const s = r.game as SbState;
      const me = s.curId ?? "";
      const stockTop = s.stocks[me]?.[s.stocks[me].length - 1];
      // Wie echte Spieler: Vorratskarte zuerst, sonst meist aufbauen, dann ablegen – sonst wird der Vorrat nie kleiner
      const stockTo = stockTop === undefined ? -1 : s.builds.findIndex((b) => sbFits(b, stockTop));
      if (stockTo >= 0 && Math.random() < 0.9) { add({ type: "play", from: "stock", to: stockTo }); break; }
      const tops = [...(s.hands[me] ?? []), ...(s.discards[me] ?? []).map((d) => d[d.length - 1])];
      const canBuild = s.builds.some((b) => tops.some((c) => c !== undefined && sbFits(b, c)));
      for (let to = 0; to < 4; to++) {
        for (const card of s.hands[me] ?? []) add({ type: "play", from: "hand", card, to });
        for (let i = 0; i < 4; i++) add({ type: "play", from: "discard", i, to });
        if (!canBuild || Math.random() < 0.1) for (const card of [...(s.hands[me] ?? []), -1]) add({ type: "discard", card, to });
      }
      add({ type: "nextRound" }); add({ type: "finishRound" });
      for (const id of ids) add({ type: "enter", player: id, points: Math.floor(Math.random() * 20) });
      add({ type: "setWinner", player: pick(ids) });
      break;
    }
    case "phase10": {
      const s = r.game as P10State;
      const me = s.curId ?? "";
      const hand = s.hands[me] ?? [];
      add({ type: "draw", from: "pile" }); add({ type: "draw", from: "discard" });
      const found = !s.laid[me] && findPhase(hand, s.phase[me] ?? 1);
      if (found) { add({ type: "lay", groups: found }); break; }
      if (s.laid[me]) for (const c of hand) for (const [owner, gs] of Object.entries(s.laid)) gs.forEach((gr, k) => { if (p10Extend(gr, c)) add({ type: "hit", card: c, owner, g: k }); });
      if (!moves.some((m) => m.action.type === "game" && (m.action.action as { type: string }).type === "hit") || Math.random() < 0.3)
        for (const c of hand) add({ type: "discard", card: c, skip: pick(ids) });
      add({ type: "nextRound" }); add({ type: "finishRound" });
      for (const id of ids) { add({ type: "enter", player: id, points: 5 * Math.floor(Math.random() * 20) }); add({ type: "setDone", player: id, done: Math.random() < 0.5 }); }
      break;
    }
    case "skyjo": {
      for (let i = 0; i < 12; i++) {
        for (const id of ids) add({ type: "flipStart", player: id, i });
        add({ type: "swap", i }); add({ type: "flip", i });
      }
      add({ type: "draw", from: Math.random() < 0.5 ? "deck" : "discard" });
      add({ type: "discardDrawn" });
      add({ type: "nextRound" });
      for (const id of ids) add({ type: "enter", player: id, points: Math.floor(Math.random() * 40) - 5 });
      add({ type: "setEnder", player: pick(ids) });
      add({ type: "finishRound" });
      break;
    }
    case "codenames": {
      for (const id of ids) for (const team of ["rot", "blau", null]) add({ type: "join", player: id, team, chief: Math.random() < 0.3 });
      ["shuffleTeams", "begin", "pass"].forEach((type) => add({ type }));
      add({ type: "clue", word: pick(["Tier", "Wasser", "Musik", "Reise"]), count: Math.floor(Math.random() * 4) });
      for (let i = 0; i < 25; i++) { add({ type: "guess", i }); add({ type: "mark", i }); }
      break;
    }
    case "fischen": {
      const st = r.game as FischenState;
      for (const target of ids) for (const rank of DECKS[st.deck].ranks) {
        add({ type: "ask", target, rank });
        if (st.table && Math.random() < 0.05) add({ type: "quartet", rank, owner: target });
      }
      for (const target of ids) add({ type: "fish", target });
      add({ type: "fish" });
      if (Math.random() < 0.05) add({ type: "undo" });
      break;
    }
    case "flip7": {
      const st = r.game as { lines: Record<string, { nums: string[]; mods: string[] }> };
      ["hit", "stay"].forEach((type) => add({ type }));
      for (const id of Object.keys(st.lines)) {
        add({ type: "target", target: id });
        const l = st.lines[id];
        for (let i = 0; i < l.nums.length + l.mods.length; i++) add({ type: "pick", owner: id, index: i });
        for (const id2 of Object.keys(st.lines)) if (id < id2) for (let i = 0; i < l.nums.length; i++) for (let j = 0; j < st.lines[id2].nums.length; j++)
          add({ type: "swap", a: { owner: id, index: i }, b: { owner: id2, index: j } });
      }
      break;
    }
    case "einenacht": {
      const ids2 = r.players.map((p) => p.id);
      ["ready", "startNight", "next", "nightDone", "closeVote"].forEach((type) => add({ type }));
      for (let i = 0; i < 3; i++) { add({ type: "peek", i }); add({ type: "drunk", i }); }
      add({ type: "see", center: [0, 2] });
      add({ type: "rob", target: null });
      add({ type: "trouble", a: null });
      for (const t of ids2) { add({ type: "see", player: t }); add({ type: "rob", target: t }); add({ type: "vote", target: t }); }
      for (const a of ids2) for (const b of ids2) if (a < b) add({ type: "trouble", a, b });
      add({ type: "lynch", targets: [pick(ids2)] });
      add({ type: "lynch", targets: [] });
      add({ type: "settle", team: pick(["dorf", "werwolf", null]), winners: [pick(ids2)] });
      break;
    }
    case "werwolf": {
      const s = r.game as WerwolfState;
      const alive = Object.keys(s.roles).filter((id) => s.alive[id]);
      const t = () => pick(alive.length ? alive : ids);
      ["ready", "startNight", "next", "closeVote"].forEach((type) => add({ type }));
      add({ type: "dog", wolf: Math.random() < 0.5 });
      add({ type: "infect", yes: Math.random() < 0.5 });
      add({ type: "raven", target: null });
      add({ type: "assignDone" });
      for (const p of [0, 1, null]) add({ type: "steal", pick: p });
      add({ type: "white", target: null });
      add({ type: "claim", role: pick(["werwolf", "dorf", "seherin", "hexe"]) });
      for (const id of Object.keys(s.roles)) add({ type: "assign", id, role: pick(["werwolf", "dorf", "seherin", "jaeger"]) });
      for (const a of alive) for (const b of alive) if (a < b) add({ type: "enchant", a, b });
      for (const a of alive) add({ type: "amor", a, b: pick(alive.filter((x) => x !== a)) });
      for (const target of alive) ["protect", "wolf", "wolf2", "white", "see", "fox", "raven", "model", "suspect", "shoot", "vote", "lynch", "elect", "successor", "visit"].forEach((type) => add({ type, target }));
      for (const a of alive) add({ type: "enchant", a });
      add({ type: "witch", heal: Math.random() < 0.3, poison: Math.random() < 0.3 ? t() : null });
      add({ type: "witch", heal: false, poison: null });
      add({ type: "vote", target: "" });
      add({ type: "lynch", target: null });
      break;
    }
  }
  // Punkteblock (echte Karten), gemeinsam für alle Spiele, die ihn nutzen
  if ((r.game as { pad?: unknown }).pad) {
    for (const id of ids) add({ type: "padEnter", player: id, points: Math.floor(Math.random() * 60) });
    add({ type: "padFinish" });
    add({ type: "padWin", player: pick(ids) });
    if (Math.random() < 0.05) add({ type: "padUndo" });
  }
  return moves;
}

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
  if (r.gameId === "fischen" && !(r.game as FischenState).table) {
    const s = r.game as FischenState;
    const n = s.pile.length + Object.values(s.hands).flat().length + Object.values(s.quartets).flat().length * 4;
    expect(n).toBe(DECKS[s.deck].suits.length * DECKS[s.deck].ranks.length);
  }
}

function playOut(start: RoomState, online: boolean, maxSteps = 15000) {
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
  ["kniffel", 2, { diceMode: "real", extraKniffel: true }],
  ["maumau", 4, {}],
  ["maumau", 2, { reverse9: true, againA: true, unterOnUnter: true, stack7: false, deck: "de32" }],
  ["maumau", 7, { deck: "fr52", hand: "6" }],
  ["uno", 2, {}],
  ["uno", 5, { stack: true, plus4Any: true, uno: false, target: "round" }],
  ["uno", 8, { target: "round" }],
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
