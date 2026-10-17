/** Profile (Statistik je Gerät) und Übertragungs-Codes aufs neue Handy */
import { DurableObject } from "cloudflare:workers";
import { addResult, emptyStats, MAX_PROFILE_GROUPS, PROFILE_ID_RE, PROFILE_KEY_RE, TRANSFER_MS, type ProfileStats, type RecentGame } from "../shared/platform/profile";
import { GROUP_CODE_RE, sanitizeAvatar } from "../shared/platform/group";
import { cleanName } from "../shared/platform/room";
import { Env, settingsOf } from "./env";
import { hashPin } from "./http";

/** Ein Durable Object pro Profil: Name und Statistik. Ohne Aktivität nach einem Jahr gelöscht. */
export const PROFILE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** So viele Geräte dürfen ein Profil gleichzeitig nutzen */
export const MAX_KEYS = 10;
export class ProfileStore extends DurableObject<Env> {
  private stats: ProfileStats | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.stats = (await ctx.storage.get<ProfileStats>("stats")) ?? null; });
  }

  async get(): Promise<ProfileStats> {
    return this.stats ?? emptyStats(Date.now());
  }

  /** Ergebnis eintragen. `event`: Kennung der Partie – kommt dasselbe Ergebnis nochmal (Wiederholung nach Fehler), zählt es nur einmal. */
  async record(entry: RecentGame, id?: string, event?: string): Promise<ProfileStats> {
    if (id && PROFILE_ID_RE.test(id)) this.pid = id;
    if (event) {
      const done = (await this.ctx.storage.get<string[]>("events")) ?? [];
      if (done.includes(event)) return this.stats ?? emptyStats(Date.now());
      await this.ctx.storage.put("events", [...done, event].slice(-50));
    }
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

  // ----- Geräteschlüssel: wer das Profil nutzen darf (die ID allein reicht nicht) -----

  /**
   * Gehört der Schlüssel zu diesem Profil? Ein Profil ohne Schlüssel (neu, oder von vor den Schlüsseln)
   * übernimmt den ersten, der sich meldet – danach zählen nur noch bekannte Schlüssel.
   */
  async owns(key: string): Promise<boolean> {
    if (!PROFILE_KEY_RE.test(key)) return false;
    const h = await hashPin("profile", key);
    const keys = (await this.ctx.storage.get<string[]>("keys")) ?? [];
    if (keys.includes(h)) return true;
    if (keys.length) return false;
    await this.ctx.storage.put("keys", [h]);
    await this.ctx.storage.setAlarm(Date.now() + PROFILE_TTL_MS);
    return true;
  }

  /** Neuer Schlüssel für ein weiteres Gerät (Übertragung) – höchstens MAX_KEYS, die ältesten fallen raus */
  async addKey(): Promise<string> {
    const b = new Uint8Array(24);
    crypto.getRandomValues(b);
    const key = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    const keys = (await this.ctx.storage.get<string[]>("keys")) ?? [];
    await this.ctx.storage.put("keys", [...keys, await hashPin("profile", key)].slice(-MAX_KEYS));
    return key;
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
