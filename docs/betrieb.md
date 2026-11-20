# Betrieb

## Adressen

Live unter **https://spieltisch.endlab.de** (eigene Domain des Workers, `routes` in `wrangler.jsonc`). Die Zone `endlab.de` liegt bei Cloudflare (Nameserver von INWX dorthin delegiert, DNSSEC an, SSL „Full (strict)“, HTTPS erzwungen). `endlab.de` zeigt eine kleine Startseite (eigener Worker `endlab-start`, `www` leitet dorthin).

Frühere Adressen:

- `endlab.de/spieltisch…` (Route `endlab.de/spieltisch*`): Seiten ziehen samt Daten auf dem Gerät um. Der Worker liefert eine kleine Seite (`worker/move.ts`), die alle Einträge mit `spieltisch:` im Anker `#umzug=…` nach `spieltisch.endlab.de` mitnimmt; dort übernimmt `src/lib/moveIn.ts` sie, solange noch kein Profil auf dem Gerät liegt. Ein Service Worker der alten Adresse meldet sich selbst ab. Dateien und `/api` laufen dort für offene Tabs weiter. Als App auf dem Home-Bildschirm muss man Spieltisch einmal neu hinzufügen.
- `spieltisch.endlab.de/spieltisch…`: Seiten leiten auf denselben Pfad an der Wurzel um (301).
- Die alte Adresse `spieltisch.bjoern-ef9.workers.dev` bleibt erreichbar, weil Profile und Geräteschlüssel im Browser je Adresse liegen; Vorschauen je Zweig laufen weiter über workers.dev.

## Deploy über Workers Builds

Workers & Pages → spieltisch → Settings → Builds:

