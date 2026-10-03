import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import type { RoomAction, RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import { getGameUI } from "@/games";
import type { EntryMode, SettingDef } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, fmt } from "@/lib/utils";
import { Segmented } from "./Segmented";
import { DeckPicker } from "./cards/DeckPicker";

/** Spiele mit Spielhilfen (siehe useHints) */
export const HINT_GAMES = new Set(["uno", "maumau", "phase10", "skipbo", "skyjo", "kniffel", "flip7", "tutto"]);

const ENTRY_OPTIONS = [
  { value: "turn", label: "Wer dran ist", hint: "am eigenen Handy" },
  { value: "all", label: "Alle", hint: "jeder für jeden" },
  { value: "host", label: "Nur Host", hint: "einer für alle" },
] as const satisfies readonly { value: EntryMode; label: string; hint: string }[];

/** Name der Gruppe mit Raum-Optionen – „Raum“ heißt nur der Online-Raum, daher lokal nur „Hilfen“ */
function extraTitle(hints: boolean, entry: boolean) {
  return hints && entry ? "Mitspielen & Hilfen" : entry ? "Mitspielen" : "Hilfen";
}

/**
 * Kurzfassung der Einstellungen für die Lobby, z. B. „App-Karten · Spielziel 6.000 · 2 Hausregeln“.
 * Grundeinstellungen mit ihrem Wert, Gruppen nur, wenn etwas vom Standard abweicht.
 */
export function settingsSummary(room: RoomState, online: boolean): string {
  const logic = getGame(room.gameId);
  const shown = logic.settings.filter((def) => !def.showIf || def.showIf(room.options));
  const parts: string[] = [];
  for (const def of shown.filter((d) => !d.group)) {
    const v = room.options[def.key] ?? def.default;
    if (def.type === "choice") { const c = def.choices.find((x) => x.value === String(v)); if (c) parts.push(c.label); }
    else if (def.type === "number") parts.push(`${def.label} ${fmt(Number(v))}`);
    else if (v === true && def.label.length <= 22) parts.push(def.label);
  }
  for (const g of new Set(shown.map((d) => d.group).filter((x): x is string => !!x))) {
    const n = shown.filter((d) => d.group === g && changedFrom(d, room.options[d.key])).length;
    if (n) parts.push(/Hausregel/.test(g) ? `${n} ${n === 1 ? "Hausregel" : "Hausregeln"}` : `${g}: ${n} geändert`);
  }
  if (online && logic.turnBased && !logic.ownTurnsOnly && room.entry !== "turn") parts.push(room.entry === "all" ? "Alle tippen" : "Nur Host tippt");
  if (HINT_GAMES.has(room.gameId) && room.noHints) parts.push("Hilfen aus");
  return parts.join(" · ") || "Wie im Original";
}

/**
 * Einstellungen des Raums, erzeugt aus der Beschreibung im Spiel-Modul.
 * Ändern darf nur der Host (lokal: jeder), alle anderen sehen sie.
 * `inGame`: nur was sich während der Partie ändern lässt (fürs Menü), ohne Gruppen.
 */
export function SettingsPanel({ room, editable, online, dispatch, className, inGame = false, title = true }: {
  room: RoomState; editable: boolean; online: boolean; dispatch: (a: RoomAction) => void; className?: string;
  inGame?: boolean; title?: boolean;
}) {
  const logic = getGame(room.gameId);
  const Extra = getGameUI(room.gameId).SettingsExtra;
  const playing = room.phase === "playing";
  const shown = logic.settings.filter((def) => (!def.showIf || def.showIf(room.options)) && (!inGame || def.inGame));
  const entryChoice = online && logic.turnBased && !logic.ownTurnsOnly && !inGame;
  const hints = HINT_GAMES.has(room.gameId);
  const groups = inGame ? [] : [...new Set(shown.map((d) => d.group).filter((g): g is string => !!g))];
  const setting = (def: SettingDef) => (
    <Setting key={def.key} def={def} value={room.options[def.key]} editable={editable && (!playing || !!def.inGame)}
      onChange={(value) => dispatch({ type: "setOption", key: def.key, value })} />
  );
  const hintBox = hints && (
    <label className="flex items-center gap-3 text-sm">
      <Checkbox checked={!room.noHints} disabled={!editable} onCheckedChange={(c) => dispatch({ type: "setHints", on: c === true })} />
      <span><span className="font-semibold">Spielhilfen erlauben</span><span className="block text-xs text-muted-foreground">Leuchten bei passenden Karten und Würfeln – nur für den Spieler am Zug. Aus: für alle aus, egal was jeder für sich eingestellt hat.</span></span>
    </label>
  );
  return (
    <section className={cn("grid gap-4", className)}>
      {title && (
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Einstellungen</h3>
          {!editable && <span className="text-xs text-muted-foreground">legt der Host fest</span>}
        </div>
      )}
      {Extra && !inGame && <Extra room={room} editable={editable && !playing} online={online} dispatch={dispatch} />}
      {/* Grundeinstellungen immer sichtbar, Gruppen einklappbar (Hausregeln anfangs zu) */}
      {shown.filter((def) => inGame || !def.group).map(setting)}
      {groups.map((g) => (
        <Group key={g} title={g} storeKey={`${room.gameId}:${g}`} changed={shown.filter((d) => d.group === g && changedFrom(d, room.options[d.key])).length}>
          {shown.filter((d) => d.group === g).map(setting)}
        </Group>
      ))}
      {inGame ? hintBox : (entryChoice || hints) && (
        <Group title={extraTitle(hints, entryChoice)} storeKey="raum" changed={(entryChoice && room.entry !== "turn" ? 1 : 0) + (room.noHints ? 1 : 0)}>
          {hintBox}
          {entryChoice && (
            <Segmented label="Wer darf für den Spieler am Zug handeln?" value={room.entry} editable={editable} options={ENTRY_OPTIONS}
              onChange={(mode) => dispatch({ type: "setEntry", mode })} />
          )}
        </Group>
      )}
    </section>
  );
}

/** Gibt es während der Partie etwas einzustellen? */
export function hasInGameSettings(room: RoomState): boolean {
  return HINT_GAMES.has(room.gameId) || getGame(room.gameId).settings.some((d) => d.inGame && (!d.showIf || d.showIf(room.options)));
}

const changedFrom = (def: SettingDef, value: unknown) => value !== undefined && value !== def.default;

/** Einklappbare Gruppe – merkt sich auf dem Gerät, ob sie offen ist; zeigt, wie viel vom Standard abweicht */
function Group({ title, storeKey, changed, children }: { title: string; storeKey: string; changed: number; children: ReactNode }) {
  const key = `spieltisch:group:${storeKey}`;
  // Hausregeln und Raum-Optionen starten eingeklappt, Wichtiges (Ablauf, Rollen) offen
  const initial = !/Hausregeln|Hilfen|Mitspielen/.test(title);
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem(key); return v === null ? initial : v === "1"; } catch { return initial; } });
  const toggle = () => { setOpen(!open); try { localStorage.setItem(key, open ? "0" : "1"); } catch { /* egal */ } };
  return (
    <div className="rounded-xl ring-1 ring-inset ring-border">
      <button type="button" onClick={toggle} aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring rounded-xl">
        <span className="flex-1">{title}</span>
        {changed > 0 && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">{changed} geändert</span>}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="text-in grid gap-4 px-3 pt-1 pb-3">{children}</div>}
    </div>
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
