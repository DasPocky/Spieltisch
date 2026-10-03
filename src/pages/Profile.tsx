import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Download, Loader2, Smartphone, Trophy, Upload, Users, Volume2 } from "lucide-react";
import { getGame, isGameId } from "@shared/games";
import { parseProfileId, PROFILE_ID_RE, TRANSFER_CODE_RE, type ProfileStats } from "@shared/platform/profile";
import type { Avatar as AvatarData } from "@shared/platform/group";
import { cleanName, MAX_NAME } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Confirm } from "@/components/Confirm";
import { getGameUI } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { NAME_KEY, remove, RETURN_KEY } from "@/lib/storage";
import { createTransfer, deleteProfile, exportData, fetchStats, importData, myAvatar, myName, myProfile, redeemTransfer, saveAvatar, saveName, wipeAllData } from "@/lib/profile";
import { adoptAndSync, syncMe, useMyGroups } from "@/lib/group";
import { Avatar, AvatarPicker } from "@/platform/Avatar";
import { QrCode } from "@/platform/QrCode";
import { ThemeSwitch } from "@/platform/ThemeSwitch";
import { VoiceSettings } from "@/platform/VoiceSettings";
import { IconTile } from "@/platform/Logo";
import { playSound } from "@/platform/sound";
import { setPref, usePrefs, type Prefs } from "@/lib/prefs";
import { cn, fmt } from "@/lib/utils";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "–");
const time = (t: number) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
/** Übertragungs-Code lesbar: ABCD-EFGH */
const formatTransfer = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;
const date = (t: number) => new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

