import { ROOMS, SUSPECTS, suspectIndex, WEAPONS, weaponIndex, type SpState } from "@shared/games/spurensuche/logic";

/** Was ein Spielleiter am Tisch sagen würde – lokal das Gerät, online das Handy des Hosts */
export function narration(before: SpState, s: SpState): string[] {
  const name = (id: string | null | undefined) => (id ? s.names[id] ?? "?" : "?");
  const parts: string[] = [];
  const newSug = s.history.length > before.history.length ? s.history.at(-1)! : null;
  const startedSug = s.pending && (!before.pending || before.pending.n !== s.pending.n) ? s.pending : null;
  const sug = startedSug ?? (newSug && newSug.n !== before.pending?.n ? newSug : null);
  if (sug) parts.push(`${name(sug.by)} verdächtigt ${SUSPECTS[suspectIndex(sug.suspect)].name}, ${WEAPONS[weaponIndex(sug.weapon)].with}, ${ROOMS[sug.room].in}.`);
  if (newSug) {
    if (newSug.passed.length) parts.push(`${newSug.passed.map(name).join(", ")} ${newSug.passed.length > 1 ? "können" : "kann"} nicht widerlegen.`);
    parts.push(newSug.shownBy ? `${name(newSug.shownBy)} zeigt ${name(newSug.by)} eine Karte.` : "Niemand kann widerlegen!");
  } else if (s.phase === "refute" && s.refuterId && s.refuterId !== before.refuterId) {
    parts.push(`${name(s.refuterId)}, du hast eine passende Karte – zeig ${name(s.pending?.by)} eine davon.`);
  }
  const acc = s.lastAccusation && s.lastAccusation.n !== before.lastAccusation?.n ? s.lastAccusation : null;
  if (acc) {
    parts.push(`${name(acc.by)} klagt an: ${SUSPECTS[suspectIndex(acc.suspect)].name}, ${WEAPONS[weaponIndex(acc.weapon)].with}, ${ROOMS[acc.room].in}.`);
    parts.push(acc.right ? `Richtig! ${name(acc.by)} hat den Fall gelöst.` : `Falsch! ${name(acc.by)} scheidet aus.`);
  }
  if (s.phase === "over" && before.phase !== "over" && !acc?.right && s.solution) {
    parts.push(`Niemand hat den Fall gelöst. Es war ${SUSPECTS[suspectIndex(s.solution.suspect)].name}, ${WEAPONS[weaponIndex(s.solution.weapon)].with}, ${ROOMS[s.solution.room].in}.`);
  }
  if (s.phase === "move" && s.curId && s.curId !== before.curId) parts.push(`${name(s.curId)} ist dran.`);
  return parts;
}
