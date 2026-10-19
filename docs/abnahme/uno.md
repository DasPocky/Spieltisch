# Abnahmeblatt Uno

Nach der Vorlage [Mau-Mau](maumau.md). Stand: Oktober 2026 – alle Punkte ✅, Spielweise „Am Rechner“ eingebaut **an**.

| Punkt | Nachweis |
| --- | --- |
| Regeln inkl. Grenzfälle (+2/+4 stapeln, +4 nur ohne Farbe oder mit Anzweifeln, Startkarte wirkt, Richtungswechsel zu zweit, „Uno“ vergessen, Ziehen bis es passt, 7-0, leerer Stapel, Spieler verlässt) | `tests/unit/uno.test.ts` |
| Zufallspartien mit festen Startwerten, nichts bleibt hängen | `tests/unit/simulate.test.ts`, `tests/unit/fairness.test.ts` |
| Geheimhaltung: fremde Hände, Stapel und Bluff beim +4 erst beim Anzweifeln | `tests/unit/uno.test.ts`, `tests/unit/table.test.ts`, `tests/e2e/uno.spec.ts` („jeder sieht nur seine Hand“) |
| Rechte, kaputte Nachrichten | gemeinsame Plattform: `tests/unit/room.test.ts`, `tests/e2e/security.spec.ts` |
| Lokal und online, echte Karten (Punkteblock), Spielhilfen, Hausregeln | `tests/e2e/uno.spec.ts` |
| Wiederverbinden, Funkloch, Zug genau einmal | `tests/e2e/network.spec.ts` (Uno) |
| Update mitten in der Partie | gemeinsame Plattform: `tests/e2e/update.spec.ts`, `tests/unit/upgrade.test.ts` |
| Großer Tisch 3D/flach, Bühne (Beta) | `tests/e2e/table.spec.ts`, `tests/unit/table.test.ts` |
| Am Rechner: Tisch aus eigener Sicht, Hand darunter, Tastatur (1–9, Z, P, U, A, 1–4, Esc, Enter) | `tests/e2e/geraete.spec.ts` (Uno) |
| Private Hand am Begleit-Handy | gemeinsame Plattform: `tests/e2e/geraete.spec.ts` („Private Hand“) |
| Kleine Displays (320 px) | `tests/e2e/uno.spec.ts` („passt auf 320 px“) |
| Bots: jede Stufe, 2–4 Spieler, nur erlaubte Züge, jede Partie endet | `tests/unit/bot-skill.test.ts` |
| Bausteine | Hand `platform/cards/Fan`, Tastatur `platform/desk/keys`, Plätze `platform/Seats`, Tisch `platform/table/*` |
