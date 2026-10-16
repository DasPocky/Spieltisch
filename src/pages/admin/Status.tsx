import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, CircleAlert, GitCommitHorizontal, RefreshCw } from "lucide-react";
import { BUILD, FREE_REQUESTS, REPO, type ServerStatus } from "@shared/build";
import { Button } from "@/components/ui/button";
import { cn, fmt } from "@/lib/utils";
import { useAdmin } from "./context";
import { ago } from "./shared";

interface MainCommit { sha: string; message: string; date: string }
const GH_KEY = "spieltisch:admin-main";

/** Letzter Commit auf main (öffentlich, ohne Anmeldung) – fünf Minuten gemerkt, das Kontingent ist knapp */
async function mainCommit(force = false): Promise<MainCommit | null> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(GH_KEY) ?? "null") as { at: number; c: MainCommit } | null;
    if (!force && saved && Date.now() - saved.at < 5 * 60_000) return saved.c;
  } catch { /* egal */ }
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, { headers: { accept: "application/vnd.github+json" } });
    if (!r.ok) return null;
    const d = (await r.json()) as { sha: string; commit: { message: string; committer?: { date: string }; author?: { date: string } } };
    const c = { sha: d.sha, message: d.commit.message.split("\n")[0], date: d.commit.committer?.date ?? d.commit.author?.date ?? "" };
    try { sessionStorage.setItem(GH_KEY, JSON.stringify({ at: Date.now(), c })); } catch { /* egal */ }
    return c;
  } catch { return null; }
}

const short = (sha: string) => (sha && sha !== "dev" ? sha.slice(0, 7) : "dev");

