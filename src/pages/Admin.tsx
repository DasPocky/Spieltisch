import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, Loader2, Lock, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { GAMES, getGame, isGameId } from "@shared/games";
import {
  isoWeek, MAX_MESSAGE, sumStats, withDefaults,
  type Access, type AccessConfig, type AdminRoom, type GameDefaults, type SiteConfig, type SiteStats, type StatCounts,
} from "@shared/platform/access";
import { createRoom, type RoomAction } from "@shared/platform/room";
import type { Options } from "@shared/platform/types";
import { Confirm } from "@/components/Confirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { navigate } from "@/hooks/useRoute";
import { setSiteConfig } from "@/hooks/useSiteConfig";
import { cn, fmt } from "@/lib/utils";
import { Segmented } from "@/platform/Segmented";
import { SettingsPanel } from "@/platform/SettingsPanel";

const LEVELS = [
  { value: "on", label: "An", hint: "für alle" },
  { value: "code", label: "Mit Code", hint: "Zugangscode" },
  { value: "off", label: "Aus", hint: "abgeschaltet" },
] as const satisfies readonly { value: Access; label: string; hint: string }[];

/** Bei den einzelnen Spielen reicht die Kurzform */
const SHORT = LEVELS.map(({ value, label }) => ({ value, label }));

/** Sitzungs-Token des Admins – so bleibt man auch nach dem Neuladen angemeldet */
const TOKEN_KEY = "spieltisch:admin";
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (t: string | null) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* egal */ } };

const gameName = (id: string) => (isGameId(id) ? GAMES[id].info.name : id);

type Msg = { ok: boolean; text: string } | null;
/** Anfrage mit Sitzungs-Token; wirft mit lesbarer Meldung */
type Api = <T>(path: string, body?: unknown) => Promise<T>;

class AuthError extends Error {}

