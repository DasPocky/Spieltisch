/** Feste Gruppen: Mitglieder, Bestenliste, Pinnwand */
import { DurableObject } from "cloudflare:workers";
import { isGameId } from "../shared/games";
import { addGroupResult, newGroup, previewGroup, removeMember, sanitizeGroupResult, upsertMember, viewGroup, cleanGroupName, type GroupData, type GroupPreview, type GroupView } from "../shared/platform/group";
import { Env, settingsOf } from "./env";
import { GAME_IDS } from "./settings";

/** Gruppen ohne Aktivität werden nach einem Jahr gelöscht */
export const GROUP_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** Lokale Ergebnisse: höchstens so viele je Gruppe in 10 Minuten */
export const GROUP_POSTS = 30;
export type GroupAnswer = { ok: true; group: GroupView } | { ok: false; status: number; error: string };
/** Ein Durable Object pro Gruppe (Name = Gruppencode): Mitglieder und Bestenliste. */
export class GroupStore extends DurableObject<Env> {
  private group: GroupData | null = null;
  private posts: number[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.group = (await ctx.storage.get<GroupData>("group")) ?? null; });
  }

  /** Neue Gruppe mit dem ersten Mitglied. null, wenn der Code schon vergeben ist. */
  async init(code: string, name: string, profileId: string, member: string, avatar: unknown): Promise<GroupView | null> {
    if (this.group) return null;
    const g = newGroup(code, name, Date.now());
    const id = upsertMember(g, profileId, member, avatar, Date.now());
    this.group = g;
    await this.save();
    try { await settingsOf(this.env).feature("group"); } catch { /* nur ein Extra */ }
    return viewGroup(g, id);
  }

  /** Mitglieder sehen alles, andere nur Name und Größe */
  async get(profileId: string | null): Promise<{ group?: GroupView; preview?: GroupPreview } | null> {
    const g = this.group;
    if (!g) return null;
    const id = profileId ? g.keys[profileId] : undefined;
    return id ? { group: viewGroup(g, id) } : { preview: previewGroup(g) };
  }

  async memberOf(profileId: string): Promise<string | null> {
    return this.group?.keys[profileId] ?? null;
  }

  /** Beitreten oder eigenen Namen/Avatar aktualisieren */
  async join(profileId: string, name: unknown, avatar: unknown): Promise<GroupAnswer> {
    const g = this.group;
    if (!g) return { ok: false, status: 404, error: "Diese Gruppe gibt es nicht." };
    try {
      const id = upsertMember(g, profileId, name, avatar, Date.now());
      await this.save();
      return { ok: true, group: viewGroup(g, id) };
    } catch (e) {
      return { ok: false, status: 400, error: e instanceof Error ? e.message : "Beitritt nicht möglich." };
    }
  }

  async rename(profileId: string, name: unknown): Promise<GroupAnswer> {
    const g = this.group;
    const id = g?.keys[profileId];
    if (!g || !id) return { ok: false, status: 403, error: "Du bist nicht in dieser Gruppe." };
    const clean = cleanGroupName(name);
    if (!clean) return { ok: false, status: 400, error: "Bitte gib einen Namen ein." };
    g.name = clean;
    await this.save();
    return { ok: true, group: viewGroup(g, id) };
  }

  /** Jedes Mitglied darf jedes entfernen (auch sich selbst = austreten). Leere Gruppen verschwinden. */
  async remove(profileId: string, memberId: string): Promise<GroupAnswer | { ok: true; gone: true }> {
    const g = this.group;
    const id = g?.keys[profileId];
    if (!g || !id) return { ok: false, status: 403, error: "Du bist nicht in dieser Gruppe." };
    if (!removeMember(g, memberId)) return { ok: false, status: 404, error: "Dieses Mitglied gibt es nicht." };
    if (!g.members.length) {
      this.group = null;
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      return { ok: true, gone: true };
    }
    await this.save();
    return memberId === id ? { ok: true, gone: true } : { ok: true, group: viewGroup(g, id) };
  }

  /** Lokale Partie: ein Mitglied meldet das Ergebnis der Mitglieder am Tisch */
  async result(profileId: string, body: unknown): Promise<GroupAnswer> {
    const g = this.group;
    const id = g?.keys[profileId];
    if (!g || !id) return { ok: false, status: 403, error: "Du bist nicht in dieser Gruppe." };
    const now = Date.now();
    this.posts = this.posts.filter((t) => now - t < 10 * 60 * 1000);
    if (this.posts.length >= GROUP_POSTS) return { ok: false, status: 429, error: "Zu viele Ergebnisse auf einmal." };
    const r = sanitizeGroupResult(body, GAME_IDS, g.members.map((m) => m.id));
    if (!r) return { ok: false, status: 400, error: "Ungültiges Ergebnis." };
    this.posts.push(now);
    addGroupResult(g, r);
    await this.save();
    return { ok: true, group: viewGroup(g, id) };
  }

  /** Online-Partie (vom Raum): nur Mitglieder zählen */
  /** `event`: Kennung der Partie – eine Wiederholung (nach einem Fehler) zählt nicht doppelt */
  async recordOnline(gameId: string, entries: { profile: string; won: boolean }[], event?: string): Promise<void> {
    const g = this.group;
    if (!g || !isGameId(gameId)) return;
    if (event) {
      const done = (await this.ctx.storage.get<string[]>("events")) ?? [];
      if (done.includes(event)) return;
      await this.ctx.storage.put("events", [...done, event].slice(-50));
    }
    const players = entries.flatMap((e) => (g.keys[e.profile] ? [{ id: g.keys[e.profile], won: e.won }] : []));
    if (!players.length) return;
    addGroupResult(g, { gameId, players });
    await this.save();
  }

  async alarm(): Promise<void> {
    this.group = null;
    await this.ctx.storage.deleteAll();
  }

  private async save() {
    await this.ctx.storage.put("group", this.group);
    await this.ctx.storage.setAlarm(Date.now() + GROUP_TTL_MS);
    const g = this.group;
    if (g) { try { await settingsOf(this.env).groupSeen({ code: g.code, name: g.name, members: g.members.length, createdAt: g.createdAt, lastAt: Date.now() }); } catch { /* nur ein Extra */ } }
  }

  /** Admin: Gruppe komplett löschen */
  async wipe(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.group = null;
  }
}
