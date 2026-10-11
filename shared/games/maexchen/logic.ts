/**
 * Mäxchen – Bluff-Würfelspiel mit zwei Würfeln. Läuft im Browser (lokal) und im Durable Object (online).
 * Wer dran ist, würfelt verdeckt, sagt einen höheren Wert an (Wahrheit oder Lüge) und gibt weiter.
 * Der Nächste glaubt (und würfelt selbst) oder deckt auf. Wer falschliegt, verliert ein Leben.
 * Zwei Arten zu spielen: App-Würfel (der Wurf ist nur für den Würfelnden sichtbar) oder echte Würfel am Tisch.
 */
import { firstPlayerId } from "../../platform/turns";
import { rollDice } from "../../platform/random";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

/** Alle Würfe von niedrig nach hoch: Zahlen (höhere Ziffer vorn), dann Pasche, ganz oben Mäxchen */
export const ORDER = [31, 32, 41, 42, 43, 51, 52, 53, 54, 61, 62, 63, 64, 65, 11, 22, 33, 44, 55, 66, 21] as const;
export const MAEXCHEN = 21;

export const rankOf = (v: number) => ORDER.indexOf(v as (typeof ORDER)[number]);
export const isValue = (v: unknown): v is number => typeof v === "number" && rankOf(v) >= 0;
export const isPasch = (v: number) => v % 11 === 0;

/** Zwei Würfel als Mäxchen-Wert: höhere Ziffer vorn, 1+2 ist Mäxchen (21) */
export function valueOf(d: readonly number[]): number {
  const hi = Math.max(d[0], d[1]);
  const lo = Math.min(d[0], d[1]);
  return hi * 10 + lo;
}

/** Die beiden Würfel eines Werts (zum Zeichnen) */
export const facesOf = (v: number): [number, number] => [Math.floor(v / 10), v % 10];

const PASCH = ["", "Einer", "Zweier", "Dreier", "Vierer", "Fünfer", "Sechser"];
/** Ansage zum Vorlesen: „Mäxchen“, „Sechserpasch“, „63“ */
export function labelOf(v: number): string {
  if (v === MAEXCHEN) return "Mäxchen";
  if (isPasch(v)) return `${PASCH[v / 11]}pasch`;
  return String(v);
}

/** Wie wahrscheinlich ist ein Wurf mindestens so hoch wie `v`? (0..1) */
export function chanceAtLeast(v: number): number {
  const r = rankOf(v);
  let n = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (rankOf(valueOf([a, b])) >= r) n++;
  return n / 36;
}

export interface Announce {
  by: string;
  value: number;
  /** ohne zu würfeln weitergegeben */
  blind: boolean;
}

export interface Reveal {
  /** wer aufgedeckt hat */
  by: string;
  /** wessen Ansage geprüft wurde */
  target: string;
  value: number;
  /** was unter dem Becher lag (nur App-Würfel) */
  dice: [number, number] | null;
  /** Ansage stimmte (Wurf mindestens so hoch) */
  truth: boolean;
  loser: string;
  cost: number;
  /** Verlierer ist ausgeschieden */
  out: boolean;
}

export type MaexEvent =
  | ({ t: "ann"; name: string } & Announce)
  | ({ t: "reveal"; byName: string; targetName: string; loserName: string } & Reveal)
  | { t: "skip"; id: string; name: string };

export interface MaexState {
  v: 1;
  /** echte Würfel am Tisch – die App führt nur Ansagen und Leben */
  table: boolean;
  lives: Record<string, number>;
  /** ausgeschiedene Spieler in Reihenfolge */
  out: string[];
  curId: string | null;
  /** was unter dem Becher liegt (geheim, nur App-Würfel) */
  dice: [number, number] | null;
  /** wer den Wurf unter dem Becher gesehen hat */
  seenBy: string | null;
  /** der Spieler am Zug hat schon gewürfelt und muss ansagen */
  rolled: boolean;
  /** Ansagen der laufenden Runde (älteste zuerst) */
  round: Announce[];
  /** zuletzt aufgedeckt – bleibt stehen, bis wieder aufgedeckt wird */
  reveal: Reveal | null;
  events: MaexEvent[];
  /** zählt Würfe/Züge, damit die Oberfläche neu animieren kann */
  n: number;
  over: boolean;
  winnerId: string | null;
}

export type MaexAction =
  | { type: "roll" }
  | { type: "announce"; value: number }
  /** Aufdecken – mit echten Würfeln sagt der Aufdeckende, ob die Ansage stimmte */
  | { type: "reveal"; truth?: boolean };

