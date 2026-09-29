/**
 * Werwolf (nach „Die Werwölfe von Düsterwald“ samt Erweiterungen) – läuft im Browser (lokal) und im Durable Object (online).
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
import { GameError, type GameContext, type GameLogic, type Options, type SettingDef } from "../../platform/types";

export type Role =
  | "werwolf" | "urwolf" | "grosserwolf"
  | "dorf" | "seherin" | "hexe" | "jaeger" | "amor" | "beschuetzer"
  | "alter" | "dorfdepp" | "suendenbock"
  | "wildeskind" | "wolfshund" | "fuchs" | "baerenfuehrer" | "ritter" | "schwester"
  | "rabe" | "schlampe"
  | "dieb" | "weisserwolf" | "floetenspieler" | "engel";
/** "solo": spielt auf eigene Rechnung (eigenes Siegziel) */
export type Team = "dorf" | "werwolf" | "solo";

export interface RoleInfo {
  id: Role;
  name: string;
  team: Team;
  emoji: string;
  /** Herkunft (für die Regelseite) */
  from: "Grundspiel" | "Neumond" | "Charaktere" | "Die Gemeinde" | "Hausregel";
  /** kurz für die Rollenkarte */
  short: string;
  /** ausführlich für die Regelseite */
  help: string;
}

export const ROLES: Record<Role, RoleInfo> = {
  werwolf: { id: "werwolf", name: "Werwolf", team: "werwolf", emoji: "🐺", from: "Grundspiel", short: "Nachts sucht ihr Wölfe gemeinsam ein Opfer aus. Tagsüber tarnt ihr euch.", help: "Die Werwölfe erwachen jede Nacht gemeinsam und einigen sich auf ein Opfer. Sie gewinnen, sobald sie mindestens so viele sind wie alle anderen zusammen." },
  dorf: { id: "dorf", name: "Dorfbewohner", team: "dorf", emoji: "🧑‍🌾", from: "Grundspiel", short: "Keine Fähigkeit – nur deine Menschenkenntnis. Finde die Werwölfe!", help: "Dorfbewohner haben keine Sonderfähigkeit. Tagsüber diskutieren sie und stimmen ab, wen das Dorf verdächtigt." },
  seherin: { id: "seherin", name: "Seherin", team: "dorf", emoji: "🔮", from: "Grundspiel", short: "Jede Nacht erfährst du die Rolle eines Mitspielers.", help: "Die Seherin (manchmal Hellseherin genannt) erwacht jede Nacht und darf sich die Rolle eines Mitspielers ansehen. Klug einsetzen – wer sich zu früh verrät, wird gefressen." },
  hexe: { id: "hexe", name: "Hexe", team: "dorf", emoji: "🧪", from: "Grundspiel", short: "Ein Heiltrank und ein Gifttrank – je einmal im Spiel.", help: "Die Hexe erfährt jede Nacht das Opfer der Werwölfe. Sie hat einen Heiltrank (rettet das Opfer) und einen Gifttrank (tötet jemanden) – jeden nur einmal im ganzen Spiel. Sie darf beide in derselben Nacht benutzen." },
  jaeger: { id: "jaeger", name: "Jäger", team: "dorf", emoji: "🏹", from: "Grundspiel", short: "Wenn du stirbst, nimmst du jemanden mit in den Tod.", help: "Stirbt der Jäger – egal ob nachts oder durch das Dorf –, schießt er sofort auf einen Mitspieler, der ebenfalls stirbt." },
  amor: { id: "amor", name: "Amor", team: "dorf", emoji: "💘", from: "Grundspiel", short: "In der ersten Nacht verliebst du zwei Menschen.", help: "Amor wählt in der ersten Nacht zwei Verliebte (auch sich selbst). Stirbt einer von ihnen, stirbt der andere aus Kummer. Sind die Verliebten ein Werwolf und ein Dorfbewohner, gewinnen sie nur, wenn sie als Letzte übrig bleiben." },
  beschuetzer: { id: "beschuetzer", name: "Heiler", team: "dorf", emoji: "🛡️", from: "Neumond", short: "Jede Nacht schützt du eine Person vor den Werwölfen.", help: "Der Heiler (auch Beschützer oder Leibwächter) wählt jede Nacht eine Person – auch sich selbst –, die in dieser Nacht nicht von Werwölfen gefressen werden kann. Nicht zweimal hintereinander dieselbe." },
  alter: { id: "alter", name: "Der Alte", team: "dorf", emoji: "👴", from: "Neumond", short: "Den ersten Angriff der Werwölfe überlebst du.", help: "Der Alte ist zäh: Den ersten Angriff der Werwölfe übersteht er. Erst beim zweiten Angriff stirbt er. Gegen Gift, Jäger und Dorf hilft das nicht." },
  dorfdepp: { id: "dorfdepp", name: "Dorfdepp", team: "dorf", emoji: "🤪", from: "Neumond", short: "Verurteilt dich das Dorf, lacht es nur – du lebst, darfst aber nicht mehr abstimmen.", help: "Wird der Dorfdepp vom Dorf verurteilt, erkennt man ihn und lässt ihn am Leben. Er ist aufgedeckt und darf ab dann nicht mehr abstimmen. Nachts kann er aber gefressen werden." },
  suendenbock: { id: "suendenbock", name: "Sündenbock", team: "dorf", emoji: "🐐", from: "Neumond", short: "Gibt es bei der Abstimmung Gleichstand, stirbst du.", help: "Endet die Abstimmung des Dorfes unentschieden, stirbt statt niemandem der Sündenbock." },
  wildeskind: { id: "wildeskind", name: "Wildes Kind", team: "dorf", emoji: "🧒", from: "Charaktere", short: "Wähle ein Vorbild. Stirbt es, wirst du zum Werwolf.", help: "Das wilde Kind wählt in der ersten Nacht ein Vorbild. Solange das Vorbild lebt, gehört es zum Dorf. Stirbt das Vorbild, wird das Kind heimlich zum Werwolf und jagt ab der nächsten Nacht mit." },
  wolfshund: { id: "wolfshund", name: "Wolfshund", team: "dorf", emoji: "🐕", from: "Charaktere", short: "In der ersten Nacht entscheidest du: Dorf oder Werwolf?", help: "Der Wolfshund entscheidet in der ersten Nacht, ob er ein treuer Dorfbewohner bleibt oder zum Werwolf wird – dann jagt er schon in dieser Nacht mit." },
  fuchs: { id: "fuchs", name: "Fuchs", team: "dorf", emoji: "🦊", from: "Charaktere", short: "Du erfährst, ob bei einer Person oder ihren Nachbarn ein Wolf ist.", help: "Der Fuchs zeigt nachts auf eine Person. Er erfährt, ob sie oder einer ihrer beiden Sitznachbarn (in Spielerreihenfolge, nur Lebende) ein Werwolf ist. Ist dort keiner, verliert er seine Fähigkeit." },
  baerenfuehrer: { id: "baerenfuehrer", name: "Bärenführer", team: "dorf", emoji: "🐻", from: "Charaktere", short: "Sitzt ein Wolf neben dir, brummt morgens dein Bär.", help: "Sitzt morgens einer der beiden lebenden Nachbarn des Bärenführers (in Spielerreihenfolge) als Werwolf neben ihm, brummt der Bär – das ganze Dorf hört es." },
  ritter: { id: "ritter", name: "Ritter mit rostigem Schwert", team: "dorf", emoji: "🗡️", from: "Charaktere", short: "Fressen dich die Wölfe, stirbt einer von ihnen eine Nacht später.", help: "Wird der Ritter von Werwölfen gefressen, verletzt sein rostiges Schwert den nächsten Werwolf nach ihm in der Spielerreihenfolge – dieser stirbt in der folgenden Nacht an Wundstarrkrampf." },
  schwester: { id: "schwester", name: "Schwester", team: "dorf", emoji: "👭", from: "Charaktere", short: "Du und deine Schwester kennt euch – ihr seid beide sicher vom Dorf.", help: "Zwei Schwestern kennen einander von Anfang an. Sie wissen also sicher, dass die andere zum Dorf gehört." },
  urwolf: { id: "urwolf", name: "Urwolf", team: "werwolf", emoji: "🌑", from: "Charaktere", short: "Du jagst mit den Wölfen und kannst einmal ein Opfer zum Werwolf machen.", help: "Der Urwolf ist ein Werwolf. Einmal im Spiel kann er das Opfer der Nacht verwandeln, statt es zu fressen: Es stirbt nicht, sondern ist ab sofort ein Werwolf (und verliert seine alte Rolle)." },
  grosserwolf: { id: "grosserwolf", name: "Großer böser Wolf", team: "werwolf", emoji: "🌕", from: "Charaktere", short: "Du frisst jede Nacht noch ein zweites Opfer – bis der erste Wolf stirbt.", help: "Der große böse Wolf jagt mit den anderen Wölfen und frisst danach allein ein zweites Opfer – solange noch kein Werwolf gestorben ist." },
  dieb: { id: "dieb", name: "Dieb", team: "dorf", emoji: "🥷", from: "Grundspiel", short: "In der ersten Nacht darfst du deine Karte gegen eine der zwei übrigen tauschen.", help: "Mit dem Dieb kommen zwei Karten mehr ins Spiel, die übrig bleiben. In der ersten Nacht sieht der Dieb diese beiden und darf seine Karte gegen eine davon tauschen. Sind beide Werwölfe, muss er tauschen. Liegt der Dieb selbst bei den übrigen Karten, spielt niemand ihn." },
  weisserwolf: { id: "weisserwolf", name: "Weißer Werwolf", team: "solo", emoji: "🐺‍❄️", from: "Charaktere", short: "Du jagst mit dem Rudel – und frisst jede zweite Nacht heimlich einen Wolf. Du gewinnst allein.", help: "Der weiße Werwolf erwacht mit den Werwölfen und gilt für sie als einer von ihnen. Jede zweite Nacht darf er zusätzlich allein einen Werwolf fressen. Er gewinnt nur, wenn er als Einziger übrig bleibt." },
  floetenspieler: { id: "floetenspieler", name: "Flötenspieler", team: "solo", emoji: "🪈", from: "Neumond", short: "Jede Nacht verzauberst du zwei Menschen. Sind alle verzaubert, gewinnst du allein.", help: "Der Flötenspieler verzaubert jede Nacht zwei Mitspieler. Die Verzauberten erfahren das, wissen aber nicht, wer der Flötenspieler ist. Sind alle anderen Lebenden verzaubert, gewinnt er sofort allein." },
  engel: { id: "engel", name: "Engel", team: "solo", emoji: "😇", from: "Charaktere", short: "Stirbst du in der ersten Nacht oder am ersten Tag, gewinnst du sofort.", help: "Der Engel will so schnell wie möglich in den Himmel: Stirbt er in der ersten Nacht oder wird er am ersten Tag verurteilt, gewinnt er allein und das Spiel ist vorbei. Überlebt er, spielt er als gewöhnlicher Dorfbewohner weiter." },
  schlampe: { id: "schlampe", name: "Dorfschlampe", team: "dorf", emoji: "💋", from: "Hausregel", short: "Jede Nacht übernachtest du bei jemand anderem – das kann dich retten oder dich das Leben kosten.", help: "Die Dorfschlampe (auch Dorfmatratze) sucht sich jede Nacht einen Mitspieler aus, bei dem sie übernachtet. Greifen die Werwölfe ihr eigenes Haus an, überlebt sie – sie ist ja nicht zu Hause. Übernachtet sie aber beim Opfer der Werwölfe, stirbt sie mit. Und übernachtet sie bei einem Werwolf, fressen die Wölfe sie ebenfalls." },
  rabe: { id: "rabe", name: "Rabe", team: "dorf", emoji: "🐦‍⬛", from: "Die Gemeinde", short: "Nachts markierst du jemanden: Am Tag hat er zwei Stimmen mehr gegen sich.", help: "Der Rabe markiert nachts einen Mitspieler. Bei der nächsten Abstimmung zählen gegen ihn automatisch zwei Stimmen mehr." },
};

