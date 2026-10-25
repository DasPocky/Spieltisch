import { active, type SlfState } from "@shared/games/stadtlandfluss/logic";

/** Kategorien als gesprochene Aufzählung: „Stadt, Land und Fluss“ */
export const listing = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}` : xs[0] ?? "");

/** Was ein Spielleiter sagt: Buchstabe, Stopp, jede Kategorie mit allen Antworten, Rundenwertung, Sieger */
export function narration(before: SlfState | null, s: SlfState, name: (id: string | null) => string): string[] {
  const parts: string[] = [];
  const fresh = !before || before.round !== s.round || (before.phase !== "write" && s.phase === "write");
  if (s.phase === "write" && fresh && (!before || !s.done.length)) {
    if (s.round === 0) parts.push(`Willkommen bei Stadt, Land, Fluss! Gesucht sind: ${listing(s.cats)}.`);
    parts.push(`Runde ${s.round + 1} von ${s.rounds}. Der Buchstabe ist: ${s.letter}! Los geht's!`);
    if (s.local) parts.push(`Reicht das Handy reihum – ${name(active(s)[0])} fängt an.`);
  }
  if (before && s.phase === "write" && before.stopAt === null && s.stopAt !== null) {
    parts.push(`Stopp! ${s.stopBy ? `${name(s.stopBy)} ist fertig.` : "Der Host beendet die Runde."} Ihr habt noch ${s.countdown} Sekunden!`);
  }
  if (before && s.phase === "review" && (before.phase !== "review" || before.cat !== s.cat)) {
    if (before.phase !== "review") parts.push("Die Zeit ist um, Stifte weg! Jetzt wird ausgewertet.");
    const said = active(s).map((id) => { const a = s.answers[id]?.[s.cat]; return a ? `${name(id)}: ${a}.` : `${name(id)} hat nichts.`; });
    parts.push(`${s.cats[s.cat]} mit ${s.letter}. ${said.join(" ")}`);
  }
  if (before && s.phase === "score" && before.phase === "review") {
    const last = s.history[s.history.length - 1]?.points ?? {};
    const ids = active(s);
    const best = Math.max(0, ...ids.map((id) => last[id] ?? 0));
    const win = ids.filter((id) => (last[id] ?? 0) === best).map(name);
    parts.push(`Runde ${s.round + 1} ist ausgewertet. Die meisten Punkte ${win.length > 1 ? "holen" : "holt"} ${listing(win)} mit ${best}.`);
  }
  if (before && s.phase === "over" && before.phase !== "over") {
    const ids = active(s);
    const best = Math.max(0, ...ids.map((id) => s.scores[id] ?? 0));
    const win = ids.filter((id) => (s.scores[id] ?? 0) === best).map(name);
    parts.push(`Das Spiel ist aus! ${listing(win)} ${win.length > 1 ? "gewinnen" : "gewinnt"} mit ${best} Punkten.`);
  }
  return parts;
}
