import type { ONStep } from "@shared/games/einenacht/logic";

/** Vorlesetexte – verraten nie, welche Karte wo liegt */
export const ON_SCRIPT: Record<ONStep, { title: string; say: string }> = {
  sleep: { title: "Die Nacht beginnt", say: "Alle schließen die Augen und strecken eine Faust in die Mitte." },
  werwolf: { title: "Werwölfe", say: "Werwölfe, wacht auf und erkennt einander. Ist nur einer wach, darf er eine Karte in der Mitte ansehen. Werwölfe, schließt die Augen." },
  guenstling: { title: "Günstling", say: "Günstling, wach auf. Werwölfe, streckt den Daumen hoch, damit der Günstling euch sieht. Günstling, schließ die Augen." },
  freimaurer: { title: "Freimaurer", say: "Freimaurer, wacht auf und erkennt einander. Freimaurer, schließt die Augen." },
  seherin: { title: "Seherin", say: "Seherin, wach auf. Du darfst die Karte eines Mitspielers oder zwei Karten aus der Mitte ansehen. Seherin, schließ die Augen." },
  raeuber: { title: "Räuber", say: "Räuber, wach auf. Du darfst deine Karte mit der eines Mitspielers tauschen und deine neue ansehen. Räuber, schließ die Augen." },
  unruhestifter: { title: "Unruhestifter", say: "Unruhestifter, wach auf. Du darfst die Karten zweier anderer Spieler vertauschen. Unruhestifter, schließ die Augen." },
  betrunkener: { title: "Betrunkener", say: "Betrunkener, wach auf und tausche deine Karte mit einer aus der Mitte, ohne sie anzusehen. Betrunkener, schließ die Augen." },
  schlaflose: { title: "Schlaflose", say: "Schlaflose, wach auf und sieh dir deine Karte an. Schlaflose, schließ die Augen." },
};

export const ON_DAWN = "Alle wachen auf! Findet die Werwölfe – ihr habt nur diesen einen Tag.";
