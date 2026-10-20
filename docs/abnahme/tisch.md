# Abnahmeblatt Großer Tisch (16 Spiele)

Nach der Vorlage [Mau-Mau](maumau.md), aber nur für die Spielweise **Tisch** (Fernseher zeigt die Partie in 3D). Die Spiele selbst
sind schon abgenommen. Stand: Oktober 2026 – alle Punkte ✅, Spielweise „Tisch“ ist damit eingebaut **an** (`shared/platform/modes.ts`).

## Für alle 16 Spiele gemeinsam

| Punkt | Nachweis |
| --- | --- |
| Fernseher sieht nie mehr als ein Außenstehender (keine Hand, Rolle, Schlüsselkarte, kein Begriff); Gegenprobe: Privates erkennt der Test | `tests/unit/tv-secret.test.ts` (ganze Partien, online und mit einem Handy für alle) |
| In jedem Zustand jeder Zufallspartie lässt sich der Tisch zeichnen; wer dran ist und jede Auslage gehört zu einem Mitspieler | `tests/unit/simulate.test.ts` (`checkTable`) |
| Echte Partie mit Handys, Tisch zeigt das Richtige, Screenshot | `tests/e2e/table.spec.ts` (je Spiel, siehe unten) |
| 3D und flach (ohne Grafikchip / Stufe „Ohne 3D“), HTML-Fassung für Vorleseprogramme | `tests/e2e/table.spec.ts` („ohne 3D“), `src/pages/Table.tsx` (`OnFelt`, sr-only in 3D) |
| Nichts bleibt hängen: Überspringen vom Host-Handy, Partie läuft auch ohne Fernseher weiter | `tests/unit/simulate.test.ts`, gemeinsame Plattform |
| Bedienung nur vom Handy: Fernseher ohne Knöpfe, Fernbedienung des Gastgebers | `tests/e2e/table.spec.ts` („Fernseher ohne Knöpfe“, „Fernbedienung“) |
| Alte Partie nach einem Update: Tisch zeigt sie wie ein Handy | `src/platform/table/model.ts` (`gameVersion`) |

## Je Spiel

| Spiel | Was der Tisch zeigt | Handy-Test (Screenshot) | Modell |
| --- | --- | --- | --- |
| Stapelbau | Aufbaustapel und Vorrat in der Mitte, Vorrat und Ablagen am Platz | „Stapelbau und Himmelskarten am Tisch“ (`9c`) | `tests/unit/table.test.ts` |
| Himmelskarten | offenes Raster je Platz, Ablage | dto. (`9d`) | `tests/unit/table.test.ts` |
| Zehn Phasen | Stapel, Ablage, ausgelegte Phase am Platz | „Zehn Phasen und Glückssieben am Tisch“ (`9e`) | `tests/unit/table.test.ts` |
| Glückssieben | Stapel, offene Reihe je Platz | dto. (`9f`) | `tests/unit/table.test.ts` |
| Decknamen | 25 Wörter, Hinweis, aufgedeckte farbig – nie die Schlüsselkarte | „Decknamen am Tisch“ (`9g`) | `tests/unit/table.test.ts` |
| Alles oder nichts | Karte hinter den Würfeln, Punkte am Platz | „Alles oder nichts und Mäxchen am Tisch“ (`9h`) | `tests/unit/table.test.ts` |
| Mäxchen | Becher mit Ansage, beim Aufdecken offene Würfel | dto. (`9i`, `9j`) | Zufallspartien |
| Dame, Mühle | Brett mit Steinen, zu setzende Steine daneben | „Dame, Mühle und Ludo am Tisch“ (`9k`, `9l`) | Zufallspartien |
| Ludo | Brett mit Pöppeln, Würfel daneben | dto. (`9m`) | Zufallspartien |
| Fischen | Teich, Quartette am Platz, Kartenzahl | „Fischen und Hellseher am Tisch“ (`9n`) | Zufallspartien |
| Hellseher | Trumpf, Stich mit Namen, Ansagen am Platz | dto. (`9o`) | Zufallspartien |
| Werwolf | Aufsteller mit Phase, Nachtlicht, verdeckte Karte je Platz | „Werwolf, Eine Nacht und Spion am Tisch“ (`9p`) | Zufallspartien |
| Eine Nacht | dto., Uhr am Tag | dto. (`9q`) | Zufallspartien |
| Spion | Aufsteller, Uhr – nie der Ort | dto. (`9r`) | Zufallspartien |
| Stirnraten | wer rät, Uhr und Punkte – nie der Begriff; nach dem Zug die Liste | „Stirnraten am Tisch“ (`9s`) | `tests/unit/stirnraten.test.ts` |

Bühne (Showstudio) bleibt Beta: Abnahme mit eigenem Blatt.
