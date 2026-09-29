# Spieltisch

Eine Spielesammlung als mobile Web-App für Spieleabende – **online** (jeder am eigenen Handy, Räume mit Code + PIN) oder **lokal** (ein Gerät für alle). Gebaut mit React 19, TypeScript, Vite, Tailwind CSS v4 und shadcn/ui, läuft kostenlos auf Cloudflare Workers mit Durable Objects.

**Spiele:**

- **Tutto** – Würfel & Karten: Karte ziehen, würfeln, zocken. Echte Würfel mit Punkte-Tasten oder App-Würfel.
- **Kniffel** – 5 Würfel, 3 Würfe, 13 Felder. App-Würfel mit Punktevorschau oder digitaler Block für echte Würfel; optional Extra-Kniffel mit Joker.

Weitere folgen – jedes Spiel ist ein eigenes Modul mit einheitlicher Schnittstelle.

- **Online-Räume:** Auf der Seite eines Spiels erstellt der Host einen Raum mit PIN. Mitspieler geben auf der Startseite den Raumcode ein (oder öffnen den Link), dann Name und PIN. Alle sehen denselben Stand live.
- **Lokal:** Alle spielen an einem Gerät, ohne Server. Der Spielstand bleibt im Browser, getrennt pro Spiel.
- **Ein Raum, mehrere Spiele:** Nach einer Partie geht der Host zurück in die Lobby und wählt ein anderes Spiel – alle bleiben im Raum.
- **Host-Einstellungen:** jedes Spiel bringt eigene Einstellungen mit (bei Tutto: Würfel und Spielziel). Bei zugbasierten Spielen legt der Host fest, wer für den Spieler am Zug handeln darf: wer dran ist (Standard), alle oder nur der Host. Der Host darf immer, so kann er auch für jemanden ohne Handy spielen.
- **Fairer Zufall:** `crypto.getRandomValues` mit Verwerfungsmethode (keine Modulo-Verzerrung). Online würfelt und mischt ausschließlich der Server.
- **Ansicht „Einfach“ oder „Voll“** (im Menü, pro Gerät). Jede Partie passt ohne Scrollen auf einen Handy-Bildschirm; die App lässt sich zum Home-Bildschirm hinzufügen.

## Loslegen

Voraussetzungen: Node.js 22 (siehe `.nvmrc`) und für das Deployment ein kostenloses Cloudflare-Konto.

```bash
npm install
npm run dev          # http://localhost:5173 – Worker und Durable Objects laufen lokal mit
npm run dev -- --host  # zum Testen mit dem Handy im selben WLAN
```

| Befehl | Was passiert |
| --- | --- |
| `npm run build` | Typprüfung (App, Worker, Tests) und Produktions-Build |
| `npm test` | Unit-Tests der gemeinsamen Logik (Vitest) |
| `npm run test:e2e` | Ende-zu-Ende-Tests im Handy-Format mit Playwright, inkl. Online-Raum mit zwei Browsern. Screenshots landen in `test-results/screens/`. |
| `npm run check` | Build + Unit-Tests |
| `npm run deploy` | Build und Deploy per Wrangler |

Für `test:e2e` einmalig `npx playwright install chromium` ausführen – oder mit vorhandenem Chromium `PW_CHROMIUM_PATH=/pfad/zu/chromium npm run test:e2e`.

## Deployment

Cloudflare Workers Builds baut und deployt jeden Push auf `main` automatisch:

1. Im Cloudflare-Dashboard **Workers & Pages → Create → Import a repository**, `DasPocky/Spieltisch` wählen.
2. Build-Befehl `npm run build`, Deploy-Befehl `npx wrangler deploy`, Produktions-Branch `main`.

Die App ist dann unter `https://spieltisch.<dein-subdomain>.workers.dev` erreichbar (Name in `wrangler.jsonc`). Zusätzlich prüft GitHub Actions (`.github/workflows/ci.yml`) bei jedem Push und Pull Request Build, Unit-Tests und die Playwright-Tests.

Manuell geht es mit `npx wrangler login` und `npm run deploy`.

## Architektur

```
Browser ──HTTP──▶ Worker ──▶ statische React-App (dist/client)
        ──WS────▶ Worker ──▶ Durable Object „GameRoom“ (eines pro Raumcode)
```

