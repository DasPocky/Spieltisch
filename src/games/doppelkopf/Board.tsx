import { useEffect, useRef, useState } from "react";
import {
  callName, canPlay, contractName, isSolo, keyOf, knownParties, needOf, needText, nextCall, partyOf, reserveWhyNot, shownCard, SOLO_HINT, SOLOS,
  suggestCall, suggestCard, suggestReserve, viewFor, whyNot, type DkAction, type DkState, type Party, type Play, type Reserve,
} from "@shared/games/doppelkopf/logic";
import type { Card } from "@shared/cards/deck";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { useCountdown } from "@/platform/Countdown";
import { dealDelay, Fan } from "@/platform/cards/Fan";
import { PlayingCard } from "@/platform/cards/PlayingCard";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { HintChip } from "@/platform/HintChip";
import { Seats } from "@/platform/Seats";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { speak } from "@/platform/speech";
import { narration } from "./narration";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";

type Props = BoardProps<DkState, DkAction>;
const partyName = (p: Party) => (p === "re" ? "Re" : "Kontra");

export function Board(props: Props) {
  useNarration(props);
  useTimeUp(props);
  if (props.game.phase === "over") return <Result {...props} />;
  return <AppBoard {...props} />;
}

function Result({ room, game: s, isHost, dispatch }: Props) {
  const ranking = s.seats.map((id) => ({ id, name: s.names[id] ?? "?", score: s.scores[id] ?? 0 })).sort((a, b) => b.score - a.score);
  const top = ranking[0]?.score ?? 0;
  const win = ranking.filter((r) => r.score === top).map((r) => r.name);
  void room;
  return <ResultScreen winner={win.join(" & ")} subtitle={`mit ${top} Punkten nach ${s.history.length} ${s.history.length === 1 ? "Runde" : "Runden"}`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
}

function useNarration({ game: s, me, isHost, room }: Props) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<DkState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => (id ? s.names[id] ?? "?" : "?"), room.options);
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.options]);
}

/** Zugzeit um: jedes Handy meldet es (der Host sofort, die anderen etwas später) – gezählt wird nur das erste */
function useTimeUp({ game: s, isHost, act }: Props) {
  const deadline = s.phase === "play" || s.phase === "reserve" ? s.deadline : null;
  const delay = isHost ? 0 : 1800;
  useEffect(() => {
    if (deadline === null) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      act({ type: "timeUp" });
      iv = setInterval(() => act({ type: "timeUp" }), 3000);
    }, Math.max(0, deadline - Date.now()) + delay);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [deadline, delay, act]);
}

/** Ein Stich: Karten nebeneinander, darunter wer sie gespielt hat */
function Trick({ plays, s, me, winner, faded, pictures }: { plays: Play[]; s: DkState; me: string | null; winner?: string; faded?: boolean; pictures: Record<string, unknown> }) {
  return (
    <div className={cn("flex max-w-full items-end justify-center gap-1.5", faded && "opacity-60")} data-testid="trick">
      {plays.map((p, i) => (
        <div key={`${p.id}-${i}`} className="flex w-[min(15vw,4.4rem)] min-w-0 flex-col items-center gap-1">
          <PlayingCard card={shownCard(p.card, pictures as never)} className={cn("w-full", !faded && i === plays.length - 1 && "card-land", winner === p.id && "rounded-[10%] ring-[3px] ring-ice")} />
          <span className={cn("w-full truncate text-center text-[0.68rem] leading-tight", winner === p.id ? "font-bold text-foreground" : "text-muted-foreground")}>{p.id === me ? "Du" : s.names[p.id] ?? "?"}</span>
        </div>
      ))}
    </div>
  );
}

