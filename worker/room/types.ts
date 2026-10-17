/** Daten eines Raums auf dem Server (Durable Object) – Typen, die die Raum-Bausteine teilen */
import type { RoomState } from "../../shared/platform/room";
import type { RecentGame } from "../../shared/platform/profile";
import type { CallPeer, ChatMsg } from "../../shared/platform/protocol";

export interface RoomData {
  pinHash: string;
  salt: string;
  /** Raum mit Spielern, Einstellungen und Spielstand */
  state: RoomState;
  /** playerId → geheimer Token zum Wiederverbinden */
  tokens: Record<string, string>;
  fails: number;
  lockUntil: number;
  createdAt: number;
  /** Beim Anlegen wurde der Zugangscode genannt – dann dürfen auch Spiele hinter dem Code gewählt werden */
  unlocked?: boolean;
  /** playerId → Profil-ID (nur auf dem Server, nie an andere Spieler) */
  profiles?: Record<string, string>;
  /** playerId → aktive Gruppe (nur auf dem Server) – bekommt das Ergebnis der Partie */
  groups?: Record<string, string>;
  /** Zuletzt ausgeführte Aktions-IDs je Spieler – doppelt geschickte Aktionen werden nur einmal ausgeführt */
  seen?: Record<string, string[]>;
  /**
   * Beitritts-Nonce → Spieler und Zeitpunkt, damit ein wiederholter Beitritt (Antwort ging verloren) keinen zweiten Spieler anlegt.
   * Gilt nur kurz (JOIN_RETRY_MS) und nur zusammen mit der richtigen PIN – danach verbindet nur noch das Token.
   * (Ältere Räume speichern hier nur die Spieler-ID – solche Einträge gelten als abgelaufen.)
   */
  joins?: Record<string, { id: string; at: number } | string>;
  /** Vom Host entfernte Spieler (die letzten) – ihr Handy darf nicht still per Name + PIN wieder hinein */
  kicked?: string[];
  /** Sprach-/Videochat: wer drin ist, und welche SFU-Sitzung wem gehört */
  call?: Record<string, CallPeer>;
  callSessions?: Record<string, string>;
  /** Text-Chat: die letzten Nachrichten */
  chat?: ChatMsg[];
  /** Eigener Raumcode (für die Admin-Übersicht) und letzte Änderung */
  code?: string;
  updatedAt?: number;
  /** Wer gerade anklopft (Einlass „PIN und Anklopfen“) */
  knocks?: Knock[];
  /** Abgelehnt: Profil-ID bzw. Name → darf erst ab dann wieder anklopfen */
  denied?: Record<string, number>;
  /** Testraum (Bots): unsichtbar unter „Offene Räume“, zählt nicht in der Statistik */
  test?: boolean;
  /** Zustands-Revision: steigt mit jeder gespeicherten Änderung des Raums – Geräte verwerfen ältere Stände */
  rev?: number;
  /** Noch nicht angekommene Ergebnisse für Profile und Gruppen (werden wiederholt) */
  results?: ResultJob[];
}

/** Ein Ergebnis, das an ein Profil oder eine Gruppe muss */
export type ResultJob =
  | { kind: "profile"; target: string; event: string; entry: RecentGame; since: number }
  | { kind: "group"; target: string; event: string; gameId: string; entries: { profile: string; won: boolean }[]; since: number };
/** Ein Gast mit richtiger PIN, der auf Einlass wartet – mit allem, was der Beitritt danach braucht */
export interface Knock {
  id: string;
  name: string;
  at: number;
  snoozed?: boolean;
  avatar?: unknown;
  profile?: string;
  group?: string;
  nonce?: string;
  /** Verbindung des Gasts weg seit – nach einem kurzen Funkloch geht es einfach weiter */
  goneAt?: number;
  /** Eingelassen, während der Gast kurz weg war – beim Wiederverbinden kommt er direkt hinein */
  admitted?: boolean;
}
export interface Attachment {
  playerId: string | null;
  /** wartet vor der Tür (Anklopfen) */
  knock?: string;
  /** Verwaltung oder Großer Tisch schaut zu (nur lesen) */
  watch?: boolean;
  /** Großer Tisch (mit PIN angemeldet) */
  table?: boolean;
}
