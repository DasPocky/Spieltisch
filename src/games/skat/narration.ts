import { gameName, kindName, type RoundRecord, type SkState } from "@shared/games/skat/logic";
import type { Options } from "@shared/platform/types";

const augen = (n: number) => `${n} ${n === 1 ? "Auge" : "Augen"}`;
const pts = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? "Punkt" : "Punkte"}`;

/** Name des Spiels in der Liste und in der Abrechnung */
export const recordName = (rec: RoundRecord, o?: Options) => (rec.kind === "eingepasst" ? "Eingepasst" : rec.kind === "ramsch" ? "Ramsch" : gameName(rec.game, o));

/** Rechnung zum Vorlesen: „mit 2, Spiel 3, Hand 4 – mal 10 sind 40“ */
export function valueText(rec: RoundRecord): string {
  if (!rec.game || rec.kind === "null") return `${recordName(rec)} zählt ${rec.value}`;
  let n = 0;
  const steps = rec.factors.map((f, i) => { n += f.n; return i === 0 ? f.label : `${f.label} ${n}`; });
  const sum = rec.factors.reduce((t, f) => t + f.n, 0);
  const base = `${steps.join(", ")} – mal ${rec.base} sind ${sum * rec.base}`;
  return rec.overbid ? `${base}. Gereizt waren ${rec.bid} – überreizt, das Spiel zählt ${rec.value}` : base;
}

/** Wie die Abrechnung angesagt wird – lokal das Gerät, online das Handy des Hosts */
export function settleText(rec: RoundRecord, name: (id: string | null) => string, o?: Options): string[] {
  if (rec.kind === "eingepasst") return ["Alle haben gepasst – eingepasst. Das Spiel zählt nicht."];
  if (rec.kind === "ramsch") {
    const parts = [`Ramsch: ${Object.entries(rec.augenBy).map(([id, n]) => `${name(id)} ${augen(n)}`).join(", ")}.`];
    if (rec.sweep) parts.push(`Durchmarsch! ${name(rec.sweep)} bekommt 120 Punkte.`);
    else {
      if (rec.virgins.length) parts.push(`${rec.virgins.map(name).join(" und ")} ${rec.virgins.length > 1 ? "bleiben Jungfrau" : "bleibt Jungfrau"} – das zählt doppelt.`);
      parts.push(`${rec.losers.map(name).join(" und ")} ${rec.losers.length > 1 ? "verlieren je" : "verliert"} ${pts(rec.points[rec.losers[0]])}.`);
    }
    return parts;
  }
  const d = name(rec.declarer);
  const parts: string[] = [];
  if (rec.kind === "null") parts.push(rec.won ? `${d} hat keinen Stich gemacht.` : `${d} hat einen Stich bekommen.`);
  else parts.push(`${d} hat ${augen(rec.augen)}, die Gegenspieler ${augen(120 - rec.augen)}.`);
  parts.push(`${valueText(rec)}.`);
  const p = rec.points[rec.declarer!] ?? 0;
  parts.push(`${d} ${rec.won ? "gewinnt" : "verliert"} ${gameName(rec.game, o)}: ${p > 0 ? "plus" : "minus"} ${pts(p)}.`);
  return parts;
}

/**
 * Was ein Spielleiter sagt: wer gibt und wer wem sagt, jedes Reizwort, Skat oder Hand, das Spiel, wer den Stich nimmt,
 * die Abrechnung mit Spitzen und Rechnung und am Ende den Sieger.
 */
export function narration(before: SkState | null, s: SkState, name: (id: string | null) => string, o: Options): string[] {
  const parts: string[] = [];
  const fresh = !before || before.round !== s.round;
  if (fresh && s.phase !== "roundEnd" && s.phase !== "over") {
    const [v, m] = s.active;
    parts.push(`Spiel ${s.round}. ${name(s.dealerId)} gibt${s.seats.length > 3 ? " und sitzt aus" : ""}. ${name(m)} sagt ${name(v)}.`);
  }
  if (!before) return parts;
  // neue Zeilen im Verlauf: Reizen, Skat, Spiel, Stiche
  const k = s.logN - before.logN;
  const lines = k > 0 ? s.log.slice(-Math.min(k, s.log.length)) : [];
  for (const line of lines) {
    if (/^Spiel \d+:|gibt/.test(line) && fresh) continue;
    if (/ gewinnt | verliert |verlieren den Ramsch|Durchmarsch|eingepasst/.test(line)) continue;
    const said = line.match(/^(.+): (\d+|ja|passe)$/);
    if (said) { parts.push(`${said[1]}: ${said[2]}.`); continue; }
    const trick = line.match(/^(.+) nimmt den Stich \((\d+) Augen\)$/);
    if (trick) { parts.push(`${trick[1]} nimmt den Stich mit ${augen(Number(trick[2]))}.`); continue; }
    const plays = line.match(/^(.+) spielt – gereizt bis (\d+)$/);
    if (plays) { parts.push(`${plays[1]} hat das Spiel bei ${plays[2]}. Skat aufnehmen oder Hand?`); continue; }
    if (/^Runde/.test(line)) continue;
    parts.push(`${line}.`);
  }
  if (before.phase === "declare" && s.phase === "play" && s.game) {
    parts.push(`${name(s.active[0])} spielt aus.`);
  }
  if (before.phase === "bid" && s.phase === "play" && s.ramsch) parts.push(`Es wird geramscht: wer die meisten Augen hat, verliert. ${name(s.active[0])} spielt aus.`);
  if ((s.phase === "roundEnd" || s.phase === "over") && before.phase !== "roundEnd" && before.phase !== "over") {
    const rec = s.history.at(-1);
    if (rec) parts.push(...settleText(rec, name, o));
    if (s.phase === "over") {
      const best = Math.max(...s.seats.map((id) => s.scores[id] ?? 0));
      const win = s.seats.filter((id) => (s.scores[id] ?? 0) === best).map(name);
      parts.push(`Die Liste ist zu Ende. ${win.join(" und ")} ${win.length > 1 ? "gewinnen" : "gewinnt"} mit ${best} ${Math.abs(best) === 1 ? "Punkt" : "Punkten"}.`);
    }
  }
  void kindName;
  return parts;
}
