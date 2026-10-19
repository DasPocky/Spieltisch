# Abnahmeblatt Mau-Mau (Referenzspiel)

Mau-Mau ist das Referenzspiel: An ihm wird geprüft, was „komplett“ heißt, bevor die anderen Spiele folgen (Roadmap Phase 2.1/Phase 3). Jede Zeile nennt den Nachweis. Stand: Oktober 2026 – alle Punkte ✅, Spielweise „Am Rechner“ ist damit eingebaut **an** (`shared/platform/modes.ts`).

| Punkt | Nachweis |
| --- | --- |
| Regeln inkl. Grenzfälle (7 stapeln, 8 aussetzen, Wunsch, Unter auf Unter, 9/Ass als Hausregel, „Mau“ vergessen, leerer Stapel, Passen ohne Ziehen, Spieler verlässt) | `tests/unit/maumau.test.ts` |
| Zufallspartien mit festen Startwerten, nichts bleibt hängen | `tests/unit/simulate.test.ts` („Nichts bleibt hängen“), `tests/unit/fairness.test.ts` |
| Geheimhaltung: fremde Hände und Stapel nur als Anzahl; Tisch und Zuschauer sehen nichts Privates | `tests/unit/maumau.test.ts` („bleiben geheim“), `tests/unit/table.test.ts`, `tests/e2e/table.spec.ts` (Tisch zeigt keine Hand) |
| Rechte: nur wer dran ist, nur der Host startet; kaputte Nachrichten abgelehnt | `tests/unit/room.test.ts`, `tests/unit/protocol.test.ts`, `tests/e2e/security.spec.ts` |
| Lokal (ein Handy für alle) und online | `tests/e2e/maumau.spec.ts` |
| Wiederverbinden und Funkloch (Zug kommt genau einmal an) | `tests/e2e/network.spec.ts` (gemeinsame Plattform) |
| Update mitten in der Partie (wer dran ist, wird nicht unterbrochen; alte Version spielt zu Ende) | `tests/e2e/update.spec.ts` (Mau-Mau), `tests/unit/upgrade.test.ts` |
| Großer Tisch in 3D und flach, Fernbedienung, Ton, Moderator | `tests/e2e/table.spec.ts` |
| Am Rechner: Tisch aus eigener Sicht, Hand darunter, Tastatur (1–9, Z, P, M, Esc), umschaltbar | `tests/e2e/geraete.spec.ts` |
| Private Hand: Karten nur am Begleit-Handy, Rückfall auf den Rechner, wenn das Handy geht | `tests/e2e/geraete.spec.ts` („Private Hand“) |
| Tastatur/Touch/Maus, Namen für alle Knöpfe, reduzierte Bewegung, kleine Displays (320 px) ohne Scrollen | `tests/e2e/geraete.spec.ts`, `tests/e2e/screens.spec.ts` |
| Bots: jede Stufe, 2–4 Spieler, nur erlaubte Züge, jede Partie endet; „schwer“ gewinnt öfter | `tests/unit/bot-skill.test.ts` |
| Moderator-Rückfall: ohne KI feste Ansagen | `tests/unit/hostline.test.ts`, `tests/e2e/security.spec.ts` |
| Echte Karten (nur Punkte zählen) | `tests/e2e/realcards.spec.ts` |
| Gemeinsame Bausteine statt Einzellösungen | Hand `platform/cards/Fan`, Karten `platform/cards/PlayingCard`, Plätze `platform/Seats`, Tastatur `platform/desk/keys` (auch Uno), Tisch `platform/table/*` |
| Doku, Screenshots, „Für Spieler“ | `docs/entwicklung.md`, `screenshots/g4…g8b`, `shared/news.ts` |

## Neue Spiele

Für jedes weitere Spiel eine Kopie dieses Blatts anlegen (`docs/abnahme/<spiel>.md`), Nachweise eintragen, dann die Spielweise in `GAME_MODES` von „beta“ auf „on“ setzen.
