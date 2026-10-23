import { useEffect, useState } from "react";
import { ChevronLeft, LayoutGrid, Loader2, LogOut, ShieldCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AdminProvider, useAdmin } from "./context";
import { goSection, SECTIONS, useSections, type AdminSection } from "./nav";
import { AdminHome } from "./Home";
import { LiveSection } from "./Live";
import { StatsSection } from "./Stats";
import { GamesSection } from "./GamesAdmin";
import { PeopleSection } from "./People";
import { CardSetsSection } from "./CardSetsAdmin";
import { SettingsSection } from "./Settings";
import { DevSection } from "./Dev";

/** Verwaltung: Anmeldung, dann Admin-Start oder ein Bereich. Am Computer mit Seitenleiste. */
export function AdminApp({ section }: { section: AdminSection }) {
  return (
    <AdminProvider login={(p) => <Login {...p} />}>
      <Layout section={section} />
    </AdminProvider>
  );
}

function Layout({ section }: { section: AdminSection }) {
  const { logout } = useAdmin();
  const sections = useSections();
  const current = SECTIONS.find((s) => s.id === section);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 lg:px-6" data-testid="admin">
      {/* Seitenleiste am Computer */}
      <aside className="sticky top-0 hidden w-56 shrink-0 self-start pt-6 lg:block" aria-label="Verwaltung">
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold tracking-tight"><ShieldCheck className="size-6 text-primary" />Verwaltung</h1>
        <nav className="grid gap-1">
          <NavItem icon={LayoutGrid} label="Übersicht" active={section === "start"} onClick={() => goSection("start")} />
          {sections.map((s) => <NavItem key={s.id} icon={s.icon} label={s.title} active={section === s.id} onClick={() => goSection(s.id)} />)}
        </nav>
        <Button variant="ghost" size="sm" className="mt-6 text-muted-foreground" onClick={logout}><LogOut />Abmelden</Button>
      </aside>

      <main className="min-w-0 flex-1 pt-[max(1rem,2.5vh)] pb-8 lg:pt-6">
        <header className="mb-4 flex min-h-11 items-center gap-2">
          {current ? (
            <>
              <Button variant="ghost" size="icon" className="-ml-2 shrink-0 lg:hidden" aria-label="Zur Übersicht" onClick={() => goSection("start")}><ChevronLeft /></Button>
              <h1 className="flex min-w-0 flex-1 items-center gap-2 truncate text-2xl font-bold tracking-tight"><current.icon className="hidden size-6 text-primary lg:block" />{current.title}</h1>
            </>
          ) : (
            <>
              <h1 className="flex flex-1 items-center gap-2 text-2xl font-bold tracking-tight lg:hidden"><ShieldCheck className="size-6 text-primary" />Verwaltung</h1>
              <h1 className="hidden flex-1 text-2xl font-bold tracking-tight lg:block">Übersicht</h1>
              <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground lg:hidden" onClick={logout}><LogOut />Abmelden</Button>
            </>
          )}
        </header>
        <div key={section} className="tab-in">
          {section === "start" && <AdminHome />}
          {section === "live" && <LiveSection />}
          {section === "statistik" && <StatsSection />}
          {section === "spiele" && <GamesSection />}
          {section === "kartensets" && <CardSetsSection />}
          {section === "leute" && <PeopleSection />}
          {section === "einstellungen" && <SettingsSection />}
          {section === "entwickler" && <DevSection />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
        active ? "bg-primary/14 text-primary" : "text-muted-foreground hover:bg-accent")}>
      <Icon className="size-4.5" />{label}
    </button>
  );
}

function Login({ onLogin, checking, message }: { onLogin: (pw: string) => Promise<string | null>; checking: boolean; message: string | null }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(message);
  useEffect(() => setError(message), [message]);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-8">
      <ShieldCheck className="mx-auto size-12 text-primary" />
      <h1 className="mt-3 text-center text-2xl font-bold tracking-tight">Verwaltung</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">Danach gibt es auf diesem Gerät den Tab „Verwaltung“ – 30 Tage lang, bis du dich abmeldest.</p>
      {checking ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Anmeldung wird geprüft …</p>
      ) : (
        <Card className="mt-5">
          <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(await onLogin(password)); setBusy(false); }}>
            <Label htmlFor="admin-pw">Admin-Passwort</Label>
            <Input id="admin-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <Button type="submit" size="lg" disabled={busy || !password}>{busy && <Loader2 className="animate-spin" />}Anmelden</Button>
            {error && <p role="alert" className="font-semibold text-destructive">{error}</p>}
          </form>
        </Card>
      )}
    </main>
  );
}
