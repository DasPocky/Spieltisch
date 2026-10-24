/**
 * Raum-Logik der Plattform: Spieler, Host, Spielauswahl, Einstellungen und Phasen.
 * Wird vom Durable Object (online) und vom Browser (lokal) gleichermaßen genutzt.
 * Spielzüge reicht der Raum nach der Rechteprüfung an das jeweilige Spiel weiter.
 */
import { MAX_SET_NAME, MAX_SETS_IN_GAME, SET_ID_RE, SET_KINDS, type GameContent, type SetKind } from "./cardsets";
import { DEFAULT_GAME, getGame, isGameId } from "../games";
import { renameGameFields, renamedGameId } from "../games/renamed";
import { legacyGame } from "../legacy";
import { presetsOf, presetValues } from "./presets";
import { sanitizeAvatar, type Avatar } from "./avatar";
import { sanitizeAccess, type RoomAccess } from "./directory";
import { GameError, type EntryMode, type GameContext, type GameLogic, type OptionValue, type Options, type Player, type SettingDef } from "./types";

export const MAX_PLAYERS = 20;
export const MAX_NAME = 16;

export interface RoomState {
  v: 2;
  gameId: string;
  players: Player[];
  hostId: string | null;
  entry: EntryMode;
  /** Host hat die Spielleiter-Funktionen an (für andere handeln, überspringen …) – sonst spielt er ganz normal mit */
  hostTools?: boolean;
  /** Spielhilfen im Raum aus (Host-Schalter) – fehlt: an */
  noHints?: boolean;
  /** Einstellungen des gewählten Spiels */
  options: Options;
  phase: "lobby" | "playing";
  /** Spielstand des gewählten Spiels, null in der Lobby */
  game: unknown;
  /**
   * Version des Spiels, mit der die laufende Partie begann (fehlt bei alten Räumen: aktuelle Version).
   * Nach einem Update läuft eine Partie mit ihrer gesicherten Version weiter (`shared/legacy`).
   */
  gameVersion?: number;
  /** Ein Update hat die laufende Partie beendet (nicht übertragbar) – die Lobby sagt es einmal an */
  updated?: { gameId: string; at: number };
  /** zählt gestartete Partien */
  round: number;
  /** Spielstände vor den letzten Zügen – zum Zurücknehmen. Bleibt auf Server bzw. Gerät, geht nie an Mitspieler. */
  undo?: unknown[];
  /** Wie viele Züge zurückgenommen werden können (nur in der Sicht für Spieler) */
  undoCount?: number;
  /** zählt Rücknahmen – damit alle kurz „Zug zurückgenommen“ sehen */
  undone?: number;
  /** Avatar je Spieler (online setzt ihn der Server beim Beitritt, lokal das Gerät) */
  /** Treffpunkt-Ansicht in der Lobby (nur online) */
  meet?: boolean;
  /** Gewählte eigene Kartensets (Kennung, Name, Art) – gelten für Spiele der passenden Art */
  sets?: RoomSet[];
  /** Inhalte der gewählten eigenen Kartensets für den nächsten Start – bleibt auf Server bzw. Gerät, geht nie an Mitspieler */
  content?: GameContent;
  avatars?: Record<string, Avatar>;
  /** Spieler → Mitglieds-ID in seiner Gruppe (öffentlich innerhalb der Gruppe, keine Profil-ID) */
  members?: Record<string, string>;
  /**
   * Wartebank: Wer mitten in einer Partie dazukommt (bei Spielen ohne Einstieg im laufenden Spiel),
   * sitzt hier und spielt ab der nächsten Partie mit („Nochmal“, Start oder Lobby holt alle rein).
   */
  bench?: Player[];
  /** Spielabend: Siege über alle Partien in diesem Raum (auch über verschiedene Spiele) */
  evening?: Evening;
  /** Name, Sichtbarkeit, Einlass und Lebensdauer (nur online; fehlt bei alten Räumen) */
  access?: RoomAccess;
  /** Testspieler (Entwickler-Modus): ziehen von selbst zufällig, aber erlaubt */
  bots?: string[];
  /** Fotos der Spieler (Speichername in R2, siehe photo.ts) – statt Tier */
  photos?: Record<string, string>;
  /** Spielstärke je Bot („leicht“ … „schwer“, siehe botSkill.ts) – fehlt: zufällig */
  botLevels?: Record<string, "zufall" | "leicht" | "mittel" | "schwer">;
  /** Abstimmung über das nächste Spiel (nur online) – `winner` gesetzt: entschieden, der Server startet es gleich */
  vote?: RoomVote;
}

/** Abstimmung über das nächste Spiel: Vorschläge, Stimme je Spieler, Ende spätestens bei `endsAt` */
export interface RoomVote { games: string[]; votes: Record<string, string>; endsAt: number; winner?: string }

