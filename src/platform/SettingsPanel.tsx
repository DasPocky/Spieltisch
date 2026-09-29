import { Minus, Plus } from "lucide-react";
import type { RoomAction, RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import type { EntryMode, SettingDef } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, fmt } from "@/lib/utils";
import { Segmented } from "./Segmented";

const ENTRY_OPTIONS = [
  { value: "turn", label: "Wer dran ist", hint: "am eigenen Handy" },
  { value: "all", label: "Alle", hint: "jeder für jeden" },
  { value: "host", label: "Nur Host", hint: "einer für alle" },
] as const satisfies readonly { value: EntryMode; label: string; hint: string }[];

/**
 * Einstellungen des Raums, erzeugt aus der Beschreibung im Spiel-Modul.
 * Ändern darf nur der Host (lokal: jeder), alle anderen sehen sie.
 */
export function SettingsPanel({ room, editable, online, dispatch, className }: {
  room: RoomState; editable: boolean; online: boolean; dispatch: (a: RoomAction) => void; className?: string;
}) {
  const logic = getGame(room.gameId);
  const playing = room.phase === "playing";
  return (
    <section className={cn("grid gap-4", className)}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Einstellungen</h3>
        {!editable && <span className="text-xs text-muted-foreground">legt der Host fest</span>}
      </div>
      {logic.settings.map((def) => (
        <Setting key={def.key} def={def} value={room.options[def.key]} editable={editable && (!playing || !!def.inGame)}
          onChange={(value) => dispatch({ type: "setOption", key: def.key, value })} />
      ))}
      {online && logic.turnBased && (
        <Segmented label="Wer darf für den Spieler am Zug handeln?" value={room.entry} editable={editable} options={ENTRY_OPTIONS}
          onChange={(mode) => dispatch({ type: "setEntry", mode })} />
      )}
    </section>
  );
}

function Setting({ def, value, editable, onChange }: { def: SettingDef; value: unknown; editable: boolean; onChange: (v: string | number | boolean) => void }) {
  switch (def.type) {
    case "choice":
      return <Segmented label={def.label} value={String(value ?? def.default)} options={def.choices} editable={editable} onChange={onChange} />;
    case "number": {
      const n = Number(value ?? def.default);
      return (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{def.label}</span>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" disabled={!editable || n <= def.min} aria-label={`${def.label} verringern`} onClick={() => onChange(n - def.step)}><Minus /></Button>
            <b className="min-w-[5.5ch] text-center text-lg tabular-nums">{fmt(n)}</b>
            <Button variant="secondary" size="icon" disabled={!editable || n >= def.max} aria-label={`${def.label} erhöhen`} onClick={() => onChange(n + def.step)}><Plus /></Button>
          </div>
        </div>
      );
    }
    case "toggle":
      return (
        <label className="flex items-center gap-3 text-sm">
          <Checkbox checked={value === true} disabled={!editable} onCheckedChange={(c) => onChange(c === true)} />
          <span><span className="font-semibold">{def.label}</span>{def.hint && <span className="block text-xs text-muted-foreground">{def.hint}</span>}</span>
        </label>
      );
  }
}
