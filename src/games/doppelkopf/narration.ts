import { callName, contractName, partyOf, type DkState } from "@shared/games/doppelkopf/logic";
import type { Options } from "@shared/platform/types";

const augen = (n: number) => `${n} ${n === 1 ? "Auge" : "Augen"}`;
const pts = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? "Punkt" : "Punkte"}`;

/**
 * Was ein Spielleiter sagt: wer gibt und wer zuerst sagt, die Vorbehalte, das Spiel, Ansagen, wer den Stich nimmt
 * (mit Doppelkopf, Fuchs und Karlchen), die Abrechnung und am Ende den Sieger. Lokal das Gerät, online das Handy des Hosts.
 */
export function narration(before: DkState | null, s: DkState, name: (id: string | null) => string, o: Options): string[] {
  const parts: string[] = [];
  const fresh = !before || before.round !== s.round;
  if (fresh && s.phase === "reserve") parts.push(`Runde ${s.round}. ${name(s.dealerId)} gibt. ${name(s.curId)} sagt zuerst: gesund oder Vorbehalt?`);
  if (before && !fresh) {
    // Vorbehalte, die seit dem letzten Stand gesagt wurden
    for (const id of s.seats) if (!before.said[id] && s.said[id]) parts.push(`${name(id)}: ${s.said[id] === "gesund" ? "gesund" : "Vorbehalt"}.`);
    if (before.phase === "reserve" && s.phase === "play") {
      if (s.contract === "hochzeit") parts.push(`Hochzeit! ${name(s.soloist)} hat beide Kreuz-Damen. Wer zuerst einen Stich macht, spielt mit.`);
      else if (s.contract && s.contract !== "normal") parts.push(`${name(s.soloist)} spielt ${contractName(s.contract, o)} – allein gegen drei.`);
      else parts.push("Alle gesund – Normalspiel.");
      parts.push(`${name(s.curId)} spielt aus.`);
    }
    for (const id of s.seats) {
      const lv = s.callBy[id] ?? 0;
      if (lv > (before.callBy[id] ?? 0)) {
        const party = s.revealed[id] ?? "re";
        parts.push(lv === 1 ? `${name(id)} sagt ${callName(party, 1)}!` : `${name(id)} sagt ${callName(party, lv)}!`);
      }
    }
    if (s.tricks.length > before.tricks.length) {
      const t = s.tricks[s.tricks.length - 1];
      let line = `${name(t.winner)} nimmt den Stich mit ${augen(t.augen)}.`;
      if (t.augen >= 40) line += " Doppelkopf!";
      if (t.plays.some((p) => p.card === "karo-A" && p.id !== t.winner) && (s.contract === "normal" || s.contract === "hochzeit")) line += " Da liegt ein Fuchs drin.";
      if (s.tricks.length === s.handSize && t.plays.find((p) => p.id === t.winner)?.card === "kreuz-B" && (s.contract === "normal" || s.contract === "hochzeit")) line += " Karlchen macht den letzten Stich!";
      parts.push(line);
      const w = s.wedding, bw = before.wedding;
      if (w && bw && !bw.decided && w.decided) parts.push(w.partner ? `${name(w.partner)} heiratet mit.` : `Keiner heiratet mit – ${name(w.by)} spielt allein.`);
    }
    if ((s.phase === "roundEnd" || s.phase === "over") && before.phase === "play") {
      const rec = s.history[s.history.length - 1];
      if (rec) {
        const team = (p: "re" | "kontra") => s.seats.filter((id) => partyOf(rec, id) === p).map(name).join(" und ");
        if (rec.alone && rec.soloist) parts.push(`${name(rec.soloist)} hat allein gespielt.`);
        parts.push(`Re hat ${augen(rec.augen.re)}, Kontra ${augen(rec.augen.kontra)}.`);
        if (rec.winner) parts.push(`${rec.winner === "re" ? "Re" : "Kontra"} gewinnt: ${team(rec.winner)}.`);
        else parts.push("Keine Partei hat ihre Absage geschafft.");
        for (const l of rec.lines) parts.push(`${l.label}${l.party !== rec.winner ? ` für ${l.party === "re" ? "Re" : "Kontra"}` : ""}.`);
        if (rec.value === 0) parts.push("Das Spiel zählt null Punkte.");
        else {
          const winners = rec.value > 0 ? "re" : "kontra";
          const each = Math.abs(rec.value) * (rec.alone && winners === "re" ? 3 : 1);
          parts.push(`${team(winners)} ${winners === "re" && rec.alone ? "bekommt" : "bekommen je"} ${pts(each)}.`);
        }
      }
      if (s.phase === "over") {
        const best = Math.max(...s.seats.map((id) => s.scores[id] ?? 0));
        const win = s.seats.filter((id) => (s.scores[id] ?? 0) === best).map(name);
        parts.push(`Die Partie ist vorbei. ${win.join(" und ")} ${win.length > 1 ? "gewinnen" : "gewinnt"} mit ${pts(best)}.`);
      }
    }
  }
  return parts;
}
