import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Dices, Lock, X } from "lucide-react";
import {
  CELLS, closeEndOf, colorOptions, crosses, idxOf, maxMissesOf, MIN_LOCK, pendingWhite, ROWS, rowPoints, suggestColor, suggestWhite,
  totalOf, valueAt, whiteOptions, whiteSum, type AkAction, type AkMark, type AkState,
} from "@shared/games/ankreuzspiel/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { DiceTray } from "@/platform/dice3d/DiceTray";
import { RollButton } from "@/platform/dice3d/RollButton";
import { useCountdown } from "@/platform/Countdown";
import { HintChip } from "@/platform/HintChip";
import { Seats } from "@/platform/Seats";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { speak } from "@/platform/speech";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";
import { diceOf } from "./dice";
import { narration } from "./narration";

type Props = BoardProps<AkState, AkAction>;
const nameIn = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";
const markLabel = (m: { row: number; n: number }) => `${ROWS[m.row].name} ${m.n}`;

export function Board(props: Props) {
  useNarration(props);
  useTimeUp(props);
  if (props.game.phase === "over") return <Result {...props} />;
  return <Play {...props} />;
}

function useNarration({ game: s, me, isHost, room }: Props) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<AkState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => nameIn(room.players, id));
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

/** Bedenkzeit um: jedes Handy meldet es (der Host sofort, die anderen etwas später) – gezählt wird nur das erste */
function useTimeUp({ game: s, isHost, act }: Props) {
  const deadline = s.phase === "white" ? s.deadline : null;
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

function Result({ room, game: s, isHost, dispatch }: Props) {
  const players = room.players.filter((p) => s.sheets[p.id]);
  const ranking = [...players].sort((a, b) => totalOf(s.sheets[b.id]) - totalOf(s.sheets[a.id])).map((p) => ({ id: p.id, name: p.name, score: totalOf(s.sheets[p.id]) }));
  const best = ranking[0]?.score ?? 0;
  const win = ranking.filter((r) => r.score === best).map((r) => r.name);
  const subtitle = s.endReason === "closed" ? `${closeEndOf(room.options) === 1 ? "Eine Reihe" : `${closeEndOf(room.options)} Reihen`} abgeschlossen`
    : s.endReason === "misses" ? `${maxMissesOf(room.options)} Fehlwürfe` : "Partie beendet";
  return (
    <ResultScreen winner={win.join(" & ")} subtitle={subtitle} ranking={ranking} isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />
  );
}

/** Was dieses Gerät gerade entscheidet (null = zuschauen/warten) */
function deciderOf(s: AkState, me: string | null, canAct: boolean): string | null {
  if (s.phase === "white") {
    const open = pendingWhite(s);
    if (me === null) return open[0] ?? null;
    return open.includes(me) ? me : null;
  }
  if (s.phase === "color") return canAct ? s.curId : null;
  return null;
}

function Play({ room, game: s, me, online, canAct, act }: Props) {
  const players = room.players;
  const local = me === null;
  const hints = useHints();
  const decider = deciderOf(s, me, canAct);
  const isPlayer = me !== null && !!s.sheets[me];
  const [viewId, setViewId] = useState<string | null>(null);
  useEffect(() => setViewId(null), [decider, s.turn]);
  const home = local ? decider ?? s.curId : isPlayer ? me : s.curId;
  const shown = viewId && s.sheets[viewId] ? viewId : home;
  const who = (id: string | null | undefined) => (id && id === me ? "Du" : nameIn(players, id));
  const options: AkMark[] = decider && shown === decider ? (s.phase === "white" ? whiteOptions(s, decider) : colorOptions(s, decider)) : [];
  const [sel, setSel] = useState<{ row: number; n: number } | null>(null);
  const selKey = `${decider}-${s.phase}-${s.n}`;
  useEffect(() => setSel(null), [selKey]);
  const tip = hints && decider && options.length
    ? s.phase === "white" ? (() => { const r = suggestWhite(s, decider); return r === null ? null : { row: r, n: whiteSum(s) }; })()
    : suggestColor(s, decider)
    : undefined;
  const open = pendingWhite(s);
  const left = useCountdown(s.phase === "white" ? s.deadline : null, false);

  const seats = players.map((p) => {
    const sh = s.sheets[p.id];
    const decided = s.phase === "white" && sh && !open.includes(p.id);
    return {
      id: p.id, name: p.name, cur: p.id === s.curId, out: !sh, testId: `player-${p.name}`,
      value: sh ? totalOf(sh) : undefined,
      sub: !sh ? "schaut zu" : s.phase === "white" ? (s.cannot.includes(p.id) ? "kann nicht" : decided ? "fertig" : "überlegt") : sh.misses ? `${sh.misses}✕` : "",
      label: `${p.name}, ${sh ? `${totalOf(sh)} Punkte, ${sh.misses} Fehlwürfe` : "schaut zu"}`,
    };
  });

  const head = s.phase === "roll" ? `${who(s.curId)} ${who(s.curId) === "Du" ? "würfelst" : "würfelt"}`
    : s.phase === "white" ? `Weiß ${whiteSum(s)} für alle`
    : `${who(s.curId)}: Weiß + Farbe`;

  return (
    <>
      <Seats me={me} online={online} seats={seats} selectedId={shown} onSelect={(id) => setViewId(id === home ? null : id)} pickable={(id) => !!s.sheets[id]} label="Mitspieler – antippen zeigt das Blatt" />
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 pt-1 pb-1">
        <div className="flex shrink-0 items-center justify-between gap-2 px-1">
          <span className="min-w-0 truncate text-sm" data-testid="turn-info">
            <b className="text-base">{head}</b>
            <span className="text-muted-foreground"> · {shown === me ? "dein Blatt" : `Blatt von ${nameIn(players, shown)}`}</span>
          </span>
          <RulesSheet gameId={room.gameId} />
        </div>
        {shown && s.sheets[shown] && (
          <SheetView s={s} id={shown} options={options} sel={sel} tip={tip ?? null} misses={maxMissesOf(room.options)}
            onPick={(m) => { vibrate(6); setSel((x) => (x && x.row === m.row && x.n === m.n ? null : { row: m.row, n: m.n })); }} />
        )}
      </div>
      <div className="shrink-0 pb-[calc(0.6rem+env(safe-area-inset-bottom))]">
        <Panel s={s} players={players} who={who} decider={decider} canAct={canAct} local={local} sel={sel} tip={tip} left={left} open={open} act={act}
          pick={(m) => setSel(m)} />
      </div>
    </>
  );
}

/** Das Blatt: vier Farbreihen à 11 Felder plus Schloss, darunter Fehlwürfe und Punkte */
function SheetView({ s, id, options, sel, tip, misses, onPick }: {
  s: AkState; id: string; options: AkMark[]; sel: { row: number; n: number } | null; tip: { row: number; n: number } | null; misses: number;
  onPick: (m: AkMark) => void;
}) {
  const sh = s.sheets[id];
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-[clamp(0.25rem,1dvh,0.6rem)] rounded-2xl bg-paper p-1.5 text-paper-ink shadow-md" data-testid="sheet">
      {ROWS.map((row, r) => {
        const last = sh.rows[r].at(-1) ?? -1;
        const shut = s.closed[r];
        return (
          <div key={row.key} className={cn("grid max-h-[5.5rem] min-h-[calc(1.3rem+6px)] flex-1 gap-[2px] rounded-lg p-[3px]", shut && !sh.locks[r] && "opacity-60")}
            style={{ background: row.color, gridTemplateColumns: `repeat(${CELLS + 1}, minmax(0, 1fr))`, gridTemplateRows: "minmax(0, 1fr)" }} role="group" aria-label={`${row.name}, ${crosses(sh, r)} Kreuze${shut ? ", abgeschlossen" : ""}`} data-testid={`row-${r}`}>
            {Array.from({ length: CELLS }, (_, i) => {
              const v = valueAt(r, i);
              const crossed = sh.rows[r].includes(i);
              const opt = options.find((o) => o.row === r && idxOf(r, o.n) === i);
              const picked = !!opt && sel?.row === r && sel.n === v;
              const hinted = !!opt && tip?.row === r && tip.n === v;
              const gone = !crossed && (i < last || shut);
              const state = crossed ? "crossed" : picked ? "selected" : opt ? "option" : gone ? "gone" : "free";
              return (
                <button key={i} type="button" disabled={!opt} onClick={opt ? () => onPick(opt) : undefined} data-testid={`cell-${r}-${i}`} data-state={state}
                  aria-label={`${row.name} ${v}${crossed ? ", angekreuzt" : picked ? ", gewählt" : opt ? ", ankreuzen" : ""}`} aria-pressed={opt ? picked : undefined}
                  className={cn("relative grid h-full min-h-0 min-w-0 place-items-center rounded-[6px] text-[clamp(0.72rem,min(4.4vw,3dvh),1.3rem)] font-bold tabular-nums outline-none transition",
                    "focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                    crossed ? "bg-white/80" : picked ? "bg-paper-ink text-white" : opt ? "bg-white ring-2 ring-paper-ink ring-inset" : gone ? "bg-white/35" : "bg-white/85",
                    hinted && !picked && "ak-hint")}
                  style={{ color: picked ? undefined : row.color }}>
                  <span className={cn((crossed || gone) && "opacity-35")}>{v}</span>
                  {(crossed || picked) && <X className={cn("absolute size-[85%]", picked ? "text-white" : "text-paper-ink")} strokeWidth={3} aria-hidden="true" />}
                  {i === CELLS - 1 && !crossed && !picked && sh.rows[r].length < MIN_LOCK && !shut && <span className="absolute right-0.5 bottom-0.5 text-[clamp(0.5rem,1.4dvh,0.7rem)] leading-none text-paper-ink/45" aria-hidden="true">{MIN_LOCK}</span>}
                </button>
              );
            })}
            <span className={cn("relative grid aspect-square max-h-full w-full min-w-0 place-items-center self-center rounded-full", sh.locks[r] ? "bg-white/90" : "bg-white/40")}
              data-testid={`lock-${r}`} data-state={sh.locks[r] ? "crossed" : shut ? "shut" : "open"}>
              <Lock className="size-[55%]" style={{ color: row.color }} aria-hidden="true" />
              {sh.locks[r] && <X className="absolute size-[85%] text-paper-ink" strokeWidth={3} aria-hidden="true" />}
            </span>
          </div>
        );
      })}
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pt-0.5 text-xs min-[380px]:[@media(min-height:740px)]:text-sm">
        <span className="flex items-center gap-1" aria-label={`${sh.misses} von ${misses} Fehlwürfen`} data-testid="misses">
          <span className="text-paper-ink/60">Fehlwürfe</span>
          {Array.from({ length: misses }, (_, k) => (
            <span key={k} className="grid size-4 place-items-center rounded-[3px] border border-paper-ink/40">{k < sh.misses && <X className="size-3.5" strokeWidth={3} />}</span>
          ))}
        </span>
        <span className="flex min-w-0 items-center gap-1 tabular-nums" data-testid="points">
          {ROWS.map((row, r) => <b key={row.key} className="min-w-5 rounded px-1 text-center" style={{ background: row.color, color: row.ink }}>{rowPoints(sh, r)}</b>)}
          {sh.misses > 0 && <span className="text-paper-ink/70">−{sh.misses * 5}</span>}
          <span className="text-paper-ink/60">=</span><b className="text-sm">{totalOf(sh)}</b>
        </span>
      </div>
    </div>
  );
}

