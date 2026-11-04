import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
import { kindOfGame } from "@shared/platform/cardsets";
import { SetPicker, setsFor } from "./SetPicker";
import { siteConfigNow } from "@/hooks/useSiteConfig";
import { changedRules, currentPreset, presetKeys, presetsOf } from "@shared/platform/presets";

/** Spiele mit Spielhilfen (siehe useHints) */
export const HINT_GAMES = new Set(["eins", "maumau", "zehnphasen", "stapelbau", "himmelskarten", "fuenfwuerfel", "glueckssieben", "alles", "herzen", "schocken", "bluff", "ankreuzspiel", "palast", "zahlenromme", "doppelkopf"]);

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
  const shown = logic.settings.filter((def) => (!def.showIf || def.showIf(room.options)) && def.key !== "own_only");
  const parts: string[] = [];
  for (const def of shown.filter((d) => !d.group)) {
    const v = room.options[def.key] ?? def.default;
    if (def.type === "choice") { const c = def.choices.find((x) => x.value === String(v)); if (c) parts.push(c.label); }
    else if (def.type === "number") parts.push(`${def.label} ${fmt(Number(v))}`);
    else if (v === true && def.label.length <= 22) parts.push(def.label);
  }
  // Ein Regelpaket wie „Kurz“ steht mit Namen da, seine Hausregeln zählen nicht extra
  const preset = currentPreset(logic, room.options, room.players.length);
  const named = preset && preset !== "standard" ? logic.presets?.find((p) => p.id === preset) : undefined;
  if (named) parts.push(`Regeln: ${named.label}`);
  const covered = new Set(named ? presetKeys(logic) : []);
  for (const g of new Set(shown.map((d) => d.group).filter((x): x is string => !!x))) {
    const n = shown.filter((d) => d.group === g && !covered.has(d.key) && changedFrom(d, room.options[d.key])).length;
    if (n) parts.push(/Hausregel/.test(g) ? `${n} ${n === 1 ? "Hausregel" : "Hausregeln"}` : `${g}: ${n} geändert`);
  }
  if (online && logic.turnBased && !logic.ownTurnsOnly && room.entry !== "turn") parts.push(room.entry === "all" ? "Alle tippen" : "Nur Host tippt");
  if (HINT_GAMES.has(room.gameId) && room.noHints) parts.push("Hilfen aus");
  const own = setsFor(room, kindOfGame(room.gameId)).length;
  if (own) parts.push(`${own} eigene${own === 1 ? "s Set" : " Sets"}${room.options.own_only === true ? " (nur eigene)" : ""}`);
  return parts.join(" · ") || "Wie im Original";
}

/**
 * Einstellungen des Raums, erzeugt aus der Beschreibung im Spiel-Modul.
 * Ändern darf nur der Host (lokal: jeder), alle anderen sehen sie.
 * `inGame`: nur was sich während der Partie ändern lässt (fürs Menü), ohne Gruppen.
 */
