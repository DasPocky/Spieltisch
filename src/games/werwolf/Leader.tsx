import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { aliveIds, holders, participants, ROLES, type Role, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AliveStrip, nameOf, News, Panel, Picker, RoleCard } from "./parts";
import { DAWN_SAY, SCRIPT } from "./script";
import { setSpeech, speechSupported, useSpeak, useSpeechEnabled } from "./useSpeech";

/**
 * Ansicht für den Spielleiter (online) bzw. das Gerät in der Mitte (lokal).
 * Führt Schritt für Schritt durch die Nacht und liest auf Wunsch vor.
 * Im Modus „App erzählt“ lokal sind die Rollen verborgen – dann tippen die aufgerufenen Rollen selbst.
 */
export function Leader({ s, players, act, online }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; online: boolean }) {
  const showRoles = s.mode === "human";
  const speech = useSpeechEnabled(s.mode === "app");
  const step = s.phase === "night" ? s.pending[0] : null;
  const say = step ? SCRIPT[step].say : s.phase === "day" ? DAWN_SAY : "";
  useSpeak(say, speech && s.phase !== "reveal");

  return (
    <>
      <AliveStrip s={s} players={players} me={null} showAll={showRoles} />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {speechSupported() && s.phase !== "reveal" && (
          <button type="button" onClick={() => setSpeech(!speech)} className="flex shrink-0 items-center gap-2 self-end text-sm font-semibold text-muted-foreground">
            {speech ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}Vorlesen {speech ? "an" : "aus"}
          </button>
        )}
        {s.phase === "reveal" && <Reveal s={s} players={players} act={act} online={online} />}
        {s.phase === "night" && step && <NightStep key={`${s.night}-${step}`} s={s} players={players} act={act} showRoles={showRoles} />}
        {s.phase === "day" && <Day s={s} players={players} act={act} />}
        {s.phase === "hunter" && <Hunter s={s} players={players} act={act} />}
      </div>
    </>
  );
}

