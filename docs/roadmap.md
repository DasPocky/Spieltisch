# Roadmap

## Neue Spiele

- **Welle 2:** Herzen, Schocken, Bluff, Stadt-Land-Fluss, Wer bin ich, ein Tabu-artiges Erklärspiel
- **Welle 3:** Ankreuzspiel, Klingel, Shithead, Zahlen-Rommé, Doppelkopf, Skat
- weitere Würfelspiele

## Plattform

- **Native Apps** – Capacitor-Hülle für iOS und Android mit Push („klopft an“, „du bist dran“), siehe [Konzept](konzept.md#12-ausblick-native-apps-für-ios-und-android)
- **Konto** – geräteübergreifend per E-Mail-Link oder Passkey (das Geräteprofil bleibt die Grundlage)
- **Desktop-Version** (Idee) – eigene Gestaltung für große Bildschirme, evtl. Spiele, die am Computer mehr Sinn ergeben
- **Bot-Modus für alle** – Mitspieler durch die App ersetzen (Testspieler gibt es schon im Entwickler-Modus; für alle bräuchten sie eine Spielstärke statt Zufall)
- **Profil gliedern** – Abschnitte zusammenfassen, evtl. Tabs
- Sprachchat-Knopf beim ersten Mal kurz erklären

## Entwicklung

- **Testhilfen bündeln** – doppelte Helfer in den Handy-Tests (lokale Lobby, Admin-Anmeldung, Räume) nach `tests/e2e/util.ts`, feste Wartezeiten durch Erwartungen ersetzen
