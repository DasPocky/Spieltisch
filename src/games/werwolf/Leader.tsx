import { useEffect, useState } from "react";
import { Check, Crown, Pause, Play, Smartphone, Crosshair, FlaskConical, Heart, House, Moon, MoonStar, Music, PawPrint, Search, Skull, Sun, Users, Volume2, VolumeX } from "lucide-react";
import { aliveIds, aliveWolves, holders, isWolf, participants, ROLES, STEP_ROLE, voters, type Role, type Step, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import type { Options, Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { RulesSheet } from "@/platform/RulesSheet";
import { cn } from "@/lib/utils";
import { AliveStrip, Ico, IconTitle, nameOf, News, Panel, Picker, RoleCard, RolePicker } from "./parts";
import { RoleIcon } from "./RoleIcon";
import { AUTO_SAY, DAWN_SAY, SCRIPT } from "./script";
import { setSpeech, speak, speechSupported, useSpeak, useSpeechEnabled, useSpokenCountdown } from "./useSpeech";
import { AutoRunner, HoldButton, Timer, INFO_STEPS, RESULT_STEPS, stepSeconds, tempoOf, useCountdown } from "./Auto";

/**
 * Ansicht für den Spielleiter (online) bzw. das Gerät in der Mitte (lokal).
 * Führt Schritt für Schritt durch die Nacht und liest auf Wunsch vor.
 * Im Modus „App erzählt“ lokal sind die Rollen verborgen – dann tippen die aufgerufenen Rollen selbst.
 */
export function Leader({ s, players, act, online, enabled, options }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; online: boolean; enabled: Role[]; options: Options }) {
  const showRoles = s.mode === "human";
  const speech = useSpeechEnabled(s.mode === "app");
  // Automatik: ein Handy in der Mitte, die App erzählt und taktet selbst
  const auto = !online && s.mode === "app" && options.auto !== false;
  const step = s.phase === "night" ? s.pending[0] : null;
  // In der Automatik liest der Nachtschritt selbst vor (mit Wartezeiten), der Tag seine Nachrichten
  const say = s.phase === "election" ? "Das Dorf wählt einen Hauptmann."
    : s.phase === "hunter" ? `${nameOf(players, s.hunters[0])} war Jäger und nimmt jemanden mit in den Tod.`
    : s.phase === "successor" ? "Der Hauptmann ist tot. Er bestimmt einen Nachfolger."
    : step && !auto ? SCRIPT[step].say : "";
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
        {s.phase === "assign" && <Assign s={s} players={players} act={act} enabled={enabled} />}
        {s.phase === "reveal" && (auto ? <GuidedReveal s={s} players={players} act={act} /> : <Reveal s={s} players={players} act={act} online={online} />)}
        {s.phase === "election" && <Election s={s} players={players} act={act} />}
        {s.phase === "successor" && <Successor s={s} players={players} act={act} />}
        {s.phase === "night" && step && <NightStep key={`${s.night}-${step}`} s={s} players={players} act={act} showRoles={showRoles} auto={auto} options={options} />}
        {s.phase === "day" && <Day key={s.night} s={s} players={players} act={act} options={options} speech={speech && s.mode === "app"} />}
        {s.phase === "hunter" && <Hunter s={s} players={players} act={act} />}
      </div>
    </>
  );
}

/**
 * Automatik: Das Handy geht der Reihe nach herum („Gib das Handy an …“). Hat jeder seine Rolle gesehen,
 * kommt das Handy in die Mitte und die Nacht beginnt von selbst.
 */
