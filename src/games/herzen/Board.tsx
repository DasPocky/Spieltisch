import { useEffect, useRef, useState } from "react";
import { canPlay, DIR_NAME, leaders, passTarget, suggestCard, suggestPass, whyNot, type HzAction, type HzState, type Play } from "@shared/games/herzen/logic";
import type { Card } from "@shared/cards/deck";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { dealDelay, Fan } from "@/platform/cards/Fan";
import { PlayingCard } from "@/platform/cards/PlayingCard";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { Seats } from "@/platform/Seats";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { speak } from "@/platform/speech";
import { narration } from "./narration";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";

type Props = BoardProps<HzState, HzAction>;
const nameIn = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";

export function Board(props: Props) {
  useNarration(props);
  if (props.game.phase === "over") return <Result {...props} />;
  return <AppBoard {...props} />;
}

function Result({ room, game: s, isHost, dispatch }: Props) {
  const win = leaders(s, room.players).map((id) => nameIn(room.players, id));
  const ranking = room.players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 })).sort((a, b) => a.score - b.score);
  return <ResultScreen winner={win.join(" & ")} subtitle={`mit nur ${ranking[0]?.score ?? 0} Punkten nach ${s.history.length} ${s.history.length === 1 ? "Runde" : "Runden"}`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
}

function useNarration({ game: s, me, isHost, room }: Props) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<HzState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => nameIn(room.players, id));
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

/** Ein Stich: Karten nebeneinander, darunter wer sie gespielt hat */
function Trick({ plays, players, me, winner, faded }: { plays: Play[]; players: Player[]; me: string | null; winner?: string; faded?: boolean }) {
  return (
    <div className={cn("flex max-w-full items-end justify-center gap-1.5", faded && "opacity-60")} data-testid="trick">
      {plays.map((p, i) => (
        <div key={`${p.id}-${p.card}`} className="flex w-[min(14vw,4.4rem)] min-w-0 flex-col items-center gap-1">
          <PlayingCard card={p.card} className={cn("w-full", !faded && i === plays.length - 1 && "card-land", winner === p.id && "rounded-[10%] ring-[3px] ring-ice")} />
          <span className={cn("w-full truncate text-center text-[0.68rem] leading-tight", winner === p.id ? "font-bold text-foreground" : "text-muted-foreground")}>{p.id === me ? "Du" : nameIn(players, p.id)}</span>
        </div>
      ))}
    </div>
  );
}

