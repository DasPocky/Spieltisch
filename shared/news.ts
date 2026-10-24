/**
 * „Was ist neu?“ – kurze Neuigkeiten für Spieler, neueste zuerst.
 * Jeder PR mit sichtbaren Änderungen trägt hier einen Eintrag ein (derselbe Text steht im PR unter „Für Spieler“).
 * Im Admin lassen sich Einträge ändern oder ausblenden, ohne neu zu bauen.
 */
export interface NewsEntry {
  /** eindeutig und stabil, z. B. „2026-10-update“ */
  id: string;
  /** Datum (JJJJ-MM-TT) */
  date: string;
  title: string;
  /** je Punkt ein kurzer Satz */
  items: string[];
}

export const NEWS: NewsEntry[] = [
  {
    id: "2026-10-kritzelpost",
    date: "2026-10-23",
    title: "Neues Partyspiel: Kritzelpost",
    items: [
      "Stille Post mit Bildern: Jeder schreibt einen Satz, der Nächste zeichnet ihn, der Übernächste beschreibt die Zeichnung – am Ende blättert ihr gemeinsam durchs Album.",
      "Man sieht immer nur die Seite davor. Mit Uhr je Schritt und Modus „Eisbrecher“: alle beginnen mit demselben Satz.",
    ],
  },
  {
    id: "2026-10-dame-international",
    date: "2026-10-23",
    title: "Dame 10 × 10 nach internationalen Regeln",
    items: ["Auf dem großen Brett gilt jetzt der Mehrheitsschlag: Wer schlagen kann, muss so viele Steine schlagen wie möglich."],
  },
  {
    id: "2026-10-regelpakete",
    date: "2026-10-23",
    title: "Regeln mit einem Tipp",
    items: [
      "In den Einstellungen steht oben „Regeln“: Standard wie im Original oder ein Paket wie „Kurz“ – bei Eins!, Alles oder nichts, Mau-Mau, Ludo und Dame.",
      "Wer einzelne Hausregeln ändert, sieht „Eigene“ mit der Zahl der Änderungen. „Standard“ bringt alles zurück.",
    ],
  },
  {
    id: "2026-10-auswahl-suche",
    date: "2026-10-23",
    title: "Spiele schneller finden, Partyabend in zwei Schritten",
    items: [
      "In der Spielauswahl gibt es eine Suche – Umlaute sind egal. „Für 3“ zeigt nur Spiele, die zu eurer Runde passen.",
      "Partyabend: erst Spiele wählen, dann die Reihenfolge mit Pfeilen festlegen. Mit Gesamtdauer und Hinweis, wenn ein Spiel mehr Spieler braucht.",
    ],
  },
  {
    id: "2026-10-start-klarer",
    date: "2026-10-23",
    title: "Startseite klarer: veranstalten, mitspielen, Fernseher",
    items: [
      "„Raum veranstalten“ fragt, was ihr vorhabt: ein Spiel, ein Partyabend oder erst mal treffen – es bleibt immer derselbe Raum.",
      "„Mitspielen“ mit Code und „Fernseher“ stehen direkt darunter; der Fernseher zeigt den Tisch, gespielt wird am Handy.",
    ],
  },
  {
    id: "2026-10-kartensets",
    date: "2026-10-23",
    title: "Neu: eigene Kartensets",
    items: [
      "Im Profil unter „Meine Kartensets“ eigene Karten, Wörter, Begriffe und Fragen anlegen – für Schamlos, Decknamen, Zeichnen & Raten und das Quiz, auch mit Bildern.",
      "In der Lobby unter Einstellungen wählen; mit genug eigenen Karten auch „Nur eigene“. Sets bleiben privat, bis ihr sie für alle vorschlagt und die Verwaltung sie freigibt.",
    ],
  },
  {
    id: "2026-10-quiz",
    date: "2026-10-20",
    title: "Neu: Quiz & Schätzen",
    items: [
      "Alle beantworten dieselbe Frage am eigenen Handy: Auswahl, Schätzen oder in die richtige Reihenfolge bringen.",
      "Über 1.100 eigene Fragen in acht Kategorien, jede mit Quelle – dazu ein Kinderquiz. Der Fernseher zeigt Frage, Uhr und Auflösung.",
    ],
  },
  {
    id: "2026-10-zeichnen",
    date: "2026-10-20",
    title: "Neu: Zeichnen & Raten",
    items: [
      "Einer malt am Handy, alle anderen raten – laut rufen oder ins Handy tippen (kleine Tippfehler zählen, „ganz nah dran!“ sieht nur, wer getippt hat).",
      "Drei Begriffe zur Wahl, von Kinder bis Ab 18. Online, an einem Handy und am Fernseher.",
    ],
  },
  {
    id: "2026-10-fernseher",
    date: "2026-10-20",
    title: "Der Fernseher zeigt nur noch den Tisch",
    items: [
      "Keine Knöpfe mehr am Rand: der Fernseher zeigt den Tisch und den QR-Code zum Mitspielen.",
      "Der Gastgeber steuert alles vom Handy aus (Menü → Großer Tisch): Ton, Moderator, Videos, Ansicht.",
      "Am Tisch stehen Namenskarten an jedem Platz, auf „hoch“ mit weichen Schatten.",
      "Alle Spiele liegen jetzt am Fernseher auf dem Tisch – auch Dame, Mühle, Ludo, Werwolf, Spion, Stirnraten und die Kartenspiele.",
      "Die echte Stimme klingt munterer und spricht Namen richtig aus.",
    ],
  },
  {
    id: "2026-10-stimme",
    date: "2026-10-20",
    title: "Eine echte Stimme",
    items: [
      "Ansagen spricht jetzt ein echter Sprecher statt der Handystimme – mit Stimmung: fröhlich, frech, grimmig und nachts im Werwolf flüsternd.",
      "Neue Namen lernt er von selbst dazu, meist in unter einer Stunde.",
      "Im Profil unter „Stimme“ lässt sich auf die Stimme des Geräts zurückschalten.",
    ],
  },
  {
    id: "2026-10-stirnraten",
    date: "2026-10-20",
    title: "Neu: Stirnraten",
    items: [
      "Handy an die Stirn, die anderen erklären – nicken heißt erraten, nach hinten kippen heißt weiter.",
      "Vier Varianten: klassisch, in Teams, mit tickender Bombe oder mit einem Hochstapler, der den Begriff nicht kennt.",
      "Über 3.500 Begriffe in 59 Kategorien – von Kinderliedern zum Summen bis „Ab 18“ – und eure eigenen.",
      "Auf Wunsch filmt das Handy die Erklärenden; das Video bleibt nur bei dir.",
    ],
  },
  {
    id: "2026-10-partyabend",
    date: "2026-10-19",
    title: "Partyabend, Bühne und Kartenspiele am Rechner",
    items: [
      "Partyabend: Der Host plant mehrere Spiele hintereinander – der Fernseher zeigt den Zwischenstand und am Ende das Siegerpodest.",
      "Mau-Mau und Eins! am Rechner sind fertig: Tisch aus deiner Sicht, Karten darunter, alles auch per Tastatur.",
      "Mit gekoppeltem Handy bleiben deine Karten auf Wunsch nur dort – der Rechner zeigt allen nur den Tisch.",
      "Am großen Bildschirm: Wer die Kamera anhat, ist an seinem Platz zu sehen – und das Sofa kann per Kamera mitspielen.",
      "Ohne Handy dabei? Der Bildschirm macht ein Foto für deinen Platz.",
      "Neu zum Ausprobieren: die Bühne – ein Showstudio mit Pulten und Scheinwerfern statt des Tischs.",
      "Einige Spiele haben eigene Namen bekommen – gleiche Regeln, gleiche Statistik: Eins!, Stapelbau, Zehn Phasen, Himmelskarten, Glückssieben, Decknamen, Fünf Würfel und Alles oder nichts.",
    ],
  },
  {
    id: "2026-10-updates",
    date: "2026-10-18",
    title: "Updates ohne Unterbrechung",
    items: [
      "Neue Versionen kommen jetzt leise: Die App lädt an einem ruhigen Moment neu und ihr landet wieder im selben Raum.",
      "Laufende Partien spielen nach einem Update mit ihrer Version zu Ende.",
      "Dein Profil gehört jetzt fest zu deinem Handy – aufs neue Handy kommt es wie gewohnt mit „Code zum Übertragen“.",
      "Der große Bildschirm zeigt keinen Chat mehr – den sieht im Wohnzimmer ja jeder.",
      "Hier steht ab jetzt kurz, was neu ist.",
    ],
  },
  {
    id: "2026-10-schamlos",
    date: "2026-10-17",
    title: "Neu: Schamlos",
    items: [
      "Lückensätze frech füllen – reihum kürt der Zar die beste Antwort.",
      "Acht Kartensets zum Mischen, auf Deutsch und Englisch – von frech bis rabenschwarz.",
      "Am großen Tisch liegen echte Karten in 3D.",
    ],
  },
];

