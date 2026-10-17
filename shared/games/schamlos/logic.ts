/**
 * Schamlos – Lückensätze frech füllen. Reihum ist jemand Kartenzar und deckt eine schwarze Karte mit Lücke auf.
 * Alle anderen legen verdeckt eine (oder zwei) weiße Karten dazu. Der Zar liest alle Sätze vor und wählt – ohne zu wissen,
 * von wem sie sind – den besten. Wer zuerst die Zielpunkte hat, gewinnt.
 * Drei Stufen: „Für alle“ (frech, für jede Runde), „Ab 18“ (Freunde) und „Feuchtfröhlich“ (Freundschaft plus und mehr).
 * Höhere Stufen spielen die Karten der darunter mit.
 */
import { GameError, type GameContext, type GameLogic, type PlayerResult } from "../../platform/types";
import { shuffle } from "../../platform/random";
import { playerName } from "../../platform/turns";
import { blanksOf, deckFor, type Tier } from "./cards";

export const HAND = 7;
export const TIERS: { value: Tier; label: string; hint: string }[] = [
  { value: "alle", label: "Für alle", hint: "frech, für jede Runde" },
  { value: "ab18", label: "Ab 18", hint: "für Freunde" },
  { value: "plus", label: "Feuchtfröhlich", hint: "Freundschaft plus" },
];

export interface Submission {
  /** wer – bleibt verborgen, bis der Zar gewählt hat */
  by: string;
  cards: string[];
}

export interface SchamlosState {
  v: 1;
  tier: Tier;
  goal: number;
  phase: "pick" | "judge" | "result" | "over";
  /** Reihenfolge, in der Zar wird */
  order: string[];
  czar: string;
  /** schwarze Karte dieser Runde */
  prompt: string;
  /** wie viele weiße Karten gelegt werden */
  blanks: number;
  hands: Record<string, string[]>;
  /** Wer hat schon gelegt? Inhalt erst beim Aufdecken sichtbar (siehe view) */
  played: Record<string, string[]>;
  /** Aufgedeckte Antworten in zufälliger Reihenfolge (ab „judge“) */
  subs: Submission[];
  /** Gewinner der Runde (ab „result“) */
  pick: number | null;
  scores: Record<string, number>;
  blackPile: string[];
  whitePile: string[];
  whiteUsed: string[];
  round: number;
  winnerId: string | null;
  log: string[];
}

export type SchamlosAction =
  /** `player`: nur lokal (ein Gerät) – für wen gelegt wird */
  | { type: "play"; cards: string[]; player?: string }
  | { type: "choose"; index: number }
  | { type: "next" };

const name = playerName;

/** Weiße Karten nachziehen – ist der Stapel leer, wird gemischt, was schon gespielt wurde */
function draw(s: SchamlosState, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (!s.whitePile.length) {
      if (!s.whiteUsed.length) break;
      s.whitePile = shuffle(s.whiteUsed);
      s.whiteUsed = [];
    }
    out.push(s.whitePile.pop()!);
  }
  return out;
}

/** Neue schwarze Karte, Hände auffüllen (auch für neu Hinzugekommene) */
function startRound(s: SchamlosState, ctx: GameContext): void {
  const ids = ctx.players.map((p) => p.id);
  for (const id of ids) {
    if (!s.order.includes(id)) s.order.push(id);
    s.scores[id] ??= 0;
    const hand = (s.hands[id] ??= []);
    hand.push(...draw(s, HAND - hand.length));
  }
  s.order = s.order.filter((id) => ids.includes(id));
  if (!s.blackPile.length) s.blackPile = shuffle(deckFor(s.tier).black);
  s.prompt = s.blackPile.pop()!;
  s.blanks = blanksOf(s.prompt);
  s.played = {};
  s.subs = [];
  s.pick = null;
  s.round++;
  s.phase = "pick";
}

function nextCzar(s: SchamlosState): void {
  const i = s.order.indexOf(s.czar);
  s.czar = s.order[(i + 1) % s.order.length] ?? s.order[0];
}

/** Alle Antworten da (oder der Host schaltet weiter): aufdecken, gemischt */
function reveal(s: SchamlosState): void {
  s.subs = shuffle(Object.entries(s.played).map(([by, cards]) => ({ by, cards })));
  s.phase = "judge";
}

const players = (s: SchamlosState, ctx: GameContext) => ctx.players.map((p) => p.id).filter((id) => id !== s.czar);