/** Zum Werwolf-Team gehören alle Wolfsrollen */
export const isWolf = (r: Role | undefined) => !!r && (ROLES[r].team === "werwolf" || r === "weisserwolf");
/** Für Liebespaare: Team einer Rolle (Engel zählt zum Dorf, sobald die erste Runde vorbei ist) */
const teamOf = (r: Role) => (r === "engel" ? "dorf" : ROLES[r].team);

export const SPECIAL_ROLES = [
  "seherin", "hexe", "jaeger", "amor", "beschuetzer", "alter", "dorfdepp", "suendenbock",
  "wildeskind", "wolfshund", "fuchs", "baerenfuehrer", "ritter", "schwester", "urwolf", "grosserwolf", "rabe", "schlampe",
  "dieb", "weisserwolf", "floetenspieler", "engel",
] as const satisfies readonly Role[];

/** Alle Rollen, die man bei „eigenen Karten“ zuordnen kann */
export const ALL_ROLES: Role[] = ["werwolf", "dorf", ...SPECIAL_ROLES];

export type Step =
  | "sleep" | "amor" | "lovers" | "wildeskind" | "wolfshund" | "schwestern" | "beschuetzer" | "schlampe"
  | "werwolf" | "weisserwolf" | "urwolf" | "grosserwolf" | "seherin" | "fuchs" | "rabe" | "hexe"
  | "dieb" | "floetenspieler" | "verzaubert";
/** Welche Rolle handelt in einem Nachtschritt? („werwolf“: alle Wölfe) */
export const STEP_ROLE: Partial<Record<Step, Role>> = {
  amor: "amor", wildeskind: "wildeskind", wolfshund: "wolfshund", beschuetzer: "beschuetzer", werwolf: "werwolf",
  urwolf: "urwolf", grosserwolf: "grosserwolf", seherin: "seherin", fuchs: "fuchs", rabe: "rabe", hexe: "hexe",
  dieb: "dieb", weisserwolf: "weisserwolf", floetenspieler: "floetenspieler", schlampe: "schlampe",
};
/** Schritte, die erst nach anderen möglich sind (wichtig, wenn online alle gleichzeitig handeln) */
const NEEDS: Partial<Record<Step, Step[]>> = { urwolf: ["werwolf"], grosserwolf: ["werwolf"], hexe: ["werwolf", "urwolf"] };

