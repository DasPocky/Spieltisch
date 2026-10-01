import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2, LogOut, Pencil, QrCode as QrIcon, Share2, Trophy, Users, X } from "lucide-react";
import { getGame, isGameId } from "@shared/games";
import { GROUP_CODE_RE, leaderboard, MAX_GROUP_NAME, MAX_MEMBERS, playedGames, type GroupPreview, type GroupView } from "@shared/platform/group";
import { cleanName, MAX_NAME } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Confirm } from "@/components/Confirm";
import { navigate } from "@/hooks/useRoute";
import { createGroup, joinGroup, loadGroup, removeMember, renameGroup, saveMyName, setActive, useMyGroups } from "@/lib/group";
import { myAvatar, myName, saveName } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Avatar } from "@/platform/Avatar";
import { QrCode } from "@/platform/QrCode";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "–");
export const groupLink = (code: string) => `${location.origin}/g/${code}`;

function Page({ children, back = "/" }: { children: ReactNode; back?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh-safe max-w-md flex-col gap-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex h-14 shrink-0 items-center">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate(back)}><ChevronLeft />{back === "/" ? "Spieltisch" : "Gruppen"}</Button>
      </header>
      {children}
    </main>
  );
}

/** Eigener Name – nur gefragt, solange noch keiner gespeichert ist */
function useMemberName() {
  const [name, setName] = useState(myName);
  const [had] = useState(() => !!myName());
  const commit = () => {
    const n = cleanName(name);
    if (n && n !== myName()) { saveMyName(n); void saveName(n); }
    return n;
  };
  return { name, setName, ask: !had, ok: !!cleanName(name), commit };
}

function NameField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Dein Name</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={MAX_NAME} autoComplete="nickname" placeholder="Name" />
    </div>
  );
}

/** /gruppe: eigene Gruppen, neue Gruppe, Gruppe mit Code beitreten */
export function Groups() {
  const groups = useMyGroups();
  const me = useMemberName();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!me.commit()) return;
    setBusy(true);
    const res = await createGroup(name);
    setBusy(false);
    if (res.group) navigate(`/g/${res.group.code}`, true);
    else toast(res.error ?? "Das ging gerade nicht.");
  };

  return (
    <Page>
      <h1 className="text-3xl font-bold tracking-tight">Gruppen</h1>
      <p className="-mt-2 text-sm text-muted-foreground">Eure feste Runde: In der Lobby holt ihr Mitglieder mit einem Tipp dazu, Siege landen in eurer Bestenliste.</p>

      {groups.codes.length > 0 && (
        <ul className="grid gap-2">
          {groups.codes.map((c) => {
            const g = groups.cache[c];
            return (
              <li key={c}>
                <button type="button" onClick={() => navigate(`/g/${c}`)} className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Users className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold">{g?.name ?? c}{groups.active === c && <ActiveBadge />}</span>
                    <span className="block text-sm text-muted-foreground">{g ? `${g.members.length} ${g.members.length === 1 ? "Mitglied" : "Mitglieder"} · ` : ""}{c}</span>
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="grid gap-3">
        <h2 className="font-bold">Neue Gruppe</h2>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (me.ok && !busy) void create(); }}>
          <div className="grid gap-1.5">
            <Label htmlFor="group-name">Name der Gruppe</Label>
            <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_GROUP_NAME} placeholder="z. B. Spieleabend" autoComplete="off" />
          </div>
          {me.ask && <NameField id="group-me" value={me.name} onChange={me.setName} />}
          <Button type="submit" disabled={!me.ok || busy}>{busy && <Loader2 className="animate-spin" />}Gruppe erstellen</Button>
        </form>
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-bold">Gruppe beitreten</h2>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (GROUP_CODE_RE.test(code)) navigate(`/g/${code}`); }}>
          <Input aria-label="Gruppencode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            autoComplete="off" autoCapitalize="characters" placeholder="Gruppencode"
            className="text-center text-lg font-semibold tracking-[0.3em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal" />
          <Button type="submit" disabled={!GROUP_CODE_RE.test(code)} className="shrink-0">Weiter</Button>
        </form>
        <p className="text-xs text-muted-foreground">Oder einfach den Einladungslink öffnen.</p>
      </Card>
    </Page>
  );
}

function ActiveBadge() {
  return <span className="rounded-full bg-primary/12 px-1.5 py-px text-[0.7rem] font-semibold text-primary">aktiv</span>;
}

/** /g/<CODE>: Gruppe mit Bestenliste, Mitgliedern und Einladung – oder die Einladung für Nicht-Mitglieder */
export function Group({ code }: { code: string }) {
  const groups = useMyGroups();
  const cached = groups.cache[code];
  const member = groups.codes.includes(code);
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    void loadGroup(code).then((res) => {
      if (!on) return;
      setPreview(res.preview ?? null);
      setError(res.group || res.preview ? null : res.error ?? null);
      setLoading(false);
    });
    return () => { on = false; };
  }, [code]);

  if (member && cached) return <Page back={groups.codes.length > 1 ? "/gruppe" : "/"}><GroupHome group={cached} active={groups.active === code} /></Page>;
  if (loading) return <Page><Loader2 className="mx-auto mt-[20vh] size-8 animate-spin text-muted-foreground" /></Page>;
  if (preview) return <Page><Invitation preview={preview} /></Page>;
  return (
    <Page>
      <h1 className="text-3xl font-bold tracking-tight">Gruppe {code}</h1>
      <p className="text-muted-foreground">{error ?? "Diese Gruppe gibt es nicht."}</p>
      <Button onClick={() => navigate("/gruppe")}>Zu den Gruppen</Button>
    </Page>
  );
}

