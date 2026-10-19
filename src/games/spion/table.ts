import type { RoomState } from "@shared/platform/room";
import type { SpionState } from "@shared/games/spion/logic";
import type { TableModel } from "../../platform/table/model";

/** Spion am Tisch: Aufsteller mit Runde, wer fragt und Uhr; vor jedem Platz die Ortskarte verdeckt – den Ort sieht nur das Handy */
export function spionTable(room: RoomState): TableModel | null {
  const s = room.game as SpionState;
  if (s.phase === "over") return null;
  const name = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? "";
  const ids = room.players.map((p) => p.id);
  const endsAt = s.startedAt && !s.pausedAt && !s.timeUp ? s.startedAt + s.pausedMs + s.minutes * 60_000 : null;
  const sign: NonNullable<TableModel["sign"]> =
    s.phase === "look" ? { title: `Runde ${s.round} von ${s.rounds}`, sub: `Schaut eure Karte an · ${s.seen.length} von ${ids.length}` }
    : s.phase === "talk" ? { title: s.pausedAt ? "Pause" : `${name(s.asker)} fragt`, sub: `Runde ${s.round} von ${s.rounds}`, endsAt }
    : s.phase === "vote" ? { title: s.vote?.final ? "Schlussabstimmung" : "Abstimmung", sub: `${Object.keys(s.vote?.votes ?? {}).length} von ${ids.length} haben abgestimmt` }
    : s.phase === "guess" ? { title: "Der Spion rät den Ort", sub: "Alle anderen warten" }
    : { title: s.last?.winner === "spy" ? "Der Spion gewinnt" : "Die Gruppe gewinnt", sub: s.last ? `Ort: ${s.last.place} · Spion: ${s.last.spies.map(name).join(", ")}` : undefined };
  return {
    deck: "zahlen", pile: 0, discard: [], counts: {}, turn: s.phase === "talk" ? s.asker : null, n: s.log.length, log: s.log.slice(-6), scores: s.scores,
    notes: Object.fromEntries(ids.map((id) => [id, `${s.scores[id] ?? 0} Pkt.`])),
    boards: Object.fromEntries(ids.map((id) => [id, { cols: 1, cells: ["?" as const] }])),
    sign,
  };
}
