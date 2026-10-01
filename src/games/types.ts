import type { ComponentType } from "react";
import type { RoomAction, RoomState } from "@shared/platform/room";
import type { GameLogic } from "@shared/platform/types";
import type { ViewMode } from "@/hooks/useViewMode";

/** Was die Plattform jeder Spiel-Oberfläche mitgibt. */
export interface BoardProps<S = unknown, A = { type: string }> {
  room: RoomState;
  /** Spielstand (online bereits auf die eigene Sicht gefiltert) */
  game: S;
  /** eigene Spieler-ID, null im lokalen Modus */
  me: string | null;
  /** wer gerade verbunden ist, null im lokalen Modus */
  online: Set<string> | null;
  isHost: boolean;
  /** Host mit eingeschalteten Spielleiter-Funktionen (lokal immer) */
  hostTools: boolean;
  /** Darf dieses Gerät gerade für den Spieler am Zug handeln? */
  canAct: boolean;
  mode: ViewMode;
  /** Spielzug an das Spiel schicken */
  act: (action: A) => void;
  /** Plattform-Aktion (Neue Runde, Lobby, …) */
  dispatch: (action: RoomAction) => void;
}

/**
 * Ein Spiel-Modul auf der Client-Seite: die gemeinsame Logik aus `shared/games/<id>`
 * plus Oberfläche, Symbol und Regelseite.
 */
export interface GameUI<S = unknown, A = { type: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logic: GameLogic<S, any>;
  /** Symbol für Kacheln und Kopfzeile */
  Icon: ComponentType<{ className?: string }>;
  /** Die laufende Partie – muss ohne Scrollen auf einen Handy-Bildschirm passen */
  Board: ComponentType<BoardProps<S, A>>;
  /** Regelseite. `focus` markiert einen Abschnitt (Element mit data-rule="…"), zu dem gescrollt wird. */
  Rules: ComponentType<{ focus?: string }>;
  /** Zusätzliche Einträge im Menü während der Partie (z. B. Verlauf, Rückgängig) */
  MenuExtras?: ComponentType<BoardProps<S, A>>;
  /** Über den Einstellungen: z. B. Vorlagen und eine Übersicht der Rollenverteilung */
  SettingsExtra?: ComponentType<{ room: RoomState; editable: boolean; online: boolean; dispatch: (action: RoomAction) => void }>;
  /** Kleine Info rechts in der Kopfzeile (z. B. Karten im Stapel) */
  HeaderExtra?: ComponentType<BoardProps<S, A>>;
}
