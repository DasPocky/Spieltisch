# Abnahmeblatt Skat

Nach der Vorlage [Doppelkopf](doppelkopf.md) und [Herzen](herzen.md). Stand: November 2026. Neues Spiel (Kategorie Karten), Tisch als Beta. Noch keine Spielweise „Am Rechner“, keine Bühne, keine echten Karten.

## Spielregel kurz

Nach der offiziellen Skatordnung, vereinfacht. Drei aktive Plätze: zu viert sitzt der Geber aus, fehlen Mitspieler oder steigt jemand aus, spielt ein Bot den Platz (in der Logik, mit derselben Strategie wie „schwer“).

- **Karten:** 32 (7 bis Ass), je 10, zwei in den Skat. Augen A 11, 10 10, K 4, D 3, B 2 – zusammen 120.
- **Reizen:** Mittelhand sagt Vorhand (18, 20, 22, 23, 24, 27, 30 …, alle möglichen Spielwerte), Vorhand „ja“ oder „passe“, dann sagt Hinterhand dem Gewinner. Springen erlaubt. Sagt niemand etwas, darf Vorhand 18 spielen. Passen alle: eingepasst (zählt nicht, Geber wandert) oder mit Hausregel Ramsch.
- **Alleinspieler:** Skat aufnehmen und zwei Karten drücken (zählen für ihn) oder Hand. Farbspiel (Karo 9, Herz 10, Pik 11, Kreuz 12), Grand 24, Null 23/Hand 35/ouvert 46/ouvert Hand 59. Aus der Hand: Schneider, Schwarz angesagt, ouvert (offen, die Hand liegt für alle sichtbar; schließt Schwarz angesagt ein). Ein Null unter dem Reizwert ist gesperrt.
- **Trumpf:** Kreuz-, Pik-, Herz-, Karo-Bube, im Farbspiel dazu A, 10, K, D, 9, 8, 7 der Trumpffarbe. Null ohne Trumpf, 7 … 10, B, D, K, A. Buben bedienen nur Trumpf (außer beim Null).
- **Spielwert:** (Spitzen mit/ohne + 1 + Hand + Schneider + angesagt + Schwarz + angesagt + ouvert) × Grundwert, Spitzen über Hand und Skat. Gewonnen mit 61 (angesagt: 90 bzw. alle Stiche). Überreizt: verloren mit dem nächsten Vielfachen des Grundwerts ab dem Reizwert. Null endet mit dem ersten Stich des Alleinspielers.
- **Liste** (Seeger-Fabian vereinfacht): gewonnen + Spielwert, verloren − 2 × Spielwert (Hausregel: einfach). Keine 50 Punkte je Spiel, keine Gegenspieler-Punkte, kein Kontra/Re.
- **Ramsch** (Hausregel, Paket „Mit Ramsch“): Grand-Regeln, jeder für sich, der Skat an den letzten Stich. Die meisten Augen verlieren sie (gleich viele: alle), Jungfrau (kein Stich) verdoppelt je Jungfrau, Durchmarsch + 120. Kein Schieben.
- **Partie** über 3, 6, 12, 24 oder 36 Spiele, Geber reihum. **Zugzeit** (online): ist sie um, entscheidet die App.

| Punkt | Nachweis |
| --- | --- |
| Blatt 32/120 Augen, Reizwerte bis 264, Trumpfreihenfolge, Hand sortiert | `tests/unit/skat.test.ts` |
| Spitzen mit/ohne, Spielwert inkl. Hand, Schneider/Schwarz (erreicht und angesagt), ouvert, Null-Werte | `tests/unit/skat.test.ts` |
| Überreizen (nächstes Vielfaches, doppelt minus), Schneider rettet das Überreizen, Ansage nicht geschafft | `tests/unit/skat.test.ts` |
| Stichsieger: Buben, 10 zwischen Ass und König, Abwurf; Null: kein Trumpf, Bube bedient Farbe | `tests/unit/skat.test.ts` |
| Reizen (Mittel- an Vorhand, Hinter- an den Gewinner, Vorhand 18, alle passen → eingepasst/Ramsch), Skat, Drücken, Ansageregeln | `tests/unit/skat.test.ts` |
| Ramsch: Verlierer, Skat an den letzten Stich, Jungfrau, Durchmarsch | `tests/unit/skat.test.ts`, `tests/unit/simulate.test.ts` |
| Geheimhaltung: fremde Hände und Skat kennt niemand (Hand: auch der Alleinspieler nicht), ouvert für alle; Fernseher wie ein Außenstehender | `tests/unit/skat.test.ts`, `tests/unit/tv-secret.test.ts` (2, 3 und 4 Spieler) |
| Nichts hängt: Host passt bzw. entscheidet für Abwesende und gibt das nächste Spiel, Zugzeit, Aussteiger → Bot | `tests/unit/skat.test.ts`, `tests/unit/simulate.test.ts` |
| Zufallspartien 1–4 Menschen, online und an einem Gerät, alle Hausregeln, alle 32 Karten immer da, Wertung stimmt | `tests/unit/simulate.test.ts` |
| Bots: reizen nach Handstärke (Spitzen, Trümpfe, Asse, Null-Sicherheit), Skat oder Hand, drücken (alle 66 Paare bewertet), Spielwahl, Trumpf ziehen, schmieren, Null drunter bleiben, Ramsch Augen loswerden; jede Stufe; „schwer“ schlägt Zufall (30 von 30); feste Uhr/Startwert wiederholbar | `tests/unit/bot-skill.test.ts`, `shared/platform/botSkill.ts` |
| Geber wandert je Partie und je Spiel | `tests/unit/fairness.test.ts` |
| Ein Handy für alle mit Sichtschutz bis zum Ergebnis auf 320×568 (Reizen, 12 Karten beim Drücken, Spielwahl, Stich, Abrechnung), online mit Bots auf 360×640 (drei Plätze) und 390×844 (vier, Geber sitzt aus), kein Scrollen | `tests/e2e/skat.spec.ts` |
| Vorlesen: Geber, wer wem sagt, jedes Reizwort, Skat/Hand, Spiel, Stiche, Abrechnung mit Spitzen und Rechnung, überreizt, Ramsch, Sieger | `src/games/skat/narration.ts`, e2e |
| Großer Tisch: Reizwert bzw. Spielansage, am Platz Vorhand/Mittelhand/Hinterhand, Reizwort, Alleinspieler und Stiche, Stich in der Mitte, keine Hände, kein Skat | `src/games/skat/table.ts` – Beta, e2e-Bilder |
| Offen | „Am Rechner“, Bühne, Kontra/Re, volle Seeger-Fabian-Liste (50 Punkte, Gegenspieler-Punkte), Bock- und Ramschrunden, Schieben im Ramsch |
