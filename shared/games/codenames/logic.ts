/**
 * Codenamen – zwei Teams, je ein Geheimdienstchef, der mit einem Wort und einer Zahl Hinweise gibt.
 * Zwei Varianten:
 *  - „app“: Die 25 Wörter liegen in der App. Chefs sehen die Farben, Agenten tippen Wörter an.
 *  - „key“: Hilfe zum Brettspiel – ihr legt eure eigenen Wortkarten aus, die App erzeugt nur die
 *    geheime Schlüsselkarte für die Chefs und zählt mit, was noch fehlt.
 */
import { randomInt, shuffle } from "../../platform/random";
import { GameError, type GameContext, type GameLogic, type Options } from "../../platform/types";
import { WORDS } from "./words";

export type Team = "rot" | "blau";
/** Farbe einer Karte: Team, Passant (neutral) oder Attentäter */
export type Color = Team | "neutral" | "attentaeter";
export type Mode = "app" | "key";

export const TEAM_NAME: Record<Team, string> = { rot: "Rot", blau: "Blau" };
export const other = (t: Team): Team => (t === "rot" ? "blau" : "rot");

export interface Member { team: Team | null; chief: boolean }

export interface CNState {
  v: 1;
  mode: Mode;
  phase: "teams" | "play" | "over";
  members: Record<string, Member>;
  /** 25 Wörter (bei „key“ leer – die liegen auf eurem Tisch) */
  words: string[];
  /** 25 Farben – die Schlüsselkarte */
  key: Color[];
  revealed: boolean[];
  start: Team;
  turn: Team;
  clue: { word: string; count: number } | null;
  /** Versuche in diesem Zug (Hinweiszahl + 1) */
  guessesLeft: number;
  guessed: number;
  winner: Team | null;
  /** durch den Attentäter entschieden */
  assassin: boolean;
  log: string[];
  /** nur im Client gesetzt: darf dieser Betrachter die Schlüsselkarte sehen? */
  seesKey?: boolean;
}

export type CNAction =
  | { type: "join"; player?: string; team: Team | null; chief?: boolean }
  | { type: "shuffleTeams" }
  | { type: "begin" }
  | { type: "clue"; word: string; count: number }
  | { type: "guess"; i: number }
  | { type: "pass" }
  | { type: "mark"; i: number };

const SIZE = 25;
const MAX_LOG = 40;
export const modeOf = (o: Options): Mode => (o.mode === "key" ? "key" : "app");

export const remaining = (s: CNState, t: Team) => s.key.filter((c, i) => c === t && !s.revealed[i]).length;
const teamOf = (s: CNState, id: string | null) => (id ? s.members[id]?.team ?? null : null);

function newBoard(s: CNState) {
  s.start = randomInt(2) === 0 ? "rot" : "blau";
  s.turn = s.start;
  s.key = shuffle<Color>([
    ...Array<Color>(9).fill(s.start), ...Array<Color>(8).fill(other(s.start)), ...Array<Color>(7).fill("neutral"), "attentaeter",
  ]);
  s.words = s.mode === "app" ? shuffle(WORDS).slice(0, SIZE) : [];
  s.revealed = Array(SIZE).fill(false);
  s.clue = null;
  s.guessesLeft = 0;
  s.guessed = 0;
  s.winner = null;
  s.assassin = false;
}

function setup(ctx: GameContext): CNState {
  const s: CNState = {
    v: 1, mode: modeOf(ctx.options), phase: "teams", members: {}, words: [], key: [], revealed: [], start: "rot", turn: "rot",
    clue: null, guessesLeft: 0, guessed: 0, winner: null, assassin: false, log: [],
  };
  for (const p of ctx.players) s.members[p.id] = { team: null, chief: false };
  newBoard(s);
  return s;
}

const log = (s: CNState, line: string) => { s.log.push(line); if (s.log.length > MAX_LOG) s.log.shift(); };
const nameOf = (ctx: GameContext, id: string) => ctx.players.find((p) => p.id === id)?.name ?? "?";

/** Fehlt noch etwas, damit es losgehen kann? (null = alles bereit) */
export function notReady(s: CNState): string | null {
  for (const t of ["rot", "blau"] as Team[]) {
    const team = Object.values(s.members).filter((m) => m.team === t);
    if (!team.some((m) => m.chief)) return `Team ${TEAM_NAME[t]} braucht einen Chef.`;
    if (s.mode === "app" && !team.some((m) => !m.chief)) return `Team ${TEAM_NAME[t]} braucht mindestens einen Agenten.`;
  }
  return null;
}

function endTurn(s: CNState) {
  s.turn = other(s.turn);
  s.clue = null;
  s.guessesLeft = 0;
  s.guessed = 0;
}

