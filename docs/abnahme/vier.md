# Abnahmeblatt Vier in einer Reihe

Nach der Vorlage [Mau-Mau](maumau.md). Stand: Oktober 2026 – alle Punkte ✅, Spielweise „Tisch“ eingebaut **an**, „Bühne“ Beta.

| Punkt | Nachweis |
| --- | --- |
| Regeln: genau zwei, Rot beginnt, volle Spalte, waagerecht/senkrecht/diagonal, Unentschieden, Nochmal tauscht Farben, Brettgröße, Aufgeben, Verlassen, Überspringen | `tests/unit/vier.test.ts` |
| Zufallspartien (7×6 und 9×7) | `tests/unit/simulate.test.ts` |
| Lokal, online, kleines Handy (320×568) | `tests/e2e/vier.spec.ts` |
| Großer Tisch: Brett von oben, letzter Stein, Gewinnreihe | `tests/e2e/table.spec.ts`, `tests/unit/table.test.ts` |
| Partyabend mit Vier in einer Reihe | `tests/e2e/table.spec.ts` („Partyabend“) |
| Bots: „schwer“ nimmt den Sieg und blockt, schlägt Zufall deutlich; jede Stufe nur erlaubte Züge | `tests/unit/bot-skill.test.ts` |
| Bausteine | Spielfeld `platform/table/blocks` (FeltGrid), Brett `src/games/_board` |
