import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { RoomAction, RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import type { EntryMode, SettingDef } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, fmt } from "@/lib/utils";
import { Segmented } from "./Segmented";
import { DeckPicker } from "./cards/DeckPicker";

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
      {logic.settings.filter((def) => !def.showIf || def.showIf(room.options)).map((def, i, shown) => (
        <div key={def.key} className="grid gap-4">
          {def.group && def.group !== shown[i - 1]?.group && (
            <h4 className="-mb-1 border-t border-border pt-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">{def.group}</h4>
          )}
          <Setting def={def} value={room.options[def.key]} editable={editable && (!playing || !!def.inGame)}
            onChange={(value) => dispatch({ type: "setOption", key: def.key, value })} />
        </div>
      ))}
      {online && logic.turnBased && !logic.ownTurnsOnly && (
        <Segmented label="Wer darf für den Spieler am Zug handeln?" value={room.entry} editable={editable} options={ENTRY_OPTIONS}
          onChange={(mode) => dispatch({ type: "setEntry", mode })} />
      )}
    </section>
  );
}

function Setting({ def, value, editable, onChange }: { def: SettingDef; value: unknown; editable: boolean; onChange: (v: string | number | boolean) => void }) {
  switch (def.type) {
    case "choice":
      if (def.visual === "deck") return <DeckPicker label={def.label} value={String(value ?? def.default)} options={def.choices} editable={editable} onChange={onChange} />;
      return <Segmented label={def.label} value={String(value ?? def.default)} options={def.choices} editable={editable} onChange={onChange} />;
    case "number":
      return <NumberSetting def={def} value={Number(value ?? def.default)} editable={editable} onChange={onChange} />;
    case "toggle":
      return (
        <label className="flex items-center gap-3 text-sm">
          <Checkbox checked={value === true} disabled={!editable} onCheckedChange={(c) => onChange(c === true)} />
          <span><span className="font-semibold">{def.label}</span>{def.hint && <span className="block text-xs text-muted-foreground">{def.hint}</span>}</span>
        </label>
      );
  }
}

/**
 * Zahl mit −/+. Online dauert die Bestätigung des Servers einen Moment – damit schnelles Tippen
 * nicht mehrfach denselben alten Wert schickt, zählt die Anzeige sofort lokal weiter.
 */
function NumberSetting({ def, value, editable, onChange }: { def: Extract<SettingDef, { type: "number" }>; value: number; editable: boolean; onChange: (v: number) => void }) {
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => { if (pending === value) setPending(null); }, [value, pending]);
  // Kommt eine andere Antwort (z. B. abgelehnt), nach kurzer Zeit wieder dem Server glauben
  useEffect(() => {
    if (pending === null) return;
    const t = setTimeout(() => setPending(null), 3000);
    return () => clearTimeout(t);
  }, [pending]);
  const n = pending ?? value;
  const set = (v: number) => { setPending(v); onChange(v); };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">{def.label}</span>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="icon" disabled={!editable || n <= def.min} aria-label={`${def.label} verringern`} onClick={() => set(n - def.step)}><Minus /></Button>
        <b className="min-w-[5.5ch] text-center text-lg tabular-nums" data-testid={`setting-${def.key}`}>{fmt(n)}</b>
        <Button variant="secondary" size="icon" disabled={!editable || n >= def.max} aria-label={`${def.label} erhöhen`} onClick={() => set(n + def.step)}><Plus /></Button>
      </div>
    </div>
  );
}
