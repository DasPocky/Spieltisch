# Spieltisch – Struktur-Audit & Umbauvorschlag

## Umgesetzt (03.10.2026)

Entschieden und gebaut: **A1** (ein Menü, feste Abschnitte), **B2** (immer erst Lobby, dann Spiel – auch lokal), **C2** (Einstellungen in der Lobby als Zusammenfassung + Sheet).

- **Menü (☰)** – Abschnitte in fester Reihenfolge, leere fallen weg: **Partie** (Host: „Nochmal spielen“, „Anderes Spiel“, *ein* „Letzten Zug zurücknehmen“ – Kniffel/Tutto-Eintrag springt ein, wenn die Plattform nichts mehr zurücknehmen kann; Überspringen nur, wenn der Spieler am Zug offline ist oder sich 20 s nichts tut, sonst hinter „Hängt etwas?“; online „Host darf für alle spielen“ mit Erklärung; eingeklappt „Während des Spiels“ nur mit `inGame`-Optionen + „Spielhilfen erlauben“) · **Spieler & Verlauf** (gleiches Sheet wie die Leiste, für *alle* Spiele; Verlauf aus `log` bzw. neuem `GameUI.History` – Kniffel, Tutto inkl. Stapel, Werwolf, Codenames; Host: „Spieler verwalten“ eingeklappt) · **Regeln** · **Einladen** (nur online im Spiel) · **Mein Gerät** (Ansicht, hell/dunkel, Töne/Vibration/„Spielhilfen für mich“, Link „Mehr in ‚Mein Profil‘“ mit Rückweg ins Spiel) · **Verlassen** (online mit Rückfrage; Host abgesetzt „Raum schließen“ mit Rückfrage). Untertitel: „Du bist Host · Raum X“ / „Gast · Host ist Anna“ / „Ein Handy für alle“. Keine Einstellungsliste mehr im Menü.
- **Start**: „Ein Handy für alle“ öffnet sofort die lokale Lobby (`/lokal`, zuletzt lokal gewähltes Spiel vorbelegt), Spiel wird dort über dieselbe Karte + „Was spielt ihr?“-Sheet gewählt wie online. Spielraster auf der Startseite und Spielseite `/spiel/<id>` entfallen; `/spiel/<id>` und `/spiel/<id>/lokal` leiten in die lokale Lobby mit diesem Spiel (gespeicherte Partien laden weiter). Lobby-Kopf: „‹ Lobby · Ein Handy für alle / Raum X“, Zurück = Verlassen. Verlassen führt immer zur Startseite.
- **Lobby**: Spielkarte · (online: Raumcode, Gruppe) · Mitspieler · **eine** Zeile „Einstellungen – Echte Würfel · App-Karten · Spielziel 6.000 · 2 Hausregeln“ → Sheet mit vollem `SettingsPanel` und „Fertig“. Passt mit 6 Spielern auf 390×844, „Spiel starten“ bleibt unten. Host kann sich online nicht selbst entfernen.
- **Startseite**: ein Profil-Knopf (Avatar) oben rechts, Hell/Dunkel-Knopf und Fußzeilen-Profil entfernt; „Admin“ klein in der Fußzeile.
- **Begriffe**: „Nochmal spielen“, „Anderes Spiel“ (auch Ergebnis, Werwolf, Eine Nacht), „Raum schließen“ (Server-Meldung „Der Host hat den Raum geschlossen.“), „Mein Profil“, Raum-Schalter „Spielhilfen erlauben“ vs. Profil „Spielhilfen für mich“; Einstellungsgruppe „Raum“ heißt jetzt „Hilfen“ (lokal) bzw. „Mitspielen & Hilfen“ (online).

**Noch offen (für später):** Regeln vorab in der Spielauswahl (ⓘ je Spiel); Profil gliedern („Im Spiel“ + „Stimme“ → „Töne & Ansagen“, evtl. Tabs); Menü als Tabs (A2) bzw. eigener Spieler-Knopf (A3), falls Rückmeldungen das nahelegen; Sprachchat-Knopf erklären; spieleigene Ergebnis-Texte als Untertitel; Admin-Link ganz von der Startseite nehmen (bewusst noch drin).

