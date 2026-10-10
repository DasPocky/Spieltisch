import { useState, type CSSProperties } from "react";
import { COLOR_NAME, count, jumping, legalMoves, placing, pointName, pointXY, removable, targets, type MuehleAction, type MuehleState } from "@shared/games/muehle/logic";
import { isOver, other, type Side } from "@shared/games/_board/duel";
import type { BoardProps } from "@/games/types";
import { useHints } from "@/lib/prefs";
import { vibrate } from "@/lib/utils";
import { BoardBox, DuelBar, DuelFooter, flippedFor, playerName } from "@/games/_board/Duel";

const WOOD = "#dcb47e";
const WOOD_EDGE = "#c39459";
const LINE = "#5b3a1e";
const STONE = ["#f7f2e7", "#2b2522"] as const;
const STONE_EDGE = ["#a99b82", "#000000"] as const;
const STONE_RING = ["#d8cdb8", "#4b413b"] as const;

export function Stone({ side, cx, cy, r = 38 }: { side: Side; cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy + r * 0.08} r={r} fill="rgb(0 0 0 / 0.25)" />
      <circle cx={cx} cy={cy} r={r} fill={STONE[side]} stroke={STONE_EDGE[side]} strokeWidth={r * 0.07} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke={STONE_RING[side]} strokeWidth={r * 0.09} />
    </g>
  );
}

/** Die Linien des Mühlebretts (drei Quadrate, vier Verbindungen) */
export function MillLines({ at }: { at: (v: number) => number }) {
  return (
    <g stroke={LINE} strokeWidth={7} fill="none" strokeLinecap="round">
      {[0, 1, 2].map((o) => <rect key={o} x={at(o)} y={at(o)} width={at(6 - o) - at(o)} height={at(6 - o) - at(o)} />)}
      <line x1={at(3)} y1={at(0)} x2={at(3)} y2={at(2)} />
      <line x1={at(3)} y1={at(4)} x2={at(3)} y2={at(6)} />
      <line x1={at(0)} y1={at(3)} x2={at(2)} y2={at(3)} />
      <line x1={at(4)} y1={at(3)} x2={at(6)} y2={at(3)} />
    </g>
  );
}

const STEP = 100;
const OFF = 60;
const SIZE = OFF * 2 + STEP * 6;
const at = (v: number) => OFF + v * STEP;

