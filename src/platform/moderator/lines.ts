/**
 * Feste Ansagen des Moderators je Charakter – später kommen KI-Sprüche dazu (mit Rückfall auf diese hier).
 * „frech“ und „böse“ nur mit Zustimmung der Runde; böse heißt spitz, nie verletzend.
 */
export type Mood = "charmant" | "frech" | "boese";
export const MOODS: { value: Mood; label: string }[] = [
  { value: "charmant", label: "Charmant" }, { value: "frech", label: "Frech" }, { value: "boese", label: "Böse" },
];

export type Moment = "hallo" | "dran" | "sieg" | "pech";
export const MOMENTS: { value: Moment; label: string }[] = [
  { value: "hallo", label: "Begrüßung" }, { value: "dran", label: "Wer ist dran" }, { value: "sieg", label: "Sieg" }, { value: "pech", label: "Pech" },
];

export const LINES: Record<Mood, Record<Moment, string[]>> = {
  charmant: {
    hallo: ["Herzlich willkommen am Spieltisch! Schön, dass ihr alle da seid.", "Guten Abend, ihr Lieben! Heute wird gespielt, gelacht und gewonnen."],
    dran: ["Anna, du bist dran – wir sind gespannt!", "Ben, die Bühne gehört dir."],
    sieg: ["Applaus für Anna – ein verdienter Sieg!", "Großartig gespielt, Ben. Das war eine Glanzleistung!"],
    pech: ["Kopf hoch, das nächste Mal klappt es bestimmt.", "Knapp daneben ist auch vorbei – aber wunderschön versucht."],
  },
  frech: {
    hallo: ["Na, wer von euch verliert heute zuerst?", "Willkommen, willkommen! Die Snacks sind besser als eure Strategie, wetten?"],
    dran: ["Anna, du bist dran. Keine Panik, wir schauen nur alle zu.", "Ben, heute noch? Die Würfel werden alt."],
    sieg: ["Anna gewinnt! Ich hätte ja auf Glück getippt – war es auch.", "Ben siegt! Der Rest guckt jetzt bitte betreten auf den Boden."],
    pech: ["Autsch. Das war … mutig.", "Tja. Manche gewinnen, andere sammeln Erfahrung."],
  },
  boese: {
    hallo: ["Ah, frische Opfer. Willkommen am Spieltisch.", "Setzt euch. Heute fließen Tränen – vor Lachen oder vor Wut."],
    dran: ["Anna, zeig uns, wie man es nicht macht.", "Ben ist dran. Ich habe meine Erwartungen schon gesenkt."],
    sieg: ["Anna gewinnt. Ich prüfe später, ob alles mit rechten Dingen zuging.", "Ben siegt. Die anderen haben es ihm aber auch leicht gemacht."],
    pech: ["Herrlich. Genau so habe ich mir das vorgestellt.", "Das tat weh. Mir nicht, aber euch."],
  },
};
