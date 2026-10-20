import { useEffect, useRef } from "react";
import { standings, teamName, type StirnState } from "@shared/games/stirnraten/logic";
import { nameOf } from "@/games/werwolf/parts";
import { ResultScreen } from "@/platform/ResultScreen";
import { speak } from "@/platform/speech";
import { BombGame } from "./Bomb";
import { ForeheadGame } from "./Forehead";
import { ImpostorGame } from "./Impostor";
import { stirnSay } from "./narration";
import type { P } from "./parts";

/** Vorlesen wie ein Spielleiter: lokal das Gerät, online nur das Handy des Hosts (sonst hallt es) */
function useNarration({ game: s, me, isHost, room }: P) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<StirnState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = stirnSay(before, s, room.players);
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

export function Board(props: P) {
  const { game: s } = props;
  useNarration(props);
  if (s.phase === "over") return <Over {...props} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {s.variant === "bombe" ? <BombGame {...props} /> : s.variant === "hochstapler" ? <ImpostorGame {...props} /> : <ForeheadGame {...props} />}
    </div>
  );
}

function Over({ room, game: s, isHost, dispatch }: P) {
  const players = room.players;
  const rows = standings(s);
  const ranking = rows.map((r) => ({ id: r.ids[0] ?? r.key, name: s.variant === "teams" ? `${r.label} (${r.ids.map((id) => nameOf(players, id)).join(", ")})` : nameOf(players, r.key), score: r.score }));
  const best = rows[0]?.score;
  const top = rows.filter((r) => r.score === best).map((r) => (s.variant === "teams" ? r.label : nameOf(players, r.key)));
  const subtitle = s.variant === "bombe" ? "Am wenigsten Bomben gewinnt" : s.variant === "teams" ? `${s.teams.length} Teams · ${s.turns} Züge` : s.variant === "hochstapler" ? `${s.turns} Runden Hochstapler` : `${s.turns} Züge`;
  return (
    <ResultScreen winner={top.join(" & ") || "Niemand"} isHost={isHost} dispatch={dispatch} ranking={ranking}
      scoreLabel={s.variant === "bombe" ? "Bomben" : s.variant === "teams" ? "Punkte" : "Punkte"} subtitle={s.variant === "teams" && s.last ? `${subtitle} · zuletzt ${teamName(s.last.team)}` : subtitle} />
  );
}
