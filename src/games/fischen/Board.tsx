import { useState } from "react";
import { rankOf, RANK_DATIVE, RANK_PLURAL, type Rank } from "@shared/cards/german";
import { askableRanks, leaders, type FischenAction, type FischenEvent, type FischenState } from "@shared/games/fischen/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { GermanCard } from "@/platform/cards/GermanCard";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { cn, vibrate } from "@/lib/utils";

const nameOf = (players: Player[], id: string, me: string | null) => (id === me ? "Du" : players.find((p) => p.id === id)?.name ?? "?");

function EventLine({ e, players, me, big }: { e: FischenEvent; players: Player[]; me: string | null; big?: boolean }) {
  const asker = nameOf(players, e.askerId, me);
  const target = nameOf(players, e.targetId, me);
  return (
    <li className={cn(big ? "text-base font-semibold" : "text-sm text-muted-foreground")}>
      {asker} {e.askerId === me ? "fragst" : "fragt"} {target === "Du" ? "dich" : target} nach {RANK_DATIVE[e.rank]} –{" "}
      {e.got ? <b className="text-emerald-300">{e.got} {e.got === 1 ? "Karte" : "Karten"}!</b> : <span>Geh fischen! 🎣{e.lucky && <b className="text-gold"> Glück gehabt!</b>}</span>}
      {e.quartet && <b className="text-gold"> Quartett: {RANK_PLURAL[e.quartet]}!</b>}
    </li>
  );
}

