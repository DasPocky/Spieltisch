import type { RoomState } from "@shared/platform/room";
import { active, cardsOf, FRUIT_NAME, topOf, type KlState } from "@shared/games/klingel/logic";
import type { TableModel } from "../../platform/table/model";

const karten = (n: number) => (n === 1 ? "1 Karte" : `${n} Karten`);

/**
 * Klingel am Fernseher: die offenen Karten groß an den Plätzen, die Klingel in der Mitte. Klingelt jemand, wackelt sie und
 * sein Name steht groß darauf (grün: richtig, rot: falsch). Ob gerade fünf liegen, verrät der Tisch nicht.
 */
export function klingelTable(room: RoomState): TableModel | null {
  const s = room.game as KlState;
  if (s.phase === "over") return null;
  const name = (id: string | null | undefined) => (id && (s.names[id] ?? room.players.find((p) => p.id === id)?.name)) || "";
  const ids = s.order.filter((id) => !s.left.includes(id));
  const e = s.last;
  const ring = e ? {
    n: e.n, by: e.by, ok: e.ok,
    title: e.ok ? `${name(e.by)}!` : `${name(e.by)} – falsch!`,
    sub: e.ok ? `${e.fruit ? `Fünf ${FRUIT_NAME[e.fruit].many} · ` : ""}+${karten(e.cards)}` : `gibt ${karten(e.cards)} ab`,
  } : null;
  return {
    // verdeckte Stapel liegen als kleine Rückseite neben der offenen Karte (nicht als Hand am Platz)
    deck: "cards", pile: 0, discard: [], counts: {},
    turn: s.ring ? null : s.curId, n: s.flips, log: s.log.slice(-6),
    notes: Object.fromEntries(ids.map((id) => [id, s.out.includes(id) ? "raus" : karten(cardsOf(s, id))])),
    bell: {
      tops: Object.fromEntries(ids.map((id) => [id, active(s).includes(id) ? topOf(s, id) : null])),
      stocks: Object.fromEntries(ids.map((id) => [id, s.stock[id]?.length ?? 0])),
      ring, pending: !!s.ring, note: s.ring ? "Klingel!" : `${name(s.curId)} deckt auf${s.auto ? " · im Takt" : ""}`, endsAt: s.limitAt,
    },
  };
}
