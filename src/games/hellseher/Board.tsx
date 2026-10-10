import { useState } from "react";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import {
  canPlay, estimateBid, forbiddenBid, leadSuit, leaders, orderFrom, points, rulesOf, SUIT_NAME, SUITS,
  type HsAction, type HsCard, type HsState, type Play,
} from "@shared/games/hellseher/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { dealDelay, Fan } from "@/platform/cards/Fan";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { HintChip } from "@/platform/HintChip";
import { PlayerRow } from "@/platform/PlayerRow";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { SmoothText } from "@/platform/SmoothText";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";
import { HS_BG, HsBack, HsCardView, SuitMark } from "./Card";

type Props = BoardProps<HsState, HsAction>;
const nameIn = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export function Board(props: Props) {
  if (props.game.phase === "over") return <Result {...props} />;
  return props.game.mode === "table" ? <TableBoard {...props} /> : <AppBoard {...props} />;
}

function Result({ room, game: s, isHost, dispatch }: Props) {
  const win = leaders(s, room.players).map((id) => nameIn(room.players, id));
  const ranking = room.players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 })).sort((a, b) => b.score - a.score);
  return <ResultScreen winner={win.join(" & ")} subtitle={`mit ${ranking[0]?.score ?? 0} Punkten nach ${s.history.length} Runden`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
}

/** Trumpf als kleines Schild: Farbpunkt und Name */
function TrumpChip({ s }: { s: HsState }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-border" data-testid="trump">
      {s.trump ? <><svg viewBox="-5 -5 10 10" className="size-3.5" aria-hidden="true"><circle r={5} fill={HS_BG[s.trump]} /><SuitMark suit={s.trump} size={0.6} /></svg>Trumpf {SUIT_NAME[s.trump]}</>
        : s.phase === "trump" ? "Trumpf wird gewählt" : "kein Trumpf"}
    </span>
  );
}

