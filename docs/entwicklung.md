# Entwicklung

## Architektur

```
Browser ──HTTP──▶ Worker ──▶ statische React-App (dist/client)
        ──WS────▶ Worker ──▶ Durable Object „GameRoom“ (eines pro Raumcode)
```

| Ordner | Inhalt |
| --- | --- |
| `shared/platform/` | Gemeinsam für Browser und Server: Raum, Rechte, Zugreihenfolge, fairer Zufall, Protokoll, Looks; `directory.ts` mit Sichtbarkeit, Einlass, Lebensdauer und Raumkarten |
| `shared/games/<id>/` | Spiellogik je Spiel (läuft auf Server und Client) |
| `shared/cards/` | Kartenblätter (französisch 32/52, deutsch 32) |
| `worker/index.ts` | API und Durable Objects (`GameRoom`, `ProfileStore`, `SiteSettings` mit Raumverzeichnis) |
| `src/games/<id>/` | Oberfläche je Spiel: Spielbrett, Regeln, Verlauf |
| `src/platform/` | Plattform-Oberfläche: Lobby, Menü, Einstellungen, Spielerleiste, Siegerehrung |
| `src/platform/dice3d/` | 3D-Würfel: Physik (cannon-es), Darstellung (three.js), Wurf-Geste und Sperre |
| `src/platform/chat/`, `call/` | Text-Chat, Treffpunkt, Sprach- und Videochat |
| `src/pages/` | Start, Spiele, Online-Raum, lokale Partie, Profil, Gruppen |
| `src/pages/admin/` | Verwaltung: Anmeldung und Speichern (`context.tsx`), Übersicht, Live mit Raum-Blatt und Zuschauen, Statistik, Spiele, Leute, Einstellungen, Status, Entwickler |
| `shared/platform/bots.ts` | Testspieler: Zug-Kandidaten je Spiel und `botMove()` – genutzt vom Server, von „Ein Handy für alle“ und von der Simulation |
| `shared/build.ts` | Stand des Codes (Commit, Zweig, Bauzeit), beim Bauen über `vite.config.ts` eingesetzt |
| `src/lib/dev.ts` | Entwickler-Modus je Admin-Gerät: Diagnose, Netz-Simulation, Vorschau-Schalter |
| `src/platform/shell/` | App-Hülle mit Tab-Leiste, Blätter „Raum öffnen“ und „Beitreten“, Raumkarten |
| `src/platform/intro/` | Zum schnellen Ausprobieren eines Spiels: Verwaltung → Einstellungen → Entwickler-Modus, dann Entwickler → „Testraum mit Bots“. Bots ziehen zufällig erlaubte Züge; der Raum bleibt unsichtbar und zählt nicht.

Willkommen (neues Gerät) und Begrüßung mit Laden (bekanntes Gerät) |
| `src/styles/looks.css` | die Looks als CSS-Variablen (hell und dunkel) |
| `tests/unit/`, `tests/e2e/` | Vitest und Playwright |

**Routen:** `/` Start · `/spiele` Spiele · `/r/<CODE>` Online-Raum · `/lokal` ein Handy für alle (nur wenn eingeschaltet) · `/profil` · `/gruppe`, `/g/<CODE>` · `/admin`, `/admin/<bereich>` (live, statistik, spiele, leute, einstellungen, entwickler)

## Grundprinzipien

- **Der Server ist die einzige Wahrheit.** Clients schicken nur Aktionen. Das Durable Object prüft sie mit derselben Logik aus `shared/`, speichert den neuen Stand und schickt jedem Spieler seine Sicht. Lokal läuft dieselbe Logik im Browser.
- **Plattform und Spiel sind getrennt.** Die Plattform (`shared/platform/room.ts`) regelt Spieler, Host, Lobby, Partie, Einstellungen und Rechte. Ein Spiel sieht nur seinen eigenen Zustand und bekommt Spieler, Host, Akteur und Einstellungen als `GameContext`.
- **Rechte je Aktion:** `host`, `turn` (für den Spieler am Zug) oder `player` (jeder für sich). Die Plattform prüft, bevor das Spiel die Aktion sieht.
- **Versteckte Informationen** filtert jedes Spiel über `view(state, viewerId)` – z. B. die Reihenfolge des Kartenstapels oder die Rollen im Werwolf.
- **Fairer Zufall** nur über `shared/platform/random.ts` (Krypto-Zufall ohne Verzerrung). Online würfelt und mischt nur der Server. Startspieler und Geber wandern jede Partie weiter.
- **Nichts bleibt hängen:** Ist der Host offline, kann ein anderer übernehmen. Wartet das Spiel auf jemanden, der offline ist oder nicht reagiert, löst der Host über `skipTurn` auf.

## Ein neues Spiel hinzufügen

