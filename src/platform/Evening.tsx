import { createContext, useContext, useState } from "react";
import { ChevronRight, Trophy } from "lucide-react";
import { getGame } from "@shared/games";
import { eveningRanking, type RoomAction, type RoomState } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/Confirm";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Spielabend für Ergebnis-Bildschirme (die Spiele kennen den Raum nicht – der Rahmen reicht ihn durch) */
export const EveningContext = createContext<{ room: RoomState; isHost: boolean; dispatch: (a: RoomAction) => void } | null>(null);

/**
 * Spielabend: Siege über alle Partien in diesem Raum, auch über verschiedene Spiele.
 * Eine Zeile mit den Besten, antippen öffnet die ganze Liste.
 */
export function EveningLine({ className }: { className?: string }) {
  const ctx = useContext(EveningContext);
  const [open, setOpen] = useState(false);
  const e = ctx?.room.evening;
  if (!ctx || !e?.log.length) return null;
  const ranking = eveningRanking(e);
  const top = ranking.filter((r) => r.wins > 0).slice(0, 3);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="evening"
        className={cn("glass flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring", className)}>
        <Trophy className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">
          <b>Spielabend</b> <span className="text-muted-foreground">· {e.log.length} {e.log.length === 1 ? "Partie" : "Partien"}</span>
          {top.length > 0 && <span className="text-muted-foreground"> · {top.map((r) => `${r.name} ${r.wins}`).join(" · ")}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <EveningSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

function EveningSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const ctx = useContext(EveningContext);
  const e = ctx?.room.evening;
  if (!ctx || !e) return null;
  const ranking = eveningRanking(e);
  const places = ranking.map((r, i) => (i > 0 && ranking[i - 1].wins === r.wins ? -1 : i + 1));
  for (let i = 1; i < places.length; i++) if (places[i] === -1) places[i] = places[i - 1];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Spielabend</SheetTitle>
          <SheetDescription>Siege über alle Partien hier – auch über verschiedene Spiele.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <ol className="grid gap-1.5" data-testid="evening-ranking">
            {ranking.map((r, i) => (
              <li key={r.id} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", places[i] === 1 && r.wins > 0 ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "glass")}>
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums", places[i] === 1 && r.wins > 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{places[i]}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{r.wins} <span className="text-xs font-normal text-muted-foreground">{r.wins === 1 ? "Sieg" : "Siege"}</span></span>
              </li>
            ))}
          </ol>
          <h3 className="mt-5 mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Partien</h3>
          <ul className="grid gap-1 text-sm">
            {[...e.log].reverse().map((g, i) => (
              <li key={i} className="flex justify-between gap-3 rounded-lg px-1 py-1">
                <span className="text-muted-foreground">{getGame(g.gameId).info.name}</span>
                <span className="truncate font-semibold">{g.winners.map((id) => e.names[id] ?? "?").join(" & ") || "–"}</span>
              </li>
            ))}
          </ul>
          {ctx.isHost && (
            <Confirm title="Spielabend neu beginnen?" description="Alle Siege dieses Abends werden auf 0 gesetzt." confirmLabel="Zurücksetzen"
              onConfirm={() => { ctx.dispatch({ type: "resetEvening" }); onOpenChange(false); }}>
              <Button variant="secondary" className="mt-5 w-full">Neuen Spielabend beginnen</Button>
            </Confirm>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
