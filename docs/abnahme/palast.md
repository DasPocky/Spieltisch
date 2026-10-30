# Abnahmeblatt Palast

Nach der Vorlage [Herzen](herzen.md) und [Mau-Mau](maumau.md). Stand: Oktober 2026. Neues Kartenspiel, Tisch als Beta. Noch keine Spielweise „Am Rechner“, keine Bühne, keine echten Karten.

## Spielregel kurz

Ablegespiel mit 52 Karten, 2–8 Spieler (ab sechs zwei Blätter). Die Farbe zählt nicht.

- **Geben:** je drei verdeckte Tischkarten, darauf drei offene, drei auf die Hand; Rest = Nachziehstapel.
- **Tauschen:** vor dem Start Hand- gegen offene Tischkarten, dann „Fertig“. Der Spieler nach dem Geber beginnt (wandert je Partie). Paket „Schnell“: ohne Tauschen.
- **Legen:** eine oder mehrere gleiche Karten, gleich hoch oder höher als die oberste der Ablage; danach auf drei nachziehen. Wer nicht kann, nimmt die ganze Ablage auf (nur dann).
- **Sonderkarten:** 2 = Neustart (auf alles, danach alles), 10 = Ablage verbrennen (auf alles, derselbe legt noch einmal), vier gleiche hintereinander verbrennen ebenso (Hausregel, an), 7 = der Nächste legt 7 oder niedriger (Hausregel, an; Paket „Ohne Sieben“).
- **Tischkarten:** ohne Hand und Stapel erst die offenen, dann blind die verdeckten. Passt die aufgedeckte nicht, kommt sie mit der Ablage auf die Hand.
- **Ende:** wer keine Karten mehr hat, ist fertig (Platz nach Reihenfolge); der Letzte hält die **Palastwache**.

| Punkt | Nachweis |
| --- | --- |
| Regeln inkl. Grenzfälle (Geben 1/2 Blätter, Tauschen nur eigene Karten, gleich hoch/höher, gleiche zusammen, Nachziehen, Aufnehmen nur ohne Zug, 2, 10 mit Nochmal, vier gleiche über zwei Spieler, Sieben an/aus, offene und blinde Tischkarten, blind daneben, Fertig mit 10, Plätze und Palastwache) | `tests/unit/palast.test.ts` |
| Geheimhaltung: fremde Hände, verdeckte Karten (auch eigene) und Stapel kennt niemand; Fernseher wie ein Außenstehender, Tisch zeigt nur Zahlen und offene Karten | `tests/unit/palast.test.ts`, `tests/unit/tv-secret.test.ts` (4 und 6 Spieler) |
| Nichts hängt: Host meldet beim Tauschen für alle fertig und zieht für Abwesende („Für … ziehen“, Vorschlag der Spielhilfe); Aussteiger → Karten aus dem Spiel, allein endet die Partie; wandert die Ablage 45 Züge ohne Fortschritt (z. B. eine Sieben reihum aufgenommen), wird sie verbrannt – jede Partie endet | `tests/unit/palast.test.ts` |
| Zufallspartien 2–8 Spieler, online und an einem Gerät, alle Hausregeln, Karten bleiben erhalten (52 bzw. 104) | `tests/unit/simulate.test.ts` |
| Bots: jede Stufe, 2 und 4 Spieler, jede Partie endet; Strategie: starke Karten offen, niedrigste passende zuerst, 2 und 10 aufheben, 10 auf großen Stapel; „schwer“ schlägt Zufall | `tests/unit/bot-skill.test.ts`, `shared/platform/botSkill.ts` |
| Startspieler wandert | `tests/unit/fairness.test.ts` |
| Ein Handy für alle mit Sichtschutz bis zum Ergebnis auf 320×568 und 360×640, online mit Bots auf 390×844, kein Scrollen – Hand nach Werten gebündelt (×N), passt auch nach großem Aufnehmen | `tests/e2e/palast.spec.ts` |
| Vorlesen (Tauschen, Beginn, jede Ablage, 2/7/10/vier gleiche, Aufnehmen, blind, Tischkarten, fertig, Sieger, Palastwache) | `src/games/palast/narration.ts`, Unit-Test, e2e |
| Großer Tisch: Stapel und Ablage in der Mitte, Handkarten nur als Zahl, Tischkarten am Platz (offen mit Wert, verdeckt „?“), „7 oder niedriger“ als Farbe | `src/games/palast/table.ts` – Beta, e2e-Bild |
| Offen | „Am Rechner“, Bühne, echte Karten, Hausregeln wie „3 ist unsichtbar“ |
