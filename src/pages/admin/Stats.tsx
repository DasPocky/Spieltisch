import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { FEATURE_KINDS, isoWeek, STAT_KINDS, sumStats, type FeatureCounts, type FeatureKind, type SiteStats, type StatCounts } from "@shared/platform/admin";
import { Card } from "@/components/ui/card";
import { readStr, writeStr } from "@/lib/storage";
import { fmt } from "@/lib/utils";
import { Segmented } from "@/platform/Segmented";
import { dayKey } from "@/lib/time";
import { useAdmin } from "./context";
import { AuthError, gameName, Tile } from "./shared";

type Range = "7" | "30" | "60" | "all";
const RANGES: { value: Range; label: string }[] = [
  { value: "7", label: "7 Tage" }, { value: "30", label: "30 Tage" }, { value: "60", label: "60 Tage" }, { value: "all", label: "Gesamt" },
];
const DAY = 86_400_000;
/** Gewählter Zeitraum, solange der Tab offen ist */
const RANGE_KEY = "spieltisch:admin-range";
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WD_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const FEATURE_LABEL: Record<FeatureKind, string> = {
  call: "Audio-Anruf beigetreten", video: "Kamera eingeschaltet", chat: "Chat-Nachrichten",
  knock: "Angeklopft", group: "Gruppen angelegt", private: "Private Räume",
};

const addCounts = (into: Record<string, StatCounts>, games: Record<string, StatCounts>) => {
  for (const [id, c] of Object.entries(games)) {
    const t = (into[id] ??= {});
    for (const k of STAT_KINDS) if (c[k]) t[k] = (t[k] ?? 0) + c[k];
  }
};

/** Statistik: Zeitraum wählen – Partien, Verlauf, beliebte Spiele, Spitzenzeiten und genutzte Funktionen */
export function StatsSection() {
  const { api } = useAdmin();
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>(() => (readStr(RANGE_KEY, true) as Range) || "30");
  useEffect(() => writeStr(RANGE_KEY, range, true), [range]);
  useEffect(() => {
    api<SiteStats>("/api/admin/stats").then(setStats).catch((e) => { if (!(e instanceof AuthError)) setError((e as Error).message); });
  }, [api]);

  const data = useMemo(() => {
    if (!stats) return null;
    const now = Date.now();
    const n = range === "all" ? Infinity : Number(range);
    const from = n === Infinity ? "" : dayKey(now - (n - 1) * DAY);
    const days = (stats.days ?? []).filter((d) => d.day >= from);
    const games: Record<string, StatCounts> = {};
    if (range === "all") Object.assign(games, structuredClone(stats.totals)); else for (const d of days) addCounts(games, d.games);
    const slots = new Map<string, number>();
    const features: FeatureCounts = {};
    for (const d of days) {
      for (const [k, v] of Object.entries(d.slots ?? {})) slots.set(k, (slots.get(k) ?? 0) + v);
      for (const k of FEATURE_KINDS) if (d.features?.[k]) features[k] = (features[k] ?? 0) + d.features[k]!;
    }
    // Verlauf: Tage im Zeitraum – „Gesamt“ in Wochen
    const byDay = new Map((stats.days ?? []).map((d) => [d.day, sumStats(d.games)]));
    const byWeek = new Map(stats.weeks.map((w) => [w.week, sumStats(w.games)]));
    const bars = range === "all"
      ? Array.from({ length: 12 }, (_, i) => { const w = isoWeek(now - (11 - i) * 7 * DAY); const s = byWeek.get(w); return { key: w, label: `KW ${Number(w.slice(-2))}`, online: s?.started ?? 0, local: s?.local ?? 0 }; })
      : Array.from({ length: n }, (_, i) => { const t = now - (n - 1 - i) * DAY; const s = byDay.get(dayKey(t)); return { key: dayKey(t), label: new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), online: s?.started ?? 0, local: s?.local ?? 0 }; });
    // Spitzenzeiten und Funktionen werden erst seit diesem Stand gezählt
    const counted = (stats.days ?? []).filter((d) => d.slots || d.features).map((d) => d.day).sort()[0];
    return { total: sumStats(games), games, slots, features, bars, counted };
  }, [stats, range]);

  if (!stats || !data) return error ? <p className="font-semibold text-destructive">{error}</p> : <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Lädt …</p>;
  const { total } = data;
  const since = range === "all" ? `seit ${new Date(stats.since).toLocaleDateString("de-DE")}` : `letzte ${range} Tage`;

  return (
    <div className="grid gap-4" data-testid="stats">
      <div className="lg:max-w-md"><Segmented label="Zeitraum" value={range} options={RANGES} onChange={setRange} /></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Partien" value={total.started + total.local} hint={`${fmt(total.started)} online · ${fmt(total.local)} lokal`} testId="stat-started" />
        <Tile label="Räume" value={total.rooms} hint={since} testId="stat-rooms" />
        <Tile label="Beitritte" value={total.players} hint="in Online-Räume" />
        <Tile label="Fertig gespielt" value={total.finished} hint="online beendet" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Block title={range === "all" ? "Partien pro Woche" : "Partien pro Tag"} extra={<Legend />}>
          <Bars bars={data.bars} />
        </Block>
        <PopularGames games={data.games} />
        <Block title="Spitzenzeiten" extra={<span className="text-xs text-muted-foreground">gestartete Partien</span>}>
          <Heatmap slots={data.slots} />
          <p className="text-xs text-muted-foreground">Deutsche Zeit. {data.counted ? `Gezählt seit ${new Date(data.counted).toLocaleDateString("de-DE")}.` : "Wird ab jetzt gezählt."}</p>
        </Block>
        <Features features={data.features} counted={data.counted} />
      </div>
    </div>
  );
}

