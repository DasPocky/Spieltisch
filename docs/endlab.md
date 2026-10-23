# EndLab: Spieltisch unter endlab.de/spieltisch – Bewertung, Entscheidungen, Zeitplan

Stand 23.10.2026. Grundlage: der Plan „EndLab – alle Projekte unter endlab.de, eine App, ein Speicher“. Hier steht, was davon wann umgesetzt wird und warum.

## Bewertung

**Der Kern stimmt.** Browser trennen Speicher (`localStorage`, Cookies, Service Worker, Cache) nach Herkunft (Schema + Host + Port), und auf dem iPhone hat jede installierte Web-App zusätzlich ihren eigenen Speicher. Ein gemeinsames Konto für mehrere Projekte geht deshalb nur mit **einer Adresse und einer installierten App**. Pfade unter `endlab.de` sind dafür der richtige Weg, Unterdomains wären es nicht.

**Ziel: eine einzige PWA für alle Projekte.** Weitere Projekte sollen dazukommen, ohne dass jemand eine zweite App installiert oder Daten verliert. Das geht nur, wenn von Anfang an alles unter `endlab.de` in **einer** App läuft – jedes neue Projekt landet dann automatisch in derselben App und demselben Speicher. Deshalb wird der Spieltisch schon jetzt umgebaut, bevor das zweite Projekt kommt: Jeder spätere Adresswechsel wäre ein Umzug für jedes Gerät (Übertragungs-Code, auf dem iPhone neu installieren), und mit jedem Nutzer teurer. **Darum direkt auf die Zieladresse, einmal.** Ziehen die Leute erst nach `spieltisch.endlab.de` und später nach `endlab.de/spieltisch`, müssten sie zweimal umziehen – die Idee „Hinweis auf workers.dev, zu spieltisch.endlab.de umzuziehen“ entfällt.

**Was im Plan fehlt oder zu schwach steht:**

1. **Eine Herkunft heißt geteiltes Vertrauen.** Alle Projekte unter `endlab.de` lesen denselben `localStorage` – also auch Profil-ID und Geräteschlüssel des Spieltischs. Eine Lücke (z. B. XSS) in irgendeinem späteren Projekt gefährdet dann alle. Regel: unter `endlab.de/…` nur eigene, geprüfte Projekte, strenge Content-Security-Policy je Projekt, keine fremden Skripte. Projekte mit fremdem oder ungeprüftem Code bekommen eine eigene Unterdomain (und damit bewusst ein eigenes Konto).
2. **Vorschauen nicht umleiten.** Die Umzugslogik darf nur auf der Produktionsadresse `spieltisch.bjoern-ef9.workers.dev` (und `spieltisch.endlab.de`) laufen, nie auf den Vorschau-Adressen je Zweig (`claude-…-spieltisch.….workers.dev`).
3. **Nicht mitten in der Partie umziehen.** Raum-Zugänge (Spieler-Token) liegen ebenfalls im Browser. Der Sprung zur neuen Adresse passiert nur in einem ruhigen Moment (kein offener Raum, keine laufende lokale Partie, nicht am Fernseher während einer Runde) – sonst flöge man aus der Runde.
4. **Fernseher und gedruckte QR-Codes.** Fernseher bleiben oft lange auf einer Adresse. Der Fernseher zieht deshalb nur beim Aufbau des Tischs um (kein Profil nötig), und QR-Codes zeigen ab dem Umzug immer die neue Adresse.
5. **Verwaltung.** Admin-Sitzung und „Admin-Gerät“ liegen auch im Browser; nach dem Umzug einmal neu anmelden – im Hinweis sagen.
6. **Umfang ist größer als geschätzt.** Gezählt im Code: 72 feste `/api/`-Pfade, 45 `navigate("/…")`, 7 × `location.origin`, dazu `index.html`, Manifest, Service Worker, Stimme und Dateien. Das ist ein großer, aber gut testbarer Umbau – in Schritte teilen.

## Entscheidungen

