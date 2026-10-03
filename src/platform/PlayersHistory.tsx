import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { currentPlayerId } from "@shared/platform/room";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { BoardProps, GameUI } from "@/games/types";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

/** Einfache Verlaufsliste (neueste zuerst) – für Spiele, deren Verlauf aus Texten besteht */
export function LogList({ entries, empty = "Noch nichts passiert." }: { entries: string[]; empty?: string }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="text-[0.95rem]" data-testid="history">
      {entries.slice(-30).reverse().map((e, i) => (
        <li key={entries.length - i} className={cn("border-b border-border py-2", i === 0 ? "font-semibold" : "text-muted-foreground")}>{e}</li>
      ))}
    </ol>
  );
}

/** Letzter Eintrag des Verlaufs als Kurztext (für Leiste und Menü) */
export const lastLog = (ui: GameUI, board: BoardProps) => ui.log?.(board.game).at(-1);

/**
 * Inhalt von „Spieler & Verlauf“ – gleich für Leiste über dem Spiel und Menü, für alle Spiele:
 * Übersicht (oder schlichte Spielerliste), dann der Verlauf des Spiels.
 */
function PlayersHistory({ ui, board, manage }: { ui: GameUI; board: BoardProps; manage?: ReactNode }) {
  const ov = ui.overview?.(board.game, board.room);
  const players = board.room.players;
  const History = ui.History;
  const curId = ov?.curId ?? currentPlayerId(board.room);
  const dot = (id: string) => board.online && (
    <span className={cn("size-1.5 shrink-0 rounded-full", board.online.has(id) ? "bg-ok" : "bg-current opacity-30")} aria-label={board.online.has(id) ? "online" : "offline"} />
  );
  const name = (id: string, n: string) => <span className="truncate">{n}{id === board.me && <span className="font-normal text-muted-foreground"> (du)</span>}</span>;
  const dran = <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[0.68rem] font-semibold text-primary-foreground">dran</span>;
  return (
    <div className="no-scrollbar grid gap-5 overflow-y-auto px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {ov ? (
        <table className="w-full text-sm" data-testid="overview">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1.5 text-left font-semibold">Spieler</th>
              {ov.cols.map((c) => <th key={c} className="px-1 py-1.5 text-right font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {players.filter((p) => ov.rows[p.id]).map((p) => (
              <tr key={p.id} className={cn("border-t border-border", curId === p.id && "bg-primary/8")}>
                <td className="py-2 pr-2">
                  <span className="flex items-center gap-1.5 font-semibold">{dot(p.id)}{name(p.id, p.name)}{curId === p.id && dran}</span>
                </td>
                {ov.rows[p.id].map((v, i) => <td key={i} className="px-1 py-2 text-right tabular-nums">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="grid gap-1" data-testid="overview">
          {players.map((p) => (
            <li key={p.id} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold", curId === p.id && "bg-primary/8")}>
              <Avatar avatar={board.room.avatars?.[p.id]} name={p.name} className="size-7" />
              {dot(p.id)}{name(p.id, p.name)}{curId === p.id && dran}
            </li>
          ))}
        </ul>
      )}
      {(History || ui.log) && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Verlauf</h3>
          {History ? <History {...board} /> : <LogList entries={ui.log!(board.game)} />}
        </section>
      )}
      {manage}
    </div>
  );
}

/** Sheet „Spieler & Verlauf“ */
export function PlayersSheet({ open, onOpenChange, ui, board, manage }: {
  open: boolean; onOpenChange: (o: boolean) => void; ui: GameUI; board: BoardProps; manage?: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Spieler & Verlauf</SheetTitle>
          <SheetDescription>Wer wie steht und was zuletzt passiert ist.</SheetDescription>
        </SheetHeader>
        <PlayersHistory ui={ui} board={board} manage={manage} />
      </SheetContent>
    </Sheet>
  );
}

/** Eingeklappter Bereich – z. B. „Spieler verwalten“ oder „Während des Spiels“ */
export function Collapsible({ title, badge, children, testId }: { title: string; badge?: ReactNode; children: ReactNode; testId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl ring-1 ring-inset ring-border" data-testid={testId}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
        <span className="flex-1">{title}</span>
        {badge}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="text-in grid gap-4 px-3 pt-1 pb-3">{children}</div>}
    </div>
  );
}
