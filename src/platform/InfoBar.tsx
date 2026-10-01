import { useState } from "react";
import { ChevronRight, History, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { BoardProps, GameUI } from "@/games/types";
import { cn } from "@/lib/utils";

/**
 * Eine schmale Leiste über dem Spiel: Was ist zuletzt passiert? Antippen öffnet „Spieler & Verlauf“ –
 * alle Spieler mit Karten, Punkten usw. und die letzten Züge. So weiß man jederzeit, wo das Spiel steht.
 */
export function InfoBar({ ui, board }: { ui: GameUI; board: BoardProps }) {
  const [open, setOpen] = useState(false);
  const log = ui.log?.(board.game) ?? [];
  const last = log.at(-1);
  const ov = ui.overview?.(board.game, board.room);
  const players = board.room.players;
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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Spieler & Verlauf</SheetTitle>
            <SheetDescription>Wer wie steht und was zuletzt passiert ist.</SheetDescription>
          </SheetHeader>
          <div className="no-scrollbar grid gap-5 overflow-y-auto px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {ov && (
              <table className="w-full text-sm" data-testid="overview">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="py-1.5 text-left font-semibold">Spieler</th>
                    {ov.cols.map((c) => <th key={c} className="px-1 py-1.5 text-right font-semibold">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {players.filter((p) => ov.rows[p.id]).map((p) => {
                    const cur = ov.curId === p.id;
                    return (
                      <tr key={p.id} className={cn("border-t border-border", cur && "bg-primary/8")}>
                        <td className="py-2 pr-2">
                          <span className="flex items-center gap-1.5 font-semibold">
                            {board.online && <span className={cn("size-1.5 shrink-0 rounded-full", board.online.has(p.id) ? "bg-ok" : "bg-current opacity-30")} aria-label={board.online.has(p.id) ? "online" : "offline"} />}
                            <span className="truncate">{p.name}{p.id === board.me && <span className="font-normal text-muted-foreground"> (du)</span>}</span>
                            {cur && <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[0.68rem] font-semibold text-primary-foreground">dran</span>}
                          </span>
                        </td>
                        {ov.rows[p.id].map((v, i) => <td key={i} className="px-1 py-2 text-right tabular-nums">{v}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {ui.log && (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Verlauf</h3>
                {log.length ? (
                  <ol className="text-[0.95rem]" data-testid="history">
                    {log.slice(-30).reverse().map((e, i) => <li key={log.length - i} className={cn("border-b border-border py-2", i === 0 ? "font-semibold" : "text-muted-foreground")}>{e}</li>)}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">Noch nichts passiert.</p>}
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
