/**
 * Großer Tisch: was der gemeinsame Bildschirm von einer Partie zeigt – Stapel, Ablage, verdeckte Hände, wer dran ist.
 * Jedes Spiel, das am Tisch läuft, liefert dafür ein Modell aus seiner öffentlichen Sicht (ohne fremde Karten).
 * Spiele ohne Modell zeigt der Tisch wie ein Handy in der Mitte.
 *
 * Bausteine, aus denen ein Modell besteht (jedes Spiel nimmt, was es braucht):
 *  - Karten: Stapel, Ablage, verdeckte Hände (Anzahl je Platz), Lückensatz
 *  - Würfel: Augen, gehaltene, Hinweis („noch 2 Würfe“)
 *  - Spielfeld: Raster mit Steinen zweier Farben, letzter Zug, Gewinnreihe
 *  - Stapel: offene Zahlenkarten in der Mitte (Aufbau, Ablage)
 *  - Auslage: offene Karten je Platz im Raster (Himmelskarten, Stapelbau-Ablagen)
 *  - Plätze: wer dran ist, Punkte, eine kurze Notiz je Platz
 * Das Modell baut jedes Spiel selbst (src/games/<id>/table.ts) aus seiner öffentlichen Sicht.
 */
import type { RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import { maumauTable } from "../../games/maumau/table";
import { einsTable } from "../../games/eins/table";
import { schamlosTable } from "../../games/schamlos/table";
import { fuenfwuerfelTable } from "../../games/fuenfwuerfel/table";
import { vierTable } from "../../games/vier/table";
import { stapelbauTable } from "../../games/stapelbau/table";
import { himmelskartenTable } from "../../games/himmelskarten/table";
import { zehnphasenTable } from "../../games/zehnphasen/table";
import { glueckssiebenTable } from "../../games/glueckssieben/table";

/** Kartenart: französisch/deutsch („cards“), Eins! oder Textkarten (Schamlos) */
export type TableDeck = "cards" | "eins" | "schamlos";

export interface TableModel {
  deck: TableDeck;
  /** Karten im Stapel */
  pile: number;
  /** oberste Karten der Ablage, die oberste zuletzt */
  discard: string[];
  /** Kartenzahl je Spieler (Reihenfolge wie am Tisch) */
  counts: Record<string, number>;
  /** wer dran ist */
  turn: string | null;
  /** zählt Züge – neue Karte auf der Ablage fliegt vom Platz dessen, der eben dran war */
  n: number;
  /** Farbe, die gerade gilt (Wunsch nach Unter bzw. Eins-Farbe) – als Text und Farbton */
  color?: { label: string; hex: string };
  /** Punkte je Spieler, falls das Spiel mitzählt */
  scores?: Record<string, number>;
  /** letzte Ereignisse, das neueste zuletzt */
  log: string[];
  /** kurze Notiz je Platz (z. B. Farbe oder Punkte) */
  notes?: Record<string, string>;
  /** Würfel in der Mitte */
  dice?: { values: number[]; held: boolean[]; /** zählt Würfe – neue Augen rollen kurz */ n: number; note?: string };
  /** Spielfeld: Zeilen von oben nach unten, je Feld Farbe 0/1 oder leer */
  grid?: { cells: (0 | 1 | null)[][]; colors: [string, string]; last?: [number, number] | null; line?: [number, number][] };
  /** offene Stapel in der Mitte (Zahlenkarten): Aufbaustapel, Ablage, Nachziehstapel – `top` als Text, `tone` färbt */
  piles?: { label: string; top: string | null; tone?: string; count?: number }[];
  /** offene Auslage je Platz (unter dem Platz): Karten im Raster, `null` = leer/abgeräumt, "?" = verdeckt */
  boards?: Record<string, { cells: ({ text: string; tone?: string } | "?" | null)[]; cols: number }>;
  /** Lückensatz-Spiele: schwarze Karte, verdeckt gelegte und aufgedeckte Antworten */
  words?: {
    prompt: string;
    /** wer schon verdeckt gelegt hat (in dieser Reihenfolge) */
    playedBy: string[];
    /** aufgedeckte Antworten (ab dem Wählen), je Antwort eine oder zwei Karten */
    subs: string[][];
    /** gewählte Antwort und von wem (nach dem Wählen) */
    pick: number | null;
    pickBy: string | null;
  };
}

export { TABLE_GAMES } from "@shared/platform/modes";

/** Tischmodelle der Spiele */
const MODELS: Record<string, (room: RoomState) => TableModel | null> = {
  maumau: maumauTable, eins: einsTable, schamlos: schamlosTable, fuenfwuerfel: fuenfwuerfelTable, vier: vierTable, stapelbau: stapelbauTable, himmelskarten: himmelskartenTable, zehnphasen: zehnphasenTable, glueckssieben: glueckssiebenTable,
};

export function tableModel(room: RoomState): TableModel | null {
  if (room.phase !== "playing" || !room.game) return null;
  // Partie läuft nach einem Update noch mit einer älteren Version: Tisch zeigt sie wie ein Handy
  if (room.gameVersion !== undefined && room.gameVersion !== getGame(room.gameId).version) return null;
  return MODELS[room.gameId]?.(room) ?? null;
}
