import { ALL_CATS, CATS, kniffel, totals, type KniffelAction, type KniffelState } from "@shared/games/kniffel/logic";
import { Button } from "@/components/ui/button";
import type { BoardProps, GameUI } from "@/games/types";
import { Section } from "@/platform/MenuSheet";
import { Board } from "./Board";
import { Rules } from "./Rules";

/** Symbol: zwei Würfel, einer mit fünf, einer mit sechs Augen */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="18" y="5" width="17" height="17" rx="4" fill="#bcd3f5" transform="rotate(14 26.5 13.5)" />
      <g fill="#1f437f" transform="rotate(14 26.5 13.5)">
        {[[22, 9], [31, 9], [22, 13.5], [31, 13.5], [22, 18], [31, 18]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.5" />)}
      </g>
      <rect x="5" y="15" width="20" height="20" rx="5" fill="#fdfdfb" transform="rotate(-8 15 25)" />
      <g fill="#1f437f" transform="rotate(-8 15 25)">
        {[[10, 20], [20, 20], [15, 25], [10, 30], [20, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" />)}
      </g>
    </svg>
  );
}

function HeaderExtra({ game, room }: BoardProps<KniffelState, KniffelAction>) {
  const done = Math.min(...room.players.map((p) => totals(game, p.id).filled));
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground ring-1 ring-inset ring-border">
      Runde <b className="text-foreground tabular-nums">{Math.min(ALL_CATS.length, done + 1)}</b>/{ALL_CATS.length}
    </span>
  );
}

function MenuExtras({ game, hostTools, act }: BoardProps<KniffelState, KniffelAction>) {
  return (
    <>
      {hostTools && (
        <div className="mt-2 grid gap-2">
          <Button variant="secondary" className="justify-start" disabled={!game.log.length} onClick={() => act({ type: "undo" })}>
            Letzten Eintrag zurücknehmen
          </Button>
        </div>
      )}
      <Section title="Verlauf">
        {game.log.length ? (
          <ul className="text-[0.95rem]">
            {game.log.slice().reverse().slice(0, 30).map((e, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-border py-2.5">
                <span>{e.name}<span className="block text-sm text-muted-foreground">{CATS[e.cat].name}{e.extra ? " · Extra-Kniffel" : ""}</span></span>
                <b className="tabular-nums">{e.pts || e.extra ? `+${e.pts + e.extra}` : "gestrichen"}</b>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>}
      </Section>
    </>
  );
}

export const kniffelUI: GameUI<KniffelState, KniffelAction> = { logic: kniffel, Icon, Board, Rules, MenuExtras, HeaderExtra };
