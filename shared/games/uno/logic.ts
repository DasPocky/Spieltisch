/**
 * Uno – Farbe oder Zahl/Symbol bedienen, Aussetzen, Richtungswechsel, +2, Farbwahl und +4.
 * Zwei Varianten:
 *  - „app“: Karten in der App (online jeder am eigenen Handy, lokal mit Sichtschutz beim Weitergeben).
 *  - „table“: Ihr spielt mit echten Karten, die App ist der Punkteblock (Sieger bekommt die Kartenpunkte der anderen).
 * Die Hände der anderen und der Stapel bleiben geheim (view).
 */
import { shuffle } from "../../platform/random";
import { nextPlayerId } from "../../platform/turns";
import { GameError, type GameContext, type GameLogic, type Options, type Player } from "../../platform/types";

export type UnoColor = "r" | "g" | "b" | "y";
export type UnoValue = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "rev" | "plus2";
/** Karte als Text: "r-7", "b-skip", "w-wild", "w-plus4" */
export type UnoCard = `${UnoColor}-${UnoValue}` | "w-wild" | "w-plus4";
export type Mode = "app" | "table";

export const COLORS: UnoColor[] = ["r", "g", "b", "y"];
export const COLOR_NAME: Record<UnoColor, string> = { r: "Rot", g: "Grün", b: "Blau", y: "Gelb" };
const VALUES: UnoValue[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "rev", "plus2"];

export interface UnoState {
  v: 1;
  mode: Mode;
  round: number;
  scores: Record<string, number>;
  phase: "play" | "roundEnd" | "over" | "enter";
  hands: Record<string, UnoCard[]>;
  counts: Record<string, number>;
  pile: UnoCard[];
  pileCount: number;
  discard: UnoCard[];
  /** Farbe, die bedient werden muss (nach Farbwahl die gewählte) */
  color: UnoColor;
  curId: string | null;
  dir: 1 | -1;
  /** Karten, die der Nächste ziehen muss (nur bei „Ziehkarten stapeln“ offen) */
  pendingDraw: number;
  /** In diesem Zug gezogene Karte – nur diese darf noch gelegt werden */
  drawn: UnoCard | null;
  /** Startkarte Farbwahl: wer beginnt, bestimmt zuerst die Farbe */
  pickColor?: boolean;
  /** +4 liegt: der Nächste zieht 4 oder zweifelt an (guilty nur auf dem Server sichtbar) */
  challenge?: { by: string; guilty?: boolean } | null;
  roundWinner: string | null;
  lastRound: { winner: string; points: number } | null;
  n: number;
  log: string[];
  // Punkteblock (echte Karten)
  entries: Record<string, number | null>;
  tableWinner: string | null;
}

export type UnoAction =
  | { type: "play"; card: UnoCard; color?: UnoColor; uno?: boolean; target?: string }
  | { type: "draw" }
  | { type: "color"; color: UnoColor }
  | { type: "doubt" }
  | { type: "pass" }
  | { type: "nextRound" }
  | { type: "enter"; player?: string; points: number | null }
  | { type: "setWinner"; player: string | null }
  | { type: "finishRound" };

/** +4: „challenge“ = Original (immer legbar, aber anzweifelbar), „strict“ = nur ohne passende Farbe, „any“ = immer */
export type Plus4Rule = "challenge" | "strict" | "any";
interface Rules { mode: Mode; target: number; stack: boolean; plus4: Plus4Rule; uno: boolean; hand: number; drawUntil: boolean; sevenZero: boolean }
export function rulesOf(o: Options): Rules {
  return {
    mode: o.mode === "table" ? "table" : "app",
    target: o.target === "round" ? 0 : Number(o.target) || 500,
    stack: o.stack === true,
    // alte Räume: plus4Any
    plus4: o.plus4 === "strict" || o.plus4 === "any" || o.plus4 === "challenge" ? o.plus4 : o.plus4Any === true ? "any" : "challenge",
    uno: o.uno !== false,
    hand: 7,
    drawUntil: o.drawUntil === true,
    sevenZero: o.sevenZero === true,
  };
}