---

> Anlass: „Die Menüs und die Struktur der gesamten App sind aktuell noch sehr verwirrend.“
> Grundlage: Durchklicken im Browser (390×844, de-DE, lokal + Online mit Host/Gast) am 02.10.2026 und Lesen von `App.tsx`, `useRoute.ts`, `pages/*`, `RoomScreen`, `MenuSheet`, `SettingsPanel`, `InfoBar`, `PlayerManager`, `Profile`.
> Screenshots: `/tmp/claude-0/-home-user-Spieltisch/70548aee-656d-55e8-aff1-822877694b49/scratchpad/ia/*.png` (Dateinamen unten in `code`). Sie liegen im temporären Scratchpad – bei Bedarf ins Repo kopieren.

---

## 1. Bestandsaufnahme

### 1.1 Bildschirme (Routen)

| Route | Bildschirm | Wie kommt man hin? | Screenshot |
|---|---|---|---|
| `/` | Start-Assistent „Wie spielt ihr?“ (3 Wege + Gruppenkarte + Fußzeile „Profil & Daten · Admin“) | Startseite | `01-home-erstbesuch`, `24-home-wiederkehrend-mit-gruppe` |
| `/` (Zustand) | Schritt „Spiel wählen – Ein Handy für alle“ (kein eigener URL-Pfad) | „Ein Handy für alle“ | `02-assistent-ein-handy-spielauswahl` |
| `/` (Zustand) | Schritt „Online-Raum erstellen“ (Name + PIN, Spiel erst danach) | „Online-Raum erstellen“ | `03-assistent-online-raum` |
| `/spiel/<id>` | **Spielseite** (Regeln, *nochmal* „Online-Raum erstellen“, „Nur auf diesem Gerät“) | **Nirgends verlinkt** – nur Direkt-URL oder als Ziel von „Spiel verlassen“ (lokal) | `06-spielseite-uno`, `16-nach-spiel-verlassen-lokal` |
| `/spiel/<id>/lokal` | Lokale Lobby → Spiel → Ergebnis | Spielauswahl „Ein Handy“ | `08`–`10`, `12b`, `20` |
| `/r/<code>` | Beitreten-Formular / Online-Lobby / Spiel / Fehler („gibt es nicht“, „beendet“) | Raum erstellen, Code eingeben, Link | `30`–`44`, `05-beitreten-raum-gibt-es-nicht` |
| `/profil` | „Profil & Einstellungen“ (Name, Statistik, Gruppen, Übertragen, Darstellung, Im Spiel, Stimme, Daten) | Personen-Icon oben rechts **und** Fußzeile „Profil & Daten“ | `21-profil-oben`, `21b-profil-ganz` |
| `/profil/uebernehmen/<code>` | Profil übernehmen (QR-Ziel) | QR/Link vom alten Handy | – |
| `/gruppe` | Gruppenliste, Gruppe erstellen/beitreten | Gruppenkarte Start, Profil | `22-gruppen-leer` |
| `/g/<code>` | Gruppe: Bestenliste, Mitglieder, Einladen, Verlassen | Gruppenkarte, Gruppenliste, Link | `23-gruppe-detail` |
| `/admin` | Admin (Freigaben, Räume, Standards, Statistik) | **Fußzeile der Startseite – für alle sichtbar** | `26-admin-login`, `27-admin` |

### 1.2 Funktionen und wo sie überall wohnen

Legende: **⚠ doppelt** · **🔀 uneinheitlicher Name** · **🙈 versteckt** · **⛔ Sackgasse**

