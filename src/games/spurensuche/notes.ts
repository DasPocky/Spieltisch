/**
 * Notizblock für das echte Brettspiel: Karten untereinander, je Mitspieler eine Spalte.
 * Reine Funktionen (testbar) – die Oberfläche speichert alles nur auf diesem Gerät.
 *
 * Zeichen: „x“ hat die Karte nicht, „y“ hat sie, „q“ Vermutung, „“ leer.
 * Automatisch (aus eigenen Karten und eingetragenen Verdachten) gilt vor Handeintrag.
 */
import { ROOMS, SUSPECTS, WEAPONS } from "@shared/games/spurensuche/logic";

export type Mark = "" | "x" | "y" | "q";
export type Group = "s" | "w" | "r";
export interface NoteCard { id: string; group: Group; name: string }
export interface Entry {
  id: string;
  /** wer verdächtigt hat */
  by: string;
  /** die drei genannten Karten (Kennungen aus der Kartenliste) */
  cards: string[];
  /** wer nichts zeigen konnte */
  passed: string[];
  /** wer gezeigt hat – null: niemand */
  shower: string | null;
  /** welche Karte (nur bekannt, wenn sie mir gezeigt wurde) */
  shown: string | null;
}
export interface Notes {
  /** wer ich bin (Spalte) */
  self: string | null;
  /** meine Karten */
  mine: string[];
  /** Handeinträge: Karte → Spieler → Zeichen */
  marks: Record<string, Record<string, Mark>>;
  log: Entry[];
  /** freie eigene Notizen */
  text?: string;
}
export const emptyNotes = (self: string | null): Notes => ({ self, mine: [], marks: {}, log: [] });

/** Karten der App als Vorgabe – auf dem Gerät umbenennbar (z. B. wie in der eigenen Schachtel) */
export const DEFAULT_CARDS: NoteCard[] = [
  ...SUSPECTS.map((x) => ({ id: `s:${x.id}`, group: "s" as const, name: x.name })),
  ...WEAPONS.map((x) => ({ id: `w:${x.id}`, group: "w" as const, name: x.name })),
  ...ROOMS.map((x) => ({ id: `r:${x.id}`, group: "r" as const, name: x.name })),
];
export const GROUP_TITLE: Record<Group, string> = { s: "Wer?", w: "Womit?", r: "Wo?" };

/**
 * Was sicher folgt: eigene Karten (alle anderen hat man nicht), wer eine Karte hat, hat sie allein,
 * wer bei einem Verdacht nichts zeigen konnte, hat keine der drei, wer gezeigt hat und zwei sicher nicht hat,
 * hat die dritte. Ergebnis: Karte → Spieler → „x“ oder „y“.
 */
export function infer(notes: Notes, cards: NoteCard[], players: string[]): Record<string, Record<string, Mark>> {
  const auto: Record<string, Record<string, Mark>> = {};
  const set = (c: string, p: string, m: Mark) => {
    const row = (auto[c] ??= {});
    if (row[p] === m) return false;
    if (row[p] === "y" || row[p] === "x") return false; // bereits sicher (Widerspruch ignorieren)
    row[p] = m;
    return true;
  };
  const ids = cards.map((c) => c.id);
  // Erst wenn die eigenen Karten eingetragen sind – sonst stünde überall ✗
  if (notes.self && notes.mine.length) for (const c of ids) set(c, notes.self, notes.mine.includes(c) ? "y" : "x");
  for (const e of notes.log) {
    for (const p of e.passed) for (const c of e.cards) set(c, p, "x");
    if (e.shower && e.shown) set(e.shown, e.shower, "y");
  }
  for (let round = 0; round < 6; round++) {
    let changed = false;
    // Wer eine Karte hat, hat sie allein
    for (const c of ids) {
      const owner = players.find((p) => auto[c]?.[p] === "y");
      if (owner) for (const p of players) if (p !== owner) changed = set(c, p, "x") || changed;
    }
    // Gezeigt, zwei sicher nicht → die dritte
    for (const e of notes.log) {
      if (!e.shower || e.shown) continue;
      const open = e.cards.filter((c) => auto[c]?.[e.shower!] !== "x");
      if (open.length === 1) changed = set(open[0], e.shower, "y") || changed;
    }
    if (!changed) break;
  }
  return auto;
}

/** Was in einer Zelle steht und ob es von selbst kam */
export function cell(notes: Notes, auto: ReturnType<typeof infer>, card: string, player: string): { mark: Mark; auto: boolean } {
  const a = auto[card]?.[player];
  if (a) return { mark: a, auto: true };
  return { mark: notes.marks[card]?.[player] ?? "", auto: false };
}

/** Status einer Karte: jemand hat sie (raus), alle haben sie sicher nicht (Lösung!), sonst offen */
export function rowState(auto: ReturnType<typeof infer>, card: string, players: string[]): "out" | "solution" | "open" {
  const row = auto[card] ?? {};
  if (players.some((p) => row[p] === "y")) return "out";
  if (players.length && players.every((p) => row[p] === "x")) return "solution";
  return "open";
}

/** Je Gruppe: ist nur noch eine Karte offen, ist sie die Lösung */
export function solutionOf(cards: NoteCard[], auto: ReturnType<typeof infer>, players: string[]): Record<Group, string | null> {
  const out: Record<Group, string | null> = { s: null, w: null, r: null };
  for (const g of ["s", "w", "r"] as Group[]) {
    const inGroup = cards.filter((c) => c.group === g);
    const sure = inGroup.find((c) => rowState(auto, c.id, players) === "solution");
    const open = inGroup.filter((c) => rowState(auto, c.id, players) !== "out");
    out[g] = sure?.id ?? (open.length === 1 ? open[0].id : null);
  }
  return out;
}

/** Nächstes Handzeichen beim Antippen */
export const nextMark = (m: Mark): Mark => (m === "" ? "x" : m === "x" ? "y" : m === "y" ? "q" : "");
export const MARK_TEXT: Record<Mark, string> = { "": "", x: "✗", y: "✓", q: "?" };

/** Wer zwischen dem Fragenden und dem Zeigenden sitzt (im Uhrzeigersinn) – die konnten nichts zeigen */
export function between(order: string[], by: string, shower: string | null): string[] {
  const i = order.indexOf(by);
  const out: string[] = [];
  for (let k = 1; k < order.length; k++) {
    const id = order[(i + k) % order.length];
    if (id === shower) break;
    out.push(id);
  }
  return out;
}
