import { useEffect, useState } from "react";
import { dealDelay, Fan } from "@/platform/cards/Fan";
import { PlayerRow } from "@/platform/PlayerRow";
import { Ban, Check, ChevronLeft, SkipForward } from "lucide-react";
import {
  cardLabel, colorOf, extend, findPhase, isSkip, isWild, leaders, needLabel, PHASES, phaseLabel, valueOf,
  type Group, type P10Action, type P10Card, type P10Color, type P10State,
} from "@shared/games/phase10/logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { HandoffCover, useHandoff } from "@/platform/Handoff";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { MUTED } from "@/lib/palette";
import { SmoothText } from "@/platform/SmoothText";
import { cn, vibrate } from "@/lib/utils";

export const P10_INK: Record<P10Color, string> = { r: MUTED.red, b: MUTED.blue, g: MUTED.teal, y: MUTED.ochre };

/** Karte: Papier mit farbiger Zahl; Joker und Aussetzen dunkel */
export function P10CardView({ card, className, dim }: { card: P10Card; className?: string; dim?: boolean }) {
  const col = colorOf(card);
  return (
    <div role="img" aria-label={cardLabel(card)}
      className={cn("@container grid aspect-[5/7] place-items-center overflow-hidden rounded-[12%] font-bold shadow ring-1 ring-black/10 transition",
        col ? "bg-paper" : "bg-navy-700 text-ice ring-ice/40", dim && "brightness-50", className)}>
      {col ? <span className="self-start justify-self-start pt-[10%] pl-[9%] text-[44cqw] leading-none tracking-tighter" style={{ color: P10_INK[col] }}>{valueOf(card)}</span>
        : isWild(card) ? <span className="text-[48cqw] leading-none">W</span>
        : <Ban className="size-[55cqw]" strokeWidth={2.5} />}
    </div>
  );
}

export function Board(props: BoardProps<P10State, P10Action>) {
  if (props.game.step === "over") return <Result {...props} />;
  return props.game.mode === "table" ? <TableBoard {...props} /> : <AppBoard {...props} />;
}

function Result({ room, game: s, isHost, dispatch }: BoardProps<P10State, P10Action>) {
  const win = leaders(s, room.players).map((id) => room.players.find((p) => p.id === id)?.name ?? "?");
  const ranking = room.players.map((p) => ({ id: p.id, name: `${p.name} · ${(s.phase[p.id] ?? 1) > s.goal ? "alle Phasen" : `Phase ${s.phase[p.id] ?? 1}`}`, score: s.scores[p.id] ?? 0 }))
    .sort((a, b) => (s.phase[b.id] ?? 1) - (s.phase[a.id] ?? 1) || a.score - b.score);
  return <ResultScreen winner={win.join(" & ")} subtitle={s.goal === 10 ? "hat alle zehn Phasen geschafft" : `hat alle ${s.goal} Phasen geschafft`} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Strafpunkte" />;
}

/** Kleine Kartenreihe für ausgelegte Gruppen */
function Mini({ cards }: { cards: P10Card[] }) {
  return <span className="flex">{cards.map((c, i) => <P10CardView key={i} card={c} className={cn("w-[1.35rem] shrink-0 rounded-[18%]", i > 0 && "-ml-1.5")} />)}</span>;
}
const groupText = (g: Group) => (g.kind === "set" ? `${g.cards.length}× ${g.value}` : g.kind === "run" ? `${g.lo}–${g.hi}` : `${g.cards.length}× Farbe`);