const MAX_LOG = 50;
const APP = (o: Options) => o.mode !== "table";
export const colorOf = (c: UnoCard): UnoColor | null => (c.startsWith("w-") ? null : (c[0] as UnoColor));
export const valueOf = (c: UnoCard) => c.slice(2) as UnoValue | "wild" | "plus4";
export const isWild = (c: UnoCard) => c.startsWith("w-");
export const top = (s: UnoState): UnoCard => s.discard[s.discard.length - 1];

/** Punkte einer Karte am Rundenende: Zahl = Wert, Aktion 20, Farbwahl 50 */
export function cardPoints(c: UnoCard): number {
  const v = valueOf(c);
  if (v === "wild" || v === "plus4") return 50;
  if (v === "skip" || v === "rev" || v === "plus2") return 20;
  return Number(v);
}

/** 108 Karten: je Farbe eine 0, zweimal 1–9, Aussetzen, Richtungswechsel, +2; dazu je 4 Farbwahl und +4 */
export function buildDeck(): UnoCard[] {
  const d: UnoCard[] = [];
  for (const c of COLORS) for (const v of VALUES) {
    d.push(`${c}-${v}`);
    if (v !== "0") d.push(`${c}-${v}`);
  }
  for (let i = 0; i < 4; i++) d.push("w-wild", "w-plus4");
  return d;
}

const ORDER = (c: UnoCard) => (isWild(c) ? 100 + (c === "w-plus4" ? 1 : 0) : COLORS.indexOf(colorOf(c)!) * 20 + VALUES.indexOf(valueOf(c) as UnoValue));
const sortHand = (h: UnoCard[]) => h.slice().sort((a, b) => ORDER(a) - ORDER(b));

/** Darf diese Karte gerade gelegt werden? */
export function canPlay(s: UnoState, card: UnoCard, o: Options, hand?: UnoCard[]): boolean {
  const r = rulesOf(o);
  const t = top(s);
  if (s.pickColor || s.challenge) return false;
  if (s.pendingDraw > 0) {
    // Stapeln: +2 auf +2, +4 auf alles Ziehen
    return card === "w-plus4" || (valueOf(card) === "plus2" && valueOf(t) === "plus2");
  }
  // Mit „Stapeln“ gibt es kein Anzweifeln – dann gilt die Farbregel fest
  const strict = r.plus4 === "strict" || (r.plus4 === "challenge" && r.stack);
  if (card === "w-plus4") return !strict || !(hand ?? []).some((c) => colorOf(c) === s.color);
  if (isWild(card)) return true;
  return colorOf(card) === s.color || valueOf(card) === valueOf(t);
}

function refill(s: UnoState) {
  if (s.discard.length <= 1) return;
  const rest = s.discard.splice(0, s.discard.length - 1);
  s.pile = shuffle(rest);
  s.log.push("Ablage wird neu gemischt");
}

function give(s: UnoState, id: string, n: number): UnoCard[] {
  const got: UnoCard[] = [];
  for (let i = 0; i < n; i++) {
    if (!s.pile.length) refill(s);
    const c = s.pile.pop();
    if (!c) break;
    got.push(c);
  }
  s.hands[id] = sortHand([...(s.hands[id] ?? []), ...got]);
  return got;
}

function sync(s: UnoState) {
  s.counts = Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length]));
  s.pileCount = s.pile.length;
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

function step(players: Player[], id: string | null, dir: 1 | -1): string | null {
  return nextPlayerId(dir === 1 ? players : players.slice().reverse(), id);
}
const nameOf = (ctx: GameContext, id: string | null) => ctx.players.find((p) => p.id === id)?.name ?? "?";

