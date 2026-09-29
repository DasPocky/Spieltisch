import { useState } from "react";
import { ChevronLeft, Loader2, ShieldCheck } from "lucide-react";
import { GAMES } from "@shared/games";
import { MAX_MESSAGE, type Access, type SiteConfig } from "@shared/platform/access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { navigate } from "@/hooks/useRoute";
import { setSiteConfig } from "@/hooks/useSiteConfig";
import { Segmented } from "@/platform/Segmented";

const LEVELS = [
  { value: "on", label: "An", hint: "für alle" },
  { value: "code", label: "🔒 Code", hint: "mit Zugangscode" },
  { value: "off", label: "Aus", hint: "abgeschaltet" },
] as const satisfies readonly { value: Access; label: string; hint: string }[];

/** Bei den einzelnen Spielen reicht die Kurzform */
const SHORT = LEVELS.map(({ value, label }) => ({ value, label }));

const PW_KEY = "spieltisch:admin";

async function call(password: string, update?: { config: Omit<SiteConfig, "hasCode">; code?: string | null }) {
  const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, ...update }) });
  return (await res.json()) as { ok: boolean; error?: string; config?: SiteConfig };
}

/** Admin-Bereich: nur mit Passwort. Spieltisch und einzelne Spiele an, hinter Code oder aus. */
export function Admin() {
  const [password, setPassword] = useState(() => { try { return sessionStorage.getItem(PW_KEY) ?? ""; } catch { return ""; } });
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const login = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await call(password);
      if (!r.ok || !r.config) { setMsg({ ok: false, text: r.error ?? "Anmeldung fehlgeschlagen." }); return; }
      try { sessionStorage.setItem(PW_KEY, password); } catch { /* egal */ }
      setConfig(r.config);
    } catch { setMsg({ ok: false, text: "Keine Verbindung zum Server." }); } finally { setBusy(false); }
  };

  const save = async (removeCode = false) => {
    if (!config) return;
    setBusy(true); setMsg(null);
    try {
      const r = await call(password, { config: { site: config.site, games: config.games, message: config.message }, code: removeCode ? null : code.trim() || undefined });
      if (!r.ok || !r.config) { setMsg({ ok: false, text: r.error ?? "Speichern fehlgeschlagen." }); return; }
      setConfig(r.config); setSiteConfig(r.config); setCode("");
      setMsg({ ok: true, text: "Gespeichert." });
    } catch { setMsg({ ok: false, text: "Keine Verbindung zum Server." }); } finally { setBusy(false); }
  };

  const needsCode = !!config && (config.site === "code" || Object.values(config.games).includes("code"));

  return (
    <main className="mx-auto flex min-h-dvh-safe max-w-md flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex h-14 shrink-0 items-center">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("/")}><ChevronLeft />Spieltisch</Button>
      </header>
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight"><ShieldCheck className="size-7 text-navy-300" />Admin</h1>

      {!config ? (
        <Card className="mt-5">
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); login(); }}>
            <Label htmlFor="admin-pw">Admin-Passwort</Label>
            <Input id="admin-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <Button type="submit" size="lg" disabled={busy || !password}>{busy && <Loader2 className="animate-spin" />}Anmelden</Button>
          </form>
        </Card>
      ) : (
        <div className="mt-5 grid gap-5">
          <Card className="grid gap-4">
            <Segmented label="Spieltisch" value={config.site} options={LEVELS} onChange={(site) => setConfig({ ...config, site })} />
            <div className="grid gap-2">
              <Label htmlFor="admin-msg">Hinweis für Besucher (optional)</Label>
              <Input id="admin-msg" value={config.message} maxLength={MAX_MESSAGE} placeholder="z. B. Heute ab 20 Uhr wieder offen"
                onChange={(e) => setConfig({ ...config, message: e.target.value })} />
            </div>
          </Card>

          <Card className="grid gap-4">
            <h2 className="font-bold">Spiele</h2>
            {Object.values(GAMES).map((g) => (
              <Segmented key={g.info.id} label={g.info.name} value={config.games[g.info.id] ?? "on"} options={SHORT}
                onChange={(v) => setConfig({ ...config, games: { ...config.games, [g.info.id]: v } })} />
            ))}
          </Card>

          <Card className="grid gap-2">
            <Label htmlFor="admin-code">Zugangscode {config.hasCode ? "(gesetzt – leer lassen zum Behalten)" : "(noch keiner)"}</Label>
            <Input id="admin-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="neuer Code, 4–32 Zeichen" autoComplete="off" />
            {needsCode && !config.hasCode && !code.trim() && <p className="text-sm text-gold">Für „🔒 Code“ braucht ihr einen Zugangscode.</p>}
            {config.hasCode && <Button variant="ghost" className="justify-start text-muted-foreground" onClick={() => save(true)}>Zugangscode löschen</Button>}
          </Card>

          {msg && <p role="status" className={msg.ok ? "font-semibold text-emerald-400" : "font-semibold text-destructive"}>{msg.text}</p>}
          <Button size="lg" disabled={busy} onClick={() => save()}>{busy && <Loader2 className="animate-spin" />}Speichern</Button>
        </div>
      )}
      {!config && msg && <p role="alert" className="mt-3 font-semibold text-destructive">{msg.text}</p>}
    </main>
  );
}
