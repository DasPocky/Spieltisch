import type { ReactNode } from "react";
import { Activity, BarChart3, Dices, Settings2, Users, Wrench, type LucideIcon } from "lucide-react";
import { navigate, type AdminSection } from "@/hooks/useRoute";
import { useDev } from "@/lib/dev";
import { NavRow } from "@/platform/NavRow";

export type { AdminSection };

export const SECTIONS: { id: Exclude<AdminSection, "start">; title: string; icon: LucideIcon; desc: string }[] = [
  { id: "live", title: "Live", icon: Activity, desc: "Offene Räume, Dauerräume, wer gerade da ist" },
  { id: "statistik", title: "Statistik", icon: BarChart3, desc: "Partien, beliebte Spiele, Spitzenzeiten" },
  { id: "spiele", title: "Spiele", icon: Dices, desc: "Freigaben, Standards, Neu und Reihenfolge" },
  { id: "leute", title: "Leute", icon: Users, desc: "Verlauf, Gruppen und Profile" },
  { id: "einstellungen", title: "Einstellungen", icon: Settings2, desc: "Aussehen, Zugang, Funktionen, Daten" },
  { id: "entwickler", title: "Entwickler", icon: Wrench, desc: "Testräume mit Bots, Diagnose, Netz, Abläufe" },
];

/** Bereiche dieses Geräts – „Entwickler“ nur im Entwickler-Modus */
export function useSections() {
  const on = useDev().on;
  return SECTIONS.filter((s) => s.id !== "entwickler" || on);
}

export const goSection = (s: AdminSection) => navigate(s === "start" ? "/admin" : `/admin/${s}`);

/** Eine Kachel auf dem Admin-Start: Bereich mit einer Zeile Live-Info */
export function SectionTile({ id, info }: { id: Exclude<AdminSection, "start">; info?: ReactNode }) {
  const s = SECTIONS.find((x) => x.id === id)!;
  return <NavRow icon={s.icon} tile title={s.title} sub={info ?? s.desc} onClick={() => goSection(id)} data-testid={`admin-tile-${id}`} />;
}
