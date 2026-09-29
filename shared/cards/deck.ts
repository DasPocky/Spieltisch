/**
 * Kartenblätter für alle Kartenspiele: französisch (32 oder 52 Karten) und deutsch (32 Karten).
 * Eine Karte ist ein String "<farbe>-<wert>", z. B. "herz-B" (Herz-Bube) oder "eichel-U" (Eichel-Unter).
 */
import { shuffle } from "../platform/random";
import type { Options } from "../platform/types";

export const FR_SUITS = ["kreuz", "pik", "herz", "karo"] as const;
export const DE_SUITS = ["eichel", "gruen", "rot", "schellen"] as const;
export type Suit = (typeof FR_SUITS)[number] | (typeof DE_SUITS)[number];
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "U" | "O" | "B" | "D" | "K" | "A";
export type Card = `${Suit}-${Rank}`;

export type DeckId = "fr32" | "fr52" | "de32";
export interface Deck {
  id: DeckId;
  name: string;
  hint: string;
  suits: readonly Suit[];
  ranks: readonly Rank[];
}

export const DECKS: Record<DeckId, Deck> = {
  fr32: { id: "fr32", name: "Französisch", hint: "32 Karten, 7 bis Ass", suits: FR_SUITS, ranks: ["7", "8", "9", "10", "B", "D", "K", "A"] },
  fr52: { id: "fr52", name: "Französisch", hint: "52 Karten, 2 bis Ass", suits: FR_SUITS, ranks: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K", "A"] },
  de32: { id: "de32", name: "Deutsch", hint: "32 Karten, Eichel bis Schellen", suits: DE_SUITS, ranks: ["7", "8", "9", "10", "U", "O", "K", "A"] },
};

/** Einstellung „Blatt“ für Kartenspiele – die Oberfläche zeigt dazu kleine Karten */
export function deckSetting(defaultDeck: DeckId) {
  return {
    key: "deck", label: "Kartenspiel", type: "choice" as const, default: defaultDeck, visual: "deck" as const,
    choices: [
      { value: "fr32", label: "Skat", hint: "32 Karten" },
      { value: "fr52", label: "Rommé", hint: "52 Karten" },
      { value: "de32", label: "Deutsch", hint: "32 Karten" },
    ],
  };
}

export const deckOf = (o: Options, fallback: DeckId = "fr32"): Deck => DECKS[(o.deck as DeckId) in DECKS ? (o.deck as DeckId) : fallback];

export const SUIT_NAME: Record<Suit, string> = {
  kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo",
  eichel: "Eichel", gruen: "Grün", rot: "Rot", schellen: "Schellen",
};
export const RANK_NAME: Record<Rank, string> = {
  "2": "Zwei", "3": "Drei", "4": "Vier", "5": "Fünf", "6": "Sechs", "7": "Sieben", "8": "Acht", "9": "Neun", "10": "Zehn",
  U: "Unter", O: "Ober", B: "Bube", D: "Dame", K: "König", A: "Ass",
};
/** Mehrzahl („hast du Könige?“) */
export const RANK_PLURAL: Record<Rank, string> = {
  "2": "Zweier", "3": "Dreier", "4": "Vierer", "5": "Fünfer", "6": "Sechser", "7": "Siebener", "8": "Achter", "9": "Neuner", "10": "Zehner",
  U: "Unter", O: "Ober", B: "Buben", D: "Damen", K: "Könige", A: "Asse",
};
/** Mehrzahl im Dativ („nach Königen fragen“) */
export const RANK_DATIVE: Record<Rank, string> = {
  "2": "Zweiern", "3": "Dreiern", "4": "Vierern", "5": "Fünfern", "6": "Sechsern", "7": "Siebenern", "8": "Achtern", "9": "Neunern", "10": "Zehnern",
  U: "Untern", O: "Obern", B: "Buben", D: "Damen", K: "Königen", A: "Assen",
};

export const suitOf = (c: Card) => c.slice(0, c.indexOf("-")) as Suit;
export const rankOf = (c: Card) => c.slice(c.indexOf("-") + 1) as Rank;
export const cardName = (c: Card) => `${SUIT_NAME[suitOf(c)]}-${RANK_NAME[rankOf(c)]}`;
/** Der „Wünscher“: Unter im deutschen, Bube im französischen Blatt */
export const isJack = (c: Card) => rankOf(c) === "U" || rankOf(c) === "B";
export const isFrench = (suit: Suit) => (FR_SUITS as readonly string[]).includes(suit);

export function isCardOf(deck: Deck, x: unknown): x is Card {
  if (typeof x !== "string") return false;
  const [s, r, ...rest] = x.split("-");
  return !rest.length && deck.suits.includes(s as Suit) && deck.ranks.includes(r as Rank);
}

export function fullDeck(deck: Deck): Card[] {
  return deck.suits.flatMap((s) => deck.ranks.map((r) => `${s}-${r}` as Card));
}

export const shuffledDeck = (deck: Deck) => shuffle(fullDeck(deck));

/** Sortierung für die Hand: nach Farbe, dann Wert */
export function sortHand(cards: Card[], deck: Deck): Card[] {
  return cards.slice().sort((a, b) => deck.suits.indexOf(suitOf(a)) - deck.suits.indexOf(suitOf(b)) || deck.ranks.indexOf(rankOf(a)) - deck.ranks.indexOf(rankOf(b)));
}

/** Sortierung nach Wert (für Quartett-Spiele), dann Farbe */
export function sortByRank(cards: Card[], deck: Deck): Card[] {
  return cards.slice().sort((a, b) => deck.ranks.indexOf(rankOf(a)) - deck.ranks.indexOf(rankOf(b)) || deck.suits.indexOf(suitOf(a)) - deck.suits.indexOf(suitOf(b)));
}

/** Zieht `n` Karten vom Stapel (Ende = oben). Ist er leer, wird `refill()` gefragt. */
export function drawCards(pile: Card[], n: number, refill: () => Card[]): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (!pile.length) pile.push(...refill());
    const c = pile.pop();
    if (!c) break;
    out.push(c);
  }
  return out;
}
