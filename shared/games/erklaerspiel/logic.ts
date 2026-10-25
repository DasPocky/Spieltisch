/**
 * Erklärspiel – Teams, reihum erklärt einer seinem Team Begriffe, ohne das Wort (oder Teile davon) zu sagen.
 * Der Erklärer sieht die Begriffe am eigenen Handy und tippt „Richtig“ oder „Weiter“, bis die Zeit um ist.
 * Danach kurze Bestätigung (Gegner oder Host können einen Treffer zurücknehmen), dann ist das nächste Team dran.
 * Spielarten: Erklären (Standard), Ein Wort, Pantomime – und „Drei Runden“ mit denselben Begriffen
 * (erst erklären, dann ein Wort, dann Pantomime; eine Runde endet, wenn alle Begriffe erraten sind).
 *
 * Zeit nur aus `ctx.now`. Den Begriff sehen während des Zugs nur der Erklärer und (Einstellung) das gegnerische
 * Team zur Kontrolle – nie das ratende Team und nie der Fernseher.
 */
import { shuffle } from "../../platform/random";
import { WATCH_ID } from "../../platform/protocol";
import { playerName } from "../../platform/turns";
import { mergedContent, OWN_MIN as OWN_MINS } from "../../platform/cardsets";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";
import { LEVELS, OWN_WORD, wordIds, wordText } from "../stirnraten/cards";
import { makeTeams, TEAM_NAMES, teamName } from "../stirnraten/logic";
import { activeCats, THEMES, themeShown } from "./themes";

export { TEAM_NAMES, teamName };

export type Variant = "klassisch" | "einwort" | "pantomime" | "drei";
export type Style = "erklaeren" | "einwort" | "pantomime";
export type Phase = "ready" | "play" | "review" | "over";

/** `w` fehlt in fremder Sicht während des Zugs */
export interface Card { w: string; r: "hit" | "pass" | null }
export interface TurnResult { explainer: string; team: number; hits: number; passes: number; points: number; style: Style }

export interface ErkState {
  v: 1;
  variant: Variant;
  phase: Phase;
  order: string[];
  teams: string[][];
  teamScores: number[];
  /** gespielte Züge und Züge insgesamt (Drei Runden: Obergrenze, die Runden enden vorher) */
  turn: number;
  turns: number;
  rounds: number;
  /** Züge je Team bisher („t0“ …) – wer im Team als Nächstes erklärt */
  played: Record<string, number>;
  team: number | null;
  explainer: string | null;
  /** Drei Runden: 0 Erklären, 1 Ein Wort, 2 Pantomime; erster Zug der aktuellen Runde */
  stage: number;
  stageTurn: number;
  cards: Card[];
  /** Stapel des Zugs bzw. (Drei Runden) noch nicht erratene Begriffe – in jeder fremden Sicht leer */
  pile: string[];
  /** so viele Begriffe liegen noch (für alle sichtbar) */
  left: number;
  /** Drei Runden: alle Begriffe der Partie – fremde Sicht leer */
  pool: string[];
  poolSize: number;
  startedAt: number | null;
  seconds: number;
  /** Überspringen kostet einen Punkt */
  minus: boolean;
  /** Das gegnerische Team sieht den Begriff zur Kontrolle */
  control: boolean;
  /** gespielte Begriffe (keine Wiederholung) – fremde Sicht leer */
  used: string[];
  /** eigene Begriffe (Kartensets, „x:<Begriff>“) – fremde Sicht leer */
  own: string[];
  ownOnly: boolean;
  last: TurnResult | null;
  log: string[];
}

export type ErkAction =
  | { type: "start" }
  | { type: "mark"; i: number; r: "hit" | "pass" }
  | { type: "timeUp" }
  | { type: "stop" }
  | { type: "fix"; i: number }
  | { type: "confirm" };

export const OWN_MIN = OWN_MINS.zeichnen;
const MAX_LOG = 40;
/** Zeitpuffer für Meldungen, die kurz nach Ablauf eintreffen */
const GRACE = 1500;
/** so viele Begriffe zieht ein Zug höchstens */
const DECK = 80;
/** Drei Runden: spätestens nach so vielen Zügen je Team ist Schluss (falls niemand mehr etwas errät) */
const MAX_TURNS_PER_TEAM = 15;

