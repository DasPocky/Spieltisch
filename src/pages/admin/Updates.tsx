import { useCallback, useEffect, useState } from "react";
import { Loader2, Rocket, Sparkles } from "lucide-react";
import { NEWS, MAX_NEWS_ITEM, MAX_NEWS_TITLE, type NewsOverrides } from "@shared/news";
import { RELEASE_HOW, UPDATE_MODES, type ReleaseStatus } from "@shared/platform/update";
import type { HealthDay } from "@shared/platform/admin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { AuthError, Panel, ago, dateTime } from "./shared";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Updates: wann neue Versionen live gehen, was gerade wartet, was zuletzt kam */
export function UpdatesPanel() {
  const { config, save, api } = useAdmin();
  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { api<ReleaseStatus>("/api/admin/release").then(setStatus, () => null); }, [api]);
  useEffect(() => { load(); }, [load, config.update.mode]);
  const u = config.update;
  const locked = !!status?.modeFromEnv;
  const mode = status?.mode ?? u.mode;
  const waits = mode === "idle" || mode === "time" || mode === "manual";
  const promote = async () => {
    setBusy(true); setMsg(null);
    try { await api("/api/admin/release", {}); setMsg({ ok: true, text: "Ist live – Geräte laden an einem ruhigen Moment neu." }); load(); }
    catch (e) { if (!(e instanceof AuthError)) setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  return (
    <Panel title="Updates" hint="Wann neue Versionen live gehen. Laufende Partien spielen immer mit ihrer Version zu Ende." wide>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Update-Zeitpunkt" data-testid="update-modes">
        {UPDATE_MODES.map((m) => (
          <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} disabled={locked}
            onClick={() => u.mode !== m.value && void save({ update: { ...u, mode: m.value } }, `Updates: ${m.label}`)}
            className={cn("rounded-xl p-2.5 text-left outline-none ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60", mode === m.value && "bg-primary/10 ring-2 ring-primary")}>
            <span className="block text-sm font-semibold">{m.label}{m.value === "now" && <span className="font-normal text-muted-foreground"> · Standard</span>}</span>
            <span className="block text-xs leading-snug text-muted-foreground">{m.hint}</span>
          </button>
        ))}
      </div>
      {locked && <p className="text-sm text-muted-foreground">Fest eingestellt über die Variable <code>UPDATE_MODE</code> – hier nicht änderbar.</p>}
      {mode === "idle" && (
        <label className="flex items-center gap-2 text-sm">
          <span className="flex-1">Höchstens warten <span className="text-muted-foreground">Stunden</span></span>
          <Input type="number" min={1} max={48} className="w-20 text-center" aria-label="Höchstens warten Stunden" defaultValue={u.maxWaitHours} disabled={locked}
            onBlur={(e) => { const v = Math.min(48, Math.max(1, Number(e.target.value) || 3)); if (v !== u.maxWaitHours) void save({ update: { ...u, maxWaitHours: v } }, `Höchstens ${v} Stunden warten`); }} />
        </label>
      )}
      {mode === "time" && (
        <label className="flex items-center gap-2 text-sm">
          <span className="flex-1">Uhrzeit <span className="text-muted-foreground">(deutsche Zeit)</span></span>
          <select className="h-9 rounded-md border border-input bg-transparent px-2" aria-label="Uhrzeit" value={u.hour} disabled={locked}
            onChange={(e) => void save({ update: { ...u, hour: Number(e.target.value) } }, `Updates um ${e.target.value} Uhr`)}>
            {HOURS.map((h) => <option key={h} value={h}>{h} Uhr</option>)}
          </select>
        </label>
      )}
      {status && waits && (!status.canPromote || !status.canReceive) && (
        <p className="rounded-xl bg-destructive/10 p-2.5 text-sm text-destructive" data-testid="update-missing">
          Damit Updates warten können, fehlen noch {[!status.canReceive && "RELEASE_SECRET", !status.canPromote && "DEPLOY_TOKEN"].filter(Boolean).join(" und ")} (siehe Betrieb-Doku). Bis dahin geht jede Version sofort live.
        </p>
      )}

      {status?.pending ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/10 p-2.5 text-sm" data-testid="update-pending">
          <Rocket className="size-4 text-primary" />
          <span className="min-w-0 flex-1">Version <code>{status.pending.sha.slice(0, 7)}</code> wartet seit {ago(status.pending.at)}.</span>
          <Button size="sm" disabled={busy} onClick={() => void promote()}>{busy && <Loader2 className="animate-spin" />}Jetzt live schalten</Button>
        </div>
      ) : status && <p className="text-sm text-muted-foreground">Gerade wartet kein Update.</p>}
      {msg && <p role="status" className={cn("text-sm font-semibold", msg.ok ? "text-ok" : "text-destructive")}>{msg.text}</p>}

      {!!status?.history.length && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Verlauf ({status.history.length})</summary>
          <ul className="mt-2 grid gap-1">
            {status.history.map((h) => (
              <li key={`${h.sha}-${h.at}`} className="flex flex-wrap gap-x-2">
                <code>{h.sha.slice(0, 7)}</code>
                <span className="text-muted-foreground">{dateTime(h.at)}</span>
                <span>{h.skipped ? "übersprungen (neuere kam)" : h.liveAt ? `live ${h.how ? RELEASE_HOW[h.how] : ""}${h.liveAt - h.at > 60_000 ? `, ${ago(h.liveAt)}` : ""}` : "wartet"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

/** „Was ist neu?“ – Texte ändern oder einzelne Einträge ausblenden */
export function NewsPanel() {
  const { config, save } = useAdmin();
  const o: NewsOverrides = config.news;
  const set = (next: NewsOverrides, label: string) => void save({ news: next }, label);
  return (
    <Panel title="Was ist neu?" hint="Erscheint einmal pro Gerät nach einem Update (nie mitten im Spiel) und im Profil unter „Neuigkeiten“." wide>
      <div className="grid gap-3" data-testid="news-admin">
        {NEWS.map((n) => {
          const e = o.edits[n.id];
          const hidden = o.hidden.includes(n.id);
          return (
            <NewsItem key={n.id} id={n.id} date={n.date} title={e?.title ?? n.title} items={e?.items ?? n.items} edited={!!e} hidden={hidden}
              onHide={(h) => set({ ...o, hidden: h ? [...o.hidden, n.id] : o.hidden.filter((x) => x !== n.id) }, h ? "Ausgeblendet" : "Wieder sichtbar")}
              onSave={(title, items) => set({ ...o, edits: { ...o.edits, [n.id]: { title, items } } }, "Neuigkeit gespeichert")}
              onReset={() => { const { [n.id]: _, ...rest } = o.edits; set({ ...o, edits: rest }, "Originaltext wiederhergestellt"); }} />
          );
        })}
      </div>
    </Panel>
  );
}

function NewsItem({ id, date, title, items, edited, hidden, onHide, onSave, onReset }: {
  id: string; date: string; title: string; items: string[]; edited: boolean; hidden: boolean;
  onHide: (h: boolean) => void; onSave: (title: string, items: string[]) => void; onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState(title);
  const [body, setBody] = useState(items.join("\n"));
  useEffect(() => { setT(title); setBody(items.join("\n")); }, [title, items]);
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className={cn("rounded-xl p-2.5 ring-1 ring-inset ring-border", hidden && "opacity-60")} data-testid={`news-${id}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1"><b>{title}</b> <span className="text-xs text-muted-foreground">{date}{edited && " · geändert"}</span></span>
        <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={!hidden} aria-label={`${title} zeigen`} onCheckedChange={(c) => onHide(c !== true)} />zeigen</label>
        <Button size="sm" variant="ghost" onClick={() => setOpen((x) => !x)}>{open ? "Zu" : "Bearbeiten"}</Button>
      </div>
      {open && (
        <div className="mt-2 grid gap-2">
          <Input value={t} maxLength={MAX_NEWS_TITLE} aria-label="Titel" onChange={(e) => setT(e.target.value)} />
          <textarea value={body} rows={4} aria-label="Punkte (je Zeile einer)" onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          <p className="text-xs text-muted-foreground">Je Zeile ein Punkt, höchstens {MAX_NEWS_ITEM} Zeichen.</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={!t.trim() || !lines.length} onClick={() => onSave(t.trim(), lines)}>Speichern</Button>
            {edited && <Button size="sm" variant="ghost" onClick={onReset}>Originaltext</Button>}
          </div>
        </div>
      )}
    </div>
  );
}


/** Protokoll der Verwaltung: wann wurde zugeschaut, eingegriffen, gespeichert (ohne Inhalte) */
export function AuditPanel() {
  const { api } = useAdmin();
  const [list, setList] = useState<{ at: number; what: string }[] | null>(null);
  useEffect(() => { api<{ at: number; what: string }[]>("/api/admin/audit").then(setList, () => null); }, [api]);
  return (
    <Panel title="Protokoll der Verwaltung" hint="Wann zugeschaut, eingegriffen oder gespeichert wurde – ohne Inhalte, PINs oder Chat.">
      {!list ? <p className="text-sm text-muted-foreground">Lädt …</p> : !list.length ? <p className="text-sm text-muted-foreground">Noch keine Einträge.</p> : (
        <details className="text-sm" data-testid="audit">
          <summary className="cursor-pointer font-semibold">Letzte {list.length} Einträge</summary>
          <ul className="mt-2 grid max-h-64 gap-1 overflow-y-auto">
            {list.map((e) => <li key={`${e.at}-${e.what}`} className="flex gap-2"><span className="shrink-0 text-muted-foreground">{dateTime(e.at)}</span><span className="min-w-0">{e.what}</span></li>)}
          </ul>
        </details>
      )}
    </Panel>
  );
}

/** Betrieb: Verbindungen, abgelehnte Züge, kaputte Nachrichten – je Tag, ohne Inhalte */
export function HealthPanel() {
  const { api } = useAdmin();
  const [days, setDays] = useState<HealthDay[] | null>(null);
  useEffect(() => { api<HealthDay[]>("/api/admin/health").then(setDays, () => null); }, [api]);
  const top = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}×`).join(", ");
  return (
    <Panel title="Betrieb" hint="Je Tag: Beitritte, Wiederverbindungen (Funkloch, Neuladen, Update), abgelehnte Züge und kaputte Nachrichten.">
      {!days ? <p className="text-sm text-muted-foreground">Lädt …</p> : !days.length ? <p className="text-sm text-muted-foreground">Noch nichts gezählt.</p> : (
        <ul className="grid gap-1.5 text-sm" data-testid="health">
          {days.slice(0, 7).map((d) => (
            <li key={d.day}>
              <b>{new Date(`${d.day}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })}</b>
              <span className="text-muted-foreground"> · {d.joins} Beitritte · {d.reconnects} wieder verbunden · {Object.values(d.rejected).reduce((a, b) => a + b, 0)} Züge abgelehnt · {d.bad} kaputte Nachrichten</span>
              {Object.keys(d.rejected).length > 0 && <span className="block text-xs text-muted-foreground">Häufigste: {top(d.rejected)}</span>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
