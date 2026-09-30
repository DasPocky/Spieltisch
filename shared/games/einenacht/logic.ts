/**
 * Werwolf – Eine Nacht: die schnelle Variante mit nur einer Nacht, in der Karten getauscht werden.
 * Danach wird diskutiert und einmal gleichzeitig abgestimmt. Niemand scheidet vorher aus.
 *
 * Online handelt jeder geheim am eigenen Handy (alle gleichzeitig), die Tauschaktionen werden
 * am Morgen in der offiziellen Reihenfolge ausgeführt. Lokal führt ein Handy in der Mitte schrittweise durch die Nacht.
 */
import { shuffle } from "../../platform/random";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";

export type ONRole = "werwolf" | "guenstling" | "freimaurer" | "seherin" | "raeuber" | "unruhestifter" | "betrunkener" | "schlaflose" | "jaeger" | "gerber" | "dorf";

export interface ONRoleInfo { id: ONRole; name: string; team: "dorf" | "werwolf" | "gerber"; short: string; help: string }

export const ON_ROLES: Record<ONRole, ONRoleInfo> = {
  werwolf: { id: "werwolf", name: "Werwolf", team: "werwolf", short: "Du siehst die anderen Werwölfe. Bist du allein, darfst du eine Karte aus der Mitte ansehen.", help: "Die Werwölfe erwachen und erkennen einander. Ist nur einer wach, darf er eine der drei Karten in der Mitte ansehen. Sie gewinnen, wenn kein Werwolf stirbt." },
  guenstling: { id: "guenstling", name: "Günstling", team: "werwolf", short: "Du kennst die Werwölfe – sie dich nicht. Du gewinnst mit ihnen.", help: "Der Günstling sieht, wer die Werwölfe sind, sie kennen ihn aber nicht. Er gewinnt mit den Werwölfen – auch wenn er selbst stirbt. Gibt es keine Werwölfe unter den Spielern, gewinnt er, wenn jemand anderes stirbt." },
  freimaurer: { id: "freimaurer", name: "Freimaurer", team: "dorf", short: "Du erkennst den anderen Freimaurer.", help: "Die beiden Freimaurer erwachen und erkennen einander. Ist nur einer im Spiel, weiß er, dass die andere Karte in der Mitte liegt." },
  seherin: { id: "seherin", name: "Seherin", team: "dorf", short: "Sieh dir die Karte eines Mitspielers an – oder zwei aus der Mitte.", help: "Die Seherin darf die Karte eines Mitspielers ansehen oder zwei der drei Karten in der Mitte." },
  raeuber: { id: "raeuber", name: "Räuber", team: "dorf", short: "Tausche deine Karte mit einem Mitspieler und sieh dir deine neue an.", help: "Der Räuber darf seine Karte mit der eines Mitspielers tauschen und sieht sich dann seine neue Karte an. Er ist ab jetzt diese Rolle, der andere wird Räuber (ohne es zu wissen)." },
  unruhestifter: { id: "unruhestifter", name: "Unruhestifter", team: "dorf", short: "Vertausche die Karten zweier anderer Spieler, ohne sie anzusehen.", help: "Der Unruhestifter darf die Karten zweier anderer Spieler vertauschen, ohne sie anzusehen. Die beiden erfahren nichts davon." },
  betrunkener: { id: "betrunkener", name: "Betrunkener", team: "dorf", short: "Du musst deine Karte mit einer aus der Mitte tauschen – ohne hinzusehen.", help: "Der Betrunkene muss seine Karte mit einer aus der Mitte tauschen, ohne die neue anzusehen. Er weiß also nicht, wer er jetzt ist." },
  schlaflose: { id: "schlaflose", name: "Schlaflose", team: "dorf", short: "Am Ende der Nacht siehst du nach, welche Karte du jetzt hast.", help: "Die Schlaflose erwacht als Letzte und sieht sich ihre Karte noch einmal an – so weiß sie, ob sie getauscht wurde." },
  jaeger: { id: "jaeger", name: "Jäger", team: "dorf", short: "Stirbst du, stirbt auch, auf wen du gezeigt hast.", help: "Stirbt der Jäger bei der Abstimmung, stirbt auch die Person, für die er gestimmt hat." },
  gerber: { id: "gerber", name: "Gerber", team: "gerber", short: "Du hasst deinen Job: Du gewinnst nur, wenn du stirbst.", help: "Der Gerber gewinnt, wenn er bei der Abstimmung stirbt. Stirbt er und kein Werwolf, verlieren auch die Werwölfe." },
  dorf: { id: "dorf", name: "Dorfbewohner", team: "dorf", short: "Keine Fähigkeit – finde die Werwölfe!", help: "Dorfbewohner haben keine Fähigkeit." },
};

