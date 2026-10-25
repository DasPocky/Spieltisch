import type { RoomState } from "@shared/platform/room";
import { deadlineOf, stageStart, STYLES, styleOf, teamName, teamOf, termText, turnPoints, type ErkState } from "@shared/games/erklaerspiel/logic";
import type { TableModel } from "../../platform/table/model";
import { TEAM_COLORS } from "../stirnraten/colors";

/**
 * Erklärspiel am Fernseher: Aufsteller mit Team, Erklärer, Uhr und Treffern – nie der Begriff während des Zugs
 * (das ratende Team schaut mit). Nach dem Zug liegen die Begriffe offen in der Mitte (erratene grün).
 */
export function erklaerspielTable(room: RoomState): TableModel | null {
  const s = room.game as ErkState;
  if (s.phase === "over") return null;
  const name = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? "";
  const ids = room.players.map((p) => p.id);
  const notes = Object.fromEntries(ids.map((id) => { const t = teamOf(s, id); return [id, t >= 0 ? `${teamName(t).replace("Team ", "")} · ${s.teamScores[t] ?? 0}` : ""]; }));
  const st = STYLES[styleOf(s)];
  const team = teamName(s.team);
  const { hits, points } = turnPoints(s);
  const round = s.variant === "drei" ? `Runde ${s.stage + 1}/3 · ${s.left} Begriffe übrig` : `Zug ${Math.min(s.turn + 1, s.turns)} von ${s.turns}`;
  let sign: TableModel["sign"] | undefined;
  let words5: TableModel["words5"];
  switch (s.phase) {
    case "ready": sign = { title: `${team}: ${name(s.explainer)} erklärt`, sub: `${stageStart(s) && s.stage > 0 ? "Neue Runde! " : ""}${st.emoji} ${st.name} · ${round}` }; break;
    case "play": sign = { title: `${team} · ✓ ${hits}`, sub: `${name(s.explainer)} erklärt · ${st.emoji} ${st.name}`, endsAt: deadlineOf(s) }; break;
    case "review":
      sign = undefined;
      words5 = {
        cols: Math.min(6, Math.max(3, Math.ceil(Math.sqrt(s.cards.length)))),
        title: `${team}: ${hits} erraten · ${points >= 0 ? "+" : ""}${points}`,
        cells: s.cards.map((c) => ({ text: termText(c.w), tone: c.r === "hit" ? "#16a34a" : undefined })),
      };
      break;
  }
  return {
    deck: "zahlen", pile: 0, discard: [], counts: {}, turn: s.explainer, n: s.log.length, log: s.log.slice(-6),
    scores: Object.fromEntries(ids.map((id) => [id, s.teamScores[teamOf(s, id)] ?? 0])), notes, sign, words5,
    color: s.team !== null ? { label: team, hex: TEAM_COLORS[s.team % TEAM_COLORS.length] } : undefined,
  };
}
