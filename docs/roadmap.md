# Roadmap

Die eine gültige Roadmap (Fassung 3, Oktober 2026) – Gesamtplan aus den Fragenblöcken plus die externe Code-Analyse.
Stand je Punkt: ✅ erledigt · 🔨 in Arbeit · ⏳ offen.

**Ziel:** Jedes Spiel läuft gleichwertig auf dem Handy, am Desktop und am Fernseher (Tisch oder Bühne mit Moderator). Updates gehen live, ohne dass eine Runde etwas merkt.

**Leitlinie (aus der Analyse):** keine Neuentwicklung – erst Sicherheits- und Update-Fundament, dann **ein** Referenzspiel vollständig, von dort Spiel für Spiel. Je Schritt ein PR mit Screenshots, durchgespielt, Freigabe, Abschnitt „Für Spieler“ (→ `shared/news.ts`).

## Phase 0 – Fundament: Updates, Versionen, Sicherheit 🔨

| Punkt | Stand |
| --- | --- |
| Versions-Handschlag: Gerät lädt an ruhigem Moment neu (Lobby, Partie-Ende, nicht dran; spätestens 2 Min.), zurück in denselben Raum, „Neue Version geladen“, keine Neulade-Schleife | ✅ |
| Fehlende Programmdateien: einmal neu laden; Server liefert die Dateien der vorigen Version mit; installierte App behält die vorige Version im Speicher | ✅ |
| Vier Versionen getrennt: Build, Nachrichtenformat (`PROTOCOL`, bei Abweichung sofort neu), Raum-Format (`ROOM_SCHEMA` + Übernahmen + Fixtures), Spielstand je Spiel | ✅ |
| Laufende Partie: mit gesicherter alter Version zu Ende (`scripts/legacy.mjs`), sonst umrechnen (`migrate`), sonst sanftes Ende mit Hinweis | ✅ |
| Raum-Revision `rev` in Stand und Bestätigung, ältere Stände verwerfen | ✅ |
| Update-Zeitpunkt im Admin (sofort · nach Rundenende je Raum · wenn keine Partie läuft · Uhrzeit · Knopf), `UPDATE_MODE` überschreibt, „Jetzt live“, Verlauf | ✅ (Warten braucht noch `RELEASE_SECRET` + `DEPLOY_TOKEN` + Deploy-Befehl, siehe Betrieb) |
| Hinweis im Raum, „Was ist neu?“ einmal pro Gerät, Neuigkeiten im Profil, im Admin bearbeitbar | ✅ |
| Analyse F-01: Beitritts-Nonce nur 2 Min. und nur mit PIN | ✅ |
| Analyse F-02/F-03: Geräteschlüssel für Profile, Gruppen und Profil im Raum; Übertragung gibt eigenen Schlüssel | ✅ |
| Analyse F-06: globale Ratenbremse (Cloudflare Rate Limiting) + Fehlversuche, lokale Bremse ohne Komplett-Leerung | ✅ |
| Analyse F-07: Raum-Bausteine als reine Funktionen (`worker/room/`) | ✅ erster Schritt (weitere bei Bedarf) |
| Analyse F-08: zentrale Prüfung aller Nachrichten (`parseClientMessage`) mit Negativtests | ✅ |
| Analyse F-09: Großer Tisch ohne Chat; Protokoll der Verwaltung | ✅ |
| Analyse F-10: Desktop-/Fernseher-Reihe in der CI, Namen-Prüfung für Knöpfe, ohne WebGL, reduzierte Bewegung | ✅ |
| Analyse F-11: Ergebnisse mit Partie-Kennung, nur einmal gezählt, bei Fehlern wiederholt | ✅ |
| Analyse F-14: Betriebskennzahlen je Tag (Beitritte, Wiederverbindungen, abgelehnte Züge, kaputte Nachrichten) | ✅ |
| CI: `npm audit` als Hinweis | ✅ · Branch-Schutz auf „Handy-Tests (Playwright)“ und „Build & Unit-Tests“ in GitHub einschalten ⏳ (Einstellung in GitHub) |

## Phase 1 – Grundlage für alle Spielweisen 🔨

