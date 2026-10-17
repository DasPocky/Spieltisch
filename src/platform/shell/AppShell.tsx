import type { ReactNode } from "react";
import { Dices, House, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useActiveGroup } from "@/lib/group";
import { myAvatar } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Avatar } from "@/platform/Avatar";
import { Logo } from "@/platform/Logo";
import { useAdminAttention, useAdminDevice } from "@/lib/admin";

export type Tab = "start" | "spiele" | "gruppe" | "profil" | "verwaltung";

/** Startseite, von der aus Tabs mit eigenem Verlaufseintrag geöffnet wurden */
interface TabState { tab?: boolean }

/**
 * Zwischen Tabs wechseln wie in einer App: Vom Start aus entsteht ein Verlaufseintrag (Zurück führt zum Start),
 * zwischen den anderen Tabs wird er nur ersetzt. Zurück auf „Start“ geht den Eintrag zurück statt einen neuen anzulegen.
 */
export function goTab(path: string) {
  if (path === location.pathname) return;
  const state = history.state as TabState | null;
  if (path === "/") {
    if (state?.tab) { history.back(); return; }
    history.replaceState(null, "", "/");
  } else if (location.pathname === "/") history.pushState({ tab: true }, "", path);
  else history.replaceState(state?.tab ? { tab: true } : null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * App-Hülle für Start, Spiele, Gruppe und Profil: Inhalt über die volle Höhe, unten die Tab-Leiste –
 * auf großen Bildschirmen (Laptop, Fernseher) links als Seitenleiste.
 * Raum und lokale Partie laufen ohne Hülle im Vollbild. Admin-Geräte haben einen fünften Tab „Verwaltung“.
 */
export function AppShell({ tab, children }: { tab: Tab; children: ReactNode }) {
  return (
    <div className="flex h-dvh-safe flex-col overflow-clip lg:flex-row">
      <div key={tab} className="tab-in flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" data-testid={`tab-${tab}`}>{children}</div>
      <TabBar tab={tab} />
    </div>
  );
}

function TabBar({ tab }: { tab: Tab }) {
  const features = useSiteConfig()?.features;
  const group = useActiveGroup();
  const admin = useAdminDevice();
  const attention = useAdminAttention(admin);
  const items: { id: Tab; label: string; path: string; icon?: LucideIcon; on: boolean; dot?: boolean }[] = [
    { id: "start", label: "Start", path: "/", icon: House, on: true },
    { id: "spiele", label: "Spiele", path: "/spiele", icon: Dices, on: true },
    { id: "gruppe", label: "Gruppe", path: group ? `/g/${group.code}` : "/gruppe", icon: Users, on: features?.groups !== false },
    { id: "profil", label: "Profil", path: "/profil", on: features?.profiles !== false },
    { id: "verwaltung", label: "Verwaltung", path: "/admin", icon: ShieldCheck, on: admin, dot: attention > 0 },
  ];
  return (
    <nav aria-label="Bereiche" className="tabbar shrink-0 pb-[env(safe-area-inset-bottom)] lg:order-first lg:flex lg:w-60 lg:flex-col lg:px-3 lg:pt-6 lg:pb-4">
      <div className="mb-6 hidden items-center gap-3 px-2 lg:flex">
        <Logo className="size-10 -rotate-6 rounded-xl" />
        <span className="min-w-0"><b className="block text-lg leading-tight">Spieltisch</b><span className="block truncate text-xs text-muted-foreground">Für euren Spieleabend</span></span>
      </div>
      <ul className="mx-auto flex max-w-xl lg:mx-0 lg:max-w-none lg:flex-col lg:gap-1">
        {items.filter((i) => i.on).map(({ id, label, path, icon: Icon, dot }) => {
          const active = id === tab;
          return (
            <li key={id} className="flex-1 lg:flex-none">
              <button type="button" onClick={() => goTab(path)} aria-current={active ? "page" : undefined} data-testid={`tabbar-${id}`}
                className={cn("flex h-15 w-full flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring",
                  "lg:h-12 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-2 lg:text-[0.95rem] lg:hover:bg-accent",
                  active ? "text-primary lg:bg-primary/12" : "text-muted-foreground")}>
                <span className={cn("relative grid h-7 w-12 place-items-center rounded-full transition-colors lg:w-8", active && "bg-primary/14 lg:bg-transparent")}>
                  {dot && <span className="absolute top-0.5 right-2.5 size-2 rounded-full bg-destructive ring-2 ring-background" data-testid="admin-dot" aria-label="braucht Aufmerksamkeit" />}
                  {Icon ? <Icon className="size-5" strokeWidth={active ? 2.4 : 2} /> : <Avatar avatar={myAvatar()} className={cn("size-6 text-sm", active && "ring-2 ring-primary")} />}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