function deal(s: UnoState, ctx: GameContext, starter: string | null) {
  const r = rulesOf(ctx.options);
  s.pile = shuffle(buildDeck());
  s.hands = {};
  for (const p of ctx.players) s.hands[p.id] = sortHand(s.pile.splice(s.pile.length - r.hand, r.hand));
  // Startkarte: +4 kommt zurück in den Stapel, alle anderen wirken auf den ersten Spieler (Originalregel)
  let first = s.pile.pop()!;
  while (first === "w-plus4") { s.pile.unshift(first); first = s.pile.pop()!; }
  s.discard = [first];
  const start = starter && ctx.players.some((p) => p.id === starter) ? starter : ctx.players[0]?.id ?? null;
  s.curId = start;
  s.dir = 1;
  s.pendingDraw = 0;
  s.drawn = null;
  s.challenge = null;
  s.pickColor = first === "w-wild";
  s.color = colorOf(first) ?? "r";
  s.roundWinner = null;
  s.phase = "play";
  const v = valueOf(first);
  if (v === "skip") { s.log.push(`Startkarte Aussetzen: ${nameOf(ctx, start)} setzt aus`); s.curId = step(ctx.players, start, 1); }
  // Richtungswechsel: der Geber (rechts vom Ersten) beginnt, dann geht es andersherum
  if (v === "rev") { s.dir = -1; s.curId = step(ctx.players, start, -1); s.log.push("Startkarte Richtungswechsel: andersherum"); }
  if (v === "plus2" && start) { give(s, start, 2); s.log.push(`Startkarte +2: ${nameOf(ctx, start)} zieht 2 und setzt aus`); s.curId = step(ctx.players, start, 1); }
}

function setup(ctx: GameContext): UnoState {
  const r = rulesOf(ctx.options);
  const s: UnoState = {
    v: 1, mode: r.mode, round: 1, scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])), phase: "play",
    hands: {}, counts: {}, pile: [], pileCount: 0, discard: [], color: "r", curId: null, dir: 1, pendingDraw: 0, drawn: null, pickColor: false, challenge: null,
    roundWinner: null, lastRound: null, n: 0, log: [], entries: {}, tableWinner: null,
  };
  if (r.mode === "table") { s.phase = "enter"; s.entries = Object.fromEntries(ctx.players.map((p) => [p.id, null])); }
  else deal(s, ctx, null);
  sync(s);
  return s;
}

/** Runde gewonnen: Punkte der anderen Hände gehen an den Sieger */
function winRound(s: UnoState, ctx: GameContext, winner: string, points: number) {
  const r = rulesOf(ctx.options);
  s.scores[winner] = (s.scores[winner] ?? 0) + points;
  s.roundWinner = winner;
  s.lastRound = { winner, points };
  s.log.push(`${nameOf(ctx, winner)} gewinnt Runde ${s.round} (+${points})`);
  s.phase = r.target === 0 || s.scores[winner] >= r.target ? "over" : "roundEnd";
}