export const ON_SPECIALS = ["guenstling", "freimaurer", "seherin", "raeuber", "unruhestifter", "betrunkener", "schlaflose", "jaeger", "gerber"] as const satisfies readonly ONRole[];

/** Nachtschritte in der offiziellen Reihenfolge (lokal nacheinander) */
export type ONStep = "sleep" | "werwolf" | "guenstling" | "freimaurer" | "seherin" | "raeuber" | "unruhestifter" | "betrunkener" | "schlaflose";
const STEP_ORDER: ONStep[] = ["werwolf", "guenstling", "freimaurer", "seherin", "raeuber", "unruhestifter", "betrunkener", "schlaflose"];

export interface ONState {
  v: 1;
  /** lokal: schrittweise am Gerät; online: jeder am eigenen Handy */
  stepwise: boolean;
  /** Karten zu Beginn (so handeln alle nachts) */
  start: Record<string, ONRole>;
  center: ONRole[];
  phase: "reveal" | "night" | "day" | "over";
  ready: string[];
  /** schrittweise: offene Schritte */
  pending: ONStep[];
  /** online: wer mit der Nacht fertig ist */
  done: string[];
  wolfPeek: number | null;
  seer: { player?: string; center?: [number, number] } | null;
  robber: string | null;
  robberSkip: boolean;
  trouble: [string, string] | null;
  troubleSkip: boolean;
  drunk: number | null;
  /** Karten nach der Nacht (erst am Morgen berechnet) */
  final: Record<string, ONRole> | null;
  finalCenter: ONRole[] | null;
  dayStartedAt: number | null;
  minutes: number;
  votes: Record<string, string>;
  dead: string[];
  winners: ("dorf" | "werwolf" | "gerber")[];
}

export type ONAction =
  | { type: "ready" }
  | { type: "startNight" }
  | { type: "next" }
  | { type: "peek"; i: number }
  | { type: "see"; player?: string; center?: [number, number] }
  | { type: "rob"; target: string | null }
  | { type: "trouble"; a: string | null; b?: string | null }
  | { type: "drunk"; i: number }
  | { type: "nightDone" }
  | { type: "vote"; target: string }
  | { type: "closeVote" }
  | { type: "lynch"; targets: string[] };

const isWolfTeam = (r: ONRole) => r === "werwolf";

export function buildONDeck(n: number, o: Options): ONRole[] {
  const wolves = o.wolves === "1" ? 1 : 2;
  const specials = ON_SPECIALS.filter((r) => o[r] === true).flatMap((r) => (r === "freimaurer" ? [r, r] : [r]));
  const size = n + 3;
  if (wolves + specials.length > size) throw new GameError(`Zu viele Rollen für ${n} Spieler – schalte welche ab.`);
  const deck: ONRole[] = [...Array(wolves).fill("werwolf"), ...specials];
  while (deck.length < size) deck.push("dorf");
  return deck;
}

/** Tauschaktionen in der offiziellen Reihenfolge ausführen */
export function resolveNight(s: ONState, until: ONStep = "schlaflose"): { cards: Record<string, ONRole>; center: ONRole[] } {
  const cards = { ...s.start };
  const center = [...s.center];
  const upto = STEP_ORDER.indexOf(until);
  const holder = (role: ONRole) => Object.keys(s.start).find((id) => s.start[id] === role);
  if (upto >= STEP_ORDER.indexOf("raeuber") && s.robber) {
    const me = holder("raeuber");
    if (me && s.robber in cards) [cards[me], cards[s.robber]] = [cards[s.robber], cards[me]];
  }
  if (upto >= STEP_ORDER.indexOf("unruhestifter") && s.trouble) {
    const [a, b] = s.trouble;
    [cards[a], cards[b]] = [cards[b], cards[a]];
  }
  if (upto >= STEP_ORDER.indexOf("betrunkener") && s.drunk !== null) {
    const me = holder("betrunkener");
    if (me) [cards[me], center[s.drunk]] = [center[s.drunk], cards[me]];
  }
  return { cards, center };
}

/** Pflichtaktion: nur der Betrunkene muss tauschen, alle anderen dürfen */
const needsAction = (s: ONState, id: string) => s.start[id] === "betrunkener";

