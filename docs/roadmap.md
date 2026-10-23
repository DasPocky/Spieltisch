# Roadmap

Die eine gültige Roadmap (Fassung 3, Oktober 2026) – Gesamtplan aus den Fragenblöcken plus die externe Code-Analyse.
Stand je Punkt: ✅ erledigt · 🔨 in Arbeit · ⏳ offen.

**Ziel:** Jedes Spiel läuft gleichwertig auf dem Handy, am Desktop und am Fernseher (Tisch oder Bühne mit Moderator). Updates gehen live, ohne dass eine Runde etwas merkt.

**Leitlinie (aus der Analyse):** keine Neuentwicklung – erst Sicherheits- und Update-Fundament, dann **ein** Referenzspiel vollständig, von dort Spiel für Spiel. Je Schritt ein PR mit Screenshots, durchgespielt, Freigabe, Abschnitt „Für Spieler“ (→ `shared/news.ts`).

**Adresse:** live unter `spieltisch.endlab.de` (Zwischenstand). Ziel `endlab.de/spieltisch` mit einer EndLab-App und einem Speicher – Bewertung, Entscheidungen und Reihenfolge in [endlab.md](endlab.md) ⏳.

## Phase 0 – Fundament: Updates, Versionen, Sicherheit 🔨

| Punkt | Stand |
| --- | --- |
| Versions-Handschlag: Gerät lädt an ruhigem Moment neu (Lobby, Partie-Ende, nicht dran; spätestens 2 Min.), zurück in denselben Raum, „Neue Version geladen“, keine Neulade-Schleife | ✅ |
| Fehlende Programmdateien: einmal neu laden; Server liefert die Dateien der vorigen Version mit; installierte App behält die vorige Version im Speicher | ✅ |
| Vier Versionen getrennt: Build, Nachrichtenformat (`PROTOCOL`, bei Abweichung sofort neu), Raum-Format (`ROOM_SCHEMA` + Übernahmen + Fixtures), Spielstand je Spiel | ✅ |
| Laufende Partie: mit gesicherter alter Version zu Ende (`scripts/legacy.mjs`), sonst umrechnen (`migrate`), sonst sanftes Ende mit Hinweis | ✅ |
| Raum-Revision `rev` in Stand und Bestätigung, ältere Stände verwerfen | ✅ |
| Update-Zeitpunkt im Admin (Standard „Sofort für alle“: jedes Gerät lädt gleich neu, die Partie läuft weiter ✅ · am ruhigen Moment · nach Rundenende je Raum · wenn keine Partie läuft · Uhrzeit · Knopf), `UPDATE_MODE` überschreibt, „Jetzt live“, Verlauf | ✅ (Warten braucht noch `RELEASE_SECRET` + `DEPLOY_TOKEN` + Deploy-Befehl, siehe Betrieb) |
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

Erledigt: Spielweisen je Spiel (an/Beta/aus in der Verwaltung) ✅ · Grafik-Stufen (automatisch nach Gerät und Bildrate, im Profil) ✅ · einfacher flacher Tisch ohne 3D bzw. bei WebGL-Ausfall ✅ · am Rechner am Tisch mitspielen – Referenz Mau-Mau (Beta): eigene Sicht, Hand darunter, Tastatur, umschaltbar ✅ · Begleit-Handy koppeln (QR am Rechner, Einmal-Code, zweites Gerät desselben Spielers) ✅ · Ton: drei Kanäle (Effekte, Musik, Publikum) mit eigener Lautstärke, Musik und Publikum am Tisch ✅ · Ohne Handy mitspielen: der Fernseher nimmt Spieler auf, ihre Hand erscheint hinter Sichtschutz am Fernseher ✅ · Fernbedienung: Pfeiltasten am Fernseher, Handy des Hosts steuert Ton, Verdecken, Moderator, Videos und Ansicht ✅ · Fernseher ohne Knöpfe: nur Tisch und QR-Code, Menü erscheint erst bei Maus oder Taste ✅ · Bots mit Spielstärke in allen Brett-, Würfel- und Kartenspielen ✅ · R2: Foto statt Tier im Raum ✅ · Gemeinsame Bausteine am Tisch (Karten, Würfel, Spielfeld, Platz-Notiz; Modell je Spiel) – Fünf Würfel und Vier in einer Reihe am Tisch (Beta) ✅ · Eins! am Rechner mitspielen (Beta, Tastatur) ✅ · am Rechner mitspielen auch bei Stapelbau, Zehn Phasen, Himmelskarten, Hellseher, Fischen und Glückssieben (Beta, Tastatur) ✅

