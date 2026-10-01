import { createContext, useContext } from "react";
import { AVATAR_COLORS, AVATAR_EMOJIS, type Avatar as AvatarData } from "@shared/platform/group";
import { cn } from "@/lib/utils";

/** Avatare der Spieler im Raum – die Punkteleiste der Spiele liest sie hier, ohne dass jedes Spiel sie durchreicht */
export const AvatarContext = createContext<Record<string, AvatarData> | undefined>(undefined);
export const useRoomAvatar = (playerId: string) => useContext(AvatarContext)?.[playerId];

/** Rundes Profilbild: Emoji auf Farbe. Ohne Avatar der Anfangsbuchstabe auf Marineblau. */
export function Avatar({ avatar, name, className }: { avatar?: AvatarData | null; name?: string; className?: string }) {
  const bg = avatar ? AVATAR_COLORS[avatar.color] : undefined;
  return (
    <span aria-hidden="true" style={bg ? { backgroundColor: bg } : undefined}
      className={cn("inline-grid size-8 shrink-0 select-none place-items-center rounded-full leading-none",
        avatar ? "text-[1.05em]" : "bg-navy-700 text-[0.8em] font-bold text-navy-200", className)}>
      {avatar ? AVATAR_EMOJIS[avatar.emoji] : (name?.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Auswahl: Farbe und Emoji */
export function AvatarPicker({ value, onChange }: { value: AvatarData; onChange: (a: AvatarData) => void }) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Farbe">
        {AVATAR_COLORS.map((c, i) => (
          <button key={c} type="button" role="radio" aria-checked={value.color === i} aria-label={`Farbe ${i + 1}`}
            onClick={() => onChange({ ...value, color: i })} style={{ backgroundColor: c }}
            className={cn("aspect-square rounded-full outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
              value.color === i ? "ring-[3px] ring-foreground/80 ring-offset-2 ring-offset-background" : "opacity-85")} />
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Emoji">
        {AVATAR_EMOJIS.map((e, i) => (
          <button key={e} type="button" role="radio" aria-checked={value.emoji === i} aria-label={`Emoji ${e}`}
            onClick={() => onChange({ ...value, emoji: i })}
            className={cn("grid aspect-square place-items-center rounded-xl text-2xl outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
              value.emoji === i ? "bg-primary/14 ring-1 ring-inset ring-primary/40" : "bg-navy-950/40")}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
