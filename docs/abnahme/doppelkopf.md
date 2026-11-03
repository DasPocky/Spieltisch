# Abnahmeblatt Doppelkopf

Nach der Vorlage [Herzen](herzen.md) und [Zahlen-Rommé](zahlenromme.md). Stand: November 2026. Neues Spiel (Kategorie Karten), Tisch als Beta. Noch keine Spielweise „Am Rechner“, keine Bühne, keine echten Karten.

## Spielregel kurz

Immer vier Plätze, doppeltes Blatt (9 bis Ass, jede Karte zweimal: 48 Karten, je 12; Paket „Ohne Neunen“: 40, je 10). Sind weniger als vier im Raum oder steigt jemand aus, spielt ein Bot den Platz (in der Logik, mit derselben Strategie wie „schwer“).

- **Trumpf:** Herz-10 (Dulle), Kreuz-, Pik-, Herz-, Karo-Dame, die Buben ebenso, Karo-Ass, -10, -König, -9. Fehl: Kreuz/Pik A, 10, K, 9 – Herz A, K, 9. Gleiche Karten: die erste sticht.
- **Parteien:** Re = Kreuz-Damen, Kontra = der Rest; geheim, bis eine Kreuz-Dame fällt oder angesagt wird (zwei bekannte Re → Rest Kontra und umgekehrt).
- **Vorbehalte** reihum ab links vom Geber: gesund oder Vorbehalt (welcher, bleibt geheim, bis alle gesagt haben). Das erste Solo gilt (Damen, Buben, Fleischlos, Kreuz, Pik, Herz, Karo), sonst Hochzeit (Klärungsstich: erster fremder Stich in den ersten drei, sonst allein), beide Kreuz-Damen und „gesund“ = stilles Solo.
- **Ansagen:** Re/Kontra bis vor der zweiten eigenen Karte, keine 90/60/30/schwarz je eine Karte später (Hochzeit: um die Stiche bis zur Klärung später). Grenzen: Re 121, Kontra 120 (nur Kontra angesagt: umgekehrt), Absage keine 90 → 151 bzw. Gegner 90 usw.
- **Wertung:** gewonnen 1, gegen die Alten 1, Re/Kontra angesagt je 2, Gegner unter 90/60/30/schwarz je 1, jede Absage 1; Sonderpunkte (nicht im Solo) Doppelkopf, Fuchs gefangen, Karlchen. Solist ×3. Vereinfacht: keine Punkte für „gegen keine 90 120 erreicht“ o. Ä., kein Pflichtsolo, keine Schweinchen.
- **Partie** über 4/8/12/20 Runden, Geber reihum. **Zugzeit** (online, 30 Sek./1/2 Min. oder ohne): ist sie um, spielt die App für den Spieler.

| Punkt | Nachweis |
| --- | --- |
| Blatt 48/40, 240 Augen, Trumpfreihenfolge in allen Spielen, Hand sortiert | `tests/unit/doppelkopf.test.ts` |
| Stichsieger inkl. gleicher Karten (erste sticht), Bedienen, Damen-/Fleischlos-Solo | `tests/unit/doppelkopf.test.ts` |
| Vorbehalte: Hochzeit (Partner, allein), Solo vor Hochzeit, erstes Solo gilt, Vorbehalt geheim, Soli abschaltbar | `tests/unit/doppelkopf.test.ts` |
| Parteien geheim bis Kreuz-Dame/Ansage, Ansage-Fristen, Absagen abschaltbar | `tests/unit/doppelkopf.test.ts` |
| Abrechnung: Grenzen mit Ansagen, Zeilen, gegen die Alten, Doppelkopf, Fuchs, Karlchen, Solo dreifach, Summe 0 | `tests/unit/doppelkopf.test.ts`, `tests/unit/simulate.test.ts` |
| Geheimhaltung: fremde Hände, Vorbehalte, Re-Liste und stilles Solo kennt niemand; Fernseher wie ein Außenstehender, Tisch ohne Hände | `tests/unit/doppelkopf.test.ts`, `tests/unit/tv-secret.test.ts` (2 und 4 Spieler) |
| Nichts hängt: Host sagt/spielt für Abwesende und gibt die nächste Runde, Zugzeit, Aussteiger → Bot | `tests/unit/doppelkopf.test.ts`, `tests/unit/simulate.test.ts` |
| Zufallspartien 1–4 Menschen, online und an einem Gerät, alle Hausregeln, Kartenzahl stimmt immer | `tests/unit/simulate.test.ts` |
| Bots: Trumpf zählen (ungesehene Karten), Partner erkennen, schmieren, Augen sichern, Fuchs schützen, nur starke Ansagen und Soli; jede Stufe; „schwer“ schlägt Zufall (71 % gegen 25 %); feste Uhr/Startwert wiederholbar | `tests/unit/bot-skill.test.ts`, `shared/platform/botSkill.ts` |
| Geber wandert je Partie und je Runde | `tests/unit/fairness.test.ts` |
| Ein Handy für alle mit Sichtschutz bis zum Ergebnis auf 320×568, online mit Bots auf 360×640 und 390×844 (Vorbehalt, 12 Karten, Ansage, Abrechnung), kein Scrollen | `tests/e2e/doppelkopf.spec.ts` |
| Vorlesen: Geber, Vorbehalte, Spiel, Ansagen, Stichsieger (Doppelkopf, Fuchs, Karlchen), Hochzeit geklärt, Abrechnung Zeile für Zeile, Sieger | `src/games/doppelkopf/narration.ts`, e2e |
| Großer Tisch: Stich in der Mitte, am Platz Vorbehalt bzw. Partei/Ansage und Stiche, Spiel als Farbe, keine Hände | `src/games/doppelkopf/table.ts` – Beta, e2e-Bild |
| Offen | „Am Rechner“, Bühne, Pflichtsolo, Schweinchen/weitere Sonderkarten, Erwiderungen nach Fristende |
