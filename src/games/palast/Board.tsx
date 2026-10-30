import { useEffect, useRef, useState } from "react";
import { rankOf, type Card, type Rank } from "@shared/cards/deck";
import {
  canPlayAny, fits, needOf, RANKS, rankWord, rulesOf, sourceOf, standings, suggestMove, suggestUp,
  type PalastAction, type PalastState,
} from "@shared/games/palast/logic";
import type { Options, Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { dealDelay, Fan } from "@/platform/cards/Fan";
import { CardBack, PlayingCard } from "@/platform/cards/PlayingCard";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { Seats } from "@/platform/Seats";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { speak } from "@/platform/speech";
import { narration } from "./narration";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";

type Props = BoardProps<PalastState, PalastAction>;
const nameIn = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";

export function Board(props: Props) {
  useNarration(props);
  if (props.game.phase === "over") return <Result {...props} />;
  return <AppBoard {...props} />;
}

function Result({ room, game: s, isHost, dispatch }: Props) {
  const players = room.players;
  const n = players.length;
  const ranking = standings(s, players).map((x) => ({
    id: x.id, name: nameIn(players, x.id), score: n + 1 - x.place, place: x.place,
    text: x.guard ? "Palastwache" : s.out.includes(x.id) ? "fertig" : `${x.left} Karten`,
  }));
  const winner = s.out[0] ?? ranking[0]?.id;
  return (
    <ResultScreen winner={nameIn(players, winner)} subtitle={s.guard ? `${nameIn(players, s.guard)} hält die Palastwache` : "als Erste ohne Karten"}
      ranking={ranking} isHost={isHost} dispatch={dispatch} />
  );
}

function useNarration({ game: s, me, isHost, room }: Props) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<PalastState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => nameIn(room.players, id), rulesOf(room.options).seven);
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players, room.options]);
}

/** „7 oder niedriger“, „ab Dame“, „alles erlaubt“ */
function needText(s: PalastState, o: Options): string {
  const need = needOf(s, o);
  if (!need) return s.discard.length ? "Neustart: alles erlaubt" : "Alles erlaubt";
  if (need.max) return "7 oder niedriger";
  return `${rankWord(need.min!)} oder höher`;
}

/** Ablage: die obersten Karten leicht aufgefächert, damit man gleiche hintereinander sieht */
function Discard({ cards, total, burned }: { cards: Card[]; total: number; burned: boolean }) {
  return (
    <div className="relative flex h-full items-center" data-testid="discard" aria-label={`Ablage: ${total} Karten`}>
      {cards.length ? cards.map((c, i) => (
        <div key={`${i}-${c}-${total}`} className={cn("h-[100cqh] w-[62.5cqh] shrink-0", i > 0 && "-ml-[44cqh]", i === cards.length - 1 && "card-land")} style={{ zIndex: i }}>
          <PlayingCard card={c} className="w-full" />
        </div>
      )) : (
        <div className={cn("grid h-[100cqh] w-[62.5cqh] place-items-center rounded-[10%] border-2 border-dashed text-center text-xs font-semibold", burned ? "border-[#c0662b]/60 text-[#c0662b]" : "border-border text-muted-foreground")} data-testid="discard-empty">
          {burned ? <span className="flex flex-col items-center gap-0.5"><Flame className="size-6" />verbrannt</span> : "leer"}
        </div>
      )}
      {total > 0 && <span className="absolute -right-2 -bottom-1 z-10 rounded-full bg-secondary px-1.5 text-[0.65rem] font-bold tabular-nums ring-1 ring-border" data-testid="discard-count">{total}</span>}
    </div>
  );
}

function Flame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2 C 13 6, 18 8, 18 14 A 6 6 0 0 1 6 14 C 6 11, 8 9.5, 9 8 C 9.5 10, 10.5 11, 11.5 11 C 11 8, 11 5, 12 2 Z" fill="currentColor" />
      <path d="M12 12 C 12.5 14, 15 15, 15 17 A 3 3 0 0 1 9 17 C 9 15.5, 11 14.5, 12 12 Z" fill="#f3c66b" />
    </svg>
  );
}

