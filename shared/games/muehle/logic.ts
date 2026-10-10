/**
 * Mühle (Neunermühle): 24 Punkte auf drei ineinanderliegenden Quadraten.
 * Setzen (je 9 Steine), Ziehen entlang der Linien, mit drei Steinen Springen.
 * Wer eine Mühle schließt, nimmt einen gegnerischen Stein – aus einer Mühle nur, wenn alle anderen auch in Mühlen stehen.
 * Verloren hat, wer weniger als drei Steine hat oder nicht mehr ziehen kann.
 */
import { GameError, type GameContext, type Options } from "../../platform/types";
import { drawn, duelBase, duelGame, nameOf, other, pushLog, win, type DuelBase, type Side } from "../_board/duel";

export interface MuehleState extends DuelBase {
  /** 24 Punkte: Farbe 0/1 oder null */
  board: (Side | null)[];
  /** Steine, die noch gesetzt werden */
  hand: [number, number];
  /** Der Spieler am Zug hat eine Mühle geschlossen und nimmt jetzt einen Stein */
  remove: boolean;
  /** Züge (beide zusammen) seit dem letzten geschlagenen Stein in der Zugphase */
  quiet: number;
  /** letzter Zug für die Anzeige */
  last: { from: number | null; to: number | null; taken: number | null } | null;
}

export type MuehleAction =
  | { type: "place"; to: number }
  | { type: "move"; from: number; to: number }
  | { type: "remove"; at: number };

export const COLOR_NAME = ["Weiß", "Schwarz"] as const;
export const STONES = 9;

/**
 * Punkt i: Ring r = floor(i / 8) (0 außen, 2 innen), Position k = i % 8 im Uhrzeigersinn ab links oben:
 * 0 links oben, 1 oben Mitte, 2 rechts oben, 3 rechts Mitte, 4 rechts unten, 5 unten Mitte, 6 links unten, 7 links Mitte.
 */
export function pointXY(i: number): [number, number] {
  const o = Math.floor(i / 8), k = i % 8, f = 6 - o;
  return ([[o, o], [3, o], [f, o], [f, 3], [f, f], [3, f], [o, f], [o, 3]] as [number, number][])[k];
}

/** Übliche Bezeichnung: Spalten a–g von links, Reihen 1–7 von unten */
export const pointName = (i: number) => { const [x, y] = pointXY(i); return `${"abcdefg"[x]}${7 - y}`; };

export const NEIGHBORS: number[][] = Array.from({ length: 24 }, (_, i) => {
  const r = Math.floor(i / 8), k = i % 8;
  const n = [r * 8 + ((k + 1) % 8), r * 8 + ((k + 7) % 8)];
  if (k % 2 === 1) {
    if (r > 0) n.push(i - 8);
    if (r < 2) n.push(i + 8);
  }
  return n;
});

export const MILLS: number[][] = [
  ...[0, 1, 2].flatMap((r) => [[0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0]].map((m) => m.map((k) => r * 8 + k))),
  ...[1, 3, 5, 7].map((k) => [k, k + 8, k + 16]),
];

export interface MuehleRules { jump: boolean; draw: number }
export const rulesOf = (o: Options): MuehleRules => ({ jump: o.jump !== false, draw: Number(o.draw) || 0 });

export const inMill = (b: (Side | null)[], i: number) => b[i] !== null && MILLS.some((m) => m.includes(i) && m.every((j) => b[j] === b[i]));
export const count = (s: MuehleState, side: Side) => s.board.filter((x) => x === side).length;
/** Setzphase des Spielers am Zug? */
export const placing = (s: MuehleState, side: Side = s.turn) => s.hand[side] > 0;
/** Darf der Spieler springen (drei Steine, Regel an)? */
export const jumping = (s: MuehleState, o: Options, side: Side = s.turn) => rulesOf(o).jump && !placing(s, side) && count(s, side) === 3;

/** Steine, die gerade genommen werden dürfen */
export function removable(s: MuehleState): number[] {
  const opp = other(s.turn);
  const theirs = s.board.flatMap((x, i) => (x === opp ? [i] : []));
  const free = theirs.filter((i) => !inMill(s.board, i));
  return free.length ? free : theirs;
}

/** Ziele für den Stein auf `from` */
export function targets(s: MuehleState, from: number, o: Options): number[] {
  if (s.board[from] !== s.turn || placing(s) || s.remove) return [];
  const all = jumping(s, o) ? s.board.map((_, i) => i) : NEIGHBORS[from];
  return all.filter((i) => s.board[i] === null);
}

export function legalMoves(s: MuehleState, o: Options): MuehleAction[] {
  if (s.remove) return removable(s).map((at) => ({ type: "remove", at }));
  if (placing(s)) return s.board.flatMap((x, to) => (x === null ? [{ type: "place" as const, to }] : []));
  return s.board.flatMap((x, from) => (x === s.turn ? targets(s, from, o).map((to) => ({ type: "move" as const, from, to })) : []));
}

