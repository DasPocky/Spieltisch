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
  /** Punkte, die vor der aktuellen Karte schon sicher waren (durch ein Tutto) */
  cardStart?: number;
  /** Tuttos mit der aktuellen Karte (Kleeblatt bei echten Würfeln) */
  cardTuttos?: number;
  /** Echte Würfel, ohne automatisches Aufdecken: Tutto geschafft, jetzt neue Karte oder eintragen */
  afterTutto?: boolean;
  /** Plus/Minus-Tutto in diesem Zug geschafft – beim Eintragen verliert der Führende 1.000 */
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
  | { type: "tutto" }
  | { type: "book"; zero?: boolean }
  | { type: "roll" }
  | { type: "toggleDie"; i: number }
  | { type: "undo" }
  | { type: "shuffle" };

const TURN_ACTIONS = new Set<string>(["draw", "addPts", "clearPts", "tutto", "book", "roll", "toggleDie"]);
const HOST_ACTIONS = new Set<string>(["undo", "shuffle"]);

export const score = (s: TuttoState, id: string) => s.scores[id] ?? 0;
export const diceModeOf = (ctx: { options: GameContext["options"] }): DiceMode => (ctx.options.diceMode === "app" ? "app" : "real");
export const targetOf = (ctx: { options: GameContext["options"] }) => Number(ctx.options.target) || 6000;
export const autoDrawOf = (ctx: { options: GameContext["options"] }) => ctx.options.autoDraw !== false;

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

/** Passt die Würfelmenge noch in eine Torte (drei Gleiche, zwei Fünfen, eine Eins)? */
export function fitsTorte(dice: number[]): boolean {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]++;
  for (let x = 1; x <= 6; x++) {
    const need = [0, 0, 0, 0, 0, 0, 0];
    need[x] += 3; need[5] += 2; need[1] += 1;
    if (counts.every((c, f) => c <= need[f])) return true;
  }
  return false;
}

/** Ist diese Auswahl für die Karte erlaubt? Liefert die Punkte (bei Straße/Torte 0) oder null. */
function pickValue(picked: number[], card: CardId | undefined, aside: number[]): number | null {
  if (!picked.length) return null;
  if (card === "street") {
    const set = new Set(picked);
    return set.size !== picked.length || picked.some((x) => aside.includes(x)) ? null : 0;
  }
  const v = scoreDice(picked);
  if (card === "torte") return v !== null && fitsTorte([...aside, ...picked]) ? 0 : null;
  return v;
}

/** Enthält der Wurf überhaupt eine erlaubte Auswahl? */
export function canScore(roll: number[], card: CardId | undefined, aside: number[]): boolean {
  for (let m = 1; m < 1 << roll.length; m++) {
    if (pickValue(roll.filter((_, i) => m & (1 << i)), card, aside) !== null) return true;
  }
  return false;
}

/** Ist die Auswahl gültig? Liefert die Punkte (bei Straße und Torte 0) oder null. */
export function selectionValue(d: DiceState, card: CardId | undefined): number | null {
  return pickValue(d.roll.filter((_, i) => d.sel[i]), card, d.aside);
}

/** Karten, bei denen man nicht freiwillig aufhören darf, bevor Tutto oder Niete fällt */
export const MUST_PLAY = new Set<CardId>(["fire", "street", "pm", "clover", "torte"]);
/** Karten, bei denen die normalen Würfelpunkte nicht zählen */
export const NO_DICE_POINTS = new Set<CardId>(["street", "pm", "clover", "torte", "stop"]);
/** Karten, mit denen man nach einem Tutto ohne neue Karte weiterwürfelt */
export const KEEP_CARD = new Set<CardId>(["fire", "clover"]);

const latestCard = (s: TuttoState): CardId | undefined => s.turnCards[s.turnCards.length - 1];

/**
 * Gerade frisch nach einem Tutto eine neue Karte, aber noch nichts damit gemacht?
 * Dann darf man die sicheren Punkte noch eintragen – auch bei Pflichtkarten.
 */
