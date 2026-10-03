import { useState, type ReactNode } from "react";
import { ChevronRight, History, Users } from "lucide-react";
import type { BoardProps, GameUI } from "@/games/types";
import { lastLog, PlayersSheet } from "./PlayersHistory";

/**
 * Eine schmale Leiste über dem Spiel: Was ist zuletzt passiert? Antippen öffnet „Spieler & Verlauf“ –
 * dasselbe wie im Menü. So weiß man jederzeit, wo das Spiel steht.
 */
export function InfoBar({ ui, board, manage }: { ui: GameUI; board: BoardProps; manage?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const log = ui.log?.(board.game) ?? [];
  const last = lastLog(ui, board);
  const ov = ui.overview?.(board.game, board.room);
  // Mit echten Karten (Punkteblock) gibt es weder Züge noch Übersicht – dann keine Leiste
  if (!last && !ov) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="infobar"
        className="mb-1.5 flex h-8 w-full shrink-0 items-center gap-2 rounded-lg bg-secondary/60 px-2.5 text-left text-sm outline-none ring-1 ring-inset ring-border transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring">
        <History className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          <span key={log.length} className="text-in inline-block">{last ?? <span className="text-muted-foreground">Noch kein Zug</span>}</span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary"><Users className="size-3.5" />Spieler<ChevronRight className="size-3.5" /></span>
      </button>
      <PlayersSheet open={open} onOpenChange={setOpen} ui={ui} board={board} manage={manage} />
    </>
  );
}