export interface Evening {
  /** Siege je Spieler-ID */
  wins: Record<string, number>;
  /** Namen merken – auch wer inzwischen gegangen ist, bleibt in der Wertung */
  names: Record<string, string>;
  /** Beendete Partien, älteste zuerst (höchstens 50) */
  log: { gameId: string; winners: string[]; at: number; round?: number; plan?: boolean }[];
  /** Partyabend: geplante Spiele der Reihe nach; `played` zählt die seit dem Plan beendeten Partien */
  plan?: { games: string[]; played: number; short?: boolean };
}

/** Höchstens so viele Spiele in einem Partyabend */
export const PLAN_MAX = 8;

/** Abstimmung: so viele Vorschläge und so lange (Sekunden) */
export const VOTE_MIN = 2;
export const VOTE_MAX = 4;
export const VOTE_SECONDS = 30;

/** Wer abstimmen soll: alle im Raum außer Testspielern (Bots blockieren nie) */
export const voters = (s: RoomState): string[] => [...s.players, ...(s.bench ?? [])].map((p) => p.id).filter((id) => !s.bots?.includes(id));

/** Stimmen je Vorschlag (nur gültige Stimmen von Leuten im Raum) */
export function tallyVote(s: RoomState): Record<string, number> {
  const v = s.vote;
  const out: Record<string, number> = Object.fromEntries((v?.games ?? []).map((g) => [g, 0]));
  if (!v) return out;
  for (const [id, g] of Object.entries(v.votes)) if (g in out && inRoom(s, id)) out[g]++;
  return out;
}

/** Gewinner der Abstimmung: meiste Stimmen, Gleichstand (auch ohne Stimmen) per Zufall */
export function voteWinner(s: RoomState, rand: () => number = Math.random): string | null {
  const t = tallyVote(s);
  const best = Math.max(...Object.values(t));
  const top = Object.keys(t).filter((g) => t[g] === best);
  return top.length ? top[Math.min(top.length - 1, Math.floor(rand() * top.length))] : null;
}

/** Spiel wählen (Standard-Einstellungen); läuft ein Partyabend mit „kurzen Runden“, gleich das Paket „Kurz“ */
function pickGame(s: RoomState, id: string) {
  if (s.gameId !== id) { s.gameId = id; s.options = defaultOptions(getGame(id).settings); }
  shortRules(s);
}

/** Partyabend mit kurzen Runden: hat das gewählte Spiel ein Paket „Kurz“, gilt es (sonst Standard) */
export function shortRules(s: RoomState) {
  if (!s.evening?.plan?.short || s.phase !== "lobby") return;
  const logic = getGame(s.gameId);
  const p = presetsOf(logic).find((x) => x.id === "kurz");
  if (p) for (const [k, v] of Object.entries(presetValues(logic, p))) s.options[k] = sanitizeOption(logic.settings.find((d) => d.key === k)!, v);
}

/** Abstimmung entschieden: zurück in die Lobby, Gewinner wählen (im Partyabend als nächstes Spiel) */
function decideVote(s: RoomState, winner: string) {
  s.vote = { ...s.vote!, winner };
  if (s.phase === "playing") { s.phase = "lobby"; s.game = null; s.undo = []; seatBench(s); }
  const plan = s.evening?.plan;
  if (plan && plan.played < plan.games.length && plan.games[plan.played] !== winner) {
    const rest = plan.games.slice(plan.played);
    const at = rest.indexOf(winner);
    if (at >= 0) rest.splice(at, 1); else if (plan.games.length >= PLAN_MAX) rest.shift();
    plan.games = [...plan.games.slice(0, plan.played), winner, ...rest];
  }
  pickGame(s, winner);
}

/**
 * Entschiedene Abstimmung: Gewinner gleich starten (als Host). Geht das nicht (Spielerzahl passt nicht),
 * bleibt er in der Lobby gewählt. In beiden Fällen ist die Abstimmung danach vorbei.
 */
export function startVoted(s: RoomState): RoomState {
  if (!s.vote?.winner) return s;
  const clean: RoomState = { ...s };
  delete clean.vote;
  try { return applyRoomAction(clean, { type: "start" }, s.hostId); } catch { return clean; }
}

/** Stand des Partyabends: nächstes Spiel (null = durch) – null, wenn kein Plan */
export function planStatus(e: Evening | undefined): { games: string[]; played: number; next: string | null; done: boolean } | null {
  if (!e?.plan?.games.length) return null;
  const { games, played } = e.plan;
  const n = Math.min(played, games.length);
  return { games, played: n, next: games[n] ?? null, done: n >= games.length };
}

/**
 * Partie gerade zu Ende gegangen? Dann zählt sie für den Spielabend. Läuft ein Partyabend-Plan, zählt nur das
 * geplante Spiel (Abendwertung und Fortschritt) – eine Partie zwischendurch ist nur zum Spaß.
 */
