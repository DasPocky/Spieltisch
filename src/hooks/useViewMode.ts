import { readStr, writeStr } from "@/lib/storage";
import { createStore } from "@/lib/store";

/** "simple": große Tasten, wenig Text. "full": alle Tasten und Infos. Gilt pro Gerät. */
export type ViewMode = "simple" | "full";

const KEY = "spieltisch:view";
const store = createStore<ViewMode>(readStr(KEY) === "full" ? "full" : "simple");

export function setViewMode(mode: ViewMode) {
  writeStr(KEY, mode);
  store.set(mode);
}

export const useViewMode = store.use;
