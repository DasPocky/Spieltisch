import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
}

/**
 * Auswahl mit 2–4 Optionen – überall gleich: Einstellungen, Menü, Darstellung, Stimme, Kartenblatt.
 * `small`: niedriger, Hinweis in derselben Zeile. `render`: eigener Inhalt je Option (z. B. Kartenvorschau).
 */
export function Segmented<T extends string>({ label, ariaLabel, value, options, editable = true, small, className, render, onChange }: {
  label?: string;
  /** Name für Screenreader, wenn kein sichtbares Label darüber steht */
  ariaLabel?: string;
  value: T;
  options: readonly SegmentOption<T>[];
  editable?: boolean;
  small?: boolean;
  className?: string;
  render?: (o: SegmentOption<T>, on: boolean) => ReactNode;
  onChange: (v: T) => void;
}) {
  // Viele Optionen: Spalten nach dem längsten Wort verteilen, damit nichts über den Rand läuft („nach Spielerzahl“)
  const cols = options.length < 4 ? `repeat(${options.length}, minmax(0, 1fr))`
    : options.map((o) => `minmax(0, ${Math.max(6, o.label.length * 1.4 + 2, ...(o.hint ?? "").split(" ").map((w) => w.length))}fr)`).join(" ");
  return (
    <div className={className}>
      {label && <div className="mb-2 text-sm font-semibold">{label}</div>}
      <div className="grid gap-1 rounded-xl bg-navy-950/50 p-1 ring-1 ring-inset ring-border" style={{ gridTemplateColumns: cols }} role="radiogroup" aria-label={label ?? ariaLabel}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} disabled={!editable}
              onClick={() => !on && onChange(o.value)}
              className={cn("rounded-lg px-1.5 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                small ? "py-2" : "py-2.5",
                on ? "bg-primary/14 text-primary ring-1 ring-inset ring-primary/35" : "text-muted-foreground")}>
              {render ? render(o, on) : small ? (
                <span className="flex items-center justify-center gap-1.5 text-sm">
                  {o.icon && <o.icon className="size-4" />}
                  <span className="font-semibold">{o.label}</span>
                  {o.hint && <span className={cn("text-xs", on ? "text-primary/80" : "text-muted-foreground")}>· {o.hint}</span>}
                </span>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-1.5 text-sm font-semibold">{o.icon && <o.icon className="size-4" />}{o.label}</div>
                  {o.hint && <div className={cn("mt-0.5 text-xs leading-tight", on ? "text-primary/80" : "text-muted-foreground")}>{o.hint}</div>}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
