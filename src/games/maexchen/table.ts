import type { RoomState } from "@shared/platform/room";
import { labelOf, lastOf, type MaexState } from "@shared/games/maexchen/logic";
import type { TableModel } from "../../platform/table/model";

/** Mäxchen am Tisch: Becher in der Mitte, die letzte Ansage groß darunter; beim Aufdecken hebt sich der Becher. Leben an den Plätzen */
export function maexchenTable(room: RoomState): TableModel | null {
  const s = room.game as MaexState;
  // Echte Würfel am Tisch: die App kennt den Wurf nicht – dann wie ein Handy
  if (s.table || s.over) return null;
  const name = (id: string | null | undefined) => room.players.find((p) => p.id === id)?.name ?? "";
  const ev = s.events.at(-1);
  const shown = ev?.t === "reveal" && s.reveal?.dice ? s.reveal : null;
  const last = lastOf(s);
  const note = shown && ev?.t === "reveal"
    ? `${labelOf(shown.value)} ${shown.truth ? "stimmt" : "war gelogen"} – ${ev.loserName} ${shown.out ? "ist raus" : `verliert ${shown.cost === 1 ? "ein Leben" : `${shown.cost} Leben`}`}`
    : last ? `${name(last.by)} sagt: ${labelOf(last.value)}${last.blind ? " (blind)" : ""}` : `${name(s.curId)} würfelt`;
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.curId, n: s.n,
    log: s.events.slice(-6).map((e) => (e.t === "ann" ? `${e.name}: ${labelOf(e.value)}` : e.t === "reveal" ? `${e.byName} deckt auf: ${e.loserName} verliert` : `${e.name} übersprungen`)),
    notes: Object.fromEntries(room.players.map((p) => [p.id, (s.lives[p.id] ?? 0) > 0 ? "♥".repeat(s.lives[p.id]) : "raus"])),
    dice: { values: shown?.dice ?? [], held: [], n: s.n, note, cup: !shown, still: !!shown },
  };
}