function Panel({ s, players, who, decider, canAct, local, sel, tip, left, open, act, pick }: {
  s: AkState; players: Player[]; who: (id: string | null | undefined) => string; decider: string | null; canAct: boolean; local: boolean;
  sel: { row: number; n: number } | null; tip: { row: number; n: number } | null | undefined; left: number | null; open: string[];
  act: (a: AkAction) => void; pick: (m: { row: number; n: number }) => void;
}) {
  const shown = diceOf(s);
  const rolling = s.phase === "roll";
  const canRoll = rolling && canAct;
  const cur = nameIn(players, s.curId);
  const last = s.last;
  const lastLine = last
    ? last.marks.length || last.miss
      ? [...groupMarks(last.marks, who), ...(last.miss ? [`${who(last.by)}: Fehlwurf`] : [])].join(" · ")
      : "Niemand hat angekreuzt"
    : null;

  let status: ReactNode;
  let buttons: ReactNode = null;
  if (rolling) {
    status = lastLine ? <span className="truncate" data-testid="last-turn">{lastLine}</span> : <span>{canRoll ? (local ? `${cur}, du beginnst.` : "Du beginnst.") : `${cur} beginnt.`}</span>;
    if (canRoll) buttons = <RollButton onRoll={() => act({ type: "roll" })}><Dices className="max-[359px]:hidden" />{local ? `${cur}: Würfeln` : "Würfeln"}</RollButton>;
  } else if (decider) {
    const white = s.phase === "white";
    const hasOwn = s.marks.some((m) => m.id === decider);
    const miss = !white && !hasOwn;
    const name = local ? `${nameIn(players, decider)}: ` : "";
    status = tip !== undefined
      ? <HintChip onClick={tip ? () => pick(tip) : undefined}>Tipp: {tip ? `${markLabel(tip)} ankreuzen` : miss ? "lieber den Fehlwurf" : "lieber nichts"}</HintChip>
      : <span className="truncate">{name}{white ? `Weiß ${whiteSum(s)} – in einer Reihe ankreuzen?` : "Ein weißer plus ein farbiger Würfel?"}</span>;
    buttons = (
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" variant="secondary" className="px-2" onClick={() => { vibrate(8); act(white ? { type: "white", row: null, ...(local ? { player: decider } : {}) } : { type: "color", row: null }); }} data-testid="mark-pass">
          {white ? "Nicht ankreuzen" : miss ? "Fehlwurf" : "Keine Farbe"}
        </Button>
        <Button size="lg" className="px-2" disabled={!sel} data-testid="mark-go"
          onClick={() => { if (!sel) return; vibrate(12); act(white ? { type: "white", row: sel.row, ...(local ? { player: decider } : {}) } : { type: "color", row: sel.row, n: sel.n }); }}>
          <Check className="max-[359px]:hidden" />{sel ? `${markLabel(sel)}` : "Feld antippen"}
        </Button>
      </div>
    );
    if (local) status = <span className="flex min-w-0 items-center justify-center gap-2"><b className="truncate text-foreground">{nameIn(players, decider)}</b>{status}</span>;
  } else if (s.phase === "white") {
    const names = open.map((id) => who(id));
    status = <span className="truncate">{names.length ? `Warte auf ${names.join(", ")}` : "Gleich geht’s weiter"}</span>;
  } else {
    status = <span className="truncate">{cur} wählt eine Farbe</span>;
  }

  return (
    <section className="glass grid gap-1.5 rounded-2xl p-2">
      <DiceTray values={shown.values} tints={shown.tints} rollKey={`${s.turn}-${s.curId}`} className="h-[clamp(3.25rem,10dvh,5rem)]"
        label="Würfel: zwei weiße, dazu die farbigen" empty={canRoll ? "Tippe auf „Würfeln“" : `${cur} würfelt gleich`} onThrow={canRoll ? () => act({ type: "roll" }) : undefined} />
      <div className="flex min-h-6 items-center justify-center gap-2 text-center text-sm text-muted-foreground" data-testid="ak-status">
        {status}
        {left !== null && s.phase === "white" && <b className={cn("shrink-0 tabular-nums", left <= 10 ? "text-destructive" : "text-foreground")} data-testid="think-left">{left} s</b>}
      </div>
      {buttons}
    </section>
  );
}

/** „Anna Rot 7, Gelb 9 · Ben Rot 7“ */
function groupMarks(marks: AkMark[], who: (id: string) => string): string[] {
  const by = new Map<string, string[]>();
  for (const m of marks) by.set(m.id, [...(by.get(m.id) ?? []), markLabel(m)]);
  return [...by].map(([id, xs]) => `${who(id)}: ${xs.join(", ")}`);
}
