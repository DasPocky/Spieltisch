import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import {
  ADMISSION_LABEL, ADMISSIONS, HOST_LIVES, LIFE_LABEL, LIFE_MS, MAX_ROOM_NAME, VISIBILITIES, VISIBILITY_LABEL,
  type RoomAccess,
} from "@shared/platform/directory";
import { Segmented } from "./Segmented";

const VIS_HINT = { all: "in der Liste", group: "nur eure Gruppe", none: "nur mit Code" } as const;
const ADM_HINT = { pin: "rein mit PIN", knock: "PIN, dann einlassen" } as const;

/** Kurzfassung für eine Zeile, z. B. „Alle · PIN · 1 Stunde“ */
export const accessSummary = (a: RoomAccess) =>
  [VISIBILITY_LABEL[a.visibility], a.admission === "knock" ? "Anklopfen" : "PIN", LIFE_LABEL[a.life]].join(" · ");

/**
 * Raumname, Sichtbarkeit, Einlass, Lebensdauer – beim Erstellen („Mehr“) und für den Host im Raum.
 * Lebensdauern über der Obergrenze des Admins fallen weg; Dauerräume (vom Admin) behalten ihre.
 */
export function RoomAccessForm({ value, onChange, editable = true, idPrefix = "room" }: {
  value: RoomAccess; onChange: (a: RoomAccess) => void; editable?: boolean; idPrefix?: string;
}) {
  const maxHours = useSiteConfig()?.limits.roomHours ?? 168;
  const lives = HOST_LIVES.filter((l) => LIFE_MS[l] <= maxHours * 3_600_000);
  const set = (patch: Partial<RoomAccess>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3.5" data-testid="room-access">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Raumname (optional)</Label>
        <Input id={`${idPrefix}-name`} value={value.name ?? ""} onChange={(e) => set({ name: e.target.value.slice(0, MAX_ROOM_NAME) })} disabled={!editable}
          maxLength={MAX_ROOM_NAME} placeholder="z. B. Donnerstagsrunde" autoComplete="off" />
      </div>
      <Segmented label="Sichtbar für" value={value.visibility} editable={editable} onChange={(v) => set({ visibility: v })}
        options={VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_LABEL[v], hint: VIS_HINT[v] }))} />
      <Segmented label="Einlass" value={value.admission} editable={editable} onChange={(v) => set({ admission: v })}
        options={ADMISSIONS.map((v) => ({ value: v, label: v === "knock" ? "Anklopfen" : ADMISSION_LABEL[v], hint: ADM_HINT[v] }))} />
      {value.life === "forever" ? (
        <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm"><b>Dauerraum</b> – bleibt bestehen, auch wenn niemand drin ist.</p>
      ) : lives.length > 1 && (
        <Segmented label="Leer noch offen für" value={lives.includes(value.life as never) ? value.life : lives[lives.length - 1]} editable={editable}
          onChange={(v) => set({ life: v })} options={lives.map((l) => ({ value: l, label: LIFE_LABEL[l] }))} />
      )}
    </div>
  );
}
