/**
 * Spiellogik für Tutto – läuft im Browser (lokal) und im Durable Object (online).
 * Spieler, Host und Zugreihenfolge verwaltet die Plattform; hier stehen nur Punkte, Karten und Würfel.
 */
import { rollDice, shuffle } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic } from "../../platform/types";
import { CARD_BY_ID, CARDS, POINT_STEPS, type CardId } from "./cards";

export * from "./cards";

const MAX_LOG = 200;
const MAX_TURN = 100000;

export interface LogEntry {
  playerId: string;
  name: string;
  pts: number;
  /** Spieler, denen durch Plus/Minus 1000 Punkte abgezogen wurden */
  penalized: string[];
  cards: CardId[];
  clover?: boolean;
}

export type DiceMode = "real" | "app";

/** Zustand des App-Würfels im laufenden Zug */
export interface DiceState {
  /** aktueller Wurf (Augenzahlen) */
  roll: number[];
  /** Auswahl im aktuellen Wurf */
  sel: boolean[];
  /** seit dem letzten Tutto beiseitegelegte Würfel */
  aside: number[];
  /** Wurf ohne wertbare Würfel */
  bust: boolean;
  /** gerade ein Tutto geschafft */
  tutto: boolean;
  /** Tuttos mit der aktuellen Karte (Kleeblatt) */
  tuttos: number;
  /** zählt Würfe hoch, damit die Oberfläche neu animieren kann */
  n: number;
}

export interface TuttoState {
  v: 1;
  /** Punkte je Spieler-ID (fehlt = 0, z. B. bei später Beigetretenen) */
  scores: Record<string, number>;
  curId: string | null;
  pile: CardId[];
  turnCards: CardId[];
  turnPts: number;
  pmOn: boolean;
  log: LogEntry[];
  winnerId: string | null;
  cloverWin: boolean;
  dice: DiceState | null;
}

export type TuttoAction =
  | { type: "draw" }
  | { type: "addPts"; delta: number }
  | { type: "clearPts" }
  | { type: "double" }
  | { type: "setPm"; on: boolean }
  | { type: "book"; zero?: boolean }
  | { type: "clover" }
  | { type: "roll" }
  | { type: "toggleDie"; i: number }
  | { type: "undo" }
  | { type: "shuffle" };

const TURN_ACTIONS = new Set<string>(["draw", "addPts", "clearPts", "double", "setPm", "book", "clover", "roll", "toggleDie"]);
const HOST_ACTIONS = new Set<string>(["undo", "shuffle"]);

export const score = (s: TuttoState, id: string) => s.scores[id] ?? 0;
export const diceModeOf = (ctx: { options: GameContext["options"] }): DiceMode => (ctx.options.diceMode === "app" ? "app" : "real");
export const targetOf = (ctx: { options: GameContext["options"] }) => Number(ctx.options.target) || 6000;

/** Punkte einer Würfelauswahl nach Tutto-Regeln, null wenn ein Würfel nicht wertbar ist. */
export function scoreDice(dice: number[]): number | null {
  if (!dice.length) return null;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]++;
  let pts = 0;
  for (let f = 1; f <= 6; f++) {
    let c = counts[f];
    while (c >= 3) { pts += f === 1 ? 1000 : f * 100; c -= 3; }
    if (f === 1) pts += c * 100;
    else if (f === 5) pts += c * 50;
    else if (c > 0) return null;
  }
  return pts;
}

/** Enthält der Wurf überhaupt wertbare Würfel? */
export function canScore(roll: number[], street: boolean, aside: number[]): boolean {
  if (street) return roll.some((d) => !aside.includes(d));
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of roll) counts[d]++;
  return counts[1] > 0 || counts[5] > 0 || counts.some((c) => c >= 3);
}