function recordEvening(prev: RoomState, next: RoomState): RoomState {
  const logic = roomGame(next);
  if (!prev.game || !next.game || logic.isOver(prev.game) || !logic.isOver(next.game) || !logic.results) return next;
  const plan = planStatus(next.evening);
  if (plan && !plan.done && plan.next !== next.gameId) return next;
  const results = logic.results(next.game, context(next, null));
  const winners = results.filter((r) => r.won).map((r) => r.id);
  const e: Evening = structuredClone(next.evening ?? { wins: {}, names: {}, log: [] });
  for (const r of results) {
    const name = next.players.find((p) => p.id === r.id)?.name;
    if (name) e.names[r.id] = name;
    e.wins[r.id] = (e.wins[r.id] ?? 0) + (r.won ? 1 : 0);
  }
  const planned = !!(e.plan && e.plan.played < e.plan.games.length);
  e.log = [...e.log, { gameId: next.gameId, winners, at: Date.now(), round: next.round, ...(planned ? { plan: true } : {}) }].slice(-50);
  if (planned) e.plan!.played++;
  return { ...next, evening: e };
}

/**
 * Partyabend: gesperrte Spiele (Verwaltung hat sie abgeschaltet) im Plan überspringen, damit nichts hängen bleibt.
 * Steht danach ein freies Spiel an und die Lobby ist offen, ist es gleich gewählt. Gibt zurück, was übersprungen wurde.
 */
export function skipBlockedPlan(s: RoomState, allowed: (gameId: string) => boolean): string[] {
  const plan = s.evening?.plan;
  if (!plan) return [];
  const skipped: string[] = [];
  while (plan.played < plan.games.length && !allowed(plan.games[plan.played])) skipped.push(plan.games[plan.played++]);
  const next = plan.games[plan.played];
  if (skipped.length && next && s.phase === "lobby" && next !== s.gameId && isGameId(next)) pickGame(s, next);
  return skipped;
}

/** Spielabend als Rangliste: meiste Siege zuerst */
export function eveningRanking(e: Evening | undefined): { id: string; name: string; wins: number }[] {
  if (!e) return [];
  return Object.entries(e.wins).map(([id, wins]) => ({ id, name: e.names[id] ?? "?", wins })).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
}

/** Spieler oder auf der Wartebank – gehört zum Raum */
export const inRoom = (room: RoomState, id: string) => room.players.some((p) => p.id === id) || !!room.bench?.some((p) => p.id === id);

/** Wartebank in die Spielerliste holen (so viele, wie das Spiel erlaubt) */
function seatBench(s: RoomState) {
  if (!s.bench?.length) return;
  const max = playerLimits(s).max;
  while (s.bench.length && s.players.length < max) s.players.push(s.bench.shift()!);
  if (!s.bench.length) delete s.bench;
}

/** So viele Züge lassen sich zurücknehmen */
export const UNDO_DEPTH = 3;
/** Neuer Spielstand, der alte kommt in den Rücknahme-Speicher */
const withUndo = (prev: RoomState, game: unknown): RoomState => ({ ...prev, game, undo: [...(prev.undo ?? []), prev.game].slice(-UNDO_DEPTH) });

export type RoomAction =
  | { type: "start" }
  | { type: "restart" }
  | { type: "toLobby" }
  | { type: "selectGame"; gameId: string }
  | { type: "setOption"; key: string; value: OptionValue }
  | { type: "setPreset"; id: string }
  | { type: "setEntry"; mode: EntryMode }
  | { type: "setHostTools"; on: boolean }
  | { type: "setHints"; on: boolean }
  /** Host: Treffpunkt (reden, sehen, schreiben) statt Spiel-Lobby anzeigen */
  | { type: "setMeet"; on: boolean }
  /** Host: Raumname, Sichtbarkeit, Einlass, Lebensdauer (Dauerraum bleibt Dauerraum) */
  | { type: "setAccess"; access: Partial<RoomAccess> }
  | { type: "removePlayer"; id: string }
  | { type: "movePlayer"; id: string; dir: -1 | 1 }
  /** Host: neue Reihenfolge (z. B. gemischt) – muss genau die Spieler enthalten */
  | { type: "orderPlayers"; ids: string[] }
  /** Avatar (Tier + Farbe) eines Spielers – jeder für sich, der Host für alle */
  | { type: "setAvatar"; id: string; avatar: Avatar }
  /** Host: das auflösen, worauf die Partie gerade wartet */
  | { type: "skip" }
  /** Host (lokal: jeder): den letzten Zug zurücknehmen */
  | { type: "undo" }
  /** Host: Spielabend-Wertung auf null */
  | { type: "resetEvening" }
  /** Host: Partyabend planen (Spiele der Reihe nach) oder beenden (null) */
  | { type: "setPlan"; games: string[] | null; short?: boolean }
  /** Host: Abstimmung über das nächste Spiel starten (2–4 Vorschläge) – in der Lobby oder nach einer Partie */
  | { type: "startVote"; games: string[] }
  /** Jeder im Raum: Stimme abgeben oder ändern */
  | { type: "vote"; gameId: string }
  /** Auswerten (Host jederzeit, alle nach Ablauf der Zeit), Host: selbst wählen (`gameId`) oder abbrechen (`cancel`) */
  | { type: "endVote"; gameId?: string; cancel?: boolean }
  /** Host: eigene Kartensets für die nächsten Partien wählen (leer = nur eingebaute Karten) */
  | { type: "setSets"; sets: RoomSet[] }
  | { type: "game"; action: { type: string } & Record<string, unknown> };

