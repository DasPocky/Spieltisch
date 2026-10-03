import { Feather, Heart, House, MoonStar, Music, PawPrint, Snowflake, type LucideIcon } from "lucide-react";
import { participants, ROLES, SPECIAL_ROLES, type Role, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { cn } from "@/lib/utils";
import { useSpeak } from "@/platform/speech";
import { Leader } from "./Leader";
import { Ico, nameOf } from "./parts";
import { RoleIcon } from "./RoleIcon";
import { PlayerView } from "./PlayerView";

const WIN: Record<string, { title: string; icon: LucideIcon; text: string }> = {
  weisserwolf: { title: "Der weiße Werwolf gewinnt", icon: Snowflake, text: "Er ist als Einziger übrig." },
  floete: { title: "Der Flötenspieler gewinnt", icon: Music, text: "Alle Lebenden sind verzaubert." },
  engel: { title: "Der Engel gewinnt", icon: Feather, text: "Er ist schon in der ersten Runde in den Himmel gekommen." },
  dorf: { title: "Das Dorf gewinnt", icon: House, text: "Alle Werwölfe sind besiegt." },
  werwolf: { title: "Die Werwölfe gewinnen", icon: PawPrint, text: "Das Dorf ist in der Hand der Wölfe." },
  liebe: { title: "Die Liebe gewinnt", icon: Heart, text: "Das Liebespaar bleibt als Letztes übrig." },
};

/** Werwolf: Spielleiter bzw. lokales Gerät bekommt den geführten Ablauf, Mitspieler ihre Handy-Ansicht. */
export function Board({ room, game: s, me, isHost, act, dispatch }: BoardProps<WerwolfState, WerwolfAction>) {
  const players = room.players;
  if (s.phase === "over") {
    const w = s.winner ? WIN[s.winner] : { title: "Spiel beendet", icon: MoonStar, text: "Das Spiel wurde abgebrochen." };
    return (
      <section className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-[4vh] pb-6 text-center">
        <w.icon aria-hidden="true" className="mx-auto size-14 text-ice" />
        <h2 className="mt-3 bg-gradient-to-b from-foreground to-navy-300 bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent" data-testid="winner">{w.title}</h2>
        {me === null && <SayOnce text={`${w.title}. ${w.text}`} />}
        <p className="text-muted-foreground">{w.text}</p>
        <ul className="mt-6 grid gap-1.5 text-left">
          {participants(s).map((id) => (
            <li key={id} className={cn("flex items-center justify-between rounded-xl px-4 py-2.5", s.winner && (s.winner === "liebe" ? s.lovers?.includes(id) : s.winner === "weisserwolf" ? s.roles[id] === "weisserwolf" : s.winner === "floete" ? s.roles[id] === "floetenspieler" : s.winner === "engel" ? s.roles[id] === "engel" : ROLES[s.roles[id]].team === s.winner) ? "bg-navy-600" : "glass")}>
              <span className={cn("font-semibold", !s.alive[id] && "text-muted-foreground line-through")}>{nameOf(players, id)}{s.lovers?.includes(id) && <Ico icon={Heart} className="ml-1.5 text-navy-200" />}</span>
              <span className="text-sm"><RoleIcon role={s.roles[id]} className="mr-1.5" />{ROLES[s.roles[id]].name}</span>
            </li>
          ))}
        </ul>
        {isHost ? (
          <div className="mt-6 grid gap-2.5">
            <Button size="lg" onClick={() => dispatch({ type: "restart" })}>Nochmal spielen</Button>
            <Button variant="secondary" onClick={() => dispatch({ type: "toLobby" })}>Anderes Spiel</Button>
          </div>
        ) : <p className="mt-6 text-muted-foreground">Der Host kann nochmal starten oder ein anderes Spiel wählen.</p>}
      </section>
    );
  }
  const leader = me === null || me === s.narratorId;
  // Im Spiel aktive Rollen (für „eigene Karten“ zuerst anbieten)
  const enabled: Role[] = ["werwolf", "dorf", ...SPECIAL_ROLES.filter((r) => room.options[r] === true)];
  return leader
    ? <Leader s={s} players={players} act={act} online={me !== null} enabled={enabled} options={room.options} />
    : <PlayerView s={s} players={players} me={me!} isHost={isHost} act={act} enabled={enabled} options={room.options} dispatch={dispatch} />;
}

/** Liest einen Text einmal vor (z. B. den Sieger am Ende) */
function SayOnce({ text }: { text: string }) {
  useSpeak(text, true);
  return null;
}