function Block({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <Card className="grid gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2"><h2 className="font-bold">{title}</h2>{extra}</div>
      {children}
    </Card>
  );
}

function Bars({ bars }: { bars: { key: string; label: string; online: number; local: number }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.online + b.local));
  const sum = bars.reduce((n, b) => n + b.online + b.local, 0);
  return (
    <>
      <div className={bars.length > 30 ? "flex h-28 items-end gap-px" : "flex h-28 items-end gap-1"} role="img" aria-label={`Verlauf, zusammen ${sum} Partien`} data-testid="stat-bars">
        {bars.map((b) => (
          <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.label}: ${b.online} online, ${b.local} lokal`}>
            <div className="w-full rounded-t-sm bg-primary/35" style={{ height: `${(b.local / max) * 100}%` }} />
            <div className={b.online ? "w-full bg-primary" : "w-full"} style={{ height: `${(b.online / max) * 100}%` }} />
            {!b.online && !b.local && <div className="h-0.5 w-full rounded-full bg-border" />}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground"><span>{bars[0]?.label}</span><span>{bars.length > 12 ? "heute" : bars.at(-1)?.label}</span></div>
    </>
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

function PopularGames({ games }: { games: Record<string, StatCounts> }) {
  const list = Object.entries(games)
    .map(([id, c]) => ({ id, c, played: (c.started ?? 0) + (c.local ?? 0) }))
    .filter((g) => g.played || g.c.rooms)
    .sort((a, b) => b.played - a.played || (b.c.rooms ?? 0) - (a.c.rooms ?? 0));
  const max = Math.max(1, ...list.map((g) => g.played));
  return (
    <Block title="Beliebteste Spiele">
      {list.length === 0 ? <p className="text-sm text-muted-foreground">In diesem Zeitraum nichts gespielt.</p> : (
        <ol className="grid gap-1.5">
          {list.slice(0, 10).map(({ id, c, played }, i) => (
            <li key={id} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 text-sm" data-testid={`stat-game-${id}`}>
              <span className="text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="min-w-0">
                <span className="flex items-baseline justify-between gap-2"><b className="truncate">{gameName(id)}</b><span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmt(c.started ?? 0)} online · {fmt(c.local ?? 0)} lokal</span></span>
                <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-navy-800/60">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(played / max) * 100}%` }} />
                </span>
              </span>
              <b className="w-8 text-right tabular-nums">{fmt(played)}</b>
            </li>
          ))}
        </ol>
      )}
      {list.length > 10 && <p className="text-xs text-muted-foreground">… und {list.length - 10} weitere</p>}
    </Block>
  );
}

/** Wochentag × Stunde: je dunkler, desto mehr Partien begannen dann */
function Heatmap({ slots }: { slots: Map<string, number> }) {
  const max = Math.max(0, ...slots.values());
  let top: [number, number] | null = null;
  for (const [k, v] of slots) if (v === max && max > 0) { const [d, h] = k.split("-").map(Number); top = [d, h]; break; }
  // Wochentag mit den meisten Partien
  const perDay = WD.map((_, d) => Array.from({ length: 24 }, (_, h) => slots.get(`${d}-${h}`) ?? 0).reduce((a, b) => a + b, 0));
  const best = perDay.indexOf(Math.max(...perDay));
  return (
    <div className="grid gap-2" data-testid="stat-heatmap">
      <div className="grid grid-cols-[1.5rem_repeat(24,minmax(0,1fr))] gap-[2px]" role="img" aria-label={top ? `Am meisten los: ${WD_LONG[top[0]]} ab ${top[1]} Uhr` : "Noch keine Daten"}>
        {WD.map((wd, d) => (
          <Row key={wd} label={wd}>
            {Array.from({ length: 24 }, (_, h) => {
              const v = slots.get(`${d}-${h}`) ?? 0;
              return <span key={h} className="aspect-square rounded-[3px] bg-primary" style={{ opacity: v ? 0.15 + 0.85 * (v / max) : 0.06 }} title={`${WD_LONG[d]} ${h}–${h + 1} Uhr: ${v}`} />;
            })}
          </Row>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center text-[9px] text-muted-foreground">{h % 6 === 0 ? h : ""}</span>)}
      </div>
      <p className="text-sm">{top ? <>Am meisten los: <b>{WD_LONG[top[0]]} ab {top[1]} Uhr</b> · stärkster Tag: <b>{WD_LONG[best]}</b></> : <span className="text-muted-foreground">Noch keine Partien in diesem Zeitraum.</span>}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <><span className="self-center text-[10px] font-semibold text-muted-foreground">{label}</span>{children}</>;
}

function Features({ features, counted }: { features: FeatureCounts; counted?: string }) {
  const max = Math.max(1, ...FEATURE_KINDS.map((k) => features[k] ?? 0));
  return (
    <Block title="Genutzte Funktionen">
      <ul className="grid gap-1.5" data-testid="stat-features">
        {FEATURE_KINDS.map((k) => (
          <li key={k} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2.5rem] items-center gap-2 text-sm">
            <span className="truncate">{FEATURE_LABEL[k]}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-navy-800/60"><span className="block h-full rounded-full bg-primary" style={{ width: `${((features[k] ?? 0) / max) * 100}%` }} /></span>
            <b className="text-right tabular-nums">{fmt(features[k] ?? 0)}</b>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Nur Online-Räume (und Gruppen). {counted ? `Gezählt seit ${new Date(counted).toLocaleDateString("de-DE")}.` : "Wird ab jetzt gezählt."}</p>
    </Block>
  );
}
