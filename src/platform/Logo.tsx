import { cn } from "@/lib/utils";

/** Marken-Symbol von Spieltisch: das App-Icon im EndLab-Look (public/icons/icon.svg) */
export function Logo({ className }: { className?: string }) {
  return <img src="/icons/icon.svg" alt="" aria-hidden="true" className={cn("size-9 rounded-xl shadow-sm", className)} />;
}

/** Rahmen für ein Spiel-Symbol in Kacheln und Kopfzeile */
export function IconTile({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-deep-500 to-deep-700 shadow-sm", className)}>
      {children}
    </div>
  );
}
