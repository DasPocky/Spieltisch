/**
 * Die einheitliche Schnittstelle, die jedes Spiel erfüllt. Diese Datei enthält nur den Teil,
 * den Server und Client gemeinsam brauchen (Zustand, Aktionen, Rechte, Einstellungen).
 * Die Oberfläche und die Regelseite eines Spiels liegen in `src/games/<id>/`.
 */

export interface Player {
  id: string;
  name: string;
}

/** Wer darf für den Spieler am Zug handeln? Der Host darf immer. */
export type EntryMode = "turn" | "all" | "host";

export type OptionValue = string | number | boolean;
export type Options = Record<string, OptionValue>;

interface SettingBase {
  key: string;
  label: string;
  /** Darf der Host die Einstellung auch während des Spiels ändern? */
  inGame?: boolean;
  /** Zwischenüberschrift, unter der die Einstellung erscheint (z. B. „Neumond“) */
  group?: string;
}

/** Einstellungen werden deklarativ beschrieben – die Plattform zeigt sie an und prüft die Werte. */
export type SettingDef =
  | (SettingBase & { type: "choice"; default: string; choices: { value: string; label: string; hint?: string }[]; /** besondere Darstellung, z. B. Kartenblätter mit Bild */ visual?: "deck" })
  | (SettingBase & { type: "number"; default: number; min: number; max: number; step: number })
  | (SettingBase & { type: "toggle"; default: boolean; hint?: string });

/** Was ein Spiel beim Ausführen einer Aktion über den Raum erfährt. */
export interface GameContext {
  /** Spieler in Zugreihenfolge */
  players: Player[];
  hostId: string | null;
  /** Wer die Aktion auslöst – null heißt lokales Gerät (darf alles). Beim Start (`setup`) ist null = lokales Spiel. */
  actorId: string | null;
  options: Options;
  /** Zeitpunkt der Aktion in ms (Server- bzw. Gerätezeit) – für Timer; nie für Zufall verwenden */
  now: number;
}

/**
 * Rechte einer Aktion:
 * - `host`: nur der Host (lokal: jeder)
 * - `turn`: für den Spieler am Zug; wer das darf, regelt die Raumeinstellung „entry“
 * - `player`: jeder Mitspieler für sich selbst (z. B. gleichzeitige Eingaben)
 */
export type ActionKind = "host" | "turn" | "player";

export type GameCategory = "Würfel" | "Karten" | "Party";

export interface GameInfo {
  id: string;
  name: string;
  /** Ein Satz für die Spieleauswahl */
  tagline: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  /** grobe Spieldauer, z. B. „30 Min.“ */
  duration: string;
}

export interface GameLogic<S = unknown, A extends { type: string } = { type: string }> {
  info: GameInfo;
  /** Version des Spielstand-Formats – bei inkompatiblen Änderungen erhöhen */
  version: number;
  settings: SettingDef[];
  /** Zugbasiert? Dann gibt es die Einstellung „Wer darf für den Spieler am Zug handeln?“ */
  turnBased: boolean;
  /**
   * Nur der Spieler am Zug handelt selbst – auch der Host nicht für andere (z. B. bei verdeckten Handkarten).
   * Dann gibt es die Einstellung „Wer darf für den Spieler am Zug handeln?“ nicht.
   */
  ownTurnsOnly?: boolean;
  /** Dürfen Spieler während einer laufenden Partie beitreten? */
  joinMidGame: boolean;

  /** Neue Partie mit den Spielern und Einstellungen aus dem Kontext */
  setup(ctx: GameContext): S;
  /** Rechte einer Aktion, null bei unbekannten Aktionen */
  actionKind(action: A): ActionKind | null;
  /** Führt eine Aktion aus. Rechte hat die Plattform schon geprüft. Wirft GameError bei ungültigen Zügen. */
  apply(state: S, action: A, ctx: GameContext): S;
  /** Wer ist am Zug? null, wenn niemand bzw. alle gleichzeitig */
  currentPlayerId(state: S): string | null;
  /** Ist die Partie entschieden? Dann sind keine Zug-Aktionen mehr möglich. */
  isOver(state: S): boolean;

  /** Spielerzahl abhängig von den Einstellungen (z. B. Spielleiter zählt mit). Ohne: info.minPlayers/maxPlayers. */
  playerLimits?(options: Options): { min: number; max: number; note?: string };

  /**
   * Damit nichts hängen bleibt: Der Host löst auf, worauf gerade gewartet wird (z. B. ein abwesender Spieler).
   * `skipLabel` liefert die Beschriftung des Knopfes oder null, wenn gerade nichts zu überspringen ist.
   */
  skipTurn?(state: S, ctx: GameContext): S;
  skipLabel?(state: S, ctx: GameContext): string | null;
  /** Ein Spieler verlässt die laufende Partie. ctx.players enthält ihn noch. */
  onPlayerRemoved?(state: S, playerId: string, ctx: GameContext): S;
  /** Der Host hat eine Einstellung während der Partie geändert. */
  onOptionsChanged?(state: S, prev: Options, ctx: GameContext): S;
  /** Sicht eines Spielers: versteckt, was er nicht sehen darf (z. B. Kartenstapel, fremde Hände). */
  view?(state: S, viewerId: string | null): S;
}

export class GameError extends Error {}
