import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { getGame } from "@shared/games";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getGameUI } from "@/games";

/**
 * Regelseite eines Spiels als Bogen von unten. Mit `focus` springt sie zum passenden Abschnitt
 * (das Spiel markiert ihn mit data-focused="true").
 */
export function RulesSheet({ gameId, focus, children }: { gameId: string; focus?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const { Rules } = getGameUI(gameId);
  const info = getGame(gameId).info;

  useEffect(() => {
    if (!open || !focus) return;
    const t = setTimeout(() => listRef.current?.querySelector('[data-focused="true"]')?.scrollIntoView({ block: "start", behavior: "smooth" }), 250);
    return () => clearTimeout(t);
  }, [open, focus]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children ?? (
          <button type="button" aria-label="Regeln nachlesen"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground ring-1 ring-inset ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Info className="size-4.5" />
          </button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Regeln: {info.name}</SheetTitle>
          <SheetDescription>{info.tagline}</SheetDescription>
        </SheetHeader>
        <div ref={listRef} className="overflow-y-auto px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <Rules focus={focus} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