/** „vor 5 Min.“ usw. */
function ago(ms: number, now = Date.now()): string {
  const min = Math.floor((now - ms) / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return d === 1 ? "vor 1 Tag" : `vor ${d} Tagen`;
}

/** Admin-Bereich: nur mit Passwort. Freigaben, offene Räume, Standard-Einstellungen und Statistik. */
export function Admin() {
  const [token, setToken] = useState(readToken);
  const [password, setPassword] = useState("");
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(() => !!readToken());
  const [msg, setMsg] = useState<Msg>(null);
  const [tab, setTab] = useState("access");

  const signOut = useCallback((text?: string) => {
    writeToken(null); setToken(null); setConfig(null);
    if (text) setMsg({ ok: false, text });
  }, []);

  const api = useCallback<Api>(async (path, body) => {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null);
    if (!res) throw new Error("Keine Verbindung zum Server.");
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { signOut(data.error ?? "Bitte melde dich neu an."); throw new AuthError(data.error); }
    if (!res.ok || data.ok === false) throw new Error(data.error ?? "Das ging gerade nicht.");
    return data;
  }, [token, signOut]);

  // Gemerkte Sitzung prüfen
  useEffect(() => {
    if (!token || config) return;
    api<{ config: SiteConfig }>("/api/admin", {})
      .then((r) => setConfig(r.config))
      .catch((e) => { if (!(e instanceof AuthError)) setMsg({ ok: false, text: e.message }); })
      .finally(() => setChecking(false));
  }, [token, config, api]);

  const login = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const r = (await res.json()) as { ok: boolean; error?: string; config?: SiteConfig; token?: string };
      if (!r.ok || !r.config) { setMsg({ ok: false, text: r.error ?? "Anmeldung fehlgeschlagen." }); return; }
      if (r.token) { writeToken(r.token); setToken(r.token); }
      setPassword(""); setConfig(r.config);
    } catch { setMsg({ ok: false, text: "Keine Verbindung zum Server." }); } finally { setBusy(false); }
  };

  const logout = async () => {
    if (token) await fetch("/api/admin/logout", { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => null);
    signOut(); setMsg(null);
  };

  return (
    <main className="mx-auto flex min-h-dvh-safe max-w-md flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex h-14 shrink-0 items-center justify-between">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("/")}><ChevronLeft />Spieltisch</Button>
        {config && <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={logout}><LogOut />Abmelden</Button>}
      </header>
      <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><ShieldCheck className="size-7 text-navy-300" />Admin</h1>

      {!config ? (
        checking ? (
          <p className="mt-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Anmeldung wird geprüft …</p>
        ) : (
          <Card className="mt-5">
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); login(); }}>
              <Label htmlFor="admin-pw">Admin-Passwort</Label>
              <Input id="admin-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              <Button type="submit" size="lg" disabled={busy || !password}>{busy && <Loader2 className="animate-spin" />}Anmelden</Button>
              <p className="text-xs text-muted-foreground">Du bleibst 12 Stunden auf diesem Gerät angemeldet.</p>
            </form>
          </Card>
        )
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="mt-5 gap-5">
          {/* Freigaben und Standards bleiben beim Wechseln erhalten (ungespeicherte Änderungen) */}
          <TabsList className="grid-cols-4">
            <TabsTrigger value="access" className="px-0.5 text-xs min-[360px]:text-[13px] min-[400px]:text-sm">Freigaben</TabsTrigger>
            <TabsTrigger value="rooms" className="px-0.5 text-xs min-[360px]:text-[13px] min-[400px]:text-sm">Räume</TabsTrigger>
            <TabsTrigger value="defaults" className="px-0.5 text-xs min-[360px]:text-[13px] min-[400px]:text-sm">Standards</TabsTrigger>
            <TabsTrigger value="stats" className="px-0.5 text-xs min-[360px]:text-[13px] min-[400px]:text-sm">Statistik</TabsTrigger>
          </TabsList>
          <TabsContent value="access" forceMount className="data-[state=inactive]:hidden"><AccessTab config={config} api={api} onSaved={setConfig} /></TabsContent>
          <TabsContent value="rooms"><RoomsTab api={api} /></TabsContent>
          <TabsContent value="defaults" forceMount className="data-[state=inactive]:hidden"><DefaultsTab config={config} api={api} onSaved={setConfig} /></TabsContent>
          <TabsContent value="stats"><StatsTab api={api} /></TabsContent>
        </Tabs>
      )}
      {!config && !checking && msg && <p role="alert" className="mt-3 font-semibold text-destructive">{msg.text}</p>}
    </main>
  );
}

function Status({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p role="status" className={msg.ok ? "font-semibold text-ok" : "font-semibold text-destructive"}>{msg.text}</p>;
}

/** Hilfe zum Speichern mit Meldung */
function useSave() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const run = async (fn: () => Promise<void>, ok = "Gespeichert.") => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) {
      if (!(e instanceof AuthError)) setMsg({ ok: false, text: (e as Error).message });
    } finally { setBusy(false); }
  };
  return { busy, msg, run };
}

// ---------- Freigaben ----------