| Feld | Wert |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run cf:build` |
| Deploy command | `npm run cf:deploy` |
| Version command | `npm run cf:preview` |
| API token | `endlab-workers-builds` |

Was dahinter läuft, steht in `package.json`:

- `cf:build` → `build`: Typecheck und Vite-Build. Schlägt etwas fehl, geht nichts live. Unit- und Handy-Tests laufen in GitHub Actions (`.github/workflows/ci.yml`) an jedem PR; gemergt wird nur, wenn sie grün sind.
- `cf:deploy` → `scripts/release.mjs`: legt die Programmteile der laufenden Version mit in die neue (Geräte mit der alten App können so weiter nachladen), dann `wrangler deploy`. Jede Version geht sofort live.
- `cf:preview` → `wrangler preview`: Vorschau je Zweig.

### Stufen

| Stufe | Wo | Daten |
| --- | --- | --- |
| Test | lokal und GitHub Actions | lokale Durable Objects, `.dev.vars` aus `scripts/test-env.mjs` |
| Staging | Vorschau je Zweig (`previews` in `wrangler.jsonc`) | eigene, leere Durable Objects, R2 `spieltisch-vorschau-dateien` |
| Live | `main` auf spieltisch.endlab.de | Durable Objects von live, R2 `spieltisch-dateien` |

Vorschauen erben keine Secrets: ohne `ADMIN_PASSWORD` ist die Verwaltung dort aus, ohne Realtime-Token auch Audio und Video.

**Vorschauen aufräumen:** Jede Vorschau legt eigene Durable-Object-Namespaces an (4 je Zweig, 500 im Konto). Nach jedem Merge löscht Claude die Vorschau: `node scripts/vorschau-aufraeumen.mjs` (ohne Argument alle gemergten oder gelöschten Zweige, sonst die genannten).

### Updates ohne Unterbrechung

- **Geräte** merken neue Versionen (Raum-Gruß „hello“ beim Wiederverbinden nach dem Deploy und `/api/version` jede Minute): kurzer Hinweis, nach 2,5 Sekunden Neuladen – auch mitten im Zug; die Partie geht danach im selben Raum weiter. Passt das Nachrichtenformat nicht mehr (`PROTOCOL`), laden sie sofort neu. Fehlt eine Programmdatei, lädt die App einmal neu.
- **Laufende Partien** spielen mit ihrer Spielversion zu Ende (gesicherte alte Logik und Oberfläche in `shared/legacy` bzw. `src/legacy`), sonst wird umgerechnet oder die Partie endet sanft (Gruppe und Spielabend bleiben) – siehe `docs/entwicklung.md`.
- **Hinweise:** „Was ist neu?“ zeigt einmal pro Gerät die Neuigkeiten aus `shared/news.ts` (in der Verwaltung änderbar).

**Rückweg:** Workers & Pages → spieltisch → Deployments → ältere Version → **Rollback**, oder Claude per `wrangler rollback`. Spielstände bleiben, Geräte laden die ältere Version beim nächsten Gruß nicht neu (sie ist nicht neuer) – erst die nächste Version.

Der Speicher der Durable Objects ist unabhängig vom Code – Räume überstehen einen Deploy, offene Verbindungen bauen sich selbst neu auf. Den Klassennamen `GameRoom` nicht umbenennen.

## Secrets

Setzt Björn, die Werte sieht niemand sonst: `npx wrangler secret put <NAME>` oder Workers & Pages → spieltisch → Settings → Variables and Secrets.

| Secret | Wofür | Ohne |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Zugang zu `/admin` | Admin-Bereich gesperrt |
| `REALTIME_APP_TOKEN` | Sprach- und Videochat (Cloudflare **Realtime → Serverless SFU**, App Secret). Die App ID steht fest in `wrangler.jsonc` (`vars`) | kein Anruf-Knopf |
| `RELEASE_SECRET` | Die GitHub-Aktion **Stimme** lädt damit Bausteine hoch (`/api/release/files`, `/api/release/voice`); gleicher Wert als GitHub-Secret | keine neuen Stimm-Bausteine |

Die globale Ratenbremse `SENSITIVE` (Cloudflare Rate Limiting, 60 je Minute und Adresse) steht unter `ratelimits`.

Lokal stehen die Werte in `.dev.vars` (nicht eingecheckt). `scripts/test-env.mjs` legt die Datei für die Tests an, mit Admin-Passwort `test-admin` und simuliertem SFU (`REALTIME_FAKE=1`).

## Sicherheit

- **Räume:** Code aus 5 Zeichen, PIN aus 4–8 Ziffern, gespeichert nur gesalzen gehasht und nie im Link. Nach 8 falschen PINs ist der Raum 10 Minuten gesperrt. Nach dem Beitritt genügt ein geheimer Token zum Wiederverbinden. Die Beitritts-Nonce (gegen doppelte Spieler bei verlorener Antwort) gilt nur 2 Minuten und nur mit richtiger PIN – sie ist kein Zugang.
- **Profile und Gruppen:** Die Profil-ID ist ein Name, kein Schlüssel. Lesen, Ändern, Ergebnisse, Übertragen, Löschen und alle Gruppen-Aktionen brauchen den Geräteschlüssel des Profils (`x-profile-key`, nur als Hash gespeichert, höchstens 10 Geräte). Ein neues Handy bekommt seinen Schlüssel über den Übertragungs-Code. Profile von vor den Schlüsseln übernimmt das erste Gerät, das sich meldet. Auch im Raum zählt ein Profil nur mit Schlüssel.
- **Bremsen:** Lokal je Worker-Instanz (schnell) und global über Cloudflare Rate Limiting (`SENSITIVE`) für Profil-Schlüssel und Übertragungs-Codes; Fehlversuche werden zusätzlich gezählt.
- **Nachrichten:** Jede Nachricht ans Raum-Objekt geht zuerst durch `parseClientMessage` (`shared/platform/parse.ts`) – Typen, Längen, erlaubte Werte; Spielaktionen höchstens 6 Ebenen tief und 40 Felder. Neue Nachrichtentypen brauchen dort einen Eintrag und einen Test.
- **Großer Tisch:** sieht nur die öffentliche Sicht (`WATCH_ID`) und keinen Chat – den Bildschirm sieht jeder im Raum.
- **Sichtbarkeit und Einlass:** „Offene Räume“ zeigt nur belebte Räume, die für alle oder die eigene Gruppe freigegeben sind; private Räume („Niemand“) erscheinen nirgends. Mit „Anklopfen“ lässt der Host (vertretungsweise jemand im Raum) jeden Gast einzeln herein, Abgelehnte warten eine Minute. „Deine Räume“ prüft jeder Raum selbst anhand des Tokens; Profil-IDs gehen nie an andere Handys.
- **Host:** Wer den Raum erstellt, ist Host. Entfernte Spieler kommen nur mit neuem Beitritt per PIN zurück.
- **Eingaben:** Jede Aktion wird auf dem Server geprüft, Nachrichten über 4 KB werden verworfen, der Chat ist begrenzt.
- **Sprache und Video:** Das Token bleibt auf dem Server. Der Worker lässt nur Mitspieler desselben Raums Sitzungen anlegen und Spuren abholen. Ton und Bild werden nicht gespeichert.
- **Bilder eigener Kartensets:** nur über ihren genauen Namen abrufbar (rund 100 Bit Zufall, der Ordner ist ein Hash der Profil-ID); gelöschte Sets und verwaiste Bilder verschwinden aus R2. Ausgeliefert mit `cache-control: private` (kein geteilter Zwischenspeicher) und `x-robots-tag: noindex`. Bewusst ohne ablaufende Signatur: Wer ein Bild einmal in einem Raum gesehen hat, kann es weiter abrufen, bis das Set gelöscht ist. Signaturen müssten in jeden Spielstand, an den Fernseher und in die Tisch-Texturen – zu viel Umbau für wenig Gewinn.
- **Admin:** Passwort nur als Secret, Vergleich in konstanter Zeit, nach 8 Fehlversuchen 10 Minuten Pause. Sitzungen gelten 30 Tage (höchstens 20 gleichzeitig) und enden mit „Abmelden“ sofort. Zuschauen läuft über eine eigene WebSocket-Verbindung, die der Worker erst nach Prüfung des Sitzungs-Tokens an den Raum weiterreicht; sie kann nur lesen. Anmelden, Zuschauen und jeder Eingriff landen im **Protokoll der Verwaltung** (nur was und wann – keine Inhalte, PINs oder Chat; die letzten 200).

## Datenhaltung

| Ort | Inhalt | Gelöscht |
| --- | --- | --- |
| `GameRoom` (je Raum) | PIN-Hash, Spieler, Avatare, Einstellungen, Raumname und Zugang, Spielstand, die letzten 100 Chat-Nachrichten, Tokens, wer gerade anklopft | wenn der Raum so lange leer war, wie der Host gewählt hat (1 Stunde, 1 Tag, 1 Woche; höchstens die Obergrenze des Admins), oder über „Raum schließen“; Dauerräume nur vom Admin |
| `ProfileStore` (je Profil) | Profilname, Statistik je Spiel, die letzten 30 Partien | ein Jahr nach der letzten Partie oder über „Profil löschen“ |
| `SiteSettings` (einmal) | Admin-Einstellungen, Statistik, Verlauf vergangener Räume, Gruppen, Raumverzeichnis (Kurzinfo offener Räume), Betriebskennzahlen (14 Tage, nur Zahlen), Protokoll der Verwaltung (200 Einträge) | vom Admin; Verzeichniseinträge mit dem Raum |
| Browser (`localStorage`) | Profil-ID und Geräteschlüssel, Name, Token je Raum, lokale Spielstände, persönliche Einstellungen | beim Verlassen bzw. vom Nutzer |

IP-Adressen oder Konten speichert die App nicht (die Bremsen zählen Adressen nur kurz im Arbeitsspeicher bzw. bei Cloudflare).

**Betrieb** (Verwaltung → Einstellungen): je Tag Beitritte, Wiederverbindungen, abgelehnte Züge nach Art und kaputte Nachrichten – von den Räumen gebündelt gemeldet, ohne Inhalte. Ergebnisse für Profile und Gruppen tragen eine Partie-Kennung und zählen nur einmal; was nicht ankommt, versucht der Raum bis zu einem Tag lang erneut.

**Frischer Stand:** Verwaltung → Einstellungen → Daten → „Alles auswählen“ löscht Räume, Verlauf, Statistik, Gruppen und Profile und setzt die Einstellungen auf den Auslieferungszustand (das Admin-Passwort bleibt als Secret). Dabei vergibt der Server eine neue Neustart-Kennung (`epoch` in `/api/config`). Jedes schon benutzte Handy löscht beim nächsten Öffnen einmal seine Daten auf dem Gerät und beginnt mit dem Willkommen; das Gerät des Admins behält seine. Wer nur einzelne Bereiche löscht, ändert an den Handys nichts.

## Kosten

Läuft im Cloudflare-Konto von EndLab (Workers Paid); WebSocket-Nachrichten zählen gebündelt, ein Spieleabend braucht nur einen Bruchteil der enthaltenen Anfragen. Die Status-Leiste der Verwaltung zeigt den Verbrauch des Tages (ungefähr: jede Worker-Instanz meldet gesammelt).

## Version prüfen

Beim Bauen landen Commit, Zweig und Bauzeit im Code (in Cloudflare-Builds aus `WORKERS_CI_COMMIT_SHA` und `WORKERS_CI_BRANCH`, sonst aus git). Die Verwaltung vergleicht Gerät, Server (`/api/admin/status`) und den letzten Commit auf `main` des öffentlichen Repositorys. „Update offen“ heißt meist: Die Veröffentlichung läuft gerade.

## KI-Sprüche (Workers AI)

Der Moderator am Tisch kann frische Sprüche über Cloudflare Workers AI holen (Binding `AI` in `wrangler.jsonc`, Modell in `shared/platform/hostline.ts`). Standardmäßig aus – einschalten in der Verwaltung unter Einstellungen → Funktionen → „KI-Sprüche“. Grenzen: höchstens 400 Sprüche am Tag für alle Räume, je Adresse 40 in 10 Minuten; nur für Begrüßung, Kartenzar, Rundenpunkt und Sieg (nicht bei jedem Zug). Jede Antwort wird geprüft (ein Satz, Name enthalten, keine unerwünschten Wörter, keine Links) – sonst und bei jedem Fehler spricht der Moderator seine festen Texte. Lokal und in den Tests ist Workers AI nicht verbunden (`remoteBindings: false` in `vite.config.ts`).

## R2-Speicher

Bucket `spieltisch-dateien` (Speicherklasse Standard, kein öffentlicher Zugriff), im Worker als `FILES` gebunden (`wrangler.jsonc`; Vorschauen nutzen `spieltisch-vorschau-dateien`). Ordner:

- `r/<Raum-Objekt-ID>/` – Fotos der Spieler; jeder Raum löscht seine Fotos, wenn er endet.
- `assets/bilder/` – Bilder für Karten und Bühne
- `k/<Kurz-Hash des Profils>/<Zufall>` – Bildkarten aus eigenen Kartensets (JPEG/PNG/WebP, höchstens 150 KB, im Gerät auf 512 px verkleinert). Ausgeliefert unter `/api/kartenbild/…` mit `nosniff` und `default-src 'none'`. **Schutz nur über den nicht erratbaren Namen** – wer die Adresse kennt (z. B. ein Mitspieler), kann das Bild laden; privat heißt hier „nicht auffindbar“, nicht „zugriffsgeschützt“. Gelöscht wird beim Ändern oder Löschen des Sets (nur Bilder aus dem eigenen Ordner, die in keinem anderen Set des Profils – etwa einer Kopie – mehr stehen). Hochgeladene, aber nie gespeicherte Bilder räumt das Speichern eines Sets mit auf: höchstens einmal pro Stunde je Profil (`imgSweep` im Profil) wird der eigene Ordner aufgelistet, und was in keinem Set steht und älter als 24 h ist, fliegt raus (`orphanImages` in `shared/platform/cardsets.ts`). Wird ein Profil gelöscht (Verwaltung, „Daten löschen → Profile“ oder nach einem Jahr ohne Aktivität), gehen seine Sets aus der Liste für alle und der ganze Bild-Ordner mit.

Dateien unter `assets/` lädt die Verwaltung hoch (Einstellungen → Dateien; Typ und Inhalt werden geprüft, höchstens 25 MB). Ausgeliefert unter `/api/asset/<Ordner>/<Name>`.

### Echte Stimme (Ordner `assets/stimme/`)

Ansagen spielt das Gerät aus Bausteinen ab: feste Satzteile je Stimmung, Namen und Zahlen einzeln (`shared/platform/voice.ts`, `src/platform/realVoice.ts`). Jeder Baustein liegt als `stimme/<Prüfsumme>.mp3` in R2, die Liste aller in `stimme/index.json`. Fehlt ein Baustein, meldet das Gerät ihn (`POST /api/voice/missing`, geprüft und je Adresse begrenzt) und spricht diesmal mit der Gerätestimme.

Die GitHub-Aktion **Stimme** (`.github/workflows/stimme.yml`, stündlich, bei Änderungen an den Ansagen und per Knopf) erzeugt mit Thorsten (deutsche Neuronalstimme mit Stimmungen, CC0, über sherpa-onnx) alle festen Satzteile (`scripts/stimme/saetze.ts`), die Vornamen aus `scripts/stimme/namen.txt`, die Zahlen 0–300 und die gemeldeten Lücken (`GET /api/release/voice`), lädt neue Bausteine über `PUT /api/release/files/stimme/…` hoch, schreibt das Verzeichnis neu und meldet Erledigtes (`POST /api/release/voice/done`). Braucht das GitHub-Secret `RELEASE_SECRET` (gleicher Wert wie das Worker-Secret); andere Adresse als spieltisch.endlab.de über die Variable `SITE_URL`. Lokal: `SITE_URL=http://localhost:5199 RELEASE_SECRET=… MODEL_DIR=… python3 scripts/stimme/erzeugen.py`.

Klang: mittleres Tempo, etwas höher als das Modell (Werte `STYLE` in `erzeugen.py`). Aussprache: `scripts/stimme/aussprache.txt` (Schreibung = Sprechweise, z. B. `Kevin = Kevvin`; prüfen ohne Hören mit `scripts/stimme/lautschrift.py`); `stimme/quelle.json` merkt sich je Baustein Text und Sprechweise – ändert sich eine Zeile, erzeugt der nächste Lauf die betroffenen Bausteine neu. Klingt ein Wort falsch, genügt eine Zeile dort.

Stimmungen: neutral (Namen, Zahlen, normale Ansagen), froh (Moderator charmant), überrascht (frech), wütend (böse), flüsternd (Werwolf-Nacht), beschwipst, müde. Im Profil unter „Stimme“: echte Stimme oder Stimme des Geräts.

### Dateien per Schlüssel einspielen

`PUT /api/release/files/<Ordner>/<Name>` nimmt Dateien mit dem Kopf `x-release-key: <RELEASE_SECRET>` an (gleiche Prüfung wie in der Verwaltung, Eintrag im Protokoll) – für spätere Automatisierungen. Ohne passenden Schlüssel nimmt der Server nichts an.
