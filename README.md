# Spieltisch

Eine Spielesammlung als mobile Web-App für Spieleabende – **online im Raum** (jeder am eigenen Handy, Raumcode + PIN), mit **Chat, Sprache und Video** direkt am Tisch. Gebaut mit React 19, TypeScript, Vite, Tailwind CSS v4 und shadcn/ui, läuft kostenlos auf Cloudflare Workers mit Durable Objects.

**Live:** https://spieltisch.bjoern-ef9.workers.dev/

<p align="center"><img src="docs/images/banner.png" alt="Spieltisch – Startseite, Kniffel mit 3D-Würfeln und Uno"></p>

<p align="center"><img src="docs/images/funktionen.png" alt="Lobby, Chat und Video, 14 Looks, Siegerehrung"></p>

## Was kann der Spieltisch?

- **Online zuerst:** Online-Raum erstellen, Link teilen, PIN sagen – alle sehen live denselben Stand. Der Server führt, so bleibt alles synchron, auch nach Funklöchern. Der Schnellstart auf der Startseite legt gleich einen Raum mit dem gewählten Spiel an.
- **Chat, Sprache, Video:** Text-Chat in jedem Raum mit Schnell-Reaktionen, die als Sprechblase über dem Platz des Spielers aufploppen. Sprach- und Videochat über Cloudflare Realtime – im Spiel sitzen die Gesichter direkt in der Spielerleiste, wer spricht, leuchtet. Push-to-talk zuschaltbar, in der Werwolf-Nacht sind die Mikros automatisch aus.
- **Treffpunkt:** einfach reden, sehen und schreiben – ohne Spiel. Ein Spiel lässt sich jederzeit dazu starten.
- **Echte 3D-Würfel:** Kniffel, Tutto und Ludo werfen mit echter Physik (Schwerkraft, Abprallen, Ausrollen). Kurz tippen wirft sanft, gedrückt halten oder nach oben wischen wirft kräftig – dann fliegen sie auch mal aus dem Kasten. Das Ergebnis kommt immer aus fairem Zufall; gegenüberliegende Seiten ergeben 7 wie bei echten Würfeln. Gehaltene Würfel bleiben liegen und leuchten.
- **Viele Spieler, kein Scrollen:** Alle Spieler passen in eine Zeile, lange Namen werden gekürzt, jeder hat Tier und Farbe. Viele Handkarten liegen in zwei Reihen; auf niedrigen Bildschirmen (Browser-Leiste, kleines Handy) wird alles dichter.
- **14 Looks:** Papierschnitt (Standard), Notizblock, Holz & Filz, Neon-Nacht, Klar & ruhig, Retro-Spielbox, Kreidetafel, Bonbon, Arcade, 70er, Casino, Comic, Aurora-Glas, Marine – der Admin wählt einen für alle, hell oder dunkel stellt jeder selbst ein. Würfel und Würfeltisch passen sich dem Look an.
- **Fair:** Krypto-Zufall ohne Verzerrung, online würfelt und mischt nur der Server. Wer anfängt bzw. gibt, wandert jede Partie weiter. Statistik-Tests prüfen Würfel und Mischen.
- **Siegerehrung** mit Podium und Konfetti, **Spielabend-Wertung** über mehrere Partien, **Gruppen** mit Bestenliste, **Profile** mit Statistik.
- **Admin** (`/admin`): Übersicht, Verlauf „wer war da“, Freigaben je Spiel, Standard-Einstellungen, Look, Funktionen, Grenzen, Export und Löschen.
- **Als App:** zum Home-Bildschirm hinzufügen, eigenes Icon, Vorschaubild beim Teilen.

**Standardmäßig aus, im Admin einschaltbar** (Optionen → Funktionen):
- **„Ein Handy für alle“** – lokal spielen ohne Raum, das Handy wird herumgereicht.
- **Offline-App** – Seite und Spiele auf dem Handy speichern, lokal ohne Netz spielen.

## Spiele

