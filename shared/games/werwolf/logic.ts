/**
 * Werwolf (nach „Die Werwölfe von Düsterwald“) – läuft im Browser (lokal) und im Durable Object (online).
 *
 * Zwei Erzähler-Modi:
 * - `human`: Ein Mensch leitet das Spiel (online: der Host, spielt nicht mit). Er sieht alle Rollen,
 *   liest das Skript vor und tippt die Entscheidungen der Nacht und des Dorfes ein.
 * - `app`: Die App erzählt. Online handelt jede Rolle geheim am eigenen Handy – nachts gleichzeitig,
 *   alle anderen geben derweil einen Verdacht ab, damit niemand am Tippen erkennbar ist.
 *   Lokal (ein Gerät) liest die App vor und die aufgerufenen Rollen tippen am Gerät in der Mitte.
 *
 * Ablauf „schrittweise“ (Spielleiter oder lokal): jeder Nachtschritt wird erst ausgeführt, dann mit „Weiter“ abgeschlossen.
 */
import { randomInt, shuffle } from "../../platform/random";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";

export type Role = "werwolf" | "dorf" | "seherin" | "hexe" | "jaeger" | "amor" | "beschuetzer";
export type Team = "dorf" | "werwolf";

export interface RoleInfo {
  id: Role;
  name: string;
  team: Team;
  emoji: string;
  /** kurz für die Rollenkarte */
  short: string;
  /** ausführlich für die Regelseite */
  help: string;
}

export const ROLES: Record<Role, RoleInfo> = {
  werwolf: { id: "werwolf", name: "Werwolf", team: "werwolf", emoji: "🐺", short: "Nachts sucht ihr Wölfe gemeinsam ein Opfer aus. Tagsüber tarnt ihr euch.", help: "Die Werwölfe erwachen jede Nacht gemeinsam und einigen sich auf ein Opfer. Sie gewinnen, sobald sie mindestens so viele sind wie alle anderen zusammen." },
  dorf: { id: "dorf", name: "Dorfbewohner", team: "dorf", emoji: "🧑‍🌾", short: "Keine Fähigkeit – nur deine Menschenkenntnis. Finde die Werwölfe!", help: "Dorfbewohner haben keine Sonderfähigkeit. Tagsüber diskutieren sie und stimmen ab, wen das Dorf verdächtigt." },
  seherin: { id: "seherin", name: "Seherin", team: "dorf", emoji: "🔮", short: "Jede Nacht erfährst du die Rolle eines Mitspielers.", help: "Die Seherin erwacht jede Nacht und darf sich die Rolle eines Mitspielers ansehen. Klug einsetzen – wer sich zu früh verrät, wird gefressen." },
  hexe: { id: "hexe", name: "Hexe", team: "dorf", emoji: "🧪", short: "Ein Heiltrank und ein Gifttrank – je einmal im Spiel.", help: "Die Hexe erfährt jede Nacht das Opfer der Werwölfe. Sie hat einen Heiltrank (rettet das Opfer) und einen Gifttrank (tötet jemanden) – jeden nur einmal im ganzen Spiel. Sie darf beide in derselben Nacht benutzen." },
  jaeger: { id: "jaeger", name: "Jäger", team: "dorf", emoji: "🏹", short: "Wenn du stirbst, nimmst du jemanden mit in den Tod.", help: "Stirbt der Jäger – egal ob nachts oder durch das Dorf –, schießt er sofort auf einen Mitspieler, der ebenfalls stirbt." },
  amor: { id: "amor", name: "Amor", team: "dorf", emoji: "💘", short: "In der ersten Nacht verliebst du zwei Menschen.", help: "Amor wählt in der ersten Nacht zwei Verliebte (auch sich selbst). Stirbt einer von ihnen, stirbt der andere aus Kummer. Sind die Verliebten ein Werwolf und ein Dorfbewohner, gewinnen sie nur, wenn sie als Letzte übrig bleiben." },
  beschuetzer: { id: "beschuetzer", name: "Beschützer", team: "dorf", emoji: "🛡️", short: "Jede Nacht schützt du eine Person vor den Werwölfen.", help: "Der Beschützer wählt jede Nacht eine Person (auch sich selbst), die in dieser Nacht nicht von den Werwölfen gefressen werden kann. Nicht zweimal hintereinander dieselbe." },
};

