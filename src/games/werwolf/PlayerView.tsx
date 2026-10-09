import { useState, type ReactNode } from "react";
import { Baby, Bird, Crosshair, Crown, Dog, Eye, FlaskConical, Heart, House, Moon, MoonStar, Music, PawPrint, Scale, Search, Shield, Skull, Snowflake, Sun, Users, BedDouble, VenetianMask, type LucideIcon } from "lucide-react";
import { aliveIds, holders, isWolf, knownRoles, participants, ROLES, STEP_ROLE, voters, wolfAt, type Role, type Step, type WerwolfAction, type WerwolfState, wolf2Targets } from "@shared/games/werwolf/logic";
import type { RoomAction } from "@shared/platform/room";
import type { Options, Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AliveStrip, Ico, IconTitle, nameOf, News, Panel, Picker, RoleCard, RolePicker } from "./parts";
import { RulesSheet } from "@/platform/RulesSheet";
import { OnlineClock } from "./OnlineClock";
import { RoleIcon } from "./RoleIcon";
import { SCRIPT } from "./script";

/**
 * Ansicht eines Mitspielers am eigenen Handy (online). Im Modus „App erzählt“ handelt jede Rolle hier geheim.
 * Wer nachts nichts zu tun hat, gibt einen Verdacht ab – so sieht jeder Bildschirm gleich beschäftigt aus.
 */
