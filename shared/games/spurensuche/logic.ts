/**
 * Spiellogik für Spurensuche – Detektivspiel auf einem Landhaus-Brett (eigene Figuren, Räume und Grundriss).
 *
 * Verdeckt liegen Täter, Werkzeug und Ort. Die übrigen Karten werden verteilt. Wer am Zug ist, würfelt mit zwei
 * Würfeln und zieht höchstens so viele Felder durch die Flure; ein Raum beendet den Zug. Im Raum äußert er einen
 * Verdacht (Person + Werkzeug + dieser Raum): Die genannte Figur und das Werkzeug kommen in den Raum. Reihum im
 * Uhrzeigersinn zeigt der erste Mitspieler, der eine der drei Karten hat, genau eine davon – nur dem Fragenden.
 * Jeder hat eine Anklage: richtig gewinnt, falsch scheidet aus (widerlegt aber weiter).
 *
 * Läuft im Browser (lokal) und im Durable Object (online). Zufall nur über shared/platform/random.
 */
import { firstPlayerId } from "../../platform/turns";
import { randomCode, rollDice, shuffle } from "../../platform/random";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

// ── Karten ──────────────────────────────────────────────────────────────────────────────────────────────

export interface Suspect { id: string; name: string; short: string; color: string; /** Buchstabe auf der Figur */ mark: string }
export const SUSPECTS: Suspect[] = [
  { id: "graefin", name: "Gräfin von Lindenau", short: "Gräfin", color: "#8c2f45", mark: "G" },
  { id: "kapitaen", name: "Kapitän Brandt", short: "Kapitän", color: "#27477d", mark: "K" },
  { id: "doktor", name: "Doktor Seidel", short: "Doktor", color: "#6b6f78", mark: "D" },
  { id: "rosa", name: "Fräulein Rosa Wendt", short: "Rosa", color: "#d9768f", mark: "R" },
  { id: "gaertner", name: "Gärtner Hubert", short: "Gärtner", color: "#3f7d4a", mark: "H" },
  { id: "koechin", name: "Köchin Martha", short: "Köchin", color: "#c08a2b", mark: "M" },
];
export const WEAPONS = [
  { id: "brief", name: "Brieföffner", with: "mit dem Brieföffner" },
  { id: "gift", name: "Giftfläschchen", with: "mit dem Giftfläschchen" },
  { id: "schuerhaken", name: "Schürhaken", with: "mit dem Schürhaken" },
  { id: "schal", name: "Seidenschal", with: "mit dem Seidenschal" },
  { id: "gartenschere", name: "Gartenschere", with: "mit der Gartenschere" },
  { id: "stock", name: "Spazierstock", with: "mit dem Spazierstock" },
] as const;
export const ROOMS = [
  { id: "lesezimmer", name: "Lesezimmer", in: "im Lesezimmer", into: "ins Lesezimmer" },
  { id: "galerie", name: "Ahnengalerie", in: "in der Ahnengalerie", into: "in die Ahnengalerie" },
  { id: "turm", name: "Turmzimmer", in: "im Turmzimmer", into: "ins Turmzimmer" },
  { id: "gewaechshaus", name: "Gewächshaus", in: "im Gewächshaus", into: "ins Gewächshaus" },
  { id: "kaminhalle", name: "Kaminhalle", in: "in der Kaminhalle", into: "in die Kaminhalle" },
  { id: "jagdzimmer", name: "Jagdzimmer", in: "im Jagdzimmer", into: "ins Jagdzimmer" },
  { id: "weinkeller", name: "Weinkeller", in: "im Weinkeller", into: "in den Weinkeller" },
  { id: "gesindestube", name: "Gesindestube", in: "in der Gesindestube", into: "in die Gesindestube" },
  { id: "rauchersalon", name: "Rauchersalon", in: "im Rauchersalon", into: "in den Rauchersalon" },
] as const;

export type Kind = "suspect" | "weapon" | "room";
/** Karten-Kennung: „s:graefin“, „w:gift“, „r:turm“ */
export type Card = string;
export const sCard = (id: string): Card => `s:${id}`;
export const wCard = (id: string): Card => `w:${id}`;
export const rCard = (i: number): Card => `r:${ROOMS[i].id}`;
export const ALL_CARDS: Card[] = [...SUSPECTS.map((x) => sCard(x.id)), ...WEAPONS.map((x) => wCard(x.id)), ...ROOMS.map((_, i) => rCard(i))];
export const kindOf = (c: Card): Kind => (c.startsWith("s:") ? "suspect" : c.startsWith("w:") ? "weapon" : "room");
export function cardName(c: Card): string {
  const id = c.slice(2);
  if (c.startsWith("s:")) return SUSPECTS.find((x) => x.id === id)?.name ?? "?";
  if (c.startsWith("w:")) return WEAPONS.find((x) => x.id === id)?.name ?? "?";
  return ROOMS.find((x) => x.id === id)?.name ?? "?";
}
export const suspectIndex = (id: string) => SUSPECTS.findIndex((x) => x.id === id);
export const weaponIndex = (id: string) => WEAPONS.findIndex((x) => x.id === id);