1. **Geräte- und Rollenmodell zuerst:** Profil → Geräte → Raum-Mitgliedschaft (Handy als Hand, Desktop als Steuerung, Mediengerät) und Raum-Anzeigen (Tisch, Zuschauer). Begleit-Handy und TV mit kurzen Paarungs-Codes, widerrufbar.
2. **Spielweisen je Spiel** (Handy · Desktop · Tisch/TV · Bühne · Ein Gerät), im Admin je Spiel schaltbar, neue als „Beta“.
3. **Grafik-Stufen** hoch/mittel/einfach nach Gerät **und gemessener Bildrate**, im Profil wählbar; WebGL-Ausfall → 2D ohne Raumverlust; reduzierte Bewegung beachten.
4. **Der Tisch ist die Desktop-Version** – keine eigene Desktop-Oberfläche. Drei Arten zu spielen, frei mischbar im selben Raum:
   - **nur am Rechner:** der Tisch aus eigener Sicht, eigene Hand vorne, Mitspieler mit Video an den Plätzen; Klicken, Ziehen, Tastatur (mit Hilfe), Hover-Hinweise, Chat rechts,
   - **Tisch + Handy:** der Rechner/Fernseher ist der Tisch für alle (heutiger Großer Tisch), gespielt wird am Handy – auch der Host kann zusätzlich am Rechner eine Hand haben,
   - **nur am Handy** wie bisher.
   Ohne 3D (schwacher Rechner, WebGL-Ausfall) ein **einfacher flacher Tisch** mit gleicher Anordnung. 2D und 3D sind nur Ansichten desselben Spielstands.
5. **Gemeinsame Bausteine** statt Einzellösungen (Tisch: Karten, Würfel, Spielfeld, Platz ✅; 3D-Würfel und -Steine folgen): `CardStack`, `HiddenHand`, `Dice`, `Token`, `Grid`, `Seat` – Physik/Kamera zeigen nur angenommene Züge.
6. **Handy als Begleiter:** Koppeln ✅, Fernbedienung ✅, Reaktionen vom Handy schweben am Tisch über dem Platz ✅ (Text bleibt auf den Handys), private Hand am Rechner ✅, Kamera + Mikro übers Begleit-Handy (es ist im Videochat derselbe Spieler) ✅.
7. **Fernseher-Beitritt:** QR ✅, Spieler ohne Handy am Fernseher ✅, Selfie ohne Profil mit der Kamera am Bildschirm ✅, Video am TV: Bilder der Spieler an ihren Plätzen (einzeln und ganz abschaltbar, nur Bild) und Couch-Kamera fürs Wohnzimmer ✅; am Rechner erscheinen Mitspieler im Videochat ebenfalls am Platz ✅.
8. **Ton:** Effekte, Musik, Publikum, getrennte Lautstärken ✅ (später: Moderator-Stimme als vierter Kanal).
9. **R2** für größere Daten: Fotos der Spieler ✅ (Typ-, Größen-, Inhalts- und Rechteprüfung, Verkleinern beim Hochladen, Löschen mit dem Raum); später Bildkarten.
10. **Bots:** Spielstärke getrennt vom Zufall, reproduzierbar mit festem Startwert, keine fremden Geheimnisse ✅ (alle Brett-, Würfel- und Kartenspiele; Rate- und Partyspiele bleiben zufällig).

## Phase 2 – Referenzspiel + Bühne und Moderator ⏳

