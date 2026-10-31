import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Plus, RotateCcw, Undo2 } from "lucide-react";
import {
  analyze, checkTable, FIRST, isValidMeld, normalize, sortTiles, standings, suggestPlay,
  type Tile, type ZrAction, type ZrState,
} from "@shared/games/zahlenromme/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { useCountdown } from "@/platform/Countdown";
import { HintChip } from "@/platform/HintChip";
import { useHandoff } from "@/platform/Handoff";
import { Seats } from "@/platform/Seats";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { speak } from "@/platform/speech";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";
import { fitGrid, fitWidth, GAP, GAP_X, GAP_Y, PAD, useSize } from "./fit";
import { narration } from "./narration";
import { TileFace, tileLabel } from "./Tile";

type Props = BoardProps<ZrState, ZrAction>;
const nameIn = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";
const steine = (n: number) => (n === 1 ? "1 Stein" : `${n} Steine`);

export function Board(props: Props) {
  useNarration(props);
  useTimeUp(props);
  if (props.game.phase === "over") return <Result {...props} />;
  if (props.game.phase === "round") return <RoundEnd {...props} />;
  return <Play {...props} />;
}

function useNarration({ game: s, me, isHost, room }: Props) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<ZrState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const parts = narration(before, s, (id) => nameIn(room.players, id));
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

/** Zugzeit um: jedes Handy meldet es (der Host sofort, die anderen etwas später) – gezählt wird nur das erste */
function useTimeUp({ game: s, isHost, act }: Props) {
  const deadline = s.phase === "play" ? s.deadline : null;
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
  const ranking = standings(s, room.players).map((x) => ({ id: x.id, name: nameIn(room.players, x.id), score: x.score }));
  const top = ranking[0]?.score ?? 0;
  const win = ranking.filter((r) => r.score === top).map((r) => r.name);
  return (
    <ResultScreen winner={win.join(" & ")} subtitle={`nach ${s.rounds.length === 1 ? "einer Runde" : `${s.rounds.length} Runden`}`} ranking={ranking}
      isHost={isHost} dispatch={dispatch} scoreLabel="Punkte" />
  );
}

/** Zwischen zwei Runden: wer gewonnen hat, was jeder noch hatte, Punkte der Runde und gesamt */
function RoundEnd({ room, game: s, act }: Props) {
  const r = s.rounds[s.rounds.length - 1];
  const players = room.players;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-2" data-testid="round-end">
      <div className="glass w-full max-w-sm rounded-2xl p-4 text-center">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Runde {r?.round}</p>
        <h2 className="mt-1 text-xl font-bold">{nameIn(players, r?.winner)} gewinnt</h2>
        <p className="text-sm text-muted-foreground">{r?.blocked ? "Pool leer – am wenigsten übrig" : "keine Steine mehr"}</p>
        <table className="mt-3 w-full text-sm tabular-nums">
          <thead><tr className="text-xs text-muted-foreground"><th className="text-left font-medium">Spieler</th><th className="font-medium">übrig</th><th className="font-medium">Runde</th><th className="text-right font-medium">gesamt</th></tr></thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className={cn(p.id === r?.winner && "font-bold")} data-testid={`round-row-${p.id}`}>
                <td className="truncate py-0.5 text-left">{p.name}</td>
                <td className="text-center">{r?.rest[p.id] ?? 0}</td>
                <td className={cn("text-center", (r?.points[p.id] ?? 0) >= 0 ? "text-[#2f8a4a]" : "text-destructive")}>{(r?.points[p.id] ?? 0) > 0 ? "+" : ""}{r?.points[p.id] ?? 0}</td>
                <td className="text-right">{s.scores[p.id] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="lg" className="w-full max-w-sm" data-testid="next-round" onClick={() => { vibrate(10); act({ type: "next" }); }}>Nächste Runde</Button>
    </div>
  );
}

interface Draft { table: Tile[][]; hand: Tile[] }
type Where = { kind: "hand" } | { kind: "group"; i: number };

