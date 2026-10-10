import type { CSSProperties } from "react";
import { COLOR_NAME, canDrop, winningCols, type VierAction, type VierState } from "@shared/games/vier/logic";
import { isOver, other, type Side } from "@shared/games/_board/duel";
import type { BoardProps } from "@/games/types";
import { useHints } from "@/lib/prefs";
import { vibrate } from "@/lib/utils";
import { BoardBox, DuelBar, DuelFooter, HintChip, playerName } from "@/games/_board/Duel";
import { DISC } from "./colors";

export { DISC };

const DISC_DARK = ["#a8262f", "#c99412"] as const;
const FRAME = "#2559c4";
const FRAME_DARK = "#1b4396";

const CELL = 100;
const PAD = 14;
/** Platz über dem Brett: dort wartet der Stein des Spielers am Zug */
const TOP = 96;

export function Disc({ side, cx, cy, r = 40 }: { side: Side; cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={DISC[side]} />
      <circle cx={cx} cy={cy} r={r * 0.68} fill="none" stroke={DISC_DARK[side]} strokeWidth={r * 0.1} opacity={0.55} />
    </g>
  );
}

/** Vier in einer Reihe: senkrechtes Brett, Spalte antippen – der Stein fällt hinein. */
export function Board(props: BoardProps<VierState, VierAction>) {
  const { room, game: s, me, online, canAct, act } = props;
  const hints = useHints();
  const over = isOver(s);
  const myTurn = canAct && !over && (me === null || s.colors[s.turn] === me);
  const W = s.cols * CELL + PAD * 2;
  const H = s.rows * CELL + PAD * 2;
  const HT = H + TOP;
  const x = (c: number) => PAD + c * CELL + CELL / 2;
  const y = (r: number) => TOP + PAD + (s.rows - 1 - r) * CELL + CELL / 2;
  const hoverCol = s.last ? s.last.c : Math.floor(s.cols / 2);
  const curName = playerName(room, s.colors[s.turn]);

  const drop = (col: number) => {
    if (!myTurn || !canDrop(s, col)) return;
    vibrate(10);
    act({ type: "drop", col });
  };

  // Spielhilfe: sofort gewinnen oder eine Drohung abwehren
  const wins = myTurn && hints ? winningCols(s, s.turn) : [];
  const threats = myTurn && hints && !wins.length ? winningCols(s, other(s.turn)) : [];
  const hint = wins.length
    ? <HintChip onClick={() => drop(wins[0])}>Gewinnzug: Spalte {wins[0] + 1}</HintChip>
    : threats.length ? <HintChip onClick={() => drop(threats[0])}>Pass auf – Gegner droht in Spalte {threats[0] + 1}</HintChip> : undefined;
  const status = !myTurn ? `${curName} ist dran (${COLOR_NAME[s.turn]})` : me === null ? `${curName}, du bist dran: Spalte antippen` : "Du bist dran: Spalte antippen";

  return (
    <>
      <DuelBar room={room} s={s} me={me} online={online} colorNames={COLOR_NAME}
        swatch={(side) => <svg viewBox="0 0 100 100" className="size-6"><Disc side={side} cx={50} cy={50} r={46} /></svg>} />
      <BoardBox label="Spielbrett">
        <svg viewBox={`0 0 ${W} ${HT}`} className="size-full" data-testid="vier-board">
          <defs>
            <mask id="vier-holes">
              <rect x={0} y={TOP} width={W} height={H} fill="white" />
              {Array.from({ length: s.cols * s.rows }, (_, i) => (
                <circle key={i} cx={x(i % s.cols)} cy={y(Math.floor(i / s.cols))} r={41} fill="black" />
              ))}
            </mask>
            <clipPath id="vier-clip"><rect x={0} y={TOP} width={W} height={H} rx={22} /></clipPath>
          </defs>
          <g clipPath="url(#vier-clip)">
            <rect x={0} y={TOP} width={W} height={H} fill="rgb(120 140 175 / 0.16)" />
            {/* Steine liegen hinter dem Brett – so sieht man sie durch die Löcher fallen */}
            {s.grid.map((col, c) => col.map((side, r) => {
              const last = s.last?.c === c && s.last?.r === r;
              const style = last ? ({ "--dy": `${-(y(r) - TOP / 2)}px`, "--dur": `${0.28 + (s.rows - r) * 0.045}s` } as CSSProperties) : undefined;
              return (
                <g key={`${c}-${r}`} className={last ? "bd-drop" : undefined} style={style} opacity={s.line.length && !s.line.some(([a, b]) => a === c && b === r) ? 0.5 : 1}>
                  <Disc side={side} cx={x(c)} cy={y(r)} />
                </g>
              );
            }))}
          </g>
          <rect x={0} y={TOP} width={W} height={H} rx={22} fill={FRAME} mask="url(#vier-holes)" />
          {/* Der nächste Stein wartet über dem Brett – in der Farbe dessen, der dran ist */}
          {!over && (
            <g key={`h${s.n}`} className="bd-pop" opacity={myTurn ? 1 : 0.55} pointerEvents="none" data-testid="next-disc">
              <Disc side={s.turn} cx={x(hoverCol)} cy={TOP / 2 + 2} r={36} />
            </g>
          )}
          {Array.from({ length: s.cols * s.rows }, (_, i) => (
            <circle key={i} cx={x(i % s.cols)} cy={y(Math.floor(i / s.cols))} r={41} fill="none" stroke={FRAME_DARK} strokeWidth={3} />
          ))}
          {/* Gewinnreihe */}
          {s.line.map(([c, r]) => (
            <circle key={`w${c}-${r}`} cx={x(c)} cy={y(r)} r={30} fill="none" stroke="white" strokeWidth={9} className="bd-pulse" data-testid="win-cell" />
          ))}
          {/* Spalten zum Antippen */}
          {Array.from({ length: s.cols }, (_, c) => {
            const ok = myTurn && canDrop(s, c);
            const glow = wins.includes(c) || threats.includes(c);
            return (
              <g key={`col${c}`} role="button" aria-label={`Spalte ${c + 1}`} aria-disabled={!ok} tabIndex={ok ? 0 : -1}
                className="bd-hit group" onClick={() => drop(c)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drop(c); } }}>
                <rect x={PAD + c * CELL} y={0} width={CELL} height={HT} fill="white" opacity={glow ? 0.14 : 0}
                  className={ok ? "transition-opacity group-active:opacity-20" : undefined} />
                <rect className="bd-focus" x={PAD + c * CELL + 4} y={TOP + 4} width={CELL - 8} height={H - 8} rx={14} fill="none" stroke="none" />
              </g>
            );
          })}
        </svg>
      </BoardBox>
      <DuelFooter board={props as never} s={s} status={status} hint={hint} mine={myTurn} />
    </>
  );
}
