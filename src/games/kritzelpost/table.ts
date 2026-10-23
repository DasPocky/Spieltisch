import type { RoomState } from "@shared/platform/room";
import { active, deadlineOf, kindAt, pagesPer, type KState } from "@shared/games/kritzelpost/logic";
import type { TableModel } from "../../platform/table/model";

/**
 * Kritzelpost am Fernseher: vor dem Album nur der Fortschritt (Schritt, wer fertig ist, Uhr) – keine Sätze, keine Zeichnungen
 * (die Sicht des Fernsehers enthält sie gar nicht). Im Album die aufgeschlagene Seite groß.
 */
export function kritzelpostTable(room: RoomState): TableModel | null {
  const s = room.game as KState;
  if (s.phase === "over") return null;
  const name = (id: string | null) => (id && (s.names[id] ?? room.players.find((p) => p.id === id)?.name)) || "";
  const notes = Object.fromEntries(s.order.map((id) => [id, s.left.includes(id) ? "ausgestiegen" : s.phase === "play" ? (s.done.includes(id) ? "fertig ✓" : kindAt(s) === "draw" ? "zeichnet …" : "schreibt …") : ""]));
  const base = { deck: "zahlen" as const, pile: 0, discard: [], counts: {}, turn: null, n: s.round * 100 + s.book * 10 + s.page, log: s.log.slice(-6), notes };
  if (s.phase === "play") {
    const kind = kindAt(s);
    const title = kind === "draw" ? "Alle zeichnen" : s.round === 0 ? "Jeder schreibt einen Satz" : "Alle beschreiben eine Zeichnung";
    return { ...base, sign: { title, sub: `Schritt ${s.round + 1} von ${s.turns} · ${s.done.length}/${active(s).length} fertig`, endsAt: deadlineOf(s) } };
  }
  const page = s.books[s.book]?.[s.page];
  const where = `Kette von ${name(s.order[s.book])} · Seite ${s.page + 1}/${pagesPer(s)}`;
  if (!page) return { ...base, sign: { title: "Album", sub: where } };
  const who = page.by === null ? "Startsatz" : name(page.by);
  if (page.kind === "draw" && !page.empty) return { ...base, drawing: { strokes: page.strokes ?? [], title: `${who} zeichnete · Kette von ${name(s.order[s.book])}`, sub: `${s.page + 1}/${pagesPer(s)}` } };
  const text = page.empty ? (page.gone ? "– ausgestiegen –" : page.kind === "draw" ? "– keine Zeichnung –" : "– kein Satz –") : `„${page.text}“`;
  return { ...base, sign: { title: text, sub: `${page.by === null ? "Startsatz" : `${who} schrieb`} · ${where}` } };
}