function locate(d: Draft, t: Tile): Where | null {
  if (d.hand.includes(t)) return { kind: "hand" };
  const i = d.table.findIndex((g) => g.includes(t));
  return i >= 0 ? { kind: "group", i } : null;
}
const sameWhere = (a: Where | null, b: Where | null) => !!a && !!b && a.kind === b.kind && (a.kind === "hand" || (b.kind === "group" && a.i === b.i));

/** Steine aus ihrer Kombination bzw. der Bank nehmen und an ein Ziel legen; leere Kombinationen fallen weg */
function moveTiles(d: Draft, tiles: Tile[], to: "hand" | "new" | number): Draft {
  const set = new Set(tiles);
  let table = d.table.map((g) => g.filter((t) => !set.has(t)));
  const hand = d.hand.filter((t) => !set.has(t));
  if (to === "hand") hand.push(...tiles);
  else if (to === "new") table.push(tiles.slice());
  else table[to] = [...table[to], ...tiles];
  table = table.filter((g) => g.length).map(normalize);
  return { table, hand };
}

function Play({ room, game: s, me, online, canAct, act }: Props) {
  const players = room.players;
  const local = me === null;
  const hints = useHints();
  const handoffId = local && s.phase === "play" ? s.curId : null;
  const { covered, reveal } = useHandoff(local && !!handoffId, handoffId, players.length);
  const viewer = local ? handoffId : me;
  const myTurn = s.phase === "play" && !!viewer && viewer === s.curId && (local || canAct) && !covered;
  const ownHand = useMemo(() => (viewer ? s.hands[viewer] ?? [] : []), [viewer, s.hands]);
  const oldTiles = useMemo(() => new Set(s.table.flat()), [s.table]);
  const melded = !!viewer && !!s.melded[viewer];

  const [sortBy, setSortBy] = useState<"color" | "num">("color");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sel, setSel] = useState<Tile[]>([]);
  const turnKey = `${viewer}-${s.round}-${s.n}`;
  useEffect(() => { setDraft(null); setSel([]); }, [turnKey]);

  const d: Draft = draft ?? { table: s.table, hand: ownHand };
  const changed = draft !== null && JSON.stringify(draft.table) !== JSON.stringify(s.table);
  const check = useMemo(() => (viewer && myTurn ? checkTable(s, viewer, d.table) : null), [s, viewer, myTurn, d.table]);
  const tip = useMemo(() => (hints && myTurn && viewer && !changed ? suggestPlay(s, viewer) : null), [hints, myTurn, viewer, changed, s]);
  const left = useCountdown(s.phase === "play" ? s.deadline : null, false);

  // Darf dieser Stein bewegt werden? Eigene immer; vom Tisch erst nach dem ersten Auslegen
  const movable = (t: Tile) => myTurn && (d.hand.includes(t) || melded || !oldTiles.has(t));
  const returnable = (t: Tile) => ownHand.includes(t);
  // Ziel-Kombination? Beim ersten Auslegen nur neue Kombinationen
  const targetable = (i: number) => myTurn && (melded || !d.table[i].some((t) => oldTiles.has(t)));

  const update = (next: Draft) => { setDraft(next); setSel([]); vibrate(8); };
  const tapTile = (t: Tile) => {
    if (!myTurn) return;
    if (sel.includes(t)) { setSel(sel.filter((x) => x !== t)); return; }
    const at = locate(d, t);
    if (!sel.length || sameWhere(locate(d, sel[0]), at)) { if (movable(t)) { vibrate(5); setSel([...sel, t]); } return; }
    // Auswahl liegt woanders: auf diese Kombination legen bzw. zurück auf die Bank
    if (at?.kind === "group" && targetable(at.i)) update(moveTiles(d, sel, at.i));
    else if (at?.kind === "hand" && sel.every(returnable)) update(moveTiles(d, sel, "hand"));
    else if (movable(t)) setSel([t]);
  };
  const tapGroup = (i: number) => { if (sel.length && targetable(i) && !sel.every((t) => d.table[i].includes(t))) update(moveTiles(d, sel, i)); };
  const tapNew = () => { if (sel.length) update(moveTiles(d, sel, "new")); };
  const tapBank = () => { if (sel.length && sel.every(returnable) && !sel.every((t) => d.hand.includes(t))) update(moveTiles(d, sel, "hand")); };
  const reset = () => { setDraft(null); setSel([]); vibrate(10); };
  const finish = () => { if (check?.ok) { vibrate(14); act({ type: "commit", table: d.table }); } };
  const drawTile = () => { vibrate(12); act({ type: "draw" }); };
  const useTip = () => { if (tip && viewer) { const used = new Set(tip.table.flat()); update({ table: tip.table, hand: ownHand.filter((t) => !used.has(t)) }); } };

  const cur = nameIn(players, s.curId);
  const last = s.last;
  const placed = d.table.flat().filter((t) => !oldTiles.has(t)).length;
  const selFromTable = sel.length > 0 && locate(d, sel[0])?.kind === "group";
  const status = covered && handoffId ? `${nameIn(players, handoffId)} ist dran.`
    : !myTurn ? (last && last.id === viewer && last.kind === "time" ? "Zeit um – dein Zug wurde zurückgesetzt, du hast gezogen." : `${s.curId === me ? "Du bist" : `${cur} ist`} dran.`)
    : sel.length ? (selFromTable ? `${steine(sel.length)} gewählt – auf eine Kombination, „Neu“ oder zurück auf die Bank tippen.` : `${steine(sel.length)} gewählt – auf eine Kombination oder „Neu“ tippen.`)
    : changed && check && !check.ok ? check.error ?? "Noch nicht gültig."
    : changed ? `Gültig – ${steine(placed)} gelegt. „Fertig“ beendet den Zug.`
    : melded ? "Steine antippen und an den Tisch legen – oder einen ziehen." : `Erstes Auslegen: mindestens ${FIRST} Punkte aus eigenen Steinen.`;

  const firstPill = myTurn && !melded;
  const pts = check?.points ?? 0;
  return (
    <>
      <Seats me={me} online={online} seats={players.map((p) => ({
        id: p.id, name: p.name, cur: s.curId === p.id,
        label: `${p.name}: ${steine(s.counts[p.id] ?? 0)}, ${s.scores[p.id] ?? 0} Punkte${s.melded[p.id] ? "" : ", noch nicht ausgelegt"}`,
        value: <span data-testid={`count-${p.id}`}>{s.counts[p.id] ?? 0}</span>,
        sub: <>{s.melded[p.id] ? <span aria-hidden="true">✓ </span> : null}{s.scores[p.id] ?? 0} P.</>,
      }))} />

      <div className="flex shrink-0 items-center gap-1.5 px-1 text-sm whitespace-nowrap text-muted-foreground">
        {firstPill ? (
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset tabular-nums",
            pts >= FIRST ? "bg-[#2f8a4a]/15 text-[#2f8a4a] ring-[#2f8a4a]/40" : "bg-secondary ring-border")} data-testid="first-sum">
            Erstes Auslegen {pts}/{FIRST}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-border" data-testid="round-info">Runde {s.round}</span>
        )}
        {left !== null && (
          <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-inset", left <= 15 ? "bg-destructive/15 text-destructive ring-destructive/40" : "bg-secondary ring-border")} data-testid="turn-timer"
            aria-label={`Zugzeit: noch ${left} Sekunden`}>
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
        )}
        <span className={cn(left === null && "ml-auto")}><RulesSheet gameId={room.gameId} /></span>
      </div>

      <TableArea table={d.table} oldTiles={oldTiles} ownHand={ownHand} sel={sel} myTurn={myTurn} bad={check?.bad ?? d.table.flatMap((g, i) => (isValidMeld(g) ? [] : [i]))}
        targetable={targetable} movable={movable} onTile={tapTile} onGroup={tapGroup} onNew={tapNew} />

      <div className="flex shrink-0 items-center gap-2 px-1 pt-1 text-sm text-muted-foreground">
        <span data-testid="status" className={cn("min-w-0 flex-1 leading-tight", myTurn && "font-semibold text-foreground", myTurn && changed && check && !check.ok && "text-destructive")}><SmoothText>{status}</SmoothText></span>
        {hints && myTurn && !changed && (tip
          ? <HintChip onClick={useTip} className="shrink-0">Tipp: {steine(tip.laid)}</HintChip>
          : <HintChip className="shrink-0">Tipp: ziehen</HintChip>)}
      </div>

      <div className="shrink-0 pb-[calc(0.6rem+env(safe-area-inset-bottom))]">
        {covered && handoffId ? (
          <div className="glass grid cursor-pointer gap-3 rounded-2xl p-4 text-center" onClick={reveal} data-testid="handoff">
            <p className="text-muted-foreground">Gib das Handy an <b className="text-foreground">{nameIn(players, handoffId)}</b>.</p>
            <Button size="lg" onClick={(e) => { e.stopPropagation(); reveal(); }}>Ich bin {nameIn(players, handoffId)} – Steine zeigen</Button>
          </div>
        ) : !viewer ? null : (
          <>
            <Bank hand={sortTiles(d.hand, sortBy)} sel={sel} myTurn={myTurn} returnTarget={selFromTable && sel.every(returnable)}
              onTile={tapTile} onBank={tapBank} sortBy={sortBy} onSort={() => { vibrate(5); setSortBy(sortBy === "color" ? "num" : "color"); }} />
            <div className="mt-1.5 grid grid-cols-[auto_1fr_1fr] gap-2">
              <Button size="lg" variant="secondary" className="px-3" disabled={!myTurn || (!changed && !sel.length)} onClick={reset} data-testid="reset" aria-label="Zug zurücksetzen">
                <RotateCcw className="size-4" /><span className="max-[359px]:sr-only">Zurück</span>
              </Button>
              <Button size="lg" variant={myTurn && !tip && !changed ? "default" : "secondary"} className={cn("min-w-0 px-2", hints && myTurn && !tip && !changed && "hint-glow")} disabled={!myTurn} onClick={drawTile} data-testid="draw">
                {s.poolCount ? "Ziehen" : "Passen"}
              </Button>
              <Button size="lg" className="min-w-0 px-2" disabled={!myTurn || !check?.ok} onClick={finish} data-testid="finish">
                {!myTurn ? `${s.curId === me ? "Du" : cur} dran` : "Fertig"}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Der Tisch: alle Kombinationen, ungültige rot; die Steine werden kleiner, je voller der Tisch ist */
function TableArea({ table, oldTiles, ownHand, sel, myTurn, bad, targetable, movable, onTile, onGroup, onNew }: {
  table: Tile[][]; oldTiles: Set<Tile>; ownHand: Tile[]; sel: Tile[]; myTurn: boolean; bad: number[];
  targetable: (i: number) => boolean; movable: (t: Tile) => boolean; onTile: (t: Tile) => void; onGroup: (i: number) => void; onNew: () => void;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const lens = [...table.map((g) => g.length), ...(myTurn ? [1] : [])];
  const w = fitWidth(lens, size.w, size.h - 8, 42, 11);
  const badSet = new Set(bad);
  const own = new Set(ownHand);
  return (
    <div ref={ref} className="relative flex min-h-0 flex-1 flex-wrap content-center items-center justify-center overflow-hidden py-1" data-testid="table"
      style={{ columnGap: GAP_X * w, rowGap: GAP_Y * w }} aria-label="Tisch">
      {!table.length && !myTurn && <p className="text-sm text-muted-foreground" data-testid="table-empty">Noch liegt nichts auf dem Tisch.</p>}
      {table.map((g, i) => {
        const isBad = badSet.has(i);
        const target = sel.length > 0 && targetable(i) && !sel.every((t) => g.includes(t));
        const m = isBad ? null : analyze(g);
        return (
          <div key={i} role="group" aria-label={`${m ? (m.kind === "run" ? "Reihe" : "Gruppe") : "Ungültig"}: ${g.map(tileLabel).join(", ")}`}
            onClick={() => onGroup(i)} data-testid="group" data-bad={isBad || undefined}
            className={cn("flex rounded-[0.55rem] transition", isBad ? "bg-destructive/20 ring-2 ring-destructive" : "bg-foreground/7 ring-1 ring-border/60",
              target && "cursor-pointer ring-2 ring-primary/70", !myTurn || targetable(i) ? "" : "opacity-80")}
            style={{ gap: GAP * w, padding: PAD * w }}>
            {g.map((t) => (
              <TileButton key={t} tile={t} w={w} selected={sel.includes(t)} fresh={!oldTiles.has(t) && own.has(t)} enabled={myTurn && (movable(t) || (sel.length > 0 && targetable(i)))}
                onClick={(e) => { e.stopPropagation(); onTile(t); }} />
            ))}
          </div>
        );
      })}
      {myTurn && (
        <button type="button" onClick={onNew} disabled={!sel.length} data-testid="new-group" aria-label="Neue Kombination"
          className={cn("grid place-items-center rounded-[0.55rem] border-2 border-dashed text-muted-foreground outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
            sel.length ? "border-primary bg-primary/10 text-primary" : "border-border/70")}
          style={{ width: w + 2 * PAD * w, height: w * 4 / 3 + 2 * PAD * w }}>
          <span className="flex flex-col items-center leading-none"><Plus style={{ width: w * 0.5, height: w * 0.5 }} /><span style={{ fontSize: Math.max(8, w * 0.28) }}>Neu</span></span>
        </button>
      )}
    </div>
  );
}

function TileButton({ tile, w, selected, fresh, enabled, onClick }: { tile: Tile; w: number; selected: boolean; fresh?: boolean; enabled: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!enabled} data-tile={tile} aria-pressed={enabled ? selected : undefined} aria-label={tileLabel(tile)}
      className={cn("relative shrink-0 rounded-[18%] outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
        selected && "-translate-y-[18%] ring-[3px] ring-primary")}
      style={{ width: w }}>
      <TileFace tile={tile} />
      {fresh && <span className="absolute top-[5%] right-[6%] size-[11%] rounded-full bg-primary ring-1 ring-white/70" aria-hidden="true" />}
    </button>
  );
}

/** Die eigene Bank: Steine im Raster, sortiert nach Farbe oder Zahl; mit gewählten Steinen vom Tisch: zurück hierher */
function Bank({ hand, sel, myTurn, returnTarget, onTile, onBank, sortBy, onSort }: {
  hand: Tile[]; sel: Tile[]; myTurn: boolean; returnTarget: boolean; onTile: (t: Tile) => void; onBank: () => void; sortBy: "color" | "num"; onSort: () => void;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  // so hoch wie nötig (wenige Steine: flach, dann hat der Tisch mehr Platz), höchstens etwa ein Sechstel des Bildschirms
  const per = Math.max(1, Math.floor((size.w - 8 + 4) / 44));
  const need = Math.ceil(Math.max(1, hand.length) / per) * (40 * 4 / 3 + 4) + 8;
  const w = fitGrid(Math.max(1, hand.length), size.w - 8, size.h - 8, 40, 14, 4);
  return (
    <div className="relative">
      <div className="mb-1 flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <span>Deine Bank · {steine(hand.length)}</span>
        <button type="button" onClick={onSort} data-testid="sort" aria-label={`Sortieren: jetzt ${sortBy === "color" ? "nach Farbe" : "nach Zahl"}`}
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-semibold text-foreground ring-1 ring-inset ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowDownUp className="size-3" />{sortBy === "color" ? "nach Farbe" : "nach Zahl"}
        </button>
      </div>
      <div ref={ref} onClick={onBank} data-testid="bank" aria-label="Deine Bank"
        style={{ height: need }}
        className={cn("flex max-h-[clamp(4.2rem,17dvh,8.5rem)] min-h-[3.9rem] flex-wrap content-start justify-center gap-1 overflow-hidden rounded-xl bg-[#7a5a3a]/15 p-1 ring-1 ring-inset ring-[#7a5a3a]/25",
          returnTarget && "cursor-pointer ring-2 ring-primary")}>
        {hand.map((t) => <TileButton key={t} tile={t} w={w} selected={sel.includes(t)} enabled={myTurn} onClick={(e) => { e.stopPropagation(); onTile(t); }} />)}
        {!hand.length && <span className="self-center text-sm">leer</span>}
      </div>
      {returnTarget && (
        <button type="button" onClick={onBank} data-testid="to-bank"
          className="absolute right-2 bottom-1 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Undo2 className="size-3.5" />zurück auf die Bank
        </button>
      )}
    </div>
  );
}