function Invitation({ preview }: { preview: GroupPreview }) {
  const me = useMemberName();
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (!me.commit()) return;
    setBusy(true);
    const res = await joinGroup(preview.code);
    setBusy(false);
    if (!res.group) toast(res.error ?? "Das ging gerade nicht.");
  };
  return (
    <>
      <div className="mt-[6vh] text-center">
        <div className="text-sm text-muted-foreground">Einladung in die Gruppe</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{preview.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{preview.count} {preview.count === 1 ? "Mitglied" : "Mitglieder"} · Code {preview.code}</p>
      </div>
      <Card className="grid gap-3">
        {preview.full ? (
          <p className="text-sm text-muted-foreground">Die Gruppe ist voll ({MAX_MEMBERS} Mitglieder).</p>
        ) : (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (me.ok && !busy) void join(); }}>
            {me.ask ? <NameField id="join-me" value={me.name} onChange={me.setName} /> : (
              <div className="flex items-center gap-3">
                <Avatar avatar={myAvatar()} className="size-10 text-xl" />
                <div className="min-w-0 flex-1"><div className="text-xs text-muted-foreground">Du trittst bei als</div><div className="truncate font-semibold">{me.name}</div></div>
              </div>
            )}
            <Button type="submit" size="lg" disabled={!me.ok || busy}>{busy && <Loader2 className="animate-spin" />}Beitreten</Button>
            <p className="text-xs text-muted-foreground">Name und Avatar ändern kannst du im Profil.</p>
          </form>
        )}
      </Card>
    </>
  );
}

