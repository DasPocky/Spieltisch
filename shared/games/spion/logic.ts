/**
 * Spion – „Wer ist der Spion?“: Alle kennen denselben geheimen Ort, nur der Spion nicht.
 * Reihum stellen sich die Spieler Fragen (mündlich am Tisch, die App zeigt, wer fragt).
 * Jederzeit darf abgestimmt werden, nach Ablauf der Zeit wird es. Der Spion darf sich
 * jederzeit enttarnen und den Ort raten. Gespielt werden mehrere Runden mit Punkten.
 *
 * Online sieht jeder nur seine eigene Karte (view), lokal geht das Handy reihum.
 */
import { randomInt, shuffle } from "../../platform/random";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";
import { PACKS, PLACE_BY_ID, PLACES, placeName, type Pack } from "./places";

export type Phase = "look" | "talk" | "vote" | "guess" | "reveal" | "over";

/** Wie eine Runde ausgegangen ist */
export type Reason =
  | "guessRight"   // Spion hat sich enttarnt und den Ort erraten
  | "guessWrong"   // … und falsch geraten
  | "caught"       // Spion wurde verurteilt
  | "caughtGuess"  // verurteilt, aber mit der letzten Chance den Ort erraten (Hausregel)
  | "innocent"     // ein Unschuldiger wurde verurteilt
  | "time";        // Zeit um, Schlussabstimmung ohne Ergebnis

export interface RoundResult {
  round: number;
  place: string;
  spies: string[];
  winner: "spy" | "group";
  reason: Reason;
  accused: string | null;
  /** wer die erfolgreiche Abstimmung gestartet hat (Bonus) */
  by: string | null;
  guessed: string | null;
  points: Record<string, number>;
}

export interface SpionVote {
  /** wer die Abstimmung gestartet hat (null: Schlussabstimmung oder lokal ohne Angabe) */
  by: string | null;
  /** nach Ablauf der Zeit: scheitert sie, gewinnt der Spion */
  final: boolean;
  /** Spieler → Verdacht ("?" in fremder Sicht) */
  votes: Record<string, string>;
}

export interface SpionState {
  v: 1;
  round: number;
  rounds: number;
  phase: Phase;
  /** Ort der Runde – null in der Sicht eines Spions */
  place: string | null;
  /** Rolle je Spieler am Ort ("" für Spione oder ohne Rollen); fremde fehlen in der eigenen Sicht */
  roles: Record<string, string>;
  /** Spione – in der eigenen Sicht nur man selbst (oder leer) */
  spies: string[];
  /** Orte, die in dieser Partie vorkommen können (die Liste für alle) */
  pool: string[];
  /** schon gespielte Orte (ohne den aktuellen) */
  used: string[];
  /** wer seine Karte gesehen hat */
  seen: string[];
  /** wer gerade fragt */
  asker: string | null;
  /** wer zuletzt gefragt hat – den darf man nicht direkt zurückfragen */
  prevAsker: string | null;
  /** Beginn der Fragerunde, Pausen (für den Timer auf allen Handys) */
  startedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;
  minutes: number;
  /** Zeit ist um (Schlussabstimmung läuft oder lief) */
  timeUp: boolean;
  vote: SpionVote | null;
  /** wer in dieser Runde schon eine Abstimmung gestartet hat (je einmal pro Runde) */
  accusers: string[];
  /** Spion hat sich enttarnt und rät (caught: nach Verurteilung, letzte Chance) */
  guess: { spy: string; caught: boolean; by: string | null } | null;
  scores: Record<string, number>;
  last: RoundResult | null;
  log: string[];
}

export type SpionAction =
  | { type: "seen"; player?: string }
  | { type: "ask"; to: string }
  | { type: "accuse"; by?: string | null }
  | { type: "vote"; target: string }
  | { type: "verdict"; target: string | null }
  | { type: "cancelVote" }
  | { type: "reveal"; spy?: string }
  | { type: "guess"; place: string }
  | { type: "timeUp" }
  | { type: "nextRound" };