| Kategorie | Spiele |
| --- | --- |
| Würfel | **Tutto** (Feuerwerk wahlweise „bis zur Niete“ oder „als Chance“), **Kniffel**, **Mäxchen** |
| Karten | **Uno**, **Mau-Mau**, **Skip-Bo**, **Phase 10**, **Skyjo**, **Flip 7**, **Fischen**, **Hellseher** (Stiche ansagen) |
| Party & Rollen | **Werwolf** (App erzählt und liest alles vor, viele Erweiterungsrollen), **Eine Nacht**, **Codenames**, **Spion** |
| Brett | **Ludo** (Mensch ärgere dich nicht), **Vier in einer Reihe**, **Mühle**, **Dame** |

Jedes Spiel geht in der App **oder mit echtem Material am Tisch** – die App ist dann Punkteblock, Schlüsselkarte oder Erzähler.

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
| `npm run test:e2e` | Ende-zu-Ende-Tests im Handy-Format mit Playwright, inkl. Online-Raum mit mehreren Browsern, Chat und Videochat (Fake-SFU). Ein Einrichtungsschritt schaltet „Ein Handy für alle“ für die Tests ein. Screenshots landen in `screenshots/`. |
| `npm run check` | Build + Unit-Tests |
| `npm run deploy` | Build und Deploy per Wrangler |

Für `test:e2e` einmalig `npx playwright install chromium` ausführen – oder mit vorhandenem Chromium `PW_CHROMIUM_PATH=/pfad/zu/chromium npm run test:e2e`.

## Deployment

Cloudflare Workers Builds baut und deployt jeden Push auf `main` automatisch:

1. Im Cloudflare-Dashboard **Workers & Pages → Create → Import a repository**, `DasPocky/Spieltisch` wählen.
2. Build-Befehl `npm run build`, Deploy-Befehl `npx wrangler deploy`, Produktions-Branch `main`.

Die App ist dann unter https://spieltisch.bjoern-ef9.workers.dev/ erreichbar (Name in `wrangler.jsonc`). Zusätzlich prüft GitHub Actions (`.github/workflows/ci.yml`) bei jedem Push und Pull Request Build, Unit-Tests und die Playwright-Tests.

Manuell geht es mit `npx wrangler login` und `npm run deploy`.

**Sprachchat einrichten (Cloudflare Realtime):**

1. Im Cloudflare-Dashboard **Realtime → Serverless SFU → Create application** (Name z. B. `spieltisch`).
2. Die angezeigte **App ID** und das **App Secret** kopieren.
3. Unter **Workers & Pages → spieltisch → Settings → Variables and Secrets → Add** (Typ **Secret**) zwei Secrets anlegen: `REALTIME_APP_ID` (= App ID) und `REALTIME_APP_TOKEN` (= App Secret) (oder `npx wrangler secret put …`).

Ohne diese Secrets ist der Knopf 📞 einfach nicht da. Das Token bleibt auf dem Server: Die App spricht nur mit unserem Worker (`/api/rooms/<CODE>/call`), der prüft, dass nur Mitspieler des Raums eine Sitzung anlegen, nur eigene Sitzungen benutzen und nur Spuren von Mitspielern desselben Raums abholen. Ton und Bild laufen über das SFU von Cloudflare und werden nicht gespeichert. Für die Playwright-Tests simuliert der Worker das SFU (`REALTIME_FAKE=1` in `.dev.vars`, legt `scripts/test-env.mjs` an).

**Admin-Passwort setzen:** im Cloudflare-Dashboard unter **Workers & Pages → spieltisch → Settings → Variables and Secrets → Add** ein Secret `ADMIN_PASSWORD` anlegen (oder `npx wrangler secret put ADMIN_PASSWORD`). Ohne dieses Secret ist `/admin` gesperrt und alles bleibt offen. Lokal steht das Passwort in `.dev.vars` (`ADMIN_PASSWORD=…`, wird nicht eingecheckt; die Playwright-Tests legen die Datei mit `test-admin` an).

## Architektur

```
Browser ──HTTP──▶ Worker ──▶ statische React-App (dist/client)
        ──WS────▶ Worker ──▶ Durable Object „GameRoom“ (eines pro Raumcode)
```

