# Abnahmeblatt Zahlen-Rommé

Nach der Vorlage [Palast](palast.md) und [Mau-Mau](maumau.md). Stand: Oktober 2026. Neues Spiel (Kategorie Karten), Tisch als Beta. Noch keine Spielweise „Am Rechner“, keine Bühne, keine echten Steine.

## Spielregel kurz

106 Zahlensteine (1–13 in Rot ●, Blau ■, Gelb ▲, Schwarz ◆, je doppelt, dazu 2 Joker), 2–4 Spieler, je 14 Steine auf der Bank.

- **Kombinationen:** Reihe = mind. drei aufeinanderfolgende Zahlen einer Farbe (keine 1 nach der 13), Gruppe = drei oder vier gleiche Zahlen in verschiedenen Farben. Joker vertritt jeden Stein.
- **Erstes Auslegen:** mind. 30 Punkte in neuen Kombinationen, nur aus eigenen Steinen (Joker zählt den vertretenen Wert), der Tisch bleibt dabei unverändert.
- **Danach:** der ganze Tisch darf umgebaut werden (anlegen, teilen, verschieben, Joker austauschen und gleich wieder nutzen). Am Zugende ist alles gültig und mind. ein eigener Stein liegt – sonst einen Stein ziehen. Nichts vom Tisch auf die Bank.
- **Pool leer:** ziehen heißt passen; passen alle hintereinander, gewinnt die Runde, wer die kleinste Steinsumme hat.
- **Wertung:** Verlierer minus ihre Steinsumme (Joker 30), der Gewinner bekommt die Summe der anderen (bei blockierter Runde minus die eigene). Partie bis 1/3/5 Runden oder 200 Punkte (höchstens 20 Runden).
- **Zugzeit** (online, 1/2/3 Min. oder ohne): „Zeit um“ setzt den Zug zurück und zieht einen Stein. Ein Zug entsteht als Entwurf am Gerät und geht als Ganzes an den Server (`commit`), der ihn vollständig prüft.

| Punkt | Nachweis |
| --- | --- |
| Kombinationen inkl. Joker (Lücke, oben/unten, als Gruppe, Anordnung bleibt), 106/104 Steine, 14 je Spieler, Sortieren nach Farbe/Zahl | `tests/unit/zahlenromme.test.ts` |
| Umbau-Prüfung: erstes Auslegen (30 Punkte, nur eigene, Tisch unverändert), Teilen, Joker tauschen und wiederverwenden, nichts zurück auf die Bank, ungültig rot (Indizes), ohne eigenen Stein abgelehnt, kaputte Eingaben | `tests/unit/zahlenromme.test.ts` |
| Wertung (Joker 30), Runden, „Kurz“, 200 Punkte, blockierte Runde, Zeit um nur nach Ablauf | `tests/unit/zahlenromme.test.ts` |
| Geheimhaltung: fremde Bänke und Pool kennt niemand, Fernseher wie ein Außenstehender, Tisch ohne Bänke | `tests/unit/zahlenromme.test.ts`, `tests/unit/tv-secret.test.ts` (2 und 4 Spieler) |
| Nichts hängt: Host zieht für Abwesende und startet die nächste Runde; Aussteiger → Steine zurück in den Pool, allein endet die Partie; Pool leer → passen bis Rundenende | `tests/unit/zahlenromme.test.ts`, `tests/unit/simulate.test.ts` |
| Zufallspartien 2–4 Spieler, online und an einem Gerät, mit/ohne Joker, Punkte-Ziel; jeder Stein genau einmal, Tisch immer gültig | `tests/unit/simulate.test.ts` |
| Bots: legen aus, legen an, teilen Reihen, borgen Tischsteine (Enden langer Reihen, vierter einer Gruppe); jede Stufe, 2 und 4 Spieler; „schwer“ schlägt Zufall | `tests/unit/bot-skill.test.ts`, `shared/platform/botSkill.ts` |
| Startspieler wandert (je Partie und je Runde) | `tests/unit/fairness.test.ts` |
| Ein Handy für alle mit Sichtschutz bis zum Ergebnis auf 320×568 und 360×640, online mit Bots und Zugzeit auf 390×844, kein Scrollen – Tisch und Bank verkleinern sich automatisch | `tests/e2e/zahlenromme.spec.ts` |
| Bedienung: antippen (mehrere), auf Kombination/„Neu“/Bank tippen, „Zurück“, Summe beim ersten Auslegen, ungültig rot, Tipp der Spielhilfe | `tests/e2e/zahlenromme.spec.ts` |
| Vorlesen (Regeln, Beginn, erstes Auslegen mit Punkten, Legen, Ziehen, Passen, Zeit um, wenige Steine, Rundensieg, Ende) | `src/games/zahlenromme/narration.ts`, Unit-Test, e2e |
| Großer Tisch: alle Kombinationen groß in der Mitte (verkleinert sich), am Platz Steinzahl und Punkte | `src/games/zahlenromme/table.ts` – Beta, e2e-Bild |
| Offen | „Am Rechner“, Bühne, Ziehen mit dem Finger (Drag), Bots mit komplexem Umbau |
