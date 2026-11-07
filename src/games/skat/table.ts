import type { RoomState } from "@shared/platform/room";
import { gameName, nameOf, positionOf, shownCard, type SkState } from "@shared/games/skat/logic";
import type { TableModel } from "../../platform/table/model";

/**
 * Skat am Tisch: der Stich in der Mitte, am Platz Reizwort bzw. Alleinspieler und Stiche, oben Reizwert oder Spielansage –
 * keine Hände und kein Skat.
 */
export function skatTable(room: RoomState): TableModel | null {
  const s = room.game as SkState;
  if (s.phase === "roundEnd" || s.phase === "over") return null;
  const trick = s.trick.length ? s.trick : (s.tricks.at(-1)?.plays ?? []);
  const tricksOf = (id: string) => s.tricks.filter((t) => t.winner === id).length;
  const note = (id: string) => {
    if (!s.active.includes(id)) return "gibt · sitzt aus";
    if (s.phase === "bid") return [positionOf(s, id), s.said[id] ? `„${s.said[id]}“` : s.curId === id ? "überlegt …" : null].filter(Boolean).join(" · ");
    if (s.phase !== "play") return s.declarer === id ? (s.phase === "skat" ? "Skat oder Hand?" : s.phase === "discard" ? "drückt …" : "sagt an …") : "";
    const n = tricksOf(id);
    return [s.declarer === id ? "Alleinspieler" : null, `${n} ${n === 1 ? "Stich" : "Stiche"}`].filter(Boolean).join(" · ");
  };
  const done = !s.trick.length ? s.tricks.at(-1)?.winner : undefined;
  const label = s.phase === "bid" ? `Reizen${s.bidding?.value ? ` · ${s.bidding.value}` : ""}`
    : s.ramsch ? "Ramsch"
    : s.game ? `${gameName(s.game, room.options)} – ${nameOf(s, s.declarer)}${s.bid ? ` (gereizt ${s.bid})` : ""}`
    : `${nameOf(s, s.declarer)} hat das Spiel bei ${s.bid}`;
  // Reizen und Ansage: Reizwert bzw. wer spielt groß auf dem Filz (beim Spielen liegt dort der Stich)
  const b = s.bidding;
  const sign = s.phase === "bid" && b
    ? { title: b.value ? String(b.value) : "Reizen", big: !!b.value, sub: b.stage === 3 ? `${nameOf(s, b.bidder)}: 18 spielen oder passen?` : `${nameOf(s, b.bidder)} sagt ${nameOf(s, b.listener)}${b.value ? (b.asked === "listener" ? " – ja oder passe?" : " – höher?") : ""}` }
    : s.phase !== "play" ? { title: `${nameOf(s, s.declarer)} spielt`, sub: `gereizt bis ${s.bid} · ${s.phase === "skat" ? "Skat oder Hand?" : s.phase === "discard" ? "drückt zwei Karten" : "sagt das Spiel an"}` }
    : undefined;
  return {
    sign,
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.curId && room.players.some((p) => p.id === s.curId) ? s.curId : null, n: s.n,
    log: s.log.slice(-6), scores: Object.fromEntries(s.seats.map((id) => [id, s.scores[id] ?? 0])),
    seatOrder: s.seats.map((id) => ({ id, name: nameOf(s, id), bot: s.ghosts.includes(id) })),
    trick: s.phase === "play" ? trick.map((p) => ({ id: p.id, card: shownCard(p.card, room.options), win: p.id === done })) : undefined,
    notes: Object.fromEntries(s.seats.map((id) => [id, note(id)])),
    color: { label, hex: s.phase === "play" && !s.ramsch ? "#a8454f" : "#3f5f8a" },
  };
}
