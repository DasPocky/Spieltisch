import { useContext, type ReactNode } from "react";
import { AVATAR_COLORS, AVATAR_EMOJIS } from "@shared/platform/group";
import type { RoomAction } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { cn, fmt } from "@/lib/utils";
import { wantGamePick } from "@/lib/pickGame";
import { EveningLine, VoteButton } from "./Evening";
import type { ScoreEntry } from "./Scoreboard";
import { AvatarContext } from "./Avatar";

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
  ranking.forEach((p, i) => { if (p.place) places[i] = p.place; });
  const avatars = useContext(AvatarContext);
  // Podium: Platz 2 links, 1 in der Mitte, 3 rechts – bei weniger Spielern nur, wer da ist
  const podium = [1, 0, 2].filter((i) => i < Math.min(3, ranking.length));
  const rest = ranking.slice(3);
  const face = (id: string, name: string, big: boolean) => {
    const av = avatars?.[id];
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-full leading-none shadow-sm", big ? "size-16 text-[2.1rem] [@media(max-height:640px)]:size-12 [@media(max-height:640px)]:text-[1.6rem]" : "size-12 text-[1.6rem] [@media(max-height:640px)]:size-10 [@media(max-height:640px)]:text-[1.3rem]")}
        style={av ? { backgroundColor: AVATAR_COLORS[av.color] } : undefined} aria-hidden="true">
        {av ? AVATAR_EMOJIS[av.emoji] : name.trim()[0]?.toUpperCase()}
      </span>
    );
  };
  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      <Confetti />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-[3vh] pb-3 text-center">
        <div className="text-sm text-muted-foreground">Gewonnen hat</div>
        <div className="text-in font-display my-0.5 text-4xl leading-tight [@media(max-height:640px)]:text-3xl tracking-tight break-words" data-testid="winner">{winner}</div>
        <div className="text-muted-foreground">{subtitle}</div>
        <div className="mt-5 [@media(max-height:640px)]:mt-2" data-testid="ranking">
          <ol className="flex items-end justify-center gap-2" aria-label="Siegertreppchen">
            {podium.map((i) => {
              const p = ranking[i];
              const place = places[i];
              return (
                <li key={p.id} className="text-in flex min-w-0 flex-1 basis-0 flex-col items-center gap-1" style={{ animationDelay: `${150 + (place - 1) * 140}ms`, maxWidth: "8.5rem" }}>
                  {place === 1 && <span className="pop text-2xl leading-none [@media(max-height:640px)]:text-lg" aria-hidden="true">👑</span>}
                  {face(p.id, p.name, place === 1)}
                  <span className="w-full truncate text-sm font-semibold" title={p.name}>{p.name}</span>
                  <span className={cn("grid w-full place-items-center rounded-t-xl pt-1 font-bold tabular-nums",
                    place === 1 ? "h-24 bg-primary text-2xl text-primary-foreground [@media(max-height:640px)]:h-16 [@media(max-height:640px)]:text-xl" : place === 2 ? "glass h-[4.5rem] text-xl [@media(max-height:640px)]:h-12 [@media(max-height:640px)]:text-lg" : "glass h-14 text-lg [@media(max-height:640px)]:h-10 [@media(max-height:640px)]:text-base")}>
                    <span>{place}.</span>
                    <span className="max-w-full truncate px-1 text-xs font-semibold opacity-80">{p.text ?? <>{fmt(p.score)}{scoreLabel && ` ${scoreLabel}`}</>}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {rest.length > 0 && (
            <ol className={cn("mt-3 grid gap-1.5 text-left", rest.length > 3 && "grid-cols-2")} aria-label="Weitere Plätze">
              {rest.map((p, j) => {
                const i = j + 3;
                return (
                  <li key={p.id} style={{ animationDelay: `${500 + j * 60}ms` }} className="text-in glass flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5">
                    <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground tabular-nums">{places[i]}.</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={p.name}>{p.name}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{p.text ?? <>{fmt(p.score)}{scoreLabel && <span className="ml-1 text-xs font-normal text-muted-foreground">{scoreLabel}</span>}</>}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
      <div className="shrink-0 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <EndActions isHost={isHost} dispatch={dispatch}>{children}</EndActions>
      </div>
    </section>
  );
}

/** Konfetti zur Siegerehrung – reines CSS, fällt einmal und ist dann weg (bei „weniger Bewegung“ gar nicht) */
function Confetti() {
  const colors = ["var(--primary)", "var(--ice)", "#ffd23f", "#5ccf7a", "#5aa9ff", "#ff7aa8"];
  return (
    <div className="confetti pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`,
          background: colors[i % colors.length],
          animationDelay: `${(i % 9) * 0.12}s`,
          animationDuration: `${2.2 + ((i * 7) % 10) / 10}s`,
          ["--x" as string]: `${((i * 53) % 60) - 30}px`,
          ["--r" as string]: `${(i * 97) % 720}deg`,
        }} />
      ))}
    </div>
  );
}

/** Nach der Partie: nochmal, anderes Spiel oder zur Lobby (Spieler, Einstellungen) – für alle Spiele gleich */
export function EndActions({ isHost, dispatch, children }: { isHost: boolean; dispatch: (a: RoomAction) => void; children?: ReactNode }) {
  if (!isHost) return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      <EveningLine />
      <p className="glass rounded-xl py-3 text-center text-muted-foreground">Der Host startet gleich nochmal oder wählt ein anderes Spiel.</p>
    </div>
  );
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      <EveningLine />
      <div className="flex gap-2">
        <Button size="lg" className="min-w-0 flex-1" onClick={() => dispatch({ type: "restart" })}>Nochmal spielen</Button>
        {/* Online: alle stimmen über das nächste Spiel ab */}
        <VoteButton size="lg" />
      </div>
      {children}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="px-2 whitespace-nowrap" onClick={() => { wantGamePick(); dispatch({ type: "toLobby" }); }}>Spiel wechseln</Button>
        <Button variant="secondary" className="px-2 whitespace-nowrap" onClick={() => dispatch({ type: "toLobby" })}>Zur Lobby</Button>
      </div>
    </div>
  );
}
