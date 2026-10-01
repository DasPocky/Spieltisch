import { ArrowLeftRight, Clover, Hand, Heart, Hourglass, Layers, LifeBuoy, Skull, Snowflake, Trash, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { bustOdds, cardLabel, linePoints, numValue, type F7Action, type F7Card, type F7State } from "@shared/games/flip7/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { ScorePad } from "@/platform/ScorePad";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { HintChip } from "@/platform/HintChip";
import { usePrefs } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";

const STATUS: Record<string, string> = { active: "", stayed: "aufgehört", bust: "raus", frozen: "eingefroren", done: "fertig" };

/** Zahlenfarben wie auf den Originalkarten: jede Zahl ihr eigener Farbton */
const NUM_COLOR = ["#7d8590", "#8a8a1f", "#5f9e12", "#e04a86", "#0f9a8e", "#2d9a46", "#8b4cc4", "#e2522a", "#2793d1", "#ec8412", "#d0294f", "#2f5fd0", "#87684f", "#3c4352"];

/** Aktionskarten: Hintergrund, Rahmen, Schrift und Symbol */
const ACTION: Record<string, { bg: string; frame: string; ink: string; Icon: LucideIcon }> = {
  "a:freeze": { bg: "linear-gradient(160deg,#eef9ff,#a9dcf7)", frame: "#3a9ad6", ink: "#0f5384", Icon: Snowflake },
  "a:flip3": { bg: "linear-gradient(160deg,#fff3a6,#ffc81f)", frame: "#e79a00", ink: "#7a3d00", Icon: Layers },
  "a:second": { bg: "linear-gradient(160deg,#ff8aa0,#e2304f)", frame: "#fff3", ink: "#fff", Icon: Heart },
  "a:flip4": { bg: "linear-gradient(160deg,#ffcf8a,#f2761c)", frame: "#c95400", ink: "#5c2200", Icon: Layers },
  "a:one": { bg: "linear-gradient(160deg,#e7dcff,#b49af0)", frame: "#7b5ad0", ink: "#3b2378", Icon: Hourglass },
  "a:swap": { bg: "linear-gradient(160deg,#d5f7ef,#7fd9c4)", frame: "#1d9c83", ink: "#0b4f42", Icon: ArrowLeftRight },
  "a:steal": { bg: "linear-gradient(160deg,#4b4f63,#262a3a)", frame: "#8a90a8", ink: "#fff", Icon: Hand },
  "a:discard": { bg: "linear-gradient(160deg,#eceff3,#bcc3cf)", frame: "#7d8796", ink: "#2c3442", Icon: Trash },
};

/** Kleine Karte im Stil der Originalkarten: cremefarben mit farbiger Zahl, Plus-Karten orange, Aktionen mit Symbol */
export function Tile({ card, selectable, selected, onClick }: { card: F7Card; selectable?: boolean; selected?: boolean; onClick?: () => void }) {
  const num = card.startsWith("n:");
  const v = num ? numValue(card) : 0;
  const act = ACTION[card];
  const minus = card.startsWith("m:-") || card === "m:/2";
  // Farben je Kartenart: Zahl, Modifikator (Plus orange, Minus rot) oder Aktion
  const color = num ? NUM_COLOR[Math.min(v, 13)] : act ? act.frame : minus ? "#9e1b2e" : "#d9700a";
  const bg = num ? "#fbf6e9" : act ? act.bg : minus ? "linear-gradient(160deg,#ff9a8a,#d93a3a)" : card === "m:x2" ? "linear-gradient(160deg,#ffd84d,#ff8a1a)" : "linear-gradient(160deg,#fff0a0,#ffb52e)";
  const ink = num ? color : act ? act.ink : minus ? "#fff" : "#8a3300";
  const Special = card === "n:13L" ? Clover : card === "n:7U" ? Skull : null;
  return (
    <button type="button" disabled={!selectable} onClick={onClick} aria-label={cardLabel(card)} aria-pressed={selected}
      className={cn("card-in relative flex h-11 min-w-9 shrink-0 flex-col items-center justify-center rounded-lg px-1.5 font-bold leading-none shadow-[0_1px_3px_rgba(2,8,23,.35)] ring-1 ring-black/10 outline-none transition disabled:cursor-default focus-visible:ring-[3px] focus-visible:ring-ring",
        num ? "text-xl" : act ? "px-1 text-[0.5rem] leading-[1.1]" : "text-[0.95rem]", selectable && "target-glow", selected && "-translate-y-1 ring-[3px] ring-ice")}
      style={{ background: bg, color: ink }}>
      {/* Feiner Innenrahmen wie auf den echten Karten */}
      <span className="pointer-events-none absolute inset-[2.5px] rounded-[5px] border-[1.5px]" style={{ borderColor: color }} aria-hidden="true" />
      {num ? (
        <>
          <span className="relative font-black tracking-tight" style={{ textShadow: "0 1px 0 rgba(0,0,0,.14)" }}>{v}</span>
          {Special && <Special className="relative mt-px size-2.5" aria-hidden="true" />}
        </>
      ) : act ? (
        <>
          <act.Icon className="relative size-4 shrink-0" strokeWidth={2.5} fill={card === "a:second" ? "currentColor" : "none"} aria-hidden="true" />
          <span className="relative mt-0.5 max-w-12 text-center font-extrabold">{cardLabel(card)}</span>
        </>
      ) : (
        <span className="relative font-black tracking-tight" style={{ textShadow: minus ? "0 1px 0 rgba(0,0,0,.3)" : "0 1px 0 rgba(255,255,255,.6)" }}>{cardLabel(card)}</span>
      )}
    </button>
  );
}

/** Flip 7: Punkteleiste, der Tisch mit allen Reihen, unten Karte ziehen oder aufhören. */
export function Board({ room, game: s, me, online, isHost, canAct, act, dispatch }: BoardProps<F7State, F7Action>) {
  const players = room.players;
  const [sel, setSel] = useState<{ owner: string; index: number }[]>([]);
  const { hints } = usePrefs();
  const entries = players.map((p) => ({ id: p.id, name: p.name, score: s.scores[p.id] ?? 0, progress: (s.scores[p.id] ?? 0) / s.target }));

  if (s.winners.length) {
    const names = s.winners.map((id) => players.find((p) => p.id === id)?.name ?? "?");
    return <ResultScreen winner={names.join(" & ")} subtitle={`mit ${s.scores[s.winners[0]]} Punkten`} ranking={[...entries].sort((a, b) => b.score - a.score)} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />;
  }
  if (s.mode === "table" && s.pad) {
    return <ScorePad pad={s.pad} players={players} me={me} isHost={isHost} online={online} act={act} gameId={room.gameId}
      info={`Runde ${s.pad.round} · bis ${s.target}`}
      hint="Jeder trägt seine Rundenpunkte ein (Zahlen, Plus-Karten, ×2 und +15 für Flip 7 schon eingerechnet; raus = 0)." />;
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
  // Spielhilfe: Wie wahrscheinlich platzt die Reihe bei „Noch eine!“? Der Stapel ergibt sich aus den offenen Karten.
  const odds = hints && mine && !p && decider ? bustOdds(s, decider) : null;
  const risk = odds ? (odds.bust / odds.total >= 0.3 ? "hoch" : odds.bust / odds.total >= 0.15 ? "mittel" : "niedrig") : null;

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
          <span className="flex items-center gap-2">
            {risk && <HintChip testId="risk">Risiko: {risk}</HintChip>}
            <RulesSheet gameId={room.gameId} />
          </span>
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