/** Karte aufdecken – gemeinsam für App-Tipp und das Markieren bei der Brettspiel-Hilfe */
function reveal(s: CNState, i: number, byTeam: Team | null, who: string) {
  if (!Number.isInteger(i) || i < 0 || i >= SIZE) throw new GameError("Diese Karte gibt es nicht.");
  if (s.revealed[i]) throw new GameError("Die Karte liegt schon offen.");
  s.revealed[i] = true;
  const c = s.key[i];
  const word = s.words[i] ?? `Feld ${i + 1}`;
  log(s, `${who}: ${word} – ${c === "neutral" ? "Passant" : c === "attentaeter" ? "Attentäter!" : TEAM_NAME[c]}`);
  if (c === "attentaeter") {
    s.winner = byTeam ? other(byTeam) : null;
    s.assassin = true;
    s.phase = "over";
    return;
  }
  for (const t of ["rot", "blau"] as Team[]) {
    if (remaining(s, t) === 0) { s.winner = t; s.phase = "over"; return; }
  }
  if (!byTeam) return;
  // Richtige Farbe: weiter raten (solange Versuche übrig) – sonst ist der Zug vorbei
  if (c === byTeam) {
    s.guessed++;
    s.guessesLeft--;
    if (s.guessesLeft <= 0) endTurn(s);
  } else endTurn(s);
}

