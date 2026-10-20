/**
 * Stirnraten – wer dran ist, hält das Handy an die Stirn und sieht den Begriff nicht; die anderen erklären.
 * Nach vorn kippen: erraten, nach hinten: überspringen. Vier Varianten:
 *  - Klassisch: reihum, jeder sammelt für sich
 *  - Teams: das Team des Ratenden erklärt, Punkte je Team; „Offene Runde“: manche Karten dürfen alle raten
 *  - Bombe: Das Handy wandert, wer es hält, erklärt dem Nächsten einen Begriff. Die Lunte ist geheim –
 *    wer es beim Knall hält, bekommt eine Bombe.
 *  - Hochstapler: Alle kennen denselben Begriff, nur einer nicht. Reihum ein Wort dazu, dann abstimmen.
 * Darstellungsarten je Karte: Erklären, Pantomime, Geräusche, Summen, mit Akzent.
 *
 * Zeit nur aus `ctx.now`; die Lunte der Bombe sieht nur der Server (bzw. das eine Handy lokal).
 */
import { randomInt, shuffle } from "../../platform/random";
import { WATCH_ID } from "../../platform/protocol";
import { playerName } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";
import { tally } from "../spion/logic";
import { CAT_BY_ID, CATEGORIES, catName, catOfWord, catsUpTo, CUSTOM, LEVELS, levelOf, STYLES, wordIds, wordText, type Style } from "./cards";

export type Variant = "klassisch" | "teams" | "bombe" | "hochstapler";
export type Phase =
  | "pick" | "ready" | "play" | "review"      // Klassisch, Teams (und „ready“ vor der Bombe)
  | "bomb" | "boom"                          // Bombe
  | "look" | "talk" | "vote" | "guess" | "reveal" // Hochstapler
  | "over";

export interface Card {
  /** Begriff („Kategorie:Nummer“) – in fremder Sicht ggf. "" */
  w: string;
  style: Style;
  /** Offene Karte: alle dürfen raten (Teams) */
  open: boolean;
  r: "hit" | "pass" | null;
  /** Team, das die offene Karte erraten hat (null: das ratende Team) */
  team: number | null;
}

export interface TurnResult {
  guesser: string;
  team: number | null;
  cat: string;
  hits: number;
  passes: number;
}

export interface ImpostorResult {
  impostor: string;
  word: string;
  caught: boolean;
  accused: string | null;
  guessed: string | null;
  winner: "impostor" | "group";
  points: Record<string, number>;
}

export interface StirnState {
  v: 1;
  variant: Variant;
  phase: Phase;
  order: string[];
  /** Teams als Listen von Spielern (nur Variante Teams) */
  teams: string[][];
  teamScores: number[];
  scores: Record<string, number>;
  /** gespielte Züge bzw. Runden */
  turn: number;
  /** so viele Züge (Klassisch/Teams) bzw. Runden (Bombe/Hochstapler) insgesamt */
  turns: number;
  /** Runden laut Einstellung */
  rounds: number;
  /** Züge je Spieler bzw. Team bisher (wer als Nächstes im Team rät; Abzug, wenn jemand geht) */
  played: Record<string, number>;
  guesser: string | null;
  team: number | null;
  /** Kategorie des Zugs ("mix": bunt gemischt) */
  cat: string | null;
  /** Karten des Zugs (die letzte ist die aktuelle) */
  cards: Card[];
  /** restliche Begriffe – in jeder fremden Sicht leer */
  deck: string[];
  startedAt: number | null;
  seconds: number;
  /** schon gespielte Begriffe (keine Wiederholung in der Partie) */
  used: string[];
  /** eigene Begriffe */
  custom: string[];
  last: TurnResult | null;
  // ---- Bombe ----
  holder: string | null;
  /** aktueller Begriff (Bombe, Hochstapler) – null in der Sicht des Hochstaplers */
  word: string | null;
  /** Knall – nur der Server bzw. das lokale Handy kennt ihn */
  boomAt: number | null;
  bombs: Record<string, number>;
  /** Begriffe in der laufenden Bombenrunde */
  passes: number;
  // ---- Hochstapler ----
  impostor: string | null;
  seen: string[];
  /** wer gerade ein Wort sagt (Index in der Sprechreihenfolge) */
  speaker: number;
  speakOrder: string[];
  votes: Record<string, string>;
  options: string[];
  result: ImpostorResult | null;
  log: string[];
}

export type StirnAction =
  | { type: "pick"; cat: string }
  | { type: "custom"; words: string[] }
  | { type: "start" }
  | { type: "mark"; i: number; r: "hit" | "pass" }
  | { type: "timeUp" }
  | { type: "stop" }
  | { type: "fix"; i: number; r?: "hit" | "pass"; team?: number | null }
  | { type: "confirm" }
  | { type: "pass"; n: number }
  | { type: "swap"; n: number }
  | { type: "tick" }
  | { type: "next" }
  | { type: "seen"; player?: string }
  | { type: "said" }
  | { type: "vote"; target: string }
  | { type: "verdict"; target: string | null }
  | { type: "guess"; word: string };

