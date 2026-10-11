import { useEffect, useState } from "react";
import { Dices, Eye, Undo2 } from "lucide-react";
import {
  chanceAtLeast, facesOf, isAlive, labelOf, lastOf, MAEXCHEN, ORDER, rankOf, turnOptions, valueOf,
  type MaexAction, type MaexState, type Reveal,
} from "@shared/games/maexchen/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { Die } from "@/platform/Die";
import { useHandoff } from "@/platform/Handoff";
import { HintChip } from "@/platform/HintChip";
import { Seats } from "@/platform/Seats";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "?";

/** Becher schütteln und anheben – nur hier gebraucht, daher direkt am Spiel */
const CSS = `
@keyframes maex-shake { 0%,100% { transform: rotate(0) } 15% { transform: translateX(-7%) rotate(-9deg) } 35% { transform: translateX(6%) rotate(8deg) } 55% { transform: translateX(-4%) rotate(-5deg) } 75% { transform: translateX(3%) rotate(3deg) } }
.maex-shake { animation: maex-shake 0.55s ease-in-out; transform-origin: 50% 90%; }
.maex-cup { transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
@media (prefers-reduced-motion: reduce) { .maex-shake { animation: none; } .maex-cup { transition: none; } }
`;

/** Zwei kleine Würfel für einen Wert */
export function Pair({ value, className }: { value: number; className?: string }) {
  const [a, b] = facesOf(value);
  return (
    <span className={cn("inline-flex gap-1", className)} aria-hidden="true">
      <Die value={a} className="size-full" /><Die value={b} className="size-full" />
    </span>
  );
}

