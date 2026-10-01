import type { ONStep } from "@shared/games/einenacht/logic";

/** Vorlesetexte – verraten nie, welche Karte wo liegt. `after` wird nach der Aktion gelesen. */
export const ON_SCRIPT: Record<ONStep, { title: string; say: string; after?: string }> = {
  sleep: { title: "Die Nacht beginnt", say: "Alle schließen die Augen und strecken eine Faust in die Mitte." },
  werwolf: { title: "Werwölfe", say: "Werwölfe, wacht auf und erkennt einander. Ist nur einer wach, darf er eine Karte in der Mitte ansehen.", after: "Werwölfe, schließt die Augen." },
  guenstling: { title: "Günstling", say: "Günstling, wach auf. Werwölfe, streckt den Daumen hoch, damit der Günstling euch sieht.", after: "Werwölfe, Daumen runter. Günstling, schließ die Augen." },
  freimaurer: { title: "Freimaurer", say: "Freimaurer, wacht auf und erkennt einander.", after: "Freimaurer, schließt die Augen." },
  seherin: { title: "Seherin", say: "Seherin, wach auf. Du darfst die Karte eines Mitspielers oder zwei Karten aus der Mitte ansehen.", after: "Seherin, schließ die Augen." },
  raeuber: { title: "Räuber", say: "Räuber, wach auf. Du darfst deine Karte mit der eines Mitspielers tauschen und deine neue ansehen.", after: "Räuber, schließ die Augen." },
  unruhestifter: { title: "Unruhestifter", say: "Unruhestifter, wach auf. Du darfst die Karten zweier anderer Spieler vertauschen.", after: "Unruhestifter, schließ die Augen." },
  betrunkener: { title: "Betrunkener", say: "Betrunkener, wach auf und tausche deine Karte mit einer aus der Mitte, ohne sie anzusehen.", after: "Betrunkener, schließ die Augen." },
  schlaflose: { title: "Schlaflose", say: "Schlaflose, wach auf und sieh dir deine Karte an.", after: "Schlaflose, schließ die Augen." },
};

/** Vollständiger Text eines Schritts (für Anzeige und Vorlesen ohne Pause) */
export const fullSay = (step: ONStep) => [ON_SCRIPT[step].say, ON_SCRIPT[step].after].filter(Boolean).join(" ");

export const ON_DAWN = "Alle wachen auf! Findet die Werwölfe – ihr habt nur diesen einen Tag.";