| Funktion | Fundorte | Befund |
|---|---|---|
| **Raum erstellen (online)** | Start → „Online-Raum erstellen“ (`03`); Spielseite `/spiel/<id>` (`06`) | ⚠ zwei Formulare, zwei Texte („PIN für den Raum (4–8 Ziffern)“ vs. „PIN (4–8 Ziffern)“; „Du bist Host und wählst das Spiel“ vs. „Du bist automatisch Host“) |
| **Lokal spielen** | Start → „Ein Handy für alle“; Spielseite → „Nur auf diesem Gerät“ | 🔀 zwei Namen für dasselbe |
| **Spiel wählen** | Start-Kachelraster (lokal, `02`); Lobby-Sheet „Was spielt ihr?“ (online, öffnet automatisch, `30`); Lobby-Karte „Gespielt wird … Wechseln“ (beide) | 🔀 Raster vs. Liste, lokal vor der Lobby, online in der Lobby |
| **Regeln** | Spielseite-Knopf „Regeln“ (`07`); Menü „Regeln: Uno“ (`15`); ⓘ-Knopf im Spielbrett (`12b`, `17`) | ⚠ 3 Wege, im Lobby-Körper aber **keiner** 🙈 (nur im ☰) |
| **Einladen / Raumcode** | Lobby-Karte „Raumcode … Einladen“ (`31`); Menü (`35`, `40`); Gruppen-Karte „An Gruppe senden“ (nur mit Gruppe); Header zeigt Code klein | ⚠ ok für Lobby, im Spiel 🙈 nur im ☰. PIN steht nirgends im Raum – Host muss sie sich merken |
| **Einstellungen (Raum/Spiel)** | Lobby-Körper (`09b`, `31b`); Menü – identische komplette Liste (`11b`, `13a`, `35b`, `40`) | ⚠ 1:1 doppelt; im Spiel grau/gesperrt, nimmt aber den halben Menü-Platz ein |
| **„Spielhilfen“** | Profil → Im Spiel → „Spielhilfen“ (persönlich, `21b`); Einstellungen → Gruppe „Raum“ → „Spielhilfen erlauben“ (`13b`) | ⚠ 🔀 zwei Schalter, gleicher Name, verschiedene Wirkung |
| **Darstellung hell/dunkel** | Mond-Knopf Start (`01`); Menü 3-fach-Umschalter (`13`); Profil → Darstellung (`21b`) | ⚠ 3× |
| **Ansicht Einfach/Voll** | nur Menü, ganz oben (`13`) | 🙈 Begriff unklar („Große Tasten / Alle Infos“), steht im Menü an prominentester Stelle, obwohl selten gebraucht |
| **Ansagen / Vorlesen** | Profil → Im Spiel „„Wer ist dran?“ ansagen“; Profil → Stimme „Vorlesen“ (`21b`) | ⚠ 🔀 zwei Abschnitte für ein Thema |
| **Spieler (Liste, Reihenfolge, entfernen, hinzufügen)** | Lobby (`09`, `31`); Menü „Spieler“ (`13c`, `39c`); InfoBar-Sheet „Spieler & Verlauf“ (nur Stand, `14`); Spieler-Chips im Brett (`12b`) | ⚠ 3–4 Orte; im Spiel kann man lokal sogar Spieler hinzufügen (`13c`) |
| **Verlauf** | InfoBar „Spieler & Verlauf“ (`14`); Menü-Abschnitt „Verlauf“ (MenuExtras fast aller Spiele, `13b`) | ⚠ doppelt; bei Kniffel/Tutto/Werwolf **nur** im Menü (keine InfoBar, `17`) → uneinheitlich |
| **Zurücknehmen** | Menü „Letzten Zug zurücknehmen“ (Plattform); bei Kniffel/Tutto zusätzlich „Letzten Eintrag zurücknehmen“ (`17c`) | ⚠ 🔀 zwei Knöpfe direkt untereinander |
| **Neue Runde** | Menü „Neue Runde, gleiche Spieler“; Ergebnis „Neue Runde, gleiche Spieler“ bzw. spieleigen „Noch eine Nacht“ (`20`) | 🔀 |
| **Zurück zur Lobby** | Menü „Partie beenden – zur Lobby“ (rot); Ergebnis „Zur Lobby – anderes Spiel wählen“ | 🔀 |
| **Überspringen** | Menü „⏭ Zug von Anna überspringen (zieht 1)“ – immer sichtbar, auch wenn alle online sind; StuckBar nur bei offline | Wirkt bedrohlich/überflüssig im Normalfall (`13b`, `39b`) |
| **Spielleiter-Funktionen** | Menü-Checkbox nur online/Host (`39b`) | 🙈 Begriff unbekannt; nicht in der Lobby |
| **Host übernehmen** | StuckBar + Menü (nur wenn Host offline) | ok |
| **Verlassen** | Menü unten: „Spiel verlassen“ (lokal) / „Raum verlassen“ (online) + „Raum löschen“ (Host) | 🙈 ganz unten nach langer Scrollstrecke; lokale Lobby hat **keinen Zurück-Pfeil**; online „Raum verlassen“ ohne Rückfrage, Zugang ist danach weg |
| **Nach dem Verlassen (lokal)** | landet auf `/spiel/<id>` mit „Online-Raum erstellen“-Formular (`16`) | ⛔ unerwarteter Ort, nicht die Startseite/Spielauswahl |
| **Profil** | Personen-Icon oben rechts; Fußzeile „Profil & Daten“; Seitentitel „Profil & Einstellungen“ | 🔀 drei Namen, zwei Links nebeneinander |
| **Gruppe** | Start-Karte, Profil → Gruppen, Lobby-Chips „Aus Donnerstagsrunde“, Online-Lobby „An Gruppe senden“ | ok, aber „Gruppe“ vs. „Raum“ wird leicht verwechselt (beides „beitreten“ mit Code) |
| **Admin** | Fußzeile Startseite | 🙈→ zu sichtbar: Gäste sehen „Admin“ |
| **Sprachchat** | ☎-Knopf im Header (online, `41`) | ok, aber Icon „Telefon“ + Popover „Nur Sprache / Mit Video“ ohne Erklärung |

