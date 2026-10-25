/**
 * Spielstärke der Bots – getrennt vom Zufall und wiederholbar:
 *  - „zufall“: irgendein erlaubter Zug (die Testspieler der Verwaltung, die Simulation)
 *  - „leicht“, „mittel“, „schwer“: Züge werden bewertet; je stärker, desto öfter nimmt der Bot den besten
 * Der Würfel des Bots hängt nur an einem festen Startwert und dem, was er sieht – dieselbe Lage ergibt denselben Zug.
 * Bewertet wird ausschließlich mit der eigenen Sicht (`viewRoom`): fremde Karten und der Stapel bleiben geheim.
 * Ob ein Zug erlaubt ist, prüft die Spiel-Logik – das verrät nichts, was ein Mensch nicht auch ausprobieren könnte.
 */
import { DECKS, rankOf, suitOf, type Card } from "../cards/deck";
import type { MauMauState } from "../games/maumau/logic";
import { colorOf, COLORS, isWild, valueOf, type EinsCard, type EinsState } from "../games/eins/logic";
import type { VierState } from "../games/vier/logic";
import { isKing, legalMoves as dameMoves, type DameState } from "../games/dame/logic";
import { legalMoves as muehleMoves, MILLS, type MuehleState } from "../games/muehle/logic";
import { PER_COLOR, PIECES, trackLen, type LudoState } from "../games/ludo/logic";
import { ALL_CATS, scoreFor, type Cat, type FuenfWuerfelState } from "../games/fuenfwuerfel/logic";
import { chanceAtLeast, lastOf, ORDER, rankOf as maexRank, turnOptions, valueOf as maexValue, type MaexState } from "../games/maexchen/logic";
import { estimateBid, isFool, isWizard, rankOf as hsRank, SUITS as HS_SUITS, suitOf as hsSuit, trickWinner, type HsCard, type HsState } from "../games/hellseher/logic";
import { bidChance as blChance, lastBid as blLast, minCount as blMin, type BluffState } from "../games/bluff/logic";
import { handOf as shHand, suggest as shSuggest, type ShState } from "../games/schocken/logic";
import { colorOptions as akColor, suggestColor as akSuggestColor, suggestWhite as akSuggestWhite, type AkState } from "../games/ankreuzspiel/logic";
import { cardPoints as hzPoints, suggestCard as hzSuggest, suggestPass as hzPass, type HzState } from "../games/herzen/logic";
import type { FischenState } from "../games/fischen/logic";
import type { SkState } from "../games/himmelskarten/logic";
import { cardPoints as p10Points, colorOf as p10Color, extend as p10Extend, findPhase, PHASES, isSkip as p10Skip, isWild as p10Wild, valueOf as p10Value, type P10Card, type P10State } from "../games/zehnphasen/logic";
import { bustOdds, linePoints, numValue as f7Value, type F7State } from "../games/glueckssieben/logic";
import { fits as sbFits, JOKER, needs as sbNeeds, type SbCard, type SbState } from "../games/stapelbau/logic";
import { canStop, latestCard, selectionValue, type AllesState, type DiceState } from "../games/alles/logic";
import { botMove, candidates, type Move } from "./bots";
import { applyRoomAction, roomGame, viewRoom, type RoomAction, type RoomState } from "./room";
import { GameError } from "./types";

export type BotLevel = "zufall" | "leicht" | "mittel" | "schwer";
export const BOT_LEVELS: { value: BotLevel; label: string }[] = [
  { value: "leicht", label: "Leicht" }, { value: "mittel", label: "Mittel" }, { value: "schwer", label: "Schwer" }, { value: "zufall", label: "Zufall" },
];
export const isBotLevel = (x: unknown): x is BotLevel => BOT_LEVELS.some((l) => l.value === x);

/** Wie oft der Bot den besten Zug nimmt (sonst einen beliebigen erlaubten) */
const BEST_SHARE: Record<BotLevel, number> = { zufall: 0, leicht: 0.4, mittel: 0.75, schwer: 1 };

/** Kleiner, schneller Zufallsgenerator mit Startwert (mulberry32) */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Legal = { action: RoomAction; next: RoomState };
type A = { type: string } & Record<string, unknown>;
/** Bewertung eines erlaubten Zugs aus Sicht des Bots (höher ist besser) */
type Scorer = (view: RoomState, a: { type: string } & Record<string, unknown>, after: RoomState, me: string) => number;

const g = (m: Move) => (m.action.type === "game" ? m.action.action : null);

// ---------------------------------------------------------------- Mau-Mau

function scoreMaumau(view: RoomState, a: { type: string } & Record<string, unknown>, _after: RoomState, me: string): number {
  const s = view.game as MauMauState;
  const hand = s.hands[me] ?? [];
  if (a.type === "play") {
    const card = a.card as Card;
    const r = rankOf(card);
    let v = 10 + (a.mau ? 3 : 0);
    // Bube/Unter für später aufheben – außer er ist die letzte Karte
    if ((r === "U" || r === "B") && hand.length > 1) v -= 4;
    // Strafkarten und Aussetzen sind gut, wenn der Nächste fast fertig ist
    const fewest = Math.min(...Object.entries(s.counts).filter(([id]) => id !== me).map(([, n]) => n));
    if ((r === "7" || r === "8") && fewest <= 2) v += 4;
    // Wunschfarbe: die Farbe, von der man am meisten hat
    if (a.wish) v += hand.filter((c) => c !== card && suitOf(c) === a.wish).length;
    // Farbe behalten, von der man viele hat (damit man später noch legen kann)
    v -= hand.filter((c) => c !== card && suitOf(c) === suitOf(card)).length * 0.3;
    return v;
  }
  if (a.type === "draw") return s.drawn ? -20 : 0;
  if (a.type === "pass") return -1;
  return 0;
}