/** Ein gewähltes Kartenset im Raum (ohne Inhalt) */
export interface RoomSet { id: string; name: string; kind?: SetKind }

export function cleanName(name: unknown): string {
  return String(name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

export function defaultOptions(settings: SettingDef[]): Options {
  return Object.fromEntries(settings.map((s) => [s.key, s.default]));
}

/** Prüft einen einzelnen Einstellungswert und bringt ihn in den erlaubten Bereich. */
export function sanitizeOption(def: SettingDef, value: unknown): OptionValue {
  switch (def.type) {
    case "choice":
      return def.choices.some((c) => c.value === value) ? (value as string) : def.default;
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return def.default;
      return Math.min(def.max, Math.max(def.min, Math.round(n / def.step) * def.step));
    }
    case "toggle":
      return value === true;
  }
}

export function createRoom(gameId: string = DEFAULT_GAME): RoomState {
  const id = isGameId(gameId) ? gameId : DEFAULT_GAME;
  return {
    v: ROOM_SCHEMA, gameId: id, players: [], hostId: null, entry: "turn",
    options: defaultOptions(getGame(id).settings), phase: "lobby", game: null, round: 0,
  };
}

/** Logik der laufenden Partie – nach einem Update ggf. die gesicherte ältere Version */
export function roomGame(room: RoomState): GameLogic<unknown, { type: string }> {
  const logic = getGame(room.gameId);
  if (room.phase !== "playing" || room.gameVersion === undefined || room.gameVersion === logic.version) return logic;
  return legacyGame(room.gameId, room.gameVersion) ?? logic;
}

/** Version des Raum-Formats (`RoomState.v`). Beim Erhöhen eine Übernahme in ROOM_MIGRATIONS eintragen und eine Fixture ablegen. */
export const ROOM_SCHEMA = 2;
/** Übernahmen alter Raum-Formate: von Version n auf n+1 */
const ROOM_MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 → 2: Spiele umbenannt (keine Markennamen) – Spiel, Einstellungen, Spielstand, Rückgängig, Spielabend und Hinweis übernehmen
  1: (s) => {
    const gameId = renamedGameId(String(s.gameId));
    const ev = s.evening as Evening | undefined;
    const upd = s.updated as RoomState["updated"];
    return {
      ...s, v: 2, gameId,
      options: renameGameFields(gameId, s.options),
      game: renameGameFields(gameId, s.game),
      ...(Array.isArray(s.undo) ? { undo: s.undo.map((g) => renameGameFields(gameId, g)) } : {}),
      ...(ev ? { evening: { ...ev, log: (ev.log ?? []).map((l) => ({ ...l, gameId: renamedGameId(l.gameId) })),
        ...(ev.plan ? { plan: { ...ev.plan, games: ev.plan.games.map(renamedGameId) } } : {}) } } : {}),
      ...(upd ? { updated: { ...upd, gameId: renamedGameId(upd.gameId) } } : {}),
    };
  },
};

/**
 * Gespeicherten Raum laden: alte Formate schrittweise übernehmen, Grundform sichern (fehlende Listen ergänzen).
 * Wirft, wenn das gar kein Raum ist – dann bleibt der gespeicherte Stand unangetastet.
 */
export function migrateRoomState(raw: unknown): RoomState {
  if (!raw || typeof raw !== "object" || typeof (raw as RoomState).gameId !== "string") throw new Error("Kein Raumzustand");
  let s = raw as Record<string, unknown>;
  let v = typeof s.v === "number" ? s.v : 1;
  while (v < ROOM_SCHEMA) {
    const step = ROOM_MIGRATIONS[v];
    if (!step) throw new Error(`Keine Übernahme für Raum-Version ${v}`);
    s = step(s);
    v++;
  }
  const r = s as unknown as RoomState;
  return {
    ...r,
    // Stand einer neueren App (z. B. nach einem Zurückrollen): Version behalten, sonst liefe ihre Übernahme später ein zweites Mal
    v: Math.max(v, ROOM_SCHEMA) as typeof ROOM_SCHEMA,
    gameId: isGameId(r.gameId) ? r.gameId : DEFAULT_GAME,
    players: Array.isArray(r.players) ? r.players : [],
    options: r.options && typeof r.options === "object" ? r.options : defaultOptions(getGame(r.gameId).settings),
    phase: r.phase === "playing" && r.game ? "playing" : "lobby",
    game: r.phase === "playing" ? r.game ?? null : null,
    round: typeof r.round === "number" ? r.round : 0,
  };
}

/** Was ein Update mit einer laufenden Partie gemacht hat */
export type UpgradeResult = "same" | "legacy" | "migrated" | "reset";