/**
 * assign: eigene Karten werden zugeordnet · election: Hauptmannwahl · successor: sterbender Hauptmann bestimmt Nachfolger
 */
export type Phase = "assign" | "reveal" | "night" | "election" | "day" | "hunter" | "successor" | "over";
export type Winner = "dorf" | "werwolf" | "liebe" | "weisserwolf" | "floete" | "engel";

export interface Death { id: string; cause: "wolf" | "weiss" | "gift" | "dorf" | "jaeger" | "kummer" | "rost" | "besuch" | "weg" }

/** Hausregeln – jede Runde spielt Werwolf ein bisschen anders */
export interface HouseRules {
  /** Hauptmann: am ersten Tag gewählt, doppelte Stimme, entscheidet Gleichstand mit */
  captain: boolean;
  /** Gleichstand: niemand stirbt oder Stichwahl der Gleichstehenden */
  tie: "none" | "runoff";
  /** Seherin erfährt nur „gut“ oder „böse“ */
  aura: boolean;
  /** Hexe darf sich selbst heilen */
  selfHeal: boolean;
  /** In der ersten Nacht fressen die Werwölfe nicht */
  peaceful: boolean;
  /** Tote dürfen mitreden (nur Hinweis für den Tisch) */
  deadTalk: boolean;
  /** Ihr spielt mit echten Karten – die App verteilt nicht */
  ownCards: boolean;
}

export function rulesOf(o: Options): HouseRules {
  return {
    captain: o.captain === true, tie: o.tie === "runoff" ? "runoff" : "none", aura: o.aura === true,
    selfHeal: o.selfHeal !== false, peaceful: o.peaceful === true, deadTalk: o.deadTalk === true, ownCards: o.cards === "own",
  };
}

