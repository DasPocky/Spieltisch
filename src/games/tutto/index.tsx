import { CARDS, tutto, type TuttoAction, type TuttoState } from "@shared/games/tutto/logic";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/Confirm";
import type { BoardProps, GameUI } from "@/games/types";
import { Section } from "@/platform/MenuSheet";
import { fmt } from "@/lib/utils";
import { Board } from "./Board";
import { Rules } from "./Rules";

/** Symbol: Würfel mit fünf Augen auf einer Karte */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="9" y="4" width="22" height="32" rx="4" fill="#fdfdfb" transform="rotate(-8 20 20)" />
      <rect x="12.5" y="13" width="15" height="15" rx="3.5" fill="#1f437f" transform="rotate(-8 20 20)" />
      <g fill="#fdfdfb" transform="rotate(-8 20 20)">
        {[[16, 16.5], [24, 16.5], [20, 20.5], [16, 24.5], [24, 24.5]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.5" />)}
      </g>
    </svg>
  );
}

function HeaderExtra({ game }: BoardProps<TuttoState, TuttoAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground ring-1 ring-inset ring-border">
      <b className="text-foreground tabular-nums">{game.pile.length}</b> Karten
    </span>
  );
}

/** Verlauf, Kartenstapel und Host-Werkzeuge im Menü */
function MenuExtras({ room, game, isHost, act }: BoardProps<TuttoState, TuttoAction>) {
  const counts = new Map<string, number>();
  for (const id of game.pile) counts.set(id, (counts.get(id) ?? 0) + 1);
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? "?";

  return (
    <>
      {isHost && (
        <div className="mt-2 grid gap-2">
          <Button variant="secondary" className="justify-start" disabled={!game.log.length} onClick={() => act({ type: "undo" })}>
            Letzten Eintrag zurücknehmen
          </Button>
          <Confirm title="Kartenstapel neu mischen?" confirmLabel="Mischen" onConfirm={() => act({ type: "shuffle" })}>
            <Button variant="secondary" className="justify-start">Kartenstapel neu mischen</Button>
          </Confirm>
        </div>
      )}

      <Section title="Verlauf">
        {game.log.length ? (
          <ul className="text-[0.95rem]">
            {game.log.slice().reverse().slice(0, 30).map((e, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-border py-2.5">
                <span>
                  {e.name}
                  {(e.cards.length > 0 || e.penalized.length > 0) && (
                    <span className="block text-sm text-muted-foreground">
                      {e.cards.map((c) => CARDS.find((x) => x.id === c)?.name).join(", ")}
                      {e.penalized.length > 0 && ` · −1.000 für ${e.penalized.map(nameOf).join(", ")}`}
                    </span>
                  )}
                </span>
                <b className="tabular-nums">{e.clover ? "☘" : `+${fmt(e.pts)}`}</b>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>}
      </Section>

      <Section title={`Im Stapel: ${game.pile.length} Karten`}>
        <ul className="grid gap-2">
          {CARDS.map((c) => {
            const k = counts.get(c.id) ?? 0;
            return (
              <li key={c.id} className="grid grid-cols-[12px_1fr_auto] items-center gap-x-2.5 text-[0.95rem]">
                <span className="size-3 rounded-[3px]" style={{ background: c.color }} />
                <span>{c.name}</span>
                <span className="text-muted-foreground tabular-nums">{k}/{c.count}</span>
                <span className="col-start-2 col-end-4 h-[3px] overflow-hidden rounded bg-foreground/10">
                  <i className="block h-full" style={{ width: `${(k / c.count) * 100}%`, background: c.color }} />
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

export const tuttoUI: GameUI<TuttoState, TuttoAction> = {
  logic: tutto,
  Icon,
  Board,
  Rules,
  MenuExtras,
  HeaderExtra,
};
