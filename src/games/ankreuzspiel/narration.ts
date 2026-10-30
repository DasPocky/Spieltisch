import { ROWS, totalOf, type AkState } from "@shared/games/ankreuzspiel/logic";

/** Was ein Spielleiter sagt: wer würfelt, was Weiß zeigt, wer was ankreuzt, Fehlwürfe, Schlösser und das Ende. Lokal das Gerät, online das Handy des Hosts. */
export function narration(before: AkState | null, s: AkState, name: (id: string | null) => string): string[] {
  const parts: string[] = [];
  if (!before) {
    if (s.phase === "roll") parts.push(`${name(s.curId)} beginnt und würfelt.`);
    return parts;
  }
  // Neuer Wurf: Weiß für alle (auch wenn der Zug gleich ganz durch ist, weil niemand etwas ankreuzen konnte)
  const done = !!s.last && s.last !== before.last;
  const rolled = before.phase === "roll" && (s.phase === "white" || s.phase === "color" ? s.dice : done ? s.last!.dice : null);
  if (rolled && rolled.length) parts.push(`${name(before.curId)} würfelt. Weiß ${rolled[0]} und ${rolled[1]}, zusammen ${rolled[0] + rolled[1]} für alle.`);
  // Ein Zug ist fertig: Kreuze, Fehlwurf, Schlösser
  if (done) {
    const t = s.last!;
    const marks = t.marks.map((m) => `${name(m.id)} ${ROWS[m.row].name} ${m.n}`);
    if (marks.length) parts.push(`Angekreuzt: ${marks.join(", ")}.`);
    else if (rolled) parts.push("Niemand kreuzt etwas an.");
    if (t.miss) parts.push(`${name(t.by)} hat einen Fehlwurf.`);
    for (const r of t.closed) parts.push(`${ROWS[r].name} ist abgeschlossen!`);
  }
  if (s.phase === "over" && before.phase !== "over") {
    parts.push(s.endReason === "closed" ? "Genug Reihen sind abgeschlossen – die Partie ist vorbei." : s.endReason === "misses" ? "Der letzte Fehlwurf – die Partie ist vorbei." : "Die Partie ist vorbei.");
    const ranked = Object.keys(s.sheets).sort((a, b) => totalOf(s.sheets[b]) - totalOf(s.sheets[a]));
    if (ranked.length) parts.push(`${name(ranked[0])} gewinnt mit ${totalOf(s.sheets[ranked[0]])} Punkten.`);
    return parts;
  }
  if (s.phase === "color" && before.phase !== "color") parts.push(`${name(s.curId)} darf noch eine Farbe nehmen.`);
  if (s.phase === "roll" && before.curId !== s.curId) parts.push(`${name(s.curId)} ist dran.`);
  return parts;
}