// ── Brett ───────────────────────────────────────────────────────────────────────────────────────────────

export const SIZE = 20;
/**
 * Grundriss 20×20: „#“ Wand, „.“ Flur, „S“ Startfeld (Flur), Ziffer = Raum. Neun Räume im Raster 3×3,
 * dazwischen zwei Felder breite Flure. Türen und Geheimgänge stehen unten.
 */
const MAP = [
  "######S######S######",
  "#00000..1111..22222#",
  "#00000..1111..22222#",
  "#00000..1111..22222#",
  "#00000..1111..22222#",
  "#00000..1111..22222#",
  "#..................S",
  "#..................#",
  "#33333..4444..55555#",
  "#33333..4444..55555#",
  "#33333..4444..55555#",
  "#33333..4444..55555#",
  "S..................#",
  "#..................S",
  "#66666..7777..88888#",
  "#66666..7777..88888#",
  "#66666..7777..88888#",
  "#66666..7777..88888#",
  "#66666..7777..88888#",
  "#############S######",
];
/** Türen: Raum → Flurfelder davor (Zeile, Spalte) */
export const DOORS: [number, number][][] = [
  [[3, 6], [6, 3]],
  [[4, 7], [6, 10]],
  [[3, 13], [6, 16]],
  [[7, 2], [10, 6]],
  [[7, 9], [9, 7], [10, 12], [12, 10]],
  [[9, 13], [12, 17]],
  [[13, 4], [16, 6]],
  [[13, 9], [17, 12]],
  [[13, 15], [15, 13]],
];
/** Geheimgänge zwischen gegenüberliegenden Ecken */
export const PASSAGES: Record<number, number> = { 0: 8, 8: 0, 2: 6, 6: 2 };
/** Startfelder der sechs Figuren (Reihenfolge wie SUSPECTS) */
export const STARTS: [number, number][] = [[0, 6], [0, 13], [6, 19], [13, 19], [19, 13], [12, 0]];

/** Position: Flurfeld r*SIZE+c (0…399) oder Raum ROOM_BASE+i */
export type Pos = number;
export const ROOM_BASE = 1000;
export const cellPos = (r: number, c: number): Pos => r * SIZE + c;
export const roomPos = (i: number): Pos => ROOM_BASE + i;
export const isRoom = (p: Pos) => p >= ROOM_BASE;
export const roomOf = (p: Pos) => (isRoom(p) ? p - ROOM_BASE : -1);
export const tile = (r: number, c: number) => (r < 0 || c < 0 || r >= SIZE || c >= SIZE ? "#" : MAP[r][c]);
export const isFloor = (r: number, c: number) => tile(r, c) === "." || tile(r, c) === "S";
/** Raum-Nummer eines Feldes im Grundriss, -1 bei Flur/Wand */
export const roomAt = (r: number, c: number) => (/[0-9]/.test(tile(r, c)) ? Number(tile(r, c)) : -1);

// ── Spielstand ──────────────────────────────────────────────────────────────────────────────────────────

export interface Suggestion {
  n: number;
  by: string;
  suspect: string;
  weapon: string;
  room: number;
  /** Wer der Reihe nach nichts zeigen konnte */
  passed: string[];
  /** Wer eine Karte gezeigt hat (welche, sieht nur der Fragende) – null: niemand konnte */
  shownBy: string | null;
}

