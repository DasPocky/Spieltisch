import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Lock, LogIn, Settings2, Smartphone, UserRound, Users, type LucideIcon } from "lucide-react";
import { PIN_RE, ROOM_CODE_RE } from "@shared/platform/protocol";
import { cleanName, MAX_NAME } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GAME_LIST } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { createRoom } from "@/lib/createRoom";
import { LAST_GAME_KEY, NAME_KEY } from "@/lib/storage";
import { IconTile, Logo } from "@/platform/Logo";
import { InstallHint } from "@/platform/InstallHint";
import { ThemeToggle } from "@/platform/ThemeSwitch";
import { accessFor } from "@shared/platform/access";
import { savedAccess, useSiteConfig } from "@/hooks/useSiteConfig";
import { activeGroupCode, loadGroup, useActiveGroup } from "@/lib/group";
import { leaderboard } from "@shared/platform/group";
import { Avatar } from "@/platform/Avatar";

type Way = "local" | "online";
const WAY_KEY = "spieltisch:way";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const readWay = (): Way | null => { const v = read(WAY_KEY); return v === "local" || v === "online" ? v : null; };

/**
 * Startseite als kleiner Assistent:
 * 1. Wie spielt ihr? (ein Handy · Online-Raum · beitreten)
 * 2a. Ein Handy: Spiel wählen. 2b. Online: Name und PIN – der Raum entsteht sofort, das Spiel wählt ihr in der Lobby.
 */