Erledigt: Spielweisen je Spiel (an/Beta/aus in der Verwaltung) ✅ · Grafik-Stufen (automatisch nach Gerät und Bildrate, im Profil) ✅ · einfacher flacher Tisch ohne 3D bzw. bei WebGL-Ausfall ✅ · am Rechner am Tisch mitspielen – Referenz Mau-Mau (Beta): eigene Sicht, Hand darunter, Tastatur, umschaltbar ✅ · Begleit-Handy koppeln (QR am Rechner, Einmal-Code, zweites Gerät desselben Spielers) ✅ · Ton: drei Kanäle (Effekte, Musik, Publikum) mit eigener Lautstärke, Musik und Publikum am Tisch ✅ · Ohne Handy mitspielen: der Fernseher nimmt Spieler auf, ihre Hand erscheint hinter Sichtschutz am Fernseher ✅ · Fernbedienung: Pfeiltasten am Fernseher, Handy des Hosts steuert Ton und Verdecken ✅ · Bots mit Spielstärke (Mau-Mau, Uno, Vier gewinnt) ✅ · R2: Foto statt Tier im Raum ✅ · Gemeinsame Bausteine am Tisch (Karten, Würfel, Spielfeld, Platz-Notiz; Modell je Spiel) – Kniffel und Vier gewinnt am Tisch (Beta) ✅ · Uno am Rechner mitspielen (Beta, Tastatur) ✅

1. **Geräte- und Rollenmodell zuerst:** Profil → Geräte → Raum-Mitgliedschaft (Handy als Hand, Desktop als Steuerung, Mediengerät) und Raum-Anzeigen (Tisch, Zuschauer). Begleit-Handy und TV mit kurzen Paarungs-Codes, widerrufbar.
2. **Spielweisen je Spiel** (Handy · Desktop · Tisch/TV · Bühne · Ein Gerät), im Admin je Spiel schaltbar, neue als „Beta“.
3. **Grafik-Stufen** hoch/mittel/einfach nach Gerät **und gemessener Bildrate**, im Profil wählbar; WebGL-Ausfall → 2D ohne Raumverlust; reduzierte Bewegung beachten.
4. **Der Tisch ist die Desktop-Version** – keine eigene Desktop-Oberfläche. Drei Arten zu spielen, frei mischbar im selben Raum:
   - **nur am Rechner:** der Tisch aus eigener Sicht, eigene Hand vorne, Mitspieler mit Video an den Plätzen; Klicken, Ziehen, Tastatur (mit Hilfe), Hover-Hinweise, Chat rechts,
   - **Tisch + Handy:** der Rechner/Fernseher ist der Tisch für alle (heutiger Großer Tisch), gespielt wird am Handy – auch der Host kann zusätzlich am Rechner eine Hand haben,
   - **nur am Handy** wie bisher.
   Ohne 3D (schwacher Rechner, WebGL-Ausfall) ein **einfacher flacher Tisch** mit gleicher Anordnung. 2D und 3D sind nur Ansichten desselben Spielstands.
5. **Gemeinsame Bausteine** statt Einzellösungen (Tisch: Karten, Würfel, Spielfeld, Platz ✅; 3D-Würfel und -Steine folgen): `CardStack`, `HiddenHand`, `Dice`, `Token`, `Grid`, `Seat` – Physik/Kamera zeigen nur angenommene Züge.
6. **Handy als Begleiter:** Koppeln ✅, Fernbedienung ✅, Reaktionen vom Handy schweben am Tisch über dem Platz ✅ (Text bleibt auf den Handys), private Hand am Rechner ✅; offen: Kamera + Mikro.
7. **Fernseher-Beitritt:** QR ✅, Spieler ohne Handy am Fernseher ✅; offen: Bild/Selfie ohne Profil; Video am TV (Couch-Kamera, Online-Mitspieler, einzeln, abschaltbar).
8. **Ton:** Effekte, Musik, Publikum, getrennte Lautstärken ✅ (später: Moderator-Stimme als vierter Kanal).
9. **R2** für größere Daten: Fotos der Spieler ✅ (Typ-, Größen-, Inhalts- und Rechteprüfung, Verkleinern beim Hochladen, Löschen mit dem Raum); später Bildkarten.
10. **Bots:** Spielstärke getrennt vom Zufall, reproduzierbar mit festem Startwert, keine fremden Geheimnisse ✅ (Mau-Mau, Uno, Vier gewinnt; weitere Spiele in Phase 3).

## Phase 2 – Referenzspiel + Bühne und Moderator ⏳

