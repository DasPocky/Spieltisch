# Konzept

Dieses Dokument beschreibt das Gesamtkonzept von Spieltisch: wofür die App da ist, wie sie aufgebaut ist und wohin sie sich entwickelt. Den Kern bilden die neue App-Hülle mit Startseite, Raumliste und privaten Räumen sowie die Zusammenführung von Treffpunkt und Spielraum. Zum Schluss folgt eine grobe Einschätzung, wie Spieltisch als native App für iOS und Android erscheinen könnte.

Technische Details stehen in [Entwicklung](entwicklung.md) und [Betrieb](betrieb.md), offene Punkte in der [Roadmap](roadmap.md).

## Inhalt

1. [Leitbild](#1-leitbild)
2. [Gestaltungsprinzipien](#2-gestaltungsprinzipien)
3. [Bausteine der App](#3-bausteine-der-app)
4. [App-Hülle und Navigation](#4-app-hülle-und-navigation)
5. [Erster Start und Wiederkommen](#5-erster-start-und-wiederkommen)
6. [Start-Tab](#6-start-tab)
7. [Räume](#7-räume)
8. [Spiele-, Gruppen- und Profil-Tab](#8-spiele--gruppen--und-profil-tab)
9. [Technische Umsetzung](#9-technische-umsetzung)
10. [Umsetzungsplan](#10-umsetzungsplan)
11. [Ausblick: native Apps für iOS und Android](#11-ausblick-native-apps-für-ios-und-android)

## 1. Leitbild

Spieltisch ist der digitale Spieltisch für den Spieleabend, ob alle zusammen im Wohnzimmer sitzen oder verteilt zu Hause. Jeder spielt am eigenen Handy, sieht live denselben Stand und kann mit den anderen reden, sie sehen und ihnen schreiben. Die App soll sich anfühlen wie eine richtige App und nicht wie eine Webseite: Sie startet schnell, begrüßt den Nutzer persönlich, zeigt sofort, was gerade los ist, und kommt ohne Anmeldung aus.

**Zielgruppen**

- **Feste Runden** (Familie, Freunde, Kollegen), die sich regelmäßig treffen und eine gemeinsame Bestenliste führen
- **Spontane Runden**, die schnell einen Raum öffnen und den Code teilen
- **Verteilte Runden**, für die Video und Sprache der eigentliche Treffpunkt sind und das Spiel dazukommt

## 2. Gestaltungsprinzipien

Diese Grundsätze gelten für jede Ansicht und jedes Spiel:

| Prinzip | Bedeutung |
| --- | --- |
| **Kein Scrollen auf dem Handy** | Jede Ansicht passt auf einen Bildschirm. Wird es eng, wird horizontal geblättert, aufgeklappt oder auf ein Blatt verlagert. |
| **Nichts bleibt hängen** | Jeder Zustand hat einen Ausweg: Überspringen, Host übernehmen oder Timeout. Das gilt auch für neue Abläufe wie das Anklopfen. |
| **Die App ist Spielleiter** | Was ein Spielleiter am Tisch sagen würde, liest die App vollständig vor. |
| **Leichte Oberfläche** | Wenige, klare Elemente; ein Hauptknopf pro Ansicht. |
| **Ohne Markennamen** | Weder in Texten noch in Looks oder Bildern tauchen Markennamen auf. |
| **Der Server ist die Wahrheit** | Clients schicken nur Aktionen; geprüft, gewürfelt und gemischt wird auf dem Server. |
| **Datensparsam** | Kein Konto, keine IP-Adressen, Profile laufen automatisch ab. |

Der Standard-Look ist **Papierschnitt**. Animationen und Übergänge orientieren sich an seiner Bildsprache (Papierteile, Schnittkanten, leichte Schatten) und übernehmen in anderen Looks deren Farben.

## 3. Bausteine der App

| Baustein | Beschreibung |
| --- | --- |
| **Profil** | Eines je Gerät: zufällige ID, Name und Avatar, dazu Statistik und letzte Partien auf dem Server. Per Übertragungs-Code auf ein anderes Gerät übertragbar. |
| **Raum** | Ort für ein Treffen: Video, Sprache, Chat und optional ein Spiel. Erreichbar über Code und PIN. |
| **Spiel** | Eine Partie innerhalb eines Raums. Logik in `shared/games/`, Oberfläche in `src/games/`. |
| **Gruppe** | Feste Runde mit Mitgliedern und Bestenliste über viele Spieleabende. |
| **Spieleabend** | Wertung über mehrere Partien in einem Raum. |
| **Admin** | Freigaben je Spiel, Standard-Einstellungen, Look, Funktionen, Verlauf, Export und künftig Dauerräume. |

Optional vom Admin einschaltbar bleiben **Ein Handy für alle** (eine Partie, ein Gerät, ohne Netz) und **Offline-Nutzung**.

## 4. App-Hülle und Navigation

### Tab-Leiste

Unten liegt eine feste Tab-Leiste mit vier Bereichen:

| Tab | Inhalt |
| --- | --- |
| **Start** | Begrüßung, eigene Räume, offene Räume, Hauptaktionen |
| **Spiele** | Alle freigegebenen Spiele mit Infoblatt und Regeln |
| **Gruppe** | Aktive Gruppe mit Bestenliste, Gruppen verwalten |
| **Profil** | Name, Avatar, Statistik, Übertragung, Einstellungen |

In einem Raum oder einer laufenden Partie ist die Tab-Leiste ausgeblendet; dort führt das Raummenü zurück. Ist eine Funktion im Admin abgeschaltet (z. B. Gruppen oder Profile), verschwindet der zugehörige Tab.

### Volle Fläche

- **Ganze Breite:** Die bisherige Begrenzung auf einen schmalen Mittelstreifen fällt weg. Große Handys und Tablets nutzen den Platz, ab etwa Tablet-Breite zweispaltig (z. B. Raumliste neben Spielauswahl).
- **Ganze Höhe:** Die Inhalte reichen bis an die Ränder, mit Abständen für Kamera-Aussparung, Statusleiste und Home-Balken.

### App-Gefühl

- Kein Zoomen per Doppeltipp, kein Gummiband-Effekt am Seitenrand, keine versehentliche Textauswahl auf Bedienelementen
- Animierte Übergänge zwischen Tabs und beim Öffnen von Blättern
- Zurück-Geste und Zurück-Taste schließen zuerst offene Blätter, wechseln dann zum Start-Tab und verlassen die App erst danach
- Haptisches Feedback, wo das Gerät es unterstützt (z. B. beim Würfeln, beim Anklopfen)

### Installation

- **Direkt aus der Seite:** Bietet der Browser die Installation an (Android, Chrome und Edge auf dem Desktop), installiert ein Knopf die App mit einem Tipp.
- **Mit Anleitung:** Wo das nicht geht (iOS Safari), zeigt ein Blatt in zwei bis drei Bildern, wie man Spieltisch über „Teilen → Zum Home-Bildschirm“ hinzufügt.
- **Einladung:** Ab dem zweiten Besuch erscheint einmal ein ansprechendes Blatt „Spieltisch als App“. Es lässt sich dauerhaft ausblenden und erscheint in der installierten App nicht.

## 5. Erster Start und Wiederkommen

### Erster Start

Ein Gerät ohne Profil sieht einen kurzen Willkommensablauf:

1. **Willkommen:** Logo und ein Satz, worum es geht.
2. **Wer bist du?** Name eingeben und Avatar wählen. Darunter: „Ich habe schon ein Profil“, das den Übertragungs-Code (8 Zeichen) vom anderen Gerät annimmt.
3. **Rundgang?** Wahl zwischen „Kurz zeigen“ (drei Wischkarten: Räume, Treffpunkt, Gruppe) und „Gleich los“.

Danach öffnet sich der Start-Tab. Jeder Schritt lässt sich überspringen; ohne Namen fragt die App ihn spätestens beim ersten Raum.

### Willkommen zurück

Bei jedem weiteren Start läuft eine Begrüßung von etwa drei Sekunden:

- Papierteile (Karten, Würfel, Spielfiguren) flattern herein und legen sich zum Logo.
- Der Avatar „klebt“ sich dazu, darunter steht „Willkommen zurück, *Name*!“.
- Ein Ladebalken aus Papierstreifen zeigt den Fortschritt. Währenddessen lädt die App Raumliste, Einstellungen und Gruppe.

Regeln für die Begrüßung:

- Ein Tipp überspringt sie.
- Sind die Daten nach drei Sekunden noch nicht da, geht es trotzdem weiter; die Inhalte erscheinen nachträglich mit Platzhaltern.
- Bei „Bewegung reduzieren“ im System gibt es nur ein kurzes Einblenden.
- Kehrt man innerhalb weniger Minuten zurück (App-Wechsel), entfällt die Begrüßung.

### Profil und späteres Konto

Das Geräteprofil bleibt die Grundlage. Ein Konto (z. B. per E-Mail-Link oder Passkey) ist vorgesehen, aber nicht Teil dieses Vorhabens. Damit es später leicht dazukommt, gilt schon jetzt:

- Die Profil-ID ist der einzige Schlüssel für Statistik, Gruppen und Raum-Mitgliedschaften.
- Ein Konto würde später nur Profil-IDs bündeln und geräteübergreifend zuordnen, ohne dass sich Datenmodell oder Räume ändern.

## 6. Start-Tab

Aufbau von oben nach unten, ohne Scrollen:

1. **Begrüßung:** Avatar, „Hallo *Name*“, bei Bedarf der Hinweis-Banner des Admins.
2. **Deine Räume:** Räume, in denen man schon war und die noch offen sind. Ein Tipp führt ohne erneute PIN zurück.
3. **Offene Räume:** Für einen sichtbare Räume anderer, Räume der eigenen Gruppe zuerst. Bei vielen Räumen wird horizontal geblättert.
4. **Schnellstart und Gruppe:** die wichtigsten Spiele als Kacheln (auf kleinen Handys ausgeblendet, sobald Räume da sind) und die eigene Gruppe mit Bestenliste.
5. **Hauptaktionen**, fest über der Tab-Leiste: **Raum öffnen** (groß) und **Beitreten** (Code oder Link). Ist „Ein Handy für alle“ eingeschaltet, kommt ein dritter Knopf dazu, ebenso der Hinweis auf eine noch laufende lokale Partie.

Ohne Räume zeigt der Bereich eine freundliche Leerstelle mit dem Hinweis, einen Raum zu öffnen oder einen Code einzugeben.

### Raumkarte

| Element | Beispiel |
| --- | --- |
| Raumname oder Host | „Donnerstagsrunde“ · „bei Anna“ |
| Spiel und Status | „Kniffel · läuft“ · „Uno · Lobby“ · „Treffpunkt“ |
| Spieler | Avatar-Reihe mit Anzahl, z. B. 4/6; Gruppenmitglieder hervorgehoben |
| Live-Zeichen | Symbol, wenn gerade jemand per Video oder Sprache verbunden ist |
| Zugang | Schloss bei Anklopfen, Gruppen-Zeichen bei „Sichtbar für Gruppe“ |

### Beitreten

- **Eigener Raum:** direkt zurück, ohne PIN (der gespeicherte Token genügt).
- **Fremder Raum:** PIN eingeben, bei Anklopfen zusätzlich auf Einlass warten.
- **Laufende Partie:** Man kommt als Zuschauer in den Raum, ist im Treffpunkt dabei und spielt ab der nächsten Partie mit.

## 7. Räume

### Ein Raumtyp für alles

Treffpunkt und Spielraum werden zu einem Raumtyp zusammengeführt. Jeder Raum ist zugleich Treffpunkt; ein Spiel ist optional und kann jederzeit begonnen oder beendet werden.

- **Ohne Spiel:** Videokacheln und Chat füllen den Raum, darunter „Spiel wählen“.
- **Mit Spiel:** Die Gesichter wandern wie bisher in die Spielerleiste, Chat und Sprache bleiben verfügbar.
- **Nach der Partie:** Siegerehrung, danach die Lobby für die nächste Partie; der Treffpunkt ist dort einen Tipp entfernt.
- **Raum öffnen** beginnt im Treffpunkt. Kommt man aus dem Spiele-Tab oder über den Schnellstart, steht das Spiel gleich in der Lobby bereit.

Niemand muss Video oder Sprache nutzen, um zu spielen, und niemand muss spielen, um sich zu treffen.

### Raum öffnen

Ein Blatt von unten mit:

- **Name** (vorausgefüllt aus dem Profil) und **PIN** (4–8 Ziffern)
- Knopf **Öffnen**
- aufklappbar **Mehr**: Raumname, Sichtbarkeit, Einlass, Lebensdauer

Im Normalfall reicht also die PIN. Kommt man aus dem Spiele-Tab, steht das gewählte Spiel im neuen Raum gleich bereit.

### Sichtbarkeit und Einlass

Zwei unabhängige Einstellungen, die der Host beim Erstellen und jederzeit im Raum ändern kann:

| Einstellung | Werte | Standard |
| --- | --- | --- |
| **Sichtbar für** | Alle · Gruppe · Niemand | Alle |
| **Einlass** | PIN · PIN und Anklopfen | PIN |

Die PIN bleibt in jedem Fall Pflicht. „Niemand“ heißt: Der Raum erscheint in keiner Liste, der Beitritt geht nur über Code bzw. Link und PIN. „Gruppe“ zeigt den Raum nur Mitgliedern der Gruppe, der der Host angehört.

### Anklopfen

1. Nach richtiger PIN sieht der Gast „Du klopfst an …“ mit der verbleibenden Wartezeit und „Abbrechen“. Ist gerade niemand im Raum verbunden, der öffnen könnte (etwa beim Ersteller selbst oder in einem leeren Dauerraum), reicht die PIN.
2. Der Host sieht „*Name* klopft an“ mit **Einlassen**, **Ablehnen** und **Moment**.
3. **Vertretung**, nur wenn vom Host wirklich keine Reaktion kommt:
   - Ist der Host nicht verbunden, dürfen alle im Raum sofort einlassen oder ablehnen.
   - Ist er verbunden, reagiert aber nicht, dürfen es nach 30 Sekunden alle im Raum.
   - Hat der Host die Anfrage gesehen und „Moment“ gewählt, gibt es keine Vertretung.
4. **Timeout:** Nach zwei Minuten ohne Entscheidung erhält der Gast „Gerade kann dich niemand hereinlassen. Versuch es später noch einmal.“
5. **Funklöcher:** Verliert der Gast kurz die Verbindung, bleibt sein Anklopfen 20 Sekunden stehen, die Wartezeit läuft weiter; wird er in dieser Zeit eingelassen, ist er beim Wiederverbinden direkt drin. Der Host gilt erst nach 15 Sekunden ohne Verbindung als weg – ein kurzes Funkloch übergibt die Entscheidung nicht an die anderen.

Abgelehnte Gäste können frühestens nach einer Minute erneut anklopfen. Wer einmal eingelassen wurde, kommt als Mitglied ohne erneutes Anklopfen zurück.

### Mitgliedschaft

Wer einmal in einem Raum war, ist Mitglied, solange der Raum offen ist und er ihn nicht über „Raum verlassen“ verlässt. Mitglieder sehen den Raum unter „Deine Räume“ und kehren ohne PIN zurück. Vom Host entfernte Spieler verlieren die Mitgliedschaft.

### Lebensdauer

Die Lebensdauer zählt ab dem Zeitpunkt, an dem der Raum leer ist:

| Wer | Optionen |
| --- | --- |
| **Host** | 1 Stunde (Standard) · 1 Tag · 1 Woche |
| **Admin** | Obergrenze für Hosts (Standard 1 Woche; Optionen darüber blendet die App aus), dazu **Dauerräume**, die nie ablaufen |

Dauerräume legt der Admin im Admin-Bereich an und verwaltet sie dort (Name, PIN, Sichtbarkeit, Einlass, Host-Rechte). Leere Räume verschwinden sofort aus „Offene Räume“, bleiben aber für ihre Mitglieder unter „Deine Räume“ sichtbar, bis sie ablaufen.

## 8. Spiele-, Gruppen- und Profil-Tab

### Spiele

Raster aller freigegebenen Spiele, nach Kategorie und Admin-Reihenfolge sortiert, hervorgehobene Spiele zuerst. Ein Tipp öffnet ein **Infoblatt** mit Kurzbeschreibung, Spielerzahl, Dauer und Regeln sowie den Knöpfen **Raum mit diesem Spiel öffnen** und, falls eingeschaltet, **Auf einem Handy spielen**. Spiele hinter einem Zugangscode tragen ein Schloss.

### Gruppe

Die bisherige Gruppenansicht, eingebettet in die Hülle: Bestenliste der aktiven Gruppe, Wechsel zwischen Gruppen, Erstellen und Beitreten.

### Profil

Die bisherige Profilansicht: Name, Avatar, Statistik, letzte Partien, Übertragung auf ein anderes Gerät, Datenexport und Löschen. Persönliche Einstellungen (hell/dunkel, Ton, Haptik, Bewegung) werden hier gebündelt.

## 9. Technische Umsetzung

### Server

| Thema | Umsetzung |
| --- | --- |
| **Raumverzeichnis** | Die vorhandene Raumübersicht in `SiteSettings` speichert je Raum zusätzlich eine Raumkarte (Name, Host, Spiel, Status, Avatare, Live-Zeichen, Sichtbarkeit) und die Gruppe des Hosts. `GameRoom` meldet sich bei wichtigen Änderungen sofort, wenn der Raum leer wird oder sich wieder belebt, sonst höchstens alle 30 Sekunden. |
| **Offene Räume** | `GET /api/rooms/open?groups=…` liefert belebte Räume, die für alle oder für eine der genannten Gruppen sichtbar sind, Gruppe zuerst. Die Gruppencodes kennt nur, wer Mitglied ist. |
| **Deine Räume** | `POST /api/rooms/mine` bekommt die gespeicherten Zugänge des Handys (Code, Spieler, Token); jeder Raum prüft den Token selbst. Ungültige Zugänge meldet der Server zurück, das Handy vergisst sie. Profil-IDs verlassen den Server nie. |
| **Raumeinstellungen** | Sichtbarkeit, Einlass, Lebensdauer und Raumname stehen als `access` im Raumzustand (`shared/platform/directory.ts`) und sind nur für den Host änderbar (`setAccess`). |
| **Anklopfen** | Zwischenstatus zwischen PIN-Prüfung und Beitritt; Antworten laufen über das WebSocket-Protokoll (`knock`). Fristen prüft der Raum bei jeder Nachricht, das Handy des Gasts gibt nach Ablauf zusätzlich selbst auf. |
| **Lebensdauer** | Der Alarm in `GameRoom` richtet sich nach der gewählten Dauer; ist beim Klingeln noch jemand da, verlängert er sich. Dauerräume setzen keinen Ablauf. |
| **Dauerräume** | `POST /api/admin/rooms/create` legt einen Raum mit Name, PIN, Sichtbarkeit und Einlass an, der nie abläuft. |

Bestehende Räume und Spielstände bleiben kompatibel: Alte Räume ohne `access` gelten als „Alle · PIN“ und laufen nach der Obergrenze des Admins ab.

### Client

| Thema | Umsetzung |
| --- | --- |
| **Hülle** | Neue Layout-Komponente mit Tab-Leiste; Routen `/`, `/spiele`, `/gruppe`, `/profil` werden zu Tabs. Raum, lokale Partie und Admin bleiben Vollbild-Routen. |
| **Begrüßung** | Eigene Komponente, die beim Start parallel Konfiguration, Raumliste und Gruppe lädt und frühestens nach der Animation, spätestens nach drei Sekunden übergibt. |
| **Aktualität** | Raumliste beim Öffnen und bei Rückkehr in die App neu laden, solange der Start-Tab sichtbar ist zusätzlich in kurzen Abständen. |
| **Installation** | Das Installationsereignis des Browsers abfangen und für den Knopf aufheben; im installierten Modus alle Installationshinweise ausblenden. |
| **Bewegung** | Alle Animationen respektieren „Bewegung reduzieren“. |

### Tests

Handy-Tests in Playwright decken ab: Tabs und Zurück-Geste, Erster Start mit und ohne Übertragungs-Code, Begrüßung überspringen, Raumliste mit Sichtbarkeiten, Anklopfen mit „Moment“, Ablehnen und Vertretung bei abwesendem Host, Dauerräume, Zuschauer bei laufender Partie. Die Regeln (Sichtbarkeit, Lebensdauer, wer einlassen darf) prüfen Unit-Tests in `tests/unit/directory.test.ts`.

## 10. Umsetzungsplan

Die Umsetzung erfolgte in fünf Schritten; alle sind umgesetzt und mit Handy-Tests abgedeckt (`shell`, `intro`, `rooms`, `roomlist`, `call`).

| Schritt | Inhalt |
| --- | --- |
| **1. Hülle** | Volle Breite, App-Gefühl, Tab-Leiste, Start-Tab mit den heutigen Inhalten, Spiele-Tab mit Infoblatt, Installation |
| **2. Erster Start und Begrüßung** | Willkommensablauf mit Profil-Übernahme und Rundgang, Begrüßungsanimation mit Laden |
| **3. Räume auf dem Server** | Raumverzeichnis, Sichtbarkeit, Einlass mit Anklopfen, Lebensdauer, Dauerräume im Admin |
| **4. Raumliste** | Deine Räume und offene Räume auf dem Start-Tab, Raumkarten, Beitritt als Zuschauer |
| **5. Ein Raumtyp** | Treffpunkt und Spielraum zusammenführen, Raum-Einstellungen für den Host |

## 11. Ausblick: native Apps für iOS und Android

Spieltisch ist als Progressive Web App gebaut und lässt sich schon heute auf dem Startbildschirm installieren. Eine Veröffentlichung in den App-Stores ist eine Option für später. Dieser Abschnitt bewertet die Wege grob.

### Wege im Vergleich

| Weg | Prinzip | Aufwand | Bewertung |
| --- | --- | --- | --- |
| **PWA (heute)** | Installation aus dem Browser | keiner | Kein Store-Eintrag. Auf iOS eingeschränkt: Installation nur über das Teilen-Menü, Push-Mitteilungen nur für installierte Apps. |
| **Trusted Web Activity** | Android-Hülle, die die PWA im Vollbild zeigt | gering | Schneller Weg in den Play Store. Nur Android, die App bleibt im Kern die Webseite. |
| **Capacitor** | Native Hülle mit eingebetteter Web-App für iOS und Android | mittel | **Empfohlen.** Die bestehende React-App läuft nahezu unverändert, native Funktionen kommen über Plugins dazu. |
| **React Native / Expo** | Neue native Oberfläche, Logik aus `shared/` wiederverwendet | hoch | Bestes natives Gefühl, aber alle Ansichten, Looks und die 3D-Würfel müssten neu gebaut werden. Erst sinnvoll, wenn die Hülle an Grenzen stößt. |

### Empfohlener Weg: Capacitor

Die Architektur kommt einer Hülle entgegen: Die Spiellogik liegt im Server und in `shared/`, die Oberfläche ist eine eigenständige React-App, und die Kommunikation läuft über HTTP und WebSocket an einen festen Server. Eine Capacitor-App würde die gebaute Oberfläche mitbringen und dieselbe API ansprechen.

Native Ergänzungen, die den Mehrwert gegenüber der PWA ausmachen:

- **Push-Mitteilungen:** „*Name* klopft an“, „Deine Runde hat begonnen“, „Du bist am Zug“. Das erfordert einen Push-Dienst auf dem Server (Apple Push Notification Service, Firebase Cloud Messaging) und eine Registrierung je Profil.
- **Direkte Links:** `https://…/r/CODE` öffnet die App statt des Browsers (Universal Links unter iOS, App Links unter Android).
- **Teilen und Kontakte:** Raum-Einladung über das System-Teilen-Menü.
- **Haptik, Bildschirm-wach-halten, Hintergrund-Audio** für den Sprachchat.
- **Kamera und Mikrofon** mit nativen Berechtigungsdialogen. WebRTC für Video und Sprache funktioniert in den eingebetteten Web-Ansichten beider Plattformen.

### Rahmenbedingungen

- **Konten bei den Stores:** Apple Developer Program (jährliche Gebühr) und Google Play Console (einmalige Gebühr). Für iOS-Builds wird ein Mac oder ein Cloud-Build-Dienst benötigt.
- **Prüfung durch Apple:** Reine Web-Hüllen werden abgelehnt. Die App muss erkennbar nativen Mehrwert bieten, etwa Push-Mitteilungen, direkte Links und Teilen. Außerdem braucht es eine Datenschutzerklärung und Angaben zur Datennutzung.
- **Konten in der App:** Wird später ein Konto eingeführt, verlangt Apple eine Löschfunktion in der App. Bei Anmeldung über Drittanbieter ist zusätzlich eine Anmeldung mit Apple-ID anzubieten.
- **Altersfreigabe:** Chat und Video mit Fremden erfordern Meldefunktionen und eine passende Altersstufe. Private Räume und Anklopfen sind dafür eine gute Grundlage.
- **Aktualisierung:** Die Oberfläche kann direkt mit der App ausgeliefert werden (Store-Update je Version) oder vom Server geladen werden (sofort aktuell, mit Rücksicht auf die Store-Richtlinien). Protokoll und Spielstände müssen dann mehrere App-Versionen gleichzeitig bedienen; die vorhandene Versionierung je Spiel ist dafür der Ansatz.
- **Kosten:** Push-Dienste sind im benötigten Umfang kostenlos, der Betrieb bleibt im Cloudflare-Gratistarif.

### Reihenfolge

1. Die PWA wie in diesem Konzept zur vollwertigen App ausbauen. Jede Verbesserung kommt später der nativen Hülle zugute.
2. Android über Trusted Web Activity oder Capacitor in den Play Store bringen, um Erfahrungen mit Store-Betrieb und Push zu sammeln.
3. iOS mit Capacitor und den nativen Ergänzungen veröffentlichen.
4. Nur bei klaren Grenzen der Hülle (Leistung, Gestik, Plattform-Funktionen) einzelne Ansichten nativ neu bauen.
