import type { RoomState } from "@shared/platform/room";
import { TEAM_NAME, type CNState, type Color } from "@shared/games/decknamen/logic";
import type { TableModel } from "../../platform/table/model";

const TONE: Record<Color, string> = { rot: "#d0453b", blau: "#2f6fd0", neutral: "#c9b79c", attentaeter: "#1a1a1a" };

/** Decknamen am Tisch: 25 Wörter in der Mitte, aufgedeckte in ihrer Farbe – die Schlüsselkarte sieht der Tisch nie */
export function decknamenTable(room: RoomState): TableModel | null {
  const s = room.game as CNState;
  if (s.mode !== "app" || s.phase !== "play" || !s.words.length) return null;
  const title = `${TEAM_NAME[s.turn]} ist dran${s.clue ? ` · Hinweis: ${s.clue.word.toUpperCase()} ${s.clue.count} · noch ${s.guessesLeft} ${s.guessesLeft === 1 ? "Versuch" : "Versuche"}` : " · der Chef überlegt"}`;
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: null, n: s.revealed.filter(Boolean).length, log: s.log.slice(-6),
    notes: Object.fromEntries(room.players.map((p) => {
      const m = s.members[p.id];
      return [p.id, m?.team ? `${TEAM_NAME[m.team]}${m.chief ? " · Chef" : ""}` : "schaut zu"];
    })),
    words5: { cols: 5, title, cells: s.words.map((w, i) => ({ text: w, tone: s.revealed[i] ? TONE[s.key[i]] : undefined })) },
  };
}
