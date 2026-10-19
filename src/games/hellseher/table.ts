import type { RoomState } from "@shared/platform/room";
import { isFool, isWizard, rankOf, suitOf, type HsCard, type HsState } from "@shared/games/hellseher/logic";
import type { TableModel } from "../../platform/table/model";

const TONE = { b: "#2a62b6", r: "#c7372f", g: "#2f8f4a", y: "#c8920f" } as const;
/** Karte als Zahl mit Farbe; Zauberer „Z“ dunkel, Narr „N“ grau */
const face = (c: HsCard) => ({ top: isWizard(c) ? "Z" : isFool(c) ? "N" : String(rankOf(c)), tone: isWizard(c) ? "#25205a" : isFool(c) ? "#7d8a99" : TONE[suitOf(c)!] });

/** Hellseher am Tisch: Trumpf und Stich in der Mitte (jede Karte mit Namen), verdeckte Hände, Ansage und Stiche am Platz */
export function hellseherTable(room: RoomState): TableModel | null {
  const s = room.game as HsState;
  if (s.mode !== "app" || (s.phase !== "trump" && s.phase !== "bid" && s.phase !== "play")) return null;
  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? "";
  // Zwischen zwei Stichen bleibt der letzte kurz liegen, bis jemand ausspielt
  const trick = s.trick.length ? s.trick : (s.lastTrick?.plays ?? []);
  return {
    deck: "zahlen", pile: 0, discard: [], counts: s.counts, turn: s.curId, n: s.n, log: s.log.slice(-6), scores: s.scores,
    notes: Object.fromEntries(room.players.map((p) => {
      const bid = s.bids[p.id];
      return [p.id, `${bid === null || bid === undefined ? (s.bidIn[p.id] ? "angesagt" : "Ansage offen") : `Ansage ${bid}`} · ${s.tricks[p.id] ?? 0} Stiche`];
    })),
    piles: [
      { label: `Runde ${s.round}`, top: null, count: s.deckCount },
      ...(s.trumpCard ? [{ label: "Trumpf", ...face(s.trumpCard), single: true }] : []),
      ...trick.map((pl) => ({ label: name(pl.id), ...face(pl.card), single: true })),
    ],
  };
}
