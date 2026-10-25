import type { RoomState } from "@shared/platform/room";
import { allCrosses, pendingWhite, ROWS, totalOf, whiteSum, type AkState } from "@shared/games/ankreuzspiel/logic";
import type { TableModel } from "../../platform/table/model";
import { diceOf } from "./dice";

/** Ankreuzspiel am Tisch: weiße und farbige Würfel in der Mitte, an den Plätzen Punkte, Kreuze und Fehlwürfe */
export function ankreuzspielTable(room: RoomState): TableModel | null {
  const s = room.game as AkState;
  if (s.phase === "over") return null;
  const name = (id: string | null | undefined) => room.players.find((p) => p.id === id)?.name ?? "";
  const shown = diceOf(s);
  const open = pendingWhite(s);
  const note = s.phase === "roll"
    ? `${name(s.curId)} würfelt${s.last?.miss ? ` · ${name(s.last.by)}: Fehlwurf` : ""}`
    : s.phase === "white"
      ? `Weiß ${whiteSum(s)} für alle${open.length ? ` · ${open.length === 1 ? `${name(open[0])} überlegt` : `${open.length} überlegen`}` : ""}`
      : `${name(s.curId)} wählt eine Farbe`;
  const closed = ROWS.filter((_, r) => s.closed[r]).map((r) => r.name);
  return {
    deck: "cards", pile: 0, discard: [], counts: {}, turn: s.curId, n: s.n,
    log: [...(closed.length ? [`Abgeschlossen: ${closed.join(", ")}`] : []), ...s.log.slice(-5)],
    scores: Object.fromEntries(Object.entries(s.sheets).map(([id, sh]) => [id, totalOf(sh)])),
    notes: Object.fromEntries(room.players.map((p) => {
      const sh = s.sheets[p.id];
      if (!sh) return [p.id, "zuschauen"];
      return [p.id, `${totalOf(sh)} Punkte · ${allCrosses(sh)} Kreuze · ${sh.misses} ${sh.misses === 1 ? "Fehlwurf" : "Fehlwürfe"}`];
    })),
    dice: { values: shown.values, held: shown.values.map(() => false), tints: shown.tints, n: s.n, note, still: s.phase !== "white" },
  };
}