export function freshAfterTutto(s: TuttoState): boolean {
  if (s.turnCards.length < 2 || s.turnPts !== (s.cardStart ?? 0) || (s.cardTuttos ?? 0) > 0) return false;
  return !s.dice || (!s.dice.roll.length && !s.dice.aside.length && !s.dice.tutto);
}

/** Darf man jetzt aufhören und die Punkte eintragen? */
export function canStop(s: TuttoState): boolean {
  const card = latestCard(s);
  if (!card || s.afterTutto || card === "stop") return true;
  if (freshAfterTutto(s)) return true;
  if (s.dice?.tutto && !KEEP_CARD.has(card)) return true;
  return !MUST_PLAY.has(card);
}

function freshDice(): DiceState {
  return { roll: [], sel: [], aside: [], bust: false, tutto: false, tuttos: 0, n: 0 };
}

export function freshPile(options: GameContext["options"] = {}): CardId[] {
  const pile: CardId[] = [];
  for (const c of CARDS) {
    if (c.promo && !options[c.id]) continue;
    for (let i = 0; i < c.count; i++) pile.push(c.id);
  }
  return shuffle(pile);
}

/** Neue Karte aufdecken – der Punktestand davor ist ab jetzt sicher */
function drawCard(s: TuttoState, ctx: GameContext) {
  if (!s.pile.length) s.pile = freshPile(ctx.options);
  s.turnCards.push(s.pile.pop()!);
  s.cardStart = s.turnPts;
  s.cardTuttos = 0;
  s.afterTutto = false;
  s.dice = diceModeOf(ctx) === "app" ? freshDice() : null;
}

/** Zu Beginn eines Zugs die Karte gleich aufdecken, wenn so eingestellt */
function startTurn(s: TuttoState, ctx: GameContext) {
  s.turnCards = [];
  s.turnPts = 0;
  s.cardStart = 0;
  s.cardTuttos = 0;
  s.afterTutto = false;
  s.pmOn = false;
  s.dice = null;
  if (autoDrawOf(ctx) && s.curId && !s.winnerId && ctx.players.some((p) => p.id === s.curId)) drawCard(s, ctx);
}

/** Zug beenden und zum nächsten Spieler wechseln */
function endTurn(s: TuttoState, ctx: GameContext) {
  s.curId = nextPlayerId(ctx.players, s.curId);
  startTurn(s, ctx);
}

function pushLog(s: TuttoState, e: LogEntry) {
  s.log.push(e);
  if (s.log.length > MAX_LOG) s.log.shift();
}

function setup(ctx: GameContext): TuttoState {
  const s: TuttoState = {
    v: 1, scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])), curId: ctx.players[0]?.id ?? null,
    pile: freshPile(ctx.options), turnCards: [], turnPts: 0, cardStart: 0, cardTuttos: 0, afterTutto: false, pmOn: false, log: [],
    winnerId: null, cloverWin: false, dice: null,
  };
  startTurn(s, ctx);
  return s;
}

/** Wirkung eines Tuttos je nach Karte – für echte und App-Würfel gleich. Liefert true, wenn die Karte bleibt. */
function applyTutto(s: TuttoState, card: CardId, ctx: GameContext): void {
  const add = (n: number) => { s.turnPts = Math.min(MAX_TURN, s.turnPts + n); };
  s.cardTuttos = (s.cardTuttos ?? 0) + 1;
  switch (card) {
    case "x2": s.turnPts = Math.min(MAX_TURN, s.turnPts * 2); break;
    case "street": add(2000); break;
    case "pm": add(1000); s.pmOn = true; break;
    case "torte": add(1500); break;
    case "fire": return;
    case "clover":
      if (s.cardTuttos >= 2) {
        const p = ctx.players.find((x) => x.id === s.curId)!;
        winByClover(s, p.id, p.name);
      }
      return;
    default: add(CARD_BY_ID[card].quick ?? 0);
  }
  // Nach dem Tutto: automatisch weiter mit neuer Karte – oder erst fragen
  if (autoDrawOf(ctx)) drawCard(s, ctx);
  else if (diceModeOf(ctx) === "real") s.afterTutto = true;
}