1. **Referenzspiel vollständig:** Mau-Mau abgenommen ✅ ([Abnahmeblatt](abnahme/maumau.md)) – Desktop 2D/3D, Tisch/TV, private Hand (Karten nur am Begleit-Handy), Tastatur/Touch, Tastatur-Baustein auch für Uno, Bots auf allen Stufen ohne illegale Züge; „Am Rechner“ für Mau-Mau eingebaut an.
2. **Moderator-Vorschau** (`/moderator`, nur Verwaltung) – Leuchtkugel mit Mund, Blinzeln und drei Charakteren ✅. 3D-Figuren (menschlich und Comic) ausprobiert und verworfen: menschliche wirken unecht, freie Comic-Pakete ließen sich nicht automatisch laden.
3. **Moderator-MVP:** Leuchtkugel am großen Tisch für alle Tischspiele (Begrüßung, wer dran ist, Kartenzar, Rundenpunkt, Sieg), Gerätestimme, abschaltbar, Charakter wählbar ✅ – reine Darstellung, keine Regelinstanz.
4. **3D-Showstudio** mit Pulten, Lichtern, Kamerafahrten; TV-Ansicht je Spiel (Tisch oder Bühne), beim Einrichten wählbar, im Raum umschaltbar.
5. **KI-Sprüche** über Cloudflare Workers AI ✅ (Schalter in der Verwaltung, 400 am Tag, Filter, Rückfall auf feste Texte); später KI-Stimme. Charakter je Runde (charmant/frech/böse) – „frech/böse“ nur mit Zustimmung der Runde und passendem Set.
6. **Partyabend:** Host plant die Reihenfolge (2–8 Spiele), nach jeder Partie ist das nächste gewählt, Gesamtwertung über die Abendliste, Zwischenstand und Siegerehrung mit Podest am Fernseher, Moderator ruft den Abendsieger aus ✅; später: abstimmen, Mini-Runden.

## Phase 3 – Spiel für Spiel komplett ⏳

„Komplett“ = am Tisch spielbar (nur Rechner · Tisch + Handy · nur Handy; 3D und einfacher Tisch) · Bühne, wo es passt · Moderator-Ansagen · Bots mit Spielstärke. Reihenfolge nach Beliebtheit (Statistik), Mau-Mau, Uno, Schamlos zuerst.

**Abnahmeblatt je Spiel:** Regel-Tests inkl. Grenzfälle · Zufallspartien mit festen Startwerten · Geheimhaltung (Tisch/Zuschauer sehen nichts Privates) und Rechte · lokal, online, Wiederverbinden, Update mitten in der Partie · 2D/3D/TV/Bühne soweit vorgesehen · Tastatur/Touch/Maus, reduzierte Bewegung, kleine Displays · Bots ohne illegale Züge, Moderator-Rückfall · Doku, Screenshots, „Für Spieler“.

| Spielart | Spiele | Besonderheiten |
| --- | --- | --- |
| Karten | Mau-Mau, Uno, Skip-Bo, Skyjo, Phase 10, Flip 7, Fischen, Hellseher | Ablagen/Auslagen in 3D, Ziehen mit der Maus |
| Würfel | Kniffel, Tutto, Mäxchen | Würfel fliegen über den Tisch, Handy schütteln, Mäxchen mit Becher |
| Party | Werwolf, Eine Nacht, Spion, Codenames, Schamlos | Moderator als Spielleiter, Nacht-Stimmung, Abstimmung live, Geheimes nur am Handy |
| Brett | Dame, Mühle, Vier gewinnt, Ludo | Holzbrett auf dem Tisch, Züge animiert |

**Dazwischen, sobald die Bühne steht:** Zeichnen & Raten · Quiz & Schätzen · **Schamlos Paket B** (Kartenset-Baukasten auch für Quiz/Codenames/Zeichnen, private Sets, öffentliche Sets und Karten mit Freigabe, Bildkarten in R2).

## Phase 4 – Später ⏳

- **Neue Spiele:** Welle 2 (Herzen, Schocken, Bluff, Stadt-Land-Fluss, Wer bin ich, Erklärspiel), Welle 3 (Ankreuzspiel, Klingel, Shithead, Zahlen-Rommé, Doppelkopf, Skat) – jedes von Anfang an komplett.
- **Konto** (E-Mail-Link oder Passkey): Gastprofile nachweisbar zuordnen (Schlüssel-Basis ist da, die ID allein reicht nicht).
- **Native Apps** erst, wenn Web-App, Push und Deep Links an Grenzen stoßen.
- Profil gliedern, Hinweis zum Sprachchat-Knopf.

## Phase 5 – Dokuseite ⏳

Eigene Seite (eigenes Cloudflare-Projekt, Suche, Dunkelmodus), bei jedem Merge gebaut, Deutsch + Englisch, aus `docs/` als einziger Quelle. Bereiche: Spieler · Gastgeber/Admins · Selbst betreiben (lückenlos) · Entwickler. Getrennt: generierte Referenz (Regeln, Einstellungen aus dem Code), Konzept, Betriebshandbuch. Screenshots/Clips ausgewählt und stabil, nie Medien von Spielenden. Hilfe-Links aus der App.