const MAX_LOG = 40;
const MAX_CUSTOM = 300;
/** Zeitpuffer für Meldungen, die kurz nach Ablauf eintreffen */
const GRACE = 1500;
/** Lunte der Bombe: geheim zwischen … und … Sekunden */
export const FUSE = { min: 25, max: 75 } as const;
/** Hochstapler: so oft geht die Runde reihum, Punkte */
export const LAPS = 2;
export const IMPOSTOR_POINTS = { escaped: 2, guessed: 1, group: 1 } as const;
/** Jede wievielte Karte ist bei „Offene Runde“ für alle */
const OPEN_EVERY = 4;

const addLog = (s: StirnState, line: string) => { s.log.push(line); if (s.log.length > MAX_LOG) s.log.shift(); };
const nameOf = playerName;

export const variantOf = (o: Options): Variant => (o.variant === "teams" || o.variant === "bombe" || o.variant === "hochstapler" ? o.variant : "klassisch");
export const usesForehead = (v: Variant) => v === "klassisch" || v === "teams";
/** Darstellungsarten, die mitspielen (Erklären immer) */
export const stylesOf = (o: Options): Style[] => ["erklaeren", ...STYLES.map((s) => s.id).filter((id) => id !== "erklaeren" && o[`style_${id}`] === true)];
const teamCount = (o: Options, n: number) => Math.max(2, Math.min(Number(o.teams) || 2, 8, Math.max(2, n)));

/** Teams aus der Spielerreihenfolge, abwechselnd verteilt */
export function makeTeams(order: string[], count: number): string[][] {
  const teams: string[][] = Array.from({ length: count }, () => []);
  order.forEach((id, i) => teams[i % count].push(id));
  return teams.filter((t) => t.length);
}

export const TEAM_NAMES = ["Rot", "Blau", "Grün", "Gelb", "Lila", "Orange", "Türkis", "Rosa"];
export const teamName = (i: number | null) => (i === null ? "" : `Team ${TEAM_NAMES[i] ?? i + 1}`);

/** Ende des Zugs in ms – null, wenn keine Uhr läuft */
export const deadlineOf = (s: StirnState): number | null => (s.phase === "play" && s.startedAt !== null ? s.startedAt + s.seconds * 1000 : null);

/** Begriffe für einen Zug aus der Kategorie (bzw. allen der Stufe), ungespielte zuerst */
function wordsFor(s: StirnState, cat: string, o: Options): string[] {
  const pool = cat === CUSTOM ? s.custom.map((_, i) => `${CUSTOM}:${i}`)
    : cat === "mix" ? catsUpTo(levelOf(o.level)).filter((c) => !c.style || stylesOf(o).includes(c.style)).flatMap(wordIds)
    : CAT_BY_ID[cat] ? wordIds(CAT_BY_ID[cat]) : [];
  const fresh = pool.filter((w) => !s.used.includes(w));
  // Alles schon gespielt: wieder von vorn (die zuletzt gespielten hinten)
  return [...shuffle(fresh), ...shuffle(pool.filter((w) => s.used.includes(w)))];
}

function styleFor(w: string, o: Options): Style {
  const forced = CAT_BY_ID[catOfWord(w)]?.style;
  if (forced) return forced;
  const list = stylesOf(o);
  return list[randomInt(list.length)];
}

function card(w: string, o: Options, index: number, variant: Variant): Card {
  return { w, style: styleFor(w, o), open: variant === "teams" && o.open === true && index % OPEN_EVERY === OPEN_EVERY - 1, r: null, team: null };
}

/** Kategorien, aus denen der Ratende wählen kann */
export function choosable(o: Options, custom: string[]): string[] {
  const styles = stylesOf(o);
  const list = catsUpTo(levelOf(o.level)).filter((c) => !c.style || styles.includes(c.style)).map((c) => c.id);
  return custom.length ? [CUSTOM, ...list] : list;
}

/** Zufällige Kategorie (für „Zufall“ und wenn der Host überspringt) */
function randomCat(o: Options, custom: string[]): string {
  const list = choosable(o, custom).filter((c) => c !== CUSTOM);
  return list.length ? list[randomInt(list.length)] : CATEGORIES[0].id;
}

/**
 * Nächster Zug: Klassisch der Spieler nach dem bisherigen (oder ausdrücklich `who`),
 * Teams das nächste Team mit Mitgliedern und darin der Nächste.
 */