/**
 * Raum nach einem Update an die aktuelle Spielversion anpassen (Server beim Laden, Gerät beim Fortsetzen):
 * gleiche Version – nichts tun; ältere Version gesichert – damit zu Ende spielen; sonst umrechnen (`migrate`);
 * geht auch das nicht, endet die Partie sanft: zurück in die Lobby, Gruppe, Spielabend und Einstellungen bleiben.
 */
export function upgradeRoom(room: RoomState): { room: RoomState; result: UpgradeResult } {
  const logic = getGame(room.gameId);
  if (room.phase !== "playing" || !room.game) return { room, result: "same" };
  // Räume von vor der Versionsprüfung: Partie gilt als aktuell
  if (room.gameVersion === undefined) return { room: { ...room, gameVersion: logic.version }, result: "same" };
  if (room.gameVersion === logic.version) return { room, result: "same" };
  if (legacyGame(room.gameId, room.gameVersion)) return { room, result: "legacy" };
  let game: unknown = null;
  try { game = logic.migrate?.(room.game, room.gameVersion) ?? null; } catch { game = null; }
  if (game) return { room: { ...room, game, gameVersion: logic.version, undo: [] }, result: "migrated" };
  const s: RoomState = { ...room, phase: "lobby", game: null, undo: [], gameVersion: undefined, updated: { gameId: room.gameId, at: Date.now() } };
  seatBench(s);
  return { room: s, result: "reset" };
}

/** Erlaubte Spielerzahl für das gewählte Spiel mit den aktuellen Einstellungen */
export function playerLimits(room: RoomState): { min: number; max: number; note?: string } {
  const logic = roomGame(room);
  const l = logic.playerLimits?.(room.options) ?? { min: logic.info.minPlayers, max: logic.info.maxPlayers };
  return { ...l, max: Math.min(MAX_PLAYERS, l.max) };
}

function context(room: RoomState, actorId: string | null): GameContext {
  return { players: room.players, hostId: room.hostId, actorId, options: room.options, now: Date.now(), round: room.round, content: room.content };
}

export function addPlayer(prev: RoomState, p: { id: string; name: string }): RoomState {
  const name = cleanName(p.name);
  const logic = roomGame(prev);
  if (!name) throw new GameError("Bitte gib einen Namen ein.");
  const all = [...prev.players, ...(prev.bench ?? [])];
  if (all.length >= MAX_PLAYERS) throw new GameError(`Maximal ${MAX_PLAYERS} Spieler.`);
  // Beim Beitritt zählt das absolute Maximum des Spiels – das genaue (je nach Einstellung) prüft der Start
  const max = Math.min(MAX_PLAYERS, logic.info.maxPlayers);
  if (all.length >= max) throw new GameError(`${logic.info.name} geht mit höchstens ${max} Spielern.`);
  if (all.some((x) => x.name.toLowerCase() === name.toLowerCase()))
    throw new GameError(`„${name}“ spielt schon mit. Nimm einen anderen Namen.`);
  const s = structuredClone(prev);
  // Partie läuft und das Spiel erlaubt keinen Einstieg: auf die Wartebank, ab der nächsten Partie dabei
  if (prev.phase === "playing" && !logic.joinMidGame) (s.bench ??= []).push({ id: p.id, name });
  else s.players.push({ id: p.id, name });
  if (!s.hostId) s.hostId = p.id;
  return s;
}

/** Wer ist gerade am Zug? */
export function currentPlayerId(room: RoomState): string | null {
  return room.phase === "playing" && room.game ? roomGame(room).currentPlayerId(room.game) : null;
}

/** Darf diese Person gerade für den Spieler am Zug handeln? (actorId null = lokales Gerät) */
export function canPlayTurn(room: RoomState, actorId: string | null): boolean {
  if (actorId === null) return true;
  if (roomGame(room).ownTurnsOnly) return currentPlayerId(room) === actorId;
  if (actorId === room.hostId && (room.hostTools || room.entry === "host")) return true;
  if (room.entry === "host") return false;
  if (room.entry === "all") return room.players.some((p) => p.id === actorId);
  return currentPlayerId(room) === actorId;
}

function assertPlayerCount(room: RoomState, logic: GameLogic<unknown, { type: string }>) {
  const n = room.players.length;
  const { min: minPlayers, max: maxPlayers } = playerLimits(room);
  const { name } = logic.info;
  if (n < minPlayers) throw new GameError(minPlayers === 1 ? "Mindestens ein Spieler wird gebraucht." : `${name} braucht mindestens ${minPlayers} Spieler.`);
  if (n > maxPlayers) throw new GameError(`${name} geht mit höchstens ${maxPlayers} Spielern.`);
}

