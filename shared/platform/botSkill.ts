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

const SCORERS: Record<string, Scorer> = { fuenfwuerfel: scoreFuenfwuerfel, maumau: scoreMaumau, eins: scoreEins, vier: scoreVier, dame: scoreDame, muehle: scoreMuehle, ludo: scoreLudo };

/** Alle sinnvollen Züge – ohne Zufall, damit dieselbe Lage denselben Zug ergibt */
const MOVES: Record<string, (view: RoomState, me: string) => A[] | null> = {
  // echte Würfel: Augen tippt der Mensch ein – dann wie die Testspieler
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
  if (!level || level === "zufall" || !hasSkill(room.gameId)) return botMove(room, botId, online);
  if (!online && room.phase === "playing" && room.game && roomGame(room).currentPlayerId(room.game) !== botId) return null;
  return chooseBotMove(room, botId, level, online, seed);
}
