import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { addPlayer, applyRoomAction, createRoom, type RoomAction, type RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import { GameError } from "@shared/platform/types";
import { RoomScreen } from "@/platform/RoomScreen";
import { navigate } from "@/hooks/useRoute";
import { localKey, readJSON, writeJSON } from "@/lib/storage";

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