```
shared/                       Logik für Browser UND Server
  cards/deck.ts               Kartenblätter: französisch 32/52, deutsch 32 (Einstellung „Blatt“)
  platform/
    types.ts                  Schnittstelle GameLogic, Einstellungen, Rechte
    room.ts                   Raum: Spieler, Host, Lobby/Partie, Rechteprüfung, Sicht pro Spieler
    random.ts                 fairer Krypto-Zufall (randomInt, rollDice, shuffle)
    turns.ts                  Zugreihenfolge; Startspieler/Geber wandert je Partie
    looks.ts                  die Looks (Admin-Auswahl)
    protocol.ts               Nachrichten zwischen Browser und Server (Aktionen, Chat, Sprachchat)
  games/
    index.ts                  Verzeichnis aller Spiele (Logik)
    tutto/                    Tutto: Karten-Daten und Spiellogik
    kniffel/                  Kniffel: Wertung und Spiellogik
    flip7/                    Flip 7: Stapel beider Varianten, Aktionen, Wertung
    werwolf/                  Werwolf: Rollen, Nacht/Tag, geheime Sicht pro Spieler
    einenacht/                Eine Nacht: Karten, Tausch-Reihenfolge, Abstimmung
    maumau/                   Mau-Mau: Hausregeln, geheime Hände
    uno/ skipbo/ phase10/     Uno, Skip-Bo, Phase 10: App-Karten oder Punkteblock
    skyjo/ codenames/         Skyjo, Codenames: App oder Brettspiel-Hilfe
    fischen/                  Fischen: Fragen, Teich, Quartette
worker/index.ts               API + Durable Object GameRoom
src/
  platform/                   Plattform-Oberfläche: RoomScreen (Kopfzeile, Lobby), Menü,
                              Einstellungen, Spielerliste, Seats (Spielerleiste), Regel-Bogen, Siegerehrung
    dice3d/                   3D-Würfel: Physik (cannon-es, lazy geladen), Würfeltisch, Wurf-Geste
    chat/                     Text-Chat, Sprechblasen, Treffpunkt
    call/                     Sprach-/Videochat (Cloudflare Realtime)
  styles/looks.css            die Looks als CSS-Variablen (hell + dunkel), Schriften lokal per @fontsource
  games/
    types.ts                  Schnittstelle GameUI (Oberfläche eines Spiels)
    index.ts                  Verzeichnis aller Spiel-Oberflächen
    tutto/                    Spielbrett, Karte, Würfel, Punkte-Tasten, Regelseite, Verlauf
    kniffel/                  Block, Würfel-Leiste, Eingabe für echte Würfel, Regelseite
    flip7/                    Tisch mit allen Reihen, Ziel- und Kartenauswahl
    werwolf/                  Spielleiter-/Geräte-Ablauf mit Vorlesen, Handy-Ansicht, Rollenkarten
    einenacht/                Gerät in der Mitte, Handy-Ansicht, Timer, Auflösung
    maumau/                   Tisch, Hand, Farbwunsch, Weitergeben mit Sichtschutz
    uno/ skipbo/ phase10/     Karten, Tisch, Punkteblock für echte Karten
    skyjo/ codenames/         Raster bzw. Wortfeld, Schlüsselkarte, Punkteblock
    fischen/                  Fragen-Verlauf, Hand, Frage-Auswahl
  pages/                      Startseite, lokale Lobby/Partie, Online-Raum, Profil, Gruppen, Admin
  hooks/                      useRoom (WebSocket + Reconnect), useRoute (Mini-Router), useViewMode
  components/ui/              shadcn/ui-Komponenten
tests/
  unit/                       Vitest: Zufall, Raum/Rechte, Tutto- und Kniffel-Regeln
  e2e/                        Playwright: lokal, online mit zwei Browsern, kleines Handy
```

**Routen:** `/` Startseite · `/lokal` lokale Lobby bzw. Partie (nur wenn „Ein Handy für alle“ an ist) · `/r/<CODE>` Online-Raum · `/profil` Mein Profil · `/gruppe`, `/g/<CODE>` Gruppen · `/admin`. Alte Links `/spiel/<id>` und `/spiel/<id>/lokal` führen in die lokale Lobby mit diesem Spiel (ein dort gespeicherter Spielstand lädt weiter).

### Grundprinzip

