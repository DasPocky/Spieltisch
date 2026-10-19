import type { RoomState } from "@shared/platform/room";
import { ROLES, type WerwolfState } from "@shared/games/werwolf/logic";
import type { TableModel } from "../../platform/table/model";

export const TEAM_TONE: Record<string, string> = { werwolf: "#b8352c", dorf: "#2f8f4a" };

/**
 * Werwolf am Tisch: Aufsteller mit Phase in der Mitte, nachts gedimmtes Licht; vor jedem Platz die eigene Karte verdeckt –
 * aufgedeckt nur, was auch alle wissen dürfen (Tote bei offenen Karten, entlarvte Dorfdeppen). Der Spielleiter liest vor.
 */
export function werwolfTable(room: RoomState): TableModel | null {
  const s = room.game as WerwolfState & { known?: string[] };
  if (s.phase === "over") return null;
  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? "";
  const ids = Object.keys(s.roles);
  const alive = ids.filter((id) => s.alive[id]);
  const known = new Set(s.known ?? []);
  const deaths = s.news?.deaths.map((d) => name(d.id)).filter(Boolean) ?? [];
  const voted = Object.keys(s.votes ?? {}).length;
  const sign: NonNullable<TableModel["sign"]> =
    s.phase === "assign" ? { title: "Karten verteilen", sub: "Der Spielleiter ordnet die Karten zu" }
    : s.phase === "reveal" ? { title: "Schaut eure Karte an", sub: `${s.ready.length} von ${ids.length} bereit` }
    : s.phase === "night" ? { title: `Nacht ${s.night}`, sub: "Das Dorf schläft – alle Augen zu" }
    : s.phase === "election" ? { title: "Hauptmannwahl", sub: `${voted} von ${alive.length} haben gewählt` }
    : s.phase === "hunter" ? { title: "Der Jäger schießt", sub: "Er nimmt jemanden mit" }
    : s.phase === "successor" ? { title: "Neuer Hauptmann", sub: "Der alte bestimmt den Nachfolger" }
    : { title: `Tag ${s.night}`, sub: s.news?.kind === "night" ? (deaths.length ? `Heute Nacht gestorben: ${deaths.join(", ")}` : "Heute Nacht ist niemand gestorben") : `${voted} von ${alive.length} haben abgestimmt` };
  return {
    deck: "zahlen", pile: 0, discard: [], counts: {}, turn: null, n: s.log.length, log: s.log.slice(-6),
    notes: Object.fromEntries(ids.map((id) => [id, !s.alive[id] ? "† tot" : s.captain === id ? "Hauptmann" : s.phase === "day" && s.votes?.[id] !== undefined ? "abgestimmt ✓" : "lebt"])),
    boards: Object.fromEntries(ids.map((id) => {
      const r = s.roles[id];
      return [id, { cols: 1, cells: [known.has(id) && r ? { text: ROLES[r].name, tone: TEAM_TONE[ROLES[r].team] ?? "#6d62a3" } : ("?" as const)] }];
    })),
    sign, night: s.phase === "night",
  };
}