function AppBoard({ room, game: s, me, online, canAct, act }: Props) {
  const players = room.players;
  const local = me === null;
  const hints = useHints();
  // Weitergeben an einem Handy: einer nach dem anderen in Sitzreihenfolge
  const passNext = s.phase === "pass" ? players.find((p) => !s.passIn[p.id])?.id ?? null : null;
  const handoffId = local ? (s.phase === "pass" ? passNext : s.phase === "play" ? s.curId : null) : null;
  const { covered, reveal } = useHandoff(local && !!handoffId, handoffId, players.length);
  const viewer = local ? handoffId : me;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const passing = s.phase === "pass" && !!viewer && !s.passIn[viewer];
  const myTurn = s.phase === "play" && !!viewer && viewer === s.curId && (local || canAct);
  const [sel, setSel] = useState<Card[]>([]);
  useEffect(() => setSel([]), [viewer, s.round, s.phase]);
  const playable = (c: Card) => myTurn && canPlay(s, hand, c, room.options);
  const received = viewer && s.trickNo === 0 ? s.received[viewer] ?? [] : [];
  const tip = hints && myTurn ? suggestCard(s, hand, room.options) : null;
  const target = viewer && s.dir !== "none" ? passTarget(players, viewer, s.dir) : null;
  const cur = nameIn(players, s.curId);
  const waiting = players.filter((p) => !s.passIn[p.id]).map((p) => (p.id === me ? "dich" : p.name));

  const status = s.phase === "roundEnd" ? `Runde ${s.round} ist vorbei.`
    : covered && handoffId ? `${nameIn(players, handoffId)} ist dran.`
    : s.phase === "pass" ? (passing ? `Drei Karten für ${nameIn(players, target)} wählen.` : `Warte auf ${waiting.join(", ")}.`)
    : !myTurn ? `${cur} ist dran.`
    : !s.trick.length ? (s.trickNo === 0 ? "Spiel die Kreuz-Zwei aus." : s.heartsBroken ? "Spiel aus." : "Spiel aus – Herz ist noch nicht gebrochen.")
    : hand.some((c) => canPlay(s, hand, c, room.options) && c.startsWith(`${s.trick[0].card.split("-")[0]}-`)) ? "Bedien die Farbe." : "Du kannst nicht bedienen – wirf ab.";

  const toggle = (c: Card) => {
    vibrate(8);
    setSel((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : xs.length >= 3 ? [...xs.slice(1), c] : [...xs, c]));
  };
  const onCard = (c: Card) => {
    if (passing) return toggle(c);
    if (!playable(c)) return;
    vibrate(10);
    act({ type: "play", card: c });
  };

  return (
    <>
      <Seats me={me} online={online} seats={players.map((p) => ({
        id: p.id, name: p.name,
        cur: s.phase === "play" && s.curId === p.id,
        value: <span title="Punkte diese Runde" aria-label="Punkte diese Runde" data-testid={`taken-${p.id}`}>{s.taken[p.id] ?? 0}</span>,
        sub: <>{s.phase === "pass" && s.passIn[p.id] && <span className="mr-1" aria-label="hat weitergegeben">✓</span>}{s.scores[p.id] ?? 0} Pkt.</>,
      }))} />

      <div className="flex shrink-0 items-center gap-2 px-1 pt-1 text-sm whitespace-nowrap text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", s.heartsBroken ? "bg-[#a8454f]/15 text-[#a8454f] ring-[#a8454f]/35" : "bg-secondary ring-border")} data-testid="hearts">
          <svg viewBox="0 0 10 10" className="size-3" aria-hidden="true"><path d="M5 9 C 1 6, 0 3.5, 1.6 2 C 3 .8, 4.5 1.6, 5 3 C 5.5 1.6, 7 .8, 8.4 2 C 10 3.5, 9 6, 5 9 Z" fill="currentColor" /></svg>
          {s.heartsBroken ? "Herz gebrochen" : "Herz noch zu"}
        </span>
        <span className="ml-auto tabular-nums" data-testid="round">Runde {s.round}{s.phase === "play" ? ` · Stich ${s.trickNo + 1}` : s.phase === "pass" ? ` · ${DIR_NAME[s.dir]}` : ""}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-1">
        {s.phase === "roundEnd" ? <RoundSummary s={s} players={players} me={me} /> : (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1.5">
            {s.phase === "pass" ? (
              <div className="glass max-w-xs rounded-2xl px-4 py-2 text-center text-sm text-muted-foreground" data-testid="pass-info">
                <b className="block text-base text-foreground">Drei Karten {DIR_NAME[s.dir]}</b>
                <span className="block [@media(max-height:700px)]:hidden">{s.passIn[viewer ?? ""] ? `Deine Karten liegen bereit für ${nameIn(players, target)}.` : "Am besten: Pik-Dame, hohe Pik und hohe Herzen loswerden."}</span>
                <span className="block text-xs">{players.filter((p) => s.passIn[p.id]).length} von {players.length} fertig</span>
              </div>
            ) : s.trick.length ? <Trick plays={s.trick} players={players} me={me} />
              : s.lastTrick ? (
                <>
                  <Trick plays={s.lastTrick.plays} players={players} me={me} winner={s.lastTrick.winner} faded />
                  <span className="text-xs text-muted-foreground" data-testid="trick-winner">
                    {s.lastTrick.winner === me ? "Du nimmst" : `${nameIn(players, s.lastTrick.winner)} nimmt`} den Stich{s.lastTrick.points ? ` – ${s.lastTrick.points} ${s.lastTrick.points === 1 ? "Punkt" : "Punkte"}` : ""}
                  </span>
                </>
              ) : <span className="text-sm text-muted-foreground">{s.curId === me ? "Du spielst" : `${cur} spielt`} die Kreuz-Zwei aus</span>}
          </div>
        )}
        <div className="flex max-w-full items-center gap-2 text-sm text-muted-foreground">
          <span data-testid="status" className={cn("min-w-0", (myTurn || passing || s.phase === "roundEnd") && "font-semibold text-foreground")}><SmoothText>{status}</SmoothText></span>
          <RulesSheet gameId={room.gameId} />
        </div>
      </div>

      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {s.phase === "roundEnd" ? (
          <Button size="lg" className="w-full" onClick={() => act({ type: "nextRound" })}>Runde {s.round + 1} geben</Button>
        ) : covered && handoffId ? (
          <HandoffCover name={nameIn(players, handoffId)} onReveal={reveal} />
        ) : (
          <>
            {received.length > 0 && s.phase === "play" && <p className="text-center text-xs text-muted-foreground" data-testid="received">Bekommen: markierte Karten</p>}
            <Fan count={hand.length}>
              {hand.map((c, i) => {
                const ok = passing || playable(c);
                const chosen = sel.includes(c);
                return (
                  <button key={c} type="button" disabled={!ok} data-card={c} style={dealDelay(i)} onClick={() => onCard(c)}
                    aria-pressed={passing ? chosen : undefined} title={myTurn && !ok ? whyNot(s, hand, c, room.options) ?? undefined : undefined}
                    className={cn("card-in shrink-0 rounded-[10%] outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                      hand.length <= 8 ? "w-[min(19vw,5.4rem)]" : "w-[min(17vw,4.8rem)]",
                      myTurn && ok && "-translate-y-2", chosen && "-translate-y-4 ring-[3px] ring-primary", received.includes(c) && "ring-2 ring-ice",
                      tip === c && "hint-glow")}>
                    <PlayingCard card={c} dim={myTurn && !ok} />
                  </button>
                );
              })}
            </Fan>
            {passing && (
              <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
                {hints ? <Button size="lg" variant="secondary" onClick={() => setSel(suggestPass(hand))}>Vorschlag</Button> : <span />}
                <Button size="lg" disabled={sel.length !== 3} data-testid="pass-go"
                  onClick={() => { vibrate(10); act({ type: "pass", cards: sel, player: viewer ?? undefined }); setSel([]); }}>
                  {sel.length === 3 ? `An ${nameIn(players, target)} geben` : `Noch ${3 - sel.length} ${3 - sel.length === 1 ? "Karte" : "Karten"} wählen`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Rundenende: geholte Punkte, angerechnet und Gesamtstand */
function RoundSummary({ s, players, me }: { s: HzState; players: Player[]; me: string | null }) {
  const rec = s.history[s.history.length - 1];
  if (!rec) return null;
  return (
    <div className="no-scrollbar grid max-h-full w-full content-center gap-1 overflow-y-auto" data-testid="round-summary">
      {rec.moon && <p className="mb-1 text-center font-semibold" data-testid="moon">{rec.moon === me ? "Du schießt" : `${nameIn(players, rec.moon)} schießt`} den Mond!</p>}
      <div className="grid grid-cols-[1fr_3.5rem_4rem] px-3 text-xs text-muted-foreground"><span /><span className="text-center">Runde</span><span className="text-right">Gesamt</span></div>
      {players.slice().sort((a, b) => (s.scores[a.id] ?? 0) - (s.scores[b.id] ?? 0)).map((p) => (
        <div key={p.id} className="glass grid grid-cols-[1fr_3.5rem_4rem] items-center rounded-xl px-3 py-1.5 tabular-nums">
          <span className="truncate font-semibold">{p.id === me ? "Du" : p.name}</span>
          <span className={cn("text-center font-bold", (rec.points[p.id] ?? 0) === 0 ? "text-ok" : "text-destructive")}>+{rec.points[p.id] ?? 0}</span>
          <span className="text-right font-bold">{s.scores[p.id] ?? 0}</span>
        </div>
      ))}
      <p className="mt-1 text-center text-xs text-muted-foreground">Ende bei {s.target} Punkten – wenig ist gut</p>
    </div>
  );
}
