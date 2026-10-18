# Betrieb

## Deployment

Cloudflare Workers Builds baut jeden Push auf `main` (Build `npm run build`, Deploy-Befehl `node scripts/release.mjs`). Das Skript

1. legt die Programmteile der laufenden Version mit in die neue (Geräte mit der alten App können so weiter nachladen),
2. lädt die neue Version hoch (`wrangler versions upload`),
3. fragt den laufenden Worker (`/api/release`), ob sie sofort live geht oder warten soll – und schaltet sie ggf. gleich frei.

Ohne Antwort (kein `RELEASE_SECRET`, Worker nicht erreichbar) geht die Version sofort live; geht das Hochladen allein nicht (z. B. neue Durable-Object-Klasse), wird klassisch deployt. Manuell: `npx wrangler login` und `npm run deploy`.

GitHub Actions (`.github/workflows/ci.yml`) prüft parallel Build, Unit-Tests, Handy-Tests und die Desktop-/Fernseher-Reihe. Der Deploy wartet nicht darauf.

### Updates ohne Unterbrechung

- **Zeitpunkt** (Verwaltung → Einstellungen → Updates, Standard „Sofort“): sofort · nach Rundenende je Raum · wenn keine Partie läuft (Höchstwartezeit, Standard 3 Std.) · feste Uhrzeit · nur per Knopf. Die Variable `UPDATE_MODE` (in `wrangler.jsonc` → `vars`) überschreibt die Einstellung. Wartende Versionen schaltet der Worker per Cron (alle 5 Minuten) frei – dafür braucht er `DEPLOY_TOKEN`.
- **Geräte** merken neue Versionen (Raum-Gruß „hello“ und `/api/version`) und laden an einem ruhigen Moment neu: Lobby, Partie-Ende oder wenn man nicht dran ist, spätestens nach 2 Minuten; im Modus „Nach Rundenende je Raum“ erst nach der Partie. Danach geht es im selben Raum weiter. Passt das Nachrichtenformat nicht mehr (`PROTOCOL`), laden sie sofort neu. Fehlt eine Programmdatei, lädt die App einmal neu.
- **Laufende Partien** spielen mit ihrer Spielversion zu Ende (gesicherte alte Logik und Oberfläche in `shared/legacy` bzw. `src/legacy`), sonst wird umgerechnet oder die Partie endet sanft (Gruppe und Spielabend bleiben) – siehe `docs/entwicklung.md`.
- **Hinweise:** Wartet ein Update, steht es dezent im Raum. Danach zeigt „Was ist neu?“ einmal pro Gerät die Neuigkeiten aus `shared/news.ts` (in der Verwaltung änderbar).

Vorschau-Builds anderer Zweige brauchen keine dieser Secrets: Das Skript lädt dort nur hoch und fragt nie den Live-Worker. Den Deploy-Befehl für andere Zweige (`npx wrangler versions upload`) nicht ändern.

Einrichtung für „warten können“ (einmalig): `RELEASE_SECRET` als Worker-Secret **und** als Build-Variable (gleicher Wert), `DEPLOY_TOKEN` als Worker-Secret (API-Token mit Recht „Workers Scripts: Edit“), Deploy-Befehl in Workers Builds auf `node scripts/release.mjs`. Ohne diese Schritte geht jede Version sofort live – wie bisher.

**Rückgängig machen:** In Cloudflare unter Workers → spieltisch → Deployments eine frühere Version wieder auf 100 % setzen (oder `npx wrangler rollback`). Spielstände bleiben, Geräte laden die ältere Version beim nächsten Gruß nicht neu (sie ist nicht neuer) – erst die nächste Version.

Der Speicher der Durable Objects ist unabhängig vom Code – Räume überstehen einen Deploy, offene Verbindungen bauen sich selbst neu auf. Den Klassennamen `GameRoom` nicht umbenennen.

## Secrets

Im Cloudflare-Dashboard unter **Workers & Pages → spieltisch → Settings → Variables and Secrets** (oder `npx wrangler secret put …`):

| Secret | Wofür | Ohne |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Zugang zu `/admin` | Admin-Bereich gesperrt |
| `REALTIME_APP_TOKEN` | Sprach- und Videochat (Cloudflare **Realtime → Serverless SFU**, App Secret). Die App ID steht fest in `wrangler.jsonc` (`vars`) – im Dashboard gesetzte Variablen löscht jeder Deploy | kein Anruf-Knopf |
| `RELEASE_SECRET` | Der Build meldet neue Versionen an (`/api/release`); gleicher Wert auch als Build-Variable | jede Version sofort live |
| `DEPLOY_TOKEN` | Wartende Versionen freischalten (Cloudflare-API-Token, „Workers Scripts: Edit“) | jede Version sofort live |

