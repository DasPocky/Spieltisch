import { useEffect, useRef, useState } from "react";
import { Dices, Hand, RefreshCw } from "lucide-react";
import {
  handOf, inPlay, LIDS, ranked, suggest, TALLY_CHOICES, turnOptions,
  type ShAction, type ShState,
} from "@shared/games/schocken/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { DiceTray } from "@/platform/dice3d/DiceTray";
import { RollButton } from "@/platform/dice3d/RollButton";
import { HintChip } from "@/platform/HintChip";
import { Seats } from "@/platform/Seats";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { speak } from "@/platform/speech";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";
import { narration } from "./narration";

type Props = BoardProps<ShState, ShAction>;
const nameIn = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";
const HALF_NAME = (h: number) => (h === 3 ? "Finale" : `${h}. Hälfte`);
const deckel = (n: number) => `${n} Deckel`;

/** Ein Bierdeckel: Pappe mit rotem Rand */
export function Lid({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="9.2" fill="var(--paper)" stroke="#a84a57" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx="10" cy="10" r="6" fill="none" stroke="#a84a57" strokeOpacity="0.35" strokeWidth="0.9" />
    </svg>
  );
}

/** Deckel als Stapel nebeneinander, leicht überlappend */
function LidPile({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("flex items-center", className)} aria-label={deckel(n)} data-testid="lid-pile">
      {Array.from({ length: n }, (_, i) => <Lid key={i} className={cn("size-5 shrink-0 drop-shadow-sm", i > 0 && "-ml-2.5")} />)}
    </span>
  );
}

export function Board(props: Props) {
  useNarration(props);
  if (props.game.phase === "over") return <Result {...props} />;
  return <Play {...props} />;
}

function useNarration({ game: s, me, isHost, room }: Props) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<ShState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => nameIn(room.players, id));
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

function Result({ room, game: s, isHost, dispatch }: Props) {
  const players = room.players;
  const rest = players.filter((p) => p.id !== s.loser);
  const best = Math.min(...rest.map((p) => s.taken[p.id] ?? 0));
  const win = rest.filter((p) => (s.taken[p.id] ?? 0) === best).map((p) => p.name);
  const ranking = [...players]
    .sort((a, b) => Number(a.id === s.loser) - Number(b.id === s.loser) || (s.taken[a.id] ?? 0) - (s.taken[b.id] ?? 0))
    .map((p) => ({ id: p.id, name: p.name, score: s.taken[p.id] ?? 0 }));
  const subtitle = s.loser ? `${nameIn(players, s.loser)} verliert die Partie` : "Partie beendet";
  return <ResultScreen winner={win.join(" & ")} subtitle={subtitle} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Deckel" />;
}

function Play({ room, game: s, me, online, canAct, act }: Props) {
  const players = room.players;
  const local = me === null;
  const hints = useHints();
  const play = inPlay(s);
  const roundEnd = s.phase === "roundEnd";
  const hands = roundEnd ? s.last?.hands ?? {} : s.hands;
  const cur = nameIn(players, s.curId);
  const who = (id: string | null | undefined) => (id && id === me ? "Du" : nameIn(players, id));
  const order = ranked({ hands: s.hands, order: s.order });

  const seats = players.map((p) => {
    const member = s.members.includes(p.id);
    const h = hands[p.id];
    const safe = member && !play.includes(p.id) && !(roundEnd && s.last?.halfLost);
    return {
      id: p.id, name: p.name, cur: s.phase === "roll" && p.id === s.curId, out: !member || safe, testId: `player-${p.name}`,
      value: member ? <span className="inline-flex items-center gap-0.5 tabular-nums"><Lid className="size-3.5" />{s.lids[p.id] ?? 0}</span> : undefined,
      sub: !member ? "schaut zu" : safe ? "raus, sicher" : h ? handOf(h.dice).label : p.id === s.curId && s.phase === "roll" ? "würfelt" : "",
      label: `${p.name}, ${member ? deckel(s.lids[p.id] ?? 0) : "schaut zu"}`,
    };
  });

  return (
    <>
      <Seats me={me} online={online} seats={seats} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1.5 pb-1">
        <div className="flex shrink-0 items-center justify-between gap-2 px-1">
          <span className="min-w-0 truncate text-sm" data-testid="round">
            <b className="text-base">{HALF_NAME(s.half)}</b> <span className="text-muted-foreground">· Runde {s.round}</span>
          </span>
          <RulesSheet gameId={room.gameId} />
        </div>
        <Middle s={s} who={who} order={order} />
      </div>
      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {roundEnd ? (
          <RoundEnd s={s} who={who} act={act} />
        ) : s.table ? (
          canAct ? <Tally s={s} players={players} act={act} /> : <Waiting text={<>Am Tisch wird gewürfelt – <b className="text-foreground">{cur}</b> tippt ein</>} />
        ) : canAct ? (
          <Controls key={`${s.curId}-${s.round}`} s={s} options={room.options} me={s.curId!} act={act} hints={hints} name={local ? cur : null} />
        ) : (
          <section className="glass rounded-2xl p-2.5">
            <DiceTray values={s.dice} held={s.held} rollKey={`${s.n}-${s.curId}-${s.throws}`} className="h-24" empty={`${cur} würfelt gleich`} />
            <p className="mt-1.5 text-center text-sm text-muted-foreground">Warte auf <b className="text-foreground">{cur}</b></p>
          </section>
        )}
      </div>
    </>
  );
}