export interface SpState {
  v: 1;
  /** Kennung dieser Partie (z. B. für den Notizblock auf dem Gerät) */
  gid: string;
  /** „notes“: echtes Brettspiel am Tisch, die App ist nur der Notizblock */
  phase: "move" | "moving" | "suggest" | "refute" | "after" | "over" | "notes";
  /** Spieler → Figur (Kennung aus SUSPECTS) */
  role: Record<string, string>;
  /** Figur → Position (alle sechs Figuren stehen auf dem Brett, auch ohne Spieler) */
  token: Record<string, Pos>;
  /** Werkzeug → Raum-Nummer */
  weaponAt: Record<string, number>;
  /** Handkarten – in der Sicht nur die eigenen */
  hands: Record<string, Card[]>;
  /** Die Lösung – in der Sicht erst am Ende */
  solution: { suspect: string; weapon: string; room: number } | null;
  curId: string | null;
  dice: number[] | null;
  /** Wurde in diesem Zug schon gewürfelt bzw. gezogen? */
  movedFrom: Pos | null;
  /** Spieler, deren Figur durch einen Verdacht in einen Raum geholt wurde – dürfen dort ohne Ziehen verdächtigen */
  summoned: string[];
  /** Ausgeschiedene (falsch angeklagt) */
  out: string[];
  /** Laufender Verdacht und wer gerade widerlegen soll */
  pending: Suggestion | null;
  refuterId: string | null;
  /** Alle Verdachte der Partie (öffentlich) */
  history: Suggestion[];
  /** Wer welche Karte von wem gesehen hat – in der Sicht nur die eigenen */
  seen: Record<string, { card: Card; by: string; n: number }[]>;
  /** Letzte gezeigte Karte (für die Anzeige) – Karte nur für den Fragenden und den Zeigenden */
  lastShown: { to: string; by: string; card: Card | null; n: number } | null;
  /** Letzte Anklage */
  lastAccusation: { by: string; suspect: string; weapon: string; room: number; right: boolean; n: number } | null;
  winnerId: string | null;
  /** Echtes Brettspiel: Kartennamen der eigenen Schachtel, von der Spielleitung für alle im Raum gesetzt */
  cardNames?: CardNames | null;
  names: Record<string, string>;
  rules: Rules;
  n: number;
  log: string[];
}

export type SpAction =
  | { type: "roll" }
  | { type: "passage" }
  | { type: "stay" }
  | { type: "move"; to: Pos }
  | { type: "suggest"; suspect: string; weapon: string }
  | { type: "noSuggest" }
  | { type: "show"; card: Card }
  | { type: "accuse"; suspect: string; weapon: string; room: number }
  | { type: "end" }
  /** Echtes Brettspiel: der Fall ist gelöst (Sieger) bzw. ungelöst (null) – nur die Spielleitung */
  | { type: "finish"; winner: string | null }
  /** Echtes Brettspiel: Kartennamen für alle im Raum (je Gruppe eine Liste) – nur die Spielleitung */
  | { type: "names"; names: CardNames };

/** Kartennamen je Gruppe: Personen, Werkzeuge, Räume (je 1–15, höchstens 30 Zeichen) */
export interface CardNames { s: string[]; w: string[]; r: string[] }
export function cleanCardNames(x: unknown): CardNames | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((n): n is string => typeof n === "string").map((n) => n.trim().slice(0, 30)).filter(Boolean).slice(0, 15) : []);
  const out = { s: list(o.s), w: list(o.w), r: list(o.r) };
  return out.s.length && out.w.length && out.r.length ? out : null;
}

export interface Rules {
  /** Gespielt wird am echten Brett, die App ist nur der Notizblock */
  real: boolean;
  /** Würfel: zwei (Original) oder einer (kürzere Wege, langsamer) */
  dice: 1 | 2;
  /** Mitspieler zeigen: Wer nur eine passende Karte hat, zeigt sie automatisch */
  autoShow: boolean;
}
export function rulesOf(o: Options): Rules {
  return { real: o.board === "real", dice: o.dice === "1" ? 1 : 2, autoShow: o.autoShow !== false };
}

const MAX_LOG = 80;
const nameOf = (s: SpState, id: string | null | undefined) => (id ? s.names[id] ?? "?" : "?");
const push = (s: SpState, line: string) => { s.log.push(line); if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG); };
const active = (s: SpState, players: string[]) => players.filter((id) => !s.out.includes(id) && s.role[id]);
export const seatOrder = (s: SpState) => Object.keys(s.role);

/** Nächster Spieler im Uhrzeigersinn (ohne Ausgeschiedene) */
function nextActive(s: SpState, from: string): string | null {
  const order = seatOrder(s);
  const i = order.indexOf(from);
  for (let k = 1; k <= order.length; k++) {
    const id = order[(i + k) % order.length];
    if (!s.out.includes(id)) return id;
  }
  return null;
}

/** Wer passende Karten hat – in Sitzreihenfolge ab dem Fragenden */
export function matching(s: SpState, id: string, sug: Pick<Suggestion, "suspect" | "weapon" | "room">): Card[] {
  const want = new Set([sCard(sug.suspect), wCard(sug.weapon), rCard(sug.room)]);
  return (s.hands[id] ?? []).filter((c) => want.has(c));
}

// ── Bewegung ────────────────────────────────────────────────────────────────────────────────────────────

/** Felder, auf denen gerade eine Figur steht (im Flur kann nur eine stehen) */
function blockedCells(s: SpState, except: string): Set<number> {
  return new Set(Object.entries(s.token).filter(([id, p]) => id !== except && !isRoom(p)).map(([, p]) => p));
}

