import { maumau, type MauMauAction, type MauMauState } from "@shared/games/maumau/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Section } from "@/platform/MenuSheet";
import { Board } from "./Board";
import { Rules } from "./Rules";

/** Symbol: zwei Karten mit Herz und Eichel */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="6" y="8" width="17" height="25" rx="3" fill="#fdfdfb" transform="rotate(-12 14.5 20.5)" />
      <path d="M13 23 C 9.5 20.2, 8 18.5, 8 16.6 A 2.4 2.4 0 0 1 13 15.5 A 2.4 2.4 0 0 1 18 16.6 C 18 18.5, 16.5 20.2, 13 23 Z" fill="#b8323f" transform="rotate(-12 14.5 20.5)" />
      <rect x="17" y="7" width="17" height="25" rx="3" fill="#fdfdfb" transform="rotate(10 25.5 19.5)" />
      <g transform="rotate(10 25.5 19.5)">
        <ellipse cx="25.5" cy="21" rx="3.4" ry="4.4" fill="#8a5a1f" />
        <path d="M21.2 18.3 C 21.2 15.7, 29.8 15.7, 29.8 18.3 C 29.8 19.3, 21.2 19.3, 21.2 18.3 Z" fill="#5a3a12" />
      </g>
    </svg>
  );
}

function HeaderExtra({ game }: BoardProps<MauMauState, MauMauAction>) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground ring-1 ring-inset ring-border">
      <b className="text-foreground tabular-nums">{game.pileCount}</b> im Stapel
    </span>
  );
}

function MenuExtras({ game }: BoardProps<MauMauState, MauMauAction>) {
  return (
    <Section title="Verlauf">
      {game.log.length ? <ul className="text-[0.95rem]">{game.log.slice().reverse().map((e, i) => <li key={i} className="border-b border-border py-2">{e}</li>)}</ul>
        : <p className="text-sm text-muted-foreground">Noch nichts Besonderes passiert.</p>}
    </Section>
  );
}

export const maumauUI: GameUI<MauMauState, MauMauAction> = { logic: maumau, Icon, Board, Rules, MenuExtras, HeaderExtra };
