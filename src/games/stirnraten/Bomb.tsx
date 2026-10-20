import { useEffect } from "react";
import { Bomb as BombIcon, Check, RefreshCw } from "lucide-react";
import { catName, wordText } from "@shared/games/stirnraten/cards";
import { Button } from "@/components/ui/button";
import { nameOf, Panel } from "@/games/werwolf/parts";
import { playSound } from "@/platform/sound";
import { cn, vibrate } from "@/lib/utils";
import { useWakeLock } from "./device";
import { Standings, TopRow, type P } from "./parts";

/**
 * Bombe: Wer sie hält, erklärt dem Nächsten den Begriff. Erraten → weitergeben.
 * Die Lunte kennt nur der Server (lokal das Handy) – das Handy des Hosts bzw. das eine Handy fragt jede Sekunde nach.
 */
export function BombGame({ room, game: s, me, isHost, act }: P) {
  const players = room.players;
  const local = me === null;
  const holding = local || me === s.holder;
  const next = s.order[(s.order.indexOf(s.holder ?? "") + 1) % Math.max(1, s.order.length)] ?? null;
  const ticking = s.phase === "bomb";
  useWakeLock(ticking && holding);

  // Nachfragen, ob es knallt: lokal und am Host-Handy jede halbe Sekunde, beim Halter jede Sekunde
  useEffect(() => {
    if (!ticking || (!local && !isHost && !holding)) return;
    const t = setInterval(() => act({ type: "tick" }), local || isHost ? 500 : 1000);
    return () => clearInterval(t);
  }, [ticking, local, isHost, holding, act]);
  // Ticken – gleichmäßig, damit niemand den Knall hört, bevor er kommt
  useEffect(() => {
    if (!ticking || !holding) return;
    const t = setInterval(() => playSound("place"), 900);
    return () => clearInterval(t);
  }, [ticking, holding]);
  useEffect(() => { if (s.phase === "boom" || (s.phase === "over" && s.variant === "bombe")) { playSound("error"); vibrate([300, 80, 300]); } }, [s.phase, s.variant]);

  const head = <TopRow room={room}>Runde {Math.min(s.turn + 1, s.turns)} von {s.turns} · weniger Bomben gewinnt</TopRow>;

  if (s.phase === "ready") {
    return (
      <>
        {head}
        <Panel title={<span className="flex items-center gap-2"><BombIcon className="size-6 text-destructive" />{nameOf(players, s.holder)} hat die Bombe</span>}
          sub="Wer die Bombe hält, erklärt dem Nächsten den Begriff (ohne ihn zu sagen). Erraten? Antippen und schnell weitergeben! Die Lunte ist geheim.">
          <Standings s={s} players={players} />
        </Panel>
        {(holding || isHost) && <Button size="lg" className="shrink-0" data-testid="ignite" onClick={() => act({ type: "start" })}>Lunte anzünden</Button>}
      </>
    );
  }

  if (s.phase === "boom") {
    return (
      <>
        {head}
        <Panel title={<span className="text-3xl" data-testid="boom">💥 Bumm!</span>} sub={`Die Bombe ist bei ${nameOf(players, s.holder)} hochgegangen.`}>
          <Standings s={s} players={players} />
        </Panel>
        <Button size="lg" className="shrink-0" onClick={() => act({ type: "next" })}>Nächste Runde</Button>
      </>
    );
  }

  // Die Lunte brennt
  return (
    <>
      {head}
      <div className="turn flex shrink-0 items-center gap-2 rounded-xl px-3 py-2" data-testid="holder">
        <BombIcon className="size-5 shrink-0 animate-pulse text-destructive" aria-hidden="true" />
        <span className="min-w-0 truncate text-lg font-bold">{nameOf(players, s.holder)} erklärt {nameOf(players, next)}</span>
      </div>
      {holding ? (
        <>
          <section className={cn("glass flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center")}>
            <span className="text-sm text-muted-foreground">{catName(s.cat)}</span>
            <p className="text-5xl font-black tracking-tight break-words" data-testid="bomb-word">{wordText(s.word)}</p>
            <span className="text-5xl" aria-hidden="true"><span className="inline-block animate-bounce">💣</span></span>
          </section>
          <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2">
            <Button size="lg" variant="secondary" aria-label="Anderer Begriff" onClick={() => act({ type: "swap", n: s.passes })}><RefreshCw /></Button>
            <Button size="lg" data-testid="bomb-pass" onClick={() => { vibrate(20); act({ type: "pass", n: s.passes }); }}><Check />Erraten – weitergeben</Button>
          </div>
        </>
      ) : (
        <Panel title={me === next ? "Du rätst!" : "Gleich bist du vielleicht dran …"} sub={`${nameOf(players, s.holder)} hat die Bombe. ${s.passes} Begriffe in dieser Runde.`}>
          <div className="flex flex-1 items-center justify-center text-7xl" aria-hidden="true"><span className="animate-pulse">💣</span></div>
        </Panel>
      )}
    </>
  );
}