/**
 * Wohin kommt die Figur mit höchstens `steps` Schritten? Durch Flure, nicht über andere Figuren; ein Raum beendet
 * den Zug, der Raum, in dem man startet, zählt nicht als Ziel. Ergebnis: Ziel → Schritte.
 */
export function reachable(s: SpState, suspect: string, steps: number): Map<Pos, number> {
  const start = s.token[suspect];
  const blocked = blockedCells(s, suspect);
  const out = new Map<Pos, number>();
  const dist = new Map<number, number>();
  const queue: number[] = [];
  const enqueue = (cell: number, d: number) => {
    if (d > steps || blocked.has(cell) || dist.has(cell)) return;
    dist.set(cell, d);
    queue.push(cell);
  };
  if (isRoom(start)) for (const [r, c] of DOORS[roomOf(start)]) enqueue(cellPos(r, c), 1);
  else { dist.set(start, 0); queue.push(start); }
  while (queue.length) {
    const cell = queue.shift()!;
    const d = dist.get(cell)!;
    if (cell !== start) out.set(cell, d);
    const r = Math.floor(cell / SIZE), c = cell % SIZE;
    // Tür: ein weiterer Schritt in den Raum
    if (d < steps) {
      DOORS.forEach((doors, room) => {
        if (roomPos(room) === start) return;
        if (doors.some(([dr, dc]) => dr === r && dc === c)) {
          const p = roomPos(room);
          if (!out.has(p) || out.get(p)! > d + 1) out.set(p, d + 1);
        }
      });
    }
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (isFloor(nr, nc)) enqueue(cellPos(nr, nc), d + 1);
    }
  }
  return out;
}

/** Kürzeste Schrittzahl von einer Position in einen Raum (für Bots und Hinweise), ohne Würfelgrenze */
export function distanceToRoom(s: SpState, suspect: string, room: number): number {
  const all = reachable(s, suspect, 60);
  return all.get(roomPos(room)) ?? 99;
}

// ── Ablauf ──────────────────────────────────────────────────────────────────────────────────────────────

function startTurn(s: SpState, id: string | null) {
  s.curId = id;
  s.phase = id ? "move" : "over";
  s.dice = null;
  s.movedFrom = null;
}

function endTurn(s: SpState) {
  const cur = s.curId;
  if (!cur) return;
  s.summoned = s.summoned.filter((x) => x !== cur);
  const next = nextActive(s, cur);
  if (!next) { s.phase = "over"; s.curId = null; return; }
  startTurn(s, next);
}

/** Den nächsten Mitspieler suchen, der widerlegen kann – sonst ist der Verdacht unwiderlegt */
function findRefuter(s: SpState, rules: Rules) {
  const sug = s.pending!;
  const order = seatOrder(s);
  const i = order.indexOf(sug.by);
  for (let k = 1; k < order.length; k++) {
    const id = order[(i + k) % order.length];
    if (sug.passed.includes(id)) continue;
    const m = matching(s, id, sug);
    if (!m.length) { sug.passed.push(id); continue; }
    if (rules.autoShow && m.length === 1) { show(s, id, m[0]); return; }
    s.refuterId = id;
    s.phase = "refute";
    return;
  }
  // Niemand konnte widerlegen
  sug.shownBy = null;
  s.history.push(sug);
  s.pending = null;
  s.refuterId = null;
  s.phase = "after";
  push(s, `Niemand kann ${nameOf(s, sug.by)} widerlegen!`);
}

function show(s: SpState, by: string, card: Card) {
  const sug = s.pending!;
  sug.shownBy = by;
  s.history.push(sug);
  (s.seen[sug.by] ??= []).push({ card, by, n: s.n });
  s.lastShown = { to: sug.by, by, card, n: s.n };
  s.pending = null;
  s.refuterId = null;
  s.phase = "after";
  push(s, `${nameOf(s, by)} zeigt ${nameOf(s, sug.by)} eine Karte.`);
}

function deal(ids: string[]): { hands: Record<string, Card[]>; solution: SpState["solution"] } {
  const suspect = shuffle(SUSPECTS)[0].id;
  const weapon = shuffle(WEAPONS)[0].id;
  const room = shuffle(ROOMS.map((_, i) => i))[0];
  const rest = shuffle(ALL_CARDS.filter((c) => c !== sCard(suspect) && c !== wCard(weapon) && c !== rCard(room)));
  const hands: Record<string, Card[]> = Object.fromEntries(ids.map((id) => [id, [] as Card[]]));
  rest.forEach((c, i) => hands[ids[i % ids.length]].push(c));
  for (const id of ids) hands[id].sort((a, b) => ALL_CARDS.indexOf(a) - ALL_CARDS.indexOf(b));
  return { hands, solution: { suspect, weapon, room } };
}

