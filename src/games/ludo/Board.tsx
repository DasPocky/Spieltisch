import { useEffect, useMemo, useRef, useState } from "react";
import { Dices } from "lucide-react";
import {
  COLOR_NAMES, HOME, inGoal, legalMoves, PIECES, rulesOf, threeTries, trackLen,
  type LastMove, type LudoAction, type LudoState, type Move,
} from "@shared/games/ludo/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { Die } from "@/platform/Die";
import { DiceTray } from "@/platform/dice3d/DiceTray";
import { HintChip } from "@/platform/HintChip";
import { Seats } from "@/platform/Seats";
import { ResultScreen } from "@/platform/ResultScreen";
import { RulesSheet } from "@/platform/RulesSheet";
import { SmoothText } from "@/platform/SmoothText";
import { useHints } from "@/lib/prefs";
import { cn, vibrate } from "@/lib/utils";
import { layout, pathOf, pointOf, type Pt } from "./geometry";
import { Pawn, PALETTE, PAWN } from "./Pawn";
import "./ludo.css";

const STEP_MS = 150;

/** Figur gerade unterwegs: Position Feld für Feld, geschlagene Figur bleibt bis zum Eintreffen stehen */
function useStepper(last: LastMove | null) {
  const seen = useRef(last?.n ?? 0);
  const [anim, setAnim] = useState<{ pid: string; piece: number; p: number; hit?: LastMove["hit"] } | null>(null);
  useEffect(() => {
    if (!last || last.n === seen.current) return;
    seen.current = last.n;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const path = pathOf(last.from, last.to);
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Startpunkt sofort, dann jedes Feld
    setAnim({ pid: last.pid, piece: last.piece, p: last.from, hit: last.hit });
    path.forEach((p, k) => timers.push(setTimeout(() => setAnim({ pid: last.pid, piece: last.piece, p, hit: last.hit }), 30 + k * STEP_MS)));
    timers.push(setTimeout(() => setAnim(null), 30 + path.length * STEP_MS + 60));
    return () => { timers.forEach(clearTimeout); setAnim(null); };
  }, [last]);
  return anim;
}