/** Wertung wie im Original: Spion 2 (Zeit um) bzw. 4 (Ort erraten / Unschuldiger verurteilt); andere je 1, wer die erfolgreiche Abstimmung gestartet hat 2 */
export const POINTS = { spyTime: 2, spyBig: 4, group: 1, accuser: 2 } as const;

const MAX_LOG = 40;
const ids = (s: SpionState) => Object.keys(s.scores);
const nameOf = (ctx: GameContext, id: string | null) => ctx.players.find((p) => p.id === id)?.name ?? "?";
const addLog = (s: SpionState, line: string) => { s.log.push(line); if (s.log.length > MAX_LOG) s.log.shift(); };

export const scoringOf = (o: Options) => (o.scoring === "rounds" ? "rounds" : "points");
export const verdictOf = (o: Options) => (o.verdict === "unanimous" ? "unanimous" : "majority");

/** Orte der gewählten Pakete (keins gewählt: alle) */
export function poolOf(o: Options): string[] {
  const packs = PACKS.map((p) => p.id).filter((p) => o[`pack_${p}`] !== false);
  const list = PLACES.filter((p) => packs.includes(p.pack as Pack));
  return (list.length ? list : PLACES).map((p) => p.id);
}

/** Wie viele Spione bei n Spielern? Zwei erst ab 5 Spielern. */
export const spyCount = (o: Options, n: number) => (o.spies === "2" && n >= 5 ? 2 : 1);

/** Restzeit-Ende in ms – null, wenn die Fragerunde nicht läuft */
export function deadlineOf(s: SpionState): number | null {
  if (s.startedAt === null || s.timeUp) return null;
  return s.startedAt + s.minutes * 60_000 + s.pausedMs;
}

/** Restzeit in ms zum Zeitpunkt `now` (bei Pause eingefroren) */
export function timeLeft(s: SpionState, now: number): number | null {
  const d = deadlineOf(s);
  if (d === null) return null;
  const at = s.pausedAt ?? now;
  return Math.max(0, d - at);
}

function deal(s: SpionState, ctx: GameContext, players: string[]) {
  let free = s.pool.filter((id) => !s.used.includes(id));
  if (!free.length) { s.used = []; free = s.pool.slice(); }
  const place = free[randomInt(free.length)];
  s.place = place;
  const order = shuffle(players);
  s.spies = order.slice(0, spyCount(ctx.options, players.length));
  const roles = shuffle(PLACE_BY_ID[place].roles);
  const withRoles = ctx.options.roles !== false;
  s.roles = {};
  let k = 0;
  for (const id of players) s.roles[id] = s.spies.includes(id) || !withRoles ? "" : roles[k++ % roles.length];
  s.phase = "look";
  s.seen = [];
  s.asker = players.length ? players[(s.round - 1) % players.length] : null;
  s.prevAsker = null;
  s.startedAt = null;
  s.pausedAt = null;
  s.pausedMs = 0;
  s.timeUp = false;
  s.vote = null;
  s.accusers = [];
  s.guess = null;
  s.minutes = Number(ctx.options.minutes) || 8;
}

function setup(ctx: GameContext): SpionState {
  const players = ctx.players.map((p) => p.id);
  const s: SpionState = {
    v: 1, round: 1, rounds: Number(ctx.options.rounds) || 5, phase: "look", place: null, roles: {}, spies: [],
    pool: poolOf(ctx.options), used: [], seen: [], asker: null, prevAsker: null, startedAt: null, pausedAt: null, pausedMs: 0,
    minutes: Number(ctx.options.minutes) || 8, timeUp: false, vote: null, accusers: [], guess: null,
    scores: Object.fromEntries(players.map((id) => [id, 0])), last: null, log: [],
  };
  deal(s, ctx, players);
  return s;
}

function startTalk(s: SpionState, ctx: GameContext) {
  s.phase = "talk";
  s.startedAt = ctx.now;
  s.pausedAt = null;
  s.pausedMs = 0;
}

