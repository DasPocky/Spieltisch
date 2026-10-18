import type { RoomState } from "@shared/platform/room";
import { HAND, type SchamlosState } from "@shared/games/schamlos/logic";
import type { TableModel } from "../../platform/table/model";

/** Schamlos am Tisch: schwarze Karte, verdeckt gelegte und aufgedeckte Antworten */
export function schamlosTable(room: RoomState): TableModel | null {
  const s = room.game as SchamlosState;
  if (s.phase === "over") return null;
  const counts = Object.fromEntries(room.players.map((p) => [p.id, s.played[p.id] ? HAND - s.blanks : HAND]));
  const subs = s.phase === "pick" ? [] : s.subs.map((x) => x.cards);
  const pick = s.phase === "result" ? s.pick : null;
  return { deck: "schamlos", pile: 0, discard: [], counts, turn: s.czar, n: s.round, log: s.log.slice(-6), scores: s.scores,
    words: { prompt: s.prompt, playedBy: Object.keys(s.played), subs, pick, pickBy: pick !== null ? s.subs[pick]?.by ?? null : null } };
}