function GuidedReveal({ s, players, act }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void }) {
  const order = participants(s);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const done = i >= order.length;
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const left = useCountdown(doneAt === null ? null : doneAt + 6000, false);
  useEffect(() => {
    if (!done) return;
    setDoneAt(Date.now());
    void speak("Alle kennen ihre Rolle. Legt das Handy in die Mitte.");
    const t = setTimeout(() => act({ type: "startNight" }), 6000);
    return () => clearTimeout(t);
  }, [done, act]);
  if (done) {
    return (
      <Panel title="Alle kennen ihre Rolle" sub="Legt das Handy in die Mitte – gleich beginnt die Nacht.">
        <div className="grid flex-1 place-content-center justify-items-center gap-2">
          <Moon className="size-12 text-ice" />
          <span className="text-5xl font-extrabold tabular-nums">{left ?? 6}</span>
        </div>
        <Button variant="secondary" onClick={() => act({ type: "startNight" })}>Jetzt beginnen</Button>
      </Panel>
    );
  }
  const who = order[i];
  if (!open) {
    return (
      <>
        <Panel title={`Gib das Handy an ${nameOf(players, who)}`} sub={`Rollen ansehen · ${i + 1} von ${order.length}. Die anderen schauen weg.`}>
          <div className="grid flex-1 place-content-center justify-items-center gap-3">
            <Smartphone className="size-12 text-navy-300" />
            <span className="text-4xl font-extrabold" data-testid="reveal-next">{nameOf(players, who)}</span>
          </div>
        </Panel>
        <Button size="lg" className="shrink-0" onClick={() => setOpen(true)}>Ich bin {nameOf(players, who)}</Button>
      </>
    );
  }
  return (
    <>
      <Panel title={<span className="flex items-center justify-between gap-2">Nur {nameOf(players, who)} schaut!<RulesSheet gameId="werwolf" focus={s.roles[who]} /></span>}
        sub="Tippe auf die Karte, merk dir Rolle und Ziel und verdecke sie wieder.">
        <RoleCard role={s.roles[who]} />
      </Panel>
      <Button size="lg" className="shrink-0" onClick={() => { setOpen(false); setI(i + 1); }}>{i + 1 < order.length ? "Verdeckt – weitergeben" : "Verdeckt – fertig"}</Button>
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
                <span className="font-semibold"><RoleIcon role={s.roles[id]} className="mr-2 text-navy-200" />{nameOf(players, id)}</span>
                <span className="text-sm text-muted-foreground">{ROLES[s.roles[id]].name}{s.ready.includes(id) && <> · <Ico icon={Check} className="text-ice" /></>}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Button size="lg" className="shrink-0" onClick={() => act({ type: "startNight" })}><Moon />Nacht beginnen</Button>
      </>
    );
  }
  if (peek) {
    return (
      <>
        <Panel title={<span className="flex items-center justify-between gap-2">Nur {nameOf(players, peek)} schaut!<RulesSheet gameId="werwolf" focus={s.roles[peek]} /></span>}
          sub="Tippe auf die Karte, merk dir Rolle und Ziel, verdecke sie wieder und gib das Handy weiter. Mehr zur Rolle: Info-Knopf.">
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
        <Picker ids={participants(s)} players={players} selected={[]} onPick={setPeek} marks={Object.fromEntries(seen.map((id) => [id, <Check aria-label="gesehen" className="size-4" />]))} />
      </Panel>
      <Button size="lg" className="shrink-0" variant={all ? "default" : "secondary"} onClick={() => act({ type: "startNight" })}>
        <Moon />{all ? "Alle kennen ihre Rolle – Nacht beginnen" : "Nacht beginnen"}
      </Button>
    </>
  );
}

