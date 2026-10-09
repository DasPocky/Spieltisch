import { ROLES, type WerwolfState } from "@shared/games/werwolf/logic";
import type { Options, Player } from "@shared/platform/types";
import { tempoOf } from "@shared/games/werwolf/tempo";
import { DAWN_SAY, SCRIPT } from "./script";

const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? "Jemand";

/** „Anna ist tot und war Seherin.“ – Rolle nur, wenn Tote aufgedeckt werden */
function deathSay(s: WerwolfState, players: Player[], id: string, how = "ist tot") {
  const role = s.revealDead && s.roles[id] ? ` und war ${ROLES[s.roles[id]].name}` : "";
  return `${nameOf(players, id)} ${how}${role}.`;
}

/** Was in der Nacht passiert ist – wie ein Spielleiter am Morgen */
export function morningSay(s: WerwolfState, players: Player[]) {
  if (s.night === 0) return "Der Engel ist im Spiel: Bevor die erste Nacht beginnt, stimmt das Dorf ab.";
  const n = s.news?.kind === "night" ? s.news : null;
  const parts: string[] = [];
  const deaths = n?.deaths ?? [];
  if (!deaths.length) parts.push("Heute Nacht ist niemand gestorben.");
  for (const d of deaths) parts.push(deathSay(s, players, d.id, d.cause === "kummer" ? "stirbt vor Kummer" : "ist tot"));
  if (n?.growl) parts.push("Der Bär brummt! Neben dem Bärenführer sitzt ein Werwolf.");
  if (n?.raven) parts.push(`Der Rabe hat ${nameOf(players, n.raven)} markiert – heute zwei Stimmen mehr gegen ${nameOf(players, n.raven)}.`);
  return parts.join(" ");
}

/**
 * Online mit App-Erzähler: Was das Host-Handy beim Übergang von `before` zu `s` vorliest.
 * Alles, was ein Spielleiter am Tisch laut sagen würde – nie, wer welche Rolle hat (außer aufgedeckten Toten).
 */
export function onlineSay(before: WerwolfState, s: WerwolfState, players: Player[], options: Options): string[] {
  const parts: string[] = [];
  const phaseChanged = before.phase !== s.phase || before.night !== s.night || (before.runoff ?? []).join() !== (s.runoff ?? []).join();
  // Wer seit eben tot ist (Urteil, Jäger, Kummer) – die Nacht verkündet der Morgen
  const fresh = Object.keys(s.alive).filter((id) => before.alive[id] && !s.alive[id]);
  // Ende der Nacht: Tote verkündet der Morgen (auch wenn danach Wahl oder Jäger kommt)
  const fromNight = before.phase === "night" && s.phase !== "night";

  if (fromNight && before.awake && SCRIPT[before.awake].after) parts.push(SCRIPT[before.awake].after!);
  if (fromNight && s.phase !== "day" && s.phase !== "election" && s.phase !== "over") parts.push(DAWN_SAY, morningSay(s, players));
  if (!fromNight && fresh.length) {
    if (before.phase === "day" && s.news?.kind === "day") parts.push("Das Dorf hat entschieden.");
    if (before.phase === "hunter") parts.push("Der Jäger hat geschossen.");
    for (const id of fresh) parts.push(deathSay(s, players, id, s.news?.deaths.find((d) => d.id === id)?.cause === "kummer" ? "stirbt vor Kummer" : "ist tot"));
  } else if (before.phase === "day" && s.phase !== "day" && s.news?.kind === "day") {
    if (s.news.idiot) parts.push(`${nameOf(players, s.news.idiot)} ist der Dorfdepp und bleibt am Leben – darf aber nicht mehr abstimmen.`);
    else if (!fresh.length) parts.push("Das Dorf hat niemanden verurteilt.");
  }
  if (s.news?.scapegoat && fresh.length && before.phase === "day") parts.push("Gleichstand – der Sündenbock musste sterben.");

  if (before.phase === "election" && s.phase !== "election" && s.captain) parts.push(`${nameOf(players, s.captain)} ist Hauptmann. Seine Stimme zählt doppelt.`);

  if (phaseChanged) {
    if (s.phase === "night") {
      if (s.seq) {
        parts.push(SCRIPT.sleep.say);
        if (s.awake) parts.push(SCRIPT[s.awake].say);
      } else parts.push("Es wird Nacht. Alle schließen die Augen – jeder handelt geheim an seinem Handy.");
    } else if (s.phase === "day" && s.runoff) {
      parts.push(`Gleichstand. Stichwahl zwischen ${s.runoff.map((id) => nameOf(players, id)).join(" und ")}.`);
    } else if (s.phase === "day") {
      if (fromNight) parts.push(DAWN_SAY, morningSay(s, players));
      parts.push(`Ihr habt ${tempoOf(options).talk} Minuten. Dann stimmt ihr ab.`);
    } else if (s.phase === "election") {
      if (fromNight) parts.push(DAWN_SAY, morningSay(s, players));
      parts.push("Das Dorf wählt jetzt einen Hauptmann.");
    } else if (s.phase === "hunter" && s.hunters[0]) {
      parts.push(`${nameOf(players, s.hunters[0])} war der Jäger und nimmt mit dem letzten Schuss jemanden mit in den Tod.`);
    } else if (s.phase === "successor") {
      parts.push("Der Hauptmann ist tot. Er bestimmt jetzt seinen Nachfolger.");
    }
  } else if (s.phase === "night" && s.seq && before.awake !== s.awake) {
    // Nacheinander: Rolle schläft ein, die nächste erwacht
    if (before.awake && SCRIPT[before.awake].after) parts.push(SCRIPT[before.awake].after!);
    if (s.awake) parts.push(SCRIPT[s.awake].say);
  }
  return parts.filter(Boolean);
}

/** Spielende: letztes Urteil bzw. letzte Nacht, dann wer gewonnen hat */
export function endSay(s: WerwolfState, players: Player[], winner: string) {
  const parts: string[] = [];
  const d = s.news?.deaths ?? [];
  if (s.news?.kind === "night") parts.push(DAWN_SAY, morningSay(s, players));
  else if (d.length) parts.push("Das Dorf hat entschieden.", ...d.map((x) => deathSay(s, players, x.id, x.cause === "kummer" ? "stirbt vor Kummer" : "ist tot")));
  parts.push("Das Spiel ist aus.", winner);
  return parts.join(" ");
}
