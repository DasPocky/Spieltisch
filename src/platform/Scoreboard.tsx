import { fmt } from "@/lib/utils";
import { Seats } from "./Seats";

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  /** Fortschritt 0..1 (z. B. Richtung Spielziel), optional */
  progress?: number;
  /** fester Platz (statt aus gleichen Punkten zu teilen) – für Spiele mit klarer Reihenfolge, z. B. Ausscheiden */
  place?: number;
  /** Text statt der Punkte (z. B. „raus in Runde 7“) */
  text?: string;
}

/**
 * Punkteleiste – alle Spieler auf einen Blick (siehe `Seats`).
 * Wer dran ist, ist hervorgehoben, der Führende bekommt eine Krone.
 */
export function Scoreboard({ entries, currentId, me, online, selectedId, onSelect, lowWins }: {
  entries: ScoreEntry[];
  currentId: string | null;
  me: string | null;
  online: Set<string> | null;
  /** optional: antippbar, z. B. um den Block eines Spielers anzuzeigen */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Wenige Punkte sind gut (z. B. Himmelskarten): die Krone geht an den Niedrigsten */
  lowWins?: boolean;
}) {
  const max = Math.max(...entries.map((p) => p.score));
  const min = Math.min(...entries.map((p) => p.score));
  return (
    <Seats me={me} online={online} selectedId={selectedId} onSelect={onSelect}
      seats={entries.map((p) => ({
        id: p.id,
        name: p.name,
        cur: p.id === currentId,
        lead: lowWins ? p.score === min && max > min : p.score === max && max > 0,
        value: fmt(p.score),
        progress: p.progress,
      }))} />
  );
}
