import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { LOOKS } from "@shared/platform/looks";
import { MAX_BANNER, MAX_MESSAGE, type Access, type SiteFeatures, type SiteLimits } from "@shared/platform/access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Segmented } from "@/platform/Segmented";
import { useAdmin } from "./context";
import { DataTab } from "./Data";
import { AuthError } from "./shared";

const LEVELS = [
  { value: "on", label: "Offen", hint: "für alle" },
  { value: "code", label: "Mit Code", hint: "Zugangscode" },
  { value: "off", label: "Zu", hint: "geschlossen" },
] as const satisfies readonly { value: Access; label: string; hint: string }[];

const FEATURES: [keyof SiteFeatures, string, string][] = [
  ["online", "Online-Räume", "aus: nur „Ein Handy für alle“"],
  ["call", "Audio & Video", "in Online-Räumen"],
  ["groups", "Gruppen", "Bestenliste und Einladen"],
  ["profiles", "Profile", "persönliche Statistik"],
  ["local", "Ein Handy für alle", "lokal spielen ohne Raum"],
  ["offline", "Offline-App", "Seite und Spiele auf dem Handy speichern"],
];
const LIMITS: [keyof SiteLimits, string, string, number, number][] = [
  ["roomHours", "Leere Räume höchstens", "Stunden", 1, 336],
  ["maxPlayers", "Höchstens", "Leute pro Raum", 2, 20],
  ["maxRooms", "Höchstens", "offene Räume (0 = egal)", 0, 500],
];

/** Einstellungen: Aussehen, Startseite, Zugang, Funktionen, Grenzen, Daten – alles gilt sofort */
export function SettingsSection() {
  const { config, save, api, setConfig } = useAdmin();
  const [resets, setResets] = useState(0);
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start" data-testid="admin-settings" key={resets}>
      <Section title="Aussehen" hint="Gilt für alle. Hell oder dunkel stellt jeder selbst ein." wide>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" role="radiogroup" aria-label="Aussehen">
          {LOOKS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={config.look === l.id} data-testid={`look-${l.id}`}
              onClick={() => config.look !== l.id && void save({ look: l.id }, `Look: ${l.name}`)}
              className={cn("flex min-w-0 items-center gap-2 rounded-xl p-2 text-left outline-none ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-ring", config.look === l.id && "bg-primary/10 ring-2 ring-primary")}>
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
      </Section>

      <Section title="Startseite">
        <SaveField id="admin-banner" label="Hinweis-Banner (optional)" value={config.banner} max={MAX_BANNER} placeholder="z. B. Neu: Ludo und Mühle!"
          onSave={(banner) => save({ banner }, banner ? "Banner gespeichert" : "Banner entfernt")} />
      </Section>

      <Section title="Zugang" hint="Wer den Spieltisch öffnen darf. Einzelne Spiele stellst du unter „Spiele“ ein.">
        <Segmented label="Spieltisch" value={config.site} options={LEVELS} onChange={(site) => void save({ site }, `Spieltisch: ${LEVELS.find((l) => l.value === site)?.label}`)} />
        <SaveField id="admin-msg" label="Hinweis für Besucher (optional)" value={config.message} max={MAX_MESSAGE} placeholder="z. B. Heute ab 20 Uhr wieder offen"
          onSave={(message) => save({ message }, "Hinweis gespeichert")} />
        <AccessCode />
      </Section>

      <Section title="Funktionen">
        {FEATURES.map(([key, label, hint]) => (
          <label key={key} className="flex items-center gap-3">
            <Checkbox checked={config.features[key]} aria-label={label}
              onCheckedChange={(c) => void save({ features: { ...config.features, [key]: c === true } }, `${label} ${c === true ? "an" : "aus"}`)} />
            <span><span className="block font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
          </label>
        ))}
      </Section>

      <Section title="Grenzen">
        {LIMITS.map(([key, before, after, min, max]) => (
          <NumberField key={key} label={`${before} ${after}`} before={before} after={after} min={min} max={max} value={config.limits[key]}
            onSave={(v) => save({ limits: { ...config.limits, [key]: v } }, `${before} ${v} ${after}`)} />
        ))}
        <NumberField label="Verlauf behalten Tage" before="Verlauf behalten" after="Tage" min={1} max={365} value={config.archiveDays}
          onSave={(archiveDays) => save({ archiveDays }, `Verlauf: ${archiveDays} Tage`)} />
      </Section>

      <div className="lg:col-span-2">
        <DataTab api={api} onReset={(c) => { setConfig(c); setResets((n) => n + 1); }} />
      </div>
    </div>
  );
}

function Section({ title, hint, wide, children }: { title: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <Card className={cn("grid gap-3", wide && "lg:col-span-2")}>
      <div>
        <h2 className="font-bold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

/** Textfeld, das beim Verlassen (oder mit Enter) speichert */
function SaveField({ id, label, value, max, placeholder, onSave }: { id: string; label: string; value: string; max: number; placeholder?: string; onSave: (v: string) => unknown }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { const v = draft.trim(); if (v !== value) void onSave(v); };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={draft} maxLength={max} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </div>
  );
}

function NumberField({ label, before, after, min, max, value, onSave }: { label: string; before: string; after: string; min: number; max: number; value: number; onSave: (v: number) => unknown }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const v = Math.min(max, Math.max(min, Number(draft) || 0));
    setDraft(String(v));
    if (v !== value) void onSave(v);
  };
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="flex-1">{before} <span className="text-muted-foreground">{after}</span></span>
      <Input type="number" inputMode="numeric" min={min} max={max} className="w-20 text-center" value={draft} aria-label={label}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </label>
  );
}

/** Zugangscode: geheim, deshalb mit eigenem Knopf statt Sofort-Speichern */
function AccessCode() {
  const { config, api, setConfig } = useAdmin();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const needsCode = config.site === "code" || Object.values(config.games).includes("code");
  const send = async (value: string | null) => {
    setBusy(true); setMsg(null);
    try {
      const { hasCode: _h, defaults: _d, epoch: _e, ...rest } = config;
      const r = await api<{ config: typeof config }>("/api/admin", { config: rest, code: value });
      setConfig(r.config); setCode("");
      setMsg(value ? "Zugangscode gespeichert." : "Zugangscode gelöscht.");
    } catch (e) { if (!(e instanceof AuthError)) setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="admin-code">Zugangscode <span className="font-normal text-muted-foreground">{config.hasCode ? "(gesetzt)" : "(noch keiner)"}</span></Label>
      <div className="flex gap-2">
        <Input id="admin-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={config.hasCode ? "neuer Code" : "Code, 4–32 Zeichen"} autoComplete="off" />
        <Button variant="secondary" disabled={busy || code.trim().length < 4} onClick={() => void send(code.trim())}>{busy && <Loader2 className="animate-spin" />}Setzen</Button>
      </div>
      {needsCode && !config.hasCode && <p className="text-sm text-destructive">„Mit Code“ ist an – lege einen Zugangscode fest.</p>}
      {config.hasCode && <Button variant="ghost" size="sm" className="justify-self-start text-muted-foreground" disabled={busy} onClick={() => void send(null)}>Zugangscode löschen</Button>}
      {msg && <p role="status" className="text-sm font-semibold text-ok">{msg}</p>}
    </div>
  );
}