function setup(ctx: GameContext): ONState {
  const ids = ctx.players.map((p) => p.id);
  const deck = shuffle(buildONDeck(ids.length, ctx.options));
  const local = ctx.actorId === null;
  return {
    v: 1, stepwise: local, start: Object.fromEntries(ids.map((id, i) => [id, deck[i]])), center: deck.slice(ids.length),
    phase: "reveal", ready: [], pending: [], done: [], wolfPeek: null, seer: null, robber: null, robberSkip: false,
    trouble: null, troubleSkip: false, drunk: null, final: null, finalCenter: null, dayStartedAt: null,
    minutes: Number(ctx.options.minutes) || 5, votes: {}, dead: [], winners: [],
  };
}


function startNight(s: ONState) {
  s.phase = "night";
  // Schritte gibt es auch für Rollen in der Mitte – sonst würde man am Ablauf erkennen, was fehlt
  const enabled = (step: ONStep) => step === "werwolf" || [...Object.values(s.start), ...s.center].includes(step as ONRole);
  s.pending = s.stepwise ? ["sleep", ...STEP_ORDER.filter(enabled)] : [];
}

function dawn(s: ONState, ctx: GameContext) {
  const { cards, center } = resolveNight(s);
  s.final = cards;
  s.finalCenter = center;
  s.phase = "day";
  s.dayStartedAt = ctx.now;
}

function finishVote(s: ONState, targets: string[]) {
  const final = s.final!;
  const dead = new Set(targets);
  // Jäger nimmt den mit, für den er gestimmt hat
  for (const id of [...dead]) if (final[id] === "jaeger" && s.votes[id]) dead.add(s.votes[id]);
  s.dead = [...dead];
  const players = Object.keys(final);
  const wolvesInPlay = players.some((id) => isWolfTeam(final[id]));
  const wolfDied = s.dead.some((id) => isWolfTeam(final[id]));
  const tannerDied = s.dead.some((id) => final[id] === "gerber");
  const winners: ONState["winners"] = [];
  if (tannerDied) winners.push("gerber");
  if (wolfDied) winners.push("dorf");
  else if (wolvesInPlay && !tannerDied) winners.push("werwolf");
  else if (!wolvesInPlay && !s.dead.length) winners.push("dorf");
  else if (!wolvesInPlay && s.dead.length && players.some((id) => final[id] === "guenstling") && !s.dead.some((id) => final[id] === "guenstling")) winners.push("werwolf");
  s.winners = winners;
  s.phase = "over";
}

function closeVote(s: ONState) {
  const tally = new Map<string, number>();
  for (const t of Object.values(s.votes)) if (t) tally.set(t, (tally.get(t) ?? 0) + 1);
  const max = Math.max(0, ...tally.values());
  // Hat jeder genau eine Stimme, stirbt niemand
  const targets = max >= 2 ? [...tally].filter(([, n]) => n === max).map(([id]) => id) : [];
  finishVote(s, targets);
}

