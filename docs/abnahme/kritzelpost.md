# Abnahmeblatt Kritzelpost

Nach der Vorlage [Mau-Mau](maumau.md). Stand: Oktober 2026. Neues Partyspiel, Tisch als Beta. Keine Spielweise „Am Rechner“ und keine Bühne.

## Spielregel kurz

Stille Post mit Bildern, 3–8 Spieler. Jeder hat eine Kette. In Schritt k bearbeitet der j-te Spieler (feste Reihenfolge vom Start) die Kette (j − k) mod n – so viele Schritte wie Spieler, jeder einmal in jeder Kette, die eigene nur in Schritt 1.

- **Normal:** Schritt 1 jeder schreibt einen Satz, danach abwechselnd zeichnen (den Satz davor) und beschreiben (die Zeichnung davor).
- **Eisbrecher:** alle Ketten beginnen mit demselben vorgegebenen Satz, Schritt 1 ist Zeichnen.
- Man sieht immer nur die Seite direkt davor. Uhr je Schritt (aus, 60–180 s): was bei Ablauf dasteht, zählt (Zeichnung: der Entwurf), sonst bleibt die Seite leer.
- Wer aussteigt, wird übersprungen (seine Seiten bleiben „ausgestiegen“); unter zwei Spielern geht es gleich ins Album. Der Host kann jeden Schritt „ohne … weiter“ beenden.
- Album: der Host blättert Kette für Kette; nach dem Ende darf jeder selbst blättern. Keine Punkte, keine Sieger.
- An einem Handy für alle: reihum mit Sichtschutz, ohne Uhr.

| Punkt | Nachweis |
| --- | --- |
| Zuteilung 3–8 Spieler: jede Seite jeder Kette von genau einem, keine Rückgabe der eigenen Kette | `tests/unit/kritzelpost.test.ts` |
| Geheimhaltung: nur Vorgängerseite und eigener Entwurf, Fernseher nur Fortschritt, Album erst beim Aufschlagen | `tests/unit/kritzelpost.test.ts`, `tests/unit/tv-secret.test.ts` |
| Nichts hängt: Zeit um, leere Abgabe, Aussteiger, Host-Weiter | `tests/unit/kritzelpost.test.ts` |
| Grenzen: Text 100 Zeichen, je Zeichnung 300 Striche bzw. 10.000 Zeichen Strichdaten (Server prüft) | `shared/games/kritzelpost/logic.ts`, Test „Größe begrenzt“ |
| Zufallspartien online und an einem Gerät | `tests/unit/simulate.test.ts` |
| Online mit drei Handys bis zum Album, ohne Scrollen (390×844 und 320×568) | `tests/e2e/kritzelpost.spec.ts` |
| Vorlesen: Schritte und Album (Handy des Hosts) | `src/games/kritzelpost/Board.tsx` (`useNarration`), e2e |
| Großer Tisch | offen (Beta, noch nicht am Fernseher abgenommen) |
