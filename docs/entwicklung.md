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
- **Namen:** Code (Variablen, Funktionen, Dateien, Test-IDs) auf Englisch, alles Sichtbare auf Deutsch – Texte, Ansagen, URLs (`/spiel/…/lokal`, `/admin/statistik`), Kommentare und Testnamen.
- **Gemeinsame Bausteine zuerst:** Zufall und Codes (`shared/platform/random.ts`), Spielernamen (`playerName` in `turns.ts`), Speicher-Schlüssel (`src/lib/storage.ts`), Zeitangaben (`src/lib/time.ts`), kleine Stores (`src/lib/store.ts`), Auswahl (`Segmented`), Listenzeilen (`NavRow`). In Tests: `startLocal`, `createRoom`, `joinRoom`, `adminLogin`, `setConfig` aus `tests/e2e/util.ts`.

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

### Großer Tisch (Laptop/Fernseher)

Unter `/tisch` baut ein großer Bildschirm einen Raum auf (oder zeigt einen laufenden mit Code + PIN). Er meldet sich mit `{ type: "table", pin }` an und liest danach nur mit – wie die Verwaltung beim Zuschauen, mit der Sicht `WATCH_ID` ohne eigene Karten. Die Handys treten über den QR-Link `/r/CODE#pin=…` bei.

**Spielweisen** (`shared/platform/modes.ts`): Jedes Spiel meldet in `GAME_MODES`, ob es „Tisch“, „Am Rechner“ oder „Bühne“ kann – neu als `beta` (nur Geräte der Verwaltung), nach der Abnahme `on`. Die Verwaltung schaltet je Spiel um (`config.modes`).

**Am Rechner mitspielen:** Auf großen Bildschirmen zeigt der Raum bei Spielen mit „Am Rechner“ den Tisch aus eigener Sicht (`platform/desk`); das Spiel bekommt `desk: true` in den Board-Props und zeigt dann nur die eigene Hand mit Knöpfen, Maus und Tastatur (Beispiel: `games/maumau/Board.tsx`, `DeskHand`). Umschaltbar auf die klassische Ansicht.

**Handy als Begleiter:** Am Rechner zeigt „Handy koppeln“ (`platform/desk/PairSheet.tsx`) einen QR mit `/r/CODE#pair=XXXXXXXX`. Der Raum gibt den Code auf `{ type: "pair" }` aus (8 Zeichen, 5 Minuten gültig, `room.pairs`). Das Handy tritt mit `pairCode` bei und wird zweites Gerät desselben Spielers (`Attachment.companion`) – Rechner und Handy verdrängen sich nicht gegenseitig. Der Code gilt nur für den Tab, der ihn eingelöst hat (Beitritts-Wert je Tab); danach verbindet das Handy über den Zugang neu.

**Ohne Handy mitspielen** (`table/Couch.tsx`): Der Fernseher meldet Spieler als normale Mitspieler an – je Platz eine eigene Verbindung über `useRoom(…, { slot })` mit eigenem Zugang und ohne das Profil des Geräts. Ist so ein Spieler dran, öffnet sich links seine Handy-Ansicht hinter einem Sichtschutz (Enter deckt auf, Escape schließt); sonst über die Liste „Am Fernseher“.

**Fernbedienung:** Am Fernseher springt der Fokus mit den Pfeiltasten von Knopf zu Knopf (`src/lib/spatialNav.ts`, Enter löst aus; in Eingabefeldern und Reglern bleiben die Pfeile beim Feld). Ist ein Tisch verbunden, bekommen die Handys `tv: true` im Spielstand; der Host sieht im Menü unter „Großer Tisch“ die Fernbedienung und schickt `{ type: "remote", cmd }` (`sound`, `louder`, `quieter`, `cover`). Der Raum reicht das nur an die Tische weiter.

