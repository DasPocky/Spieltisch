import { useEffect, useRef } from "react";
import { scoringOf, type SpionState } from "@shared/games/spion/logic";
import { placeName } from "@shared/games/spion/places";
import { nameOf } from "@/games/werwolf/parts";
import { speak } from "@/platform/speech";
import { spionSay } from "./narration";
import { ResultScreen } from "@/platform/ResultScreen";
import { ids, names, type P } from "./parts";
import { Device } from "./Device";
import { Phone } from "./Phone";

/** Vorlesen wie ein Spielleiter: lokal das Gerät, online nur das Handy des Hosts (sonst hallt es) */
function useNarration({ game: s, me, isHost, room }: P) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<SpionState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = spionSay(before, s, room.players);
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
  return on;
}

export function Board(props: P) {
  const { game: s, me } = props;
  useNarration(props);
  if (s.phase === "over") return <Over {...props} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {me === null ? <Device {...props} /> : <Phone {...props} me={me} />}
    </div>
  );
}

function Over({ room, game: s, isHost, dispatch }: P) {
  const players = room.players;
  const ranking = ids(s).map((id) => ({ id, name: nameOf(players, id), score: s.scores[id] })).sort((a, b) => b.score - a.score);
  const top = ranking.filter((r) => r.score === ranking[0]?.score).map((r) => r.name);
  const r = s.last;
  return (
    <ResultScreen winner={top.join(" & ") || "Niemand"} isHost={isHost} dispatch={dispatch} ranking={ranking}
      scoreLabel={scoringOf(room.options) === "rounds" ? "Siege" : "Punkte"}
      subtitle={r ? `Letzte Runde: ${placeName(r.place)} · ${r.spies.length > 1 ? "Spione" : "Spion"}: ${names(players, r.spies)} (${r.winner === "spy" ? "gewonnen" : "enttarnt"})` : ""} />
  );
}
