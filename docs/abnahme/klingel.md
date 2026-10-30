# Abnahmeblatt Klingel

Nach der Vorlage [Schocken](schocken.md). Stand: Oktober 2026. Neues Reaktions-Kartenspiel, Tisch als Beta. Noch keine Spielweise „Am Rechner“ und keine Bühne.

## Spielregel kurz

56 Obstkarten (Erdbeere, Banane, Pflaume, Birne; je Sorte 5× eine, 3× zwei, 3× drei, 2× vier, 1× fünf Früchte), 2–6 Spieler.

- **Ablauf:** Reihum deckt jeder seine oberste verdeckte Karte auf seinen offenen Stapel. Es zählt nur die oberste offene Karte jedes Spielers.
- **Klingeln:** Stehen von einer Sorte genau fünf Früchte offen, haut man auf die Klingel. Wer zuerst richtig klingelt, bekommt alle offenen Karten (gemischt unter seinen Stapel) und deckt als Nächstes auf. Falsch geklingelt: an jeden Mitspieler eine Karte (verdeckte zuerst, sonst von unten aus dem offenen Stapel); auf derselben Lage nur einmal.
- **Raus und Ende:** Ohne Karten ist man raus. Gewonnen hat, wer alle Karten hat – mit Zeitlimit (5/10/15 Min., Standard 10) nach Ablauf, wer die meisten hat; spätestens nach 1500 aufgedeckten Karten wird gezählt. Hat niemand mehr verdeckte Karten, dreht jeder seinen offenen Stapel um.
- **Takt:** „Automatisch aufdecken“ (ruhig 3 s, normal 2 s, schnell 1,3 s); ohne Takt deckt die App nach 8 s selbst auf. Pakete: Im Takt, Schnell (1,3 s, 5 Min.).
- **Wer war schneller (online):** Das erste Klingeln öffnet ein Sammelfenster von 150 ms. Jedes Handy misst seine Reaktionszeit selbst (Anzeigen der Lage bis Tippen). Gewertet wird sie nur zwischen Serverzeit − 400 ms und Serverzeit, nie unter 120 ms; gleiche Zeit und gleicher Eingang: Los. Jede Lage hat eine Nummer – Klingeln zu einer alten Lage zählt nicht („Zu spät!“).

| Punkt | Nachweis |
| --- | --- |
| Regeln inkl. Grenzfälle (genau fünf, nur oberste Karte, richtig/falsch, einmal je Lage, raus, umdrehen, Zeitlimit, Takt, Wartezeit) | `tests/unit/klingel.test.ts` |
| Fairness beim Klingeln: Reaktionszeit gekappt, Späterer mit schnellerer Reaktion gewinnt, Schummeln bringt höchstens 400 ms, nach dem Fenster zu spät, alle geklingelt → sofort, Doppeltippen, Los bei Gleichstand | `tests/unit/klingel.test.ts` |
| Nichts hängt: Wartezeit deckt selbst auf, Host überspringt (Klingel auswerten bzw. aufdecken), Aussteiger übersprungen, Letzter gewinnt | `tests/unit/klingel.test.ts` |
| Verdeckte Stapel geheim, Fernseher wie ein Außenstehender | `tests/unit/klingel.test.ts`, `tests/unit/tv-secret.test.ts` |
| Zufallspartien 2–6 Spieler, online und an einem Gerät, Takt, ohne Zeitlimit; Karten bleiben 56 | `tests/unit/simulate.test.ts` |
| Bots: Reaktionszeit je Stufe (leicht 0,95–1,7 s, mittel 0,65–1,15 s, schwer 0,42–0,72 s), selten falsch, Leichte verpassen mal eine Fünf; Server schaut gezielt nach | `shared/games/klingel/bot.ts`, `tests/unit/klingel.test.ts`, e2e mit Bots |
| Startspieler wandert je Partie | `tests/unit/fairness.test.ts` |
| Online mit drei Handys (falsch, gleichzeitig richtig), ein Handy für alle (Zonen, Mitte, mehrere Finger) bis zum Sieg, kein Scrollen auf 390×844, 360×640, 320×568 | `tests/e2e/klingel.spec.ts` |
| Vorlesen (Regeln, Takt, Zeitlimit, wer klingelt, raus, Sieger) am Host-Handy | `src/games/klingel/narration.ts`, Unit-Test, e2e |
| Großer Tisch: offene Karten groß vor den Plätzen mit Stapelzahl, Klingel in der Mitte, Name grün/rot beim Klingeln | `src/games/klingel/table.ts`, `TableBell.tsx` – Beta, e2e-Bild, noch nicht am Fernseher abgenommen |
| Offen | „Am Rechner“, Bühne, Sonderkarten (Tiere), echte Netzlaufzeiten im Feld prüfen |
