import {
  Baby, BedDouble, Bird, Crosshair, Dog, Eye, Feather, FlaskConical, Footprints, Heart, Hourglass, House, Laugh,
  MoonStar, Music, PawPrint, Scale, Search, Shield, Skull, Snowflake, Sword, Users, VenetianMask, type LucideIcon,
} from "lucide-react";
import type { Role } from "@shared/games/werwolf/logic";
import { cn } from "@/lib/utils";

/** Einheitliches, einfarbiges Symbol je Rolle (statt Emojis) */
export const ROLE_ICON: Record<Role, LucideIcon> = {
  werwolf: PawPrint, urwolf: MoonStar, grosserwolf: Skull, weisserwolf: Snowflake,
  dorf: House, seherin: Eye, hexe: FlaskConical, jaeger: Crosshair, amor: Heart, beschuetzer: Shield, alter: Hourglass,
  dorfdepp: Laugh, suendenbock: Scale, wildeskind: Baby, wolfshund: Dog, fuchs: Search, baerenfuehrer: Footprints,
  ritter: Sword, schwester: Users, rabe: Bird, schlampe: BedDouble, dieb: VenetianMask, floetenspieler: Music, engel: Feather,
};

export function RoleIcon({ role, className }: { role: Role; className?: string }) {
  const Icon = ROLE_ICON[role];
  return <Icon aria-hidden="true" className={cn("inline size-4 shrink-0 align-[-3px]", className)} />;
}
