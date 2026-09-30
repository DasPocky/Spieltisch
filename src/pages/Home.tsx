import { cn } from "@/lib/utils";
import { useState } from "react";
import { Lock, LogIn, UserRound } from "lucide-react";
import { ROOM_CODE_RE } from "@shared/platform/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GAME_LIST } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { IconTile, Logo } from "@/platform/Logo";
import { InstallHint } from "@/platform/InstallHint";
import { accessFor } from "@shared/platform/access";
import { savedAccess, useSiteConfig } from "@/hooks/useSiteConfig";

/** Startseite: Raum per Code beitreten oder ein Spiel auswählen. */
export function Home() {
  const [code, setCode] = useState("");
  const codeOk = ROOM_CODE_RE.test(code);
  const config = useSiteConfig();
  // Abgeschaltete Spiele erscheinen nicht, Spiele hinter Zugangscode bekommen ein Schloss
  const games = GAME_LIST.filter(({ id }) => !config || accessFor(config, id) !== "off");
  const locked = (id: string) => !!config && accessFor(config, id) === "code" && !savedAccess();

  return (
    <main className="mx-auto flex h-dvh-safe max-w-md flex-col overflow-hidden px-4 pt-[3vh] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center gap-3.5">
        <Logo className="size-14 shrink-0 -rotate-6 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="bg-gradient-to-b from-white to-navy-300 bg-clip-text text-4xl font-extrabold leading-none tracking-tighter text-transparent">Spieltisch</h1>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">Spiele für euren Spieleabend – jeder am eigenen Handy oder alle an einem.</p>
        </div>
        <Button variant="secondary" size="icon" className="shrink-0 self-start" aria-label="Dein Profil" onClick={() => navigate("/profil")}><UserRound /></Button>
      </div>

      <form className="glass mt-5 shrink-0 rounded-2xl p-3.5" onSubmit={(e) => { e.preventDefault(); if (codeOk) navigate(`/r/${code}`); }}>
        <label htmlFor="code" className="text-sm font-semibold text-muted-foreground">Raum beitreten</label>
        <div className="mt-2 flex gap-2">
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
            autoComplete="off" autoCapitalize="characters" placeholder="Raumcode" className="text-center text-xl font-bold tracking-[0.3em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal" />
          <Button type="submit" disabled={!codeOk} className="shrink-0"><LogIn />Los</Button>
        </div>
      </form>

      <InstallHint />

      <h2 className="mt-5 mb-2.5 shrink-0 text-xl font-extrabold tracking-tight">Spiel auswählen</h2>
      {/* Nur die Liste scrollt, falls es einmal mehr Spiele werden, als auf den Bildschirm passen */}
      <ul className="no-scrollbar grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pb-1">
        {games.map(({ id, info, ui: { Icon } }) => (
          <li key={id}>
            <button type="button" onClick={() => navigate(`/spiel/${id}`)} aria-label={`${info.name} – ${info.category}, ${info.minPlayers}–${info.maxPlayers} Spieler`}
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
      <p className="shrink-0 pt-3 text-center text-xs text-muted-foreground">Online-Räume verschwinden 48 Stunden nach dem letzten Zug.</p>
    </main>
  );
}
