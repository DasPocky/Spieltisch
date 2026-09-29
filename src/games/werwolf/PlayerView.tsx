import { useState } from "react";
import { aliveIds, holders, ROLES, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AliveStrip, nameOf, News, Panel, Picker, RoleCard } from "./parts";

/**
 * Ansicht eines Mitspielers am eigenen Handy (online). Im Modus „App erzählt“ handelt jede Rolle hier geheim.
 * Wer nachts nichts zu tun hat, gibt einen Verdacht ab – so sieht jeder Bildschirm gleich beschäftigt aus.
 */
export function PlayerView({ s, players, me, isHost, act }: { s: WerwolfState; players: Player[]; me: string; isHost: boolean; act: (a: WerwolfAction) => void }) {
  const role = s.roles[me];
  const alive = s.alive[me];
  const app = s.mode === "app";

  return (
    <>
      <AliveStrip s={s} players={players} me={me} />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {s.phase === "reveal" ? (
          <>
            <Panel title="Deine Rolle" sub="Schau sie dir unauffällig an. Niemand darf mitlesen.">
              <RoleCard role={role} />
              {role === "werwolf" && holders(s, "werwolf").length > 1 && (
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Dein Rudel: {holders(s, "werwolf").filter((id) => id !== me).map((id) => nameOf(players, id)).join(", ")}
                </p>
              )}
            </Panel>
            {s.ready.includes(me)
              ? <p className="glass shrink-0 rounded-xl py-4 text-center text-muted-foreground">{app ? `Warte auf die anderen (${s.ready.length}/${Object.keys(s.roles).length}) …` : "Warte auf den Spielleiter …"}</p>
              : <Button size="lg" className="shrink-0" onClick={() => act({ type: "ready" })}>Gesehen – bereit</Button>}
            {app && isHost && <Button variant="secondary" className="shrink-0" onClick={() => act({ type: "startNight" })}>Nacht jetzt beginnen</Button>}
          </>
        ) : (
          <>
            <RoleCard role={role} compact />
            {s.lovers?.includes(me) && (
              <p className="shrink-0 rounded-xl bg-pink-500/15 px-3 py-2 text-center text-sm font-semibold text-pink-200">
                💘 Du bist verliebt in {nameOf(players, s.lovers[0] === me ? s.lovers[1] : s.lovers[0])}
              </p>
            )}
            {s.phase === "hunter" ? (
              <HunterWait s={s} players={players} me={me} app={app} act={act} />
            ) : !alive ? (
              <>
                {s.phase === "day" && <News s={s} players={players} />}
                <Panel title="Du bist tot ✝" sub="Du darfst zuschauen – aber nichts verraten!" />
                {app && isHost && s.phase === "day" && <CloseVote s={s} act={act} />}
              </>
            ) : s.phase === "night" ? (
              app ? <AppNight s={s} players={players} me={me} act={act} /> : <Panel title={<>🌙 Nacht {s.night}</>} sub="Augen zu! Der Spielleiter ruft die Rollen auf. Öffne sie nur, wenn du gerufen wirst." />
            ) : s.phase === "day" ? (
              <>
                <News s={s} players={players} />
                {app ? <AppVote s={s} players={players} me={me} isHost={isHost} act={act} />
                  : <Panel title={<>☀️ Tag {s.night}</>} sub="Diskutiert, wer ein Werwolf sein könnte, und stimmt per Handzeichen ab. Der Spielleiter trägt das Urteil ein." />}
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function AppNight({ s, players, me, act }: { s: WerwolfState; players: Player[]; me: string; act: (a: WerwolfAction) => void }) {
  const role = s.roles[me];
  const [pick, setPick] = useState<string[]>([]);
  const [heal, setHeal] = useState(false);
  const alive = aliveIds(s);
  const own = (step: string) => s.pending.includes(step as never) && !s.acted.includes(step as never);
  const one = (id: string) => setPick((p) => (p[0] === id ? [] : [id]));
  const two = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
  const title = <>🌙 Nacht {s.night}</>;

  if (role === "amor" && own("amor")) {
    return (
      <>
        <Panel title={title} sub="💘 Wähle zwei Menschen, die sich verlieben (du darfst dich selbst wählen).">
          <Picker ids={alive} players={players} selected={pick} onPick={two} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 2} onClick={() => act({ type: "amor", a: pick[0], b: pick[1] })}>Verlieben</Button>
      </>
    );
  }
  if (role === "beschuetzer" && own("beschuetzer")) {
    return (
      <>
        <Panel title={title} sub="🛡️ Wen beschützt du heute Nacht?">
          <Picker ids={alive} players={players} selected={pick} onPick={one} disabled={(id) => id === s.lastProtected} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "protect", target: pick[0] })}>Beschützen</Button>
      </>
    );
  }
  if (role === "werwolf" && own("werwolf")) {
    const votes: Record<string, number> = {};
    for (const t of Object.values(s.wolfVotes)) votes[t] = (votes[t] ?? 0) + 1;
    const mine = s.wolfVotes[me];
    return (
      <>
        <Panel title={title} sub={mine ? "🐺 Warte, bis alle Wölfe gewählt haben – ihr könnt eure Wahl noch ändern. Bei Gleichstand entscheidet der Zufall." : "🐺 Wen fresst ihr heute Nacht? Die Zahlen zeigen die Stimmen deines Rudels."}>
          <Picker ids={alive.filter((id) => s.roles[id] !== "werwolf")} players={players} selected={mine ? [mine] : pick}
            onPick={(id) => { one(id); act({ type: "wolf", target: id }); }} marks={Object.fromEntries(Object.entries(votes).map(([id, n]) => [id, `🐺${n}`]))} />
        </Panel>
      </>
    );
  }
  if (role === "seherin" && own("seherin")) {
    return (
      <>
        <Panel title={title} sub="🔮 Wessen Rolle möchtest du sehen?">
          <Picker ids={alive.filter((id) => id !== me)} players={players} selected={pick} onPick={one} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "see", target: pick[0] })}>Rolle ansehen</Button>
      </>
    );
  }
  if (role === "hexe" && own("hexe")) {
    if (s.pending.includes("werwolf") && !s.acted.includes("werwolf")) {
      return <Suspect s={s} players={players} me={me} act={act} hint="🧪 Die Werwölfe wählen noch. Gib derweil deinen Verdacht ab." />;
    }
    return (
      <>
        <Panel title={title} sub={<>🧪 Opfer der Werwölfe: <b className="text-foreground">{nameOf(players, s.victim)}</b></>}>
          <label className={cn("mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-border", !s.potions.heal && "opacity-40")}>
            <Checkbox checked={heal} disabled={!s.potions.heal} onCheckedChange={(c) => setHeal(c === true)} />Heiltrank benutzen{!s.potions.heal && " (verbraucht)"}
          </label>
          {s.potions.poison ? (
            <>
              <div className="mb-2 text-sm font-semibold text-muted-foreground">☠ Optional vergiften:</div>
              <Picker ids={alive.filter((id) => id !== me)} players={players} selected={pick} onPick={one} />
            </>
          ) : <p className="text-sm text-muted-foreground">☠ Gifttrank verbraucht.</p>}
        </Panel>
        <Button size="lg" className="shrink-0" onClick={() => act({ type: "witch", heal, poison: pick[0] ?? null })}>Bestätigen</Button>
      </>
    );
  }
  const seen = role === "seherin" ? s.seer.filter((x) => x.night === s.night).at(-1) : null;
  return <Suspect s={s} players={players} me={me} act={act} hint={seen ? `🔮 ${nameOf(players, seen.target)} ist ${ROLES[seen.role].emoji} ${ROLES[seen.role].name}. Gib jetzt noch deinen Verdacht ab.` : undefined} />;
}

