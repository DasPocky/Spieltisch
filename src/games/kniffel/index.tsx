import { ALL_CATS, CATS, kniffel, totals, type KniffelAction, type KniffelState } from "@shared/games/kniffel/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Board } from "./Board";
import { Rules } from "./Rules";
import { Icon } from "./Icon";



function HeaderExtra({ game, room }: BoardProps<KniffelState, KniffelAction>) {
  const done = Math.min(...room.players.map((p) => totals(game, p.id).filled));
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground ring-1 ring-inset ring-border">
      Runde <b className="text-foreground tabular-nums">{Math.min(ALL_CATS.length, done + 1)}</b>/{ALL_CATS.length}
    </span>
  );
}

/** Verlauf für „Spieler & Verlauf“: wer was eingetragen hat */
function History({ game }: BoardProps<KniffelState, KniffelAction>) {
  if (!game.log.length) return <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>;
  return (
    <ul className="text-[0.95rem]" data-testid="history">
      {game.log.slice().reverse().slice(0, 30).map((e, i) => (
        <li key={i} className="flex justify-between gap-3 border-b border-border py-2.5">
          <span>{e.name}<span className="block text-sm text-muted-foreground">{CATS[e.cat].name}{e.extra ? " · Extra-Kniffel" : ""}</span></span>
          <b className="tabular-nums">{e.pts || e.extra ? `+${e.pts + e.extra}` : "gestrichen"}</b>
        </li>
      ))}
    </ul>
  );
}

export const kniffelUI: GameUI<KniffelState, KniffelAction> = { logic: kniffel, Icon, Board, Rules, History, HeaderExtra, undoEntry: (g) => g.log.length > 0 };
