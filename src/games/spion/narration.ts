import { placeName } from "@shared/games/spion/places";
import type { SpionState } from "@shared/games/spion/logic";
import type { Player } from "@shared/platform/types";

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "Jemand";
const list = (players: Player[], ids: string[]) => ids.map((id) => nameOf(players, id)).join(" und ");

/** Was der Spielleiter beim Übergang von `before` zu `s` laut sagt – verrät nie den Ort oder den Spion vor der Auflösung */
export function spionSay(before: SpionState | null, s: SpionState, players: Player[]): string[] {
  const parts: string[] = [];
  const roundStart = !before || before.round !== s.round || (before.phase !== "look" && s.phase === "look");
  if (s.phase === "look" && roundStart) {
    parts.push(`Runde ${s.round} von ${s.rounds}. Jeder schaut sich geheim seine Karte an. Einer von euch ist der Spion.`);
    return parts;
  }
  if (!before) return parts;
  if (before.phase === "look" && s.phase === "talk") {
    parts.push(`Alle kennen ihre Karte. Ihr habt ${s.minutes} Minuten. ${nameOf(players, s.asker)} fängt an und stellt jemandem eine Frage.`);
    return parts;
  }
  if (s.phase === "talk" && before.phase === "talk" && s.asker && s.asker !== before.asker) parts.push(`${nameOf(players, s.asker)} fragt.`);
  if (before.phase === "vote" && s.phase === "talk") parts.push("Keine Einigung. Weiter geht's.");
  if (before.phase !== "vote" && s.phase === "vote" && s.vote) {
    parts.push(s.vote.final
      ? "Die Zeit ist um! Letzte Abstimmung: Auf drei zeigt jeder auf seinen Verdacht. Eins, zwei, drei!"
      : `${s.vote.by ? `${nameOf(players, s.vote.by)} will abstimmen. ` : "Abstimmung! "}Auf drei zeigt jeder auf seinen Verdacht. Eins, zwei, drei!`);
  }
  if (before.phase !== "guess" && s.phase === "guess" && s.guess) {
    parts.push(s.guess.caught
      ? `${nameOf(players, s.guess.spy)} war tatsächlich der Spion – hat aber noch eine letzte Chance, den Ort zu raten.`
      : `${nameOf(players, s.guess.spy)} enttarnt sich als Spion und rät jetzt den Ort.`);
  }
  // Auflösung – in der letzten Runde geht es direkt zum Ergebnis
  const resolved = (s.phase === "reveal" || s.phase === "over") && before.phase !== "reveal" && before.phase !== "over";
  if (resolved && s.last) {
    const r = s.last;
    const spies = list(players, r.spies);
    const one = r.spies.length === 1;
    switch (r.reason) {
      case "caught": parts.push(`${spies} ${one ? "wurde" : "wurden"} verurteilt – und ${one ? "war der Spion" : "waren die Spione"}! Die Gruppe gewinnt.`); break;
      case "caughtGuess": parts.push(`${spies} wurde erwischt, hat den Ort aber noch erraten! Der Spion gewinnt.`); break;
      case "innocent": parts.push(`${nameOf(players, r.accused)} wurde verurteilt – war aber unschuldig! Der Spion war ${spies}.`); break;
      case "guessRight": parts.push(`${spies} tippt auf ${placeName(r.guessed)} – richtig! Der Spion gewinnt.`); break;
      case "guessWrong": parts.push(r.guessed ? `${spies} tippt auf ${placeName(r.guessed)} – falsch! Die Gruppe gewinnt.` : `${spies} hat nicht geraten – die Gruppe gewinnt.`); break;
      case "time": parts.push(`Keine Mehrheit – der Spion ${spies} kommt davon und gewinnt.`); break;
    }
    parts.push(`Der Ort war: ${placeName(r.place)}.`);
  }
  if (before.phase !== "over" && s.phase === "over") {
    const top = Math.max(...Object.values(s.scores));
    const winners = Object.keys(s.scores).filter((id) => s.scores[id] === top);
    parts.push(`Das Spiel ist aus. Es gewinnt ${list(players, winners)} mit ${top} ${top === 1 ? "Punkt" : "Punkten"}.`);
  }
  return parts;
}