function AccessTab({ config, api, onSaved }: { config: SiteConfig; api: Api; onSaved: (c: SiteConfig) => void }) {
  const [draft, setDraft] = useState<AccessConfig>(() => ({ site: config.site, games: config.games, message: config.message }));
  const [code, setCode] = useState("");
  const { busy, msg, run } = useSave();

  const save = (removeCode = false) => run(async () => {
    const r = await api<{ config: SiteConfig }>("/api/admin", { config: draft, code: removeCode ? null : code.trim() || undefined });
    onSaved(r.config); setSiteConfig(r.config); setCode("");
  });

  const needsCode = draft.site === "code" || Object.values(draft.games).includes("code");

  return (
    <div className="grid gap-5">
      <Card className="grid gap-4">
        <Segmented label="Spieltisch" value={draft.site} options={LEVELS} onChange={(site) => setDraft({ ...draft, site })} />
        <div className="grid gap-2">
          <Label htmlFor="admin-msg">Hinweis für Besucher (optional)</Label>
          <Input id="admin-msg" value={draft.message} maxLength={MAX_MESSAGE} placeholder="z. B. Heute ab 20 Uhr wieder offen"
            onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
        </div>
      </Card>

      <Card className="grid gap-4">
        <h2 className="font-bold">Spiele</h2>
        {Object.values(GAMES).map((g) => (
          <Segmented key={g.info.id} label={g.info.name} value={draft.games[g.info.id] ?? "on"} options={SHORT}
            onChange={(v) => setDraft({ ...draft, games: { ...draft.games, [g.info.id]: v } })} />
        ))}
      </Card>

      <Card className="grid gap-2">
        <Label htmlFor="admin-code">Zugangscode {config.hasCode ? "(gesetzt – leer lassen zum Behalten)" : "(noch keiner)"}</Label>
        <Input id="admin-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="neuer Code, 4–32 Zeichen" autoComplete="off" />
        {needsCode && !config.hasCode && !code.trim() && <p className="text-sm text-ice">Für „Mit Code“ braucht ihr einen Zugangscode.</p>}
        {config.hasCode && <Button variant="ghost" className="justify-start text-muted-foreground" onClick={() => save(true)}>Zugangscode löschen</Button>}
      </Card>

      <Status msg={msg} />
      <Button size="lg" disabled={busy} onClick={() => save()}>{busy && <Loader2 className="animate-spin" />}Speichern</Button>
    </div>
  );
}

// ---------- Räume ----------

function RoomsTab({ api }: { api: Api }) {
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { msg, run } = useSave();

  const load = useCallback(async () => {
    setLoading(true);
    try { setRooms((await api<{ rooms: AdminRoom[] }>("/api/admin/rooms")).rooms); } catch { /* Meldung kommt beim nächsten Versuch */ } finally { setLoading(false); }
  }, [api]);

  // Beim Öffnen laden und alle 15 Sekunden auffrischen
  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const act = (code: string, what: "close" | "unlock") => run(async () => {
    await api(`/api/admin/rooms/${code}/${what}`, {});
    await load();
  }, what === "close" ? `Raum ${code} ist geschlossen.` : `PIN-Sperre von ${code} ist aufgehoben.`);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rooms ? (rooms.length === 1 ? "1 offener Raum" : `${rooms.length} offene Räume`) : "Lädt …"}</p>
        <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={load} disabled={loading}>
          <RefreshCw className={cn(loading && "animate-spin")} />Aktualisieren
        </Button>
      </div>
      <Status msg={msg} />
      {rooms?.length === 0 && <Card className="text-center text-muted-foreground">Gerade ist kein Raum offen.</Card>}
      {rooms?.map((r) => <RoomCard key={r.code} room={r} onAct={(what) => act(r.code, what)} />)}
    </div>
  );
}