export function PlayerView({ s, players, me, isHost, act, enabled, options, dispatch }: {
  s: WerwolfState; players: Player[]; me: string; isHost: boolean; act: (a: WerwolfAction) => void; enabled: Role[]; options: Options; dispatch: (a: RoomAction) => void;
}) {
  const role = s.roles[me];
  const alive = s.alive[me];
  const app = s.mode === "app";

  return (
    <>
      <AliveStrip s={s} players={players} me={me} />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <OnlineClock s={s} players={players} isHost={isHost} options={options} dispatch={dispatch} />
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
            <Panel title={<span className="flex items-center justify-between gap-2">Deine Rolle<RulesSheet gameId="werwolf" focus={role} /></span>} sub="Schau sie dir unauffällig an. Niemand darf mitlesen. Mehr zur Rolle: Info-Knopf.">
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
            {/* Eigene Rolle immer griffbereit, mit „Mehr dazu“ (Regelseite springt zur Rolle) */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="min-w-0 flex-1"><RoleCard role={role} compact /></div>
              <RulesSheet gameId="werwolf" focus={role} />
            </div>
            <Allies s={s} players={players} me={me} compact />
            {s.lovers?.includes(me) && (
              <p className="shrink-0 rounded-xl bg-navy-600/40 px-3 py-2 text-center text-sm font-semibold text-navy-100">
                <Ico icon={Heart} className="mr-1.5" />Du bist verliebt in {nameOf(players, s.lovers[0] === me ? s.lovers[1] : s.lovers[0])}
                <span className="block text-xs font-normal opacity-80">Stirbt einer, stirbt auch der andere.</span>
              </p>
            )}
            {s.phase === "hunter" ? (
              <HunterWait s={s} players={players} me={me} app={app} act={act} />
            ) : !alive ? (
              <>
                {s.phase === "day" && <News s={s} players={players} />}
                <Panel title={<IconTitle icon={Skull}>Du bist tot</IconTitle>} sub={s.rules.deadTalk ? "Nach euren Hausregeln darfst du weiter mitreden – aber keine Rollen verraten!" : "Du darfst zuschauen – aber nichts verraten!"} />
                {app && isHost && (s.phase === "day" || s.phase === "election") && <CloseVote s={s} act={act} />}
                {s.phase === "successor" && <SuccessorPick s={s} players={players} me={me} app={app} isHost={isHost} act={act} />}
              </>
            ) : s.phase === "night" ? (
              app ? <AppNight s={s} players={players} me={me} act={act} /> : <Panel title={<IconTitle icon={Moon}>Nacht {s.night}</IconTitle>} sub="Augen zu! Der Spielleiter ruft die Rollen auf. Öffne sie nur, wenn du gerufen wirst." />
            ) : s.phase === "successor" ? (
              <SuccessorPick s={s} players={players} me={me} app={app} isHost={isHost} act={act} />
            ) : s.phase === "election" ? (
              <>
                <News s={s} players={players} />
                {app ? <AppVote s={s} players={players} me={me} isHost={isHost} act={act} />
                  : <Panel title={<IconTitle icon={Crown}>Hauptmannwahl</IconTitle>} sub="Wählt per Handzeichen einen Hauptmann – seine Stimme zählt doppelt. Der Spielleiter trägt ihn ein." />}
              </>
            ) : s.phase === "day" ? (
              <>
                <News s={s} players={players} />
                {app ? <AppVote s={s} players={players} me={me} isHost={isHost} act={act} />
                  : <Panel title={<IconTitle icon={Sun}>Tag {s.night}</IconTitle>} sub="Diskutiert, wer ein Werwolf sein könnte, und stimmt per Handzeichen ab. Der Spielleiter trägt das Urteil ein." />}
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
  // Nacheinander: nur die Rolle, die gerade aufgerufen ist
  const cur = s.awake !== undefined ? s.awake : s.pending[0];
  const own = (step: string) => s.pending.includes(step as never) && !s.acted.includes(step as never) && (!s.seq || cur === step);
  const one = (id: string) => setPick((p) => (p[0] === id ? [] : [id]));
  const two = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
  const title = <IconTitle icon={Moon}>Nacht {s.night}</IconTitle>;
  const say = (icon: LucideIcon, text: ReactNode) => <><Ico icon={icon} className="mr-1.5" />{text}</>;

  if (role === "amor" && own("amor")) {
    return (
      <>
        <Panel title={title} sub={say(Heart, "Wähle zwei Menschen, die sich verlieben (du darfst dich selbst wählen).")}>
          <Picker ids={alive} players={players} selected={pick} onPick={two} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 2} onClick={() => act({ type: "amor", a: pick[0], b: pick[1] })}>Verlieben</Button>
      </>
    );
  }
  if (role === "beschuetzer" && own("beschuetzer")) {
    return (
      <>
        <Panel title={title} sub={say(Shield, "Wen beschützt du heute Nacht?")}>
          <Picker ids={alive} players={players} selected={pick} onPick={one} disabled={(id) => id === s.lastProtected} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "protect", target: pick[0] })}>Beschützen</Button>
      </>
    );
  }
  if (role === "dieb" && own("dieb")) {
    return (
      <Panel title={title} sub={say(VenetianMask, "Die zwei übrigen Karten – willst du tauschen?")}>
        <div className="grid gap-2">
          {s.extra.map((r, i) => <Button key={i} size="lg" variant="secondary" onClick={() => act({ type: "steal", pick: i })}><RoleIcon role={r} className="size-5" />{ROLES[r].name} nehmen</Button>)}
          {!s.extra.every((r) => isWolf(r)) && <Button variant="ghost" onClick={() => act({ type: "steal", pick: null })}>Dieb bleiben</Button>}
        </div>
      </Panel>
    );
  }
  if (role === "wildeskind" && own("wildeskind")) {
    return (
      <>
        <Panel title={title} sub={say(Baby, "Wähle dein Vorbild. Stirbt es, wirst du zum Werwolf.")}>
          <Picker ids={alive.filter((id) => id !== me)} players={players} selected={pick} onPick={one} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "model", target: pick[0] })}>Vorbild wählen</Button>
      </>
    );
  }
  if (role === "wolfshund" && own("wolfshund")) {
    return (
      <Panel title={title} sub={say(Dog, "Bleibst du ein treuer Dorfbewohner – oder läufst du zu den Wölfen?")}>
        <div className="grid gap-2">
          <Button size="lg" variant="secondary" onClick={() => act({ type: "dog", wolf: false })}><House className="size-5" />Ich bleibe beim Dorf</Button>
          <Button size="lg" variant="secondary" onClick={() => act({ type: "dog", wolf: true })}><PawPrint className="size-5" />Ich werde Werwolf</Button>
        </div>
      </Panel>
    );
  }
  // Verwandelte haben oft noch eine eigene Aufgabe – nach der Wolfsstimme kommt die dran
  const roleTask = (Object.keys(STEP_ROLE) as Step[]).some((p) => p !== "werwolf" && STEP_ROLE[p] === role && own(p));
  if (wolfAt(s, me) && own("werwolf") && !(s.wolfVotes[me] && roleTask)) {
    const votes: Record<string, number> = {};
    for (const t of Object.values(s.wolfVotes)) votes[t] = (votes[t] ?? 0) + 1;
    const mine = s.wolfVotes[me];
    return (
      <>
        <Panel title={title} sub={say(PawPrint, mine ? "Warte, bis alle Wölfe gewählt haben – ihr könnt eure Wahl noch ändern. Bei Gleichstand entscheidet der Zufall." : "Wen fresst ihr heute Nacht? Die Zahlen zeigen die Stimmen deines Rudels.")}>
          <Picker ids={alive.filter((id) => !wolfAt(s, id))} players={players} selected={mine ? [mine] : pick}
            onPick={(id) => { one(id); act({ type: "wolf", target: id }); }} marks={Object.fromEntries(Object.entries(votes).map(([id, n]) => [id, <span className="inline-flex items-center gap-0.5"><PawPrint aria-hidden="true" className="size-3.5" />{n}</span>]))} />
        </Panel>
      </>
    );
  }
  if (role === "urwolf" && own("urwolf") && !s.pending.some((p) => p === "werwolf" && !s.acted.includes(p))) {
    return (
      <Panel title={title} sub={say(MoonStar, s.victim ? <>Das Rudel hat <b className="text-foreground">{nameOf(players, s.victim)}</b> gewählt. Verwandeln statt fressen? (nur einmal im Spiel)</> : "Heute Nacht gibt es kein Opfer.")}>
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
        <Panel title={title} sub={say(Skull, "Such dir allein ein zweites Opfer.")}>
          <Picker ids={alive.filter((id) => !wolfAt(s, id) && id !== s.victim && id !== s.infected)} players={players} selected={pick} onPick={one} />
        </Panel>
        {wolf2Targets(s).length
          ? <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "wolf2", target: pick[0] })}>Fressen</Button>
          : <Button size="lg" className="shrink-0" variant="secondary" onClick={() => act({ type: "wolf2", target: null })}>Kein zweites Opfer möglich – weiter</Button>}
      </>
    );
  }
  if (role === "weisserwolf" && own("weisserwolf")) {
    return (
      <>
        <Panel title={title} sub={say(Snowflake, "Heute darfst du allein einen Werwolf fressen – oder niemanden.")}>
          <Picker ids={alive.filter((id) => id !== me && wolfAt(s, id))} players={players} selected={pick} onPick={one}
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
        <Panel title={title} sub={say(Music, "Verzaubere zwei Menschen. Sind alle verzaubert, gewinnst du.")}>
          <Picker ids={open} players={players} selected={pick} onPick={two} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== Math.min(2, open.length)} onClick={() => act({ type: "enchant", a: pick[0], b: pick[1] })}>Verzaubern</Button>
      </>
    );
  }
  if (role === "fuchs" && own("fuchs")) {
    return (
      <>
        <Panel title={title} sub={say(Search, "Auf wen zeigst du? Du erfährst, ob dort oder bei den Nachbarn ein Wolf ist.")}>
          <Picker ids={alive} players={players} selected={pick} onPick={one} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "fox", target: pick[0] })}>Schnüffeln</Button>
      </>
    );
  }
  if (role === "schlampe" && own("schlampe")) {
    return (
      <>
        <Panel title={title} sub={say(BedDouble, "Bei wem übernachtest du heute? Greifen die Wölfe dein Haus an, bist du nicht da – aber beim Opfer oder bei einem Wolf stirbst du.")}>
          <Picker ids={alive.filter((id) => id !== me)} players={players} selected={pick} onPick={one} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "visit", target: pick[0] })}>Hier übernachten</Button>
      </>
    );
  }
  if (role === "rabe" && own("rabe")) {
    return (
      <>
        <Panel title={title} sub={say(Bird, "Wen markierst du? Er hat morgen zwei Stimmen mehr gegen sich.")}>
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
        <Panel title={title} sub={say(Eye, "Wessen Rolle möchtest du sehen?")}>
          <Picker ids={alive.filter((id) => id !== me)} players={players} selected={pick} onPick={one} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={pick.length !== 1} onClick={() => act({ type: "see", target: pick[0] })}>Rolle ansehen</Button>
      </>
    );
  }
  if (role === "hexe" && own("hexe")) {
    if ((s.pending.includes("werwolf") && !s.acted.includes("werwolf")) || (s.pending.includes("urwolf") && !s.acted.includes("urwolf"))) {
      return <Suspect s={s} players={players} me={me} act={act} hint={say(FlaskConical, "Die Werwölfe wählen noch. Gib derweil deinen Verdacht ab.")} />;
    }
    return (
      <>
        <Panel title={title} sub={say(FlaskConical, s.victim ? <>Opfer der Werwölfe: <b className="text-foreground">{nameOf(players, s.victim)}</b></> : "Heute Nacht wurde niemand angegriffen.")}>
          <label className={cn("mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-border", !s.potions.heal && "opacity-40")}>
            <Checkbox checked={heal} disabled={!s.potions.heal || !s.victim} onCheckedChange={(c) => setHeal(c === true)} />Heiltrank benutzen{!s.potions.heal && " (verbraucht)"}
          </label>
          {s.potions.poison ? (
            <>
              <div className="mb-2 text-sm font-semibold text-muted-foreground"><Ico icon={Skull} className="mr-1.5" />Optional vergiften:</div>
              <Picker ids={alive.filter((id) => id !== me)} players={players} selected={pick} onPick={one} />
            </>
          ) : <p className="text-sm text-muted-foreground"><Ico icon={Skull} className="mr-1.5" />Gifttrank verbraucht.</p>}
        </Panel>
        <Button size="lg" className="shrink-0" onClick={() => act({ type: "witch", heal, poison: pick[0] ?? null })}>Bestätigen</Button>
      </>
    );
  }
  const seen = role === "seherin" ? s.seer.filter((x) => x.night === s.night).at(-1) : null;
  const sniff = role === "fuchs" ? s.fox.filter((x) => x.night === s.night).at(-1) : null;
  const hint = seen ? say(Eye, <>{nameOf(players, seen.target)} ist <b className="text-foreground"><RoleIcon role={seen.role} className="mr-1" />{ROLES[seen.role].name}</b>. Gib jetzt noch deinen Verdacht ab.</>)
    : sniff ? say(Search, sniff.wolf ? `Bei ${nameOf(players, sniff.target)} oder den Nachbarn steckt ein Wolf! Gib jetzt noch deinen Verdacht ab.` : "Dort ist kein Wolf – dein Spürsinn ist weg. Gib noch deinen Verdacht ab.")
    : undefined;
  if (s.seq) {
    // Wer gerade nicht dran ist: Augen zu. Das Ergebnis der eigenen Rolle bleibt bis zum Morgen stehen.
    return (
      <Panel title={<IconTitle icon={Moon}>Nacht {s.night}</IconTitle>} sub={seen || sniff ? <>{seen ? say(Eye, <>{nameOf(players, seen.target)} ist <b className="text-foreground"><RoleIcon role={seen.role} className="mr-1" />{ROLES[seen.role].name}</b>.</>) : say(Search, sniff!.wolf ? `Bei ${nameOf(players, sniff!.target)} oder den Nachbarn steckt ein Wolf!` : "Dort ist kein Wolf – dein Spürsinn ist weg.")} Merk es dir – dann Augen zu.</> : undefined}>
        <div className="grid place-items-center gap-2 py-6 text-center" data-testid="eyes-closed">
          <MoonStar className="size-10 text-navy-300" aria-hidden="true" />
          <div className="text-xl font-bold">Augen zu!</div>
          <p className="text-sm text-muted-foreground">{cur ? <>Wach ist gerade: <b className="text-foreground">{SCRIPT[cur].title}</b>. Du wirst aufgerufen, wenn du dran bist.</> : "Gleich wird es Tag."}</p>
        </div>
      </Panel>
    );
  }
  return <Suspect s={s} players={players} me={me} act={act} hint={hint} />;
}



