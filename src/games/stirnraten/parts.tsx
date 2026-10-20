import type { ReactNode } from "react";
import { STYLE_BY_ID, type Style } from "@shared/games/stirnraten/cards";
import { standings, teamName, type StirnAction, type StirnState } from "@shared/games/stirnraten/logic";
import type { Player } from "@shared/platform/types";
import { nameOf } from "@/games/werwolf/parts";
import { RulesSheet } from "@/platform/RulesSheet";
import { cn } from "@/lib/utils";
import { TEAM_COLORS } from "./colors";
import type { BoardProps } from "@/games/types";

export type P = BoardProps<StirnState, StirnAction>;

export { TEAM_COLORS } from "./colors";

export function TopRow({ children, room }: { children?: ReactNode; room: P["room"] }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-1">
      <span className="min-w-0 truncate text-sm text-muted-foreground">{children}</span>
      <RulesSheet gameId={room.gameId} />
    </div>
  );
}

/** Darstellungsart als kleines Schild */
export function StyleChip({ style, big }: { style: Style; big?: boolean }) {
  const st = STYLE_BY_ID[style];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-secondary font-semibold ring-1 ring-inset ring-border", big ? "px-3 py-1 text-base" : "px-2.5 py-0.5 text-sm")} data-testid="style-chip">
      <span aria-hidden="true">{st.emoji}</span>{st.name}
    </span>
  );
}

/** Wer ist dran? Groß und farbig */
export function TurnBanner({ s, players, children }: { s: StirnState; players: Player[]; children?: ReactNode }) {
  const color = s.team !== null ? TEAM_COLORS[s.team % TEAM_COLORS.length] : undefined;
  return (
    <div className="turn shrink-0 rounded-xl px-3 py-2" data-testid="guesser" style={color ? { boxShadow: `inset 4px 0 0 ${color}` } : undefined}>
      <div className="truncate text-lg font-bold">{nameOf(players, s.guesser)} rät{s.team !== null && <span className="font-semibold" style={{ color }}> · {teamName(s.team)}</span>}</div>
      {children}
    </div>
  );
}

/** Stand: Teams bzw. Spieler mit Punkten (Bombe: Bomben) */
export function Standings({ s, players, compact }: { s: StirnState; players: Player[]; compact?: boolean }) {
  const rows = standings(s);
  const unit = s.variant === "bombe" ? "💣" : "";
  return (
    <ul className={cn("grid gap-1", compact && rows.length > 4 && "grid-cols-2")} data-testid="standings">
      {rows.map((r) => {
        const team = r.key.startsWith("t") && s.variant === "teams" ? Number(r.key.slice(1)) : null;
        return (
          <li key={r.key} className="glass flex items-center gap-2 rounded-xl px-3 py-1.5">
            {team !== null && <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: TEAM_COLORS[team % TEAM_COLORS.length] }} aria-hidden="true" />}
            <span className="min-w-0 flex-1 truncate font-semibold">
              {team !== null ? r.label : nameOf(players, r.key)}
              {team !== null && !compact && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{r.ids.map((id) => nameOf(players, id)).join(", ")}</span>}
            </span>
            <b className="tabular-nums">{r.score}{unit && <span className="ml-0.5" aria-label="Bomben">{unit}</span>}</b>
          </li>
        );
      })}
    </ul>
  );
}

export const roundOf = (s: StirnState) => {
  const per = s.variant === "teams" ? s.teams.length : s.variant === "klassisch" ? s.order.length : 1;
  return { round: Math.min(Math.floor(s.turn / Math.max(1, per)) + 1, Math.ceil(s.turns / Math.max(1, per))), rounds: Math.ceil(s.turns / Math.max(1, per)) };
};
