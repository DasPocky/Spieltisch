import { Trophy } from "lucide-react";
import type { ReactNode } from "react";
import type { RoomAction } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { cn, fmt } from "@/lib/utils";
import { wantGamePick } from "@/lib/pickGame";
import type { ScoreEntry } from "./Scoreboard";

/** Siegerehrung mit Rangliste. Der Host startet von hier eine neue Runde oder geht zurück in die Lobby. */
export function ResultScreen({ winner, subtitle, ranking, isHost, dispatch, children, scoreLabel }: {
  winner: string;
  subtitle: string;
  ranking: ScoreEntry[];
  /** Einheit hinter der Zahl in der Rangliste, z. B. „Karten übrig“ */
  scoreLabel?: string;
  isHost: boolean;
  dispatch: (a: RoomAction) => void;
  /** zusätzliche Host-Knöpfe des Spiels */
  children?: ReactNode;
}) {
  // Gleichstand teilt sich den Platz
  const places = ranking.map((p, i) => (i > 0 && ranking[i - 1].score === p.score ? -1 : i + 1));
  for (let i = 1; i < places.length; i++) if (places[i] === -1) places[i] = places[i - 1];
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-[4vh] pb-3 text-center">
        <div className="pop mx-auto grid size-16 place-items-center rounded-full bg-primary/12 text-primary">
          <Trophy className="size-9" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="mt-3 text-sm text-muted-foreground">Gewonnen hat</div>
        <div className="text-in my-0.5 text-4xl font-bold leading-tight tracking-tight" data-testid="winner">{winner}</div>
        <div className="text-muted-foreground">{subtitle}</div>
        <ol className="mt-6 grid gap-1.5 text-left" data-testid="ranking">
          {ranking.map((p, i) => {
            const place = places[i];
            return (
              <li key={p.id} style={{ animationDelay: `${120 + i * 60}ms` }}
                className={cn("text-in flex items-center gap-3 rounded-xl px-3 py-2.5", place === 1 ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "glass")}>
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums",
                  place === 1 ? "bg-primary text-primary-foreground" : place === 2 ? "bg-navy-300/40" : place === 3 ? "bg-navy-400/30" : "text-muted-foreground")}>{place}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{fmt(p.score)}{scoreLabel && <span className="ml-1 text-xs font-normal text-muted-foreground">{scoreLabel}</span>}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="shrink-0 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <EndActions isHost={isHost} dispatch={dispatch}>{children}</EndActions>
      </div>
    </section>
  );
}

/** Nach der Partie: nochmal, anderes Spiel oder zur Lobby (Spieler, Einstellungen) – für alle Spiele gleich */
export function EndActions({ isHost, dispatch, children }: { isHost: boolean; dispatch: (a: RoomAction) => void; children?: ReactNode }) {
  if (!isHost) return <p className="glass rounded-xl py-3 text-center text-muted-foreground">Der Host startet gleich nochmal oder wählt ein anderes Spiel.</p>;
  return (
    <div className="grid gap-2">
      <Button size="lg" onClick={() => dispatch({ type: "restart" })}>Nochmal spielen</Button>
      {children}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => { wantGamePick(); dispatch({ type: "toLobby" }); }}>Spiel wechseln</Button>
        <Button variant="secondary" onClick={() => dispatch({ type: "toLobby" })}>Zur Lobby</Button>
      </div>
    </div>
  );
}