### 1.3 Querschnitts-Beobachtungen

- **Das ☰-Menü ist ein Sammelbecken**: In der Partie (Host, online) hat es ~6 Bildschirmhöhen (`39`–`39e`): Ansicht → Darstellung → Regeln → Raumcode → komplette Einstellungen (gesperrt) → Raum → Spielleiter → Zurücknehmen/Überspringen/Neue Runde/Beenden → Verlauf → Spieler → Verlassen/Löschen. Wichtiges (Verlassen, Neue Runde) liegt unten, Seltenes (Ansicht, Theme) oben.
- **Lobby = Menü**: In der Lobby zeigt das ☰ fast exakt denselben Inhalt wie die Seite darunter (`11b` vs. `09b`).
- **Menü-Untertitel** „Du leitest das Spiel und legst die Einstellungen fest.“ erklärt nichts über das Menü.
- **Spielname doppelt** in Lobby: Header „Uno“ + Karte „Gespielt wird Uno“ (`09b`).
- **Host kann sich selbst entfernen** (X neben „Anna (du) · Host“, `31b`).
- **„Raum“** bedeutet dreierlei: Online-Raum, Einstellungsgruppe „Raum“ (auch lokal, wo es keinen Raum gibt, `10`), „Raum löschen“.
- **„Runde / Partie / Spiel“** werden gemischt: „Neue Runde“ setzt die ganze *Partie* zurück, „Partie beenden“, „Spiel verlassen“, „Spiel starten“.
- **Ein-Handy-Weg vs. Online-Weg sind asymmetrisch**: lokal *erst Spiel, dann Lobby*; online *erst Name+PIN, dann Spiel in der Lobby*.

---

## 2. Top-10-Probleme (für eine lockere Spielerunde, schlimmstes zuerst)

