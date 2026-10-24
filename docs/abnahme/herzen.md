# Abnahmeblatt Herzen

Nach der Vorlage [Mau-Mau](maumau.md) und [Eins!](eins.md). Stand: Oktober 2026. Neues Kartenspiel, Tisch als Beta. Noch keine Spielweise „Am Rechner“ und keine Bühne, keine echten Karten (Block).

## Spielregel kurz

Stichspiel mit 52 Karten, 3–6 Spieler (klassisch 4). Zu dritt ohne Karo-2, zu fünft ohne Karo-2 und Pik-2, zu sechst zusätzlich ohne Karo-3 und Pik-3 – Kreuz-2 und alle 26 Strafpunkte bleiben.

- **Weitergeben:** drei Karten im Wechsel links, rechts, gegenüber (nur bei gerader Spielerzahl), keine. Getauscht wird, wenn alle gewählt haben. Einstellbar: immer links, nie.
- **Spielen:** Kreuz-2 spielt aus, Farbe bedienen, höchste Karte der ausgespielten Farbe nimmt. Im ersten Stich keine Punkte (außer es geht nicht anders; Hausregel erlaubt sie). Herz erst ausspielen, wenn gebrochen (oder nur noch Herz auf der Hand).
- **Punkte:** Herz 1, Pik-Dame 13. **Mond schießen** (abschaltbar): alle 26 geholt → 0, die anderen je 26.
- **Ende** bei 100 Punkten (Pakete: Kurz = 50, Locker = ohne Weitergeben, Punkte im ersten Stich). Es gewinnt, wer am wenigsten hat, Gleichstand teilt.

| Punkt | Nachweis |
| --- | --- |
| Regeln inkl. Grenzfälle (Blatt je Spielerzahl, Richtung, drei eigene Karten, Kreuz-2, Bedienen, erster Stich, Herz gebrochen, nur noch Herz, Mond an/aus, Ende 100/50, Sieger) | `tests/unit/herzen.test.ts` |
| Geheimhaltung: fremde Hände, gewählte und bekommene Karten nur für den Besitzer; Fernseher wie ein Außenstehender | `tests/unit/herzen.test.ts`, `tests/unit/tv-secret.test.ts` |
| Nichts hängt: Host gibt für Fehlende weiter („Vorschlag“), spielt für Abwesende; Aussteiger → Runde neu geben, unter drei Spielern Ende | `tests/unit/herzen.test.ts` |
| Zufallspartien 3–6 Spieler, online und an einem Gerät, Karten bleiben erhalten | `tests/unit/simulate.test.ts` |
| Bots: jede Stufe, 3–4 Spieler, nur erlaubte Züge, jede Partie endet; Strategie: gefährliche Karten weitergeben, unter dem Stich bleiben, Pik-Dame abwerfen | `tests/unit/bot-skill.test.ts`, `shared/platform/botSkill.ts` |
| Startspieler/Geber wandert | `tests/unit/fairness.test.ts` |
| Online mit Bots durchspielen, ein Handy für alle mit Sichtschutz, kein Scrollen (390×844, 320×568) | `tests/e2e/herzen.spec.ts` |
| Vorlesen (Weitergeben, Kreuz-2, Herz gebrochen, Pik-Dame, Mond, Sieger) am Host-Handy | `src/games/herzen/Board.tsx` (`narration`), e2e |
| Großer Tisch: Stich in der Mitte, verdeckte Hände, Punkte am Platz | `src/games/herzen/table.ts` – Beta, noch nicht am Fernseher abgenommen |
| Offen | „Am Rechner“, echte Karten als Block, Bühne |
