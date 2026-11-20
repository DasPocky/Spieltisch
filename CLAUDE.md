# Hinweise für Claude

Spieltisch ist eine mobile Web-Spielesammlung (React + Cloudflare Workers +
Durable Objects). Überblick: `README.md`, Aufbau und Tests:
`docs/entwicklung.md`, Betrieb: `docs/betrieb.md`.

## Zusammenarbeit (gilt in allen EndLab-Repos)

- Immer auf **Deutsch**, per **du**, kurz und direkt. Entscheidungen mit
  Optionen und Empfehlung vorlegen.
- **Jede Änderung als PR.** Vorher Vorschau-Link und Screenshots im
  Handy-Format zeigen.
- **Vor jedem Merge fragen.** Gemergt wird erst, wenn Björn „merge“ schreibt.
  Jeder Merge auf `main` geht sofort live.
- **Keine Geheimnisse** im Chat, im Code oder in GitHub. Secrets setzt Björn
  in Cloudflare.
- Deploy nur über **Cloudflare Workers Builds**, nie von Hand und nie aus
  GitHub Actions. GitHub Actions prüfen nur.
- Nichts darf hängen bleiben: Jede Änderung am Betrieb hat einen Rückweg.
- **Vollbild auf dem Handy:** Die App reicht bis an alle Ränder
  (`viewport-fit=cover`, Statusleiste durchscheinend, Hintergrund auch auf
  `<html>`). Nichts Bedienbares unter Notch, Kamera-Loch oder Home-Leiste:
  Abstände mit `env(safe-area-inset-*)`, Dialoge und Blätter nie höher als der
  freie Bereich, auch im Querformat.
- **Keine Ideen, Konzepte oder Pläne im Repo.** Ins Repo kommt nur, was gebaut
  ist und gilt: Code, Tests, Betriebsdoku, CLAUDE.md. Vorschläge nur im Chat.

## Spiele

- Neue Features vor dem PR **durchspielen**.
- Was ein Spielleiter am Tisch sagen würde, liest die App **vollständig vor**
  (Werwolf, Eine Nacht …).
- Jeder Zustand braucht einen Ausweg (Überspringen, Host übernehmen, Timeout).
- Gestaltung: **kein Scrollen auf dem Handy**, leichte Oberfläche, **keine
  Markennamen** in Texten, Looks, Bildern, Code, Kennungen und Dateinamen
  (frühere Kennungen nur in `shared/games/renamed.ts`).
- Look ist einheitlich EndLab wie in allen EndLab-Apps (hell „Welle“, dunkel
  „Nachthimmel“, Schrift Sora); Hell/Dunkel stellt jeder selbst ein, Standard
  wie das Handy. Online zuerst, „Ein Handy für alle“ und Offline sind im Admin
  einschaltbar.

## Arbeiten im Repo

- Dev-Server für Tests: `node scripts/test-env.mjs && npx vite --port 5199 --strictPort`
  (Playwright nutzt Port 5199 und verwendet einen laufenden Server mit). Bei
  hängenden Abhängigkeiten: `rm -rf node_modules/.vite` und mit `--force`
  starten.
- Handy-Tests in Paketen laufen lassen (z. B.
  `npx playwright test fuenfwuerfel alles --project=spiele --no-deps`), der
  komplette Lauf dauert lange. Chromium: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`.
- `tests/unit/simulate.test.ts` und `fairness.test.ts` brauchen mehrere
  Minuten.
- 3D-Würfel ohne Grafikchip werden vereinfacht gezeichnet; für Screenshots in
  voller Qualität `localStorage.setItem("spieltisch:diceHQ", "1")` setzen.
- Vor dem Commit: `npx tsc -b --noEmit` und die betroffenen Tests.
- **Nach jedem Merge löscht Claude die Vorschau des Zweigs**
  (`node scripts/vorschau-aufraeumen.mjs`, ohne Argument alle gemergten
  Zweige). Jede Vorschau belegt 4 Durable-Object-Namespaces, das Konto hat
  500.