1. **Das ☰-Menü ist zu lang und falsch sortiert.** Wer „Raus hier“ oder „Nochmal“ sucht, muss durch Ansicht, Theme, Regeln und eine komplette (gesperrte) Einstellungsliste scrollen. → `39`–`39e`, `13`–`13d`.
2. **Einstellungen stehen doppelt (Lobby + Menü) und im Spiel gesperrt im Weg.** Niemand weiß, wo „die“ Einstellungen sind; im Spiel sieht man graue Optionen, die man nicht ändern kann. → `09b` vs. `11b`, `40`.
3. **Zwei „Spielhilfen“-Schalter** (persönlich im Profil, Raum-weit in der Lobby) mit gleichem Namen – wer ihn ausschaltet, wundert sich, warum es weiter leuchtet (oder umgekehrt). → `21b`, `13b`.
4. **Sackgasse nach „Spiel verlassen“ (lokal):** man landet auf der unverlinkten Spielseite mit Online-Formular statt auf der Startseite/Spielauswahl. → `16`, `06`.
5. **Spieler & Verlauf an drei Orten, je Spiel anders**: InfoBar-Sheet (nur Uno, Mau-Mau, Skip-Bo …), Menü-„Verlauf“ (fast alle), Menü-„Spieler“ (alle), Chips im Brett. Bei Kniffel gibt es keine InfoBar, dafür Verlauf im Menü. → `14`, `13c`, `17`, `17c`.
6. **Doppelte Wege zum Raum-Erstellen mit unterschiedlicher Logik** (Start: Spiel kommt nachher; Spielseite: Spiel ist schon gewählt) und doppeltes „lokal spielen“ unter zwei Namen. → `03`, `06`.
7. **Host-Aktionen ohne Ordnung und mit Fachbegriffen**: „Spielleiter-Funktionen“, „Letzten Zug zurücknehmen“ + „Letzten Eintrag zurücknehmen“, „⏭ Zug von Anna überspringen (erstes freies Feld wird gestrichen)“ dauerhaft sichtbar. → `39b`, `17c`.
8. **Uneinheitliche Begriffe**: Runde/Partie/Spiel; „Raum“ als Einstellungsgruppe auch lokal; „Profil & Daten“ / „Profil & Einstellungen“ / Personen-Icon; „Neue Runde, gleiche Spieler“ vs. „Noch eine Nacht“; „Partie beenden – zur Lobby“ vs. „Zur Lobby – anderes Spiel wählen“. → `20`, `10`, `21`.
9. **Verlassen ist versteckt und unsicher**: kein Zurück in der lokalen Lobby (`09`), „Raum verlassen“ ganz unten und ohne Rückfrage (Gast verliert Zugang, `43`); „Raum löschen“ direkt darunter.
10. **Startseite zeigt Dinge, die eine Spielrunde nicht braucht**: „Admin“-Link für alle, Profil doppelt (Icon + Fußzeile), Theme-Knopf; dafür ist „Regeln ansehen / Spiele entdecken“ ohne Lobby nicht erreichbar. → `01`, `24`.

---

## 3. Vorschlag

### 3.1 Zielstruktur (Navigationskarte)

```
Start  /
├─ [Ein Handy für alle] → Spiel wählen → Lobby (lokal) → Spiel → Ergebnis
├─ [Online spielen]     → Name + PIN   → Lobby (online, Spiel wählen) → Spiel → Ergebnis
├─ [Raum beitreten]     → Code → Name + PIN → Lobby (Gast) → Spiel
├─ Meine Gruppe (Karte)  → /g/<code>
└─ Kopf: (Profil-Avatar)  → /profil  („Mein Profil“: Name, Statistik, Gruppen, Einstellungen, Daten)

Admin: nur über /admin (kein Link auf der Startseite)
/spiel/<id>: entfällt als eigener Schritt (Weiterleitung auf lokale Lobby bzw. Start)
```

Regeln für alle Bildschirme im Raum (Lobby **und** Spiel):

- **Header immer gleich:** `‹ Zurück/Verlassen` · Spielname (+ Raumcode online) · [Spielstatus-Chip] · [☎] · [☰]
- **Ergebnis-Bildschirm**: immer dieselben zwei Knöpfe „Nochmal spielen“ (primär) und „Anderes Spiel“ (sekundär) – spieleigene Texte nur als Untertitel.

### 3.2 Ein einheitliches Menü (☰) mit festen Abschnitten

Reihenfolge nach Häufigkeit, nicht nach Technik. Leere Abschnitte fallen weg.

