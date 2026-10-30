import { rankOf } from "@shared/cards/deck";
import { cardsText, sourceOf, type PalastState } from "@shared/games/palast/logic";

/**
 * Was ein Spielleiter sagt: Tauschen, wer beginnt, was gelegt wird, Sonderkarten (2, 7, 10, vier gleiche), Aufnehmen,
 * Tischkarten, wer fertig ist und wer am Ende die Palastwache hält. Lokal das Gerät, online das Handy des Hosts.
 */
export function narration(before: PalastState | null, s: PalastState, name: (id: string | null) => string, seven = true): string[] {
  const parts: string[] = [];
  if (!before && s.phase === "swap") parts.push("Jeder hat drei verdeckte und drei offene Tischkarten und drei auf der Hand. Tauscht jetzt Handkarten gegen offene Tischkarten – starke Karten liegen besser offen.");
  if (s.phase === "play" && (!before || before.phase === "swap")) parts.push(`${name(s.curId)} beginnt.`);
  const l = s.last;
  if (before && l && s.n !== before.n) {
    const who = name(l.id);
    if (l.kind === "take") parts.push(`${who} kann nicht und nimmt ${l.took === 1 ? "eine Karte" : `${l.took} Karten`} auf.`);
    else if (l.kind === "blindFail") parts.push(`${who} deckt blind ${cardsText(l.cards)} auf – passt nicht. ${who} nimmt ${l.took} Karten auf.`);
    else {
      const r = rankOf(l.cards[0]);
      parts.push(`${who} ${l.src === "down" ? "deckt blind" : "legt"} ${cardsText(l.cards)}${l.src === "down" ? " auf – passt" : ""}.`);
      if (l.burn === "ten") parts.push("Die Zehn verbrennt den Stapel!");
      else if (l.burn === "four") parts.push("Vier gleiche – der Stapel brennt!");
      else if (l.burn === "stall") parts.push("Die Ablage ist lange genug gewandert – sie wird verbrannt.");
      if (l.burn) { /* schon gesagt */ } else if (r === "2") parts.push("Neustart – jetzt darf alles drauf.");
      else if (r === "7" && seven) parts.push("Jetzt nur sieben oder niedriger.");
      if (l.out) parts.push(`${who} ist fertig – Platz ${s.out.indexOf(l.id) + 1}.`);
      else if (l.burn && l.burn !== "stall") parts.push(`${who} legt noch einmal.`);
    }
    // Wechsel auf die Tischkarten
    if (s.phase === "play") {
      const was = sourceOf(before, l.id), now = sourceOf(s, l.id);
      if (was !== now && now === "up") parts.push(`${who} hat keine Handkarten mehr – als Nächstes die offenen Tischkarten.`);
      if (was !== now && now === "down") parts.push(`${who} spielt ab jetzt blind die verdeckten Tischkarten.`);
    }
  }
  if (before && before.phase !== "over" && s.phase === "over") {
    if (s.out[0]) parts.push(`${name(s.out[0])} gewinnt.`);
    if (s.guard) parts.push(`${name(s.guard)} hält die Palastwache.`);
  }
  return parts;
}
