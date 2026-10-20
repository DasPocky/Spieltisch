/**
 * Fragen fürs Quiz – eigene Sammlung, keine Markennamen, keine fremden Fragenkataloge.
 * Kennung einer Frage: „Kategorie:Nummer“ – neue Fragen nur hinten anhängen, damit laufende Partien gültig bleiben.
 *
 * Drei Arten, als kurze Tupel (spart Platz):
 *  - Auswahl:  ["Frage?", "richtige Antwort", "falsch", "falsch", "falsch"]  (die App mischt die Reihenfolge)
 *  - Schätzen: ["Frage?", Zahl, "Einheit"]  (Einheit darf "" sein; wer am nächsten liegt, gewinnt)
 *  - Ordnen:   ["Aufgabe (z. B. vom kleinsten zum größten)", ["erstes", "zweites", "drittes", "viertes"]]  (in richtiger Reihenfolge)
 */
export type Wahl = [string, string, string, string, string];
export type Zahl = [string, number, string];
export type Folge = [string, [string, string, string, string]];
export type Frage = Wahl | Zahl | Folge;

export type Stufe = "kinder" | "familie" | "freunde";

export interface FragenKategorie {
  id: string;
  name: string;
  emoji: string;
  stufe: Stufe;
  fragen: Frage[];
}

export const isZahl = (f: Frage): f is Zahl => typeof f[1] === "number";
export const isFolge = (f: Frage): f is Folge => Array.isArray(f[1]);
export const isWahl = (f: Frage): f is Wahl => f.length === 5;
