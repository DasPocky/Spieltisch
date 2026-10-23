/**
 * Eigene Kartensets: Spieler bauen im Profil Sets für Schamlos, Decknamen, Zeichnen & Raten und das Quiz.
 * Privat liegen sie im Profil (nur der Besitzer und Räume, die er startet, lesen sie). „Für alle vorschlagen“
 * legt eine Kopie in die Warteschlange der Verwaltung; freigegebene Sets stehen allen zur Wahl.
 *
 * Bilder (weiße Schamlos-Karten, Decknamen-Wörter) liegen in R2 unter `k/<profil-hash>/<zufall>`; im Set steht nur
 * der Schlüssel als „bild:<schlüssel>“. Alle Texte werden hier geprüft – am Server und im Editor gleich.
 */
import type { Frage } from "../games/quiz/fragen/typen";

export type SetKind = "schamlos" | "decknamen" | "zeichnen" | "quiz";
export const SET_KINDS: { id: SetKind; name: string; item: string; hint: string }[] = [
  { id: "schamlos", name: "Schamlos", item: "Karten", hint: "schwarze Karten mit Lücke ___, weiße Karten zum Einsetzen (auch als Bild)" },
  { id: "decknamen", name: "Decknamen", item: "Wörter", hint: "mindestens 25 Wörter oder Bilder" },
  { id: "zeichnen", name: "Zeichnen & Raten", item: "Begriffe", hint: "Begriffe, die man malen kann" },
  { id: "quiz", name: "Quiz & Schätzen", item: "Fragen", hint: "Auswahl, Schätzen oder Ordnen" },
];

/** Status eines Sets: privat · vorgeschlagen (wartet) · frei (für alle) · abgelehnt (mit Grund) */
export type SetStatus = "privat" | "wartet" | "frei" | "abgelehnt";

export interface CardSetData {
  /** Schamlos */
  black?: string[];
  white?: string[];
  /** Decknamen, Zeichnen */
  words?: string[];
  /** Quiz */
  questions?: Frage[];
}

export interface CardSet extends CardSetData {
  id: string;
  kind: SetKind;
  name: string;
  /** Profil-ID des Besitzers */
  owner: string;
  status: SetStatus;
  /** Grund der Ablehnung bzw. Hinweis der Verwaltung */
  note?: string;
  updatedAt: number;
}

/** Kurzinfo für Listen (ohne Inhalt) */
export interface CardSetInfo { id: string; kind: SetKind; name: string; owner: string; status: SetStatus; note?: string; count: number; updatedAt: number; by?: string }

export const SET_ID_RE = /^[a-z0-9]{12}$/;
export const MAX_SETS_PER_PROFILE = 30;
export const MAX_SET_NAME = 30;
export const MAX_ITEMS = 300;
export const MAX_TEXT = 120;
export const MAX_WORD = 40;
export const MIN_DECKNAMEN = 25;
/** So viele Sets lassen sich in einer Partie mischen */
export const MAX_SETS_IN_GAME = 6;

export const IMG_PREFIX = "bild:";
export const SET_IMAGE_KEY_RE = /^k\/[0-9a-f]{16}\/[a-z0-9]{20}$/;
export const SET_IMAGE_MAX_BYTES = 150_000;
export const SET_IMAGE_SIZE = 512;
export const isImage = (t: string) => t.startsWith(IMG_PREFIX);
export const imageKey = (t: string) => t.slice(IMG_PREFIX.length);
export const setImageUrl = (t: string) => `/api/kartenbild/${imageKey(t)}`;

export const BLANK = "___";

const clean = (t: unknown, max: number) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, max) : "");
const uniq = (xs: string[]) => [...new Map(xs.map((x) => [x.toLowerCase(), x])).values()];
const cleanItem = (t: unknown, max: number) => {
  const s = clean(t, isImage(String(t ?? "")) ? 200 : max);
  if (isImage(s)) return SET_IMAGE_KEY_RE.test(imageKey(s)) ? s : "";
  return s;
};

export class SetError extends Error {}

/** Name prüfen */
export function cleanSetName(name: unknown): string {
  const n = clean(name, MAX_SET_NAME);
  if (!n) throw new SetError("Gib dem Set einen Namen.");
  return n;
}