/** Ist die Auswahl gültig? Liefert die Punkte (bei der Straße 0) oder null. */
export function selectionValue(d: DiceState, card: CardId | undefined): number | null {
  const picked = d.roll.filter((_, i) => d.sel[i]);
  if (!picked.length) return null;
  if (card === "street") {
    const set = new Set(picked);
    if (set.size !== picked.length || picked.some((x) => d.aside.includes(x))) return null;
    return 0;
  }
  return scoreDice(picked);
}

/** Karten, bei denen man nicht freiwillig aufhören darf, bevor Tutto oder Niete fällt */
export const MUST_PLAY = new Set<CardId>(["fire", "street", "pm", "clover"]);
/** Karten, bei denen die normalen Würfelpunkte nicht zählen */
const NO_DICE_POINTS = new Set<CardId>(["street", "pm", "clover"]);

function freshDice(): DiceState {
  return { roll: [], sel: [], aside: [], bust: false, tutto: false, tuttos: 0, n: 0 };
}

export function freshPile(): CardId[] {
  const pile: CardId[] = [];
  for (const c of CARDS) for (let i = 0; i < c.count; i++) pile.push(c.id);
  return shuffle(pile);
}

/** Zug beenden und zum nächsten Spieler wechseln */
function endTurn(s: TuttoState, ctx: GameContext) {
  s.turnCards = [];
  s.turnPts = 0;
  s.pmOn = true;
  s.dice = null;
  s.curId = nextPlayerId(ctx.players, s.curId);
}

function pushLog(s: TuttoState, e: LogEntry) {
  s.log.push(e);
  if (s.log.length > MAX_LOG) s.log.shift();
}

function setup(ctx: GameContext): TuttoState {
  return {
    v: 1, scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])), curId: ctx.players[0]?.id ?? null,
    pile: freshPile(), turnCards: [], turnPts: 0, pmOn: true, log: [],
    winnerId: null, cloverWin: false, dice: null,
  };
}