function RoomCard({ room: r, onAct }: { room: AdminRoom; onAct: (what: "close" | "unlock") => void }) {
  const online = r.players.filter((p) => p.online).length;
  return (
    <Card className="grid gap-3 p-4" data-testid={`room-${r.code}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xl font-bold tracking-widest">{r.code}</div>
          <div className="truncate text-sm text-muted-foreground">{gameName(r.gameId)}</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {r.locked && <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><Lock className="size-3" />PIN gesperrt</span>}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", r.phase === "playing" ? "bg-primary/14 text-primary" : "bg-navy-800 text-muted-foreground")}>
            {r.phase === "playing" ? "läuft" : "Lobby"}
          </span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <p className="text-sm font-semibold">{r.players.length === 1 ? "1 Spieler" : `${r.players.length} Spieler`} · {online} online</p>
        {r.players.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {r.players.map((p) => (
              <li key={p.name} className="flex items-center gap-1.5 rounded-full bg-navy-800/70 px-2 py-0.5 text-xs font-semibold">
                <span className={cn("size-1.5 rounded-full", p.online ? "bg-ok" : "bg-muted-foreground/40")} aria-hidden />
                {p.name}<span className="sr-only">{p.online ? " (online)" : " (offline)"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">erstellt {ago(r.createdAt)} · aktiv {ago(r.activeAt)}</p>
      <div className="grid gap-2">
        {r.locked && <Button variant="secondary" size="sm" onClick={() => onAct("unlock")}>PIN-Sperre aufheben</Button>}
        <Confirm title={`Raum ${r.code} schließen?`} description="Alle Spieler fliegen raus, der Spielstand wird gelöscht." confirmLabel="Schließen" onConfirm={() => onAct("close")}>
          <Button variant="destructive" size="sm">Raum schließen</Button>
        </Confirm>
      </div>
    </Card>
  );
}

// ---------- Standards ----------

function DefaultsTab({ config, api, onSaved }: { config: SiteConfig; api: Api; onSaved: (c: SiteConfig) => void }) {
  const [draft, setDraft] = useState<GameDefaults>(config.defaults ?? {});
  const [gameId, setGameId] = useState<string>(Object.keys(GAMES)[0]);
  const { busy, msg, run } = useSave();
  const logic = getGame(gameId);

  // Vorschau-Raum für das Einstellungs-Panel
  const room = useMemo(() => {
    const r = createRoom(gameId);
    return { ...r, options: withDefaults(logic.settings, r.options, draft[gameId]) };
  }, [gameId, logic, draft]);

  const dispatch = (a: RoomAction) => {
    if (a.type !== "setOption") return;
    setDraft((d) => ({ ...d, [gameId]: { ...d[gameId], [a.key]: a.value } as Options }));
  };

  const save = () => run(async () => {
    const r = await api<{ config: SiteConfig }>("/api/admin", { defaults: draft });
    setDraft(r.config.defaults); onSaved(r.config); setSiteConfig(r.config);
  });

  const custom = (id: string) => Object.keys(draft[id] ?? {}).length > 0;

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">Gilt für neue Räume und lokale Spiele. In der Lobby lässt sich alles weiter ändern.</p>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Spiel wählen">
        {Object.values(GAMES).map((g) => (
          <button key={g.info.id} type="button" aria-pressed={gameId === g.info.id} onClick={() => setGameId(g.info.id)}
            className={cn("relative truncate rounded-lg px-1.5 py-2 text-sm font-semibold ring-1 ring-inset outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
              gameId === g.info.id ? "bg-primary/14 text-primary ring-primary/35" : "text-muted-foreground ring-border")}>
            {g.info.name}
            {custom(g.info.id) && <><span className="absolute top-1 right-1 size-1.5 rounded-full bg-ice" aria-hidden /><span className="sr-only"> (angepasst)</span></>}
          </button>
        ))}
      </div>
      <Card>
        {logic.settings.length ? (
          <SettingsPanel key={gameId} room={room} editable online={false} dispatch={dispatch} />
        ) : (
          <p className="text-muted-foreground">{logic.info.name} hat keine Einstellungen.</p>
        )}
      </Card>
      <Status msg={msg} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" disabled={busy || !custom(gameId)}
          onClick={() => setDraft((d) => Object.fromEntries(Object.entries(d).filter(([id]) => id !== gameId)))}>
          Zurücksetzen
        </Button>
        <Button size="lg" disabled={busy} onClick={save}>{busy && <Loader2 className="animate-spin" />}Speichern</Button>
      </div>
    </div>
  );
}

// ---------- Statistik ----------

/** Die letzten 12 Kalenderwochen, neueste zuerst */
function lastWeeks(n: number, now = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => isoWeek(now - i * 7 * 86_400_000));
}

function StatsTab({ api }: { api: Api }) {
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<SiteStats>("/api/admin/stats").then(setStats).catch((e) => { if (!(e instanceof AuthError)) setError((e as Error).message); });
  }, [api]);

  if (!stats) return error ? <p className="font-semibold text-destructive">{error}</p> : <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Lädt …</p>;

  const total = sumStats(stats.totals);
  const games = Object.entries(stats.totals)
    .map(([id, c]) => ({ id, c, played: (c.started ?? 0) + (c.local ?? 0) }))
    .sort((a, b) => b.played - a.played || (b.c.rooms ?? 0) - (a.c.rooms ?? 0));
  const byWeek = new Map(stats.weeks.map((w) => [w.week, sumStats(w.games)]));
  const weeks = lastWeeks(12).map((week) => ({ week, s: byWeek.get(week) ?? { rooms: 0, started: 0, finished: 0, local: 0 } }));
  const max = Math.max(1, ...weeks.map((w) => w.s.started + w.s.local));
  const n = (c: StatCounts, k: keyof StatCounts) => fmt(c[k] ?? 0);

  return (
    <div className="grid gap-5" data-testid="stats">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Räume" value={total.rooms} testId="stat-rooms" />
        <Tile label="Partien" value={total.started + total.local} hint={<>{fmt(total.started)} online<br />{fmt(total.local)} lokal</>} testId="stat-started" />
        <Tile label="Beendet" value={total.finished} hint="online" testId="stat-finished" />
      </div>

      <Card className="grid gap-2 p-4">
        <h2 className="font-bold">Pro Spiel</h2>
        {games.length === 0 ? <p className="text-sm text-muted-foreground">Noch nichts gezählt.</p> : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-[11px] text-muted-foreground">
                <th className="py-1 text-left font-semibold">Spiel</th>
                <th className="w-10 py-1 pl-1 text-right font-semibold">Räume</th>
                <th className="w-10 py-1 pl-1 text-right font-semibold">Online</th>
                <th className="w-10 py-1 pl-1 text-right font-semibold">Lokal</th>
                <th className="w-10 py-1 pl-1 text-right font-semibold">Fertig</th>
              </tr>
            </thead>
            <tbody>
              {games.map(({ id, c }) => (
                <tr key={id} className="border-t border-border" data-testid={`stat-game-${id}`}>
                  <td className="max-w-0 truncate py-1.5 pr-1 font-semibold">{gameName(id)}</td>
                  <td className="py-1.5 text-right">{n(c, "rooms")}</td>
                  <td className="py-1.5 text-right">{n(c, "started")}</td>
                  <td className="py-1.5 text-right">{n(c, "local")}</td>
                  <td className="py-1.5 text-right">{n(c, "finished")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-muted-foreground">Online und Lokal: gestartete Partien. Fertig zählt nur online beendete.</p>
      </Card>

      <Card className="grid gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-bold">Pro Woche</h2>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary" />online</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary/35" />lokal</span>
          </span>
        </div>
        <ul className="grid gap-1.5">
          {weeks.map(({ week, s }) => (
            <li key={week} className="flex items-center gap-2 text-xs">
              <span className="w-11 shrink-0 text-muted-foreground">KW {Number(week.slice(-2))}</span>
              <span className="flex h-3 flex-1 overflow-hidden rounded-sm bg-navy-800/60">
                <span className="h-full bg-primary" style={{ width: `${(s.started / max) * 100}%` }} />
                <span className="h-full bg-primary/35" style={{ width: `${(s.local / max) * 100}%` }} />
              </span>
              <span className="w-7 shrink-0 text-right font-semibold tabular-nums">{fmt(s.started + s.local)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Gezählt seit {new Date(stats.since).toLocaleDateString("de-DE")}.</p>
      </Card>
    </div>
  );
}

function Tile({ label, value, hint, testId }: { label: string; value: number; hint?: ReactNode; testId?: string }) {
  return (
    <Card className="grid content-start gap-0.5 p-3 text-center">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <b className="text-2xl tabular-nums" data-testid={testId}>{fmt(value)}</b>
      {hint && <span className="text-[11px] leading-tight text-muted-foreground">{hint}</span>}
    </Card>
  );
}
