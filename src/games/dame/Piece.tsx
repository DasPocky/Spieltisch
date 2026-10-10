import type { Side } from "@shared/games/_board/duel";

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