export const SPECIAL_ROLES = ["seherin", "hexe", "jaeger", "amor", "beschuetzer"] as const;

export type Step = "sleep" | "amor" | "lovers" | "beschuetzer" | "werwolf" | "seherin" | "hexe";
/** Welche Rolle handelt in einem Nachtschritt? */
export const STEP_ROLE: Partial<Record<Step, Role>> = { amor: "amor", beschuetzer: "beschuetzer", werwolf: "werwolf", seherin: "seherin", hexe: "hexe" };

export type Phase = "reveal" | "night" | "day" | "hunter" | "over";
export type Winner = "dorf" | "werwolf" | "liebe";

export interface Death { id: string; cause: "wolf" | "gift" | "dorf" | "jaeger" | "kummer" | "weg" }

export interface WerwolfState {
  v: 1;
  mode: "human" | "app";
  /** Schrittweise: Spielleiter oder lokales Gerät führen durch die Nacht */
  stepwise: boolean;
  /** Spielleiter (nur online im Modus human) – spielt nicht mit */
  narratorId: string | null;
  revealDead: boolean;
  /** Rollen der Mitspieler (nicht des Spielleiters) */
  roles: Record<string, Role>;
  alive: Record<string, boolean>;
  lovers: [string, string] | null;
  phase: Phase;
  /** Rolle gesehen (Phase reveal) */
  ready: string[];
  night: number;
  /** offene Schritte dieser Nacht, in Reihenfolge */
  pending: Step[];
  /** in dieser Nacht schon ausgeführt (schrittweise: wartet noch auf „Weiter“) */
  acted: Step[];
  wolfVotes: Record<string, string>;
  victim: string | null;
  protectedId: string | null;
  lastProtected: string | null;
  seer: { night: number; target: string; role: Role }[];
  potions: { heal: boolean; poison: boolean };
  healed: boolean;
  poisoned: string | null;
  /** Verdacht während der Nacht (App-Modus online, zur Tarnung) */
  suspicions: Record<string, string>;
  /** Abstimmung am Tag (App-Modus online): Stimme oder "" für Enthaltung */
  votes: Record<string, string>;
  /** Ergebnis der letzten Nacht bzw. Abstimmung */
  news: { kind: "night" | "day"; deaths: Death[]; tally?: Record<string, number> } | null;
  /** Jäger, die noch schießen müssen */
  hunters: string[];
  /** wohin es nach dem Jägerschuss weitergeht */
  afterHunter: "day" | "night";
  winner: Winner | null;
  log: string[];
  /** nur in der gefilterten Sicht: wessen Rollen der Betrachter wirklich kennt */
  known?: string[];
}

export type WerwolfAction =
  | { type: "ready" }
  | { type: "startNight" }
  | { type: "amor"; a: string; b: string }
  | { type: "protect"; target: string }
  | { type: "wolf"; target: string }
  | { type: "see"; target: string }
  | { type: "witch"; heal: boolean; poison: string | null }
  | { type: "suspect"; target: string }
  | { type: "next" }
  | { type: "vote"; target: string }
  | { type: "closeVote" }
  | { type: "lynch"; target: string | null }
  | { type: "shoot"; target: string };

export const modeOf = (o: Options) => (o.narrator === "human" ? "human" : "app");

/** Vorgeschlagene Zahl der Werwölfe */
export function autoWolves(n: number) {
  return n <= 6 ? 1 : n <= 10 ? 2 : n <= 14 ? 3 : 4;
}

/** Die Mitspieler (ohne Spielleiter) */
export const participants = (s: WerwolfState) => Object.keys(s.roles);
export const aliveIds = (s: WerwolfState) => participants(s).filter((id) => s.alive[id]);
export const holders = (s: WerwolfState, role: Role) => participants(s).filter((id) => s.roles[id] === role);
const aliveHolders = (s: WerwolfState, role: Role) => holders(s, role).filter((id) => s.alive[id]);

