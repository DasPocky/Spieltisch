/**
 * Punkteblock für Spiele mit echten Karten: jeder trägt seine Rundenpunkte ein (online nur die eigenen,
 * der Host alle), der Host schließt die Runde ab. Alternativ zählt `padWin` nur Rundensiege.
 */
import { GameError, type GameContext } from "./types";

export interface Pad {
  round: number;
  scores: Record<string, number>;
  entries: Record<string, number | null>;
  /** abgeschlossene Runden (für Verlauf und Rückgängig) */
  rounds: Record<string, number>[];
}

export type PadAction =
  | { type: "padEnter"; player?: string; points: number | null }
  | { type: "padFinish" }
  | { type: "padWin"; player: string }
  | { type: "padUndo" };

export const isPadAction = (a: { type: string }): a is PadAction => a.type.startsWith("pad");

export function newPad(ids: string[]): Pad {
  return { round: 1, scores: Object.fromEntries(ids.map((id) => [id, 0])), entries: Object.fromEntries(ids.map((id) => [id, null])), rounds: [] };
}

const clear = (p: Pad, ids: string[]) => { p.entries = Object.fromEntries(ids.map((id) => [id, null])); };

/** Wendet eine Punkteblock-Aktion an (verändert `pad`). */
export function applyPad(pad: Pad, a: PadAction, ctx: GameContext, limits: { min: number; max: number } = { min: 0, max: 999 }) {
  const actor = ctx.actorId;
  const isHost = actor === null || actor === ctx.hostId;
  const ids = ctx.players.map((p) => p.id);
  switch (a.type) {
    case "padEnter": {
      const who = a.player ?? actor;
      if (!who || !ids.includes(who)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (!isHost && who !== actor) throw new GameError("Trag nur deine eigenen Punkte ein.");
      if (a.points !== null && (!Number.isInteger(a.points) || a.points < limits.min || a.points > limits.max)) throw new GameError(`Punkte zwischen ${limits.min} und ${limits.max}.`);
      pad.entries[who] = a.points;
      return;
    }
    case "padFinish": {
      if (!isHost) throw new GameError("Die Runde schließt der Host ab.");
      const missing = ctx.players.filter((p) => pad.entries[p.id] === null || pad.entries[p.id] === undefined);
      if (missing.length) throw new GameError(`Es fehlen noch Punkte: ${missing.map((p) => p.name).join(", ")}.`);
      const r = Object.fromEntries(ids.map((id) => [id, pad.entries[id] ?? 0]));
      for (const id of ids) pad.scores[id] = (pad.scores[id] ?? 0) + r[id];
      pad.rounds.push(r);
      pad.round++;
      clear(pad, ids);
      return;
    }
    case "padWin": {
      if (!isHost) throw new GameError("Den Rundensieger trägt der Host ein.");
      if (!ids.includes(a.player)) throw new GameError("Diesen Spieler gibt es nicht.");
      const r = Object.fromEntries(ids.map((id) => [id, id === a.player ? 1 : 0]));
      pad.scores[a.player] = (pad.scores[a.player] ?? 0) + 1;
      pad.rounds.push(r);
      pad.round++;
      clear(pad, ids);
      return;
    }
    case "padUndo": {
      if (!isHost) throw new GameError("Zurücknehmen darf der Host.");
      const last = pad.rounds.pop();
      if (!last) throw new GameError("Es gibt noch keine Runde.");
      for (const [id, n] of Object.entries(last)) if (id in pad.scores) pad.scores[id] -= n;
      pad.round--;
      pad.entries = { ...Object.fromEntries(ids.map((id) => [id, null])), ...last };
      return;
    }
  }
}

/** Spieler verlässt die Partie */
export function padRemove(pad: Pad, id: string) {
  delete pad.entries[id];
}
/** Wer vorne liegt (bei `low` die wenigsten Punkte) */
export function padLeaders(pad: Pad, ids: string[], low = false): string[] {
  const vals = ids.map((id) => pad.scores[id] ?? 0);
  const best = low ? Math.min(...vals) : Math.max(...vals);
  return ids.filter((id) => (pad.scores[id] ?? 0) === best);
}