function NightStep({ s, players, act, showRoles, auto, options }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; showRoles: boolean; auto: boolean; options: Options }) {
  const step = s.pending[0];
  const script = SCRIPT[step];
  const acted = s.acted.includes(step);
  const [pick, setPick] = useState<string[]>([]);
  const alive = aliveIds(s);
  const who = (ids: string[]) => ids.map((id) => nameOf(players, id)).join(", ");
  const awake = step === "werwolf" ? aliveWolves(s) : step === "schwestern" ? holders(s, "schwester") : step === "verzaubert" ? s.enchanted : STEP_ROLE[step] ? holders(s, STEP_ROLE[step]!).filter((id) => s.alive[id]) : [];
  const toggle = (id: string, max: number) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-max)));

  let body: React.ReactNode = null;
  let confirm: { label: string; ok: boolean; run: () => void } | null = null;

  if (step === "dieb" && !acted) {
    body = s.rules.ownCards ? (
      <>
        <p className="mb-2 text-sm text-muted-foreground">Hat der Dieb getauscht? Tippe seine neue Rolle an – oder „Weiter“ ohne Tausch.</p>
        <RolePicker selected={null} onPick={(r) => act({ type: "steal", pick: null, role: r })} />
      </>
    ) : (
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">Die zwei übrigen Karten:</p>
        {s.extra.map((r, i) => <Button key={i} size="lg" variant="secondary" onClick={() => act({ type: "steal", pick: i })}><RoleIcon role={r} className="size-5" />{ROLES[r].name} nehmen</Button>)}
        {!s.extra.every((r) => isWolf(r)) && <Button variant="ghost" onClick={() => act({ type: "steal", pick: null })}>Nicht tauschen</Button>}
      </div>
    );
  } else if (step === "amor" && !acted) {
    body = <Picker ids={alive} players={players} selected={pick} onPick={(id) => toggle(id, 2)} />;
    confirm = { label: pick.length === 2 ? `${nameOf(players, pick[0])} & ${nameOf(players, pick[1])} verlieben` : "Zwei Personen wählen", ok: pick.length === 2, run: () => act({ type: "amor", a: pick[0], b: pick[1] }) };
  } else if (step === "lovers" && s.lovers) {
    body = <p className="text-center text-2xl font-extrabold">{nameOf(players, s.lovers[0])} <Heart aria-label="und" className="inline size-6 align-[-3px] text-ice" /> {nameOf(players, s.lovers[1])}</p>;
  } else if (step === "beschuetzer" && !acted) {
    body = <Picker ids={alive} players={players} selected={pick} onPick={(id) => toggle(id, 1)} disabled={(id) => id === s.lastProtected} />;
    confirm = { label: "Beschützen", ok: pick.length === 1, run: () => act({ type: "protect", target: pick[0] }) };
  } else if (step === "wildeskind" && !acted) {
    body = <Picker ids={alive.filter((id) => s.roles[id] !== "wildeskind")} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: pick.length ? `${nameOf(players, pick[0])} als Vorbild` : "Vorbild wählen", ok: pick.length === 1, run: () => act({ type: "model", target: pick[0] }) };
  } else if (step === "wolfshund" && !acted) {
    body = (
      <div className="grid gap-2">
        <Button size="lg" variant="secondary" onClick={() => act({ type: "dog", wolf: false })}><House />Bleibt beim Dorf</Button>
        <Button size="lg" variant="secondary" onClick={() => act({ type: "dog", wolf: true })}><PawPrint />Wird zum Werwolf</Button>
      </div>
    );
  } else if (step === "schwestern") {
    body = <p className="text-center text-2xl font-extrabold"><Ico icon={Users} className="mr-2 size-6 text-ice" />{who(holders(s, "schwester"))}</p>;
  } else if (step === "werwolf" && !acted) {
    body = <Picker ids={alive.filter((id) => !isWolf(s.roles[id]))} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: pick.length ? `${nameOf(players, pick[0])} fressen` : "Opfer wählen", ok: pick.length === 1, run: () => act({ type: "wolf", target: pick[0] }) };
  } else if (step === "weisserwolf" && !acted) {
    body = <Picker ids={alive.filter((id) => isWolf(s.roles[id]) && s.roles[id] !== "weisserwolf")} players={players} selected={pick} onPick={(id) => toggle(id, 1)}
      extra={{ label: "Niemand", selected: false, onPick: () => act({ type: "white", target: null }) }} />;
    confirm = { label: pick.length ? `${nameOf(players, pick[0])} fressen` : "Wolf wählen", ok: pick.length === 1, run: () => act({ type: "white", target: pick[0] }) };
  } else if (step === "floetenspieler" && !acted) {
    const open = alive.filter((id) => s.roles[id] !== "floetenspieler" && !s.enchanted.includes(id));
    body = <Picker ids={open} players={players} selected={pick} onPick={(id) => toggle(id, 2)} />;
    confirm = { label: "Verzaubern", ok: pick.length === Math.min(2, open.length), run: () => act({ type: "enchant", a: pick[0], b: pick[1] }) };
  } else if (step === "verzaubert") {
    body = <p className="text-center text-2xl font-extrabold"><Ico icon={Music} className="mr-2 size-6 text-ice" />{s.enchantedTonight.map((id) => nameOf(players, id)).join(" & ")}</p>;
  } else if (step === "urwolf" && !acted) {
    body = s.victim ? (
      <div className="grid gap-2">
        <p className="rounded-xl bg-navy-950/50 p-3 text-center">Opfer: <b className="text-lg">{nameOf(players, s.victim)}</b></p>
        <Button size="lg" variant="secondary" onClick={() => act({ type: "infect", yes: true })}><MoonStar />Verwandeln – wird zum Werwolf</Button>
        <Button size="lg" variant="secondary" onClick={() => act({ type: "infect", yes: false })}>Nein, fressen</Button>
      </div>
    ) : <Button size="lg" variant="secondary" onClick={() => act({ type: "infect", yes: false })}>Kein Opfer – weiter</Button>;
  } else if (step === "grosserwolf" && !acted) {
    body = <Picker ids={alive.filter((id) => !isWolf(s.roles[id]) && id !== s.victim && id !== s.infected)} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: pick.length ? `${nameOf(players, pick[0])} fressen` : "Zweites Opfer wählen", ok: pick.length === 1, run: () => act({ type: "wolf2", target: pick[0] }) };
  } else if (step === "fuchs" && !acted) {
    body = <Picker ids={alive} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: "Schnüffeln", ok: pick.length === 1, run: () => act({ type: "fox", target: pick[0] }) };
  } else if (step === "fuchs" && acted) {
    const r = s.fox.at(-1)!;
    body = <p className="text-center text-2xl font-extrabold" data-testid="fox-result"><Ico icon={Search} className="mr-2 size-6 text-ice" />{r.wolf ? `Wolf in der Nähe von ${nameOf(players, r.target)}!` : "Kein Wolf dort – der Fuchs verliert seinen Spürsinn."}</p>;
  } else if (step === "schlampe" && !acted) {
    body = <Picker ids={alive.filter((id) => s.roles[id] !== "schlampe")} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: pick.length ? `Übernachtet bei ${nameOf(players, pick[0])}` : "Person wählen", ok: pick.length === 1, run: () => act({ type: "visit", target: pick[0] }) };
  } else if (step === "rabe" && !acted) {
    body = <Picker ids={alive} players={players} selected={pick} onPick={(id) => toggle(id, 1)} extra={{ label: "Niemand", selected: false, onPick: () => act({ type: "raven", target: null }) }} />;
    confirm = { label: pick.length ? `${nameOf(players, pick[0])} markieren` : "Person wählen", ok: pick.length === 1, run: () => act({ type: "raven", target: pick[0] }) };
  } else if (step === "seherin" && !acted) {
    body = <Picker ids={alive.filter((id) => s.roles[id] !== "seherin")} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: "Rolle ansehen", ok: pick.length === 1, run: () => act({ type: "see", target: pick[0] }) };
  } else if (step === "seherin" && acted) {
    const r = s.seer.at(-1)!;
    body = (
      <div className="text-center">
        <div className="text-sm text-muted-foreground">{nameOf(players, r.target)} ist</div>
        <RoleIcon role={r.role} className="mx-auto mt-2 block size-12 text-ice" />
        <div className="text-3xl font-extrabold" data-testid="seer-result">{ROLES[r.role].name}</div>
      </div>
    );
  } else if (step === "hexe" && !acted) {
    body = <Witch s={s} players={players} hold={auto} onDone={(heal, poison) => act({ type: "witch", heal, poison })} />;
  } else if (acted && script.after) {
    body = <p className="text-center text-lg font-semibold text-muted-foreground"><Ico icon={Check} className="mr-1.5" />Erledigt</p>;
  }

  const actorHint = showRoles && awake.length ? who(awake) : "";
  const panel = (
    <Panel title={<IconTitle icon={Moon}>Nacht {s.night} · {script.title}</IconTitle>} sub={<><span className="italic">„{acted && script.after ? script.after : script.say}“</span>{actorHint && <span className="block not-italic">Wach: {actorHint}</span>}</>}>
      {body}
    </Panel>
  );
  if (auto) return <AutoStep verdict={verdictSay(s, players)} step={step} acted={acted} options={options} act={act} panel={panel} confirm={confirm} />;
  // Ohne Automatik (Spielleiter oder Automatik aus): Richtzeit als Orientierung, weiter geht es per Hand
  const guide = step !== "sleep" && !acted && s.stepAt ? s.stepAt + stepSeconds(step, options) * 1000 : null;
  return (
    <>
      {guide !== null && <Timer deadline={guide} label={showRoles ? "Richtzeit für diesen Schritt" : "Zeit für diese Rolle"} warnAt={5} />}
      {panel}
      {confirm && !acted
        ? <Button size="lg" className="shrink-0" disabled={!confirm.ok} onClick={confirm.run}>{confirm.label}</Button>
        : <Button size="lg" className="shrink-0" onClick={() => act({ type: "next" })}>Weiter</Button>}
    </>
  );
}

