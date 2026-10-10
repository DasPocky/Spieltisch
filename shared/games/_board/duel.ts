/**
 * Gemeinsamer Rahmen für Brettspiele zu zweit (Vier in einer Reihe, Mühle, Dame):
 * Farben, wer dran ist, Sieg/Remis, Aufgeben, Überspringen und Verlassen.
 * Farbe 0 fängt immer an – bei „Nochmal“ tauschen die Spieler die Farben.
 */
import { randomInt } from "../../platform/random";
import { GameError, type GameContext, type GameInfo, type GameLogic, type Options, type SettingDef } from "../../platform/types";

export type Side = 0 | 1;

export interface DuelBase {
  v: 1;
  /** Spieler-ID je Farbe – Farbe 0 beginnt */
  colors: [string, string];
  turn: Side;
  winner: Side | null;
  draw: boolean;
  /** Wie die Partie endete (für die Ergebnisanzeige) */
  end: string | null;
  /** zählt Züge (für Animationen) */
  n: number;
  log: string[];
}

export type ResignAction = { type: "resign" };

const MAX_LOG = 80;
export const other = (s: Side): Side => (s === 0 ? 1 : 0);

/** Farben verteilen: in jeder neuen Partie fängt der andere an */
export function duelBase(ctx: GameContext): DuelBase {
  const ids = ctx.players.map((p) => p.id);
  if (ids.length !== 2) throw new GameError("Dieses Spiel ist für genau zwei Spieler.");
  const swap = (ctx.round ?? 0) % 2 === 1;
  return { v: 1, colors: swap ? [ids[1], ids[0]] : [ids[0], ids[1]], turn: 0, winner: null, draw: false, end: null, n: 0, log: [] };
}

export function pushLog(s: DuelBase, line: string) {
  s.log.push(line);
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

export const nameOf = (ctx: GameContext, id: string | undefined) => ctx.players.find((p) => p.id === id)?.name ?? "?";
export const sideOf = (s: DuelBase, id: string | null): Side | null => (id === s.colors[0] ? 0 : id === s.colors[1] ? 1 : null);
export const isOver = (s: DuelBase) => s.winner !== null || s.draw;

export function win(s: DuelBase, side: Side, end: string) {
  s.winner = side;
  s.end = end;
}

export function drawn(s: DuelBase, end: string) {
  s.draw = true;
  s.end = end;
}

interface DuelDef<S extends DuelBase, A extends { type: string }> {
  info: GameInfo;
  version: number;
  settings: SettingDef[];
  setup(ctx: GameContext): S;
  /** Alle erlaubten Züge des Spielers am Zug (für „Überspringen“ und zum Prüfen, dass nichts hängt) */
  moves(s: S, o: Options): A[];
  /** Führt einen Zug auf der Kopie aus (Rechte und Spielende sind schon geprüft) */
  play(s: S, a: A, ctx: GameContext): void;
  /** Aktionen des Spiels, die der Spieler am Zug ausführt */
  actions: A["type"][];
}

/** Baut aus Aufstellung, Zuggenerator und Zugausführung ein vollständiges Spiel für die Plattform */
export function duelGame<S extends DuelBase, A extends { type: string }>(def: DuelDef<S, A>): GameLogic<S, A | ResignAction> {
  return {
    info: def.info,
    version: def.version,
    settings: def.settings,
    turnBased: true,
    joinMidGame: false,
    setup: def.setup,
    actionKind: (a) => (a.type === "resign" ? "player" : (def.actions as string[]).includes(a.type) ? "turn" : null),
    apply(prev, a, ctx) {
      if (isOver(prev)) throw new GameError("Die Partie ist schon entschieden.");
      const s = structuredClone(prev);
      if (a.type === "resign") {
        // Lokal (ein Handy) gibt der Spieler am Zug auf, online der, der tippt
        const side = ctx.actorId === null ? s.turn : sideOf(s, ctx.actorId);
        if (side === null) throw new GameError("Du spielst in dieser Partie nicht mit.");
        pushLog(s, `${nameOf(ctx, s.colors[side])} gibt auf`);
        win(s, other(side), `${nameOf(ctx, s.colors[side])} hat aufgegeben`);
        s.n++;
        return s;
      }
      def.play(s, a as A, ctx);
      return s;
    },
    currentPlayerId: (s) => (isOver(s) ? null : s.colors[s.turn]),
    isOver,
    results: (s, ctx) => s.colors.map((id, i) => ({ id, won: s.winner === i })).filter((r) => ctx.players.some((p) => p.id === r.id)),
    skipLabel: (s, ctx) => (isOver(s) ? null : `Für ${nameOf(ctx, s.colors[s.turn])} einen zufälligen Zug machen`),
    skipTurn(prev, ctx) {
      const moves = def.moves(prev, ctx.options);
      if (isOver(prev) || !moves.length) return prev;
      const s = structuredClone(prev);
      pushLog(s, `${nameOf(ctx, s.colors[s.turn])} reagiert nicht – zufälliger Zug:`);
      def.play(s, moves[randomInt(moves.length)], ctx);
      return s;
    },
    onPlayerRemoved(prev, id) {
      const side = sideOf(prev, id);
      if (side === null || isOver(prev)) return prev;
      const s = structuredClone(prev);
      win(s, other(side), "Der Gegner hat die Partie verlassen");
      return s;
    },
  };
}
