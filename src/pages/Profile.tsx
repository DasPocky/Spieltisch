import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Copy, Loader2, Trophy } from "lucide-react";
import { getGame, isGameId } from "@shared/games";
import { formatProfileId, parseProfileId, PROFILE_ID_RE, type ProfileStats } from "@shared/platform/profile";
import { cleanName, MAX_NAME } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Confirm } from "@/components/Confirm";
import { getGameUI } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { NAME_KEY } from "@/lib/storage";
import { adoptProfile, deleteProfile, fetchStats, myName, myProfile, saveName, wipeAllData } from "@/lib/profile";
import { ThemeSwitch } from "@/platform/ThemeSwitch";
import { VoiceSettings } from "@/platform/VoiceSettings";
import { IconTile } from "@/platform/Logo";
import { cn, fmt } from "@/lib/utils";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "–");
const date = (t: number) => new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

/** Eigenes Profil: Name, Statistik je Spiel, letzte Partien, Profil auf ein anderes Gerät mitnehmen. */
export function Profile() {
  const [id, setId] = useState(() => myProfile().id);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(myName);
  const [showCode, setShowCode] = useState(false);
  const [other, setOther] = useState("");

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchStats(id).then((s) => { if (on) { setStats(s); setLoading(false); } });
    return () => { on = false; };
  }, [id]);

  const games = Object.entries(stats?.games ?? {}).filter(([g]) => isGameId(g)).sort((a, b) => b[1].played - a[1].played);
  const played = games.reduce((n, [, g]) => n + g.played, 0);
  const won = games.reduce((n, [, g]) => n + g.won, 0);

  const storeName = () => {
    const n = cleanName(name);
    try { localStorage.setItem(NAME_KEY, n); } catch { /* egal */ }
    void saveName(n);
    toast("Name gespeichert");
  };

  return (
    <main className="mx-auto flex min-h-dvh-safe max-w-md flex-col gap-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex h-14 shrink-0 items-center">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("/")}><ChevronLeft />Spieltisch</Button>
      </header>
      <h1 className="text-3xl font-bold tracking-tight">Profil & Einstellungen</h1>

      <Card className="grid gap-2">
        <Label htmlFor="profile-name">Dein Name</Label>
        <div className="flex gap-2">
          <Input id="profile-name" value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <Button variant="secondary" disabled={!cleanName(name)} onClick={storeName}>Speichern</Button>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          Online zählt jede Partie in deinem Raum. Lokal (ein Handy für alle) zählt der Spieler, der genauso heißt wie du.
        </p>
      </Card>

      <Card className="grid gap-3" data-testid="stats">
        <h2 className="flex items-center gap-2 font-bold"><Trophy className="size-4 text-ice" />Statistik</h2>
        {loading ? <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /> : !played ? (
          <p className="text-sm text-muted-foreground">Noch keine Partien. Nach dem ersten Spiel steht hier, wie oft du gewonnen hast.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Partien", fmt(played)], ["Siege", fmt(won)], ["Quote", pct(won, played)]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-navy-950/50 py-2"><div className="text-xl font-bold tabular-nums">{v}</div><div className="text-xs text-muted-foreground">{k}</div></div>
              ))}
            </div>
            <ul className="grid gap-1.5">
              {games.map(([g, s]) => {
                const { Icon } = getGameUI(g);
                return (
                  <li key={g} className="flex items-center gap-2.5 rounded-xl bg-navy-950/30 px-2.5 py-2">
                    <IconTile className="size-9 rounded-lg"><Icon className="size-6" /></IconTile>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{getGame(g).info.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.played} {s.played === 1 ? "Partie" : "Partien"} · {s.won} gewonnen ({pct(s.won, s.played)})
                        {s.best !== undefined && ` · Bestwert ${fmt(s.best)}`}
                        {s.scored ? ` · Ø ${fmt(Math.round((s.total ?? 0) / s.scored))}` : ""}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {stats!.recent.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-muted-foreground">Letzte Partien</summary>
                <ul className="mt-2 grid gap-1">
                  {stats!.recent.filter((r) => isGameId(r.gameId)).slice(0, 15).map((r, i) => (
                    <li key={i} className="flex justify-between gap-2 border-b border-border py-1.5">
                      <span>{date(r.at)} · {getGame(r.gameId).info.name} <span className="text-muted-foreground">({r.players} Spieler, {r.online ? "online" : "lokal"})</span></span>
                      <b className={cn("shrink-0 whitespace-nowrap", r.won ? "text-ice" : "text-muted-foreground")}>{r.won ? "Sieg" : "–"}{r.score !== undefined ? ` · ${fmt(r.score)}` : ""}</b>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </Card>

      <Card className="grid gap-2.5">
        <h2 className="font-bold">Auf ein anderes Handy mitnehmen</h2>
        <p className="text-sm text-muted-foreground">Dein Profil-Code ist wie ein Schlüssel: Wer ihn hat, sieht und führt deine Statistik weiter. Nicht weitergeben.</p>
        {showCode ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-navy-950/60 px-3 py-2 text-center font-mono text-lg tracking-wider" data-testid="profile-code">{formatProfileId(id)}</code>
            <Button variant="secondary" size="icon" aria-label="Kopieren" onClick={() => { void navigator.clipboard?.writeText(formatProfileId(id)); toast("Kopiert"); }}><Copy /></Button>
          </div>
        ) : <Button variant="secondary" onClick={() => setShowCode(true)}>Profil-Code anzeigen</Button>}
        <Label htmlFor="profile-adopt" className="mt-2">Code von einem anderen Gerät eingeben</Label>
        <div className="flex gap-2">
          <Input id="profile-adopt" value={other} onChange={(e) => setOther(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" className="font-mono" />
          <Button variant="secondary" disabled={!PROFILE_ID_RE.test(parseProfileId(other))}
            onClick={() => { const n = parseProfileId(other); adoptProfile(n); setId(n); setOther(""); setShowCode(false); toast("Profil übernommen"); }}>Übernehmen</Button>
        </div>
      </Card>

      <Card className="grid gap-2.5">
        <h2 className="font-bold">Darstellung</h2>
        <ThemeSwitch />
      </Card>

      <Card className="grid gap-2.5">
        <h2 className="font-bold">Stimme</h2>
        <VoiceSettings />
      </Card>

      <Card className="grid gap-2.5">
        <h2 className="font-bold">Daten</h2>
        <p className="text-sm text-muted-foreground">Gespeichert sind dein Name, dein Profil mit Statistik, die letzten Mitspieler und Spielstände auf diesem Gerät.</p>
        <Confirm title="Profil löschen?" description="Deine Statistik wird vom Server gelöscht. Dieses Gerät bekommt ein neues, leeres Profil." confirmLabel="Löschen"
          onConfirm={async () => { await deleteProfile(); setId(myProfile().id); setShowCode(false); toast("Profil gelöscht"); }}>
          <Button variant="secondary">Profil und Statistik löschen</Button>
        </Confirm>
        <Confirm title="Alle Daten löschen?" description="Profil, Statistik, Namen, Spielstände und Einstellungen werden von diesem Gerät (und das Profil vom Server) gelöscht." confirmLabel="Alles löschen"
          onConfirm={async () => { await wipeAllData(); toast("Alle Daten gelöscht"); navigate("/"); location.reload(); }}>
          <Button variant="ghost" className="text-destructive">Alle Daten auf diesem Gerät löschen</Button>
        </Confirm>
      </Card>
    </main>
  );
}
