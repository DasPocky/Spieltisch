# Abnahmeblatt Kniffel

Nach der Vorlage [Mau-Mau](maumau.md). Stand: Oktober 2026 – alle Punkte ✅, Spielweise „Tisch“ eingebaut **an**, „Bühne“ Beta.

| Punkt | Nachweis |
| --- | --- |
| Regeln: drei Würfe, Halten, jedes Feld einmal, Streichen, Bonus ab 63, weiterer Kniffel (+50/Joker, Hausregel), Ende bei vollen Blöcken | `tests/unit/kniffel.test.ts` |
| Echte Würfel: Eingaben geprüft, Werte eintippen | `tests/unit/kniffel.test.ts`, `tests/e2e/kniffel.spec.ts` |
| Rechte, Wartebank, Spieler am Zug wird entfernt | `tests/unit/kniffel.test.ts` |
| Zufallspartien, faire Würfel | `tests/unit/simulate.test.ts`, `tests/unit/fairness.test.ts` |
| Lokal, online (nur wer dran ist würfelt, alle sehen dieselben Augen), kleines Handy ohne Scrollen, Spielhilfe | `tests/e2e/kniffel.spec.ts` |
| Großer Tisch: fünf Würfel auf dem Filz, Punkte an den Plätzen | `tests/e2e/table.spec.ts` („Bausteine am Tisch“), `tests/unit/table.test.ts` |
| Bots: jede Stufe, 2–3 Spieler, nur erlaubte Züge, jede Partie endet | `tests/unit/bot-skill.test.ts` |
| Bausteine | Würfel `platform/table/blocks` (FeltDice), 3D-Würfel `platform/dice3d` |