function pause(s: SpionState, now: number) { if (s.pausedAt === null && s.startedAt !== null) s.pausedAt = now; }
function resume(s: SpionState, now: number) {
  if (s.pausedAt !== null) { s.pausedMs += Math.max(0, now - s.pausedAt); s.pausedAt = null; }
}

/** Runde werten, Punkte verteilen; letzte Runde → Partie vorbei */
function finish(s: SpionState, ctx: GameContext, r: { winner: "spy" | "group"; reason: Reason; accused?: string | null; by?: string | null; guessed?: string | null }) {
  const points: Record<string, number> = {};
  const rounds = scoringOf(ctx.options) === "rounds";
  for (const id of ids(s)) {
    const spy = s.spies.includes(id);
    let p = 0;
    if (r.winner === "spy" && spy) p = rounds ? 1 : r.reason === "time" ? POINTS.spyTime : POINTS.spyBig;
    if (r.winner === "group" && !spy) p = rounds ? 1 : r.by === id && r.reason !== "guessWrong" ? POINTS.accuser : POINTS.group;
    points[id] = p;
    s.scores[id] = (s.scores[id] ?? 0) + p;
  }
  s.last = {
    round: s.round, place: s.place!, spies: [...s.spies], winner: r.winner, reason: r.reason,
    accused: r.accused ?? null, by: r.by ?? null, guessed: r.guessed ?? null, points,
  };
  const spyNames = s.spies.map((id) => nameOf(ctx, id)).join(" & ");
  addLog(s, `Runde ${s.round}: ${placeName(s.place)} – ${r.winner === "spy" ? `${spyNames} (Spion) gewinnt` : `${spyNames} (Spion) verliert`}`);
  s.vote = null;
  s.guess = null;
  pause(s, ctx.now);
  s.phase = s.round >= s.rounds ? "over" : "reveal";
}

/** Ergebnis einer Abstimmung: wer ist verurteilt? (null: keine Mehrheit) */
export function tally(votes: Record<string, string>, players: string[], o: Options): string | null {
  const count = (x: string) => Object.keys(votes).filter((v) => players.includes(v) && votes[v] === x).length;
  const top = Math.max(0, ...players.map(count));
  // Gleichstand an der Spitze: niemand verurteilt
  if (players.filter((x) => count(x) === top).length !== 1) return null;
  for (const x of players) {
    const voters = Object.keys(votes).filter((v) => v !== x && players.includes(v));
    const yes = voters.filter((v) => votes[v] === x).length;
    if (!voters.length || !yes) continue;
    if (verdictOf(o) === "unanimous" ? yes === voters.length : yes * 2 > voters.length) return x;
  }
  return null;
}

function judge(s: SpionState, ctx: GameContext, accused: string | null) {
  const v = s.vote!;
  if (accused === null) {
    if (v.final) { finish(s, ctx, { winner: "spy", reason: "time" }); return; }
    addLog(s, "Abstimmung ohne Mehrheit – weiter geht's.");
    s.vote = null;
    s.phase = "talk";
    resume(s, ctx.now);
    return;
  }
  if (!s.spies.includes(accused)) { finish(s, ctx, { winner: "spy", reason: "innocent", accused, by: v.by }); return; }
  if (ctx.options.lastChance === true) {
    addLog(s, `${nameOf(ctx, accused)} ist ertappt – letzte Chance: Ort raten.`);
    s.guess = { spy: accused, caught: true, by: v.by };
    s.vote = null;
    s.phase = "guess";
    return;
  }
  finish(s, ctx, { winner: "group", reason: "caught", accused, by: v.by });
}

function closeVote(s: SpionState, ctx: GameContext) {
  judge(s, ctx, tally(s.vote!.votes, ids(s), ctx.options));
}

function toFinalVote(s: SpionState, ctx: GameContext) {
  s.timeUp = true;
  pause(s, ctx.now);
  s.vote = { by: null, final: true, votes: {} };
  s.phase = "vote";
  addLog(s, "Zeit ist um – Schlussabstimmung.");
}