export const STYLES: Record<Style, { name: string; emoji: string; hint: string; rule: string }> = {
  erklaeren: { name: "Erklären", emoji: "💬", hint: "mit Worten – ohne das Wort oder Teile davon", rule: "Erklärt mit Worten, aber sagt das Wort nicht und keine Teile davon." },
  einwort: { name: "Ein Wort", emoji: "☝️", hint: "nur ein einziges Wort sagen", rule: "Der Erklärer darf je Begriff nur ein einziges Wort sagen." },
  pantomime: { name: "Pantomime", emoji: "🤐", hint: "nur zeigen – kein Wort, kein Laut", rule: "Nur zeigen, kein Wort und kein Laut." },
};
export const STAGES: Style[] = ["erklaeren", "einwort", "pantomime"];

const addLog = (s: ErkState, line: string) => { s.log.push(line); if (s.log.length > MAX_LOG) s.log.shift(); };
const nameOf = playerName;

export const variantOf = (o: Options): Variant => (o.variant === "einwort" || o.variant === "pantomime" || o.variant === "drei" ? o.variant : "klassisch");
export const styleOf = (s: Pick<ErkState, "variant" | "stage">): Style => (s.variant === "drei" ? STAGES[Math.min(2, s.stage)] : s.variant === "klassisch" ? "erklaeren" : s.variant);
const teamCount = (o: Options, n: number) => Math.max(2, Math.min(Number(o.teams) || 2, 4, Math.floor(n / 2) || 2));

/** Ende des Zugs in ms – null, wenn keine Uhr läuft */
export const deadlineOf = (s: ErkState): number | null => (s.phase === "play" && s.startedAt !== null ? s.startedAt + s.seconds * 1000 : null);
export const teamOf = (s: ErkState, id: string | null) => (id === null ? -1 : s.teams.findIndex((t) => t.includes(id)));
/** Punkte eines Zugs: erratene Begriffe (jeder einmal), Minuspunkt je Überspringen falls eingestellt */
export function turnPoints(s: ErkState): { hits: number; passes: number; points: number } {
  // in fremder Sicht fehlt der Begriff – dann zählt jede Karte für sich
  const hits = new Set(s.cards.map((c, i) => (c.r === "hit" ? c.w ?? i : null)).filter((x) => x !== null)).size;
  const passes = s.cards.filter((c) => c.r === "pass").length;
  return { hits, passes, points: hits - (s.minus ? passes : 0) };
}
/** Ist das die erste Runde einer neuen Stufe (Drei Runden)? */
export const stageStart = (s: ErkState) => s.variant === "drei" && s.turn === s.stageTurn;

/** Begriffe aus Themen und eigenen Sets, ungespielte zuerst */
function freshWords(s: ErkState, o: Options, n: number): string[] {
  const builtIn = s.ownOnly ? [] : activeCats(o).flatMap(wordIds);
  const pool = [...s.own, ...builtIn];
  const fresh = pool.filter((w) => !s.used.includes(w));
  return [...shuffle(fresh), ...shuffle(pool.filter((w) => s.used.includes(w)))].slice(0, n);
}

function sync(s: ErkState) { s.left = s.variant === "drei" ? s.pile.length : 0; }

/** Nächster Zug: nächstes Team mit Mitgliedern, darin der Nächste */
function startTurn(s: ErkState) {
  let t = s.team === null ? 0 : (s.team + 1) % s.teams.length;
  for (let k = 0; k < s.teams.length && !s.teams[t].length; k++) t = (t + 1) % s.teams.length;
  const members = s.teams[t];
  const n = s.played[`t${t}`] ?? 0;
  s.team = t;
  s.explainer = members[n % members.length] ?? null;
  s.played[`t${t}`] = n + 1;
  s.cards = [];
  if (s.variant !== "drei") s.pile = [];
  s.startedAt = null;
  s.phase = "ready";
}

/** Zug endet: die offene Karte zählt nicht (Drei Runden: zurück in den Stapel) */
function toReview(s: ErkState) {
  const cur = s.cards.at(-1);
  if (cur && cur.r === null) {
    s.cards.pop();
    if (s.variant === "drei") s.pile.unshift(cur.w);
  }
  if (s.variant !== "drei") s.pile = [];
  s.startedAt = null;
  s.phase = "review";
}

function endGame(s: ErkState) { s.phase = "over"; s.explainer = null; s.startedAt = null; }

