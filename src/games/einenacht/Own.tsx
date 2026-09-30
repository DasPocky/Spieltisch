import { useEffect, useState } from "react";
import { Moon, Pause, Play, Sun, Volume2, VolumeX } from "lucide-react";
import { ON_ROLES, type ONAction, type ONState } from "@shared/games/einenacht/logic";
import type { Options, Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { IconTitle, Panel, Picker } from "@/games/werwolf/parts";
import { setSpeech, speechSupported, useSpeak, useSpeechEnabled } from "@/games/werwolf/useSpeech";
import { cn } from "@/lib/utils";
import { Countdown } from "./parts";
import { RoleIcon } from "./RoleIcon";
import { ON_DAWN, ON_SCRIPT } from "./script";

const ids = (s: ONState) => Object.keys(s.start);
/** Genug Zeit zum Vorlesen und Handeln (die Rollen tauschen echte Karten) */
const stepSeconds = (say: string) => Math.round(Math.max(7, say.length / 13 + 6));

/** Rollen im Spiel laut Einstellungen */
function rolesInPlay(o: Options): string[] {
  const list = [`${o.wolves === "1" ? 1 : 2}× ${ON_ROLES.werwolf.name}`];
  for (const r of Object.keys(ON_ROLES) as (keyof typeof ON_ROLES)[]) if (r !== "werwolf" && r !== "dorf" && o[r] === true) list.push(r === "freimaurer" ? `2× ${ON_ROLES[r].name}` : ON_ROLES[r].name);
  return list;
}

/** Eigene Karten: Das Handy des Hosts (lokal: das Gerät) erzählt die Nacht und schaltet selbst weiter. */
export function OwnNarrator({ s, players, options, act }: { s: ONState; players: Player[]; options: Options; act: (a: ONAction) => void }) {
  const speech = useSpeechEnabled(true);
  const [auto, setAuto] = useState(true);
  const step = s.phase === "night" ? s.pending[0] : null;
  useSpeak(step ? ON_SCRIPT[step].say : s.phase === "day" ? ON_DAWN : "", speech && s.phase !== "reveal");
  const secs = step ? stepSeconds(ON_SCRIPT[step].say) : 0;
  const [left, setLeft] = useState(secs);
  const key = `${step}|${s.pending.length}`;
  useEffect(() => { setLeft(secs); }, [key, secs]);
  useEffect(() => {
    if (!step || !auto) return;
    if (left <= 0) { act({ type: "next" }); return; }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left, auto, step, act]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {speechSupported() && s.phase !== "reveal" && (
        <button type="button" onClick={() => setSpeech(!speech)} className="flex shrink-0 items-center gap-2 self-end text-sm font-semibold text-muted-foreground">
          {speech ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}Vorlesen {speech ? "an" : "aus"}
        </button>
      )}
      {s.phase === "reveal" && (
        <>
          <Panel title="Karten austeilen" sub={`Mischt ${players.length + 3} Karten: jeder bekommt eine, drei liegen verdeckt in der Mitte. Karte ansehen und verdeckt vor sich legen.`}>
            <ul className="grid gap-1 text-sm" data-testid="own-roles">{rolesInPlay(options).map((r) => <li key={r}>{r}</li>)}<li className="text-muted-foreground">Rest: Dorfbewohner</li></ul>
          </Panel>
          <Button size="lg" className="shrink-0" onClick={() => act({ type: "startNight" })}><Moon />Nacht beginnen</Button>
        </>
      )}
      {s.phase === "night" && step && (
        <>
          <Panel title={<IconTitle icon={Moon}>{ON_SCRIPT[step].title}</IconTitle>} sub={<span className="italic">„{ON_SCRIPT[step].say}“</span>}>
            <div className="grid flex-1 place-content-center justify-items-center gap-3">
              {step !== "sleep" && ON_ROLES[step as keyof typeof ON_ROLES] ? <RoleIcon role={step as keyof typeof ON_ROLES} className="block size-14 text-ice" /> : <Moon className="size-14 text-ice" />}
              <p className="text-5xl font-extrabold tabular-nums" data-testid="own-left">{auto ? left : "–"}</p>
              <p className="text-sm text-muted-foreground">{auto ? "Sekunden bis zum nächsten Schritt" : "Automatik angehalten"}</p>
            </div>
          </Panel>
          <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2">
            <Button size="lg" variant="secondary" aria-label={auto ? "Automatik anhalten" : "Automatik fortsetzen"} onClick={() => setAuto((a) => !a)}>{auto ? <Pause /> : <Play />}</Button>
            <Button size="lg" onClick={() => act({ type: "next" })}>Weiter</Button>
          </div>
        </>
      )}
      {s.phase === "day" && <OwnDay s={s} players={players} act={act} />}
    </div>
  );
}

const TEAMS = [["dorf", "Dorf"], ["werwolf", "Werwölfe"], ["gerber", "Gerber"]] as const;

function OwnDay({ s, players, act }: { s: ONState; players: Player[]; act: (a: ONAction) => void }) {
  const [team, setTeam] = useState<"dorf" | "werwolf" | "gerber" | null>(null);
  const [won, setWon] = useState<string[]>([]);
  return (
    <>
      <Countdown s={s} />
      <Panel title={<IconTitle icon={Sun}>Aufdecken und eintragen</IconTitle>} sub="Nach der Abstimmung deckt ihr alle Karten auf. Wer hat gewonnen? Für die Statistik die Gewinner antippen.">
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          {TEAMS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={team === id} onClick={() => setTeam(team === id ? null : id)}
              className={cn("rounded-lg py-2 text-sm font-bold ring-1 ring-inset", team === id ? "bg-ice text-navy-950 ring-transparent" : "text-muted-foreground ring-border")}>{label}</button>
          ))}
        </div>
        <Picker ids={ids(s)} players={players} selected={won} onPick={(id) => setWon((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))} />
      </Panel>
      <Button size="lg" className="shrink-0" onClick={() => act({ type: "settle", team, winners: won })}>{team ? "Ergebnis eintragen" : "Niemand gewinnt"}</Button>
    </>
  );
}

/** Eigene Karten, online: alle anderen Handys zeigen nur, was gerade passiert */
export function OwnPhone({ s }: { s: ONState }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {s.phase === "reveal" && <Panel title="Karten austeilen" sub="Nimm deine Karte, sieh sie dir an und leg sie verdeckt vor dich. Der Host startet die Nacht." />}
      {s.phase === "night" && <Panel title={<IconTitle icon={Moon}>Augen zu</IconTitle>} sub="Das Handy des Hosts führt durch die Nacht. Wach nur auf, wenn deine Rolle gerufen wird." />}
      {s.phase === "day" && (
        <>
          <Countdown s={s} />
          <Panel title={<IconTitle icon={Sun}>Diskutiert!</IconTitle>} sub="Am Ende zeigen alle gleichzeitig auf jemanden. Dann deckt ihr die Karten auf, der Host trägt das Ergebnis ein." />
        </>
      )}
    </div>
  );
}