1. **Referenzspiel vollständig:** Mau-Mau abgenommen ✅ ([Abnahmeblatt](abnahme/maumau.md)) – Desktop 2D/3D, Tisch/TV, private Hand (Karten nur am Begleit-Handy), Tastatur/Touch, Tastatur-Baustein auch für Eins!, Bots auf allen Stufen ohne illegale Züge; „Am Rechner“ für Mau-Mau eingebaut an. Eins! danach abgenommen ✅ ([Abnahmeblatt](abnahme/eins.md)), Schamlos ✅ ([Abnahmeblatt](abnahme/schamlos.md)) mit eigener Bühnen-Leinwand (schwarze Karte groß, Antworten eingesetzt), Fünf Würfel ✅ und Vier in einer Reihe ✅ am Tisch freigegeben ([fuenfwuerfel](abnahme/fuenfwuerfel.md), [vier](abnahme/vier.md)).
2. **Moderator-Vorschau** (`/moderator`, nur Verwaltung) – Leuchtkugel mit Mund, Blinzeln und drei Charakteren ✅. 3D-Figuren (menschlich und Comic) ausprobiert und verworfen: menschliche wirken unecht, freie Comic-Pakete ließen sich nicht automatisch laden.
3. **Moderator-MVP:** Leuchtkugel am großen Tisch für alle Tischspiele (Begrüßung, wer dran ist, Kartenzar, Rundenpunkt, Sieg), Gerätestimme, abschaltbar, Charakter wählbar ✅ – reine Darstellung, keine Regelinstanz.
4. **3D-Showstudio** ✅ (Beta: Mau-Mau, Eins!, Schamlos, Fünf Würfel, Vier in einer Reihe): Bühne mit Leinwand, Pult je Spieler mit Leuchtstreifen, schwenkende Scheinwerfer, Spotlicht und Kamerafahrt zu dem, der dran ist; am Fernseher „Tisch | Bühne“ umschaltbar (je Gerät gemerkt). Später: eigene Bühnen-Ansichten je Spiel (Quiz, Zeichnen), Abnahme → „an“.
5. **KI-Sprüche** über Cloudflare Workers AI ✅ (Schalter in der Verwaltung, 400 am Tag, Filter, Rückfall auf feste Texte); später KI-Stimme. Charakter je Runde (charmant/frech/böse) – „frech/böse“ nur mit Zustimmung der Runde und passendem Set.
6. **Partyabend:** Host plant die Reihenfolge (2–8 Spiele), nach jeder Partie ist das nächste gewählt, Gesamtwertung über die Abendliste, Zwischenstand und Siegerehrung mit Podest am Fernseher, Moderator ruft den Abendsieger aus ✅, Auswahl als Raster ohne Scrollen ✅; später: abstimmen, Mini-Runden.

## Phase 3 – Spiel für Spiel komplett 🔨

**Keine Markennamen** ✅: Spiele mit Markennamen heißen jetzt Eins!, Stapelbau, Zehn Phasen, Decknamen, Himmelskarten, Glückssieben, Fünf Würfel und Alles oder nichts – in der App, im Code, in Kennungen und Dateinamen. Alte Räume, Statistiken, Profile, Gruppen, Einstellungen und Links laufen weiter (`shared/games/renamed.ts`). Werbebilder neu aus aktuellen Screenshots (`node scripts/bilder.mjs`) ✅.

**Stand:** abgenommen Mau-Mau, Eins!, Schamlos, Fünf Würfel, Vier in einer Reihe ✅ · am Tisch als Beta: Stapelbau, Himmelskarten, Zehn Phasen, Glückssieben, Decknamen (neue Bausteine „Stapel“ in der Mitte, „Auslage am Platz“ und „Wortraster“) ✅ – Abnahme nach dem Ausprobieren

