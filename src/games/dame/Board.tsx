import { useState, type CSSProperties } from "react";
import { COLOR_NAME, isDark, isKing, legalMoves, ownedBy, rulesOf, squareName, type DameAction, type DameState } from "@shared/games/dame/logic";
import { isOver, type Side } from "@shared/games/_board/duel";
import type { BoardProps } from "@/games/types";
import { useHints } from "@/lib/prefs";
import { vibrate } from "@/lib/utils";
import { BoardBox, DuelBar, DuelFooter, flippedFor, HintChip, playerName } from "@/games/_board/Duel";

const LIGHT = "#efdcb8";
const DARK = "#9a6a44";
const EDGE = "#5e3b22";
const PIECE = ["#f6f0e2", "#2b2421"] as const;
const PIECE_EDGE = ["#a39478", "#000000"] as const;
const PIECE_RING = ["#d9ccb2", "#4d423c"] as const;
const GOLD = "#e3b53c";

/** Spielstein; die Dame trägt eine Krone */
export function Piece({ side, king, cx, cy, r = 40 }: { side: Side; king: boolean; cx: number; cy: number; r?: number }) {
  const k = r / 40;
  return (
    <g>
      <circle cx={cx} cy={cy + 3 * k} r={r} fill="rgb(0 0 0 / 0.3)" />
      <circle cx={cx} cy={cy} r={r} fill={PIECE[side]} stroke={PIECE_EDGE[side]} strokeWidth={2.5 * k} />
      <circle cx={cx} cy={cy} r={r * 0.68} fill="none" stroke={PIECE_RING[side]} strokeWidth={3.5 * k} />
      {king && (
        <path transform={`translate(${cx - 20 * k} ${cy - 16 * k}) scale(${k})`} fill={GOLD} stroke={side === 0 ? "#8a6a1c" : "#000"} strokeWidth={1.5}
          d="M2 10 L11 20 L20 4 L29 20 L38 10 L34 30 L6 30 Z" />
      )}
    </g>
  );
}

const CELL = 100;
const FRAME = 16;

