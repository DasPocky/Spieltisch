import { navigate } from "@/hooks/useRoute";
import { LAST_GAME_KEY, LOCAL_GAME_KEY, readStr, writeStr } from "./storage";


/** Raum bzw. lokale Partie mit dem zuletzt gespielten (oder ersten freien) Spiel – gewechselt wird in der Lobby */
export function defaultGame(ids: string[], locked: (id: string) => boolean): string {
  const free = ids.filter((id) => !locked(id));
  const last = readStr(LAST_GAME_KEY);
  return last && free.includes(last) ? last : free[0] ?? ids[0] ?? "alles";
}

/** Ein Handy für alle: gleich in die lokale Lobby – mit dem gewählten oder zuletzt lokal gespielten Spiel */
export function playLocal(ids: string[], locked: (id: string) => boolean, pick?: string, replace = false) {
  const prev = readStr(LOCAL_GAME_KEY);
  const id = pick && ids.includes(pick) ? pick : prev && ids.includes(prev) ? prev : defaultGame(ids, locked);
  writeStr(LOCAL_GAME_KEY, id);
  navigate("/lokal", replace);
}