/** Ein Stich: Karten nebeneinander, darunter wer sie gespielt hat */
function Trick({ plays, players, me, winner, faded }: { plays: Play[]; players: Player[]; me: string | null; winner?: string; faded?: boolean }) {
  return (
    <div className={cn("flex max-w-full items-end justify-center gap-1.5", faded && "opacity-60")} data-testid="trick">
      {plays.map((p, i) => (
        <div key={`${p.id}-${p.card}`} className="flex w-[min(14vw,4.4rem)] min-w-0 flex-col items-center gap-1">
          <HsCardView card={p.card} className={cn("w-full", !faded && i === plays.length - 1 && "card-land", winner === p.id && "ring-[3px] ring-ice")} />
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
  const order = orderFrom(players, s.dealerId);
  const secretBid = s.phase === "bid" && !s.curId;
  // Verdeckt an einem Handy: einer nach dem anderen, in Ansage-Reihenfolge
  const secretNext = secretBid ? order.find((id) => !s.bidIn[id]) ?? null : null;
  const handoffId = local ? (secretBid ? secretNext : s.phase === "roundEnd" ? null : s.curId) : null;
  const { covered, reveal } = useHandoff(local && !!handoffId, handoffId, players.length);
  const viewer = local ? handoffId : me;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const myTurn = !!viewer && (secretBid ? !s.bidIn[viewer] && (local || me === viewer) : canAct && viewer === s.curId);
  const bidding = s.phase === "bid" && myTurn;
  const playing = s.phase === "play" && myTurn;
  const playable = (c: HsCard) => playing && canPlay(s.trick, hand, c);
  const lead = leadSuit(s.trick);
  const forbidden = bidding && viewer ? forbiddenBid(s, players, room.options, viewer) : null;
  const bidSum = players.reduce((t, p) => t + (s.bids[p.id] ?? 0), 0);
  const allIn = players.every((p) => s.bidIn[p.id]);
  const cur = nameIn(players, s.curId);
  const mine = viewer ? { bid: s.bids[viewer], got: s.tricks[viewer] ?? 0 } : null;
  const waiting = players.filter((p) => !s.bidIn[p.id]).map((p) => (p.id === me ? "dich" : p.name));

  const status = s.phase === "roundEnd" ? `Runde ${s.round} ist vorbei.`
    : covered && handoffId ? `${nameIn(players, handoffId)} ist dran.`
    : s.phase === "trump" ? (myTurn ? "Zauberer aufgedeckt – du bestimmst den Trumpf." : `Zauberer aufgedeckt – ${cur} wählt den Trumpf.`)
    : s.phase === "bid" ? (secretBid ? (myTurn ? "Wie viele Stiche machst du? (verdeckt)" : `Warte auf ${waiting.join(", ")}.`)
      : myTurn ? "Wie viele Stiche machst du?" : `${cur} sagt an.`)
    : !myTurn ? `${cur} ist dran.`
    : !s.trick.length ? `Spiel aus${mine && mine.bid !== null ? ` – angesagt ${mine.bid}, du hast ${mine.got}` : ""}.`
    : lead && hand.some((c) => c.startsWith(`${lead}-`)) ? `${SUIT_NAME[lead]} bedienen.` : "Spiel eine Karte.";

  const onBid = (n: number) => {
    vibrate(10);
    act(secretBid ? { type: "secretBid", player: viewer ?? undefined, bid: n } : { type: "bid", bid: n });
  };

  return (
    <>
      <PlayerRow>
        {order.map((id) => {
          const p = players.find((x) => x.id === id);
          if (!p) return null;
          const isCur = (s.phase === "bid" || s.phase === "play" || s.phase === "trump") && s.curId === id;
          const bid = s.bids[id];
          return (
            <div key={id} data-cur={isCur} className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-sm font-semibold", isCur ? "turn" : "glass")}>
              {online && <span className={cn("size-1.5 rounded-full", online.has(id) ? "bg-ok" : "bg-current opacity-30")} />}
              <span className="max-w-[6.5rem] truncate">{id === me ? "Du" : p.name}</span>
              {id === s.dealerId && <span className="rounded bg-current/15 px-1 text-[0.62rem] leading-4" title="Geber" aria-label="Geber">G</span>}
              <span className="tabular-nums" title="Stiche / Ansage" aria-label="Stiche / Ansage" data-testid={`bid-${id}`}>
                {s.tricks[id] ?? 0}/{bid !== null && bid !== undefined && !secretBid ? bid : s.bidIn[id] ? "✓" : "–"}
              </span>
              <span className="text-xs font-normal tabular-nums opacity-75">{s.scores[id] ?? 0}</span>
            </div>
          );
        })}
      </PlayerRow>

      {/* Runde steht oben in der Kopfzeile */}
      <div className="flex shrink-0 items-center gap-2 px-1 pt-1 text-sm whitespace-nowrap text-muted-foreground">
        <span className="sr-only" data-testid="round">Runde {s.round}/{s.totalRounds}</span>
        <TrumpChip s={s} />
        {s.phase !== "trump" && <span className="ml-auto tabular-nums" data-testid="bidsum">{allIn || !secretBid ? `${bidSum} von ${s.round} angesagt` : ""}</span>}
      </div>

      {/* Mitte: Trumpfkarte und Stich */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-1">
        {s.phase === "roundEnd" ? <RoundSummary s={s} players={players} me={me} /> : (
          <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-3">
            <div className="flex w-[min(12vw,3.2rem)] shrink-0 flex-col items-center gap-1 self-center">
              {s.trumpCard ? <HsCardView card={s.trumpCard} className="w-full" /> : <HsBack className="w-full opacity-40" />}
              <span className="text-[0.62rem] font-bold tracking-wider text-muted-foreground uppercase">Trumpf</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              {s.trick.length ? <Trick plays={s.trick} players={players} me={me} />
                : s.lastTrick ? (
                  <>
                    <Trick plays={s.lastTrick.plays} players={players} me={me} winner={s.lastTrick.winner} faded />
                    <span className="text-xs text-muted-foreground" data-testid="trick-winner">{s.lastTrick.winner === me ? "Du gewinnst" : `${nameIn(players, s.lastTrick.winner)} gewinnt`} den Stich</span>
                  </>
                ) : <span className="text-sm text-muted-foreground">{s.phase === "play" ? `${s.curId === me ? "Du spielst" : `${cur} spielt`} aus` : "Bei den Namen: Stiche / Ansage"}</span>}
            </div>
          </div>
        )}
        <div className="flex max-w-full items-center gap-2 text-sm text-muted-foreground">
          <span data-testid="status" className={cn("min-w-0", (myTurn || s.phase === "roundEnd") && "font-semibold text-foreground")}><SmoothText>{status}</SmoothText></span>
          <RulesSheet gameId={room.gameId} />
        </div>
      </div>

      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {s.phase === "roundEnd" ? (
          <Button size="lg" className="w-full" onClick={() => act({ type: "nextRound" })}>{s.round >= s.totalRounds ? "Zum Ergebnis" : `Runde ${s.round + 1} geben`}</Button>
        ) : covered && handoffId ? (
          <HandoffCover name={nameIn(players, handoffId)} onReveal={reveal} />
        ) : (
          <>
            <Fan count={hand.length}>
              {hand.map((c, i) => {
                const ok = playable(c);
                return (
                  <button key={c} type="button" disabled={!ok} data-card={c} style={dealDelay(i)} onClick={() => { vibrate(10); act({ type: "play", card: c }); }}
                    className={cn("card-in w-[min(17vw,4.8rem)] shrink-0 rounded-[11%] outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                      ok && "-translate-y-2", ok && hints && "hint-glow")}>
                    <HsCardView card={c} dim={playing && !ok} />
                  </button>
                );
              })}
            </Fan>
            {s.phase === "trump" && myTurn ? (
              <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Trumpf wählen">
                {SUITS.map((c) => (
                  <button key={c} type="button" onClick={() => { vibrate(10); act({ type: "trump", suit: c }); }} aria-label={SUIT_NAME[c]}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary text-xs font-bold ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                    <svg viewBox="-5 -5 10 10" className="size-5" aria-hidden="true"><circle r={5} fill={HS_BG[c]} /><SuitMark suit={c} size={0.6} /></svg>{SUIT_NAME[c]}
                  </button>
                ))}
              </div>
            ) : bidding ? (
              <div className="mt-2">
                {hints && <div className="mb-1.5 flex justify-center"><HintChip>Tipp: etwa {estimateBid(hand, s.trump, players.length)} {estimateBid(hand, s.trump, players.length) === 1 ? "Stich" : "Stiche"}{forbidden !== null ? ` · ${forbidden} geht nicht` : ""}</HintChip></div>}
                <div className={cn("grid gap-1.5", s.round + 1 > 7 ? "grid-cols-7" : "")} style={s.round + 1 <= 7 ? { gridTemplateColumns: `repeat(${s.round + 1}, minmax(0, 1fr))` } : undefined}
                  role="group" aria-label="Ansage">
                  {Array.from({ length: s.round + 1 }, (_, n) => (
                    <Button key={n} variant={n === forbidden ? "ghost" : "secondary"} className={cn("h-10 px-0 text-lg tabular-nums", s.round > 13 && "h-9")} disabled={n === forbidden}
                      aria-label={`${n} ansagen`} onClick={() => onBid(n)}>{n}</Button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

/** Rundenende: Ansage, Stiche und Punkte je Spieler */
function RoundSummary({ s, players, me }: { s: HsState; players: Player[]; me: string | null }) {
  const rec = s.history[s.history.length - 1];
  if (!rec) return null;
  return (
    <div className="no-scrollbar grid max-h-full w-full content-center gap-1 overflow-y-auto" data-testid="round-summary">
      <div className="grid grid-cols-[1fr_3.5rem_3.5rem_4rem] px-3 text-xs text-muted-foreground"><span /><span className="text-center">Ansage</span><span className="text-center">Stiche</span><span className="text-right">Punkte</span></div>
      {orderFrom(players, rec.dealerId).map((id) => {
        const hit = rec.bids[id] === rec.tricks[id];
        return (
          <div key={id} className="glass grid grid-cols-[1fr_3.5rem_3.5rem_4rem] items-center rounded-xl px-3 py-1.5 tabular-nums">
            <span className="truncate font-semibold">{id === me ? "Du" : nameIn(players, id)}</span>
            <span className="text-center">{rec.bids[id]}</span>
            <span className="text-center">{rec.tricks[id]}</span>
            <span className={cn("text-right font-bold", hit ? "text-ok" : "text-destructive")}>{signed(rec.points[id] ?? 0)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Zahl mit − und + (leer = „–“) */
function Stepper({ value, max, editable, label, onChange, hidden }: { value: number | null; max: number; editable: boolean; label: string; onChange: (n: number | null) => void; hidden?: boolean }) {
  const v = value ?? null;
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={label}>
      <Button variant="secondary" size="icon" className="size-9 rounded-lg" disabled={!editable || v === 0} aria-label={`${label} weniger`}
        onClick={() => { vibrate(8); onChange(v === null ? 0 : Math.max(0, v - 1)); }}><Minus className="size-4" /></Button>
      <span className="w-8 text-center text-lg font-bold tabular-nums" data-testid={`val-${label}`}>{hidden ? "✓" : v === null ? "–" : v}</span>
      <Button variant="secondary" size="icon" className="size-9 rounded-lg" disabled={!editable || (v ?? -1) >= max} aria-label={`${label} mehr`}
        onClick={() => { vibrate(8); onChange(v === null ? 0 : v + 1); }}><Plus className="size-4" /></Button>
    </div>
  );
}

/** Echte Karten: die App ist der Block – Ansagen und Stiche eintippen, sie rechnet */
function TableBoard({ room, game: s, me, isHost, online, act }: Props) {
  const players = room.players;
  const local = me === null;
  const hints = useHints();
  const r = rulesOf(room.options);
  const order = orderFrom(players, s.dealerId);
  const bidsPhase = s.phase === "tableBid";
  const [showPrev, setShowPrev] = useState(false);
  const entries = players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0 }));
  const bidMissing = players.filter((p) => !s.bidIn[p.id]).length;
  const bidSum = players.reduce((t, p) => t + (s.bids[p.id] ?? 0), 0);
  const even = bidMissing === 0 && bidSum === s.round;
  const takenMissing = players.filter((p) => s.taken[p.id] === null || s.taken[p.id] === undefined).length;
  const takenSum = players.reduce((t, p) => t + (s.taken[p.id] ?? 0), 0);
  const dealer = s.dealerId ? order[order.length - 1] : null;
  const forbidden = dealer ? forbiddenBid(s, players, room.options, dealer) : null;
  const lastRound = s.round * players.length >= 60;
  const prev = s.history[s.history.length - 1];

  const sumText = bidsPhase
    ? `${bidMissing && r.secret && !local ? `${players.length - bidMissing} von ${players.length} haben angesagt` : `${bidSum} von ${s.round} angesagt`}`
    : `${takenSum} von ${s.round} Stichen`;

  return (
    <>
      <Scoreboard entries={entries} currentId={null} me={me} online={online} />
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pt-1 text-sm text-muted-foreground">
        <span data-testid="round"><b className="text-foreground">{s.round === 1 ? "1 Karte" : `${s.round} Karten`}</b> · {nameIn(players, s.dealerId)} gibt</span>
        <RulesSheet gameId={room.gameId} />
      </div>
      <p className="shrink-0 px-1 text-sm text-muted-foreground">
        {bidsPhase ? `Ansagen eintragen – ${nameIn(players, order[0])} beginnt.${lastRound ? " Letzte Runde: ohne Trumpf." : ""}` : "Wie viele Stiche hat jeder gemacht?"}
      </p>
      <div className="no-scrollbar mt-1.5 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto">
        {order.map((id) => {
          const p = players.find((x) => x.id === id)!;
          const editable = local || isHost || id === me;
          const bid = s.bids[id];
          const got = s.taken[id];
          // Wer als Nächstes ansagt (offene Ansage reihum), ist leicht markiert
          const next = bidsPhase && !r.secret && id === order.find((x) => !s.bidIn[x]);
          return (
            <div key={id} data-next={next} className={cn("glass flex items-center gap-2 rounded-xl px-2.5 py-1", next && "ring-2 ring-inset ring-primary/45")}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{id === me ? `${p.name} (du)` : p.name}</span>
                  {id === s.dealerId && <span className="rounded bg-secondary px-1 text-[0.62rem] leading-4 text-muted-foreground ring-1 ring-inset ring-border" aria-label="Geber">G</span>}
                </div>
                {!bidsPhase && <div className="text-xs text-muted-foreground tabular-nums">Ansage {bid ?? "–"}{got !== null && got !== undefined && bid !== null && bid !== undefined ? <> · <b className={got === bid ? "text-ok" : "text-destructive"}>{signed(points(bid, got))}</b></> : null}</div>}
              </div>
              {bidsPhase
                ? <Stepper value={bid ?? null} max={s.round} editable={editable} label={`Ansage ${p.name}`} hidden={!!s.bidIn[id] && (bid === null || bid === undefined)} onChange={(n) => act({ type: "tBid", player: id, bid: n })} />
                : <Stepper value={got ?? null} max={s.round} editable={editable} label={`Stiche ${p.name}`} onChange={(n) => act({ type: "tTricks", player: id, n })} />}
            </div>
          );
        })}
        {prev && (
          <button type="button" onClick={() => setShowPrev((v) => !v)} className="glass rounded-xl px-3 py-2 text-left text-sm text-muted-foreground" aria-expanded={showPrev}>
            <span className="font-semibold">Runde {prev.round}:</span> {showPrev
              ? players.map((p) => `${p.name} ${prev.bids[p.id]}/${prev.tricks[p.id]} ${signed(prev.points[p.id] ?? 0)}`).join(" · ")
              : `${players.filter((p) => prev.bids[p.id] === prev.tricks[p.id]).length} von ${players.length} getroffen – antippen`}
          </button>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 pt-1.5 text-sm" data-testid="bidsum">
        <span className="tabular-nums text-muted-foreground">{sumText}</span>
        {bidsPhase && even && <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset", r.noEven ? "bg-destructive/15 text-destructive ring-destructive/30" : "bg-primary/12 text-ice ring-primary/35")} data-testid="even">
          {r.noEven ? "geht auf – nicht erlaubt" : "Ansagen gehen auf"}</span>}
        {bidsPhase && hints && forbidden !== null && bidMissing <= 1 && !s.bidIn[dealer!] && <HintChip>{nameIn(players, dealer)} darf nicht {forbidden} ansagen</HintChip>}
        {!bidsPhase && takenMissing === 0 && takenSum !== s.round && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">{takenSum > s.round ? `${takenSum - s.round} zu viel` : `${s.round - takenSum} fehlen`}</span>}
      </div>
      <div className="grid shrink-0 gap-2 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isHost ? bidsPhase ? (
          <Button size="lg" disabled={bidMissing > 0 || (r.noEven && even)} onClick={() => { vibrate(10); act({ type: "tBidsDone" }); }}>
            {bidMissing ? `Noch ${bidMissing} ${bidMissing === 1 ? "Ansage" : "Ansagen"}` : r.noEven && even ? "Geber muss anders ansagen" : "Ansagen fertig – spielen"}
          </Button>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button size="lg" variant="secondary" aria-label="Zurück zu den Ansagen" onClick={() => act({ type: "tBack" })}><ArrowLeft /></Button>
            <Button size="lg" disabled={takenMissing > 0 || takenSum !== s.round} onClick={() => { vibrate(10); act({ type: "tFinish" }); }}>
              {takenMissing ? `Noch ${takenMissing} ${takenMissing === 1 ? "Eintrag" : "Einträge"}` : takenSum !== s.round ? "Stiche stimmen nicht" : `Runde ${s.round} werten`}
            </Button>
          </div>
        ) : <p className="glass rounded-xl py-3 text-center text-muted-foreground">{bidsPhase ? (s.bidIn[me ?? ""] ? "Der Host startet die Runde." : "Trag deine Ansage ein.") : takenMissing ? "Trag deine Stiche ein." : "Der Host wertet die Runde."}</p>}
      </div>
    </>
  );
}

