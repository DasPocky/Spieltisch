import { Fish, Layers } from "lucide-react";
import { useState } from "react";
import { DECKS, rankOf, RANK_DATIVE, RANK_PLURAL, type Card, type Rank } from "@shared/cards/deck";
import { leaders, type FischenAction, type FischenEvent, type FischenState } from "@shared/games/fischen/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { PlayingCard } from "@/platform/cards/PlayingCard";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { cn, vibrate } from "@/lib/utils";
import { TableBoard } from "./TableBoard";

const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? "?";

/** Die letzte Frage groß als Sprechblase, davor die beiden vorherigen klein */
function LastAsk({ e, players, viewer }: { e: FischenEvent; players: Player[]; viewer: string | null }) {
  const asker = e.askerId === viewer ? "Du" : nameOf(players, e.askerId);
  const target = e.targetId === viewer ? "dich" : nameOf(players, e.targetId);
  return (
    <div className="rounded-2xl bg-paper px-4 py-3 text-paper-ink shadow-lg" data-testid="last-ask">
      <div className="text-sm font-semibold text-paper-ink/60">{asker} → {target}</div>
      <div className="text-xl font-extrabold leading-tight">„Hast du {RANK_PLURAL[e.rank]}?“</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {e.got
          ? <span className="rounded-full bg-ok px-3 py-1 text-sm font-bold text-navy-950">Ja! {e.got} {e.got === 1 ? "Karte" : "Karten"}</span>
          : <span className="rounded-full bg-navy-600 px-3 py-1 text-sm font-bold text-white">Nein – geh fischen!</span>}
        {e.lucky && <span className="rounded-full bg-ice px-3 py-1 text-sm font-bold text-navy-950">Glück gehabt – nochmal!</span>}
        {e.quartet && <span className="rounded-full bg-ice px-3 py-1 text-sm font-bold text-navy-950">Quartett: {RANK_PLURAL[e.quartet]}!</span>}
      </div>
    </div>
  );
}

function OlderAsk({ e, players, viewer }: { e: FischenEvent; players: Player[]; viewer: string | null }) {
  const asker = e.askerId === viewer ? "Du" : nameOf(players, e.askerId);
  const target = e.targetId === viewer ? "dich" : nameOf(players, e.targetId);
  return (
    <li className="truncate text-sm text-muted-foreground">
      {asker} → {target}: {RANK_PLURAL[e.rank]} · {e.got ? `${e.got} bekommen` : "gefischt"}{e.quartet ? " · Quartett!" : ""}
    </li>
  );
}

/** Eine Gruppe gleicher Werte als kleiner Fächer */
function RankStack({ cards, rank, selected, disabled, fished, onPick }: { cards: Card[]; rank: Rank; selected: boolean; disabled: boolean; fished: Card | null; onPick: () => void }) {
  const step = 0.6;
  return (
    <button type="button" disabled={disabled} onClick={onPick} aria-pressed={selected} aria-label={`${RANK_PLURAL[rank]}: ${cards.length} von 4. Nach ${RANK_DATIVE[rank]} fragen`}
      className={cn("flex shrink-0 flex-col items-center rounded-2xl p-1.5 outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
        selected ? "-translate-y-1.5 bg-ice/25 ring-2 ring-ice" : "")}>
      <div className="relative h-[calc(2.7rem*1.6)]" style={{ width: `calc(2.7rem + ${(cards.length - 1) * step}rem)` }}>
        {cards.map((c, i) => (
          <div key={c} className={cn("absolute top-0 w-[2.7rem] rounded-[10%]", c === fished && "ring-[3px] ring-ice")} style={{ left: `${i * step}rem` }}>
            <PlayingCard card={c} className="card-in" />
          </div>
        ))}
      </div>
      <span className={cn("mt-1 text-xs font-bold whitespace-nowrap", selected ? "text-ice" : "text-muted-foreground")}>{RANK_PLURAL[rank]} {cards.length}/4</span>
    </button>
  );
}

/** Fischen: 1. Mitspieler antippen, 2. Wert aus der eigenen Hand antippen, 3. fragen. */
export function Board(props: BoardProps<FischenState, FischenAction>) {
  return props.game.table ? <TableBoard {...props} /> : <HandBoard {...props} />;
}