/** Rollenverteilung aus den Einstellungen */
export function buildDeck(n: number, o: Options): Role[] {
  const wolves = o.wolves === "auto" || o.wolves === undefined ? autoWolves(n) : Number(o.wolves);
  const specials = SPECIAL_ROLES.filter((r) => o[r] === true);
  if (wolves < 1) throw new GameError("Es braucht mindestens einen Werwolf.");
  if (wolves * 2 >= n) throw new GameError(`${wolves} Werwölfe sind zu viele für ${n} Mitspieler.`);
  if (wolves + specials.length > n) throw new GameError(`Zu viele Sonderrollen für ${n} Mitspieler – schalte welche ab.`);
  const deck: Role[] = [...Array(wolves).fill("werwolf"), ...specials];
  while (deck.length < n) deck.push("dorf");
  return deck;
}

function setup(ctx: GameContext): WerwolfState {
  const mode = modeOf(ctx.options);
  const local = ctx.actorId === null;
  const narratorId = mode === "human" && !local ? ctx.hostId : null;
  const ids = ctx.players.map((p) => p.id).filter((id) => id !== narratorId);
  if (ids.length < 5) throw new GameError(narratorId ? "Werwolf braucht mindestens 5 Mitspieler plus Spielleiter." : "Werwolf braucht mindestens 5 Mitspieler.");
  const deck = shuffle(buildDeck(ids.length, ctx.options));
  return {
    v: 1, mode, stepwise: mode === "human" || local, narratorId, revealDead: ctx.options.revealDead !== false,
    roles: Object.fromEntries(ids.map((id, i) => [id, deck[i]])), alive: Object.fromEntries(ids.map((id) => [id, true])),
    lovers: null, phase: "reveal", ready: [], night: 0, pending: [], acted: [],
    wolfVotes: {}, victim: null, protectedId: null, lastProtected: null, seer: [], potions: { heal: true, poison: true },
    healed: false, poisoned: null, suspicions: {}, votes: {}, news: null, hunters: [], afterHunter: "day", winner: null, log: [],
  };
}

const nameOf = (ctx: GameContext, id: string) => ctx.players.find((p) => p.id === id)?.name ?? "?";

function startNight(s: WerwolfState) {
  s.phase = "night";
  s.night++;
  s.acted = [];
  s.wolfVotes = {};
  s.victim = null;
  s.lastProtected = s.protectedId;
  s.protectedId = null;
  s.healed = false;
  s.poisoned = null;
  s.suspicions = {};
  s.votes = {};
  const has = (r: Role) => aliveHolders(s, r).length > 0;
  const steps: Step[] = [];
  if (s.stepwise) steps.push("sleep");
  if (s.night === 1 && has("amor")) steps.push("amor", ...(s.stepwise ? ["lovers" as const] : []));
  if (has("beschuetzer")) steps.push("beschuetzer");
  steps.push("werwolf");
  if (has("seherin")) steps.push("seherin");
  if (has("hexe") && (s.potions.heal || s.potions.poison)) steps.push("hexe");
  s.pending = steps;
}

/** Tötet Spieler samt Liebeskummer; merkt Jäger vor. */
function kill(s: WerwolfState, deaths: Death[], id: string, cause: Death["cause"]) {
  if (!s.alive[id]) return;
  s.alive[id] = false;
  deaths.push({ id, cause });
  if (s.roles[id] === "jaeger" && cause !== "weg") s.hunters.push(id);
  if (s.lovers?.includes(id)) {
    const other = s.lovers[0] === id ? s.lovers[1] : s.lovers[0];
    kill(s, deaths, other, "kummer");
  }
}

export function checkWinner(s: WerwolfState): Winner | null {
  const alive = aliveIds(s);
  const wolves = alive.filter((id) => s.roles[id] === "werwolf").length;
  const [a, b] = s.lovers ?? [];
  const mixedLovers = !!s.lovers && ROLES[s.roles[a!]].team !== ROLES[s.roles[b!]].team;
  if (mixedLovers && alive.length === 2 && alive.includes(a!) && alive.includes(b!)) return "liebe";
  if (wolves === 0) return alive.length ? "dorf" : "werwolf";
  if (wolves * 2 >= alive.length) return "werwolf";
  return null;
}