/** Tarn-Aufgabe für alle, die nachts nichts zu tun haben */
function Suspect({ s, players, me, act, hint }: { s: WerwolfState; players: Player[]; me: string; act: (a: WerwolfAction) => void; hint?: ReactNode }) {
  const mine = s.suspicions[me];
  return (
    <Panel title={<IconTitle icon={Moon}>Nacht {s.night}</IconTitle>} sub={hint ?? (mine ? "Danke. Warte, bis es Tag wird …" : "Heute Nacht hast du keine Aufgabe. Wen verdächtigst du? Das wird morgens anonym gezeigt.")}>
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
        <Panel title={<IconTitle icon={Sun}>Tag {s.night}</IconTitle>} sub="Als aufgedeckter Dorfdepp darfst du nicht mehr abstimmen – aber mitreden!" />
        {isHost && <CloseVote s={s} act={act} />}
      </>
    );
  }
  const count = Object.keys(s.votes).length;
  return (
    <>
      <Panel title={s.phase === "election" ? <IconTitle icon={Crown}>Hauptmannwahl</IconTitle> : s.runoff ? <IconTitle icon={Scale}>Stichwahl</IconTitle> : <IconTitle icon={Sun}>Tag {s.night}</IconTitle>}
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
        <Panel title={<IconTitle icon={Crosshair}>Du bist gestorben – schieß!</IconTitle>} sub="Als Jäger nimmst du jemanden mit in den Tod.">
          <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={setPick} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "shoot", target: pick })}>Schießen</Button>
      </>
    );
  }
  return (
    <>
      <News s={s} players={players} />
      <Panel title={<IconTitle icon={Crosshair}>Der Jäger zielt …</IconTitle>} sub={`${nameOf(players, hunter)} war Jäger und nimmt jemanden mit in den Tod.`} />
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
  const pack = wolfAt(s, me) ? [...knownRoles(s)].filter((id) => id !== me && wolfAt(s, id)) : [];
  const sister = role === "schwester" ? holders(s, "schwester").filter((id) => id !== me && knownRoles(s).has(id)) : [];
  const lines: [LucideIcon, string][] = [];
  if (s.converted.includes(me)) lines.push([PawPrint, "Der Urwolf hat dich verwandelt: Du jagst mit den Wölfen und gewinnst mit ihnen – deine Fähigkeit behältst du."]);
  if (pack.length) lines.push([PawPrint, `Dein Rudel: ${pack.map((id) => `${nameOf(players, id)}${s.alive[id] ? "" : " (tot)"}`).join(", ")}`]);
  if (sister.length) lines.push([Users, `Deine Schwester: ${sister.map((id) => nameOf(players, id)).join(", ")}`]);
  if (role === "wildeskind" && s.model) lines.push([Baby, `Dein Vorbild: ${nameOf(players, s.model)}`]);
  if (role !== "floetenspieler" && s.enchanted.includes(me)) lines.push([Music, `Du bist verzaubert – mit dir: ${s.enchanted.filter((id) => id !== me).map((id) => nameOf(players, id)).join(", ") || "noch niemand"}`]);
  if (!lines.length) return null;
  return <div className={compact ? "shrink-0 rounded-xl bg-navy-950/50 px-3 py-1.5 text-sm" : "mt-3 text-center text-sm text-muted-foreground"}>{lines.map(([icon, l]) => <div key={l}><Ico icon={icon} className="mr-1.5" />{l}</div>)}</div>;
}

/** Der gestorbene Hauptmann bestimmt seinen Nachfolger (online), sonst warten */
function SuccessorPick({ s, players, me, app, isHost, act }: { s: WerwolfState; players: Player[]; me: string; app: boolean; isHost: boolean; act: (a: WerwolfAction) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  if (app && s.captain === me) {
    return (
      <>
        <Panel title={<IconTitle icon={Crown}>Bestimme deinen Nachfolger</IconTitle>} sub="Du bist gestorben. Wer wird neuer Hauptmann?">
          <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={setPick} />
        </Panel>
        <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "successor", target: pick })}>Nachfolger bestimmen</Button>
      </>
    );
  }
  return <Panel title={<IconTitle icon={Crown}>Neuer Hauptmann</IconTitle>} sub={`${nameOf(players, s.captain)} bestimmt einen Nachfolger …${isHost && app ? " (Hängt es? Im Menü kannst du ihn zufällig bestimmen.)" : ""}`} />;
}