/** Eigenes Profil: Name, Statistik je Spiel, letzte Partien, Profil auf ein anderes Gerät mitnehmen. */
export function Profile() {
  const [id, setId] = useState(() => myProfile().id);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(myName);
  const [avatar, setAvatar] = useState(myAvatar);
  const [picking, setPicking] = useState(false);
  const [transfer, setTransfer] = useState<{ code: string; until: number } | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const groups = useMyGroups();
  const otherCode = parseProfileId(other);
  const otherOk = TRANSFER_CODE_RE.test(otherCode) || PROFILE_ID_RE.test(otherCode);
  // Aus dem Menü einer Partie gekommen: zurück dorthin
  const [back] = useState(() => { try { return sessionStorage.getItem(RETURN_KEY); } catch { return null; } });

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
    void saveName(n).then(syncMe);
    toast("Name gespeichert");
  };
  const pickAvatar = (a: AvatarData) => { setAvatar(a); void saveAvatar(a).then(syncMe); };

  /** Code vom alten Handy: Übertragungs-Code (8 Zeichen) oder der frühere Profil-Code (16) */
  const adopt = async () => {
    setBusy(true);
    let pid: string | undefined = otherCode;
    if (TRANSFER_CODE_RE.test(otherCode)) {
      const res = await redeemTransfer(otherCode);
      if (!res.id) { setBusy(false); toast(res.error ?? "Das hat nicht geklappt."); return; }
      pid = res.id;
    }
    await adoptAndSync(pid);
    setBusy(false);
    setId(pid); setName(myName()); setAvatar(myAvatar()); setOther(""); setTransfer(null);
    toast("Profil übernommen");
  };
  const showTransfer = async () => {
    const t = await createTransfer();
    if (t) setTransfer(t); else toast("Keine Verbindung zum Server.");
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportData()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `spieltisch-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (!importData(await f.text())) { toast("Das ist keine Spieltisch-Datei."); return; }
    toast("Daten eingespielt");
    location.reload();
  };

  return (
    <main className="mx-auto flex min-h-dvh-safe max-w-md flex-col gap-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex h-14 shrink-0 items-center">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => { remove(RETURN_KEY, true); navigate(back ?? "/"); }}><ChevronLeft />{back ? "Zurück zum Spiel" : "Spieltisch"}</Button>
      </header>
      <h1 className="text-3xl font-bold tracking-tight">Mein Profil</h1>

      <Card className="grid gap-2">
        <Label htmlFor="profile-name">Dein Name</Label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPicking((p) => !p)} aria-label="Avatar ändern" aria-expanded={picking}
            className="shrink-0 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring" data-testid="my-avatar">
            <Avatar avatar={avatar} className="size-9 text-xl" />
          </button>
          <Input id="profile-name" value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <Button variant="secondary" disabled={!cleanName(name)} onClick={storeName}>Speichern</Button>
        </div>
        {picking ? (
          <div className="mt-1 grid gap-2">
            <AvatarPicker value={avatar} onChange={pickAvatar} />
            <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>Fertig</Button>
          </div>
        ) : (
          <button type="button" className="justify-self-start text-sm font-semibold text-primary" onClick={() => setPicking(true)}>Avatar ändern</button>
        )}
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

      <Card className="grid gap-2.5" data-testid="groups-card">
        <h2 className="flex items-center gap-2 font-bold"><Users className="size-4 text-ice" />Gruppen</h2>
        {groups.codes.length > 0 && (
          <ul className="grid gap-1">
            {groups.codes.map((c) => (
              <li key={c}>
                <button type="button" onClick={() => navigate(`/g/${c}`)} className="flex w-full items-center gap-2 rounded-xl bg-navy-950/30 px-3 py-2.5 text-left">
                  <span className="min-w-0 flex-1 truncate font-semibold">{groups.cache[c]?.name ?? c}</span>
                  {groups.active === c && <span className="rounded-full bg-primary/12 px-1.5 py-px text-[0.7rem] font-semibold text-primary">aktiv</span>}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" onClick={() => navigate("/gruppe")}>{groups.codes.length ? "Gruppen verwalten" : "Gruppe erstellen oder beitreten"}</Button>
      </Card>

      <Card className="grid gap-2.5" data-testid="transfer">
        <h2 className="flex items-center gap-2 font-bold"><Smartphone className="size-4 text-ice" />Auf neues Handy übertragen</h2>
        <p className="text-sm text-muted-foreground">Statistik, Name, Avatar und Gruppen ziehen mit um. Der Code gilt 15 Minuten und nur einmal – nicht weitergeben.</p>
        {transfer ? (
          <div className="grid gap-2.5">
            <QrCode value={`${location.origin}/profil/uebernehmen/${transfer.code}`} className="mx-auto w-48" label="QR-Code zum Übertragen" />
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-navy-950/60 px-3 py-2 text-center font-mono text-xl tracking-[0.2em]" data-testid="transfer-code">{formatTransfer(transfer.code)}</code>
              <Button variant="secondary" size="icon" aria-label="Link kopieren" onClick={() => { void navigator.clipboard?.writeText(`${location.origin}/profil/uebernehmen/${transfer.code}`); toast("Link kopiert"); }}><Copy /></Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">Mit dem neuen Handy scannen oder dort im Profil eingeben · gültig bis {time(transfer.until)} Uhr</p>
          </div>
        ) : <Button variant="secondary" onClick={showTransfer}>Code zum Übertragen anzeigen</Button>}
        <Label htmlFor="profile-adopt" className="mt-2">Code vom alten Handy eingeben</Label>
        <div className="flex gap-2">
          <Input id="profile-adopt" value={other} onChange={(e) => setOther(e.target.value)} placeholder="XXXX-XXXX" autoComplete="off" autoCapitalize="characters" className="font-mono" />
          <Button variant="secondary" disabled={!otherOk || busy} onClick={adopt}>{busy && <Loader2 className="animate-spin" />}Übernehmen</Button>
        </div>
      </Card>

      <Card className="grid gap-2.5">
        <h2 className="font-bold">Darstellung</h2>
        <ThemeSwitch />
      </Card>

      <Card className="grid gap-3" data-testid="play-prefs">
        <h2 className="font-bold">Im Spiel</h2>
        <PlayPrefs />
      </Card>

      <Card className="grid gap-2.5">
        <h2 className="font-bold">Stimme</h2>
        <VoiceSettings />
      </Card>

      <Card className="grid gap-2.5">
        <h2 className="font-bold">Daten</h2>
        <p className="text-sm text-muted-foreground">Gespeichert sind dein Name, dein Profil mit Statistik, Gruppen, die letzten Mitspieler und Spielstände auf diesem Gerät.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={download}><Download />Sichern</Button>
          <Button variant="secondary" onClick={() => file.current?.click()}><Upload />Einspielen</Button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Datei einspielen" onChange={(e) => void upload(e.target.files?.[0])} />
        <Confirm title="Profil löschen?" description="Deine Statistik wird vom Server gelöscht. Dieses Gerät bekommt ein neues, leeres Profil." confirmLabel="Löschen"
          onConfirm={async () => { await deleteProfile(); setId(myProfile().id); setAvatar(myAvatar()); setTransfer(null); toast("Profil gelöscht"); }}>
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

const PREFS: [keyof Prefs, string, string][] = [
  ["sound", "Töne", "Leise Klänge beim Spielen."],
  ["vibration", "Vibration", "Kurz vibrieren, wenn du dran bist."],
  ["announce", "„Wer ist dran?“ ansagen", "Liest vor, wer am Zug ist."],
  ["hints", "Spielhilfen für mich", "Zeigt dir, welche Karten oder Züge gerade gehen – wenn der Raum Spielhilfen erlaubt."],
];

/** Rückmeldung während der Partie – gilt nur für dieses Gerät */
function PlayPrefs() {
  const p = usePrefs();
  return (
    <div className="grid gap-3">
      {PREFS.map(([key, label, hint]) => (
        <div key={key} className="flex items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
            <Checkbox checked={p[key]} onCheckedChange={(c) => setPref(key, c === true)} />
            <span><span className="font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
          </label>
          {key === "sound" && (
            <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" aria-label="Töne probehören"
              onClick={() => { playSound("turn", { force: true }); setTimeout(() => playSound("place", { force: true }), 700); setTimeout(() => playSound("dice", { force: true }), 1100); }}>
              <Volume2 />Probe
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

/** /profil/uebernehmen/<CODE>: Link aus dem QR-Code des alten Handys */
export function ProfileTransfer({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(TRANSFER_CODE_RE.test(code) ? null : "Dieser Link ist ungültig.");
  const go = async () => {
    setBusy(true);
    const res = await redeemTransfer(code);
    if (!res.id) { setBusy(false); setError(res.error ?? "Das hat nicht geklappt."); return; }
    await adoptAndSync(res.id);
    toast("Profil übernommen");
    navigate("/profil", true);
  };
  return (
    <main className="mx-auto max-w-md px-4 pt-[14vh] text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary"><Smartphone className="size-7" /></span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Profil übernehmen</h1>
      <p className="mt-2 text-muted-foreground">Dieses Handy übernimmt dein Profil vom alten Handy – mit Statistik, Name, Avatar und Gruppen. Ein bisheriges Profil auf diesem Handy wird ersetzt.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}
      <Button size="lg" className="mt-6 w-full" disabled={busy || !TRANSFER_CODE_RE.test(code)} onClick={go}>{busy && <Loader2 className="animate-spin" />}Profil übernehmen</Button>
      <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => navigate("/")}>Abbrechen</Button>
    </main>
  );
}
