/**
 * Testspieler („Bots“): ziehen zufällig, aber nur erlaubte Züge. Dieselben Zug-Kandidaten nutzt die Simulation
 * in tests/unit/simulate.test.ts – was dort viele tausend Partien ohne Hänger übersteht, taugt auch am echten Tisch.
 */
import { DECKS } from "../cards/deck";
import { ALL_CATS, type FuenfWuerfelState } from "../games/fuenfwuerfel/logic";
import type { FischenState } from "../games/fischen/logic";
import type { MauMauState } from "../games/maumau/logic";
import { extend as p10Extend, findPhase, type P10State } from "../games/zehnphasen/logic";
import { encodePoints } from "../games/zeichnen/logic";
import { randomAnswer, type QState } from "../games/quiz/logic";
import { fits as sbFits, type SbState } from "../games/stapelbau/logic";
import { canPlay as einsCanPlay, COLORS, type EinsState } from "../games/eins/logic";
import type { WerwolfState } from "../games/werwolf/logic";
import { SUITS as HS_SUITS, type HsState } from "../games/hellseher/logic";
import { canPlay as hzCanPlay, type HzState } from "../games/herzen/logic";
import { POINT_STEPS } from "../games/alles/logic";
import { ORDER as MAEX_ORDER, rankOf as maexRank, type MaexState } from "../games/maexchen/logic";
import { legalMoves as dameMoves, type DameState } from "../games/dame/logic";
import type { MuehleState } from "../games/muehle/logic";
import type { VierState } from "../games/vier/logic";
import type { SchamlosState } from "../games/schamlos/logic";
import { applyRoomAction, currentPlayerId, roomGame, type RoomAction, type RoomState } from "./room";
import { GameError } from "./types";

export type Move = { action: RoomAction; actor: string | null };
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const g = (a: { type: string } & Record<string, unknown>): RoomAction => ({ type: "game", action: a });

export function shuffleInPlace<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
  return xs;
}

