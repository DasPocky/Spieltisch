import { Search, Users, X } from "lucide-react";
import { getGame } from "@shared/games";
import { fitsPlayers, gameMatches } from "@/lib/gameSearch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GameFilter { query: string; fit: boolean }
export const NO_FILTER: GameFilter = { query: "", fit: false };

/** Spiele nach Suche und (wenn eingeschaltet) passender Spielerzahl filtern */
export function filterGames(ids: string[], f: GameFilter, players: number): string[] {
  return ids.filter((id) => { const g = getGame(id).info; return gameMatches(g, f.query) && (!f.fit || fitsPlayers(g, players)); });
}

/** Suchfeld mit Löschen-Knopf, daneben „Für N“ – zeigt nur Spiele, die zur Spielerzahl passen */
export function GameSearch({ value, onChange, players, className }: { value: GameFilter; onChange: (f: GameFilter) => void; players: number; className?: string }) {
  return (
    <div className={cn("flex gap-2", className)}>
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Spiel suchen</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={value.query} onChange={(e) => onChange({ ...value, query: e.target.value })} placeholder="Suchen …" data-testid="game-search"
          enterKeyHint="search" autoComplete="off" className="h-10 w-full rounded-xl bg-navy-950/45 pr-9 pl-9 text-base ring-1 ring-inset ring-input outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden" />
        {value.query && (
          <button type="button" onClick={() => onChange({ ...value, query: "" })} aria-label="Suche löschen"
            className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" /></button>
        )}
      </label>
      {players > 0 && (
        <button type="button" onClick={() => onChange({ ...value, fit: !value.fit })} aria-pressed={value.fit} data-testid="game-fit"
          aria-label={`Nur Spiele für ${players} Spieler`}
          className={cn("flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring", value.fit ? "bg-primary text-primary-foreground" : "glass")}>
          <Users className="size-4" />Für {players}
        </button>
      )}
    </div>
  );
}

/** Nichts gefunden – mit Ausweg */
export function NoGames({ onReset }: { onReset: () => void }) {
  return (
    <div className="grid justify-items-center gap-2 py-6 text-center text-sm text-muted-foreground" data-testid="game-none">
      Kein Spiel passt dazu.
      <Button variant="secondary" onClick={onReset}>Alle Spiele zeigen</Button>
    </div>
  );
}
