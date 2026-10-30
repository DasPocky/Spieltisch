import type { RoomState } from "@shared/platform/room";
import { rankOf, suitOf } from "@shared/cards/deck";
import { cardsLeft, needOf, type PalastState } from "@shared/games/palast/logic";
import type { TableModel } from "../../platform/table/model";

const SUIT_SIGN: Record<string, string> = { kreuz: "♣", pik: "♠", herz: "♥", karo: "♦" };
/** wie `SUIT_COLOR` der Spielkarten: Weinrot und Blauschwarz */
const SUIT_COLOR: Record<string, string> = { kreuz: "#1b1e25", pik: "#1b1e25", herz: "#a8454f", karo: "#a8454f" };

/**
 * Palast am Tisch: Nachziehstapel und Ablage in der Mitte, verdeckte Hände (nur die Zahl), vor jedem Platz die drei
 * Tischkarten – offene mit Wert, verdeckte als „?“. Handkarten zeigt der Tisch nie.
 */
export function palastTable(room: RoomState): TableModel | null {
  const s = room.game as PalastState;
  if (s.phase === "over") return null;
  const boards: NonNullable<TableModel["boards"]> = {};
  for (const p of room.players) {
    const up = s.up[p.id] ?? [], down = s.downLeft[p.id] ?? [];
    const cells = down.map((d, i) => {
      const c = up[i];
      if (c) return { text: `${rankOf(c)}${SUIT_SIGN[suitOf(c)] ?? ""}`, tone: SUIT_COLOR[suitOf(c)] };
      return d ? "?" as const : null;
    });
    // mehr offene als Plätze (nach dem Tauschen nie, sicherheitshalber)
    for (const c of up.slice(down.length)) cells.push({ text: `${rankOf(c)}${SUIT_SIGN[suitOf(c)] ?? ""}`, tone: SUIT_COLOR[suitOf(c)] });
    if (cells.some((c) => c !== null)) boards[p.id] = { cols: Math.max(3, cells.length), cells };
  }
  const need = s.phase === "play" ? needOf(s, room.options) : null;
  const place = (id: string) => s.out.indexOf(id);
  return {
    deck: "cards", pile: s.pileCount, discard: s.discard.slice(-4), counts: s.counts, turn: s.phase === "play" ? s.curId : null, n: s.n,
    log: s.log.slice(-6), boards,
    notes: Object.fromEntries(room.players.map((p) => [p.id, s.phase === "swap"
      ? (s.ready[p.id] ? "fertig getauscht" : "tauscht …")
      : place(p.id) >= 0 ? `fertig – Platz ${place(p.id) + 1}` : `${cardsLeft(s, p.id)} Karten übrig`])),
    color: need?.max ? { label: "7 oder niedriger", hex: "#2a5cbf" } : s.phase === "play" && s.discard.length && !need ? { label: "Neustart – alles erlaubt", hex: "#1f7a4d" } : undefined,
  };
}
