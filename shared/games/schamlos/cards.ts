/**
 * Karten für Schamlos – alle Texte selbst geschrieben, in Sets (Frech, Ab 18, Feuchtfröhlich, Rabenschwarz, Englisch).
 * Schwarze Karten haben Lücken („___“), weiße Karten füllen sie. Die Sets lassen sich beliebig mischen.
 * Eine Karte wird über ihre ID angesprochen: Set, Farbe und Nummer, z. B. „frech-w-12“.
 * Neue Karten hinten anhängen – so bleiben die IDs laufender Partien gültig.
 */
import * as frech from "./sets/frech";
import * as ab18 from "./sets/ab18";
import * as plus from "./sets/plus";
import * as schwarz from "./sets/schwarz";
import * as en from "./sets/en";

export interface CardSet { id: string; name: string; hint: string }

/** Alle eingebauten Sets in der Reihenfolge der Auswahl */
export const SETS: CardSet[] = [
  { id: "frech", name: "Frech", hint: "für alle – frech, aber für jede Runde" },
  { id: "ab18", name: "Ab 18", hint: "Freunde-Edition – derb und peinlich" },
  { id: "plus", name: "Feuchtfröhlich", hint: "für Freundschaft plus und mehr" },
  { id: "schwarz", name: "Rabenschwarz", hint: "sehr schwarzer Humor" },
  { id: "en", name: "English", hint: "filthy UK & US humour" },
];

const BLANK = "___";

const DATA: Record<string, { black: string[]; white: string[] }> = { frech, ab18, plus, schwarz, en };
type Deck = { black: string[]; white: string[] };

const ids = (set: string, kind: "b" | "w") => (DATA[set]?.[kind === "b" ? "black" : "white"] ?? []).map((_, i) => `${set}-${kind}-${i}`);

/** Sets für Erwachsene: sobald eins davon mitspielt, kommen Karten mit Kinder-Bezug aus allen Sets nicht in den Stapel */
export const ADULT_SETS = ["ab18", "plus", "en"];
/** Kinder, Schule, Jugend (deutsch und englisch) – „Schuld“/„Schulden“ ausgenommen */
export const CHILD_RE = /(^|[^a-zäöüß])(kind|kinder|kita|baby|babys|schul(?!d)|schüler|teen|jugend|pubert|enkel|tochter|töchter|sohn|söhne|nichte|neffe|minderj)|\b(child\w*|kids?|school\w*|teen\w*|daughters?|sons?|boys?|girls?|nativity|pupils?|bab(y|ies)\w*)\b/i;

/** Alle Karten der gewählten Sets zusammen – ohne gültige Auswahl das Set „Frech“ */
export function deckFor(sets: readonly string[]): Deck {
  const chosen = sets.filter((s) => s in DATA);
  const use = chosen.length ? chosen : ["frech"];
  const adult = use.some((s) => ADULT_SETS.includes(s));
  const ok = (id: string) => !adult || !CHILD_RE.test(cardText(id));
  return { black: use.flatMap((s) => ids(s, "b")).filter(ok), white: use.flatMap((s) => ids(s, "w")).filter(ok) };
}

/** Text einer Karte */
export function cardText(id: string): string {
  const [set, kind, n] = id.split("-");
  return DATA[set]?.[kind === "b" ? "black" : "white"]?.[Number(n)] ?? "";
}

/** Wie viele Lücken eine schwarze Karte hat (mindestens eine – ohne Lücke kommt die Antwort ans Ende) */
export function blanksOf(id: string): number {
  return Math.max(1, cardText(id).split(BLANK).length - 1);
}

/** Satz mit eingesetzten Antworten, als Stücke (für Hervorhebung): `fill` markiert die eingesetzten Teile */
export function fillIn(prompt: string, answers: string[]): { text: string; fill: boolean }[] {
  const text = cardText(prompt);
  const parts = text.split(BLANK);
  const words = answers.map(cardText);
  if (parts.length === 1) return [{ text: `${text} `, fill: false }, { text: words.join(" "), fill: true }];
  const out: { text: string; fill: boolean }[] = [];
  parts.forEach((p, i) => {
    // Am Satzanfang groß schreiben
    if (p) out.push({ text: p, fill: false });
    if (i < parts.length - 1) {
      let w = words[i] ?? BLANK;
      if (i === 0 && !p) w = w.charAt(0).toUpperCase() + w.slice(1);
      out.push({ text: w, fill: true });
    }
  });
  return out;
}
