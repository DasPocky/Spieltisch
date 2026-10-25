import type { RoomState } from "@shared/platform/room";
import { active, deadlineOf, liveMark, scoreCategory, type Mark, type SlfState } from "@shared/games/stadtlandfluss/logic";
import type { TableModel } from "../../platform/table/model";

/**
 * Stadt-Land-Fluss am Fernseher: beim Schreiben der Buchstabe groß und wer fertig ist (die Sicht des Fernsehers enthält
 * keine Antworten); in der Auswertung die Antworten der Kategorie mit Punkten, danach der Stand.
 */
export function stadtlandflussTable(room: RoomState): TableModel | null {
  const s = room.game as SlfState;
  if (s.phase === "over") return null;
  const ids = active(s);
  const name = (id: string | null) => (id && (s.names[id] ?? room.players.find((p) => p.id === id)?.name)) || "";
  const base = { deck: "zahlen" as const, pile: 0, discard: [], counts: {}, turn: null, n: s.round * 100 + s.cat, log: s.log.slice(-6), scores: s.scores };
  if (s.phase === "write") {
    const notes = Object.fromEntries(s.order.map((id) => [id, s.left.includes(id) ? "ausgestiegen" : s.done.includes(id) ? (s.stopBy === id ? "Stopp! ✓" : "fertig ✓") : "schreibt …"]));
    const stop = s.stopAt !== null ? ` · Stopp${s.stopBy ? ` von ${name(s.stopBy)}` : ""}!` : "";
    return { ...base, notes, sign: { title: s.letter, sub: `Runde ${s.round + 1} von ${s.rounds} · ${s.cats.join(", ")} · ${s.done.length}/${ids.length} fertig${stop}`, endsAt: deadlineOf(s), big: true } };
  }
  if (s.phase === "review") {
    const marks = Object.fromEntries(ids.map((id) => { const m = liveMark(s, id); return [id, m === "tie" ? "ok" : m]; })) as Record<string, Mark>;
    const answers = Object.fromEntries(ids.map((id) => [id, s.answers[id]?.[s.cat] ?? ""]));
    const pts = scoreCategory(answers, marks);
    const notes = Object.fromEntries(ids.map((id) => [id, `${answers[id] || "–"} · +${pts[id] ?? 0}`]));
    return {
      ...base, notes,
      words5: {
        title: `${s.cats[s.cat]} mit ${s.letter} · ${s.cat + 1}/${s.cats.length}`, cols: Math.min(4, Math.max(1, ids.length)),
        cells: ids.map((id) => ({ text: `${name(id)}: ${answers[id] || "–"}`, tone: marks[id] === "ok" ? undefined : "#8a8178" })),
      },
    };
  }
  const last = s.history[s.history.length - 1]?.points ?? {};
  const notes = Object.fromEntries(ids.map((id) => [id, `+${last[id] ?? 0} · ${s.scores[id] ?? 0} Pkt.`]));
  const best = Math.max(0, ...ids.map((id) => s.scores[id] ?? 0));
  return { ...base, notes, sign: { title: `Runde ${s.round + 1} gewertet`, sub: `Vorn: ${ids.filter((id) => (s.scores[id] ?? 0) === best).map(name).join(", ")} mit ${best} Punkten` } };
}