Ein Spiel besteht aus der **Logik** in `shared/games/<id>/logic.ts` und der **Oberfläche** in `src/games/<id>/index.tsx`.

### Logik

```ts
export const meinSpiel: GameLogic<MeinState, MeinAction> = {
  info: { id: "meinspiel", name: "Mein Spiel", tagline: "Ein Satz für die Auswahl.", category: "Würfel", minPlayers: 2, maxPlayers: 6, duration: "15 Min." },
  version: 1,
  turnBased: true,
  settings: [{ key: "rounds", label: "Runden", type: "number", default: 10, min: 1, max: 20, step: 1 }],
  setup: (ctx) => ({ v: 1, curId: ctx.players[0].id, scores: {}, winnerId: null }),
  actionKind: (a) => (a.type === "roll" ? "turn" : a.type === "reset" ? "host" : null),
  apply(state, a, ctx) { /* neuen Zustand zurückgeben, ungültige Züge mit GameError ablehnen */ },
  currentPlayerId: (s) => s.curId,
  isOver: (s) => s.winnerId !== null,
  // optional: view, skipTurn, onPlayerRemoved, onOptionsChanged, results
};
```

Regeln für die Logik:

- Rein und deterministisch – Zufall nur aus `random.ts`, kein `Math.random`, keine Zeit, kein DOM.
- Den alten Zustand nie verändern; ungültige Züge mit `GameError` und einer deutschen Meldung ablehnen.
- Jede Eingabe prüfen – Aktionen kommen ungefiltert aus dem Netz.
- Spieler nicht selbst speichern: Reihenfolge aus `ctx.players`, Punkte je Spieler-ID.

Danach in `shared/games/index.ts` eintragen.

### Oberfläche

```tsx
export const meinSpielUI: GameUI<MeinState, MeinAction> = {
  logic: meinSpiel,
  Icon,     // Symbol für Kacheln und Kopfzeile
  Board,    // die laufende Partie
  Rules,    // Regelseite
  log,      // optional: Verlauf
};
```

Danach in `src/games/index.ts` eintragen. Wiederverwendbare Bausteine liegen in `src/platform/` (`Scoreboard`, `DiceTray`, `cards/PlayingCard`, `ResultScreen`, `RulesSheet` …).

Das Spielbrett muss **ohne Scrollen** auf einen Handy-Bildschirm passen: Platz in der Mitte mit `flex-1 min-h-0` füllen, Knöpfe mit `shrink-0` unten.

Lobby, Einstellungen, Rechte, Online-Räume, Menü und Siegerehrung funktionieren dann automatisch.

## Tests

| Was | Wo |
| --- | --- |
| Regeln je Spiel | `tests/unit/<id>.test.ts` (Hilfen in `helpers.ts`, z. B. `fixDice()`) |
| Zufallspartien aller Spiele | `tests/unit/simulate.test.ts` – Bots (`shared/platform/bots.ts`) spielen je Einstellung 25 Partien lokal und online; jede muss enden, nie darf ein Zug fehlen, keine Karte verloren gehen (gründlicher: `SIM_ROUNDS=200 npm test`) |
| Fairness | `tests/unit/fairness.test.ts` – Statistik-Tests für Würfel, Mischen und Startspieler |
| Handy-Tests | `tests/e2e/` – Playwright im Format 390×844, inkl. Online-Raum mit mehreren Browsern; `expectNoScroll()` prüft, dass nichts scrollt |

Für die Handy-Tests einmalig `npx playwright install chromium` – oder ein vorhandenes Chromium per `PW_CHROMIUM_PATH=/pfad/zu/chromium npm run test:e2e`. Ein Einrichtungsschritt schaltet „Ein Handy für alle“ für die Tests ein; Screenshots landen in `screenshots/`.

**CI** (`.github/workflows/ci.yml`): Build und Unit-Tests laufen gleichzeitig mit den Handy-Tests. Die Handy-Tests sind auf vier Rechner verteilt (`--shard`), die Admin-Tests laufen auf einem fünften, weil sie Spiele abschalten; jeder Rechner hat seinen eigenen Server. Die Zufallssimulation spielt im PR 5 Partien je Einstellung, auf main 25 und nachts 200. Der Haken „Handy-Tests (Playwright)“ fasst alle Rechner zusammen.

Ohne Grafikchip (z. B. in Testumgebungen) zeichnen die 3D-Würfel automatisch einfacher. Für Vorschaubilder in voller Qualität: `localStorage.setItem("spieltisch:diceHQ", "1")`.

Willkommen (neues Gerät) und Begrüßung (bekanntes Gerät) sind im automatisierten Browser aus, damit die Tests nicht an der Animation hängen. `tests/e2e/intro.spec.ts` schaltet sie mit `localStorage["spieltisch:test-intro"] = "true"` gezielt ein.