function HandBoard({ room, game: s, me, online, isHost, canAct, act, dispatch }: BoardProps<FischenState, FischenAction>) {
  const players = room.players;
  const local = me === null;
  const [rank, setRank] = useState<Rank | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const { covered, reveal } = useHandoff(local, s.curId, players.length);

  if (s.finished) {
    const win = leaders(s, players).map((id) => nameOf(players, id));
    const ranking = players.map((p) => ({ id: p.id, name: p.name, score: s.quartets[p.id]?.length ?? 0 })).sort((a, b) => b.score - a.score);
    return <ResultScreen winner={win.join(" & ")} subtitle={`mit ${ranking[0]?.score ?? 0} Quartetten`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Quartette" />;
  }

  const deck = DECKS[s.deck];
  const cur = players.find((p) => p.id === s.curId);
  const viewer = local ? s.curId : me;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const myTurn = canAct && viewer === s.curId && !covered;
  const groups = deck.ranks.map((r) => ({ rank: r, cards: hand.filter((c) => rankOf(c) === r) })).filter((g) => g.cards.length);
  const selRank = rank && groups.some((g) => g.rank === rank) ? rank : null;
  const targets = players.filter((p) => p.id !== viewer && (s.counts[p.id] ?? 0) > 0);
  const selTarget = target && targets.some((p) => p.id === target) ? target : targets.length === 1 ? targets[0].id : null;
  const last = s.events.at(-1);
  const older = s.events.slice(-7, -1).reverse();
  const myQuartets = viewer ? s.quartets[viewer] ?? [] : [];
  const viewerForText = local ? null : me;

  const ask = () => {
    if (!selRank || !selTarget) return;
    vibrate(12);
    act({ type: "ask", target: selTarget, rank: selRank });
    setRank(null);
  };

  return (
    <>
      {/* Schritt 1: Mitspieler */}
      {myTurn && <div className="shrink-0 px-1 pb-1 text-sm font-bold text-ice">1 · Wen fragst du?</div>}
      <div className="no-scrollbar -mx-4 flex shrink-0 gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Mitspieler">
        {players.filter((p) => p.id !== viewer || !myTurn).map((p) => {
          const pickable = myTurn && targets.some((t) => t.id === p.id);
          const chosen = myTurn && selTarget === p.id;
          return (
            <button key={p.id} type="button" disabled={!pickable} onClick={() => setTarget(p.id)} aria-pressed={chosen}
              className={cn("flex min-w-[6.5rem] shrink-0 flex-col items-start rounded-xl px-3 py-2 text-left text-sm outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                chosen ? "bg-ice text-navy-950" : p.id === s.curId ? "bg-gradient-to-b from-navy-400 to-primary text-white" : pickable ? "bg-navy-700/80 ring-2 ring-navy-300/60" : "glass")}>
              <span className="flex items-center gap-1.5 font-bold">
                {online && <span className={cn("size-1.5 rounded-full", online.has(p.id) ? "bg-ok" : "bg-current opacity-30")} />}
                <span className="max-w-[6rem] truncate">{p.id === me ? "Du" : p.name}</span>
              </span>
              <span className={cn("text-xs tabular-nums", !chosen && p.id !== s.curId && "text-muted-foreground")}><Layers className="inline size-3 align-[-1px]" aria-label="Karten" /> {s.counts[p.id] ?? 0} · ★ {s.quartets[p.id]?.length ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Mitte: letzte Fragen */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden py-2" aria-live="polite">
        <div className="flex shrink-0 items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Fish className="size-4" />Teich: <b className="text-foreground tabular-nums">{s.pileCount}</b></span>
          <span className="min-w-0 truncate">★ {myQuartets.length ? myQuartets.map((r) => RANK_PLURAL[r]).join(", ") : "noch kein Quartett"}</span>
          <RulesSheet gameId={room.gameId} />
        </div>
        {last ? <LastAsk e={last} players={players} viewer={viewerForText} /> : (
          <div className="glass rounded-2xl p-4 text-center text-muted-foreground">
            {myTurn ? "Du fängst an! Frag jemanden nach einem Wert, den du selbst hast." : `${cur?.name} fängt an.`}
          </div>
        )}
        {older.length > 0 && <ul className="grid min-h-0 content-start gap-1 overflow-hidden px-1">{older.map((e, i) => <OlderAsk key={i} e={e} players={players} viewer={viewerForText} />)}</ul>}
      </div>

      {/* Schritt 2: Wert aus der eigenen Hand, dann fragen */}
      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {covered ? <HandoffCover name={cur?.name ?? "?"} onReveal={reveal} /> : (
          <>
            {myTurn && <div className="px-1 text-sm font-bold text-ice">2 · Wonach fragst du? <span className="font-normal text-muted-foreground">Tippe einen Stapel an</span></div>}
            <div className="flex flex-wrap items-end justify-center gap-x-0.5 pt-2" data-testid="hand" role="group" aria-label="Wert">
              {groups.map((g) => (
                <RankStack key={g.rank} cards={g.cards} rank={g.rank} selected={myTurn && selRank === g.rank} disabled={!myTurn} fished={s.fished} onPick={() => setRank(g.rank)} />
              ))}
              {!groups.length && <p className="py-6 text-sm text-muted-foreground">Keine Karten auf der Hand.</p>}
            </div>
            {myTurn ? (
              <Button size="lg" className="mt-2 w-full" disabled={!selRank || !selTarget} onClick={ask}>
                {selRank && selTarget ? `${nameOf(players, selTarget)}, hast du ${RANK_PLURAL[selRank]}?` : !selTarget ? "Erst oben einen Mitspieler antippen" : "Jetzt einen Stapel antippen"}
              </Button>
            ) : (
              <p className="glass mt-2 rounded-xl py-4 text-center text-muted-foreground">Warte auf <b className="text-foreground">{cur?.name}</b></p>
            )}
          </>
        )}
      </div>
    </>
  );
}
