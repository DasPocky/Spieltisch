/**
 * Begriffe für Stirnraten: Kategorien in vier Stufen. Kennungen der Begriffe sind „Kategorie:Nummer“ –
 * neue Begriffe nur hinten anhängen, damit laufende Partien gültig bleiben. Keine Markennamen.
 */
import { KINDER } from "./words/kinder";
import { FAMILIE } from "./words/familie";
import { FREUNDE } from "./words/freunde";
import { AB18 } from "./words/ab18";

export type Level = "kinder" | "familie" | "freunde" | "ab18";
/** Wie ein Begriff erklärt wird */
export type Style = "erklaeren" | "pantomime" | "geraeusche" | "summen" | "akzent";

export interface Category {
  id: string;
  name: string;
  level: Level;
  /** Symbol für die Auswahl */
  emoji: string;
  /** Diese Kategorie wird immer so dargestellt (z. B. Kinderlieder summen) */
  style?: Style;
  words: string[];
}

export const LEVELS: { id: Level; name: string; hint: string }[] = [
  { id: "kinder", name: "Kinder", hint: "leicht, ab 6" },
  { id: "familie", name: "Familie", hint: "für alle" },
  { id: "freunde", name: "Freunde", hint: "Partys, Alltag, Jugendwörter" },
  { id: "ab18", name: "Ab 18", hint: "frech und feuchtfröhlich" },
];

export const STYLES: { id: Style; name: string; hint: string; emoji: string }[] = [
  { id: "erklaeren", name: "Erklären", hint: "mit Worten, ohne den Begriff zu sagen", emoji: "💬" },
  { id: "pantomime", name: "Pantomime", hint: "nur zeigen – kein Wort, kein Laut", emoji: "🤐" },
  { id: "geraeusche", name: "Geräusche", hint: "nur mit Lauten und Tönen", emoji: "🔊" },
  { id: "summen", name: "Summen", hint: "singen oder summen, ohne Text", emoji: "🎵" },
  { id: "akzent", name: "Mit Akzent", hint: "erklären – aber in einem Akzent oder Dialekt", emoji: "🗣️" },
];
export const STYLE_BY_ID = Object.fromEntries(STYLES.map((s) => [s.id, s])) as Record<Style, (typeof STYLES)[number]>;

export const CATEGORIES: Category[] = [...KINDER, ...FAMILIE, ...FREUNDE, ...AB18];
export const CAT_BY_ID: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
/** Eigene Begriffe der Runde */
export const CUSTOM = "eigene";

const RANK: Record<Level, number> = { kinder: 0, familie: 1, freunde: 2, ab18: 3 };
export const levelOf = (v: unknown): Level => (typeof v === "string" && v in RANK ? (v as Level) : "familie");
/** Kategorien bis zur gewählten Stufe (Kinder nur Kinder, „Ab 18“ alles) */
export const catsUpTo = (level: Level) => CATEGORIES.filter((c) => RANK[c.level] <= RANK[level]);

/** Alle Begriffe einer Kategorie als Kennungen */
export const wordIds = (cat: Category) => cat.words.map((_, i) => `${cat.id}:${i}`);

/** Text zu einer Kennung – eigene Begriffe stehen im Spielstand */
export function wordText(id: string | null | undefined, custom: string[] = []): string {
  if (!id) return "";
  const [cat, n] = id.split(":");
  if (cat === CUSTOM) return custom[Number(n)] ?? "";
  return CAT_BY_ID[cat]?.words[Number(n)] ?? "";
}

export const catOfWord = (id: string) => id.split(":")[0];
export const catName = (id: string | null | undefined) => (id === CUSTOM ? "Eigene Begriffe" : id === "mix" ? "Bunt gemischt" : (id && CAT_BY_ID[id]?.name) || "");
export const totalWords = () => CATEGORIES.reduce((t, c) => t + c.words.length, 0);