/** Ein Tischplatz: verdeckte Karte, darauf (leicht versetzt) die offene */
function Slot({ up, down, onUp, onDown, upSel, upOk, downOk, className, testId }: {
  up?: Card; down: boolean; onUp?: () => void; onDown?: () => void; upSel?: boolean; upOk?: boolean; downOk?: boolean; className?: string; testId?: string;
}) {
  return (
    <div className={cn("relative aspect-[5/8.6]", className)} data-testid={testId}>
      {down ? (
        <button type="button" disabled={!onDown} onClick={onDown} aria-label="Verdeckte Tischkarte aufdecken" data-testid="down-card"
          className={cn("absolute inset-x-0 bottom-0 rounded-[10%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default", downOk && "hint-glow -translate-y-1")}>
          <CardBack className="w-full" />
        </button>
      ) : !up && <div className="absolute inset-x-0 bottom-0 aspect-[5/8] rounded-[10%] border border-dashed border-border/70" />}
      {up && (
        <button type="button" disabled={!onUp} onClick={onUp} aria-pressed={onUp ? !!upSel : undefined} data-card={up} data-testid="up-card"
          className={cn("absolute inset-x-0 top-0 rounded-[10%] outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
            upSel && "-translate-y-2 ring-[3px] ring-primary")}>
          <PlayingCard card={up} dim={upOk === false} />
        </button>
      )}
    </div>
  );
}

/** Hand nach Werten gebündelt – die Farbe zählt nicht, so passt auch ein großer aufgenommener Stapel ohne Scrollen */
function groups(cards: Card[]): { rank: Rank; cards: Card[] }[] {
  return RANKS.map((rank) => ({ rank, cards: cards.filter((c) => rankOf(c) === rank) })).filter((g) => g.cards.length);
}

