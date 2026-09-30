import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addPlayer, applyRoomAction, createRoom, roomGame, type RoomAction, type RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import { GameError } from "@shared/platform/types";
import { RoomScreen } from "@/platform/RoomScreen";
import { navigate } from "@/hooks/useRoute";
import { localKey, readJSON, writeJSON } from "@/lib/storage";
import { myName, reportLocal } from "@/lib/profile";

const isOver = (r: RoomState) => r.phase === "playing" && !!r.game && roomGame(r).isOver(r.game);

/**
 * Lokale Partie zu Ende: Das Ergebnis des Spielers, der so heißt wie das eigene Profil, kommt in die Statistik.
 * Nur beim Übergang zu „vorbei“ – nicht beim Neuladen einer schon beendeten Partie.
 */
function useLocalStats(room: RoomState) {
  const was = useRef(isOver(room));
  useEffect(() => {
    const over = isOver(room);
    if (over && !was.current) {
      const logic = roomGame(room);
      const name = myName().trim().toLowerCase();
      const me = name ? room.players.find((p) => p.name.trim().toLowerCase() === name) : undefined;
      const results = logic.results?.(room.game, { players: room.players, hostId: room.hostId, actorId: null, options: room.options, now: Date.now() });
      const mine = me && results?.find((r) => r.id === me.id);
      if (mine) void reportLocal({ gameId: room.gameId, won: mine.won, score: mine.score, players: results!.length });
    }
    was.current = over;
  }, [room]);
}

/** Ist ein gespeicherter Spielstand noch mit dem aktuellen Code verträglich? */
function load(gameId: string): RoomState {
  const saved = readJSON<RoomState & { gameVersion?: number }>(localKey(gameId));
  if (saved?.v === 1 && saved.gameId === gameId && saved.gameVersion === getGame(gameId).version) return saved;
  return createRoom(gameId);
}

/** Offline-Modus: ein Gerät, alle Spieler. Der Spielstand bleibt im Browser, getrennt pro Spiel. */
export function LocalGame({ gameId }: { gameId: string }) {
  const [room, setRoom] = useState<RoomState>(() => load(gameId));

  useEffect(() => writeJSON(localKey(room.gameId), { ...room, gameVersion: getGame(room.gameId).version }), [room]);
  useLocalStats(room);

  const run = useCallback((fn: (s: RoomState) => RoomState) => {
    setRoom((s) => {
      try { return fn(s); } catch (e) {
        const msg = e instanceof GameError ? e.message : "Das ging gerade nicht.";
        if (!(e instanceof GameError)) console.error(e);
        queueMicrotask(() => toast(msg));
        return s;
      }
    });
  }, []);

  // Spiel in der Lobby gewechselt: Spielstand liegt schon unter dem neuen Spiel, Adresse nachziehen
  useEffect(() => {
    if (room.gameId !== gameId) navigate(`/spiel/${room.gameId}/lokal`, true);
  }, [room.gameId, gameId]);

  return (
    <RoomScreen
      room={room}
      me={null}
      online={null}
      dispatch={(a: RoomAction) => run((s) => applyRoomAction(s, a, null))}
      onAddLocal={(name) => run((s) => addPlayer(s, { id: crypto.randomUUID(), name }))}
      onLeave={() => navigate(`/spiel/${gameId}`)}
    />
  );
}
