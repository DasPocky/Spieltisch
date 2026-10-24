/**
 * Schocken – Würfelspiel mit drei Würfeln und Becher. Läuft im Browser (lokal) und im Durable Object (online).
 * Jede Runde würfelt jeder bis zu dreimal (der Beginner legt die Wurfzahl vor) und darf Würfel herauslegen.
 * Der höchste Wurf bestimmt, wie viele Deckel der niedrigste bekommt: erst aus der Mitte, dann vom Gewinner.
 * Wer alle 13 Deckel hat, verliert die Hälfte. Zwei Hälften, bei verschiedenen Verlierern ein Finale.
 * Zwei Arten zu spielen: App-Würfel (offen, alle sehen den Wurf) oder echte Würfel – dann zählt die App nur die Deckel.
 */
import { rollDice } from "../../platform/random";
import { firstPlayerId, playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export const LIDS = 13;
export const MAX_THROWS = 3;
const MAX_LOG = 80;

export type HandKind = "aus" | "schock" | "general" | "strasse" | "zahl";
export interface HandInfo {
  kind: HandKind;
  /** zum Vorlesen und Anzeigen: „Schock aus“, „Schock 4“, „Fünfer-General“, „Straße 3-4-5“, „653“ */
  label: string;
  /** Deckel, die dieser Wurf als bester der Runde kostet (Schock aus: alle) */
  lids: number;
  /** vergleichbar: höher ist besser */
  score: number;
}

const FACE = ["", "Einer", "Zweier", "Dreier", "Vierer", "Fünfer", "Sechser"];

/** Was ist dieser Wurf wert? Rangfolge: Schock aus > Schock 6…2 > General > Straße > Zahl */
export function handOf(dice: readonly number[]): HandInfo {
  const d = [...dice].sort((a, b) => b - a);
  const [a, b, c] = d;
  if (a === 1 && b === 1 && c === 1) return { kind: "aus", label: "Schock aus", lids: LIDS, score: 10_000 };
  if (b === 1 && c === 1) return { kind: "schock", label: `Schock ${a}`, lids: a, score: 9_000 + a };
  if (a === b && b === c) return { kind: "general", label: `${FACE[a]}-General`, lids: 3, score: 8_000 + a };
  if (a - 1 === b && b - 1 === c) return { kind: "strasse", label: `Straße ${c}-${b}-${a}`, lids: 2, score: 7_000 + a };
  return { kind: "zahl", label: `${a}${b}${c}`, lids: 1, score: a * 100 + b * 10 + c };
}

/** Was der Gewinner als Deckel kostet – zum Eintippen mit echten Würfeln */
export const TALLY_CHOICES: { count: number | "aus"; label: string; hint: string }[] = [
  { count: "aus", label: "Schock aus", hint: "1-1-1 – Hälfte verloren" },
  { count: 6, label: "Schock 6", hint: "1-1-6" },
  { count: 5, label: "Schock 5", hint: "1-1-5" },
  { count: 4, label: "Schock 4", hint: "1-1-4" },
  { count: 3, label: "Schock 3 / General", hint: "1-1-3 oder drei Gleiche" },
  { count: 2, label: "Schock 2 / Straße", hint: "1-1-2 oder 4-5-6 …" },
  { count: 1, label: "Zahl", hint: "alles andere" },
];

export interface ShHand {
  dice: number[];
  throws: number;
}

export interface ShResult {
  half: number;
  round: number;
  /** fertige Würfe der Runde (leer bei echten Würfeln) */
  hands: Record<string, ShHand>;
  /** Reihenfolge der Runde */
  order: string[];
  winner: string;
  loser: string;
  /** Bezeichnung des besten Wurfs */
  label: string;
  /** so viele Deckel kostete der beste Wurf */
  worth: number;
  /** so viele gingen wirklich an den Verlierer */
  moved: number;
  from: "pot" | "winner";
  aus: boolean;
  /** wer damit die Hälfte verloren hat */
  halfLost: string | null;
}

export interface ShState {
  v: 1;
  /** echte Würfel am Tisch – die App zählt nur die Deckel */
  table: boolean;
  /** 1, 2 oder 3 (= Finale) */
  half: number;
  /** wie viele Hälften die Partie hat (1 oder 2 plus Finale) */
  halves: number;
  /** Verlierer der Hälften in Reihenfolge */
  halfLosers: string[];
  /** wer in dieser Hälfte mitspielt (Sitzreihenfolge) */
  members: string[];
  /** Deckel in der Mitte */
  pot: number;
  lids: Record<string, number>;
  /** alle Deckel, die jemand in der ganzen Partie bekommen hat */
  taken: Record<string, number>;
  phase: "roll" | "roundEnd" | "over";
  round: number;
  starter: string | null;
  curId: string | null;
  order: string[];
  /** höchstens so viele Würfe (der Beginner legt vor) */
  limit: number;
  dice: number[];
  held: boolean[];
  throws: number;
  /** Sechsen gedreht – jetzt muss geworfen werden */
  turned: boolean;
  hands: Record<string, ShHand>;
  last: ShResult | null;
  log: string[];
  /** zählt Würfe/Züge, damit die Oberfläche neu animieren kann */
  n: number;
  /** zählt jede Aktion (auch Herauslegen) – Bots mit festem Startwert drehen sich so nicht im Kreis */
  step: number;
  /** wer die Partie verloren hat */
  loser: string | null;
}

export type ShAction =
  | { type: "roll" }
  | { type: "hold"; i: number }
  /** zwei Sechsen: eine wird zur Eins und bleibt draußen, die andere kommt zurück in den Becher */
  | { type: "turn" }
  | { type: "stop" }
  /** echte Würfel: wer hatte den besten und wer den schlechtesten Wurf, was war der beste wert? */
  | { type: "tally"; winner: string; loser: string; count: number | "aus" }
  | { type: "next" };

export const tableOf = (o: Options) => o.mode === "table";
export const sixesOf = (o: Options) => o.sixes === true && !tableOf(o);
export const halvesOf = (o: Options) => (o.length === "half" ? 1 : 2);

const nameOf = (players: Player[], id: string | null | undefined) => playerName({ players }, id);

function push(s: ShState, line: string) {
  s.log.push(line);
  if (s.log.length > MAX_LOG) s.log.shift();
}

/** Wer spielt die Runde mit? Solange Deckel in der Mitte liegen alle der Hälfte, danach nur, wer Deckel hat */
export const inPlay = (s: ShState) => (s.pot > 0 ? s.members : s.members.filter((id) => (s.lids[id] ?? 0) > 0));

/** Gleicher Wurf: weniger Würfe ist besser, dann wer früher dran war */
export function ranked(s: Pick<ShState, "hands" | "order">): string[] {
  const at = (id: string) => s.order.indexOf(id);
  return s.order.filter((id) => s.hands[id]).sort((x, y) =>
    handOf(s.hands[y].dice).score - handOf(s.hands[x].dice).score || s.hands[x].throws - s.hands[y].throws || at(x) - at(y));
}

function freshTurn(s: ShState) {
  s.dice = [];
  s.held = [false, false, false];
  s.throws = 0;
  s.turned = false;
}

/** Nur die Würfel im Becher werden neu geworfen */
function throwDice(s: ShState) {
  if (s.dice.length !== 3) { s.dice = rollDice(3); s.held = [false, false, false]; }
  else {
    const fresh = rollDice(s.held.filter((h) => !h).length);
    s.dice = s.dice.map((d, i) => (s.held[i] ? d : fresh.shift()!));
  }
  s.throws++;
  s.turned = false;
}

function startRound(s: ShState, starter: string | null) {
  const play = inPlay(s);
  const first = starter && play.includes(starter) ? starter : play[0] ?? null;
  const i = first ? play.indexOf(first) : 0;
  s.round++;
  s.order = [...play.slice(i), ...play.slice(0, i)];
  s.starter = first;
  s.curId = first;
  s.limit = MAX_THROWS;
  s.hands = {};
  s.phase = "roll";
  freshTurn(s);
}

function startHalf(s: ShState, half: number, members: string[], starter: string | null) {
  s.half = half;
  s.members = members;
  s.pot = LIDS;
  s.lids = Object.fromEntries(members.map((id) => [id, 0]));
  s.round = 0;
  s.last = null;
  startRound(s, starter);
}

function finish(s: ShState, loser: string | null) {
  s.phase = "over";
  s.loser = loser;
  s.curId = null;
}

/** Hälfte verloren: nächste Hälfte, Finale oder Schluss */
function afterHalf(s: ShState, loser: string, players: Player[]) {
  const here = (id: string) => players.some((p) => p.id === id);
  if (s.half >= 3 || s.halves === 1) return finish(s, loser);
  if (s.half === 1) return; // zweite Hälfte startet mit „Weiter“
  // zweite Hälfte: derselbe Verlierer zweimal – Partie verloren, sonst Finale
  const first = s.halfLosers[0];
  if (first === loser || !here(first)) finish(s, loser);
}

function nextHalf(s: ShState, players: Player[]) {
  const loser = s.halfLosers.at(-1) ?? null;
  if (s.half === 1) return startHalf(s, 2, players.map((p) => p.id), loser);
  // Finale der beiden Hälften-Verlierer, in Sitzreihenfolge
  const two = players.map((p) => p.id).filter((id) => s.halfLosers.includes(id));
  if (two.length < 2) return finish(s, loser);
  startHalf(s, 3, two, loser);
}

/** Deckel verteilen: aus der Mitte, sonst vom Gewinner; Schock aus: alle zum Verlierer */
function settle(s: ShState, winner: string, loser: string, worth: number, aus: boolean, label: string, players: Player[]) {
  const from: ShResult["from"] = s.pot > 0 ? "pot" : "winner";
  let moved: number;
  if (aus) {
    const before = s.lids[loser] ?? 0;
    for (const id of s.members) s.lids[id] = 0;
    s.lids[loser] = LIDS;
    s.pot = 0;
    moved = LIDS - before;
  } else if (from === "pot") {
    moved = Math.min(worth, s.pot);
    s.pot -= moved;
    s.lids[loser] = (s.lids[loser] ?? 0) + moved;
  } else {
    moved = Math.min(worth, s.lids[winner] ?? 0);
    s.lids[winner] -= moved;
    s.lids[loser] = (s.lids[loser] ?? 0) + moved;
  }
  s.taken[loser] = (s.taken[loser] ?? 0) + moved;
  const halfLost = aus || (s.pot === 0 && inPlay(s).length <= 1) ? loser : null;
  s.last = { half: s.half, round: s.round, hands: s.hands, order: s.order, winner, loser, label, worth, moved, from, aus, halfLost };
  const w = nameOf(players, winner), l = nameOf(players, loser);
  push(s, `${w}: ${label} – ${l} ${moved === 1 ? "bekommt 1 Deckel" : `bekommt ${moved} Deckel`}${from === "winner" && !aus ? ` von ${w}` : ""}`);
  s.phase = "roundEnd";
  s.curId = null;
  if (halfLost) {
    s.halfLosers.push(loser);
    push(s, s.half === 3 ? `${l} verliert das Finale` : `${l} verliert die ${s.half}. Hälfte`);
    afterHalf(s, loser, players);
  }
  s.n++;
}

/** Alle durch? Dann werten */
function evaluate(s: ShState, players: Player[]) {
  const r = ranked(s);
  if (r.length < 2) {
    // nur noch einer übrig – nichts zu werten, neu anfangen
    if (r.length) startRound(s, r[0]);
    return;
  }
  const winner = r[0], loser = r[r.length - 1];
  const h = handOf(s.hands[winner].dice);
  settle(s, winner, loser, h.lids, h.kind === "aus", h.label, players);
}

function finishTurn(s: ShState, players: Player[]) {
  const cur = s.curId!;
  s.hands[cur] = { dice: [...s.dice], throws: s.throws };
  if (cur === s.order[0]) s.limit = s.throws;
  const next = s.order.find((id) => !s.hands[id]);
  s.n++;
  if (next) { s.curId = next; freshTurn(s); return; }
  evaluate(s, players);
}

/** Was darf der Spieler am Zug gerade? */
export function turnOptions(s: ShState, options: Options) {
  const rolled = s.dice.length === 3;
  const sixes = s.dice.filter((d) => d === 6).length;
  const left = s.limit - s.throws;
  return {
    roll: !s.table && left > 0 && (!rolled || s.turned || s.held.some((h) => !h)),
    hold: !s.table && rolled && left > 0 && !s.turned,
    turn: sixesOf(options) && rolled && left > 0 && !s.turned && sixes >= 2,
    stop: !s.table && rolled && !s.turned,
    left,
  };
}

function setup(ctx: GameContext): ShState {
  const s: ShState = {
    v: 1, table: tableOf(ctx.options), half: 1, halves: halvesOf(ctx.options), halfLosers: [], members: [], pot: LIDS, lids: {},
    taken: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    phase: "roll", round: 0, starter: null, curId: null, order: [], limit: MAX_THROWS, dice: [], held: [false, false, false], throws: 0, turned: false,
    hands: {}, last: null, log: [], n: 0, step: 0, loser: null,
  };
  startHalf(s, 1, ctx.players.map((p) => p.id), firstPlayerId(ctx));
  return s;
}

function apply(prev: ShState, a: ShAction, ctx: GameContext): ShState {
  if (prev.phase === "over") throw new GameError("Die Partie ist vorbei.");
  const s = structuredClone(prev);
  s.step = (s.step ?? 0) + 1;
  if (a.type === "next") {
    if (s.phase !== "roundEnd") throw new GameError("Die Runde läuft noch.");
    if (s.last?.halfLost) nextHalf(s, ctx.players);
    else startRound(s, s.last?.loser ?? s.starter);
    s.n++;
    return s;
  }
  if (s.phase !== "roll") throw new GameError("Die Runde ist schon gewertet.");
  const cur = s.curId;
  if (!cur) throw new GameError("Gerade ist niemand dran.");
  const can = turnOptions(s, ctx.options);
  switch (a.type) {
    case "roll": {
      if (s.table) throw new GameError("Ihr würfelt mit echten Würfeln am Tisch.");
      if (can.left <= 0) throw new GameError(s.limit < MAX_THROWS ? `Mehr als ${s.limit} ${s.limit === 1 ? "Wurf" : "Würfe"} sind diese Runde nicht erlaubt.` : "Du hast keine Würfe mehr.");
      if (!can.roll) throw new GameError("Alle Würfel liegen draußen – lass sie stehen.");
      throwDice(s);
      s.n++;
      return s;
    }
    case "hold": {
      if (!can.hold) throw new GameError(s.turned ? "Erst würfeln – die Sechs muss zurück in den Becher." : "Gerade gibt es nichts herauszulegen.");
      const i = a.i;
      if (!Number.isInteger(i) || i < 0 || i > 2) throw new GameError("Diesen Würfel gibt es nicht.");
      s.held[i] = !s.held[i];
      return s;
    }
    case "turn": {
      if (!sixesOf(ctx.options)) throw new GameError("Sechsen drehen ist ausgeschaltet.");
      if (!can.turn) throw new GameError(can.left <= 0 ? "Drehen geht nur, wenn du noch würfeln darfst." : "Dafür brauchst du zwei Sechsen.");
      const [x, y] = s.dice.flatMap((d, i) => (d === 6 ? [i] : []));
      s.dice[x] = 1;
      s.held[x] = true;
      s.held[y] = false;
      s.turned = true;
      push(s, `${nameOf(ctx.players, cur)} dreht zwei Sechsen zu einer Eins`);
      s.n++;
      return s;
    }
    case "stop": {
      if (s.table) throw new GameError("Mit echten Würfeln tippt ihr das Ergebnis der Runde ein.");
      if (!can.stop) throw new GameError(s.turned ? "Erst würfeln – die Sechs muss zurück in den Becher." : "Erst würfeln.");
      finishTurn(s, ctx.players);
      return s;
    }
    case "tally": {
      if (!s.table) throw new GameError("Die App würfelt – hier gibt es nichts einzutippen.");
      const play = inPlay(s);
      if (!play.includes(a.winner) || !play.includes(a.loser)) throw new GameError("Wer hat mitgewürfelt?");
      if (a.winner === a.loser) throw new GameError("Gewinner und Verlierer müssen verschiedene Spieler sein.");
      const choice = TALLY_CHOICES.find((c) => c.count === a.count);
      if (!choice) throw new GameError("Was war der beste Wurf?");
      s.hands = {};
      settle(s, a.winner, a.loser, a.count === "aus" ? LIDS : a.count, a.count === "aus", choice.label, ctx.players);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

// ---------------------------------------------------------------- Strategie (Spielhilfe und Bots)

/** Ein Plan für den Zug: würfeln (mit diesen Würfeln draußen), Sechsen drehen oder stehen lassen */
export type ShPlan = { type: "roll"; hold: boolean[] } | { type: "turn" } | { type: "stop" };

/** Wie gut muss mein Wurf sein? Schlechtester fertiger Wurf der anderen – den will ich schlagen */
function worstOther(s: ShState, me: string): HandInfo | null {
  const done = ranked(s).filter((id) => id !== me);
  const id = done.at(-1);
  return id ? handOf(s.hands[id].dice) : null;
}

/** Ein einfacher, guter Plan: Einsen herauslegen, starke Würfe stehen lassen, nicht der Letzte sein */
export function suggest(s: ShState, me: string, options: Options): ShPlan {
  const can = turnOptions(s, options);
  if (!s.dice.length) return { type: "roll", hold: [false, false, false] };
  if (s.turned) return { type: "roll", hold: s.held };
  const h = handOf(s.dice);
  if (can.left <= 0) return { type: "stop" };
  if (h.kind === "aus" || h.kind === "schock" || h.kind === "general") return { type: "stop" };
  const worst = worstOther(s, me);
  const beginner = s.order[0] === me;
  // Beginner: mit Straße zufrieden; danach: stehen lassen, sobald ich nicht der Schlechteste bin
  if (beginner ? h.kind === "strasse" : worst && h.score > worst.score) return { type: "stop" };
  if (can.turn && s.dice.filter((d) => d === 1).length === 0) return { type: "turn" };
  // Einsen draußen lassen; ohne Eins die Sechsen (gute Zahl)
  const ones = s.dice.map((d) => d === 1);
  const hold = ones.some(Boolean) ? ones : s.dice.map((d) => d === 6);
  if (hold.every(Boolean)) return { type: "stop" };
  return { type: "roll", hold };
}

export const schocken: GameLogic<ShState, ShAction> = {
  info: {
    id: "schocken",
    name: "Schocken",
    tagline: "Bis zu dreimal würfeln, Einsen herauslegen – wer am Ende alle Deckel hat, verliert.",
    category: "Würfel",
    minPlayers: 2,
    maxPlayers: 10,
    duration: "15–30 Min.",
  },
  version: 1,
  turnBased: true,
  joinMidGame: false,
  presets: [
    { id: "kurz", label: "Kurz", hint: "nur eine Hälfte", options: { length: "half" } },
    { id: "kneipe", label: "Kneipe", hint: "mit Sechsen drehen", options: { sixes: true } },
  ],
  settings: [
    {
      key: "mode", label: "Würfel", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "App würfelt, alle sehen den Wurf" },
        { value: "table", label: "Echte Würfel", hint: "Becher am Tisch, App zählt Deckel" },
      ],
    },
    {
      key: "length", label: "Länge", type: "choice", default: "full",
      choices: [
        { value: "full", label: "Zwei Hälften", hint: "wie im Original, bei Bedarf Finale" },
        { value: "half", label: "Eine Hälfte", hint: "kürzere Partie" },
      ],
    },
    {
      key: "sixes", label: "Sechsen drehen", type: "toggle", default: false, group: "Hausregeln", showIf: (o) => o.mode !== "table",
      hint: "Zwei Sechsen dürfen zu einer Eins werden – die andere Sechs kommt zurück in den Becher",
    },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt Würfe, Deckel und Hälften an (online: das Handy des Hosts)" },
  ],
  setup,
  apply,
  actionKind: (a) => (a.type === "next" ? "player" : ["roll", "hold", "turn", "stop", "tally"].includes(a.type) ? "turn" : null),
  currentPlayerId: (s) => (s.phase === "roll" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => ctx.players.map((p) => ({ id: p.id, won: p.id !== s.loser, score: s.taken[p.id] ?? 0 })),
  skipLabel: (s, ctx) => {
    if (s.phase !== "roll" || !s.curId) return null;
    const name = nameOf(ctx.players, s.curId);
    if (s.table) return `Für ${name} weiter – nächster beginnt`;
    return s.dice.length ? `${name}: Wurf stehen lassen` : `Für ${name} einmal würfeln`;
  },
  skipTurn(prev, ctx) {
    if (prev.phase !== "roll" || !prev.curId) return prev;
    const s = structuredClone(prev);
    if (s.table) {
      // echte Würfel: der Nächste im Kreis beginnt die Runde neu
      const play = inPlay(s);
      const i = play.indexOf(s.curId!);
      s.round--;
      startRound(s, play[(i + 1) % play.length]);
      s.n++;
      return s;
    }
    if (!s.dice.length || s.turned) {
      throwDice(s);
    }
    push(s, `${nameOf(ctx.players, s.curId)} übersprungen`);
    finishTurn(s, ctx.players);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    if (prev.phase === "over") return prev;
    const s = structuredClone(prev);
    const rest = ctx.players.filter((p) => p.id !== id);
    if (rest.length < 2) { finish(s, id); return s; }
    if (s.half === 3 && s.members.includes(id)) { finish(s, id); return s; }
    s.halfLosers = s.halfLosers.filter((x) => x !== id);
    if (!s.members.includes(id)) return s;
    // Seine Deckel kommen zurück in die Mitte
    s.pot += s.lids[id] ?? 0;
    delete s.lids[id];
    s.members = s.members.filter((x) => x !== id);
    // nach der Wertung: „Weiter“ fängt ohne ihn an
    if (s.phase === "roundEnd") return s;
    const wasCur = s.curId === id;
    delete s.hands[id];
    s.order = s.order.filter((x) => x !== id);
    if (!s.order.length) { startRound(s, s.members[0]); return s; }
    if (wasCur) {
      const next = s.order.find((x) => !s.hands[x]);
      if (next) { s.curId = next; freshTurn(s); } else evaluate(s, rest);
    }
    s.n++;
    return s;
  },
  botPause: (s) => (s.phase === "roundEnd" ? 3500 : s.dice.length ? 800 : 0),
};
