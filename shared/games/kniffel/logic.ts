/**
 * Spiellogik für Kniffel – läuft im Browser (lokal) und im Durable Object (online).
 * Zwei Arten zu spielen: App-Würfel (Server würfelt) oder echte Würfel mit digitalem Block.
 */
import { rollDice } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic } from "../../platform/types";

export const UPPER = ["ones", "twos", "threes", "fours", "fives", "sixes"] as const;
export const LOWER = ["three", "four", "full", "small", "large", "kniffel", "chance"] as const;
export type Cat = (typeof UPPER)[number] | (typeof LOWER)[number];
export const ALL_CATS: Cat[] = [...UPPER, ...LOWER];

export interface CatInfo {
  id: Cat;
  name: string;
  /** kurze Wertungsregel */
  hint: string;
  /** feste Punkte (Full House, Straßen, Kniffel) */
  fixed?: number;
  /** Augenzahl im oberen Teil */
  face?: number;
}

export const CATS: Record<Cat, CatInfo> = {
  ones: { id: "ones", name: "Einser", hint: "nur Einser zählen", face: 1 },
  twos: { id: "twos", name: "Zweier", hint: "nur Zweier zählen", face: 2 },
  threes: { id: "threes", name: "Dreier", hint: "nur Dreier zählen", face: 3 },
  fours: { id: "fours", name: "Vierer", hint: "nur Vierer zählen", face: 4 },
  fives: { id: "fives", name: "Fünfer", hint: "nur Fünfer zählen", face: 5 },
  sixes: { id: "sixes", name: "Sechser", hint: "nur Sechser zählen", face: 6 },
  three: { id: "three", name: "Dreierpasch", hint: "3 Gleiche – alle Augen" },
  four: { id: "four", name: "Viererpasch", hint: "4 Gleiche – alle Augen" },
  full: { id: "full", name: "Full House", hint: "3 + 2 Gleiche", fixed: 25 },
  small: { id: "small", name: "Kleine Straße", hint: "4 in Folge", fixed: 30 },
  large: { id: "large", name: "Große Straße", hint: "5 in Folge", fixed: 40 },
  kniffel: { id: "kniffel", name: "Kniffel", hint: "5 Gleiche", fixed: 50 },
  chance: { id: "chance", name: "Chance", hint: "alle Augen" },
};

export const UPPER_BONUS_AT = 63;
export const UPPER_BONUS = 35;
export const EXTRA_KNIFFEL = 50;
const MAX_LOG = 200;

export type Sheet = Partial<Record<Cat, number>>;

export interface LogEntry {
  playerId: string;
  name: string;
  cat: Cat;
  pts: number;
  /** Bonus für einen weiteren Kniffel */
  extra: number;
}

export interface KniffelState {
  v: 1;
  sheets: Record<string, Sheet>;
  /** Summe der Extra-Kniffel-Boni je Spieler */
  extras: Record<string, number>;
  curId: string | null;
  /** aktueller Wurf (App-Würfel), leer vor dem ersten Wurf */
  dice: number[];
  held: boolean[];
  rollsLeft: number;
  /** zählt Würfe, damit die Oberfläche neu animieren kann */
  n: number;
  log: LogEntry[];
  finished: boolean;
}

export type KniffelAction =
  | { type: "roll" }
  | { type: "hold"; i: number }
  | { type: "score"; cat: Cat; value?: number; extra?: boolean }
  | { type: "undo" };

export type DiceMode = "app" | "real";
export const diceModeOf = (ctx: { options: GameContext["options"] }): DiceMode => (ctx.options.diceMode === "real" ? "real" : "app");
export const extraRuleOf = (ctx: { options: GameContext["options"] }) => ctx.options.extraKniffel === true;

function counts(dice: number[]) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}
const sum = (dice: number[]) => dice.reduce((s, d) => s + d, 0);

export function isKniffel(dice: number[]) {
  return dice.length === 5 && counts(dice).some((c) => c === 5);
}