export function newGame(players: Player[], options: Options, ctx?: Pick<GameContext, "round">): SpState {
  const ids = players.map((p) => p.id);
  const first = firstPlayerId({ players, round: ctx?.round }) ?? ids[0];
  const { hands, solution } = deal(ids);
  const role = Object.fromEntries(ids.map((id, i) => [id, SUSPECTS[i % SUSPECTS.length].id]));
  const token = Object.fromEntries(SUSPECTS.map((x, i) => [x.id, cellPos(...STARTS[i])]));
  const rooms = shuffle(ROOMS.map((_, i) => i));
  const weaponAt = Object.fromEntries(WEAPONS.map((w, i) => [w.id, rooms[i]]));
  const s: SpState = {
    v: 1, gid: randomCode(8), phase: "move", role, token, weaponAt, hands, solution, curId: first, dice: null, movedFrom: null,
    summoned: [], out: [], pending: null, refuterId: null, history: [], seen: Object.fromEntries(ids.map((id) => [id, []])),
    lastShown: null, lastAccusation: null, winnerId: null, names: Object.fromEntries(players.map((p) => [p.id, p.name])),
    rules: rulesOf(options), n: 0, log: [],
  };
  if (s.rules.real) {
    // Am echten Brett: keine Karten und keine Züge in der App – nur der Notizblock je Handy
    s.hands = Object.fromEntries(ids.map((id) => [id, []]));
    s.solution = null;
    s.phase = "notes";
    s.curId = null;
    push(s, "Gespielt wird am echten Brett – das Handy ist euer Notizblock.");
    return s;
  }
  push(s, `Ein Mord im Landhaus! ${nameOf(s, first)} beginnt.`);
  return s;
}

export function canSuggestHere(s: SpState, id: string): boolean {
  return isRoom(s.token[s.role[id]]);
}