/** Status auf dem Admin-Start: Server, Version (Gerät, Server, main), Anfragen heute, Verbindungen – Details zum Aufklappen */
export function StatusBar() {
  const { api } = useAdmin();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [down, setDown] = useState(false);
  const [main, setMain] = useState<MainCommit | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (force = false) => {
    const t = performance.now();
    try {
      const s = await api<ServerStatus>("/api/admin/status");
      setMs(Math.round(performance.now() - t)); setStatus(s); setDown(false);
    } catch { setDown(true); setMs(null); }
    setMain(await mainCommit(force));
  }, [api]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 60_000); return () => clearInterval(t); }, [load]);

  const server = status?.build.sha;
  const deviceOld = !!server && server !== "dev" && BUILD.sha !== "dev" && server !== BUILD.sha;
  // Vorschau oder Entwicklung: ein anderer Zweig ist kein Fehler
  const branch = status?.build.branch && status.build.branch !== "main" ? status.build.branch : null;
  const mainNewer = !branch && !!server && !!main && server !== "dev" && main.sha !== server;
  const version = !status ? { ok: true, text: "…" }
    : deviceOld ? { ok: false, text: "Gerät alt" }
    : branch ? { ok: true, text: "Zweig" }
    : mainNewer ? { ok: false, text: "Update offen" }
    : main === null ? { ok: true, text: short(server ?? "") }
    : { ok: true, text: "aktuell" };
  const used = status ? status.requests.count / FREE_REQUESTS : 0;

  return (
    <section className="glass rounded-2xl p-1" data-testid="admin-status">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="relative grid w-full grid-cols-3 items-stretch gap-1 rounded-xl pb-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Cell label="Server" ok={!down} value={down ? "weg" : ms === null ? "…" : `${ms} ms`} />
        <Cell label="Version" ok={version.ok} value={version.text} testId="status-version" />
        <Cell label="Anfragen heute" ok={used < 0.8} value={status ? `${Math.round(used * 100)} %` : "…"} />
        <ChevronDown className={cn("absolute bottom-0 left-1/2 size-3.5 -translate-x-1/2 text-muted-foreground transition", open && "rotate-180")} aria-hidden />
        <span className="sr-only">{open ? "Details zuklappen" : "Details zeigen"}</span>
      </button>
      {open && (
        <div className="grid gap-3 px-3 pt-2 pb-3 text-sm" data-testid="status-details">
          {deviceOld && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2">
              <span className="flex-1">Auf dem Server läuft eine neuere Version als auf diesem Gerät.</span>
              <Button size="sm" onClick={() => location.reload()}>Neu laden</Button>
            </div>
          )}
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Gerät</dt><dd><Sha sha={BUILD.sha} />{BUILD.time && <span className="text-muted-foreground"> · gebaut {ago(Date.parse(BUILD.time))}</span>}</dd>
            <dt className="text-muted-foreground">Server</dt><dd>{status ? <><Sha sha={status.build.sha} />{status.build.branch && <span className="text-muted-foreground"> · {status.build.branch}</span>}{status.build.time && <span className="text-muted-foreground"> · gebaut {ago(Date.parse(status.build.time))}</span>}</> : "…"}</dd>
            <dt className="text-muted-foreground">main</dt>
            <dd className="min-w-0">{main ? <><Sha sha={main.sha} /> <span className="text-muted-foreground">· {main.date ? ago(Date.parse(main.date)) : ""}</span><span className="block truncate text-xs text-muted-foreground">{main.message}</span></> : main === null ? <span className="text-muted-foreground">gerade nicht abrufbar</span> : "…"}</dd>
          </dl>
          {branch && <p className="text-xs text-muted-foreground">Der Server läuft auf dem Zweig „{branch}“, nicht auf main.</p>}
          {mainNewer && !deviceOld && <p className="text-xs text-muted-foreground">Auf main gibt es neuere Änderungen. Meist läuft gerade die Veröffentlichung – in ein paar Minuten nochmal schauen.</p>}
          {status && (
            <>
              <div className="grid gap-1">
                <div className="flex justify-between"><span>Anfragen heute <span className="text-muted-foreground">(ca., UTC)</span></span><b className="tabular-nums">{fmt(status.requests.count)} / {fmt(FREE_REQUESTS)}</b></div>
                <span className="h-1.5 overflow-hidden rounded-full bg-navy-800/60"><span className={cn("block h-full rounded-full", used < 0.8 ? "bg-primary" : "bg-destructive")} style={{ width: `${Math.min(100, used * 100)}%` }} /></span>
                <span className="text-xs text-muted-foreground">Kostenloses Kontingent pro Tag. Gezählt seit {new Date(status.requests.since).toLocaleDateString("de-DE")}.</span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                <Service ok={status.services.password} label="Admin-Passwort" />
                <Service ok={status.services.realtime} label={status.services.realtimeFake ? "Audio & Video (Test)" : "Audio & Video"} />
                <Service ok label={`${status.rooms} ${status.rooms === 1 ? "Raum" : "Räume"} · ${status.connections} verbunden`} />
              </ul>
            </>
          )}
          <Button variant="ghost" size="sm" className="justify-self-start text-muted-foreground" onClick={() => void load(true)}><RefreshCw />Neu prüfen</Button>
        </div>
      )}
    </section>
  );
}

function Cell({ label, value, ok, testId }: { label: string; value: string; ok: boolean; testId?: string }) {
  return (
    <span className="relative grid min-w-0 place-items-center rounded-xl px-1 py-1.5 text-center" data-testid={testId}>
      <span className="text-[0.7rem] text-muted-foreground">{label}</span>
      <span className={cn("flex max-w-full items-center gap-1 truncate text-sm font-semibold", !ok && "text-destructive")}>
        <span className={cn("size-1.5 shrink-0 rounded-full", ok ? "bg-ok" : "bg-destructive")} aria-hidden />{value}
      </span>
    </span>
  );
}

function Sha({ sha }: { sha: string }) {
  return <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold"><GitCommitHorizontal className="size-3.5" />{short(sha)}</span>;
}

function Service({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", ok ? "bg-ok/12 text-ok" : "bg-destructive/12 text-destructive")}>
      {ok ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}{label}
    </li>
  );
}