function apply(prev: TuttoState, a: TuttoAction, ctx: GameContext): TuttoState {
  const s = structuredClone(prev);
  const appDice = diceModeOf(ctx) === "app";
  const cur = ctx.players.find((p) => p.id === s.curId);
  if (TURN_ACTIONS.has(a.type) && !cur) throw new GameError("Es ist niemand am Zug.");
  const card = latestCard(s);

  switch (a.type) {
    case "draw": {
      if (card) {
        if (card === "stop") throw new GameError("Stopp – der Zug ist vorbei.");
        if (appDice) {
          const d = s.dice;
          if (d?.bust) throw new GameError("Niete – der Zug ist vorbei.");
          if (!d?.tutto) throw new GameError("Erst ein Tutto würfeln, dann gibt es eine neue Karte.");
          if (KEEP_CARD.has(card)) throw new GameError("Mit dieser Karte würfelst du weiter.");
        } else if (!s.afterTutto) throw new GameError("Eine neue Karte gibt es erst nach einem Tutto.");
      }
      drawCard(s, ctx);
      return s;
    }
    case "tutto": {
      if (appDice) throw new GameError("Das Tutto erkennt der App-Würfel selbst.");
      if (!card) throw new GameError("Zieh zuerst eine Karte.");
      if (card === "stop") throw new GameError("Stopp – in diesem Zug wird nicht gewürfelt.");
      if (s.afterTutto) throw new GameError("Zieh eine neue Karte oder trag die Punkte ein.");
      applyTutto(s, card, ctx);
      return s;
    }
    case "roll": {
      if (!appDice) throw new GameError("Der App-Würfel ist aus.");
      if (!card) throw new GameError("Zieh zuerst eine Karte.");
      if (card === "stop") throw new GameError("Stopp – in diesem Zug wird nicht gewürfelt.");
      const d = s.dice ?? freshDice();
      if (d.bust) throw new GameError("Niete – der Zug ist vorbei.");
      if (d.tutto) {
        if (!KEEP_CARD.has(card)) throw new GameError("Tutto! Zieh eine neue Karte oder trag die Punkte ein.");
        d.tutto = false;
      } else if (d.roll.length) {
        const v = selectionValue(d, card);
        if (v === null) throw new GameError(card === "street" ? "Wähle mindestens eine neue Zahl für die Straße." : card === "torte" ? "Wähle Würfel, die in die Torte passen." : "Wähle mindestens einen wertbaren Würfel (1, 5 oder drei Gleiche).");
        if (!NO_DICE_POINTS.has(card)) s.turnPts = Math.min(MAX_TURN, s.turnPts + v);
        d.aside.push(...d.roll.filter((_, i) => d.sel[i]));
        d.roll = []; d.sel = [];
        if (d.aside.length >= 6) {
          d.aside = [];
          d.tuttos++;
          d.n++;
          d.tutto = true;
          s.dice = d;
          applyTutto(s, card, ctx);
          return s;
        }
      }
      d.roll = rollDice(6 - d.aside.length);
      d.sel = d.roll.map(() => false);
      d.bust = !canScore(d.roll, card, d.aside);
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
      if (appDice) throw new GameError("Die Punkte zählt der App-Würfel.");
      if (!(POINT_STEPS as readonly number[]).includes(a.delta)) throw new GameError("Ungültiger Punktwert.");
      if (!card) throw new GameError("Zieh zuerst eine Karte.");
      if (NO_DICE_POINTS.has(card)) throw new GameError(card === "stop" ? "Stopp – in diesem Zug wird nicht gewürfelt." : "Mit dieser Karte zählen die Würfelpunkte nicht.");
      if (s.afterTutto) throw new GameError("Zieh erst eine neue Karte.");
      s.turnPts = Math.min(MAX_TURN, Math.max(s.cardStart ?? 0, s.turnPts + a.delta));
      return s;
    }
    case "clearPts":
      if (appDice) throw new GameError("Die Punkte zählt der App-Würfel.");
      s.turnPts = s.cardStart ?? 0;
      return s;
    case "book": {
      const p = cur!;
      // Feuerwerk mit echten Würfeln: Eintragen heißt „Niete geworfen“, die kostet hier nichts
      const fireEnd = card === "fire" && !appDice && !s.afterTutto;
      let zero = !!a.zero && !fireEnd;
      // Mit App-Würfel entscheidet der Wurf über die Niete, nicht der Spieler
      if (zero && appDice && card && card !== "stop" && s.dice && !s.dice.bust) throw new GameError("Das ist keine Niete – würfle weiter oder trag ein.");
      if (card && !zero && !fireEnd) {
        const d = appDice ? s.dice : null;
        if (d?.bust) zero = card !== "fire";
        else if (!canStop(s)) throw new GameError("Mit dieser Karte darfst du nicht aufhören – spiel weiter.");
        else if (d && !d.tutto && d.roll.length && !freshAfterTutto(s)) {
          // offene Auswahl noch mitnehmen
          const v = selectionValue(d, card);
          if (v === null) throw new GameError("Wähle zuerst wertbare Würfel aus.");
          if (!NO_DICE_POINTS.has(card)) s.turnPts = Math.min(MAX_TURN, s.turnPts + v);
        }
      }
      const pts = zero ? 0 : s.turnPts;
      const penalized: string[] = [];
      if (s.pmOn && pts > 0) {
        const max = Math.max(...ctx.players.map((x) => score(s, x.id)));
        if (score(s, p.id) < max) {
          for (const x of ctx.players) if (x.id !== p.id && score(s, x.id) === max) { s.scores[x.id] = score(s, x.id) - 1000; penalized.push(x.id); }
        }
      }
      s.scores[p.id] = score(s, p.id) + pts;
      pushLog(s, { playerId: p.id, name: p.name, pts, penalized, cards: s.turnCards });
      if (s.scores[p.id] >= targetOf(ctx)) {
        s.winnerId = p.id;
        s.turnCards = []; s.turnPts = 0; s.pmOn = false; s.dice = null; s.afterTutto = false;
      } else endTurn(s, ctx);
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
      startTurn(s, ctx);
      return s;
    }
    case "shuffle":
      s.pile = freshPile(ctx.options);
      startTurn(s, ctx);
      return s;
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

function winByClover(s: TuttoState, id: string, name: string) {
  pushLog(s, { playerId: id, name, pts: 0, penalized: [], cards: s.turnCards, clover: true });
  s.turnCards = []; s.turnPts = 0; s.dice = null; s.afterTutto = false;
  s.winnerId = id; s.cloverWin = true;
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
  version: 2,
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
    { key: "autoDraw", label: "Karten automatisch aufdecken", hint: "Zu Zugbeginn und nach jedem Tutto", type: "toggle", default: true, inGame: true },
    { key: "torte", label: "Promokarte „Torte“", hint: "1× im Stapel: Drilling + zwei Fünfen + eine Eins = 1.500", type: "toggle", default: false },
  ],
  setup,
  apply,
  actionKind: (a) => (TURN_ACTIONS.has(a.type) ? "turn" : HOST_ACTIONS.has(a.type) ? "host" : null),
  currentPlayerId: (s) => s.curId,
  isOver: (s) => s.winnerId !== null,
  skipLabel: (s, ctx) => {
    const cur = ctx.players.find((p) => p.id === s.curId);
    return cur && !s.winnerId ? `Zug von ${cur.name} überspringen (Niete)` : null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    s.afterTutto = false;
    const cur = ctx.players.find((p) => p.id === s.curId);
    if (cur) pushLog(s, { playerId: cur.id, name: cur.name, pts: 0, penalized: [], cards: s.turnCards });
    endTurn(s, ctx);
    return s;
  },
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
    if (before.diceMode === ctx.options.diceMode && before.autoDraw === ctx.options.autoDraw) return prev;
    const s = structuredClone(prev);
    if (before.diceMode !== ctx.options.diceMode) { s.dice = diceModeOf(ctx) === "app" && s.turnCards.length ? freshDice() : null; s.afterTutto = false; }
    // Automatisch aufdecken gerade eingeschaltet: die offene Karte gleich ziehen
    if (autoDrawOf(ctx) && !s.turnCards.length && !s.winnerId && s.curId) drawCard(s, ctx);
    return s;
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
