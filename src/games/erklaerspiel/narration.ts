import { stageStart, standings, STYLES, styleOf, teamName, turnPoints, type ErkState } from "@shared/games/erklaerspiel/logic";
import type { Player } from "@shared/platform/types";

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "Jemand";
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
const pts = (k: number) => (Math.abs(k) === 1 ? `${k} Punkt` : `${k} Punkte`);
const ROUND = ["Erste", "Zweite", "Dritte"];

/** Was der Spielleiter laut sagt – nie einen Begriff, solange erklärt wird */
export function erklSay(before: ErkState | null, s: ErkState, players: Player[]): string[] {
  const parts: string[] = [];
  const who = nameOf(players, s.explainer);
  const team = teamName(s.team);

  // Zug bestätigt: Punkte und Stand
  if (before && before.turn !== s.turn && s.last) {
    const l = s.last;
    parts.push(`${teamName(l.team)} bekommt ${pts(l.points)}.`);
    parts.push(`Stand: ${standings(s).map((r) => `${r.label.replace("Team ", "")} ${r.score}`).join(", ")}.`);
  }
  if (s.phase === "ready" && (!before || before.turn !== s.turn || before.explainer !== s.explainer || before.phase !== "ready")) {
    if (stageStart(s) && s.stage > 0) parts.push(`${ROUND[s.stage]} Runde mit denselben Begriffen: ${STYLES[styleOf(s)].name}. ${STYLES[styleOf(s)].rule}`);
    else if (!before && s.variant === "drei") parts.push(`Drei Runden mit denselben ${s.poolSize} Begriffen: erst erklären, dann ein Wort, dann Pantomime. Erste Runde: ${STYLES.erklaeren.rule}`);
    else if (!before) parts.push(`${STYLES[styleOf(s)].name}. ${STYLES[styleOf(s)].rule}`);
    parts.push(`${team} ist dran. ${who} erklärt – ${who}, nimm das Handy, nur du siehst die Begriffe. Dein Team ruft, du tippst Richtig oder Weiter.`);
  }
  if (before?.phase === "ready" && s.phase === "play") parts.push(`Los! ${s.seconds} Sekunden.`);
  if (before?.phase === "play" && s.phase === "review") {
    const { hits } = turnPoints(s);
    parts.push(`${s.left === 0 && s.variant === "drei" ? "Alle Begriffe sind erraten!" : "Zeit ist um!"} ${team} hat ${n(hits, "Begriff", "Begriffe")} erraten. Die Gegner prüfen kurz und bestätigen.`);
  }
  if (before && before.phase !== "over" && s.phase === "over") {
    const top = Math.max(...s.teamScores);
    const winners = s.teams.map((_, i) => i).filter((i) => s.teamScores[i] === top).map(teamName);
    parts.push(`Das Spiel ist aus. ${winners.length > 1 ? `Unentschieden zwischen ${winners.join(" und ")}` : `Es gewinnt ${winners[0]}`} mit ${pts(top)}.`);
  }
  return parts;
}
