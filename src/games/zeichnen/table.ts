import type { RoomState } from "@shared/platform/room";
import { wordText } from "@shared/games/stirnraten/cards";
import { deadlineOf, type ZState } from "@shared/games/zeichnen/logic";
import type { TableModel } from "../../platform/table/model";

/**
 * Zeichnen & Raten am Fernseher: das Blatt groß und live auf dem Tisch, darüber wer zeichnet, Lücken und Uhr.
 * Den Begriff zeigt der Fernseher erst nach dem Bild (der Spielstand des Fernsehers enthält ihn vorher gar nicht).
 */
export function zeichnenTable(room: RoomState): TableModel | null {
  const s = room.game as ZState;
  if (s.phase === "over") return null;
  const name = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? "";
  const notes = Object.fromEntries(room.players.map((p) => [p.id, `${s.scores[p.id] ?? 0} Pkt.${s.solved.includes(p.id) ? " · ✓" : ""}`]));
  const base = { deck: "zahlen" as const, pile: 0, discard: [], counts: {}, turn: s.drawer, n: s.log.length + s.turn, log: s.log.slice(-6), scores: s.scores, notes };
  if (s.phase === "pick") return { ...base, sign: { title: `${name(s.drawer)} ist dran`, sub: "sucht einen Begriff aus" } };
  if (s.phase === "draw") {
    return { ...base, drawing: { strokes: s.strokes, title: `${name(s.drawer)} zeichnet`, sub: s.word ? wordText(s.word) : s.mask, endsAt: deadlineOf(s) } };
  }
  const solved = s.last?.solved ?? [];
  return { ...base, drawing: { strokes: s.strokes, title: s.last ? `„${wordText(s.last.word)}“` : "", sub: solved.length ? `erraten von ${solved.map(name).join(", ")}` : "keiner hat's erraten" } };
}
