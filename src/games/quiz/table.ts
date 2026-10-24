import type { RoomState } from "@shared/platform/room";
import { KAT_BY_ID } from "@shared/games/quiz/fragen";
import { deadlineOf, OWN_CAT, OWN_KAT, type QState } from "@shared/games/quiz/logic";
import type { QuizMark, TableModel } from "../../platform/table/model";
import { LETTERS, solution, TONES } from "./text";

/** Quiz am Fernseher: Frage groß mit Antworten und Uhr – nach dem Auflösen die Lösung und wer wie viel bekam */
export function quizTable(room: RoomState): TableModel | null {
  const s = room.game as QState;
  if (s.phase === "over" || !s.shown) return null;
  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? "";
  const notes = Object.fromEntries(room.players.map((p) => [p.id, `${s.scores[p.id] ?? 0} Pkt.${s.phase === "ask" && s.answered.includes(p.id) ? " · ✓" : ""}`]));
  const sh = s.shown;
  const kat = sh.cat === OWN_CAT ? OWN_KAT : KAT_BY_ID[sh.cat];
  const reveal = s.phase === "reveal";
  const key = s.last?.key;
  return {
    deck: "zahlen", pile: 0, discard: [], counts: {}, turn: null, n: s.idx, log: s.log.slice(-6), scores: s.scores, notes,
    quiz: {
      head: `${kat ? `${kat.emoji} ${kat.name} · ` : ""}Frage ${s.idx + 1} von ${s.total}`,
      question: `${sh.text}${sh.kind === "zahl" && sh.unit ? ` (in ${sh.unit})` : ""}`,
      options: sh.kind === "zahl" ? [] : sh.options.map((text, i) => ({
        text, letter: sh.kind === "wahl" ? LETTERS[i] : "•", tone: sh.kind === "wahl" ? TONES[i] : "#475569",
        right: reveal && sh.kind === "wahl" ? key === i : undefined,
      })),
      endsAt: deadlineOf(s),
      status: reveal
        ? `Lösung: ${solution(s)}`
        : `${s.answered.length} von ${s.order.length} haben geantwortet`,
      marks: Object.fromEntries(s.order.map((id) => [id, mark(s, id)])),
      points: reveal ? s.order.map((id) => ({ name: name(id), p: s.last?.points[id] ?? 0 })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p) : [],
    },
  };
}

/** Schild am Pult: beim Fragen nur, ob jemand geantwortet hat – erst nach dem Auflösen, wie es ausging */
function mark(s: QState, id: string): QuizMark {
  if (s.phase === "ask") return s.answered.includes(id) ? { text: "hat geantwortet", tone: "done" } : { text: "überlegt …", tone: "idle" };
  const p = s.last?.points[id] ?? 0;
  const kind = s.shown?.kind;
  if (p > 0) return { text: `${kind === "wahl" || s.local ? "richtig" : kind === "zahl" ? "nah dran" : "Treffer"} +${p}`, tone: "right" };
  if (s.last?.answers[id] === undefined) return { text: s.local ? "kein Punkt" : "keine Antwort", tone: "idle" };
  return { text: kind === "zahl" ? "zu weit weg" : "falsch", tone: "wrong" };
}