/** Zugende: Gegner ist dran – oder hat verloren */
function endTurn(s: MuehleState, ctx: GameContext) {
  const opp = other(s.turn);
  const me = nameOf(ctx, s.colors[s.turn]);
  s.turn = opp;
  if (!placing(s, opp) && count(s, opp) < 3) {
    win(s, other(opp), `${nameOf(ctx, s.colors[opp])} hat nur noch ${count(s, opp)} Steine`);
    pushLog(s, `${me} gewinnt`);
    return;
  }
  if (!legalMoves(s, ctx.options).length) {
    win(s, other(opp), `${nameOf(ctx, s.colors[opp])} kann nicht mehr ziehen`);
    pushLog(s, `${nameOf(ctx, s.colors[opp])} ist eingesperrt – ${me} gewinnt`);
    return;
  }
  const { draw } = rulesOf(ctx.options);
  if (draw && s.quiet >= draw * 2) {
    drawn(s, `${draw} Züge je Spieler ohne Mühle`);
    pushLog(s, "Unentschieden – zu lange ohne Mühle");
  }
}

/** Nach Setzen oder Ziehen: Mühle geschlossen? */
function afterStone(s: MuehleState, to: number, ctx: GameContext) {
  const opp = other(s.turn);
  // Neue Mühle: ein Stein des Gegners wird genommen (hat er keinen auf dem Brett, entfällt das)
  if (inMill(s.board, to) && s.board.some((x) => x === opp)) {
    s.remove = true;
    pushLog(s, `${nameOf(ctx, s.colors[s.turn])} hat eine Mühle`);
    return;
  }
  endTurn(s, ctx);
}

export const muehle = duelGame<MuehleState, MuehleAction>({
  info: {
    id: "muehle",
    name: "Mühle",
    tagline: "Steine setzen und ziehen, Mühlen schließen und dem Gegner Steine nehmen.",
    category: "Brett",
    minPlayers: 2,
    maxPlayers: 2,
    duration: "10–20 Min.",
  },
  version: 1,
  settings: [
    { key: "jump", label: "Springen mit drei Steinen", type: "toggle", default: true, hint: "Originalregel – wer nur noch drei Steine hat, darf auf jeden freien Punkt springen", group: "Regeln" },
    {
      key: "draw", label: "Unentschieden", type: "choice", default: "0", group: "Regeln",
      choices: [
        { value: "0", label: "Nie", hint: "Original: ihr spielt aus oder einigt euch" },
        { value: "20", label: "Nach 20 Zügen", hint: "je Spieler ohne Mühle" },
        { value: "50", label: "Nach 50 Zügen", hint: "je Spieler ohne Mühle" },
      ],
    },
    { key: "turnBoard", label: "Brett für Schwarz drehen", type: "toggle", default: false, inGame: true, hint: "nur bei einem Handy: das Brett dreht sich zu dem, der dran ist", group: "Ein Handy für alle" },
  ],
  actions: ["place", "move", "remove"],
  setup: (ctx) => ({ ...duelBase(ctx), board: Array(24).fill(null), hand: [STONES, STONES], remove: false, quiet: 0, last: null }),
  moves: (s, o) => legalMoves(s, o),
  play(s, a, ctx) {
    const valid = (i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < 24;
    const who = nameOf(ctx, s.colors[s.turn]);
    switch (a.type) {
      case "place": {
        if (s.remove) throw new GameError("Nimm erst einen Stein des Gegners.");
        if (!placing(s)) throw new GameError("Alle Steine sind gesetzt – jetzt wird gezogen.");
        if (!valid(a.to) || s.board[a.to] !== null) throw new GameError("Dieser Punkt ist besetzt.");
        s.board[a.to] = s.turn;
        s.hand[s.turn]--;
        s.n++;
        s.last = { from: null, to: a.to, taken: null };
        pushLog(s, `${who}: setzt auf ${pointName(a.to)}`);
        afterStone(s, a.to, ctx);
        return;
      }
      case "move": {
        if (s.remove) throw new GameError("Nimm erst einen Stein des Gegners.");
        if (placing(s)) throw new GameError("Erst alle Steine setzen.");
        if (!valid(a.from) || s.board[a.from] !== s.turn) throw new GameError("Das ist nicht dein Stein.");
        if (!valid(a.to) || s.board[a.to] !== null) throw new GameError("Dieser Punkt ist besetzt.");
        if (!targets(s, a.from, ctx.options).includes(a.to)) throw new GameError(jumping(s, ctx.options) ? "Dieser Punkt ist besetzt." : "Ziehen geht nur entlang einer Linie zum Nachbarpunkt.");
        s.board[a.from] = null;
        s.board[a.to] = s.turn;
        s.n++;
        s.quiet++;
        s.last = { from: a.from, to: a.to, taken: null };
        pushLog(s, `${who}: ${pointName(a.from)}–${pointName(a.to)}`);
        afterStone(s, a.to, ctx);
        return;
      }
      case "remove": {
        if (!s.remove) throw new GameError("Du hast keine Mühle geschlossen.");
        if (!valid(a.at) || s.board[a.at] !== other(s.turn)) throw new GameError("Tippe einen Stein des Gegners an.");
        if (!removable(s).includes(a.at)) throw new GameError("Steine in einer Mühle sind geschützt – nimm einen anderen.");
        s.board[a.at] = null;
        s.remove = false;
        s.quiet = 0;
        s.n++;
        s.last = { ...(s.last ?? { from: null, to: null }), taken: a.at };
        pushLog(s, `${who}: nimmt ${pointName(a.at)}`);
        endTurn(s, ctx);
        return;
      }
      default:
        throw new GameError("Unbekannte Aktion.");
    }
  },
});
