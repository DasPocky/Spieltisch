# Abnahmeblatt Schamlos

Nach der Vorlage [Mau-Mau](maumau.md). Stand: Oktober 2026. Schamlos hat keine Spielweise „Am Rechner“ (gespielt wird am Handy, der Bildschirm ist Tisch oder Bühne).

| Punkt | Nachweis |
| --- | --- |
| Regeln: legen, Zar wählt anonym, Punkt, nächster Zar, Ziel­punkte, Lückentext (Satzanfang groß, zwei Lücken) | `tests/unit/schamlos.test.ts` |
| Inhalte: jedes Set groß genug, ab-18-Sets ohne Kinder-Bezug, Sets mischen | `tests/unit/schamlos.test.ts` |
| Nichts hängt: Host deckt ohne Fehlende auf, wählt statt Zar, neue Karte wenn niemand legte; Spieler geht (auch als Zar) | `tests/unit/schamlos.test.ts` |
| Zufallspartien | `tests/unit/simulate.test.ts` |
| Geheimhaltung: fremde Hände und gelegte Karten verdeckt, beim Wählen anonym | `tests/unit/schamlos.test.ts` („Sicht“) |
| Online mit drei Handys, an einem Gerät mit Sichtschutz, ohne Scrollen | `tests/e2e/schamlos.spec.ts` |
| Großer Tisch (Karten in 3D und flach) | `tests/e2e/table.spec.ts`, `tests/unit/table.test.ts` |
| Bühne: schwarze Karte groß auf der Leinwand, Antworten eingesetzt, Punkt hervorgehoben | `tests/e2e/table.spec.ts` („Bühne bei Schamlos“) |
| Moderator: Kartenzar und Rundenpunkt werden angesagt | `src/platform/table/host.tsx` (Moment „zar“, „punkt“) |
| Bots legen und wählen | `shared/platform/bots.ts` (Fall „schamlos“), `tests/unit/simulate.test.ts` |

Offen: Paket B (eigene Kartensets mit Freigabe, Bildkarten) – siehe Roadmap.