export const schamlos: GameLogic<SchamlosState, SchamlosAction> = {
  info: { id: "schamlos", name: "Schamlos", tagline: "Lückensätze frech füllen – der Zar kürt die beste Antwort", category: "Party", minPlayers: 3, maxPlayers: 12, duration: "30 Min." },
  version: 1,
  settings: [
    { key: "tier", label: "Stufe", type: "choice", default: "alle", choices: TIERS },
    { key: "goal", label: "Punkte zum Sieg", type: "number", default: 7, min: 3, max: 15, step: 1 },
  ],
  turnBased: false,
  joinMidGame: true,

  setup(ctx) {
    const tier = (TIERS.some((t) => t.value === ctx.options.tier) ? ctx.options.tier : "alle") as Tier;
    const deck = deckFor(tier);
    const order = ctx.players.map((p) => p.id);
    const s: SchamlosState = {
      v: 1, tier, goal: Number(ctx.options.goal) || 7, phase: "pick", order,
      // Zar wandert von Partie zu Partie weiter
      czar: order[(ctx.round ?? 0) % order.length],
      prompt: "", blanks: 1, hands: {}, played: {}, subs: [], pick: null, scores: {},
      blackPile: shuffle(deck.black), whitePile: shuffle(deck.white), whiteUsed: [], round: 0, winnerId: null, log: [],
    };
    startRound(s, ctx);
    return s;
  },

  actionKind(a) {
    return a.type === "play" || a.type === "choose" || a.type === "next" ? "player" : null;
  },

  apply(prev, a, ctx) {
    const s = structuredClone(prev);
    const me = ctx.actorId;
    switch (a.type) {
      case "play": {
        if (s.phase !== "pick") throw new GameError("Gerade wird nicht gelegt.");
        // Lokal (ein Gerät) sagt die Oberfläche, wer gerade legt
        const id = me ?? a.player ?? null;
        if (!id || id === s.czar) throw new GameError("Der Zar legt keine Karte.");
        if (s.played[id]) throw new GameError("Du hast schon gelegt.");
        const hand = s.hands[id] ?? [];
        if (a.cards.length !== s.blanks || new Set(a.cards).size !== a.cards.length || !a.cards.every((c) => hand.includes(c))) {
          throw new GameError(s.blanks === 1 ? "Wähle eine Karte." : `Wähle ${s.blanks} Karten.`);
        }
        s.hands[id] = hand.filter((c) => !a.cards.includes(c));
        s.played[id] = a.cards;
        if (players(s, ctx).every((p) => s.played[p])) reveal(s);
        return s;
      }
      case "choose": {
        if (s.phase !== "judge") throw new GameError("Gerade wird nicht gewählt.");
        if (me !== null && me !== s.czar && me !== ctx.hostId) throw new GameError("Nur der Zar wählt.");
        const sub = s.subs[a.index];
        if (!sub) throw new GameError("Diese Antwort gibt es nicht.");
        s.pick = a.index;
        s.scores[sub.by] = (s.scores[sub.by] ?? 0) + 1;
        s.log.push(`${name(ctx, sub.by)} gewinnt die Runde`);
        s.phase = s.scores[sub.by] >= s.goal ? "over" : "result";
        if (s.phase === "over") s.winnerId = sub.by;
        return s;
      }
      case "next": {
        if (s.phase !== "result") throw new GameError("Noch nicht.");
        for (const sub of s.subs) s.whiteUsed.push(...sub.cards);
        nextCzar(s);
        startRound(s, ctx);
        return s;
      }
    }
  },

  currentPlayerId(s) {
    return s.phase === "judge" || s.phase === "result" ? s.czar : null;
  },
  isOver: (s) => s.phase === "over",

  results(s, ctx): PlayerResult[] {
    return ctx.players.map((p) => ({ id: p.id, won: p.id === s.winnerId, score: s.scores[p.id] ?? 0 }));
  },

  // Nichts bleibt hängen: fehlende Antworten überspringen, abwesenden Zar ersetzen
  skipLabel(s, ctx) {
    if (s.phase === "pick") {
      const missing = players(s, ctx).filter((p) => !s.played[p]);
      if (!missing.length) return null;
      return Object.keys(s.played).length ? `Ohne ${missing.map((m) => name(ctx, m)).join(", ")} aufdecken` : "Neue Karte, neuer Zar";
    }
    if (s.phase === "judge") return `Statt ${name(ctx, s.czar)} zufällig wählen`;
    if (s.phase === "result") return "Nächste Runde";
    return null;
  },
  skipTurn(prev, ctx) {
    const s = structuredClone(prev);
    if (s.phase === "pick") {
      if (Object.keys(s.played).length) { reveal(s); return s; }
      nextCzar(s); s.round--; startRound(s, ctx);
      return s;
    }
    if (s.phase === "judge" && s.subs.length) return schamlos.apply(s, { type: "choose", index: Math.floor(Math.random() * s.subs.length) }, { ...ctx, actorId: null });
    if (s.phase === "result") return schamlos.apply(s, { type: "next" }, ctx);
    return s;
  },

  onPlayerRemoved(prev, id, ctx) {
    const s = structuredClone(prev);
    const rest = { ...ctx, players: ctx.players.filter((p) => p.id !== id) };
    s.whiteUsed.push(...(s.hands[id] ?? []), ...(s.played[id] ?? []));
    delete s.hands[id];
    delete s.played[id];
    s.subs = s.subs.filter((x) => x.by !== id);
    if (s.phase === "over") return s;
    if (s.czar === id || rest.players.length < 2) {
      nextCzar(s);
      s.order = s.order.filter((p) => p !== id);
      if (s.czar === id) s.czar = s.order[0];
      startRound(s, rest);
      return s;
    }
    s.order = s.order.filter((p) => p !== id);
    if (s.phase === "pick" && players(s, rest).every((p) => s.played[p]) && Object.keys(s.played).length) reveal(s);
    if (s.phase === "judge" && !s.subs.length) { nextCzar(s); startRound(s, rest); }
    return s;
  },

  view(s, viewer) {
    if (viewer === null) return s;
    const v: SchamlosState = { ...s, blackPile: [], whitePile: [], whiteUsed: [], hands: viewer in s.hands ? { [viewer]: s.hands[viewer] } : {} };
    // Was andere gelegt haben, bleibt verdeckt – nur dass sie gelegt haben, ist sichtbar
    v.played = Object.fromEntries(Object.entries(s.played).map(([id, cards]) => [id, id === viewer ? cards : []]));
    // Beim Wählen weiß niemand, von wem welche Antwort ist
    if (s.phase === "judge") v.subs = s.subs.map((x) => ({ by: x.by === viewer ? viewer : "", cards: x.cards }));
    return v;
  },
};
