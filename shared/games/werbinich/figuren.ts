/**
 * Figuren für „Wer bin ich“: nur historische Persönlichkeiten, gemeinfreie Gestalten aus Märchen, Sagen und alten Büchern,
 * Tiere und Berufe – keine Marken, keine geschützten Figuren.
 */
export interface Kategorie {
  id: string;
  name: string;
  /** im Paket „Kinder“ dabei */
  kinder?: boolean;
  figuren: string[];
}

export const KATEGORIEN: Kategorie[] = [
  {
    id: "personen", name: "Persönlichkeiten",
    figuren: [
      "Albert Einstein", "Kleopatra", "Napoleon", "Wolfgang Amadeus Mozart", "Johann Wolfgang von Goethe", "Marie Curie", "Leonardo da Vinci",
      "Julius Caesar", "Christoph Kolumbus", "Galileo Galilei", "Ludwig van Beethoven", "William Shakespeare", "Martin Luther", "Karl der Große",
      "Isaac Newton", "Charles Darwin", "Johann Sebastian Bach", "Jeanne d'Arc", "Marco Polo", "Sokrates", "Alexander der Große", "Nofretete",
      "Tutanchamun", "Dschingis Khan", "Florence Nightingale", "Mahatma Gandhi", "Abraham Lincoln", "Sigmund Freud", "Vincent van Gogh",
      "Queen Victoria", "Maria Theresia", "Friedrich Schiller", "Albrecht Dürer", "Johannes Gutenberg", "Hildegard von Bingen", "Kaiserin Sisi",
      "Ludwig II.", "Michelangelo", "Konfuzius", "Archimedes", "Nikolaus Kopernikus", "Alexander von Humboldt", "Thomas Edison", "Nikola Tesla",
    ],
  },
  {
    id: "maerchen", name: "Märchen & Sagen", kinder: true,
    figuren: [
      "Rotkäppchen", "Schneewittchen", "Aschenputtel", "Rumpelstilzchen", "Hänsel", "Gretel", "Frau Holle", "Froschkönig", "Dornröschen",
      "Rapunzel", "Der gestiefelte Kater", "Robin Hood", "König Artus", "Zauberer Merlin", "Odysseus", "Herkules", "Pinocchio", "Till Eulenspiegel",
      "Baron Münchhausen", "Medusa", "Zeus", "Weihnachtsmann", "Osterhase", "Zahnfee", "Drache", "Hexe", "Zwerg", "Riese", "Meerjungfrau",
      "Einhorn", "Gespenst", "Vampir", "Sherlock Holmes", "Graf Dracula", "Don Quijote", "Robinson Crusoe", "Alice im Wunderland", "Heidi",
      "Max und Moritz", "Struwwelpeter", "Der Rattenfänger von Hameln", "Rübezahl", "Der Wolf", "Die böse Königin",
    ],
  },
  {
    id: "tiere", name: "Tiere", kinder: true,
    figuren: [
      "Löwe", "Elefant", "Giraffe", "Pinguin", "Hund", "Katze", "Krokodil", "Delfin", "Eule", "Schildkröte", "Känguru", "Igel", "Fledermaus",
      "Hai", "Biene", "Kuh", "Schwein", "Pferd", "Affe", "Zebra", "Eichhörnchen", "Frosch", "Schnecke", "Papagei", "Bär", "Wolf", "Fuchs",
      "Maus", "Schmetterling", "Krake", "Nashorn", "Flamingo", "Koala", "Panda", "Kamel", "Storch", "Hamster", "Ameise", "Wal", "Tiger",
    ],
  },
  {
    id: "berufe", name: "Berufe",
    figuren: [
      "Bäcker", "Pilot", "Polizist", "Feuerwehrmann", "Zahnarzt", "Lehrer", "Koch", "Astronaut", "Tierarzt", "Gärtner", "Friseur",
      "Schornsteinfeger", "Busfahrer", "Briefträger", "Bauer", "Fischer", "Richter", "Zauberer", "Clown", "Kapitän", "Detektiv", "Schreiner",
      "Krankenpfleger", "Fotograf", "Bauarbeiter", "Bibliothekar", "Taucher", "Förster", "Ritter", "Pirat", "Dirigent", "Archäologe",
    ],
  },
];

export const KATEGORIE_BY_ID = Object.fromEntries(KATEGORIEN.map((k) => [k.id, k]));

/** Beispielfragen für Testspieler und als Platzhalter */
export const FRAGEN = [
  "Bin ich ein Mensch?", "Bin ich ein Tier?", "Lebe ich noch?", "Bin ich eine Frau?", "Kann ich fliegen?", "Bin ich berühmt?",
  "Komme ich in einem Märchen vor?", "Habe ich vier Beine?", "Lebe ich im Wasser?", "Bin ich älter als hundert Jahre?", "Trage ich eine Uniform?",
];
