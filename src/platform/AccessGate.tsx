import { useState, type ReactNode } from "react";
import { ChevronLeft, Loader2, Lock } from "lucide-react";
import { getGame } from "@shared/games";
import { accessFor } from "@shared/platform/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { navigate } from "@/hooks/useRoute";
import { savedAccess, unlock, useSiteConfig } from "@/hooks/useSiteConfig";
import { Logo } from "./Logo";

/**
 * Zeigt den Inhalt nur, wenn der Admin ihn freigegeben hat:
 * abgeschaltet → Hinweis, hinter Zugangscode → Code-Eingabe (einmal pro Gerät).
 */
export function AccessGate({ gameId, children }: { gameId?: string; children: ReactNode }) {
  const config = useSiteConfig();
  const [unlocked, setUnlocked] = useState(() => !!savedAccess());
  if (!config) return <div className="grid h-dvh-safe place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  const access = accessFor(config, gameId);
  const what = gameId && config.site === "on" ? getGame(gameId).info.name : "Der Spieltisch";
  if (access === "off") {
    return (
      <Screen back={!!gameId && config.site !== "off"}>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="closed">{what} ist gerade geschlossen</h1>
        {config.message && <p className="mt-2 text-muted-foreground">{config.message}</p>}
      </Screen>
    );
  }
  if (access === "code" && !unlocked) {
    return (
      <Screen back={!!gameId && config.site === "on"}>
        <h1 className="text-2xl font-bold tracking-tight">{what} braucht einen Zugangscode</h1>
        {config.message && <p className="mt-2 text-muted-foreground">{config.message}</p>}
        <CodeForm onOk={() => setUnlocked(true)} />
      </Screen>
    );
  }
  return <>{children}</>;
}

function Screen({ back, children }: { back: boolean; children: ReactNode }) {
  return (
    <main className="mx-auto flex h-dvh-safe max-w-md flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex h-14 shrink-0 items-center">
        {back && <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("/")}><ChevronLeft />Startseite</Button>}
      </header>
      <div className="my-auto text-center">
        <Logo className="mx-auto mb-5 size-16 -rotate-6 rounded-2xl" />
        <Lock className="mx-auto mb-3 size-6 text-navy-300" />
        {children}
      </div>
    </main>
  );
}

function CodeForm({ onOk }: { onOk: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="mt-5 grid gap-2.5" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setError(null);
      if (await unlock(code.trim())) onOk(); else setError("Der Code stimmt nicht.");
      setBusy(false);
    }}>
      <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Zugangscode" aria-label="Zugangscode" autoComplete="off" className="text-center text-lg" />
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || code.trim().length < 4}>{busy && <Loader2 className="animate-spin" />}Freischalten</Button>
    </form>
  );
}
