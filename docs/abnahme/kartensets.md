# Abnahmeblatt Eigene Kartensets

Nach der Vorlage [Mau-Mau](maumau.md). Stand: 23.10.2026. Betrifft Schamlos, Decknamen, Zeichnen & Raten und Quiz; Rollen: Ersteller (Profil), Host, Gast, Fernseher, Verwaltung.

| Punkt | Nachweis |
| --- | --- |
| Prüfung der Inhalte: Name, Lücken, höchstens 300, Doppelte, Unicode, gültige Fragen, nur gültige Bildschlüssel | `tests/unit/cardsets.test.ts` |
| Spiele mit eigenen, gemischten und zu wenigen Inhalten; „Nur eigene“ erst ab genug | `tests/unit/cardsets.test.ts`, `tests/e2e/kartensets.spec.ts` |
| Geheimhaltung: Inhalte nie in der Raumsicht, Listen eigener Karten/Begriffe/Fragen nicht bei Spielern | `tests/unit/cardsets.test.ts` |
| Rechte: fremdes privates Set weder lesen, ändern, löschen noch vorschlagen – auch nicht mit fremder ID und eigenem Schlüssel | `tests/e2e/kartensets.spec.ts` („Rechte und Grenzen“) |
| Bilder: nur eigene Bildschlüssel, zu groß → 413 vor dem Einlesen, kein Bild → 400, `nosniff` und echter Bildtyp | `tests/e2e/kartensets.spec.ts` |
| Anfragen begrenzt gelesen (auch ohne Content-Length) | `tests/unit/cardsets.test.ts` („Anfragen“) |
| Ablauf: anlegen → vorschlagen → Verwaltung gibt frei → öffentlich ohne Ersteller → Raum → Spiel | `tests/e2e/kartensets.spec.ts` |
| Gelöschtes Set im Raum: Host bekommt Hinweis, Spiel startet mit dem Rest | `tests/e2e/kartensets.spec.ts` |
| Ein Handy für alle, Start ohne Netz | `tests/e2e/kartensets.spec.ts` („Quiz mit eigenen Fragen“) |
| Bildkarten auf dem Brett und am Tisch (3D) | `tests/e2e/kartensets.spec.ts`, `tests/e2e/table.spec.ts` („eigenen Bildkarten“) |
| Quiz nie leer (alle Kategorien abgewählt) | `tests/unit/cardsets.test.ts`, `tests/e2e/kartensets.spec.ts` |

**Bewusste Grenzen (dokumentiert, nicht behoben):** Bildkarten sind nur durch die nicht erratbare Adresse geschützt (wer sie kennt, z. B. ein Mitspieler, kann sie laden). Hochgeladene, aber nie gespeicherte Bilder bleiben in R2 liegen. Ändert ein Ersteller ein Bild, während eine Partie es zeigt, fehlt es dort ab dann.

**Entschieden (23.10.2026):** Name des Erstellers öffentlich nur mit Häkchen „Meinen Namen zeigen“, sonst „Community-Set“ · jedes Gerät darf Sets anlegen (Profil mit Geräteschlüssel entsteht automatisch), die Verwaltung kann eigene Kartensets unter Einstellungen → Funktionen abschalten (gespeicherte Sets bleiben erhalten) – Nachweis: `tests/e2e/kartensets.spec.ts` („Name des Erstellers“, „abschalten“).

**Noch nicht auf echten Geräten geprüft:** iPhone/Android (Bild-Auswahl, Verkleinern), Fernseher.
