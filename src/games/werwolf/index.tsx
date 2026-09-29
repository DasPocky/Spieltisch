import { werwolf, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { Section } from "@/platform/MenuSheet";
import { Board } from "./Board";
import { Rules } from "./Rules";

/** Symbol: Mond mit Wolfskopf */
function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="14" fill="#fdfdfb" />
      <circle cx="26" cy="15" r="12" fill="#1f437f" />
      <path d="M9 33 L12 22 L15 25 L18 19 L21 25 L23 21 L25 33 Z" fill="#0a1730" />
      <circle cx="16.5" cy="26" r="1" fill="#fbbf3c" />
    </svg>
  );
}

function HeaderExtra({ game: s }: BoardProps<WerwolfState, WerwolfAction>) {
  const label = s.phase === "reveal" ? "Rollen" : s.phase === "night" ? `🌙 Nacht ${s.night}` : s.phase === "over" ? "Ende" : `☀️ Tag ${s.night}`;
  return <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold ring-1 ring-inset ring-border" data-testid="ww-phase">{label}</span>;
}

function MenuExtras({ game: s }: BoardProps<WerwolfState, WerwolfAction>) {
  return (
    <Section title="Verlauf">
      {s.log.length ? (
        <ul className="text-[0.95rem]">{s.log.slice().reverse().map((e, i) => <li key={i} className="border-b border-border py-2">{e}</li>)}</ul>
      ) : <p className="text-sm text-muted-foreground">Noch nichts passiert.</p>}
    </Section>
  );
}

export const werwolfUI: GameUI<WerwolfState, WerwolfAction> = { logic: werwolf, Icon, Board, Rules, MenuExtras, HeaderExtra };
