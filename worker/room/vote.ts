/** Abstimmung im Raum: der Raum weckt sich zum Ablauf selbst und wertet aus, auch wenn kein Handy mehr verbunden ist */
import { applyRoomAction, type RoomState } from "../../shared/platform/room";

/** Zeitpunkt, zu dem eine offene Abstimmung ausgewertet wird (null = keine offen) */
export const voteDueAt = (s: RoomState): number | null => (s.vote && !s.vote.winner ? s.vote.endsAt : null);

/** Abgelaufene Abstimmung auswerten wie „endVote“ nach Ablauf – null, wenn (noch) nichts zu tun ist */
export function expireVote(s: RoomState, now = Date.now()): RoomState | null {
  const at = voteDueAt(s);
  if (at === null || now < at - 500) return null;
  return applyRoomAction(s, { type: "endVote" }, s.hostId ?? null);
}