// ---------------------------------------------------------------- Eins!

function scoreEins(view: RoomState, a: { type: string } & Record<string, unknown>, _after: RoomState, me: string): number {
  const s = view.game as EinsState;
  const hand = s.hands[me] ?? [];
  const most = (skip?: string) => {
    const n: Record<string, number> = {};
    for (const c of hand) if (c !== skip) { const col = colorOf(c); if (col) n[col] = (n[col] ?? 0) + 1; }
    return n;
  };
  if (a.type === "play") {
    const card = a.card as EinsCard;
    let v = 10 + (a.eins ? 3 : 0);
    // Joker für später aufheben
    if (isWild(card) && hand.length > 2) v -= 5;
    const val = valueOf(card);
    const fewest = Math.min(...Object.entries(s.counts).filter(([id]) => id !== me).map(([, n]) => n));
    if ((val === "plus2" || val === "skip" || val === "plus4") && fewest <= 2) v += 4;
    if (a.color) v += (most(card)[a.color as string] ?? 0);
    return v;
  }
  if (a.type === "color") return most()[a.color as string] ?? 0;
  if (a.type === "doubt") return -2;
  if (a.type === "draw") return -3;
  return 0;
}

// ---------------------------------------------------------------- Vier in einer Reihe

/** Steht für die Farbe ein Gewinnzug bereit? (offenes Brett, keine Geheimnisse) */
function winsNext(room: RoomState, actor: string): boolean {
  const s = room.game as VierState;
  for (let col = 0; col < s.cols; col++) {
    try {
      const n = applyRoomAction(room, { type: "game", action: { type: "drop", col } }, actor);
      if ((n.game as VierState).winner !== null) return true;
    } catch (e) { if (!(e instanceof GameError)) throw e; }
  }
  return false;
}

function scoreVier(view: RoomState, a: { type: string } & Record<string, unknown>, after: RoomState, me: string): number {
  if (a.type !== "drop") return -100;
  const s = view.game as VierState;
  const n = after.game as VierState;
  const col = a.col as number;
  if (n.winner !== null) return 1000;
  const other = s.colors.find((id) => id !== me) ?? me;
  // Darf der andere danach gewinnen? Dann nur, wenn es sowieso nicht zu verhindern ist
  let v = winsNext(after, other) ? -500 : 0;
  // Den Gewinnzug des anderen blocken: Zug, nach dem er keinen mehr hat, während er vorher einen hatte
  if (winsNext({ ...view, game: { ...s, turn: (1 - s.turn) as 0 | 1 } }, other) && v === 0) v += 200;
  // Mitte ist stärker
  v -= Math.abs(col - (s.cols - 1) / 2) * 2;
  return v;
}

// ---------------------------------------------------------------- Brettspiele zu zweit (offenes Brett)

type Duel = { colors: [string, string]; turn: 0 | 1; winner: 0 | 1 | null; draw: boolean };

/**
 * Zwei Halbzüge vorausschauen: Wert nach dem eigenen Zug, dann die beste Antwort des anderen (für ihn).
 * Ist man nach dem Zug noch selbst dran (z. B. Stein nehmen nach einer Mühle), zählt der beste eigene Folgezug.
 */
function lookahead(after: RoomState, me: string, value: (r: RoomState, side: 0 | 1) => number, replies: (r: RoomState) => A[]): number {
  const s = after.game as Duel;
  const side = s.colors.indexOf(me) as 0 | 1;
  const base = (r: RoomState) => {
    const d = r.game as Duel;
    if (d.winner !== null) return d.winner === side ? 1000 : -1000;
    return d.draw ? 0 : value(r, side);
  };
  if (s.winner !== null || s.draw) return base(after);
  const actor = s.colors[s.turn];
  const mine = actor === me;
  let best = mine ? -Infinity : Infinity;
  for (const a of replies(after)) {
    try {
      const v = base(applyRoomAction(after, { type: "game", action: a }, actor));
      best = mine ? Math.max(best, v) : Math.min(best, v);
    } catch (e) { if (!(e instanceof GameError)) throw e; }
  }
  return Number.isFinite(best) ? best : base(after);
}

function dameValue(r: RoomState, side: 0 | 1): number {
  const s = r.game as DameState;
  let v = 0;
  s.board.forEach((x, i) => {
    if (!x) return;
    const own = side === 0 ? x > 0 : x < 0;
    const row = Math.floor(i / s.size);
    // Damen zählen dreifach, Steine etwas mehr, je näher sie der Umwandlung sind
    const w = isKing(x) ? 3 : 1 + 0.05 * (x > 0 ? row : s.size - 1 - row);
    v += own ? w : -w;
  });
  return v * 10;
}
const dameReplies = (r: RoomState): A[] => [
  ...dameMoves(r.game as DameState, r.options).map((m) => ({ type: "move", from: m.from, path: m.path })),
  ...(r.game as DameState).blow.map((at) => ({ type: "blow", at })),
];