function confirmTurn(s: ErkState, ctx: GameContext) {
  const { hits, passes, points } = turnPoints(s);
  const t = s.team ?? 0;
  if (t < s.teamScores.length) s.teamScores[t] += points;
  const hit = new Set(s.cards.filter((c) => c.r === "hit").map((c) => c.w));
  if (s.variant === "drei") {
    // Was nicht erraten wurde, bleibt im Stapel; zurückgenommene Treffer kommen wieder hinein
    const back = s.cards.filter((c) => !hit.has(c.w)).map((c) => c.w);
    s.pile = [...new Set([...s.pile, ...back])].filter((w) => !hit.has(w));
  } else for (const c of s.cards) if (!s.used.includes(c.w)) s.used.push(c.w);
  s.last = { explainer: s.explainer ?? "", team: t, hits, passes, points, style: styleOf(s) };
  addLog(s, `${teamName(t)} · ${nameOf(ctx, s.explainer)}: ${hits} erraten${s.minus && passes ? `, ${passes} übersprungen` : ""} → ${points >= 0 ? "+" : ""}${points}`);
  s.turn++;
  s.cards = [];
  if (s.variant === "drei" && !s.pile.length) {
    s.stage++;
    if (s.stage >= STAGES.length) { endGame(s); sync(s); return; }
    s.pile = shuffle(s.pool);
    s.stageTurn = s.turn;
    addLog(s, `Runde ${s.stage + 1}: ${STYLES[styleOf(s)].name} – mit denselben Begriffen.`);
  }
  if (s.turn >= s.turns) { endGame(s); sync(s); return; }
  startTurn(s);
  sync(s);
}

function setup(ctx: GameContext): ErkState {
  const o = ctx.options;
  const variant = variantOf(o);
  const order = ctx.players.map((p) => p.id);
  const teams = makeTeams(order, teamCount(o, order.length));
  const rounds = Math.max(1, Math.min(Number(o.rounds) || 3, 10));
  const own = [...new Set(mergedContent(ctx.content).words.map((w) => w.trim()).filter((w) => w && !w.startsWith("bild:")))].map((w) => OWN_WORD + w);
  const s: ErkState = {
    v: 1, variant, phase: "ready", order, teams, teamScores: teams.map(() => 0), turn: 0,
    turns: variant === "drei" ? teams.length * MAX_TURNS_PER_TEAM : rounds * teams.length, rounds, played: {},
    team: null, explainer: null, stage: 0, stageTurn: 0, cards: [], pile: [], left: 0, pool: [], poolSize: 0, startedAt: null,
    seconds: Math.max(30, Math.min(Number(o.seconds) || 60, 180)), minus: o.minus === true, control: o.control !== false,
    used: [], own, ownOnly: own.length >= OWN_MIN && o.own_only === true, last: null, log: [],
  };
  if (variant === "drei") {
    s.pool = freshWords(s, o, Math.max(10, Math.min(Number(o.words) || 30, 80)));
    s.poolSize = s.pool.length;
    s.pile = shuffle(s.pool);
  }
  // „Nochmal“: ein anderes Team fängt an
  const first = (ctx.round ?? 0) % teams.length;
  s.team = (first - 1 + teams.length) % teams.length;
  startTurn(s);
  sync(s);
  return s;
}

function draw(s: ErkState): boolean {
  const w = s.pile.shift();
  if (!w) return false;
  s.cards.push({ w, r: null });
  return true;
}

