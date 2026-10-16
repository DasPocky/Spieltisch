import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import type { ArchivedRoom } from "@shared/platform/access";
import { Confirm } from "@/components/Confirm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ago, AuthError, dateTime, duration, gameName, Status, useSave, type Api } from "./shared";

/** Verlauf: welche Räume es gab, wer drin war, was gespielt wurde – und eine Liste aller Namen */
export function HistoryTab({ api, archiveDays }: { api: Api; archiveDays: number }) {
  const [rooms, setRooms] = useState<ArchivedRoom[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"rooms" | "people">("rooms");
  const { msg, run } = useSave();

  const load = useCallback(() => {
    api<{ rooms: ArchivedRoom[] }>("/api/admin/archive").then((r) => setRooms(r.rooms)).catch((e) => { if (!(e instanceof AuthError)) setError((e as Error).message); });
  }, [api]);
  useEffect(load, [load]);

  // Alle Namen: in wie vielen Räumen, zuletzt wann, welche Spiele
  const people = useMemo(() => {
    const m = new Map<string, { name: string; rooms: number; last: number; games: Set<string> }>();
    for (const r of rooms ?? []) for (const name of r.players) {
      const key = name.toLowerCase();
      const p = m.get(key) ?? { name, rooms: 0, last: 0, games: new Set<string>() };
      p.rooms++; p.last = Math.max(p.last, r.lastAt); r.games.forEach((g) => p.games.add(g));
      m.set(key, p);
    }
    return [...m.values()].sort((a, b) => b.last - a.last);
  }, [rooms]);

  if (!rooms) return error ? <p className="font-semibold text-destructive">{error}</p> : <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Lädt …</p>;

  const q = query.trim().toLowerCase();
  const shownRooms = q ? rooms.filter((r) => r.code.toLowerCase().includes(q) || r.players.some((p) => p.toLowerCase().includes(q)) || r.games.some((g) => gameName(g).toLowerCase().includes(q))) : rooms;
  const shownPeople = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
  const remove = (r: ArchivedRoom) => run(async () => { await api("/api/admin/archive/delete", { code: r.code, createdAt: r.createdAt }); load(); }, `Raum ${r.code} aus dem Verlauf gelöscht.`);

  return (
    <div className="grid gap-3" data-testid="history">
      <p className="text-sm text-muted-foreground">Online-Räume der letzten {archiveDays} Tage (einstellbar unter „Einstellungen“). „Ein Handy für alle“ bleibt auf den Geräten und erscheint hier nicht.</p>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-navy-950/50 p-1 ring-1 ring-inset ring-border" role="radiogroup" aria-label="Ansicht">
        {([["rooms", `Räume · ${rooms.length}`], ["people", `Leute · ${people.length}`]] as const).map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
            className={cn("rounded-lg py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring", view === v ? "bg-navy-600 shadow-md" : "text-muted-foreground")}>{label}</button>
        ))}
      </div>
      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, Raumcode oder Spiel" className="pl-9" aria-label="Verlauf durchsuchen" />
      </label>
      <Status msg={msg} />

      {view === "rooms" ? (
        shownRooms.length === 0 ? <Card className="text-center text-muted-foreground">{rooms.length ? "Nichts gefunden." : "Noch keine Räume im Verlauf."}</Card> : shownRooms.map((r) => (
          <Card key={`${r.code}-${r.createdAt}`} className="grid gap-2 p-4" data-testid={`arch-${r.code}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-lg font-bold tracking-widest">{r.code}</div>
                <div className="text-xs text-muted-foreground">{dateTime(r.createdAt)} · {duration((r.endedAt ?? r.lastAt) - r.createdAt)}</div>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", r.endedAt ? "bg-navy-800 text-muted-foreground" : "bg-ok/15 text-ok")}>{r.endedAt ? "zu" : "offen"}</span>
            </div>
            <p className="text-sm"><b>{r.partien === 1 ? "1 Partie" : `${r.partien} Partien`}</b>{r.games.length > 0 && <span className="text-muted-foreground"> · {r.games.map(gameName).join(", ")}</span>}</p>
            {r.players.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {r.players.map((p) => <li key={p} className="rounded-full bg-navy-800/70 px-2 py-0.5 text-xs font-semibold">{p}</li>)}
              </ul>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">zuletzt aktiv {ago(r.lastAt)}</span>
              <Confirm title={`Raum ${r.code} aus dem Verlauf löschen?`} description="Nur der Eintrag im Verlauf – ein offener Raum läuft weiter." confirmLabel="Löschen" onConfirm={() => remove(r)}>
                <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" aria-label={`${r.code} aus dem Verlauf löschen`}><Trash2 />Löschen</Button>
              </Confirm>
            </div>
          </Card>
        ))
      ) : (
        shownPeople.length === 0 ? <Card className="text-center text-muted-foreground">{people.length ? "Nichts gefunden." : "Noch niemand im Verlauf."}</Card> : (
          <Card className="p-0">
            <ul className="divide-y divide-border" data-testid="people">
              {shownPeople.map((p) => (
                <li key={p.name} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[...p.games].map(gameName).join(", ") || "noch nichts gespielt"}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    <b className="block text-sm text-foreground">{p.rooms === 1 ? "1 Raum" : `${p.rooms} Räume`}</b>{ago(p.last)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )
      )}
    </div>
  );
}