**Echter Tisch in 3D** 🔨 (vor den restlichen Spielen, damit jedes gleich richtig auf den Tisch kommt): alles, was in der Mitte und am Platz liegt, liegt wirklich auf dem Tisch – Zahlenkarten, Stapel mit sichtbarer Höhe, Auslagen am Platz, Wortkarten, Würfel und Spielsteine in Perspektive, mit Dicke, Licht und Schatten, leicht schief wie hingelegt; neue Karten gleiten herein, Aufdecken dreht um. Schonend für schwache Geräte: gezeichnet wird nur bei Bewegung, Kartenbilder einmal erzeugt und geteilt, weiche Schatten statt Schattenberechnung (echte nur auf „hoch“), Bildschärfe begrenzt, „flach“ bleibt als Rückfall. Erledigt: Stapel, Auslage am Platz, Wortkarten mit Teamplättchen (Stapelbau, Himmelskarten, Zehn Phasen, Glückssieben, Decknamen) ✅ · Würfel kullern herein, gehaltene vorn mit Lichtschein (Fünf Würfel) ✅ · Vier in einer Reihe als schräg stehendes Brett, Steine fallen in die Spalte ✅ · Alles oder nichts (Karte hinter den Würfeln) und Mäxchen (Becher, Ansage, Aufdecken) als Beta ✅ · Dame, Mühle (zu setzende Steine neben dem Brett) und Ludo (Pöppel, Würfel daneben) als Brett auf dem Tisch, Beta ✅ · Fischen (Teich, Quartette am Platz) und Hellseher (Trumpf und Stich mit Namen, Ansagen am Platz), Beta ✅ · Werwolf, Eine Nacht und Spion mit Aufsteller (Phase, Hinweis), Nachtlicht, Uhr und verdeckter Karte je Platz, Beta ✅. Damit hat jedes Spiel eine eigene Tisch-Ansicht; alle abgenommen und an (`docs/abnahme/tisch.md`) ✅. Ab jetzt kommt jedes weitere Spiel gleich in 3D auf den Tisch. Raum und Material ✅: lackiertes Holz mit Maserung, Filz mit Fasern und Schimmer, Dielen und Teppich, Umgebungslicht zum Spiegeln, Rand dunkelt ab (auf „einfach“ ohne Lack und Schimmer). Weiche Verschattung und Unschärfe hinten auf „hoch“, Namenskarten am Platz ✅.

„Komplett“ = am Tisch spielbar (nur Rechner · Tisch + Handy · nur Handy; 3D und einfacher Tisch) · Bühne, wo es passt · Moderator-Ansagen · Bots mit Spielstärke. Reihenfolge nach Beliebtheit (Statistik), Mau-Mau, Eins!, Schamlos zuerst.

**Abnahmeblatt je Spiel:** Regel-Tests inkl. Grenzfälle · Zufallspartien mit festen Startwerten · Geheimhaltung (Tisch/Zuschauer sehen nichts Privates) und Rechte · lokal, online, Wiederverbinden, Update mitten in der Partie · 2D/3D/TV/Bühne soweit vorgesehen · Tastatur/Touch/Maus, reduzierte Bewegung, kleine Displays · Bots ohne illegale Züge, Moderator-Rückfall · Doku, Screenshots, „Für Spieler“.

| Spielart | Spiele | Besonderheiten |
| --- | --- | --- |
| Karten | Mau-Mau, Eins!, Stapelbau, Himmelskarten, Zehn Phasen, Glückssieben, Fischen, Hellseher | Ablagen/Auslagen in 3D, Ziehen mit der Maus |
| Würfel | Fünf Würfel, Alles oder nichts, Mäxchen | Würfel fliegen über den Tisch, Handy schütteln, Mäxchen mit Becher |
| Party | Werwolf, Eine Nacht, Spion, Decknamen, Schamlos | Moderator als Spielleiter, Nacht-Stimmung, Abstimmung live, Geheimes nur am Handy |
| Brett | Dame, Mühle, Vier in einer Reihe, Ludo | Holzbrett auf dem Tisch, Züge animiert |