function apply(prev: ErkState, a: ErkAction, ctx: GameContext): ErkState {
  const s = structuredClone(prev);
  const local = ctx.actorId === null;
  const me = local ? null : ctx.actorId;
  const host = local || ctx.actorId === ctx.hostId;
  const explains = local || me === s.explainer;
  /** Gegner: wer nicht im Team des Erklärers ist */
  const opponent = me !== null && s.order.includes(me) && teamOf(s, me) !== s.team;
  const done = (x: ErkState) => { sync(x); return x; };

  switch (a.type) {
    case "start": {
      if (s.phase !== "ready") throw new GameError("Gerade gibt es nichts zu starten.");
      if (!explains && !host) throw new GameError(`${nameOf(ctx, s.explainer)} startet den Zug.`);
      if (s.variant !== "drei") s.pile = freshWords(s, ctx.options, DECK);
      if (!draw(s)) throw new GameError("Es gibt keine Begriffe.");
      s.startedAt = ctx.now;
      s.phase = "play";
      return done(s);
    }
    case "mark": {
      // Doppelte Meldungen (zweimal getippt) still ignorieren: nur die aktuelle Karte zählt
      if (s.phase !== "play" || a.i !== s.cards.length - 1) return prev;
      if (a.r !== "hit" && a.r !== "pass") throw new GameError("Richtig oder weiter?");
      if (!explains) throw new GameError(`${nameOf(ctx, s.explainer)} erklärt gerade.`);
      const end = deadlineOf(s);
      if (end !== null && ctx.now > end + GRACE) { toReview(s); return done(s); }
      const c = s.cards[a.i];
      c.r = a.r;
      // Drei Runden: übersprungene Begriffe kommen unten wieder in den Stapel
      if (a.r === "pass" && s.variant === "drei") s.pile.push(c.w);
      if (!draw(s)) toReview(s);
      return done(s);
    }
    case "timeUp": {
      // Jedes Handy meldet das Ende – gezählt wird nur das erste, und nur wenn die Zeit wirklich um ist
      const end = deadlineOf(s);
      if (end === null || ctx.now < end - GRACE) return prev;
      toReview(s);
      return done(s);
    }
    case "stop": {
      if (s.phase !== "play") return prev;
      if (!explains && !host) throw new GameError(`${nameOf(ctx, s.explainer)} erklärt gerade.`);
      toReview(s);
      return done(s);
    }
    case "fix": {
      if (s.phase !== "review") throw new GameError("Korrigieren geht nach dem Zug.");
      const c = s.cards[a.i];
      if (!c) throw new GameError("Diesen Begriff gibt es nicht.");
      if (c.r === "hit") {
        // Treffer zurücknehmen: Gegner, Host oder der Erklärer selbst
        if (!explains && !host && !opponent) throw new GameError("Zurücknehmen dürfen die Gegner oder der Host.");
        c.r = "pass";
      } else {
        // Doch erraten: nur Erklärer oder Host (falsch getippt)
        if (!explains && !host) throw new GameError(`Nachtragen darf ${nameOf(ctx, s.explainer)} oder der Host.`);
        if (s.cards.some((x) => x !== c && x.w === c.w && x.r === "hit")) throw new GameError("Der Begriff zählt schon.");
        c.r = "hit";
      }
      return done(s);
    }
    case "confirm": {
      if (s.phase !== "review") throw new GameError("Der Zug läuft noch.");
      if (!explains && !host && !opponent) throw new GameError("Bestätigen dürfen die Gegner, der Erklärer oder der Host.");
      confirmTurn(s, ctx);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/** Darf dieser Zuschauer den Begriff während des Zugs sehen? */
export function seesWord(s: ErkState, viewer: string | null): boolean {
  if (viewer === null) return true;
  if (viewer === WATCH_ID || !s.order.includes(viewer)) return false;
  if (viewer === s.explainer) return true;
  return s.control && teamOf(s, viewer) !== s.team;
}

/** Was jeder sehen darf: keine Stapel; während des Zugs Begriffe nur für Erklärer (und Gegner zur Kontrolle) */
function view(s: ErkState, viewer: string | null): ErkState {
  if (viewer === null) return s;
  const out: ErkState = { ...s, pile: [], pool: [], used: [], own: [] };
  if (s.phase === "play" && !seesWord(s, viewer)) out.cards = s.cards.map((c) => ({ r: c.r }) as Card);
  return out;
}

export const erklaerspiel: GameLogic<ErkState, ErkAction> = {
  info: {
    id: "erklaerspiel",
    name: "Erklärspiel",
    tagline: "Im Team gegen die Uhr: Begriffe erklären, ohne das Wort zu sagen.",
    category: "Party",
    minPlayers: 4,
    maxPlayers: 16,
    duration: "30 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: false,
  presets: [
    { id: "pantomime", label: "Pantomime", hint: "nur zeigen, kein Wort", options: { variant: "pantomime" } },
    { id: "drei", label: "Drei Runden", hint: "erklären, ein Wort, zeigen", options: { variant: "drei" } },
  ],
  settings: [
    {
      key: "variant", label: "Spielart", type: "choice", default: "klassisch",
      choices: [
        { value: "klassisch", label: "Erklären", hint: "mit Worten, ohne das Wort" },
        { value: "einwort", label: "Ein Wort", hint: "nur ein Wort je Begriff" },
        { value: "pantomime", label: "Pantomime", hint: "nur zeigen" },
        { value: "drei", label: "Drei Runden", hint: "dieselben Begriffe: erklären, ein Wort, zeigen" },
      ],
    },
    { key: "teams", label: "Teams", type: "number", default: 2, min: 2, max: 4, step: 1 },
    { key: "seconds", label: "Zeit pro Zug (s)", type: "number", default: 60, min: 30, max: 180, step: 15 },
    { key: "rounds", label: "Züge je Team", type: "number", default: 3, min: 1, max: 10, step: 1, showIf: (o) => variantOf(o) !== "drei" },
    { key: "words", label: "Begriffe im Topf", type: "number", default: 30, min: 10, max: 80, step: 5, showIf: (o) => variantOf(o) === "drei" },
    { key: "minus", label: "Überspringen kostet einen Punkt", type: "toggle", default: false, group: "Hausregeln" },
    { key: "control", label: "Gegner sehen den Begriff", type: "toggle", default: true, group: "Ablauf", hint: "zur Kontrolle am eigenen Handy – das ratende Team nie" },
    { key: "narrate", label: "Vorlesen", type: "toggle", default: true, group: "Ablauf", hint: "Das Handy sagt an, wer erklärt und wie es steht (online: das Handy des Hosts)" },
    {
      key: "level", label: "Stufe", type: "choice", default: "familie", group: "Begriffe",
      choices: LEVELS.map((l) => ({ value: l.id, label: l.name, hint: l.hint })),
    },
    ...THEMES.map((t) => ({
      key: `th_${t.id}`, label: `${t.emoji} ${t.name}`, type: "toggle" as const, default: true, group: "Begriffe", chip: true,
      showIf: (o: Options) => themeShown(t, o),
    })),
    { key: "own_only", label: "Nur eigene Begriffe", hint: `statt der eingebauten Begriffe (ab ${OWN_MIN})`, type: "toggle", default: false, group: "Kartensets" },
  ],
  playerLimits: () => ({ min: 4, max: 16, note: "Teams werden abwechselnd verteilt (Reihenfolge der Spieler)" }),
  setup,
  apply,
  actionKind: (a) => (["start", "mark", "timeUp", "stop", "fix", "confirm"].includes(a.type) ? "player" : null),
  currentPlayerId: (s) => (s.phase === "ready" || s.phase === "play" ? s.explainer : null),
  isOver: (s) => s.phase === "over",
  results: (s) => {
    const max = Math.max(...s.teamScores);
    return s.teams.flatMap((t, i) => t.map((id) => ({ id, won: s.teamScores[i] === max, score: s.teamScores[i] })));
  },
  skipLabel: (s) => {
    if (s.phase === "ready") return (s.teams[s.team ?? 0]?.length ?? 0) > 1 ? "Jemand anderes erklärt" : "Zug überspringen";
    if (s.phase === "play") return "Zug beenden";
    if (s.phase === "review") return "Ergebnis übernehmen";
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "ready") {
      const t = s.team ?? 0;
      const members = s.teams[t] ?? [];
      if (members.length > 1) {
        // Der Nächste im Team erklärt (z. B. wenn der Erklärer offline ist) – der Zug bleibt beim Team
        const n = s.played[`t${t}`] ?? 1;
        s.played[`t${t}`] = n + 1;
        s.explainer = members[n % members.length];
        addLog(s, `Statt dessen erklärt ${nameOf(ctx, s.explainer)}.`);
        return s;
      }
      addLog(s, `${teamName(t)} setzt aus.`);
      s.turn++;
      if (s.turn >= s.turns) { endGame(s); return s; }
      startTurn(s);
      sync(s);
      return s;
    }
    if (s.phase === "play") { toReview(s); sync(s); return s; }
    if (s.phase === "review") { confirmTurn(s, ctx); return s; }
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!s.order.includes(id)) return s;
    const t = teamOf(s, id);
    const wasExplainer = s.explainer === id;
    s.order = s.order.filter((x) => x !== id);
    s.teams = s.teams.map((m) => m.filter((x) => x !== id));
    if (s.phase === "over") return s;
    if (s.teams.filter((m) => m.length).length < 2) { endGame(s); return s; }
    // Leeres Team: seine restlichen Züge fallen weg
    if (t >= 0 && !s.teams[t].length && s.variant !== "drei") s.turns -= Math.max(0, s.rounds - (s.played[`t${t}`] ?? 0));
    if (wasExplainer && (s.phase === "ready" || s.phase === "play")) {
      // Laufender Zug zählt als gespielt, ohne Wertung; Begriffe bleiben im Topf
      if (s.variant === "drei") s.pile = [...new Set([...s.pile, ...s.cards.map((c) => c.w)])];
      s.cards = [];
      addLog(s, `${nameOf(ctx, id)} ist gegangen – der Zug fällt aus.`);
      s.turn++;
      if (s.turn >= s.turns) { endGame(s); sync(s); return s; }
      startTurn(s);
      sync(s);
      return s;
    }
    if (s.turn >= s.turns && s.phase !== "review") endGame(s);
    sync(s);
    return s;
  },
  view,
};

/** Stand für die Anzeige: Teams mit Punkten, bester zuerst */
export function standings(s: ErkState): { team: number; label: string; ids: string[]; score: number }[] {
  return s.teams.map((ids, team) => ({ team, label: teamName(team), ids, score: s.teamScores[team] ?? 0 })).sort((a, b) => b.score - a.score);
}

/** Text eines Begriffs (eigene stehen in der Kennung) */
export const termText = (w: string) => wordText(w);