| # | Abschnitt | Inhalt | Wer |
|---|---|---|---|
| 1 | **Partie** | Nochmal spielen · Anderes Spiel (zur Lobby) · Rückgängig (ein Knopf, Spiel entscheidet ob „Zug“ oder „Eintrag“) · *Überspringen nur, wenn jemand offline/hängt* | Host (lokal: alle) |
| 2 | **Spieler & Verlauf** | Tabelle + Verlauf (= heutige InfoBar-Inhalte; Verlauf aus MenuExtras hierher) · Spieler umsortieren/entfernen nur in der Lobby | alle |
| 3 | **Regeln** | eine Zeile „Regeln: Uno ›“ | alle |
| 4 | **Einladen** (online) | Raumcode, Link teilen, PIN-Hinweis | alle |
| 5 | **Raum-Einstellungen** | *Im Spiel*: nur die `inGame`-Optionen + Zusammenfassung „3 Hausregeln aktiv“. *In der Lobby*: entfällt (steht ja auf der Seite) | Host ändert, Gäste lesen |
| 6 | **Mein Gerät** | Ansicht Einfach/Voll · Hell/Dunkel · Töne/Vibration/Vorlesen (Kurzschalter, Rest → Profil) | jeder für sich |
| 7 | **Verlassen** | „Raum verlassen“ (mit Rückfrage) · Host: „Raum schließen“ (rot, mit Rückfrage) | – |

InfoBar bleibt als *Abkürzung* zu Abschnitt 2 (gleiche Inhalte, gleicher Name „Spieler & Verlauf“), und zwar bei **allen** Spielen mit Verlauf.

### 3.3 Wo Einstellungen leben

| Ebene | Was | Ort |
|---|---|---|
| **Raum / Partie** (gilt für alle, Host entscheidet) | Spielregeln, Hausregeln, Ablauf, „Spielhilfen im Raum erlauben“, „Wer tippt für wen“, Spielleiter-Modus | **Lobby** (einzige Bearbeitungsstelle). Im Spiel: nur `inGame`-Optionen im Menü |
| **Persönlich / dieses Handy** | Hell/Dunkel, Ansicht, Töne, Vibration, Vorlesen & Stimme, „Hilfen für mich anzeigen“ | **Profil → Einstellungen**; Kurzschalter im Menü-Abschnitt „Mein Gerät“ |
| **Seite** | Freigaben, Standards | **Admin** |

„Spielhilfen“ umbenennen: Raum = **„Hilfen erlauben“** (Host), persönlich = **„Hilfen für mich anzeigen“** (grau + Hinweis, wenn der Raum sie verbietet).
Profil-Abschnitte „Im Spiel“ + „Stimme“ zu **„Töne & Ansagen“** zusammenlegen.

### 3.4 Namenskonventionen

| Begriff | Bedeutung | Ersetzt |
|---|---|---|
| **Raum** | nur der Online-Raum (Code + PIN) | Einstellungsgruppe „Raum“ → „Mitspielen & Hilfen“ (lokal: „Hilfen“) |
| **Partie** | ein Durchgang von Start bis Sieger | „Neue Runde“ (bei Rücksetzen) → **„Nochmal spielen“** |
| **Runde** | nur die spielinterne Runde (Kniffel 1/13, Uno-Runde) | – |
| **Lobby** | Vorbereitungsbildschirm | „Zur Lobby – anderes Spiel wählen“ / „Partie beenden – zur Lobby“ → **„Anderes Spiel“** |
| **Host** | Ersteller/Leiter des Raums | „Spielleiter-Funktionen“ → **„Host darf für alle spielen“** (mit Erklärung) |
| **Verlassen / Schließen** | Ich gehe / Raum endet für alle | „Raum löschen“ → **„Raum schließen“** |
| **Profil** | alles Persönliche | „Profil & Daten“, „Profil & Einstellungen“ → **„Mein Profil“** |
| **Ein Handy** / **Online** | die zwei Spielweisen | „Nur auf diesem Gerät“ → **„Ein Handy für alle“** |

### 3.5 Optionen, wo es Geschmackssache ist

**A) Wie soll das Menü aufgebaut sein?**

| Option | Beschreibung | Pro | Contra |
|---|---|---|---|
| **A1 Ein Menü, feste Abschnitte** (oben 3.2) | ein Sheet, kurze Abschnitte mit Überschriften, Einstellungen nur als `inGame`-Rest | wenig Umbau, alles an einer Stelle | bleibt ein Scroll-Sheet, für Host länger als für Gäste |
| **A2 Menü mit Tabs** | Sheet mit 3 Tabs: **Partie · Spieler · Ich** (Regeln/Einladen als Knöpfe im Kopf des Sheets) | jeder Tab passt auf einen Bildschirm, klare Trennung Raum vs. persönlich | Tabs auf dem Handy etwas versteckter; mehr Umbau |
| **A3 Zwei Knöpfe statt einem** | Header: [👥 Spieler] öffnet „Spieler & Verlauf“, [☰] nur Partie/Regeln/Einladen/Ich/Verlassen; InfoBar entfällt | spart die InfoBar-Zeile im Spiel, „Spieler“ ist sofort sichtbar | ein Header-Knopf mehr (bei HeaderExtra + ☎ eng auf 320 px) |

