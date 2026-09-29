/**
 * Raum-Logik der Plattform: Spieler, Host, Spielauswahl, Einstellungen und Phasen.
 * Wird vom Durable Object (online) und vom Browser (lokal) gleichermaßen genutzt.
 * Spielzüge reicht der Raum nach der Rechteprüfung an das jeweilige Spiel weiter.
 */
import { DEFAULT_GAME, getGame, isGameId } from "../games";
import { GameError, type EntryMode, type GameContext, type GameLogic, type OptionValue, type Options, type Player, type SettingDef } from "./types";

export const MAX_PLAYERS = 12;
export const MAX_NAME = 20;

export interface RoomState {
  v: 1;
  gameId: string;
  players: Player[];
  hostId: string | null;
  entry: EntryMode;
  /** Einstellungen des gewählten Spiels */
  options: Options;
  phase: "lobby" | "playing";
  /** Spielstand des gewählten Spiels, null in der Lobby */
  game: unknown;
  /** zählt gestartete Partien */
  round: number;
}

export type RoomAction =
  | { type: "start" }
  | { type: "restart" }
  | { type: "toLobby" }
  | { type: "selectGame"; gameId: string }
  | { type: "setOption"; key: string; value: OptionValue }
  | { type: "setEntry"; mode: EntryMode }
  | { type: "removePlayer"; id: string }
  | { type: "movePlayer"; id: string; dir: -1 | 1 }
  | { type: "game"; action: { type: string } & Record<string, unknown> };

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
    v: 1, gameId: id, players: [], hostId: null, entry: "turn",
    options: defaultOptions(getGame(id).settings), phase: "lobby", game: null, round: 0,
  };
}

export function roomGame(room: RoomState): GameLogic<unknown, { type: string }> {
  return getGame(room.gameId);
}

function context(room: RoomState, actorId: string | null): GameContext {
  return { players: room.players, hostId: room.hostId, actorId, options: room.options };
}

export function addPlayer(prev: RoomState, p: { id: string; name: string }): RoomState {
  const name = cleanName(p.name);
  const logic = roomGame(prev);
  if (!name) throw new GameError("Bitte gib einen Namen ein.");
  if (prev.players.length >= MAX_PLAYERS) throw new GameError(`Maximal ${MAX_PLAYERS} Spieler.`);
  if (prev.players.some((x) => x.name.toLowerCase() === name.toLowerCase()))
    throw new GameError(`„${name}“ spielt schon mit. Nimm einen anderen Namen.`);
  if (prev.phase === "playing" && !logic.joinMidGame)
    throw new GameError("Die Partie läuft schon. Tritt bei, wenn der Host zurück in die Lobby geht.");
  if (prev.phase === "playing" && prev.players.length >= logic.info.maxPlayers)
    throw new GameError(`${logic.info.name} geht mit höchstens ${logic.info.maxPlayers} Spielern.`);
  const s = structuredClone(prev);
  s.players.push({ id: p.id, name });
  if (!s.hostId) s.hostId = p.id;
  return s;
}

/** Wer ist gerade am Zug? */
export function currentPlayerId(room: RoomState): string | null {
  return room.phase === "playing" && room.game ? roomGame(room).currentPlayerId(room.game) : null;
}

/** Darf diese Person gerade für den Spieler am Zug handeln? (actorId null = lokales Gerät) */
export function canPlayTurn(room: RoomState, actorId: string | null): boolean {
  if (actorId === null || actorId === room.hostId) return true;
  if (room.entry === "host") return false;
  if (room.entry === "all") return room.players.some((p) => p.id === actorId);
  return currentPlayerId(room) === actorId;
}

function assertPlayerCount(room: RoomState, logic: GameLogic<unknown, { type: string }>) {
  const n = room.players.length;
  const { minPlayers, maxPlayers, name } = logic.info;
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
      assertPlayerCount(prev, logic);
      const s = structuredClone(prev);
      s.game = logic.setup(context(s, actorId));
      s.phase = "playing";
      s.round++;
      return s;
    }
    case "toLobby": {
      hostOnly();
      return { ...structuredClone(prev), phase: "lobby", game: null };
    }
    case "selectGame": {
      hostOnly();
      if (prev.phase !== "lobby") throw new GameError("Erst zurück in die Lobby, dann ein anderes Spiel wählen.");
      if (!isGameId(a.gameId)) throw new GameError("Dieses Spiel gibt es nicht.");
      if (a.gameId === prev.gameId) return prev;
      return { ...structuredClone(prev), gameId: a.gameId, options: defaultOptions(getGame(a.gameId).settings) };
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
    case "setEntry": {
      hostOnly();
      return { ...structuredClone(prev), entry: a.mode === "all" || a.mode === "host" ? a.mode : "turn" };
    }
    case "removePlayer": {
      hostOnly();
      const i = prev.players.findIndex((p) => p.id === a.id);
      if (i < 0) throw new GameError("Spieler nicht gefunden.");
      const s = structuredClone(prev);
      if (s.phase === "playing" && s.game && logic.onPlayerRemoved) {
        s.game = logic.onPlayerRemoved(s.game, a.id, context(s, actorId));
      }
      s.players.splice(i, 1);
      if (s.hostId === a.id) s.hostId = s.players[0]?.id ?? null;
      if (s.phase === "playing" && s.players.length < logic.info.minPlayers) { s.phase = "lobby"; s.game = null; }
      return s;
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
      return { ...prev, game: logic.apply(prev.game, action, context(prev, actorId)) };
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/** Was eine Person vom Raum sehen darf (versteckte Informationen entfernt das Spiel selbst). */
export function viewRoom(room: RoomState, viewerId: string | null): RoomState {
  const logic = roomGame(room);
  if (!room.game || !logic.view) return room;
  return { ...room, game: logic.view(room.game, viewerId) };
}