export function apply(prev: SpState, a: SpAction, ctx: GameContext): SpState {
  if (prev.phase === "over") throw new GameError("Die Partie ist vorbei.");
  const s = structuredClone(prev);
  s.n++;
  const cur = s.curId;
  const me = s.role[cur ?? ""];

  if (s.phase === "notes" && a.type === "names") {
    const names = cleanCardNames(a.names);
    if (!names) throw new GameError("Jede Gruppe braucht mindestens einen Namen.");
    s.cardNames = names;
    push(s, "Die Spielleitung hat die Kartennamen für alle eingetragen.");
    return s;
  }
  if (s.phase === "notes") {
    if (a.type !== "finish") throw new GameError("Am echten Brett führt die App keine Züge.");
    if (a.winner !== null && !s.role[a.winner]) throw new GameError("Unbekannter Spieler.");
    s.winnerId = a.winner;
    s.phase = "over";
    push(s, a.winner ? `${nameOf(s, a.winner)} hat den Fall gelöst!` : "Der Fall bleibt ungelöst.");
    return s;
  }
  if (a.type === "finish") throw new GameError("Das geht nur am echten Brett.");

  switch (a.type) {
    case "roll": {
      if (s.phase !== "move" || !cur) throw new GameError("Jetzt wird nicht gewürfelt.");
      s.dice = rollDice(s.rules.dice);
      const total = s.dice.reduce((x, y) => x + y, 0);
      s.movedFrom = s.token[me];
      s.phase = "moving";
      push(s, `${nameOf(s, cur)} würfelt ${total}.`);
      // Eingesperrt: kein Ziel erreichbar – dann bleibt die Figur stehen
      if (reachable(s, me, total).size === 0) { s.phase = isRoom(s.token[me]) ? "suggest" : "after"; push(s, `${nameOf(s, cur)} kommt nicht weiter.`); }
      return s;
    }
    case "passage": {
      if (s.phase !== "move" || !cur) throw new GameError("Jetzt nicht.");
      const room = roomOf(s.token[me]);
      const to = PASSAGES[room];
      if (to === undefined) throw new GameError("Hier gibt es keinen Geheimgang.");
      s.movedFrom = s.token[me];
      s.token[me] = roomPos(to);
      s.phase = "suggest";
      push(s, `${nameOf(s, cur)} nimmt den Geheimgang ${ROOMS[to].into}.`);
      return s;
    }
    case "stay": {
      if (s.phase !== "move" || !cur || !s.summoned.includes(cur) || !isRoom(s.token[me])) throw new GameError("Du kannst hier nicht bleiben.");
      s.phase = "suggest";
      return s;
    }
    case "move": {
      if (s.phase !== "moving" || !cur || !s.dice) throw new GameError("Erst würfeln.");
      const total = s.dice.reduce((x, y) => x + y, 0);
      if (!reachable(s, me, total).has(a.to)) throw new GameError("Da kommst du nicht hin.");
      s.token[me] = a.to;
      if (isRoom(a.to)) { s.phase = "suggest"; push(s, `${nameOf(s, cur)} geht ${ROOMS[roomOf(a.to)].into}.`); }
      else s.phase = "after";
      return s;
    }
    case "suggest": {
      if (s.phase !== "suggest" || !cur) throw new GameError("Jetzt kein Verdacht.");
      const room = roomOf(s.token[me]);
      if (room < 0) throw new GameError("Verdächtigen geht nur in einem Raum.");
      if (suspectIndex(a.suspect) < 0 || weaponIndex(a.weapon) < 0) throw new GameError("Unbekannte Karte.");
      // Figur und Werkzeug in den Raum holen
      if (s.token[a.suspect] !== roomPos(room)) {
        s.token[a.suspect] = roomPos(room);
        const pid = Object.keys(s.role).find((id) => s.role[id] === a.suspect);
        if (pid && pid !== cur && !s.summoned.includes(pid)) s.summoned.push(pid);
      }
      s.weaponAt[a.weapon] = room;
      s.pending = { n: s.n, by: cur, suspect: a.suspect, weapon: a.weapon, room, passed: [], shownBy: null };
      push(s, `${nameOf(s, cur)} verdächtigt: ${SUSPECTS[suspectIndex(a.suspect)].name}, ${WEAPONS[weaponIndex(a.weapon)].name}, ${ROOMS[room].name}.`);
      findRefuter(s, s.rules);
      return s;
    }
    case "noSuggest": {
      if (s.phase !== "suggest") throw new GameError("Jetzt nicht.");
      s.phase = "after";
      return s;
    }
    case "show": {
      if (s.phase !== "refute" || !s.refuterId || !s.pending) throw new GameError("Gerade muss niemand eine Karte zeigen.");
      if (ctx.actorId !== null && ctx.actorId !== s.refuterId) throw new GameError("Nur wer widerlegt, zeigt eine Karte.");
      if (!matching(s, s.refuterId, s.pending).includes(a.card)) throw new GameError("Diese Karte passt nicht.");
      show(s, s.refuterId, a.card);
      return s;
    }
    case "accuse": {
      if (!cur || (s.phase !== "move" && s.phase !== "after")) throw new GameError("Anklagen geht nur in deinem Zug.");
      if (suspectIndex(a.suspect) < 0 || weaponIndex(a.weapon) < 0 || !ROOMS[a.room]) throw new GameError("Unbekannte Karte.");
      const sol = s.solution!;
      const right = sol.suspect === a.suspect && sol.weapon === a.weapon && sol.room === a.room;
      s.lastAccusation = { by: cur, suspect: a.suspect, weapon: a.weapon, room: a.room, right, n: s.n };
      const what = `${SUSPECTS[suspectIndex(a.suspect)].name} ${WEAPONS[weaponIndex(a.weapon)].with} ${ROOMS[a.room].in}`;
      if (right) {
        s.winnerId = cur;
        s.phase = "over";
        s.curId = null;
        push(s, `${nameOf(s, cur)} klagt an: ${what} – richtig! Fall gelöst.`);
        return s;
      }
      s.out.push(cur);
      push(s, `${nameOf(s, cur)} klagt an: ${what} – falsch! ${nameOf(s, cur)} scheidet aus, zeigt aber weiter Karten.`);
      if (!active(s, seatOrder(s)).length) { s.phase = "over"; s.curId = null; push(s, "Niemand hat den Fall gelöst."); return s; }
      endTurn(s);
      return s;
    }
    case "end": {
      if (s.phase !== "after") throw new GameError("Erst den Zug zu Ende spielen.");
      endTurn(s);
      return s;
    }
  }
  throw new GameError("Unbekannte Aktion.");
}

// ── Sicht und Deduktion ─────────────────────────────────────────────────────────────────────────────────

export function view(s: SpState, viewer: string | null): SpState {
  if (viewer === null) return s;
  const over = s.phase === "over";
  const v = structuredClone(s);
  if (!over) {
    v.solution = null;
    v.hands = { [viewer]: s.hands[viewer] ?? [] };
    v.seen = { [viewer]: s.seen[viewer] ?? [] };
    if (v.lastShown && v.lastShown.to !== viewer && v.lastShown.by !== viewer) v.lastShown = { ...v.lastShown, card: null };
  }
  return v;
}

