import { setPref, usePrefs, type VolumePref } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { playCrowd, playSound } from "./sound";

const VOLUMES: [VolumePref, string][] = [["volFx", "Effekte"], ["volMusic", "Musik"], ["volCrowd", "Publikum"]];

/** Drei Regler – am Tisch und im Profil */
export function Volumes({ className }: { className?: string }) {
  const p = usePrefs();
  return (
    <div className={cn("grid gap-1.5", className)} data-testid="volumes">
      {VOLUMES.map(([key, label]) => (
        <label key={key} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-sm">
          <span>{label}</span>
          <input type="range" min={0} max={100} step={5} value={Math.round(p[key] * 100)} aria-label={label}
            onChange={(e) => setPref(key, Number(e.target.value) / 100)}
            onPointerUp={() => { if (key === "volFx") playSound("place"); if (key === "volCrowd") playCrowd("applause"); }}
            className="h-6 w-full accent-[#ff7a59]" />
        </label>
      ))}
    </div>
  );
}