function apply(prev: ONState, a: ONAction, ctx: GameContext): ONState {
  const s = structuredClone(prev);
  const actor = ctx.actorId;
  const me = actor !== null && actor in s.start ? actor : null;
  const leader = actor === null || actor === ctx.hostId;
  /** online: eigene Rolle zu Beginn; lokal: der aktuelle Schritt */
  const acting = (role: ONRole, step: ONStep) => {
    if (s.phase !== "night") throw new GameError("Das geht nur nachts.");
    if (s.stepwise) {
      if (s.pending[0] !== step) throw new GameError("Das ist gerade nicht dran.");
      return;
    }
    if (!me || s.start[me] !== role) throw new GameError("Das darf nur die passende Rolle.");
    if (s.done.includes(me)) throw new GameError("Du hast diese Nacht schon gehandelt.");
  };
  const finishMine = () => {
    if (!s.stepwise && me && !s.done.includes(me)) s.done.push(me);
    if (!s.stepwise && Object.keys(s.start).every((id) => s.done.includes(id))) dawn(s, ctx);
  };
  const others = (id: string | null) => Object.keys(s.start).filter((x) => x !== id);
  const holder = (role: ONRole) => Object.keys(s.start).find((id) => s.start[id] === role) ?? null;

  switch (a.type) {
    case "ready": {
      if (s.phase !== "reveal" || !me) throw new GameError("Gerade nicht.");
      if (!s.ready.includes(me)) s.ready.push(me);
      if (Object.keys(s.start).every((id) => s.ready.includes(id))) startNight(s);
      return s;
    }
    case "startNight": {
      if (s.phase !== "reveal" || !leader) throw new GameError("Das darf nur der Host.");
      startNight(s);
      return s;
    }
    case "next": {
      if (!s.stepwise || s.phase !== "night") throw new GameError("Gerade nicht.");
      const step = s.pending[0];
      // Schritte mit Pflichtaktion erst nach der Aktion weiter (wenn die Rolle mitspielt)
      if (step === "betrunkener" && holder("betrunkener") && s.drunk === null) throw new GameError("Der Betrunkene muss tauschen.");
      s.pending.shift();
      if (!s.pending.length) dawn(s, ctx);
      return s;
    }
    case "peek": {
      acting("werwolf", "werwolf");
      if (Object.values(s.start).filter(isWolfTeam).length !== 1) throw new GameError("Nur ein einsamer Werwolf darf in die Mitte schauen.");
      if (![0, 1, 2].includes(a.i) || s.wolfPeek !== null) throw new GameError("Nur eine Karte.");
      s.wolfPeek = a.i;
      finishMine();
      return s;
    }
    case "see": {
      acting("seherin", "seherin");
      if (s.seer) throw new GameError("Du hast schon geschaut.");
      if (a.player) {
        if (!(a.player in s.start) || a.player === holder("seherin")) throw new GameError("Wähle einen anderen Mitspieler.");
        s.seer = { player: a.player };
      } else if (a.center && a.center.length === 2 && a.center[0] !== a.center[1] && a.center.every((i) => [0, 1, 2].includes(i))) {
        s.seer = { center: [a.center[0], a.center[1]] };
      } else throw new GameError("Einen Mitspieler oder zwei Karten aus der Mitte.");
      finishMine();
      return s;
    }
    case "rob": {
      acting("raeuber", "raeuber");
      if (s.robber || s.robberSkip) throw new GameError("Schon erledigt.");
      if (a.target) {
        if (!(a.target in s.start) || a.target === holder("raeuber")) throw new GameError("Wähle einen anderen Mitspieler.");
        s.robber = a.target;
      } else s.robberSkip = true;
      finishMine();
      return s;
    }
    case "trouble": {
      acting("unruhestifter", "unruhestifter");
      if (s.trouble || s.troubleSkip) throw new GameError("Schon erledigt.");
      if (a.a && a.b) {
        const ok = others(holder("unruhestifter"));
        if (a.a === a.b || !ok.includes(a.a) || !ok.includes(a.b)) throw new GameError("Zwei andere Spieler, bitte.");
        s.trouble = [a.a, a.b];
      } else s.troubleSkip = true;
      finishMine();
      return s;
    }
    case "drunk": {
      acting("betrunkener", "betrunkener");
      if (s.drunk !== null) throw new GameError("Schon getauscht.");
      if (![0, 1, 2].includes(a.i)) throw new GameError("Diese Karte gibt es nicht.");
      s.drunk = a.i;
      finishMine();
      return s;
    }
    case "nightDone": {
      if (s.phase !== "night" || s.stepwise || !me) throw new GameError("Gerade nicht.");
      if (needsAction(s, me) && !s.done.includes(me)) throw new GameError("Erst deine Aktion ausführen.");
      finishMine();
      return s;
    }
    case "vote": {
      if (s.phase !== "day" || s.stepwise || !me) throw new GameError("Abgestimmt wird am Tag.");
      if (!(a.target in s.start) || a.target === me) throw new GameError("Stimme für jemand anderen.");
      s.votes[me] = a.target;
      if (Object.keys(s.start).every((id) => id in s.votes)) closeVote(s);
      return s;
    }
    case "closeVote": {
      if (s.phase !== "day" || s.stepwise || !leader) throw new GameError("Gerade nicht.");
      closeVote(s);
      return s;
    }
    case "lynch": {
      if (s.phase !== "day" || !s.stepwise) throw new GameError("Gerade nicht.");
      if (!Array.isArray(a.targets) || a.targets.some((t) => !(t in s.start))) throw new GameError("Ungültige Auswahl.");
      finishVote(s, [...new Set(a.targets)]);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/** Geheim bleibt: fremde Karten, die Mitte, fremde Nachtaktionen – bis zum Ende */
function view(s: ONState, viewer: string | null): ONState {
  if (viewer === null || s.phase === "over") return s;
  const mine = s.start[viewer];
  const known: Record<string, ONRole> = { [viewer]: mine };
  const wolves = Object.keys(s.start).filter((id) => s.start[id] === "werwolf");
  if (mine === "werwolf" || mine === "guenstling") for (const id of wolves) known[id] = "werwolf";
  if (mine === "freimaurer") for (const id of Object.keys(s.start)) if (s.start[id] === "freimaurer") known[id] = "freimaurer";
  if (mine === "seherin" && s.seer?.player) known[s.seer.player] = s.start[s.seer.player];
  const center: ONRole[] = s.center.map((r, i) =>
    (mine === "werwolf" && s.wolfPeek === i) || (mine === "seherin" && s.seer?.center?.includes(i)) ? r : ("?" as ONRole));
  const final: Record<string, ONRole> | null = s.final ? {} : null;
  if (final && s.final) {
    if (mine === "schlaflose") final[viewer] = s.final[viewer];
  }
  // Räuber sieht seine neue Karte sofort (vor Unruhestifter/Betrunkenem)
  const robbed = mine === "raeuber" && s.robber ? { [viewer]: s.start[s.robber] } : {};
  return {
    ...s,
    start: Object.fromEntries(Object.keys(s.start).map((id) => [id, known[id] ?? ("?" as ONRole)])),
    center,
    final: final ? { ...final, ...robbed } : Object.keys(robbed).length ? robbed : null,
    finalCenter: null,
    seer: mine === "seherin" ? s.seer : null,
    robber: mine === "raeuber" ? s.robber : null,
    trouble: mine === "unruhestifter" ? s.trouble : null,
    drunk: mine === "betrunkener" ? s.drunk : null,
    wolfPeek: mine === "werwolf" ? s.wolfPeek : null,
    votes: Object.fromEntries(Object.entries(s.votes).map(([id, t]) => [id, id === viewer ? t : "?"])),
  };
}

export const einenacht: GameLogic<ONState, ONAction> = {
  info: {
    id: "einenacht",
    name: "Eine Nacht",
    tagline: "Werwolf in einer einzigen Nacht: heimlich vertauschte Karten, eine Abstimmung – in 10 Minuten entschieden.",
    category: "Party",
    minPlayers: 3,
    maxPlayers: 10,
    duration: "10 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: false,
  settings: [
    { key: "wolves", label: "Werwölfe", type: "choice", default: "2", choices: [{ value: "1", label: "1 Werwolf" }, { value: "2", label: "2 Werwölfe" }] },
    { key: "minutes", label: "Diskussion (Minuten)", type: "number", default: 5, min: 1, max: 15, step: 1 },
    ...ON_SPECIALS.map((r) => ({
      key: r, label: `${ON_ROLES[r].name}${r === "freimaurer" ? " (zwei Karten)" : ""}`, type: "toggle" as const,
      default: ["seherin", "raeuber", "unruhestifter"].includes(r), hint: ON_ROLES[r].short, group: "Rollen",
    })),
  ],
  setup,
  apply,
  actionKind: (a) => (["ready", "startNight", "next", "peek", "see", "rob", "trouble", "drunk", "nightDone", "vote", "closeVote", "lynch"].includes(a.type) ? "player" : null),
  currentPlayerId: () => null,
  isOver: (s) => s.phase === "over",
  silent: (s) => s.phase === "night",
  results: (s) => {
    const final = s.final ?? s.start;
    const team = (r: ONRole) => (r === "werwolf" || r === "guenstling" ? "werwolf" : r === "gerber" ? "gerber" : "dorf");
    return Object.keys(final).map((id) => ({ id, won: s.winners.includes(team(final[id])) }));
  },
  skipLabel: (s) => (s.phase === "reveal" ? "Nacht beginnen" : s.phase === "night" && !s.stepwise ? "Nacht beenden (offene Aktionen verfallen)" : s.phase === "day" && !s.stepwise ? "Abstimmung beenden" : null),
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "reveal") startNight(s);
    else if (s.phase === "night") dawn(s, ctx);
    else if (s.phase === "day") closeVote(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    // Wer geht, scheidet aus: Die Runde wird ohne ihn fortgesetzt
    const s = structuredClone(prev);
    delete s.start[id];
    if (s.final) delete s.final[id];
    delete s.votes[id];
    s.ready = s.ready.filter((x) => x !== id);
    s.done = s.done.filter((x) => x !== id);
    if (s.robber === id) s.robber = null;
    if (s.trouble?.includes(id)) s.trouble = null;
    if (s.phase === "night" && !s.stepwise && Object.keys(s.start).every((x) => s.done.includes(x))) dawn(s, ctx);
    if (s.phase === "day" && !s.stepwise && Object.keys(s.start).every((x) => x in s.votes)) closeVote(s);
    return s;
  },
  view,
};