function Waiting({ text }: { text: React.ReactNode }) {
  return <p className="glass rounded-xl py-4 text-center text-sm text-muted-foreground">{text}</p>;
}

/** Mitte: Deckel, Vorgabe des Beginners, bester und schlechtester Wurf der Runde bzw. die Wertung */
function Middle({ s, who, order }: { s: ShState; who: (id: string | null | undefined) => string; order: string[] }) {
  const r = s.phase === "roundEnd" ? s.last : null;
  const potLine = s.pot > 0
    ? <><LidPile n={s.pot} className="min-w-0" /><span className="shrink-0 text-sm"><b>{s.pot}</b> in der Mitte</span></>
    : <span className="text-sm text-muted-foreground">Mitte leer – Deckel gehen vom Gewinner zum Verlierer</span>;
  if (r) {
    return (
      <div className="pop my-auto flex flex-col gap-2 rounded-2xl bg-paper px-4 py-3 text-paper-ink shadow-lg" data-testid="round-summary">
        <div className="text-sm font-semibold text-paper-ink/60">Runde {r.round} gewertet</div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate">Höchster: <b>{who(r.winner)}</b></span>
          <b className="shrink-0 text-lg">{r.label}</b>
        </div>
        {r.hands[r.loser] && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">Niedrigster: <b>{who(r.loser)}</b></span>
            <b className="shrink-0 text-lg">{handOf(r.hands[r.loser].dice).label}</b>
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-paper-ink/15 pt-2">
          <LidPile n={Math.min(r.moved, LIDS)} className="shrink-0" />
          <span className="min-w-0 text-base font-bold leading-tight" data-testid="moved">
            {r.aus ? `Schock aus! ${who(r.loser)} ${who(r.loser) === "Du" ? "bekommst" : "bekommt"} alle Deckel`
              : `${who(r.loser)} ${who(r.loser) === "Du" ? "bekommst" : "bekommt"} ${deckel(r.moved)}${r.from === "winner" ? ` von ${who(r.winner)}` : " aus der Mitte"}`}
          </span>
        </div>
        {r.halfLost && (
          <div className="rounded-xl bg-primary/15 px-3 py-2 text-center font-bold" data-testid="half-lost">
            {who(r.halfLost)} {who(r.halfLost) === "Du" ? "verlierst" : "verliert"} {r.half === 3 ? "das Finale" : `die ${r.half}. Hälfte`}
          </div>
        )}
      </div>
    );
  }
  const best = order[0], worst = order.length > 1 ? order[order.length - 1] : null;
  const h = s.dice.length === 3 ? handOf(s.dice) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="glass flex shrink-0 items-center justify-between gap-2 rounded-2xl px-3 py-2" data-testid="pot">{potLine}</div>
      <div className="glass grid shrink-0 gap-0.5 rounded-2xl px-3 py-2 text-sm">
        {s.limit < 3 && s.curId !== s.order[0] && <div className="font-semibold">{who(s.order[0])} {s.order[0] && who(s.order[0]) === "Du" ? "hast" : "hat"} {s.limit === 1 ? "einen Wurf" : "zwei Würfe"} vorgelegt</div>}
        {best ? (
          <>
            <div className="flex justify-between gap-2"><span className="truncate text-muted-foreground">Höchster: {who(best)}</span><b className="shrink-0">{handOf(s.hands[best].dice).label}</b></div>
            {worst && <div className="flex justify-between gap-2"><span className="truncate text-muted-foreground">Niedrigster: {who(worst)}</span><b className="shrink-0">{handOf(s.hands[worst].dice).label}</b></div>}
          </>
        ) : (
          <div className="text-muted-foreground">{s.table ? "Würfelt reihum am Tisch – der Beginner legt die Wurfzahl vor." : `${who(s.curId)} ${s.curId && who(s.curId) === "Du" ? "beginnst" : "beginnt"} und legt die Wurfzahl vor.`}</div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        {h ? (
          <>
            <div className="text-xs text-muted-foreground">{who(s.curId)} · Wurf {s.throws} von {s.limit}</div>
            <div key={s.n} className="text-in font-display text-[clamp(1.6rem,8vw,2.4rem)] leading-tight" data-testid="hand-label">{h.label}</div>
            <div className="text-xs text-muted-foreground [@media(max-height:640px)]:hidden">{h.kind === "aus" ? "alle Deckel" : `wäre ${deckel(h.lids)} wert`}</div>
          </>
        ) : !s.table && (
          <div className="text-sm text-muted-foreground"><b className="text-foreground">{who(s.curId)}</b> {s.curId && who(s.curId) === "Du" ? "bist" : "ist"} dran</div>
        )}
      </div>
    </div>
  );
}

function Controls({ s, options, me, act, hints, name }: { s: ShState; options: Props["room"]["options"]; me: string; act: (a: ShAction) => void; hints: boolean; name: string | null }) {
  const can = turnOptions(s, options);
  const rolled = s.dice.length === 3;
  const plan = hints && rolled ? suggest(s, me, options) : null;
  const hint = plan?.type === "roll" ? plan.hold : undefined;
  const tip = !plan ? null : plan.type === "stop" ? "Stehen lassen" : plan.type === "turn" ? "Sechsen drehen" : plan.hold.some(Boolean) ? "Leuchtende herauslegen" : "Alle nochmal";
  const status = !rolled ? (name ? `${name}, du bist dran.` : "Tippe auf „Würfeln“.")
    : s.turned ? "Die zweite Sechs muss zurück in den Becher – würfle."
    : can.left <= 0 ? "Keine Würfe mehr – lass stehen."
    : "Antippen zum Herauslegen";
  return (
    <section className="glass rounded-2xl p-2.5">
      <DiceTray values={s.dice} held={s.held} hint={hint} rollKey={`${s.n}-${s.curId}-${s.throws}`} canToggle={can.hold} onToggle={(i) => act({ type: "hold", i })}
        className="h-24" label="Würfel – antippen zum Herauslegen" onThrow={can.roll ? () => act({ type: "roll" }) : undefined} />
      <div className="mt-1.5 flex min-h-6 items-center justify-center text-center text-sm text-muted-foreground">
        {tip && !s.turned ? <HintChip>Tipp: {tip}</HintChip> : <span className="truncate"><SmoothText>{status}</SmoothText></span>}
      </div>
      {can.turn && (
        <Button variant="ghost" className="mt-1 h-9 w-full" onClick={() => { vibrate(10); act({ type: "turn" }); }} data-testid="turn"><RefreshCw />Zwei Sechsen zu einer Eins drehen</Button>
      )}
      <div className={cn("mt-1.5 grid gap-2.5", rolled && can.left > 0 ? "grid-cols-2" : "grid-cols-1")}>
        {can.left > 0 && (
          <RollButton variant={rolled && !s.turned ? "secondary" : "default"} onRoll={() => act({ type: "roll" })} disabled={!can.roll}>
            <Dices className="max-[359px]:hidden" />Würfeln <span className="text-sm font-semibold opacity-75">({can.left})</span>
          </RollButton>
        )}
        {rolled && (
          <Button size="lg" className="whitespace-nowrap" variant={can.left > 0 ? "secondary" : "default"} disabled={!can.stop} onClick={() => { vibrate(12); act({ type: "stop" }); }} data-testid="stop">
            <Hand className="max-[359px]:hidden" />Stehen lassen
          </Button>
        )}
      </div>
    </section>
  );
}

function RoundEnd({ s, who, act }: { s: ShState; who: (id: string | null | undefined) => string; act: (a: ShAction) => void }) {
  const r = s.last!;
  const label = r.halfLost ? (s.half === 1 ? "Zweite Hälfte" : "Finale") : `Runde ${s.round + 1} – ${who(r.loser)} ${who(r.loser) === "Du" ? "beginnst" : "beginnt"}`;
  const winnerDice = r.hands[r.winner]?.dice;
  return (
    <section className="glass grid gap-2 rounded-2xl p-2.5">
      {winnerDice && <DiceTray values={winnerDice} held={[false, false, false]} still rollKey={`end-${s.n}`} className="h-20" />}
      <Button size="lg" onClick={() => { vibrate(10); act({ type: "next" }); }} data-testid="next">{label}</Button>
    </section>
  );
}

/** Echte Würfel: höchster und niedrigster Wurf und was der höchste wert ist – die App verteilt die Deckel */
function Tally({ s, players, act }: { s: ShState; players: Player[]; act: (a: ShAction) => void }) {
  const play = players.filter((p) => inPlay(s).includes(p.id));
  const [winner, setWinner] = useState<string | null>(null);
  const [loser, setLoser] = useState<string | null>(null);
  const [count, setCount] = useState<number | "aus" | null>(null);
  const cols = play.length > 6 ? "grid-cols-5" : play.length > 4 ? "grid-cols-3" : play.length > 2 ? "grid-cols-4" : "grid-cols-2";
  const chip = (sel: boolean, off?: boolean) => cn("h-9 min-w-0 truncate rounded-lg px-1.5 text-sm font-semibold outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-30",
    sel ? "bg-ice text-navy-950" : "bg-navy-700/70 ring-1 ring-inset ring-border", off && "opacity-30");
  const ready = winner && loser && winner !== loser && count !== null;
  return (
    <section className="glass grid gap-1.5 rounded-2xl p-2.5" data-testid="tally">
      <div className="px-0.5 text-sm font-semibold">Höchster Wurf</div>
      <div className={cn("grid gap-1", cols)} role="radiogroup" aria-label="Höchster Wurf">
        {play.map((p) => <button key={p.id} type="button" role="radio" aria-checked={winner === p.id} disabled={loser === p.id} className={chip(winner === p.id)} onClick={() => setWinner(p.id)}>{p.name}</button>)}
      </div>
      <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Was war der höchste Wurf?">
        {TALLY_CHOICES.map((c) => (
          <button key={String(c.count)} type="button" role="radio" aria-checked={count === c.count} title={c.hint} className={cn(chip(count === c.count), "h-10 text-xs leading-tight whitespace-normal", c.count === 1 && "col-span-1")} onClick={() => setCount(c.count)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="px-0.5 text-sm font-semibold">Niedrigster Wurf</div>
      <div className={cn("grid gap-1", cols)} role="radiogroup" aria-label="Niedrigster Wurf">
        {play.map((p) => <button key={p.id} type="button" role="radio" aria-checked={loser === p.id} disabled={winner === p.id} className={chip(loser === p.id)} onClick={() => setLoser(p.id)}>{p.name}</button>)}
      </div>
      <Button size="lg" disabled={!ready} onClick={() => ready && act({ type: "tally", winner, loser, count })} data-testid="tally-go">
        {ready ? (count === "aus" ? `${nameIn(players, loser)} bekommt alle Deckel` : `${nameIn(players, loser)} bekommt ${count === 1 ? "1 Deckel" : `${count} Deckel`}`) : "Wurf wählen"}
      </Button>
    </section>
  );
}
