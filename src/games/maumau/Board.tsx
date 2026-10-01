import { useState } from "react";
import { dealDelay, Fan } from "@/platform/cards/Fan";
import { PlayerRow } from "@/platform/PlayerRow";
import { DECKS, isJack, SUIT_NAME, type Card, type Suit } from "@shared/cards/deck";
import { canPlay, top, type MauMauAction, type MauMauState } from "@shared/games/maumau/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { CardBack, PlayingCard, SuitIcon } from "@/platform/cards/PlayingCard";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { ScorePad } from "@/platform/ScorePad";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { cn, vibrate } from "@/lib/utils";

/** Mau-Mau: Mitspieler oben, Stapel und Ablage in der Mitte, die eigene Hand unten. */
export function Board({ room, game: s, me, online, isHost, canAct, act, dispatch }: BoardProps<MauMauState, MauMauAction>) {
  const players = room.players;
  const local = me === null;
  const [mau, setMau] = useState(false);
  const [unter, setUnter] = useState<Card | null>(null);
  // Lokal: Hand erst zeigen, wenn der Richtige das Handy hat
  const { covered, reveal } = useHandoff(local, s.curId, players.length);

  if (s.winnerId && s.pad) {
    const winner = players.find((p) => p.id === s.winnerId);
    const ranking = players.map((p) => ({ id: p.id, name: p.name, score: s.pad!.scores[p.id] ?? 0 })).sort((a, b) => b.score - a.score);
    return <ResultScreen winner={winner?.name ?? "?"} subtitle={`hat ${s.goal} Runden gewonnen`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Siege" />;
  }
  if (s.mode === "table" && s.pad) {
    return <ScorePad pad={s.pad} players={players} me={me} isHost={isHost} online={online} act={act} gameId={room.gameId} mode="wins"
      info={`Runde ${s.pad.round} · bis ${s.goal} Siege`} hint="Ihr spielt mit echten Karten. Wer eine Runde gewinnt, wird hier angetippt." />;
  }
  if (s.winnerId) {
    const winner = players.find((p) => p.id === s.winnerId);
    const ranking = players.map((p) => ({ id: p.id, name: p.name, score: s.counts[p.id] ?? 0 })).sort((a, b) => a.score - b.score);
    return <ResultScreen winner={winner?.name ?? "?"} subtitle="hat alle Karten abgelegt – Mau-Mau!" ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Karten übrig" />;
  }

  const cur = players.find((p) => p.id === s.curId);
  const viewer = local ? s.curId : me;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const myTurn = canAct && viewer === s.curId;
  const playable = (c: Card) => myTurn && (!s.drawn || c === s.drawn) && canPlay(s, c, room.options);
  const mauRule = room.options.mau !== false;

  // Nichts passt: der Stapel leuchtet, damit klar ist, was zu tun ist
  const mustDraw = myTurn && !s.drawn && !covered && !hand.some(playable);
  const play = (c: Card, wish?: Suit) => {
    vibrate(10);
    act({ type: "play", card: c, wish, mau });
    setMau(false);
    setUnter(null);
  };
  const status = !myTurn ? `${cur?.name} ist am Zug`
    : s.drawn ? (playable(s.drawn) ? "Gezogene Karte legen – oder passen." : "Die gezogene Karte passt nicht – tippe auf Passen.")
    : s.pendingDraw ? `Leg eine Sieben oder zieh ${s.pendingDraw} Karten.`
    : hand.some(playable) ? "Leg eine passende Karte." : "Nichts passt – zieh eine Karte.";

  return (
    <>
      {/* Mitspieler mit Kartenzahl */}
      <PlayerRow>
        {players.map((p) => (
          <div key={p.id} data-cur={p.id === s.curId}
            className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold",
              p.id === s.curId ? "turn" : "glass")}>
            {online && <span className={cn("size-1.5 rounded-full", online.has(p.id) ? "bg-ok" : "bg-current opacity-30")} />}
            <span className="max-w-[7rem] truncate">{p.id === me ? "Du" : p.name}</span>
            <span className="flex items-center gap-1 tabular-nums" aria-label={`${s.counts[p.id] ?? 0} Karten`}>
              <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-navy-300/80 ring-1 ring-white/40" />{s.counts[p.id] ?? 0}
            </span>
          </div>
        ))}
      </PlayerRow>

      {/* Mitte: Stapel und Ablage */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-2">
        <div className="flex h-full max-h-60 min-h-0 w-full items-start justify-center gap-5 pt-5">
          <button type="button" disabled={!myTurn || !!s.drawn || covered} onClick={() => { vibrate(8); act({ type: "draw" }); }}
            aria-label={s.pendingDraw ? `${s.pendingDraw} Karten ziehen` : "Karte ziehen"}
            className={cn("relative h-[68%] rounded-[10%] outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default", mustDraw && "target-glow")}>
            <CardBack className="h-full">
              <span className="text-[14cqw] font-bold text-paper/85">{s.pileCount}</span>
            </CardBack>
            {s.pendingDraw > 0 && <span className="absolute -top-2 -right-2 rounded-full bg-destructive px-2 py-0.5 text-sm font-bold text-navy-950">+{s.pendingDraw}</span>}
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[0.66rem] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase">Stapel</span>
          </button>
          <div className="relative h-[86%]" key={s.discard.length}>
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[0.66rem] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase">Ablage</span>
            <PlayingCard card={top(s)} className="card-land h-full" />
            {s.wish && (
              <span className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-navy-950/90 px-2.5 py-1 text-xs font-bold whitespace-nowrap ring-1 ring-border" data-testid="wish">
                Wunsch: <SuitIcon suit={s.wish} className="size-4" />{SUIT_NAME[s.wish]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span data-testid="status" className={cn(myTurn && "font-semibold text-foreground")}><SmoothText>{status}</SmoothText></span>
          <span aria-label={s.dir === 1 ? "Richtung im Uhrzeigersinn" : "Richtung gegen den Uhrzeigersinn"}>{s.dir === 1 ? "↻" : "↺"}</span>
          <RulesSheet gameId={room.gameId} />
        </div>
      </div>

      {/* Hand */}
      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {covered ? (
          <HandoffCover name={cur?.name ?? "?"} onReveal={reveal} />
        ) : unter ? (
          <div className="glass rounded-2xl p-3">
            <p className="mb-2 text-center text-sm font-semibold">Welche Farbe wünschst du dir?</p>
            <div className="grid grid-cols-4 gap-2">
              {DECKS[s.deck].suits.map((suit) => (
                <button key={suit} type="button" onClick={() => play(unter, suit)} aria-label={SUIT_NAME[suit]}
                  className="flex flex-col items-center gap-1 rounded-xl bg-paper py-2 text-xs font-bold text-paper-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                  <SuitIcon suit={suit} className="size-8" />{SUIT_NAME[suit]}
                </button>
              ))}
            </div>
            <Button variant="ghost" className="mt-1 w-full text-muted-foreground" onClick={() => setUnter(null)}>Abbrechen</Button>
          </div>
        ) : (
          <>
            <Fan count={hand.length}>
                {hand.map((c, i) => {
                  const ok = playable(c);
                  return (
                    <button key={c} type="button" disabled={!ok} style={dealDelay(i)}
                      onClick={() => (isJack(c) ? setUnter(c) : play(c))}
                      className={cn("card-in w-[min(19vw,5rem)] shrink-0 rounded-[10%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                        ok && "-translate-y-2.5", c === s.drawn && "ring-[3px] ring-ice")}>
                      <PlayingCard card={c} dim={myTurn && !ok} />
                    </button>
                  );
                })}
            </Fan>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] gap-2 [&>button]:min-w-0 [&>button]:px-3">
              <Button variant="secondary" size="lg" disabled={!myTurn || !!s.drawn} onClick={() => act({ type: "draw" })}>
                {s.pendingDraw ? `${s.pendingDraw} ziehen` : "Ziehen"}
              </Button>
              {mauRule ? (
                <Button size="lg" variant={mau ? "ice" : "secondary"} aria-pressed={mau} disabled={!myTurn || hand.length !== 2} onClick={() => { vibrate(20); setMau((m) => !m); }}>
                  Mau!
                </Button>
              ) : <span />}
              <Button variant="secondary" size="lg" disabled={!myTurn || !s.drawn} onClick={() => act({ type: "pass" })}>Passen</Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
