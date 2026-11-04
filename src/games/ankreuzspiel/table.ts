import type { RoomState } from "@shared/platform/room";
import { allCrosses, CELLS, pendingWhite, ROWS, totalOf, whiteSum, type AkState } from "@shared/games/ankreuzspiel/logic";
import type { TableModel } from "../../platform/table/model";
import { diceOf } from "./dice";

/** Bis zu so vielen Spielern passt das Mini-Blatt an jeden Platz – darüber bleibt nur der Text */
export const SHEET_MAX = 6;

/** Ankreuzspiel am Tisch: weiße und farbige Würfel in der Mitte, an den Plätzen Punkte, Kreuze und Fehlwürfe – bis 6 Spieler mit Mini-Blatt */
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
      const pts = totalOf(sh), x = allCrosses(sh);
      return [p.id, `${pts} ${pts === 1 ? "Punkt" : "Punkte"} · ${x} ${x === 1 ? "Kreuz" : "Kreuze"} · ${sh.misses} ${sh.misses === 1 ? "Fehlwurf" : "Fehlwürfe"}`];
    })),
    sheets: Object.keys(s.sheets).length <= SHEET_MAX ? Object.fromEntries(Object.entries(s.sheets).map(([id, sh]) => [id, {
      rows: ROWS.map((r, i) => ({ color: r.color, marks: Array.from({ length: CELLS }, (_, k) => sh.rows[i].includes(k)), lock: sh.locks[i] })),
    }])) : undefined,
    dice: { slots: 2 + ROWS.filter((_, r) => !s.closed[r]).length, values: shown.values, held: shown.values.map(() => false), tints: shown.tints, n: s.n, note, still: s.phase !== "white" },
  };
}