/** Was weiß dieser Spieler sicher? Karten, die nicht in der Lösung sein können (eigene + gezeigte) */
export function knownCards(s: SpState, id: string): Set<Card> {
  return new Set([...(s.hands[id] ?? []), ...(s.seen[id] ?? []).map((x) => x.card)]);
}

/** Wer hat welche Karte ganz sicher nicht? Aus den öffentlichen „konnte nicht widerlegen“ */
export function lacks(s: SpState): Record<string, Set<Card>> {
  const out: Record<string, Set<Card>> = {};
  for (const h of s.history) for (const id of h.passed) {
    const set = (out[id] ??= new Set());
    set.add(sCard(h.suspect)); set.add(wCard(h.weapon)); set.add(rCard(h.room));
  }
  return out;
}

/** Offene Kandidaten je Art aus Sicht eines Spielers */
export function candidatesFor(s: SpState, id: string): { suspects: string[]; weapons: string[]; rooms: number[] } {
  const known = knownCards(s, id);
  // Öffentlich: wer bei einem Verdacht nichts zeigen konnte, hat keine der drei Karten.
  // Hat also kein Mitspieler eine Karte und ich auch nicht, liegt sie in der Lösung.
  const miss = lacks(s);
  const others = seatOrder(s).filter((x) => x !== id);
  const surely = (c: Card) => !known.has(c) && others.length > 0 && others.every((o) => miss[o]?.has(c));
  const narrow = <T,>(all: T[], card: (x: T) => Card): T[] => {
    const sure = all.find((x) => surely(card(x)));
    return sure !== undefined ? [sure] : all.filter((x) => !known.has(card(x)));
  };
  return {
    suspects: narrow(SUSPECTS.map((x) => x.id), sCard),
    weapons: narrow(WEAPONS.map((x) => x.id), wCard),
    rooms: narrow(ROOMS.map((_, i) => i), rCard),
  };
}

/**
 * Ein guter Zug für Bots (nur mit eigenem Wissen): sicher anklagen, sonst in einen Raum mit unbekannter Karte,
 * dort Unbekanntes verdächtigen. Beim Widerlegen eine Karte zeigen, die der Fragende schon kennen könnte.
 */
export function botPlan(s: SpState, id: string): SpAction[] {
  if (s.phase === "refute" && s.refuterId === id && s.pending) {
    const m = matching(s, id, s.pending);
    return m.length ? [{ type: "show", card: m[0] }] : [];
  }
  if (s.curId !== id) return [];
  const me = s.role[id];
  const c = candidatesFor(s, id);
  const sure = c.suspects.length === 1 && c.weapons.length === 1 && c.rooms.length === 1;
  const pickOf = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
  if (sure && (s.phase === "move" || s.phase === "after")) return [{ type: "accuse", suspect: c.suspects[0], weapon: c.weapons[0], room: c.rooms[0] }];
  if (s.phase === "move") {
    const here = roomOf(s.token[me]);
    if (s.summoned.includes(id) && here >= 0 && c.rooms.includes(here)) return [{ type: "stay" }];
    if (here >= 0 && PASSAGES[here] !== undefined && c.rooms.includes(PASSAGES[here]) && Math.random() < 0.7) return [{ type: "passage" }];
    return [{ type: "roll" }];
  }
  if (s.phase === "moving" && s.dice) {
    const total = s.dice.reduce((x, y) => x + y, 0);
    const reach = reachable(s, me, total);
    const goals = c.rooms.length ? c.rooms : ROOMS.map((_, i) => i);
    const rooms = [...reach.keys()].filter((p) => isRoom(p) && goals.includes(roomOf(p)));
    if (rooms.length) return [{ type: "move", to: pickOf(rooms) }];
    const anyRoom = [...reach.keys()].filter(isRoom);
    if (anyRoom.length && Math.random() < 0.5) return [{ type: "move", to: pickOf(anyRoom) }];
    // Sonst so nah wie möglich an eine Tür eines offenen Raums (Luftlinie über die Felder reicht als Schätzung)
    const doors = goals.flatMap((g) => DOORS[g]);
    let best: Pos | null = null, bestD = 999;
    for (const p of reach.keys()) {
      if (isRoom(p)) continue;
      const r = Math.floor(p / SIZE), c = p % SIZE;
      const d = Math.min(...doors.map(([dr, dc]) => Math.abs(dr - r) + Math.abs(dc - c)));
      if (d < bestD) { bestD = d; best = p; }
    }
    return best !== null ? [{ type: "move", to: best }] : [];
  }
  if (s.phase === "suggest") {
    const sus = c.suspects.length ? pickOf(c.suspects) : pickOf(SUSPECTS).id;
    const wpn = c.weapons.length ? pickOf(c.weapons) : pickOf([...WEAPONS]).id;
    return [{ type: "suggest", suspect: sus, weapon: wpn }];
  }
  if (s.phase === "after") return [{ type: "end" }];
  return [];
}

