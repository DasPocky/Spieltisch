import { Clover, LifeBuoy, Skull } from "lucide-react";
import { useState } from "react";
import { cardLabel, linePoints, numValue, type F7Action, type F7Card, type F7State } from "@shared/games/flip7/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { cn, vibrate } from "@/lib/utils";

const STATUS: Record<string, string> = { active: "", stayed: "aufgehört", bust: "raus", frozen: "eingefroren", done: "fertig" };

/** Kleine Karte: Zahlen farbig nach Wert, Aktionen und Modifikatoren eigens gefärbt */
export function Tile({ card, selectable, selected, onClick }: { card: F7Card; selectable?: boolean; selected?: boolean; onClick?: () => void }) {
  const num = card.startsWith("n:");
  const v = num ? numValue(card) : 0;
  // Zahlen: helles bis dunkles Navy je nach Wert; Aktionen dunkel, Plus-Karten Eisblau, Minus gedämpftes Rot
  const light = 94 - Math.min(v, 13) * 3.4;
  const style = num ? { background: `hsl(216 42% ${light}%)`, color: light < 62 ? "#fff" : "#10223d" } : undefined;
  const cls = card.startsWith("a:") ? "bg-navy-700 text-white ring-1 ring-inset ring-navy-300/40" : card.startsWith("m:-") || card === "m:/2" ? "bg-destructive text-navy-950" : !num ? "bg-ice text-navy-950" : "";
  const Special = card === "n:13L" ? Clover : card === "n:7U" ? Skull : null;
  return (
    <button type="button" disabled={!selectable} onClick={onClick} aria-label={cardLabel(card)} aria-pressed={selected}
      className={cn("flex h-11 min-w-9 shrink-0 flex-col items-center justify-center rounded-lg px-1.5 font-extrabold leading-none shadow outline-none disabled:cursor-default focus-visible:ring-[3px] focus-visible:ring-ring",
        num ? "text-lg" : "text-[0.62rem] leading-tight", cls, selectable && "ring-2 ring-ice/70", selected && "-translate-y-1 ring-[3px] ring-ice")}
      style={style}>
      {num ? <>{v}{Special && <Special className="size-2.5" aria-hidden="true" />}</> : <span className="max-w-14 text-center">{cardLabel(card)}</span>}
    </button>
  );
}

