/** Ergebnisse einer beendeten Partie für Profile und Gruppen – als Aufträge, die notfalls wiederholt werden */
import type { PlayerResult } from "../../shared/platform/types";
import type { ResultJob, RoomData } from "./types";

/** Kennung einer Partie: gleiche Kennung = dasselbe Ergebnis (Profile und Gruppen zählen es nur einmal) */
export const resultEvent = (room: Pick<RoomData, "code" | "createdAt">, round: number) => `${room.code ?? ""}:${room.createdAt}:${round}`;

/** Aufträge je Profil und je Gruppe der Mitspieler */
export function resultJobs(room: Pick<RoomData, "code" | "createdAt" | "profiles" | "groups">, gameId: string, round: number, results: PlayerResult[], now: number): ResultJob[] {
  const event = resultEvent(room, round);
  const players = results.length;
  const jobs: ResultJob[] = [];
  for (const r of results) {
    const pid = room.profiles?.[r.id];
    if (pid) jobs.push({ kind: "profile", target: pid, event, since: now, entry: { gameId, at: now, won: r.won, score: r.score, players, online: true } });
  }
  // Gruppen der Mitspieler: jede bekommt das Ergebnis aller, die dort Mitglied sind
  const entries = results.flatMap((r) => (room.profiles?.[r.id] ? [{ profile: room.profiles[r.id], won: r.won }] : []));
  const codes = new Set(Object.entries(room.groups ?? {}).filter(([id]) => results.some((r) => r.id === id)).map(([, c]) => c));
  for (const c of codes) jobs.push({ kind: "group", target: c, event, since: now, gameId, entries });
  return jobs;
}