function AppBoard({ room, game: s, me, online, canAct, act }: BoardProps<P10State, P10Action>) {
  const players = room.players;
  const local = me === null;
  const { covered, reveal } = useHandoff(local && (s.step === "draw" || s.step === "play"), s.curId, players.length);
  const cur = players.find((p) => p.id === s.curId);
  const viewer = local ? s.curId : me;
  const hand = viewer ? s.hands[viewer] ?? [] : [];
  const myTurn = canAct && (s.step === "draw" || s.step === "play") && viewer === s.curId && !covered;
  const myPhase = viewer ? s.phase[viewer] ?? 1 : 1;
  const needs = PHASES[myPhase - 1] ?? [];
  const laidMine = !!(viewer && s.laid[viewer]);

  const [sel, setSel] = useState<number[]>([]);
  const [slots, setSlots] = useState<number[][] | null>(null);
  const [skipPick, setSkipPick] = useState(false);
  const handKey = `${s.n}|${s.step}|${hand.join(",")}`;
  useEffect(() => { setSel([]); setSlots(null); setSkipPick(false); }, [handKey]);

  const inSlots = new Set(slots?.flat() ?? []);
  const toggle = (i: number) => { if (!myTurn || s.step !== "play") return; vibrate(5); setSel((x) => (x.includes(i) ? x.filter((j) => j !== i) : [...x, i])); };
  const one = sel.length === 1 ? hand[sel[0]] : null;
  const top = s.discard[s.discard.length - 1];

  const assign = (k: number) => { if (!slots) return; setSlots(slots.map((g, j) => (j === k ? [...g, ...sel] : g))); setSel([]); };
  const suggest = () => {
    const found = findPhase(hand, myPhase);
    if (!found) return false;
    const used = new Set<number>();
    setSlots(found.map((g) => g.map((c) => { const i = hand.findIndex((x, j) => x === c && !used.has(j)); used.add(i); return i; })));
    setSel([]);
    return true;
  };
  const [noFind, setNoFind] = useState(false);
  useEffect(() => { setNoFind(false); }, [handKey]);
  const lay = () => { if (!slots) return; vibrate(15); act({ type: "lay", groups: slots.map((g) => g.map((i) => hand[i])) }); };
  const hit = (owner: string, g: number) => { if (!one) return; vibrate(10); act({ type: "hit", card: one, owner, g }); };
  const discard = (skip?: string) => {
    if (!one) return;
    if (isSkip(one) && !skip && players.length > 2) { setSkipPick(true); return; }
    vibrate(10);
    act({ type: "discard", card: one, skip });
  };

  const status = s.step === "roundEnd" ? `Runde ${s.round} vorbei`
    : !myTurn ? `${cur?.name} ist am Zug`
    : s.step === "draw" ? "Zieh vom Stapel oder nimm die oberste Ablage."
    : slots ? "Karten markieren, dann „Hierher“ bei der Gruppe."
    : laidMine ? "Anlegen: Karte markieren, dann Gruppe antippen. Zum Schluss eine Karte ablegen."
    : "Phase auslegen – oder eine Karte markieren und ablegen.";
  const layers = players.filter((p) => s.laid[p.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mitspieler: Phase, Karten, Punkte */}
      <PlayerRow>
        {players.map((p) => (
          <div key={p.id} data-cur={p.id === s.curId}
            className={cn("flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold",
              p.id === s.curId && s.step !== "roundEnd" ? "turn" : "glass")}>
            {online && <span className={cn("size-1.5 rounded-full", online.has(p.id) ? "bg-ok" : "bg-current opacity-30")} />}
            <span className="max-w-[6rem] truncate">{p.id === me ? "Du" : p.name}</span>
            <span className="rounded bg-current/10 px-1 text-xs tabular-nums" aria-label={`Phase ${s.phase[p.id]}`}>P{Math.min(s.goal, s.phase[p.id] ?? 1)}</span>
            {s.laid[p.id] && <Check className="size-3.5" aria-label="Phase liegt" />}
            {(s.skips[p.id] ?? 0) > 0 && <SkipForward className="size-3.5 opacity-80" aria-label="setzt aus" />}
            <span className="text-xs font-normal tabular-nums opacity-75">{s.counts[p.id] ?? 0} · {s.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </PlayerRow>

      {s.step === "roundEnd" ? <RoundEnd room={room} s={s} act={act} /> : (
        <>
          {/* Ausgelegte Gruppen */}
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto py-1" data-testid="table">
            <p className="mb-1.5 px-1 text-sm"><b>{viewer === me || local ? "Deine" : ""} Phase {myPhase}:</b> <span className="text-muted-foreground">{phaseLabel(myPhase)}</span></p>
            {layers.length === 0 && <p className="glass rounded-xl px-3 py-4 text-center text-sm text-muted-foreground">Noch hat niemand seine Phase ausgelegt.</p>}
            <ul className="grid gap-1.5">
              {layers.map((p) => (
                <li key={p.id} className="glass rounded-xl px-2.5 py-1.5">
                  <p className="mb-1 text-xs text-muted-foreground">{p.name} · Phase {s.phase[p.id]}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.laid[p.id].map((g, k) => {
                      const ok = myTurn && s.step === "play" && laidMine && !slots && !!one && !!extend(g, one);
                      return (
                        <button key={k} type="button" disabled={!ok} onClick={() => hit(p.id, k)} aria-label={`An ${p.name}s Gruppe ${groupText(g)} anlegen`}
                          className={cn("flex items-center gap-1.5 rounded-lg bg-navy-900/60 px-1.5 py-1 text-xs tabular-nums ring-1 ring-inset ring-border transition disabled:cursor-default", ok && "target-glow ring-0")}>
                          <Mini cards={g.cards} /><span className="text-muted-foreground">{groupText(g)}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Stapel und Ablage */}
          <div className="flex shrink-0 items-center justify-center gap-3 py-1.5">
            <button type="button" disabled={!myTurn || s.step !== "draw"} onClick={() => { vibrate(8); act({ type: "draw", from: "pile" }); }} aria-label={`Vom Stapel ziehen (${s.pileCount})`}
              className={cn("card-back grid aspect-[5/7] w-12 place-items-center rounded-[12%] text-sm font-bold text-paper/85 shadow outline-none disabled:cursor-default", myTurn && s.step === "draw" && "target-glow")}>{s.pileCount}</button>
            <button type="button" disabled={!myTurn || s.step !== "draw" || !top || isSkip(top)} onClick={() => { vibrate(8); act({ type: "draw", from: "discard" }); }}
              aria-label={top ? `Ablage nehmen: ${cardLabel(top)}` : "Ablage leer"} className={cn("w-12 rounded-[12%] outline-none disabled:cursor-default", myTurn && s.step === "draw" && top && !isSkip(top) && "target-glow")}>
              {top ? <P10CardView key={s.discard.length} card={top} className="card-land" /> : <div className="aspect-[5/7] rounded-[12%] ring-1 ring-dashed ring-border" />}
            </button>
            <span data-testid="status" className={cn("max-w-[13rem] text-sm leading-snug", myTurn ? "font-semibold" : "text-muted-foreground")}><SmoothText>{status}</SmoothText></span>
            <RulesSheet gameId={room.gameId} />
          </div>

          {/* Hand und Aktionen */}
          <div className="shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {covered ? <HandoffCover name={cur?.name ?? "?"} onReveal={reveal} /> : (
              <>
                {slots && (
                  <div className="mb-1.5 grid gap-1" data-testid="slots">
                    {needs.map((n, k) => (
                      <div key={k} className="glass flex items-center gap-2 rounded-xl px-2 py-1">
                        <span className="w-24 shrink-0 text-xs leading-tight text-muted-foreground">{needLabel(n)}</span>
                        <span className="min-w-0 flex-1 overflow-hidden"><Mini cards={slots[k].map((i) => hand[i])} /></span>
                        {slots[k].length > 0 && <Button size="sm" variant="ghost" className="px-2 text-muted-foreground" onClick={() => setSlots(slots.map((g, j) => (j === k ? [] : g)))}>Leeren</Button>}
                        <Button size="sm" variant="secondary" disabled={!sel.length} onClick={() => assign(k)}>Hierher</Button>
                      </div>
                    ))}
                  </div>
                )}
                <Fan count={hand.length - inSlots.size} className="pt-2.5" minShow={0.58}>
                    {hand.map((c, i) => inSlots.has(i) ? null : (
                      <button key={`${c}-${hand.slice(0, i).filter((x) => x === c).length}`} type="button" disabled={!myTurn || s.step !== "play"} style={dealDelay(i)} onClick={() => toggle(i)} aria-pressed={sel.includes(i)}
                        className={cn("card-in w-[min(14vw,3.6rem)] shrink-0 rounded-[12%] outline-none disabled:cursor-default",
                          sel.includes(i) && "-translate-y-2.5 ring-[3px] ring-ice")}>
                        <P10CardView card={c} />
                      </button>
                    ))}
                </Fan>
                {skipPick ? (
                  <div className="glass mt-2 grid gap-2 rounded-2xl p-2.5">
                    <p className="text-center text-sm font-semibold">Wer soll aussetzen?</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {players.filter((p) => p.id !== viewer).map((p) => <Button key={p.id} variant="secondary" onClick={() => discard(p.id)}>{p.name}</Button>)}
                    </div>
                  </div>
                ) : s.step === "draw" ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button size="lg" disabled={!myTurn} onClick={() => act({ type: "draw", from: "pile" })}>Ziehen</Button>
                    <Button size="lg" variant="secondary" disabled={!myTurn || !top || isSkip(top)} onClick={() => act({ type: "draw", from: "discard" })}>Ablage nehmen</Button>
                  </div>
                ) : slots ? (
                  <div className="mt-2 grid grid-cols-[auto_1fr_1fr] gap-2 [&>button]:min-w-0 [&>button]:px-3">
                    <Button size="lg" variant="ghost" className="text-muted-foreground" aria-label="Zurück" onClick={() => { setSlots(null); setSel([]); }}><ChevronLeft /></Button>
                    <Button size="lg" variant="secondary" onClick={() => setNoFind(!suggest())}>{noFind ? "Nichts da" : "Finden"}</Button>
                    <Button size="lg" disabled={slots.some((g, k) => g.length < needs[k].n)} onClick={lay}>Auslegen</Button>
                  </div>
                ) : (
                  <div className={cn("mt-2 grid gap-2 [&>button]:min-w-0 [&>button]:px-3", laidMine ? "grid-cols-1" : "grid-cols-2")}>
                    {!laidMine && <Button size="lg" variant="secondary" disabled={!myTurn} onClick={() => { setSlots(needs.map(() => [])); setSel([]); }}>Phase auslegen</Button>}
                    <Button size="lg" disabled={!myTurn || !one} onClick={() => discard()}>{one ? `${isWild(one) ? "Joker" : isSkip(one) ? "Aussetzen" : valueOf(one)} ablegen` : "Ablegen"}</Button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RoundEnd({ room, s, act }: { room: BoardProps["room"]; s: P10State; act: (a: P10Action) => void }) {
  const last = s.lastRound;
  return (
    <>
      <ul className="no-scrollbar mt-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto" data-testid="round-end">
        {room.players.map((p) => (
          <li key={p.id} className="glass flex items-center justify-between gap-2 rounded-xl px-3 py-2">
            <span className="min-w-0 truncate font-semibold">{p.name}</span>
            <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
              {last?.done.includes(p.id) ? <span className="flex items-center gap-1 text-ice"><Check className="size-4" />geschafft</span> : <span className="text-muted-foreground">nicht geschafft</span>}
              <span>+{last?.points[p.id] ?? 0}</span>
              <span className="text-muted-foreground">→ P{Math.min(s.goal, s.phase[p.id] ?? 1)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="shrink-0 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button size="lg" className="w-full" onClick={() => act({ type: "nextRound" })}>Nächste Runde</Button>
      </div>
    </>
  );
}

/** Echte Karten: Strafpunkte eintragen und abhaken, wer seine Phase geschafft hat */
function TableBoard(props: BoardProps<P10State, P10Action>) {
  const { room, game: s, me, isHost, act } = props;
  const players = room.players;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const local = me === null;
  const entries = players.map((p) => ({ id: p.id, name: `${p.name} · P${Math.min(s.goal, s.phase[p.id] ?? 1)}`, score: s.scores[p.id] ?? 0 }));
  const commit = (id: string) => {
    const raw = draft[id];
    if (raw === undefined) return;
    const n = raw.trim() === "" ? null : Number(raw);
    if (n !== null && !Number.isInteger(n)) return;
    act({ type: "enter", player: id, points: n });
  };
  const missing = players.filter((p) => s.entries[p.id] === null || s.entries[p.id] === undefined).length;

  return (
    <>
      <Scoreboard entries={entries} currentId={null} me={me} online={props.online} lowWins />
      <div className="flex shrink-0 items-center justify-between px-1 pt-1 text-sm text-muted-foreground">
        <span>Runde {s.round}</span>
        <RulesSheet gameId={room.gameId} />
      </div>
      <p className="shrink-0 px-1 text-sm text-muted-foreground">Strafpunkte der Handkarten eintragen (1–9: 5, 10–12: 10, Aussetzen 15, Joker 25) und abhaken, wer seine Phase geschafft hat.</p>
      <div className="no-scrollbar mt-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto">
        {players.map((p) => {
          const editable = local || isHost || p.id === me;
          const val = draft[p.id] ?? (s.entries[p.id] === null || s.entries[p.id] === undefined ? "" : String(s.entries[p.id]));
          const ph = s.phase[p.id] ?? 1;
          return (
            <div key={p.id} className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.id === me ? `${p.name} (du)` : p.name}</p>
                <p className="truncate text-xs text-muted-foreground">Phase {ph}: {phaseLabel(ph)}</p>
              </div>
              <Input value={val} disabled={!editable} inputMode="numeric" aria-label={`Punkte ${p.name}`} className="h-10 w-16 shrink-0 text-center text-lg font-bold"
                onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                onBlur={() => commit(p.id)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <button type="button" disabled={!editable} aria-pressed={!!s.done[p.id]} aria-label={`${p.name} hat Phase ${ph} geschafft`}
                onClick={() => act({ type: "setDone", player: p.id, done: !s.done[p.id] })}
                className={cn("grid size-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset", s.done[p.id] ? "bg-ice text-navy-950 ring-transparent" : "text-muted-foreground ring-border")}>
                <Check className="size-5" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="grid shrink-0 gap-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isHost ? (
          <Button size="lg" disabled={missing > 0} onClick={() => { vibrate(10); setDraft({}); act({ type: "finishRound" }); }}>
            {missing ? `Noch ${missing} ${missing === 1 ? "Eintrag" : "Einträge"}` : `Runde ${s.round} abschließen`}
          </Button>
        ) : <p className="glass rounded-xl py-3 text-center text-muted-foreground">{missing ? "Trag deine Punkte ein." : "Der Host schließt die Runde ab."}</p>}
      </div>
    </>
  );
}