function AppBoard({ room, game: s, me, online, canAct, act }: Props) {
  const players = room.players;
  const o = room.options;
  const local = me === null;
  const hints = useHints();
  const swapNext = s.phase === "swap" ? players.find((p) => !s.ready[p.id])?.id ?? null : null;
  const handoffId = local ? (s.phase === "swap" ? swapNext : s.phase === "play" ? s.curId : null) : null;
  const { covered, reveal } = useHandoff(local && !!handoffId, handoffId, players.length);
  const viewer = local ? handoffId : me;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const up = viewer ? s.up[viewer] ?? [] : [];
  const downLeft = viewer ? s.downLeft[viewer] ?? [] : [];
  const swapping = s.phase === "swap" && !!viewer && !s.ready[viewer];
  const myTurn = s.phase === "play" && !!viewer && viewer === s.curId && (local || canAct);
  const src = viewer && s.phase === "play" ? sourceOf(s, viewer) : null;
  const isOut = !!viewer && s.out.includes(viewer);

  // Auswahl beim Legen: ein Wert und wie viele davon
  const [sel, setSel] = useState<{ rank: Rank; n: number } | null>(null);
  // Tauschen: gewählte Hand- bzw. offene Karte (Index)
  const [pick, setPick] = useState<{ hand: number | null; up: number | null }>({ hand: null, up: null });
  useEffect(() => { setSel(null); setPick({ hand: null, up: null }); }, [viewer, s.n, s.phase]);

  const from = src === "hand" ? hand : src === "up" ? up : [];
  const tip = hints && myTurn ? suggestMove(s, viewer!, o) : null;
  const tipRank = tip?.type === "play" ? rankOf(tip.cards[0]) : null;
  const nothing = myTurn && (src === "hand" || src === "up") && !canPlayAny(s, viewer!, o);
  const cur = nameIn(players, s.curId);
  const waiting = players.filter((p) => !s.ready[p.id]).map((p) => (p.id === me ? "dich" : p.name));

  const status = covered && handoffId ? `${nameIn(players, handoffId)} ist dran.`
    : s.phase === "swap" ? (swapping ? "Tausche Hand- und offene Karten: je eine antippen." : `Warte auf ${waiting.join(", ")}.`)
    : isOut ? `Du bist fertig – Platz ${s.out.indexOf(viewer!) + 1}. ${cur} ist dran.`
    : !myTurn ? `${cur} ist dran.`
    : src === "down" ? "Deck blind eine verdeckte Karte auf."
    : nothing ? "Nichts passt – nimm den Stapel auf."
    : src === "up" ? "Leg von deinen offenen Tischkarten."
    : sel ? `${sel.n}× ${rankWord(sel.rank)} gewählt.` : "Wähle Karten zum Legen.";

  const choose = (rank: Rank, count: number) => {
    vibrate(8);
    // erneut antippen: eine weniger, bei null abgewählt
    setSel((x) => (x?.rank === rank ? (x.n > 1 ? { rank, n: x.n - 1 } : null) : { rank, n: count }));
  };
  const lay = () => {
    if (!sel) return;
    const cards = from.filter((c) => rankOf(c) === sel.rank).slice(0, sel.n);
    vibrate(12);
    act({ type: "play", cards });
    setSel(null);
  };

  const arrangeSwap = (hi: number, ui: number) => {
    const nextUp = up.slice();
    const nextHand = hand.slice();
    [nextUp[ui], nextHand[hi]] = [nextHand[hi], nextUp[ui]];
    vibrate(10);
    act({ type: "arrange", up: nextUp, player: viewer ?? undefined });
    setPick({ hand: null, up: null });
  };
  const pickSwap = (kind: "hand" | "up", i: number) => {
    const next = { ...pick, [kind]: pick[kind] === i ? null : i };
    if (next.hand !== null && next.up !== null) arrangeSwap(next.hand, next.up);
    else { vibrate(6); setPick(next); }
  };

  const needPill = s.phase === "play" ? needText(s, o) : "Tauschen";
  const sevenOn = !!needOf(s, o)?.max;

  return (
    <>
      <Seats me={me} online={online} seats={players.map((p) => {
        const place = s.out.indexOf(p.id);
        const ups = (s.up[p.id] ?? []).map((c) => rankOf(c)).join(" ");
        const downs = (s.downLeft[p.id] ?? []).filter(Boolean).length;
        return {
          id: p.id, name: p.name, cur: s.phase === "play" && s.curId === p.id, out: place >= 0,
          label: `${p.name}: ${s.counts[p.id] ?? 0} Handkarten, offen ${ups || "keine"}, ${downs} verdeckt`,
          value: place >= 0 ? <span data-testid={`place-${p.id}`}>{place + 1}.</span> : <span title="Handkarten" data-testid={`count-${p.id}`}>{s.counts[p.id] ?? 0}</span>,
          sub: place >= 0 ? "fertig" : <>{s.phase === "swap" && s.ready[p.id] && <span className="mr-0.5" aria-label="fertig getauscht">✓</span>}{ups || "–"}{downs ? <span className="opacity-70"> ·{downs}▾</span> : null}</>,
        };
      })} />

      <div className="flex shrink-0 items-center gap-2 px-1 pt-1 text-sm whitespace-nowrap text-muted-foreground">
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
          sevenOn ? "bg-[#2a5cbf]/15 text-[#2a5cbf] ring-[#2a5cbf]/35" : "bg-secondary ring-border")} data-testid="need">{needPill}</span>
        <span className="ml-auto tabular-nums" data-testid="pile-info">{s.burned.length ? `verbrannt ${s.burned.length}` : s.phase === "play" ? `Ablage ${s.discard.length}` : ""}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 py-1">
        {s.phase === "swap" ? (
          <div className="glass max-w-xs rounded-2xl px-4 py-2 text-center text-sm text-muted-foreground [@media(max-height:600px)]:hidden" data-testid="swap-info">
            <b className="block text-base text-foreground">Tauschen vor dem Start</b>
            Starke Karten (2, 10, Ass, König) liegen besser offen – die spielst du erst am Schluss.
            <span className="block text-xs">{players.filter((p) => s.ready[p.id]).length} von {players.length} fertig</span>
          </div>
        ) : <>
        <div className="flex h-[min(12rem,26dvh)] min-h-0 w-full items-center justify-center gap-6 [container-type:size]" data-testid="piles">
          <div className="relative h-full shrink-0" aria-label={`Nachziehstapel: ${s.pileCount} Karten`}>
            {s.pileCount ? <CardBack className="w-[62.5cqh]"><span className="text-[22cqw] font-bold text-white/80 tabular-nums">{s.pileCount}</span></CardBack>
              : <div className="grid h-[100cqh] w-[62.5cqh] place-items-center rounded-[10%] border-2 border-dashed border-border text-xs text-muted-foreground">leer</div>}
          </div>
          <Discard cards={s.discard.slice(-4)} total={s.discard.length} burned={!!s.last?.burn && !s.discard.length} />
        </div>
        </>}
        <div className="flex max-w-full items-center gap-2 text-sm text-muted-foreground">
          <span data-testid="status" className={cn("min-w-0", (myTurn || swapping) && "font-semibold text-foreground")}><SmoothText>{status}</SmoothText></span>
          <RulesSheet gameId={room.gameId} />
        </div>
      </div>

      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {covered && handoffId ? (
          <HandoffCover name={nameIn(players, handoffId)} onReveal={reveal} />
        ) : !viewer ? null : s.phase === "swap" ? (
          <SwapArea hand={hand} up={up} downLeft={downLeft} pick={pick} onPick={pickSwap} active={swapping}
            onSuggest={hints && swapping ? () => act({ type: "arrange", up: suggestUp(hand, up), player: viewer ?? undefined }) : undefined}
            onReady={() => { vibrate(10); act({ type: "ready", player: viewer ?? undefined }); }} />
        ) : isOut ? (
          <p className="glass rounded-2xl p-3 text-center text-sm text-muted-foreground" data-testid="done">Du hast alle Karten los – schau den anderen zu.</p>
        ) : (
          <>
            {src === "hand" ? (
              <>
                <div className="flex items-end justify-center gap-1.5" data-testid="my-table" aria-label="Deine Tischkarten">
                  {downLeft.map((d, i) => <Slot key={i} up={up[i]} down={d} className="w-[min(9vw,2.3rem)]" />)}
                  <span className="ml-1 self-center text-[0.68rem] leading-tight text-muted-foreground">Tisch-<br />karten</span>
                </div>
                <HandFan hand={hand} sel={sel} myTurn={myTurn} tipRank={tipRank} ok={(r) => fits(s, r, o)} onPick={choose} />
              </>
            ) : (
              <div className="flex items-end justify-center gap-2 pt-3 pb-1" data-testid="my-table" aria-label="Deine Tischkarten">
                {downLeft.map((d, i) => {
                  const c = up[i];
                  const okUp = !!c && myTurn && src === "up" && fits(s, rankOf(c), o);
                  return (
                    <Slot key={i} up={c} down={d} className="w-[min(21vw,5.2rem)]" testId={`slot-${i}`}
                      upSel={!!c && sel?.rank === rankOf(c)} upOk={myTurn && src === "up" ? okUp : undefined} downOk={myTurn && src === "down" && d && tip?.type === "blind" && tip.i === i}
                      onUp={okUp ? () => { const all = up.filter((x) => rankOf(x) === rankOf(c)).length; choose(rankOf(c), all); } : undefined}
                      onDown={myTurn && src === "down" && d ? () => { vibrate(14); act({ type: "blind", i }); } : undefined} />
                  );
                })}
              </div>
            )}
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              {src === "down" ? (
                <Button size="lg" className="col-span-2" disabled={!myTurn} data-testid="blind-go"
                  onClick={() => { const i = downLeft.findIndex(Boolean); if (i >= 0) { vibrate(14); act({ type: "blind", i }); } }}>
                  {myTurn ? "Blind aufdecken" : `${cur} ist dran`}
                </Button>
              ) : (
                <>
                  <Button size="lg" className="min-w-0 truncate px-3 whitespace-nowrap" disabled={!myTurn || !sel} data-testid="play-go" onClick={lay}>
                    {!myTurn ? `${cur} ist dran` : sel ? `${sel.n}× ${rankWord(sel.rank)} legen` : "Legen"}
                  </Button>
                  <Button size="lg" variant={nothing ? "default" : "secondary"} disabled={!nothing} data-testid="take"
                    className={cn("px-3",nothing && tip?.type === "take" && "hint-glow")} onClick={() => { vibrate(14); act({ type: "take" }); }}>
                    Aufnehmen
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Die Hand: je Wert eine Karte mit Anzahl. Antippen wählt alle dieses Werts, nochmal antippen eine weniger. */
function HandFan({ hand, sel, myTurn, tipRank, ok, onPick }: {
  hand: Card[]; sel: { rank: Rank; n: number } | null; myTurn: boolean; tipRank: Rank | null; ok: (r: Rank) => boolean; onPick: (r: Rank, n: number) => void;
}) {
  const gs = groups(hand);
  const width = gs.length <= 6 ? "w-[min(19vw,5.2rem)]" : gs.length <= 9 ? "w-[min(17vw,4.6rem)]" : "w-[min(15vw,4.2rem)]";
  return (
    <Fan count={gs.length} rows={false} minShow={0.3} className="pt-2.5">
      {gs.map((g, i) => {
        const can = myTurn && ok(g.rank);
        const chosen = sel?.rank === g.rank;
        return (
          <button key={g.rank} type="button" disabled={!can} data-card={g.cards[0]} data-rank={g.rank} style={dealDelay(i)} onClick={() => onPick(g.rank, g.cards.length)}
            aria-pressed={can ? chosen : undefined} aria-label={`${g.cards.length}× ${rankWord(g.rank)}`}
            className={cn("card-in relative shrink-0 rounded-[10%] outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default", width,
              can && "-translate-y-1.5", chosen && "-translate-y-3.5 ring-[3px] ring-primary", tipRank === g.rank && !chosen && "hint-glow")}>
            {g.cards.length > 1 && <span className="absolute inset-0 translate-x-[3px] -translate-y-[3px] rounded-[10%] bg-paper ring-1 ring-black/15" aria-hidden="true" />}
            <PlayingCard card={g.cards[0]} dim={myTurn && !can} className="relative" />
            {g.cards.length > 1 && (
              <span className={cn("absolute bottom-[6%] left-[6%] rounded-full px-1 text-[0.7rem] font-bold leading-tight tabular-nums shadow", chosen ? "bg-primary text-primary-foreground" : "bg-foreground text-background")} data-testid="group-count">
                {chosen && sel!.n < g.cards.length ? `${sel!.n}/${g.cards.length}` : `×${g.cards.length}`}
              </span>
            )}
          </button>
        );
      })}
    </Fan>
  );
}

/** Tauschen vor dem Start: oben die offenen Tischkarten, unten die Hand – je eine antippen tauscht sie */
function SwapArea({ hand, up, downLeft, pick, onPick, onSuggest, onReady, active }: {
  hand: Card[]; up: Card[]; downLeft: boolean[]; pick: { hand: number | null; up: number | null };
  onPick: (kind: "hand" | "up", i: number) => void; onSuggest?: () => void; onReady: () => void; active: boolean;
}) {
  return (
    <div className="grid gap-1" data-testid="swap">
      <div className="flex items-end justify-center gap-2">
        <span className="w-12 self-center text-right text-[0.68rem] leading-tight text-muted-foreground">offen auf dem Tisch</span>
        {downLeft.map((d, i) => (
          <Slot key={i} up={up[i]} down={d} className="w-[min(17vw,4.4rem)]" testId={`swap-up-${i}`}
            upSel={pick.up === i} onUp={active ? () => onPick("up", i) : undefined} />
        ))}
        <span className="w-12" />
      </div>
      <div className="flex items-end justify-center gap-2 pt-2">
        <span className="w-12 self-center text-right text-[0.68rem] leading-tight text-muted-foreground">auf der Hand</span>
        {hand.map((c, i) => (
          <button key={`${i}-${c}`} type="button" disabled={!active} onClick={() => onPick("hand", i)} aria-pressed={active ? pick.hand === i : undefined} data-card={c} data-testid={`swap-hand-${i}`}
            className={cn("w-[min(17vw,4.4rem)] shrink-0 rounded-[10%] outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default", pick.hand === i && "-translate-y-2 ring-[3px] ring-primary")}>
            <PlayingCard card={c} />
          </button>
        ))}
        <span className="w-12" />
      </div>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-2">
        {onSuggest ? <Button size="lg" variant="secondary" onClick={onSuggest} data-testid="swap-suggest">Vorschlag</Button> : <span />}
        <Button size="lg" disabled={!active} onClick={onReady} data-testid="swap-ready">{active ? "Fertig" : "Warte auf die anderen"}</Button>
      </div>
    </div>
  );
}