**Fotos (R2):** Spieler können im Treffpunkt (Kamera-Knopf auf der eigenen Kachel) oder über den eigenen Avatar ein Foto statt Tier setzen. Das Handy schneidet quadratisch zu und verkleinert (`src/lib/photo.ts`), geschickt wird es über die Raum-Verbindung (`{ type: "photo", data }`). Der Raum prüft Größe und Bildtyp an den ersten Bytes (`shared/platform/photo.ts`), legt es im Bucket `FILES` unter `r/<Raum-Objekt>/<Zufall>` ab und merkt den Namen in `RoomState.photos`; `roomAvatars` gibt ihn als `avatar.photo` weiter, `Avatar` zeigt dann das Bild. Ausgeliefert wird über `/api/photo/<Name>`. Endet der Raum, löscht er alle seine Fotos.

**Bots mit Spielstärke** (`shared/platform/botSkill.ts`): „leicht“, „mittel“, „schwer“ bewerten Züge (Mau-Mau, Uno, Vier gewinnt) nur aus eigener Sicht, wiederholbar mit festem Startwert; andere Spiele und „zufall“ ziehen zufällig. Stufe je Bot in `RoomState.botLevels`.

**Moderator** (`src/platform/moderator/`): die Leuchtkugel (`figures.tsx`) mit Mund, Blinzeln und Farbe je Charakter; Ansagen je Charakter und Moment mit Namen in `lines.ts`. Am großen Tisch beobachtet `useTableHost` (`src/platform/table/host.tsx`) die Partie und sagt an: Beginn, wer dran ist, Kartenzar, Rundenpunkt, Sieg – reine Anzeige, der erste Stand nach dem Laden bleibt still; Werwolf und Eine Nacht haben ihren eigenen Spielleiter. Schalter am Tisch: Moderator an/aus, Charakter, Vorlesen (Gerät). Vorschau unter `/moderator` (nur Verwaltung).

**Private Hand am Rechner:** Der Server meldet dem Rechner im Zustand `paired`, wenn das Begleit-Handy desselben Spielers verbunden ist. Dann bietet die Kopfzeile „Karten nur am Handy“ (`useDeskPrivate`, je Gerät): der Rechner zeigt nur den Tisch, gespielt wird am Handy. Geht das Handy, liegen die Karten sofort wieder am Rechner. Tastatur fürs Spiel am Rechner über `useDeskKeys` (`src/platform/desk/keys.ts`). Abnahme je Spiel: `docs/abnahme/<spiel>.md` (Vorlage Mau-Mau).

**Video am Tisch** (`src/platform/table/video.ts`): Der Große Tisch bekommt nach der PIN einen eigenen Schlüssel (`tableKey`, die letzten vier im Raum) und meldet sich damit im Videochat als `@tisch` an. `useSeatVideos` holt nur die Bilder der Spieler mit Kamera (kein Ton – im Wohnzimmer hallt das), `useCouchCam` schickt die Kamera des Bildschirms als Kachel „Couch“ zu den Handys. Schalter „Videos“ (`tableVideo`) und Klick aufs Video am Platz blenden aus. Couch-Spieler bekommen ein Foto über `TableCamera` (Countdown, Verkleinern wie am Handy). Test-SFU: `REALTIME_FAKE=1`, Attrappe `FAKE_RTC` in `tests/e2e/util.ts`.

**Partyabend** (`evening.plan` in `shared/platform/room.ts`): der Host legt mit `setPlan` 2–8 Spiele fest (`null` beendet den Plan). Jedes Spielende zählt `played` hoch, `toLobby` wählt das nächste Spiel mit Standard-Einstellungen, Rückgängig zählt zurück; `planStatus()` liefert nächstes Spiel und ob der Abend durch ist. Gewertet wird über die Abendliste (`eveningRanking`). Handy: Planen und Beenden im Abend-Blatt (`src/platform/Evening.tsx`); Fernseher: `PartyBoard` mit Zwischenstand bzw. Podest statt der Lobby-Karte.