function apply(prev: CNState, a: CNAction, ctx: GameContext): CNState {
  const s = structuredClone(prev);
  const actor = ctx.actorId;
  const local = actor === null;
  const isHost = local || actor === ctx.hostId;
  const me = teamOf(s, actor);

  switch (a.type) {
    case "join": {
      // Online wählt jeder für sich; lokal (und der Host) darf alle einteilen
      const target = a.player ?? actor;
      if (!target || !ctx.players.some((p) => p.id === target)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (!local && target !== actor && !isHost) throw new GameError("Du kannst nur dich selbst einteilen.");
      if (s.phase === "over") throw new GameError("Die Runde ist vorbei.");
      const team = a.team === "rot" || a.team === "blau" ? a.team : null;
      const chief = !!team && !!a.chief;
      // Während des Spiels: Chefs bleiben Chefs (sie kennen die Karte), Wechsel nur als Agent
      if (s.phase === "play" && s.members[target]?.chief && !chief) throw new GameError("Chefs kennen die Schlüsselkarte und bleiben Chef.");
      if (s.phase === "play" && chief && !s.members[target]?.chief && s.mode === "app") throw new GameError("Neue Chefs nur vor dem Start.");
      s.members[target] = { team, chief };
      return s;
    }
    case "shuffleTeams": {
      if (!isHost) throw new GameError("Das darf nur der Host.");
      if (s.phase !== "teams") throw new GameError("Das geht nur vor dem Start.");
      const ids = shuffle(ctx.players.map((p) => p.id));
      ids.forEach((id, k) => { s.members[id] = { team: k % 2 === 0 ? "rot" : "blau", chief: k < 2 }; });
      return s;
    }
    case "begin": {
      if (!isHost) throw new GameError("Das darf nur der Host.");
      if (s.phase !== "teams") throw new GameError("Die Runde läuft schon.");
      const missing = notReady(s);
      if (missing) throw new GameError(missing);
      s.phase = "play";
      log(s, `Team ${TEAM_NAME[s.start]} beginnt.`);
      return s;
    }
    case "clue": {
      if (s.mode !== "app" || s.phase !== "play") throw new GameError("Gerade gibt es keinen Hinweis.");
      if (!local && !(me === s.turn && s.members[actor!]?.chief)) throw new GameError(`Den Hinweis gibt der Chef von Team ${TEAM_NAME[s.turn]}.`);
      if (s.clue) throw new GameError("Der Hinweis steht schon.");
      const word = String(a.word ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
      const count = Number(a.count);
      if (!word) throw new GameError("Erst ein Hinweiswort eingeben.");
      if (/\s/.test(word)) throw new GameError("Der Hinweis ist genau ein Wort.");
      if (!Number.isInteger(count) || count < 0 || count > 9) throw new GameError("Die Zahl muss zwischen 0 und 9 liegen.");
      if (s.words.some((w, i) => !s.revealed[i] && w.toLowerCase() === word.toLowerCase())) throw new GameError("Das Wort liegt auf dem Tisch – nimm ein anderes.");
      s.clue = { word, count };
      // 0 (oder „unbegrenzt“) heißt: so viele Versuche, wie noch Karten des Teams liegen
      s.guessesLeft = count === 0 ? remaining(s, s.turn) + 1 : count + 1;
      s.guessed = 0;
      log(s, `Chef ${TEAM_NAME[s.turn]}: „${word}“ ${count}`);
      return s;
    }
    case "guess": {
      if (s.mode !== "app" || s.phase !== "play") throw new GameError("Gerade wird nicht geraten.");
      if (!s.clue) throw new GameError("Erst gibt der Chef einen Hinweis.");
      if (!local && (me !== s.turn || s.members[actor!]?.chief)) throw new GameError(`Es raten die Agenten von Team ${TEAM_NAME[s.turn]}.`);
      reveal(s, a.i, s.turn, local ? TEAM_NAME[s.turn] : nameOf(ctx, actor!));
      return s;
    }
    case "pass": {
      if (s.mode !== "app" || s.phase !== "play" || !s.clue) throw new GameError("Gerade gibt es nichts zu beenden.");
      if (!local && (me !== s.turn || s.members[actor!]?.chief)) throw new GameError(`Den Zug beenden die Agenten von Team ${TEAM_NAME[s.turn]}.`);
      if (s.guessed < 1) throw new GameError("Mindestens ein Wort muss geraten werden.");
      log(s, `Team ${TEAM_NAME[s.turn]} beendet den Zug.`);
      endTurn(s);
      return s;
    }
    case "mark": {
      // Brettspiel-Hilfe: ein Chef (oder lokal das Gerät) markiert, welche Karte am Tisch aufgedeckt wurde
      if (s.mode !== "key" || s.phase !== "play") throw new GameError("Markieren gibt es nur bei der Brettspiel-Hilfe.");
      if (!local && !s.members[actor!]?.chief) throw new GameError("Nur Chefs sehen die Schlüsselkarte.");
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= SIZE) throw new GameError("Dieses Feld gibt es nicht.");
      if (s.revealed[a.i]) { s.revealed[a.i] = false; return s; } // versehentlich angetippt: zurücknehmen
      reveal(s, a.i, null, local ? "Tisch" : nameOf(ctx, actor!));
      return s;
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

export const codenames: GameLogic<CNState, CNAction> = {
  info: {
    id: "codenames",
    name: "Codenamen",
    tagline: "Zwei Teams, ein Wort, eine Zahl – findet eure Agenten, meidet den Attentäter.",
    category: "Party",
    minPlayers: 2,
    maxPlayers: 20,
    duration: "15 Min.",
  },
  version: 1,
  turnBased: false,
  joinMidGame: true,
  settings: [
    {
      key: "mode", label: "Variante", type: "choice", default: "app",
      choices: [
        { value: "app", label: "📱 In der App", hint: "Wörter auf dem Handy" },
        { value: "key", label: "🎲 Brettspiel-Hilfe", hint: "nur die Schlüsselkarte" },
      ],
    },
  ],
  /** In der App braucht jedes Team Chef + Agent, als Brettspiel-Hilfe reichen die zwei Chefs */
  playerLimits: (o) => (modeOf(o) === "app" ? { min: 4, max: 20 } : { min: 2, max: 20 }),
  setup,
  apply,
  actionKind: (a) => (["join", "shuffleTeams", "begin", "clue", "guess", "pass", "mark"].includes(a.type) ? "player" : null),
  currentPlayerId: () => null,
  isOver: (s) => s.phase === "over",
  results: (s) => Object.entries(s.members).filter(([, m]) => m.team).map(([id, m]) => ({ id, won: m.team === s.winner })),
  skipLabel: (s) => (s.phase === "play" && s.mode === "app" ? `Zug von Team ${TEAM_NAME[s.turn]} beenden` : null),
  skipTurn(prev) {
    const s = structuredClone(prev);
    if (s.phase === "play") { log(s, `Zug von Team ${TEAM_NAME[s.turn]} übersprungen.`); endTurn(s); }
    return s;
  },
  onPlayerRemoved(prev, id) {
    const s = structuredClone(prev);
    delete s.members[id];
    return s;
  },
  // Die Schlüsselkarte sehen nur Chefs (und lokal das Gerät, das sie gezielt aufdeckt)
  view(s, viewer) {
    if (viewer === null) return { ...s, seesKey: true };
    const chief = !!s.members[viewer]?.chief;
    if (chief || s.phase === "over") return { ...s, seesKey: true };
    return { ...s, seesKey: false, key: s.key.map((c, i) => (s.revealed[i] ? c : "neutral")) };
  },
};

/** Nur für Tests: Karte gezielt festlegen */
export function withKey(s: CNState, key: Color[], start: Team = "rot"): CNState {
  return { ...s, key, start, turn: start, revealed: Array(SIZE).fill(false) };
}
