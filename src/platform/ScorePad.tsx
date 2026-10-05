import { useState, type ReactNode } from "react";
import { Trophy, Undo2 } from "lucide-react";
import type { Pad, PadAction } from "@shared/platform/pad";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RulesSheet } from "@/platform/RulesSheet";
import { Scoreboard } from "@/platform/Scoreboard";
import { cn, vibrate } from "@/lib/utils";

/**
 * Punkteblock für Spiele mit echten Karten. `mode="points"`: jeder trägt seine Rundenpunkte ein,
 * der Host schließt ab. `mode="wins"`: der Host tippt den Rundensieger an.
 */
export function ScorePad({ pad, players, me, isHost, online, act, gameId, info, hint, mode = "points", lowWins, allowNegative, entry }: {
  pad: Pad;
  players: Player[];
  me: string | null;
  isHost: boolean;
  online: Set<string> | null;
  act: (a: PadAction) => void;
  gameId: string;
  /** z. B. „Runde 3 · bis 200“ */
  info: string;
  hint: string;
  mode?: "points" | "wins";
  lowWins?: boolean;
  allowNegative?: boolean;
  /** Eigene Eingabe statt Zahlenfeld (z. B. Karten antippen) – bekommt den Spieler und setzt die Punkte */
  entry?: (p: Player, editable: boolean, value: number | null, set: (n: number | null) => void) => ReactNode;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const local = me === null;
  const entries = players.map((p) => ({ id: p.id, name: p.name, score: pad.scores[p.id] ?? 0 }));
  const commit = (id: string) => {
    const raw = draft[id];
    if (raw === undefined) return;
    const n = raw.trim() === "" ? null : Number(raw.replace("−", "-"));
    if (n !== null && !Number.isInteger(n)) return;
    act({ type: "padEnter", player: id, points: n });
  };
  const missing = players.filter((p) => pad.entries[p.id] === null || pad.entries[p.id] === undefined).length;

  return (
    <>
      <Scoreboard entries={entries} currentId={null} me={me} online={online} lowWins={lowWins} />
      <div className="flex shrink-0 items-center justify-between px-1 pt-1 text-sm text-muted-foreground">
        <span data-testid="pad-info">{info}</span>
        <RulesSheet gameId={gameId} />
      </div>
      <p className="shrink-0 px-1 text-sm text-muted-foreground">{hint}</p>
      <div className="no-scrollbar mt-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto">
        {players.map((p) => {
          const editable = local || isHost || p.id === me;
          const val = draft[p.id] ?? (pad.entries[p.id] === null || pad.entries[p.id] === undefined ? "" : String(pad.entries[p.id]));
          return mode === "wins" ? (
            <button key={p.id} type="button" disabled={!isHost} onClick={() => { vibrate(12); act({ type: "padWin", player: p.id }); }}
              aria-label={`${p.name} hat die Runde gewonnen`}
              className="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default">
              <span className="min-w-0 flex-1 truncate font-semibold">{p.id === me ? `${p.name} (du)` : p.name}</span>
              <span className="tabular-nums text-muted-foreground">{pad.scores[p.id] ?? 0} {(pad.scores[p.id] ?? 0) === 1 ? "Sieg" : "Siege"}</span>
              {isHost && <Trophy className="size-4 text-navy-300" />}
            </button>
          ) : (
            <div key={p.id} className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate font-semibold">{p.id === me ? `${p.name} (du)` : p.name}</span>
              {entry ? entry(p, editable, pad.entries[p.id] ?? null, (n) => act({ type: "padEnter", player: p.id, points: n })) : <Input value={val} disabled={!editable} inputMode={allowNegative ? "text" : "numeric"} aria-label={`Punkte ${p.name}`} className="h-10 w-20 text-center text-lg font-bold"
                onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value.replace(allowNegative ? /[^\d−-]/g : /\D/g, "").slice(0, 4) }))}
                onBlur={() => commit(p.id)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />}
            </div>
          );
        })}
        {pad.rounds.length > 0 && (
          <details className="glass rounded-xl px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold text-muted-foreground">Bisherige Runden ({pad.rounds.length})</summary>
            <ol className="mt-1.5 grid gap-1">
              {pad.rounds.map((r, i) => (
                <li key={i} className="tabular-nums text-muted-foreground">
                  {i + 1}: {mode === "wins" ? players.find((p) => r[p.id] === 1)?.name ?? "?" : players.map((p) => `${p.name} ${r[p.id] ?? 0}`).join(" · ")}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
      <div className="grid shrink-0 gap-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isHost ? (
          <div className={cn("grid gap-2", pad.rounds.length ? "grid-cols-[auto_1fr]" : "grid-cols-1")}>
            {pad.rounds.length > 0 && <Button size="lg" variant="secondary" aria-label="Letzte Runde zurücknehmen" onClick={() => { setDraft({}); act({ type: "padUndo" }); }}><Undo2 /></Button>}
            {mode === "points" ? (
              <Button size="lg" disabled={missing > 0} onClick={() => { vibrate(10); setDraft({}); act({ type: "padFinish" }); }}>
                {missing ? `Noch ${missing} ${missing === 1 ? "Eintrag" : "Einträge"}` : `Runde ${pad.round} abschließen`}
              </Button>
            ) : <p className="self-center text-center text-sm text-muted-foreground">Rundensieger antippen</p>}
          </div>
        ) : <p className="glass rounded-xl py-3 text-center text-muted-foreground">{mode === "wins" ? "Der Host trägt den Rundensieger ein." : missing ? "Trag deine Punkte ein." : "Der Host schließt die Runde ab."}</p>}
      </div>
    </>
  );
}