Feste Werte in `wrangler.jsonc` → `vars`: `CF_ACCOUNT_ID`, `WORKER_NAME`, optional `UPDATE_MODE`. Die globale Ratenbremse `SENSITIVE` (Cloudflare Rate Limiting, 60 je Minute und Adresse) steht unter `ratelimits`.

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
- **Admin:** Passwort nur als Secret, Vergleich in konstanter Zeit, nach 8 Fehlversuchen 10 Minuten Pause. Sitzungen gelten 30 Tage (höchstens 20 gleichzeitig) und enden mit „Abmelden“ sofort. Zuschauen läuft über eine eigene WebSocket-Verbindung, die der Worker erst nach Prüfung des Sitzungs-Tokens an den Raum weiterreicht; sie kann nur lesen. Anmelden, Zuschauen und jeder Eingriff landen im **Protokoll der Verwaltung** (nur was und wann – keine Inhalte, PINs oder Chat; die letzten 200).

## Datenhaltung

| Ort | Inhalt | Gelöscht |
| --- | --- | --- |
| `GameRoom` (je Raum) | PIN-Hash, Spieler, Avatare, Einstellungen, Raumname und Zugang, Spielstand, die letzten 100 Chat-Nachrichten, Tokens, wer gerade anklopft | wenn der Raum so lange leer war, wie der Host gewählt hat (1 Stunde, 1 Tag, 1 Woche; höchstens die Obergrenze des Admins), oder über „Raum schließen“; Dauerräume nur vom Admin |
| `ProfileStore` (je Profil) | Profilname, Statistik je Spiel, die letzten 30 Partien | ein Jahr nach der letzten Partie oder über „Profil löschen“ |
| `SiteSettings` (einmal) | Admin-Einstellungen, Statistik, Verlauf vergangener Räume, Gruppen, Raumverzeichnis (Kurzinfo offener Räume), Update-Verlauf, Betriebskennzahlen (14 Tage, nur Zahlen), Protokoll der Verwaltung (200 Einträge) | vom Admin; Verzeichniseinträge mit dem Raum |
| Browser (`localStorage`) | Profil-ID und Geräteschlüssel, Name, Token je Raum, lokale Spielstände, persönliche Einstellungen | beim Verlassen bzw. vom Nutzer |

IP-Adressen oder Konten speichert die App nicht (die Bremsen zählen Adressen nur kurz im Arbeitsspeicher bzw. bei Cloudflare).

**Betrieb** (Verwaltung → Einstellungen): je Tag Beitritte, Wiederverbindungen, abgelehnte Züge nach Art und kaputte Nachrichten – von den Räumen gebündelt gemeldet, ohne Inhalte. Ergebnisse für Profile und Gruppen tragen eine Partie-Kennung und zählen nur einmal; was nicht ankommt, versucht der Raum bis zu einem Tag lang erneut.

**Frischer Stand:** Verwaltung → Einstellungen → Daten → „Alles auswählen“ löscht Räume, Verlauf, Statistik, Gruppen und Profile und setzt die Einstellungen auf den Auslieferungszustand (das Admin-Passwort bleibt als Secret). Dabei vergibt der Server eine neue Neustart-Kennung (`epoch` in `/api/config`). Jedes schon benutzte Handy löscht beim nächsten Öffnen einmal seine Daten auf dem Gerät und beginnt mit dem Willkommen; das Gerät des Admins behält seine. Wer nur einzelne Bereiche löscht, ändert an den Handys nichts.

## Kosten

Alles läuft im kostenlosen Cloudflare-Tarif (100.000 Worker-Anfragen pro Tag; WebSocket-Nachrichten zählen gebündelt). Ein Spieleabend braucht davon einen Bruchteil. Die Status-Leiste der Verwaltung zeigt den Verbrauch des Tages (ungefähr: jede Worker-Instanz meldet gesammelt).

## Version prüfen

Beim Bauen landen Commit, Zweig und Bauzeit im Code (in Cloudflare-Builds aus `WORKERS_CI_COMMIT_SHA` und `WORKERS_CI_BRANCH`, sonst aus git). Die Verwaltung vergleicht Gerät, Server (`/api/admin/status`) und den letzten Commit auf `main` des öffentlichen Repositorys. „Update offen“ heißt meist: Die Veröffentlichung läuft gerade.

## R2-Speicher (Fotos)

Bucket `spieltisch-dateien` (Speicherklasse Standard, kein öffentlicher Zugriff), im Worker als `FILES` gebunden (`wrangler.jsonc`, auch für Vorschauen). Jeder Raum legt seine Fotos unter `r/<Raum-Objekt-ID>/` ab und löscht sie, wenn er endet. Fehlt die Bindung, sind Fotos einfach aus.