function muehleValue(r: RoomState, side: 0 | 1): number {
  const s = r.game as MuehleState;
  const stones = (x: 0 | 1) => s.board.filter((b) => b === x).length + s.hand[x];
  // fast fertige Mühlen (zwei eigene, dritter Punkt frei)
  const open = (x: 0 | 1) => MILLS.filter((m) => m.filter((j) => s.board[j] === x).length === 2 && m.some((j) => s.board[j] === null)).length;
  const other = (1 - side) as 0 | 1;
  let v = (stones(side) - stones(other)) * 10 + (open(side) - open(other)) * 2;
  // gleich darf jemand einen Stein nehmen
  if (s.remove) v += s.turn === side ? 8 : -8;
  return v;
}
const muehleReplies = (r: RoomState): A[] => muehleMoves(r.game as MuehleState, r.options) as A[];

const scoreDame: Scorer = (_v, _a, after, me) => lookahead(after, me, dameValue, dameReplies);
const scoreMuehle: Scorer = (_v, _a, after, me) => lookahead(after, me, muehleValue, muehleReplies);

// ---------------------------------------------------------------- Ludo (Würfel: nur der eigene Zug zählt)

function ludoValue(s: LudoState, me: string): number {
  const T = trackLen(s.board);
  const abs = (pid: string, pos: number) => (s.color[pid] * PER_COLOR + pos) % T;
  const progress = (pos: number) => (pos < 0 ? -10 : pos >= T ? pos + 15 : pos);
  let v = 0;
  for (const [pid, ps] of Object.entries(s.pos)) {
    const sum = ps.reduce((t, p) => t + progress(p), 0);
    v += pid === me ? sum : -sum / Math.max(1, Object.keys(s.pos).length - 1);
  }
  // Gefahr: gegnerische Figur 1–6 Felder hinter einer eigenen auf der Laufbahn
  for (const p of s.pos[me] ?? []) {
    if (p < 0 || p >= T) continue;
    const at = abs(me, p);
    for (const [pid, ps] of Object.entries(s.pos)) {
      if (pid === me) continue;
      if (ps.some((q) => q >= 0 && q < T && ((at - abs(pid, q) + T) % T) >= 1 && ((at - abs(pid, q) + T) % T) <= 6)) { v -= p / 4 + 3; break; }
    }
  }
  return v;
}
const scoreLudo: Scorer = (_v, a, after, me) => (a.type === "roll" ? 0 : ludoValue(after.game as LudoState, me));

// ---------------------------------------------------------------- Fünf Würfel

/** Was ein Feld im Schnitt bringt – darunter lieber weiterwürfeln oder ein schwaches Feld opfern */
const PAR: Record<Cat, number> = { ones: 2, twos: 5, threes: 8, fours: 11, fives: 14, sixes: 17, three: 17, four: 10, full: 18, small: 20, large: 22, pasch: 12, chance: 22 };

/** Plan für den Wurf: eintragen (welches Feld) oder welche Würfel halten */
function fwPlan(s: FuenfWuerfelState, me: string): { score: Cat } | { hold: boolean[] } {
  const sheet = s.sheets[me] ?? {};
  const free = ALL_CATS.filter((c) => sheet[c] === undefined);
  const diff = (c: Cat) => scoreFor(c, s.dice) - PAR[c];
  const best = free.reduce((a, c) => (diff(c) > diff(a) || (diff(c) === diff(a) && scoreFor(c, s.dice) > scoreFor(a, s.dice)) ? c : a), free[0]);
  if (s.rollsLeft === 0 || diff(best) >= 8 || (["large", "pasch"] as Cat[]).some((c) => free.includes(c) && scoreFor(c, s.dice) > 0)) return { score: best };
  const n = [0, 0, 0, 0, 0, 0, 0];
  for (const d of s.dice) n[d]++;
  // Straße: längste Folge verschiedener Augen, wenn noch eine Straße frei ist und kein Drilling liegt
  const uniq = [...new Set(s.dice)].sort();
  let run: number[] = [], cur: number[] = [];
  for (const d of uniq) { cur = cur.length && d === cur[cur.length - 1] + 1 ? [...cur, d] : [d]; if (cur.length > run.length) run = cur; }
  if (run.length >= 3 && Math.max(...n) < 3 && (free.includes("small") || free.includes("large"))) {
    const used = new Set<number>();
    return { hold: s.dice.map((d) => (run.includes(d) && !used.has(d) ? (used.add(d), true) : false)) };
  }
  // sonst die häufigste Augenzahl (bei Gleichstand die höhere)
  let face = 6;
  for (let f = 6; f >= 1; f--) if (n[f] > n[face]) face = f;
  // alle fünf gleich (Pasch schon belegt): nichts mehr zu würfeln – eintragen
  if (n[face] === 5) return { score: best };
  return { hold: s.dice.map((d) => d === face) };
}

const scoreFuenfwuerfel: Scorer = (view, a, _after, me) => {
  const s = view.game as FuenfWuerfelState;
  if (!s.dice.length) return a.type === "roll" ? 10 : -10;
  const plan = fwPlan(s, me);
  if ("score" in plan) {
    if (a.type === "score") return a.cat === plan.score ? 100 : scoreFor(a.cat as Cat, s.dice) - PAR[a.cat as Cat];
    return -50;
  }
  if (a.type === "hold") return s.held[a.i as number] !== plan.hold[a.i as number] ? 20 : -20;
  if (a.type === "roll") return plan.hold.every((h, i) => h === s.held[i]) ? 10 : 0;
  return -50;
};

// ---------------------------------------------------------------- Mäxchen (nur mit App-Würfeln: der Bot sieht nur seinen Becher)

