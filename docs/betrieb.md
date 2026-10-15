# Betrieb

## Deployment

Cloudflare Workers Builds baut und liefert jeden Push auf `main` aus (Build `npm run build`, Deploy `npx wrangler deploy`). Das dauert wenige Minuten. Manuell: `npx wrangler login` und `npm run deploy`.

GitHub Actions (`.github/workflows/ci.yml`) prüft parallel Build, Unit-Tests und Handy-Tests. Der Deploy wartet nicht darauf.

Der Speicher der Durable Objects ist unabhängig vom Code – Räume überstehen einen Deploy, offene Verbindungen bauen sich selbst neu auf. Den Klassennamen `GameRoom` nicht umbenennen und Spielstände rückwärtskompatibel halten; bei inkompatiblen Änderungen `version` im Spiel-Modul erhöhen.

## Secrets

Im Cloudflare-Dashboard unter **Workers & Pages → spieltisch → Settings → Variables and Secrets** (oder `npx wrangler secret put …`):

| Secret | Wofür | Ohne |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Zugang zu `/admin` | Admin-Bereich gesperrt |
| `REALTIME_APP_ID`, `REALTIME_APP_TOKEN` | Sprach- und Videochat (Cloudflare **Realtime → Serverless SFU**, App ID und App Secret) | kein Anruf-Knopf |

Lokal stehen die Werte in `.dev.vars` (nicht eingecheckt). `scripts/test-env.mjs` legt die Datei für die Tests an, mit Admin-Passwort `test-admin` und simuliertem SFU (`REALTIME_FAKE=1`).

## Sicherheit

- **Räume:** Code aus 5 Zeichen, PIN aus 4–8 Ziffern, gespeichert nur gesalzen gehasht und nie im Link. Nach 8 falschen PINs ist der Raum 10 Minuten gesperrt. Nach dem Beitritt genügt ein geheimer Token zum Wiederverbinden.
- **Host:** Wer den Raum erstellt, ist Host. Entfernte Spieler kommen nur mit neuem Beitritt per PIN zurück.
- **Eingaben:** Jede Aktion wird auf dem Server geprüft, Nachrichten über 4 KB werden verworfen, der Chat ist begrenzt.
- **Sprache und Video:** Das Token bleibt auf dem Server. Der Worker lässt nur Mitspieler desselben Raums Sitzungen anlegen und Spuren abholen. Ton und Bild werden nicht gespeichert.
- **Admin:** Passwort nur als Secret, Vergleich in konstanter Zeit, nach 8 Fehlversuchen 10 Minuten Pause.

## Datenhaltung

| Ort | Inhalt | Gelöscht |
| --- | --- | --- |
| `GameRoom` (je Raum) | PIN-Hash, Spieler, Avatare, Einstellungen, Spielstand, die letzten 100 Chat-Nachrichten, Tokens | 48 h nach der letzten Aktion oder über „Raum schließen“ |
| `ProfileStore` (je Profil) | Profilname, Statistik je Spiel, die letzten 30 Partien | ein Jahr nach der letzten Partie oder über „Profil löschen“ |
| `SiteSettings` (einmal) | Admin-Einstellungen, Statistik, Verlauf vergangener Räume, Gruppen | vom Admin |
| Browser (`localStorage`) | Profil-ID, Name, Token je Raum, lokale Spielstände, persönliche Einstellungen | beim Verlassen bzw. vom Nutzer |

IP-Adressen oder Konten speichert die App nicht.

## Kosten

Alles läuft im kostenlosen Cloudflare-Tarif (100.000 Worker-Anfragen pro Tag; WebSocket-Nachrichten zählen gebündelt). Ein Spieleabend braucht davon einen Bruchteil.
