import { useEffect, useState } from "react";
import { ChevronRight, DoorOpen, LogIn, Plus, Smartphone, Tv, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GAME_LIST } from "@/games";
import { useGames } from "@/hooks/useGames";
import { LOCAL_GAME_KEY, readLocal, readStr } from "@/lib/storage";
import { getGame, isGameId } from "@shared/games";
import { myAvatar, myName } from "@/lib/profile";
import { IconTile, Logo } from "@/platform/Logo";
import { InstallHint, InstallInvite } from "@/platform/InstallHint";
import { orderGames } from "@shared/platform/access";
import { activeGroupCode, loadGroup, useActiveGroup } from "@/lib/group";
import { leaderboard } from "@shared/platform/group";
import { Avatar } from "@/platform/Avatar";
import { cn } from "@/lib/utils";
import { defaultGame, playLocal } from "@/lib/playLocal";
import { goTab } from "@/platform/shell/AppShell";
import { CreateRoomSheet, JoinSheet, type RoomPlan } from "@/platform/shell/RoomSheets";
import { RoomRow } from "@/platform/shell/RoomCards";
import { NavRow } from "@/platform/NavRow";
import { useRooms } from "@/lib/rooms";
import { navigate } from "@/hooks/useRoute";

/** Läuft auf diesem Handy noch eine lokale Partie? Dann steht das auf der Startseite. */
function runningLocal(): string | null {
  const id = readStr(LOCAL_GAME_KEY);
  if (!isGameId(id)) return null;
  const saved = readLocal<{ phase?: string; game?: unknown }>(id);
  return saved?.phase === "playing" && saved.game ? getGame(id).info.name : null;
}

/**
 * Start-Tab: Begrüßung, eigene und offene Räume, Schnellstart und Gruppe – unten fest die Hauptaktionen
 * „Raum öffnen“ und „Beitreten“ (und „Ein Handy für alle“, wenn der Admin es eingeschaltet hat).
 * Name und PIN fragt ein Blatt von unten, das Spiel wählt ihr in der Lobby.
 * Auf großen Bildschirmen stehen die Hauptaktionen oben als zwei Karten: „Großer Tisch“ und „Selbst mitspielen“.
 */
export function Home() {
  const { config, ids, locked, features, onlineOff, online, localOn } = useGames();
  const [plan, setPlan] = useState<RoomPlan | null>(null);
  const [joining, setJoining] = useState(false);
  const [running] = useState(runningLocal);
  const [name] = useState(myName);
  const [avatar] = useState(myAvatar);
  const rooms = useRooms(online);
  const anyRooms = rooms.mine.length + rooms.open.length > 0;
  // Ein Raumtyp für alles: ohne Spiel geht es im Treffpunkt los, mit Schnellstart-Spiel gleich in die Lobby
  const newRoom = (gameId?: string) => setPlan(gameId ? { gameId, pickGame: false } : { gameId: defaultGame(ids, locked), pickGame: false, meet: true });

  return (
    <main className={cn("mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-[max(1rem,2.5vh)] pb-3 lg:max-w-6xl lg:px-10 lg:pt-10", anyRooms && "has-rooms")}>
      {/* Am großen Bildschirm steht das Logo schon in der Seitenleiste – ohne Namen ist der Kopf dort überflüssig */}
      <header className={cn("flex shrink-0 items-center gap-3", !name && "lg:hidden")}>
        <span className="relative shrink-0 lg:hidden">
          <Logo className="size-11 -rotate-6 rounded-xl" />
          {features?.profiles !== false && name && <Avatar avatar={avatar} className="absolute -right-1.5 -bottom-1.5 size-6 text-sm ring-2 ring-background" />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold leading-tight tracking-tight" data-testid="greeting">{name ? `Hallo, ${name}!` : "Spieltisch"}</h1>
          <p className="truncate text-sm text-muted-foreground">{name ? "Was spielt ihr heute?" : "Für euren Spieleabend"}</p>
        </div>
      </header>

      <DesktopHero top={!name} online={online} onlineOff={onlineOff} localOn={localOn} running={running}
        onRoom={() => newRoom()} onJoin={() => setJoining(true)} onLocal={() => playLocal(ids, locked)} />

      <div className="mt-4 grid shrink-0 grid-cols-[minmax(0,1fr)] gap-2.5 lg:mt-6 lg:gap-4">
        {config?.banner && <p className="text-in rounded-2xl bg-primary/12 px-4 py-2.5 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/25" data-testid="banner">{config.banner}</p>}
        {online && <RoomRow title="Deine Räume" cards={rooms.mine} mine testId="my-rooms" />}
        {online && <RoomRow title="Offene Räume" cards={rooms.open} testId="open-rooms" />}
        {online && rooms.loaded && !anyRooms && (
          <p className="text-in flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm text-muted-foreground ring-1 ring-inset ring-border ring-dashed lg:hidden" data-testid="no-rooms">
            <DoorOpen className="size-4.5 shrink-0" />Gerade ist kein Raum offen – öffne einen oder tritt mit Code bei.
          </p>
        )}
        {(localOn || online) && <QuickGames games={ids} featured={config?.featured ?? []} order={config?.order ?? []} local={localOn}
          onPick={(id) => { if (localOn) playLocal(ids, locked, id); else newRoom(id); }} onAll={() => goTab("/spiele")} />}
        {features?.groups !== false && <GroupCard />}
        <InstallHint />
      </div>

      <div className="min-h-3 flex-1 lg:hidden" />

      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)] gap-2 lg:hidden" data-testid="home-actions">
        {localOn && (
          <NavRow icon={Smartphone} tile onClick={() => playLocal(ids, locked)} title="Ein Handy für alle"
            sub={running ? `${running} läuft noch – weiter` : "Herumreichen oder in die Mitte legen"} />
        )}
        <div className="flex gap-2">
          <Button size="lg" className="h-14 flex-1 rounded-2xl text-base" disabled={!online} onClick={() => newRoom()}>
            <Plus className="size-5" />{onlineOff ? "Online abgeschaltet" : online ? "Raum öffnen" : "Raum öffnen – offline"}
          </Button>
          <Button size="lg" variant="secondary" className="h-14 rounded-2xl px-4 text-base" disabled={!online} onClick={() => setJoining(true)}>
            <LogIn className="size-5" />Beitreten
          </Button>
        </div>
      </div>

      <CreateRoomSheet plan={plan} onClose={() => setPlan(null)} />
      <JoinSheet open={joining} onClose={() => setJoining(false)} online={online} />
      <InstallInvite />
    </main>
  );
}