const scoreMaexchen: Scorer = (view, a, _after, _me) => {
  const s = view.game as MaexState;
  const last = lastOf(s);
  const opt = turnOptions(s, view.options);
  if (!s.rolled) {
    // Unglaubwürdige Ansage (selten so hoch gewürfelt) aufdecken, sonst würfeln
    const doubt = !!last && chanceAtLeast(last.value) < 0.35;
    if (a.type === "reveal") return doubt ? 50 : -10;
    if (a.type === "roll") return 20;
    return -50;
  }
  if (a.type !== "announce") return -50;
  const v = a.value as number;
  const real = s.dice ? maexValue(s.dice) : null;
  // ehrlich, wenn es reicht – sonst knapp bluffen (die niedrigste erlaubte Ansage)
  if (real !== null && maexRank(real) >= opt.minRank) return v === real ? 100 : -maexRank(v);
  return 50 - (maexRank(v) - opt.minRank) * 5;
};

// ---------------------------------------------------------------- Alles oder nichts (nur mit App-Würfeln)

/** Beste gültige Auswahl im Wurf: meiste Punkte, bei Gleichstand möglichst viele Würfel (Straße, Torte) */
function allesPick(d: DiceState, card: ReturnType<typeof latestCard>): boolean[] {
  let best: boolean[] = d.roll.map(() => false), top = -1;
  for (let m = 1; m < 1 << d.roll.length; m++) {
    const sel = d.roll.map((_, i) => !!(m & (1 << i)));
    const v = selectionValue({ ...d, sel }, card);
    if (v === null) continue;
    const rank = v * 10 + sel.filter(Boolean).length;
    if (rank > top) { top = rank; best = sel; }
  }
  return best;
}

const scoreAlles: Scorer = (view, a, _after, _me) => {
  const s = view.game as AllesState;
  const d = s.dice;
  const card = latestCard(s);
  if (a.type === "useChance") return 100;
  if (!d || (!d.roll.length && !s.turnCards.length)) return a.type === "draw" ? 50 : a.type === "roll" ? 40 : -50;
  if (d.bust) return a.type === "book" ? 50 : -50;
  const want = d.roll.length ? allesPick(d, card) : [];
  const sel = selectionValue(d, card);
  const left = 6 - d.aside.length - d.sel.filter(Boolean).length;
  const pts = s.turnPts + (sel ?? 0);
  // Aufhören, wenn genug im Topf ist und kaum Würfel übrig sind (oder der Topf sehr voll ist)
  const stop = canStop(s) && sel !== null && ((pts >= 300 && left <= 2) || pts >= 1000);
  switch (a.type) {
    case "toggleDie": return d.roll.length && want[a.i as number] !== d.sel[a.i as number] ? 30 : -30;
    case "roll": return stop ? -10 : 20;
    case "book": return a.zero ? -100 : stop ? 60 : -20;
    case "draw": return d.alles || !s.turnCards.length ? 45 : -50;
    default: return -50;
  }
};

// ---------------------------------------------------------------- Fischen (merkt sich die öffentlichen Fragen)

const scoreFischen: Scorer = (view, a, _after, me) => {
  if (a.type !== "ask") return -50;
  const s = view.game as FischenState;
  const rank = a.rank as string, target = a.target as string;
  const mine = (s.hands[me] ?? []).filter((c) => rankOf(c) === rank).length;
  // Was die Fragen verraten: wer nach einem Wert fragt, hat ihn; wer abgeben musste oder „Geh fischen!“ sagte, hat ihn nicht mehr
  let known = 0;
  for (const e of s.events) {
    if (e.rank !== rank) continue;
    if (e.askerId === target) known = 1;
    if (e.targetId === target) known = -1;
    if (e.askerId === me && e.targetId !== target && e.got > 0) known = known === 1 ? 1 : 0;
  }
  return mine * 3 + known * 10 + (s.counts[target] ?? 0) * 0.1;
};

// ---------------------------------------------------------------- Hellseher (ansagen, dann genau so viele Stiche)

/** Stärke einer Karte für die Wahl: Zauberer vor Trumpf vor Farbe, Narr ganz unten */
const hsPower = (c: HsCard, trump: string | null) => (isWizard(c) ? 100 : isFool(c) ? 0 : (hsSuit(c) === trump ? 20 : 0) + hsRank(c));

const scoreHellseher: Scorer = (view, a, _after, me) => {
  const s = view.game as HsState;
  const hand = s.hands[me] ?? [];
  const n = view.players.length;
  if (a.type === "trump") return hand.filter((c) => hsSuit(c) === a.suit).reduce((t, c) => t + 1 + hsRank(c) / 13, 0);
  if (a.type === "bid" || a.type === "secretBid") return -Math.abs((a.bid as number) - Math.round(estimateBid(hand, s.trump, n)));
  if (a.type === "nextRound") return 10;
  if (a.type !== "play") return -50;
  const card = a.card as HsCard;
  const need = (s.bids[me] ?? 0) - (s.tricks[me] ?? 0);
  // Gewinnt die Karte den Stich (so wie er jetzt liegt)?
  const wins = trickWinner([...s.trick, { id: me, card }], s.trump) === me;
  const p = hsPower(card, s.trump);
  if (need > 0) return wins ? 100 - p : -p;
  return wins ? -100 - p : p;
};

// ---------------------------------------------------------------- Herzen (unter dem Stich bleiben, Strafkarten abwerfen)