/** Mögliche Züge je Spiel – bewusst großzügig, ungültige werden von der Logik abgelehnt */
export function candidates(r: RoomState, online: boolean): Move[] {
  const ids = r.players.map((p) => p.id);
  const anyone = (a: RoomAction): Move[] => (online ? ids.map((id) => ({ action: a, actor: id })) : [{ action: a, actor: null }]);
  const moves: Move[] = [];
  const add = (a: { type: string } & Record<string, unknown>) => moves.push(...anyone(g(a)));
  switch (r.gameId) {
    case "alles":
      ["draw", "roll", "book", "clearPts", "alles"].forEach((type) => add({ type }));
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
    case "fuenfwuerfel": {
      const s = r.game as FuenfWuerfelState;
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
    case "eins": {
      const s = r.game as EinsState;
      const hand = s.hands[s.curId ?? ""] ?? [];
      for (const card of hand) for (const target of card.endsWith("-7") ? ids : [undefined]) add({ type: "play", card, color: pick(COLORS), eins: Math.random() < 0.9, target });
      add({ type: "color", color: pick(COLORS) });
      if (Math.random() < 0.5) add({ type: "doubt" });
      // Wie echte Spieler: meist legen, wenn etwas passt – sonst wachsen die Hände endlos
      if (s.phase !== "play" || !hand.some((c) => einsCanPlay(s, c, r.options, hand)) || Math.random() < 0.1) add({ type: "draw" });
      ["pass", "nextRound", "finishRound"].forEach((type) => add({ type }));
      for (const id of ids) add({ type: "enter", player: id, points: Math.floor(Math.random() * 120) });
      add({ type: "setWinner", player: pick(ids) });
      break;
    }
    case "stapelbau": {
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
    case "zehnphasen": {
      const s = r.game as P10State;
      const me = s.curId ?? "";
      const hand = s.hands[me] ?? [];
      add({ type: "draw", from: "pile" }); add({ type: "draw", from: "discard" });
      const found = !s.laid[me] && findPhase(hand, s.phase[me] ?? 1);
      if (found) { add({ type: "lay", groups: found }); break; }
      if (s.laid[me]) for (const c of hand) for (const [owner, gs] of Object.entries(s.laid)) gs.forEach((gr, k) => { if (p10Extend(gr, c)) add({ type: "hit", card: c, owner, g: k }); });
      if (!moves.some((m) => m.action.type === "game" && (m.action.action as { type: string }).type === "hit") || Math.random() < 0.3)
        for (const c of hand) { add({ type: "discard", card: c, skip: pick(ids) }); if (c === "S") add({ type: "discard", card: c }); }
      add({ type: "nextRound" }); add({ type: "finishRound" });
      for (const id of ids) { add({ type: "enter", player: id, points: 5 * Math.floor(Math.random() * 20) }); add({ type: "setDone", player: id, done: Math.random() < 0.5 }); }
      break;
    }
    case "himmelskarten": {
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
    case "decknamen": {
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
    case "glueckssieben": {
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
    case "hellseher": {
      const s = r.game as HsState;
      add({ type: "trump", suit: pick(HS_SUITS) });
      const bid = () => Math.floor(Math.random() * (s.round + 1));
      if (s.phase === "bid" && s.curId) for (let n = 0; n <= s.round; n++) add({ type: "bid", bid: n });
      // Verdeckt: online jeder für sich, lokal das Gerät für jeden
      if (s.phase === "bid" && !s.curId) for (const id of ids) {
        if (online) moves.push({ action: g({ type: "secretBid", bid: bid() }), actor: id });
        else add({ type: "secretBid", player: id, bid: bid() });
      }
      for (const card of s.hands[s.curId ?? ""] ?? []) add({ type: "play", card });
      add({ type: "nextRound" });
      // Echte Karten: wie am Tisch – offene Felder füllen, Stiche passend zur Kartenzahl, ab und zu korrigieren
      if (s.phase === "tableBid") {
        const open = ids.filter((id) => s.bids[id] === null || s.bids[id] === undefined);
        for (const id of open.length ? open : ids) add({ type: "tBid", player: id, bid: Math.floor(Math.random() * (s.round + 1)) });
      }
      if (s.phase === "tableTricks") {
        const open = ids.filter((id) => s.taken[id] === null || s.taken[id] === undefined);
        const rest = s.round - ids.reduce((t, id) => t + (s.taken[id] ?? 0), 0);
        if (open.length === 1 && rest >= 0) add({ type: "tTricks", player: open[0], n: rest });
        else if (open.length > 1) for (const id of open) add({ type: "tTricks", player: id, n: Math.floor(Math.random() * (Math.max(0, rest) + 1)) });
        else if (rest !== 0) for (const id of ids) { const n = (s.taken[id] ?? 0) + rest; if (n >= 0 && n <= s.round) add({ type: "tTricks", player: id, n }); }
      }
      ["tBidsDone", "tFinish"].forEach((type) => add({ type }));
      if (Math.random() < 0.02) add({ type: "tBack" });
      break;
    }
    case "herzen": {
      const s = r.game as HzState;
      // Weitergeben: online jeder für sich, lokal das Gerät für jeden – drei zufällige Karten
      if (s.phase === "pass") for (const id of ids) {
        if (s.passing[id]) continue;
        const cards = shuffleInPlace([...(s.hands[id] ?? [])]).slice(0, 3);
        if (online) moves.push({ action: g({ type: "pass", cards }), actor: id });
        else add({ type: "pass", player: id, cards });
      }
      const hand = s.hands[s.curId ?? ""] ?? [];
      for (const card of hand) if (hzCanPlay(s, hand, card, r.options) || Math.random() < 0.05) add({ type: "play", card });
      add({ type: "nextRound" });
      break;
    }
    case "schamlos": {
      const s = r.game as SchamlosState;
      // Jeder legt zufällige Karten aus der eigenen Hand; Zar (bzw. Host) wählt; weiter
      for (const id of ids) {
        const hand = shuffleInPlace([...(s.hands[id] ?? [])]);
        const play = { type: "play", cards: hand.slice(0, s.blanks), player: id };
        moves.push(online ? { action: g(play), actor: id } : { action: g(play), actor: null });
      }
      for (let i = 0; i < s.subs.length; i++) add({ type: "choose", index: i });
      add({ type: "next" });
      break;
    }
    case "spion": {
      const st = r.game as { pool: string[]; place: string | null };
      ["seen", "accuse", "cancelVote", "reveal", "timeUp", "nextRound"].forEach((type) => add({ type }));
      for (const id of ids) {
        add({ type: "seen", player: id });
        add({ type: "ask", to: id });
        add({ type: "accuse", by: id });
        add({ type: "vote", target: id });
        add({ type: "verdict", target: id });
        add({ type: "reveal", spy: id });
      }
      add({ type: "verdict", target: null });
      add({ type: "guess", place: pick(st.pool) });
      if (st.place && Math.random() < 0.3) add({ type: "guess", place: st.place });
      break;
    }
    case "stirnraten": {
      const st = r.game as { cards: unknown[]; passes: number; options: string[]; order: string[]; phase: string };
      ["start", "timeUp", "stop", "confirm", "tick", "next", "seen", "said"].forEach((type) => add({ type }));
      add({ type: "pick", cat: "mix" });
      for (let k = 0; k < 4; k++) add({ type: "mark", i: st.cards.length - 1, r: Math.random() < 0.7 ? "hit" : "pass" });
      if (st.cards.length) add({ type: "fix", i: Math.floor(Math.random() * st.cards.length), r: "pass" });
      for (let k = 0; k < 3; k++) add({ type: "pass", n: st.passes });
      add({ type: "swap", n: st.passes });
      for (const id of ids) {
        add({ type: "seen", player: id });
        add({ type: "vote", target: id });
        add({ type: "verdict", target: id });
      }
      add({ type: "verdict", target: null });
      if (st.options.length) add({ type: "guess", word: pick(st.options) });
      if (Math.random() < 0.05) add({ type: "custom", words: ["Opas Schnurrbart", "Unser Hund"] });
      break;
    }
    case "quiz": {
      ["reveal", "timeUp", "next"].forEach((type) => add({ type }));
      const v = randomAnswer(r.game as QState);
      if (v !== null) for (const id of ids) moves.push({ action: g({ type: "answer", value: v }), actor: online ? id : null });
      add({ type: "award", ids: ids.filter(() => Math.random() < 0.5) });
      break;
    }
    case "zeichnen": {
      ["timeUp", "next", "done", "undo"].forEach((type) => add({ type }));
      for (let i = 0; i < 3; i++) add({ type: "pick", i });
      // ein paar Kritzel – ein Strich aus 2–8 Punkten
      for (let k = 0; k < 3; k++) {
        const pts = Array.from({ length: 2 + Math.floor(Math.random() * 7) }, () => [Math.random(), Math.random()] as [number, number]);
        add({ type: "stroke", c: Math.floor(Math.random() * 9), w: Math.floor(Math.random() * 4), p: encodePoints(pts) });
      }
      add({ type: "guess", text: pick(["Haus", "Hund", "Sonne", "Auto", "Baum", "Katze"]) });
      if (Math.random() < 0.3) add({ type: "award", to: pick([...ids, null]) });
      break;
    }
    case "kritzelpost": {
      ["timeUp", "done"].forEach((type) => add({ type }));
      add({ type: "page", dir: 1 });
      if (Math.random() < 0.1) add({ type: "page", dir: -1 });
      // Bots schreiben einen festen Satz und kritzeln ein paar Striche (lokal für jeden Spieler einzeln)
      for (const id of ids) {
        const player = online ? undefined : id;
        moves.push(...anyone(g({ type: "write", text: "Ein Hund fährt Fahrrad", player })).filter((m) => !online || m.actor === id));
        moves.push(...anyone(g({ type: "done", player })).filter((m) => !online || m.actor === id));
        const pts = Array.from({ length: 2 + Math.floor(Math.random() * 5) }, () => [Math.random(), Math.random()] as [number, number]);
        moves.push(...anyone(g({ type: "stroke", c: Math.floor(Math.random() * 9), w: Math.floor(Math.random() * 4), p: encodePoints(pts), player })).filter((m) => !online || m.actor === id));
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
      add({ type: "wolf2", target: null });
      for (const target of alive) ["protect", "wolf", "wolf2", "white", "see", "fox", "raven", "model", "suspect", "shoot", "vote", "lynch", "elect", "successor", "visit"].forEach((type) => add({ type, target }));
      for (const a of alive) add({ type: "enchant", a });
      add({ type: "witch", heal: Math.random() < 0.3, poison: Math.random() < 0.3 ? t() : null });
      add({ type: "witch", heal: false, poison: null });
      add({ type: "vote", target: "" });
      add({ type: "lynch", target: null });
      break;
    }
    case "maexchen": {
      const st = r.game as MaexState;
      add({ type: "roll" });
      // Wie echte Spieler: meist knapp über der letzten Ansage, ab und zu aufdecken
      const last = st.round.at(-1);
      const from = last ? maexRank(last.value) + 1 : 0;
      for (const value of MAEX_ORDER.slice(from, from + 4)) add({ type: "announce", value });
      add({ type: "announce", value: pick(MAEX_ORDER) });
      if (!last || last.value === 21 || Math.random() < 0.4) { add({ type: "reveal" }); add({ type: "reveal", truth: Math.random() < 0.5 }); }
      break;
    }
    case "ludo": {
      add({ type: "roll" });
      add({ type: "roll", value: 1 + Math.floor(Math.random() * 6) });
      for (let piece = 0; piece < 4; piece++) { add({ type: "move", piece }); add({ type: "move", piece, back: true }); }
      break;
    }
    case "vier": {
      const s = r.game as VierState;
      for (let col = -1; col <= s.cols; col++) add({ type: "drop", col });
      break;
    }
    case "muehle": {
      const s = r.game as MuehleState;
      for (let i = 0; i < 24; i++) {
        add({ type: "place", to: i });
        add({ type: "remove", at: i });
        for (let j = 0; j < 24; j++) if (s.board[i] === s.turn && s.board[j] === null) add({ type: "move", from: i, to: j });
      }
      break;
    }
    case "dame": {
      const s = r.game as DameState;
      // Erlaubte Züge plus ein paar ungültige (unvollständige Schlagfolgen, fremde Steine)
      for (const m of dameMoves(s, r.options)) {
        add({ type: "move", from: m.from, path: m.path });
        if (m.path.length > 1) add({ type: "move", from: m.from, path: m.path.slice(0, 1) });
      }
      for (const at of s.blow) add({ type: "blow", at });
      add({ type: "move", from: Math.floor(Math.random() * s.board.length), path: [Math.floor(Math.random() * s.board.length)] });
      add({ type: "blow", at: 0 });
      break;
    }
  }
  if (["vier", "muehle", "dame"].includes(r.gameId) && Math.random() < 0.002) add({ type: "resign" });
  // Punkteblock (echte Karten), gemeinsam für alle Spiele, die ihn nutzen
  if ((r.game as { pad?: unknown }).pad) {
    for (const id of ids) add({ type: "padEnter", player: id, points: Math.floor(Math.random() * 60) });
    add({ type: "padFinish" });
    add({ type: "padWin", player: pick(ids) });
    if (Math.random() < 0.05) add({ type: "padUndo" });
  }
  return moves;
}


/** Kennung neuer Testspieler – so erkennt man sie auch ohne Liste */
export const BOT_PREFIX = "bot-";

/**
 * Ein zufälliger erlaubter Zug für einen Testspieler. Online zieht er als er selbst (`actor` = seine ID);
 * lokal („Ein Handy für alle“) zieht das Gerät für ihn, aber nur, wenn er an der Reihe ist.
 * Gibt den neuen Spielstand zurück oder null, wenn er gerade nichts tun kann.
 */
export function botMove(room: RoomState, botId: string, online: boolean): { action: RoomAction; next: RoomState } | null {
  if (room.phase !== "playing" || !room.game || roomGame(room).isOver(room.game)) return null;
  if (!online && currentPlayerId(room) !== botId) return null;
  const moves = candidates(room, online).filter((m) => (online ? m.actor === botId : true));
  for (const m of shuffleInPlace(moves)) {
    try {
      return { action: m.action, next: applyRoomAction(room, m.action, online ? botId : null) };
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
    }
  }
  return null;
}
