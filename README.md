# Spieltisch

Die Spielesammlung für den Spieleabend am Handy: Raum öffnen, Link teilen, zusammen spielen – jeder am eigenen Handy, mit Chat, Sprache und Video direkt am Tisch.

**Live:** https://spieltisch.endlab.de/

<p align="center"><img src="docs/images/banner.png" alt="Spieltisch – Startseite, Fünf Würfel mit 3D-Würfeln und Eins!"></p>

## Funktionen

- **Wie eine App** – Tab-Leiste (Start, Spiele, Gruppe, Profil), Begrüßung mit Papierschnitt-Animation, Willkommen mit Rundgang für neue Geräte, direkt installierbar.
- **Online-Räume** – Raumcode und PIN, alle sehen live denselben Stand. Der Server führt, so bleibt alles synchron, auch nach Funklöchern.
- **Räume auf einen Blick** – Der Start zeigt eigene und offene Räume, Gruppe zuerst. Jeder Raum ist öffentlich, nur für die Gruppe oder privat, auf Wunsch mit Anklopfen; leere Räume bleiben 1 Stunde bis 1 Woche, Dauerräume legt der Admin an.
- **Chat, Sprache, Video** – Text-Chat mit Reaktionen als Sprechblasen, Sprach- und Videochat mit den Gesichtern direkt in der Spielerleiste. Jeder Raum ist zugleich **Treffpunkt**: reden ohne Spiel, spielen ohne Video – beides geht.
- **Echte 3D-Würfel** – Die Würfel fliegen mit echter Physik über den Bildschirm und landen gut lesbar in der Ablage. Das Ergebnis kommt immer aus fairem Zufall.
- **Für jede Runde passend** – Alle Spieler in einer Zeile, kein Scrollen, auch auf kleinen Handys. Jedes Spiel geht in der App oder mit echtem Material am Tisch (die App ist dann Punkteblock, Schlüsselkarte oder Erzähler).
- **EndLab-Look** – Marineblau und Eisblau wie alle EndLab-Apps; hell oder dunkel stellt jeder selbst ein, Standard wie das Handy.
- **Rund um die Partie** – Siegerehrung mit Podium, Spielabend-Wertung, Gruppen mit Bestenliste, Profile mit Statistik.
- **Verwaltung** – Eigener Tab auf Admin-Geräten: Live-Räume mit Eingriffen und unsichtbarem Zuschauen, Statistik mit Spitzenzeiten, Freigaben und Standards je Spiel, Status mit Versionsabgleich und ein Entwickler-Modus mit Testspielern.
- **Als App installierbar** – eigenes Icon und Vorschaubild beim Teilen. Optional einschaltbar: „Ein Handy für alle“ und Offline-Nutzung.

<p align="center"><img src="docs/images/funktionen.png" alt="Lobby, Chat und Video, Siegerehrung"></p>

## Spiele

| Kategorie | Spiele |
| --- | --- |
| Würfel | Alles oder nichts, Fünf Würfel, Mäxchen, Schocken, Bluff, Ankreuzspiel |
| Karten | Eins!, Mau-Mau, Stapelbau, Zehn Phasen, Himmelskarten, Glückssieben, Fischen, Hellseher, Herzen, Palast, Zahlen-Rommé (Reihen und Gruppen legen, den ganzen Tisch umbauen), Doppelkopf (Re gegen Kontra mit doppeltem Blatt, Bots füllen auf), Skat (reizen, Skat drücken, allein gegen zwei – Farbspiel, Grand, Null, auf Wunsch Ramsch), Klingel (genau fünf gleiche Früchte – wer zuerst klingelt, bekommt die Karten) |
| Party & Rollen | Werwolf (die App erzählt und liest vor), Eine Nacht, Decknamen, Spion, Schamlos, Stirnraten (Handy an die Stirn: klassisch, Teams, Bombe, Hochstapler), Zeichnen & Raten (malen am Handy, raten per Rufen oder Tippen), Quiz & Schätzen (alle antworten gleichzeitig, Fragen mit Quellen), Kritzelpost (Stille Post mit Bildern, am Ende das Album), Stadt-Land-Fluss (jeder schreibt am eigenen Handy, Stopp und gemeinsame Auswertung), Erklärspiel (Teams erklären gegen die Uhr: Erklären, Ein Wort, Pantomime, drei Runden), Wer bin ich (alle sehen deine Figur, nur du nicht – Ja/Nein-Fragen reihum, die anderen stimmen am Handy ab) |
| Brett | Ludo, Vier in einer Reihe, Mühle, Dame, Spurensuche (Detektivspiel im Landhaus: würfeln, verdächtigen, widerlegen, anklagen) |

## Loslegen

Voraussetzung: Node.js 22 (siehe `.nvmrc`).

```bash
npm install
npm run dev            # http://localhost:5173 – Worker und Durable Objects laufen lokal mit
npm run dev -- --host  # zum Testen mit dem Handy im selben WLAN
```

| Befehl | Zweck |
| --- | --- |
| `npm run build` | Typprüfung und Produktions-Build |
| `npm test` | Unit-Tests (Vitest) |
| `npm run test:e2e` | Handy-Tests im Browser (Playwright) |
| `npm run cf:build`, `cf:deploy`, `cf:preview` | Befehle für Cloudflare Workers Builds (siehe [Betrieb](docs/betrieb.md)) |

Jeder Merge auf `main` wird von Cloudflare Workers Builds gebaut und geht sofort live; jeder andere Zweig bekommt eine Vorschau.

## Technik

React 19, TypeScript, Vite, Tailwind CSS v4 und shadcn/ui im Browser; Cloudflare Workers mit Durable Objects auf dem Server; three.js und cannon-es für die Würfel; Cloudflare Realtime für Sprache und Video.

## Dokumentation

- [Entwicklung](docs/entwicklung.md) – Architektur, Grundprinzipien, ein neues Spiel hinzufügen, Tests
- [Betrieb](docs/betrieb.md) – Deployment, Secrets, Sicherheit, Datenhaltung
