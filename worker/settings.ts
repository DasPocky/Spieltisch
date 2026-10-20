/** Ein einziges Durable Object für die Seite: Admin-Einstellungen und -Sitzungen, Raumverzeichnis, Statistik, Verlauf */
import { renameStored } from "../shared/games/renamed";
import { DurableObject } from "cloudflare:workers";
import { GAMES, isGameId } from "../shared/games";
import { PROFILE_ID_RE } from "../shared/platform/profile";
import { GROUP_CODE_RE } from "../shared/platform/group";
import { ACCESS_CODE_RE, DEFAULT_CONFIG, sanitizeConfig, sanitizeDefaults, type AccessConfig, type GameDefaults, type SiteConfig } from "../shared/platform/access";
import { addHealth, countFeature, countStat, emptySiteStats, type HealthDay, type HealthDelta, STAT_KINDS, WIPE_KINDS, type AdminRoom, type ArchivedRoom, type DirGroup, type DirProfile, type SiteStats, type FeatureKind, type StatKind, type WipeKind } from "../shared/platform/admin";
import { BUILD, type ServerStatus } from "../shared/build";
import { DEFAULT_UPDATE, releaseDue, sanitizeUpdate, type PendingRelease, type ReleaseEntry, type ReleaseHow, type ReleaseStatus, type UpdateConfig, type UpdateMode, type VersionInfo } from "../shared/platform/update";
import { LIFE_MS, type RoomCard } from "../shared/platform/directory";
import { ROOM_CODE_RE } from "../shared/platform/protocol";
import { Env } from "./env";
import { hashPin, sameSecret } from "./http";
import { ROOM_TTL_MS, LOCK_MS } from "./rooms";

export interface SettingsData {
  config: AccessConfig;
  codeHash: string | null;
  salt: string;
  fails: number;
  lockUntil: number;
  /** Admin-Sitzungen: SHA-256 des Tokens → läuft ab um */
  sessions?: Record<string, number>;
  /** Standard-Einstellungen pro Spiel */
  defaults?: GameDefaults;
  /** Kennung des letzten kompletten Neustarts */
  epoch?: string;
  /** Neuer Standard „Sofort für alle“ schon übernommen (früher war „Am ruhigen Moment“ Standard) */
  forceUpdate?: boolean;
}
/** Eintrag im Protokoll der Verwaltung */
export interface AuditEntry { at: number; what: string }
export const GAME_IDS = Object.keys(GAMES);
export const ADMIN_MAX_FAILS = 8;
/** Admin-Gerät bleibt 30 Tage angemeldet (Abmelden beendet die Sitzung sofort); höchstens so viele Sitzungen gleichzeitig */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SESSIONS = 20;
export const ADMIN_TOKEN_RE = /^[0-9a-f]{64}$/;
/** Raum-Übersicht: Einträge ohne Lebenszeichen fliegen nach Ablauf der Raum-Frist raus */
export const INDEX_STALE_MS = ROOM_TTL_MS + 60 * 60 * 1000;
export const settingsDefs = (id: string) => (isGameId(id) ? GAMES[id].settings : undefined);
/** Anmeldung im Admin-Bereich: Sitzungs-Token oder Passwort */
export interface AdminCred { token?: string; password?: string }
export type AdminResult = { ok: boolean; error?: string; status?: number };
/**
 * Ein einziges Durable Object mit den Admin-Einstellungen (Freigaben, Zugangscode, Hinweis, Standards),
 * den Admin-Sitzungen, der Übersicht offener Räume (`room:<CODE>`) und der Statistik.
 */
/** Höchstens so viele fehlende Bausteine der Stimme auf der Warteliste */
const VOICE_QUEUE_MAX = 3000;

