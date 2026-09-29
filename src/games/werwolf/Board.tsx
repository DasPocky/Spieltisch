import { participants, ROLES, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { cn } from "@/lib/utils";
import { Leader } from "./Leader";
import { nameOf } from "./parts";
import { PlayerView } from "./PlayerView";

const WIN: Record<string, { title: string; emoji: string; text: string }> = {
  dorf: { title: "Das Dorf gewinnt", emoji: "🏡", text: "Alle Werwölfe sind besiegt." },
  werwolf: { title: "Die Werwölfe gewinnen", emoji: "🐺", text: "Das Dorf ist in der Hand der Wölfe." },
  liebe: { title: "Die Liebe gewinnt", emoji: "💘", text: "Das Liebespaar bleibt als Letztes übrig." },
};

/** Werwolf: Spielleiter bzw. lokales Gerät bekommt den geführten Ablauf, Mitspieler ihre Handy-Ansicht. */
export function Board({ room, game: s, me, isHost, act, dispatch }: BoardProps<WerwolfState, WerwolfAction>) {
  const players = room.players;
  if (s.phase === "over") {
    const w = s.winner ? WIN[s.winner] : { title: "Spiel beendet", emoji: "🌘", text: "Das Spiel wurde abgebrochen." };
    return (
      <section className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-[4vh] pb-6 text-center">
        <div className="text-6xl">{w.emoji}</div>
        <h2 className="mt-3 bg-gradient-to-b from-gold to-amber-500 bg-clip-text text-4xl font-extrabold leading-tight tracking-tight text-transparent" data-testid="winner">{w.title}</h2>
        <p className="text-muted-foreground">{w.text}</p>
        <ul className="mt-6 grid gap-1.5 text-left">
          {participants(s).map((id) => (
            <li key={id} className={cn("flex items-center justify-between rounded-xl px-4 py-2.5", s.winner && (s.winner === "liebe" ? s.lovers?.includes(id) : ROLES[s.roles[id]].team === s.winner) ? "bg-navy-600" : "glass")}>
              <span className={cn("font-semibold", !s.alive[id] && "text-muted-foreground line-through")}>{nameOf(players, id)}{s.lovers?.includes(id) && " 💘"}</span>
              <span className="text-sm">{ROLES[s.roles[id]].emoji} {ROLES[s.roles[id]].name}</span>
            </li>
          ))}
        </ul>
        {isHost ? (
          <div className="mt-6 grid gap-2.5">
            <Button size="lg" onClick={() => dispatch({ type: "restart" })}>Neue Runde, neue Rollen</Button>
            <Button variant="secondary" onClick={() => dispatch({ type: "toLobby" })}>Zur Lobby – anderes Spiel wählen</Button>
          </div>
        ) : <p className="mt-6 text-muted-foreground">Der Host kann eine neue Runde starten.</p>}
      </section>
    );
  }
  const leader = me === null || me === s.narratorId;
  return leader
    ? <Leader s={s} players={players} act={act} online={me !== null} />
    : <PlayerView s={s} players={players} me={me!} isHost={isHost} act={act} />;
}
