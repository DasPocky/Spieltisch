import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, LogIn, Settings2, Smartphone, Users, Video, type LucideIcon } from "lucide-react";
import { PIN_RE, ROOM_CODE_RE } from "@shared/platform/protocol";
import { cleanName, MAX_NAME } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GAME_LIST } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { createRoom } from "@/lib/createRoom";
import { LAST_GAME_KEY, LOCAL_GAME_KEY, localKey, NAME_KEY, readJSON, remove, RETURN_KEY } from "@/lib/storage";
import { getGame, isGameId } from "@shared/games";
import { myAvatar } from "@/lib/profile";
import { IconTile, Logo } from "@/platform/Logo";
import { wantGamePick } from "@/lib/pickGame";
import { InstallHint } from "@/platform/InstallHint";
import { accessFor, orderGames } from "@shared/platform/access";
import { savedAccess, useSiteConfig } from "@/hooks/useSiteConfig";
import { activeGroupCode, loadGroup, useActiveGroup } from "@/lib/group";
import { leaderboard } from "@shared/platform/group";
import { Avatar } from "@/platform/Avatar";
import { cn } from "@/lib/utils";
import { useOnline } from "@/hooks/useOnline";

type Way = "local" | "online";
/** Angezeigter Schritt: nur der Online-Raum hat einen eigenen */
type Step = "online" | "meet";
const WAY_KEY = "spieltisch:way";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
/** Läuft auf diesem Handy noch eine lokale Partie? Dann steht das auf der Startseite. */
function runningLocal(): string | null {
  const id = read(LOCAL_GAME_KEY);
  if (!isGameId(id)) return null;
  const saved = readJSON<{ phase?: string; game?: unknown }>(localKey(id));
  return saved?.phase === "playing" && saved.game ? getGame(id).info.name : null;
}
const readWay = (): Way | null => { const v = read(WAY_KEY); return v === "local" || v === "online" ? v : null; };

/**
 * Startseite als kleiner Assistent:
 * 1. Wie spielt ihr? (ein Handy · Online-Raum · beitreten)
 * 2a. Ein Handy: direkt in die lokale Lobby. 2b. Online: Name und PIN – der Raum entsteht sofort.
 * Das Spiel wählt ihr in beiden Fällen in der Lobby.
 */
