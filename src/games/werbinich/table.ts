import type { RoomState } from "@shared/platform/room";
import { ANSWER_TEXT, active, counts, deadlineOf, voters, type WbState } from "@shared/games/werbinich/logic";
import type { TableModel } from "../../platform/table/model";

/**
 * Wer bin ich am Fernseher: wer fragt, die Frage und die Abstimmung live, wer schon erraten hat – nie eine Figur
 * (der Fragende schaut mit; die Sicht des Fernsehers enthält keine). Die Auflösung zeigt danach das Ergebnis.
 */
export function werbinichTable(room: RoomState): TableModel | null {
  const s = room.game as WbState;
  if (s.phase === "over") return null;
  const name = (id: string | null) => (id && (s.names[id] ?? room.players.find((p) => p.id === id)?.name)) || "";
  const notes = Object.fromEntries(s.order.map((id) => [id, s.left.includes(id) ? "ausgestiegen" : s.solved.includes(id) ? `erraten ✓ · ${s.scores[id] ?? 0} Pkt.` : s.phase === "write" ? (s.drafts[id] !== undefined ? "fertig ✓" : "schreibt …") : "rät noch"]));
  const base = { deck: "zahlen" as const, pile: 0, discard: [], counts: {}, turn: s.phase === "write" ? null : s.asker, n: s.log.length, log: s.log.slice(-6), scores: s.scores, notes };
  const c = counts(s);
  const tally = `Ja ${c.ja} · Nein ${c.nein} · Weiß nicht ${c.egal} · ${c.ja + c.nein + c.egal} von ${voters(s).length}`;
  const round = `Runde ${Math.min(s.lap + 1, s.laps)} von ${s.laps}`;
  const last = s.last ? `Zuletzt: ${name(s.last.asker)} – ${s.last.kind === "frage" ? `${s.last.text}: ${ANSWER_TEXT[s.last.result]}` : s.last.result === "ja" ? "erraten!" : "falsch geraten"}` : round;
  switch (s.phase) {
    case "write": return { ...base, sign: { title: "Figuren werden geschrieben", sub: `jeder für seinen Nachbarn · ${active(s).length} Spieler` } };
    case "ask": return { ...base, sign: { title: `${name(s.asker)} ist dran`, sub: last } };
    case "vote": return { ...base, sign: { title: s.question ? `${name(s.asker)}: ${s.question}` : `${name(s.asker)} fragt`, sub: tally, endsAt: deadlineOf(s) } };
    case "guess": return { ...base, sign: { title: `${name(s.asker)} rät${s.guess ? `: ${s.guess}` : ""}`, sub: `Richtig ${c.ja} · Falsch ${c.nein} · ${round}`, endsAt: deadlineOf(s) } };
  }
}
