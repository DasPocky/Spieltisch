import { Trophy } from "lucide-react";
import type { ReactNode } from "react";
import type { RoomAction } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { cn, fmt } from "@/lib/utils";
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
  return (
    <section className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-[6vh] pb-6 text-center">
      <Trophy className="mx-auto size-14 text-ice" strokeWidth={1.5} aria-hidden="true" />
      <div className="mt-3 text-muted-foreground">Gewonnen hat</div>
      <div className="my-1.5 bg-gradient-to-b from-foreground to-navy-300 bg-clip-text text-5xl font-bold leading-tight tracking-tight text-transparent">{winner}</div>
      <div className="text-muted-foreground">{subtitle}</div>
      <ol className="mt-8 grid gap-1.5 text-left">
        {ranking.map((p, i) => (
          <li key={p.id} className={cn("flex justify-between rounded-xl px-4 py-3 font-semibold", i === 0 ? "bg-navy-600" : "glass")}>
            <span><span className="mr-2 text-muted-foreground">{i + 1}.</span>{p.name}</span><span className="tabular-nums">{fmt(p.score)}{scoreLabel && <span className="ml-1 text-sm font-normal text-muted-foreground">{scoreLabel}</span>}</span>
          </li>
        ))}
      </ol>
      {isHost ? (
        <div className="mt-6 grid gap-2.5">
          <Button size="lg" onClick={() => dispatch({ type: "restart" })}>Neue Runde, gleiche Spieler</Button>
          {children}
          <Button variant="secondary" onClick={() => dispatch({ type: "toLobby" })}>Zur Lobby – anderes Spiel wählen</Button>
        </div>
      ) : <p className="mt-6 text-muted-foreground">Der Host kann eine neue Runde starten.</p>}
    </section>
  );
}