*Empfehlung:* A1 als Schritt 1, später A2 wenn das Menü weiter wächst.

**B) Wie startet man?**

| Option | Beschreibung | Pro | Contra |
|---|---|---|---|
| **B1 Weg zuerst** (heute, aufgeräumt) | Start: Ein Handy · Online · Beitreten; Spiel wird lokal vorher, online in der Lobby gewählt | bekannt, kein Umlernen | Asymmetrie lokal/online bleibt |
| **B2 Weg zuerst, Spiel immer in der Lobby** | auch lokal sofort in eine Lobby mit „Was spielt ihr?“-Sheet (wie online, `30`) | beide Wege identisch, Spielseite überflüssig | lokal ein Tipp mehr; Spielstand pro Spiel muss weiter funktionieren |
| **B3 Spiel zuerst** | Start = Spieleraster; Tipp auf Spiel → Sheet „Ein Handy / Online-Raum“; „Raum beitreten“ als Leiste oben | Spiele sind sofort sichtbar (Stöbern, Regeln vorab) | Online-Gruppen, die das Spiel später wechseln, denken eher in „Raum“; Beitreten rückt nach hinten |

*Empfehlung:* B2 (eine Lobby-Logik für alles). B3 nur, wenn viele Einzelne „stöbern“ statt Gruppen spielen.

**C) Einstellungen in der Lobby**

| Option | Pro | Contra |
|---|---|---|
| **C1 Alles auf der Lobby-Seite** (heute, aber nur noch dort) | sichtbar, nichts zu suchen | lange Lobby, „Spiel starten“ verdeckt Inhalte (`09b`, `31b`) |
| **C2 Zusammenfassung + Sheet** – Karte „Einstellungen: Bis 500 · 2 Hausregeln ›“ öffnet ein Sheet | Lobby passt auf einen Bildschirm (Spiel, Einladen, Spieler, Start) | ein Tipp mehr für den Host; Gäste sehen Details nur auf Tipp |

*Empfehlung:* C2 – die Lobby ist für Gäste vor allem „Wer ist da? Wann geht’s los?“.

---

## 4. Umsetzung in Schritten

### Schritt 1 – Schnelle Erfolge (nur Platzierung/Text, keine neue Logik)

1. **Menü umsortieren** (A1): Partie-Aktionen nach oben, Verlassen direkt darunter sichtbar; Ansicht + Theme in einen kompakten Abschnitt „Mein Gerät“ ans Ende. `MenuSheet.tsx`
2. **SettingsPanel im Menü** nur im Spiel und nur mit `inGame`-Optionen; in der Lobby ganz raus aus dem Menü. `MenuSheet.tsx`
3. **„Spiel verlassen“ lokal → `/`** (oder Spielauswahl) statt `/spiel/<id>`. `LocalGame.tsx`
4. **Admin-Link von der Startseite entfernen**; Profil nur noch über Avatar oben rechts (Fußzeile weg); Mond-Knopf weg (steht im Profil). `Home.tsx`
5. **Begriffe vereinheitlichen** (Tabelle 3.4): „Nochmal spielen“, „Anderes Spiel“, „Raum schließen“, „Mein Profil“, „Ein Handy für alle“; „Spielhilfen“ → „Hilfen erlauben“ (Raum) / „Hilfen für mich anzeigen“ (Profil). `ResultScreen.tsx`, `MenuSheet.tsx`, `SettingsPanel.tsx`, `Profile.tsx`, `GamePage.tsx`
6. **Einstellungsgruppe „Raum“ umbenennen** (lokal: „Hilfen“), damit „Raum“ nur noch Online-Raum heißt. `SettingsPanel.tsx`
7. **Überspringen** nur zeigen, wenn der Spieler am Zug offline ist bzw. nach X Sekunden Inaktivität (lokal: unter „Mehr“). `MenuSheet.tsx`
8. **Rückfrage bei „Raum verlassen“** (Gast: „Du brauchst dann wieder Code und PIN“). Host kann sich nicht selbst entfernen. `MenuSheet.tsx`, `PlayerManager.tsx`
9. **Zurück-Pfeil im Raum-Header** (Lobby), der dasselbe tut wie „Verlassen“. `RoomScreen.tsx`
10. **Menü-Untertitel** ersetzen durch Rolle + Raum: „Du bist Host · Raum 9WTFA“ / „Gast · Host ist Anna“.

