import { ANSWER_TEXT, active, open, type WbState } from "@shared/games/werbinich/logic";

const listing = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}` : xs[0] ?? "");

/** Was ein Spielleiter sagt: Start, wer fragt, die Frage, jede Antwort, jedes Raten, Auflösung und Sieger – nie die Figur dessen, der noch rät */
export function narration(before: WbState | null, s: WbState, name: (id: string | null) => string): string[] {
  const parts: string[] = [];
  if (!before && s.phase === "write") {
    parts.push("Willkommen bei Wer bin ich! Jeder schreibt jetzt geheim eine Figur für seinen Nachbarn auf. Verratet nichts!");
    if (s.local) parts.push("Reicht das Handy reihum, der Nachbar schaut weg.");
  }
  const started = s.phase !== "write" && s.phase !== "over" && (!before || before.phase === "write");
  if (started) {
    if (!before || !s.mutual) parts.push("Willkommen bei Wer bin ich!");
    parts.push("Jeder hat eine geheime Figur. Alle anderen sehen sie, nur ihr selbst nicht – schaut also nicht auf eure eigene. Reihum stellt ihr Fragen über euch, die man mit Ja oder Nein beantworten kann.");
  }
  // Ergebnis der letzten Frage bzw. des Ratens
  const resolved = !!before && !!s.last && JSON.stringify(s.last) !== JSON.stringify(before.last)
    && (((before.phase === "vote" || before.phase === "guess") && s.phase !== before.phase) || s.solved.length > before.solved.length);
  if (resolved) {
    const l = s.last!;
    const who = name(l.asker);
    if (l.kind === "frage") {
      parts.push(`Die Antwort ist: ${ANSWER_TEXT[l.result]}.`);
      if (s.phase === "ask" && s.asker === l.asker) parts.push(`${who} darf weiterfragen.`);
    } else if (l.result === "ja") {
      parts.push(`Richtig! ${who} war ${s.figures[l.asker] ?? "erraten"}.`);
    } else {
      parts.push(`Leider falsch, ${who}.`);
    }
  }
  if (s.phase === "ask" && before && (before.asker !== s.asker || before.phase === "write") && !started) {
    parts.push(`${name(s.asker)} ist dran. Stell eine Ja-oder-Nein-Frage über dich.`);
  } else if (started && s.phase === "ask") {
    parts.push(`${name(s.asker)} fängt an.`);
  }
  if (before && s.phase === "vote" && before.phase !== "vote") {
    parts.push(s.question ? `${name(s.asker)} fragt: ${s.question}` : "Stimmt ab:");
    parts.push("Ja, Nein oder Weiß nicht?");
  }
  if (before && s.phase === "guess" && before.phase !== "guess") {
    parts.push(s.guess ? `${name(s.asker)} rät: ${s.guess}. Stimmt das?` : `${name(s.asker)} rät. Stimmt das?`);
  }
  if (before && s.phase === "over" && before.phase !== "over") {
    const ids = active(s);
    parts.push(open(s).length ? "Das Spiel ist aus! Die Auflösung:" : "Alle haben ihre Figur erraten! Die Auflösung:");
    parts.push(`${ids.map((id) => `${name(id)} war ${s.figures[id] ?? "?"}`).join(". ")}.`);
    const best = Math.max(0, ...ids.map((id) => s.scores[id] ?? 0));
    const win = ids.filter((id) => best > 0 && (s.scores[id] ?? 0) === best).map(name);
    if (win.length) parts.push(`${listing(win)} ${win.length > 1 ? "gewinnen" : "gewinnt"} mit ${best} Punkten.`);
  }
  return parts;
}
