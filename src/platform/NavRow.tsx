import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Eine Zeile, die woanders hinführt: Symbol, Titel, eine Zeile darunter, Pfeil.
 * `tile`: Symbol auf getönter Kachel (Einstiege wie „Ein Handy für alle“), sonst schlicht (Einstellungen, Gruppe).
 * `outline`: ohne Glas, nur Rahmen – für Listen in Blättern (Menü).
 */
export function NavRow({ icon: Icon, tile, outline, title, sub, className, children, ...rest }: {
  icon?: LucideIcon;
  tile?: boolean;
  outline?: boolean;
  title: ReactNode;
  sub?: ReactNode;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title">) {
  return (
    <button type="button" {...rest}
      className={cn("flex w-full items-center gap-3 text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
        outline ? "rounded-xl px-3 py-2.5 ring-1 ring-inset ring-border active:bg-accent" : "glass rounded-2xl px-3.5 py-2.5 active:scale-[0.99]", className)}>
      {Icon && (tile
        ? <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Icon className="size-5" /></span>
        : <Icon className={cn("size-4.5 shrink-0", outline ? "text-muted-foreground" : "text-primary")} />)}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate font-semibold">{title}</span>
        {sub && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      {children}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
