# Abnahmeblatt Wer bin ich

Nach der Vorlage [Mau-Mau](maumau.md). Stand: Oktober 2026. Neues Partyspiel, Tisch als Beta. Keine Spielweise „Am Rechner“ und keine Bühne.

## Abgrenzung zu Stirnraten

Stirnraten ist schnell und körperlich (Handy an der Stirn, Kippen, Uhr, Erklären). Wer bin ich ist ruhig und reihum: jeder hat für die ganze Partie eine Figur, fragt mit Ja/Nein, die anderen stimmen am eigenen Handy ab, Notizblock, Punkte nach Reihenfolge des Erratens.

## Spielregel kurz

3–10 Spieler. Jeder bekommt eine geheime Figur, alle anderen sehen sie am Handy, nur er selbst nicht.

- **Figuren:** aus der App (Persönlichkeiten, Märchen & Sagen, Tiere, Berufe – nur Historisches, Gemeinfreies und Allgemeines, als Chips wählbar, keine Doppelten) oder **Gegenseitig**: jeder schreibt geheim eine für seinen Nachbarn (nächster in der Reihenfolge).
- **Zug:** laut eine Ja/Nein-Frage (Text freiwillig), die anderen stimmen ab: Ja, Nein, Weiß nicht. Mehrheit entscheidet sofort, sobald sie feststeht; Gleichstand Ja/Nein = Weiß nicht. Bei Ja und Weiß nicht weiterfragen (abschaltbar, höchstens 1–5 je Zug), bei Nein der Nächste. „Zug beenden“ geht jederzeit nach der ersten Frage.
- **Raten:** getippt, tippfehlertolerant wie Zeichnen & Raten, auch mit markantem Namensteil („Einstein“). Nicht erkannt oder laut geraten: die anderen bestätigen (Mehrheit, Gleichstand = falsch). Falsch: der Nächste ist dran.
- **Punkte:** Erster so viele wie Spieler, dann je einer weniger (mindestens 1). Ende, wenn alle erraten haben oder die Fragerunden (3–30) um sind; dann Auflösung aller Figuren und Siegerehrung.
- **Notizblock:** jede Antwort landet automatisch darin, eigene Zeilen dazu und löschen; privat.
- **Pakete:** Kinder (Tiere und Märchen, 45 s), Schnell (1 Frage je Zug, 6 Runden, 20 s).
- **Nichts hängt:** Abstimmungszeit 20–60 s, danach zählen die abgegebenen Stimmen; Host setzt die Antwort (wenn er selbst fragt, über kleine Knöpfe), „Abstimmung beenden“, „… überspringen“, beim Schreiben „für … auslosen“; Aussteiger werden übersprungen, unter zwei Spielern ist Schluss.
- **Ein Handy für alle:** das Handy zeigt nur die Figur des Fragenden und nur, solange jemand den Knopf hält (der Fragende schaut weg); die Gruppe tippt Antwort bzw. Richtig/Falsch. Gegenseitig: reihum mit Sichtschutz.
- **Bots:** nur Testspieler (Fragen aus einer Liste, raten zufällig, manchmal richtig).

| Punkt | Nachweis |
| --- | --- |
| Fragen, Mehrheit, Weiterfragen, Grenze je Zug, automatische Notiz | `tests/unit/werbinich.test.ts` |
| Raten richtig/falsch, Bestätigen, Punkte nach Reihenfolge, Ende, Rundengrenze | `tests/unit/werbinich.test.ts` |
| Geheimhaltung: eigene Figur fehlt, Fernseher/Außenstehende ohne Figuren, Notizblock und Entwürfe privat | `tests/unit/werbinich.test.ts`, `tests/unit/tv-secret.test.ts` |
| Zeit um, Host-Antwort, Überspringen, Aussteiger, gegenseitig vergeben, ein Handy für alle | `tests/unit/werbinich.test.ts` |
| Zufallspartien online und an einem Gerät | `tests/unit/simulate.test.ts` |
| Online mit drei Handys bis zum Ergebnis, eigene Figur unsichtbar, ohne Scrollen (390×844 und 320×568) | `tests/e2e/werbinich.spec.ts` |
| Vorlesen: Start, wer dran ist, Frage, jede Antwort, Raten, Auflösung, Sieger (Handy des Hosts) | `src/games/werbinich/narration.ts`, e2e |
| Ein Handy für alle: Figur nur beim Halten | `tests/e2e/werbinich.spec.ts` |
| Großer Tisch | Beta – wer fragt, Frage und Abstimmung live, wer erraten hat, nie eine Figur (e2e), noch nicht am Fernseher abgenommen |
