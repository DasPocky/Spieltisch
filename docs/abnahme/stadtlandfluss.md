# Abnahmeblatt Stadt-Land-Fluss

Nach der Vorlage [Mau-Mau](maumau.md). Stand: Oktober 2026. Neues Partyspiel, Tisch als Beta. Keine Spielweise „Am Rechner“ und keine Bühne.

## Spielregel kurz

2–12 Spieler, jeder schreibt am eigenen Handy. Je Runde wird ein Buchstabe gezogen (ohne Wiederholung, bis alle dran waren; Q, X, Y nur mit Hausregel).

- **Kategorien:** Standard Stadt, Land, Fluss, Name, Beruf, Tier; weitere als Chips an- und abwählbar, bis zu vier eigene (durch Komma), zusammen höchstens zehn.
- **Stopp:** wer alle Felder hat, ruft „Stopp!“ – dann Countdown (5–30 s) für die anderen. Spätestens die Rundenzeit (aus, 60–180 s) beendet die Runde. Entwürfe gehen laufend an den Server und zählen bei Ablauf.
- **Auswertung** Kategorie für Kategorie: alle sehen alle Antworten. Daumen runter lehnt ab, wenn mehr als die Hälfte der anderen dafür ist; bei Gleichstand entscheidet der Host (ohne Entscheid gilt die Antwort). Falscher Anfangsbuchstabe zählt automatisch nicht.
- **Punkte:** 20 als Einziger mit gültiger Antwort, 10 einzigartig, 5 mehrfach (groß/klein egal, Tippfehler-Toleranz aus Zeichnen & Raten), sonst 0.
- **Pakete:** Kurz (3 Runden, Stadt, Land, Fluss, Tier), Kinder (Name, Tier, Obst & Gemüse, Essen, Gegenstand, Körperteil, Spielzeug, 30 s Countdown).
- **Nichts hängt:** Host „Stopp für alle“, dann „ohne … auswerten“; Weiter in der Auswertung; Aussteiger werden übersprungen, unter zwei Spielern ist nach der Runde Schluss.
- **Ein Handy für alle:** reihum mit Sichtschutz, ohne Uhr und ohne Stopp; abgelehnt wird gemeinsam per Tippen.
- **Bots:** Antworten aus kleinen Wortlisten je Kategorie (`shared/games/stadtlandfluss/woerter.ts`), eigene Kategorien bleiben leer.

| Punkt | Nachweis |
| --- | --- |
| Punkte 20/10/5/0, Tippfehler-Vergleich, Anfangsbuchstabe | `tests/unit/stadtlandfluss.test.ts` |
| Ablehnen: Mehrheit, Gleichstand mit Host-Entscheid, nicht die eigene | `tests/unit/stadtlandfluss.test.ts` |
| Stopp nur mit allen Feldern, Countdown, Zeit um mit Entwürfen | `tests/unit/stadtlandfluss.test.ts` |
| Geheimhaltung: beim Schreiben nur eigene Antworten, Auswertung nur bis zur aktuellen Kategorie | `tests/unit/stadtlandfluss.test.ts`, `tests/unit/tv-secret.test.ts` |
| Ende, Aussteiger, Host-Weiter, ein Handy für alle | `tests/unit/stadtlandfluss.test.ts` |
| Zufallspartien online und an einem Gerät | `tests/unit/simulate.test.ts` |
| Online mit drei Handys bis zum Ergebnis, Ablehnen, ohne Scrollen (390×844 und 320×568) | `tests/e2e/stadtlandfluss.spec.ts` |
| Vorlesen: Buchstabe, Stopp, jede Kategorie mit allen Antworten, Wertung, Sieger (Handy des Hosts) | `src/games/stadtlandfluss/narration.ts`, e2e |
| Großer Tisch | Beta – Buchstabe groß, wer fertig ist; Auswertung mit Punkten (e2e), noch nicht am Fernseher abgenommen |
