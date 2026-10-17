import { useState, type ReactNode } from "react";
import { GAMES, isGameId } from "@shared/games";
import type { AccessConfig, SiteConfig } from "@shared/platform/access";
import { Card } from "@/components/ui/card";
import { cn, fmt } from "@/lib/utils";

export type Msg = { ok: boolean; text: string } | null;
/** Anfrage mit Sitzungs-Token; wirft mit lesbarer Meldung */
export type Api = <T>(path: string, body?: unknown) => Promise<T>;

export class AuthError extends Error {}

export const gameName = (id: string) => (isGameId(id) ? GAMES[id].info.name : id);

/** Nur die Felder, die der Admin speichert – aus der aktuellen Konfiguration */
export const toAccess = (c: SiteConfig): AccessConfig => ({
  site: c.site, games: c.games, message: c.message, banner: c.banner, featured: c.featured, order: c.order,
  limits: c.limits, features: c.features, archiveDays: c.archiveDays, look: c.look,
});

export { ago, dateTime, duration } from "@/lib/time";

export function Status({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p role="status" className={msg.ok ? "font-semibold text-ok" : "font-semibold text-destructive"}>{msg.text}</p>;
}

/** Hilfe zum Speichern mit Meldung */
export function useSave() {
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

export function Tile({ label, value, hint, testId }: { label: string; value: number | string; hint?: ReactNode; testId?: string }) {
  return (
    <Card className="grid content-start gap-0.5 p-3 text-center">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <b className="text-2xl tabular-nums" data-testid={testId}>{typeof value === "number" ? fmt(value) : value}</b>
      {hint && <span className="text-[11px] leading-tight text-muted-foreground">{hint}</span>}
    </Card>
  );
}

/** Datei im Browser speichern */
export function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Karte eines Admin-Bereichs: Überschrift, optional Hinweis darunter oder etwas rechts daneben, dann der Inhalt */
export function Panel({ title, hint, extra, wide, children }: { title: string; hint?: string; extra?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <Card className={cn("grid gap-3", wide && "lg:col-span-2")}>
      <div>
        <div className="flex items-baseline justify-between gap-2"><h2 className="font-bold">{title}</h2>{extra}</div>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}
