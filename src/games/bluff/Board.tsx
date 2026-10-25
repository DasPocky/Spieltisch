import { useEffect, useRef, useState } from "react";
import { Eye, Minus, Plus, Undo2 } from "lucide-react";
import {
  bidChance, bidLabel, standings, diceOf, exactOf, faceName, isAlive, jokersOf, lastBid, matches, minCount, suggest, totalDice, turnOptions,
  type BluffAction, type BluffReveal, type BluffState,
} from "@shared/games/bluff/logic";
import type { Options, Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { Die } from "@/platform/Die";
import { useHandoff } from "@/platform/Handoff";
import { HintChip } from "@/platform/HintChip";
import { Seats } from "@/platform/Seats";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { speak } from "@/platform/speech";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";
import { narration } from "./narration";

type Props = BoardProps<BluffState, BluffAction>;
const nameIn = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";

const CSS = `
@keyframes bluff-shake { 0%,100% { transform: rotate(0) } 15% { transform: translateX(-7%) rotate(-9deg) } 35% { transform: translateX(6%) rotate(8deg) } 55% { transform: translateX(-4%) rotate(-5deg) } 75% { transform: translateX(3%) rotate(3deg) } }
.bluff-shake { animation: bluff-shake 0.55s ease-in-out; transform-origin: 50% 90%; }
.bluff-cup { transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
@media (prefers-reduced-motion: reduce) { .bluff-shake { animation: none; } .bluff-cup { transition: none; } }
`;

/** Würfelzahl als kleine Punkte am Platz */
function Pips({ n, max, light }: { n: number; max: number; light?: boolean }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} Würfel`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={cn("block size-2 rounded-[3px]", i < n ? (light ? "bg-white" : "bg-ice") : light ? "bg-white/25" : "bg-navy-950/60 ring-1 ring-inset ring-border")} />
      ))}
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
  const prev = useRef<BluffState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => nameIn(room.players, id), jokersOf(room.options));
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players, room.options]);
}

function Result({ room, game: s, isHost, dispatch }: Props) {
  const players = room.players;
  const n = players.length;
  const ranking = standings(s, players).map((x) => ({
    id: x.id, name: nameIn(players, x.id), score: n + 1 - x.place, place: x.place,
    text: x.outRound === null ? `${x.dice} Würfel` : x.outRound ? `raus in Runde ${x.outRound}` : "raus",
  }));
  const left = s.winnerId ? s.count[s.winnerId] ?? 0 : 0;
  return <ResultScreen winner={nameIn(players, s.winnerId)} subtitle={`noch ${left} Würfel unter dem Becher`} ranking={ranking} isHost={isHost} dispatch={dispatch} />;
}

/** Der eigene Becher: antippen hebt ihn an, darunter die eigenen Würfel */
function Cup({ dice, lifted, canPeek, shakeKey, onToggle, face, jokers }: {
  dice: number[] | null; lifted: boolean; canPeek: boolean; shakeKey: number; onToggle: () => void; face: number | null; jokers: boolean;
}) {
  const open = lifted && !!dice;
  return (
    <button type="button" disabled={!canPeek} onClick={() => { vibrate(6); onToggle(); }} data-testid="cup"
      aria-label={canPeek ? (open ? "Becher zudecken" : "Becher anheben und Würfel ansehen") : "Würfelbecher"} aria-pressed={canPeek ? open : undefined}
      className="relative aspect-square h-full max-h-64 max-w-full outline-none disabled:cursor-default focus-visible:[&>svg]:drop-shadow-[0_0_6px_var(--ring)]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
        <ellipse cx="50" cy="80" rx="46" ry="13" fill="var(--paper)" opacity="0.9" />
        <ellipse cx="50" cy="80" rx="40" ry="10.5" fill="none" stroke="#a84a57" strokeOpacity="0.45" strokeWidth="1.2" />
      </svg>
      {open && (
        <span className="absolute inset-x-[8%] bottom-[13%] flex flex-wrap items-end justify-center gap-[3%]" data-testid="my-dice" aria-label={`Deine Würfel: ${dice.join(", ")}`}>
          {dice.map((d, i) => (
            <span key={i} className="dice-in block w-[15%]" style={{ animationDelay: `${i * 50}ms` }}>
              <Die value={d} mark={face && matches(d, face, jokers) ? "selected" : undefined} className="size-full" />
            </span>
          ))}
        </span>
      )}
      <span key={shakeKey} className={cn("absolute inset-x-[22%] top-[6%] bottom-[14%] block", shakeKey > 0 && "bluff-shake")}>
        <svg viewBox="0 0 60 78" className={cn("bluff-cup size-full", open && "translate-x-[48%] -translate-y-[34%] rotate-[24deg]")} aria-hidden="true">
          <path d="M10 6 H50 L57 70 Q57 76 51 76 H9 Q3 76 3 70 Z" fill="var(--deep-600)" />
          <path d="M10 6 H50 L52 20 H8 Z" fill="var(--deep-500)" />
          <path d="M4.5 62 H55.5 L56.5 70 Q56.5 75 51 75 H9 Q3.5 75 3.5 70 Z" fill="var(--deep-700)" />
          <path d="M14 26 L12 56" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" strokeLinecap="round" />
          <rect x="9" y="3" width="42" height="6" rx="3" fill="var(--deep-400)" />
        </svg>
      </span>
      {canPeek && !open && (
        <span className="absolute inset-x-0 bottom-[22%] flex justify-center">
          <span className="text-in flex items-center gap-1 rounded-full bg-navy-950/75 px-2.5 py-1 text-xs font-semibold text-foreground"><Eye className="size-3.5" />Antippen zum Nachsehen</span>
        </span>
      )}
    </button>
  );
}

/** Ansage groß in der Mitte – oder wer die Runde beginnt */
function Stage({ s, who, total }: { s: BluffState; who: (id: string | null) => string; total: number }) {
  const last = lastBid(s);
  if (!last) {
    return (
      <div className="glass shrink-0 rounded-2xl px-4 py-2.5 text-center text-sm text-muted-foreground" data-testid="announcement">
        Runde {s.round} – <b className="text-foreground">{who(s.curId)} {who(s.curId) === "Du" ? "sagst" : "sagt"} zuerst an</b>.
        <div className="text-xs">{total} Würfel im Spiel</div>
      </div>
    );
  }
  const earlier = s.bids.slice(0, -1).slice(-4);
  return (
    <div key={s.bids.length} className="text-in shrink-0 rounded-2xl bg-paper px-4 py-2 text-paper-ink shadow-lg" data-testid="announcement">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-paper-ink/60">
        <span className="truncate">{who(last.by)} {who(last.by) === "Du" ? "sagst" : "sagt"}: mindestens</span>
        <span className="shrink-0 text-xs">{total} Würfel im Spiel</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-[clamp(1.35rem,7.5vw,2rem)] font-extrabold leading-tight tracking-tight" data-testid="announced">{bidLabel(last)}</div>
        <Die value={last.face} className="size-[clamp(1.75rem,8vw,2.25rem)] shrink-0" />
      </div>
      {earlier.length > 0 && <div className="truncate text-xs text-paper-ink/55">vorher: {earlier.map(bidLabel).join(" → ")}</div>}
    </div>
  );
}

function RevealCard({ r, who }: { r: BluffReveal; who: (id: string | null) => string }) {
  const verb = (id: string, du: string, er: string) => (who(id) === "Du" ? du : er);
  const res = r.loser
    ? r.out ? `${who(r.loser)} ${verb(r.loser, "bist", "ist")} raus!` : `${who(r.loser)} ${verb(r.loser, "verlierst", "verliert")} einen Würfel`
    : r.gainer ? `${who(r.gainer)} ${verb(r.gainer, "bekommst", "bekommt")} einen Würfel zurück` : "Genau richtig!";
  const head = r.kind === "bluff" ? (r.holds ? "Stimmt!" : "Gelogen!") : r.actual === r.bid.count ? "Genau!" : "Daneben!";
  return (
    <div className="pop shrink-0 rounded-2xl bg-paper px-4 py-2 text-paper-ink shadow-lg" data-testid="reveal">
      <div className="truncate text-sm font-semibold text-paper-ink/60">{who(r.by)} {verb(r.by, "rufst", "ruft")} {r.kind === "bluff" ? "Bluff!" : "Genau!"} · Ansage {bidLabel(r.bid)}</div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-2xl font-extrabold leading-tight">{head}</div>
        <div className="shrink-0 text-sm font-semibold" data-testid="actual">{r.actual} {faceName(r.bid.face, r.actual)} liegen</div>
      </div>
      <div className="truncate text-sm font-semibold" data-testid="reveal-result">{res}</div>
    </div>
  );
}

/** Aufgedeckt: alle Becher, passende Würfel hervorgehoben */
function AllCups({ r, players, who, jokers }: { r: BluffReveal; players: Player[]; who: (id: string | null) => string; jokers: boolean }) {
  const shown = players.filter((p) => r.cups[p.id]?.length);
  if (!shown.length) return <div className="my-auto text-center text-sm text-muted-foreground">Mit echten Würfeln – schaut auf den Tisch.</div>;
  return (
    <div className={cn("grid min-h-0 content-center gap-x-3 gap-y-1 overflow-hidden", shown.length > 4 && "grid-cols-2")} data-testid="all-cups">
      {shown.map((p) => (
        <div key={p.id} className={cn("flex min-w-0 items-center gap-2 rounded-xl px-2 py-1", (p.id === r.loser) && "bg-primary/15")}>
          <span className="w-12 min-w-0 shrink truncate text-xs font-semibold">{who(p.id)}</span>
          <span className="flex gap-0.5">
            {r.cups[p.id].map((d, i) => <Die key={i} value={d} mark={matches(d, r.bid.face, jokers) ? "selected" : undefined} className={cn("size-6", !matches(d, r.bid.face, jokers) && "opacity-45")} />)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Play({ room, game: s, me, online, canAct, act }: Props) {
  const players = room.players;
  const local = me === null;
  const hints = useHints();
  const jokers = jokersOf(room.options);
  const [lifted, setLifted] = useState(false);
  const alive = players.filter((p) => isAlive(s, p.id));
  const { covered, reveal } = useHandoff(local && !s.table && s.phase === "bid", s.curId, alive.length);
  useEffect(() => { setLifted(false); }, [s.curId, s.round]);
  const who = (id: string | null) => (id && id === me ? "Du" : nameIn(players, id));
  const total = totalDice(s);
  const max = Math.max(diceOf(room.options), ...Object.values(s.count));
  const cur = players.find((p) => p.id === s.curId);
  const myTurn = s.phase === "bid" && canAct && (local || me === s.curId) && !covered;
  // eigene Würfel: lokal die des Spielers am Zug (nach dem Sichtschutz), online die eigenen
  const owner = local ? (covered ? null : s.curId) : me;
  const myDice = !s.table && owner && s.phase === "bid" ? s.cups[owner] ?? null : null;
  const last = lastBid(s);

  return (
    <>
      <style>{CSS}</style>
      <Seats me={me} online={online} seats={players.map((p) => {
        const dead = !isAlive(s, p.id);
        return {
          id: p.id, name: p.name, cur: s.phase === "bid" && p.id === s.curId, out: dead, testId: `player-${p.name}`,
          sub: dead ? "raus" : <Pips n={s.count[p.id] ?? 0} max={max} light={s.phase === "bid" && p.id === s.curId} />,
          label: `${p.name}, ${dead ? "raus" : `${s.count[p.id]} Würfel`}`,
        };
      })} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1.5 pb-1">
        <div className="flex shrink-0 items-center justify-between gap-2 px-1">
          <span className="min-w-0 truncate text-sm">
            {s.phase === "bid"
              ? <><b className="text-base" data-testid="current-player">{cur ? who(cur.id) : "?"}</b> <span className="text-muted-foreground"><SmoothText>{last ? "erhöht oder zweifelt" : "sagt an"}</SmoothText></span></>
              : <b className="text-base">Aufgedeckt</b>}
          </span>
          <RulesSheet gameId={room.gameId} />
        </div>
        <div className="relative z-10 shrink-0">{s.phase === "reveal" && s.reveal ? <RevealCard r={s.reveal} who={who} /> : <Stage s={s} who={who} total={total} />}</div>
        <div className="flex min-h-0 flex-1 justify-center">
          {s.phase === "reveal" && s.reveal ? <AllCups r={s.reveal} players={players} who={who} jokers={jokers} />
            : <Cup dice={myDice} lifted={lifted} canPeek={!!myDice?.length} shakeKey={myDice ? s.round : 0} onToggle={() => setLifted((l) => !l)} face={last?.face ?? null} jokers={jokers} />}
        </div>
      </div>
      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {s.phase === "reveal" ? (
          <Button size="lg" className="w-full" onClick={() => { vibrate(10); act({ type: "next" }); }} data-testid="next">
            {s.reveal?.final ? "Zum Ergebnis" : `Nächste Runde – ${who(s.starter)} ${who(s.starter) === "Du" ? "beginnst" : "beginnt"}`}
          </Button>
        ) : covered ? (
          <div className="glass grid cursor-pointer gap-3 rounded-2xl p-4 text-center" onClick={reveal} data-testid="handoff">
            <p className="text-muted-foreground">Gib das Handy an <b className="text-foreground">{cur?.name}</b>.</p>
            <Button size="lg" onClick={(e) => { e.stopPropagation(); reveal(); }}>Ich bin {cur?.name}</Button>
          </div>
        ) : !myTurn ? (
          <p className="glass rounded-xl py-4 text-center text-muted-foreground">Warte auf <b className="text-foreground">{cur?.name}</b></p>
        ) : (
          <Controls key={`${s.curId}-${s.round}-${s.bids.length}`} s={s} options={room.options} me={owner} act={act} hints={hints && !!myDice && lifted} />
        )}
      </div>
    </>
  );
}

function Controls({ s, options, me, act, hints }: { s: BluffState; options: Options; me: string | null; act: (a: BluffAction) => void; hints: boolean }) {
  const can = turnOptions(s, options);
  const last = lastBid(s);
  const total = totalDice(s);
  const plan = hints && me ? suggest(s, me, options) : null;
  const start = plan?.type === "bid" ? plan : (() => {
    const f = [last?.face ?? 2, 2, 3, 4, 5, 6, 1].find((x) => minCount(s, x, options) !== null);
    return f ? { face: f, count: minCount(s, f, options)! } : null;
  })();
  const [face, setFace] = useState<number | null>(start?.face ?? null);
  const [count, setCount] = useState<number>(start?.count ?? 1);
  const [asking, setAsking] = useState<"doubt" | "exact" | null>(null);
  const [actual, setActual] = useState(last?.count ?? 0);
  const low = face ? minCount(s, face, options) : null;
  const valid = face !== null && low !== null && count >= low && count <= total;
  const chance = hints && me && valid ? bidChance(s, me, { count, face: face! }, options) : null;

  if (asking && last) {
    return (
      <section className="glass grid gap-2 rounded-2xl p-2.5" data-testid="ask-actual">
        <p className="px-1 text-center text-sm">Becher hoch! Wie viele <b>{faceName(last.face)}</b> liegen{jokersOf(options) && last.face !== 1 ? " (mit Einsen)" : ""}?</p>
        <div className="flex items-center justify-center gap-3">
          <Button size="icon" variant="secondary" aria-label="weniger" disabled={actual <= 0} onClick={() => setActual((a) => a - 1)}><Minus /></Button>
          <b className="w-12 text-center text-3xl tabular-nums" data-testid="actual-count">{actual}</b>
          <Button size="icon" variant="secondary" aria-label="mehr" disabled={actual >= total} onClick={() => setActual((a) => a + 1)}><Plus /></Button>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button size="lg" variant="secondary" aria-label="Zurück" onClick={() => setAsking(null)}><Undo2 /></Button>
          <Button size="lg" onClick={() => act({ type: asking, actual })} data-testid="actual-go">{actual} {faceName(last.face, actual)} liegen</Button>
        </div>
      </section>
    );
  }

  const call = (type: "doubt" | "exact") => {
    vibrate(20);
    if (s.table) { setAsking(type); return; }
    act({ type });
  };
  const pickFace = (f: number) => {
    const m = minCount(s, f, options);
    if (m === null) return;
    vibrate(5);
    setFace(f);
    setCount((c) => (f === face ? c : m));
  };

  return (
    <section className="glass grid grid-cols-1 gap-2 rounded-2xl p-2.5">
      <div className="flex min-h-6 items-center justify-between gap-2 px-0.5 text-sm">
        <b className="min-w-0 truncate">{last ? "Erhöhen auf mindestens …" : "Ansage: mindestens …"}</b>
        {chance !== null && <HintChip className="shrink-0">{Math.round(chance * 100)} % sicher</HintChip>}
        {!hints && s.cups[me ?? ""]?.length && !s.table ? <span className="shrink-0 text-xs text-muted-foreground">Becher antippen</span> : null}
      </div>
      <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label="Augenzahl" data-testid="faces">
        {[1, 2, 3, 4, 5, 6].map((f) => {
          const ok = can.bid && minCount(s, f, options) !== null;
          return (
            <button key={f} type="button" role="radio" aria-checked={face === f} aria-label={faceName(f)} disabled={!ok} onClick={() => pickFace(f)}
              className={cn("grid h-[min(2.75rem,7vh)] min-w-0 place-items-center rounded-lg outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-25",
                face === f ? "bg-ice" : "bg-navy-700/70 ring-1 ring-inset ring-border", plan?.type === "bid" && plan.face === f && face !== f && "ring-2 ring-ice/60")}>
              <Die value={f} className="size-[min(1.9rem,5vh)]" />
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-1.5">
        <Button size="icon" variant="secondary" aria-label="Anzahl verringern" disabled={!face || low === null || count <= low} onClick={() => setCount((c) => c - 1)}><Minus /></Button>
        <b className="w-8 text-center text-2xl tabular-nums" data-testid="bid-count">{count}</b>
        <Button size="icon" variant="secondary" aria-label="Anzahl erhöhen" disabled={!face || count >= total} onClick={() => setCount((c) => c + 1)}><Plus /></Button>
        <Button size="lg" className="min-w-0 whitespace-nowrap" disabled={!valid} onClick={() => { vibrate(12); act({ type: "bid", count, face: face! }); }} data-testid="bid">
          <span className="truncate">{valid ? `${count} × ${faceName(face!, count)}` : can.bid ? "Augenzahl wählen" : "Nicht zu überbieten"}</span>
        </Button>
      </div>
      {last && (
        <div className={cn("grid gap-2", can.exact ? "grid-cols-2" : "grid-cols-1")}>
          <Button size="lg" variant={plan?.type === "doubt" ? "default" : "secondary"} onClick={() => call("doubt")} data-testid="doubt">Bluff!</Button>
          {can.exact && exactOf(options) && <Button size="lg" variant="secondary" onClick={() => call("exact")} data-testid="exact">Genau!</Button>}
        </div>
      )}
    </section>
  );
}