/** Dame: eigenen Stein antippen, dann das Ziel – bei Mehrfachschlag jedes Landefeld der Reihe nach. */
export function Board(props: BoardProps<DameState, DameAction>) {
  const { room, game: s, me, online, canAct, act } = props;
  const hints = useHints();
  const [pick, setPick] = useState<{ n: number; from: number; path: number[] } | null>(null);
  const over = isOver(s);
  const myTurn = canAct && !over && (me === null || s.colors[s.turn] === me);
  const sel = pick && pick.n === s.n ? pick : null;
  const n = s.size;
  const flipped = flippedFor(s, me, room.options.turnBoard === true);
  const rules = rulesOf(room.options);
  const W = n * CELL + FRAME * 2;
  const xy = (i: number): [number, number] => {
    const r = Math.floor(i / n), c = i % n;
    const vx = flipped ? n - 1 - c : c, vy = flipped ? r : n - 1 - r;
    return [FRAME + vx * CELL + CELL / 2, FRAME + vy * CELL + CELL / 2];
  };
  const curName = playerName(room, s.colors[s.turn]);
  const moves = myTurn ? legalMoves(s, room.options) : [];
  const mustCapture = moves.some((m) => m.caps.length) && rules.capture === "must";
  const movable = new Set(moves.map((m) => m.from));
  const fits = sel ? moves.filter((m) => m.from === sel.from && sel.path.every((p, k) => m.path[k] === p) && m.path.length > sel.path.length) : [];
  const next = new Set(fits.map((m) => m.path[sel!.path.length]));
  const capsSoFar = sel ? (fits[0]?.caps.slice(0, sel.path.length) ?? []) : [];
  const blowable = myTurn ? s.blow : [];

  const send = (from: number, path: number[]) => { vibrate(12); act({ type: "move", from, path }); setPick(null); };
  const tap = (i: number) => {
    if (!myTurn) return;
    const v = s.board[i];
    if (blowable.includes(i) && !sel) { vibrate(25); act({ type: "blow", at: i }); return; }
    if (ownedBy(v, s.turn) && (!sel || !sel.path.length)) {
      setPick(sel?.from === i ? null : { n: s.n, from: i, path: [] });
      return;
    }
    if (!sel) return;
    // Angefangenen Schlag abbrechen: das aktuelle Landefeld nochmal antippen
    if (sel.path.length && i === sel.path[sel.path.length - 1]) { setPick(null); return; }
    const free = isDark(n, i) && (v === 0 || (i === sel.from && next.has(i)));
    if (!free) { if (!sel.path.length) setPick(null); return; }
    const path = [...sel.path, i];
    if (!next.has(i)) {
      // Mitten im Mehrfachschlag zählt nur ein gültiges Landefeld; sonst erklärt die Logik, warum es nicht geht
      if (!sel.path.length) send(sel.from, path);
      return;
    }
    if (fits.some((m) => m.path.length === path.length && m.path[path.length - 1] === i)) send(sel.from, path);
    else { vibrate(8); setPick({ n: s.n, from: sel.from, path }); }
  };

  const who = me === null ? `${curName}:` : "Du bist dran:";
  const status = !myTurn ? `${curName} ist dran (${COLOR_NAME[s.turn]})`
    : sel && sel.path.length ? "Weiterschlagen: nächstes Landefeld antippen"
    : mustCapture ? `${me === null ? `${curName}, du` : "Du"} musst schlagen (Schlagzwang)`
    : sel ? "Wohin? Feld antippen" : `${who} Stein wählen`;
  const hint = myTurn && blowable.length && !sel
    ? <HintChip>Pusten: tippe den markierten Stein an – oder zieh einfach</HintChip>
    : undefined;

  // Wo steht der gewählte Stein gerade (bei angefangenem Mehrfachschlag)?
  const ghostAt = sel && sel.path.length ? sel.path[sel.path.length - 1] : null;
  const last = s.last;
  const lastTo = last && last.path.length ? last.path[last.path.length - 1] : null;
  const pieces = s.board.map((v, i) => ({ v, i })).filter((p) => p.v !== 0);
  const counts = (side: Side) => {
    const own = s.board.filter((v) => ownedBy(v, side));
    const kings = own.filter(isKing).length;
    return `${own.length}${kings ? ` · ${kings}♛` : ""}`;
  };

  return (
    <>
      <DuelBar room={room} s={s} me={me} online={online} colorNames={COLOR_NAME}
        swatch={(side) => <svg viewBox="0 0 100 100" className="size-6"><Piece side={side} king={false} cx={50} cy={48} r={44} /></svg>}
        extra={counts} />
      <BoardBox label="Damebrett">
        <svg viewBox={`0 0 ${W} ${W}`} className="size-full" data-testid="dame-board">
          <rect x={0} y={0} width={W} height={W} rx={18} fill={EDGE} />
          {Array.from({ length: n * n }, (_, i) => {
            const [x, y] = xy(i);
            const mark = last && (i === last.from || i === lastTo) && !last.blown;
            return (
              <g key={`q${i}`}>
                <rect x={x - CELL / 2} y={y - CELL / 2} width={CELL} height={CELL} fill={isDark(n, i) ? DARK : LIGHT} />
                {mark && <rect x={x - CELL / 2} y={y - CELL / 2} width={CELL} height={CELL} fill="#f3d36b" opacity={0.28} />}
              </g>
            );
          })}
          {/* eben geschlagene oder weggepustete Steine verblassen */}
          {last && [...last.caps, ...(last.blown != null ? [last.blown] : [])].map((i) => (
            <g key={`x${i}-${s.n}`} className="bd-fade" pointerEvents="none">
              <Piece side={last.blown != null ? (s.turn === 0 ? 1 : 0) : s.turn} king={false} cx={xy(i)[0]} cy={xy(i)[1]} />
            </g>
          ))}
          {pieces.map(({ v, i }) => {
            const [x, y] = xy(i);
            const side: Side = v > 0 ? 0 : 1;
            const moved = i === lastTo && !last?.blown;
            const style = moved ? ({ "--fx": `${xy(last!.from)[0] - x}px`, "--fy": `${xy(last!.from)[1] - y}px` } as CSSProperties) : undefined;
            const hidden = sel && ghostAt !== null && i === sel.from;
            return (
              <g key={`p${i}-${moved ? s.n : 0}`} className={moved ? "bd-slide" : undefined} style={style} opacity={hidden ? 0.35 : 1}>
                <Piece side={side} king={isKing(v)} cx={x} cy={y} />
              </g>
            );
          })}
          {/* Mehrfachschlag in Arbeit: Stein am bisherigen Landefeld, übersprungene Steine markiert */}
          {sel && ghostAt !== null && (
            <g pointerEvents="none">
              <Piece side={s.turn} king={isKing(s.board[sel.from])} cx={xy(ghostAt)[0]} cy={xy(ghostAt)[1]} />
              {capsSoFar.map((c) => (
                <path key={`c${c}`} d={`M${xy(c)[0] - 22} ${xy(c)[1] - 22} l44 44 m0 -44 l-44 44`} stroke="#e0484f" strokeWidth={9} strokeLinecap="round" />
              ))}
            </g>
          )}
          {/* Markierungen */}
          {Array.from({ length: n * n }, (_, i) => {
            const [x, y] = xy(i);
            if (sel && i === (ghostAt ?? sel.from)) return <circle key={`m${i}`} cx={x} cy={y} r={46} fill="none" stroke="var(--primary)" strokeWidth={8} />;
            if (blowable.includes(i)) return <circle key={`m${i}`} cx={x} cy={y} r={46} fill="none" stroke="#e0484f" strokeWidth={7} className="bd-pulse" data-testid="blowable" />;
            if (hints && sel && next.has(i)) return <circle key={`m${i}`} cx={x} cy={y} r={17} fill="var(--primary)" opacity={0.95} data-testid="target" />;
            if (hints && !sel && movable.has(i)) return <circle key={`m${i}`} cx={x} cy={y} r={45} fill="none" stroke={mustCapture ? "#e0484f" : "var(--primary)"} strokeWidth={4.5} opacity={0.85} data-testid="movable" />;
            return null;
          })}
          {/* dunkle Felder zum Antippen */}
          {Array.from({ length: n * n }, (_, i) => {
            if (!isDark(n, i)) return null;
            const [x, y] = xy(i);
            const v = s.board[i];
            const label = `Feld ${squareName(n, i)}${v === 0 ? "" : ` – ${COLOR_NAME[v > 0 ? 0 : 1]}${isKing(v) ? " Dame" : ""}`}`;
            return (
              <g key={`h${i}`} role="button" aria-label={label} tabIndex={myTurn ? 0 : -1} className="bd-hit" onClick={() => tap(i)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(i); } }}>
                <rect className="bd-focus" x={x - CELL / 2 + 3} y={y - CELL / 2 + 3} width={CELL - 6} height={CELL - 6} rx={8} fill="transparent" stroke="none" />
              </g>
            );
          })}
        </svg>
      </BoardBox>
      <DuelFooter board={props as never} s={s} status={status} hint={hint} mine={myTurn} />
    </>
  );
}
