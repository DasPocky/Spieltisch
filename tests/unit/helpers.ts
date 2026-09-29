import { vi } from "vitest";
import { addPlayer, applyRoomAction, createRoom, type RoomAction, type RoomState } from "@shared/platform/room";

/** Raum mit Spielern anlegen; der erste ist Host. */
export function roomWith(names: string[], gameId = "tutto"): RoomState {
  let r = createRoom(gameId);
  names.forEach((name, i) => { r = addPlayer(r, { id: `p${i + 1}`, name }); });
  return r;
}

export const act = (r: RoomState, a: RoomAction, actor: string | null = null) => applyRoomAction(r, a, actor);
export const game = (r: RoomState, action: { type: string } & Record<string, unknown>, actor: string | null = null) =>
  applyRoomAction(r, { type: "game", action }, actor);

/** Legt fest, welche Augenzahlen die nächsten Würfe liefern (randomInt(6)+1). */
export function fixDice(faces: number[]) {
  const queue = faces.map((f) => f - 1);
  return vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(arr: T): T => {
    const a = arr as unknown as Uint32Array;
    for (let i = 0; i < a.length; i++) {
      if (!queue.length) throw new Error("Keine Würfel mehr vorbereitet");
      a[i] = queue.shift()!;
    }
    return arr;
  });
}
