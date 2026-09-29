import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ALL_ROLES, knownRoles, participants, ROLES, type Death, type Role, type WerwolfState } from "@shared/games/werwolf/logic";
import type { Player } from "@shared/platform/types";
import { cn } from "@/lib/utils";

export const CAUSE: Record<Death["cause"], string> = {
  wolf: "von den Werwölfen gefressen", gift: "vergiftet", dorf: "vom Dorf verurteilt",
  weiss: "vom weißen Werwolf gefressen", jaeger: "vom Jäger erschossen", kummer: "aus Liebeskummer gestorben", rost: "am rostigen Schwert gestorben", weg: "hat das Spiel verlassen",
};

export const nameOf = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "?";

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
              on ? "bg-gold text-navy-950" : "bg-navy-700/70 ring-1 ring-inset ring-border active:bg-navy-600")}>
            <span className="truncate">{nameOf(players, id)}</span>
            {marks?.[id] !== undefined && <span className={cn("shrink-0 text-sm tabular-nums", on ? "text-navy-950/70" : "text-muted-foreground")}>{marks[id]}</span>}
          </button>
        );
      })}
      {extra && (
        <button type="button" aria-pressed={extra.selected} onClick={extra.onPick}
          className={cn("h-12 rounded-xl px-3 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            extra.selected ? "bg-gold text-navy-950" : "text-muted-foreground ring-1 ring-inset ring-border")}>
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
        hidden ? "card-back text-paper" : r.team === "werwolf" ? "bg-gradient-to-b from-[#6b2430] to-[#3a1119] text-white" : "bg-paper text-paper-ink")}>
      {hidden ? (
        <span className="flex items-center justify-center gap-2 font-bold"><Eye className="size-5" />Tippen: Rolle ansehen</span>
      ) : (
        <span className={cn("flex items-center gap-3", compact ? "justify-start text-left" : "flex-col")}>
          <span className={compact ? "text-3xl" : "text-6xl"} aria-hidden="true">{r.emoji}</span>
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
            {show && <span aria-label={ROLES[s.roles[id]].name}>{ROLES[s.roles[id]].emoji}</span>}
            {nameOf(players, id)}
            {s.captain === id && <span aria-label="Hauptmann">👑</span>}
            {s.lovers?.includes(id) && <span aria-label="verliebt">💘</span>}
            {s.enchanted.includes(id) && <span aria-label="verzaubert">🪈</span>}
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
              ✝ {nameOf(players, d.id)} <span className="font-normal text-muted-foreground">– {CAUSE[d.cause]}</span>
              {known.has(d.id) && <span className="font-normal"> · {ROLES[s.roles[d.id]].emoji} {ROLES[s.roles[d.id]].name}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 font-semibold">{kind === "night" ? "Niemand ist gestorben." : "Niemand wurde verurteilt."}</p>}
      {s.news.idiot && <p className="mt-1 font-semibold">🤪 {nameOf(players, s.news.idiot)} ist der Dorfdepp – das Dorf lacht und lässt ihn leben. Er darf nicht mehr abstimmen.</p>}
      {s.news.scapegoat && <p className="mt-1 text-sm text-muted-foreground">🐐 Gleichstand – der Sündenbock musste sterben.</p>}
      {s.news.growl && <p className="mt-1 font-semibold text-gold">🐻 Der Bär brummt! Neben dem Bärenführer sitzt ein Werwolf.</p>}
      {s.news.growl === false && <p className="mt-1 text-sm text-muted-foreground">🐻 Der Bär bleibt still.</p>}
      {s.news.raven && <p className="mt-1 text-sm text-muted-foreground">🐦‍⬛ Der Rabe hat {nameOf(players, s.news.raven)} markiert: +2 Stimmen bei der Abstimmung.</p>}
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
            selected === r ? "bg-gold text-navy-950" : "bg-navy-700/70 ring-1 ring-inset ring-border")}>
          <span aria-hidden="true">{ROLES[r].emoji}</span><span className="truncate">{ROLES[r].name}</span>
        </button>
      ))}
    </div>
  );
}
