import type { ZrState } from "@shared/games/zahlenromme/logic";

const steine = (n: number) => (n === 1 ? "einen Stein" : `${n} Steine`);

/**
 * Was ein Spielleiter sagt: Rundenbeginn, wer dran ist, erstes Auslegen mit Punkten, wie viele Steine gelegt werden,
 * Ziehen, Passen und „Zeit um“, wer nur noch wenige Steine hat, Rundensieg mit Punkten und das Ende.
 * Lokal das Gerät, online das Handy des Hosts.
 */
export function narration(before: ZrState | null, s: ZrState, name: (id: string | null) => string): string[] {
  const parts: string[] = [];
  const newRound = s.phase === "play" && (!before || before.round !== s.round);
  if (newRound) {
    if (s.round === 1) parts.push(`Jeder hat vierzehn Steine. Das erste Auslegen braucht mindestens dreißig Punkte aus eigenen Steinen.`);
    else parts.push(`Runde ${s.round}.`);
    parts.push(`${name(s.curId)} beginnt.`);
    return parts;
  }
  const l = s.last;
  if (before && l && s.n !== before.n) {
    const who = name(l.id);
    if (l.kind === "commit") {
      parts.push(l.first !== null ? `${who} legt zum ersten Mal aus – ${l.first} Punkte, ${steine(l.laid)}.` : `${who} legt ${steine(l.laid)}.`);
      if (l.left === 1) parts.push(`${who} hat nur noch einen Stein!`);
      else if (l.left === 2) parts.push(`${who} hat nur noch zwei Steine.`);
    } else if (l.kind === "draw") parts.push(`${who} zieht einen Stein.`);
    else if (l.kind === "pass") parts.push(`${who} passt – der Pool ist leer.`);
    else parts.push(before.poolCount > s.poolCount ? `Zeit um – ${who} zieht einen Stein.` : `Zeit um – ${who} passt.`);
  }
  if (before && before.phase === "play" && s.phase !== "play") {
    const r = s.rounds[s.rounds.length - 1];
    if (r) {
      parts.push(r.blocked ? `Keiner kann mehr. ${name(r.winner)} hat am wenigsten übrig und gewinnt Runde ${r.round}.` : `${name(r.winner)} gewinnt Runde ${r.round}!`);
      if (r.winner) parts.push(`Plus ${r.points[r.winner]} Punkte.`);
    }
    if (s.phase === "over") {
      const ids = Object.keys(s.scores);
      const top = Math.max(...ids.map((id) => s.scores[id]));
      const win = ids.filter((id) => s.scores[id] === top).map((id) => name(id));
      parts.push(`Die Partie ist vorbei. ${win.join(" und ")} ${win.length > 1 ? "gewinnen" : "gewinnt"} mit ${top} Punkten.`);
    }
    return parts;
  }
  if (before && s.phase === "play" && s.curId && s.curId !== before.curId) parts.push(`${name(s.curId)} ist dran.`);
  return parts;
}
