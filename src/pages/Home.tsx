import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Lock, LogIn, Settings2, Smartphone, UserRound, Users, type LucideIcon } from "lucide-react";
import { ROOM_CODE_RE } from "@shared/platform/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GAME_LIST } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { IconTile, Logo } from "@/platform/Logo";
import { InstallHint } from "@/platform/InstallHint";
import { ThemeToggle } from "@/platform/ThemeSwitch";
import { accessFor } from "@shared/platform/access";
import { savedAccess, useSiteConfig } from "@/hooks/useSiteConfig";

type Way = "local" | "online";
const WAY_KEY = "spieltisch:way";
const readWay = (): Way | null => { try { const v = localStorage.getItem(WAY_KEY); return v === "local" || v === "online" ? v : null; } catch { return null; } };

/**
 * Startseite als kleiner Assistent: 1. Wie spielt ihr? (ein Handy · Online-Raum erstellen · Raum beitreten)
 * 2. Spiel wählen. Die letzte Spielweise wird gemerkt, Namen und Profil bleiben gespeichert.
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
  const open = (id: string) => navigate(way === "local" ? `/spiel/${id}/lokal` : `/spiel/${id}`);

  return (
    <main className="mx-auto flex h-dvh-safe max-w-md flex-col overflow-hidden px-4 pt-[3vh] pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center gap-3">
        <Logo className="size-12 shrink-0 -rotate-6 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="bg-gradient-to-b from-foreground to-navy-300 bg-clip-text text-[2rem] font-extrabold leading-none tracking-tighter text-transparent">Spieltisch</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">Für euren Spieleabend</p>
        </div>
        <ThemeToggle />
        <Button variant="secondary" size="icon" className="size-11 shrink-0 rounded-full" aria-label="Profil und Einstellungen" onClick={() => navigate("/profil")}><UserRound /></Button>
      </div>

      {way === null ? (
        <>
          <h2 className="mt-6 mb-2.5 shrink-0 text-xl font-extrabold tracking-tight">Wie spielt ihr?</h2>
          <div className="grid shrink-0 gap-2.5">
            <WayCard icon={Smartphone} title="Ein Handy für alle" text="Ihr reicht ein Handy herum oder legt es in die Mitte." marked={last === "local"} onClick={() => choose("local")} />
            <WayCard icon={Users} title="Online-Raum erstellen" text="Jeder spielt am eigenen Handy. Du bekommst Raumcode und PIN." marked={last === "online"} onClick={() => choose("online")} />
          </div>
          <form className="glass mt-2.5 shrink-0 rounded-2xl p-3.5" onSubmit={(e) => { e.preventDefault(); if (codeOk) navigate(`/r/${code}`); }}>
            <label htmlFor="code" className="flex items-center gap-2 font-bold"><LogIn className="size-5 text-navy-300" />Raum beitreten</label>
            <p className="mt-0.5 text-sm text-muted-foreground">Code vom Host eingeben</p>
            <div className="mt-2 flex gap-2">
              <Input id="code" aria-label="Raum beitreten" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                autoComplete="off" autoCapitalize="characters" placeholder="Raumcode" className="text-center text-xl font-bold tracking-[0.3em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal" />
              <Button type="submit" disabled={!codeOk} className="shrink-0">Los</Button>
            </div>
          </form>
          <InstallHint />
          <div className="min-h-0 flex-1" />
        </>
      ) : (
        <>
          <div className="mt-5 mb-2.5 flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="-ml-2 shrink-0" aria-label="Zurück" onClick={() => setWay(null)}><ChevronLeft /></Button>
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold leading-tight tracking-tight">Spiel wählen</h2>
              <p className="text-sm text-muted-foreground">{way === "local" ? "Ein Handy für alle" : "Online-Raum – jeder am eigenen Handy"}</p>
            </div>
          </div>
          {/* Nur die Liste scrollt, falls es einmal mehr Spiele werden, als auf den Bildschirm passen */}
          <ul className="no-scrollbar grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pb-1">
            {games.map(({ id, info, ui: { Icon } }) => (
              <li key={id}>
                <button type="button" onClick={() => open(id)} aria-label={`${info.name} – ${info.category}, ${info.minPlayers}–${info.maxPlayers} Spieler`}
                  className="glass flex h-full w-full items-center gap-2.5 rounded-2xl p-2.5 text-left outline-none transition active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring">
                  <IconTile className="size-11 rounded-xl"><Icon className="size-7" /></IconTile>
                  <span className="min-w-0">
                    <span className={cn("block truncate font-bold leading-tight", info.name.length > 8 && "text-[0.94rem] tracking-tight")}>{info.name}{locked(id) && <Lock className="ml-1 inline size-3.5 align-[-1px] text-navy-300" aria-label="mit Zugangscode" />}</span>
                    <span className="block truncate text-xs text-muted-foreground">{info.minPlayers}–{info.maxPlayers} Spieler</span>
                    <span className="block truncate text-xs text-muted-foreground">{info.duration}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
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

/** Große Auswahlkarte im Assistenten */
function WayCard({ icon: Icon, title, text, marked, onClick }: { icon: LucideIcon; title: string; text: string; marked: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("glass flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring", marked && "ring-2 ring-navy-300/60")}>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-deep-500 to-deep-700 text-white"><Icon className="size-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">{title}</span>
        <span className="block text-sm leading-snug text-muted-foreground">{text}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