/** Werwolf-Nachtschritt in der Automatik (Ablauf siehe AutoRunner) */
function AutoStep({ step, acted, options, act, panel, confirm, verdict }: {
  step: Step; acted: boolean; options: Options; act: (a: WerwolfAction) => void; panel: React.ReactNode;
  confirm: { label: string; ok: boolean; run: () => void } | null; verdict: string;
}) {
  const info = INFO_STEPS.includes(step) || step === "sleep";
  return (
    <AutoRunner say={`${step === "sleep" ? verdict : ""}${AUTO_SAY[step] ?? SCRIPT[step].say}`} after={SCRIPT[step].after} total={step === "sleep" ? 2 : stepSeconds(step, options)}
      required={!info} acted={acted} result={RESULT_STEPS.includes(step)} onNext={() => act({ type: "next" })} confirm={confirm}>
      {panel}
    </AutoRunner>
  );
}

/** Hexe in zwei einfachen Fragen: erst heilen, dann vergiften */
function Witch({ s, players, hold, onDone }: { s: WerwolfState; players: Player[]; hold: boolean; onDone: (heal: boolean, poison: string | null) => void }) {
  const victimIsWitch = !!s.victim && s.roles[s.victim] === "hexe";
  const canHeal = s.potions.heal && !!s.victim && (s.rules.selfHeal || !victimIsWitch);
  const [q, setQ] = useState<"heal" | "poison">(canHeal ? "heal" : "poison");
  const [heal, setHeal] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const answerHeal = (h: boolean) => { setHeal(h); if (s.potions.poison) setQ("poison"); else onDone(h, null); };
  const victim = <p className="rounded-xl bg-navy-950/50 p-3 text-center">{s.victim ? <>Opfer der Werwölfe: <b className="text-lg">{nameOf(players, s.victim)}</b></> : "Heute Nacht wurde niemand angegriffen."}</p>;
  if (q === "heal") {
    return (
      <div className="grid gap-2.5" data-testid="witch-heal">
        {victim}
        <p className="text-center font-semibold"><Ico icon={FlaskConical} className="mr-1.5" />Heiltrank benutzen?</p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => answerHeal(true)}>Heilen</Button>
          <Button size="lg" variant="secondary" onClick={() => answerHeal(false)}>Nicht heilen</Button>
        </div>
      </div>
    );
  }
  if (!s.potions.poison) {
    return (
      <div className="grid gap-2.5">
        {victim}
        <p className="text-center text-sm text-muted-foreground">{!s.potions.heal ? "Beide Tränke sind verbraucht." : canHeal ? "" : "Heilen geht heute nicht."} Der Gifttrank ist verbraucht.</p>
        <Button size="lg" onClick={() => onDone(heal, null)}>Fertig</Button>
      </div>
    );
  }
  return (
    <div className="grid gap-2.5" data-testid="witch-poison">
      {!canHeal && victim}
      {heal && <p className="text-center text-sm text-ice"><Ico icon={Check} className="mr-1" />{nameOf(players, s.victim!)} wird geheilt.</p>}
      <p className="text-center font-semibold"><Ico icon={Skull} className="mr-1.5" />Jemanden vergiften?</p>
      <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={(id) => setPick(pick === id ? null : id)}
        extra={{ label: "Niemand vergiften", selected: false, onPick: () => onDone(heal, null) }} />
      {pick && (hold
        ? <HoldButton label={`${nameOf(players, pick)} vergiften`} onDone={() => onDone(heal, pick)} />
        : <Button size="lg" onClick={() => onDone(heal, pick)}>{nameOf(players, pick)} vergiften</Button>)}
    </div>
  );
}