- **Der Server ist die einzige Wahrheit.** Clients schicken nur Aktionen (`{ type: "action", action }`), das Durable Object prüft sie mit derselben Logik aus `shared/`, speichert den neuen Stand und schickt jedem Spieler seine Sicht.
- **Lokal läuft dieselbe Logik** im Browser (`applyRoomAction` mit `actorId = null`, also alle Rechte).
- **Die Plattform** (`shared/platform/room.ts`) verwaltet alles, was für jedes Spiel gleich ist: Spieler und Zugreihenfolge, Host, Lobby ↔ Partie, Neue Runde, Spielwechsel, Einstellungen und die Rechteprüfung. Das Spiel sieht nur seinen eigenen Zustand und bekommt Spieler, Host, Akteur und Einstellungen als `GameContext`.
- **Rechte** deklariert jedes Spiel pro Aktion: `host` (nur Host), `turn` (für den Spieler am Zug – wer das darf, regelt die Raumeinstellung) oder `player` (jeder für sich selbst). Die Plattform prüft, bevor das Spiel die Aktion sieht.
- **Versteckte Informationen:** Über `view(state, viewerId)` filtert ein Spiel, was ein Spieler sehen darf. Tutto verbirgt so die Reihenfolge des Kartenstapels (Clients sehen nur, welche Karten noch drin sind), Werwolf schickt jedem nur die eigene Rolle (Wölfe kennen ihr Rudel, der Spielleiter sieht alles).
- **Spielerzahl:** Jedes Spiel hat `minPlayers`/`maxPlayers`, optional abhängig von Einstellungen über `playerLimits(options)`. Beim Beitritt gilt das absolute Maximum des Spiels, beim Start das genaue Minimum und Maximum zu den Einstellungen; die Lobby zeigt beides an.
- **Einstellungen gruppieren:** Mit `group` bekommen Einstellungen Zwischenüberschriften (Werwolf: Grundspiel, Neumond, Charaktere, Die Gemeinde).

### Damit nichts hängen bleibt

- **Host offline:** Ist der Host nicht verbunden, sehen alle anderen „Host übernehmen“. Der Server prüft, dass der Host wirklich weg ist.
- **Spieler offline oder reagiert nicht:** Jedes Spiel beschreibt mit `skipTurn`/`skipLabel`, wie der Host auflöst, worauf gerade gewartet wird (Tutto: Niete, Kniffel: erstes freies Feld wird gestrichen, Mau-Mau: Karte ziehen, Fischen: nächster Spieler, Werwolf: Nacht bzw. Abstimmung beenden, Jäger überspringen). Ist der Spieler am Zug offline, erscheint dafür ein Balken; im Menü steht es, sobald jemand offline ist oder sich 20 Sekunden nichts tut – sonst hinter „Hängt etwas?“.
- **Geprüft per Simulation:** `tests/unit/simulate.test.ts` lässt Zufalls-Bots je Spiel und Einstellung 25 komplette Partien lokal und online spielen (gründlicher: `SIM_ROUNDS=200 npm test`). In jedem Zustand muss ein erlaubter Zug existieren, jede Partie muss enden, und Karten dürfen nicht verloren gehen.

### Zugang und Sicherheit

- Raumcode: 5 Zeichen aus 32 (ohne 0/O/1/I), PIN: 4–8 Ziffern. Die PIN wird mit zufälligem Salt als SHA-256 gespeichert und steht nie im Link.
- Nach 8 falschen PINs ist der Raum 10 Minuten gesperrt.
- Nach dem Beitritt merkt sich das Gerät einen geheimen Token – Neuladen oder Funkloch geht ohne PIN weiter.
- Wer den Raum erstellt, ist Host. Verlässt der Host den Raum (wird entfernt), übernimmt der nächste Spieler.
- Nachrichten über 4 KB werden verworfen, jede Aktion wird serverseitig validiert.
- Räume ohne Aktivität werden nach **48 Stunden** automatisch gelöscht (Durable-Object-Alarm). Der Host kann einen Raum im Menü sofort schließen („Raum schließen“ – alles wird gelöscht).
- Admin: Passwort nur als Cloudflare-Secret, Vergleich in konstanter Zeit, nach 8 Fehlversuchen 10 Minuten Pause. Der Zugangscode wird gesalzen gehasht gespeichert. Abgeschaltete oder gesperrte Spiele lehnt der Server schon beim Erstellen eines Online-Raums ab; bestehende Räume laufen weiter.