/** Tarn-Aufgabe für alle, die nachts nichts zu tun haben */
function Suspect({ s, players, me, act, hint }: { s: WerwolfState; players: Player[]; me: string; act: (a: WerwolfAction) => void; hint?: string }) {
  const mine = s.suspicions[me];
  return (
    <Panel title={<>🌙 Nacht {s.night}</>} sub={hint ?? (mine ? "Danke. Warte, bis es Tag wird …" : "Wen verdächtigst du? Der Verdacht wird morgens anonym gezeigt.")}>
      <Picker ids={aliveIds(s).filter((id) => id !== me)} players={players} selected={mine ? [mine] : []} onPick={(id) => act({ type: "suspect", target: id })} />
    </Panel>
  );
}

function AppVote({ s, players, me, isHost, act }: { s: WerwolfState; players: Player[]; me: string; isHost: boolean; act: (a: WerwolfAction) => void }) {
  const mine = s.votes[me];
  const alive = aliveIds(s);
  const count = Object.keys(s.votes).length;
  return (
    <>
      <Panel title={<>☀️ Tag {s.night}</>} sub={mine === undefined ? "Diskutiert – dann stimmt jeder ab, wer verurteilt wird." : `Du hast abgestimmt. ${count}/${alive.length} Stimmen sind da.`}>
        <Picker ids={alive.filter((id) => id !== me)} players={players} selected={mine ? [mine] : []} onPick={(id) => act({ type: "vote", target: id })}
          extra={{ label: "Enthaltung", selected: mine === "", onPick: () => act({ type: "vote", target: "" }) }} />
      </Panel>
      {isHost && <CloseVote s={s} act={act} />}
    </>
  );
}

function HunterWait({ s, players, me, app, act }: { s: WerwolfState; players: Player[]; me: string; app: boolean; act: (a: WerwolfAction) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const hunter = s.hunters[0];
  if (app && hunter === me) {
    return (
      <>
        <News s={s} players={players} />
        <Panel title="🏹 Du bist gestorben – schieß!" sub="Als Jäger nimmst du jemanden mit in den Tod.">
          <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={setPick} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "shoot", target: pick })}>Schießen</Button>
      </>
    );
  }
  return (
    <>
      <News s={s} players={players} />
      <Panel title="🏹 Der Jäger zielt …" sub={`${nameOf(players, hunter)} war Jäger und nimmt jemanden mit in den Tod.`} />
    </>
  );
}

/** Der Host kann die Abstimmung beenden – auch wenn er schon tot ist */
function CloseVote({ s, act }: { s: WerwolfState; act: (a: WerwolfAction) => void }) {
  const count = Object.keys(s.votes).length;
  return <Button variant="secondary" className="shrink-0" disabled={!count} onClick={() => act({ type: "closeVote" })}>Abstimmung beenden ({count}/{aliveIds(s).length})</Button>;
}