**Stirnraten** 🔨 (neues Partyspiel, alle Varianten kombiniert): Handy an die Stirn, nicken = erraten, nach hinten = weiter (Sensor, sonst Tippen) · Varianten Klassisch, Teams (2–8, „Offene Runde“), Bombe (geheime Lunte, weitergeben), Hochstapler (einer kennt den Begriff nicht) · Darstellung Erklären, Pantomime, Geräusche, Summen, Akzent · 3.556 Begriffe in 59 Kategorien, Stufen Kinder/Familie/Freunde/Ab 18, eigene Begriffe · ein Handy, online und am Fernseher (Uhr, Punkte, nie der Begriff) · Video der Runde mit der Frontkamera, bleibt auf dem Gerät (Verwaltung: abschaltbar) · Vorlesen wie ein Spielleiter.

**Echte Stimme** ✅ (statt Gerätestimme): Thorsten (deutsche Neuronalstimme, CC0) mit Stimmungen – Moderator je Charakter froh/überrascht/wütend, Werwolf-Nacht flüsternd. Ansagen werden am Gerät aus Bausteinen zusammengesetzt (feste Satzteile, Namen und Zahlen einzeln), alles in R2. Die GitHub-Aktion „Stimme“ erzeugt vorab Satzteile, ~520 Vornamen und Zahlen und liefert gemeldete Lücken (neue Namen, neue Sätze) stündlich nach; bis dahin spricht das Gerät. Profil: echte Stimme oder Gerätestimme. Später: weitere Stimmen (z. B. eine Frauenstimme) als Auswahl.

**Dazwischen, sobald die Bühne steht:** Zeichnen & Raten ✅ (drei Begriffe zur Wahl aus den malbaren Stirnraten-Kategorien, Striche live im Spielstand, Raten per Rufen oder Tippen mit Tippfehler-Toleranz und „ganz nah dran“, Fernseher zeigt das Blatt groß – Tisch Beta) · Quiz & Schätzen ✅ (alle antworten gleichzeitig am eigenen Handy: Auswahl mit Tempo-Bonus, Schätzen, Ordnen; über 1.100 eigene Fragen in 8 Kategorien plus Kinderquiz, jede mit Quelle – die GitHub-Aktion „Quiz-Belege“ prüft, dass die Antwort in der Quelle steht; Tisch Beta) · **Eigene Kartensets** ✅ (Paket B: Editor im Profil für Schamlos, Decknamen, Zeichnen & Raten und Quiz – Liste einfügen, Fragen einzeln, Bildkarten in R2; Auswahl in der Lobby mit „Nur eigene …“ ab genug Inhalt; Vorschlagen → Verwaltung „Kartensets“ prüft mit Vorschau und gibt frei oder lehnt mit Grund ab; online und an einem Handy, Bilder auch am Tisch). Erstellername nur mit Häkchen, abschaltbar in der Verwaltung ✅. Verwaiste Bilder aufräumen (beim Speichern, höchstens stündlich; mit dem Profil) ✅. Offen: Bilder nur für Berechtigte ausliefern (heute: nicht erratbare Adresse).

## Phase 4 – Später ⏳

- **Neue Spiele:** Welle 2 (Herzen, Schocken, Bluff, Stadt-Land-Fluss, Wer bin ich, Erklärspiel), Welle 3 (Ankreuzspiel, Klingel, Shithead, Zahlen-Rommé, Doppelkopf, Skat) – jedes von Anfang an komplett.
- **Konto** (E-Mail-Link oder Passkey): Gastprofile nachweisbar zuordnen (Schlüssel-Basis ist da, die ID allein reicht nicht).
- **Native Apps** erst, wenn Web-App, Push und Deep Links an Grenzen stoßen.
- Profil gliedern, Hinweis zum Sprachchat-Knopf.

## Phase 5 – Dokuseite ⏳

Eigene Seite (eigenes Cloudflare-Projekt, Suche, Dunkelmodus), bei jedem Merge gebaut, Deutsch + Englisch, aus `docs/` als einziger Quelle. Bereiche: Spieler · Gastgeber/Admins · Selbst betreiben (lückenlos) · Entwickler. Getrennt: generierte Referenz (Regeln, Einstellungen aus dem Code), Konzept, Betriebshandbuch. Screenshots/Clips ausgewählt und stabil, nie Medien von Spielenden. Hilfe-Links aus der App.