## Datenhaltung

| Ort | Inhalt | Wann gelöscht |
| --- | --- | --- |
| Durable Object `GameRoom` (Cloudflare, eines pro Raumcode, SQLite-Speicher) | PIN-Hash + Salt, Spielernamen, Avatare, gewähltes Spiel, Einstellungen, Spielstand inkl. Verlauf, die letzten 100 Chat-Nachrichten, Wiederverbindungs-Tokens, Fehlversuche, Profil-ID je Spieler (nur serverseitig, für die Statistik) | 48 h nach der letzten Aktion oder sofort über „Raum schließen“ |
| Durable Object `ProfileStore` (eines pro Profil-ID) | Profilname, Zähler je Spiel (Partien, Siege, Bestwert, Punktesumme), die letzten 30 Partien (Spiel, Datum, Sieg, Punkte, Spielerzahl) | ein Jahr nach der letzten Partie oder sofort über „Profil löschen“ |
| Durable Object `SiteSettings` (genau eines) | Admin-Freigaben, Look, Funktionen, Grenzen, Standard-Einstellungen, Hinweistext, Hash + Salt des Zugangscodes, Fehlversuche, Statistik, Verlauf vergangener Räume, Verzeichnis von Gruppen und Profilen | bis der Admin es ändert bzw. löscht (Verlauf nach eingestellter Frist) |
| `localStorage` im Browser | Profil-ID (`spieltisch:profile`), Zugangscode nach richtiger Eingabe (`spieltisch:access`), eigener Name (`spieltisch:name`), Token pro Raum (`spieltisch:room:<CODE>`), lokaler Spielstand pro Spiel (`spieltisch:local:<id>`) und zuletzt lokal gewähltes Spiel (`spieltisch:localGame`), Ansicht (`spieltisch:view`) | beim Verlassen des Raums bzw. vom Nutzer |
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
  // ownTurnsOnly: true,    // bei verdeckten Karten: nur der Spieler am Zug selbst, auch nicht der Host
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
  log,         // optional: Verlauf als Texte – Leiste über dem Spiel und „Spieler & Verlauf“
  overview,    // optional: Spielertabelle für „Spieler & Verlauf“ (sonst schlichte Spielerliste)
  History,     // optional: ausführlicher Verlauf statt `log` (z. B. Einträge mit Punkten)
  undoEntry,   // optional: spieleigenes Zurücknehmen ({ type: "undo" }) – springt im einen Rückgängig-Knopf ein
  MenuExtras,  // optional: zusätzliche Knöpfe im Menü-Abschnitt „Partie“
  HeaderExtra, // optional: kleine Info in der Kopfzeile
};
```

Und in `src/games/index.ts` eintragen. Bausteine zum Wiederverwenden liegen in `src/platform/`: `Scoreboard` (optional antippbar), `Die` (Würfel), `cards/PlayingCard` (Karten beider Blätter samt Rückseite), `Handoff` (Sichtschutz beim lokalen Weitergeben), `ResultScreen` (Siegerehrung mit „Nochmal spielen“ und „Anderes Spiel“), `RulesSheet`, `Segmented`.

Das `Board` muss ohne Scrollen auf einen Handy-Bildschirm passen: Es sitzt in einem Flex-Container mit fester Höhe – den Platz in der Mitte mit `flex-1 min-h-0` füllen, Tasten mit `shrink-0` unten.

### 3. Tests

- Unit-Tests in `tests/unit/<id>.test.ts` (Hilfen in `tests/unit/helpers.ts`, z. B. `fixDice()` für vorgegebene Würfe).
- Ein Playwright-Test in `tests/e2e/`, der die Partie im Handy-Format spielt und `expectNoScroll()` prüft.

Fertig – Startseite, Lobby, Spielwechsel, Einstellungen, Rechte, Online-Räume und Menü funktionieren automatisch.
