# Abnahmeblatt Bluff

Nach der Vorlage [Schocken](schocken.md) und [Mäxchen](maexchen.md). Stand: Oktober 2026. Neues Würfelspiel, Tisch als Beta. Noch keine Spielweise „Am Rechner“ und keine Bühne.

## Spielregel kurz

Fünf Würfel je Spieler verdeckt unter dem Becher, 2–8 Spieler.

- **Ansage:** reihum „mindestens N Würfel zeigen X“ über alle Becher. Jede Ansage höher: mehr Würfel oder gleich viele mit höherer Augenzahl. Höchstens so viele, wie Würfel im Spiel sind.
- **Joker (Standard):** Einsen zählen für jede Augenzahl. Auf Einsen wechseln: halbe Anzahl (aufgerundet), zurück: doppelt plus eins. Mit Einsen eröffnet niemand. Paket „Ohne Joker“: Einsen zählen nur als Eins, Eröffnen auf Einsen erlaubt.
- **Bluff!:** alle decken auf. Liegen weniger als angesagt, verliert der Ansager einen Würfel, sonst der Rufer. Der Verlierer beginnt (ist er raus, sein Nachbar).
- **Genau! (Hausregel, an):** liegen exakt so viele, bekommt der Rufer einen Würfel zurück (höchstens bis zur Startzahl) und beginnt; sonst verliert er einen.
- **Ende:** ohne Würfel raus, der Letzte gewinnt (nach dem Aufdecken „Zum Ergebnis“). Paket „Kurz“: drei Würfel je Spieler.
- **Echte Würfel:** Die App führt Ansagen und Würfelzahl; wer ruft, tippt nach dem Aufdecken ein, wie viele passende Würfel liegen.

| Punkt | Nachweis |
| --- | --- |
| Regeln inkl. Grenzfälle (Erhöhen, Joker-Umrechnung, Eröffnen auf Einsen, Obergrenze, Bluff stimmt/stimmt nicht, Genau mit/ohne Rückgabe und daneben, raus → Nachbar beginnt, Ende, echte Würfel) | `tests/unit/bluff.test.ts` |
| Geheimnis: jeder sieht nur seinen Becher, Fernseher keinen; beim Aufdecken alle | `tests/unit/bluff.test.ts`, `tests/unit/tv-secret.test.ts`, e2e |
| Nichts hängt: Überspringen → alle würfeln neu, Nächster beginnt; Aussteiger → neue Runde bzw. Ende; „Weiter“ nach dem Aufdecken darf jeder | `tests/unit/bluff.test.ts` |
| Zufallspartien 2–8 Spieler, online und an einem Gerät, App- und echte Würfel, ohne Joker/Genau, Kurz | `tests/unit/simulate.test.ts` |
| Bots: jede Stufe, 2 und 4 Spieler; Strategie: Wahrscheinlichkeit aus eigenen Würfeln (Binomial), sicherste Erhöhung oder zweifeln, „Genau!“ nur bei guter Chance; Lesepause beim Aufdecken | `tests/unit/bot-skill.test.ts`, `shared/platform/botSkill.ts` |
| Beginner wandert je Partie | `tests/unit/fairness.test.ts` |
| Ein Handy für alle (Sichtschutz, Becher anheben) bis zum Ergebnis auf 320×568, online mit Bots, kein Scrollen | `tests/e2e/bluff.spec.ts` |
| Vorlesen (Würfel je Spieler, Joker, Beginner, jede Ansage, Bluff!/Genau!, was liegt, wer verliert/raus ist, Sieger) | `src/games/bluff/narration.ts`, Unit-Test, e2e |
| Großer Tisch: Becher in der Mitte mit Ansage, verdeckte Würfel am Platz, beim Aufdecken alle (passende blau) | `src/games/bluff/table.ts` – Beta, e2e-Bild, noch nicht am Fernseher abgenommen |
| Offen | „Am Rechner“, Bühne, Hausregel „Palifico“ (letzter Würfel) |