### Schritt 2 – Größere Umbauten

1. **Verlauf vereinheitlichen**: alle MenuExtras-„Verlauf“-Abschnitte über `ui.log` liefern → ein Abschnitt „Spieler & Verlauf“ (Menü + InfoBar), für alle Spiele gleich (auch Kniffel/Tutto/Werwolf). Spieleigene Extras (Codenames-Team, Tutto-Mischen) in den Abschnitt „Partie“.
2. **Ein Rückgängig-Knopf**: Plattform-Undo und spieleigenes „Letzten Eintrag zurücknehmen“ zusammenführen.
3. **Spielseite `/spiel/<id>` abschaffen** bzw. auf die lokale Lobby umleiten; Online-Erstellen nur noch über Start (B1/B2). Regeln vorab: in der Spielauswahl langer Druck / ⓘ an jeder Kachel.
4. **Lobby verdichten** (C2): Karte „Gespielt wird“ + Einladen + Spieler + Einstellungs-Zusammenfassung → Sheet; Regeln-Knopf direkt neben „Gespielt wird“.
5. **Lokal = Online-Logik** (B2): auch lokal erst Lobby, dann „Was spielt ihr?“.
6. **Profil gliedern**: „Ich“ (Name, Avatar, Statistik) · „Gruppen“ · „Einstellungen“ (Darstellung, Töne & Ansagen, Hilfen) · „Handy wechseln & Daten“. Optional als Tabs.
7. **Optional A2/A3** (Menü-Tabs oder eigener Spieler-Knopf), wenn Rückmeldungen nach Schritt 1 noch Verwirrung zeigen.

---

## Anhang: Screenshot-Liste

`01-home-erstbesuch` · `02-assistent-ein-handy-spielauswahl` · `03-assistent-online-raum` · `04-home-beitreten-code` · `05-beitreten-raum-gibt-es-nicht` · `06-spielseite-uno` · `07-regeln-sheet-spielseite` · `08-lokal-lobby-leer` · `09-lokal-lobby-spieler` · `09b-lokal-lobby-ganz` · `10-lokal-lobby-einstellungen-offen` · `11-lokal-lobby-menue` · `11b-lokal-lobby-menue-ganz` · `12-lokal-uno-im-spiel` · `12b-lokal-uno-hand` · `13…13d-ingame-menue-*` · `14-infobar-spieler-verlauf` · `15-regeln-aus-menue` · `16-nach-spiel-verlassen-lokal` · `17-kniffel-lokal-header` · `17b/17c-kniffel-menue*` · `18-einenacht-lobby` · `19-einenacht-tag-header` · `20/20b-ergebnis-*` · `21/21b-profil-*` · `22-gruppen-leer` · `23-gruppe-detail` · `24-home-wiederkehrend-mit-gruppe` · `25-lokal-lobby-mit-gruppe` · `26-admin-login` · `27-admin` · `30-online-host-spielwahl-sheet` · `31/31b-online-lobby-host*` · `32-gast-beitreten-formular` · `33/33b-online-lobby-gast*` · `34-online-lobby-host-einstellungen` · `35/35b-online-lobby-menue-host*` · `36-online-lobby-menue-gast` · `37-online-im-spiel-host` · `38-online-im-spiel-gast` · `39…39e-online-ingame-menue-host-*` · `40…40d-online-ingame-menue-gast-*` · `41-anruf-knopf-gast` · `43-gast-nach-raum-verlassen` · `44-host-nachdem-gast-weg`
