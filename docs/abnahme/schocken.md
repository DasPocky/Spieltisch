# Abnahmeblatt Schocken

Nach der Vorlage [Herzen](herzen.md) und [Mäxchen](maexchen.md). Stand: Oktober 2026. Neues Würfelspiel, Tisch als Beta. Noch keine Spielweise „Am Rechner“ und keine Bühne.

## Spielregel kurz

Drei Würfel, 2–10 Spieler, 13 Deckel in der Mitte.

- **Runde:** Der Beginner würfelt bis zu dreimal und legt damit die Wurfzahl für alle fest. Zwischen den Würfen Würfel herauslegen (und zurücknehmen), „Stehen lassen“ gibt weiter. Der Verlierer beginnt die nächste Runde.
- **Rangfolge:** Schock aus (1-1-1) > Schock 6…2 (1-1-x, x Deckel) > General (drei Gleiche, 3 Deckel) > Straße (2 Deckel) > Zahl (1 Deckel, gelesen von hoch nach niedrig). Gleicher Wurf: weniger Würfe vorn, sonst wer früher dran war.
- **Deckel:** Der niedrigste Wurf bekommt so viele Deckel, wie der höchste wert ist – erst aus der Mitte, danach vom Gewinner. Ist die Mitte leer, scheidet aus der Hälfte aus, wer keine Deckel hat. Wer alle 13 hat (oder Schock aus kassiert), verliert die Hälfte.
- **Partie:** zwei Hälften; zweimal derselbe Verlierer → verloren, sonst Finale der beiden. Pakete: Kurz = eine Hälfte, Kneipe = Sechsen drehen (zwei Sechsen → eine Eins, die andere zurück in den Becher, nur mit Würfen übrig).
- **Echte Würfel:** Die App zählt nur die Deckel – nach der Runde höchsten und niedrigsten Wurf und den Wert des höchsten eintippen.

| Punkt | Nachweis |
| --- | --- |
| Regeln inkl. Grenzfälle (Rangfolge, Gleichstand, Wurfzahl-Limit, Herauslegen, Mitte → Gewinner, ohne Deckel raus, Schock aus, Hälften, Finale, zweimal derselbe, Kurz, Sechsen drehen, echte Würfel) | `tests/unit/schocken.test.ts` |
| Nichts hängt: Überspringen würfelt einmal und lässt stehen (echte Würfel: Nächster beginnt), Aussteiger → Deckel zurück in die Mitte, im Finale verliert, wer geht | `tests/unit/schocken.test.ts` |
| Fernseher wie ein Außenstehender (keine Geheimnisse, Würfe sind offen) | `tests/unit/tv-secret.test.ts` |
| Zufallspartien 2–10 Spieler, online und an einem Gerät, App- und echte Würfel | `tests/unit/simulate.test.ts` |
| Bots: jede Stufe, 2 und 4 Spieler, nur erlaubte Züge; Strategie: Einsen herauslegen, Schock/General stehen lassen, nicht der Schlechteste sein | `tests/unit/bot-skill.test.ts`, `shared/platform/botSkill.ts` |
| Beginner wandert je Partie | `tests/unit/fairness.test.ts` |
| Ein Handy für alle bis zum Ergebnis auf 320×568, online mit Bots, kein Scrollen | `tests/e2e/schocken.spec.ts` |
| Vorlesen (Hälfte, Beginner, jeder Wurf, Vorgabe, Deckel, Hälfte verloren, Finale, Verlierer) am Host-Handy | `src/games/schocken/narration.ts`, Unit-Test, e2e |
| Großer Tisch: Würfel in der Mitte, Deckel und Würfe am Platz | `src/games/schocken/table.ts` – Beta, e2e-Bild, noch nicht am Fernseher abgenommen |
| Offen | „Am Rechner“, Bühne, verdeckter Becher als Hausregel |