export function Home() {
  const [code, setCode] = useState("");
  const [way, setWay] = useState<Way | null>(null);
  const last = readWay();
  const codeOk = ROOM_CODE_RE.test(code);
  const config = useSiteConfig();
  // Abgeschaltete Spiele erscheinen nicht, Spiele hinter Zugangscode bekommen ein Schloss
  const games = GAME_LIST.filter(({ id }) => !config || accessFor(config, id) !== "off");
  const locked = (id: string) => !!config && accessFor(config, id) === "code" && !savedAccess();
  const choose = (w: Way) => { try { localStorage.setItem(WAY_KEY, w); } catch { /* egal */ } setWay(w); };

  return (
    <main className="mx-auto flex h-dvh-safe max-w-md flex-col overflow-hidden px-4 pt-[2.5vh] pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center gap-3">
        <Logo className="size-10 shrink-0 -rotate-6 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-none tracking-tight">Spieltisch</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">Für euren Spieleabend</p>
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label="Profil und Einstellungen" onClick={() => navigate("/profil")}><UserRound /></Button>
      </div>

      {way === null && (
        <>
          <h2 className="mt-7 mb-2 shrink-0 px-1 text-sm font-semibold text-muted-foreground">Wie spielt ihr?</h2>
          <div className="glass grid shrink-0 grid-cols-[minmax(0,1fr)] divide-y divide-border overflow-hidden rounded-2xl">
            <WayRow icon={Smartphone} title="Ein Handy für alle" text="Herumreichen oder in die Mitte legen" marked={last === "local"} onClick={() => choose("local")} />
            <WayRow icon={Users} title="Online-Raum erstellen" text="Jeder spielt am eigenen Handy" marked={last === "online"} onClick={() => choose("online")} />
          </div>
          <form className="glass mt-3 shrink-0 rounded-2xl p-3" onSubmit={(e) => { e.preventDefault(); if (codeOk) navigate(`/r/${code}`); }}>
            <label htmlFor="code" className="flex items-center gap-2 px-1 font-semibold"><LogIn className="size-4.5 text-primary" />Raum beitreten</label>
            <div className="mt-2 flex gap-2">
              <Input id="code" aria-label="Raum beitreten" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                autoComplete="off" autoCapitalize="characters" placeholder="Raumcode vom Host" className="text-center text-lg font-semibold tracking-[0.3em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal" />
              <Button type="submit" disabled={!codeOk} className="shrink-0">Los</Button>
            </div>
          </form>
          <GroupCard />
          <InstallHint />
          <div className="min-h-0 flex-1" />
        </>
      )}

      {way === "local" && (
        <>
          <StepHead title="Spiel wählen" sub="Ein Handy für alle" onBack={() => setWay(null)} />
          {/* Nur die Liste scrollt, falls es einmal mehr Spiele werden, als auf den Bildschirm passen */}
          <ul className="no-scrollbar grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pb-1">
            {games.map(({ id, info, ui: { Icon } }) => (
              <li key={id}>
                <button type="button" onClick={() => navigate(`/spiel/${id}/lokal`)} aria-label={`${info.name} – ${info.category}, ${info.minPlayers}–${info.maxPlayers} Spieler`}
                  className="glass flex h-full w-full items-center gap-2.5 rounded-2xl p-2.5 text-left outline-none transition active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring">
                  <IconTile className="size-10 rounded-xl"><Icon className="size-6.5" /></IconTile>
                  <span className="min-w-0">
                    <span className={cn("block truncate font-semibold leading-tight", info.name.length > 8 && "text-[0.94rem] tracking-tight")}>{info.name}{locked(id) && <Lock className="ml-1 inline size-3.5 align-[-1px] text-muted-foreground" aria-label="mit Zugangscode" />}</span>
                    <span className="block truncate text-xs text-muted-foreground">{info.minPlayers}–{info.maxPlayers} Spieler · {info.duration}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {way === "online" && (
        <>
          <StepHead title="Online-Raum erstellen" sub="Das Spiel wählst du gleich in der Lobby" onBack={() => setWay(null)} />
          <CreateRoom gameId={defaultGame(games.map((g) => g.id), locked)} />
          <div className="min-h-0 flex-1" />
        </>
      )}

      <nav className="flex shrink-0 items-center justify-center gap-4 pt-3 text-xs text-muted-foreground">
        <button type="button" className="underline-offset-4 hover:underline" onClick={() => navigate("/profil")}>Profil & Daten</button>
        <span aria-hidden="true">·</span>
        <button type="button" className="flex items-center gap-1 underline-offset-4 hover:underline" onClick={() => navigate("/admin")}><Settings2 className="size-3.5" />Admin</button>
      </nav>
    </main>
  );
}

/** Raum wird mit dem zuletzt gespielten (oder ersten freien) Spiel angelegt – gewechselt wird in der Lobby */
function defaultGame(ids: string[], locked: (id: string) => boolean): string {
  const free = ids.filter((id) => !locked(id));
  const last = read(LAST_GAME_KEY);
  return last && free.includes(last) ? last : free[0] ?? ids[0] ?? "tutto";
}

function CreateRoom({ gameId }: { gameId: string }) {
  const [name, setName] = useState(() => read(NAME_KEY) ?? "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = cleanName(name).length > 0 && PIN_RE.test(pin);
  const create = async () => {
    setBusy(true); setError(null);
    try { await createRoom(name, pin, gameId, true); }
    catch (e) { setError(e instanceof Error ? e.message : "Keine Verbindung zum Server."); }
    finally { setBusy(false); }
  };
  return (
    <form className="glass grid shrink-0 gap-3.5 rounded-2xl p-4" data-testid="create-room" onSubmit={(e) => { e.preventDefault(); if (ok && !busy) void create(); }}>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Dein Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="nickname" placeholder="Name" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pin">PIN für den Raum (4–8 Ziffern)</Label>
        <Input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric" autoComplete="off" placeholder="z. B. 4711" className="tracking-[0.3em]" />
      </div>
      <Button type="submit" size="lg" disabled={!ok || busy}>{busy && <Loader2 className="animate-spin" />}Raum erstellen</Button>
      <p className="-mt-1 text-sm text-muted-foreground">Mitspieler brauchen Raumcode und PIN. Du bist Host und wählst das Spiel.</p>
      {error && <p role="alert" className="rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}
    </form>
  );
}

function StepHead({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div className="mt-5 mb-3 flex shrink-0 items-center gap-2">
      <Button variant="ghost" size="icon" className="-ml-2 shrink-0" aria-label="Zurück" onClick={onBack}><ChevronLeft /></Button>
      <div className="min-w-0">
        <h2 className="text-xl font-bold leading-tight tracking-tight">{title}</h2>
        <p className="truncate text-sm text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

/** „Meine Gruppe“: Name und die besten drei – oder ein kleiner Einstieg, solange das Handy in keiner Gruppe ist */
function GroupCard() {
  const group = useActiveGroup();
  useEffect(() => { const c = activeGroupCode(); if (c) void loadGroup(c); }, []);
  if (!group) {
    return (
      <button type="button" onClick={() => navigate("/gruppe")} data-testid="group-card"
        className="glass mt-3 flex w-full shrink-0 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left outline-none transition active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring">
        <Users className="size-4.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate font-semibold">Gruppe erstellen oder beitreten</span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </button>
    );
  }
  const top = leaderboard(group, null).filter((r) => r.played > 0).slice(0, 3);
  return (
    <button type="button" onClick={() => navigate(`/g/${group.code}`)} data-testid="group-card" aria-label={`Meine Gruppe: ${group.name}`}
      className="glass mt-3 grid w-full shrink-0 grid-cols-[minmax(0,1fr)] gap-1.5 rounded-2xl px-3.5 py-2.5 text-left outline-none transition active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring">
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-semibold"><span className="font-normal text-muted-foreground">Meine Gruppe · </span>{group.name}</span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </span>
      {top.length ? (
        <span className="flex min-w-0 gap-3 text-sm">
          {top.map((r, i) => (
            <span key={r.member.id} className="flex min-w-0 items-center gap-1.5">
              <Avatar avatar={r.member.avatar} className="size-6 text-[0.8rem]" />
              <span className="truncate">{i === 0 ? <b>{r.member.name}</b> : r.member.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">{r.won}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex -space-x-1.5">{group.members.slice(0, 5).map((m) => <Avatar key={m.id} avatar={m.avatar} className="size-6 text-[0.8rem] ring-2 ring-background" />)}</span>
          <span className="truncate">{group.members.length} {group.members.length === 1 ? "Mitglied" : "Mitglieder"} · noch keine Partien</span>
        </span>
      )}
    </button>
  );
}

/** Eine Zeile im Assistenten */
function WayRow({ icon: Icon, title, text, marked, onClick }: { icon: LucideIcon; title: string; text: string; marked: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full items-center gap-3 p-3.5 text-left outline-none transition hover:bg-accent/60 active:bg-accent focus-visible:bg-accent">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold leading-tight">{title}{marked && <span className="rounded-full bg-primary/12 px-1.5 py-px text-[0.7rem] font-semibold text-primary">zuletzt</span>}</span>
        <span className="block truncate text-sm text-muted-foreground">{text}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