export function applyRoomAction(prev: RoomState, a: RoomAction, actorId: string | null): RoomState {
  const isHost = actorId === null || actorId === prev.hostId;
  const logic = roomGame(prev);
  const hostOnly = () => { if (!isHost) throw new GameError("Das darf nur der Host."); };

  switch (a.type) {
    case "start":
    case "restart": {
      hostOnly();
      if (a.type === "start" && prev.phase !== "lobby") throw new GameError("Die Partie läuft schon.");
      if (a.type === "restart" && prev.phase !== "playing") throw new GameError("Es läuft keine Partie.");
      const s = structuredClone(prev);
      // Neue Partien immer mit der aktuellen Version (auch nach einer Partie, die noch mit einer älteren lief)
      const current = getGame(prev.gameId);
      s.gameVersion = current.version;
      delete s.updated;
      seatBench(s);
      s.phase = "playing";
      assertPlayerCount(s, current);
      s.game = current.setup(context(s, actorId));
      s.round++;
      s.undo = [];
      delete s.vote;
      return s;
    }
    case "toLobby": {
      hostOnly();
      const s: RoomState = { ...structuredClone(prev), phase: "lobby", game: null, undo: [] };
      delete s.vote;
      seatBench(s);
      // Partyabend: das nächste geplante Spiel steht gleich bereit
      const next = planStatus(s.evening)?.next;
      if (next && next !== s.gameId && isGameId(next)) pickGame(s, next);
      return s;
    }
    case "setSets": {
      hostOnly();
      if (!Array.isArray(a.sets) || a.sets.length > MAX_SETS_IN_GAME * SET_KINDS.length) throw new GameError(`Höchstens ${MAX_SETS_IN_GAME} Sets.`);
      const seen = new Set<string>();
      const sets = a.sets.filter((x) => x && SET_ID_RE.test(String(x.id)) && !seen.has(String(x.id)) && seen.add(String(x.id))).map((x): RoomSet => {
        const kind = SET_KINDS.find((k) => k.id === x.kind)?.id;
        return { id: String(x.id), name: String(x.name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SET_NAME) || "Eigenes Set", ...(kind ? { kind } : {}) };
      });
      // Je Art höchstens sechs (Sets ohne Art zählen für jede)
      if (SET_KINDS.some((k) => sets.filter((x) => !x.kind || x.kind === k.id).length > MAX_SETS_IN_GAME)) throw new GameError(`Höchstens ${MAX_SETS_IN_GAME} Sets je Spiel.`);
      const s = structuredClone(prev);
      if (sets.length) s.sets = sets; else delete s.sets;
      delete s.content;
      return s;
    }
    case "setPlan": {
      hostOnly();
      const s = structuredClone(prev);
      if (!a.games?.length) { if (s.evening) delete s.evening.plan; return s; }
      if (!Array.isArray(a.games) || a.games.length > PLAN_MAX || !a.games.every((g) => typeof g === "string" && isGameId(g))) throw new GameError("Diesen Plan gibt es so nicht.");
      s.evening = { ...(s.evening ?? { wins: {}, names: {}, log: [] }), plan: { games: [...a.games], played: 0, ...(a.short === true ? { short: true } : {}) } };
      if (s.phase === "lobby") pickGame(s, a.games[0]);
      return s;
    }
    case "startVote": {
      hostOnly();
      if (prev.phase === "playing" && !(prev.game && logic.isOver(prev.game))) throw new GameError("Abstimmen geht in der Lobby oder nach der Partie.");
      const games = Array.isArray(a.games) ? a.games : [];
      if (games.length < VOTE_MIN || games.length > VOTE_MAX || new Set(games).size !== games.length || !games.every((g) => typeof g === "string" && isGameId(g)))
        throw new GameError(`Zum Abstimmen ${VOTE_MIN} bis ${VOTE_MAX} verschiedene Spiele wählen.`);
      return { ...structuredClone(prev), vote: { games: [...games], votes: {}, endsAt: Date.now() + VOTE_SECONDS * 1000 } };
    }
    case "vote": {
      const v = prev.vote;
      if (!v || v.winner) throw new GameError("Gerade wird nicht abgestimmt.");
      if (actorId !== null && !inRoom(prev, actorId)) throw new GameError("Du bist nicht in diesem Raum.");
      if (!v.games.includes(a.gameId)) throw new GameError("Das steht nicht zur Wahl.");
      const s = structuredClone(prev);
      s.vote!.votes[actorId ?? "local"] = a.gameId;
      // Alle (außer Bots) haben gewählt: gleich auswerten
      const who = voters(s);
      if (who.length && who.every((id) => id in s.vote!.votes)) decideVote(s, voteWinner(s)!);
      return s;
    }
    case "endVote": {
      const v = prev.vote;
      // Schon entschieden (z. B. hat ein anderes Handy nach Ablauf schon ausgewertet): nichts zu tun
      if ((!v || v.winner) && !a.cancel && a.gameId === undefined) return prev;
      if (!v || v.winner) throw new GameError("Gerade wird nicht abgestimmt.");
      const s = structuredClone(prev);
      if (a.cancel) { hostOnly(); delete s.vote; return s; }
      if (a.gameId !== undefined) {
        hostOnly();
        if (!v.games.includes(a.gameId)) throw new GameError("Das steht nicht zur Wahl.");
        decideVote(s, a.gameId);
        return s;
      }
      // Auswerten: der Host jederzeit, alle anderen, sobald die Zeit um ist (niemand bleibt hängen)
      if (!isHost && Date.now() < v.endsAt - 500) throw new GameError("Die Abstimmung läuft noch.");
      decideVote(s, voteWinner(s)!);
      return s;
    }
    case "selectGame": {
      hostOnly();
      if (prev.phase !== "lobby") throw new GameError("Erst zurück in die Lobby, dann ein anderes Spiel wählen.");
      if (!isGameId(a.gameId)) throw new GameError("Dieses Spiel gibt es nicht.");
      if (a.gameId === prev.gameId && !prev.vote) return prev;
      const s: RoomState = { ...structuredClone(prev), gameId: a.gameId, options: a.gameId === prev.gameId ? prev.options : defaultOptions(getGame(a.gameId).settings) };
      delete s.vote;
      return s;
    }
    case "setOption": {
      hostOnly();
      const def = logic.settings.find((d) => d.key === a.key);
      if (!def) throw new GameError("Diese Einstellung gibt es nicht.");
      if (prev.phase === "playing" && !def.inGame) throw new GameError("Das lässt sich nur in der Lobby ändern.");
      const s = structuredClone(prev);
      s.options[def.key] = sanitizeOption(def, a.value);
      if (s.phase === "playing" && s.game && logic.onOptionsChanged) {
        s.game = logic.onOptionsChanged(s.game, prev.options, context(s, actorId));
      }
      return s;
    }
    case "setPreset": {
      hostOnly();
      if (prev.phase === "playing") throw new GameError("Das lässt sich nur in der Lobby ändern.");
      const p = presetsOf(logic).find((x) => x.id === a.id);
      if (!p) throw new GameError("Diese Regeln gibt es nicht.");
      const s = structuredClone(prev);
      for (const [k, v] of Object.entries(presetValues(logic, p))) s.options[k] = sanitizeOption(logic.settings.find((d) => d.key === k)!, v);
      return s;
    }
    case "setEntry": {
      hostOnly();
      return { ...structuredClone(prev), entry: a.mode === "all" || a.mode === "host" ? a.mode : "turn" };
    }
    case "setHints": {
      hostOnly();
      return { ...structuredClone(prev), noHints: a.on !== true };
    }
    case "setMeet": {
      hostOnly();
      return { ...structuredClone(prev), meet: a.on === true };
    }
    case "setAccess": {
      hostOnly();
      return { ...structuredClone(prev), access: sanitizeAccess(a.access, prev.access) };
    }
    case "setHostTools": {
      hostOnly();
      return { ...structuredClone(prev), hostTools: a.on === true };
    }
    case "removePlayer": {
      hostOnly();
      // Von der Wartebank: einfach weg, die Partie merkt davon nichts
      if (prev.bench?.some((p) => p.id === a.id)) {
        const s = structuredClone(prev);
        s.bench = s.bench!.filter((p) => p.id !== a.id);
        if (!s.bench.length) delete s.bench;
        if (s.bots) s.bots = s.bots.filter((id) => id !== a.id);
        if (s.botLevels) delete s.botLevels[a.id];
        if (s.photos) delete s.photos[a.id];
        if (s.avatars) delete s.avatars[a.id];
        if (s.members) delete s.members[a.id];
        return s;
      }
      const i = prev.players.findIndex((p) => p.id === a.id);
      if (i < 0) throw new GameError("Spieler nicht gefunden.");
      const s = structuredClone(prev);
      if (s.phase === "playing" && s.game && logic.onPlayerRemoved) {
        s.game = logic.onPlayerRemoved(s.game, a.id, context(s, actorId));
      }
      s.players.splice(i, 1);
      if (s.bots) s.bots = s.bots.filter((id) => id !== a.id);
      if (s.botLevels) delete s.botLevels[a.id];
      if (s.photos) delete s.photos[a.id];
      if (s.avatars) delete s.avatars[a.id];
      if (s.members) delete s.members[a.id];
      if (s.hostId === a.id) s.hostId = s.players[0]?.id ?? null;
      // Mindestzahl gilt nur beim Start – während der Partie regelt das Spiel Abgänge selbst (onPlayerRemoved)
      if (s.phase === "playing" && !s.players.length) { s.phase = "lobby"; s.game = null; }
      // Ältere Spielstände kennen den Spieler noch – nicht mehr zurücknehmen
      s.undo = [];
      return s;
    }
    case "orderPlayers": {
      hostOnly();
      if (prev.phase !== "lobby") throw new GameError("Die Reihenfolge lässt sich nur in der Lobby ändern.");
      const ids = Array.isArray(a.ids) ? a.ids : [];
      const byId = new Map(prev.players.map((p) => [p.id, p]));
      if (ids.length !== prev.players.length || new Set(ids).size !== ids.length || !ids.every((id) => byId.has(id))) throw new GameError("Das geht so nicht.");
      return { ...structuredClone(prev), players: ids.map((id) => structuredClone(byId.get(id)!)) };
    }
    case "setAvatar": {
      if (actorId !== a.id) hostOnly();
      const av = sanitizeAvatar(a.avatar);
      if (!av || ![...prev.players, ...(prev.bench ?? [])].some((p) => p.id === a.id)) throw new GameError("Das geht so nicht.");
      return { ...structuredClone(prev), avatars: { ...prev.avatars, [a.id]: av } };
    }
    case "movePlayer": {
      hostOnly();
      const i = prev.players.findIndex((p) => p.id === a.id);
      const j = i + (a.dir === -1 ? -1 : 1);
      if (i < 0 || j < 0 || j >= prev.players.length) return prev;
      const s = structuredClone(prev);
      [s.players[i], s.players[j]] = [s.players[j], s.players[i]];
      return s;
    }
    case "skip": {
      hostOnly();
      if (prev.phase !== "playing" || !prev.game) throw new GameError("Es läuft keine Partie.");
      if (!logic.skipTurn || !logic.skipLabel?.(prev.game, context(prev, actorId))) throw new GameError("Gerade gibt es nichts zu überspringen.");
      return recordEvening(prev, withUndo(prev, logic.skipTurn(prev.game, context(prev, actorId))));
    }
    case "resetEvening": {
      hostOnly();
      const s = structuredClone(prev);
      delete s.evening;
      return s;
    }
    case "undo": {
      hostOnly();
      if (prev.phase !== "playing" || !prev.undo?.length) throw new GameError("Es gibt keinen Zug zum Zurücknehmen.");
      const undo = prev.undo.slice(0, -1);
      const game = prev.undo[prev.undo.length - 1];
      let evening = prev.evening;
      // Das Ende der Partie wird zurückgenommen: dann zählt sie auch nicht mehr für den Spielabend
      // (nur wenn diese Partie dort steht – eine ungeplante Partie während eines Plans stand nie drin)
      const last = evening?.log[evening.log.length - 1];
      const counted = !!last && last.gameId === prev.gameId && (last.round === undefined || last.round === prev.round);
      if (evening && last && counted && prev.game && logic.isOver(prev.game) && !logic.isOver(game)) {
        evening = { ...evening, log: evening.log.slice(0, -1), wins: { ...evening.wins } };
        for (const id of last.winners) evening.wins[id] = Math.max(0, (evening.wins[id] ?? 0) - 1);
        // Alte Einträge ohne Merker: wie bisher, sonst nur wenn die Partie den Plan weitergebracht hat
        if (evening.plan && evening.plan.played > 0 && (last.plan || last.round === undefined)) evening.plan = { ...evening.plan, played: evening.plan.played - 1 };
      }
      return { ...prev, game, undo, undone: (prev.undone ?? 0) + 1, evening };
    }
    case "game": {
      const action = a.action;
      if (!action || typeof action !== "object" || typeof action.type !== "string") throw new GameError("Ungültige Aktion.");
      if (prev.phase !== "playing" || !prev.game) throw new GameError("Die Partie hat noch nicht begonnen.");
      const kind = logic.actionKind(action);
      if (!kind) throw new GameError("Unbekannte Aktion.");
      if (kind === "host") hostOnly();
      if (kind === "turn") {
        if (logic.isOver(prev.game)) throw new GameError("Die Partie ist schon entschieden.");
        if (!canPlayTurn(prev, actorId)) {
          const cur = prev.players.find((p) => p.id === currentPlayerId(prev));
          throw new GameError(prev.entry === "host" ? "Eintragen darf in diesem Raum nur der Host." : cur ? `${cur.name} ist am Zug.` : "Du bist nicht am Zug.");
        }
      }
      if (kind === "player" && actorId !== null && !prev.players.some((p) => p.id === actorId)) {
        throw new GameError("Du spielst in diesem Raum nicht mit.");
      }
      return recordEvening(prev, withUndo(prev, logic.apply(prev.game, action, context(prev, actorId))));
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/** Was eine Person vom Raum sehen darf (versteckte Informationen entfernt das Spiel selbst). */
export function viewRoom(full: RoomState, viewerId: string | null): RoomState {
  // Frühere Spielstände enthalten verdeckte Karten – Spieler erfahren nur, wie viele es gibt
  const { undo, content: _content, ...rest } = full;
  const room: RoomState = { ...rest, undoCount: undo?.length ?? 0 };
  const logic = roomGame(room);
  if (!room.game || !logic.view) return room;
  return { ...room, game: logic.view(room.game, viewerId) };
}

/** Beschriftung für „Überspringen“, oder null, wenn gerade nichts hängt */
export function skipLabel(room: RoomState): string | null {
  const logic = roomGame(room);
  if (room.phase !== "playing" || !room.game || !logic.skipLabel) return null;
  return logic.skipLabel(room.game, context(room, room.hostId));
}
