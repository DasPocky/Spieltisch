import { handOf, LIDS, type ShState } from "@shared/games/schocken/logic";

const HALF = ["", "erste", "zweite"];
const THROWS = ["", "einem Wurf", "zwei Würfen", "drei Würfen"];
const lids = (n: number) => (n === 1 ? "einen Deckel" : `${n} Deckel`);

/** Was ein Spielleiter sagt: wer beginnt, was gewürfelt wurde, wer wie viele Deckel bekommt, wer die Hälfte verliert. Lokal das Gerät, online das Handy des Hosts. */
export function narration(before: ShState | null, s: ShState, name: (id: string | null) => string): string[] {
  const parts: string[] = [];
  // Würfe, die gerade fertig geworden sind
  const same = !!before && before.half === s.half && before.round === s.round;
  const done = s.phase === "roll" ? (same ? s.hands : {}) : s.last && s.last !== before?.last ? s.last.hands : {};
  const had = before?.phase === "roll" ? before.hands : {};
  for (const [id, h] of Object.entries(done)) {
    if (had[id] || !before) continue;
    parts.push(`${name(id)}: ${handOf(h.dice).label} mit ${THROWS[h.throws] ?? `${h.throws} Würfen`}.`);
    if (id === before.order[0] && h.throws < 3 && s.phase === "roll") parts.push(`Höchstens ${h.throws === 1 ? "ein Wurf" : "zwei Würfe"} für alle.`);
  }
  if (s.last && s.last !== before?.last && (s.phase === "roundEnd" || s.phase === "over")) {
    const r = s.last;
    if (r.aus) parts.push(`Schock aus von ${name(r.winner)}! ${name(r.loser)} bekommt alle Deckel.`);
    else parts.push(`${name(r.winner)} hat ${r.label}. ${name(r.loser)} bekommt ${lids(r.moved)}${r.from === "winner" ? ` von ${name(r.winner)}` : ""}.`);
    if (r.halfLost) parts.push(r.half === 3 ? `${name(r.halfLost)} verliert das Finale.` : `${name(r.halfLost)} hat alle ${LIDS} Deckel und verliert die ${HALF[r.half]} Hälfte.`);
    if (s.phase === "over") parts.push(`${name(s.loser)} hat die Partie verloren.`);
  }
  const fresh = s.phase === "roll" && (!before || before.round !== s.round || before.half !== s.half);
  if (fresh) {
    if (!before || before.half !== s.half) parts.push(s.half === 3 ? `Finale: ${s.members.map(name).join(" gegen ")}.` : `${HALF[s.half] === "erste" ? "Erste" : "Zweite"} Hälfte. ${LIDS} Deckel liegen in der Mitte.`);
    else if (before.pot > 0 && s.pot === 0) parts.push("Die Mitte ist leer. Wer keine Deckel hat, ist raus aus der Hälfte.");
    parts.push(s.table ? `${name(s.curId)} beginnt. Würfelt am Tisch.` : `${name(s.curId)} beginnt.`);
  }
  return parts;
}