const MAX_EVENTS = 80;

export const livesOf = (o: Options) => Math.min(6, Math.max(1, Math.round(Number(o.lives) || 3)));
export const maexDoubleOf = (o: Options) => o.maexDouble !== false;
export const blindOf = (o: Options) => o.blind !== false && o.mode !== "table";

export const lastOf = (s: MaexState): Announce | null => s.round.at(-1) ?? null;
export const isAlive = (s: MaexState, id: string) => (s.lives[id] ?? 0) > 0;

/** Nächster Spieler im Kreis, der noch Leben hat (ohne `from` selbst) */
export function nextAlive(s: MaexState, players: Player[], from: string | null): string | null {
  const i = players.findIndex((p) => p.id === from);
  for (let k = 1; k <= players.length; k++) {
    const p = players[(i + k + players.length) % players.length];
    if (p.id !== from && isAlive(s, p.id)) return p.id;
  }
  return null;
}

/** Was darf der Spieler am Zug gerade? */
export function turnOptions(s: MaexState, options: Options) {
  const last = lastOf(s);
  const maxed = last?.value === MAEXCHEN;
  return {
    roll: !s.table && !s.rolled && !maxed,
    reveal: !!last && !s.rolled,
    blind: !s.table && !s.rolled && !!last && !maxed && blindOf(options),
    announce: s.table ? !maxed : s.rolled,
    /** niedrigste erlaubte Ansage (Rang) */
    minRank: last ? rankOf(last.value) + 1 : 0,
  };
}

const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? "?";

function push(s: MaexState, e: MaexEvent) {
  s.events.push(e);
  if (s.events.length > MAX_EVENTS) s.events.shift();
}

function newRound(s: MaexState, starter: string | null) {
  s.round = [];
  s.dice = null;
  s.seenBy = null;
  s.rolled = false;
  s.curId = starter;
}

/** Bleibt nur einer übrig, hat er gewonnen */
function checkEnd(s: MaexState, players: Player[]) {
  const alive = players.filter((p) => isAlive(s, p.id));
  if (alive.length <= 1) {
    s.over = true;
    s.winnerId = alive[0]?.id ?? null;
    s.curId = null;
  }
}

function setup(ctx: GameContext): MaexState {
  const lives = livesOf(ctx.options);
  return {
    v: 1, table: ctx.options.mode === "table",
    lives: Object.fromEntries(ctx.players.map((p) => [p.id, lives])), out: [],
    curId: firstPlayerId(ctx), dice: null, seenBy: null, rolled: false, round: [], reveal: null, events: [],
    n: 0, over: false, winnerId: null,
  };
}

