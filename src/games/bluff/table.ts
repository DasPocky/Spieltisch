import type { RoomState } from "@shared/platform/room";
import { bidLabel, jokersOf, lastBid, matches, type BluffState } from "@shared/games/bluff/logic";
import type { TableModel } from "../../platform/table/model";

/** Bluff am Tisch: Becher in der Mitte mit der Ansage groß; beim Aufdecken liegen alle Würfel an den Plätzen (passende hervorgehoben) */
export function bluffTable(room: RoomState): TableModel | null {
  const s = room.game as BluffState;
  if (s.phase === "over") return null;
  const name = (id: string | null | undefined) => room.players.find((p) => p.id === id)?.name ?? "";
  const r = s.phase === "reveal" ? s.reveal : null;
  const last = lastBid(s);
  const jokers = jokersOf(room.options);
  const boards: NonNullable<TableModel["boards"]> = {};
  for (const p of room.players) {
    const n = s.count[p.id] ?? 0;
    const shown = r && !s.table ? r.cups[p.id] : null;
    if (shown?.length) boards[p.id] = { cols: Math.min(6, shown.length), cells: shown.map((d) => ({ text: String(d), tone: matches(d, r!.bid.face, jokers) ? "#2a5cbf" : undefined })) };
    else if (n > 0) boards[p.id] = { cols: Math.min(6, n), cells: Array.from({ length: n }, () => "?" as const) };
  }
  const res = r ? (r.loser ? `${name(r.loser)} ${r.out ? "ist raus" : "verliert einen Würfel"}` : r.gainer ? `${name(r.gainer)} bekommt einen Würfel` : "Genau richtig!") : "";
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.phase === "bid" ? s.curId : null, n: s.n,
    log: s.log.slice(-6), scores: s.count, boards,
    notes: Object.fromEntries(room.players.map((p) => [p.id, (s.count[p.id] ?? 0) > 0 ? `${s.count[p.id]} Würfel` : "raus"])),
    ...(r
      ? { sign: { title: `${r.kind === "bluff" ? "Bluff!" : "Genau!"} ${r.actual} liegen`, sub: `Ansage ${bidLabel(r.bid)} von ${name(r.bid.by)} – ${res}` } }
      : { dice: { values: [], held: [], n: s.n, cup: true, note: last ? `${name(last.by)}: mindestens ${bidLabel(last)}` : `${name(s.curId)} sagt zuerst an` } }),
  };
}