function apply(prev: UnoState, a: UnoAction, ctx: GameContext): UnoState {
  const s = structuredClone(prev);
  const r = rulesOf(ctx.options);
  const actor = ctx.actorId;
  const isHost = actor === null || actor === ctx.hostId;

  if (s.mode === "table") return applyTable(s, a, ctx, isHost);

  if (a.type === "nextRound") {
    if (s.phase !== "roundEnd") throw new GameError("Die Runde läuft noch.");
    s.round++;
    deal(s, ctx, s.roundWinner);
    sync(s);
    return s;
  }
  if (s.phase !== "play") throw new GameError("Die Runde ist vorbei.");
  const me = s.curId;
  if (!me || !s.hands[me]) throw new GameError("Es ist niemand am Zug.");
  const hand = s.hands[me];
  const endTurn = (skip = false) => {
    s.drawn = null;
    s.curId = step(ctx.players, s.curId, s.dir);
    if (skip) s.curId = step(ctx.players, s.curId, s.dir);
    s.n++;
  };

  if (s.pickColor && a.type !== "color") throw new GameError("Wähle zuerst die Farbe.");
  if (s.challenge && a.type !== "draw" && a.type !== "doubt") throw new GameError("Zieh 4 Karten oder zweifle das +4 an.");

  switch (a.type) {
    case "color": {
      if (!s.pickColor) throw new GameError("Die Farbe steht schon fest.");
      if (!COLORS.includes(a.color)) throw new GameError("Wähle eine Farbe.");
      s.color = a.color;
      s.pickColor = false;
      s.log.push(`${nameOf(ctx, me)} wählt ${COLOR_NAME[a.color]}`);
      sync(s);
      return s;
    }
    case "doubt": {
      const c = s.challenge;
      if (!c) throw new GameError("Hier gibt es nichts anzuzweifeln.");
      s.challenge = null;
      if (c.guilty && s.hands[c.by]) {
        // Geblufft: wer das +4 gelegt hat, zieht 4 – der Zweifler spielt normal
        give(s, c.by, 4);
        s.log.push(`${nameOf(ctx, me)} zweifelt an – ${nameOf(ctx, c.by)} hatte die Farbe und zieht 4`);
      } else {
        give(s, me, 6);
        s.log.push(`${nameOf(ctx, me)} zweifelt an – zu Unrecht, zieht 6 und setzt aus`);
        endTurn();
      }
      sync(s);
      return s;
    }
    case "play": {
      const i = hand.indexOf(a.card);
      if (i < 0) throw new GameError("Diese Karte hast du nicht.");
      if (s.drawn && a.card !== s.drawn) throw new GameError("Nach dem Ziehen darfst du nur die gezogene Karte legen.");
      if (!canPlay(s, a.card, ctx.options, hand)) {
        throw new GameError(s.pendingDraw ? `Du musst ${s.pendingDraw} Karten ziehen${r.stack ? " oder weiter draufpacken" : ""}.`
          : a.card === "w-plus4" ? "+4 nur, wenn du keine Karte in der Farbe hast." : `Das passt nicht – gefragt ist ${COLOR_NAME[s.color]} oder ${valueLabel(valueOf(top(s)))}.`);
      }
      if (isWild(a.card) && (!a.color || !COLORS.includes(a.color))) throw new GameError("Wähle eine Farbe.");
      const v = valueOf(a.card);
      const others = ctx.players.filter((p) => p.id !== me && s.hands[p.id]);
      // 7-0: mit der 7 tauscht man die Hand mit jemandem
      const swap7 = r.sevenZero && v === "7" && hand.length > 1;
      const swapWith = swap7 ? (a.target ?? (others.length === 1 ? others[0].id : undefined)) : undefined;
      if (swap7 && (!swapWith || !others.some((p) => p.id === swapWith))) throw new GameError("Mit wem tauschst du die Karten?");
      // Bluff-Prüfung für das Anzweifeln: hatte man die gefragte Farbe?
      const guilty = a.card === "w-plus4" && hand.some((c) => colorOf(c) === s.color);
      hand.splice(i, 1);
      s.discard.push(a.card);
      s.color = isWild(a.card) ? a.color! : colorOf(a.card)!;
      s.log.push(`${nameOf(ctx, me)}: ${cardLabel(a.card)}${isWild(a.card) ? ` → ${COLOR_NAME[s.color]}` : ""}`);
      if (hand.length === 0) {
        // Letzte Karte +2/+4: der Nächste zieht trotzdem – die Karten zählen mit
        const owed = v === "plus2" || v === "plus4" ? (v === "plus2" ? 2 : 4) + (r.stack ? s.pendingDraw : 0) : 0;
        if (owed) {
          const victim = step(ctx.players, me, s.dir)!;
          give(s, victim, owed);
          s.log.push(`${nameOf(ctx, victim)} zieht ${owed}`);
          s.pendingDraw = 0;
        }
        const points = ctx.players.reduce((t, p) => t + (p.id === me ? 0 : (s.hands[p.id] ?? []).reduce((u, c) => u + cardPoints(c), 0)), 0);
        s.drawn = null;
        winRound(s, ctx, me, points);
        sync(s);
        return s;
      }
      const swap0 = r.sevenZero && v === "0";
      if (hand.length === 1 && r.uno && !a.uno && !swap7 && !swap0) {
        give(s, me, 2);
        s.log.push(`${nameOf(ctx, me)} hat „Uno“ vergessen und zieht 2 Strafkarten`);
      }
      if (swap7 && swapWith) {
        [s.hands[me], s.hands[swapWith]] = [s.hands[swapWith], s.hands[me]];
        s.log.push(`${nameOf(ctx, me)} tauscht die Karten mit ${nameOf(ctx, swapWith)}`);
      }
      if (swap0) {
        // 0: alle geben ihre Hand in Spielrichtung weiter
        const ids = ctx.players.filter((p) => s.hands[p.id]).map((p) => p.id);
        const old = Object.fromEntries(ids.map((id) => [id, s.hands[id]]));
        for (const id of ids) s.hands[step(ctx.players.filter((p) => s.hands[p.id]), id, s.dir)!] = old[id];
        s.log.push("Alle geben ihre Karten weiter");
      }
      const two = ctx.players.filter((p) => s.hands[p.id]).length === 2;
      if (v === "rev") s.dir = s.dir === 1 ? -1 : 1;
      if (v === "plus4" && !r.stack && r.plus4 === "challenge") {
        // Original: der Nächste entscheidet – 4 ziehen oder anzweifeln
        s.challenge = { by: me, guilty };
        endTurn();
      } else if (v === "plus2" || v === "plus4") {
        const n = v === "plus2" ? 2 : 4;
        if (r.stack) { s.pendingDraw += n; endTurn(); }
        else {
          const victim = step(ctx.players, me, s.dir)!;
          give(s, victim, n);
          s.log.push(`${nameOf(ctx, victim)} zieht ${n} und setzt aus`);
          endTurn(true);
        }
      } else endTurn(v === "skip" || (v === "rev" && two));
      sync(s);
      return s;
    }
    case "draw": {
      if (s.drawn) throw new GameError("Du hast schon gezogen – leg die Karte oder passe.");
      if (s.challenge) {
        s.challenge = null;
        give(s, me, 4);
        s.log.push(`${nameOf(ctx, me)} zieht 4 und setzt aus`);
        endTurn();
        sync(s);
        return s;
      }
      if (s.pendingDraw > 0) {
        const got = give(s, me, s.pendingDraw);
        s.log.push(`${nameOf(ctx, me)} zieht ${got.length} Karten`);
        s.pendingDraw = 0;
        endTurn();
        sync(s);
        return s;
      }
      // Hausregel „Ziehen, bis es passt“: so lange ziehen, bis eine Karte passt oder der Stapel leer ist
      let got: UnoCard | undefined;
      let n = 0;
      do { got = give(s, me, 1)[0]; if (got) n++; } while (r.drawUntil && got && !canPlay(s, got, ctx.options, s.hands[me]));
      s.log.push(`${nameOf(ctx, me)} zieht ${n === 1 ? "eine Karte" : `${n} Karten`}`);
      // Ohne Automatik sieht man die gezogene Karte erst und passt selbst
      if (got && (canPlay(s, got, ctx.options, s.hands[me]) || ctx.options.autoPass !== true)) s.drawn = got;
      else endTurn();
      sync(s);
      return s;
    }
    case "pass": {
      if (!s.drawn) throw new GameError("Erst ziehen, dann passen.");
      s.log.push(`${nameOf(ctx, me)} passt`);
      endTurn();
      sync(s);
      return s;
    }
    default:
      throw new GameError("Das geht nur mit echten Karten.");
  }
}

