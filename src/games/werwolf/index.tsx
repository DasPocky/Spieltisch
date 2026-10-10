import { Crown, Moon, Sun } from "lucide-react";
import { werwolf, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import type { BoardProps, GameUI } from "@/games/types";
import { LogList } from "@/platform/PlayersHistory";
import { Setup } from "./Setup";
import { Board } from "./Board";
import { Rules } from "./Rules";
import { Icon } from "./Icon";



function HeaderExtra({ game: s }: BoardProps<WerwolfState, WerwolfAction>) {
  const label = s.phase === "assign" ? "Karten" : s.phase === "reveal" ? "Rollen" : s.phase === "night" ? `Nacht ${s.night}`
    : s.phase === "over" ? "Ende" : s.phase === "election" ? "Wahl" : `Tag ${s.night}`;
  const Icon = s.phase === "night" ? Moon : s.phase === "election" ? Crown : ["day", "hunter", "successor"].includes(s.phase) ? Sun : null;
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border" data-testid="ww-phase">
      {Icon && <Icon aria-hidden="true" className="size-4 text-ice" />}{label}
    </span>
  );
}

/** Verlauf für „Spieler & Verlauf“ */
function History({ game: s }: BoardProps<WerwolfState, WerwolfAction>) {
  return <LogList entries={s.log} />;
}

export const werwolfUI: GameUI<WerwolfState, WerwolfAction> = { logic: werwolf, Icon, Board, Rules, History, HeaderExtra, SettingsExtra: Setup };