function startTurn(s: StirnState, ctx: GameContext, who?: string | null) {
  if (s.variant === "teams") {
    let t = s.team === null ? 0 : (s.team + 1) % s.teams.length;
    for (let k = 0; k < s.teams.length && !s.teams[t].length; k++) t = (t + 1) % s.teams.length;
    const members = s.teams[t];
    const n = s.played[`t${t}`] ?? 0;
    s.team = t;
    s.guesser = members[n % members.length] ?? null;
    s.played[`t${t}`] = n + 1;
  } else {
    s.guesser = who !== undefined && who !== null && s.order.includes(who) ? who
      : s.guesser === null ? s.order[0] ?? null : s.order[(s.order.indexOf(s.guesser) + 1) % s.order.length] ?? null;
    if (s.guesser) s.played[s.guesser] = (s.played[s.guesser] ?? 0) + 1;
  }
  s.cards = [];
  s.deck = [];
  s.startedAt = null;
  const mode = ctx.options.catMode;
  s.cat = mode === "mix" ? "mix" : mode === "random" ? randomCat(ctx.options, s.custom) : null;
  s.phase = s.cat ? "ready" : "pick";
}

// ---------- Bombe ----------
function newBombWord(s: StirnState, o: Options) {
  const cat = randomCat(o, []);
  s.cat = cat;
  const w = wordsFor(s, cat, o)[0] ?? null;
  s.word = w;
  if (w) s.used.push(w);
}

function startBombRound(s: StirnState, ctx: GameContext, holder: string | null) {
  s.holder = holder && s.order.includes(holder) ? holder : s.order[s.turn % Math.max(1, s.order.length)] ?? null;
  s.word = null;
  s.boomAt = null;
  s.passes = 0;
  s.cat = null;
  s.phase = "ready";
  void ctx;
}

function lightFuse(s: StirnState, ctx: GameContext) {
  s.boomAt = ctx.now + (FUSE.min + randomInt(FUSE.max - FUSE.min + 1)) * 1000;
  s.startedAt = ctx.now;
  newBombWord(s, ctx.options);
  s.phase = "bomb";
}

function explode(s: StirnState, ctx: GameContext) {
  const who = s.holder;
  if (who) s.bombs[who] = (s.bombs[who] ?? 0) + 1;
  addLog(s, `Runde ${s.turn + 1}: Die Bombe geht bei ${nameOf(ctx, who)} hoch (${s.passes} Begriffe).`);
  s.boomAt = null;
  s.turn++;
  s.phase = s.turn >= s.turns ? "over" : "boom";
}

const nextOf = (s: StirnState, id: string | null) => {
  const i = id ? s.order.indexOf(id) : -1;
  return s.order[(i + 1) % s.order.length] ?? null;
};

// ---------- Hochstapler ----------
function dealImpostor(s: StirnState, ctx: GameContext) {
  const o = ctx.options;
  const cats = catsUpTo(levelOf(o.level)).filter((c) => !c.style);
  const cat = cats[randomInt(cats.length)] ?? CATEGORIES[0];
  s.cat = cat.id;
  const w = wordsFor(s, cat.id, o)[0] ?? `${cat.id}:0`;
  s.word = w;
  s.used.push(w);
  s.impostor = s.order[randomInt(s.order.length)] ?? null;
  s.seen = [];
  s.votes = {};
  const start = s.turn % Math.max(1, s.order.length);
  s.speakOrder = [...s.order.slice(start), ...s.order.slice(0, start)];
  // Der Hochstapler soll nicht immer anfangen – wäre er vorn, rückt er eins nach hinten
  if (s.speakOrder[0] === s.impostor && s.speakOrder.length > 1) s.speakOrder.push(s.speakOrder.shift()!);
  s.speaker = 0;
  // Auswahl für den Tipp des Hochstaplers: der Begriff und sieben andere derselben Kategorie
  const others = shuffle(wordIds(cat).filter((x) => x !== w)).slice(0, 7);
  s.options = shuffle([w, ...others]);
  s.result = null;
  s.phase = "look";
}

function finishImpostor(s: StirnState, ctx: GameContext, r: { caught: boolean; accused: string | null; guessed: string | null }) {
  const imp = s.impostor!;
  const right = r.guessed !== null && r.guessed === s.word;
  const winner: ImpostorResult["winner"] = !r.caught || right ? "impostor" : "group";
  const points: Record<string, number> = {};
  for (const id of s.order) {
    const p = id === imp ? (!r.caught ? IMPOSTOR_POINTS.escaped : right ? IMPOSTOR_POINTS.guessed : 0) : winner === "group" ? IMPOSTOR_POINTS.group : 0;
    points[id] = p;
    s.scores[id] = (s.scores[id] ?? 0) + p;
  }
  s.result = { impostor: imp, word: s.word!, caught: r.caught, accused: r.accused, guessed: r.guessed, winner, points };
  addLog(s, `Runde ${s.turn + 1}: ${nameOf(ctx, imp)} war Hochstapler – ${winner === "impostor" ? "gewinnt" : "entlarvt"} (${wordText(s.word)}).`);
  s.turn++;
  s.phase = s.turn >= s.turns ? "over" : "reveal";
}

