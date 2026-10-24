import { DIR_NAME, MOON, QUEEN, type HzState } from "@shared/games/herzen/logic";

/** Was ein Spielleiter sagt: Weitergeben, wer ausspielt, „Herz gebrochen“, Pik-Dame, Wertung. Lokal das Gerät, online das Handy des Hosts. */
export function narration(before: HzState | null, s: HzState, name: (id: string | null) => string): string[] {
  const parts: string[] = [];
  const fresh = !before || before.round !== s.round;
  if (fresh && s.phase === "pass") parts.push(`Runde ${s.round}. Jeder gibt drei Karten ${DIR_NAME[s.dir]} weiter.`);
  if (fresh && s.dir === "none" && s.phase === "play") parts.push(`Runde ${s.round}. Diesmal wird nicht weitergegeben.`);
  if (s.phase === "play" && s.trickNo === 0 && !s.trick.length && (fresh || before?.phase !== "play")) parts.push(`${name(s.curId)} hat die Kreuz-Zwei und spielt aus.`);
  if (before && !before.heartsBroken && s.heartsBroken && s.round === before.round) parts.push("Herz ist gebrochen!");
  if (before && s.lastTrick && s.lastTrick !== before.lastTrick && s.lastTrick.plays.some((p) => p.card === QUEEN) && before.round === s.round) parts.push(`${name(s.lastTrick.winner)} nimmt die Pik-Dame.`);
  if (before && (s.phase === "roundEnd" || s.phase === "over") && before.phase === "play") {
    const rec = s.history[s.history.length - 1];
    if (rec?.moon) parts.push(`${name(rec.moon)} schießt den Mond! Alle anderen bekommen ${MOON} Punkte.`);
    else if (rec) parts.push(`Runde ${s.round} ist vorbei.`);
    if (s.phase === "over") {
      const ids = Object.keys(s.scores);
      const best = Math.min(...ids.map((id) => s.scores[id]));
      const win = ids.filter((id) => s.scores[id] === best).map(name);
      parts.push(`${win.join(" und ")} ${win.length > 1 ? "gewinnen" : "gewinnt"} mit ${best} Punkten.`);
    }
  }
  return parts;
}
