import { useState, type ReactNode } from "react";
import { Bird, Crown, Eye, EyeOff, Footprints, Heart, Laugh, Music, Scale, Skull, type LucideIcon } from "lucide-react";
import { ALL_ROLES, knownRoles, participants, ROLES, type Death, type Role, type WerwolfState } from "@shared/games/werwolf/logic";
import type { Player } from "@shared/platform/types";
import { cn } from "@/lib/utils";
import { RoleIcon } from "./RoleIcon";

export const CAUSE: Record<Death["cause"], string> = {
  wolf: "von den Werwölfen gefressen", gift: "vergiftet", dorf: "vom Dorf verurteilt",
  weiss: "vom weißen Werwolf gefressen", jaeger: "vom Jäger erschossen", kummer: "aus Liebeskummer gestorben", rost: "am rostigen Schwert gestorben", besuch: "beim nächtlichen Besuch umgekommen", weg: "hat das Spiel verlassen",
};

export const nameOf = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";

/** Einfarbiges Symbol im Fließtext */
export function Ico({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon aria-hidden="true" className={cn("inline size-4 shrink-0 align-[-3px]", className)} />;
}

/** Überschrift mit Symbol davor */
export function IconTitle({ icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <span className="flex min-w-0 items-center gap-2"><Ico icon={icon} className="size-5 text-ice" /><span className="min-w-0">{children}</span></span>;
}

/** Glas-Kachel für den Hauptinhalt, füllt den freien Platz und scrollt innen, falls nötig */
export function Panel({ title, sub, children, className }: { title?: ReactNode; sub?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={cn("glass flex min-h-0 flex-1 flex-col rounded-2xl p-3.5", className)}>
      {title && <h2 className="shrink-0 text-xl font-extrabold tracking-tight">{title}</h2>}
      {sub && <p className="mt-1 shrink-0 text-sm leading-snug text-muted-foreground">{sub}</p>}
      {children && <div className="no-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto">{children}</div>}
    </section>
  );
}

/** Namen zum Antippen (Opfer, Verdacht, Abstimmung, …) */
export function Picker({ ids, players, selected, onPick, disabled, extra, marks }: {
  ids: string[];
  players: Player[];
  selected: string[];
  onPick: (id: string) => void;
  disabled?: (id: string) => boolean;
  /** zusätzlicher Knopf, z. B. „Niemand“ */
  extra?: { label: string; selected: boolean; onPick: () => void };
  /** kleine Zusatzinfo je Name, z. B. Stimmen */
  marks?: Record<string, ReactNode>;
}) {
  return (
    <div className={cn("grid gap-1.5", ids.length > 10 ? "grid-cols-3" : "grid-cols-2")} role="group">
      {ids.map((id) => {
        const on = selected.includes(id);
        return (
          <button key={id} type="button" aria-pressed={on} disabled={disabled?.(id)} onClick={() => onPick(id)}
            className={cn("flex h-12 min-w-0 items-center justify-between gap-1 rounded-xl px-3 text-left font-semibold outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-35",
              on ? "bg-ice text-navy-950" : "bg-navy-700/70 ring-1 ring-inset ring-border active:bg-navy-600")}>
            <span className="truncate">{nameOf(players, id)}</span>
            {marks?.[id] !== undefined && <span className={cn("shrink-0 text-sm tabular-nums", on ? "text-navy-950/70" : "text-muted-foreground")}>{marks[id]}</span>}
          </button>
        );
      })}
      {extra && (
        <button type="button" aria-pressed={extra.selected} onClick={extra.onPick}
          className={cn("h-12 rounded-xl px-3 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            extra.selected ? "bg-ice text-navy-950" : "text-muted-foreground ring-1 ring-inset ring-border")}>
          {extra.label}
        </button>
      )}
    </div>
  );
}

/** Rollenkarte – verdeckt, bis man sie antippt, damit niemand mitliest */
export function RoleCard({ role, hidden: startHidden = true, compact }: { role: Role; hidden?: boolean; compact?: boolean }) {
  const [hidden, setHidden] = useState(startHidden);
  const r = ROLES[role];
  return (
    <button type="button" onClick={() => setHidden((h) => !h)} aria-label={hidden ? "Rolle aufdecken" : `Deine Rolle: ${r.name}. Tippen zum Verdecken`}
      className={cn("relative w-full overflow-hidden rounded-2xl text-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
        compact ? "px-3 py-2.5" : "px-4 py-5",
        hidden ? "card-back text-paper" : r.team === "werwolf" ? "bg-gradient-to-b from-navy-700 to-navy-950 text-white ring-1 ring-inset ring-destructive/50" : "bg-paper text-paper-ink")}>
      {hidden ? (
        <span className="flex items-center justify-center gap-2 font-bold"><Eye className="size-5" />Tippen: Rolle ansehen</span>
      ) : (
        <span className={cn("flex items-center gap-3", compact ? "justify-start text-left" : "flex-col")}>
          <RoleIcon role={role} className={cn(compact ? "size-8" : "size-14", r.team === "werwolf" ? "text-destructive" : "text-navy-600")} />
          <span className="min-w-0">
            <span className={cn("block font-extrabold tracking-tight", compact ? "text-lg" : "text-3xl")} data-testid="my-role">{r.name}</span>
            <span className={cn("block text-sm leading-snug", r.team === "werwolf" ? "text-white/75" : "text-paper-ink/70")}>{r.short}</span>
          </span>
          {!compact && <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold opacity-60"><EyeOff className="size-3.5" />Tippen zum Verdecken</span>}
        </span>
      )}
    </button>
  );
}

/** Wer lebt noch? Tote durchgestrichen (mit Rolle, wenn aufgedeckt); `showAll` nur für den Spielleiter */
export function AliveStrip({ s, players, me, showAll }: { s: WerwolfState; players: Player[]; me: string | null; showAll?: boolean }) {
  const known = knownRoles(s);
  return (
    <div className="no-scrollbar -mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-1" aria-label="Mitspieler">
      {participants(s).map((id) => {
        const dead = !s.alive[id];
        // Lebende Rollen nie in der Leiste zeigen – ein Blick aufs Nachbarhandy würde sie verraten
        const show = showAll || (dead && known.has(id));
        return (
          <span key={id} className={cn("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ring-1 ring-inset",
            dead ? "text-muted-foreground line-through decoration-destructive ring-border" : "bg-navy-700/60 ring-border",
            id === me && "ring-navy-300")}>
            {show && <span role="img" aria-label={ROLES[s.roles[id]].name}><RoleIcon role={s.roles[id]} className="size-3.5 text-navy-200" /></span>}
            {nameOf(players, id)}
            {s.captain === id && <span role="img" aria-label="Hauptmann"><Ico icon={Crown} className="size-3.5 text-ice" /></span>}
            {s.lovers?.includes(id) && <span role="img" aria-label="verliebt"><Ico icon={Heart} className="size-3.5 text-navy-200" /></span>}
            {s.enchanted.includes(id) && <span role="img" aria-label="verzaubert"><Ico icon={Music} className="size-3.5 text-navy-200" /></span>}
          </span>
        );
      })}
    </div>
  );
}

/** Was in der Nacht bzw. bei der Abstimmung passiert ist */
export function News({ s, players }: { s: WerwolfState; players: Player[] }) {
  if (!s.news) return null;
  const known = knownRoles(s);
  const { deaths, kind, tally } = s.news;
  const top = tally ? Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  return (
    <div className="shrink-0 rounded-2xl bg-navy-950/50 p-3 ring-1 ring-inset ring-border" data-testid="news">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{kind === "night" ? "Heute Nacht" : "Urteil des Dorfes"}</div>
      {deaths.length ? (
        <ul className="mt-1 grid gap-0.5">
          {deaths.map((d) => (
            <li key={d.id} className="font-semibold">
              <Ico icon={Skull} className="mr-1 text-muted-foreground" />{nameOf(players, d.id)} <span className="font-normal text-muted-foreground">– {CAUSE[d.cause]}</span>
              {known.has(d.id) && <span className="font-normal"> · <RoleIcon role={s.roles[d.id]} className="mr-1" />{ROLES[s.roles[d.id]].name}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 font-semibold">{kind === "night" ? "Niemand ist gestorben." : "Niemand wurde verurteilt."}</p>}
      {s.news.idiot && <p className="mt-1 font-semibold"><Ico icon={Laugh} className="mr-1" />{nameOf(players, s.news.idiot)} ist der Dorfdepp – das Dorf lacht und lässt ihn leben. Er darf nicht mehr abstimmen.</p>}
      {s.news.scapegoat && <p className="mt-1 text-sm text-muted-foreground"><Ico icon={Scale} className="mr-1" />Gleichstand – der Sündenbock musste sterben.</p>}
      {s.news.growl && <p className="mt-1 font-semibold text-ice"><Ico icon={Footprints} className="mr-1" />Der Bär brummt! Neben dem Bärenführer sitzt ein Werwolf.</p>}
      {s.news.growl === false && <p className="mt-1 text-sm text-muted-foreground"><Ico icon={Footprints} className="mr-1" />Der Bär bleibt still.</p>}
      {s.news.raven && <p className="mt-1 text-sm text-muted-foreground"><Ico icon={Bird} className="mr-1" />Der Rabe hat {nameOf(players, s.news.raven)} markiert: +2 Stimmen bei der Abstimmung.</p>}
      {top.length > 0 && kind === "night" && (
        <p className="mt-1 text-sm text-muted-foreground">Verdacht der Nacht: {top.map(([id, n]) => `${nameOf(players, id)} (${n})`).join(", ")}</p>
      )}
      {top.length > 0 && kind === "day" && (
        <p className="mt-1 text-sm text-muted-foreground">Stimmen: {top.map(([id, n]) => `${nameOf(players, id)} ${n}`).join(" · ")}</p>
      )}
    </div>
  );
}

/** Rollen zum Antippen (eigene Karten, Dieb) – die im Spiel aktiven zuerst */
export function RolePicker({ selected, onPick, prefer }: { selected: Role | null; onPick: (r: Role) => void; prefer?: Role[] }) {
  const order = [...new Set<Role>([...(prefer ?? []), ...ALL_ROLES])];
  return (
    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Rolle">
      {order.map((r) => (
        <button key={r} type="button" aria-pressed={selected === r} onClick={() => onPick(r)}
          className={cn("flex h-11 min-w-0 items-center gap-2 rounded-xl px-2.5 text-left text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            selected === r ? "bg-ice text-navy-950" : "bg-navy-700/70 ring-1 ring-inset ring-border")}>
          <RoleIcon role={r} className={selected === r ? "text-navy-950" : "text-navy-200"} /><span className="truncate">{ROLES[r].name}</span>
        </button>
      ))}
    </div>
  );
}
