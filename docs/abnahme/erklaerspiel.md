# Abnahmeblatt Erklärspiel

Nach der Vorlage [Schocken](schocken.md). Stand: Oktober 2026. Neues Partyspiel, Tisch als Beta. Keine Spielweise „Am Rechner“, keine Bühne.

## Spielregel kurz

2–4 Teams, 4–16 Spieler, abwechselnd verteilt (Reihenfolge der Lobby, „Mischen“ würfelt neu).

- **Zug:** Das Team am Zug hat einen Erklärer (wechselt im Team reihum). Nur sein Handy zeigt den Begriff; er erklärt ohne das Wort oder Teile davon, das Team ruft. „Richtig“ = Punkt, „Weiter“ = überspringen (Hausregel: −1). Uhr 30–180 s (Standard 60), danach endet der Zug von selbst, die offene Karte zählt nicht.
- **Bestätigung:** Liste für alle. Gegner, Host oder Erklärer nehmen Treffer zurück; nachtragen nur Erklärer oder Host. Bestätigen: Gegner, Erklärer oder Host – das ratende Team nicht.
- **Spielarten:** Erklären (Standard), Ein Wort, Pantomime; Paket „Drei Runden“: ein Topf (10–80 Begriffe) wird erst erklärt, dann mit einem Wort, dann als Pantomime; Übersprungene kommen zurück in den Topf, eine Runde endet, wenn er leer ist. Pakete: Pantomime, Drei Runden (höchstens zwei je Spiel, „Ein Wort“ über die Spielart).
- **Begriffe:** Kategorien von Stirnraten (ohne Summen/Geräusche) zu 12 Themen-Chips zusammengefasst, Stufe Kinder bis Ab 18; eigene Kartensets der Art „Zeichnen & Raten“ (ab 3 auch „Nur eigene“). Keine Wiederholung in der Partie.
- **Geheim:** Begriff während des Zugs nur beim Erklärer und – Einstellung „Gegner sehen den Begriff“ (Standard an) – beim gegnerischen Team. Ratendes Team, Fernseher und Zuschauer nie.

| Punkt | Nachweis |
| --- | --- |
| Teams und Reihenfolge, Treffer/Überspringen/Minuspunkt, Rücknahme (wer darf was), Zeitablauf mit Puffer, Drei Runden, Pakete, Themen, Kartensets, Ende | `tests/unit/erklaerspiel.test.ts` |
| Nichts hängt: Zeit um meldet jedes Handy (Erklärer sofort, Host nach 1,5 s, andere nach 3 s; der Server prüft gegen seine Uhr); Host: „Jemand anderes erklärt“ (Erklärer offline), „Zug beenden“, „Ergebnis übernehmen“; Erklärer geht → Zug fällt aus; Team leer → Ende | `tests/unit/erklaerspiel.test.ts` |
| Fernseher wie ein Außenstehender (kein Begriff während des Zugs) | `tests/unit/tv-secret.test.ts` |
| Zufallspartien 4–7 Spieler, 2–3 Teams, alle Spielarten, online und an einem Gerät | `tests/unit/simulate.test.ts` |
| Bots: nur Testspieler (Verwaltung) – tippen zufällig Richtig/Weiter, erklären nicht | `shared/platform/bots.ts` |
| Online mit 4 Handys bis zum Ergebnis, Gegner nimmt Treffer zurück, kein Scrollen auf 390×844 und 320×568, Fernseher zeigt keinen Begriff | `tests/e2e/erklaerspiel.spec.ts` |
| Ein Handy für alle: Sichtschutz „Gib das Handy an …“ vor jedem Zug | `tests/e2e/erklaerspiel.spec.ts` |
| Vorlesen (Spielart und Regel, wer erklärt, Los, Zeit um, Punkte und Stand, neue Runde, Sieger) am Host-Handy | `src/games/erklaerspiel/narration.ts`, e2e |
| Großer Tisch: Aufsteller mit Team, Erklärer, Uhr, Treffern; nach dem Zug die Liste | `src/games/erklaerspiel/table.ts` – Beta, e2e-Bild |
| Offen | „Am Rechner“, Bühne, Abnahme am echten Fernseher |