function hasRun(dice: number[], len: number) {
  const set = new Set(dice);
  for (let start = 1; start + len - 1 <= 6; start++) {
    let ok = true;
    for (let f = start; f < start + len; f++) if (!set.has(f)) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

/** Punkte, die ein Wurf in einer Kategorie bringt. `joker`: weiterer Kniffel zählt als Full House und Straße. */
export function scoreFor(cat: Cat, dice: number[], joker = false): number {
  if (dice.length !== 5) return 0;
  const c = counts(dice);
  const info = CATS[cat];
  if (info.face) return c[info.face] * info.face;
  const jk = joker && isKniffel(dice);
  switch (cat) {
    case "three": return c.some((n) => n >= 3) ? sum(dice) : 0;
    case "four": return c.some((n) => n >= 4) ? sum(dice) : 0;
    case "full": return jk || (c.includes(3) && c.includes(2)) ? 25 : 0;
    case "small": return jk || hasRun(dice, 4) ? 30 : 0;
    case "large": return jk || hasRun(dice, 5) ? 40 : 0;
    case "kniffel": return isKniffel(dice) ? 50 : 0;
    case "chance": return sum(dice);
    default: return 0;
  }
}

/** Ist ein von Hand eingetippter Wert (echte Würfel) möglich? */
export function validEntry(cat: Cat, value: number): boolean {
  if (!Number.isInteger(value)) return false;
  const info = CATS[cat];
  if (info.face) return value >= 0 && value <= 5 * info.face && value % info.face === 0;
  if (info.fixed) return value === 0 || value === info.fixed;
  if (cat === "chance") return value >= 5 && value <= 30;
  return value === 0 || (value >= 5 && value <= 30); // Pasch
}

export interface Totals { upper: number; bonus: number; lower: number; extra: number; total: number; filled: number }

export function totals(s: KniffelState, id: string): Totals {
  const sheet = s.sheets[id] ?? {};
  const upper = UPPER.reduce((t, c) => t + (sheet[c] ?? 0), 0);
  const lower = LOWER.reduce((t, c) => t + (sheet[c] ?? 0), 0);
  const bonus = upper >= UPPER_BONUS_AT ? UPPER_BONUS : 0;
  const extra = s.extras[id] ?? 0;
  return { upper, bonus, lower, extra, total: upper + bonus + lower + extra, filled: ALL_CATS.filter((c) => sheet[c] !== undefined).length };
}

/** Gewinner (bei Gleichstand mehrere) – erst am Ende sinnvoll */
export function winners(s: KniffelState, playerIds: string[]): string[] {
  const best = Math.max(...playerIds.map((id) => totals(s, id).total));
  return playerIds.filter((id) => totals(s, id).total === best);
}

function freshTurn(s: KniffelState) {
  s.dice = [];
  s.held = [false, false, false, false, false];
  s.rollsLeft = 3;
}

function setup(ctx: GameContext): KniffelState {
  const s: KniffelState = {
    v: 1, sheets: Object.fromEntries(ctx.players.map((p) => [p.id, {}])), extras: {},
    curId: ctx.players[0]?.id ?? null, dice: [], held: [], rollsLeft: 3, n: 0, log: [], finished: false,
  };
  freshTurn(s);
  return s;
}

const isFull = (s: KniffelState, id: string) => ALL_CATS.every((c) => s.sheets[id]?.[c] !== undefined);

/** Nächster Spieler mit freien Feldern, sonst ist die Partie vorbei. */
function advance(s: KniffelState, ctx: GameContext) {
  freshTurn(s);
  let next = s.curId;
  for (let i = 0; i < ctx.players.length; i++) {
    next = nextPlayerId(ctx.players, next);
    if (next && !isFull(s, next)) { s.curId = next; return; }
  }
  s.finished = true;
}

function apply(prev: KniffelState, a: KniffelAction, ctx: GameContext): KniffelState {
  const s = structuredClone(prev);
  const app = diceModeOf(ctx) === "app";
  const cur = ctx.players.find((p) => p.id === s.curId);

  switch (a.type) {
    case "roll": {
      if (!app) throw new GameError("Ihr spielt mit echten Würfeln.");
      if (s.rollsLeft <= 0) throw new GameError("Keine Würfe mehr – trag jetzt ein.");
      if (s.dice.length === 5 && s.held.every(Boolean)) throw new GameError("Alle Würfel sind gehalten.");
      if (s.dice.length !== 5) { s.dice = [0, 0, 0, 0, 0]; s.held = [false, false, false, false, false]; }
      // nur die freien Würfel neu werfen
      const fresh = rollDice(s.held.filter((h) => !h).length);
      s.dice = s.dice.map((d, i) => (s.held[i] ? d : fresh.shift()!));
      s.rollsLeft--;
      s.n++;
      return s;
    }
    case "hold": {
      if (!app || s.dice.length !== 5) throw new GameError("Erst würfeln.");
      if (s.rollsLeft <= 0) throw new GameError("Keine Würfe mehr – trag jetzt ein.");
      if (!Number.isInteger(a.i) || a.i < 0 || a.i > 4) throw new GameError("Diesen Würfel gibt es nicht.");
      s.held[a.i] = !s.held[a.i];
      return s;
    }
    case "score": {
      if (!cur) throw new GameError("Es ist niemand am Zug.");
      if (!ALL_CATS.includes(a.cat)) throw new GameError("Dieses Feld gibt es nicht.");
      const sheet = (s.sheets[cur.id] ??= {});
      if (sheet[a.cat] !== undefined) throw new GameError(`${CATS[a.cat].name} ist schon eingetragen.`);
      const extraAllowed = extraRuleOf(ctx) && sheet.kniffel === 50;
      let pts: number;
      let extra = 0;
      if (app) {
        if (s.dice.length !== 5) throw new GameError("Erst würfeln.");
        const extraKniffel = extraAllowed && isKniffel(s.dice);
        pts = scoreFor(a.cat, s.dice, extraKniffel);
        if (extraKniffel) extra = EXTRA_KNIFFEL;
      } else {
        pts = Number(a.value ?? 0);
        if (!validEntry(a.cat, pts)) throw new GameError(`${pts} Punkte gehen bei ${CATS[a.cat].name} nicht.`);
        if (a.extra) {
          if (!extraAllowed) throw new GameError("Ein Extra-Kniffel zählt erst, wenn der Kniffel mit 50 eingetragen ist.");
          extra = EXTRA_KNIFFEL;
        }
      }
      sheet[a.cat] = pts;
      if (extra) s.extras[cur.id] = (s.extras[cur.id] ?? 0) + extra;
      s.log.push({ playerId: cur.id, name: cur.name, cat: a.cat, pts, extra });
      if (s.log.length > MAX_LOG) s.log.shift();
      advance(s, ctx);
      return s;
    }
    case "undo": {
      const e = s.log.pop();
      if (!e) throw new GameError("Es gibt nichts zum Zurücknehmen.");
      delete s.sheets[e.playerId]?.[e.cat];
      if (e.extra) s.extras[e.playerId] = (s.extras[e.playerId] ?? 0) - e.extra;
      if (ctx.players.some((p) => p.id === e.playerId)) s.curId = e.playerId;
      s.finished = false;
      freshTurn(s);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

export const kniffel: GameLogic<KniffelState, KniffelAction> = {
  info: {
    id: "kniffel",
    name: "Kniffel",
    tagline: "Dreimal würfeln, clever eintragen – wer am Ende den vollsten Block hat, gewinnt.",
    category: "Würfel",
    minPlayers: 1,
    maxPlayers: 8,
    duration: "20–40 Min.",
  },
  version: 1,
  turnBased: true,
  joinMidGame: false,
  settings: [
    {
      key: "diceMode", label: "Würfel", type: "choice", default: "app",
      choices: [
        { value: "app", label: "App-Würfel", hint: "App würfelt und rechnet" },
        { value: "real", label: "Echte Würfel", hint: "digitaler Block" },
      ],
    },
    { key: "extraKniffel", label: "Extra-Kniffel", type: "toggle", default: false, hint: "Jeder weitere Kniffel: +50 und Joker für Full House und Straßen" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "undo" ? "host" : a.type === "roll" || a.type === "hold" || a.type === "score" ? "turn" : null),
  currentPlayerId: (s) => (s.finished ? null : s.curId),
  isOver: (s) => s.finished,
  results: (s, ctx) => {
    const ids = ctx.players.map((p) => p.id);
    const win = winners(s, ids);
    return ids.map((id) => ({ id, won: win.includes(id), score: totals(s, id).total }));
  },
  skipLabel: (s, ctx) => {
    const cur = ctx.players.find((p) => p.id === s.curId);
    return cur && !s.finished ? `Zug von ${cur.name} überspringen (erstes freies Feld wird gestrichen)` : null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    const cur = ctx.players.find((p) => p.id === s.curId);
    if (!cur) return s;
    const sheet = (s.sheets[cur.id] ??= {});
    const cat = ALL_CATS.find((c) => sheet[c] === undefined);
    if (cat) {
      sheet[cat] = 0;
      s.log.push({ playerId: cur.id, name: cur.name, cat, pts: 0, extra: 0 });
    }
    advance(s, ctx);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    if (prev.curId !== id) return prev;
    const s = structuredClone(prev);
    const rest = { ...ctx, players: ctx.players.filter((p) => p.id !== id) };
    s.curId = nextPlayerId(ctx.players, id);
    if (s.curId === id || !rest.players.length) { s.curId = null; s.finished = true; return s; }
    freshTurn(s);
    if (isFull(s, s.curId!)) advance(s, rest);
    return s;
  },
};
