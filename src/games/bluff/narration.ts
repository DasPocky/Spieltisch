import { bidSpoken, faceName, type BluffState } from "@shared/games/bluff/logic";

const NUM = ["keine", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const num = (n: number) => NUM[n] ?? String(n);

/** Was ein Spielleiter sagt: wer beginnt, jede Ansage, „Bluff!“ oder „Genau!“, was wirklich liegt und wer einen Würfel verliert. Lokal das Gerät, online das Handy des Hosts. */
export function narration(before: BluffState | null, s: BluffState, name: (id: string | null) => string, jokers: boolean): string[] {
  const parts: string[] = [];
  const fresh = s.phase === "bid" && (!before || before.round !== s.round || before.phase !== "bid");
  if (fresh) {
    if (!before) parts.push(`Jeder hat ${num(s.count[Object.keys(s.count)[0]] ?? 0)} Würfel unter seinem Becher.${jokers ? " Einsen sind Joker." : ""}`);
    else if (before.round === s.round) parts.push("Alle würfeln neu.");
    parts.push(s.table ? `Alle schütteln die Becher. ${name(s.curId)} sagt zuerst an.` : `Neue Runde. ${name(s.curId)} sagt zuerst an.`);
    return parts;
  }
  if (!before) return parts;
  if (s.phase === "bid" && s.bids.length > before.bids.length) {
    const b = s.bids.at(-1)!;
    parts.push(`${name(b.by)}: mindestens ${bidSpoken(b)}.`);
  }
  if (s.phase === "reveal" && before.phase === "bid" && s.reveal) {
    const r = s.reveal;
    parts.push(r.kind === "bluff" ? `${name(r.by)} ruft: Bluff!` : `${name(r.by)} ruft: Genau!`);
    parts.push(`Alle decken auf. Es liegen ${num(r.actual)} ${faceName(r.bid.face, r.actual)}${jokers && r.bid.face !== 1 ? " mit Jokern" : ""}. Angesagt waren ${bidSpoken(r.bid)}.`);
    if (r.loser) parts.push(r.out ? `${name(r.loser)} verliert den letzten Würfel und ist raus.` : `${name(r.loser)} verliert einen Würfel.`);
    else if (r.gainer) parts.push(`Genau richtig! ${name(r.gainer)} bekommt einen Würfel zurück.`);
    else parts.push(`Genau richtig! ${name(r.by)} hat schon alle Würfel.`);
    if (r.final) parts.push(`${name(Object.entries(s.count).find(([, n]) => n > 0)?.[0] ?? null)} gewinnt!`);
  }
  return parts;
}