/** Was in der Nacht passiert ist – zum Vorlesen (nur Namen und, falls aufgedeckt, Rollen) */
/** Urteil des Dorfes zum Vorlesen, wenn danach die Nacht beginnt */
function verdictSay(s: WerwolfState, players: Player[]) {
  if (s.news?.kind !== "day") return "";
  const d = s.news.deaths;
  if (s.news.idiot) return `${nameOf(players, s.news.idiot)} ist der Dorfdepp und bleibt am Leben. `;
  if (!d.length) return "Das Dorf hat niemanden verurteilt. ";
  return d.map((x) => `${nameOf(players, x.id)} ist tot${s.revealDead ? ` und war ${ROLES[s.roles[x.id]].name}` : ""}.`).join(" ") + " ";
}

export function newsSay(s: WerwolfState, players: Player[]) {
  const d = s.news?.kind === "night" ? s.news.deaths : [];
  if (!d.length) return "Heute Nacht ist niemand gestorben.";
  return d.map((x) => `${nameOf(players, x.id)} ist tot${s.revealDead ? ` und war ${ROLES[s.roles[x.id]].name}` : ""}.`).join(" ");
}

type DayStage = "talk" | "count" | "pick" | "secret";

/**
 * Tag mit Diskussions-Timer und Abstimmung: zeigen („3, 2, 1“), geheim reihum oder gemeinsam.
 * Das Handy liegt offen in der Mitte – hier darf die App sprechen.
 */