/** Flip 7: Punkteleiste, der Tisch mit allen Reihen, unten Karte ziehen oder aufhören. */
export function Board({ room, game: s, me, online, isHost, canAct, act, dispatch }: BoardProps<F7State, F7Action>) {
  const players = room.players;
  const [sel, setSel] = useState<{ owner: string; index: number }[]>([]);
  const entries = players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0, progress: (s.scores[p.id] ?? 0) / s.target }));

  if (s.winners.length) {
    const names = s.winners.map((id) => players.find((p) => p.id === id)?.name ?? "?");
    return <ResultScreen winner={names.join(" & ")} subtitle={`mit ${s.scores[s.winners[0]]} Punkten`} ranking={[...entries].sort((a, b) => b.score - a.score)} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
  }

  const nameOf = (id: string | null) => (id === me ? "Du" : players.find((p) => p.id === id)?.name ?? "?");
  const decider = s.pending ? s.pending.by : s.curId;
  const mine = canAct && decider !== null;
  const p = s.pending;
  const pickMode = mine && p && (p.kind === "pickCard" || p.kind === "swap");
  const canPick = (owner: string, index: number) => {
    if (!pickMode || !p) return false;
    const l = s.lines[owner];
    if (p.kind === "swap") return index < l.nums.length && !sel.some((x) => x.owner === owner && x.index !== index);
    return p.card !== "a:steal" || owner !== p.by;
  };
  const toggle = (owner: string, index: number) => {
    vibrate(6);
    if (p?.kind === "pickCard") { act({ type: "pick", owner, index }); return; }
    const exists = sel.some((x) => x.owner === owner && x.index === index);
    const next = exists ? sel.filter((x) => !(x.owner === owner && x.index === index)) : [...sel, { owner, index }].slice(-2);
    if (next.length === 2 && next[0].owner !== next[1].owner) { act({ type: "swap", a: next[0], b: next[1] }); setSel([]); } else setSel(next);
  };
  const targets = p?.kind === "target"
    ? players.filter((x) => s.lines[x.id]?.status === "active" && (p.card === "a:freeze" || p.card === "a:flip3" || p.card === "a:flip4" || p.card === "a:one" || x.id !== p.by) && !(p.card === "a:second" && s.lines[x.id]?.second))
    : [];
  const myLine = decider ? s.lines[decider] : null;

  return (
    <>
      <Scoreboard entries={entries} currentId={decider} me={me} online={online} />
      {s.lastRound && s.lastRound.round === s.round - 1 && (
        <p className="shrink-0 truncate rounded-xl bg-navy-950/50 px-3 py-1.5 text-center text-xs text-muted-foreground" data-testid="last-round">
          Runde {s.lastRound.round}: {players.map((x) => `${x.name} +${s.lastRound!.points[x.id] ?? 0}`).join(" · ")}{s.lastRound.flip7 ? ` · Flip 7: ${nameOf(s.lastRound.flip7)}!` : ""}
        </p>
      )}

      {/* Der Tisch */}
      <div className="no-scrollbar mt-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto" data-testid="table">
        {players.map((x) => {
          const l = s.lines[x.id];
          if (!l) return null;
          const cards = [...l.nums, ...l.mods];
          return (
            <div key={x.id} className={cn("rounded-xl px-2.5 py-2", x.id === decider ? "bg-navy-600/60 ring-1 ring-inset ring-navy-300/50" : "glass", l.status === "bust" && "opacity-50")}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-bold">{nameOf(x.id)}{x.id === s.dealerId && <span className="ml-1 text-xs font-normal text-muted-foreground">(Geber)</span>}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  {l.second && <LifeBuoy className="size-4 text-ice" aria-label="Zweite Chance" />}
                  {STATUS[l.status] && <span className="rounded-full bg-navy-950/60 px-2 py-0.5 font-semibold text-muted-foreground">{STATUS[l.status]}</span>}
                  <b className="tabular-nums">{linePoints(l)}</b>
                </span>
              </div>
              <div className="no-scrollbar flex gap-1 overflow-x-auto pb-0.5">
                {cards.length ? cards.map((c, i) => (
                  <Tile key={`${c}-${i}`} card={c} selectable={canPick(x.id, i)} selected={sel.some((y) => y.owner === x.id && y.index === i)} onClick={() => toggle(x.id, i)} />
                )) : <span className="py-2 text-xs text-muted-foreground">noch keine Karten</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-center justify-between px-1 text-sm text-muted-foreground">
          <span>Runde {s.round} · Ziel {s.target}</span>
          <RulesSheet gameId={room.gameId} />
        </div>
        {!mine ? (
          <div className="glass rounded-xl py-4 text-center text-muted-foreground">Warte auf <b className="text-foreground">{nameOf(decider)}</b>{p ? ` (${cardLabel(p.card)})` : ""}</div>
        ) : p?.kind === "target" ? (
          <div className="glass rounded-2xl p-2.5">
            <p className="mb-2 text-center text-sm font-semibold">{nameOf(p.by)} zieht <b className="text-ice">{cardLabel(p.card)}</b> – wen trifft's?</p>
            <div className="grid grid-cols-2 gap-1.5">
              {targets.map((x) => <Button key={x.id} variant="secondary" onClick={() => act({ type: "target", target: x.id })}>{nameOf(x.id)}</Button>)}
            </div>
          </div>
        ) : p ? (
          <div className="glass rounded-2xl p-3 text-center text-sm font-semibold">
            <b className="text-ice">{cardLabel(p.card)}:</b> {p.kind === "swap" ? "Tippe zwei Zahlenkarten von verschiedenen Spielern an." : p.card === "a:steal" ? "Tippe die Karte an, die du klaust." : "Tippe die Karte an, die weg soll."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Button size="lg" variant="secondary" onClick={() => { vibrate(10); act({ type: "stay" }); }}>Aufhören ({myLine ? linePoints(myLine) : 0})</Button>
            <Button size="lg" onClick={() => { vibrate(15); act({ type: "hit" }); }}>Noch eine!</Button>
          </div>
        )}
      </div>
    </>
  );
}