function judgeImpostor(s: StirnState, ctx: GameContext, accused: string | null) {
  if (accused !== null && accused === s.impostor) {
    s.phase = "guess";
    addLog(s, `${nameOf(ctx, accused)} ist entlarvt – darf aber noch den Begriff raten.`);
    return;
  }
  finishImpostor(s, ctx, { caught: false, accused, guessed: null });
}

// ---------- Zug beenden (Klassisch, Teams) ----------
function toReview(s: StirnState) {
  // Die Karte, die beim Ablauf noch offen war, zählt nicht
  if (s.cards.length && s.cards[s.cards.length - 1].r === null) s.cards.pop();
  s.deck = [];
  s.phase = "review";
}

function confirmTurn(s: StirnState, ctx: GameContext) {
  const hits = s.cards.filter((c) => c.r === "hit");
  for (const c of hits) {
    if (s.variant === "teams") {
      const t = c.open && c.team !== null ? c.team : s.team!;
      if (t >= 0 && t < s.teamScores.length) s.teamScores[t]++;
    } else if (s.guesser && s.order.includes(s.guesser)) s.scores[s.guesser] = (s.scores[s.guesser] ?? 0) + 1;
  }
  for (const c of s.cards) if (!s.used.includes(c.w)) s.used.push(c.w);
  s.last = { guesser: s.guesser!, team: s.team, cat: s.cat ?? "", hits: hits.length, passes: s.cards.length - hits.length };
  addLog(s, `${nameOf(ctx, s.guesser)}${s.team !== null ? ` (${teamName(s.team)})` : ""}: ${hits.length} erraten · ${catName(s.cat)}`);
  s.turn++;
  if (s.turn >= s.turns) { s.phase = "over"; s.guesser = null; return; }
  startTurn(s, ctx);
}

function setup(ctx: GameContext): StirnState {
  const o = ctx.options;
  const variant = variantOf(o);
  const order = ctx.players.map((p) => p.id);
  const rounds = Math.max(1, Math.min(Number(o.rounds) || 2, 20));
  const teams = variant === "teams" ? makeTeams(order, teamCount(o, order.length)) : [];
  const s: StirnState = {
    v: 1, variant, phase: "pick", order, teams, teamScores: teams.map(() => 0),
    scores: Object.fromEntries(order.map((id) => [id, 0])), turn: 0,
    turns: usesForehead(variant) ? rounds * (variant === "teams" ? teams.length : order.length) : rounds, rounds, played: {},
    guesser: null, team: null, cat: null, cards: [], deck: [], startedAt: null,
    seconds: Math.max(30, Math.min(Number(o.seconds) || 60, 240)), used: [], custom: [], last: null,
    holder: null, word: null, boomAt: null, bombs: Object.fromEntries(order.map((id) => [id, 0])), passes: 0,
    impostor: null, seen: [], speaker: 0, speakOrder: [], votes: {}, options: [], result: null, log: [],
  };
  // „Nochmal“: der Startspieler wandert weiter
  if (usesForehead(variant)) startTurn(s, ctx, order[(ctx.round ?? 0) % Math.max(1, order.length)] ?? null);
  else if (variant === "bombe") startBombRound(s, ctx, order[ctx.round ? ctx.round % order.length : 0]);
  else dealImpostor(s, ctx);
  return s;
}

