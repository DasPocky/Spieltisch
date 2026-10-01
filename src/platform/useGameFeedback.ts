import { useEffect, useRef } from "react";
import { currentPlayerId, roomGame, type RoomState } from "@shared/platform/room";
import { prefs } from "@/lib/prefs";
import { vibrate } from "@/lib/utils";
import { playSound, userGesture, type Sound } from "./sound";
import { speak } from "./speech";

/** Geheime Rollen: Töne/Ansagen könnten verraten, wer nachts das Handy hält – nur der Sieg-Ton */
const QUIET_GAMES = new Set(["werwolf", "einenacht"]);

const ACTION_SOUND: Record<string, Sound> = {
  roll: "dice",
  draw: "draw", fish: "draw",
  play: "place", discard: "place", discardDrawn: "place", lay: "place", hit: "place", flip: "place", flipStart: "place",
  swap: "place", ask: "place", place: "place", pick: "place", quartet: "place",
};

/**
 * Rückmeldung während der Partie (pro Gerät einstellbar): Ton + kurzes Vibrieren, wenn man dran ist,
 * optional „X ist dran“ vorlesen, Sieg-Ton am Ende. Gibt einen Wrapper für `act` zurück, der Zug-Töne spielt.
 */
export function useGameFeedback(room: RoomState, me: string | null) {
  const quiet = QUIET_GAMES.has(room.gameId);
  const playing = room.phase === "playing" && room.game !== null;
  const cur = playing ? currentPlayerId(room) : null;
  const over = playing && roomGame(room).isOver(room.game);

  // Wer dran ist – erster Stand (z. B. nach Neuladen) bleibt still
  const lastCur = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = lastCur.current;
    lastCur.current = cur;
    if (prev === undefined || quiet || !cur || cur === prev || over) return;
    if (me !== null && cur !== me) return;
    playSound("turn");
    vibrate(40);
    if (prefs().announce) {
      const name = room.players.find((p) => p.id === cur)?.name;
      void speak(me !== null ? "Du bist dran." : name ? `${name} ist dran.` : "", { force: true });
    }
  }, [cur, me, quiet, over, room.players]);

  // Partie entschieden
  const lastOver = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const prev = lastOver.current;
    lastOver.current = over;
    if (prev === false && over) playSound("win");
  }, [over]);

  return <A extends { type: string }>(act: (action: A) => void) => (action: A) => {
    // nur eigene Eingaben, keine Timer oder automatischen Züge
    const s = ACTION_SOUND[action.type];
    if (s && !quiet && userGesture()) playSound(s);
    act(action);
  };
}