/** Änderungen aus dem Admin: ausgeblendete Einträge und geänderte Texte */
export interface NewsOverrides {
  hidden: string[];
  edits: Record<string, { title: string; items: string[] }>;
}

export const EMPTY_NEWS: NewsOverrides = { hidden: [], edits: {} };
export const MAX_NEWS_TITLE = 80;
export const MAX_NEWS_ITEM = 240;

export function sanitizeNews(x: unknown): NewsOverrides {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const known = new Set(NEWS.map((n) => n.id));
  const hidden = Array.isArray(o.hidden) ? [...new Set(o.hidden.filter((id): id is string => typeof id === "string" && known.has(id)))] : [];
  const edits: NewsOverrides["edits"] = {};
  const e = (o.edits && typeof o.edits === "object" ? o.edits : {}) as Record<string, unknown>;
  for (const [id, raw] of Object.entries(e)) {
    if (!known.has(id) || !raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim().slice(0, MAX_NEWS_TITLE) : "";
    const items = Array.isArray(r.items) ? r.items.filter((i): i is string => typeof i === "string").map((i) => i.trim().slice(0, MAX_NEWS_ITEM)).filter(Boolean).slice(0, 8) : [];
    if (title && items.length) edits[id] = { title, items };
  }
  return { hidden, edits };
}

/** Sichtbare Neuigkeiten mit den Änderungen aus dem Admin, neueste zuerst */
export function newsFor(o: NewsOverrides | undefined): NewsEntry[] {
  return NEWS.filter((n) => !o?.hidden.includes(n.id)).map((n) => ({ ...n, ...o?.edits[n.id] }));
}
