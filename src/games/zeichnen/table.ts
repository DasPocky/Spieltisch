import type { RoomState } from "@shared/platform/room";
import { wordText } from "@shared/games/stirnraten/cards";
import { deadlineOf, POINTS, type ZState } from "@shared/games/zeichnen/logic";
import type { QuizMark, TableModel } from "../../platform/table/model";

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
    return { ...base, drawing: { strokes: s.strokes, title: `${name(s.drawer)} zeichnet`, sub: s.word ? wordText(s.word) : s.mask, endsAt: deadlineOf(s), marks: marks(s) } };
  }
  const solved = s.last?.solved ?? [];
  const word = s.last ? wordText(s.last.word) : undefined;
  return { ...base, drawing: { strokes: s.strokes, title: word ? `„${word}“` : "", sub: solved.length ? `erraten von ${solved.map(name).join(", ")}` : "keiner hat's erraten", word, marks: marks(s) } };
}

/** Punkte dieses Zugs für einen Ratenden (getippt: je nach Zeit, gerufen: fest) */
function guessPoints(s: ZState, id: string): number | undefined {
  if (s.mode === "rufen") return POINTS.shout;
  return s.guesses.find((g) => g.by === id && g.ok)?.pts;
}

/** Schilder an den Pulten: wer zeichnet, wer noch rät, wer es hat – ohne Tipps und ohne den Begriff */
export function marks(s: ZState): Record<string, QuizMark> {
  const solved = s.phase === "reveal" ? s.last?.solved ?? s.solved : s.solved;
  const out: Record<string, QuizMark> = {};
  for (const id of s.order) {
    if (id === s.drawer) {
      const pts = solved.length * (s.mode === "rufen" ? POINTS.shoutDrawer : POINTS.drawer);
      out[id] = s.phase === "draw" ? { text: "zeichnet", tone: "done" } : { text: pts ? `zeichnete +${pts}` : "zeichnete", tone: pts ? "right" : "idle" };
    } else if (solved.includes(id)) {
      const pts = guessPoints(s, id);
      out[id] = { text: pts ? `erraten! +${pts}` : "erraten!", tone: "right" };
    } else out[id] = s.phase === "draw" ? { text: "rät …", tone: "idle" } : { text: "nicht erraten", tone: "idle" };
  }
  return out;
}
