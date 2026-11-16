# Abnahmeblatt Spurensuche

Stand: November 2026. Neues Spiel (Kategorie Brett). Eigenes Setting, eigene Figuren, Werkzeuge, Räume und eigener Grundriss – die Spielregeln folgen dem klassischen Detektivspiel mit Brett. Noch keine eigene Tisch-Ansicht (der Fernseher zeigt die Handy-Ansicht in der Mitte), keine Bühne, kein „Am Rechner“.

## Spielregel kurz

- **Karten:** 6 Personen, 6 Werkzeuge, 9 Räume. Je eine verdeckt als Lösung, die übrigen 18 reihum verteilt (Unterschied höchstens eine).
- **Brett:** 20×20, neun Räume im Raster 3×3, dazwischen zwei Felder breite Flure. Türen je Raum 2 (Kaminhalle 4). Geheimgänge Lesezimmer ↔ Rauchersalon und Turmzimmer ↔ Weinkeller. Alle sechs Figuren stehen auf dem Brett, auch ohne Spieler.
- **Zug:** zwei Würfel (Einstellung: einer), höchstens so viele Felder durch die Flure, nicht schräg, nicht über Figuren; ein Raum beendet den Zug, zurück in den Startraum geht nicht. Statt zu würfeln: Geheimgang. Wer per Verdacht in einen Raum geholt wurde, darf dort im nächsten Zug ohne Würfeln verdächtigen.
- **Verdacht:** im Raum, Person + Werkzeug + dieser Raum; Figur und Werkzeug kommen in den Raum. Reihum im Uhrzeigersinn zeigt der Erste mit einer passenden Karte genau eine, nur dem Fragenden. Hat er nur eine passende, zeigt die App sie automatisch (abschaltbar).
- **Anklage:** in deinem Zug, einmal. Richtig: gewonnen. Falsch: raus, widerlegt aber weiter. Alle raus: niemand gewinnt, die Lösung wird gezeigt.

## Abnahme

| Punkt | Wo geprüft |
| --- | --- |
| Verteilen, Lösung nicht in den Händen, Figuren und Werkzeuge auf dem Brett | `tests/unit/spurensuche.test.ts` |
| Bewegung: Schritte, Türen, Startraum, Figuren versperren den Flur, Geheimgänge | `tests/unit/spurensuche.test.ts` |
| Verdacht holt Figur und Werkzeug, reihum widerlegen, automatisch bei einer Karte, „konnte nicht“ öffentlich | `tests/unit/spurensuche.test.ts` |
| Geheimhaltung: fremde Hände, Lösung, fremde gezeigte Karten | `tests/unit/spurensuche.test.ts` (view) |
| Anklage richtig/falsch, Ausgeschiedene widerlegen weiter, alle raus | `tests/unit/spurensuche.test.ts` |
| Nichts bleibt hängen: Überspringen beim Widerlegen und im Zug, Spieler verlässt die Partie | `tests/unit/spurensuche.test.ts`, `tests/unit/simulate.test.ts` |
| Bots: ganze Partien zu Ende, nur mit eigenem Wissen, klagen erst sicher an | `tests/unit/spurensuche.test.ts` |
| Ein Handy für alle: Sichtschutz (auch beim Widerlegen), würfeln, ziehen, verdächtigen, Notizblock, ohne Scrollen auf 390×844 und 360×640 | `tests/e2e/spurensuche.spec.ts` |
| Offen | Tisch-Ansicht mit Brett in 3D, Bühne, „Am Rechner“, Spielstärke der Bots, Abnahme am echten Fernseher |