/** Fischen: Mitspieler oben, was zuletzt gefragt wurde in der Mitte, unten die eigene Hand und die Frage. */
export function Board({ room, game: s, me, online, isHost, canAct, act, dispatch }: BoardProps<FischenState, FischenAction>) {
  const players = room.players;
  const local = me === null;
  const [rank, setRank] = useState<Rank | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const { covered, reveal } = useHandoff(local, s.curId, players.length);

  if (s.finished) {
    const win = leaders(s, players).map((id) => players.find((p) => p.id === id)?.name ?? "?");
    const ranking = players.map((p) => ({ id: p.id, name: p.name, score: s.quartets[p.id]?.length ?? 0 })).sort((a, b) => b.score - a.score);
    return <ResultScreen winner={win.join(" & ")} subtitle={`mit ${ranking[0]?.score ?? 0} Quartetten`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Quartette" />;
  }

  const cur = players.find((p) => p.id === s.curId);
  const viewer = local ? s.curId : me;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const myTurn = canAct && viewer === s.curId && !covered;
  const ranks = askableRanks(hand);
  const selRank = rank && ranks.includes(rank) ? rank : null;
  const targets = players.filter((p) => p.id !== viewer && (s.counts[p.id] ?? 0) > 0);
  const selTarget = target && targets.some((p) => p.id === target) ? target : targets.length === 1 ? targets[0].id : null;
  const recent = s.events.slice(-3).reverse();
  const myQuartets = viewer ? s.quartets[viewer] ?? [] : [];

  const ask = () => {
    if (!selRank || !selTarget) return;
    vibrate(12);
    act({ type: "ask", target: selTarget, rank: selRank });
  };

  return (
    <>
      <div className="no-scrollbar -mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-1" aria-label="Mitspieler">
        {players.map((p) => (
          <div key={p.id} className={cn("flex shrink-0 flex-col rounded-xl px-3 py-1.5 text-sm",
            p.id === s.curId ? "bg-gradient-to-b from-navy-400 to-primary text-white shadow-[0_6px_18px_rgb(63_122_224/0.4)]" : "glass")}>
            <span className="flex items-center gap-1.5 font-semibold">
              {online && <span className={cn("size-1.5 rounded-full", online.has(p.id) ? "bg-emerald-400" : "bg-current opacity-30")} />}
              <span className="max-w-[6.5rem] truncate">{p.id === me ? "Du" : p.name}</span>
            </span>
            <span className={cn("text-xs tabular-nums", p.id !== s.curId && "text-muted-foreground")}>{s.counts[p.id] ?? 0} Karten · ★ {s.quartets[p.id]?.length ?? 0}</span>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 py-2">
        <section className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-3.5" aria-live="polite">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>🎣 Teich: <b className="text-foreground tabular-nums">{s.pileCount}</b> Karten</span>
            <RulesSheet gameId={room.gameId} />
          </div>
          {recent.length ? (
            <ul className="no-scrollbar mt-2 grid min-h-0 content-start gap-1.5 overflow-y-auto" data-testid="events">
              {recent.map((e, i) => <EventLine key={s.events.length - i} e={e} players={players} me={local ? null : me} big={i === 0} />)}
            </ul>
          ) : <p className="mt-2 text-muted-foreground">Noch hat niemand gefragt.</p>}
          {s.fished && viewer === s.events.at(-1)?.askerId && !covered && (
            <div className="mt-auto flex items-center gap-3 pt-2 text-sm">
              <GermanCard card={s.fished} className="w-10" />
              <span className="text-muted-foreground">Gefischt</span>
            </div>
          )}
        </section>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <span className="text-muted-foreground">{local ? "Quartette:" : "Deine Quartette:"}</span>
          {myQuartets.length ? myQuartets.map((r) => <span key={r} className="rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-gold">{RANK_PLURAL[r]}</span>)
            : <span className="text-muted-foreground">noch keine</span>}
        </div>
      </div>

      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {covered ? <HandoffCover name={cur?.name ?? "?"} onReveal={reveal} /> : (
          <>
            <div className="no-scrollbar -mx-4 flex items-end overflow-x-auto px-4 pt-3 pb-1" data-testid="hand">
              <div className="mx-auto flex items-end">
                {hand.map((c, i) => (
                  <button key={c} type="button" disabled={!myTurn} onClick={() => setRank(rankOf(c))} aria-label={`Nach ${RANK_DATIVE[rankOf(c)]} fragen`}
                    className={cn("w-[min(17vw,4.5rem)] shrink-0 rounded-[10%] outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                      i > 0 && (hand.length > 6 ? "-ml-[min(8vw,2.2rem)]" : "-ml-[min(3vw,0.8rem)]"),
                      selRank === rankOf(c) && "-translate-y-2.5", c === s.fished && "ring-[3px] ring-gold")}>
                    <GermanCard card={c} />
                  </button>
                ))}
                {!hand.length && <p className="py-6 text-sm text-muted-foreground">Keine Karten auf der Hand.</p>}
              </div>
            </div>
            {myTurn ? (
              <div className="glass mt-2 rounded-2xl p-2.5">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Wert">
                  {ranks.map((r) => (
                    <button key={r} type="button" aria-pressed={selRank === r} onClick={() => setRank(r)}
                      className={cn("h-9 rounded-lg px-2.5 text-sm font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring", selRank === r ? "bg-gold text-navy-950" : "bg-navy-700/80 ring-1 ring-inset ring-border")}>
                      {RANK_PLURAL[r]}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Mitspieler fragen">
                  {targets.map((p) => (
                    <button key={p.id} type="button" aria-pressed={selTarget === p.id} onClick={() => setTarget(p.id)}
                      className={cn("h-9 rounded-lg px-2.5 text-sm font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring", selTarget === p.id ? "bg-gold text-navy-950" : "bg-navy-700/80 ring-1 ring-inset ring-border")}>
                      {p.name}
                    </button>
                  ))}
                </div>
                <Button size="lg" className="mt-2 w-full" disabled={!selRank || !selTarget} onClick={ask}>
                  {selRank && selTarget ? `${players.find((p) => p.id === selTarget)?.name}, hast du ${RANK_PLURAL[selRank]}?` : "Wert und Mitspieler wählen"}
                </Button>
              </div>
            ) : (
              <p className="glass mt-2 rounded-xl py-4 text-center text-muted-foreground">Warte auf <b className="text-foreground">{cur?.name}</b></p>
            )}
          </>
        )}
      </div>
    </>
  );
}
