/**
 * Gemeinsame Bausteine der Brettspiele zu zweit: Spielerleiste mit Farben, Statuszeile,
 * Ergebnis unter dem Brett und „Aufgeben“ im Menü.
 */
import type { ReactNode } from "react";
import { Flag, Handshake, Trophy } from "lucide-react";
import type { RoomAction, RoomState } from "@shared/platform/room";
import { isOver, sideOf, type DuelBase, type Side } from "@shared/games/_board/duel";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/Confirm";
import type { BoardProps } from "@/games/types";
import { HintChip } from "@/platform/HintChip";
import { PlayerRow } from "@/platform/PlayerRow";
import { EndActions } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { cn } from "@/lib/utils";
import "./board.css";

export const playerName = (room: RoomState, id: string) => room.players.find((p) => p.id === id)?.name ?? "?";

/** Wie das Brett liegt: online sieht jeder seine Farbe unten, lokal auf Wunsch zum Spieler am Zug gedreht */
export function flippedFor(s: DuelBase, me: string | null, turnBoard: boolean): boolean {
  if (me !== null) return sideOf(s, me) === 1;
  return turnBoard && !isOver(s) && s.turn === 1;
}

/** Zwei Spieler mit ihrer Farbe – wer dran ist, leuchtet */
export function DuelBar({ room, s, me, online, colorNames, swatch, extra }: {
  room: RoomState;
  s: DuelBase;
  me: string | null;
  online: Set<string> | null;
  colorNames: readonly [string, string];
  swatch: (side: Side) => ReactNode;
  extra?: (side: Side) => ReactNode;
}) {
  const over = isOver(s);
  return (
    <PlayerRow className="justify-center">
      {([0, 1] as Side[]).map((side) => {
        const id = s.colors[side];
        const cur = !over && s.turn === side;
        const won = s.winner === side;
        return (
          <div key={side} data-cur={cur} data-testid={`duel-${side}`}
            className={cn("flex min-w-0 flex-1 basis-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold",
              cur ? "turn" : won ? "bg-primary/12 ring-1 ring-inset ring-primary/40" : "glass")}>
            <span className="grid size-6 shrink-0 place-items-center" aria-label={colorNames[side]}>{swatch(side)}</span>
            <span className="min-w-0 flex-1 truncate">
              {online && <span className={cn("mr-1.5 inline-block size-1.5 rounded-full align-middle", online.has(id) ? "bg-ok" : "bg-current opacity-30")} />}
              {id === me ? "Du" : playerName(room, id)}
            </span>
            {won && <Trophy className="size-4 shrink-0" aria-label="Sieger" />}
            {extra && <span className={cn("shrink-0 text-xs tabular-nums", !cur && "text-muted-foreground")}>{extra(side)}</span>}
          </div>
        );
      })}
    </PlayerRow>
  );
}

/** Das Brett füllt den freien Platz in der Mitte, ohne zu scrollen */
export function BoardBox({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="relative min-h-0 flex-1 py-1.5" role="group" aria-label={label}>
      <div className="absolute inset-x-0 inset-y-1.5">{children}</div>
    </div>
  );
}

/** Unter dem Brett: Hinweis, wer was tun soll – oder nach der Partie Ergebnis und „Nochmal“ */
export function DuelFooter({ board, s, status, hint, mine }: {
  board: BoardProps<DuelBase, { type: string }>;
  s: DuelBase;
  status: string;
  hint?: ReactNode;
  /** Ist gerade dieses Gerät dran? (Status hervorheben) */
  mine: boolean;
}) {
  const { room, me, isHost, dispatch } = board;
  if (isOver(s)) {
    const winnerId = s.winner !== null ? s.colors[s.winner] : null;
    const title = winnerId === null ? "Unentschieden" : winnerId === me ? "Du gewinnst!" : `${playerName(room, winnerId)} gewinnt`;
    return (
      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="pop glass mb-2 flex items-center gap-3 rounded-2xl px-3 py-2.5" data-testid="result">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
            {winnerId === null ? <Handshake className="size-6" aria-hidden="true" /> : <Trophy className="size-6" aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg leading-tight font-bold" data-testid="winner">{title}</span>
            <span className="block truncate text-sm text-muted-foreground">{s.end}</span>
          </span>
        </div>
        <EndActions isHost={isHost} dispatch={dispatch as (a: RoomAction) => void} />
      </div>
    );
  }
  return (
    <div className="flex min-h-11 shrink-0 items-center justify-center gap-2 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm text-muted-foreground">
      <span data-testid="status" className={cn("min-w-0 text-center", mine && "font-semibold text-foreground")}>
        {hint ?? <SmoothText>{status}</SmoothText>}
      </span>
      <RulesSheet gameId={room.gameId} />
    </div>
  );
}

export { HintChip };

/** Menü: Aufgeben (lokal gibt der Spieler am Zug auf, online man selbst) */
export function ResignMenu({ game: s, me, room, act }: BoardProps<DuelBase, { type: string }>) {
  if (isOver(s)) return null;
  const side = me === null ? s.turn : sideOf(s, me);
  if (side === null) return null;
  const name = me === null ? playerName(room, s.colors[side]) : "Du";
  return (
    <Confirm title={me === null ? `${name} gibt auf?` : "Aufgeben?"} description="Die Partie endet sofort, der Gegner gewinnt." confirmLabel="Aufgeben" onConfirm={() => act({ type: "resign" })}>
      <Button variant="secondary" className="justify-start"><Flag />{me === null ? `${name} gibt auf` : "Aufgeben"}</Button>
    </Confirm>
  );
}
