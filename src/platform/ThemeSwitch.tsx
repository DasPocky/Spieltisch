import { Monitor, Moon, Sun } from "lucide-react";
import { setTheme, useTheme, type ThemeChoice } from "@/lib/theme";
import { Segmented, type SegmentOption } from "./Segmented";

const OPTIONS: SegmentOption<ThemeChoice>[] = [
  { value: "light", label: "Hell", icon: Sun }, { value: "dark", label: "Dunkel", icon: Moon }, { value: "system", label: "Wie Handy", icon: Monitor },
];

/** Darstellung umschalten: hell, dunkel oder wie das Handy */
export function ThemeSwitch({ className }: { className?: string }) {
  return <Segmented ariaLabel="Darstellung" value={useTheme()} options={OPTIONS} small className={className} onChange={setTheme} />;
}
