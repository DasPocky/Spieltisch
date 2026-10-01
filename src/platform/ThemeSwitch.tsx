import { Monitor, Moon, Sun } from "lucide-react";
import { setTheme, useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: [ThemeChoice, string, typeof Sun][] = [["light", "Hell", Sun], ["dark", "Dunkel", Moon], ["system", "Wie Handy", Monitor]];

/** Darstellung umschalten: hell, dunkel oder wie das Handy */
export function ThemeSwitch({ className }: { className?: string }) {
  const choice = useTheme();
  return (
    <div className={cn("grid grid-cols-3 gap-1 rounded-xl bg-navy-950/50 p-1 ring-1 ring-inset ring-border", className)} role="radiogroup" aria-label="Darstellung">
      {OPTIONS.map(([value, label, Icon]) => (
        <button key={value} type="button" role="radio" aria-checked={choice === value} onClick={() => setTheme(value)}
          className={cn("flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
            choice === value ? "bg-navy-600 shadow-sm" : "text-muted-foreground")}>
          <Icon className="size-4" />{label}
        </button>
      ))}
    </div>
  );
}

/** Kleiner Knopf (Startseite): wechselt zwischen hell und dunkel */
export function ThemeToggle({ className }: { className?: string }) {
  const choice = useTheme();
  const dark = choice === "dark" || (choice === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button type="button" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Helle Darstellung" : "Dunkle Darstellung"}
      className={cn("grid size-11 shrink-0 place-items-center rounded-full bg-secondary ring-1 ring-inset ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