function apply(prev: MaexState, a: MaexAction, ctx: GameContext): MaexState {
  if (prev.over) throw new GameError("Die Partie ist vorbei.");
  const s = structuredClone(prev);
  const cur = s.curId;
  if (!cur || !ctx.players.some((p) => p.id === cur)) throw new GameError("Gerade ist niemand dran.");
  const can = turnOptions(s, ctx.options);
  const last = lastOf(s);

  switch (a.type) {
    case "roll": {
      if (s.table) throw new GameError("Ihr würfelt mit echten Würfeln am Tisch.");
      if (s.rolled) throw new GameError("Du hast schon gewürfelt – sag jetzt an.");
      if (!can.roll) throw new GameError("Mäxchen ist nicht zu überbieten – deck auf!");
      const d = rollDice(2);
      s.dice = [d[0], d[1]];
      s.seenBy = cur;
      s.rolled = true;
      s.n++;
      return s;
    }
    case "announce": {
      if (!isValue(a.value)) throw new GameError("Diesen Wurf gibt es nicht.");
      if (last && rankOf(a.value) <= rankOf(last.value)) {
        throw new GameError(last.value === MAEXCHEN ? "Mäxchen ist nicht zu überbieten – deck auf!" : `Du musst mehr als ${labelOf(last.value)} ansagen.`);
      }
      let blind = false;
      if (!s.table && !s.rolled) {
        if (!last) throw new GameError("Erst würfeln.");
        if (!blindOf(ctx.options)) throw new GameError("Erst würfeln – blind weitergeben ist ausgeschaltet.");
        blind = true;
      }
      const ann: Announce = { by: cur, value: a.value, blind };
      s.round.push(ann);
      push(s, { t: "ann", name: nameOf(ctx.players, cur), ...ann });
      s.rolled = false;
      s.curId = nextAlive(s, ctx.players, cur);
      s.n++;
      return s;
    }
    case "reveal": {
      if (!last) throw new GameError("Es gibt noch keine Ansage zum Aufdecken.");
      if (s.rolled) throw new GameError("Du hast schon gewürfelt – sag jetzt an.");
      let truth: boolean;
      if (s.table) {
        if (typeof a.truth !== "boolean") throw new GameError("Stimmte die Ansage?");
        truth = a.truth;
      } else {
        if (!s.dice) throw new GameError("Unter dem Becher liegt nichts.");
        truth = rankOf(valueOf(s.dice)) >= rankOf(last.value);
      }
      const loser = truth ? cur : last.by;
      const cost = Math.min(s.lives[loser] ?? 0, truth && last.value === MAEXCHEN && maexDoubleOf(ctx.options) ? 2 : 1);
      s.lives[loser] = (s.lives[loser] ?? 0) - cost;
      const out = s.lives[loser] <= 0;
      if (out && !s.out.includes(loser)) s.out.push(loser);
      s.reveal = { by: cur, target: last.by, value: last.value, dice: s.table ? null : s.dice, truth, loser, cost, out };
      push(s, {
        t: "reveal", byName: nameOf(ctx.players, cur), targetName: nameOf(ctx.players, last.by), loserName: nameOf(ctx.players, loser), ...s.reveal,
      });
      // Der Verlierer beginnt die neue Runde – ist er raus, sein linker Nachbar
      newRound(s, out ? nextAlive(s, ctx.players, loser) : loser);
      s.n++;
      checkEnd(s, ctx.players);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

export const maexchen: GameLogic<MaexState, MaexAction> = {
  info: {
    id: "maexchen",
    name: "Mäxchen",
    tagline: "Verdeckt würfeln, höher ansagen, frech bluffen – glaubst du's oder deckst du auf?",
    category: "Würfel",
    minPlayers: 2,
    maxPlayers: 10,
    duration: "10–20 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  settings: [
    {
      key: "mode", label: "Würfel", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "App würfelt verdeckt" },
        { value: "table", label: "Echte Würfel", hint: "Becher am Tisch, App führt Leben" },
      ],
    },
    { key: "lives", label: "Leben je Spieler", type: "number", default: 3, min: 1, max: 6, step: 1 },
    {
      key: "maexDouble", label: "Mäxchen kostet doppelt", type: "toggle", default: true, group: "Hausregeln",
      hint: "Original – wer ein echtes Mäxchen aufdeckt, verliert 2 Leben",
    },
    {
      key: "blind", label: "Blind weitergeben", type: "toggle", default: true, group: "Hausregeln", showIf: (o) => o.mode !== "table",
      hint: "Wer glaubt, darf ohne zu würfeln weitergeben – muss aber höher ansagen",
    },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "roll" || a.type === "announce" || a.type === "reveal" ? "turn" : null),
  currentPlayerId: (s) => (s.over ? null : s.curId),
  isOver: (s) => s.over,
  results: (s, ctx) => ctx.players.map((p) => ({ id: p.id, won: p.id === s.winnerId, score: Math.max(0, s.lives[p.id] ?? 0) })),
  skipLabel: (s, ctx) => {
    if (s.over || !s.curId) return null;
    return `${nameOf(ctx.players, s.curId)} überspringen (Runde beginnt neu)`;
  },
  skipTurn(prev, ctx) {
    if (prev.over || !prev.curId) return prev;
    const s = structuredClone(prev);
    const id = s.curId!;
    push(s, { t: "skip", id, name: nameOf(ctx.players, id) });
    newRound(s, nextAlive(s, ctx.players, id));
    s.n++;
    checkEnd(s, ctx.players);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    if (prev.over) return prev;
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    const wasCur = s.curId === id;
    // Der Nachfolger im Kreis, solange der Gehende noch mitgezählt wird
    const after = nextAlive(s, ctx.players, id);
    s.lives[id] = 0;
    if (wasCur) newRound(s, after);
    else if (s.round.some((x) => x.by === id)) newRound(s, s.curId);
    checkEnd(s, rest);
    return s;
  },
  /** Den Wurf unter dem Becher sieht nur, wer ihn gewürfelt hat – und nur, solange er am Zug ist */
  view: (s, viewer) => (viewer === null || (s.seenBy === viewer && s.curId === viewer && s.rolled) ? s : { ...s, dice: null }),
};
