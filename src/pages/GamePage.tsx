import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Smartphone } from "lucide-react";
import { getGame } from "@shared/games";
import { PIN_RE } from "@shared/platform/protocol";
import { cleanName, MAX_NAME } from "@shared/platform/room";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGameUI } from "@/games";
import { navigate } from "@/hooks/useRoute";
import { NAME_KEY, setPendingJoin } from "@/lib/storage";
import { IconTile } from "@/platform/Logo";
import { RulesSheet } from "@/platform/RulesSheet";

/** Seite eines Spiels: kurz vorgestellt, Regeln, Online-Raum erstellen oder lokal spielen. */
export function GamePage({ gameId }: { gameId: string }) {
  const info = getGame(gameId).info;
  const { Icon } = getGameUI(gameId);
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } });
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = cleanName(name).length > 0 && PIN_RE.test(pin);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin, game: gameId }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "Raum konnte nicht erstellt werden.");
      try { localStorage.setItem(NAME_KEY, cleanName(name)); } catch { /* egal */ }
      setPendingJoin(data.code, { name: cleanName(name), pin });
      navigate(`/r/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh-safe max-w-md flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex h-14 shrink-0 items-center justify-between">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("/")}><ChevronLeft />Alle Spiele</Button>
        <RulesSheet gameId={gameId}>
          <Button variant="secondary" size="sm"><BookOpen className="size-4" />Regeln</Button>
        </RulesSheet>
      </header>

      <div className="mt-[2vh] flex items-center gap-4">
        <IconTile className="size-18 rounded-3xl"><Icon className="size-12" /></IconTile>
        <div className="min-w-0">
          <h1 className="text-4xl font-extrabold leading-none tracking-tighter">{info.name}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{info.category} · {info.minPlayers}–{info.maxPlayers} Spieler · {info.duration}</p>
        </div>
      </div>
      <p className="mt-3 text-muted-foreground">{info.tagline}</p>

      <Card className="mt-5 grid gap-4">
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok && !busy) create(); }}>
          <h2 className="text-lg font-bold">Online-Raum erstellen</h2>
          <div className="grid gap-2">
            <Label htmlFor="name">Dein Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="nickname" placeholder="Name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pin">PIN (4–8 Ziffern)</Label>
            <Input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric" autoComplete="off" placeholder="z. B. 4711" className="tracking-[0.3em]" />
          </div>
          <Button type="submit" size="lg" disabled={!ok || busy}>
            {busy && <Loader2 className="animate-spin" />}Raum erstellen
          </Button>
          <p className="-mt-1 text-sm text-muted-foreground">Mitspieler brauchen Raumcode und PIN. Du bist automatisch Host.</p>
        </form>
      </Card>

      {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/15 p-3 text-destructive">{error}</p>}

      <button
        type="button"
        onClick={() => navigate(`/spiel/${gameId}/lokal`)}
        className="glass mt-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left outline-none transition active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-600"><Smartphone className="size-5" /></span>
        <span className="flex-1">
          <span className="block font-semibold">Nur auf diesem Gerät</span>
          <span className="block text-sm text-muted-foreground">Alle spielen an einem Handy, ohne Internet</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </button>
    </main>
  );
}