/** Punkteblock: Verlierer tragen ihre Handpunkte ein, der Sieger bekommt die Summe */
function applyTable(s: UnoState, a: UnoAction, ctx: GameContext, isHost: boolean): UnoState {
  const actor = ctx.actorId;
  if (s.phase === "over") throw new GameError("Die Partie ist vorbei.");
  switch (a.type) {
    case "enter": {
      const who = a.player ?? actor;
      if (!who || !ctx.players.some((p) => p.id === who)) throw new GameError("Diesen Spieler gibt es nicht.");
      if (actor !== null && who !== actor && !isHost) throw new GameError("Trag nur deine eigenen Punkte ein.");
      if (a.points !== null && (!Number.isInteger(a.points) || a.points < 0 || a.points > 999)) throw new GameError("Punkte zwischen 0 und 999.");
      s.entries[who] = a.points;
      return s;
    }
    case "setWinner": {
      if (a.player !== null && !ctx.players.some((p) => p.id === a.player)) throw new GameError("Diesen Spieler gibt es nicht.");
      s.tableWinner = a.player;
      if (a.player) s.entries[a.player] = 0;
      return s;
    }
    case "finishRound": {
      if (!isHost) throw new GameError("Die Runde schließt der Host ab.");
      const w = s.tableWinner;
      if (!w) throw new GameError("Wer hat die Runde gewonnen?");
      const missing = ctx.players.filter((p) => p.id !== w && (s.entries[p.id] === null || s.entries[p.id] === undefined));
      if (missing.length) throw new GameError(`Es fehlen noch Punkte: ${missing.map((p) => p.name).join(", ")}.`);
      const points = ctx.players.reduce((t, p) => t + (p.id === w ? 0 : s.entries[p.id] ?? 0), 0);
      winRound(s, ctx, w, points);
      if ((s.phase as UnoState["phase"]) !== "over") { s.phase = "enter"; s.round++; s.entries = Object.fromEntries(ctx.players.map((p) => [p.id, null])); s.tableWinner = null; }
      return s;
    }
    default:
      throw new GameError("Mit echten Karten tragt ihr nur die Punkte ein.");
  }
}