// ── Plattform ───────────────────────────────────────────────────────────────────────────────────────────

export const spurensuche: GameLogic<SpState, SpAction> = {
  info: {
    id: "spurensuche",
    name: "Spurensuche",
    tagline: "Mord im Landhaus: würfeln, Räume durchsuchen, verdächtigen – wer, womit und wo?",
    category: "Brett",
    minPlayers: 3,
    maxPlayers: 6,
    duration: "45 Min.",
  },
  version: 1,
  settings: [
    {
      key: "board", label: "Spielbrett", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "Brett, Würfel und Karten auf dem Handy" },
        { value: "real", label: "Echtes Brettspiel", hint: "ihr spielt am Tisch – jedes Handy ist der Notizblock" },
      ],
    },
    {
      key: "dice", label: "Würfel", type: "choice", default: "2", showIf: (o) => o.board !== "real",
      choices: [
        { value: "2", label: "Zwei", hint: "wie im Original" },
        { value: "1", label: "Einer", hint: "kürzere Schritte, mehr Taktik" },
      ],
    },
    { key: "autoShow", label: "Nur eine passende Karte: automatisch zeigen", type: "toggle", default: true, showIf: (o) => o.board !== "real" },
  ],
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  setup: (ctx) => newGame(ctx.players, ctx.options, ctx),
  actionKind: (a) => (a.type === "finish" || a.type === "names" ? "host" : a.type === "show" ? "player" : ["roll", "passage", "stay", "move", "suggest", "noSuggest", "accuse", "end"].includes(a.type) ? "turn" : null),
  apply,
  currentPlayerId: (s) => (s.phase === "refute" ? s.refuterId : s.phase === "over" ? null : s.curId),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => ctx.players.filter((p) => s.role[p.id]).map((p) => ({ id: p.id, won: p.id === s.winnerId })),
  view,
  skipLabel: (s) => (s.phase === "notes" ? null : s.phase === "refute" && s.refuterId ? `Für ${s.names[s.refuterId]} eine Karte zeigen`
    : s.phase !== "over" && s.curId ? `${s.names[s.curId]} überspringen` : null),
  skipTurn(prev) {
    if (prev.phase === "over" || prev.phase === "notes") return prev;
    const s = structuredClone(prev);
    if (s.phase === "refute" && s.refuterId && s.pending) {
      const m = matching(s, s.refuterId, s.pending);
      if (m.length) { s.n++; show(s, s.refuterId, m[0]); }
      return s;
    }
    s.n++;
    if (s.pending) { s.history.push({ ...s.pending, shownBy: null }); s.pending = null; s.refuterId = null; }
    push(s, `${nameOf(s, s.curId)} wird übersprungen.`);
    endTurn(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    if (prev.phase === "over" || !prev.role[id]) return prev;
    if (prev.phase === "notes") { const s = structuredClone(prev); delete s.role[id]; delete s.hands[id]; return s; }
    const s = structuredClone(prev);
    s.n++;
    // Karten des Gehenden werden aufgedeckt an alle verteilt bekannt: wir geben sie reihum weiter
    const rest = seatOrder(s).filter((x) => x !== id);
    (s.hands[id] ?? []).forEach((c, i) => { const to = rest[i % rest.length]; if (to) (s.hands[to] ??= []).push(c); });
    for (const to of rest) s.hands[to]?.sort((a, b) => ALL_CARDS.indexOf(a) - ALL_CARDS.indexOf(b));
    delete s.hands[id];
    const wasCur = s.curId === id;
    const wasRef = s.refuterId === id;
    const next = nextActive(s, id);
    delete s.role[id];
    s.out = s.out.filter((x) => x !== id);
    s.summoned = s.summoned.filter((x) => x !== id);
    push(s, `${nameOf(s, id)} hat das Haus verlassen – die Karten gehen an die anderen.`);
    if (!active(s, seatOrder(s)).length || seatOrder(s).length < 2) { s.phase = "over"; s.curId = null; return s; }
    if (wasRef && s.pending) { s.pending.passed = s.pending.passed.filter((x) => x !== id); findRefuter(s, s.rules); }
    else if (s.pending && s.phase === "refute") findRefuter(s, s.rules);
    if (wasCur) {
      if (s.pending) { s.history.push({ ...s.pending, shownBy: null }); s.pending = null; s.refuterId = null; }
      startTurn(s, next && next !== id && s.role[next] ? next : nextActive(s, seatOrder(s)[0]) ?? seatOrder(s)[0]);
    }
    void ctx;
    return s;
  },
};
