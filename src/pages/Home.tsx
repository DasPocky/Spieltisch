import { useState } from "react";
import { ChevronRight, LogIn } from "lucide-react";
import { ROOM_CODE_RE } from "@shared/platform/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GAME_LIST } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { IconTile, Logo } from "@/platform/Logo";

/** Startseite: Raum per Code beitreten oder ein Spiel auswählen. */
export function Home() {
  const [code, setCode] = useState("");
  const codeOk = ROOM_CODE_RE.test(code);

  return (
    <main className="mx-auto flex min-h-dvh-safe max-w-md flex-col px-4 pt-[5vh] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="text-center">
        <Logo className="mx-auto mb-4 size-16 -rotate-6 rounded-2xl" />
        <h1 className="bg-gradient-to-b from-white to-navy-300 bg-clip-text text-5xl font-extrabold leading-none tracking-tighter text-transparent">Spieltisch</h1>
        <p className="mx-auto mt-3 max-w-[32ch] text-muted-foreground">Spiele für euren Spieleabend – jeder am eigenen Handy oder alle an einem.</p>
      </div>

      <form className="glass mt-7 rounded-2xl p-4" onSubmit={(e) => { e.preventDefault(); if (codeOk) navigate(`/r/${code}`); }}>
        <label htmlFor="code" className="text-sm font-semibold text-muted-foreground">Raum beitreten</label>
        <div className="mt-2 flex gap-2">
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
            autoComplete="off" autoCapitalize="characters" placeholder="Raumcode" className="text-center text-xl font-bold tracking-[0.3em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal" />
          <Button type="submit" disabled={!codeOk} className="shrink-0"><LogIn />Los</Button>
        </div>
      </form>

      <h2 className="mt-7 mb-3 text-xl font-extrabold tracking-tight">Spiel auswählen</h2>
      <ul className="grid gap-2.5">
        {GAME_LIST.map(({ id, info, ui: { Icon } }) => (
          <li key={id}>
            <button type="button" onClick={() => navigate(`/spiel/${id}`)}
              className="glass flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring">
              <IconTile className="size-13 rounded-2xl"><Icon className="size-9" /></IconTile>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-tight">{info.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{info.category} · {info.minPlayers}–{info.maxPlayers} Spieler · {info.duration}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">Online-Räume verschwinden 48 Stunden nach dem letzten Zug.</p>
    </main>
  );
}
