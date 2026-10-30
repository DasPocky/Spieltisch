import { cardsOf, FRUIT_NAME, LIMITS, PACES, type KlState } from "@shared/games/klingel/logic";

const listing = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}` : xs[0] ?? "");
const cards = (n: number) => (n === 1 ? "eine Karte" : `${n} Karten`);
const PACE_SAY: Record<number, string> = { [PACES.ruhig]: "alle drei Sekunden", [PACES.normal]: "alle zwei Sekunden", [PACES.schnell]: "etwa jede Sekunde" };

/**
 * Was ein Spielleiter sagt: die Regeln zum Start, wer zuerst klingelt (und was er bekommt), wer falsch klingelt,
 * wer raus ist und wer gewinnt. Das einzelne Aufdecken liest niemand vor – das ginge zu schnell.
 */
export function narration(before: KlState | null, s: KlState, name: (id: string | null) => string): string[] {
  const parts: string[] = [];
  if (!before) {
    parts.push("Willkommen bei Klingel!");
    parts.push("Reihum deckt jeder die oberste Karte seines Stapels auf. Es zählt nur die oberste offene Karte jedes Spielers.");
    parts.push("Liegen von einer Obstsorte genau fünf Früchte offen, haut schnell auf die Klingel. Wer zuerst richtig klingelt, bekommt alle offenen Karten. Wer falsch klingelt, gibt jedem Mitspieler eine Karte ab.");
    parts.push("Wer keine Karten mehr hat, ist raus.");
    if (s.auto) parts.push(`Die App deckt ${PACE_SAY[s.pace] ?? "im Takt"} für euch auf.`);
    if (s.limitAt !== null) {
      const min = LIMITS.find((m) => Math.abs(Number(m) * 60_000 - (s.limitAt! - s.at)) < 1000) ?? "";
      parts.push(min ? `Nach ${min} Minuten gewinnt, wer die meisten Karten hat.` : "Ist die Zeit um, gewinnt, wer die meisten Karten hat.");
    } else parts.push("Gewonnen hat, wer am Ende alle Karten hat.");
    parts.push(`${name(s.curId)} fängt an.`);
    return parts;
  }
  const e = s.last;
  if (e && e.n !== before.last?.n) {
    if (e.ok) parts.push(`${name(e.by)} war am schnellsten${e.fruit ? ` – fünf ${FRUIT_NAME[e.fruit].many}` : ""}! ${cards(e.cards)} für ${name(e.by)}.`);
    else parts.push(`Falsch geklingelt, ${name(e.by)}! ${e.cards ? `${cards(e.cards)} abgeben.` : ""}`.trim());
    if (e.out?.length) parts.push(`${listing(e.out.map(name))} ${e.out.length > 1 ? "sind" : "ist"} raus.`);
  }
  if (s.phase === "over" && before.phase !== "over") {
    const win = s.winners.map(name);
    if (s.timeUp) parts.push(`Die Zeit ist um! ${listing(win)} ${win.length > 1 ? "gewinnen" : "gewinnt"} mit ${cards(cardsOf(s, s.winners[0] ?? ""))}.`);
    else parts.push(`${listing(win)} ${win.length > 1 ? "gewinnen" : "hat alle Karten und gewinnt"}!`);
  }
  return parts;
}