export function SettingsPanel({ room, editable, online, dispatch, className, inGame = false, title = true, presets = true, fit = false }: {
  room: RoomState; editable: boolean; online: boolean; dispatch: (a: RoomAction) => void; className?: string;
  inGame?: boolean; title?: boolean;
  /** Regelpakete zeigen (nicht in der Verwaltung: dort zählen die einzelnen Standards) */
  presets?: boolean;
  /**
   * Im Blatt ohne Scrollen: ragt der Inhalt über den Rahmen (das Elternelement), klappt das Panel beim Öffnen Bereiche ein –
   * erst Gruppen von unten, dann eigene Sets, Vorschläge und Grundeinstellungen; reicht das nicht, stehen die
   * eingeklappten Bereiche als kleine Knöpfe nebeneinander. Sobald jemand einen Bereich öffnet oder schließt, bleibt alles, wie es ist.
   */
  fit?: boolean;
}) {
  const logic = getGame(room.gameId);
  const ui = getGameUI(room.gameId);
  const Extra = ui.SettingsExtra;
  const playing = room.phase === "playing";
  const setKind = siteConfigNow()?.features.sets === false ? null : kindOfGame(room.gameId);
  // „Nur eigene …“ steht bei der Auswahl der eigenen Sets
  const ownDef = setKind ? logic.settings.find((d) => d.key === "own_only") : undefined;
  const shown = logic.settings.filter((def) => (!def.showIf || def.showIf(room.options)) && (!inGame || def.inGame) && def !== ownDef);
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
  // Selbst einklappen, solange niemand etwas angefasst hat (nur mit `fit`)
  const root = useRef<HTMLElement>(null);
  const [auto, setAuto] = useState<{ game: string; closed: string[]; pills: boolean; touched: boolean }>({ game: room.gameId, closed: [], pills: false, touched: false });
  const fold = fit && auto.game === room.gameId ? auto : { game: room.gameId, closed: [] as string[], pills: false, touched: false };
  const extraGroup = !inGame && (entryChoice || hints);
  const order = [...(extraGroup ? ["raum"] : []), ...[...groups].reverse(), "sets", "extra", "basics"];
  // Nur gleich beim Öffnen einklappen (kurzes Fenster) – danach springt nichts mehr von selbst
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!fit) return;
    const t = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(t);
  }, [fit]);
  useLayoutEffect(() => {
    const el = root.current, box = el?.parentElement;
    if (!fit || fold.touched || settled || !el || !box) return;
    const check = () => {
      if (box.scrollHeight <= box.clientHeight + 1) return;
      const next = order.find((k) => {
        if (fold.closed.includes(k)) return false;
        const sec = [...el.querySelectorAll<HTMLElement>("[data-sec]")].find((x) => x.dataset.sec === k);
        return sec?.dataset.open === "true" && sec.offsetHeight > 0;
      });
      if (next) setAuto({ ...fold, closed: [...fold.closed, next] });
      else if (!fold.pills) setAuto({ ...fold, pills: true });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el); ro.observe(box);
    return () => ro.disconnect();
  });
  const touch = (sec: string) => setAuto({ ...fold, touched: true, closed: fold.closed.filter((k) => k !== sec) });
  const folding = (sec: string) => ({ sec, autoClosed: fold.closed.includes(sec), pill: fold.pills, onTouch: fit ? () => touch(sec) : undefined });

  return (
    <section ref={root} className={cn("grid", fit ? "gap-3" : "gap-4", className)} data-fit={fit ? (settled || fold.touched ? "fertig" : "misst") : undefined}>
      {title && (
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Einstellungen</h3>
          {!editable && <span className="text-xs text-muted-foreground">legt der Host fest</span>}
        </div>
      )}
      {presets && !inGame && fit && <Presets room={room} editable={editable && !playing} dispatch={dispatch} />}
      <div className={cn(fit ? "flex flex-wrap gap-2 [&>*]:basis-full [&>[data-pill]]:basis-auto" : "contents")}>
      {Extra && !inGame && (
        <Fold {...folding("extra")} title={ui.settingsExtraTitle ?? "Vorschläge"}><Extra room={room} editable={editable && !playing} online={online} dispatch={dispatch} /></Fold>
      )}
      {setKind && !inGame && (
        <Fold {...folding("sets")} title="Eigene Sets">
          <SetPicker room={room} editable={editable && !playing} online={online} dispatch={dispatch}
            ownToggle={ownDef && (!ownDef.showIf || ownDef.showIf(room.options)) ? (enough) => (
              <Setting def={ownDef} value={room.options[ownDef.key]} editable={editable && !playing && enough} onChange={(value) => dispatch({ type: "setOption", key: ownDef.key, value })} />
            ) : undefined} />
        </Fold>
      )}
      {presets && !inGame && !fit && <Presets room={room} editable={editable && !playing} dispatch={dispatch} />}
      {/* Grundeinstellungen immer sichtbar (im Blatt notfalls eingeklappt), Gruppen einklappbar (Hausregeln anfangs zu) */}
      {shown.some((def) => inGame || !def.group) && (
        <Fold {...folding("basics")} title="Grundeinstellungen" gap={fit ? "gap-3" : "gap-4"}>{shown.filter((def) => inGame || !def.group).map(setting)}</Fold>
      )}
      {groups.map((g) => (
        <Group key={g} {...folding(g)} title={g} storeKey={`${room.gameId}:${g}`} changed={shown.filter((d) => d.group === g && changedFrom(d, room.options[d.key])).length}>
          {shown.some((d) => d.group === g && d.chip) && (
            <div className="flex flex-wrap gap-1.5">{shown.filter((d) => d.group === g && d.chip).map((d) => (
              <Chip key={d.key} label={d.label} hint={"hint" in d ? d.hint : undefined} checked={room.options[d.key] === true} editable={editable && !playing}
                onChange={(value) => dispatch({ type: "setOption", key: d.key, value })} />
            ))}</div>
          )}
          {shown.filter((d) => d.group === g && !d.chip).map(setting)}
        </Group>
      ))}
      {inGame ? hintBox : (entryChoice || hints) && (
        <Group {...folding("raum")} title={extraTitle(hints, entryChoice)} storeKey="raum" changed={(entryChoice && room.entry !== "turn" ? 1 : 0) + (room.noHints ? 1 : 0)}>
          {hintBox}
          {entryChoice && (
            <Segmented label="Wer darf für den Spieler am Zug handeln?" value={room.entry} editable={editable} options={ENTRY_OPTIONS}
              onChange={(mode) => dispatch({ type: "setEntry", mode })} />
          )}
        </Group>
      )}
      </div>
    </section>
  );
}