function apply(prev: SpionState, a: SpionAction, ctx: GameContext): SpionState {
  const s = structuredClone(prev);
  const local = ctx.actorId === null;
  const me = !local && ctx.actorId! in s.scores ? ctx.actorId : null;
  const players = ids(s);
  const known = (id: unknown): id is string => typeof id === "string" && players.includes(id);

  switch (a.type) {
    case "seen": {
      if (s.phase !== "look") throw new GameError("Die Karten sind schon verteilt.");
      const who = local ? a.player : me;
      if (!known(who)) throw new GameError("Wer schaut gerade?");
      if (!s.seen.includes(who)) s.seen.push(who);
      if (players.every((id) => s.seen.includes(id))) startTalk(s, ctx);
      return s;
    }
    case "ask": {
      if (s.phase !== "talk") throw new GameError("Gerade wird nicht gefragt.");
      if (!known(a.to)) throw new GameError("Diesen Spieler gibt es nicht.");
      // Online: wer fragt, tippt an, wen – oder wer gefragt wurde, meldet sich selbst
      if (!local && me !== s.asker && me !== a.to) throw new GameError(`${nameOf(ctx, s.asker)} fragt gerade.`);
      if (a.to === s.asker) throw new GameError("Man fragt nicht sich selbst.");
      if (a.to === s.prevAsker && players.length > 2) throw new GameError(`${nameOf(ctx, s.asker)} darf ${nameOf(ctx, a.to)} nicht direkt zurückfragen.`);
      s.prevAsker = s.asker;
      s.asker = a.to;
      return s;
    }
    case "accuse": {
      if (s.phase !== "talk") throw new GameError("Abstimmen geht während der Fragerunde.");
      const by = local ? (known(a.by) ? a.by : null) : me;
      if (!local && !by) throw new GameError("Du spielst nicht mit.");
      if (by && s.accusers.includes(by)) throw new GameError(`${nameOf(ctx, by)} hat diese Runde schon eine Abstimmung gestartet.`);
      if (by) s.accusers.push(by);
      pause(s, ctx.now);
      s.vote = { by, final: false, votes: {} };
      s.phase = "vote";
      addLog(s, by ? `${nameOf(ctx, by)} startet eine Abstimmung.` : "Abstimmung!");
      return s;
    }
    case "vote": {
      if (s.phase !== "vote" || !s.vote) throw new GameError("Gerade wird nicht abgestimmt.");
      if (local || !me) throw new GameError("Online stimmt jeder am eigenen Handy ab.");
      if (!known(a.target) || a.target === me) throw new GameError("Stimme für jemand anderen.");
      s.vote.votes[me] = a.target;
      if (players.every((id) => id in s.vote!.votes)) closeVote(s, ctx);
      return s;
    }
    case "verdict": {
      // Lokal: alle zeigen gleichzeitig, das Handy bekommt das Ergebnis
      if (s.phase !== "vote" || !s.vote) throw new GameError("Gerade wird nicht abgestimmt.");
      if (!local) throw new GameError("Online stimmt jeder am eigenen Handy ab.");
      if (a.target !== null && !known(a.target)) throw new GameError("Diesen Spieler gibt es nicht.");
      judge(s, ctx, a.target);
      return s;
    }
    case "cancelVote": {
      if (s.phase !== "vote" || !s.vote || s.vote.final) throw new GameError("Gerade gibt es nichts abzubrechen.");
      if (!local && me !== s.vote.by && ctx.actorId !== ctx.hostId) throw new GameError("Abbrechen darf, wer die Abstimmung gestartet hat.");
      s.vote = null;
      s.phase = "talk";
      resume(s, ctx.now);
      addLog(s, "Abstimmung abgebrochen.");
      return s;
    }
    case "reveal": {
      if (s.phase !== "talk") throw new GameError("Enttarnen geht während der Fragerunde.");
      const spy = local ? a.spy : me;
      if (!known(spy)) throw new GameError("Wer ist der Spion?");
      if (!s.spies.includes(spy)) throw new GameError(`${nameOf(ctx, spy)} ist nicht der Spion.`);
      pause(s, ctx.now);
      s.guess = { spy, caught: false, by: null };
      s.phase = "guess";
      addLog(s, `${nameOf(ctx, spy)} enttarnt sich als Spion und rät den Ort.`);
      return s;
    }
    case "guess": {
      if (s.phase !== "guess" || !s.guess) throw new GameError("Gerade rät niemand.");
      if (!local && me !== s.guess.spy) throw new GameError("Raten darf nur der Spion.");
      if (typeof a.place !== "string" || !s.pool.includes(a.place)) throw new GameError("Diesen Ort gibt es nicht.");
      const right = a.place === s.place;
      const { caught, spy, by } = s.guess;
      if (caught) finish(s, ctx, right ? { winner: "spy", reason: "caughtGuess", accused: spy, guessed: a.place } : { winner: "group", reason: "caught", accused: spy, by, guessed: a.place });
      else finish(s, ctx, right ? { winner: "spy", reason: "guessRight", guessed: a.place } : { winner: "group", reason: "guessWrong", guessed: a.place });
      return s;
    }
    case "timeUp": {
      // Jedes Handy meldet das Ende – gezählt wird nur das erste, und nur wenn die Zeit wirklich um ist
      if (s.phase !== "talk" || s.timeUp) return prev;
      const left = timeLeft(s, ctx.now);
      if (left === null || left > 1500) return prev;
      toFinalVote(s, ctx);
      return s;
    }
    case "nextRound": {
      if (s.phase !== "reveal") throw new GameError("Die Runde läuft noch.");
      if (s.place) s.used.push(s.place);
      s.round++;
      deal(s, ctx, players);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/** Was jeder sehen darf: Ort und Rolle nur Nicht-Spione, die Spione nur sie selbst – bis zur Auflösung */
function view(s: SpionState, viewer: string | null): SpionState {
  if (viewer === null || s.phase === "reveal" || s.phase === "over") return s;
  const spy = s.spies.includes(viewer);
  const player = viewer in s.scores;
  const vote = s.vote ? { ...s.vote, votes: Object.fromEntries(Object.entries(s.vote.votes).map(([id, t]) => [id, id === viewer ? t : "?"])) } : null;
  return {
    ...s,
    place: spy || !player ? null : s.place,
    roles: player ? { [viewer]: s.roles[viewer] ?? "" } : {},
    spies: spy ? [viewer] : [],
    vote,
  };
}

export const spion: GameLogic<SpionState, SpionAction> = {
  info: {
    id: "spion",
    name: "Spion",
    tagline: "Alle kennen den Ort – nur einer nicht. Wer ist der Spion?",
    category: "Party",
    minPlayers: 3,
    maxPlayers: 12,
    duration: "30 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: false,
  settings: [
    { key: "minutes", label: "Zeit pro Runde (min)", type: "number", default: 8, min: 2, max: 15, step: 1, group: "Ablauf" },
    { key: "rounds", label: "Runden", type: "number", default: 5, min: 1, max: 20, step: 1, group: "Ablauf" },
    {
      key: "scoring", label: "Wertung", type: "choice", default: "points", group: "Ablauf",
      choices: [
        { value: "points", label: "Punkte", hint: "Spion 2–4, andere 1–2" },
        { value: "rounds", label: "Nur Runden", hint: "Sieg = 1 Punkt" },
      ],
    },
    {
      key: "verdict", label: "Verurteilt wird mit", type: "choice", default: "majority", group: "Ablauf",
      choices: [
        { value: "majority", label: "Mehrheit", hint: "mehr als die Hälfte" },
        { value: "unanimous", label: "Einstimmig", hint: "alle außer dem Verdächtigen" },
      ],
    },
    { key: "roles", label: "Rollen am Ort", type: "toggle", default: true, group: "Orte", hint: "z. B. Bahnhof – Zugbegleiter" },
    ...PACKS.map((p) => ({ key: `pack_${p.id}`, label: `Paket ${p.name}`, type: "toggle" as const, default: true, group: "Orte", hint: p.hint })),
    {
      key: "spies", label: "Spione", type: "choice", default: "1", group: "Hausregeln",
      choices: [{ value: "1", label: "1 Spion" }, { value: "2", label: "2 Spione", hint: "ab 5 Spielern, kennen sich nicht" }],
    },
    { key: "lastChance", label: "Letzte Chance", type: "toggle", default: false, group: "Hausregeln", hint: "Ertappter Spion darf noch den Ort raten" },
  ],
  setup,
  apply,
  actionKind: (a) => (["seen", "ask", "accuse", "vote", "verdict", "cancelVote", "reveal", "guess", "timeUp", "nextRound"].includes(a.type) ? "player" : null),
  currentPlayerId: (s) => (s.phase === "talk" ? s.asker : null),
  isOver: (s) => s.phase === "over",
  results: (s) => {
    const max = Math.max(...Object.values(s.scores));
    return Object.entries(s.scores).map(([id, score]) => ({ id, won: score === max, score }));
  },
  skipLabel: (s) => {
    if (s.phase === "look") return "Fragerunde starten";
    if (s.phase === "talk") return "Zeit beenden – Schlussabstimmung";
    if (s.phase === "vote") return "Abstimmung auswerten";
    if (s.phase === "guess") return "Spion rät nicht – als falsch werten";
    if (s.phase === "reveal") return "Nächste Runde";
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    switch (s.phase) {
      case "look": startTalk(s, ctx); break;
      case "talk": toFinalVote(s, ctx); break;
      case "vote": closeVote(s, ctx); break;
      case "guess": {
        const { caught, spy, by } = s.guess!;
        finish(s, ctx, caught ? { winner: "group", reason: "caught", accused: spy, by } : { winner: "group", reason: "guessWrong" });
        break;
      }
      case "reveal": return apply(prev, { type: "nextRound" }, ctx);
    }
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (!(id in s.scores)) return s;
    const order = ctx.players.map((p) => p.id).filter((x) => x !== id && x in s.scores);
    const wasSpy = s.spies.includes(id);
    delete s.scores[id];
    delete s.roles[id];
    s.seen = s.seen.filter((x) => x !== id);
    s.accusers = s.accusers.filter((x) => x !== id);
    s.spies = s.spies.filter((x) => x !== id);
    if (s.last) s.last = { ...s.last, spies: s.last.spies.filter((x) => x !== id) };
    if (s.vote) {
      delete s.vote.votes[id];
      for (const [v, t] of Object.entries(s.vote.votes)) if (t === id) delete s.vote.votes[v];
      if (s.vote.by === id) s.vote.by = null;
    }
    if (s.prevAsker === id) s.prevAsker = null;
    if (s.asker === id) {
      const i = ctx.players.findIndex((p) => p.id === id);
      const after = ctx.players.slice(i + 1).concat(ctx.players.slice(0, i)).map((p) => p.id).find((x) => order.includes(x));
      s.asker = after ?? order[0] ?? null;
    }
    const running = ["look", "talk", "vote", "guess"].includes(s.phase);
    // Ohne Spion keine Runde – neu verteilen (ohne Wertung)
    if (running && wasSpy && (!s.spies.length || s.guess?.spy === id)) {
      if (!order.length) return s;
      addLog(s, `${nameOf(ctx, id)} hat das Spiel verlassen – die Runde wird neu verteilt.`);
      deal(s, ctx, order);
      return s;
    }
    if (s.phase === "look" && order.length && order.every((x) => s.seen.includes(x))) startTalk(s, ctx);
    if (s.phase === "vote" && s.vote && order.length && order.every((x) => x in s.vote!.votes) && Object.keys(s.vote.votes).length) closeVote(s, ctx);
    return s;
  },
  view,
};