function GroupHome({ group, active }: { group: GroupView; active: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [game, setGame] = useState<string | null>(null);
  const [qr, setQr] = useState(false);
  const games = playedGames(group).filter(isGameId);
  const rows = leaderboard(group, game);
  const any = rows.some((r) => r.played > 0);
  const link = groupLink(group.code);

  const rename = async () => {
    const res = await renameGroup(group.code, name);
    if (res.group) setEditing(false); else toast(res.error ?? "Das ging gerade nicht.");
  };
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: "Spieltisch", text: `Komm in unsere Gruppe „${group.name}“ – Code ${group.code}`, url: link }); return; }
      await navigator.clipboard.writeText(link);
      toast("Link kopiert");
    } catch { /* abgebrochen */ }
  };

  return (
    <>
      <div>
        {editing ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void rename(); }}>
            <Input aria-label="Name der Gruppe" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_GROUP_NAME} autoFocus className="text-lg font-semibold" />
            <Button type="submit" size="icon" aria-label="Namen speichern" disabled={!name.trim()}><Check /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Abbrechen" onClick={() => { setEditing(false); setName(group.name); }}><X /></Button>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <h1 className="min-w-0 flex-1 text-3xl font-bold tracking-tight break-words" data-testid="group-name">{group.name}</h1>
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0 text-muted-foreground" aria-label="Gruppe umbenennen" onClick={() => { setName(group.name); setEditing(true); }}><Pencil /></Button>
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{group.members.length} {group.members.length === 1 ? "Mitglied" : "Mitglieder"} · Code <b className="font-semibold tracking-wider text-foreground" data-testid="group-code">{group.code}</b></span>
          {active ? <ActiveBadge /> : <button type="button" className="font-semibold text-primary" onClick={() => setActive(group.code)}>Als aktive Gruppe nutzen</button>}
        </div>
      </div>

      <Card className="grid gap-3 p-4" data-testid="leaderboard">
        <h2 className="flex items-center gap-2 font-bold"><Trophy className="size-4 text-ice" />Bestenliste</h2>
        {games.length > 0 && (
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="radiogroup" aria-label="Spiel">
            {[null, ...games].map((g) => (
              <button key={g ?? "all"} type="button" role="radio" aria-checked={game === g} onClick={() => setGame(g)}
                className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
                  game === g ? "bg-primary/14 text-primary ring-1 ring-inset ring-primary/35" : "bg-navy-950/40 text-muted-foreground")}>
                {g ? getGame(g).info.name : "Alle Spiele"}
              </button>
            ))}
          </div>
        )}
        {!any ? (
          <p className="text-sm text-muted-foreground">Noch keine Partien. Holt euch in der Lobby mit einem Tipp dazu oder spielt online – jeder Sieg zählt hier.</p>
        ) : (
          <table className="w-full table-fixed text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="w-6 pb-1.5 text-left font-normal">#</th>
                <th className="pb-1.5 text-left font-normal">Name</th>
                <th className="w-12 pb-1.5 text-right font-normal">Siege</th>
                <th className="w-15 pb-1.5 text-right font-normal">Partien</th>
                <th className="w-15 pb-1.5 text-right font-normal">Quote</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.member.id} className={cn("border-t border-border", r.played === 0 && "text-muted-foreground")}>
                  <td className="py-1.5 text-muted-foreground">{r.played ? i + 1 : "–"}</td>
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <Avatar avatar={r.member.avatar} className="size-7" />
                      <span className="truncate font-semibold">{r.member.name}{r.member.id === group.you && <span className="font-normal text-muted-foreground"> (du)</span>}</span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-bold">{r.won}</td>
                  <td className="py-1.5 text-right">{r.played}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{pct(r.won, r.played)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="grid gap-2 p-4">
        <h2 className="font-bold">Mitglieder</h2>
        <ul className="grid gap-1" data-testid="members">
          {group.members.map((m) => (
            <li key={m.id} className="flex h-11 items-center gap-2.5">
              <Avatar avatar={m.avatar} className="size-8" />
              <span className="min-w-0 flex-1 truncate font-semibold">{m.name}{m.id === group.you && <span className="font-normal text-muted-foreground"> (du)</span>}</span>
              {m.id !== group.you && (
                <Confirm title={`${m.name} entfernen?`} description="Die Siege verschwinden aus der Bestenliste. Mit dem Link kann die Person wieder beitreten." confirmLabel="Entfernen"
                  onConfirm={async () => { const r = await removeMember(group.code, m.id); if (r.error) toast(r.error); }}>
                  <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`${m.name} entfernen`}><X /></Button>
                </Confirm>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="grid gap-3 p-4">
        <h2 className="font-bold">Einladen</h2>
        <p className="-mt-1.5 text-sm text-muted-foreground">Wer den Link oder Code hat, kann beitreten.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={share}><Share2 />Link teilen</Button>
          <Button variant="secondary" onClick={() => setQr((q) => !q)} aria-expanded={qr}><QrIcon />{qr ? "QR ausblenden" : "QR-Code"}</Button>
        </div>
        {qr && <QrCode value={link} className="mx-auto w-56" label={`QR-Code für ${link}`} />}
      </Card>

      <Confirm title="Gruppe verlassen?" description={group.members.length === 1 ? "Du bist das letzte Mitglied – die Gruppe wird gelöscht." : "Deine Siege verschwinden aus der Bestenliste. Mit dem Link kannst du wieder beitreten."} confirmLabel="Verlassen"
        onConfirm={async () => { const r = await removeMember(group.code, group.you); if (r.error) toast(r.error); else navigate("/", true); }}>
        <Button variant="ghost" className="text-destructive"><LogOut />Gruppe verlassen</Button>
      </Confirm>
    </>
  );
}
