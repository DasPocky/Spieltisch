/** Profile (Statistik je Gerät) und Übertragungs-Codes aufs neue Handy */
import { DurableObject } from "cloudflare:workers";
import { addResult, emptyStats, MAX_PROFILE_GROUPS, PROFILE_ID_RE, TRANSFER_MS, type ProfileStats, type RecentGame } from "../shared/platform/profile";
import { GROUP_CODE_RE, sanitizeAvatar } from "../shared/platform/group";
import { cleanName } from "../shared/platform/room";
import { Env, settingsOf } from "./env";

/** Ein Durable Object pro Profil: Name und Statistik. Ohne Aktivität nach einem Jahr gelöscht. */
export const PROFILE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export class ProfileStore extends DurableObject<Env> {
  private stats: ProfileStats | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.stats = (await ctx.storage.get<ProfileStats>("stats")) ?? null; });
  }

  async get(): Promise<ProfileStats> {
    return this.stats ?? emptyStats(Date.now());
  }

  async record(entry: RecentGame, id?: string): Promise<ProfileStats> {
    if (id && PROFILE_ID_RE.test(id)) this.pid = id;
    this.stats = addResult(this.stats ?? emptyStats(Date.now()), entry);
    await this.save();
    return this.stats;
  }

  /** Name und/oder Avatar setzen (fehlende Felder bleiben) */
  async update(name: unknown, avatar: unknown): Promise<ProfileStats> {
    const s = { ...(this.stats ?? emptyStats(Date.now())) };
    if (name !== undefined) s.name = cleanName(name);
    const av = sanitizeAvatar(avatar);
    if (av) s.avatar = av;
    this.stats = s;
    await this.save();
    return s;
  }

  /** Gruppe merken bzw. vergessen (für den Umzug aufs neue Handy) */
  async setGroup(code: string, member: boolean): Promise<void> {
    if (!GROUP_CODE_RE.test(code)) return;
    const s = { ...(this.stats ?? emptyStats(Date.now())) };
    const rest = (s.groups ?? []).filter((c) => c !== code);
    s.groups = member ? [code, ...rest].slice(0, MAX_PROFILE_GROUPS) : rest;
    this.stats = s;
    await this.save();
  }

  // ----- Übertragungs-Code (eigenes Objekt je Code, nicht im Profil) -----

  async offer(profileId: string): Promise<number> {
    const until = Date.now() + TRANSFER_MS;
    await this.ctx.storage.put("transfer", { profileId, until });
    await this.ctx.storage.setAlarm(until);
    return until;
  }

  /** Einmal einlösen: Profil-ID, danach ist der Code verbraucht */
  async take(): Promise<string | null> {
    const t = await this.ctx.storage.get<{ profileId: string; until: number }>("transfer");
    if (!t) return null;
    await this.remove();
    return t.until > Date.now() ? t.profileId : null;
  }

  async remove(): Promise<void> {
    this.stats = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  async alarm(): Promise<void> { await this.remove(); }

  private async save() {
    await this.ctx.storage.put("stats", this.stats);
    await this.ctx.storage.setAlarm(Date.now() + PROFILE_TTL_MS);
    if (this.pid) await this.ctx.storage.put("pid", this.pid);
    // Admin-Verzeichnis (nur Name, Anzahl Partien, Zeiten)
    const id = this.pid ?? (await this.ctx.storage.get<string>("pid"));
    if (id && this.stats) {
      const games = Object.values(this.stats.games).reduce((n, g) => n + g.played, 0);
      try { await settingsOf(this.env).profileSeen({ id, name: this.stats.name, games, createdAt: this.stats.createdAt, lastAt: Date.now() }); } catch { /* nur ein Extra */ }
    }
  }

  private pid: string | undefined;

  /** Admin: Profil komplett löschen */
  async wipe(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.stats = null;
    this.pid = undefined;
  }
}
