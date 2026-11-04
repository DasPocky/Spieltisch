import { useEffect, useRef, useState } from "react";
import {
  bidOptions, BIDS, canPlay, declareWhyNot, gameName, gameValueOf, KINDS, kindName, keyOf, leadKey, modeOf, nextBid, openHand, positionOf, shownCard, spitzen,
  suggestBid, suggestCard, suggestDiscard, suggestGame, suggestSkat, viewFor, whyNot, type Game, type Kind, type Play, type SkAction, type SkState,
} from "@shared/games/skat/logic";
import type { Card } from "@shared/cards/deck";
import type { Options } from "@shared/platform/types";
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
import { narration, recordName } from "./narration";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";

type Props = BoardProps<SkState, SkAction>;

export function Board(props: Props) {
  useNarration(props);
  useTimeUp(props);
  if (props.game.phase === "over") return <Result {...props} />;
  return <AppBoard {...props} />;
}

function Result({ game: s, isHost, dispatch }: Props) {
  const ranking = s.seats.map((id) => ({ id, name: s.names[id] ?? "?", score: s.scores[id] ?? 0 })).sort((a, b) => b.score - a.score);
  const top = ranking[0]?.score ?? 0;
  const win = ranking.filter((r) => r.score === top).map((r) => r.name);
  return <ResultScreen winner={win.join(" & ")} subtitle={`mit ${top} Punkten nach ${s.history.length} ${s.history.length === 1 ? "Spiel" : "Spielen"}`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
}

function useNarration({ game: s, me, isHost, room }: Props) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<SkState | null>(null);
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
  const deadline = s.phase !== "roundEnd" && s.phase !== "over" ? s.deadline : null;
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
function Trick({ plays, s, me, winner, faded, o }: { plays: Play[]; s: SkState; me: string | null; winner?: string; faded?: boolean; o: Options }) {
  return (
    <div className={cn("flex max-w-full items-end justify-center gap-2", faded && "opacity-60")} data-testid="trick">
      {plays.map((p, i) => (
        <div key={`${p.id}-${i}`} className="flex w-[min(24vw,14dvh,7rem)] min-w-0 flex-col items-center gap-1">
          <PlayingCard card={shownCard(p.card, o)} className={cn("w-full", !faded && i === plays.length - 1 && "card-land", winner === p.id && "rounded-[10%] ring-[3px] ring-ice")} />
          <span className={cn("w-full truncate text-center text-[0.68rem] leading-tight", winner === p.id ? "font-bold text-foreground" : "text-muted-foreground")}>{p.id === me ? "Du" : s.names[p.id] ?? "?"}</span>
        </div>
      ))}
    </div>
  );
}

const Wait = ({ title, children, testId }: { title: string; children?: React.ReactNode; testId?: string }) => (
  <div className="glass max-w-xs rounded-2xl px-4 py-2 text-center text-sm text-muted-foreground" data-testid={testId}>
    <b className="block text-base text-foreground">{title}</b>
    {children}
  </div>
);

function AppBoard({ room, game: s, me, online, canAct, act }: Props) {
  const local = me === null;
  const o = room.options;
  const hints = useHints();
  const turnPhase = s.phase !== "roundEnd" && s.phase !== "over";
  const handoffId = local && turnPhase ? s.curId : null;
  const { covered, reveal } = useHandoff(local && !!handoffId, handoffId, room.players.length);
  const viewer = local ? handoffId : me;
  const v = viewer ? viewFor(s, viewer) : s;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const myTurn = turnPhase && !!viewer && viewer === s.curId && (local || canAct) && !(local && covered);
  const [picked, setPicked] = useState<Card[]>([]);
  useEffect(() => { setPicked([]); }, [viewer, s.round, s.phase]);
  const mode = modeOf(s);
  const playable = (c: Card) => myTurn && s.phase === "play" && canPlay(s, hand, c);
  const tip = hints && myTurn && s.phase === "play" && viewer ? suggestCard(v, viewer) : null;
  const tipDiscard = hints && myTurn && s.phase === "discard" && viewer ? suggestDiscard(v, viewer) : null;
  const left = useCountdown(turnPhase ? s.deadline : null, false);
  const name = (id: string | null | undefined) => (id === viewer ? "du" : s.names[id ?? ""] ?? "?");
  const Name = (id: string | null | undefined) => (id === viewer ? "Du" : s.names[id ?? ""] ?? "?");
  const last = s.tricks.at(-1);
  const lead = leadKey(s);
  const declarerHand = openHand(s) && s.declarer && s.declarer !== viewer ? s.hands[s.declarer] ?? [] : null;

  const status = s.phase === "roundEnd" ? `Spiel ${s.round} ist vorbei.`
    : covered && handoffId ? `${s.names[handoffId]} ist dran.`
    : s.phase === "bid" ? (myTurn ? "Reizen: sagen, halten oder passen." : `${Name(s.curId)} ${s.curId === viewer ? "bist" : "ist"} beim Reizen dran.`)
    : s.phase === "skat" ? (myTurn ? "Skat aufnehmen oder Hand spielen?" : `${Name(s.declarer)} überlegt: Skat oder Hand?`)
    : s.phase === "discard" ? (myTurn ? "Zwei Karten drücken." : `${Name(s.declarer)} drückt.`)
    : s.phase === "declare" ? (myTurn ? "Spiel ansagen." : `${Name(s.declarer)} sagt das Spiel an.`)
    : !myTurn ? `${Name(s.curId)} ${s.curId === viewer ? "bist" : "ist"} dran.`
    : !lead ? "Spiel aus."
    : !hand.some((c) => keyOf(c, mode) === lead) ? "Du kannst nicht bedienen – frei spielen."
    : lead === "trumpf" ? "Trumpf bedienen." : "Farbe bedienen.";

  const onCard = (c: Card) => {
    if (s.phase === "discard" && myTurn) {
      vibrate(8);
      setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : p.length >= 2 ? [p[1], c] : [...p, c]));
      return;
    }
    if (!playable(c)) return;
    vibrate(10);
    act({ type: "play", card: c });
  };

  const tricksOf = (id: string) => s.tricks.filter((t) => t.winner === id).length;
  const seatSub = (id: string) => {
    if (!s.active.includes(id)) return "gibt";
    if (s.phase === "bid") return s.said[id] ?? positionOf(s, id);
    if (s.phase === "roundEnd") return "Punkte";
    if (s.declarer === id && !s.ramsch) return "Alleinspieler";
    return positionOf(s, id);
  };
  const shownOnline = online ? new Set([...online, ...s.ghosts]) : null;
  const chip = s.phase === "bid" ? `Reizen${s.bidding?.value ? ` · ${s.bidding.value}` : ""}`
    : s.ramsch ? "Ramsch"
    : s.game ? `${gameName(s.game, o)} · ${name(s.declarer)}`
    : `${name(s.declarer)} · gereizt ${s.bid}`;

  return (
    <>
      <Seats me={viewer ?? me} online={shownOnline} seats={s.seats.map((id) => ({
        id, name: s.names[id] ?? "?",
        cur: turnPhase && s.curId === id,
        out: !s.active.includes(id),
        label: `${s.names[id]}: ${tricksOf(id)} Stiche, ${s.scores[id] ?? 0} Punkte`,
        value: <span data-testid={`seat-value-${id}`}>{s.phase === "play" ? tricksOf(id) : s.scores[id] ?? 0}</span>,
        sub: <span data-testid={`seat-note-${id}`} className={cn(s.declarer === id && !s.ramsch && s.phase !== "bid" && "font-semibold text-foreground")}>{seatSub(id)}</span>,
      }))} />

      <div className="flex shrink-0 items-center gap-1.5 px-1 pt-0.5 text-sm whitespace-nowrap text-muted-foreground">
        <span className={cn("inline-flex min-w-0 items-center truncate rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
          s.game || s.ramsch ? "bg-[#a8454f]/15 text-[#a8454f] ring-[#a8454f]/35" : "bg-secondary ring-border")} data-testid="contract">{chip}</span>
        {s.phase === "play" && s.bid > 0 && !s.ramsch && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs ring-1 ring-inset ring-border" data-testid="bid-value">gereizt {s.bid}</span>}
        {left !== null && (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-inset", left <= 10 ? "bg-destructive/15 text-destructive ring-destructive/40" : "bg-secondary ring-border")} data-testid="turn-timer"
            aria-label={`Zugzeit: noch ${left} Sekunden`}>{left}s</span>
        )}
        <span className="ml-auto tabular-nums" data-testid="round">{s.phase === "play" ? `Stich ${Math.min(s.tricks.length + 1, 10)}/10` : `Spiel ${s.round}/${s.total}`}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 py-1">
        {s.phase === "roundEnd" ? <RoundSummary s={s} me={me} o={o} />
          : s.phase === "bid" ? <BidPanel s={s} v={v} viewer={viewer} myTurn={myTurn} hints={hints} act={act} name={name} Name={Name} />
          : s.phase === "skat" ? (myTurn ? (
            <div className="grid w-full max-w-sm gap-1.5" data-testid="skat-choice">
              <p className="text-center text-sm text-muted-foreground">Du hast das Spiel bei <b className="text-foreground">{s.bid}</b>.</p>
              <Button size="lg" onClick={() => { vibrate(10); act({ type: "skat", take: true }); }} className={cn(hints && viewer && suggestSkat(v, viewer) && "hint-glow")}>Skat aufnehmen</Button>
              <Button variant="secondary" onClick={() => { vibrate(10); act({ type: "skat", take: false }); }} className={cn(hints && viewer && !suggestSkat(v, viewer) && "hint-glow")}>Hand spielen</Button>
            </div>
          ) : <Wait title={`${Name(s.declarer)} hat das Spiel bei ${s.bid}`} testId="skat-wait">Skat aufnehmen oder Hand?</Wait>)
          : s.phase === "discard" ? (myTurn ? (
            <div className="grid w-full max-w-sm justify-items-center gap-1.5" data-testid="discard">
              <div className="flex gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="grid w-[min(16vw,9dvh,4.5rem)] place-items-center">
                    {picked[i] ? <PlayingCard card={shownCard(picked[i], o)} className="w-full" />
                      : <div className="aspect-[5/7] w-full rounded-[10%] border-2 border-dashed border-border" />}
                  </div>
                ))}
              </div>
              <Button size="lg" className="w-full" disabled={picked.length !== 2} data-testid="discard-go"
                onClick={() => { vibrate(10); act({ type: "discard", cards: picked }); }}>{picked.length === 2 ? "Diese zwei drücken" : `Noch ${2 - picked.length} ${picked.length === 1 ? "Karte" : "Karten"} antippen`}</Button>
            </div>
          ) : <Wait title={`${Name(s.declarer)} hat den Skat`} testId="discard-wait">und drückt zwei Karten …</Wait>)
          : s.phase === "declare" ? (myTurn && viewer ? <Declare s={v} me={viewer} o={o} hints={hints} act={act} /> : <Wait title={`${Name(s.declarer)} sagt an`} testId="declare-wait">gereizt bis {s.bid}</Wait>)
          : (
            <>
              {declarerHand && (
                <div className="flex max-w-full flex-wrap justify-center gap-0.5" data-testid="open-hand" aria-label={`Offene Karten von ${s.names[s.declarer!]}`}>
                  {declarerHand.map((c) => <PlayingCard key={c} card={shownCard(c, o)} className="w-[min(8vw,5dvh,2.2rem)]" />)}
                </div>
              )}
              {s.trick.length ? <Trick plays={s.trick} s={s} me={viewer} o={o} />
                : last ? (
                  <>
                    <Trick plays={last.plays} s={s} me={viewer} winner={last.winner} faded o={o} />
                    <span className="text-xs text-muted-foreground" data-testid="trick-winner">{last.winner === viewer ? "Du nimmst" : `${s.names[last.winner]} nimmt`} den Stich – {last.augen} Augen</span>
                  </>
                ) : <span className="text-sm text-muted-foreground">{s.curId === viewer ? "Du spielst" : `${s.names[s.curId ?? ""]} spielt`} aus</span>}
            </>
          )}
        <div className="flex max-w-full items-center gap-2 text-sm text-muted-foreground">
          <span data-testid="status" className={cn("min-w-0", (myTurn || s.phase === "roundEnd") && "font-semibold text-foreground")}><SmoothText>{status}</SmoothText></span>
          <RulesSheet gameId={room.gameId} />
        </div>
      </div>

      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {s.phase === "roundEnd" ? (
          <Button size="lg" className="w-full" onClick={() => act({ type: "nextRound" })}>Spiel {s.round + 1} geben</Button>
        ) : covered && handoffId ? (
          <HandoffCover name={s.names[handoffId] ?? "?"} onReveal={reveal} />
        ) : !s.active.includes(viewer ?? "") ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="sitting-out">Du gibst und sitzt dieses Spiel aus.</p>
        ) : (
          <>
            {(tip || tipDiscard) && (
              <div className="flex h-7 items-center justify-center gap-2">
                {tip && <HintChip>Tipp: die markierte Karte</HintChip>}
                {tipDiscard && <HintChip>Tipp: die markierten Karten drücken</HintChip>}
              </div>
            )}
            <Fan count={hand.length}>
              {hand.map((c, i) => {
                const choosing = myTurn && s.phase === "discard";
                const ok = choosing || playable(c);
                const sel = choosing && picked.includes(c);
                return (
                  <button key={`${c}-${i}`} type="button" disabled={!ok} data-card={c} style={dealDelay(i)} onClick={() => onCard(c)} aria-pressed={choosing ? sel : undefined}
                    title={myTurn && s.phase === "play" && !ok ? whyNot(s, hand, c) ?? undefined : undefined}
                    className={cn("card-in shrink-0 rounded-[10%] outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                      hand.length <= 10 ? "w-[min(18vw,5.2rem)]" : "w-[min(17vw,4.8rem)]",
                      ok && !choosing && "-translate-y-2", sel && "-translate-y-3 ring-[3px] ring-ice",
                      (tip === c || tipDiscard?.includes(c)) && "hint-glow")}>
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

/** Reizen: wer wem sagt, der aktuelle Wert – am Zug: sagen (auch springen), ja oder passe */
function BidPanel({ s, v, viewer, myTurn, hints, act, name, Name }: {
  s: SkState; v: SkState; viewer: string | null; myTurn: boolean; hints: boolean; act: (a: SkAction) => void;
  name: (id: string | null | undefined) => string; Name: (id: string | null | undefined) => string;
}) {
  const b = s.bidding;
  if (!b) return null;
  const opt = bidOptions(s, viewer);
  const tip = hints && myTurn && viewer ? suggestBid(v, viewer) : null;
  const glow = (a: SkAction) => tip && tip.type === a.type && (a.type !== "bid" || (tip.type === "bid" && tip.value === a.value)) ? "hint-glow" : "";
  const send = (a: SkAction) => { vibrate(10); act(a); };
  const head = b.stage === 3 ? `${Name(b.bidder)}: alle haben gepasst`
    : b.value ? `${Name(b.bidder)} ${b.bidder === viewer ? "sagst" : "sagt"} ${name(b.listener) === "du" ? "dir" : name(b.listener)}: ${b.value}`
    : `${Name(b.bidder)} ${b.bidder === viewer ? "sagst" : "sagt"} ${b.listener === viewer ? "dir" : name(b.listener)}`;
  const jumps = opt.say !== null && b.stage !== 3 ? BIDS.filter((x) => x > opt.say!).slice(0, 3) : [];
  return (
    <div className="grid w-full max-w-sm gap-1.5" data-testid="bid">
      <div className="glass rounded-2xl px-3 py-1.5 text-center">
        <span className="block text-xs text-muted-foreground" data-testid="bid-head">{head}</span>
        <b className="block text-3xl tabular-nums" data-testid="bid-current">{b.value || "–"}</b>
      </div>
      {myTurn && opt.hold && (
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="secondary" size="lg" onClick={() => send({ type: "pass" })} className={glow({ type: "pass" })}>Passe</Button>
          <Button size="lg" onClick={() => send({ type: "hold" })} className={glow({ type: "hold" })}>Ja</Button>
        </div>
      )}
      {myTurn && opt.say !== null && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="secondary" size="lg" onClick={() => send({ type: "pass" })} className={glow({ type: "pass" })}>Passe</Button>
            <Button size="lg" onClick={() => send({ type: "bid", value: opt.say! })} className={glow({ type: "bid", value: opt.say! })} data-testid="bid-say">
              {b.stage === 3 ? "18 spielen" : `${opt.say} sagen`}
            </Button>
          </div>
          {jumps.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground" data-testid="bid-jumps">
              <span>oder</span>
              {jumps.map((x) => (
                <button key={x} type="button" onClick={() => send({ type: "bid", value: x })}
                  className="glass min-w-10 rounded-full px-2.5 py-1 text-sm font-semibold text-foreground tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{x}</button>
              ))}
            </div>
          )}
        </>
      )}
      {!myTurn && <p className="text-center text-xs text-muted-foreground">{nextBid(b.value) && b.stage !== 3 ? `Nächster Reizwert: ${b.asked === "listener" ? b.value : nextBid(b.value)}` : ""}</p>}
    </div>
  );
}

/** Spielwahl: Spielart mit Wert, beim Handspiel Ansagen, dann ansagen */
function Declare({ s, me, o, hints, act }: { s: SkState; me: string; o: Options; hints: boolean; act: (a: SkAction) => void }) {
  const tip = hints ? suggestGame(s, me) : null;
  const [kind, setKind] = useState<Kind>(() => suggestGame(s, me).kind);
  const [ann, setAnn] = useState<{ schneider: boolean; schwarz: boolean; ouvert: boolean }>({ schneider: false, schwarz: false, ouvert: false });
  const hand = !s.tookSkat;
  const cards = [...(s.hands[me] ?? []), ...(hand ? [] : s.skat)];
  const gameOf = (k: Kind): Game => k === "null"
    ? { kind: k, hand, schneider: false, schwarz: false, ouvert: ann.ouvert }
    : { kind: k, hand, schneider: hand && (ann.schneider || ann.schwarz || ann.ouvert), schwarz: hand && (ann.schwarz || ann.ouvert), ouvert: hand && ann.ouvert };
  const valueOf = (k: Kind) => gameValueOf(gameOf(k), k === "null" ? 0 : spitzen(cards, k));
  const g = gameOf(kind);
  const why = declareWhyNot(s, g);
  const value = valueOf(kind);
  const toggle = (k: keyof typeof ann) => setAnn((a) => ({ ...a, [k]: !a[k] }));
  const Toggle = ({ k, label, disabled }: { k: keyof typeof ann; label: string; disabled?: boolean }) => (
    <button type="button" aria-pressed={ann[k]} disabled={disabled} onClick={() => toggle(k)}
      className={cn("rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-40",
        ann[k] ? "bg-primary text-primary-foreground ring-primary" : "bg-secondary text-foreground ring-border")}>{label}</button>
  );
  return (
    <div className="grid w-full max-w-sm gap-1.5" data-testid="declare">
      <div className="grid grid-cols-3 gap-1">
        {KINDS.map((k) => {
          const val = valueOf(k);
          const low = val < s.bid;
          return (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={`kind-${k}`}
              className={cn("flex items-baseline justify-center gap-1 rounded-xl px-1 py-1.5 text-sm leading-tight font-semibold ring-1 ring-inset outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
                kind === k ? "bg-primary text-primary-foreground ring-primary" : "glass ring-border", tip?.kind === k && kind !== k && "hint-glow")}>
              <span className="truncate">{kindName(k, o)}</span>
              <span className={cn("text-xs font-normal tabular-nums", kind === k ? "text-primary-foreground/85" : low ? "text-destructive" : "text-muted-foreground")}>{val}</span>
            </button>
          );
        })}
      </div>
      {(kind === "null" || hand) && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {kind !== "null" && <><Toggle k="schneider" label="Schneider" /><Toggle k="schwarz" label="Schwarz" /></>}
          <Toggle k="ouvert" label="Ouvert" />
        </div>
      )}
      <Button disabled={!!why} onClick={() => { vibrate(12); act({ type: "declare", kind, schneider: g.schneider, schwarz: g.schwarz, ouvert: g.ouvert }); }} data-testid="declare-go">
        {gameName(g, o)} ansagen · {value}
      </Button>
      <p className={cn("text-center text-xs", why || value < s.bid ? "text-destructive" : "text-muted-foreground")} data-testid="declare-note">
        {why ?? `${kind === "null" ? "" : `Spitzen ${spitzenShort(spitzen(cards, kind as Exclude<Kind, "null">))}${hand ? " (ohne Skat)" : ""} · `}${value < s.bid ? `überreizt – gereizt bis ${s.bid}` : `gereizt bis ${s.bid}`}`}
      </p>
    </div>
  );
}
const spitzenShort = (n: number) => `${n >= 0 ? "mit" : "ohne"} ${Math.abs(n)}`;

/** Spielende: wer was gespielt hat, Augen, Rechnung, Skat, Punkte und Stand */
function RoundSummary({ s, me, o }: { s: SkState; me: string | null; o: Options }) {
  const rec = s.history.at(-1);
  if (!rec) return null;
  const nm = (id: string | null) => (id === me ? "Du" : s.names[id ?? ""] ?? "?");
  const title = rec.kind === "eingepasst" ? "Eingepasst – alle haben gepasst"
    : rec.kind === "ramsch" ? (rec.sweep ? `Durchmarsch: ${nm(rec.sweep)}` : `Ramsch: ${rec.losers.map(nm).join(" & ")} ${rec.losers.length > 1 || rec.losers[0] === me ? "verlieren" : "verliert"}`)
    : `${nm(rec.declarer)} ${rec.won ? (rec.declarer === me ? "gewinnst" : "gewinnt") : (rec.declarer === me ? "verlierst" : "verliert")}`;
  const seats = s.seats;
  return (
    <div className="grid w-full content-center gap-1 overflow-hidden" data-testid="round-summary">
      <p className="text-center font-semibold" data-testid="round-winner">
        {title} {rec.declarer && <span className="font-normal text-muted-foreground">– {recordName(rec, o)}</span>}
      </p>
      {rec.declarer && rec.kind !== "null" && (
        <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
          <div className={cn("glass rounded-xl px-2 py-1", rec.won && "ring-2 ring-ok/60")}>
            <span className="block truncate text-muted-foreground">{nm(rec.declarer)}</span>
            <b className="block text-base tabular-nums" data-testid="augen-declarer">{rec.augen} Augen</b>
          </div>
          <div className={cn("glass rounded-xl px-2 py-1", !rec.won && "ring-2 ring-ok/60")}>
            <span className="block truncate text-muted-foreground">Gegenspieler</span>
            <b className="block text-base tabular-nums">{120 - rec.augen} Augen</b>
          </div>
        </div>
      )}
      {rec.kind === "ramsch" && (
        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
          {Object.entries(rec.augenBy).map(([id, n]) => (
            <div key={id} className={cn("glass min-w-0 rounded-xl px-1 py-1", rec.losers.includes(id) && "ring-2 ring-destructive/50")}>
              <span className="block truncate text-muted-foreground">{nm(id)}{rec.virgins.includes(id) ? " · Jungfrau" : ""}</span>
              <b className="block text-base tabular-nums">{n} Augen</b>
            </div>
          ))}
        </div>
      )}
      {rec.declarer && (
        <p className="text-center text-xs text-muted-foreground" data-testid="lines">
          {rec.kind === "null" ? `${recordName(rec, o)}: ${rec.tricks ? "ein Stich – verloren" : "kein Stich"} · Wert ${rec.value}` : (
            <>{rec.factors.map((f) => (f.label.startsWith("mit") || f.label.startsWith("ohne") ? f.label : `${f.label} +1`)).join(" · ")} = {rec.factors.reduce((t, f) => t + f.n, 0)} × {rec.base}
              {" "}= <b className="text-foreground">{rec.factors.reduce((t, f) => t + f.n, 0) * rec.base}</b></>
          )}
          {rec.overbid && <b className="block text-destructive" data-testid="overbid">Überreizt (gereizt {rec.bid}) – zählt {rec.value}</b>}
          {!rec.overbid && rec.kind !== "null" && <span className="block">gereizt {rec.bid}{rec.won ? "" : rec.augen >= 61 ? " – Ansage nicht geschafft" : ""}</span>}
        </p>
      )}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground" data-testid="skat-shown">
        <span>Skat</span>
        {rec.skat.map((c) => <PlayingCard key={c} card={shownCard(c, o)} className="w-7" />)}
      </div>
      <div className={cn("grid gap-1 text-center tabular-nums", seats.length > 3 ? "grid-cols-4" : "grid-cols-3")}>
        {seats.map((id) => (
          <div key={id} className="glass min-w-0 rounded-xl px-1 py-1">
            <span className="block truncate text-xs">{nm(id)}</span>
            <b className={cn("block", (rec.points[id] ?? 0) > 0 ? "text-ok" : (rec.points[id] ?? 0) < 0 ? "text-destructive" : "")}>{(rec.points[id] ?? 0) > 0 ? "+" : ""}{rec.points[id] ?? 0}</b>
            <span className="block text-xs text-muted-foreground">{s.scores[id] ?? 0}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Spiel {s.round} von {s.total}</p>
    </div>
  );
}