**Ton** (`src/platform/sound.ts`): alles mit WebAudio erzeugt, drei Kanäle mit eigener Lautstärke (`prefs.volFx/volMusic/volCrowd`) hinter einem Begrenzer – `playSound` (Effekte), `playCrowd` (Applaus, Jubel, „Oooh“, Lachen), `startMusic`/`stopMusic` (ruhige Akkordfolge, Lobby lebhafter). Der Tisch spielt Musik und Publikum (`table/sound.tsx`), die Handys nur Effekte.

**Grafik-Stufen** (`src/lib/quality.ts`): hoch/mittel/einfach/flach – automatisch nach Gerät und gemessener Bildrate, im Profil festlegbar. „Flach“ (oder kein WebGL, Grafik abgestürzt) zeichnet den Tisch mit `table/flat.ts` – gleiche Schnittstelle wie die 3D-Szene.

**Bausteine des Tischs:** Ein Tischmodell besteht aus Karten (Stapel, Ablage, verdeckte Hände, Lückensatz), Würfeln (`dice`), Spielfeld (`grid`) und Plätzen (wer dran ist, Punkte, `notes` je Platz). Jedes Spiel baut sein Modell selbst in `src/games/<id>/table.ts` und trägt es in `MODELS` (`table/model.ts`) ein; neue Tisch-Ansichten starten in `GAME_MODES` als `beta`. Würfel und Spielfeld liegen als `FeltDice`/`FeltGrid` (`table/blocks.tsx`) auf dem Filz – im 3D- und im flachen Tisch gleich.

Ein Spiel bekommt seine Tisch-Ansicht über ein Modell in `src/platform/table/model.ts` (Stapel, Ablage, Kartenzahl je Spieler, wer dran ist, Verlauf). Die 3D-Szene (`table/scene.ts`, three.js, nur bei Bedarf geladen) zeichnet daraus den Holztisch; Kartenbilder kommen aus denselben Bausteinen wie am Handy (`table/textures.ts`). Spiele ohne Modell zeigt der Tisch wie ein Handy in der Mitte.

## Versionen und Updates

Es gibt vier getrennte Versionen:

| Version | Wo | Wann erhöhen |
| --- | --- | --- |
| Build (Commit + Bauzeit) | `shared/build.ts` | automatisch – Geräte laden bei neuerem Server neu |
| Nachrichtenformat | `PROTOCOL` in `shared/platform/protocol.ts` | wenn alte Geräte neue Nachrichten nicht verstehen (oder umgekehrt) – dann sofortiges Neuladen |
| Raum-Format | `RoomState.v`, `ROOM_SCHEMA` + `ROOM_MIGRATIONS` in `shared/platform/room.ts` | bei Umbau des Raums; Übernahme eintragen und Fixture unter `tests/fixtures/rooms/` ablegen |
| Spielstand je Spiel | `version` im Spiel-Modul | bei inkompatibler Änderung des Spielstands |

**Spielversion erhöhen:** `version` hochzählen, dann `node scripts/legacy.mjs <spiel>`. Das sichert Logik und Oberfläche der vorigen Version aus `origin/main` nach `shared/legacy/<spiel>-v<N>` und `src/legacy/<spiel>-v<N>` (Importe angepasst, in die Verzeichnisse eingetragen) und zieht `shared/games/versions.json` nach. Laufende Partien spielen damit zu Ende, die nächste startet aktuell (`gameVersion` merkt sich der Raum beim Start). Alternativ `migrate(state, from)` im Spiel schreiben und `--no-snapshot` nehmen. Ohne beides endet eine laufende Partie nach dem Update sanft (zurück in die Lobby mit Hinweis, Gruppe und Spielabend bleiben). Der Test `tests/unit/upgrade.test.ts` erinnert, wenn `versions.json` nicht passt. Alte Stände entfernen, wenn keine Partie mehr damit läuft: `node scripts/legacy.mjs --prune <spiel>-v<N>`.

Jede gespeicherte Änderung erhöht die **Revision** des Raums (`rev` in `state`/`ack`); Geräte verwerfen ältere Stände.

## Zugriffsmodell

Profil ≠ Gerät ≠ Spieler ≠ Rolle ≠ Verbindung:

