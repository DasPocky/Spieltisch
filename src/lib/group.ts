/**
 * Gruppen auf diesem Gerät: Liste der Gruppencodes, die aktive Gruppe und ein Zwischenspeicher der letzten Sicht
 * (damit Startseite und Lobby sofort etwas zeigen). Die Wahrheit liegt im Durable Object der Gruppe.
 */
import { useSyncExternalStore } from "react";
import { GROUP_CODE_RE, type GroupPreview, type GroupView } from "@shared/platform/group";
import { fetchStats, myAvatar, myName, myProfile, setLocalAvatar, adoptProfile } from "./profile";
import { NAME_KEY, readJSON, writeJSON } from "./storage";

const KEY = "spieltisch:groups";
const PLAYERS_KEY = "spieltisch:groupPlayers";

export interface MyGroups {
  codes: string[];
  active: string | null;
  cache: Record<string, GroupView>;
}

function read(): MyGroups {
  const raw = readJSON<Partial<MyGroups>>(KEY);
  const codes = Array.isArray(raw?.codes) ? raw.codes.filter((c) => typeof c === "string" && GROUP_CODE_RE.test(c)) : [];
  const active = raw?.active && codes.includes(raw.active) ? raw.active : codes[0] ?? null;
  return { codes, active, cache: raw?.cache && typeof raw.cache === "object" ? raw.cache : {} };
}

let current = read();
const listeners = new Set<() => void>();
function set(next: MyGroups) {
  current = next;
  writeJSON(KEY, next);
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY || e.key === null) { current = read(); listeners.forEach((l) => l()); } });
}

export const myGroups = () => current;
export function useMyGroups(): MyGroups {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}

/** Aktive Gruppe (zuletzt bekannte Sicht) oder null */
export function useActiveGroup(): GroupView | null {
  const g = useMyGroups();
  return g.active ? g.cache[g.active] ?? null : null;
}

export const activeGroupCode = () => current.active;

export function setActive(code: string) {
  if (current.codes.includes(code)) set({ ...current, active: code });
}

/** Gruppe merken (vorn einsortiert, wird aktiv) */
function remember(view: GroupView, activate = true) {
  const codes = current.codes.includes(view.code) ? current.codes : [view.code, ...current.codes];
  set({ codes, active: activate || !current.active ? view.code : current.active, cache: { ...current.cache, [view.code]: view } });
}

/** Gruppe vergessen (ausgetreten oder entfernt worden) */
export function forget(code: string) {
  const codes = current.codes.filter((c) => c !== code);
  const { [code]: _gone, ...cache } = current.cache;
  set({ codes, active: current.active === code ? codes[0] ?? null : current.active, cache });
}

type Answer = { group?: GroupView; preview?: GroupPreview; gone?: boolean; error?: string };

async function call(path: string, method = "GET", body?: Record<string, unknown>): Promise<Answer> {
  try {
    const res = await fetch(path, {
      method,
      cache: "no-store",
      headers: body ? { "content-type": "application/json" } : { "x-profile": myProfile().id },
      body: body ? JSON.stringify({ ...body, profile: myProfile().id }) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as Answer;
    if (!res.ok) return { error: data.error ?? "Das ging gerade nicht." };
    return data;
  } catch { return { error: "Keine Verbindung zum Server." }; }
}

/** Gruppe laden. Mitglieder bekommen alles (und der Zwischenspeicher wird frisch), andere die Vorschau. */
export async function loadGroup(code: string): Promise<Answer> {
  const res = await call(`/api/groups/${code}`);
  if (res.group) { if (current.codes.includes(code)) set({ ...current, cache: { ...current.cache, [code]: res.group } }); else remember(res.group, !current.active); }
  // Nicht mehr Mitglied (entfernt worden) oder Gruppe weg
  else if ((res.preview || res.error === "Diese Gruppe gibt es nicht.") && current.codes.includes(code)) forget(code);
  return res;
}

const me = () => ({ name: myName(), avatar: myAvatar() });

export function saveMyName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* egal */ }
}

export async function createGroup(name: string): Promise<Answer> {
  const { name: member, avatar } = me();
  const res = await call("/api/groups", "POST", { name, member, avatar });
  if (res.group) remember(res.group);
  return res;
}

export async function joinGroup(code: string): Promise<Answer> {
  const res = await call(`/api/groups/${code}/join`, "POST", me());
  if (res.group) remember(res.group);
  return res;
}

export async function renameGroup(code: string, name: string): Promise<Answer> {
  const res = await call(`/api/groups/${code}`, "PUT", { name });
  if (res.group) remember(res.group, false);
  return res;
}

export async function removeMember(code: string, member: string): Promise<Answer> {
  const res = await call(`/api/groups/${code}/remove`, "POST", { member });
  if (res.gone) forget(code);
  else if (res.group) remember(res.group, false);
  return res;
}

/** Lokale Partie: Ergebnis der Mitglieder am Tisch melden */
export async function reportGroupResult(code: string, gameId: string, players: { id: string; won: boolean }[]): Promise<Answer> {
  const res = await call(`/api/groups/${code}/result`, "POST", { gameId, players });
  if (res.group) remember(res.group, false);
  return res;
}

/** Eigenen Namen und Avatar in allen Gruppen aktualisieren */
export async function syncMe() {
  if (!myName()) return;
  await Promise.all(current.codes.map(async (code) => {
    const res = await call(`/api/groups/${code}/join`, "POST", me());
    if (res.group) remember(res.group, false);
  }));
}

/** Profil übernehmen (Übertragungs-Code oder Profil-Code): Name, Avatar und Gruppen kommen mit */
export async function adoptAndSync(id: string) {
  adoptProfile(id);
  set({ codes: [], active: null, cache: {} });
  const stats = await fetchStats(id);
  if (stats?.name) saveMyName(stats.name);
  setLocalAvatar(stats?.avatar);
  for (const code of [...(stats?.groups ?? [])].reverse()) await loadGroup(code);
  const first = stats?.groups?.find((c) => current.codes.includes(c));
  if (first) setActive(first);
}

// ----- Lokale Spieler, die aus der Gruppe kommen -----

interface Link { code: string; member: string }

/** Lokaler Spieler (zufällige ID) gehört zu diesem Gruppenmitglied */
export function linkLocalPlayer(playerId: string, code: string, member: string) {
  const all = readJSON<Record<string, Link>>(PLAYERS_KEY) ?? {};
  all[playerId] = { code, member };
  // Nur die letzten paar merken
  writeJSON(PLAYERS_KEY, Object.fromEntries(Object.entries(all).slice(-80)));
}

export function localLinks(): Record<string, Link> {
  return readJSON<Record<string, Link>>(PLAYERS_KEY) ?? {};
}