/** Großer Bildschirm: Tisch für alle aufbauen oder selbst mitspielen */
function DesktopHero({ top, online, onlineOff, localOn, running, onRoom, onJoin, onLocal }: {
  top: boolean; online: boolean; onlineOff: boolean; localOn: boolean; running: string | null; onRoom: () => void; onJoin: () => void; onLocal: () => void;
}) {
  return (
    <div className={cn("mt-6 hidden shrink-0 grid-cols-[1.3fr_1fr] gap-5 lg:grid", top && "lg:mt-0")} data-testid="desktop-hero">
      <section className="desk-hero glass flex items-center gap-6 rounded-3xl p-7">
        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-bold text-primary">Großer Tisch</span>
          <h2 className="mt-3 text-2xl font-bold leading-tight">Laptop oder Fernseher als Spieltisch</h2>
          <p className="mt-2 text-muted-foreground">Karten, Würfel und Punkte liegen groß in der Mitte. Jeder spielt mit dem eigenen Handy – was geheim ist, bleibt geheim.</p>
          <Button size="lg" className="mt-5 h-12 rounded-2xl px-5 text-base" disabled={!online} onClick={() => navigate("/tisch")} data-testid="table-open">
            <Tv className="size-5" />{onlineOff ? "Online abgeschaltet" : "Tisch aufbauen"}
          </Button>
        </div>
        <TableArt />
      </section>
      <section className="desk-hero glass flex flex-col rounded-3xl p-7">
        <span className="self-start rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">Am Rechner</span>
        <h2 className="mt-3 text-2xl font-bold leading-tight">Hier selbst mitspielen</h2>
        <p className="mt-2 text-muted-foreground">Öffne einen Raum oder tritt mit Code bei. Die anderen kommen mit Handy oder Rechner dazu.</p>
        <div className="min-h-4 flex-1" />
        <div className="flex flex-wrap gap-2.5">
          <Button size="lg" className="h-12 rounded-2xl px-5 text-base" disabled={!online} onClick={onRoom}><Plus className="size-5" />Raum öffnen</Button>
          <Button size="lg" variant="secondary" className="h-12 rounded-2xl px-5 text-base" disabled={!online} onClick={onJoin}><LogIn className="size-5" />Beitreten</Button>
          {localOn && <Button size="lg" variant="ghost" className="h-12 rounded-2xl px-4 text-base" onClick={onLocal}><Smartphone className="size-5" />{running ? `${running} weiterspielen` : "Reihum an einem Gerät"}</Button>}
        </div>
      </section>
    </div>
  );
}