export function valueLabel(v: UnoValue | "wild" | "plus4"): string {
  return v === "skip" ? "Aussetzen" : v === "rev" ? "Richtungswechsel" : v === "plus2" ? "+2" : v === "plus4" ? "+4" : v === "wild" ? "Farbwahl" : v;
}
export const cardLabel = (c: UnoCard) => (isWild(c) ? valueLabel(valueOf(c)) : `${COLOR_NAME[colorOf(c)!]} ${valueLabel(valueOf(c))}`);

export function leaders(s: UnoState, players: Player[]): string[] {
  const best = Math.max(...players.map((p) => s.scores[p.id] ?? 0));
  return players.filter((p) => (s.scores[p.id] ?? 0) === best).map((p) => p.id);
}

export const uno: GameLogic<UnoState, UnoAction> = {
  info: {
    id: "uno",
    name: "Uno",
    tagline: "Farbe oder Zahl bedienen, Aussetzen, +2, +4 – und „Uno!“ nicht vergessen.",
    category: "Karten",
    minPlayers: 2,
    maxPlayers: 10,
    duration: "20–40 Min.",
  },
  version: 1,
  turnBased: true,
  ownTurnsOnly: true,
  joinMidGame: false,
  settings: [
    {
      key: "mode", label: "Karten", type: "choice", default: "app",
      choices: [
        { value: "app", label: "In der App", hint: "App mischt und verteilt" },
        { value: "table", label: "Echte Karten", hint: "App ist der Punkteblock" },
      ],
    },
    {
      key: "target", label: "Spieldauer", type: "choice", default: "500",
      choices: [
        { value: "round", label: "Eine Runde", hint: "wer zuerst leer ist" },
        { value: "500", label: "Bis 500", hint: "Punkte sammeln" },
      ],
    },
    { key: "uno", label: "„Uno!“ sagen", type: "toggle", default: true, hint: "Original – vergessen = 2 Strafkarten", group: "Hausregeln", showIf: APP },
    {
      key: "plus4", label: "+4 legen", type: "choice", default: "challenge", group: "Hausregeln", showIf: APP,
      choices: [
        { value: "challenge", label: "Anzweifeln", hint: "Original: Bluff erlaubt, der Nächste darf anzweifeln" },
        { value: "strict", label: "Nur ohne Farbe", hint: "kein Bluff möglich" },
        { value: "any", label: "Immer", hint: "ohne Anzweifeln" },
      ],
    },
    { key: "stack", label: "Ziehkarten stapeln", type: "toggle", default: false, hint: "+2 auf +2, +4 auf alles – der Letzte zieht alles (dann kein Anzweifeln)", group: "Hausregeln", showIf: APP },
    { key: "drawUntil", label: "Ziehen, bis es passt", type: "toggle", default: false, hint: "statt nur einer Karte", group: "Hausregeln", showIf: APP },
    { key: "sevenZero", label: "7-0", type: "toggle", default: false, hint: "7: Hand mit jemandem tauschen, 0: alle geben ihre Hand weiter", group: "Hausregeln", showIf: APP },
    { key: "autoPass", label: "Nach dem Ziehen automatisch weiter", type: "toggle", default: false, hint: "passt die gezogene Karte nicht, ist sofort der Nächste dran – sonst siehst du sie erst und tippst auf Passen", group: "Ablauf", inGame: true, showIf: APP },
  ],
  setup,
  apply,
  actionKind: (a) => (["play", "draw", "pass", "color", "doubt"].includes(a.type) ? "turn" : "player"),
  currentPlayerId: (s) => (s.phase === "play" ? s.curId : null),
  isOver: (s) => s.phase === "over",
  results: (s, ctx) => {
    const win = leaders(s, ctx.players);
    return ctx.players.map((p) => ({ id: p.id, won: win.includes(p.id), score: s.scores[p.id] ?? 0 }));
  },
  skipLabel: (s, ctx) => (s.phase === "play" && s.curId ? `Zug von ${nameOf(ctx, s.curId)} überspringen (zieht ${s.drawn ? "nichts mehr" : s.challenge ? 4 : s.pendingDraw || 1})` : null),
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase !== "play" || !s.curId) return s;
    s.pickColor = false;
    if (!s.drawn) { give(s, s.curId, s.challenge ? 4 : s.pendingDraw || 1); s.pendingDraw = 0; s.challenge = null; }
    s.log.push(`Zug von ${nameOf(ctx, s.curId)} übersprungen`);
    s.drawn = null;
    s.curId = step(ctx.players, s.curId, s.dir);
    s.n++;
    sync(s);
    return s;
  },
  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    if (s.hands[id]) { s.pile.unshift(...s.hands[id]); delete s.hands[id]; }
    delete s.entries[id];
    if (s.tableWinner === id) s.tableWinner = null;
    if (s.challenge?.by === id) s.challenge = null;
    if (s.curId === id) { s.curId = step(ctx.players, id, s.dir); s.drawn = null; s.challenge = null; s.pickColor = false; }
    const rest = ctx.players.filter((p) => p.id !== id);
    if (s.phase === "play" && rest.length === 1) winRound(s, { ...ctx, players: rest }, rest[0].id, 0);
    sync(s);
    return s;
  },
  // Ob das +4 ein Bluff war, verrät erst das Anzweifeln
  view: (s, viewer) => (viewer === null ? s : { ...s, pile: [], challenge: s.challenge ? { by: s.challenge.by } : null, hands: viewer in s.hands ? { [viewer]: s.hands[viewer] } : {} }),
};
