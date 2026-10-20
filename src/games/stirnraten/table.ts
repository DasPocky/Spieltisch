import type { RoomState } from "@shared/platform/room";
import { catName, STYLE_BY_ID, wordText } from "@shared/games/stirnraten/cards";
import { deadlineOf, teamName, type StirnState } from "@shared/games/stirnraten/logic";
import type { TableModel } from "../../platform/table/model";
import { TEAM_COLORS } from "./colors";

/**
 * Stirnraten am Fernseher: Aufsteller mit wer rät, Uhr und Darstellungsart – nie der Begriff, der Ratende schaut mit.
 * Nach dem Zug liegen die Karten offen in der Mitte (erratene grün).
 */
export function stirnratenTable(room: RoomState): TableModel | null {
  const s = room.game as StirnState;
  if (s.phase === "over") return null;
  const name = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? "";
  const ids = room.players.map((p) => p.id);
  const teamOf = (id: string) => s.teams.findIndex((t) => t.includes(id));
  const notes = Object.fromEntries(ids.map((id) => {
    if (s.variant === "teams") { const t = teamOf(id); return [id, t >= 0 ? `${teamName(t).replace("Team ", "")} · ${s.teamScores[t] ?? 0}` : ""]; }
    if (s.variant === "bombe") return [id, `💣 ${s.bombs[id] ?? 0}`];
    return [id, `${s.scores[id] ?? 0} Pkt.`];
  }));
  const hits = s.cards.filter((c) => c.r === "hit").length;
  const cur = s.cards.at(-1);
  const who = `${name(s.guesser)}${s.team !== null ? ` (${teamName(s.team)})` : ""}`;
  let sign: TableModel["sign"] | null;
  let words5: TableModel["words5"];
  switch (s.phase) {
    case "pick": sign = { title: `${who} ist dran`, sub: "wählt eine Kategorie" }; break;
    case "ready": sign = { title: `${who} ist dran`, sub: `${catName(s.cat)} · Handy an die Stirn!` }; break;
    case "play": sign = { title: `${who} rät · ✓ ${hits}`, sub: cur ? `${STYLE_BY_ID[cur.style].emoji} ${STYLE_BY_ID[cur.style].name}${cur.open ? " · alle raten mit!" : ""} · ${catName(s.cat)}` : catName(s.cat), endsAt: deadlineOf(s) }; break;
    case "review":
      // Die Liste liegt offen in der Mitte (ohne Aufsteller, der sie verdecken würde)
      sign = null;
      words5 = { cols: Math.min(6, Math.max(3, Math.ceil(Math.sqrt(s.cards.length)))), title: `${hits} erraten · ${who}`, cells: s.cards.map((c) => ({ text: wordText(c.w, s.custom), tone: c.r === "hit" ? "#16a34a" : undefined })) };
      break;
    case "bomb": sign = { title: `💣 ${name(s.holder)} hat die Bombe`, sub: `${catName(s.cat)} · ${s.passes} weitergegeben` }; break;
    case "boom": sign = { title: "💥 Bumm!", sub: `Bei ${name(s.holder)} hochgegangen` }; break;
    case "look": sign = { title: `Runde ${s.turn + 1} von ${s.turns}`, sub: `Begriff ansehen · ${s.seen.length} von ${s.order.length}` }; break;
    case "talk": sign = { title: `${name(s.speakOrder[s.speaker % s.speakOrder.length] ?? null)} sagt ein Wort`, sub: `Kategorie: ${catName(s.cat)}` }; break;
    case "vote": sign = { title: "Wer ist der Hochstapler?", sub: `${Object.keys(s.votes).length} von ${s.order.length} haben abgestimmt` }; break;
    case "guess": sign = { title: "Erwischt!", sub: "Der Hochstapler rät den Begriff" }; break;
    case "reveal": sign = { title: s.result?.winner === "impostor" ? "Der Hochstapler gewinnt" : "Hochstapler entlarvt", sub: s.result ? `${name(s.result.impostor)} · Begriff: ${wordText(s.result.word)}` : undefined }; break;
    default: sign = { title: "Stirnraten" };
  }
  const turn = s.phase === "bomb" || (s.variant === "bombe" && s.phase === "ready") ? s.holder
    : s.phase === "talk" ? s.speakOrder[s.speaker % s.speakOrder.length] ?? null : s.guesser;
  return {
    deck: "zahlen", pile: 0, discard: [], counts: {}, turn, n: s.log.length, log: s.log.slice(-6),
    scores: s.variant === "bombe" ? s.bombs : s.variant === "teams" ? Object.fromEntries(ids.map((id) => [id, s.teamScores[teamOf(id)] ?? 0])) : s.scores,
    notes, sign: sign ?? undefined, words5,
    ...(s.variant === "teams" ? { color: s.team !== null ? { label: teamName(s.team), hex: TEAM_COLORS[s.team % TEAM_COLORS.length] } : undefined } : {}),
  };
}
