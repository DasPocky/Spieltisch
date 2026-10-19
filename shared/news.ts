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