function Reveal({ s, players, act, online }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; online: boolean }) {
  const [seen, setSeen] = useState<string[]>([]);
  const [peek, setPeek] = useState<string | null>(null);
  if (online) {
    return (
      <>
        <Panel title="Rollen sind verteilt" sub="Jeder sieht seine Rolle am eigenen Handy. Du siehst alle – starte die Nacht, wenn alle bereit sind.">
          <ul className="grid gap-1.5">
            {participants(s).map((id) => (
              <li key={id} className="flex items-center justify-between rounded-xl bg-navy-950/40 px-3 py-2">
                <span className="font-semibold">{ROLES[s.roles[id]].emoji} {nameOf(players, id)}</span>
                <span className="text-sm text-muted-foreground">{ROLES[s.roles[id]].name}{s.ready.includes(id) ? " · ✓" : ""}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Button size="lg" className="shrink-0" onClick={() => act({ type: "startNight" })}>🌙 Nacht beginnen</Button>
      </>
    );
  }
  if (peek) {
    return (
      <>
        <Panel title={`Nur ${nameOf(players, peek)} schaut!`} sub="Tippe auf die Karte, merk dir deine Rolle, verdecke sie wieder und gib das Handy weiter.">
          <RoleCard role={s.roles[peek]} />
          {s.roles[peek] === "werwolf" && holders(s, "werwolf").length > 1 && (
            <p className="mt-3 text-center text-sm text-muted-foreground">Die anderen Werwölfe lernst du in der ersten Nacht kennen.</p>
          )}
        </Panel>
        <Button size="lg" className="shrink-0" onClick={() => { setSeen((x) => [...x, peek]); setPeek(null); }}>Verdeckt – weitergeben</Button>
      </>
    );
  }
  const all = participants(s).every((id) => seen.includes(id));
  return (
    <>
      <Panel title="Rollen ansehen" sub="Reicht das Handy herum. Jeder tippt auf seinen Namen und schaut sich allein seine Rolle an.">
        <Picker ids={participants(s)} players={players} selected={[]} onPick={setPeek} marks={Object.fromEntries(seen.map((id) => [id, "✓"]))} />
      </Panel>
      <Button size="lg" className="shrink-0" variant={all ? "default" : "secondary"} onClick={() => act({ type: "startNight" })}>
        🌙 {all ? "Alle kennen ihre Rolle – Nacht beginnen" : "Nacht beginnen"}
      </Button>
    </>
  );
}

function NightStep({ s, players, act, showRoles }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; showRoles: boolean }) {
  const step = s.pending[0];
  const script = SCRIPT[step];
  const acted = s.acted.includes(step);
  const [pick, setPick] = useState<string[]>([]);
  const [heal, setHeal] = useState(false);
  const alive = aliveIds(s);
  const who = (role: Role) => holders(s, role).filter((id) => s.alive[id]).map((id) => nameOf(players, id)).join(", ");
  const toggle = (id: string, max: number) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-max)));

  let body: React.ReactNode = null;
  let confirm: { label: string; ok: boolean; run: () => void } | null = null;

  if (step === "amor" && !acted) {
    body = <Picker ids={alive} players={players} selected={pick} onPick={(id) => toggle(id, 2)} />;
    confirm = { label: pick.length === 2 ? `${nameOf(players, pick[0])} 💘 ${nameOf(players, pick[1])}` : "Zwei Personen wählen", ok: pick.length === 2, run: () => act({ type: "amor", a: pick[0], b: pick[1] }) };
  } else if (step === "lovers" && s.lovers) {
    body = <p className="text-center text-2xl font-extrabold">{nameOf(players, s.lovers[0])} 💘 {nameOf(players, s.lovers[1])}</p>;
  } else if (step === "beschuetzer" && !acted) {
    body = <Picker ids={alive} players={players} selected={pick} onPick={(id) => toggle(id, 1)} disabled={(id) => id === s.lastProtected} />;
    confirm = { label: "Beschützen", ok: pick.length === 1, run: () => act({ type: "protect", target: pick[0] }) };
  } else if (step === "werwolf" && !acted) {
    body = <Picker ids={alive.filter((id) => s.roles[id] !== "werwolf")} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: pick.length ? `${nameOf(players, pick[0])} fressen` : "Opfer wählen", ok: pick.length === 1, run: () => act({ type: "wolf", target: pick[0] }) };
  } else if (step === "seherin" && !acted) {
    body = <Picker ids={alive.filter((id) => s.roles[id] !== "seherin")} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: "Rolle ansehen", ok: pick.length === 1, run: () => act({ type: "see", target: pick[0] }) };
  } else if (step === "seherin" && acted) {
    const r = s.seer.at(-1)!;
    body = (
      <div className="text-center">
        <div className="text-sm text-muted-foreground">{nameOf(players, r.target)} ist</div>
        <div className="mt-1 text-5xl">{ROLES[r.role].emoji}</div>
        <div className="text-3xl font-extrabold" data-testid="seer-result">{ROLES[r.role].name}</div>
      </div>
    );
  } else if (step === "hexe" && !acted) {
    body = (
      <div className="grid gap-3">
        <p className="rounded-xl bg-navy-950/50 p-3 text-center">Opfer der Werwölfe: <b className="text-lg">{nameOf(players, s.victim)}</b></p>
        <label className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-border", !s.potions.heal && "opacity-40")}>
          <Checkbox checked={heal} disabled={!s.potions.heal || !s.victim} onCheckedChange={(c) => setHeal(c === true)} />
          🧪 Heiltrank benutzen{!s.potions.heal && " (verbraucht)"}
        </label>
        {s.potions.poison ? (
          <>
            <div className="text-sm font-semibold text-muted-foreground">☠ Gifttrank – optional jemanden vergiften:</div>
            <Picker ids={alive} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />
          </>
        ) : <p className="text-sm text-muted-foreground">☠ Gifttrank verbraucht.</p>}
      </div>
    );
    confirm = { label: "Bestätigen", ok: true, run: () => act({ type: "witch", heal, poison: pick[0] ?? null }) };
  } else if (acted && script.after) {
    body = <p className="text-center text-lg font-semibold text-muted-foreground">✓ Erledigt</p>;
  }

  const actorHint = showRoles && step !== "sleep" && step !== "lovers" ? who(step) : "";
  return (
    <>
      <Panel title={<>🌙 Nacht {s.night} · {script.title}</>} sub={<><span className="italic">„{acted && script.after ? script.after : script.say}“</span>{actorHint && <span className="block not-italic">Wach: {actorHint}</span>}</>}>
        {body}
      </Panel>
      {confirm && !acted
        ? <Button size="lg" className="shrink-0" disabled={!confirm.ok} onClick={confirm.run}>{confirm.label}</Button>
        : <Button size="lg" className="shrink-0" onClick={() => act({ type: "next" })}>Weiter</Button>}
    </>
  );
}

function Day({ s, players, act }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void }) {
  const [pick, setPick] = useState<string | null | undefined>(undefined);
  return (
    <>
      <News s={s} players={players} />
      <Panel title={<>☀️ Tag {s.night}</>} sub="Das Dorf diskutiert und stimmt ab. Wen verurteilt das Dorf?">
        <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={(id) => setPick(id === pick ? undefined : id)}
          extra={{ label: "Niemand", selected: pick === null, onPick: () => setPick(pick === null ? undefined : null) }} />
      </Panel>
      <Button size="lg" className="shrink-0" disabled={pick === undefined} onClick={() => act({ type: "lynch", target: pick ?? null })}>
        {pick ? `${nameOf(players, pick)} verurteilen` : pick === null ? "Niemanden verurteilen" : "Auswahl treffen"}
      </Button>
    </>
  );
}

export function Hunter({ s, players, act }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const hunter = s.hunters[0];
  return (
    <>
      <News s={s} players={players} />
      <Panel title="🏹 Der Jäger schießt" sub={`${nameOf(players, hunter)} war Jäger und nimmt jemanden mit in den Tod.`}>
        <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={setPick} />
      </Panel>
      <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "shoot", target: pick })}>Schießen</Button>
    </>
  );
}
