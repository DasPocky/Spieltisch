/**
 * Eigene Kartensets am Gerät: Liste, Laden, Speichern, Vorschlagen, Bilder hochladen.
 * Wer fragt, weist sich mit Profil-ID und Geräteschlüssel aus (siehe profile.ts) – die ID allein reicht nicht.
 * Für „Ein Handy für alle“ merkt sich das Gerät die Inhalte gewählter Sets, damit sie auch ohne Netz gehen.
 */
import { SET_IMAGE_MAX_BYTES, SET_IMAGE_SIZE, type CardSet, type CardSetData, type CardSetInfo, type GameContent, type SetKind, type SetStatus } from "@shared/platform/cardsets";
import { myProfile, profileHeaders } from "./profile";
import { readJSON, writeJSON } from "./storage";

const CACHE_KEY = "spieltisch:sets-cache";
const headers = (json = false): Record<string, string> => ({ "x-profile": myProfile().id, ...profileHeaders(), ...(json ? { "content-type": "application/json" } : {}) });

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init }).catch(() => null);
  if (!res) throw new Error("Keine Verbindung zum Server.");
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Das ging gerade nicht.");
  return data;
}

export const mySets = (kind?: SetKind) => call<{ sets: CardSetInfo[] }>(`/api/sets${kind ? `?kind=${kind}` : ""}`, { headers: headers() }).then((r) => r.sets);
export const publicSets = (kind: SetKind) => call<{ sets: CardSetInfo[] }>(`/api/sets/public?kind=${kind}`).then((r) => r.sets);
export const loadSet = (id: string) => call<{ set: CardSet }>(`/api/sets/${id}`, { headers: headers() }).then((r) => r.set);

export const saveSet = (id: string, kind: SetKind, name: string, data: CardSetData, showName = false) =>
  call<{ set: CardSet }>(`/api/sets/${id}`, { method: "PUT", headers: headers(true), body: JSON.stringify({ kind, name, data, showName }) }).then((r) => r.set);

export const deleteSet = (id: string) => call<{ ok: true }>(`/api/sets/${id}`, { method: "DELETE", headers: headers() });

/** Für alle vorschlagen bzw. zurückziehen – liefert den neuen Status */
export const submitSet = (id: string, back = false) =>
  call<{ status: SetStatus }>(`/api/sets/${id}/${back ? "withdraw" : "submit"}`, { method: "POST", headers: headers() }).then((r) => r.status);

/**
 * Bild fürs Set: auf höchstens SET_IMAGE_SIZE Pixel verkleinern (Seitenverhältnis bleibt), als JPEG – meist 20–60 KB.
 * Liefert „bild:<schlüssel>“ für den Inhalt des Sets.
 */
export async function uploadSetImage(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Das ist kein Bild.");
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { throw new Error("Das Bild ließ sich nicht öffnen."); }
  const scale = Math.min(1, SET_IMAGE_SIZE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  let blob: Blob | null = null;
  for (const q of [0.85, 0.72, 0.58]) {
    blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", q));
    if (blob && blob.size <= SET_IMAGE_MAX_BYTES) break;
    blob = null;
  }
  if (!blob) throw new Error("Das Bild ist zu groß.");
  const r = await call<{ value: string }>("/api/sets/image", { method: "POST", headers: headers(), body: blob });
  return r.value;
}

// ----- Merken für „Ein Handy für alle“ -----

type Cache = Record<string, { name: string; kind: SetKind; data: CardSetData; at: number }>;

/** Inhalt eines gewählten Sets laden und auf dem Gerät merken (fürs Spielen ohne Server) */
export async function cacheSet(id: string): Promise<CardSet> {
  const set = await loadSet(id);
  const cache = readJSON<Cache>(CACHE_KEY) ?? {};
  cache[id] = { name: set.name, kind: set.kind, data: { black: set.black, white: set.white, words: set.words, questions: set.questions }, at: Date.now() };
  // Nicht unbegrenzt: die 20 zuletzt gewählten
  const keep = Object.entries(cache).sort((a, b) => b[1].at - a[1].at).slice(0, 20);
  writeJSON(CACHE_KEY, Object.fromEntries(keep));
  return set;
}

/** Inhalte der gewählten Sets aus dem Gerätespeicher – nur Sets der passenden Art */
export function cachedContent(ids: string[], kind: SetKind): GameContent {
  const cache = readJSON<Cache>(CACHE_KEY) ?? {};
  return { sets: ids.flatMap((id) => (cache[id]?.kind === kind ? [{ id, name: cache[id].name, data: cache[id].data }] : [])) };
}