export function Home() {
  const [code, setCode] = useState("");
  const [way, setWay] = useState<Step | null>(null);
  const last = readWay();
  const codeOk = ROOM_CODE_RE.test(code);
  const config = useSiteConfig();
  // Abgeschaltete Spiele erscheinen nicht, Spiele hinter Zugangscode bekommen ein Schloss
  const games = GAME_LIST.filter(({ id }) => !config || accessFor(config, id) !== "off");
  const locked = (id: string) => !!config && accessFor(config, id) === "code" && !savedAccess();
  const remember = (w: Way) => { try { localStorage.setItem(WAY_KEY, w); } catch { /* egal */ } };
  const [avatar] = useState(myAvatar);
  const [running] = useState(runningLocal);
  // Ohne Netz: Online-Wege sichtbar, aber gesperrt – „Ein Handy für alle“ geht immer
  const netOnline = useOnline();
  // Admin kann Online-Räume, Gruppen und Profile abschalten
  const features = config?.features;
  const onlineOff = features?.online === false;
  const online = netOnline && !onlineOff;
  // Ein Handy: gleich in die lokale Lobby – mit dem zuletzt lokal gewählten Spiel, falls es noch freigegeben ist
  const playLocal = (pick?: string) => {
    remember("local");
    const ids = games.map((g) => g.id);
    const prev = read(LOCAL_GAME_KEY);
    const id = pick && ids.includes(pick as never) ? pick : prev && ids.includes(prev as never) ? prev : defaultGame(ids, locked);
    try { localStorage.setItem(LOCAL_GAME_KEY, id); } catch { /* egal */ }
    navigate("/lokal");
  };

  return (
    <main className="mx-auto flex h-dvh-safe max-w-md flex-col overflow-hidden px-4 pt-[2.5vh] pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center gap-3">
        <Logo className="size-10 shrink-0 -rotate-6 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-none tracking-tight">Spieltisch</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">Für euren Spieleabend</p>
        </div>
        {features?.profiles !== false && <button type="button" aria-label="Mein Profil" onClick={() => { remove(RETURN_KEY, true); navigate("/profil"); }} data-testid="profile-button"
          className="shrink-0 rounded-full outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring">
          <Avatar avatar={avatar} className="size-11 text-2xl ring-1 ring-border" />
        </button>}
      </div>

      {way === null && (
        <>
          {config?.banner && <p className="text-in mt-5 shrink-0 rounded-2xl bg-primary/12 px-4 py-2.5 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/25" data-testid="banner">{config.banner}</p>}
          <h2 className={cn("mb-2 shrink-0 px-1 text-sm font-semibold text-muted-foreground", config?.banner ? "mt-3" : "mt-5")}>Wie spielt ihr?</h2>
          <div className="grid shrink-0 grid-cols-2 gap-2.5">
            <WayCard icon={Smartphone} title="Ein Handy für alle" text={running ? `${running} läuft noch – weiter` : "Herumreichen oder in die Mitte legen"} marked={!running && last === "local"} primary onClick={playLocal} />
            <WayCard icon={Users} title="Online-Raum erstellen" text={onlineOff ? "Gerade abgeschaltet" : online ? "Jeder am eigenen Handy" : "Braucht Netz – offline"} marked={online && last === "online"} disabled={!online} onClick={() => { remember("online"); setWay("online"); }} />
          </div>
          <form className="glass mt-2.5 flex shrink-0 items-center gap-2 rounded-2xl p-2 pl-3" onSubmit={(e) => { e.preventDefault(); if (codeOk) navigate(`/r/${code}`); }}>
            <LogIn className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
            <Input id="code" aria-label="Raum beitreten" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
              autoComplete="off" autoCapitalize="characters" placeholder="Raumcode – beitreten" className="h-10 text-center text-lg font-semibold tracking-[0.3em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal" />
            <Button type="submit" disabled={!codeOk || !online} className="h-10 shrink-0">Los</Button>
          </form>
          {online && (
            <button type="button" onClick={() => setWay("meet")} data-testid="meet-card"
              className="glass mt-2.5 flex w-full shrink-0 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring">
              <Video className="size-4.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1"><span className="block font-semibold leading-tight">Treffpunkt</span><span className="block truncate text-xs text-muted-foreground">Reden, sehen, schreiben – spielen später</span></span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </button>
          )}
          <QuickGames games={games.map((g) => g.id)} featured={config?.featured ?? []} order={config?.order ?? []} onPick={(id) => playLocal(id)} />
          {features?.groups !== false && <GroupCard />}
          <InstallHint />
          <div className="min-h-0 flex-1" />
        </>
      )}

      {way === "meet" && (
        <>
          <StepHead title="Treffpunkt" sub="Video, Sprache und Chat – ein Spiel geht jederzeit" onBack={() => setWay(null)} />
          <CreateRoom gameId={defaultGame(games.map((g) => g.id), locked)} meet />
          <div className="min-h-0 flex-1" />
        </>
      )}

      {way === "online" && (
        <>
          <StepHead title="Online-Raum erstellen" sub="Das Spiel wählst du gleich in der Lobby" onBack={() => setWay(null)} />
          <CreateRoom gameId={defaultGame(games.map((g) => g.id), locked)} />
          <div className="min-h-0 flex-1" />
        </>
      )}

      <nav className="flex shrink-0 items-center justify-center pt-3 text-xs text-muted-foreground/80">
        <button type="button" className="flex items-center gap-1 underline-offset-4 hover:underline" onClick={() => navigate("/admin")}><Settings2 className="size-3" />Admin</button>
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

function CreateRoom({ gameId, meet }: { gameId: string; meet?: boolean }) {
  const [name, setName] = useState(() => read(NAME_KEY) ?? "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = cleanName(name).length > 0 && PIN_RE.test(pin);
  const create = async () => {
    setBusy(true); setError(null);
    try { await createRoom(name, pin, gameId, true, meet); }
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

/** Eine der zwei großen Kacheln „Wie spielt ihr?“ */
function WayCard({ icon: Icon, title, text, marked, disabled, primary, onClick }: { icon: LucideIcon; title: string; text: string; marked: boolean; disabled?: boolean; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={() => onClick()} disabled={disabled}
      className={cn("relative flex min-w-0 flex-col items-start gap-2 rounded-2xl p-3 text-left outline-none transition active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-50",
        primary ? "bg-primary text-primary-foreground shadow-[var(--btn-shadow,none)]" : "glass")}>
      {marked && <span className={cn("absolute top-2 right-2 rounded-full px-1.5 py-px text-[0.65rem] font-semibold", primary ? "bg-white/25" : "bg-primary/12 text-primary")}>zuletzt</span>}
      <span className={cn("grid size-10 place-items-center rounded-xl", primary ? "bg-white/20" : "bg-primary/12 text-primary")}><Icon className="size-5.5" /></span>
      <span className="min-w-0">
        <span className="font-display block text-[1.05rem] leading-tight">{title}</span>
        <span className={cn("mt-0.5 block text-xs leading-snug", primary ? "opacity-85" : "text-muted-foreground")}>{text}</span>
      </span>
    </button>
  );
}

/** Schnellstart: die wichtigsten Spiele als Kacheln – ein Tipp, und die Lobby (ein Handy) steht mit diesem Spiel bereit */
function QuickGames({ games, featured, order, onPick }: { games: string[]; featured: string[]; order: string[]; onPick: (id?: string) => void }) {
  const last = read(LOCAL_GAME_KEY);
  const ids = orderGames(games, order);
  const first = [...featured.filter((id) => ids.includes(id)), ...(last && ids.includes(last) ? [last] : []), ...ids];
  const shown = [...new Set(first)].slice(0, 7);
  if (!shown.length) return null;
  return (
    <section className="mt-4 shrink-0" aria-label="Schnellstart">
      <h2 className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold text-muted-foreground">Schnellstart <span className="text-xs font-normal">ein Handy</span></h2>
      <div className="grid grid-cols-4 gap-2">
        {shown.map((id, i) => {
          const g = GAME_LIST.find((x) => x.id === id)!;
          return (
            // Kleine Handys: nur eine Reihe (drei Spiele und „Alle“), damit nichts scrollt
            <button key={id} type="button" onClick={() => onPick(id)} data-testid={`quick-${id}`}
              className={cn(i >= 3 && "quick-extra", "glass relative flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 pt-2 pb-1.5 outline-none transition active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring")}>
              {featured.includes(id) && <span className="absolute top-1 right-1 rounded-full bg-primary px-1 text-[0.55rem] font-bold leading-tight text-primary-foreground">NEU</span>}
              <IconTile className="size-10 rounded-xl"><g.Icon className="size-6.5" /></IconTile>
              <span className="w-full truncate text-center text-[0.7rem] font-semibold">{g.info.name}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => { wantGamePick(); onPick(); }}
          className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 pt-2 pb-1.5 text-muted-foreground ring-1 ring-inset ring-border ring-dashed outline-none transition active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring">
          <span className="grid size-10 place-items-center text-lg font-bold">{games.length}</span>
          <span className="w-full truncate text-center text-[0.7rem] font-semibold">Alle Spiele</span>
        </button>
      </div>
    </section>
  );
}
