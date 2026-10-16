import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { sumStats, type AdminRoom, type SiteStats } from "@shared/platform/access";
import { LOOKS } from "@shared/platform/looks";
import { GAMES } from "@shared/games";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { goSection, SectionTile } from "./nav";
import { useDev } from "@/lib/dev";
import { StatusBar } from "./Status";
import { Tile } from "./shared";

/** Offene Räume, alle 15 Sekunden frisch – für Admin-Start und Live */
export function useAdminRooms() {
  const { api } = useAdmin();
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRooms((await api<{ rooms: AdminRoom[] }>("/api/admin/rooms")).rooms); } catch { /* nächster Versuch */ } finally { setLoading(false); }
  }, [api]);
  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);
  return { rooms, loading, load };
}

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Admin-Start: drei Zahlen live, Hinweise mit Ein-Tipp-Lösung, darunter die Bereiche */
export function AdminHome() {
  const { config, api, save } = useAdmin();
  const { rooms, load } = useAdminRooms();
  const devOn = useDev().on;
  const [stats, setStats] = useState<SiteStats | null>(null);
  useEffect(() => { api<SiteStats>("/api/admin/stats").then(setStats).catch(() => { /* ohne Zahlen */ }); }, [api]);

  const online = rooms?.reduce((n, r) => n + r.players.filter((p) => p.online).length, 0);
  const today = stats ? sumStats(stats.days?.find((d) => d.day === dayKey(Date.now()))?.games ?? {}) : null;
  const playing = rooms?.filter((r) => r.phase === "playing").length ?? 0;

  // Was gerade Aufmerksamkeit braucht – jeweils mit dem Knopf, der es löst
  const notes: { id: string; warn?: boolean; text: ReactNode; action?: { label: string; run: () => void } }[] = [];
  for (const r of rooms ?? []) {
    if (r.locked) notes.push({ id: `lock-${r.code}`, warn: true, text: <>Raum <b className="tracking-wider">{r.code}</b>: PIN-Sperre nach falschen PINs</>,
      action: { label: "Lösen", run: () => { void api(`/api/admin/rooms/${r.code}/unlock`, {}).then(load); } } });
  }
  if (config.site === "off") notes.push({ id: "site", warn: true, text: "Der Spieltisch ist geschlossen.", action: { label: "Öffnen", run: () => void save({ site: "on" }, "Spieltisch ist offen") } });
  if (config.site === "code") notes.push({ id: "site", text: "Der Spieltisch braucht einen Zugangscode." });
  const needsCode = config.site === "code" || Object.values(config.games).includes("code");
  if (needsCode && !config.hasCode) notes.push({ id: "code", warn: true, text: "„Mit Code“ ist an, aber es gibt keinen Zugangscode.", action: { label: "Festlegen", run: () => goSection("einstellungen") } });
  if (!config.features.online) notes.push({ id: "online", warn: true, text: "Online-Räume sind abgeschaltet.", action: { label: "Einschalten", run: () => void save({ features: { ...config.features, online: true } }, "Online-Räume an") } });
  if (config.banner) notes.push({ id: "banner", text: <>Banner aktiv: „{config.banner}“</>, action: { label: "Entfernen", run: () => void save({ banner: "" }, "Banner entfernt") } });

  const off = Object.values(config.games).filter((a) => a === "off").length;
  const coded = Object.values(config.games).filter((a) => a === "code").length;

  return (
    <div className="grid gap-4">
      <StatusBar />
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Räume offen" value={rooms ? rooms.length : "…"} hint={rooms ? `${playing} spielen` : undefined} testId="live-rooms" />
        <Tile label="Online jetzt" value={online ?? "…"} hint="Leute" testId="live-online" />
        <Tile label="Heute" value={today ? today.started + today.local : "…"} hint="Partien" testId="today" />
      </div>

      {notes.length > 0 && (
        <ul className="grid gap-1.5" data-testid="admin-notes">
          {notes.map((n) => (
            <li key={n.id} className={cn("flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm", n.warn ? "bg-destructive/10" : "bg-primary/8")}>
              {n.warn ? <AlertTriangle className="size-4.5 shrink-0 text-destructive" /> : <Info className="size-4.5 shrink-0 text-primary" />}
              <span className="min-w-0 flex-1 leading-snug">{n.text}</span>
              {n.action && <Button size="sm" variant={n.warn ? "default" : "secondary"} className="shrink-0" onClick={n.action.run}>{n.action.label}</Button>}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <SectionTile id="live" info={rooms ? `${rooms.length} ${rooms.length === 1 ? "Raum" : "Räume"} · ${online ?? 0} online` : undefined} />
        <SectionTile id="statistik" info={stats ? `${sumStats(stats.totals).started + sumStats(stats.totals).local} Partien seit Beginn` : undefined} />
        <SectionTile id="spiele" info={`${Object.keys(GAMES).length - off - coded} frei${coded ? ` · ${coded} mit Code` : ""}${off ? ` · ${off} aus` : ""}`} />
        <SectionTile id="leute" />
        <SectionTile id="einstellungen" info={`Look: ${LOOKS.find((l) => l.id === config.look)?.name ?? config.look}`} />
        {devOn && <SectionTile id="entwickler" />}
      </div>
    </div>
  );
}
