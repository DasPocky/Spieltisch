import type { RoomState } from "@shared/platform/room";
import { CARD_BY_ID, diceModeOf, type AllesState } from "@shared/games/alles/logic";
import type { TableModel } from "../../platform/table/model";

/** Alles oder nichts am Tisch: Kartenstapel und aufgedeckte Karte hinten, Würfel davor – beiseitegelegte vorn, Punkte an den Plätzen */
export function allesTable(room: RoomState): TableModel | null {
  const s = room.game as AllesState;
  // Echte Würfel: der Tisch kennt die Augen nicht – dann wie ein Handy
  if (s.winnerId || diceModeOf(room) === "real") return null;
  const name = room.players.find((p) => p.id === s.curId)?.name ?? "";
  const card = s.turnCards.at(-1);
  const c = card ? CARD_BY_ID[card] : null;
  const d = s.dice;
  const note = !d || (!d.roll.length && !d.aside.length) ? `${name} ist dran`
    : d.bust ? "Niete – die Punkte sind weg" : d.alles ? `Volltreffer! ${s.turnPts} Punkte` : `${s.turnPts} Punkte im Zug`;
  return {
    deck: "zahlen", pile: 0, discard: [], counts: {}, turn: s.curId, n: d?.n ?? s.log.length, log: s.log.slice(-6).map((e) => `${e.name}: ${e.pts} Punkte`), scores: s.scores,
    notes: Object.fromEntries(room.players.map((p) => [p.id, `${(s.scores[p.id] ?? 0).toLocaleString("de-DE")} Pkt.`])),
    piles: [{ label: "Karten", top: null, count: s.pile.length }, ...(c ? [{ label: c.name, top: c.big, tone: c.color }] : [])],
    dice: d ? { values: [...d.aside, ...d.roll], held: [...d.aside.map(() => true), ...d.sel], n: d.n, note } : { values: [], held: [], n: 0, note },
  };
}
