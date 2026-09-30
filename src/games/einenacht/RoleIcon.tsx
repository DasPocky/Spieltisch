import { Axe, Beer, Coffee, Crosshair, Eye, Handshake, HatGlasses, House, PawPrint, Shuffle, VenetianMask, type LucideIcon } from "lucide-react";
import type { ONRole } from "@shared/games/einenacht/logic";
import { cn } from "@/lib/utils";

/** Einfarbiges Symbol je Karte – gleiche Bildsprache wie beim großen Werwolf */
export const ON_ROLE_ICON: Record<ONRole, LucideIcon> = {
  werwolf: PawPrint, guenstling: HatGlasses, freimaurer: Handshake, seherin: Eye, raeuber: VenetianMask, unruhestifter: Shuffle,
  betrunkener: Beer, schlaflose: Coffee, jaeger: Crosshair, gerber: Axe, dorf: House,
};

export function RoleIcon({ role, className }: { role: ONRole; className?: string }) {
  const Icon = ON_ROLE_ICON[role];
  return <Icon aria-hidden="true" className={cn("inline size-4 shrink-0 align-[-3px]", className)} />;
}
