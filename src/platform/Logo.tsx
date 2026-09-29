import { cn } from "@/lib/utils";

/** Marken-Symbol von Spieltisch: Würfel vor einer Karte. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("grid size-9 place-items-center rounded-xl bg-gradient-to-br from-navy-400 to-navy-700 shadow-lg ring-1 ring-white/15", className)}>
      <svg viewBox="0 0 40 40" className="size-[72%]" aria-hidden="true">
        <rect x="17" y="5" width="17" height="24" rx="3.5" transform="rotate(12 25 17)" fill="#bcd3f5" opacity="0.9" />
        <rect x="6" y="13" width="20" height="20" rx="5" fill="#fdfdfb" />
        {[[11, 18], [21, 18], [16, 23], [11, 28], [21, 28]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.9" fill="#1f437f" />)}
      </svg>
    </div>
  );
}

/** Rahmen für ein Spiel-Symbol in Kacheln und Kopfzeile */
export function IconTile({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-navy-500 to-navy-700 shadow-lg ring-1 ring-white/15", className)}>
      {children}
    </div>
  );
}
