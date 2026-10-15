import { DoorClosed, Lock, Users, Video } from "lucide-react";
import { getGame, isGameId } from "@shared/games";
import type { RoomCard } from "@shared/platform/directory";
import { gameIcon } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { cn } from "@/lib/utils";
import { Avatar } from "@/platform/Avatar";
import { IconTile } from "@/platform/Logo";

/** Was im Raum gerade passiert, in drei Wörtern */
function status(c: RoomCard): string {
  const game = isGameId(c.gameId) ? getGame(c.gameId).info.name : "Spiel";
  if (c.meet) return "Treffpunkt";
  return c.phase === "playing" ? `${game} · läuft` : `${game} · Lobby`;
}

/** Eine Raumkarte: Name oder Host, was läuft, wer da ist, ob jemand per Video drin ist */
export function RoomCardView({ card: c, mine }: { card: RoomCard; mine?: boolean }) {
  const Icon = gameIcon(c.gameId);
  const shown = [...c.players].sort((a, b) => Number(b.online) - Number(a.online)).slice(0, 3);
  return (
    <button type="button" onClick={() => navigate(`/r/${c.code}`)} data-testid={`room-card-${c.code}`}
      aria-label={`${c.name ?? (c.host ? `Raum bei ${c.host}` : `Raum ${c.code}`)}: ${status(c)}, ${c.online} da`}
      className="glass flex w-full min-w-0 snap-start items-center gap-2.5 rounded-2xl p-2.5 text-left outline-none transition active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring">
      <IconTile className="size-10 rounded-xl">{c.meet ? <Video className="size-5.5 text-white" /> : <Icon className="size-6.5" />}</IconTile>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{c.name ?? (c.host ? `bei ${c.host}` : `Raum ${c.code}`)}</span>
          {c.live && <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-1.5 py-px text-[0.6rem] font-bold text-primary-foreground"><Video className="size-2.5" />LIVE</span>}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">{status(c)}</span>
          {!mine && c.admission === "knock" && <DoorClosed className="size-3.5 shrink-0" aria-label="mit Anklopfen" />}
          {c.visibility === "group" && <Users className="size-3.5 shrink-0" aria-label="nur Gruppe" />}
          {c.visibility === "none" && <Lock className="size-3.5 shrink-0" aria-label="privat" />}
          {c.group && !mine && <span className="shrink-0 rounded-full bg-primary/12 px-1.5 text-[0.6rem] font-bold text-primary">Gruppe</span>}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="flex -space-x-1.5">
          {shown.map((p, i) => <Avatar key={`${p.name}-${i}`} avatar={p.avatar} name={p.name} className={cn("size-6 text-[0.8rem] ring-2 ring-background", !p.online && "opacity-45")} />)}
        </span>
        <span className="text-[0.7rem] font-semibold text-muted-foreground">{c.online > 0 ? `${c.online} da` : "leer"}</span>
      </span>
    </button>
  );
}

/** Eine Reihe Raumkarten: eine passt ganz, weitere schauen rechts heraus – seitlich wischen statt scrollen */
export function RoomRow({ title, cards, mine, testId }: { title: string; cards: RoomCard[]; mine?: boolean; testId: string }) {
  if (!cards.length) return null;
  return (
    <section className="shrink-0" aria-label={title} data-testid={testId}>
      <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-sm font-semibold text-muted-foreground">
        {title}<span className="text-xs font-normal">{cards.length > 1 ? `${cards.length} · wischen` : ""}</span>
      </h2>
      <div className={cn("no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 scroll-px-4", cards.length === 1 && "overflow-hidden")}>
        {cards.map((c) => (
          <div key={c.code} className={cn("shrink-0", cards.length === 1 ? "w-full" : "w-[84%] sm:w-[48%]")}><RoomCardView card={c} mine={mine} /></div>
        ))}
      </div>
    </section>
  );
}
