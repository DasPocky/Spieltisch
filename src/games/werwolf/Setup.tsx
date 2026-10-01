import { buildDeck, modeOf, ROLES, SPECIAL_ROLES, type Role } from "@shared/games/werwolf/logic";
import type { RoomAction, RoomState } from "@shared/platform/room";
import type { OptionValue } from "@shared/platform/types";
import { cn } from "@/lib/utils";
import { RoleIcon } from "./RoleIcon";

/** Vorlagen: welche Rollen und Hausregeln an sind (alles andere aus) */
const PRESETS: { id: string; label: string; hint: string; on: Role[]; rules: Record<string, OptionValue> }[] = [
  { id: "start", label: "Einsteiger", hint: "Werwölfe, Seherin, Hexe", on: ["seherin", "hexe"], rules: { captain: false, tie: "none" } },
  { id: "classic", label: "Klassisch", hint: "+ Jäger, Amor, Hauptmann", on: ["seherin", "hexe", "jaeger", "amor"], rules: { captain: true, tie: "runoff" } },
  { id: "many", label: "Viel los", hint: "+ Heiler, Alter, Fuchs, Rabe …", on: ["seherin", "hexe", "jaeger", "amor", "beschuetzer", "alter", "dorfdepp", "fuchs", "rabe", "wildeskind"], rules: { captain: true, tie: "runoff" } },
];

/**
 * Über den Werwolf-Einstellungen: Vorlagen zum schnellen Start und eine Live-Übersicht,
 * welche Karten bei dieser Spielerzahl im Spiel sind.
 */
export function Setup({ room, editable, online, dispatch }: { room: RoomState; editable: boolean; online: boolean; dispatch: (a: RoomAction) => void }) {
  const o = room.options;
  const human = modeOf(o) === "human";
  // Online mit Spielleiter spielt der Host nicht mit
  const n = Math.max(0, room.players.length - (human && online ? 1 : 0));
  let deck: Role[] | null = null;
  let error = "";
  try { deck = buildDeck(Math.max(n, 5), o); } catch (e) { error = (e as Error).message; }
  const counts = new Map<Role, number>();
  for (const r of deck ?? []) counts.set(r, (counts.get(r) ?? 0) + 1);
  const active = PRESETS.find((p) => SPECIAL_ROLES.every((r) => (o[r] === true) === p.on.includes(r)));
  const apply = (p: (typeof PRESETS)[number]) => {
    for (const r of SPECIAL_ROLES) if ((o[r] === true) !== p.on.includes(r)) dispatch({ type: "setOption", key: r, value: p.on.includes(r) });
    for (const [k, v] of Object.entries(p.rules)) if (o[k] !== v) dispatch({ type: "setOption", key: k, value: v });
  };

  return (
    <div className="grid gap-3" data-testid="ww-setup">
      {editable && (
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">Schnellstart</span>
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => apply(p)} aria-pressed={active?.id === p.id}
                className={cn("rounded-xl px-2 py-2 text-left ring-1 ring-inset outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                  active?.id === p.id ? "bg-ice text-navy-950 ring-transparent" : "ring-border")}>
                <span className="block text-sm font-bold">{p.label}</span>
                <span className={cn("block text-xs leading-tight", active?.id === p.id ? "text-navy-800" : "text-muted-foreground")}>{p.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl bg-navy-950/40 p-3 ring-1 ring-inset ring-border" data-testid="ww-deck">
        <p className="text-sm font-semibold">{n < 5 ? "Ab 5 Spielern – so sähe es mit 5 aus:" : `${n} Spieler bekommen:`}</p>
        {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {[...counts].map(([r, c]) => (
              <li key={r} className="flex items-center gap-1 rounded-full bg-navy-800/70 px-2 py-0.5 text-xs font-semibold">
                <RoleIcon role={r} className={cn("size-3.5", ROLES[r].team === "werwolf" ? "text-destructive" : "text-navy-200")} />{c > 1 && `${c}× `}{ROLES[r].name}
              </li>
            ))}
          </ul>
        )}
        {human && <p className="mt-1.5 text-xs text-muted-foreground">Mit Spielleiter: Der Host liest vor und spielt nicht mit.</p>}
        {!human && o.auto !== false && <p className="mt-1.5 text-xs text-muted-foreground">Automatik an: Ein Handy liegt in der Mitte, liest vor und macht selbst weiter.</p>}
      </div>
    </div>
  );
}
