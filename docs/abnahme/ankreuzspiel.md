# Abnahmeblatt Ankreuzspiel

Nach der Vorlage [Schocken](schocken.md). Stand: Oktober 2026. Neues Würfelspiel, Tisch als Beta. Noch keine Spielweise „Am Rechner“, keine Bühne, keine echten Würfel.

## Spielregel kurz

Zwei weiße und vier farbige Würfel (Rot, Gelb, Grün, Blau), 2–6 Spieler, je ein Blatt mit vier Reihen à 11 Feldern plus Schloss.

- **Reihen:** Rot und Gelb 2 → 12, Grün und Blau 12 → 2. Angekreuzt wird nur von links nach rechts, Übersprungenes bleibt leer.
- **Zug:** Wer dran ist, würfelt. *Weiß:* alle gleichzeitig dürfen die Summe der weißen Würfel in einer Reihe ankreuzen (online gleichzeitig, an einem Handy reihum). *Farbe:* danach nur der Spieler am Zug – ein weißer plus der farbige Würfel in dessen Reihe.
- **Fehlwurf:** Spieler am Zug kreuzt in beiden Schritten nichts an → −5.
- **Schloss:** letztes Feld erst ab 5 Kreuzen in der Reihe, dann zählt das Schloss als Kreuz, die Reihe ist für alle zu und ihr Würfel raus. Schließen zwei im selben Weiß-Wurf ab, bekommen beide das Schloss.
- **Ende:** zwei abgeschlossene Reihen (auch direkt nach Weiß) oder vierter Fehlwurf. Punkte je Reihe nach Dreieckszahlen (1, 3, 6 … 78). Pakete: Kurz (1 Reihe / 3 Fehlwürfe), Lang (3 / 5).

| Punkt | Nachweis |
| --- | --- |
| Regeln inkl. Grenzfälle (Richtung, Weiß gleichzeitig, Farbe nur am Zug, Fehlwurf nur am Zug, Schloss ab 5, gemeinsames Schloss, Würfel raus, Ende nach Weiß, Fehlwurf-Ende, Pakete, Punkte) | `tests/unit/ankreuzspiel.test.ts` |
| Nichts hängt: wer nichts ankreuzen kann, verzichtet automatisch; online Bedenkzeit (20/40/90 s, jedes Handy meldet), Host überspringt Würfeln/Weiß/Farbe; Aussteiger → Blatt weg, sein Zug fällt aus, allein endet die Partie | `tests/unit/ankreuzspiel.test.ts` |
| Fernseher wie ein Außenstehender (alles offen) | `tests/unit/tv-secret.test.ts` |
| Zufallspartien 2/4/6 Spieler, online und an einem Gerät, alle Pakete | `tests/unit/simulate.test.ts` |
| Bots: jede Stufe, 2 und 4 Spieler; Strategie: kaum Felder überspringen, Schloss immer, Fehlwurf meiden | `tests/unit/bot-skill.test.ts`, `shared/platform/botSkill.ts` |
| Startspieler wandert je Partie | `tests/unit/fairness.test.ts` |
| Ein Handy für alle bis zum Ergebnis auf 360×640, online mit Bots, kein Scrollen | `tests/e2e/ankreuzspiel.spec.ts` |
| Vorlesen (Beginner, Wurf mit weißer Summe, Kreuze, Fehlwurf, Schloss, Ende, Sieger) am Host-Handy | `src/games/ankreuzspiel/narration.ts`, Unit-Test, e2e |
| Großer Tisch: weiße und farbige Würfel in der Mitte, Punkte/Kreuze/Fehlwürfe am Platz, wer noch überlegt | `src/games/ankreuzspiel/table.ts` – Beta, e2e-Bild |
| Offen | „Am Rechner“, Bühne, echte Würfel, ganze Blätter am Fernseher |