const scoreHerzen: Scorer = (view, a, _after, me) => {
  const s = view.game as HzState;
  const hand = s.hands[me] ?? [];
  if (a.type === "nextRound") return 10;
  if (a.type === "pass") {
    const best = hzPass(hand);
    return (a.cards as string[]).filter((c) => best.includes(c as never)).length;
  }
  if (a.type !== "play") return -50;
  return a.card === hzSuggest(s, hand, view.options) ? 100 : -hzPoints(a.card as never);
};

// ---------------------------------------------------------------- Schocken (Einsen herauslegen, nicht der Schlechteste sein)

const scoreSchocken: Scorer = (view, a, _after, me) => {
  const s = view.game as ShState;
  if (a.type === "next") return 10;
  const plan = shSuggest(s, me, view.options);
  if (plan.type === "stop") return a.type === "stop" ? 100 : -shHand(s.dice).score / 1000;
  if (plan.type === "turn") return a.type === "turn" ? 100 : -10;
  if (a.type === "hold") return s.held[a.i as number] !== plan.hold[a.i as number] ? 20 : -20;
  if (a.type === "roll") return plan.hold.every((h, i) => h === s.held[i]) || !s.dice.length || s.turned ? 30 : 0;
  return -50;
};

// ---------------------------------------------------------------- Ankreuzspiel (kaum Felder überspringen, Fehlwürfe meiden)

