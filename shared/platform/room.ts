/**
 * Raum-Logik der Plattform: Spieler, Host, Spielauswahl, Einstellungen und Phasen.
 * Wird vom Durable Object (online) und vom Browser (lokal) gleichermaßen genutzt.
 * Spielzüge reicht der Raum nach der Rechteprüfung an das jeweilige Spiel weiter.
 */
import { DEFAULT_GAME, getGame, isGameId } from "../games";
import type { Avatar } from "./group";
import { GameError, type EntryMode, type GameContext, type GameLogic, type OptionValue, type Options, type Player, type SettingDef } from "./types";

export const MAX_PLAYERS = 20;
export const MAX_NAME = 20;

export interface RoomState {
  v: 1;
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
  /** zählt gestartete Partien */
  round: number;
  /** Spielstände vor den letzten Zügen – zum Zurücknehmen. Bleibt auf Server bzw. Gerät, geht nie an Mitspieler. */
  undo?: unknown[];
  /** Wie viele Züge zurückgenommen werden können (nur in der Sicht für Spieler) */
  undoCount?: number;
  /** zählt Rücknahmen – damit alle kurz „Zug zurückgenommen“ sehen */
  undone?: number;
  /** Avatar je Spieler (online setzt ihn der Server beim Beitritt, lokal das Gerät) */
  avatars?: Record<string, Avatar>;
  /** Spieler → Mitglieds-ID in seiner Gruppe (öffentlich innerhalb der Gruppe, keine Profil-ID) */
  members?: Record<string, string>;
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
  | { type: "setEntry"; mode: EntryMode }
  | { type: "setHostTools"; on: boolean }
  | { type: "setHints"; on: boolean }
  | { type: "removePlayer"; id: string }
  | { type: "movePlayer"; id: string; dir: -1 | 1 }
  /** Host: das auflösen, worauf die Partie gerade wartet */
  | { type: "skip" }
  /** Host (lokal: jeder): den letzten Zug zurücknehmen */
  | { type: "undo" }
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

/** Erlaubte Spielerzahl für das gewählte Spiel mit den aktuellen Einstellungen */
export function playerLimits(room: RoomState): { min: number; max: number; note?: string } {
  const logic = roomGame(room);
  const l = logic.playerLimits?.(room.options) ?? { min: logic.info.minPlayers, max: logic.info.maxPlayers };
  return { ...l, max: Math.min(MAX_PLAYERS, l.max) };
}

function context(room: RoomState, actorId: string | null): GameContext {
  return { players: room.players, hostId: room.hostId, actorId, options: room.options, now: Date.now() };
}

export function addPlayer(prev: RoomState, p: { id: string; name: string }): RoomState {
  const name = cleanName(p.name);
  const logic = roomGame(prev);
  if (!name) throw new GameError("Bitte gib einen Namen ein.");
  if (prev.players.length >= MAX_PLAYERS) throw new GameError(`Maximal ${MAX_PLAYERS} Spieler.`);
  // Beim Beitritt zählt das absolute Maximum des Spiels – das genaue (je nach Einstellung) prüft der Start
  const max = Math.min(MAX_PLAYERS, logic.info.maxPlayers);
  if (prev.players.length >= max) throw new GameError(`${logic.info.name} geht mit höchstens ${max} Spielern.`);
  if (prev.players.some((x) => x.name.toLowerCase() === name.toLowerCase()))
    throw new GameError(`„${name}“ spielt schon mit. Nimm einen anderen Namen.`);
  if (prev.phase === "playing" && !logic.joinMidGame)
    throw new GameError("Die Partie läuft schon. Tritt bei, wenn der Host zurück in die Lobby geht.");
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
      assertPlayerCount(prev, logic);
      const s = structuredClone(prev);
      s.game = logic.setup(context(s, actorId));
      s.phase = "playing";
      s.round++;
      s.undo = [];
      return s;
    }
    case "toLobby": {
      hostOnly();
      return { ...structuredClone(prev), phase: "lobby", game: null, undo: [] };
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
    case "setHints": {
      hostOnly();
      return { ...structuredClone(prev), noHints: a.on !== true };
    }
    case "setHostTools": {
      hostOnly();
      return { ...structuredClone(prev), hostTools: a.on === true };
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
      if (s.avatars) delete s.avatars[a.id];
      if (s.members) delete s.members[a.id];
      if (s.hostId === a.id) s.hostId = s.players[0]?.id ?? null;
      // Mindestzahl gilt nur beim Start – während der Partie regelt das Spiel Abgänge selbst (onPlayerRemoved)
      if (s.phase === "playing" && !s.players.length) { s.phase = "lobby"; s.game = null; }
      // Ältere Spielstände kennen den Spieler noch – nicht mehr zurücknehmen
      s.undo = [];
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
    case "skip": {
      hostOnly();
      if (prev.phase !== "playing" || !prev.game) throw new GameError("Es läuft keine Partie.");
      if (!logic.skipTurn || !logic.skipLabel?.(prev.game, context(prev, actorId))) throw new GameError("Gerade gibt es nichts zu überspringen.");
      return withUndo(prev, logic.skipTurn(prev.game, context(prev, actorId)));
    }
    case "undo": {
      hostOnly();
      if (prev.phase !== "playing" || !prev.undo?.length) throw new GameError("Es gibt keinen Zug zum Zurücknehmen.");
      const undo = prev.undo.slice(0, -1);
      return { ...prev, game: prev.undo[prev.undo.length - 1], undo, undone: (prev.undone ?? 0) + 1 };
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
      return withUndo(prev, logic.apply(prev.game, action, context(prev, actorId)));
    }
    default:
      throw new GameError("Unbekannte Aktion.");
  }
}

/** Was eine Person vom Raum sehen darf (versteckte Informationen entfernt das Spiel selbst). */
export function viewRoom(full: RoomState, viewerId: string | null): RoomState {
  // Frühere Spielstände enthalten verdeckte Karten – Spieler erfahren nur, wie viele es gibt
  const { undo, ...rest } = full;
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