/**
 * Regeln auf einen Blick: Standard, die Pakete des Spiels (z. B. „Kurz“) und – wenn einzelne Hausregeln
 * geändert sind – „Eigene“ mit der Zahl der Änderungen. Ein Tipp setzt alle Regeln des Pakets.
 */
function Presets({ room, editable, dispatch }: { room: RoomState; editable: boolean; dispatch: (a: RoomAction) => void }) {
  const logic = getGame(room.gameId);
  // Pakete, deren Regeln gerade gar nicht gelten (z. B. Hausregeln bei echten Karten), bleiben weg
  const visible = new Set(logic.settings.filter((d) => !d.showIf || d.showIf(room.options)).map((d) => d.key));
  const current = currentPreset(logic, room.options, room.players.length);
  const all = presetsOf(logic).filter((p) => p.id === "standard" || p.id === current || Object.keys({ ...p.options, ...p.byPlayers?.(room.players.length) }).some((k) => visible.has(k)));
  if (all.length < 2 && current) return null;
  const n = changedRules(logic, room.options);
  const options = [...all.map((p) => ({ value: p.id, label: p.label, hint: p.hint })),
    ...(current ? [] : [{ value: "eigene", label: "Eigene", hint: `${n} ${n === 1 ? "Änderung" : "Änderungen"}` }])];
  return (
    <div data-testid="presets">
      <Segmented label="Regeln" value={current ?? "eigene"} editable={editable} options={options}
        onChange={(id) => { if (id !== "eigene") dispatch({ type: "setPreset", id }); }} />
    </div>
  );
}

/** Gibt es während der Partie etwas einzustellen? */
export function hasInGameSettings(room: RoomState): boolean {
  return HINT_GAMES.has(room.gameId) || getGame(room.gameId).settings.some((d) => d.inGame && (!d.showIf || d.showIf(room.options)));
}

const changedFrom = (def: SettingDef, value: unknown) => value !== undefined && value !== def.default;

interface Folding {
  /** Kennung des Bereichs (fürs Selbst-Einklappen im Blatt) */
  sec?: string;
  /** vom Blatt eingeklappt, weil sonst gescrollt werden müsste */
  autoClosed?: boolean;
  /** eingeklappt als kleiner Knopf statt als ganze Zeile */
  pill?: boolean;
  /** jemand öffnet oder schließt selbst – ab dann klappt das Blatt nichts mehr ein */
  onTouch?: () => void;
}