```
shared/                       Logik für Browser UND Server
  platform/
    types.ts                  Schnittstelle GameLogic, Einstellungen, Rechte
    room.ts                   Raum: Spieler, Host, Lobby/Partie, Rechteprüfung, Sicht pro Spieler
    random.ts                 fairer Krypto-Zufall (randomInt, rollDice, shuffle)
    turns.ts                  Hilfen für Zugreihenfolge
    protocol.ts               Nachrichten zwischen Browser und Server
  games/
    index.ts                  Verzeichnis aller Spiele (Logik)
    tutto/                    Tutto: Karten-Daten und Spiellogik
    kniffel/                  Kniffel: Wertung und Spiellogik
worker/index.ts               API + Durable Object GameRoom
src/
  platform/                   Plattform-Oberfläche: RoomScreen (Kopfzeile, Lobby), Menü,
                              Einstellungen, Spielerliste, Punkteleiste, Regel-Bogen, Siegerehrung
  games/
    types.ts                  Schnittstelle GameUI (Oberfläche eines Spiels)
    index.ts                  Verzeichnis aller Spiel-Oberflächen
    tutto/                    Spielbrett, Karte, Würfel, Punkte-Tasten, Regelseite, Menü-Extras
    kniffel/                  Block, Würfel-Leiste, Eingabe für echte Würfel, Regelseite
  pages/                      Startseite, Spielseite, lokales Spiel, Online-Raum
  hooks/                      useRoom (WebSocket + Reconnect), useRoute (Mini-Router), useViewMode
  components/ui/              shadcn/ui-Komponenten
tests/
  unit/                       Vitest: Zufall, Raum/Rechte, Tutto- und Kniffel-Regeln
  e2e/                        Playwright: lokal, online mit zwei Browsern, kleines Handy
```

**Routen:** `/` Startseite · `/spiel/<id>` Spielseite · `/spiel/<id>/lokal` lokales Spiel · `/r/<CODE>` Online-Raum.

### Grundprinzip

- **Der Server ist die einzige Wahrheit.** Clients schicken nur Aktionen (`{ type: "action", action }`), das Durable Object prüft sie mit derselben Logik aus `shared/`, speichert den neuen Stand und schickt jedem Spieler seine Sicht.
- **Lokal läuft dieselbe Logik** im Browser (`applyRoomAction` mit `actorId = null`, also alle Rechte).
- **Die Plattform** (`shared/platform/room.ts`) verwaltet alles, was für jedes Spiel gleich ist: Spieler und Zugreihenfolge, Host, Lobby ↔ Partie, Neue Runde, Spielwechsel, Einstellungen und die Rechteprüfung. Das Spiel sieht nur seinen eigenen Zustand und bekommt Spieler, Host, Akteur und Einstellungen als `GameContext`.
- **Rechte** deklariert jedes Spiel pro Aktion: `host` (nur Host), `turn` (für den Spieler am Zug – wer das darf, regelt die Raumeinstellung) oder `player` (jeder für sich selbst). Die Plattform prüft, bevor das Spiel die Aktion sieht.
- **Versteckte Informationen:** Über `view(state, viewerId)` filtert ein Spiel, was ein Spieler sehen darf. Tutto verbirgt so die Reihenfolge des Kartenstapels (Clients sehen nur, welche Karten noch drin sind).

### Zugang und Sicherheit

- Raumcode: 5 Zeichen aus 32 (ohne 0/O/1/I), PIN: 4–8 Ziffern. Die PIN wird mit zufälligem Salt als SHA-256 gespeichert und steht nie im Link.
- Nach 8 falschen PINs ist der Raum 10 Minuten gesperrt.
- Nach dem Beitritt merkt sich das Gerät einen geheimen Token – Neuladen oder Funkloch geht ohne PIN weiter.
- Wer den Raum erstellt, ist Host. Verlässt der Host den Raum (wird entfernt), übernimmt der nächste Spieler.
- Nachrichten über 4 KB werden verworfen, jede Aktion wird serverseitig validiert.
- Räume ohne Aktivität werden nach **48 Stunden** automatisch gelöscht (Durable-Object-Alarm). Der Host kann einen Raum im Menü sofort löschen.

## Datenhaltung

| Ort | Inhalt | Wann gelöscht |
| --- | --- | --- |
| Durable Object `GameRoom` (Cloudflare, eines pro Raumcode, SQLite-Speicher) | PIN-Hash + Salt, Spielernamen, gewähltes Spiel, Einstellungen, Spielstand inkl. Verlauf, Wiederverbindungs-Tokens, Fehlversuche | 48 h nach der letzten Aktion oder sofort über „Raum löschen“ |
| `localStorage` im Browser | eigener Name (`spieltisch:name`), Token pro Raum (`spieltisch:room:<CODE>`), lokaler Spielstand pro Spiel (`spieltisch:local:<id>`), Ansicht (`spieltisch:view`) | beim Verlassen des Raums bzw. vom Nutzer |
| `sessionStorage` im Browser | Name + PIN für genau einen Beitritt | direkt nach dem Beitritt |

IP-Adressen oder Konten speichert die App nicht. Cloudflare selbst protokolliert Anfragen (Observability ist in `wrangler.jsonc` aktiv).

**Deploys:** Der Speicher der Durable Objects ist unabhängig vom Code, Räume bleiben also erhalten; offene WebSockets verbinden sich nach einem Deploy automatisch neu. Den Klassennamen `GameRoom` nicht umbenennen (sonst braucht es eine neue Migration in `wrangler.jsonc`) und Spielstand-Formate rückwärtskompatibel halten – bei inkompatiblen Änderungen `version` im Spiel-Modul erhöhen (lokale Spielstände mit alter Version werden dann verworfen).