const scoreAnkreuzspiel: Scorer = (view, a, _after, me) => {
  const s = view.game as AkState;
  if (a.type === "roll") return 10;
  if (a.type === "timeUp") return 0;
  if (a.type === "white") return a.row === akSuggestWhite(s, me) ? 100 : 0;
  if (a.type === "color") {
    const best = akSuggestColor(s, me);
    return (best ? a.row === best.row && a.n === best.n : a.row === null) ? 100 : 0;
  }
  return -50;

// ---------------------------------------------------------------- Bluff (Wahrscheinlichkeit aus den eigenen Würfeln schätzen)

const scoreBluff: Scorer = (view, a, _after, me) => {
  const s = view.game as BluffState;
  if (a.type === "next") return 10;
  const last = blLast(s);
  // Wahrscheinlichkeit, dass die Ansage stimmt – fremde Becher unbekannt, eigene bekannt
  if (a.type === "bid") return blChance(s, me, { count: a.count as number, face: a.face as number }, view.options) * 100 - (a.count as number) * 0.01;
  if (!last) return -100;
  if (a.type === "doubt") return (1 - blChance(s, me, last, view.options)) * 100;
  // „Genau!“ nur, wenn es deutlich wahrscheinlicher ist als ein Fehlgriff
  if (a.type === "exact") return blChance(s, me, last, view.options, true) * 160 - 40;
  return -100;
};

// ---------------------------------------------------------------- Stapelbau (Vorrat loswerden, Gegnern nichts vorlegen)

const scoreStapelbau: Scorer = (view, a, after, me) => {
  const s = view.game as SbState;
  const n = after.game as SbState;
  if (a.type === "nextRound" || a.type === "finishRound") return 0;
  // oberste Vorratskarten der anderen (offen) – was sie als Nächstes bräuchten, legen wir ihnen nicht hin
  const theirs = Object.entries(n.stocks).filter(([id]) => id !== me).map(([, st]) => st[st.length - 1]).filter((c): c is SbCard => c !== undefined);
  const helps = n.builds.some((b) => theirs.some((c) => c !== JOKER && c === sbNeeds(b)));
  if (a.type === "play") {
    if (a.from === "stock") return 100;
    let v = 40 + (a.from === "discard" ? 5 : 0);
    const myTop = n.stocks[me]?.[n.stocks[me].length - 1];
    if (myTop !== undefined && n.builds.some((b) => sbFits(b, myTop))) v += 30;
    const card = a.from === "hand" ? (a.card as SbCard) : s.discards[me]?.[a.i as number]?.at(-1);
    if (card === JOKER) v -= 15;
    if (helps) v -= 20;
    return v;
  }
  if (a.type === "discard") {
    const card = a.card as SbCard;
    if (card < 0) return -15;
    const pile = s.discards[me]?.[a.to as number] ?? [];
    const top = pile[pile.length - 1];
    // absteigend stapeln (später rückwärts wieder aufbauen), Joker nie ablegen
    let v = -10 + card / 12;
    if (card === JOKER) v -= 20;
    else if (top === card + 1) v += 5;
    else if (top === card) v += 4;
    else if (top === undefined) v += 2;
    return v;
  }
  return -50;
};

// ---------------------------------------------------------------- Himmelskarten (wenig Punkte, Spalten abräumen)

/** Was es bringt, Karte `d` an Platz `i` zu legen (verdeckte zählen wie eine 5) */
function skGain(grid: SkState["grids"][string], i: number, d: number): number {
  const cell = grid[i];
  if (!cell) return -Infinity;
  const mates = [i % 4, i % 4 + 4, i % 4 + 8].filter((j) => j !== i).map((j) => grid[j]);
  let v = (cell.up ? cell.v! : 5) - d;
  const same = mates.filter((m) => m?.up && m.v === d).length;
  if (same === 2) v += 3 * d + 10; // ganze Spalte fällt weg
  else if (same === 1) v += 2;
  return v;
}

const scoreHimmelskarten: Scorer = (view, a, _after, me) => {
  const s = view.game as SkState;
  const grid = s.grids[me] ?? [];
  const best = (d: number) => Math.max(...grid.map((_, i) => skGain(grid, i, d)));
  switch (a.type) {
    case "flipStart": return -(a.i as number) * 0.01;
    case "draw": {
      const top = s.discard[s.discard.length - 1];
      return a.from === "discard" ? (top !== undefined && best(top) >= 3 ? 30 : -5) : 10;
    }
    case "swap": return s.drawn === null ? -50 : skGain(grid, a.i as number, s.drawn);
    case "discardDrawn": return 1;
    case "flip": {
      // lieber in Spalten aufdecken, in denen schon etwas offen liegt
      const i = a.i as number;
      return [i % 4, i % 4 + 4, i % 4 + 8].filter((j) => grid[j]?.up).length * 0.1;
    }
    case "nextRound": return 10;
    default: return -50;
  }
};

// ---------------------------------------------------------------- Glückssieben (aufhören, bevor es kippt)

const scoreGlueckssieben: Scorer = (view, a, _after, me) => {
  const s = view.game as F7State;
  const line = s.lines[me];
  const standing = (id: string) => (s.scores[id] ?? 0) + (s.lines[id] ? linePoints(s.lines[id]) : 0);
  if (a.type === "hit" || a.type === "stay") {
    const odds = bustOdds(s, me);
    const p = odds ? odds.bust / odds.total : 0;
    const pts = line ? linePoints(line) : 0;
    // weiterziehen lohnt, solange der erwartete Gewinn (~7) den erwarteten Verlust übersteigt
    const hit = (1 - p) * 7 > p * pts;
    return (a.type === "hit") === hit ? 10 : 0;
  }
  if (a.type === "target") {
    const t = a.target as string;
    const good = s.pending?.card === "a:second";
    if (good) return t === me ? 20 : -standing(t) / 100;
    // Schlechtes trifft den, der vorn liegt – nie sich selbst, wenn es anders geht
    return t === me ? -50 : 10 + standing(t) / 100;
  }
  if (a.type === "pick") {
    const owner = a.owner as string;
    const card = s.lines[owner]?.nums[a.index as number];
    return owner === me ? -10 : card ? f7Value(card) : 0;
  }
  return 0;
};

// ---------------------------------------------------------------- Zehn Phasen (Phase sammeln, Nutzloses abwerfen)

/** Wie nützlich ist eine Handkarte für die aktuelle Phase (Gleiche, Folge oder eine Farbe)? */
function p10Use(hand: P10Card[], c: P10Card, phase: number): number {
  if (p10Wild(c)) return 100;
  if (p10Skip(c)) return -5;
  const kinds = new Set((PHASES[phase - 1] ?? []).map((n) => n.kind));
  const rest = hand.filter((x) => x !== c && !p10Wild(x) && !p10Skip(x));
  const v = p10Value(c);
  let u = 0;
  if (kinds.has("set")) u += rest.filter((x) => p10Value(x) === v).length * 2;
  if (kinds.has("run")) {
    // doppelte Werte helfen einer Folge nicht; Nachbarn im Fenster schon
    const others = new Set(rest.map(p10Value));
    if (others.has(v)) u -= 1;
    else u += [...others].filter((x) => Math.abs(x - v) <= 3).length;
  }
  if (kinds.has("color")) u += rest.filter((x) => p10Color(x) === p10Color(c)).length;
  return u;
}

const scoreZehnphasen: Scorer = (view, a, _after, me) => {
  const s = view.game as P10State;
  const hand = s.hands[me] ?? [];
  const phase = s.phase[me] ?? 1;
  switch (a.type) {
    case "draw": {
      if (a.from === "pile") return 10;
      const top = s.discard[s.discard.length - 1];
      if (!top || p10Skip(top)) return -10;
      if (p10Wild(top)) return 30;
      // nur, wenn die Karte die Phase sofort vollmacht oder anlegbar ist – sonst reichen sich zwei Bots ewig dieselbe Karte
      const helps = s.laid[me]
        ? Object.values(s.laid).some((gs) => gs.some((gr) => p10Extend(gr, top)))
        : !findPhase(hand, phase) && !!findPhase([...hand, top], phase);
      return helps ? 30 : 0;
    }
    case "lay": return 100;
    case "hit": return 50;
    case "discard": {
      const c = a.card as P10Card;
      // Aussetzen trifft den, der am weitesten ist
      const lead = a.skip ? (s.phase[a.skip as string] ?? 0) : 0;
      return -p10Use(hand, c, phase) + p10Points(c) / 10 + lead * 0.1;
    }
    case "nextRound": return 10;
    default: return -50;
  }
};

const SCORERS: Record<string, Scorer> = { zehnphasen: scoreZehnphasen, glueckssieben: scoreGlueckssieben, himmelskarten: scoreHimmelskarten, stapelbau: scoreStapelbau, fischen: scoreFischen, hellseher: scoreHellseher, herzen: scoreHerzen, schocken: scoreSchocken, bluff: scoreBluff, ankreuzspiel: scoreAnkreuzspiel, fuenfwuerfel: scoreFuenfwuerfel, maexchen: scoreMaexchen, alles: scoreAlles, maumau: scoreMaumau, eins: scoreEins, vier: scoreVier, dame: scoreDame, muehle: scoreMuehle, ludo: scoreLudo };

/** Alle sinnvollen Züge – ohne Zufall, damit dieselbe Lage denselben Zug ergibt */
const MOVES: Record<string, (view: RoomState, me: string) => A[] | null> = {
  // echte Würfel: Augen tippt der Mensch ein – dann wie die Testspieler
  zehnphasen: (view, me) => {
    const s = view.game as P10State;
    if (s.mode !== "app") return null;
    const hand = s.hands[me] ?? [];
    const out: A[] = [{ type: "draw", from: "pile" }, { type: "draw", from: "discard" }, { type: "nextRound" }];
    const found = !s.laid[me] && findPhase(hand, s.phase[me] ?? 1);
    if (found) out.push({ type: "lay", groups: found });
    if (s.laid[me]) for (const c of hand) for (const [owner, gs] of Object.entries(s.laid)) gs.forEach((gr, g) => {
      for (const end of [undefined, "lo", "hi"] as const) if (p10Extend(gr, c, end)) out.push({ type: "hit", card: c, owner, g, ...(end ? { end } : {}) });
    });
    const others = view.players.map((p) => p.id).filter((id) => id !== me);
    for (const card of new Set(hand)) {
      out.push({ type: "discard", card });
      if (p10Skip(card)) for (const skip of others) out.push({ type: "discard", card, skip });
    }
    return out;
  },
  glueckssieben: (view) => {
    const s = view.game as F7State;
    if (s.mode !== "app") return null;
    const ids = Object.keys(s.lines);
    const out: A[] = [{ type: "hit" }, { type: "stay" }, ...ids.map((target) => ({ type: "target", target }))];
    for (const owner of ids) {
      const l = s.lines[owner];
      for (let index = 0; index < l.nums.length + l.mods.length; index++) out.push({ type: "pick", owner, index });
      for (const o2 of ids) if (owner < o2) for (let i = 0; i < l.nums.length; i++) for (let j = 0; j < s.lines[o2].nums.length; j++)
        out.push({ type: "swap", a: { owner, index: i }, b: { owner: o2, index: j } });
    }
    return out;
  },
  himmelskarten: (view, me) => {
    const s = view.game as SkState;
    if (s.mode !== "app") return null;
    const cells = Array.from({ length: 12 }, (_, i) => i);
    return [...cells.flatMap((i) => [{ type: "flipStart", i }, { type: "flipStart", player: me, i }, { type: "swap", i }, { type: "flip", i }]),
      { type: "draw", from: "deck" }, { type: "draw", from: "discard" }, { type: "discardDrawn" }, { type: "nextRound" }];
  },
  stapelbau: (view, me) => {
    const s = view.game as SbState;
    if (s.mode !== "app") return null;
    const hand = [...new Set(s.hands[me] ?? [])];
    const out: A[] = [{ type: "nextRound" }, { type: "finishRound" }];
    for (let to = 0; to < 4; to++) {
      out.push({ type: "play", from: "stock", to });
      for (const card of hand) out.push({ type: "play", from: "hand", card, to }, { type: "discard", card, to });
      out.push({ type: "discard", card: -1, to });
      for (let i = 0; i < 4; i++) out.push({ type: "play", from: "discard", i, to });
    }
    return out;
  },
  fischen: (view, me) => {
    const s = view.game as FischenState;
    if (s.table) return null;
    const ranks = [...new Set((s.hands[me] ?? []).map(rankOf))];
    return view.players.filter((p) => p.id !== me).flatMap((p) => ranks.map((rank) => ({ type: "ask", target: p.id, rank })));
  },
  hellseher: (view, me) => {
    const s = view.game as HsState;
    if (s.mode !== "app") return null;
    const bids = Array.from({ length: s.round + 1 }, (_, bid) => bid);
    return [...HS_SUITS.map((suit) => ({ type: "trump", suit })), ...bids.map((bid) => ({ type: "bid", bid })), ...bids.map((bid) => ({ type: "secretBid", bid })),
      ...(s.hands[me] ?? []).map((card) => ({ type: "play", card })), { type: "nextRound" }];
  },
  bluff: (view) => {
    const s = view.game as BluffState;
    if (s.table) return null;
    const out: A[] = [{ type: "next" }, { type: "doubt" }, { type: "exact" }];
    for (let face = 1; face <= 6; face++) {
      const c = blMin(s, face, view.options);
      if (c !== null) for (let k = 0; k < 3; k++) out.push({ type: "bid", face, count: c + k });
    }
    return out;
  },
  schocken: (view) => ((view.game as ShState).table ? null : [{ type: "next" }, { type: "roll" }, { type: "stop" }, { type: "turn" }, ...[0, 1, 2].map((i) => ({ type: "hold", i }))]),
  ankreuzspiel: (view, me) => {
    const s = view.game as AkState;
    return [{ type: "roll" }, ...(s.deadline !== null && Date.now() >= s.deadline ? [{ type: "timeUp" }] : []), { type: "white", row: null, player: me }, ...[0, 1, 2, 3].map((row) => ({ type: "white", row, player: me })),
      { type: "color", row: null }, ...akColor(s, me).map((m) => ({ type: "color", row: m.row, n: m.n }))];
  },
  herzen: (view, me) => {
    const s = view.game as HzState;
    const hand = s.hands[me] ?? [];
    const out: A[] = [{ type: "nextRound" }, ...hand.map((card) => ({ type: "play", card }))];
    if (s.phase === "pass" && hand.length >= 3) {
      // der Vorschlag und zwei schlichtere Wahlen (die ersten bzw. letzten drei Karten)
      for (const cards of [hzPass(hand), hand.slice(0, 3), hand.slice(-3)]) out.push({ type: "pass", cards });
    }
    return out;
  },
  maexchen: (view) => ((view.game as MaexState).table ? null : [{ type: "roll" }, { type: "reveal" }, ...ORDER.map((value) => ({ type: "announce", value }))]),
  alles: (view) => (view.options.diceMode !== "app" || view.options.cards === "real" ? null
    : [{ type: "draw" }, { type: "roll" }, { type: "book" }, { type: "useChance" }, ...[0, 1, 2, 3, 4, 5].map((i) => ({ type: "toggleDie", i }))]),
  fuenfwuerfel: (view) => (view.options.diceMode === "real" ? null : [{ type: "roll" }, ...[0, 1, 2, 3, 4].map((i) => ({ type: "hold", i })), ...ALL_CATS.map((cat) => ({ type: "score", cat }))]),
  maumau: (view, me) => {
    const s = view.game as MauMauState;
    const out: A[] = [{ type: "draw" }, { type: "pass" }];
    for (const card of s.hands[me] ?? []) for (const wish of DECKS[s.deck].suits) for (const mau of [true, false]) out.push({ type: "play", card, wish, mau });
    return out;
  },
  eins: (view, me) => {
    const s = view.game as EinsState;
    const out: A[] = [{ type: "draw" }, { type: "pass" }, { type: "doubt" }, { type: "nextRound" }, { type: "finishRound" }, ...COLORS.map((color) => ({ type: "color", color }))];
    for (const card of s.hands[me] ?? []) for (const color of COLORS) for (const eins of [true, false]) {
      for (const target of card.endsWith("-7") ? view.players.map((p) => p.id) : [undefined]) out.push({ type: "play", card, color, eins, target });
    }
    return out;
  },
  vier: (view) => Array.from({ length: (view.game as VierState).cols }, (_, col) => ({ type: "drop", col })),
  dame: (view) => dameReplies(view),
  muehle: (view) => muehleReplies(view),
  // Würfeln ohne Wunschzahl – der Bot darf sich den Wurf nicht aussuchen
  ludo: () => [{ type: "roll" }, ...Array.from({ length: PIECES }, (_, piece) => [{ type: "move", piece }, { type: "move", piece, back: true }]).flat()],
};

/** Kann dieses Spiel Züge bewerten? (sonst spielen alle Stufen wie „zufall“) */
export const hasSkill = (gameId: string) => gameId in SCORERS;

/**
 * Zug eines Bots mit Spielstärke. `seed` macht ihn wiederholbar (z. B. Raum + Runde).
 * Gibt null zurück, wenn der Bot gerade nichts tun kann.
 */
export function chooseBotMove(room: RoomState, botId: string, level: BotLevel, online: boolean, seed = ""): Legal | null {
  if (room.phase !== "playing" || !room.game || roomGame(room).isOver(room.game)) return null;
  const view = viewRoom(room, botId);
  // Würfel des Bots: fester Startwert + nur das, was er sieht
  const rnd = seeded(`${seed}|${botId}|${room.round}|${JSON.stringify(view.game)}`);
  const own = MOVES[room.gameId]?.(view, botId);
  const moves: Move[] = own
    ? own.map((a) => ({ action: { type: "game", action: a }, actor: online ? botId : null }))
    : candidates(room, online).filter((m) => (online ? m.actor === botId : true));
  const legal: Legal[] = [];
  const seen = new Set<string>();
  for (const m of moves) {
    const key = JSON.stringify(m.action);
    if (seen.has(key)) continue;
    seen.add(key);
    try { legal.push({ action: m.action, next: applyRoomAction(room, m.action, online ? botId : null) }); } catch (e) { if (!(e instanceof GameError)) throw e; }
  }
  if (!legal.length) return null;
  const scorer = own ? SCORERS[room.gameId] : undefined;
  if (!scorer || rnd() >= BEST_SHARE[level]) return legal[Math.floor(rnd() * legal.length)];
  let best: Legal[] = [], top = -Infinity;
  for (const l of legal) {
    const a = g({ action: l.action, actor: botId });
    const v = a ? scorer(view, a as { type: string } & Record<string, unknown>, viewRoom(l.next, botId), botId) : -Infinity;
    if (v > top + 1e-9) { top = v; best = [l]; } else if (Math.abs(v - top) <= 1e-9) best.push(l);
  }
  return best[Math.floor(rnd() * best.length)];
}

/** Zug eines Bots mit der Stärke, die der Raum für ihn kennt (ohne Angabe: zufällig wie die Testspieler) */
export function playBot(room: RoomState, botId: string, online: boolean, seed = ""): { action: RoomAction; next: RoomState } | null {
  const level = room.botLevels?.[botId];
  // Spiele ohne Bewertung: echter Zufall (ein fester Startwert ließe den Bot in derselben Lage immer gleich ziehen –
  // z. B. einen Würfel endlos an- und abwählen)
  // Spielweisen ohne Bewertung (z. B. echte Würfel): ebenso
  const skilled = hasSkill(room.gameId) && room.game && MOVES[room.gameId]?.(viewRoom(room, botId), botId) !== null;
  if (!level || level === "zufall" || !skilled) return botMove(room, botId, online);
  if (!online && room.phase === "playing" && room.game && roomGame(room).currentPlayerId(room.game) !== botId) return null;
  return chooseBotMove(room, botId, level, online, seed);
}

/** Wartezeit vor dem nächsten Bot-Zug: kurz und etwas zufällig, dazu die Lesepause des Spiels */
export function botDelay(room: RoomState, rnd = Math.random()): number {
  let extra = 0;
  try { if (room.game) extra = Math.max(0, Math.min(15_000, roomGame(room).botPause?.(room.game) ?? 0)); } catch { /* ohne Pause */ }
  return 900 + Math.floor(rnd * 900) + extra;
}