/** Nach Todesfällen: Jäger, Sieg oder weiter */
function afterDeaths(s: WerwolfState, next: "day" | "night") {
  s.winner = checkWinner(s);
  if (s.winner) { s.phase = "over"; return; }
  if (s.hunters.length) { s.phase = "hunter"; s.afterHunter = next; return; }
  if (next === "night") startNight(s); else s.phase = "day";
}

function dawn(s: WerwolfState, ctx: GameContext) {
  const deaths: Death[] = [];
  if (s.victim && s.victim !== s.protectedId && !s.healed) kill(s, deaths, s.victim, "wolf");
  if (s.poisoned) kill(s, deaths, s.poisoned, "gift");
  const tally: Record<string, number> = {};
  for (const t of Object.values(s.suspicions)) tally[t] = (tally[t] ?? 0) + 1;
  s.news = { kind: "night", deaths, tally: s.stepwise ? undefined : tally };
  s.log.push(`Nacht ${s.night}: ${deaths.length ? deaths.map((d) => nameOf(ctx, d.id)).join(", ") + " tot" : "niemand gestorben"}`);
  s.votes = {};
  afterDeaths(s, "day");
}

/** Schritt erledigt: schrittweise wartet er auf „Weiter“, sonst geht es direkt weiter. */
function done(s: WerwolfState, step: Step, ctx: GameContext) {
  if (!s.acted.includes(step)) s.acted.push(step);
  if (!s.stepwise) {
    s.pending = s.pending.filter((p) => p !== step);
    if (!s.pending.length) dawn(s, ctx);
  }
}

/** Darf der Akteur diesen Schritt ausführen? */
function assertStep(s: WerwolfState, step: Step, actorId: string | null) {
  if (s.phase !== "night") throw new GameError("Das geht nur nachts.");
  if (!s.pending.includes(step)) throw new GameError("Das ist heute Nacht nicht dran.");
  if (s.stepwise) {
    if (s.pending[0] !== step) throw new GameError("Das ist gerade nicht dran.");
    if (actorId !== null && actorId !== s.narratorId) throw new GameError("Das tippt der Spielleiter ein.");
    return;
  }
  const role = STEP_ROLE[step];
  if (actorId !== null && (!role || s.roles[actorId] !== role || !s.alive[actorId])) throw new GameError("Das darf nur die passende Rolle.");
}

function assertAlive(s: WerwolfState, id: string, what = "Diese Person") {
  if (!(id in s.roles)) throw new GameError(`${what} spielt nicht mit.`);
  if (!s.alive[id]) throw new GameError(`${what} ist schon tot.`);
}

/** Mehrheit; bei Gleichstand null (oder zufällig, wenn `random`) */
function majority(votes: string[], random: boolean): string | null {
  const tally = new Map<string, number>();
  for (const v of votes) if (v) tally.set(v, (tally.get(v) ?? 0) + 1);
  if (!tally.size) return null;
  const max = Math.max(...tally.values());
  const top = [...tally].filter(([, n]) => n === max).map(([id]) => id);
  if (top.length === 1) return top[0];
  return random ? top[randomInt(top.length)] : null;
}

function resolveVote(s: WerwolfState, ctx: GameContext, target: string | null, tally?: Record<string, number>) {
  const deaths: Death[] = [];
  if (target) kill(s, deaths, target, "dorf");
  s.news = { kind: "day", deaths, tally };
  s.log.push(`Tag ${s.night}: ${target ? `${nameOf(ctx, target)} vom Dorf verurteilt` : "niemand verurteilt"}`);
  afterDeaths(s, "night");
}

