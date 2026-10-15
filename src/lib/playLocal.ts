import { navigate } from "@/hooks/useRoute";
import { LAST_GAME_KEY, LOCAL_GAME_KEY } from "./storage";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/** Raum bzw. lokale Partie mit dem zuletzt gespielten (oder ersten freien) Spiel – gewechselt wird in der Lobby */
export function defaultGame(ids: string[], locked: (id: string) => boolean): string {
  const free = ids.filter((id) => !locked(id));
  const last = read(LAST_GAME_KEY);
  return last && free.includes(last) ? last : free[0] ?? ids[0] ?? "tutto";
}

/** Ein Handy für alle: gleich in die lokale Lobby – mit dem gewählten oder zuletzt lokal gespielten Spiel */
export function playLocal(ids: string[], locked: (id: string) => boolean, pick?: string, replace = false) {
  const prev = read(LOCAL_GAME_KEY);
  const id = pick && ids.includes(pick) ? pick : prev && ids.includes(prev) ? prev : defaultGame(ids, locked);
  try { localStorage.setItem(LOCAL_GAME_KEY, id); } catch { /* egal */ }
  navigate("/lokal", replace);
}