- **Profil** (dauerhafte Gast-Identität): ID plus Geräteschlüssel je Gerät (`myProfile().key`, Kopfzeile `x-profile-key`). Server-Prüfung in `worker/auth.ts`.
- **Spieler im Raum:** Spieler-ID plus Token (Wiederverbinden); Host-Rechte prüft die Plattform je Aktion.
- **Großer Tisch / Zuschauer:** nur lesen, öffentliche Sicht, kein Chat am Tisch.
- **Verwaltung:** eigenes Passwort und Sitzungen, ist kein Mitspieler, jeder Eingriff wird protokolliert.

Negativtests dazu: `tests/e2e/security.spec.ts` (fremdes Profil, fremde Gruppe, fremde Nonce, Tisch ohne Chat, Zuschauer ohne Züge, kaputte Nachrichten), `tests/unit/protocol.test.ts`, `tests/unit/room-services.test.ts`.

Raum-Bausteine ohne Durable-Object-Abhängigkeit liegen in `worker/room/` (Beitritt, Chat, Ergebnisse, Typen) – `worker/rooms.ts` bleibt die Fassade.

## Tests

| Was | Wo |
| --- | --- |
| Regeln je Spiel | `tests/unit/<id>.test.ts` (Hilfen in `helpers.ts`, z. B. `fixDice()`) |
| Zufallspartien aller Spiele | `tests/unit/simulate.test.ts` – Bots (`shared/platform/bots.ts`) spielen je Einstellung 25 Partien lokal und online; jede muss enden, nie darf ein Zug fehlen, keine Karte verloren gehen (gründlicher: `SIM_ROUNDS=200 npm test`) |
| Fairness | `tests/unit/fairness.test.ts` – Statistik-Tests für Würfel, Mischen und Startspieler |
| Handy-Tests | `tests/e2e/` – Playwright im Format 390×844, inkl. Online-Raum mit mehreren Browsern; `expectNoScroll()` prüft, dass nichts scrollt |
| Desktop & Fernseher | `tests/e2e/geraete.spec.ts` (Projekt `geraete`) – Startseite, Tastatur, Namen für alle Knöpfe, Partie am Rechner, Tisch in 1920×1080 ohne WebGL und mit reduzierter Bewegung |
| Updates | `tests/e2e/update.spec.ts` – Neuladen alter Apps, kein Neuladen mitten im eigenen Zug, keine Schleife, „Was ist neu?“; `tests/unit/upgrade.test.ts` – alte Spielversionen, Raum-Fixtures, Update-Zeitpunkte |

Für die Handy-Tests einmalig `npx playwright install chromium` – oder ein vorhandenes Chromium per `PW_CHROMIUM_PATH=/pfad/zu/chromium npm run test:e2e`. Ein Einrichtungsschritt schaltet „Ein Handy für alle“ für die Tests ein; Screenshots landen in `screenshots/`.

**CI** (`.github/workflows/ci.yml`): Build und Unit-Tests laufen gleichzeitig mit den Handy-Tests (dazu `npm audit` als Hinweis). Die Handy-Tests sind auf vier Rechner verteilt (`--shard`), die Admin-Tests laufen auf einem fünften, weil sie Spiele abschalten, Desktop & Fernseher auf einem sechsten; jeder Rechner hat seinen eigenen Server. Die Zufallssimulation spielt im PR 5 Partien je Einstellung, auf main 25 und nachts 200. Der Haken „Handy-Tests (Playwright)“ fasst alle Rechner zusammen.

Ohne Grafikchip (z. B. in Testumgebungen) zeichnen die 3D-Würfel automatisch einfacher. Für Vorschaubilder in voller Qualität: `localStorage.setItem("spieltisch:diceHQ", "1")`.

Willkommen (neues Gerät) und Begrüßung (bekanntes Gerät) sind im automatisierten Browser aus, damit die Tests nicht an der Animation hängen. `tests/e2e/intro.spec.ts` schaltet sie mit `localStorage["spieltisch:test-intro"] = "true"` gezielt ein.
