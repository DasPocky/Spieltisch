/**
 * Großer Tisch: was der gemeinsame Bildschirm von einer Partie zeigt – Stapel, Ablage, verdeckte Hände, wer dran ist.
 * Jedes Spiel, das am Tisch läuft, liefert dafür ein Modell aus seiner öffentlichen Sicht (ohne fremde Karten).
 * Spiele ohne Modell zeigt der Tisch wie ein Handy in der Mitte.
 *
 * Bausteine, aus denen ein Modell besteht (jedes Spiel nimmt, was es braucht):
 *  - Karten: Stapel, Ablage, verdeckte Hände (Anzahl je Platz), Lückensatz
 *  - Würfel: Augen, gehaltene, Hinweis („noch 2 Würfe“), Becher (Mäxchen)
 *  - Spielfeld: Raster mit Steinen zweier Farben, letzter Zug, Gewinnreihe
 *  - Brett: Dame, Mühle, Ludo – Brett mit Steinen bzw. Figuren, Würfel daneben
 *  - Aufsteller: Phase und Hinweis groß in der Mitte, Uhr, Nachtlicht (Partyspiele)
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
import { decknamenTable } from "../../games/decknamen/table";
import { allesTable } from "../../games/alles/table";
import { maexchenTable } from "../../games/maexchen/table";
import { dameTable } from "../../games/dame/table";
import { muehleTable } from "../../games/muehle/table";
import { ludoTable } from "../../games/ludo/table";
import { fischenTable } from "../../games/fischen/table";
import { hellseherTable } from "../../games/hellseher/table";
import { werwolfTable } from "../../games/werwolf/table";
import { einenachtTable } from "../../games/einenacht/table";
import { spionTable } from "../../games/spion/table";
import { stirnratenTable } from "../../games/stirnraten/table";
import { zeichnenTable } from "../../games/zeichnen/table";
import { kritzelpostTable } from "../../games/kritzelpost/table";
import { herzenTable } from "../../games/herzen/table";
import { schockenTable } from "../../games/schocken/table";
import { erklaerspielTable } from "../../games/erklaerspiel/table";
import { quizTable } from "../../games/quiz/table";

/** Kartenart: französisch/deutsch („cards“), Eins!, Textkarten (Schamlos) oder Zahlenkarten (Rückseite blau, 5:7) */
export type TableDeck = "cards" | "eins" | "schamlos" | "zahlen";

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
  dice?: {
    values: number[]; held: boolean[]; /** zählt Würfe – neue Augen rollen kurz */ n: number; note?: string;
    /** Würfel liegen unter dem Becher (Mäxchen) */
    cup?: boolean;
    /** Würfel liegen ruhig da (aufgedeckt statt geworfen) */
    still?: boolean;
  };
  /** Spielfeld: Zeilen von oben nach unten, je Feld Farbe 0/1 oder leer */
  grid?: { cells: (0 | 1 | null)[][]; colors: [string, string]; last?: [number, number] | null; line?: [number, number][] };
  /** offene Stapel in der Mitte (Zahlenkarten): Aufbaustapel, Ablage, Nachziehstapel – `top` als Text, `tone` färbt */
  piles?: { label: string; /** offene Karte; "?" = eine verdeckte Karte */ top: string | null; tone?: string; count?: number; /** einzelne Karte statt Stapel (z. B. im Stich) */ single?: boolean }[];
  /** offene Auslage je Platz (unter dem Platz): Karten im Raster, `null` = leer/abgeräumt, "?" = verdeckt */
  boards?: Record<string, { cells: ({ text: string; tone?: string } | "?" | null)[]; cols: number }>;
  /** Zeichenblatt groß über dem Tisch (Zeichnen & Raten): Striche live, darüber Titel, Lücken bzw. Begriff und Uhr */
  drawing?: { strokes: { c: number; w: number; p: string }[]; title: string; sub?: string; endsAt?: number | null };
  /** Quizfrage groß über dem Tisch: Frage, Antworten (farbig), Uhr, Stand – nach dem Auflösen die Lösung und Punkte */
  quiz?: {
    head: string; question: string; options: { text: string; letter: string; tone: string; right?: boolean }[];
    endsAt: number | null; status: string; points: { name: string; p: number }[];
    /** Bühne: Schild je Pult – beim Fragen nur „hat geantwortet“ (nie die Antwort), nach dem Auflösen richtig/falsch und Punkte */
    marks?: Record<string, QuizMark>;
  };
  /** Wortraster in der Mitte (z. B. Decknamen): Karten mit Text, aufgedeckte farbig; `title` steht darüber */
  words5?: { cells: { text: string; tone?: string }[]; cols: number; title?: string };
  /**
   * Brettspiel auf dem Tisch (Dame, Mühle, Ludo): Brettbild nach `board`, Steine und Figuren in Brett-Koordinaten
   * (-1 … 1, x nach rechts, y zum Bildschirm hin). `id` je Figur: wandert sie, gleitet sie von der alten Stelle;
   * `move` für Spiele ohne feste Figuren (letzter Zug von → nach).
   */
  tabletop?: {
    board: "dame:8" | "dame:10" | "muehle" | "ludo:4" | "ludo:6";
    pieces: { x: number; y: number; color: string; kind: "stone" | "king" | "pawn"; id?: string }[];
    move?: { from: [number, number]; to: [number, number] } | null;
    /** Würfel neben dem Brett (Ludo) */
    die?: { value: number | null; n: number };
    note?: string;
  };
  /** Aufsteller in der Mitte (Partyspiele): Phase groß, Hinweis darunter; `endsAt` zeigt eine Uhr (Zeitpunkt in ms) */
  sign?: { title: string; sub?: string; endsAt?: number | null };
  /** Nacht: Licht gedimmt, kühler */
  night?: boolean;
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

/** Schild am Pult beim Quiz auf der Bühne */
export interface QuizMark { text: string; tone: "idle" | "done" | "right" | "wrong" }

export { TABLE_GAMES } from "@shared/platform/modes";

/** Tischmodelle der Spiele */
const MODELS: Record<string, (room: RoomState) => TableModel | null> = {
  maumau: maumauTable, eins: einsTable, schamlos: schamlosTable, fuenfwuerfel: fuenfwuerfelTable, vier: vierTable, stapelbau: stapelbauTable, himmelskarten: himmelskartenTable, zehnphasen: zehnphasenTable, glueckssieben: glueckssiebenTable, decknamen: decknamenTable, alles: allesTable, maexchen: maexchenTable, dame: dameTable, muehle: muehleTable, ludo: ludoTable, fischen: fischenTable, hellseher: hellseherTable, werwolf: werwolfTable, einenacht: einenachtTable, spion: spionTable, stirnraten: stirnratenTable, zeichnen: zeichnenTable, kritzelpost: kritzelpostTable, herzen: herzenTable, schocken: schockenTable, erklaerspiel: erklaerspielTable, quiz: quizTable,
};

export function tableModel(room: RoomState): TableModel | null {
  if (room.phase !== "playing" || !room.game) return null;
  // Partie läuft nach einem Update noch mit einer älteren Version: Tisch zeigt sie wie ein Handy
  if (room.gameVersion !== undefined && room.gameVersion !== getGame(room.gameId).version) return null;
  return MODELS[room.gameId]?.(room) ?? null;
}
