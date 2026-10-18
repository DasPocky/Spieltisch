/**
 * Feste Ansagen des Moderators je Charakter – später kommen KI-Sprüche dazu (mit Rückfall auf diese hier).
 * „{name}“ wird durch den Namen ersetzt. „frech“ und „böse“ nur mit Zustimmung der Runde; böse heißt spitz, nie verletzend.
 */
export type Mood = "charmant" | "frech" | "boese";
export const MOODS: { value: Mood; label: string }[] = [
  { value: "charmant", label: "Charmant" }, { value: "frech", label: "Frech" }, { value: "boese", label: "Böse" },
];

/** hallo: Partie beginnt · dran: jemand ist am Zug · zar: neue Runde mit Kartenzar · punkt: Rundenpunkt · sieg: Partie gewonnen · pech: Missgeschick */
export type Moment = "hallo" | "dran" | "zar" | "punkt" | "sieg" | "pech";
/** Momente zum Ausprobieren in der Vorschau */
export const MOMENTS: { value: Moment; label: string }[] = [
  { value: "hallo", label: "Begrüßung" }, { value: "dran", label: "Wer ist dran" }, { value: "sieg", label: "Sieg" }, { value: "pech", label: "Pech" },
];

export const LINES: Record<Mood, Record<Moment, string[]>> = {
  charmant: {
    hallo: ["Herzlich willkommen am Spieltisch! Schön, dass ihr alle da seid.", "Guten Abend, ihr Lieben! Heute wird gespielt, gelacht und gewonnen."],
    dran: ["{name}, du bist dran – wir sind gespannt!", "{name}, die Bühne gehört dir.", "Weiter geht's mit {name}."],
    zar: ["{name} ist Kartenzar. Legt eure besten Antworten!", "Neue Runde – {name} darf diesmal entscheiden."],
    punkt: ["Der Punkt geht an {name} – herrlich!", "{name} hat den Saal überzeugt. Applaus!"],
    sieg: ["Applaus für {name} – ein verdienter Sieg!", "Großartig gespielt, {name}. Das war eine Glanzleistung!"],
    pech: ["Kopf hoch, das nächste Mal klappt es bestimmt.", "Knapp daneben ist auch vorbei – aber wunderschön versucht."],
  },
  frech: {
    hallo: ["Na, wer von euch verliert heute zuerst?", "Willkommen, willkommen! Die Snacks sind besser als eure Strategie, wetten?"],
    dran: ["{name}, du bist dran. Keine Panik, wir schauen nur alle zu.", "{name}, heute noch? Die Karten werden alt.", "{name} ist dran. Zeig, was du kannst – oder auch nicht."],
    zar: ["{name} ist Kartenzar. Bestechungen bitte unauffällig.", "{name} entscheidet. Ich hoffe, ihr habt euch Mühe gegeben."],
    punkt: ["Punkt für {name}! Ich hätte das nicht gewählt, aber gut.", "{name} kassiert ab. Die anderen schauen bitte betreten zu Boden."],
    sieg: ["{name} gewinnt! Ich hätte ja auf Glück getippt – war es auch.", "{name} siegt! Der Rest übt bitte bis nächstes Mal."],
    pech: ["Autsch. Das war … mutig.", "Tja. Manche gewinnen, andere sammeln Erfahrung."],
  },
  boese: {
    hallo: ["Ah, frische Opfer. Willkommen am Spieltisch.", "Setzt euch. Heute fließen Tränen – vor Lachen oder vor Wut."],
    dran: ["{name}, zeig uns, wie man es nicht macht.", "{name} ist dran. Ich habe meine Erwartungen schon gesenkt.", "{name}. Bitte. Irgendwas."],
    zar: ["{name} ist Kartenzar. Möge der Geschmack mit euch sein.", "{name} richtet über euch. Viel Glück, ihr werdet es brauchen."],
    punkt: ["{name} bekommt den Punkt. Erstaunlich.", "Ausgerechnet {name}. Na gut, gönnen wir es."],
    sieg: ["{name} gewinnt. Ich prüfe später, ob alles mit rechten Dingen zuging.", "{name} siegt. Die anderen haben es aber auch leicht gemacht."],
    pech: ["Herrlich. Genau so habe ich mir das vorgestellt.", "Das tat weh. Mir nicht, aber euch."],
  },
};

/** Zufällige Ansage zum Moment, mit Namen */
export function lineFor(mood: Mood, moment: Moment, name = ""): string {
  const list = LINES[mood][moment];
  return list[Math.floor(Math.random() * list.length)].replaceAll("{name}", name);
}