/** Kleines Bild: Tisch von oben, drei Handys davor */
function TableArt() {
  return (
    <svg viewBox="0 0 220 150" className="desk-art w-44 shrink-0" aria-hidden="true">
      <rect x="14" y="18" width="192" height="98" rx="18" fill="#8a5a36" />
      <rect x="26" y="28" width="168" height="78" rx="10" fill="#2f7f7a" />
      <rect x="92" y="48" width="24" height="34" rx="3" fill="#fffdf8" transform="rotate(-8 104 65)" />
      <rect x="104" y="46" width="24" height="34" rx="3" fill="#fffdf8" transform="rotate(10 116 63)" />
      {[30, 98, 166].map((x, i) => <rect key={x} x={x} y={i === 1 ? 104 : 98} width="26" height="44" rx="6" fill="#23343a" stroke="#fff" strokeWidth="3" />)}
    </svg>
  );
}

/** „Meine Gruppe“: Name und die besten drei – oder ein kleiner Einstieg, solange das Handy in keiner Gruppe ist */
function GroupCard() {
  const group = useActiveGroup();
  useEffect(() => { const c = activeGroupCode(); if (c) void loadGroup(c); }, []);
  if (!group) {
    return (
      <NavRow icon={Users} onClick={() => goTab("/gruppe")} data-testid="group-card" className="shrink-0" title="Gruppe erstellen oder beitreten" />
    );
  }
  const top = leaderboard(group, null).filter((r) => r.played > 0).slice(0, 3);
  return (
    <button type="button" onClick={() => goTab(`/g/${group.code}`)} data-testid="group-card" aria-label={`Meine Gruppe: ${group.name}`}
      className="glass grid w-full shrink-0 grid-cols-[minmax(0,1fr)] gap-1.5 rounded-2xl px-3.5 py-2.5 text-left outline-none transition active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring">
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

/** Schnellstart: die wichtigsten Spiele als Kacheln – ein Tipp, und die Lobby (ein Handy) steht mit diesem Spiel bereit */
function QuickGames({ games, featured, order, onPick, onAll, local }: { games: string[]; featured: string[]; order: string[]; onPick: (id: string) => void; onAll: () => void; local: boolean }) {
  const last = readStr(LOCAL_GAME_KEY);
  const ids = orderGames(games, order);
  const first = [...featured.filter((id) => ids.includes(id)), ...(last && ids.includes(last) ? [last] : []), ...ids];
  const shown = [...new Set(first)].slice(0, 11);
  if (!shown.length) return null;
  return (
    <section className="quick-section shrink-0" aria-label="Schnellstart">
      <h2 className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold text-muted-foreground lg:mb-3 lg:text-lg lg:text-foreground"><span><span className="lg:hidden">Schnellstart</span><span className="hidden lg:inline">Gleich eine Runde</span></span>
        <span className="text-xs font-normal lg:text-sm lg:text-muted-foreground">{local ? <><span className="lg:hidden">ein Handy</span><span className="hidden lg:inline">an diesem Gerät</span></> : "neuer Raum"}</span></h2>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-6 lg:gap-4">
        {shown.map((id, i) => {
          const g = GAME_LIST.find((x) => x.id === id)!;
          return (
            // Kleine Handys: nur eine Reihe (drei Spiele und „Alle“), damit nichts scrollt
            <button key={id} type="button" onClick={() => onPick(id)} data-testid={`quick-${id}`}
              className={cn(i >= 3 && "quick-extra", "quick-tile glass relative lg:gap-2 lg:py-5 flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 pt-2 pb-1.5 outline-none transition active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring", i >= 7 && "hidden lg:flex", i >= 5 && "quick-desk-more")}>
              {featured.includes(id) && <span className="absolute top-1 right-1 rounded-full bg-primary px-1 text-[0.55rem] font-bold leading-tight text-primary-foreground">NEU</span>}
              <IconTile className="size-10 rounded-xl lg:size-14 lg:rounded-2xl"><g.Icon className="size-6.5 lg:size-9" /></IconTile>
              <span className="w-full truncate text-center text-[0.7rem] font-semibold lg:text-base">{g.info.name}</span>
            </button>
          );
        })}
        <button type="button" onClick={onAll} data-testid="quick-all"
          className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 pt-2 pb-1.5 text-muted-foreground ring-1 ring-inset ring-border ring-dashed outline-none transition active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring">
          <span className="grid size-10 place-items-center text-lg font-bold lg:size-14 lg:text-3xl">{games.length}</span>
          <span className="w-full truncate text-center text-[0.7rem] font-semibold lg:text-base">Alle Spiele</span>
        </button>
      </div>
    </section>
  );
}
