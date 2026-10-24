import { Suspense, useState } from "react";
import { BookOpen, Clock, Loader2, Lock, Smartphone, Users } from "lucide-react";
import { getGame } from "@shared/games";
import { GAME_CATEGORIES, type GameCategory } from "@shared/platform/types";
import { orderGames } from "@shared/platform/access";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { gameIcon, getGameUI } from "@/games";
import { useBackClose } from "@/hooks/useBackClose";
import { useGames } from "@/hooks/useGames";
import { playLocal } from "@/lib/playLocal";
import { cn } from "@/lib/utils";
import { IconTile } from "@/platform/Logo";
import { CreateRoomForm } from "@/platform/shell/RoomSheets";

const players = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

/** Spiele-Tab: alle freigegebenen Spiele als Raster, nach Kategorie filterbar. Ein Tipp öffnet das Infoblatt. */
export function Games() {
  const { config, games, ids, locked } = useGames();
  const [cat, setCat] = useState<GameCategory | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const featured = config?.featured ?? [];
  const ordered = orderGames(ids, config?.order ?? []);
  const sorted = [...featured.filter((id) => ordered.includes(id)), ...ordered.filter((id) => !featured.includes(id))];
  const cats = GAME_CATEGORIES.filter((c) => games.some((g) => g.info.category === c));
  const shown = sorted.map((id) => games.find((g) => g.id === id)!).filter((g) => !cat || g.info.category === cat);
  const dense = shown.length > 24;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-[max(1rem,2.5vh)] pb-3">
      <h1 className="text-2xl font-bold tracking-tight">Spiele</h1>
      <p className="games-sub mt-0.5 text-sm text-muted-foreground">{games.length} Spiele – antippen für Regeln und Start</p>
      <div className="no-scrollbar -mx-4 mt-3 flex shrink-0 gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="Kategorie">
        {[null, ...cats].map((c) => (
          <button key={c ?? "alle"} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
            className={cn("h-8 shrink-0 rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition",
              cat === c ? "bg-primary text-primary-foreground ring-primary" : "text-muted-foreground ring-border")}>
            {c ?? "Alle"}
          </button>
        ))}
      </div>
      {/* Ab 25 Spielen fünf Spalten, damit das Raster auf dem Handy ohne Scrollen bleibt */}
      <ul className={cn("games-grid mt-3 grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]", dense ? "grid-cols-5 gap-1.5" : "grid-cols-4")} data-testid="game-grid">
        {shown.map(({ id, info, Icon }) => (
          <li key={id}>
            <button type="button" onClick={() => setOpen(id)} data-testid={`game-${id}`}
              className="glass relative flex h-full w-full min-w-0 flex-col items-center gap-0.5 rounded-2xl px-0.5 pt-2 pb-1.5 outline-none transition active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring">
              {featured.includes(id) && <span className="absolute top-1 right-1 rounded-full bg-primary px-1 text-[0.55rem] font-bold leading-tight text-primary-foreground">NEU</span>}
              {locked(id) && <Lock className="absolute top-1.5 left-1.5 size-3.5 text-muted-foreground" aria-label="mit Zugangscode" />}
              <IconTile className="game-tile-icon size-10 rounded-xl"><Icon className="size-6.5" /></IconTile>
              <span className={cn("w-full px-0.5 text-center font-semibold", dense ? "line-clamp-2 hyphens-auto break-words text-[0.66rem] leading-tight" : "truncate text-[0.72rem]")}>{info.name}</span>
              <span className="game-tile-players flex items-center gap-0.5 text-[0.65rem] text-muted-foreground"><Users className="size-3" />{players(info.minPlayers, info.maxPlayers)}</span>
            </button>
          </li>
        ))}
      </ul>
      <GameSheet gameId={open} onClose={() => setOpen(null)} />
    </main>
  );
}

/** Infoblatt eines Spiels: worum es geht, Regeln zum Aufklappen, Raum mit diesem Spiel öffnen */
export function GameSheet({ gameId, onClose }: { gameId: string | null; onClose: () => void }) {
  const { ids, locked, online, localOn, onlineOff } = useGames();
  const [view, setView] = useState<"info" | "rules" | "create">("info");
  const close = () => { onClose(); setTimeout(() => setView("info"), 300); };
  useBackClose(!!gameId, close);
  const info = gameId ? getGame(gameId).info : null;
  const Icon = gameIcon(gameId ?? "alles");
  return (
    <Sheet open={!!gameId} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent data-testid="game-sheet">
        {info && gameId && (
          <>
            <SheetHeader className="flex items-center gap-3 pr-14">
              <IconTile className="size-12 shrink-0 rounded-2xl"><Icon className="size-8" /></IconTile>
              <div className="min-w-0">
                <SheetTitle>{info.name}</SheetTitle>
                <SheetDescription>{info.tagline}</SheetDescription>
              </div>
            </SheetHeader>
            <div className="flex flex-wrap gap-1.5 px-5 pt-2 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1"><Users className="size-3.5" />{players(info.minPlayers, info.maxPlayers)} Spieler</span>
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1"><Clock className="size-3.5" />{info.duration}</span>
              <span className="rounded-full bg-secondary px-2.5 py-1">{info.category}</span>
              {locked(gameId) && <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1"><Lock className="size-3.5" />Zugangscode</span>}
            </div>
            {view === "rules" ? (
              <div className="mt-2 min-h-0 overflow-y-auto border-t px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                <Suspense fallback={<Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />}><Rules gameId={gameId} /></Suspense>
              </div>
            ) : view === "create" ? (
              <div className="overflow-y-auto px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"><CreateRoomForm plan={{ gameId, pickGame: false }} /></div>
            ) : (
              <div className="grid gap-2 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                <Button size="lg" disabled={!online} onClick={() => setView("create")}>{onlineOff ? "Online gerade abgeschaltet" : online ? "Raum mit diesem Spiel öffnen" : "Raum öffnen braucht Netz"}</Button>
                {localOn && <Button size="lg" variant="secondary" onClick={() => playLocal(ids, locked, gameId, true)}><Smartphone />Auf einem Handy spielen</Button>}
                <Button variant="ghost" onClick={() => setView("rules")}><BookOpen />Regeln lesen</Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Rules({ gameId }: { gameId: string }) {
  const { Rules } = getGameUI(gameId);
  return <Rules />;
}
