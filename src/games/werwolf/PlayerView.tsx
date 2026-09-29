import { useState } from "react";
import { aliveIds, holders, isWolf, knownRoles, participants, ROLES, voters, type Role, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import type { Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AliveStrip, nameOf, News, Panel, Picker, RoleCard, RolePicker } from "./parts";

/**
 * Ansicht eines Mitspielers am eigenen Handy (online). Im Modus „App erzählt“ handelt jede Rolle hier geheim.
 * Wer nachts nichts zu tun hat, gibt einen Verdacht ab – so sieht jeder Bildschirm gleich beschäftigt aus.
 */
export function PlayerView({ s, players, me, isHost, act, enabled }: { s: WerwolfState; players: Player[]; me: string; isHost: boolean; act: (a: WerwolfAction) => void; enabled: Role[] }) {
  const role = s.roles[me];
  const alive = s.alive[me];
  const app = s.mode === "app";

  return (
    <>
      <AliveStrip s={s} players={players} me={me} />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {s.phase === "assign" ? (
          app ? (
            <>
              <Panel title="Welche Karte hast du gezogen?" sub={s.ready.includes(me) ? `Danke! Warte auf die anderen (${s.ready.length}/${participants(s).length}) …` : "Ihr spielt mit echten Karten. Tippe deine Rolle an – niemand sonst sieht sie."}>
                <RolePicker selected={s.ready.includes(me) ? role : null} prefer={enabled} onPick={(r) => act({ type: "claim", role: r })} />
              </Panel>
              {isHost && <Button variant="secondary" className="shrink-0" onClick={() => act({ type: "assignDone" })}>Alle fertig – Nacht beginnen</Button>}
            </>
          ) : <Panel title="Karten ziehen" sub="Zieh eine echte Karte und zeig sie nur dem Spielleiter. Er trägt die Rollen ein." />
        ) : s.phase === "reveal" ? (
          <>
            <Panel title="Deine Rolle" sub="Schau sie dir unauffällig an. Niemand darf mitlesen.">
              <RoleCard role={role} />
              <Allies s={s} players={players} me={me} />
            </Panel>
            {s.ready.includes(me)
              ? <p className="glass shrink-0 rounded-xl py-4 text-center text-muted-foreground">{app ? `Warte auf die anderen (${s.ready.length}/${Object.keys(s.roles).length}) …` : "Warte auf den Spielleiter …"}</p>
              : <Button size="lg" className="shrink-0" onClick={() => act({ type: "ready" })}>Gesehen – bereit</Button>}
            {app && isHost && <Button variant="secondary" className="shrink-0" onClick={() => act({ type: "startNight" })}>Nacht jetzt beginnen</Button>}
          </>
        ) : (
          <>
            <RoleCard role={role} compact />
            <Allies s={s} players={players} me={me} compact />
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
                <Panel title="Du bist tot ✝" sub={s.rules.deadTalk ? "Nach euren Hausregeln darfst du weiter mitreden – aber keine Rollen verraten!" : "Du darfst zuschauen – aber nichts verraten!"} />
                {app && isHost && (s.phase === "day" || s.phase === "election") && <CloseVote s={s} act={act} />}
                {s.phase === "successor" && <SuccessorPick s={s} players={players} me={me} app={app} isHost={isHost} act={act} />}
              </>
            ) : s.phase === "night" ? (
              app ? <AppNight s={s} players={players} me={me} act={act} /> : <Panel title={<>🌙 Nacht {s.night}</>} sub="Augen zu! Der Spielleiter ruft die Rollen auf. Öffne sie nur, wenn du gerufen wirst." />
            ) : s.phase === "successor" ? (
              <SuccessorPick s={s} players={players} me={me} app={app} isHost={isHost} act={act} />
            ) : s.phase === "election" ? (
              <>
                <News s={s} players={players} />
                {app ? <AppVote s={s} players={players} me={me} isHost={isHost} act={act} />
                  : <Panel title="👑 Hauptmannwahl" sub="Wählt per Handzeichen einen Hauptmann – seine Stimme zählt doppelt. Der Spielleiter trägt ihn ein." />}
              </>
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
  if (role === "dieb" && own("dieb")) {
    return (
      <Panel title={title} sub="🥷 Die zwei übrigen Karten – willst du tauschen?">
        <div className="grid gap-2">
          {s.extra.map((r, i) => <Button key={i} size="lg" variant="secondary" onClick={() => act({ type: "steal", pick: i })}>{ROLES[r].emoji} {ROLES[r].name} nehmen</Button>)}
          {!s.extra.every((r) => isWolf(r)) && <Button variant="ghost" onClick={() => act({ type: "steal", pick: null })}>Dieb bleiben</Button>}
        </div>
      </Panel>
    );
  }
  if (role === "wildeskind" && own("wildeskind")) {
    return (
      <>
        <Panel title={title} sub="🧒 Wähle dein Vorbild. Stirbt es, wirst du zum Werwolf.">
          <Picker ids={alive.filter((id) => id !== me)} players={players} selected={pick} onPick={one} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "model", target: pick[0] })}>Vorbild wählen</Button>
      </>
    );
  }
  if (role === "wolfshund" && own("wolfshund")) {
    return (
      <Panel title={title} sub="🐕 Bleibst du ein treuer Dorfbewohner – oder läufst du zu den Wölfen?">
        <div className="grid gap-2">
          <Button size="lg" variant="secondary" onClick={() => act({ type: "dog", wolf: false })}>🏡 Ich bleibe beim Dorf</Button>
          <Button size="lg" variant="secondary" onClick={() => act({ type: "dog", wolf: true })}>🐺 Ich werde Werwolf</Button>
        </div>
      </Panel>
    );
  }
  if (isWolf(role) && own("werwolf")) {
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
  if (role === "urwolf" && own("urwolf") && !s.pending.some((p) => p === "werwolf" && !s.acted.includes(p))) {
    return (
      <Panel title={title} sub={s.victim ? <>🌑 Das Rudel hat <b className="text-foreground">{nameOf(players, s.victim)}</b> gewählt. Verwandeln statt fressen? (nur einmal im Spiel)</> : "🌑 Heute Nacht gibt es kein Opfer."}>
        <div className="grid gap-2">
          {s.victim && <Button size="lg" variant="secondary" onClick={() => act({ type: "infect", yes: true })}>Verwandeln – wird zum Werwolf</Button>}
          <Button size="lg" variant="secondary" onClick={() => act({ type: "infect", yes: false })}>{s.victim ? "Nein, fressen" : "Weiter"}</Button>
        </div>
      </Panel>
    );
  }
  if (role === "grosserwolf" && own("grosserwolf") && !s.pending.some((p) => p === "werwolf" && !s.acted.includes(p))) {
    return (
      <>
        <Panel title={title} sub="🌕 Such dir allein ein zweites Opfer.">
          <Picker ids={alive.filter((id) => !isWolf(s.roles[id]) && id !== s.victim && id !== s.infected)} players={players} selected={pick} onPick={one} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "wolf2", target: pick[0] })}>Fressen</Button>
      </>
    );
  }
  if (role === "weisserwolf" && own("weisserwolf")) {
    return (
      <>
        <Panel title={title} sub="❄️ Heute darfst du allein einen Werwolf fressen – oder niemanden.">
          <Picker ids={alive.filter((id) => id !== me && isWolf(s.roles[id]))} players={players} selected={pick} onPick={one}
            extra={{ label: "Niemand", selected: false, onPick: () => act({ type: "white", target: null }) }} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "white", target: pick[0] })}>Fressen</Button>
      </>
    );
  }
  if (role === "floetenspieler" && own("floetenspieler")) {
    const open = alive.filter((id) => id !== me && !s.enchanted.includes(id));
    return (
      <>
        <Panel title={title} sub="🪈 Verzaubere zwei Menschen. Sind alle verzaubert, gewinnst du.">
          <Picker ids={open} players={players} selected={pick} onPick={two} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== Math.min(2, open.length)} onClick={() => act({ type: "enchant", a: pick[0], b: pick[1] })}>Verzaubern</Button>
      </>
    );
  }
  if (role === "fuchs" && own("fuchs")) {
    return (
      <>
        <Panel title={title} sub="🦊 Auf wen zeigst du? Du erfährst, ob dort oder bei den Nachbarn ein Wolf ist.">
          <Picker ids={alive} players={players} selected={pick} onPick={one} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "fox", target: pick[0] })}>Schnüffeln</Button>
      </>
    );
  }
  if (role === "schlampe" && own("schlampe")) {
    return (
      <>
        <Panel title={title} sub="💋 Bei wem übernachtest du heute? Greifen die Wölfe dein Haus an, bist du nicht da – aber beim Opfer oder bei einem Wolf stirbst du.">
          <Picker ids={alive.filter((id) => id !== me)} players={players} selected={pick} onPick={one} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "visit", target: pick[0] })}>Hier übernachten</Button>
      </>
    );
  }
  if (role === "rabe" && own("rabe")) {
    return (
      <>
        <Panel title={title} sub="🐦‍⬛ Wen markierst du? Er hat morgen zwei Stimmen mehr gegen sich.">
          <Picker ids={alive.filter((id) => id !== me)} players={players} selected={pick} onPick={one}
            extra={{ label: "Niemand", selected: false, onPick: () => act({ type: "raven", target: null }) }} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "raven", target: pick[0] })}>Markieren</Button>
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
    if ((s.pending.includes("werwolf") && !s.acted.includes("werwolf")) || (s.pending.includes("urwolf") && !s.acted.includes("urwolf"))) {
      return <Suspect s={s} players={players} me={me} act={act} hint="🧪 Die Werwölfe wählen noch. Gib derweil deinen Verdacht ab." />;
    }
    return (
      <>
        <Panel title={title} sub={s.victim ? <>🧪 Opfer der Werwölfe: <b className="text-foreground">{nameOf(players, s.victim)}</b></> : "🧪 Heute Nacht wurde niemand angegriffen."}>
          <label className={cn("mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-border", !s.potions.heal && "opacity-40")}>
            <Checkbox checked={heal} disabled={!s.potions.heal || !s.victim} onCheckedChange={(c) => setHeal(c === true)} />Heiltrank benutzen{!s.potions.heal && " (verbraucht)"}
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
  const sniff = role === "fuchs" ? s.fox.filter((x) => x.night === s.night).at(-1) : null;
  const hint = seen ? `🔮 ${nameOf(players, seen.target)} ist ${ROLES[seen.role].emoji} ${ROLES[seen.role].name}. Gib jetzt noch deinen Verdacht ab.`
    : sniff ? (sniff.wolf ? `🦊 Bei ${nameOf(players, sniff.target)} oder den Nachbarn steckt ein Wolf! Gib jetzt noch deinen Verdacht ab.` : `🦊 Dort ist kein Wolf – dein Spürsinn ist weg. Gib noch deinen Verdacht ab.`)
    : undefined;
  return <Suspect s={s} players={players} me={me} act={act} hint={hint} />;
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
  if (s.idiots.includes(me)) {
    return (
      <>
        <Panel title={<>☀️ Tag {s.night}</>} sub="Als aufgedeckter Dorfdepp darfst du nicht mehr abstimmen – aber mitreden!" />
        {isHost && <CloseVote s={s} act={act} />}
      </>
    );
  }
  const count = Object.keys(s.votes).length;
  return (
    <>
      <Panel title={s.phase === "election" ? "👑 Hauptmannwahl" : s.runoff ? <>⚖️ Stichwahl</> : <>☀️ Tag {s.night}</>}
        sub={mine === undefined
          ? s.phase === "election" ? "Wen wählt ihr zum Hauptmann? Seine Stimme zählt doppelt." : s.runoff ? "Gleichstand – jetzt nur zwischen diesen Personen." : "Diskutiert – dann stimmt jeder ab, wer verurteilt wird."
          : `Du hast abgestimmt. ${count}/${voters(s).length} Stimmen sind da.`}>
        <Picker ids={(s.runoff ?? alive).filter((id) => id !== me || s.phase === "election")} players={players} selected={mine ? [mine] : []} onPick={(id) => act({ type: "vote", target: id })}
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
  return <Button variant="secondary" className="shrink-0" disabled={!count} onClick={() => act({ type: "closeVote" })}>Abstimmung beenden ({count}/{voters(s).length})</Button>;
}

/** Wen kennt man sicher? Rudel, Schwester, Vorbild des wilden Kindes */
function Allies({ s, players, me, compact }: { s: WerwolfState; players: Player[]; me: string; compact?: boolean }) {
  const role = s.roles[me];
  const pack = isWolf(role) ? [...knownRoles(s)].filter((id) => id !== me && isWolf(s.roles[id])) : [];
  const sister = role === "schwester" ? holders(s, "schwester").filter((id) => id !== me && knownRoles(s).has(id)) : [];
  const lines: string[] = [];
  if (pack.length) lines.push(`🐺 Dein Rudel: ${pack.map((id) => `${nameOf(players, id)}${s.alive[id] ? "" : " ✝"}`).join(", ")}`);
  if (sister.length) lines.push(`👭 Deine Schwester: ${sister.map((id) => nameOf(players, id)).join(", ")}`);
  if (role === "wildeskind" && s.model) lines.push(`🧒 Dein Vorbild: ${nameOf(players, s.model)}`);
  if (role !== "floetenspieler" && s.enchanted.includes(me)) lines.push(`🪈 Du bist verzaubert – mit dir: ${s.enchanted.filter((id) => id !== me).map((id) => nameOf(players, id)).join(", ") || "noch niemand"}`);
  if (!lines.length) return null;
  return <div className={compact ? "shrink-0 rounded-xl bg-navy-950/50 px-3 py-1.5 text-sm" : "mt-3 text-center text-sm text-muted-foreground"}>{lines.map((l) => <div key={l}>{l}</div>)}</div>;
}

/** Der gestorbene Hauptmann bestimmt seinen Nachfolger (online), sonst warten */
function SuccessorPick({ s, players, me, app, isHost, act }: { s: WerwolfState; players: Player[]; me: string; app: boolean; isHost: boolean; act: (a: WerwolfAction) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  if (app && s.captain === me) {
    return (
      <>
        <Panel title="👑 Bestimme deinen Nachfolger" sub="Du bist gestorben. Wer wird neuer Hauptmann?">
          <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={setPick} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "successor", target: pick })}>Nachfolger bestimmen</Button>
      </>
    );
  }
  return <Panel title="👑 Neuer Hauptmann" sub={`${nameOf(players, s.captain)} bestimmt einen Nachfolger …${isHost && app ? " (Hängt es? Im Menü kannst du ihn zufällig bestimmen.)" : ""}`} />;
}