export class SiteSettings extends DurableObject<Env> {
  private data: SettingsData = { config: { ...DEFAULT_CONFIG }, codeHash: null, salt: crypto.randomUUID(), fails: 0, lockUntil: 0 };
  private stats: SiteStats = emptySiteStats(Date.now());

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      // renameStored: Spiele mit früheren Kennungen (vor der Umbenennung) übernehmen
      const saved = await ctx.storage.get<SettingsData>("settings");
      if (saved) this.data = renameStored(saved);
      // Einmalig: wer den alten Standard („Am ruhigen Moment“) hatte, bekommt den neuen („Sofort für alle“)
      if (saved && !this.data.forceUpdate) {
        if (!this.data.config.update || this.data.config.update.mode === "now") this.data.config = { ...this.data.config, update: { ...(this.data.config.update ?? DEFAULT_UPDATE), mode: "force" } };
        this.data.forceUpdate = true;
        await ctx.storage.put("settings", this.data);
      }
      this.stats = renameStored((await ctx.storage.get<SiteStats>("stats")) ?? this.stats);
    });
  }

  async config(): Promise<SiteConfig> {
    // Ältere gespeicherte Einstellungen kennen neue Felder noch nicht – die Prüfung füllt sie mit Standards
    return { ...sanitizeConfig(this.data.config, GAME_IDS), hasCode: !!this.data.codeHash, defaults: this.data.defaults ?? {}, epoch: this.data.epoch };
  }

  async checkCode(code: string): Promise<boolean> {
    if (!this.data.codeHash) return false;
    return (await hashPin(this.data.salt, code)) === this.data.codeHash;
  }

  /** Prüft Sitzungs-Token oder Passwort. Nach zu vielen falschen Passwörtern 10 Minuten Pause. */
  async auth(cred: AdminCred): Promise<AdminResult> {
    const secret = this.env.ADMIN_PASSWORD;
    if (!secret) return { ok: false, status: 503, error: "Der Admin-Bereich ist nicht eingerichtet (ADMIN_PASSWORD fehlt)." };
    if (cred.token) {
      const sessions = this.data.sessions ?? {};
      const until = ADMIN_TOKEN_RE.test(cred.token) ? sessions[await hashPin("session", cred.token)] : undefined;
      if (until && until > Date.now()) return { ok: true };
      // Abgelaufene oder fremde Tokens zählen nicht als Fehlversuch – raten ist bei 256 Bit aussichtslos
      if (!cred.password) return { ok: false, status: 401, error: "Bitte melde dich neu an." };
    }
    if (Date.now() < this.data.lockUntil) return { ok: false, status: 429, error: "Zu viele Fehlversuche. Bitte in ein paar Minuten nochmal." };
    if (!(await sameSecret(cred.password ?? "", secret))) {
      this.data.fails++;
      if (this.data.fails >= ADMIN_MAX_FAILS) { this.data.fails = 0; this.data.lockUntil = Date.now() + LOCK_MS; }
      await this.save();
      return { ok: false, status: 403, error: "Falsches Passwort." };
    }
    if (this.data.fails) { this.data.fails = 0; await this.save(); }
    return { ok: true };
  }

  /** Neue Admin-Sitzung (nach erfolgreicher Anmeldung). Abgelaufene und zu viele alte fallen raus. */
  private async newSession(): Promise<string> {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const now = Date.now();
    const live = Object.entries(this.data.sessions ?? {}).filter(([, until]) => until > now).sort((a, b) => b[1] - a[1]).slice(0, MAX_SESSIONS - 1);
    this.data.sessions = Object.fromEntries([...live, [await hashPin("session", token), now + SESSION_MS]]);
    await this.save();
    return token;
  }

  async logout(token: string): Promise<void> {
    if (!ADMIN_TOKEN_RE.test(token) || !this.data.sessions) return;
    delete this.data.sessions[await hashPin("session", token)];
    await this.save();
  }

  /** Admin: anmelden (ohne Änderungen, mit Passwort → neues Sitzungs-Token) oder speichern. */
  async admin(cred: AdminCred, update?: { config?: unknown; code?: string | null; defaults?: unknown }): Promise<AdminResult & { config?: SiteConfig; token?: string }> {
    const auth = await this.auth(cred);
    if (!auth.ok) return auth;
    if (update?.config !== undefined) {
      if (typeof update.code === "string" && update.code && !ACCESS_CODE_RE.test(update.code)) return { ok: false, status: 400, error: "Der Zugangscode braucht 4 bis 32 Zeichen." };
      this.data.config = sanitizeConfig(update.config, GAME_IDS);
      if (update.code === null) this.data.codeHash = null;
      else if (typeof update.code === "string" && update.code) {
        this.data.salt = crypto.randomUUID();
        this.data.codeHash = await hashPin(this.data.salt, update.code);
      }
    }
    if (update?.defaults !== undefined) this.data.defaults = sanitizeDefaults(update.defaults, settingsDefs);
    if (update) await this.save();
    const token = !update && !cred.token ? await this.newSession() : undefined;
    return { ok: true, config: await this.config(), token };
  }

  // ----- Raum-Übersicht -----

  /** Ein Raum meldet sich an oder aktualisiert seine Kurzinfo – und landet im Verlauf („wer war da“) */
  async roomReport(room: AdminRoom): Promise<void> {
    if (!ROOM_CODE_RE.test(room.code)) return;
    await this.ctx.storage.put(`room:${room.code}`, room);
    const key = archKey(room.code, room.createdAt);
    const a = renameStored(await this.ctx.storage.get<ArchivedRoom>(key)) ?? { code: room.code, createdAt: room.createdAt, lastAt: room.activeAt, games: [], players: [], partien: 0 };
    a.lastAt = Math.max(a.lastAt, room.activeAt);
    for (const p of room.players) if (!a.players.includes(p.name)) a.players.push(p.name);
    if (room.phase === "playing" && !a.games.includes(room.gameId)) a.games.push(room.gameId);
    a.players = a.players.slice(0, 60);
    await this.ctx.storage.put(key, a);
  }

  /** Raum geschlossen oder abgelaufen */
  async roomEnded(code: string, createdAt: number): Promise<void> {
    await this.ctx.storage.delete(`room:${code}`);
    const key = archKey(code, createdAt);
    const a = await this.ctx.storage.get<ArchivedRoom>(key);
    if (a) await this.ctx.storage.put(key, { ...a, endedAt: Date.now() });
  }

  /** Verlauf, neueste zuerst; was älter ist als die eingestellte Frist, wird dabei gelöscht */
  async archiveList(): Promise<ArchivedRoom[]> {
    const all = new Map([...(await this.ctx.storage.list<ArchivedRoom>({ prefix: "arch:" }))].map(([k, a]) => [k, renameStored(a)]));
    const days = (await this.config()).archiveDays;
    const cut = Date.now() - days * 86_400_000;
    const old = [...all].filter(([, a]) => a.lastAt < cut).map(([k]) => k);
    if (old.length) await this.ctx.storage.delete(old);
    return [...all].filter(([k]) => !old.includes(k)).map(([, a]) => a).sort((a, b) => b.lastAt - a.lastAt);
  }

  async archiveDelete(code: string, createdAt: number): Promise<void> {
    await this.ctx.storage.delete(archKey(code, createdAt));
  }

  // ----- Verzeichnis: Gruppen und Profile (ab jetzt erfasst, damit der Admin sie sieht und löschen kann) -----

  async groupSeen(g: DirGroup): Promise<void> {
    if (!GROUP_CODE_RE.test(g.code)) return;
    await this.ctx.storage.put(`grp:${g.code}`, g);
  }

  async profileSeen(p: DirProfile): Promise<void> {
    if (!PROFILE_ID_RE.test(p.id)) return;
    await this.ctx.storage.put(`prf:${p.id}`, p);
  }

  async directory(): Promise<{ groups: DirGroup[]; profiles: DirProfile[] }> {
    const groups = [...(await this.ctx.storage.list<DirGroup>({ prefix: "grp:" })).values()].sort((a, b) => b.lastAt - a.lastAt);
    const profiles = [...(await this.ctx.storage.list<DirProfile>({ prefix: "prf:" })).values()].sort((a, b) => b.lastAt - a.lastAt);
    return { groups, profiles };
  }

  async directoryRemove(kind: "grp" | "prf", id: string): Promise<void> {
    await this.ctx.storage.delete(`${kind}:${id}`);
  }

  /** Löschen nach Art; liefert Räume, Gruppen und Profile, die der Aufrufer selbst noch leeren muss */
  async wipe(kinds: WipeKind[]): Promise<{ rooms: string[]; groups: string[]; profiles: string[] }> {
    const out = { rooms: [] as string[], groups: [] as string[], profiles: [] as string[] };
    const drop = async (prefix: string) => {
      const keys = [...(await this.ctx.storage.list({ prefix })).keys()];
      for (let i = 0; i < keys.length; i += 128) await this.ctx.storage.delete(keys.slice(i, i + 128));
      return keys.map((k) => k.slice(prefix.length));
    };
    if (kinds.includes("rooms")) out.rooms = await drop("room:");
    if (kinds.includes("archive")) await drop("arch:");
    if (kinds.includes("stats")) { this.stats = emptySiteStats(Date.now()); await this.ctx.storage.put("stats", this.stats); }
    if (kinds.includes("groups")) out.groups = await drop("grp:");
    if (kinds.includes("profiles")) out.profiles = await drop("prf:");
    // Einstellungen auf Auslieferungszustand: Freigaben, Standards, Optionen, Look, Banner, Zugangscode weg.
    // Admin-Sitzungen bleiben (das Passwort liegt als Secret bei Cloudflare).
    if (kinds.includes("settings")) {
      this.data = { ...this.data, config: { ...DEFAULT_CONFIG }, codeHash: null, salt: crypto.randomUUID(), fails: 0, lockUntil: 0, defaults: undefined };
      await this.save();
    }
    // Alles gelöscht: neue Neustart-Kennung – jedes Handy löscht beim nächsten Öffnen einmal seine Daten
    if (WIPE_KINDS.every((k) => kinds.includes(k))) {
      this.data.epoch = crypto.randomUUID();
      await this.save();
    }
    return out;
  }

  async roomGone(code: string): Promise<void> {
    await this.ctx.storage.delete(`room:${code}`);
  }

  /** Alle bekannten Räume; uralte Einträge (Raum längst abgelaufen) werden dabei aufgeräumt */
  async roomList(): Promise<AdminRoom[]> {
    const all = await this.ctx.storage.list<AdminRoom>({ prefix: "room:" });
    const now = Date.now();
    // Dauerräume bleiben, sonst gilt die Lebensdauer des Raums (alte Räume: die eingebaute Frist)
    const limit = (r: AdminRoom) => (r.life === "forever" ? Infinity : r.life ? LIFE_MS[r.life] + 60 * 60 * 1000 : INDEX_STALE_MS);
    const stale = [...all].filter(([, r]) => now - r.activeAt > limit(r)).map(([k]) => k);
    if (stale.length) await this.ctx.storage.delete(stale);
    return [...all].filter(([k]) => !stale.includes(k)).map(([, r]) => r);
  }

  /** Offene Räume für den Start-Tab: belebt, sichtbar für alle oder für eine der eigenen Gruppen. Gruppe zuerst. */
  async openRooms(groups: string[]): Promise<RoomCard[]> {
    const all = await this.ctx.storage.list<AdminRoom>({ prefix: "room:" });
    const cards: RoomCard[] = [];
    for (const [, r] of all) {
      const c = r.card;
      if (!c || c.online === 0 || c.test) continue;
      const mine = !!r.groupCode && groups.includes(r.groupCode);
      if (c.visibility === "none" || (c.visibility === "group" && !mine)) continue;
      cards.push({ ...c, group: mine || undefined });
    }
    return cards.sort((a, b) => Number(!!b.group) - Number(!!a.group) || b.online - a.online || b.activeAt - a.activeAt).slice(0, 30);
  }

  // ----- Statistik -----

  async count(gameId: string, kind: StatKind, code?: string): Promise<void> {
    if (!isGameId(gameId) || !STAT_KINDS.includes(kind)) return;
    this.stats = countStat(this.stats, gameId, kind, Date.now());
    await this.ctx.storage.put("stats", this.stats);
    // Verlauf: gestartete Partien je Raum
    if (kind === "started" && code && ROOM_CODE_RE.test(code)) {
      const room = await this.ctx.storage.get<AdminRoom>(`room:${code}`);
      if (room) {
        const key = archKey(code, room.createdAt);
        const a = renameStored(await this.ctx.storage.get<ArchivedRoom>(key));
        if (a) await this.ctx.storage.put(key, { ...a, partien: a.partien + 1, games: a.games.includes(gameId) ? a.games : [...a.games, gameId] });
      }
    }
  }

  /** Worker-Anfragen pro Tag (ungefähr: jede Instanz meldet gesammelt) */
  async addRequests(n: number): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);
    const r = (await this.ctx.storage.get<{ day: string; count: number; since: number }>("requests")) ?? { day, count: 0, since: Date.now() };
    const next = r.day === day ? { ...r, count: r.count + n } : { day, count: n, since: r.since };
    await this.ctx.storage.put("requests", next);
  }

  async status(): Promise<Omit<ServerStatus, "build" | "services">> {
    const day = new Date().toISOString().slice(0, 10);
    const r = (await this.ctx.storage.get<{ day: string; count: number; since: number }>("requests")) ?? { day, count: 0, since: Date.now() };
    const rooms = await this.roomList();
    return {
      now: Date.now(),
      requests: r.day === day ? r : { day, count: 0, since: r.since },
      rooms: rooms.length,
      connections: rooms.reduce((n, x) => n + (x.card?.online ?? x.players.filter((p) => p.online).length), 0),
    };
  }

  async feature(kind: FeatureKind): Promise<void> {
    this.stats = countFeature(this.stats, kind, Date.now());
    await this.ctx.storage.put("stats", this.stats);
  }

  /** Einen KI-Spruch für heute verbuchen – false, wenn das Tageslimit erreicht ist */
  /** Echte Stimme: fehlende Bausteine merken (Gerät meldet), die GitHub-Aktion holt sie ab und erzeugt sie */
  async voiceNote(items: { key: string; mood: string; text: string }[]): Promise<number> {
    const queue = (await this.ctx.storage.get<Record<string, { mood: string; text: string; at: number }>>("voiceQueue")) ?? {};
    const now = Date.now();
    for (const it of items) if (!queue[it.key]) queue[it.key] = { mood: it.mood, text: it.text, at: now };
    // Begrenzt: die ältesten fliegen raus
    const keys = Object.keys(queue);
    if (keys.length > VOICE_QUEUE_MAX) for (const k of keys.sort((a, b) => queue[a].at - queue[b].at).slice(0, keys.length - VOICE_QUEUE_MAX)) delete queue[k];
    await this.ctx.storage.put("voiceQueue", queue);
    return Object.keys(queue).length;
  }

  async voiceQueue(): Promise<{ key: string; mood: string; text: string }[]> {
    const queue = (await this.ctx.storage.get<Record<string, { mood: string; text: string; at: number }>>("voiceQueue")) ?? {};
    return Object.entries(queue).map(([key, v]) => ({ key, mood: v.mood, text: v.text }));
  }

  async voiceDone(keys: string[]): Promise<void> {
    const queue = (await this.ctx.storage.get<Record<string, { mood: string; text: string; at: number }>>("voiceQueue")) ?? {};
    for (const k of keys) delete queue[k];
    await this.ctx.storage.put("voiceQueue", queue);
  }

  async aiTake(max: number): Promise<boolean> {
    const day = new Date().toISOString().slice(0, 10);
    const used = (await this.ctx.storage.get<{ day: string; count: number }>("ai")) ?? { day, count: 0 };
    const today = used.day === day ? used : { day, count: 0 };
    if (today.count >= max) return false;
    await this.ctx.storage.put("ai", { day, count: today.count + 1 });
    return true;
  }

  async statsGet(): Promise<SiteStats> {
    return this.stats;
  }

  // ----- Betriebskennzahlen (gesammelt von den Räumen) -----

  async health(d: HealthDelta): Promise<void> {
    const days = (await this.ctx.storage.get<HealthDay[]>("health")) ?? [];
    await this.ctx.storage.put("health", addHealth(days, d, Date.now()));
  }

  async healthList(): Promise<HealthDay[]> {
    return (await this.ctx.storage.get<HealthDay[]>("health")) ?? [];
  }

  // ----- Protokoll der Verwaltung: wer hat wann zugeschaut oder eingegriffen (ohne Inhalte, PINs oder Tokens) -----

  async audit(what: string): Promise<void> {
    const list = (await this.ctx.storage.get<AuditEntry[]>("audit")) ?? [];
    list.unshift({ at: Date.now(), what: what.slice(0, 120) });
    await this.ctx.storage.put("audit", list.slice(0, 200));
  }

  async auditList(): Promise<AuditEntry[]> {
    return (await this.ctx.storage.get<AuditEntry[]>("audit")) ?? [];
  }

  // ----- Updates: neue Versionen zum gewählten Zeitpunkt freischalten -----

  /** Gilt gerade: Variable UPDATE_MODE vor der Admin-Einstellung */
  private updateConfig(): UpdateConfig & { fromEnv: boolean } {
    const cfg = sanitizeUpdate(this.data.config.update ?? DEFAULT_UPDATE);
    const env = this.env.UPDATE_MODE;
    const fromEnv = !!env && sanitizeUpdate({ mode: env }).mode === env;
    return { ...cfg, mode: fromEnv ? (env as UpdateMode) : cfg.mode, fromEnv };
  }

  /** Ist DEPLOY_TOKEN noch gültig (nicht abgelaufen, nicht gelöscht)? */
  private async tokenOk(): Promise<boolean> {
    try {
      const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: { authorization: `Bearer ${this.env.DEPLOY_TOKEN}` } });
      const body = (await res.json().catch(() => null)) as { result?: { status?: string } } | null;
      const ok = res.ok && body?.result?.status === "active";
      if (!ok) await this.ctx.storage.put("releaseError", "DEPLOY_TOKEN ist ungültig oder abgelaufen – Updates gehen sofort live, bis ein neuer Schlüssel gesetzt ist.");
      else await this.ctx.storage.delete("releaseError");
      return ok;
    } catch { return false; }
  }

  private canPromote(): boolean {
    return !!(this.env.DEPLOY_TOKEN && this.env.CF_ACCOUNT_ID && this.env.WORKER_NAME);
  }

  private async releases(): Promise<{ pending: PendingRelease | null; history: ReleaseEntry[] }> {
    return (await this.ctx.storage.get<{ pending: PendingRelease | null; history: ReleaseEntry[] }>("releases")) ?? { pending: null, history: [] };
  }

  private async saveReleases(r: { pending: PendingRelease | null; history: ReleaseEntry[] }): Promise<void> {
    r.history = r.history.slice(0, 30);
    await this.ctx.storage.put("releases", r);
  }

  /**
   * Der Build hat eine neue Version hochgeladen: sofort live („now“) oder warten?
   * Ohne Schlüssel zum Freischalten gilt immer „sofort“ – sonst bliebe das Update für immer liegen.
   */
  async releaseOffer(v: { versionId: string; sha: string; time: string }): Promise<"now" | "later"> {
    const cfg = this.updateConfig();
    const r = await this.releases();
    // Warten nur, wenn der Worker später auch selbst freischalten kann (Schlüssel gültig) – sonst bliebe das Update liegen
    const later = (cfg.mode === "idle" || cfg.mode === "time" || cfg.mode === "manual") && this.canPromote() && (await this.tokenOk());
    // Ältere wartende Version wird überholt – die neue enthält alles
    if (r.pending) r.history = r.history.map((h) => (h.sha === r.pending!.sha && !h.liveAt ? { ...h, skipped: true } : h));
    r.history.unshift({ sha: v.sha, time: v.time, at: Date.now(), ...(later ? {} : { liveAt: Date.now(), how: "sofort" as const }) });
    r.pending = later ? { ...v, at: Date.now() } : null;
    await this.saveReleases(r);
    return later ? "later" : "now";
  }

  /** Läuft gerade irgendwo eine Partie (mit jemandem online)? */
  private async playingRooms(): Promise<number> {
    return (await this.roomList()).filter((r) => r.phase === "playing" && (r.card?.online ?? r.players.filter((p) => p.online).length) > 0).length;
  }

  /** Wartendes Update freischalten, wenn es dran ist (alle 5 Minuten) – oder sofort (`force`, Knopf im Admin) */
  async releaseTick(force = false): Promise<{ ok: boolean; error?: string; live?: boolean }> {
    const r = await this.releases();
    if (!r.pending) return { ok: true, live: false };
    const how: ReleaseHow | null = force ? "knopf" : releaseDue(r.pending, this.updateConfig(), Date.now(), await this.playingRooms());
    if (!how) return { ok: true, live: false };
    const error = await this.promote(r.pending.versionId, r.pending.sha);
    if (error) { await this.ctx.storage.put("releaseError", error); return { ok: false, error }; }
    await this.ctx.storage.delete("releaseError");
    r.history = r.history.map((h) => (h.sha === r.pending!.sha && !h.liveAt ? { ...h, liveAt: Date.now(), how, skipped: undefined } : h));
    r.pending = null;
    await this.saveReleases(r);
    return { ok: true, live: true };
  }

  /** Version bei Cloudflare zu 100 % live schalten */
  private async promote(versionId: string, sha: string): Promise<string | undefined> {
    if (!this.canPromote()) return "Zum Freischalten fehlt der Schlüssel DEPLOY_TOKEN (siehe docs/betrieb.md).";
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.env.CF_ACCOUNT_ID}/workers/scripts/${this.env.WORKER_NAME}/deployments`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.env.DEPLOY_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ strategy: "percentage", versions: [{ version_id: versionId, percentage: 100 }], annotations: { "workers/message": `Spieltisch ${sha.slice(0, 7)}` } }),
      });
      if (res.ok) return undefined;
      const body = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null;
      return `Cloudflare lehnt ab: ${body?.errors?.[0]?.message ?? res.status}`;
    } catch (e) {
      return `Cloudflare nicht erreichbar: ${(e as Error).message}`;
    }
  }

  async releaseStatus(): Promise<ReleaseStatus> {
    const cfg = this.updateConfig();
    const r = await this.releases();
    return { mode: cfg.mode, modeFromEnv: cfg.fromEnv, canPromote: this.canPromote(), canReceive: !!this.env.RELEASE_SECRET, pending: r.pending, history: r.history,
      error: (await this.ctx.storage.get<string>("releaseError")) ?? undefined };
  }

  /** Für alle: welche Version läuft, wann kommt die nächste */
  async version(): Promise<VersionInfo> {
    const cfg = this.updateConfig();
    const r = await this.releases();
    return { build: BUILD, mode: cfg.mode, pending: r.pending ? { at: r.pending.at, mode: cfg.mode, ...(cfg.mode === "time" ? { hour: cfg.hour } : {}) } : null };
  }

  private async save() {
    await this.ctx.storage.put("settings", this.data);
  }
}
export const archKey = (code: string, createdAt: number) => `arch:${String(createdAt).padStart(15, "0")}:${code}`;