| Frage | Entscheidung | Grund |
|---|---|---|
| Wohin ziehen die Leute? | direkt nach `endlab.de/spieltisch`, `spieltisch.endlab.de` nur Zwischenstand | nur ein Umzug statt zwei |
| Wie verteilt Cloudflare? | **beide als Routen**: Hub `endlab.de/*`, Spieltisch `endlab.de/spieltisch*` (spezifischere Route gewinnt); keine eigene Domain auf `endlab.de` | ob Route oder eigene Domain Vorrang hat, ließ sich hier nicht nachlesen – mit zwei Routen stellt sich die Frage nicht |
| Wo liegt der Hub? | eigenes Repo `endlab-start` | eigener Deploy; ein Fehler am Hub kann den Spieltisch nicht mitreißen (und umgekehrt) |
| Basispfad im Client | ein Helfer für alle Pfade (`apiUrl`, `appPath`), Vite `base`, Router schneidet den Basispfad ab | eine Stelle statt 120 – künftige Funktionen machen es automatisch richtig |
| Worker | nimmt beide Formen an (mit und ohne `/spieltisch`), schneidet das Präfix am Anfang ab | alte Adressen, Vorschauen und Tests laufen unverändert weiter; schrittweise umstellbar |
| Spieltisch als eigene App installierbar? | nein, nur noch „EndLab“ | eine zweite installierte App wäre auf dem iPhone ein zweites Konto |
| Konto-Schlüssel `endlab:…` | Profil-ID und Geräteschlüssel beim Umzug (E4) gleich unter `endlab:` ablegen, Spiel-Einstellungen behalten `spieltisch:` | der Umzug schreibt die Daten ohnehin neu – kein zusätzlicher Migrationsschritt, und das nächste Projekt findet das Konto sofort |
| Alte Adressen | bleiben an, laden normal, ziehen in einem ruhigen Moment um | Vorschauen, alte Links und Fernseher brauchen sie; nichts darf hängen bleiben |

## Zeitplan (Pakete)

Reihenfolge der gesamten Arbeit, mit Platz für EndLab:

1. **Jetzt:** PR #32 Kartensets (+ Domain-Commit) mergen · B1 Sicherheit · B3 Regeln (Dame, Bot-Tests). *Grund: fertig und getestet, kleine Risiken – erst abschließen.*
2. ✅ (PR #35) **E1 Basispfad, ohne sichtbare Änderung** (vor dem Navigations-Umbau C1): Helfer für Pfade, Worker nimmt beide Formen an, Tests laufen weiter auf `/`. *Grund: C1 baut Startseite und Links ohnehin um – mit den Helfern nur einmal; jede spätere Funktion bringt sonst neue feste Pfade.*
3. ✅ (PR E2) **E2 Spieltisch unter `/spieltisch/` in der Vorschau:** Vorschau-Builds (Zweig ≠ main) bauen mit `/spieltisch`, Produktion bleibt an der Wurzel; Test `tests/e2e/basispfad.spec.ts` (läuft mit `APP_BASE`). Manifest und Installationshinweis kommen mit E3. Vite `base`, Dateien, Service Worker mit Scope `/spieltisch/`, Manifest auf EndLab, alle Handy-, Tisch- und Geräte-Tests zusätzlich mit Basispfad, Screenshots. *Grund: großes Risiko nur in der Vorschau, nicht live.*
4. **Hub (Repo `endlab-start`):** EndLab-Manifest, kleiner Service Worker, der nichts unter Projektpfaden anfasst, Kachel → `/spieltisch/`, Installationshinweis. Kann parallel zu E1/E2 laufen. *Braucht: Repo vom Nutzer.*
5. ✅ **E3 Routen schalten** (umgesetzt: Route `endlab.de/spieltisch*` → Spieltisch in `wrangler.jsonc`; Routen-Worker laufen vor dem Worker der eigenen Domain `endlab.de` – wie schon bei `endlab.de/tasto*`. Jeder Cloudflare-Build baut mit `/spieltisch`; alte Adressen springen im Browser auf denselben Pfad unter `/spieltisch`, Manifest heißt „EndLab“): `endlab.de/*` → Hub, `endlab.de/spieltisch*` → Spieltisch; `spieltisch.endlab.de` leitet um. *Grund: erst wenn E2 in der Vorschau durchgespielt ist.*
6. **E4 Umzug live** (entfällt laut Entscheidung 23.10.: alte Adressen bekommen keinen Hinweis): auf den alten Adressen im ruhigen Moment Übertragungs-Code holen und springen, Rückfall „Profil per Code übernehmen“, Hinweis zum Neu-Installieren, „Was ist neu“. *Grund: erst nach E3, sonst gibt es kein Ziel.*
7. Parallel bzw. danach wie geplant: B2 Partyabend (berührt keine Pfade, kann neben E2 laufen), dann C1–C3 Bedienung mit den Basispfad-Helfern, dann Spielwellen nach Freigabe.
8. **Mit dem zweiten Projekt:** es liest das Konto aus `endlab:…` und bekommt einen eigenen Pfad und Worker – keine neue App.

## Noch zu klären bzw. zu prüfen

- Repo `endlab-start` anlegen und dieser Sitzung freigeben (oder Quelltext des Hubs dort einchecken) – der heutige Stand liegt in keinem Repo.
- Vor E3 in der Cloudflare-Doku bzw. mit einer Test-Route prüfen, dass `endlab.de/spieltisch*` vor `endlab.de/*` greift, auch für WebSockets.
- Der heutige Hub leitet jeden Pfad außer `/` auf `/` um – nach E3 bekommt er `/spieltisch…` nicht mehr zu sehen; vorher nichts ändern.
