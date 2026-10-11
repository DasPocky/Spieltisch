import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { isoWeek, sumStats, type AdminRoom, type SiteStats, type StatCounts } from "@shared/platform/access";
import { Card } from "@/components/ui/card";
import { fmt } from "@/lib/utils";
import { AuthError, gameName, Tile, type Api } from "./shared";

const EMPTY = { rooms: 0, started: 0, finished: 0, local: 0, players: 0 };
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Übersicht: was gerade los ist, Verlauf der letzten Tage und Wochen, beliebteste Spiele */
export function OverviewTab({ api }: { api: Api }) {
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const fail = (e: unknown) => { if (!(e instanceof AuthError)) setError((e as Error).message); };
    api<SiteStats>("/api/admin/stats").then(setStats).catch(fail);
    api<{ rooms: AdminRoom[] }>("/api/admin/rooms").then((r) => setRooms(r.rooms)).catch(() => setRooms([]));
  }, [api]);

  if (!stats) return error ? <p className="font-semibold text-destructive">{error}</p> : <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Lädt …</p>;

  const now = Date.now();
  const total = sumStats(stats.totals);
  const byDay = new Map((stats.days ?? []).map((d) => [d.day, sumStats(d.games)]));
  const days = Array.from({ length: 14 }, (_, i) => { const t = now - (13 - i) * 86_400_000; return { t, s: byDay.get(dayKey(t)) ?? EMPTY }; });
  const today = byDay.get(dayKey(now)) ?? EMPTY;
  const byWeek = new Map(stats.weeks.map((w) => [w.week, sumStats(w.games)]));
  const week = byWeek.get(isoWeek(now)) ?? EMPTY;
  const weeks = Array.from({ length: 12 }, (_, i) => { const w = isoWeek(now - i * 7 * 86_400_000); return { week: w, s: byWeek.get(w) ?? EMPTY }; });
  const dayMax = Math.max(1, ...days.map((d) => d.s.started + d.s.local));
  const weekMax = Math.max(1, ...weeks.map((w) => w.s.started + w.s.local));
  const online = rooms?.reduce((n, r) => n + r.players.filter((p) => p.online).length, 0) ?? 0;
  const playing = rooms?.filter((r) => r.phase === "playing").length ?? 0;
  const games = Object.entries(stats.totals)
    .map(([id, c]) => ({ id, c, played: (c.started ?? 0) + (c.local ?? 0) }))
    .sort((a, b) => b.played - a.played || (b.c.rooms ?? 0) - (a.c.rooms ?? 0));
  const gameMax = Math.max(1, ...games.map((g) => g.played));
  const n = (c: StatCounts, k: keyof StatCounts) => fmt(c[k] ?? 0);
  const share = total.started + total.local ? Math.round((total.started / (total.started + total.local)) * 100) : 0;

  return (
    <div className="grid gap-5" data-testid="stats">
      {/* Gerade jetzt */}
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Räume offen" value={rooms ? rooms.length : "…"} hint={rooms ? `${playing} spielen` : undefined} testId="live-rooms" />
        <Tile label="Online jetzt" value={rooms ? online : "…"} hint="Leute" testId="live-online" />
        <Tile label="Heute" value={today.started + today.local} hint="Partien" testId="today" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Diese Woche" value={week.started + week.local} hint={`${fmt(week.players)} Beitritte`} />
        <Tile label="Partien" value={total.started + total.local} hint={<>{fmt(total.started)} online<br />{fmt(total.local)} lokal</>} testId="stat-started" />
        <Tile label="Räume" value={total.rooms} hint={`${fmt(total.finished)} Partien fertig`} testId="stat-rooms" />
      </div>

      <Card className="grid gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-bold">Letzte 14 Tage</h2>
          <Legend />
        </div>
        <div className="flex h-28 items-end gap-1" role="img" aria-label="Partien pro Tag der letzten 14 Tage">
          {days.map(({ t, s }) => (
            <div key={t} className="flex h-full flex-1 flex-col justify-end" title={`${new Date(t).toLocaleDateString("de-DE")}: ${s.started} online, ${s.local} lokal`}>
              <div className="w-full rounded-t-sm bg-primary/35" style={{ height: `${(s.local / dayMax) * 100}%` }} />
              <div className={s.started ? "w-full bg-primary" : "w-full"} style={{ height: `${(s.started / dayMax) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{new Date(days[0].t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span>
          <span>heute</span>
        </div>
        <p className="text-xs text-muted-foreground">{share} % online, {100 - share} % „Ein Handy für alle“ (insgesamt).</p>
      </Card>

      <Card className="grid gap-2 p-4">
        <h2 className="font-bold">Beliebteste Spiele</h2>
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
              {games.map(({ id, c, played }) => (
                <tr key={id} className="border-t border-border" data-testid={`stat-game-${id}`}>
                  <td className="max-w-0 py-1.5 pr-1">
                    <span className="block truncate font-semibold">{gameName(id)}</span>
                    <span className="mt-0.5 block h-1 rounded-full bg-primary/70" style={{ width: `${(played / gameMax) * 100}%` }} aria-hidden />
                  </td>
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
          <Legend />
        </div>
        <ul className="grid gap-1.5">
          {weeks.map(({ week: w, s }) => (
            <li key={w} className="flex items-center gap-2 text-xs">
              <span className="w-11 shrink-0 text-muted-foreground">KW {Number(w.slice(-2))}</span>
              <span className="flex h-3 flex-1 overflow-hidden rounded-sm bg-navy-800/60">
                <span className="h-full bg-primary" style={{ width: `${(s.started / weekMax) * 100}%` }} />
                <span className="h-full bg-primary/35" style={{ width: `${(s.local / weekMax) * 100}%` }} />
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

function Legend() {
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary" />online</span>
      <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary/35" />lokal</span>
    </span>
  );
}
