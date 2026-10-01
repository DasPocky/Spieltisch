/** Karten und Würfelwertung von Tutto – reine Daten, von Logik und Oberfläche genutzt. */
export type CardId =
  | "b200" | "b300" | "b400" | "b500" | "b600"
  | "x2" | "fire" | "street" | "pm" | "stop" | "clover" | "torte" | "chance";

export interface CardType {
  id: CardId;
  name: string;
  big: string;
  sub: string;
  count: number;
  color: string;
  /** Kurzregel unter der Karte */
  rule: string;
  /** Ausführliche Erklärung zum Nachschlagen */
  help: string;
  /** Punkte-Schnelltaste, die zu dieser Karte passt */
  quick?: number;
  /** Punktwert, einheitlich auf der Karte angezeigt (wo es einen gibt) */
  value?: string;
  /** Promokarte – nur im Stapel, wenn sie in den Einstellungen an ist */
  promo?: boolean;
  /** Hausregel-Karte – Anzahl im Stapel kommt aus der Einstellung */
  house?: boolean;
}

const BONUS_HELP = (n: number) =>
  `Würfle ganz normal. Schaffst du ein Tutto (alle 6 Würfel gewertet), bekommst du deine Würfelpunkte plus ${n} Bonus. ` +
  "Danach darfst du aufhören oder weiterzocken: Dann gibt es eine neue Karte – kommt eine Stopp-Karte oder wirfst du eine Niete, sind alle Punkte dieses Zugs weg. Hörst du vor dem Tutto auf, zählen nur die Würfelpunkte.";