/** Mühle: Punkte antippen – setzen, Stein wählen und ziehen, nach einer Mühle einen Stein nehmen. */
export function Board(props: BoardProps<MuehleState, MuehleAction>) {
  const { room, game: s, me, online, canAct, act } = props;
  const hints = useHints();
  const [pick, setPick] = useState<{ n: number; i: number } | null>(null);
  const over = isOver(s);
  const myTurn = canAct && !over && (me === null || s.colors[s.turn] === me);
  const sel = pick && pick.n === s.n ? pick.i : null;
  const flipped = flippedFor(s, me, room.options.turnBoard === true);
  const xy = (i: number): [number, number] => {
    const [x, y] = pointXY(i);
    return flipped ? [at(6 - x), at(6 - y)] : [at(x), at(y)];
  };
  const curName = playerName(room, s.colors[s.turn]);
  const opp = other(s.turn);
  const moves = myTurn ? legalMoves(s, room.options) : [];
  const canRemove = s.remove ? removable(s) : [];
  const movable = new Set(moves.flatMap((m) => (m.type === "move" ? [m.from] : [])));
  const goals = sel !== null ? targets(s, sel, room.options) : [];
  const jump = jumping(s, room.options);

  const tap = (i: number) => {
    if (!myTurn) return;
    const v = s.board[i];
    if (s.remove) {
      if (v === opp) { vibrate(20); act({ type: "remove", at: i }); }
      return;
    }
    if (placing(s)) {
      if (v === null) { vibrate(10); act({ type: "place", to: i }); }
      return;
    }
    if (v === s.turn) { setPick(sel === i ? null : { n: s.n, i }); return; }
    if (v === null && sel !== null) { vibrate(10); act({ type: "move", from: sel, to: i }); setPick(null); }
  };

  const you = me === null ? `${curName}, du` : "Du";
  const status = !myTurn
    ? s.remove ? `${curName} hat eine Mühle und nimmt einen Stein` : `${curName} ist dran (${COLOR_NAME[s.turn]})`
    : s.remove ? `Mühle! Nimm einen ${COLOR_NAME[opp] === "Weiß" ? "weißen" : "schwarzen"} Stein`
    : placing(s) ? `${you} setzt – noch ${s.hand[s.turn]} ${s.hand[s.turn] === 1 ? "Stein" : "Steine"}`
    : jump ? (sel === null ? "Drei Steine: wähle einen – du darfst springen" : "Spring auf einen freien Punkt")
    : sel === null ? `${you} ziehst – wähle einen Stein` : "Wohin? Tippe einen freien Nachbarpunkt";

  const last = s.last;
  return (
    <>
      <DuelBar room={room} s={s} me={me} online={online} colorNames={COLOR_NAME}
        swatch={(side) => <svg viewBox="0 0 100 100" className="size-6"><Stone side={side} cx={50} cy={48} r={42} /></svg>}
        extra={(side) => (s.hand[side] > 0 ? <><span className="max-[399px]:hidden">noch </span>{s.hand[side]}</> : <>{count(s, side)}<span className="max-[399px]:hidden"> Steine</span></>)} />
      <BoardBox label="Mühlebrett">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full" data-testid="muehle-board">
          <rect x={6} y={6} width={SIZE - 12} height={SIZE - 12} rx={28} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={8} />
          <MillLines at={at} />
          {s.board.map((_, i) => { const [x, y] = xy(i); return <circle key={`d${i}`} cx={x} cy={y} r={11} fill={LINE} />; })}
          {/* geschlagener Stein verblasst */}
          {last?.taken != null && (
            <g key={`t${s.n}`} className="bd-fade" pointerEvents="none"><Stone side={s.turn} cx={xy(last.taken)[0]} cy={xy(last.taken)[1]} /></g>
          )}
          {last?.from != null && last.to != null && s.board[last.from] === null && (
            <circle cx={xy(last.from)[0]} cy={xy(last.from)[1]} r={22} fill="none" stroke={LINE} strokeWidth={4} strokeDasharray="6 7" opacity={0.6} />
          )}
          {s.board.map((v, i) => {
            if (v === null) return null;
            const [x, y] = xy(i);
            const moved = last?.to === i && last.taken == null;
            const slide = moved && last?.from != null;
            const style = slide ? ({ "--fx": `${xy(last!.from!)[0] - x}px`, "--fy": `${xy(last!.from!)[1] - y}px` } as CSSProperties) : undefined;
            return (
              <g key={`s${i}-${moved ? s.n : 0}`} className={slide ? "bd-slide" : moved ? "bd-pop" : undefined} style={style}>
                <Stone side={v} cx={x} cy={y} />
              </g>
            );
          })}
          {/* Markierungen: Auswahl, Ziele, Steine zum Nehmen */}
          {s.board.map((v, i) => {
            const [x, y] = xy(i);
            if (i === sel) return <circle key={`m${i}`} cx={x} cy={y} r={45} fill="none" stroke="var(--primary)" strokeWidth={8} />;
            if (myTurn && hints && s.remove && canRemove.includes(i)) return <circle key={`m${i}`} cx={x} cy={y} r={45} fill="none" stroke="#e0484f" strokeWidth={7} className="bd-pulse" data-testid="removable" />;
            if (myTurn && hints && goals.includes(i)) return <circle key={`m${i}`} cx={x} cy={y} r={17} fill="var(--primary)" opacity={0.9} data-testid="target" />;
            if (myTurn && hints && sel === null && movable.has(i) && v !== null) return <circle key={`m${i}`} cx={x} cy={y} r={44} fill="none" stroke="var(--primary)" strokeWidth={4} opacity={0.75} />;
            return null;
          })}
          {/* Punkte zum Antippen */}
          {s.board.map((v, i) => {
            const [x, y] = xy(i);
            const label = `Punkt ${pointName(i)}${v === null ? "" : ` – ${COLOR_NAME[v]}`}`;
            return (
              <g key={`h${i}`} role="button" aria-label={label} tabIndex={myTurn ? 0 : -1} className="bd-hit" onClick={() => tap(i)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(i); } }}>
                <circle className="bd-focus" cx={x} cy={y} r={48} fill="transparent" stroke="none" />
              </g>
            );
          })}
        </svg>
      </BoardBox>
      <DuelFooter board={props as never} s={s} status={status} mine={myTurn} />
    </>
  );
}
