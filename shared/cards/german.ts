/**
 * Deutsches Blatt mit 32 Karten (Eichel, Grün, Rot, Schellen; 7 bis Ass) – gemeinsamer Kern für Kartenspiele.
 * Eine Karte ist ein String "<farbe>-<wert>", z. B. "eichel-U" (Eichel-Unter) oder "rot-10".
 */
import { shuffle } from "../platform/random";

export const SUITS = ["eichel", "gruen", "rot", "schellen"] as const;
export const RANKS = ["7", "8", "9", "10", "U", "O", "K", "A"] as const;
export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type Card = `${Suit}-${Rank}`;

export const SUIT_NAME: Record<Suit, string> = { eichel: "Eichel", gruen: "Grün", rot: "Rot", schellen: "Schellen" };
export const RANK_NAME: Record<Rank, string> = { "7": "Sieben", "8": "Acht", "9": "Neun", "10": "Zehn", U: "Unter", O: "Ober", K: "König", A: "Ass" };
/** Mehrzahl für Quartette */
export const RANK_PLURAL: Record<Rank, string> = { "7": "Siebener", "8": "Achter", "9": "Neuner", "10": "Zehner", U: "Unter", O: "Ober", K: "Könige", A: "Asse" };

export const suitOf = (c: Card) => c.slice(0, c.indexOf("-")) as Suit;
export const rankOf = (c: Card) => c.slice(c.indexOf("-") + 1) as Rank;
export const cardName = (c: Card) => `${SUIT_NAME[suitOf(c)]}-${RANK_NAME[rankOf(c)]}`;

export const isCard = (x: unknown): x is Card =>
  typeof x === "string" && SUITS.includes(x.split("-")[0] as Suit) && RANKS.includes(x.split("-")[1] as Rank) && x.split("-").length === 2;

export function fullDeck(): Card[] {
  return SUITS.flatMap((s) => RANKS.map((r) => `${s}-${r}` as Card));
}

export const shuffledDeck = () => shuffle(fullDeck());

/** Sortierung für die Hand: nach Farbe, dann Wert */
export function sortHand(cards: Card[]): Card[] {
  return cards.slice().sort((a, b) => SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)) || RANKS.indexOf(rankOf(a)) - RANKS.indexOf(rankOf(b)));
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