/** Kopf eines eingeklappten oder einklappbaren Bereichs */
function FoldHead({ title, open, pill, autoClosed, changed = 0, onClick }: { title: string; open: boolean; pill: boolean; autoClosed?: boolean; changed?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} data-auto-collapsed={autoClosed || undefined}
      className={cn("flex w-full items-center gap-2 text-left text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring", pill ? "rounded-full px-3 py-2" : "rounded-xl px-3 py-2.5")}>
      <span className="flex-1">{title}</span>
      {changed > 0 && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">{pill ? changed : `${changed} geändert`}</span>}
      <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
    </button>
  );
}

/** Bereich ohne eigene Gruppe (Grundeinstellungen, Vorschläge, eigene Sets): offen wie bisher, im Blatt notfalls eingeklappt */
function Fold({ sec, autoClosed, pill = false, onTouch, title, gap = "gap-4", children }: Folding & { title: string; gap?: string; children: ReactNode }) {
  if (!autoClosed) return <div className={cn("grid empty:hidden", gap)} data-sec={sec} data-open="true">{children}</div>;
  return (
    <div className={cn("ring-1 ring-inset ring-border", pill ? "rounded-full" : "rounded-xl")} data-sec={sec} data-open="false" data-pill={pill || undefined}>
      <FoldHead title={title} open={false} pill={pill} autoClosed onClick={() => onTouch?.()} />
    </div>
  );
}

/** Einklappbare Gruppe – merkt sich auf dem Gerät, ob sie offen ist; zeigt, wie viel vom Standard abweicht */
function Group({ title, storeKey, changed, children, sec, autoClosed, pill = false, onTouch }: Folding & { title: string; storeKey: string; changed: number; children: ReactNode }) {
  const key = `spieltisch:group:${storeKey}`;
  // Hausregeln und Raum-Optionen starten eingeklappt, Wichtiges (Ablauf, Rollen) offen
  const initial = !/Hausregeln|Hilfen|Mitspielen/.test(title);
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem(key); return v === null ? initial : v === "1"; } catch { return initial; } });
  const shown = open && !autoClosed;
  const toggle = () => {
    onTouch?.();
    // Vom Blatt eingeklappt: nur wieder aufklappen (gemerkt war sie offen)
    if (autoClosed) return;
    setOpen(!open); try { localStorage.setItem(key, open ? "0" : "1"); } catch { /* egal */ }
  };
  const asPill = pill && !shown;
  return (
    <div className={cn("ring-1 ring-inset ring-border", asPill ? "rounded-full" : "rounded-xl")} data-sec={sec} data-open={shown} data-pill={asPill || undefined}>
      <FoldHead title={title} open={shown} pill={asPill} autoClosed={autoClosed} changed={changed} onClick={toggle} />
      {shown && <div className="text-in grid gap-4 px-3 pt-1 pb-3">{children}</div>}
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
    case "text":
      return <TextSetting def={def} value={String(value ?? def.default)} editable={editable} onChange={onChange} />;
  }
}

/** Freier Text: wird beim Verlassen des Feldes oder mit Eingabe übernommen */
function TextSetting({ def, value, editable, onChange }: { def: Extract<SettingDef, { type: "text" }>; value: string; editable: boolean; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => { if (text.trim() !== value) onChange(text); };
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-semibold">{def.label}{def.hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{def.hint}</span>}</span>
      <input value={text} disabled={!editable} maxLength={def.maxLength} placeholder={def.placeholder} onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} data-testid={`setting-${def.key}`}
        className="h-10 rounded-lg bg-background px-3 text-base ring-1 ring-inset ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-60" />
    </label>
  );
}

/** Schalter als Chip: an = gefüllt, aus = nur Umriss */
function Chip({ label, hint, checked, editable, onChange }: { label: string; hint?: string; checked: boolean; editable: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} disabled={!editable} onClick={() => onChange(!checked)} title={hint}
      className={cn("min-h-9 rounded-full px-3 py-1 text-[0.8rem] font-semibold ring-1 ring-inset outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-60",
        checked ? "bg-primary/12 text-primary ring-primary/50" : "text-muted-foreground line-through decoration-1 ring-border")}>
      {label}
    </button>
  );
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
