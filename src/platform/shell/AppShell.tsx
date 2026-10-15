import type { ReactNode } from "react";
import { Dices, House, Users, type LucideIcon } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useActiveGroup } from "@/lib/group";
import { myAvatar } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Avatar } from "@/platform/Avatar";

export type Tab = "start" | "spiele" | "gruppe" | "profil";

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
 * App-Hülle für Start, Spiele, Gruppe und Profil: Inhalt über die volle Höhe, unten die Tab-Leiste.
 * Raum, lokale Partie und Admin laufen ohne Hülle im Vollbild.
 */
export function AppShell({ tab, children }: { tab: Tab; children: ReactNode }) {
  return (
    <div className="flex h-dvh-safe flex-col">
      <div key={tab} className="tab-in flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" data-testid={`tab-${tab}`}>{children}</div>
      <TabBar tab={tab} />
    </div>
  );
}

function TabBar({ tab }: { tab: Tab }) {
  const features = useSiteConfig()?.features;
  const group = useActiveGroup();
  const items: { id: Tab; label: string; path: string; icon?: LucideIcon; on: boolean }[] = [
    { id: "start", label: "Start", path: "/", icon: House, on: true },
    { id: "spiele", label: "Spiele", path: "/spiele", icon: Dices, on: true },
    { id: "gruppe", label: "Gruppe", path: group ? `/g/${group.code}` : "/gruppe", icon: Users, on: features?.groups !== false },
    { id: "profil", label: "Profil", path: "/profil", on: features?.profiles !== false },
  ];
  return (
    <nav aria-label="Bereiche" className="tabbar shrink-0 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl">
        {items.filter((i) => i.on).map(({ id, label, path, icon: Icon }) => {
          const active = id === tab;
          return (
            <li key={id} className="flex-1">
              <button type="button" onClick={() => goTab(path)} aria-current={active ? "page" : undefined} data-testid={`tabbar-${id}`}
                className={cn("flex h-15 w-full flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground")}>
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-primary/14")}>
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
