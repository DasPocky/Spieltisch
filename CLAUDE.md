# Hinweise für Claude

Spieltisch ist eine mobile Web-Spielesammlung (React + Cloudflare Workers). Überblick: `README.md`, Details: `docs/entwicklung.md`, `docs/betrieb.md`, offene Punkte: `docs/roadmap.md`.

## Zusammenarbeit

- Immer auf **Deutsch**, per **du**, kurz und direkt. Entscheidungen mit Optionen zur Auswahl vorlegen.
- **Vor jedem Push fragen** und vorher **Bilder zeigen** (Screenshots im Handy-Format) und das Feature **durchspielen**. Jeder Push auf `main` geht sofort live.
- Was ein Spielleiter am Tisch sagen würde, liest die App **vollständig vor** (Werwolf, Eine Nacht …).
- **Nichts darf hängen bleiben:** jeder Zustand braucht einen Ausweg (Überspringen, Host übernehmen, Timeout).
- Gestaltung: **kein Scrollen auf dem Handy**, leichte Oberfläche, **keine Markennamen** in Texten, Looks und Bildern.
- Standard-Look ist „Papierschnitt“; Online zuerst, „Ein Handy für alle“ und Offline sind im Admin einschaltbar.

## Arbeiten im Repo

- Dev-Server für Tests: `node scripts/test-env.mjs && npx vite --port 5199 --strictPort` (Playwright nutzt Port 5199 und verwendet einen laufenden Server mit). Bei hängenden Abhängigkeiten: `rm -rf node_modules/.vite` und mit `--force` starten.
- Handy-Tests in Paketen laufen lassen (z. B. `npx playwright test kniffel tutto --project=spiele --no-deps`), der komplette Lauf dauert lange. Chromium: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`.
- `tests/unit/simulate.test.ts` und `fairness.test.ts` brauchen mehrere Minuten.
- 3D-Würfel ohne Grafikchip werden vereinfacht gezeichnet; für Screenshots in voller Qualität `localStorage.setItem("spieltisch:diceHQ", "1")` setzen.
- Vor dem Commit: `npx tsc -b --noEmit` und die betroffenen Tests.