function apply(prev: WerwolfState, a: WerwolfAction, ctx: GameContext): WerwolfState {
  const s = structuredClone(prev);
  const actor = ctx.actorId;
  const leader = actor === null || actor === s.narratorId || (!s.narratorId && actor === ctx.hostId);
  const isPlayer = actor !== null && actor in s.roles;

  switch (a.type) {
    case "ready": {
      if (s.phase !== "reveal") throw new GameError("Die Rollen sind schon verteilt.");
      if (!isPlayer) throw new GameError("Du spielst nicht mit.");
      if (!s.ready.includes(actor!)) s.ready.push(actor!);
      if (!s.stepwise && s.ready.length === participants(s).length) startNight(s);
      return s;
    }
    case "startNight": {
      if (s.phase !== "reveal") throw new GameError("Die Nacht hat schon begonnen.");
      if (!leader) throw new GameError("Das darf nur der Spielleiter bzw. Host.");
      startNight(s);
      return s;
    }
    case "next": {
      if (!s.stepwise) throw new GameError("Die App führt automatisch weiter.");
      if (actor !== null && actor !== s.narratorId) throw new GameError("Das darf nur der Spielleiter.");
      if (s.phase !== "night") throw new GameError("Gerade ist keine Nacht.");
      const step = s.pending[0];
      if (step !== "sleep" && step !== "lovers" && !s.acted.includes(step)) throw new GameError("Erst eine Auswahl treffen.");
      s.pending.shift();
      if (!s.pending.length) dawn(s, ctx);
      return s;
    }
    case "amor": {
      assertStep(s, "amor", actor);
      if (s.lovers) throw new GameError("Die Verliebten stehen schon fest.");
      assertAlive(s, a.a); assertAlive(s, a.b);
      if (a.a === a.b) throw new GameError("Zwei verschiedene Personen, bitte.");
      s.lovers = [a.a, a.b];
      done(s, "amor", ctx);
      return s;
    }
    case "protect": {
      assertStep(s, "beschuetzer", actor);
      assertAlive(s, a.target);
      if (a.target === s.lastProtected) throw new GameError("Nicht zweimal hintereinander dieselbe Person.");
      s.protectedId = a.target;
      done(s, "beschuetzer", ctx);
      return s;
    }
    case "wolf": {
      assertStep(s, "werwolf", actor);
      assertAlive(s, a.target);
      if (s.roles[a.target] === "werwolf") throw new GameError("Werwölfe fressen keine Werwölfe.");
      if (s.stepwise || actor === null) {
        s.victim = a.target;
        done(s, "werwolf", ctx);
        return s;
      }
      s.wolfVotes[actor] = a.target;
      const wolves = aliveHolders(s, "werwolf");
      if (wolves.every((w) => s.wolfVotes[w])) {
        s.victim = majority(wolves.map((w) => s.wolfVotes[w]), true);
        done(s, "werwolf", ctx);
      }
      return s;
    }
    case "see": {
      assertStep(s, "seherin", actor);
      assertAlive(s, a.target);
      if (s.roles[a.target] === "seherin") throw new GameError("Wähle jemand anderen.");
      if (s.seer.some((x) => x.night === s.night)) throw new GameError("Heute Nacht hast du schon geschaut.");
      s.seer.push({ night: s.night, target: a.target, role: s.roles[a.target] });
      done(s, "seherin", ctx);
      return s;
    }
    case "witch": {
      assertStep(s, "hexe", actor);
      if (!s.acted.includes("werwolf") && s.pending.includes("werwolf")) throw new GameError("Warte, bis die Werwölfe gewählt haben.");
      if (a.heal && (!s.potions.heal || !s.victim)) throw new GameError("Der Heiltrank geht gerade nicht.");
      if (a.poison) {
        if (!s.potions.poison) throw new GameError("Der Gifttrank ist verbraucht.");
        assertAlive(s, a.poison);
      }
      s.healed = !!a.heal;
      s.poisoned = a.poison || null;
      if (s.healed) s.potions.heal = false;
      if (s.poisoned) s.potions.poison = false;
      done(s, "hexe", ctx);
      return s;
    }
    case "suspect": {
      if (s.phase !== "night" || s.stepwise) throw new GameError("Gerade nicht.");
      if (!isPlayer || !s.alive[actor!]) throw new GameError("Du spielst nicht (mehr) mit.");
      assertAlive(s, a.target);
      s.suspicions[actor!] = a.target;
      return s;
    }
    case "vote": {
      if (s.phase !== "day") throw new GameError("Abgestimmt wird tagsüber.");
      if (s.stepwise) throw new GameError("Die Abstimmung trägt der Spielleiter ein.");
      if (!isPlayer || !s.alive[actor!]) throw new GameError("Tote stimmen nicht ab.");
      if (a.target) assertAlive(s, a.target);
      s.votes[actor!] = a.target || "";
      const alive = aliveIds(s);
      if (alive.every((id) => id in s.votes)) closeVote(s, ctx);
      return s;
    }
    case "closeVote": {
      if (s.phase !== "day" || s.stepwise) throw new GameError("Gerade gibt es keine Abstimmung.");
      if (!leader) throw new GameError("Das darf nur der Host.");
      closeVote(s, ctx);
      return s;
    }
    case "lynch": {
      if (s.phase !== "day") throw new GameError("Verurteilt wird tagsüber.");
      if (!s.stepwise) throw new GameError("Im App-Modus stimmt jeder am Handy ab.");
      if (actor !== null && actor !== s.narratorId) throw new GameError("Das tippt der Spielleiter ein.");
      if (a.target) assertAlive(s, a.target);
      resolveVote(s, ctx, a.target || null);
      return s;
    }
    case "shoot": {
      if (s.phase !== "hunter") throw new GameError("Gerade schießt niemand.");
      const hunter = s.hunters[0];
      if (!(s.stepwise ? actor === null || actor === s.narratorId : actor === null || actor === hunter)) throw new GameError("Das darf nur der Jäger.");
      assertAlive(s, a.target);
      s.hunters.shift();
      const deaths: Death[] = [];
      kill(s, deaths, a.target, "jaeger");
      s.news = { kind: s.news?.kind ?? "day", deaths: [...(s.news?.deaths ?? []), ...deaths], tally: s.news?.tally };
      s.log.push(`${nameOf(ctx, hunter)} erschießt ${nameOf(ctx, a.target)}`);
      afterDeaths(s, s.afterHunter);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

function closeVote(s: WerwolfState, ctx: GameContext) {
  const tally: Record<string, number> = {};
  for (const t of Object.values(s.votes)) if (t) tally[t] = (tally[t] ?? 0) + 1;
  resolveVote(s, ctx, majority(Object.values(s.votes), false), tally);
}

/** Was eine Person sehen darf. Spielleiter, lokales Gerät und das Spielende sehen alles. */
function view(s: WerwolfState, viewer: string | null): WerwolfState {
  if (viewer === null || viewer === s.narratorId || s.phase === "over") return s;
  const own = s.roles[viewer];
  const wolf = own === "werwolf";
  const roles: Record<string, Role> = {};
  for (const id of participants(s)) {
    if (id === viewer || (wolf && s.roles[id] === "werwolf") || (s.revealDead && !s.alive[id])) roles[id] = s.roles[id];
  }
  // Unbekannte Rollen als "dorf" tarnen, damit die Struktur gleich bleibt – die Oberfläche zeigt nur `known`
  const masked = Object.fromEntries(participants(s).map((id) => [id, roles[id] ?? "dorf"])) as Record<string, Role>;
  const inLove = !!s.lovers && (s.lovers.includes(viewer) || own === "amor");
  const myStep = (p: Step) => STEP_ROLE[p] === own || (own === "hexe" && p === "werwolf");
  return {
    ...s,
    roles: masked,
    known: Object.keys(roles),
    lovers: inLove ? s.lovers : null,
    pending: s.pending.filter(myStep),
    acted: s.acted.filter(myStep),
    wolfVotes: wolf ? s.wolfVotes : {},
    victim: wolf || (own === "hexe" && s.alive[viewer]) ? s.victim : null,
    protectedId: own === "beschuetzer" ? s.protectedId : null,
    lastProtected: own === "beschuetzer" ? s.lastProtected : null,
    seer: own === "seherin" ? s.seer : [],
    potions: own === "hexe" ? s.potions : { heal: false, poison: false },
    healed: false,
    poisoned: null,
    suspicions: viewer in s.suspicions ? { [viewer]: s.suspicions[viewer] } : {},
    votes: Object.fromEntries(Object.entries(s.votes).map(([id, t]) => [id, id === viewer ? t : "?"])),
  };
}

/** Welche Rollen kennt der Betrachter? (fehlt = alle) */
export function knownRoles(s: WerwolfState): Set<string> {
  return new Set(s.known ?? participants(s));
}

export const werwolf: GameLogic<WerwolfState, WerwolfAction> = {
  info: {
    id: "werwolf",
    name: "Werwolf",
    tagline: "Nachts schlagen die Wölfe zu, tagsüber sucht das Dorf die Schuldigen – mit Spielleiter oder die App erzählt.",
    category: "Party",
    minPlayers: 5,
    maxPlayers: 20,
    duration: "30–60 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: false,
  settings: [
    {
      key: "narrator", label: "Erzähler", type: "choice", default: "app",
      choices: [
        { value: "app", label: "Die App", hint: "alle spielen mit" },
        { value: "human", label: "Spielleiter", hint: "Host leitet, spielt nicht" },
      ],
    },
    {
      key: "wolves", label: "Werwölfe", type: "choice", default: "auto",
      choices: [
        { value: "auto", label: "Auto", hint: "nach Spielerzahl" },
        { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" },
      ],
    },
    { key: "seherin", label: "🔮 Seherin", type: "toggle", default: true, hint: "sieht jede Nacht eine Rolle" },
    { key: "hexe", label: "🧪 Hexe", type: "toggle", default: true, hint: "ein Heil-, ein Gifttrank" },
    { key: "jaeger", label: "🏹 Jäger", type: "toggle", default: false, hint: "nimmt jemanden mit in den Tod" },
    { key: "amor", label: "💘 Amor", type: "toggle", default: false, hint: "verliebt zwei Menschen" },
    { key: "beschuetzer", label: "🛡️ Beschützer", type: "toggle", default: false, hint: "schützt jede Nacht eine Person" },
    { key: "revealDead", label: "Rollen der Toten aufdecken", type: "toggle", default: true, hint: "sonst erst am Spielende" },
  ],
  playerLimits: (o) => (modeOf(o) === "human" ? { min: 5, max: 20, note: "online zählt der Spielleiter zusätzlich" } : { min: 5, max: 20 }),
  setup,
  apply,
  actionKind: (a) => (a.type in ACTIONS ? "player" : null),
  currentPlayerId: () => null,
  isOver: (s) => s.phase === "over",
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (id === s.narratorId) { s.phase = "over"; s.winner = null; s.log.push("Der Spielleiter hat den Raum verlassen."); return s; }
    if (!(id in s.roles) || !s.alive[id]) return s;
    const deaths: Death[] = [];
    kill(s, deaths, id, "weg");
    s.hunters = s.hunters.filter((h) => h !== id);
    s.log.push(`${nameOf(ctx, id)} hat das Spiel verlassen`);
    s.winner = checkWinner(s);
    if (s.winner) { s.phase = "over"; return s; }
    if (s.phase === "night") {
      // Schritte ohne lebende Rolle entfallen, offene Wolfsabstimmung neu prüfen
      s.pending = s.pending.filter((p) => !STEP_ROLE[p] || aliveHolders(s, STEP_ROLE[p]!).length > 0 || s.acted.includes(p));
      delete s.wolfVotes[id];
      const wolves = aliveHolders(s, "werwolf");
      if (!s.stepwise && s.pending.includes("werwolf") && wolves.every((w) => s.wolfVotes[w])) {
        s.victim = majority(wolves.map((w) => s.wolfVotes[w]), true);
        done(s, "werwolf", { ...ctx, players: ctx.players.filter((p) => p.id !== id) });
      } else if (!s.pending.length) dawn(s, ctx);
    }
    if (s.phase === "day" && !s.stepwise) {
      delete s.votes[id];
      if (aliveIds(s).every((x) => x in s.votes)) closeVote(s, ctx);
    }
    return s;
  },
  view,
};

const ACTIONS: Record<WerwolfAction["type"], true> = {
  ready: true, startNight: true, amor: true, protect: true, wolf: true, see: true, witch: true,
  suspect: true, next: true, vote: true, closeVote: true, lynch: true, shoot: true,
};