**Kostenlose Limits:** 100.000 Worker-Anfragen pro Tag; bei Durable Objects zählen eingehende WebSocket-Nachrichten gebündelt, ausgehende sind gratis. Ein Spieleabend braucht davon einen Bruchteil.

## Neues Spiel hinzufügen

Ein Spiel besteht aus zwei Teilen: der **Logik** in `shared/games/<id>/` (läuft auf Server und Client) und der **Oberfläche** in `src/games/<id>/`.

### 1. Logik: `shared/games/<id>/logic.ts`

```ts
import { GameError, type GameContext, type GameLogic } from "../../platform/types";
import { nextPlayerId } from "../../platform/turns";
import { rollDice } from "../../platform/random";

export interface MeinState { v: 1; curId: string | null; scores: Record<string, number>; winnerId: string | null }
export type MeinAction = { type: "roll" } | { type: "reset" };

export const meinSpiel: GameLogic<MeinState, MeinAction> = {
  info: { id: "meinspiel", name: "Mein Spiel", tagline: "Ein Satz für die Auswahl.", category: "Würfel", minPlayers: 2, maxPlayers: 6, duration: "15 Min." },
  version: 1,
  turnBased: true,          // aktiviert „Wer darf für den Spieler am Zug handeln?“
  joinMidGame: false,       // Beitritt nur in der Lobby
  settings: [               // die Plattform zeigt und prüft diese Einstellungen
    { key: "rounds", label: "Runden", type: "number", default: 10, min: 1, max: 20, step: 1 },
  ],
  setup: (ctx) => ({ v: 1, curId: ctx.players[0].id, scores: {}, winnerId: null }),
  actionKind: (a) => (a.type === "roll" ? "turn" : a.type === "reset" ? "host" : null),
  apply(state, a, ctx) {
    const s = structuredClone(state);
    switch (a.type) {
      case "roll": /* … Zufall nur über shared/platform/random … */ s.curId = nextPlayerId(ctx.players, s.curId); return s;
      case "reset": return this.setup(ctx);
      default: throw new GameError("Unbekannte Aktion.");
    }
  },
  currentPlayerId: (s) => s.curId,
  isOver: (s) => s.winnerId !== null,
  // optional: onPlayerRemoved, onOptionsChanged, view (versteckte Infos)
};
```

Regeln für die Logik:

- **Rein und deterministisch** bis auf Zufall aus `shared/platform/random.ts` – kein `Math.random`, keine Zeit, kein DOM.
- **Nie den alten Zustand verändern** (`structuredClone` oder Spread), ungültige Züge mit `GameError` und einer deutschen Meldung ablehnen.
- **Jede Eingabe prüfen** (Indizes, Zahlen) – die Aktion kommt ungefiltert aus dem Netz.
- Spieler nicht selbst speichern: die Reihenfolge kommt aus `ctx.players`, Punkte o. Ä. per Spieler-ID ablegen.
- Geheimes (Stapel, Hände anderer) in `view()` entfernen.

Dann in `shared/games/index.ts` eintragen: `export const GAMES = { tutto, meinspiel: meinSpiel }`.

### 2. Oberfläche: `src/games/<id>/index.tsx`

```tsx
import type { GameUI } from "@/games/types";
export const meinSpielUI: GameUI<MeinState, MeinAction> = {
  logic: meinSpiel,
  Icon,        // SVG-Symbol für Kacheln und Kopfzeile
  Board,       // die laufende Partie – bekommt BoardProps (room, game, me, canAct, act, dispatch, …)
  Rules,       // Regelseite; Abschnitt mit data-focused="true" wird angesprungen
  MenuExtras,  // optional: Verlauf, Rückgängig o. Ä. im Menü
  HeaderExtra, // optional: kleine Info in der Kopfzeile
};
```

Und in `src/games/index.ts` eintragen. Bausteine zum Wiederverwenden liegen in `src/platform/`: `Scoreboard` (optional antippbar), `Die` (Würfel), `ResultScreen` (Siegerehrung mit „Neue Runde“ und „Zur Lobby“), `RulesSheet`, `Segmented`.

Das `Board` muss ohne Scrollen auf einen Handy-Bildschirm passen: Es sitzt in einem Flex-Container mit fester Höhe – den Platz in der Mitte mit `flex-1 min-h-0` füllen, Tasten mit `shrink-0` unten.

### 3. Tests

- Unit-Tests in `tests/unit/<id>.test.ts` (Hilfen in `tests/unit/helpers.ts`, z. B. `fixDice()` für vorgegebene Würfe).
- Ein Playwright-Test in `tests/e2e/`, der die Partie im Handy-Format spielt und `expectNoScroll()` prüft.

Fertig – Startseite, Lobby, Spielwechsel, Einstellungen, Rechte, Online-Räume und Menü funktionieren automatisch.