function apply(prev: StirnState, a: StirnAction, ctx: GameContext): StirnState {
  const s = structuredClone(prev);
  const local = ctx.actorId === null;
  const me = local ? null : ctx.actorId;
  const host = local || ctx.actorId === ctx.hostId;
  const known = (id: unknown): id is string => typeof id === "string" && s.order.includes(id);
  const teamOf = (id: string | null) => s.teams.findIndex((t) => id !== null && t.includes(id));
  /** Wer darf den Zug steuern? Lokal alle, online der Ratende, sein Team und der Host */
  const steers = () => host || me === s.guesser || (s.variant === "teams" && s.team !== null && teamOf(me) === s.team);

  switch (a.type) {
    case "pick": {
      if (s.phase !== "pick") throw new GameError("Die Kategorie steht schon.");
      if (!steers()) throw new GameError(`${nameOf(ctx, s.guesser)} wählt die Kategorie.`);
      if (typeof a.cat !== "string") throw new GameError("Welche Kategorie?");
      if (a.cat !== "mix" && !choosable(ctx.options, s.custom).includes(a.cat)) throw new GameError("Diese Kategorie gibt es hier nicht.");
      s.cat = a.cat;
      s.phase = "ready";
      return s;
    }
    case "custom": {
      if (s.phase !== "pick" && s.phase !== "ready") throw new GameError("Eigene Begriffe gehen vor dem Zug.");
      if (!Array.isArray(a.words)) throw new GameError("Keine Begriffe.");
      const words = [...new Set(a.words.filter((w): w is string => typeof w === "string").map((w) => w.trim().replace(/\s+/g, " ").slice(0, 40)).filter(Boolean))];
      if (!words.length) throw new GameError("Schreib mindestens einen Begriff.");
      // Neue hinten anhängen – schon gespielte Kennungen bleiben gültig
      for (const w of words) if (!s.custom.includes(w) && s.custom.length < MAX_CUSTOM) s.custom.push(w);
      addLog(s, `${words.length} eigene Begriffe dazu (jetzt ${s.custom.length}).`);
      return s;
    }
    case "start": {
      if (s.phase !== "ready") throw new GameError("Gerade gibt es nichts zu starten.");
      if (s.variant === "bombe") {
        if (!host && me !== s.holder) throw new GameError(`${nameOf(ctx, s.holder)} hat die Bombe.`);
        lightFuse(s, ctx);
        return s;
      }
      if (!steers()) throw new GameError(`${nameOf(ctx, s.guesser)} startet.`);
      const deck = wordsFor(s, s.cat ?? "mix", ctx.options);
      if (!deck.length) throw new GameError("In dieser Kategorie gibt es keine Begriffe.");
      s.deck = deck;
      s.cards = [card(s.deck.shift()!, ctx.options, 0, s.variant)];
      s.startedAt = ctx.now;
      s.phase = "play";
      return s;
    }
    case "mark": {
      // Sensor und Finger können doppelt melden: nur die aktuelle Karte zählt, sonst still ignorieren
      if (s.phase !== "play" || a.i !== s.cards.length - 1) return prev;
      if (a.r !== "hit" && a.r !== "pass") throw new GameError("Erraten oder überspringen?");
      if (!steers()) throw new GameError(`${nameOf(ctx, s.guesser)} rät gerade.`);
      const end = deadlineOf(s);
      if (end !== null && ctx.now > end + GRACE) { toReview(s); return s; }
      s.cards[a.i].r = a.r;
      const w = s.deck.shift();
      if (w) s.cards.push(card(w, ctx.options, s.cards.length, s.variant));
      else toReview(s);
      return s;
    }
    case "timeUp": {
      // Jedes Handy meldet das Ende – gezählt wird nur das erste, und nur wenn die Zeit wirklich um ist
      const end = deadlineOf(s);
      if (end === null || ctx.now < end - GRACE) return prev;
      toReview(s);
      return s;
    }
    case "stop": {
      if (s.phase !== "play") return prev;
      if (!steers()) throw new GameError(`${nameOf(ctx, s.guesser)} rät gerade.`);
      toReview(s);
      return s;
    }
    case "fix": {
      if (s.phase !== "review") throw new GameError("Korrigieren geht nach dem Zug.");
      if (!steers()) throw new GameError("Korrigieren darf das ratende Team oder der Host.");
      const c = s.cards[a.i];
      if (!c) throw new GameError("Diese Karte gibt es nicht.");
      if (a.r === "hit" || a.r === "pass") c.r = a.r;
      if (a.team !== undefined) {
        if (!c.open) throw new GameError("Nur offene Karten dürfen alle raten.");
        if (a.team !== null && !(Number.isInteger(a.team) && a.team >= 0 && a.team < s.teams.length)) throw new GameError("Dieses Team gibt es nicht.");
        c.team = a.team === s.team ? null : a.team;
        if (a.team !== null) c.r = "hit";
      }
      return s;
    }
    case "confirm": {
      if (s.phase !== "review") throw new GameError("Der Zug läuft noch.");
      if (!steers()) throw new GameError("Weiter geht's, wenn das ratende Team bestätigt.");
      confirmTurn(s, ctx);
      return s;
    }

    // ---------- Bombe ----------
    case "pass": {
      if (s.phase !== "bomb" || a.n !== s.passes) return prev;
      if (!host && me !== s.holder) throw new GameError(`${nameOf(ctx, s.holder)} hat die Bombe.`);
      if (s.boomAt !== null && ctx.now >= s.boomAt) { explode(s, ctx); return s; }
      s.passes++;
      s.holder = nextOf(s, s.holder);
      newBombWord(s, ctx.options);
      return s;
    }
    case "swap": {
      if (s.phase !== "bomb" || a.n !== s.passes) return prev;
      if (!host && me !== s.holder) throw new GameError(`${nameOf(ctx, s.holder)} hat die Bombe.`);
      if (s.boomAt !== null && ctx.now >= s.boomAt) { explode(s, ctx); return s; }
      newBombWord(s, ctx.options);
      return s;
    }
    case "tick": {
      if (s.phase !== "bomb" || s.boomAt === null || ctx.now < s.boomAt) return prev;
      explode(s, ctx);
      return s;
    }
    case "next": {
      if (s.phase === "boom") { startBombRound(s, ctx, s.holder); return s; }
      if (s.phase === "reveal") { dealImpostor(s, ctx); return s; }
      throw new GameError("Die Runde läuft noch.");
    }

    // ---------- Hochstapler ----------
    case "seen": {
      if (s.phase !== "look") throw new GameError("Die Karten sind schon verteilt.");
      const who = local ? a.player : me;
      if (!known(who)) throw new GameError("Wer schaut gerade?");
      if (!s.seen.includes(who)) s.seen.push(who);
      if (s.order.every((id) => s.seen.includes(id))) s.phase = "talk";
      return s;
    }
    case "said": {
      if (s.phase !== "talk") throw new GameError("Gerade sagt niemand etwas.");
      const cur = s.speakOrder[s.speaker % s.speakOrder.length];
      if (!host && me !== cur) throw new GameError(`${nameOf(ctx, cur)} ist dran.`);
      s.speaker++;
      if (s.speaker >= s.speakOrder.length * LAPS) s.phase = "vote";
      return s;
    }
    case "vote": {
      if (s.phase !== "vote") throw new GameError("Gerade wird nicht abgestimmt.");
      if (local || !known(me)) throw new GameError("Online stimmt jeder am eigenen Handy ab.");
      if (!known(a.target) || a.target === me) throw new GameError("Stimme für jemand anderen.");
      s.votes[me] = a.target;
      if (s.order.every((id) => id in s.votes)) judgeImpostor(s, ctx, tally(s.votes, s.order, ctx.options));
      return s;
    }
    case "verdict": {
      if (s.phase !== "vote") throw new GameError("Gerade wird nicht abgestimmt.");
      if (!local && !host) throw new GameError("Online stimmt jeder am eigenen Handy ab.");
      if (a.target !== null && !known(a.target)) throw new GameError("Diesen Spieler gibt es nicht.");
      judgeImpostor(s, ctx, a.target);
      return s;
    }
    case "guess": {
      if (s.phase !== "guess") throw new GameError("Gerade rät niemand.");
      if (!local && me !== s.impostor && !host) throw new GameError("Raten darf nur der Hochstapler.");
      if (typeof a.word !== "string" || !s.options.includes(a.word)) throw new GameError("Diesen Begriff gibt es nicht.");
      finishImpostor(s, ctx, { caught: true, accused: s.impostor, guessed: a.word });
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/** Was jeder sehen darf: keinen Stapel, keine Lunte; der Fernseher nie den Begriff, der Hochstapler nicht den Begriff */
function view(s: StirnState, viewer: string | null): StirnState {
  if (viewer === null) return s;
  const player = s.order.includes(viewer);
  const out: StirnState = { ...s, deck: [], boomAt: null };
  // Zuschauer und Fernseher: der Ratende schaut mit auf den Bildschirm – Begriff erst nach dem Zug
  if (!player || viewer === WATCH_ID) {
    if (s.phase === "play") out.cards = s.cards.map((c, i) => (i === s.cards.length - 1 ? { ...c, w: "" } : c));
    if (s.phase === "bomb") out.word = null;
  }
  if (s.variant === "hochstapler" && s.phase !== "reveal" && s.phase !== "over") {
    const isImp = viewer === s.impostor;
    if (isImp || !player || viewer === WATCH_ID) out.word = null;
    out.impostor = isImp ? viewer : null;
    out.votes = Object.fromEntries(Object.entries(s.votes).map(([id, t]) => [id, id === viewer ? t : "?"]));
    if (s.phase !== "guess") out.options = [];
  }
  return out;
}

export const stirnraten: GameLogic<StirnState, StirnAction> = {
  info: {
    id: "stirnraten",
    name: "Stirnraten",
    tagline: "Handy an die Stirn – die anderen erklären, du rätst.",
    category: "Party",
    minPlayers: 2,
    maxPlayers: 20,
    duration: "20 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: false,
  settings: [
    {
      key: "variant", label: "Variante", type: "choice", default: "klassisch",
      choices: [
        { value: "klassisch", label: "Klassisch", hint: "reihum, jeder für sich" },
        { value: "teams", label: "Teams", hint: "das eigene Team erklärt" },
        { value: "bombe", label: "Bombe", hint: "erklären und weitergeben, bis es knallt" },
        { value: "hochstapler", label: "Hochstapler", hint: "einer kennt den Begriff nicht" },
      ],
    },
    { key: "teams", label: "Teams", type: "number", default: 2, min: 2, max: 8, step: 1, showIf: (o) => variantOf(o) === "teams" },
    { key: "seconds", label: "Zeit pro Zug (s)", type: "number", default: 60, min: 30, max: 240, step: 15, showIf: (o) => usesForehead(variantOf(o)) },
    { key: "rounds", label: "Runden", type: "number", default: 2, min: 1, max: 20, step: 1 },
    {
      key: "level", label: "Stufe", type: "choice", default: "familie", group: "Begriffe",
      choices: LEVELS.map((l) => ({ value: l.id, label: l.name, hint: l.hint })),
    },
    {
      key: "catMode", label: "Kategorie", type: "choice", default: "pick", group: "Begriffe", showIf: (o) => usesForehead(variantOf(o)),
      choices: [
        { value: "pick", label: "Ratende wählt", hint: "vor jedem Zug" },
        { value: "random", label: "Zufall", hint: "eine Kategorie je Zug" },
        { value: "mix", label: "Bunt gemischt", hint: "aus allen Kategorien" },
      ],
    },
    ...STYLES.filter((st) => st.id !== "erklaeren").map((st) => ({
      key: `style_${st.id}`, label: `${st.emoji} ${st.name}`, type: "toggle" as const, default: false, group: "Darstellung", hint: st.hint,
      showIf: (o: Options) => variantOf(o) !== "hochstapler",
    })),
    { key: "open", label: "Offene Runde", type: "toggle", default: false, group: "Darstellung", hint: "Jede 4. Karte dürfen alle Teams raten", showIf: (o) => variantOf(o) === "teams" },
    { key: "video", label: "Video der Runde", type: "toggle", default: true, group: "Ablauf", hint: "Das Stirn-Handy filmt die Erklärenden – bleibt nur auf dem Gerät", showIf: (o) => usesForehead(variantOf(o)) },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt an, wer dran ist und wie es ausgeht (online: das Handy des Hosts)" },
  ],
  playerLimits: (o) => (variantOf(o) === "hochstapler" ? { min: 3, max: 20 } : variantOf(o) === "teams" ? { min: 2, max: 20, note: "Teams werden abwechselnd verteilt" } : { min: 2, max: 20 }),
  setup,
  apply,
  actionKind: (a) => (["pick", "custom", "start", "mark", "timeUp", "stop", "fix", "confirm", "pass", "swap", "tick", "next", "seen", "said", "vote", "verdict", "guess"].includes(a.type) ? "player" : null),
  currentPlayerId: (s) => (s.phase === "bomb" || (s.variant === "bombe" && s.phase === "ready") ? s.holder : s.phase === "talk" ? s.speakOrder[s.speaker % s.speakOrder.length] ?? null : usesForehead(s.variant) && s.phase !== "over" ? s.guesser : null),
  isOver: (s) => s.phase === "over",
  results: (s) => {
    if (s.variant === "teams") {
      const max = Math.max(...s.teamScores);
      return s.teams.flatMap((t, i) => t.map((id) => ({ id, won: s.teamScores[i] === max, score: s.teamScores[i] })));
    }
    if (s.variant === "bombe") {
      const min = Math.min(...s.order.map((id) => s.bombs[id] ?? 0));
      return s.order.map((id) => ({ id, won: (s.bombs[id] ?? 0) === min }));
    }
    const max = Math.max(...s.order.map((id) => s.scores[id] ?? 0));
    return s.order.map((id) => ({ id, won: (s.scores[id] ?? 0) === max, score: s.scores[id] ?? 0 }));
  },
  skipLabel: (s) => {
    switch (s.phase) {
      case "pick": return "Zufällige Kategorie";
      case "ready": return s.variant === "bombe" ? "Bombe zünden" : "Zug starten";
      case "play": return "Zeit beenden";
      case "review": return "Ergebnis übernehmen";
      case "bomb": return "Bombe hochgehen lassen";
      case "boom": case "reveal": return "Nächste Runde";
      case "look": return "Alle haben geschaut";
      case "talk": return "Weiter zum Abstimmen";
      case "vote": return "Abstimmung auswerten";
      case "guess": return "Hochstapler rät nicht";
      default: return null;
    }
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    const c = { ...ctx, actorId: null };
    switch (s.phase) {
      case "pick": s.cat = randomCat(ctx.options, s.custom); s.phase = "ready"; return s;
      case "ready": return apply(prev, { type: "start" }, c);
      case "play": toReview(s); return s;
      case "review": confirmTurn(s, ctx); return s;
      case "bomb": explode(s, ctx); return s;
      case "boom": case "reveal": return apply(prev, { type: "next" }, c);
      case "look": s.seen = [...s.order]; s.phase = "talk"; return s;
      case "talk": s.phase = "vote"; return s;
      case "vote": judgeImpostor(s, ctx, Object.keys(s.votes).length ? tally(s.votes, s.order, ctx.options) : null); return s;
      case "guess": finishImpostor(s, ctx, { caught: true, accused: s.impostor, guessed: null }); return s;
      default: return s;
    }
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!s.order.includes(id)) return s;
    const was = { guesser: s.guesser === id, holder: s.holder === id, impostor: s.impostor === id };
    const nextHolder = nextOf(s, id);
    const teamWas = s.teams.findIndex((t) => t.includes(id));
    s.order = s.order.filter((x) => x !== id);
    delete s.scores[id];
    delete s.bombs[id];
    s.teams = s.teams.map((t) => t.filter((x) => x !== id));
    s.seen = s.seen.filter((x) => x !== id);
    delete s.votes[id];
    for (const [v, t] of Object.entries(s.votes)) if (t === id) delete s.votes[v];
    const spoken = s.speakOrder.indexOf(id);
    if (spoken >= 0) {
      s.speakOrder = s.speakOrder.filter((x) => x !== id);
      if (spoken < s.speaker % (s.speakOrder.length + 1)) s.speaker = Math.max(0, s.speaker - 1);
    }
    if (!s.order.length || s.phase === "over") return s;
    // Leere Teams: Zug rückt einfach weiter (Team bleibt mit 0 Mitgliedern stehen, bekommt keinen Zug mehr)
    if (s.variant === "teams" && s.teams.filter((t) => t.length).length < 2) { s.phase = "over"; return s; }
    if (usesForehead(s.variant)) {
      // Züge, die der Spieler (bzw. sein jetzt leeres Team) noch gehabt hätte, fallen weg
      if (s.variant === "klassisch") s.turns -= Math.max(0, s.rounds - (s.played[id] ?? 0));
      else if (teamWas >= 0 && !s.teams[teamWas].length) s.turns -= Math.max(0, s.rounds - (s.played[`t${teamWas}`] ?? 0));
      if (was.guesser && s.phase !== "review") {
        // Laufender Zug zählt als gespielt, ohne Wertung – der Nächste ist dran
        s.cards = [];
        s.deck = [];
        s.turn++;
        if (s.turn >= s.turns) { s.phase = "over"; s.guesser = null; return s; }
        startTurn(s, ctx, s.variant === "klassisch" ? nextHolder : undefined);
        return s;
      }
      if (s.turn >= s.turns && s.phase !== "review") s.phase = "over";
      return s;
    }
    if (s.variant === "bombe" && was.holder) s.holder = s.order.includes(nextHolder ?? "") ? nextHolder : s.order[0];
    if (s.variant === "hochstapler") {
      if (was.impostor && ["look", "talk", "vote", "guess"].includes(s.phase)) {
        if (s.order.length < 2) { s.phase = "over"; return s; }
        addLog(s, `${nameOf(ctx, id)} hat das Spiel verlassen – neue Karten.`);
        dealImpostor(s, ctx);
        return s;
      }
      if (s.phase === "look" && s.order.every((x) => s.seen.includes(x))) s.phase = "talk";
      if (s.phase === "talk" && s.speaker >= s.speakOrder.length * LAPS) s.phase = "vote";
      if (s.phase === "vote" && s.order.every((x) => x in s.votes)) judgeImpostor(s, ctx, tally(s.votes, s.order, ctx.options));
    }
    return s;
  },
  view,
};

/** Wer erklärt in diesem Zug? (für die Anzeige) */
export function explainers(s: StirnState): string[] {
  if (s.variant === "teams" && s.team !== null) {
    const mates = (s.teams[s.team] ?? []).filter((id) => id !== s.guesser);
    return mates.length ? mates : s.order.filter((id) => id !== s.guesser);
  }
  return s.order.filter((id) => id !== s.guesser);
}

/** Rangliste für die Anzeige: Teams oder Spieler mit Punkten (bei der Bombe: Bomben, weniger ist besser) */
export function standings(s: StirnState): { key: string; label: string; ids: string[]; score: number }[] {
  if (s.variant === "teams") return s.teams.map((t, i) => ({ key: `t${i}`, label: teamName(i), ids: t, score: s.teamScores[i] ?? 0 })).sort((a, b) => b.score - a.score);
  if (s.variant === "bombe") return s.order.map((id) => ({ key: id, label: id, ids: [id], score: s.bombs[id] ?? 0 })).sort((a, b) => a.score - b.score);
  return s.order.map((id) => ({ key: id, label: id, ids: [id], score: s.scores[id] ?? 0 })).sort((a, b) => b.score - a.score);
}
