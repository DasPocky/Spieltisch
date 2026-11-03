import type { RoomState } from "@shared/platform/room";
import { callName, contractName, knownParties, nameOf, shownCard, type DkState } from "@shared/games/doppelkopf/logic";
import type { TableModel } from "../../platform/table/model";

/**
 * Doppelkopf am Tisch: der Stich in der Mitte, an jedem Platz Vorbehalt bzw. Ansage und Stiche – keine Hände.
 * Parteien nur, soweit sie am Tisch klar sind (gespielte Kreuz-Dame, Ansage, Solo).
 */
export function doppelkopfTable(room: RoomState): TableModel | null {
  const s = room.game as DkState;
  if (s.phase !== "reserve" && s.phase !== "play") return null;
  // Zwischen zwei Stichen bleibt der letzte liegen, bis jemand ausspielt
  const trick = s.trick.length ? s.trick : (s.tricks.at(-1)?.plays ?? []);
  const known = knownParties(s, null);
  const tricksOf = (id: string) => s.tricks.filter((t) => t.winner === id).length;
  const note = (id: string) => {
    if (s.phase === "reserve") return s.said[id] === "gesund" ? "gesund" : s.said[id] === "vorbehalt" ? "Vorbehalt!" : s.curId === id ? "überlegt …" : "";
    const party = known[id];
    const call = s.callBy[id] && party ? callName(party, s.callBy[id]) : null;
    const who = s.soloist === id && s.contract !== "normal" ? (s.contract === "hochzeit" ? "Hochzeit" : "Solist") : party === "re" ? "Re" : party === "kontra" ? "Kontra" : "";
    return [who, call && call !== who ? `„${call}“` : null, `${tricksOf(id)} ${tricksOf(id) === 1 ? "Stich" : "Stiche"}`].filter(Boolean).join(" · ");
  };
  return {
    deck: "cards", pile: 0, discard: trick.map((p) => shownCard(p.card, room.options)), counts: {}, turn: s.curId && room.players.some((p) => p.id === s.curId) ? s.curId : null, n: s.n,
    log: s.log.slice(-6), scores: Object.fromEntries(room.players.map((p) => [p.id, s.scores[p.id] ?? 0])),
    notes: Object.fromEntries(room.players.map((p) => [p.id, note(p.id)])),
    color: s.contract ? { label: `${contractName(s.contract, room.options)}${s.soloist && s.contract !== "normal" ? ` – ${nameOf(s, s.soloist)}` : ""}`, hex: s.contract === "normal" ? "#3f5f8a" : "#a8454f" } : undefined,
  };
}
