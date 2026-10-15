import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Sparkles } from "lucide-react";
import { GAME_IDS } from "@shared/games";
import { LOOKS } from "@shared/platform/looks";
import { MAX_BANNER, orderGames, type SiteConfig, type SiteFeatures, type SiteLimits } from "@shared/platform/access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setSiteConfig, siteConfigNow } from "@/hooks/useSiteConfig";
import { applyLook } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { gameName, Status, toAccess, useSave, type Api } from "./shared";

const FEATURES: [keyof SiteFeatures, string, string][] = [
  ["online", "Online-Räume", "aus: nur „Ein Handy für alle“"],
  ["call", "Audio & Video", "in Online-Räumen"],
  ["groups", "Gruppen", "Bestenliste und Einladen"],
  ["profiles", "Profile", "persönliche Statistik"],
  ["local", "Ein Handy für alle", "lokal spielen ohne Raum (sonst nur online)"],
  ["offline", "Offline-App", "Seite und Spiele auf dem Handy speichern – lokal ohne Netz"],
];
const LIMITS: [keyof SiteLimits, string, string, number, number][] = [
  ["roomHours", "Leere Räume höchstens", "Stunden (Obergrenze für die Wahl des Hosts)", 1, 336],
  ["maxPlayers", "Höchstens", "Leute pro Raum", 2, 20],
  ["maxRooms", "Höchstens", "offene Räume (0 = egal)", 0, 500],
];

/** Startseite, Grenzen, Funktionen und Verlauf-Frist */
export function OptionsTab({ config, api, onSaved }: { config: SiteConfig; api: Api; onSaved: (c: SiteConfig) => void }) {
  const [banner, setBanner] = useState(config.banner);
  const [featured, setFeatured] = useState(config.featured);
  const [order, setOrder] = useState(() => orderGames(GAME_IDS, config.order));
  const [limits, setLimits] = useState(config.limits);
  const [features, setFeatures] = useState(config.features);
  const [archiveDays, setArchiveDays] = useState(config.archiveDays);
  const [look, setLook] = useState(config.look);
  const { busy, msg, run } = useSave();
  // Auswahl gleich als Vorschau zeigen; ohne Speichern beim Verlassen zurück zum gespeicherten Look
  useEffect(() => { applyLook(look); }, [look]);
  useEffect(() => () => { applyLook(siteConfigNow()?.look ?? config.look); }, [config.look]);

  const move = (i: number, d: -1 | 1) => setOrder((o) => { const n = [...o]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const save = () => run(async () => {
    // Freigaben vom letzten Stand übernehmen, nur die eigenen Felder ändern
    const r = await api<{ config: SiteConfig }>("/api/admin", { config: { ...toAccess(config), banner, featured, order, limits, features, archiveDays, look } });
    onSaved(r.config); setSiteConfig(r.config);
  });

  return (
    <div className="grid gap-5" data-testid="options">
      <Card className="grid gap-3">
        <h2 className="font-bold">Aussehen</h2>
        <p className="-mt-2 text-sm text-muted-foreground">Gilt für alle. Hell oder dunkel stellt jeder selbst ein. Vorschau sofort, für alle erst mit „Speichern“.</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Aussehen">
          {LOOKS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={look === l.id} onClick={() => setLook(l.id)} data-testid={`look-${l.id}`}
              className={cn("flex min-w-0 items-center gap-2 rounded-xl p-2 text-left outline-none ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-ring", look === l.id && "bg-primary/10 ring-2 ring-primary")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ background: l.page, boxShadow: `inset 0 0 0 1px ${l.ink}33` }} aria-hidden>
                <span className="flex h-5 w-7 items-end justify-end rounded-[4px] p-0.5" style={{ background: l.card }}><span className="size-2.5 rounded-full" style={{ background: l.primary }} /></span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold" style={{ fontFamily: `"${l.font}"` }}>{l.name}</span>
                <span className="block truncate text-[0.7rem] leading-tight text-muted-foreground">{l.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-bold">Startseite</h2>
        <div className="grid gap-2">
          <Label htmlFor="admin-banner">Hinweis-Banner (optional)</Label>
          <Input id="admin-banner" value={banner} maxLength={MAX_BANNER} placeholder="z. B. Neu: Ludo und Mühle!" onChange={(e) => setBanner(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">Reihenfolge und „Neu“ in der Spielauswahl</span>
          <ol className="grid gap-1">
            {order.map((id, i) => (
              <li key={id} className="flex items-center gap-1 rounded-lg py-0.5 pl-3 ring-1 ring-inset ring-border">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{gameName(id)}</span>
                <button type="button" aria-pressed={featured.includes(id)} onClick={() => setFeatured((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))}
                  className={cn("flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring", featured.includes(id) ? "bg-primary/14 text-primary" : "text-muted-foreground")}
                  aria-label={`${gameName(id)} als neu markieren`}><Sparkles className="size-3.5" />Neu</button>
                <Button variant="ghost" size="icon" className="size-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${gameName(id)} nach oben`}><ArrowUp /></Button>
                <Button variant="ghost" size="icon" className="size-8" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`${gameName(id)} nach unten`}><ArrowDown /></Button>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-bold">Funktionen</h2>
        {FEATURES.map(([key, label, hint]) => (
          <label key={key} className="flex items-center gap-3">
            <Checkbox checked={features[key]} onCheckedChange={(c) => setFeatures({ ...features, [key]: c === true })} aria-label={label} />
            <span><span className="block font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
          </label>
        ))}
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-bold">Grenzen</h2>
        {LIMITS.map(([key, before, after, min, max]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{before} <span className="text-muted-foreground">{after}</span></span>
            <Input type="number" inputMode="numeric" min={min} max={max} className="w-20 text-center" value={limits[key]} aria-label={`${before} ${after}`}
              onChange={(e) => setLimits({ ...limits, [key]: Math.min(max, Math.max(min, Number(e.target.value) || 0)) })} />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <span className="flex-1">Verlauf behalten <span className="text-muted-foreground">Tage</span></span>
          <Input type="number" inputMode="numeric" min={1} max={365} className="w-20 text-center" value={archiveDays} aria-label="Verlauf behalten Tage"
            onChange={(e) => setArchiveDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))} />
        </label>
      </Card>

      <Status msg={msg} />
      <Button size="lg" disabled={busy} onClick={save}>{busy && <Loader2 className="animate-spin" />}Speichern</Button>
    </div>
  );
}