function apply(prev: TuttoState, a: TuttoAction, ctx: GameContext): TuttoState {
  const s = structuredClone(prev);
  const appDice = diceModeOf(ctx) === "app";
  const cur = ctx.players.find((p) => p.id === s.curId);
  if (TURN_ACTIONS.has(a.type) && !cur) throw new GameError("Es ist niemand am Zug.");

  switch (a.type) {
    case "draw": {
      if (appDice && s.dice) {
        const card = s.turnCards[s.turnCards.length - 1];
        const midTurn = s.dice.roll.length > 0 || s.dice.aside.length > 0;
        if (s.dice.bust) throw new GameError("Niete – der Zug ist vorbei.");
        if (card === "stop") throw new GameError("Stopp – der Zug ist vorbei.");
        if (!s.dice.tutto && midTurn) throw new GameError("Erst ein Tutto würfeln, dann gibt es eine neue Karte.");
        if (s.dice.tutto && (card === "fire" || card === "clover")) throw new GameError("Mit dieser Karte würfelst du weiter.");
      }
      if (!s.pile.length) s.pile = freshPile();
      s.turnCards.push(s.pile.pop()!);
      if (appDice) s.dice = freshDice();
      return s;
    }
    case "roll": {
      if (!appDice) throw new GameError("Der App-Würfel ist aus.");
      const card = s.turnCards[s.turnCards.length - 1];
      if (!card) throw new GameError("Zieh zuerst eine Karte.");
      if (card === "stop") throw new GameError("Stopp – in diesem Zug wird nicht gewürfelt.");
      const d = s.dice ?? freshDice();
      if (d.bust) throw new GameError("Niete – der Zug ist vorbei.");
      if (d.tutto) {
        if (card !== "fire" && card !== "clover") throw new GameError("Tutto! Zieh eine neue Karte oder trag die Punkte ein.");
        d.tutto = false;
      } else if (d.roll.length) {
        const v = selectionValue(d, card);
        if (v === null) throw new GameError(card === "street" ? "Wähle mindestens eine neue Zahl für die Straße." : "Wähle mindestens einen wertbaren Würfel (1, 5 oder drei Gleiche).");
        if (!NO_DICE_POINTS.has(card)) s.turnPts = Math.min(MAX_TURN, s.turnPts + v);
        d.aside.push(...d.roll.filter((_, i) => d.sel[i]));
        d.roll = []; d.sel = [];
        if (d.aside.length >= 6) {
          d.aside = [];
          d.tuttos++;
          d.n++;
          applyTutto(s, d, card, ctx);
          if (!s.winnerId) s.dice = d;
          return s;
        }
      }
      d.roll = rollDice(6 - d.aside.length);
      d.sel = d.roll.map(() => false);
      d.bust = !canScore(d.roll, card === "street", d.aside);
      d.n++;
      s.dice = d;
      return s;
    }
    case "toggleDie": {
      const d = s.dice;
      if (!d || !d.roll.length || d.bust) throw new GameError("Gerade gibt es nichts auszuwählen.");
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= d.roll.length) throw new GameError("Diesen Würfel gibt es nicht.");
      d.sel[a.i] = !d.sel[a.i];
      return s;
    }
    case "addPts": {
      if (!(POINT_STEPS as readonly number[]).includes(a.delta)) throw new GameError("Ungültiger Punktwert.");
      s.turnPts = Math.min(MAX_TURN, Math.max(0, s.turnPts + a.delta));
      return s;
    }
    case "clearPts":
      s.turnPts = 0;
      return s;
    case "double":
      if (!s.turnCards.includes("x2")) throw new GameError("Verdoppeln geht nur mit der x2-Karte.");
      s.turnPts = Math.min(MAX_TURN, s.turnPts * 2);
      return s;
    case "setPm":
      s.pmOn = !!a.on;
      return s;
    case "book": {
      const p = cur!;
      const card = s.turnCards[s.turnCards.length - 1];
      let zero = !!a.zero;
      if (appDice && s.dice && card) {
        const d = s.dice;
        if (d.bust) zero = card !== "fire";
        else if (!zero && !d.tutto && card !== "stop") {
          if (MUST_PLAY.has(card)) throw new GameError("Mit dieser Karte darfst du nicht aufhören – würfle weiter.");
          // offene Auswahl noch mitnehmen
          const v = d.roll.length ? selectionValue(d, card) : null;
          if (d.roll.length && v === null) throw new GameError("Wähle zuerst wertbare Würfel aus.");
          if (v) s.turnPts = Math.min(MAX_TURN, s.turnPts + v);
        }
      }
      const pts = zero ? 0 : s.turnPts;
      const penalized: string[] = [];
      if (s.turnCards.includes("pm") && s.pmOn && pts > 0) {
        const max = Math.max(...ctx.players.map((x) => score(s, x.id)));
        if (score(s, p.id) < max) {
          for (const x of ctx.players) if (x.id !== p.id && score(s, x.id) === max) { s.scores[x.id] = score(s, x.id) - 1000; penalized.push(x.id); }
        }
      }
      s.scores[p.id] = score(s, p.id) + pts;
      pushLog(s, { playerId: p.id, name: p.name, pts, penalized, cards: s.turnCards });
      if (s.scores[p.id] >= targetOf(ctx)) {
        s.winnerId = p.id;
        s.turnCards = []; s.turnPts = 0; s.pmOn = true; s.dice = null;
      } else endTurn(s, ctx);
      return s;
    }
    case "clover": {
      if (appDice) throw new GameError("Das Kleeblatt wertet der App-Würfel automatisch.");
      if (!s.turnCards.includes("clover")) throw new GameError("Dafür brauchst du die Kleeblatt-Karte.");
      winByClover(s, cur!.id, cur!.name);
      return s;
    }
    case "undo": {
      const e = s.log.pop();
      if (!e) throw new GameError("Es gibt nichts zum Zurücknehmen.");
      s.scores[e.playerId] = score(s, e.playerId) - e.pts;
      if (ctx.players.some((p) => p.id === e.playerId)) s.curId = e.playerId;
      for (const id of e.penalized) s.scores[id] = score(s, id) + 1000;
      s.winnerId = null;
      s.cloverWin = false;
      s.turnCards = [];
      s.turnPts = 0;
      s.pmOn = true;
      s.dice = null;
      return s;
    }
    case "shuffle":
      s.pile = freshPile();
      s.turnCards = [];
      s.turnPts = 0;
      s.dice = null;
      return s;
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

function winByClover(s: TuttoState, id: string, name: string) {
  pushLog(s, { playerId: id, name, pts: 0, penalized: [], cards: s.turnCards, clover: true });
  s.turnCards = []; s.turnPts = 0; s.dice = null;
  s.winnerId = id; s.cloverWin = true;
}

/** Wirkung eines Tuttos je nach Karte (nur App-Würfel). */
function applyTutto(s: TuttoState, d: DiceState, card: CardId, ctx: GameContext): void {
  const c = CARD_BY_ID[card];
  switch (card) {
    case "x2": s.turnPts = Math.min(MAX_TURN, s.turnPts * 2); break;
    case "street": s.turnPts = Math.min(MAX_TURN, s.turnPts + 2000); break;
    case "pm": s.turnPts = Math.min(MAX_TURN, s.turnPts + 1000); s.pmOn = true; break;
    case "fire": break;
    case "clover":
      if (d.tuttos >= 2) {
        const p = ctx.players.find((x) => x.id === s.curId)!;
        winByClover(s, p.id, p.name);
        return;
      }
      break;
    default: if (c.quick) s.turnPts = Math.min(MAX_TURN, s.turnPts + c.quick);
  }
  d.tutto = true;
}

export const tutto: GameLogic<TuttoState, TuttoAction> = {
  info: {
    id: "tutto",
    name: "Tutto",
    tagline: "Karte ziehen, würfeln, zocken – wer zuerst das Ziel erreicht, gewinnt.",
    category: "Würfel",
    minPlayers: 1,
    maxPlayers: 12,
    duration: "30–60 Min.",
  },
  version: 1,
  turnBased: true,
  joinMidGame: true,
  settings: [
    {
      key: "diceMode", label: "Würfel", type: "choice", default: "real", inGame: true,
      choices: [
        { value: "real", label: "Echte Würfel", hint: "Punkte selbst eintippen" },
        { value: "app", label: "🎲 App-Würfel", hint: "App würfelt und zählt" },
      ],
    },
    { key: "target", label: "Spielziel", type: "number", default: 6000, min: 1000, max: 50000, step: 1000, inGame: true },
  ],
  setup,
  apply,
  actionKind: (a) => (TURN_ACTIONS.has(a.type) ? "turn" : HOST_ACTIONS.has(a.type) ? "host" : null),
  currentPlayerId: (s) => s.curId,
  isOver: (s) => s.winnerId !== null,
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (s.curId === id) {
      endTurn(s, ctx);
      if (s.curId === id) s.curId = null;
    }
    if (s.winnerId === id) { s.winnerId = null; s.cloverWin = false; }
    return s;
  },
  onOptionsChanged(prev, before, ctx) {
    if (before.diceMode === ctx.options.diceMode) return prev;
    return { ...prev, dice: null };
  },
  // Die Reihenfolge des Stapels bleibt geheim – die Clients sehen nur, welche Karten noch drin sind.
  view: (s) => ({ ...s, pile: [...s.pile].sort() }),
};

/** Nur für Tests: gezielt eine Karte oben auf den Stapel legen */
export function stackCard(s: TuttoState, card: CardId): TuttoState {
  const i = s.pile.lastIndexOf(card);
  const pile = s.pile.slice();
  if (i >= 0) pile.splice(i, 1);
  pile.push(card);
  return { ...s, pile };
}
