# Spieltisch

Die Spielesammlung für den Spieleabend am Handy: Raum öffnen, Link teilen, zusammen spielen – jeder am eigenen Handy, mit Chat, Sprache und Video direkt am Tisch.

**Live:** https://spieltisch.bjoern-ef9.workers.dev/

<p align="center"><img src="docs/images/banner.png" alt="Spieltisch – Startseite, Kniffel mit 3D-Würfeln und Uno"></p>

## Funktionen

- **Online-Räume** – Raumcode und PIN, alle sehen live denselben Stand. Der Server führt, so bleibt alles synchron, auch nach Funklöchern.
- **Chat, Sprache, Video** – Text-Chat mit Reaktionen als Sprechblasen, Sprach- und Videochat mit den Gesichtern direkt in der Spielerleiste. Dazu ein **Treffpunkt** zum Reden ohne Spiel.
- **Echte 3D-Würfel** – Die Würfel fliegen mit echter Physik über den Bildschirm und landen gut lesbar in der Ablage. Das Ergebnis kommt immer aus fairem Zufall.
- **Für jede Runde passend** – Alle Spieler in einer Zeile, kein Scrollen, auch auf kleinen Handys. Jedes Spiel geht in der App oder mit echtem Material am Tisch (die App ist dann Punkteblock, Schlüsselkarte oder Erzähler).
- **14 Looks** – Der Admin wählt den Stil, hell oder dunkel stellt jeder selbst ein.
- **Rund um die Partie** – Siegerehrung mit Podium, Spielabend-Wertung, Gruppen mit Bestenliste, Profile mit Statistik.
- **Admin-Bereich** – Freigaben je Spiel, Standard-Einstellungen, Look, Funktionen, Verlauf, Export.
- **Als App installierbar** – eigenes Icon und Vorschaubild beim Teilen. Optional einschaltbar: „Ein Handy für alle“ und Offline-Nutzung.

<p align="center"><img src="docs/images/funktionen.png" alt="Lobby, Chat und Video, 14 Looks, Siegerehrung"></p>

## Spiele

| Kategorie | Spiele |
| --- | --- |
| Würfel | Tutto, Kniffel, Mäxchen |
| Karten | Uno, Mau-Mau, Skip-Bo, Phase 10, Skyjo, Flip 7, Fischen, Hellseher |
| Party & Rollen | Werwolf (die App erzählt und liest vor), Eine Nacht, Codenames, Spion |
| Brett | Ludo, Vier in einer Reihe, Mühle, Dame |

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
| `npm run deploy` | Build und Deploy per Wrangler |

Jeder Push auf `main` wird von Cloudflare automatisch gebaut und ausgeliefert.

## Technik

React 19, TypeScript, Vite, Tailwind CSS v4 und shadcn/ui im Browser; Cloudflare Workers mit Durable Objects auf dem Server; three.js und cannon-es für die Würfel; Cloudflare Realtime für Sprache und Video. Läuft im kostenlosen Cloudflare-Tarif.

## Dokumentation

- [Entwicklung](docs/entwicklung.md) – Architektur, Grundprinzipien, ein neues Spiel hinzufügen, Tests
- [Betrieb](docs/betrieb.md) – Deployment, Secrets, Sicherheit, Datenhaltung
- [Roadmap](docs/roadmap.md) – geplante Spiele und offene Punkte
