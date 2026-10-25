import { ROWS, type AkState } from "@shared/games/ankreuzspiel/logic";

export interface Tint { face: string; pip: string }
/** Die weißen Würfel: Papierweiß mit dunklen Augen (auch in dunklen Looks) */
export const WHITE: Tint = { face: "#fbf8f1", pip: "#1f2a44" };
export const ROW_TINTS: Tint[] = ROWS.map((r) => ({ face: r.color, pip: r.ink }));

/** Würfel zum Zeigen: weiße zuerst, dann die farbigen, deren Reihe noch offen ist (`row` je Würfel, −1 = weiß) */
export function diceOf(s: Pick<AkState, "dice">, dice = s.dice): { values: number[]; tints: Tint[]; rows: number[] } {
  const values: number[] = [], tints: Tint[] = [], rows: number[] = [];
  dice.forEach((v, i) => {
    if (!v) return;
    values.push(v);
    tints.push(i < 2 ? WHITE : ROW_TINTS[i - 2]);
    rows.push(i < 2 ? -1 : i - 2);
  });
  return { values, tints, rows };
}