function AppBoard({ room, game: s, me, online, canAct, act }: Props) {
  const local = me === null;
  const o = room.options;
  const hints = useHints();
  const turnPhase = s.phase === "reserve" || s.phase === "play";
  const handoffId = local && turnPhase ? s.curId : null;
  const { covered, reveal } = useHandoff(local && !!handoffId, handoffId, room.players.length);
  const viewer = local ? handoffId : me;
  const v = viewer ? viewFor(s, viewer) : s;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const myTurn = turnPhase && !!viewer && viewer === s.curId && (local || canAct) && !(local && covered);
  const known = knownParties(v, viewer);
  const mine = viewer ? known[viewer] : undefined;
  const [soloOpen, setSoloOpen] = useState(false);
  useEffect(() => setSoloOpen(false), [viewer, s.round, s.phase]);
  const playable = (c: Card) => myTurn && s.phase === "play" && canPlay(s, hand, c);
  const tip = hints && myTurn && s.phase === "play" && viewer ? suggestCard(v, viewer) : null;
  const tipReserve = hints && myTurn && s.phase === "reserve" && viewer ? suggestReserve(v, viewer, o) : null;
  const call = viewer && !(local && covered) && (!local || viewer === s.curId) ? nextCall(s, viewer, o) : null;
  const callTip = hints && call && viewer ? suggestCall(v, viewer, o) === call : false;
  const left = useCountdown(turnPhase ? s.deadline : null, false);
  const cur = s.curId === me ? "Du bist" : `${s.names[s.curId ?? ""] ?? "?"} ist`;
  const last = s.tricks.at(-1);
  const lead = s.trick[0]?.card;

  const status = s.phase === "roundEnd" ? `Runde ${s.round} ist vorbei.`
    : covered && handoffId ? `${s.names[handoffId]} ist dran.`
    : s.phase === "reserve" ? (myTurn ? "Gesund oder Vorbehalt?" : `${cur} dran – gesund oder Vorbehalt?`)
    : !myTurn ? `${cur} dran.`
    : !lead ? "Spiel aus."
    : !hand.some((c) => keyOf(c, s.contract) === keyOf(lead, s.contract)) ? "Du kannst nicht bedienen – frei spielen."
    : keyOf(lead, s.contract) === "trumpf" ? "Trumpf bedienen." : "Farbe bedienen.";

  const onCard = (c: Card) => {
    if (!playable(c)) return;
    vibrate(10);
    act({ type: "play", card: c });
  };
  const reserve = (what: Reserve) => { vibrate(10); act({ type: "reserve", what }); };
  const doCall = () => { if (call && viewer) { vibrate(14); act({ type: "call", level: call, player: local ? viewer : undefined }); } };

  const seatSub = (id: string) => {
    if (s.phase === "reserve") return s.said[id] === "gesund" ? "gesund" : s.said[id] === "vorbehalt" ? "Vorbehalt" : "…";
    const p = known[id];
    const lv = s.callBy[id];
    if (lv && p) return callName(p, lv);
    if (s.soloist === id && (isSolo(s.contract) || s.contract === "hochzeit")) return s.contract === "hochzeit" ? "Hochzeit" : "Solo";
    return p ? partyName(p) : "?";
  };
  const shownOnline = online ? new Set([...online, ...s.ghosts]) : null;

  return (
    <>
      <Seats me={viewer ?? me} online={shownOnline} seats={s.seats.map((id) => ({
        id, name: s.names[id] ?? "?",
        cur: turnPhase && s.curId === id,
        label: `${s.names[id]}: ${s.tricks.filter((t) => t.winner === id).length} Stiche, ${s.scores[id] ?? 0} Punkte`,
        value: <span title="Stiche" data-testid={`tricks-${id}`}>{s.tricks.filter((t) => t.winner === id).length}</span>,
        sub: <span data-testid={`seat-note-${id}`} className={cn(known[id] === "re" && "font-semibold text-foreground")}>{seatSub(id)} · {s.scores[id] ?? 0}</span>,
      }))} />

      <div className="flex shrink-0 items-center gap-1.5 px-1 pt-0.5 text-sm whitespace-nowrap text-muted-foreground">
        <span className={cn("inline-flex min-w-0 items-center truncate rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
          s.contract && s.contract !== "normal" ? "bg-[#a8454f]/15 text-[#a8454f] ring-[#a8454f]/35" : "bg-secondary ring-border")} data-testid="contract">
          {s.contract ? `${contractName(s.contract, o)}${s.soloist && s.contract !== "normal" ? ` · ${s.soloist === viewer ? "du" : s.names[s.soloist]}` : ""}` : "Vorbehalte"}
        </span>
        {mine && s.phase === "play" && (
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground ring-1 ring-inset ring-border" data-testid="my-party"
            title={`${partyName(mine)} braucht ${needText(needOf(s.calls, mine))}`}>
            {partyName(mine)} · {needText(needOf(s.calls, mine)).replace(" Augen", "")}
          </span>
        )}
        {left !== null && (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-inset", left <= 10 ? "bg-destructive/15 text-destructive ring-destructive/40" : "bg-secondary ring-border")} data-testid="turn-timer"
            aria-label={`Zugzeit: noch ${left} Sekunden`}>{left}s</span>
        )}
        <span className="ml-auto tabular-nums" data-testid="round">R {s.round}/{s.total}{s.phase === "play" ? ` · Stich ${Math.min(s.tricks.length + 1, s.handSize)}` : ""}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 py-1">
        {s.phase === "roundEnd" ? <RoundSummary s={s} me={me} /> : s.phase === "reserve" ? (
          myTurn ? (
            <div className="grid w-full max-w-sm gap-1.5" data-testid="reserve">
              {!soloOpen ? (
                <>
                  <Button size="lg" onClick={() => reserve("gesund")} className={cn(tipReserve === "gesund" && "hint-glow")}>Gesund</Button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant="secondary" disabled={!!reserveWhyNot(s, viewer!, "hochzeit", o)} onClick={() => reserve("hochzeit")} className={cn(tipReserve === "hochzeit" && "hint-glow")}>Hochzeit</Button>
                    <Button variant="secondary" disabled={o.solos === false} onClick={() => setSoloOpen(true)} className={cn(tipReserve && isSolo(tipReserve) && "hint-glow")} data-testid="solo-open">Solo …</Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground [@media(max-height:600px)]:hidden">Hochzeit nur mit beiden Kreuz-Damen – das erste angemeldete Solo gilt.</p>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-1" data-testid="solo-list">
                  {SOLOS.map((id) => (
                    <button key={id} type="button" onClick={() => reserve(id)} title={SOLO_HINT[id]}
                      className={cn("glass rounded-xl px-2 py-1.5 text-left text-sm leading-tight font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring", tipReserve === id && "hint-glow")}>
                      {contractName(id, o)}<span className="block truncate text-[0.68rem] font-normal text-muted-foreground">{SOLO_HINT[id]}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => setSoloOpen(false)} className="rounded-xl px-2 py-1.5 text-sm text-muted-foreground underline-offset-2 hover:underline">Zurück</button>
                </div>
              )}
            </div>
          ) : (
            <div className="glass max-w-xs rounded-2xl px-4 py-2 text-center text-sm text-muted-foreground" data-testid="reserve-wait">
              <b className="block text-base text-foreground">Vorbehalte</b>
              {s.seats.filter((id) => s.said[id]).length} von 4 haben gesagt
            </div>
          )
        ) : s.trick.length ? <Trick plays={s.trick} s={s} me={viewer} pictures={o} />
          : last ? (
            <>
              <Trick plays={last.plays} s={s} me={viewer} winner={last.winner} faded pictures={o} />
              <span className="text-xs text-muted-foreground" data-testid="trick-winner">
                {last.winner === viewer ? "Du nimmst" : `${s.names[last.winner]} nimmt`} den Stich – {last.augen} Augen
              </span>
            </>
          ) : <span className="text-sm text-muted-foreground">{s.curId === viewer ? "Du spielst" : `${s.names[s.curId ?? ""]} spielt`} aus</span>}
        <div className="flex max-w-full items-center gap-2 text-sm text-muted-foreground">
          <span data-testid="status" className={cn("min-w-0", (myTurn || s.phase === "roundEnd") && "font-semibold text-foreground")}><SmoothText>{status}</SmoothText></span>
          <RulesSheet gameId={room.gameId} />
        </div>
      </div>

      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {s.phase === "roundEnd" ? (
          <Button size="lg" className="w-full" onClick={() => act({ type: "nextRound" })}>Runde {s.round + 1} geben</Button>
        ) : covered && handoffId ? (
          <HandoffCover name={s.names[handoffId] ?? "?"} onReveal={reveal} />
        ) : (
          <>
            <div className="flex h-8 items-center justify-center gap-2">
              {call && mine && (
                <Button size="sm" variant={call === 1 ? "default" : "secondary"} onClick={doCall} data-testid="call" className={cn(callTip && "hint-glow")}>
                  {call === 1 ? `${partyName(mine)} ansagen` : `${callName(mine, call).replace(/^./, (x) => x.toUpperCase())} absagen`}
                </Button>
              )}
              {tip && !call && <HintChip>Tipp: die markierte Karte</HintChip>}
            </div>
            <Fan count={hand.length}>
              {hand.map((c, i) => {
                const ok = playable(c);
                return (
                  <button key={`${c}-${i}`} type="button" disabled={!ok} data-card={c} style={dealDelay(i)} onClick={() => onCard(c)}
                    title={myTurn && s.phase === "play" && !ok ? whyNot(s, hand, c) ?? undefined : undefined}
                    className={cn("card-in shrink-0 rounded-[10%] outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                      hand.length <= 8 ? "w-[min(19vw,5.4rem)]" : "w-[min(17vw,4.8rem)]",
                      ok && "-translate-y-2", tip === c && hand.indexOf(c) === i && "hint-glow")}>
                    <PlayingCard card={shownCard(c, o)} dim={myTurn && s.phase === "play" && !ok} />
                  </button>
                );
              })}
            </Fan>
          </>
        )}
      </div>
    </>
  );
}

/** Rundenende: wer gewinnt, Augen, Wertung Zeile für Zeile, Punkte und Stand */
function RoundSummary({ s, me }: { s: DkState; me: string | null }) {
  const rec = s.history[s.history.length - 1];
  if (!rec) return null;
  const team = (p: Party) => s.seats.filter((id) => partyOf(rec, id) === p).map((id) => (id === me ? "du" : s.names[id])).join(" & ");
  return (
    <div className="grid w-full content-center gap-1 overflow-hidden" data-testid="round-summary">
      <p className="text-center font-semibold" data-testid="round-winner">
        {rec.winner ? `${partyName(rec.winner)} gewinnt` : "Keiner gewinnt"} <span className="font-normal text-muted-foreground">– {contractName(rec.contract)}{rec.alone ? " (allein)" : ""}</span>
      </p>
      <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
        {(["re", "kontra"] as Party[]).map((p) => (
          <div key={p} className={cn("glass rounded-xl px-2 py-1", rec.winner === p && "ring-2 ring-ok/60")}>
            <b className="block text-sm">{partyName(p)}{rec.calls[p] ? ` · ${callName(p, rec.calls[p])}` : ""}</b>
            <span className="block truncate text-muted-foreground">{team(p)}</span>
            <b className="block text-base tabular-nums" data-testid={`augen-${p}`}>{rec.augen[p]} Augen</b>
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 px-1 text-xs text-muted-foreground" data-testid="lines">
        {rec.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-1"><span className="truncate">{l.label}{l.party !== rec.winner ? ` (${partyName(l.party)})` : ""}</span><b className="tabular-nums text-foreground">{l.party === "re" ? "+" : "−"}{l.pts}</b></li>
        ))}
      </ul>
      <p className="text-center text-xs text-muted-foreground">Spielwert {Math.abs(rec.value)} für {rec.value >= 0 ? "Re" : "Kontra"}{rec.alone ? " – Solist dreifach" : ""}</p>
      <div className="grid grid-cols-4 gap-1 text-center tabular-nums">
        {s.seats.map((id) => (
          <div key={id} className="glass min-w-0 rounded-xl px-1 py-1">
            <span className="block truncate text-xs">{id === me ? "Du" : s.names[id]}</span>
            <b className={cn("block", (rec.points[id] ?? 0) > 0 ? "text-ok" : (rec.points[id] ?? 0) < 0 ? "text-destructive" : "")}>{(rec.points[id] ?? 0) > 0 ? "+" : ""}{rec.points[id] ?? 0}</b>
            <span className="block text-xs text-muted-foreground">{s.scores[id] ?? 0}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Runde {s.round} von {s.total}</p>
    </div>
  );
}