function Day({ s, players, act, options, speech }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; options: Options; speech: boolean }) {
  const mode = options.vote === "secret" ? "secret" : options.vote === "talk" ? "talk" : "point";
  const minutes = tempoOf(options).talk;
  const [stage, setStage] = useState<DayStage>("talk");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [count, setCount] = useState(3);
  const [tie, setTie] = useState<string[]>([]);
  const left = useCountdown(deadline, pausedLeft !== null);
  const say = (text: string) => (speech ? speak(text) : Promise.resolve());
  useSpokenCountdown(stage === "talk" && pausedLeft === null ? left : null, speech, minutes * 60);

  useEffect(() => {
    let alive = true;
    void say(`${DAWN_SAY} ${newsSay(s, players)} Ihr habt ${minutes} Minuten.`).then(() => { if (alive) setDeadline(Date.now() + minutes * 60_000); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (stage !== "talk" || pausedLeft !== null) return;
    if (left === 0) startVote(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);
  // „3, 2, 1 – zeigt!“
  useEffect(() => {
    if (stage !== "count") return;
    if (count === 0) { setStage("pick"); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, count]);

  function startVote(timeUp: boolean) {
    const pre = timeUp ? "Die Zeit ist um. " : "";
    setDeadline(null);
    if (mode === "point") { setCount(3); void say(`${pre}Auf drei zeigt jeder auf einen Verdächtigen.`).then(() => { setStage("count"); void say("Eins. Zwei. Drei!"); }); }
    else if (mode === "secret") { setStage("secret"); void say(`${pre}Gebt das Handy reihum zur geheimen Abstimmung.`); }
    else { setStage("pick"); void say(`${pre}Einigt euch, wen das Dorf verurteilt.`); }
  }
  const shown = pausedLeft ?? left;
  const mmss = shown === null ? "…" : `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, "0")}`;

  return (
    <>
      <News s={s} players={players} />
      {stage === "talk" && (
        <>
          <Panel title={<IconTitle icon={Sun}>Tag {s.night} – diskutiert!</IconTitle>} sub="Wer könnte ein Werwolf sein? Wenn die Zeit um ist, wird abgestimmt.">
            <div className="grid flex-1 place-content-center justify-items-center gap-2">
              <span className={cn("text-6xl font-extrabold tabular-nums", shown !== null && shown <= 60 && "text-ice")} data-testid="day-timer">{mmss}</span>
              <span className="text-sm text-muted-foreground">{pausedLeft !== null ? "Angehalten" : shown !== null && shown <= 60 ? "Letzte Minute" : "Diskussion läuft"}</span>
            </div>
          </Panel>
          <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2">
            <Button size="lg" variant="secondary" aria-label={pausedLeft !== null ? "Weiterlaufen lassen" : "Anhalten"}
              onClick={() => { if (pausedLeft !== null) { setDeadline(Date.now() + pausedLeft * 1000); setPausedLeft(null); } else setPausedLeft(left ?? 0); }}>
              {pausedLeft !== null ? <Play /> : <Pause />}
            </Button>
            <Button size="lg" onClick={() => startVote(false)}>Jetzt abstimmen</Button>
          </div>
        </>
      )}
      {stage === "count" && (
        <Panel title={<IconTitle icon={Sun}>Gleich zeigen alle …</IconTitle>} sub="Auf drei zeigt jeder auf einen Verdächtigen.">
          <div className="grid flex-1 place-items-center">
            <span key={count} className="pop text-8xl font-extrabold text-ice tabular-nums" data-testid="vote-count">{count || "Zeigt!"}</span>
          </div>
        </Panel>
      )}
      {stage === "secret" && <SecretVote s={s} players={players} onResult={(target, tied) => { if (tied.length) { setTie(tied); setStage("pick"); } else act({ type: "lynch", target }); }} />}
      {stage === "pick" && <Verdict s={s} players={players} act={act} tie={tie} pointed={mode === "point"} />}
    </>
  );
}

/** Ergebnis eintragen: wer hat die meisten Stimmen bzw. auf wen hat sich das Dorf geeinigt? */
function Verdict({ s, players, act, tie, pointed }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; tie: string[]; pointed: boolean }) {
  const [pick, setPick] = useState<string | null | undefined>(undefined);
  const sub = tie.length ? `Gleichstand zwischen ${tie.map((id) => nameOf(players, id)).join(" und ")} – einigt euch oder wählt „Niemand“.`
    : pointed ? "Auf wen zeigen die meisten Finger? Bei Gleichstand: „Niemand“." : "Wen verurteilt das Dorf?";
  return (
    <>
      <Panel title={<IconTitle icon={Sun}>Urteil</IconTitle>} sub={sub}>
        <Picker ids={tie.length ? tie : aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={(id) => setPick(id === pick ? undefined : id)}
          extra={{ label: "Niemand", selected: pick === null, onPick: () => setPick(pick === null ? undefined : null) }} />
      </Panel>
      <Button size="lg" className="shrink-0" disabled={pick === undefined} onClick={() => act({ type: "lynch", target: pick ?? null })}>
        {pick ? `${nameOf(players, pick)} verurteilen` : pick === null ? "Niemanden verurteilen" : "Auswahl treffen"}
      </Button>
    </>
  );
}

/** Geheime Abstimmung: das Handy geht reihum, die App zählt (Hauptmann doppelt, Rabe +2) */
function SecretVote({ s, players, onResult }: { s: WerwolfState; players: Player[]; onResult: (target: string | null, tie: string[]) => void }) {
  const list = voters(s);
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const [votes, setVotes] = useState<Record<string, string | null>>({});
  const cur = list[i];
  const cast = (target: string | null) => {
    const next = { ...votes, [cur]: target };
    setVotes(next);
    setReady(false);
    if (i + 1 < list.length) { setI(i + 1); return; }
    const tally = new Map<string, number>();
    for (const [voter, t] of Object.entries(next)) if (t) tally.set(t, (tally.get(t) ?? 0) + (voter === s.captain ? 2 : 1));
    if (s.raven && s.alive[s.raven]) tally.set(s.raven, (tally.get(s.raven) ?? 0) + 2);
    if (!tally.size) { onResult(null, []); return; }
    const max = Math.max(...tally.values());
    const top = [...tally].filter(([, n]) => n === max).map(([id]) => id);
    onResult(top.length === 1 ? top[0] : null, top.length > 1 ? top : []);
  };
  if (!ready) {
    return (
      <>
        <Panel title={`Geheime Abstimmung · ${i + 1} von ${list.length}`} sub={`Gib das Handy an ${nameOf(players, cur)}. Die anderen schauen weg.`} />
        <Button size="lg" className="shrink-0" onClick={() => setReady(true)}>Ich bin {nameOf(players, cur)}</Button>
      </>
    );
  }
  return (
    <Panel title={`${nameOf(players, cur)} stimmt ab`} sub="Antippen – dann sofort weitergeben.">
      <Picker ids={aliveIds(s).filter((id) => id !== cur)} players={players} selected={[]} onPick={(id) => cast(id)}
        extra={{ label: "Enthaltung", selected: false, onPick: () => cast(null) }} />
    </Panel>
  );
}

export function Hunter({ s, players, act }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const hunter = s.hunters[0];
  return (
    <>
      <News s={s} players={players} />
      <Panel title={<IconTitle icon={Crosshair}>Der Jäger schießt</IconTitle>} sub={`${nameOf(players, hunter)} war Jäger und nimmt jemanden mit in den Tod.`}>
        <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={setPick} />
      </Panel>
      <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "shoot", target: pick })}>Schießen</Button>
    </>
  );
}

/** Eigene Karten: Spielleiter bzw. Gerät tippt, wer welche Karte gezogen hat */
function Assign({ s, players, act, enabled }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; enabled: Role[] }) {
  const [who, setWho] = useState<string | null>(null);
  if (who) {
    return (
      <>
        <Panel title={`Karte von ${nameOf(players, who)}`} sub="Welche Karte hat diese Person gezogen?">
          <RolePicker selected={s.ready.includes(who) ? s.roles[who] : null} prefer={enabled} onPick={(role) => { act({ type: "assign", id: who, role }); setWho(null); }} />
        </Panel>
        <Button variant="ghost" className="shrink-0" onClick={() => setWho(null)}>Zurück</Button>
      </>
    );
  }
  return (
    <>
      <Panel title="Eigene Karten zuordnen" sub="Jeder zieht eine echte Karte. Tippe die Namen an und wähle die gezogene Rolle – nicht Zugeordnete sind Dorfbewohner.">
        <Picker ids={participants(s)} players={players} selected={[]} onPick={setWho}
          marks={Object.fromEntries(s.ready.map((id) => [id, <span role="img" aria-label={ROLES[s.roles[id]].name}><RoleIcon role={s.roles[id]} /></span>]))} />
      </Panel>
      <Button size="lg" className="shrink-0" onClick={() => act({ type: "assignDone" })}><Moon />Fertig – Nacht beginnen</Button>
    </>
  );
}

function Election({ s, players, act }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  return (
    <>
      <News s={s} players={players} />
      <Panel title={<IconTitle icon={Crown}>Hauptmannwahl</IconTitle>} sub="Das Dorf wählt per Handzeichen einen Hauptmann. Seine Stimme zählt doppelt.">
        <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={setPick} />
      </Panel>
      <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "elect", target: pick })}>{pick ? `${nameOf(players, pick)} wird Hauptmann` : "Auswahl treffen"}</Button>
    </>
  );
}

function Successor({ s, players, act }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  return (
    <>
      <News s={s} players={players} />
      <Panel title={<IconTitle icon={Crown}>Neuer Hauptmann</IconTitle>} sub={`${nameOf(players, s.captain)} ist gestorben und bestimmt einen Nachfolger.`}>
        <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={setPick} />
      </Panel>
      <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "successor", target: pick })}>Nachfolger bestimmen</Button>
    </>
  );
}
