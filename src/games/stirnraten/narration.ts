import { catName, STYLE_BY_ID, wordText } from "@shared/games/stirnraten/cards";
import { LAPS, teamName, type StirnState } from "@shared/games/stirnraten/logic";
import type { Player } from "@shared/platform/types";

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "Jemand";
const list = (players: Player[], ids: string[]) => ids.map((id) => nameOf(players, id)).join(" und ");
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** Was der Spielleiter beim Übergang von `before` zu `s` laut sagt – nie den Begriff, solange geraten wird */
export function stirnSay(before: StirnState | null, s: StirnState, players: Player[]): string[] {
  const parts: string[] = [];
  const who = nameOf(players, s.guesser);
  const team = s.team !== null ? `, ${teamName(s.team)}` : "";

  // Klassisch und Teams
  if (s.variant === "klassisch" || s.variant === "teams") {
    const turnStart = !before || before.turn !== s.turn;
    if (turnStart && before?.last && before.phase === "review") {
      const l = s.last!;
      parts.push(`${nameOf(players, l.guesser)} hat ${n(l.hits, "Begriff", "Begriffe")} erraten.`);
    }
    if (s.phase === "pick" && (turnStart || before?.phase !== "pick")) parts.push(`${who}${team} ist dran und wählt eine Kategorie.`);
    if (s.phase === "ready" && (turnStart || before?.phase !== "ready")) {
      parts.push(`${who}${team} ist dran. Kategorie: ${s.cat === "mix" ? "bunt gemischt" : catName(s.cat)}. ${who}, halte das Handy an die Stirn. Nach vorn kippen heißt erraten, nach hinten weiter.`);
    }
    if (before?.phase === "ready" && s.phase === "play") parts.push(`Los! Ihr habt ${s.seconds} Sekunden.`);
    if (before?.phase === "play" && s.phase === "review") {
      const hits = s.cards.filter((c) => c.r === "hit").length;
      parts.push(`Zeit ist um! ${who} hat ${n(hits, "Begriff", "Begriffe")} erraten.`);
    }
  }

  if (s.variant === "bombe") {
    if (s.phase === "ready" && (!before || before.phase !== "ready")) {
      parts.push(`Runde ${s.turn + 1} von ${s.turns}. ${nameOf(players, s.holder)} hat die Bombe. Wer sie hält, erklärt dem Nächsten den Begriff. Ist er erraten, schnell weitergeben! Niemand weiß, wann sie hochgeht.`);
    }
    if (before?.phase === "ready" && s.phase === "bomb") parts.push("Die Lunte brennt!");
    if (before?.phase === "bomb" && (s.phase === "boom" || s.phase === "over")) parts.push(`Bumm! Die Bombe ist bei ${nameOf(players, before.holder)} hochgegangen.`);
  }

  if (s.variant === "hochstapler") {
    const roundStart = !before || before.turn !== s.turn || (before.phase !== "look" && s.phase === "look");
    if (s.phase === "look" && roundStart) parts.push(`Runde ${s.turn + 1} von ${s.turns}. Kategorie: ${catName(s.cat)}. Jeder schaut sich geheim seinen Begriff an. Einer von euch ist der Hochstapler und kennt ihn nicht.`);
    if (before?.phase === "look" && s.phase === "talk") parts.push(`Jeder sagt reihum ein Wort zum Begriff, ${LAPS} Runden lang. ${nameOf(players, s.speakOrder[0] ?? null)} fängt an.`);
    if (before?.phase === "talk" && s.phase === "talk" && before.speaker !== s.speaker) parts.push(`${nameOf(players, s.speakOrder[s.speaker % s.speakOrder.length] ?? null)}.`);
    if (before?.phase === "talk" && s.phase === "vote") parts.push("Wer ist der Hochstapler? Auf drei zeigt jeder auf seinen Verdacht. Eins, zwei, drei!");
    if (before?.phase === "vote" && s.phase === "guess") parts.push(`Erwischt! Aber ${nameOf(players, before.impostor ?? s.impostor)} darf noch den Begriff raten.`);
    const resolved = (s.phase === "reveal" || s.phase === "over") && before && before.phase !== "reveal" && before.phase !== "over";
    if (resolved && s.result) {
      const r = s.result;
      const imp = nameOf(players, r.impostor);
      if (!r.caught) parts.push(r.accused ? `${nameOf(players, r.accused)} war unschuldig! Der Hochstapler war ${imp}.` : `Keine Mehrheit – ${imp} war der Hochstapler und kommt davon.`);
      else parts.push(r.winner === "impostor" ? `${imp} wurde erwischt, hat den Begriff aber erraten!` : `${imp} ist entlarvt!`);
      parts.push(`Der Begriff war: ${wordText(r.word)}.`);
    }
  }

  if (before && before.phase !== "over" && s.phase === "over") {
    if (s.variant === "teams") {
      const top = Math.max(...s.teamScores);
      const winners = s.teams.map((_, i) => i).filter((i) => s.teamScores[i] === top).map(teamName);
      parts.push(`Das Spiel ist aus. Es gewinnt ${winners.join(" und ")} mit ${n(top, "Punkt", "Punkten")}.`);
    } else if (s.variant === "bombe") {
      const min = Math.min(...s.order.map((id) => s.bombs[id] ?? 0));
      parts.push(`Das Spiel ist aus. Am wenigsten Bomben hatte ${list(players, s.order.filter((id) => (s.bombs[id] ?? 0) === min))}.`);
    } else {
      const top = Math.max(...s.order.map((id) => s.scores[id] ?? 0));
      parts.push(`Das Spiel ist aus. Es gewinnt ${list(players, s.order.filter((id) => (s.scores[id] ?? 0) === top))} mit ${n(top, "Punkt", "Punkten")}.`);
    }
  }
  return parts;
}

/** Ansage einer Karte für die Erklärenden (nur am eigenen Handy, nie am Stirn-Handy) */
export const styleLine = (style: keyof typeof STYLE_BY_ID) => `${STYLE_BY_ID[style].name}: ${STYLE_BY_ID[style].hint}`;
