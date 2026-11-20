import { useEffect, useState } from "react";
import { Rocket, Sparkles } from "lucide-react";
import { NEWS, MAX_NEWS_ITEM, MAX_NEWS_TITLE, type NewsOverrides } from "@shared/news";
import type { ReleaseStatus } from "@shared/platform/update";
import type { HealthDay } from "@shared/platform/admin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { Panel, dateTime } from "./shared";

/** Updates: jede neue Version geht nach dem Merge sofort live, Geräte laden kurz neu */
export function UpdatesPanel() {
  const { api } = useAdmin();
  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  useEffect(() => { api<ReleaseStatus>("/api/admin/release").then(setStatus, () => null); }, [api]);
  return (
    <Panel title="Updates" hint="Jede neue Version geht sofort live. Geräte zeigen einen kurzen Hinweis, laden neu und spielen im selben Raum weiter.">
      <p className="flex items-center gap-2 text-sm" data-testid="update-mode">
        <Rocket className="size-4 text-primary" />
        Sofort für alle
      </p>
      {status && <p className="text-sm text-muted-foreground">Läuft: <code>{status.build.sha.slice(0, 7)}</code>{status.build.time ? `, gebaut ${dateTime(Date.parse(status.build.time))}` : ""}</p>}
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