/** Die laufende Ludo-Partie: Spielerleiste, Brett, Würfel – alles auf einem Bildschirm. */
export function Board({ room, game: s, me, isHost, canAct, act, dispatch }: BoardProps<LudoState, LudoAction>) {
  const r = rulesOf(room.options);
  const hints = useHints();
  // Online sitzt die eigene Farbe unten links
  const L = layout(s.board, me && s.color[me] !== undefined ? s.color[me] : 0);
  const T = trackLen(s.board);
  const anim = useStepper(s.last);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [s.die, s.curId]);

  const players = room.players.filter((p) => s.pos[p.id]);
  const cur = players.find((p) => p.id === s.curId);
  const curColor = cur ? s.color[cur.id] : 0;
  const moves: Move[] = useMemo(() => (s.curId && s.die !== null ? legalMoves(s, s.curId, s.die, r) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, room.options]);
  const mine = canAct && !!cur;
  const showMoves = mine && s.die !== null && !anim;

  if (s.finished) {
    const ranked = [...players].sort((a, b) => rank(s, a.id) - rank(s, b.id));
    const winner = s.places[0] ? room.players.find((p) => p.id === s.places[0]) : ranked[0];
    return (
      <ResultScreen winner={winner?.name ?? "?"} subtitle={s.places[0] ? `mit ${COLOR_NAMES[s.color[s.places[0]]]} – alle Figuren im Ziel` : "als Letzter im Spiel"}
        ranking={ranked.map((p) => ({ id: p.id, name: `${p.name} · ${COLOR_NAMES[s.color[p.id]]}`, score: inGoal(s, p.id) }))}
        scoreLabel="im Ziel" isHost={isHost} dispatch={dispatch} />
    );
  }

  const tries = cur ? threeTries(s, cur.id, r) : false;
  const posOf = (pid: string, i: number): number => {
    if (anim && anim.pid === pid && anim.piece === i) return anim.p;
    if (anim?.hit && anim.hit.pid === pid && anim.hit.piece === i) return anim.hit.from;
    return s.pos[pid][i];
  };

  const tapPiece = (pid: string, i: number) => {
    if (!mine || pid !== s.curId || s.die === null || anim) return;
    const ms = moves.filter((m) => m.piece === i);
    vibrate(8);
    if (ms.length === 1) act({ type: "move", piece: i, back: ms[0].back });
    else if (ms.length > 1) setSel(sel === i ? null : i);
    else act({ type: "move", piece: i }); // die Logik erklärt, warum nicht
  };

  // Ziele zeigen: mit Spielhilfe alle, sonst nur bei gewählter Figur mit zwei Möglichkeiten
  const targets = showMoves ? moves.filter((m) => (hints || sel === m.piece) && (sel === null || sel === m.piece)) : [];
  const glow = new Set(showMoves && hints ? moves.map((m) => m.piece) : []);
  const canHit = showMoves && moves.some((m) => m.hit);

  const status = !cur ? "" : s.die !== null
    ? (moves.length > 1 && new Set(moves.map((m) => m.piece)).size > 1 ? "Welche Figur soll ziehen?" : "Tippe die Figur an.")
    : tries ? `Keine Figur draußen – bis zu dreimal würfeln (${Math.min(3, s.tries + 1)}. Versuch)`
    : s.tries === 0 && s.last?.pid === cur.id && s.shown === 6 ? "Eine 6 – nochmal würfeln!"
    : r.dice === "real" ? "Würfle und tippe die Zahl an." : "Würfle!";

  return (
    <>
      <Seats me={me} online={null} seats={players.map((p) => {
        const done = s.places.indexOf(p.id);
        return {
          id: p.id, name: p.name, cur: p.id === s.curId,
          icon: <svg viewBox="-0.45 -0.5 0.9 0.95" className="h-7 w-6 shrink-0" aria-hidden="true"><Pawn color={s.color[p.id]} /></svg>,
          sub: done >= 0 ? `Platz ${done + 1}` : `Ziel ${inGoal(s, p.id)}/${PIECES}`,
        };
      })} />

      <div className="relative flex min-h-0 flex-1 items-center justify-center py-1">
        <svg viewBox={`${-L.half} ${-L.half} ${2 * L.half} ${2 * L.half}`} className="block aspect-square max-h-full w-full max-w-full touch-manipulation select-none" data-testid="board" role="img"
          aria-label={`Spielbrett – am Zug: ${cur?.name ?? ""} (${COLOR_NAMES[curColor]})`}>
          <BoardBg L={L} n={s.board} curColor={cur ? curColor : null} colors={Object.values(s.color)} />
          {/* Ziele (Spielhilfe) */}
          {targets.map((m) => {
            const [x, y] = pointOf(L, s.board, curColor, m.to, m.piece);
            return (
              <g key={`${m.piece}-${m.back ? "b" : "f"}`} role="button" aria-label={`Ziel für Figur ${m.piece + 1}`} data-testid="target" className="cursor-pointer"
                onClick={() => { vibrate(8); act({ type: "move", piece: m.piece, back: m.back }); }}>
                <circle cx={x} cy={y} r={L.r * 1.18} fill="none" stroke={m.hit ? "#c0262d" : "#0f1a2e"} strokeWidth={0.07} strokeDasharray="0.16 0.1" className="ludo-target" />
                <circle cx={x} cy={y} r={L.r * 1.4} fill="transparent" />
              </g>
            );
          })}
          {/* Figuren: die gerade ziehende zuletzt, damit sie oben liegt */}
          {players.flatMap((p) => s.pos[p.id].map((_, i) => ({ pid: p.id, i })))
            .sort((a, b) => Number(anim?.pid === a.pid && anim.piece === a.i) - Number(anim?.pid === b.pid && anim.piece === b.i))
            .map(({ pid, i }) => {
              const c = s.color[pid];
              const p = posOf(pid, i);
              const [x, y] = pointOf(L, s.board, c, p, i);
              const isGlow = pid === s.curId && glow.has(i);
              const tappable = mine && pid === s.curId && s.die !== null;
              const moving = anim?.pid === pid && anim.piece === i;
              return (
                <g key={`${pid}-${i}`} style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform ${moving ? STEP_MS - 20 : 0}ms ease-out` }}
                  role={tappable ? "button" : undefined} aria-label={`${COLOR_NAMES[c]} Figur ${i + 1}${p === HOME ? " im Haus" : p >= T ? " im Ziel" : ""}`}
                  data-testid={pid === s.curId ? `piece-${i}` : undefined} data-pos={s.pos[pid][i]} data-glow={isGlow || undefined}
                  className={cn(tappable && "cursor-pointer")} onClick={() => tapPiece(pid, i)}>
                  {isGlow && <circle r={L.r * 1.12} className="ludo-glow" fill="#ffffff" fillOpacity={0.7} stroke="#2a5cbf" strokeWidth={0.1} />}
                  {sel === i && pid === s.curId && <circle r={L.r * 1.12} fill="none" stroke="#0f1a2e" strokeWidth={0.08} />}
                  <g transform={`scale(${(L.r * 2.5) / PAWN})`}><Pawn color={c} lift={moving} /></g>
                  {tappable && <circle r={L.r * 1.35} fill="transparent" />}
                </g>
              );
            })}
        </svg>
      </div>

      <div className="shrink-0 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <section className="glass rounded-2xl p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-sm text-muted-foreground">Am Zug</span>
                <b className="truncate text-base" data-testid="current-player">{cur?.id === me ? "Du" : cur?.name}</b>
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[curColor].fill }} aria-hidden="true" />
                <span className="text-sm text-muted-foreground">{COLOR_NAMES[curColor]}</span>
              </div>
              <p className="min-h-5 truncate text-sm text-muted-foreground" data-testid="status">
                <SmoothText>{mine ? status : room.entry === "host" && !canAct ? `Der Host spielt für ${cur?.name}` : `Warte auf ${cur?.name} …`}</SmoothText>
              </p>
            </div>
            {(r.dice === "app" || s.die !== null || !mine) && (
              <span className={cn("relative block h-16 w-24 shrink-0", s.die === null && "opacity-70 transition-opacity delay-1000 duration-300")} data-testid="die">
                <DiceTray className="size-full" values={s.shown ? [s.shown] : []} rollKey={`${s.rolls}`} empty="" label="Würfel" />
                {s.shown && <span role="img" className="sr-only" aria-label={`Würfel ${s.shown}`} />}
              </span>
            )}
            <RulesSheet gameId={room.gameId} focus={s.die === 6 ? "six" : tries ? "three" : undefined} />
          </div>
          {canHit && hints && <div className="mt-1.5"><HintChip>Du kannst schlagen – rot umrandetes Feld</HintChip></div>}
          {mine && s.die === null && (
            r.dice === "app" ? (
              <Button size="lg" className="mt-2 w-full" disabled={!!anim} onClick={() => { vibrate(15); act({ type: "roll" }); }}>
                <Dices />Würfeln
              </Button>
            ) : (
              <div className="mt-2 grid grid-cols-6 gap-1.5" role="group" aria-label="Gewürfelte Zahl">
                {[1, 2, 3, 4, 5, 6].map((v) => (
                  <button key={v} type="button" aria-label={`${v} gewürfelt`} disabled={!!anim}
                    onClick={() => { vibrate(10); act({ type: "roll", value: v }); }}
                    className="aspect-square rounded-[22%] outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring">
                    <Die value={v} className="size-full" />
                  </button>
                ))}
              </div>
            )
          )}
        </section>
      </div>
    </>
  );
}

/** Rang für die Ergebnisliste: Platzierte zuerst, dann nach Fortschritt */
function rank(s: LudoState, id: string) {
  const place = s.places.indexOf(id);
  if (place >= 0) return place;
  const progress = s.pos[id].reduce((t, p) => t + (p + 1), 0);
  return 100 - progress / 100;
}

/** Das Brett: Holzton, Laufbahn mit Linie, Startfelder, Zielfelder und Häuser in den Farben */
function BoardBg({ L, n, curColor, colors }: { L: ReturnType<typeof layout>; n: 4 | 6; curColor: number | null; colors: number[] }) {
  const h = L.half;
  const line = L.track.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + "Z";
  const field = (pt: Pt, fill: string, key: string, stroke = "#2a2418") => <circle key={key} cx={pt[0]} cy={pt[1]} r={L.r} fill={fill} stroke={stroke} strokeWidth={0.05} />;
  const used = new Set(colors);
  return (
    <g>
      <rect x={-h} y={-h} width={2 * h} height={2 * h} rx={0.45} fill="#f3e2b4" />
      <rect x={-h + 0.12} y={-h + 0.12} width={2 * h - 0.24} height={2 * h - 0.24} rx={0.36} fill="none" stroke="#c9a96a" strokeWidth={0.05} />
      <path d={line} fill="none" stroke="#5a4a2c" strokeWidth={0.06} />
      {L.goal.map((g, c) => <path key={c} d={`M${L.track[(c * 10 + L.track.length - 1) % L.track.length].join(" ")} L${g.map((p) => p.join(" ")).join(" L")}`} fill="none" stroke="#5a4a2c" strokeWidth={0.06} />)}
      {L.track.map((pt, i) => (i % 10 === 0 ? field(pt, PALETTE[i / 10].fill, `t${i}`) : field(pt, "#fffdf6", `t${i}`)))}
      {L.goal.map((g, c) => g.map((pt, k) => field(pt, PALETTE[c].light, `g${c}${k}`, PALETTE[c].dark)))}
      {L.home.map((hs, c) => (
        <g key={`h${c}`} opacity={used.has(c) ? 1 : 0.55}>
          {c === curColor && <circle cx={(hs[0][0] + hs[3][0]) / 2} cy={(hs[0][1] + hs[3][1]) / 2} r={L.r * 2.55} fill={PALETTE[c].fill} fillOpacity={0.2} stroke={PALETTE[c].fill} strokeWidth={0.07} />}
          {hs.map((pt, k) => field(pt, PALETTE[c].light, `h${c}${k}`, PALETTE[c].dark))}
        </g>
      ))}
      {/* Mitte: Farbe des Spielers am Zug */}
      <circle r={n === 4 ? 0.42 : 0.5} fill={curColor !== null ? PALETTE[curColor].fill : "#c9a96a"} stroke="#2a2418" strokeWidth={0.05} style={{ transition: "fill 0.35s" }} />
    </g>
  );
}