export interface WerwolfState {
  v: 1;
  mode: "human" | "app";
  rules: HouseRules;
  /** Hauptmann (falls die Hausregel an ist) */
  captain: string | null;
  captainElected: boolean;
  /** Stichwahl: nur diese Personen stehen zur Wahl */
  runoff: string[] | null;
  /** vom Flötenspieler verzaubert */
  enchanted: string[];
  /** in dieser Nacht neu verzaubert */
  enchantedTonight: string[];
  /** die zwei übrigen Karten (Dieb) */
  extra: Role[];
  /** Opfer des weißen Werwolfs heute Nacht */
  whiteKill: string | null;
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
  /** zweites Opfer des großen bösen Wolfs */
  victim2: string | null;
  protectedId: string | null;
  lastProtected: string | null;
  seer: { night: number; target: string; role: Role }[];
  fox: { night: number; target: string; wolf: boolean }[];
  foxPower: boolean;
  potions: { heal: boolean; poison: boolean };
  healed: boolean;
  poisoned: string | null;
  /** Vorbild des wilden Kindes */
  model: string | null;
  /** Urwolf: schon verwandelt? und wen heute Nacht */
  infectUsed: boolean;
  infected: string | null;
  /** Rabe: Markierung für den kommenden Tag (+2 Stimmen) */
  raven: string | null;
  /** Dorfschlampe: bei wem sie heute Nacht übernachtet */
  visit?: string | null;
  /** Ritter: dieser Wolf stirbt am nächsten Morgen */
  rusty: string | null;
  wolfDied: boolean;
  elderHit: boolean;
  /** aufgedeckte Dorfdeppen – dürfen nicht mehr abstimmen */
  idiots: string[];
  /** Verdacht während der Nacht (App-Modus online, zur Tarnung) */
  suspicions: Record<string, string>;
  /** Abstimmung am Tag (App-Modus online): Stimme oder "" für Enthaltung */
  votes: Record<string, string>;
  /** Ergebnis der letzten Nacht bzw. Abstimmung */
  news: {
    kind: "night" | "day";
    deaths: Death[];
    tally?: Record<string, number>;
    /** der Bär hat gebrummt */
    growl?: boolean;
    /** vom Raben markiert */
    raven?: string | null;
    /** Dorfdepp wurde verurteilt und bleibt am Leben */
    idiot?: string;
    /** Sündenbock musste bei Gleichstand sterben */
    scapegoat?: boolean;
  } | null;
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
  | { type: "model"; target: string }
  | { type: "dog"; wolf: boolean }
  | { type: "protect"; target: string }
  | { type: "wolf"; target: string }
  | { type: "infect"; yes: boolean }
  | { type: "wolf2"; target: string }
  | { type: "see"; target: string }
  | { type: "fox"; target: string }
  | { type: "raven"; target: string | null }
  | { type: "visit"; target: string }
  | { type: "witch"; heal: boolean; poison: string | null }
  | { type: "suspect"; target: string }
  | { type: "next" }
  | { type: "vote"; target: string }
  | { type: "closeVote" }
  | { type: "lynch"; target: string | null }
  | { type: "shoot"; target: string }
  | { type: "assign"; id: string; role: Role }
  | { type: "claim"; role: Role }
  | { type: "assignDone" }
  | { type: "steal"; pick: number | null; role?: Role }
  | { type: "white"; target: string | null }
  | { type: "enchant"; a: string; b?: string }
  | { type: "elect"; target: string }
  | { type: "successor"; target: string };

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
export const aliveWolves = (s: WerwolfState) => aliveIds(s).filter((id) => isWolf(s.roles[id]));
/** Wer darf am Tag abstimmen? (aufgedeckte Dorfdeppen nicht) */
export const voters = (s: WerwolfState) => aliveIds(s).filter((id) => !s.idiots.includes(id));

/** Die beiden lebenden Sitznachbarn (Spielerreihenfolge, im Kreis) */
export function neighbors(s: WerwolfState, id: string): string[] {
  const alive = aliveIds(s);
  const i = alive.indexOf(id);
  if (i < 0 || alive.length < 2) return [];
  const prev = alive[(i - 1 + alive.length) % alive.length];
  const next = alive[(i + 1) % alive.length];
  return prev === next ? [prev] : [prev, next];
}

/** Rollenverteilung aus den Einstellungen */
export function buildDeck(n: number, o: Options): Role[] {
  const wolves = o.wolves === "auto" || o.wolves === undefined ? autoWolves(n) : Number(o.wolves);
  const specials = SPECIAL_ROLES.filter((r) => o[r] === true);
  const specialWolves = specials.filter((r) => isWolf(r));
  const village = specials.filter((r) => !isWolf(r)).flatMap((r) => (r === "schwester" ? [r, r] : [r]));
  if (wolves < 1) throw new GameError("Es braucht mindestens einen Werwolf.");
  if (wolves * 2 >= n) throw new GameError(`${wolves} Werwölfe sind zu viele für ${n} Mitspieler.`);
  if (specialWolves.length > wolves) throw new GameError("Urwolf und großer böser Wolf zählen als Werwölfe – stell mehr Werwölfe ein.");
  if (wolves + village.length > n) throw new GameError(`Zu viele Sonderrollen für ${n} Mitspieler – schalte welche ab.`);
  const deck: Role[] = [...specialWolves, ...Array(wolves - specialWolves.length).fill("werwolf"), ...village];
  while (deck.length < n) deck.push("dorf");
  return deck;
}

function setup(ctx: GameContext): WerwolfState {
  const mode = modeOf(ctx.options);
  const local = ctx.actorId === null;
  const narratorId = mode === "human" && !local ? ctx.hostId : null;
  const ids = ctx.players.map((p) => p.id).filter((id) => id !== narratorId);
  if (ids.length < 5) throw new GameError(narratorId ? "Werwolf braucht mindestens 5 Mitspieler plus Spielleiter." : "Werwolf braucht mindestens 5 Mitspieler.");
  const rules = rulesOf(ctx.options);
  // Mit Dieb kommen zwei Dorfbewohner-Karten dazu, die übrig bleiben
  const base = rules.ownCards ? ids.map(() => "dorf" as Role) : buildDeck(ids.length, ctx.options);
  const deck: Role[] = rules.ownCards ? base : shuffle<Role>(base.includes("dieb") ? [...base, "dorf", "dorf"] : base);
  return {
    v: 1, mode, rules, captain: null, captainElected: false, runoff: null, enchanted: [], enchantedTonight: [],
    extra: deck.slice(ids.length), whiteKill: null,
    stepwise: mode === "human" || local, narratorId, revealDead: ctx.options.revealDead !== false,
    roles: Object.fromEntries(ids.map((id, i) => [id, deck[i]])), alive: Object.fromEntries(ids.map((id) => [id, true])),
    lovers: null, phase: rules.ownCards ? "assign" : "reveal", ready: [], night: 0, pending: [], acted: [],
    wolfVotes: {}, victim: null, victim2: null, protectedId: null, lastProtected: null, seer: [], fox: [], foxPower: true,
    potions: { heal: true, poison: true }, healed: false, poisoned: null, model: null, infectUsed: false, infected: null,
    raven: null, rusty: null, wolfDied: false, elderHit: false, idiots: [],
    suspicions: {}, votes: {}, news: null, hunters: [], afterHunter: "day", winner: null, log: [],
  };
}

const nameOf = (ctx: GameContext, id: string) => ctx.players.find((p) => p.id === id)?.name ?? "?";

function startNight(s: WerwolfState) {
  s.phase = "night";
  s.night++;
  s.acted = [];
  s.wolfVotes = {};
  s.victim = null;
  s.victim2 = null;
  s.lastProtected = s.protectedId;
  s.protectedId = null;
  s.healed = false;
  s.poisoned = null;
  s.infected = null;
  s.raven = null;
  s.visit = null;
  s.whiteKill = null;
  s.enchantedTonight = [];
  s.runoff = null;
  s.suspicions = {};
  s.votes = {};
  const has = (r: Role) => aliveHolders(s, r).length > 0;
  const steps: Step[] = [];
  const peaceful = s.night === 1 && s.rules.peaceful;
  if (s.stepwise) steps.push("sleep");
  if (s.night === 1) {
    if (has("dieb")) steps.push("dieb");
    if (has("amor")) steps.push("amor", ...(s.stepwise ? ["lovers" as const] : []));
    if (has("wildeskind")) steps.push("wildeskind");
    if (has("wolfshund")) steps.push("wolfshund");
    if (s.stepwise && aliveHolders(s, "schwester").length > 1) steps.push("schwestern");
  }
  if (has("beschuetzer")) steps.push("beschuetzer");
  if (has("schlampe")) steps.push("schlampe");
  // Kein mögliches Opfer (nur noch Wölfe am Leben): der Rudel-Schritt entfällt, sonst hinge die Nacht
  const prey = aliveIds(s).some((id) => !isWolf(s.roles[id]));
  if (!peaceful && prey) {
    steps.push("werwolf");
    if (has("weisserwolf") && s.night % 2 === 0) steps.push("weisserwolf");
    if (has("urwolf") && !s.infectUsed) steps.push("urwolf");
    if (has("grosserwolf") && !s.wolfDied) steps.push("grosserwolf");
  } else if (!peaceful && has("weisserwolf") && s.night % 2 === 0) steps.push("weisserwolf");
  if (has("seherin")) steps.push("seherin");
  if (has("fuchs") && s.foxPower) steps.push("fuchs");
  if (has("rabe")) steps.push("rabe");
  if (has("hexe") && (s.potions.heal || s.potions.poison)) steps.push("hexe");
  if (has("floetenspieler") && aliveIds(s).some((id) => s.roles[id] !== "floetenspieler" && !s.enchanted.includes(id))) {
    steps.push("floetenspieler", ...(s.stepwise ? ["verzaubert" as const] : []));
  }
  s.pending = steps;
}

/** Tötet Spieler samt Liebeskummer; merkt Jäger vor. */
function kill(s: WerwolfState, deaths: Death[], id: string, cause: Death["cause"]) {
  if (!s.alive[id]) return;
  s.alive[id] = false;
  deaths.push({ id, cause });
  if (isWolf(s.roles[id])) s.wolfDied = true;
  // Engel: stirbt er in der ersten Runde, gewinnt er
  if (s.roles[id] === "engel" && s.night <= 1 && cause !== "weg" && !s.winner) s.winner = "engel";
  if (s.roles[id] === "jaeger" && cause !== "weg") s.hunters.push(id);
  if (s.lovers?.includes(id)) {
    const other = s.lovers[0] === id ? s.lovers[1] : s.lovers[0];
    kill(s, deaths, other, "kummer");
  }
}

/** Angriff der Werwölfe: Schutz, Heiltrank und der Alte können retten */
function attack(s: WerwolfState, deaths: Death[], id: string | null, healable: boolean) {
  if (!id || !s.alive[id] || id === s.protectedId) return;
  if (healable && s.healed) return;
  // Die Dorfschlampe ist nachts woanders – ihr leeres Haus rettet sie
  if (s.roles[id] === "schlampe" && s.visit && s.visit !== id) return;
  if (s.roles[id] === "alter" && !s.elderHit) { s.elderHit = true; return; }
  kill(s, deaths, id, "wolf");
  // Ritter: der nächste Wolf nach ihm stirbt am folgenden Morgen
  if (s.roles[id] === "ritter") {
    const order = participants(s);
    const i = order.indexOf(id);
    for (let k = 1; k < order.length; k++) {
      const cand = order[(i + k) % order.length];
      if (s.alive[cand] && isWolf(s.roles[cand])) { s.rusty = cand; break; }
    }
  }
}

export function checkWinner(s: WerwolfState): Winner | null {
  if (s.winner === "engel") return "engel";
  const alive = aliveIds(s);
  const wolves = alive.filter((id) => isWolf(s.roles[id])).length;
  const white = alive.find((id) => s.roles[id] === "weisserwolf");
  const flute = alive.find((id) => s.roles[id] === "floetenspieler");
  const [a, b] = s.lovers ?? [];
  const mixedLovers = !!s.lovers && teamOf(s.roles[a!]) !== teamOf(s.roles[b!]);
  if (mixedLovers && alive.length === 2 && alive.includes(a!) && alive.includes(b!)) return "liebe";
  if (flute && alive.every((id) => id === flute || s.enchanted.includes(id))) return "floete";
  if (white && alive.length === 1) return "weisserwolf";
  if (wolves === 0) return alive.length ? "dorf" : "werwolf";
  // Mit lebendem weißen Werwolf geht es weiter, bis er allein ist oder stirbt
  if (white) return null;
  if (wolves * 2 >= alive.length) return "werwolf";
  return null;
}

/** Nach Todesfällen: wildes Kind, Sieg, Jäger, Hauptmann-Nachfolge oder weiter */
function afterDeaths(s: WerwolfState, next: "day" | "night") {
  for (const kid of aliveHolders(s, "wildeskind")) {
    if (s.model && !s.alive[s.model]) s.roles[kid] = "werwolf";
  }
  s.enchanted = s.enchanted.filter((id) => s.alive[id]);
  s.winner = checkWinner(s);
  if (s.winner) { s.phase = "over"; return; }
  s.afterHunter = next;
  if (s.hunters.length) { s.phase = "hunter"; return; }
  if (s.captain && !s.alive[s.captain]) { s.phase = "successor"; return; }
  continueTo(s, next);
}

function continueTo(s: WerwolfState, next: "day" | "night") {
  if (next === "night") { startNight(s); return; }
  s.votes = {};
  s.runoff = null;
  // Hausregel Hauptmann: am ersten Tag wird zuerst gewählt
  s.phase = s.rules.captain && !s.captainElected ? "election" : "day";
}

function dawn(s: WerwolfState, ctx: GameContext) {
  const deaths: Death[] = [];
  const rustyTonight = s.rusty;
  s.rusty = null;
  if (s.infected && s.alive[s.infected]) s.roles[s.infected] = "werwolf";
  attack(s, deaths, s.victim, true);
  attack(s, deaths, s.victim2, false);
  // Dorfschlampe: beim Opfer oder bei einem Werwolf übernachtet – dann stirbt sie mit
  const harlot = aliveHolders(s, "schlampe")[0];
  if (harlot && s.visit && s.alive[harlot] && harlot !== s.protectedId) {
    const peaceful = s.night === 1 && s.rules.peaceful;
    if (deaths.some((d) => d.id === s.visit && d.cause === "wolf") || (!peaceful && isWolf(s.roles[s.visit]))) kill(s, deaths, harlot, "besuch");
  }
  if (s.whiteKill && s.alive[s.whiteKill]) kill(s, deaths, s.whiteKill, "weiss");
  if (s.poisoned) kill(s, deaths, s.poisoned, "gift");
  if (rustyTonight && s.alive[rustyTonight]) kill(s, deaths, rustyTonight, "rost");
  const tally: Record<string, number> = {};
  for (const t of Object.values(s.suspicions)) tally[t] = (tally[t] ?? 0) + 1;
  const bear = aliveHolders(s, "baerenfuehrer")[0];
  const growl = bear ? neighbors(s, bear).some((id) => isWolf(s.roles[id])) : undefined;
  s.news = { kind: "night", deaths, tally: s.stepwise ? undefined : tally, growl, raven: s.raven && s.alive[s.raven] ? s.raven : null };
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

/** Ist ein Schritt noch offen (nicht ausgeführt)? */
const open = (s: WerwolfState, step: Step) => s.pending.includes(step) && !s.acted.includes(step);

/** Darf der Akteur diesen Schritt ausführen? */
function assertStep(s: WerwolfState, step: Step, actorId: string | null) {
  if (s.phase !== "night") throw new GameError("Das geht nur nachts.");
  if (!s.pending.includes(step)) throw new GameError("Das ist heute Nacht nicht dran.");
  if (s.stepwise) {
    if (s.pending[0] !== step) throw new GameError("Das ist gerade nicht dran.");
    if (actorId !== null && actorId !== s.narratorId) throw new GameError("Das tippt der Spielleiter ein.");
    return;
  }
  if ((NEEDS[step] ?? []).some((n) => open(s, n))) throw new GameError("Warte, bis die Werwölfe gewählt haben.");
  if (actorId === null) return;
  const role = s.roles[actorId];
  const ok = step === "werwolf" ? isWolf(role) : STEP_ROLE[step] === role;
  if (!ok || !s.alive[actorId]) throw new GameError("Das darf nur die passende Rolle.");
}

function assertAlive(s: WerwolfState, id: string, what = "Diese Person") {
  if (!(id in s.roles)) throw new GameError(`${what} spielt nicht mit.`);
  if (!s.alive[id]) throw new GameError(`${what} ist schon tot.`);
}

/** Mehrheit; bei Gleichstand null (oder zufällig, wenn `random`) */
function majority(tally: Map<string, number>, random: boolean): string | null {
  if (!tally.size) return null;
  const max = Math.max(...tally.values());
  const top = [...tally].filter(([, n]) => n === max).map(([id]) => id);
  if (top.length === 1) return top[0];
  return random ? top[randomInt(top.length)] : null;
}
const count = (votes: string[]) => {
  const t = new Map<string, number>();
  for (const v of votes) if (v) t.set(v, (t.get(v) ?? 0) + 1);
  return t;
};

function resolveVote(s: WerwolfState, ctx: GameContext, target: string | null, tally?: Record<string, number>, scapegoat = false) {
  const deaths: Death[] = [];
  let idiot: string | undefined;
  if (target && s.roles[target] === "dorfdepp" && !s.idiots.includes(target)) {
    // Das Dorf erkennt den Dorfdepp und lässt ihn leben
    s.idiots.push(target);
    idiot = target;
  } else if (target) kill(s, deaths, target, "dorf");
  s.news = { kind: "day", deaths, tally, idiot, scapegoat: scapegoat || undefined };
  s.log.push(`Tag ${s.night}: ${idiot ? `${nameOf(ctx, idiot)} ist der Dorfdepp und bleibt am Leben` : target ? `${nameOf(ctx, target)} vom Dorf verurteilt` : "niemand verurteilt"}`);
  afterDeaths(s, "night");
}

/** Stimmen zählen: der Hauptmann zählt doppelt, der Rabe gibt zwei dazu */
function tallyVotes(s: WerwolfState, withRaven: boolean) {
  const tally = new Map<string, number>();
  for (const [voter, t] of Object.entries(s.votes)) if (t) tally.set(t, (tally.get(t) ?? 0) + (voter === s.captain ? 2 : 1));
  if (withRaven && s.raven && s.alive[s.raven]) tally.set(s.raven, (tally.get(s.raven) ?? 0) + 2);
  return tally;
}

function closeVote(s: WerwolfState, ctx: GameContext) {
  if (s.phase === "election") {
    const winner = majority(tallyVotes(s, false), true);
    electCaptain(s, ctx, winner);
    return;
  }
  const tally = tallyVotes(s, !s.runoff);
  let target = majority(tally, false);
  if (!target && tally.size > 0) {
    const max = Math.max(...tally.values());
    const top = [...tally].filter(([, n]) => n === max).map(([id]) => id);
    // Hauptmann entscheidet Gleichstand, wenn er für einen der Gleichstehenden gestimmt hat
    const cv = s.captain ? s.votes[s.captain] : undefined;
    if (cv && top.includes(cv)) target = cv;
    else if (s.rules.tie === "runoff" && !s.runoff) {
      s.runoff = top;
      s.votes = {};
      s.log.push(`Tag ${s.night}: Stichwahl zwischen ${top.map((id) => nameOf(ctx, id)).join(" und ")}`);
      return;
    }
  }
  let scapegoat = false;
  // Gleichstand: der Sündenbock muss sterben
  const goat = aliveHolders(s, "suendenbock")[0];
  if (!target && tally.size > 0 && goat) { target = goat; scapegoat = true; }
  resolveVote(s, ctx, target, Object.fromEntries(tally), scapegoat);
}

function electCaptain(s: WerwolfState, ctx: GameContext, id: string | null) {
  const pick = id ?? aliveIds(s)[randomInt(aliveIds(s).length)];
  s.captain = pick;
  s.captainElected = true;
  s.votes = {};
  s.log.push(`${nameOf(ctx, pick)} ist Hauptmann`);
  s.phase = "day";
}

/** Nacht sofort auflösen: offene Wolfsstimmen zählen, alle anderen offenen Aktionen verfallen. */
function forceNight(s: WerwolfState, ctx: GameContext) {
  if (!s.victim && open(s, "werwolf")) s.victim = majority(count(Object.values(s.wolfVotes)), true);
  s.log.push(`Nacht ${s.night} vom Host beendet`);
  s.pending = [];
  dawn(s, ctx);
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
      if (!["sleep", "lovers", "schwestern", "verzaubert"].includes(step) && !s.acted.includes(step)) throw new GameError("Erst eine Auswahl treffen.");
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
    case "model": {
      assertStep(s, "wildeskind", actor);
      assertAlive(s, a.target);
      if (s.roles[a.target] === "wildeskind") throw new GameError("Wähle jemand anderen als Vorbild.");
      s.model = a.target;
      done(s, "wildeskind", ctx);
      return s;
    }
    case "dog": {
      assertStep(s, "wolfshund", actor);
      const dog = aliveHolders(s, "wolfshund")[0];
      if (a.wolf && dog) s.roles[dog] = "werwolf";
      done(s, "wolfshund", ctx);
      return s;
    }
    case "visit": {
      assertStep(s, "schlampe", actor);
      assertAlive(s, a.target);
      if (s.roles[a.target] === "schlampe") throw new GameError("Such dir jemand anderen aus.");
      s.visit = a.target;
      done(s, "schlampe", ctx);
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
      if (isWolf(s.roles[a.target])) throw new GameError("Werwölfe fressen keine Werwölfe.");
      if (s.stepwise || actor === null) {
        s.victim = a.target;
        done(s, "werwolf", ctx);
        return s;
      }
      s.wolfVotes[actor] = a.target;
      const wolves = aliveWolves(s);
      if (wolves.every((w) => s.wolfVotes[w])) {
        s.victim = majority(count(wolves.map((w) => s.wolfVotes[w])), true);
        done(s, "werwolf", ctx);
      }
      return s;
    }
    case "infect": {
      assertStep(s, "urwolf", actor);
      if (a.yes) {
        if (!s.victim) throw new GameError("Heute Nacht gibt es kein Opfer zum Verwandeln.");
        s.infected = s.victim;
        s.victim = null;
        s.infectUsed = true;
      }
      done(s, "urwolf", ctx);
      return s;
    }
    case "wolf2": {
      assertStep(s, "grosserwolf", actor);
      assertAlive(s, a.target);
      if (isWolf(s.roles[a.target])) throw new GameError("Werwölfe fressen keine Werwölfe.");
      if (a.target === s.victim || a.target === s.infected) throw new GameError("Wähle ein anderes Opfer als das Rudel.");
      s.victim2 = a.target;
      done(s, "grosserwolf", ctx);
      return s;
    }
    case "see": {
      assertStep(s, "seherin", actor);
      assertAlive(s, a.target);
      if (s.roles[a.target] === "seherin") throw new GameError("Wähle jemand anderen.");
      if (s.seer.some((x) => x.night === s.night)) throw new GameError("Heute Nacht hast du schon geschaut.");
      // Hausregel „Aura“: nur gut (Dorf) oder böse (Werwolf)
      const seen = s.roles[a.target];
      s.seer.push({ night: s.night, target: a.target, role: s.rules.aura ? (isWolf(seen) ? "werwolf" : "dorf") : seen });
      done(s, "seherin", ctx);
      return s;
    }
    case "fox": {
      assertStep(s, "fuchs", actor);
      assertAlive(s, a.target);
      if (s.fox.some((x) => x.night === s.night)) throw new GameError("Heute Nacht hast du schon geschnüffelt.");
      const wolf = [a.target, ...neighbors(s, a.target)].some((id) => isWolf(s.roles[id]));
      s.fox.push({ night: s.night, target: a.target, wolf });
      if (!wolf) s.foxPower = false;
      done(s, "fuchs", ctx);
      return s;
    }
    case "raven": {
      assertStep(s, "rabe", actor);
      if (a.target) assertAlive(s, a.target);
      s.raven = a.target || null;
      done(s, "rabe", ctx);
      return s;
    }
    case "witch": {
      assertStep(s, "hexe", actor);
      if (a.heal && (!s.potions.heal || !s.victim)) throw new GameError("Der Heiltrank geht gerade nicht.");
      if (a.heal && !s.rules.selfHeal && s.roles[s.victim!] === "hexe") throw new GameError("Nach euren Hausregeln darf sich die Hexe nicht selbst heilen.");
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
      if (s.phase !== "day" && s.phase !== "election") throw new GameError("Abgestimmt wird tagsüber.");
      if (s.stepwise) throw new GameError("Die Abstimmung trägt der Spielleiter ein.");
      if (!isPlayer || !s.alive[actor!]) throw new GameError("Tote stimmen nicht ab.");
      if (s.idiots.includes(actor!)) throw new GameError("Als aufgedeckter Dorfdepp darfst du nicht mehr abstimmen.");
      if (a.target) assertAlive(s, a.target);
      if (a.target && s.runoff && !s.runoff.includes(a.target)) throw new GameError("In der Stichwahl stehen nur die Gleichstehenden zur Wahl.");
      s.votes[actor!] = a.target || "";
      if (voters(s).every((id) => id in s.votes)) closeVote(s, ctx);
      return s;
    }
    case "closeVote": {
      if ((s.phase !== "day" && s.phase !== "election") || s.stepwise) throw new GameError("Gerade gibt es keine Abstimmung.");
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
      s.news = { ...(s.news ?? { kind: "day" }), deaths: [...(s.news?.deaths ?? []), ...deaths] };
      s.log.push(`${nameOf(ctx, hunter)} erschießt ${nameOf(ctx, a.target)}`);
      afterDeaths(s, s.afterHunter);
      return s;
    }
    case "assign": {
      if (s.phase !== "assign") throw new GameError("Die Karten sind schon zugeordnet.");
      if (!leader) throw new GameError("Das tippt der Spielleiter ein.");
      if (!(a.id in s.roles) || !ALL_ROLES.includes(a.role)) throw new GameError("Ungültige Zuordnung.");
      s.roles[a.id] = a.role;
      if (!s.ready.includes(a.id)) s.ready.push(a.id);
      return s;
    }
    case "claim": {
      if (s.phase !== "assign") throw new GameError("Die Karten sind schon zugeordnet.");
      if (!isPlayer) throw new GameError("Du spielst nicht mit.");
      if (!ALL_ROLES.includes(a.role)) throw new GameError("Diese Rolle gibt es nicht.");
      s.roles[actor!] = a.role;
      if (!s.ready.includes(actor!)) s.ready.push(actor!);
      if (!s.stepwise && s.ready.length === participants(s).length) finishAssign(s);
      return s;
    }
    case "assignDone": {
      if (s.phase !== "assign") throw new GameError("Die Karten sind schon zugeordnet.");
      if (!leader) throw new GameError("Das darf nur der Spielleiter bzw. Host.");
      finishAssign(s);
      return s;
    }
    case "steal": {
      assertStep(s, "dieb", actor);
      const thief = aliveHolders(s, "dieb")[0];
      if (!thief) { done(s, "dieb", ctx); return s; }
      if (s.rules.ownCards) {
        if (a.role && ALL_ROLES.includes(a.role)) s.roles[thief] = a.role;
      } else {
        const wolvesOnly = s.extra.length === 2 && s.extra.every((r) => isWolf(r));
        if (a.pick === null && wolvesOnly) throw new GameError("Beide Karten sind Werwölfe – du musst tauschen.");
        if (a.pick !== null) {
          if (a.pick !== 0 && a.pick !== 1) throw new GameError("Diese Karte gibt es nicht.");
          const taken = s.extra[a.pick];
          s.extra[a.pick] = "dieb";
          s.roles[thief] = taken;
        }
      }
      done(s, "dieb", ctx);
      return s;
    }
    case "white": {
      assertStep(s, "weisserwolf", actor);
      if (a.target) {
        assertAlive(s, a.target);
        if (!isWolf(s.roles[a.target]) || s.roles[a.target] === "weisserwolf") throw new GameError("Der weiße Werwolf frisst nur andere Werwölfe.");
      }
      s.whiteKill = a.target || null;
      done(s, "weisserwolf", ctx);
      return s;
    }
    case "enchant": {
      assertStep(s, "floetenspieler", actor);
      const flute = aliveHolders(s, "floetenspieler")[0];
      const targets = [a.a, a.b].filter((x): x is string => !!x);
      const open2 = aliveIds(s).filter((id) => id !== flute && !s.enchanted.includes(id));
      if (!targets.length || new Set(targets).size !== targets.length) throw new GameError("Wähle zwei verschiedene Personen.");
      if (targets.length < Math.min(2, open2.length)) throw new GameError("Wähle zwei Personen.");
      for (const t of targets) {
        assertAlive(s, t);
        if (!open2.includes(t)) throw new GameError("Diese Person ist schon verzaubert oder der Flötenspieler selbst.");
      }
      s.enchanted.push(...targets);
      s.enchantedTonight = targets;
      done(s, "floetenspieler", ctx);
      return s;
    }
    case "elect": {
      if (s.phase !== "election") throw new GameError("Gerade wird kein Hauptmann gewählt.");
      if (!s.stepwise) throw new GameError("Im App-Modus wählt jeder am Handy.");
      if (actor !== null && actor !== s.narratorId) throw new GameError("Das tippt der Spielleiter ein.");
      assertAlive(s, a.target);
      electCaptain(s, ctx, a.target);
      return s;
    }
    case "successor": {
      if (s.phase !== "successor") throw new GameError("Gerade wird kein Nachfolger bestimmt.");
      const old = s.captain;
      const allowed = s.stepwise ? actor === null || actor === s.narratorId : actor === null || actor === old || leader;
      if (!allowed) throw new GameError("Das bestimmt der alte Hauptmann.");
      assertAlive(s, a.target);
      s.captain = a.target;
      s.log.push(`${nameOf(ctx, a.target)} ist neuer Hauptmann`);
      continueTo(s, s.afterHunter);
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/** Eigene Karten fertig zugeordnet: es braucht mindestens einen Werwolf */
function finishAssign(s: WerwolfState) {
  if (!participants(s).some((id) => isWolf(s.roles[id]))) throw new GameError("Mindestens eine Person muss ein Werwolf sein.");
  s.phase = "reveal";
  s.ready = [];
  startNight(s);
}

/** Was eine Person sehen darf. Spielleiter, lokales Gerät und das Spielende sehen alles. */
function view(s: WerwolfState, viewer: string | null): WerwolfState {
  if (viewer === null || viewer === s.narratorId || s.phase === "over") return s;
  const own = s.roles[viewer];
  const wolf = isWolf(own);
  const roles: Record<string, Role> = {};
  for (const id of participants(s)) {
    const sister = own === "schwester" && s.roles[id] === "schwester";
    // eigene Karten: Rollen der anderen bleiben geheim, bis zugeordnet wurde
    if (id === viewer || (wolf && isWolf(s.roles[id])) || sister || s.idiots.includes(id) || (s.revealDead && !s.alive[id])) roles[id] = s.roles[id];
  }
  // Unbekannte Rollen als "dorf" tarnen, damit die Struktur gleich bleibt – die Oberfläche zeigt nur `known`
  const masked = Object.fromEntries(participants(s).map((id) => [id, roles[id] ?? "dorf"])) as Record<string, Role>;
  const inLove = !!s.lovers && (s.lovers.includes(viewer) || own === "amor");
  const myStep = (p: Step) => (p === "werwolf" ? wolf || own === "hexe" : STEP_ROLE[p] === own || (own === "hexe" && p === "urwolf"));
  const seesVictim = wolf || (own === "hexe" && s.alive[viewer]);
  return {
    ...s,
    roles: masked,
    known: Object.keys(roles),
    lovers: inLove ? s.lovers : null,
    pending: s.pending.filter(myStep),
    acted: s.acted.filter(myStep),
    wolfVotes: wolf ? s.wolfVotes : {},
    victim: seesVictim ? s.victim : null,
    victim2: wolf ? s.victim2 : null,
    infected: wolf ? s.infected : null,
    protectedId: own === "beschuetzer" ? s.protectedId : null,
    lastProtected: own === "beschuetzer" ? s.lastProtected : null,
    seer: own === "seherin" ? s.seer : [],
    fox: own === "fuchs" ? s.fox : [],
    model: own === "wildeskind" ? s.model : null,
    potions: own === "hexe" ? s.potions : { heal: false, poison: false },
    raven: own === "rabe" ? s.raven : null,
    visit: own === "schlampe" ? s.visit ?? null : null,
    rusty: null,
    extra: own === "dieb" ? s.extra : [],
    whiteKill: own === "weisserwolf" ? s.whiteKill : null,
    enchanted: own === "floetenspieler" ? s.enchanted : s.enchanted.includes(viewer) ? s.enchanted : [],
    enchantedTonight: own === "floetenspieler" ? s.enchantedTonight : [],
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

const roleToggle = (r: Role, def: boolean, group: string, hint: string): SettingDef =>
  ({ key: r, label: `${ROLES[r].emoji} ${ROLES[r].name}`, type: "toggle", default: def, hint, group });

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
  version: 3,
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
    {
      key: "cards", label: "Rollen", type: "choice", default: "app",
      choices: [
        { value: "app", label: "App verteilt", hint: "zufällig, geheim" },
        { value: "own", label: "Eigene Karten", hint: "ihr zieht echte Karten" },
      ],
    },
    { key: "revealDead", label: "Rollen der Toten aufdecken", type: "toggle", default: true, hint: "sonst erst am Spielende", group: "Hausregeln" },
    { key: "captain", label: "👑 Hauptmann", type: "toggle", default: false, hint: "am ersten Tag gewählt, doppelte Stimme, entscheidet Gleichstand", group: "Hausregeln" },
    {
      key: "tie", label: "Bei Gleichstand", type: "choice", default: "none", group: "Hausregeln",
      choices: [{ value: "none", label: "Niemand stirbt" }, { value: "runoff", label: "Stichwahl" }],
    },
    { key: "aura", label: "Seherin sieht nur gut/böse", type: "toggle", default: false, hint: "statt der genauen Rolle", group: "Hausregeln" },
    { key: "selfHeal", label: "Hexe darf sich selbst heilen", type: "toggle", default: true, group: "Hausregeln" },
    { key: "peaceful", label: "Erste Nacht ohne Opfer", type: "toggle", default: false, hint: "die Wölfe lernen sich nur kennen", group: "Hausregeln" },
    { key: "deadTalk", label: "Tote dürfen mitreden", type: "toggle", default: false, group: "Hausregeln" },
    roleToggle("seherin", true, "Grundspiel", "sieht jede Nacht eine Rolle"),
    roleToggle("hexe", true, "Grundspiel", "ein Heil-, ein Gifttrank"),
    roleToggle("jaeger", false, "Grundspiel", "nimmt jemanden mit in den Tod"),
    roleToggle("amor", false, "Grundspiel", "verliebt zwei Menschen"),
    roleToggle("beschuetzer", false, "Neumond", "schützt jede Nacht eine Person"),
    roleToggle("alter", false, "Neumond", "überlebt den ersten Wolfsangriff"),
    roleToggle("dorfdepp", false, "Neumond", "überlebt die Verurteilung, verliert die Stimme"),
    roleToggle("suendenbock", false, "Neumond", "stirbt bei Gleichstand"),
    roleToggle("wildeskind", false, "Charaktere", "wird zum Wolf, wenn sein Vorbild stirbt"),
    roleToggle("wolfshund", false, "Charaktere", "wählt: Dorf oder Wolf"),
    roleToggle("fuchs", false, "Charaktere", "wittert Wölfe in einer Dreiergruppe"),
    roleToggle("baerenfuehrer", false, "Charaktere", "sein Bär brummt neben Wölfen"),
    roleToggle("ritter", false, "Charaktere", "sein rostiges Schwert tötet einen Wolf"),
    roleToggle("schwester", false, "Charaktere", "zwei Karten – kennen sich"),
    roleToggle("urwolf", false, "Charaktere", "Werwolf: verwandelt einmal sein Opfer"),
    roleToggle("grosserwolf", false, "Charaktere", "Werwolf: frisst ein zweites Opfer"),
    roleToggle("dieb", false, "Grundspiel", "tauscht mit einer von zwei übrigen Karten"),
    roleToggle("rabe", false, "Die Gemeinde", "+2 Stimmen gegen einen Verdächtigen"),
    roleToggle("schlampe", false, "Hausregel", "übernachtet jede Nacht bei jemand anderem"),
    roleToggle("weisserwolf", false, "Solo-Rollen", "frisst Wölfe, gewinnt allein"),
    roleToggle("floetenspieler", false, "Solo-Rollen", "verzaubert alle, gewinnt allein"),
    roleToggle("engel", false, "Solo-Rollen", "will in der ersten Runde sterben"),
  ],
  playerLimits: (o) => (modeOf(o) === "human" ? { min: 5, max: 20, note: "online zählt der Spielleiter zusätzlich" } : { min: 5, max: 20 }),
  setup,
  apply,
  actionKind: (a) => (a.type in ACTIONS ? "player" : null),
  currentPlayerId: () => null,
  isOver: (s) => s.phase === "over",
  skipLabel: (s) => {
    if (s.phase === "assign") return "Zuordnung abschließen (Rest: Dorfbewohner)";
    if (s.phase === "election") return s.stepwise ? null : "Hauptmannwahl beenden";
    if (s.phase === "successor") return "Nachfolger zufällig bestimmen";
    if (s.phase === "reveal") return "Nicht alle bereit – Nacht beginnen";
    if (s.phase === "night") return "Nacht beenden (wer nicht reagiert hat, verpasst seine Aktion)";
    if (s.phase === "day" && !s.stepwise) return "Abstimmung beenden";
    if (s.phase === "hunter") return "Jäger überspringen";
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "assign") finishAssign(s);
    else if (s.phase === "election") closeVote(s, ctx);
    else if (s.phase === "successor") {
      const alive = aliveIds(s);
      s.captain = alive[randomInt(alive.length)];
      continueTo(s, s.afterHunter);
    } else if (s.phase === "reveal") startNight(s);
    else if (s.phase === "night") forceNight(s, ctx);
    else if (s.phase === "day" && !s.stepwise) closeVote(s, ctx);
    else if (s.phase === "hunter") {
      s.hunters.shift();
      afterDeaths(s, s.afterHunter);
    }
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (id === s.narratorId) { s.phase = "over"; s.winner = null; s.log.push("Der Spielleiter hat den Raum verlassen."); return s; }
    if (!(id in s.roles) || !s.alive[id]) return s;
    if (s.phase === "assign") {
      delete s.roles[id]; delete s.alive[id];
      s.ready = s.ready.filter((x) => x !== id);
      return s;
    }
    if (s.captain === id) s.captain = null;
    const deaths: Death[] = [];
    kill(s, deaths, id, "weg");
    s.hunters = s.hunters.filter((h) => h !== id);
    s.log.push(`${nameOf(ctx, id)} hat das Spiel verlassen`);
    s.winner = checkWinner(s);
    if (s.winner) { s.phase = "over"; return s; }
    if (s.phase === "night") {
      // Schritte ohne lebende Rolle entfallen, offene Wolfsabstimmung neu prüfen
      const actorAlive = (p: Step) => p === "werwolf" ? aliveWolves(s).length > 0 : !STEP_ROLE[p] || aliveHolders(s, STEP_ROLE[p]!).length > 0;
      s.pending = s.pending.filter((p) => actorAlive(p) || s.acted.includes(p));
      delete s.wolfVotes[id];
      const wolves = aliveWolves(s);
      if (!s.stepwise && open(s, "werwolf") && wolves.every((w) => s.wolfVotes[w])) {
        s.victim = majority(count(wolves.map((w) => s.wolfVotes[w])), true);
        done(s, "werwolf", ctx);
      } else if (!s.pending.length) dawn(s, ctx);
    }
    if (s.phase === "day" && !s.stepwise) {
      delete s.votes[id];
      if (voters(s).every((x) => x in s.votes)) closeVote(s, ctx);
    }
    return s;
  },
  view,
};

const ACTIONS: Record<WerwolfAction["type"], true> = {
  ready: true, startNight: true, amor: true, model: true, dog: true, protect: true, wolf: true, infect: true, wolf2: true,
  see: true, fox: true, raven: true, visit: true, witch: true, suspect: true, next: true, vote: true, closeVote: true, lynch: true, shoot: true,
  assign: true, claim: true, assignDone: true, steal: true, white: true, enchant: true, elect: true, successor: true,
};