export const CARDS: CardType[] = [
  { id: "b200", value: "+200", name: "Bonus 200", big: "200", sub: "Bonus", count: 5, color: "#b8913a", quick: 200, rule: "Bei einem Tutto gibt es 200 Punkte extra.", help: BONUS_HELP(200) },
  { id: "b300", value: "+300", name: "Bonus 300", big: "300", sub: "Bonus", count: 5, color: "#b8913a", quick: 300, rule: "Bei einem Tutto gibt es 300 Punkte extra.", help: BONUS_HELP(300) },
  { id: "b400", value: "+400", name: "Bonus 400", big: "400", sub: "Bonus", count: 5, color: "#b8913a", quick: 400, rule: "Bei einem Tutto gibt es 400 Punkte extra.", help: BONUS_HELP(400) },
  { id: "b500", value: "+500", name: "Bonus 500", big: "500", sub: "Bonus", count: 5, color: "#b8913a", quick: 500, rule: "Bei einem Tutto gibt es 500 Punkte extra.", help: BONUS_HELP(500) },
  { id: "b600", value: "+600", name: "Bonus 600", big: "600", sub: "Bonus", count: 5, color: "#b8913a", quick: 600, rule: "Bei einem Tutto gibt es 600 Punkte extra.", help: BONUS_HELP(600) },
  { id: "x2", value: "×2", name: "x2", big: "×2", sub: "Verdoppeln", count: 5, color: "#6d62a3", rule: "Bei einem Tutto werden die Punkte dieses Zugs verdoppelt.",
    help: "Würfle ganz normal. Schaffst du ein Tutto, werden alle Punkte verdoppelt, die du in diesem Zug bisher gesammelt hast. Danach darfst du aufhören oder eine neue Karte ziehen. Hörst du vorher auf, zählen die Punkte einfach, ohne Verdopplung." },
  { id: "fire", name: "Feuerwerk", big: "*", sub: "Feuerwerk", count: 5, color: "#b86a4b", rule: "Würfeln bis zur Niete, Aufhören geht nicht. Alle Punkte bis dahin zählen.",
    help: "Du musst so lange weiterwürfeln, bis du eine Niete wirfst – freiwillig aufhören ist nicht erlaubt. Jedes Tutto zwischendurch zählt einfach mit, du würfelst danach mit allen 6 Würfeln weiter. Die Niete kostet dich hier ausnahmsweise nichts: Alle Punkte bis dahin bekommst du gutgeschrieben." },
  { id: "street", value: "2.000", name: "Straße", big: "1–6", sub: "2.000 Punkte", count: 5, color: "#4a7f8c", quick: 2000, rule: "1 bis 6 je einmal auslegen. Gelingt es, gibt es 2.000 Punkte, sonst nichts.",
    help: "Du brauchst eine Straße: Lege aus jedem Wurf mindestens einen Würfel mit einer Zahl beiseite, die du noch nicht hast, bis 1, 2, 3, 4, 5 und 6 vollständig sind. Gelingt es, gibt es 2.000 Punkte (normale Würfelpunkte zählen hier nicht). Bringt ein Wurf keine neue Zahl, ist es eine Niete." },
  { id: "pm", value: "±1.000", name: "Plus/Minus", big: "±", sub: "1.000 Punkte", count: 5, color: "#5a6478", quick: 1000, rule: "Bei einem Tutto: 1.000 Punkte für dich, der Führende verliert 1.000.",
    help: "Du musst ein Tutto würfeln. Gelingt es, bekommst du 1.000 Punkte – die Würfelpunkte zählen dabei nicht. Gleichzeitig verliert der Führende 1.000 Punkte (bei Gleichstand alle Führenden). Bist du selbst vorn, verliert niemand etwas. Bei einer Niete gibt es nichts." },
  { id: "stop", name: "Stopp", big: "STOP", sub: "Zug vorbei", count: 10, color: "#a84a57", rule: "Der Zug ist sofort vorbei. Nach einem Tutto sind alle Punkte des Zugs weg.",
    help: "Pech gehabt: Du darfst nicht würfeln, der Nächste ist dran. Hast du vorher ein Tutto geschafft und weitergezockt, verfallen alle Punkte dieses Zugs – deshalb gut überlegen, ob man nach einem Tutto lieber aufhört." },
  { id: "clover", name: "Kleeblatt", big: "K", sub: "Kleeblatt", count: 1, color: "#4f8a5e", rule: "Zweimal hintereinander Tutto – dann ist das Spiel sofort gewonnen.",
    help: "Die seltenste Karte (nur einmal im Stapel). Schaffst du zweimal hintereinander ein Tutto, ohne zwischendurch eine Niete zu werfen, hast du das Spiel sofort gewonnen – egal wie viele Punkte du hast. Aufhören geht nicht. Bei einer Niete gibt es nichts." },
  { id: "torte", value: "1.500", name: "Torte", big: "T", sub: "1.500 Punkte", count: 1, color: "#c0607e", promo: true, rule: "Drilling, zwei Fünfen und eine Eins auslegen – dann gibt es 1.500 Punkte.",
    help: "Promokarte zum 30. Geburtstag von Tutto. Du musst mit deinen 6 Würfeln eine „Geburtstagstorte“ auslegen: drei Gleiche, zwei Fünfen und eine Eins. Gelingt das (ein Tutto), bekommst du 1.500 Punkte – die normalen Würfelpunkte zählen hier nicht. Aufhören geht nicht, bei einer Niete gibt es nichts." },
  { id: "chance", name: "Chance", big: "?", sub: "Chance", count: 0, color: "#2f8a8f", house: true, rule: "Sofort die nächste Karte ziehen. Bei einer Niete darfst du die Würfel einmal neu werfen.",
    help: "Hausregel: Die Chance bleibt liegen und du ziehst sofort die nächste Karte, die ganz normal gilt. Wirfst du dabei eine Niete, darfst du genau diese Würfel noch einmal werfen – deine Punkte bleiben. Kommen mehrere Chancen hintereinander, hast du entsprechend viele Versuche. Wie viele Chance-Karten im Stapel sind, stellt ihr in den Einstellungen ein." },
];

/** Allgemeine Würfelwertung, für die Regelübersicht */
export const DICE_RULES = [
  ["1", "100"],
  ["5", "50"],
  ["Drei Einsen", "1.000"],
  ["Drei Zweien … Sechsen", "Zahl × 100"],
] as const;

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c])) as Record<CardId, CardType>;
export const DECK_SIZE = CARDS.reduce((s, c) => s + (c.promo || c.house ? 0 : c.count), 0); // 56
/** Würfelpunkte, die man mit echten Würfeln eintippen kann (Kartenboni rechnet die App selbst) */
export const POINT_STEPS = [50, 100, 200, 300, 400, 500, 600, 1000, -50] as const;