/** Leben als kleine Deckel */
function Lids({ n, max, light }: { n: number; max: number; light?: boolean }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} Leben`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={cn("block size-2 rounded-full", i < n ? (light ? "bg-white" : "bg-ice") : light ? "bg-white/25" : "bg-navy-950/60 ring-1 ring-inset ring-border")} />
      ))}
    </span>
  );
}

/**
 * Der Würfelbecher auf dem Deckel. Gehört der Wurf dir, hebst du den Becher mit Antippen an.
 * `shakeKey` wechselt bei jedem Wurf – dann wackelt der Becher.
 */
function Cup({ dice, lifted, canPeek, shakeKey, onToggle, empty }: {
  dice: [number, number] | null; lifted: boolean; canPeek: boolean; shakeKey: number; onToggle: () => void; empty: boolean;
}) {
  const open = lifted && !!dice;
  return (
    <button type="button" disabled={!canPeek} onClick={() => { vibrate(6); onToggle(); }} data-testid="cup"
      aria-label={canPeek ? (open ? "Becher zudecken" : "Becher anheben und Wurf ansehen") : "Würfelbecher"} aria-pressed={canPeek ? open : undefined}
      className="relative aspect-square h-full max-h-72 max-w-full outline-none disabled:cursor-default focus-visible:[&>svg]:drop-shadow-[0_0_6px_var(--ring)]">
      {/* Deckel (Untersetzer) */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
        <ellipse cx="50" cy="80" rx="44" ry="13" fill="var(--paper)" opacity="0.9" />
        <ellipse cx="50" cy="80" rx="38" ry="10.5" fill="none" stroke="#a84a57" strokeOpacity="0.45" strokeWidth="1.2" />
      </svg>
      {/* Würfel unter dem Becher */}
      {open && (
        <span className="absolute inset-x-[22%] bottom-[12%] flex justify-center gap-[6%]" data-testid="my-roll" aria-label={`Dein Wurf: ${labelOf(valueOf(dice))}`}>
          <span className="dice-in block w-[44%]"><Die value={dice[0]} className="size-full" /></span>
          <span className="dice-in block w-[44%]" style={{ animationDelay: "60ms" }}><Die value={dice[1]} className="size-full" /></span>
        </span>
      )}
      {/* Becher */}
      <span key={shakeKey} className={cn("absolute inset-x-[20%] top-[8%] bottom-[14%] block", shakeKey > 0 && "maex-shake")}>
        <svg viewBox="0 0 60 78" className={cn("maex-cup size-full", open && "translate-x-[42%] -translate-y-[28%] rotate-[22deg]")} aria-hidden="true" style={{ opacity: empty ? 0.7 : 1 }}>
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

/** Ansage oder Aufdeckung der Runde – die große Karte in der Mitte */
function Stage({ s, players, viewer }: { s: MaexState; players: Player[]; viewer: string | null }) {
  const who = (id: string) => (id === viewer ? "Du" : nameOf(players, id));
  const last = lastOf(s);
  if (last) {
    const earlier = s.round.slice(0, -1).slice(-5);
    return (
      <div key={s.round.length} className="text-in shrink-0 rounded-2xl bg-paper px-4 py-2.5 text-paper-ink shadow-lg" data-testid="announcement">
        <div className="flex items-center justify-between gap-2 text-sm font-semibold text-paper-ink/60">
          <span className="truncate">{who(last.by)} {last.by === viewer ? "sagst" : "sagt"}</span>
          {last.blind && <span className="shrink-0 rounded-full bg-paper-ink/10 px-2 py-0.5 text-xs">blind weitergegeben</span>}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 truncate text-[clamp(1.35rem,7.5vw,2rem)] font-extrabold leading-tight tracking-tight" data-testid="announced">{labelOf(last.value)}{last.value === MAEXCHEN && "!"}</div>
          <Pair value={last.value} className="h-[clamp(1.75rem,8vw,2.25rem)] shrink-0" />
        </div>
        {earlier.length > 0 && (
          <div className="truncate text-xs text-paper-ink/55">
            vorher: {earlier.map((a) => `${labelOf(a.value)}${a.blind ? " (blind)" : ""}`).join(" → ")}
          </div>
        )}
      </div>
    );
  }
  if (s.reveal) return <RevealCard r={s.reveal} players={players} viewer={viewer} />;
  return (
    <div className="glass shrink-0 rounded-2xl px-4 py-3 text-center text-muted-foreground">
      Neue Runde – <b className="text-foreground">{s.curId === viewer ? "du beginnst" : `${nameOf(players, s.curId)} beginnt`}</b>.
      <div className="text-xs">Jede Ansage ist erlaubt, ab 31.</div>
    </div>
  );
}

function RevealCard({ r, players, viewer }: { r: Reveal; players: Player[]; viewer: string | null }) {
  const who = (id: string) => (id === viewer ? "Du" : nameOf(players, id));
  const loserText = r.out ? `${who(r.loser)} ${r.loser === viewer ? "bist" : "ist"} raus!` : `${who(r.loser)} ${r.loser === viewer ? "verlierst" : "verliert"} ${r.cost === 2 ? "2 Leben" : "1 Leben"}`;
  return (
    <div className="pop shrink-0 rounded-2xl bg-paper px-4 py-2.5 text-paper-ink shadow-lg" data-testid="reveal">
      <div className="truncate text-sm font-semibold text-paper-ink/60">{who(r.by)} {r.by === viewer ? "deckst" : "deckt"} auf · Ansage {labelOf(r.value)}</div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-extrabold leading-tight">{r.truth ? "Stimmt!" : "Gelogen!"}</div>
          <div className="truncate text-sm font-semibold">{loserText}</div>
        </div>
        {r.dice && (
          <span className="flex shrink-0 flex-col items-center">
            <span className="flex h-9 gap-1"><Die value={r.dice[0]} className="size-full" /><Die value={r.dice[1]} className="size-full" /></span>
            <span className="text-xs text-paper-ink/60">lag: {labelOf(valueOf(r.dice))}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Alle 21 Würfe in drei Reihen: Zahlen, Pasche, Mäxchen – niedrigere als die letzte Ansage sind gesperrt */
function Picker({ minRank, value, onPick, mine }: { minRank: number; value: number | null; onPick: (v: number) => void; mine: number | null }) {
  return (
    <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Ansage" data-testid="picker">
      {ORDER.map((v) => {
        const ok = rankOf(v) >= minRank;
        const sel = value === v;
        const special = v === MAEXCHEN;
        return (
          <button key={v} type="button" role="radio" aria-checked={sel} disabled={!ok} aria-label={labelOf(v)} onClick={() => { vibrate(5); onPick(v); }}
            className={cn("relative h-[min(2.6rem,6.2vh)] rounded-lg text-[0.95rem] font-bold tabular-nums outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-25",
              sel ? "bg-ice text-navy-950" : special ? "bg-primary/25 text-foreground ring-1 ring-inset ring-primary/50" : "bg-navy-700/70 ring-1 ring-inset ring-border")}>
            {special ? "21" : v}
            {mine === v && <i className={cn("absolute top-1 right-1 size-1.5 rounded-full", sel ? "bg-navy-950" : "bg-ok")} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export function Board({ room, game: s, me, online, isHost, canAct, act, dispatch }: BoardProps<MaexState, MaexAction>) {
  const players = room.players;
  const local = me === null;
  const hints = useHints();
  const [pick, setPick] = useState<number | null>(null);
  const [blind, setBlind] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [asking, setAsking] = useState(false);
  const alive = players.filter((p) => isAlive(s, p.id));
  const { covered, reveal } = useHandoff(local && !s.table, s.curId, alive.length);

  // Neuer Zug: Auswahl zurücksetzen; frisch gewürfelt: Becher bleibt zu, bis man nachsieht
  useEffect(() => { setPick(null); setBlind(false); setAsking(false); setLifted(false); }, [s.curId, s.round.length]);
  useEffect(() => { setLifted(false); }, [s.n]);

  const maxLives = Math.max(1, ...Object.values(s.lives), Number(room.options.lives) || 3);

  if (s.over) {
    const outRank = (id: string) => s.out.indexOf(id);
    const ranking = [...players]
      .sort((a, b) => (s.lives[b.id] ?? 0) - (s.lives[a.id] ?? 0) || outRank(b.id) - outRank(a.id))
      .map((p) => ({ id: p.id, name: p.name, score: Math.max(0, s.lives[p.id] ?? 0) }));
    const left = s.winnerId ? s.lives[s.winnerId] ?? 0 : 0;
    return <ResultScreen winner={nameOf(players, s.winnerId)} subtitle={`noch ${left} Leben übrig`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Leben" />;
  }

  const cur = players.find((p) => p.id === s.curId);
  const myTurn = canAct && (local || me === s.curId) && !covered;
  const can = turnOptions(s, room.options);
  const last = lastOf(s);
  const curName = cur ? (cur.id === me ? "Du" : cur.name) : "?";
  // Eigener Wurf: lokal nur der Spieler am Zug (nach dem Sichtschutz), online die Sicht vom Server
  const myDice = !s.table && s.rolled && s.dice && (local ? !covered : me === s.curId) ? s.dice : null;
  const mine = myDice ? valueOf(myDice) : null;
  const picking = myTurn && (s.table ? !asking && can.announce : s.rolled || blind);

  const announce = () => {
    if (pick === null) return;
    vibrate(12);
    act({ type: "announce", value: pick });
  };

  const status = (() => {
    if (!cur) return "";
    if (s.table) return last ? "glaubt oder deckt auf" : "würfelt und sagt an";
    if (s.rolled) return "hat gewürfelt";
    if (last) return last.value === MAEXCHEN ? "muss aufdecken" : "glaubt oder deckt auf";
    return "würfelt";
  })();

  return (
    <>
      <style>{CSS}</style>
      <Seats me={me} online={online} seats={players.map((p) => {
        const dead = !isAlive(s, p.id);
        return {
          id: p.id, name: p.name, cur: p.id === s.curId, out: dead, testId: `player-${p.name}`,
          sub: dead ? "raus" : <Lids n={s.lives[p.id] ?? 0} max={maxLives} light={p.id === s.curId} />,
        };
      })} />

      <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1.5 pb-1">
        <div className="flex shrink-0 items-center justify-between gap-2 px-1">
          <span className="min-w-0 truncate text-sm">
            <b className="text-base" data-testid="current-player">{curName}</b>{" "}
            <span className="text-muted-foreground"><SmoothText>{status}</SmoothText></span>
          </span>
          <RulesSheet gameId={room.gameId} />
        </div>
        <div className="relative z-10 shrink-0"><Stage s={s} players={players} viewer={local ? null : me} /></div>
        {!s.table ? (
          <div className="flex min-h-0 flex-1 justify-center">
            <Cup dice={myDice} lifted={lifted} canPeek={!!myDice} shakeKey={s.rolled ? s.n : 0} onToggle={() => setLifted((l) => !l)} empty={!s.round.length && !s.rolled} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 justify-center">
            <Cup dice={null} lifted={false} canPeek={false} shakeKey={0} onToggle={() => {}} empty={!s.round.length} />
          </div>
        )}
      </div>

      <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {covered ? (
          <div className="glass grid cursor-pointer gap-3 rounded-2xl p-4 text-center" onClick={reveal} data-testid="handoff">
            <p className="text-muted-foreground">Gib das Handy an <b className="text-foreground">{cur?.name}</b>.</p>
            <Button size="lg" onClick={(e) => { e.stopPropagation(); reveal(); }}>Ich bin {cur?.name}</Button>
          </div>
        ) : !myTurn ? (
          <p className="glass rounded-xl py-4 text-center text-muted-foreground">Warte auf <b className="text-foreground">{cur?.name}</b></p>
        ) : picking ? (
          <section className="glass grid gap-2 rounded-2xl p-2.5">
            <div className="flex min-h-6 items-center justify-between gap-2 px-0.5 text-sm">
              <b>{blind ? "Blind weitergeben – was sagst du an?" : "Was sagst du an?"}</b>
              {hints && pick !== null && mine !== null && (
                <HintChip>{rankOf(mine) >= rankOf(pick) ? "Das stimmt" : "Das ist geblufft"}</HintChip>
              )}
              {hints && pick === null && mine !== null && last && rankOf(mine) <= rankOf(last.value) && <HintChip>Dein Wurf reicht nicht</HintChip>}
            </div>
            <Picker minRank={can.minRank} value={pick} onPick={setPick} mine={lifted ? mine : null} />
            <div className={cn("grid gap-2", (blind || (s.table && last)) ? "grid-cols-[auto_1fr]" : "grid-cols-1")}>
              {blind && <Button size="lg" variant="secondary" aria-label="Zurück" onClick={() => { setBlind(false); setPick(null); }}><Undo2 /></Button>}
              {s.table && last && <Button size="lg" variant="secondary" onClick={() => setAsking(true)}>Aufdecken</Button>}
              <Button size="lg" disabled={pick === null} onClick={announce} data-testid="announce">
                {pick === null ? "Wert wählen" : `${labelOf(pick)} ansagen`}
              </Button>
            </div>
          </section>
        ) : s.table && asking && last ? (
          <section className="glass grid gap-2 rounded-2xl p-2.5">
            <p className="px-1 text-center text-sm">Becher hoch! Liegt mindestens <b>{labelOf(last.value)}</b>?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" variant="secondary" onClick={() => act({ type: "reveal", truth: true })}>Stimmt</Button>
              <Button size="lg" variant="secondary" onClick={() => act({ type: "reveal", truth: false })}>Gelogen</Button>
            </div>
            <Button variant="ghost" onClick={() => setAsking(false)}>Doch nicht aufdecken</Button>
          </section>
        ) : (
          <section className="glass grid gap-2 rounded-2xl p-2.5">
            {last ? (
              <>
                <div className="flex min-h-6 items-center justify-between gap-2 px-0.5 text-sm">
                  <span>Glaubst du <b>{labelOf(last.value)}</b>?</span>
                  {hints && <HintChip>Chance {Math.round(chanceAtLeast(last.value) * 100)} %</HintChip>}
                </div>
                <div className={cn("grid gap-2", can.roll ? "grid-cols-2" : "grid-cols-1")}>
                  <Button size="lg" variant={can.roll ? "secondary" : "default"} onClick={() => { vibrate(15); if (s.table) setAsking(true); else act({ type: "reveal" }); }} data-testid="reveal-btn">Aufdecken!</Button>
                  {can.roll && <Button size="lg" onClick={() => { vibrate(15); act({ type: "roll" }); }}><Dices />Glauben</Button>}
                </div>
                {can.blind && <Button variant="ghost" className="h-9" onClick={() => setBlind(true)}>Glauben, aber blind weitergeben</Button>}
              </>
            ) : s.table ? null : (
              <Button size="lg" onClick={() => { vibrate(15); act({ type: "roll" }); }}><Dices />Würfeln</Button>
            )}
          </section>
        )}
      </div>
    </>
  );
}