function cleanQuestion(q: unknown): Frage | null {
  if (!Array.isArray(q) || typeof q[0] !== "string") return null;
  const text = clean(q[0], MAX_TEXT);
  if (text.length < 3) return null;
  if (typeof q[1] === "number") {
    return Number.isFinite(q[1]) && Math.abs(q[1]) < 1e12 ? [text, q[1], clean(q[2], 12)] : null;
  }
  if (Array.isArray(q[1])) {
    const items = q[1].map((x: unknown) => clean(x, MAX_WORD));
    return items.length === 4 && items.every(Boolean) && new Set(items).size === 4 ? [text, items as [string, string, string, string]] : null;
  }
  const opts = q.slice(1, 5).map((x: unknown) => clean(x, MAX_WORD));
  return opts.length === 4 && opts.every(Boolean) && new Set(opts).size === 4 ? [text, opts[0], opts[1], opts[2], opts[3]] : null;
}

/** Inhalt eines Sets prüfen und bereinigen – wirft SetError mit verständlichem Grund */
export function cleanSetData(kind: SetKind, d: CardSetData): CardSetData {
  const list = (xs: unknown, max: number) => (Array.isArray(xs) ? uniq(xs.map((x) => cleanItem(x, max)).filter(Boolean)).slice(0, MAX_ITEMS) : []);
  if (kind === "schamlos") {
    const black = list(d.black, MAX_TEXT).filter((t) => !isImage(t));
    const white = list(d.white, MAX_TEXT);
    const bad = black.find((b) => !b.includes(BLANK));
    if (bad) throw new SetError(`Schwarze Karten brauchen eine Lücke ___: „${bad}“`);
    if (black.some((b) => b.split(BLANK).length - 1 > 3)) throw new SetError("Höchstens drei Lücken pro Karte.");
    if (!black.length && !white.length) throw new SetError("Das Set ist noch leer.");
    return { black, white };
  }
  if (kind === "quiz") {
    const qs = Array.isArray(d.questions) ? d.questions.map(cleanQuestion).filter((q): q is Frage => !!q) : [];
    const seen = new Set<string>();
    const questions = qs.filter((q) => { const k = q[0].toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, MAX_ITEMS);
    if (!questions.length) throw new SetError("Das Set hat noch keine gültige Frage.");
    return { questions };
  }
  const words = list(d.words, MAX_WORD).filter((w) => kind === "decknamen" || !isImage(w));
  if (!words.length) throw new SetError("Das Set ist noch leer.");
  return { words };
}

/** Anzahl Einträge (für Listen) */
export const setCount = (s: CardSetData) => (s.black?.length ?? 0) + (s.white?.length ?? 0) + (s.words?.length ?? 0) + (s.questions?.length ?? 0);

/** Alle Bildschlüssel eines Sets (zum Aufräumen) */
export const setImages = (s: CardSetData) => [...(s.white ?? []), ...(s.words ?? [])].filter(isImage).map(imageKey);

export const toInfo = (s: CardSet, by?: string): CardSetInfo => ({ id: s.id, kind: s.kind, name: s.name, owner: s.owner, status: s.status, note: s.note, count: setCount(s), updatedAt: s.updatedAt, ...(by ? { by } : {}) });

/**
 * Was eine Partie aus den gewählten Sets bekommt (nur Inhalte, keine Besitzer):
 * steht im Raum (`room.content`) und kommt so in den Spielkontext.
 */
export interface GameContent { sets: { id: string; name: string; data: CardSetData }[] }

/** Welche Art Sets ein Spiel nimmt (null: keine eigenen Sets) */
export const kindOfGame = (gameId: string): SetKind | null => (SET_KINDS.some((k) => k.id === gameId) ? (gameId as SetKind) : null);

/** Inhalte aller gewählten Sets zusammengelegt */
export function mergedContent(c: GameContent | null | undefined): Required<CardSetData> {
  const out: Required<CardSetData> = { black: [], white: [], words: [], questions: [] };
  for (const s of c?.sets ?? []) {
    out.black.push(...(s.data.black ?? []));
    out.white.push(...(s.data.white ?? []));
    out.words.push(...(s.data.words ?? []));
    out.questions.push(...(s.data.questions ?? []));
  }
  return out;
}
