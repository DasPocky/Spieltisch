import { useState } from "react";
import { Check, FlaskConical, Heart, House, Moon, MoonStar, Music, PawPrint, Search, Skull, Users } from "lucide-react";
import { aliveIds, aliveWolves, holders, isWolf, ROLES, STEP_ROLE, wolfAt, type Step, type WerwolfAction, type WerwolfState, wolf2Targets } from "@shared/games/werwolf/logic";
import type { Options, Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { Ico, IconTitle, nameOf, Panel, Picker, RolePicker } from "./parts";
import { RoleIcon } from "./RoleIcon";
import { AUTO_SAY, SCRIPT } from "./script";
import { AutoRunner, HoldButton, Timer, INFO_STEPS, RESULT_STEPS, stepSeconds } from "./Auto";
import { verdictSay } from "./Day";

export function NightStep({ s, players, act, showRoles, auto, options }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; showRoles: boolean; auto: boolean; options: Options }) {
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
    body = <p className="text-center text-2xl font-bold">{nameOf(players, s.lovers[0])} <Heart aria-label="und" className="inline size-6 align-[-3px] text-ice" /> {nameOf(players, s.lovers[1])}</p>;
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
    body = <p className="text-center text-2xl font-bold"><Ico icon={Users} className="mr-2 size-6 text-ice" />{who(holders(s, "schwester"))}</p>;
  } else if (step === "werwolf" && !acted) {
    body = <Picker ids={alive.filter((id) => !wolfAt(s, id))} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: pick.length ? `${nameOf(players, pick[0])} fressen` : "Opfer wählen", ok: pick.length === 1, run: () => act({ type: "wolf", target: pick[0] }) };
  } else if (step === "weisserwolf" && !acted) {
    body = <Picker ids={alive.filter((id) => wolfAt(s, id) && s.roles[id] !== "weisserwolf")} players={players} selected={pick} onPick={(id) => toggle(id, 1)}
      extra={{ label: "Niemand", selected: false, onPick: () => act({ type: "white", target: null }) }} />;
    confirm = { label: pick.length ? `${nameOf(players, pick[0])} fressen` : "Wolf wählen", ok: pick.length === 1, run: () => act({ type: "white", target: pick[0] }) };
  } else if (step === "floetenspieler" && !acted) {
    const open = alive.filter((id) => s.roles[id] !== "floetenspieler" && !s.enchanted.includes(id));
    body = <Picker ids={open} players={players} selected={pick} onPick={(id) => toggle(id, 2)} />;
    confirm = { label: "Verzaubern", ok: pick.length === Math.min(2, open.length), run: () => act({ type: "enchant", a: pick[0], b: pick[1] }) };
  } else if (step === "verzaubert") {
    body = <p className="text-center text-2xl font-bold"><Ico icon={Music} className="mr-2 size-6 text-ice" />{s.enchantedTonight.map((id) => nameOf(players, id)).join(" & ")}</p>;
  } else if (step === "urwolf" && !acted) {
    body = s.victim ? (
      <div className="grid gap-2">
        <p className="rounded-xl bg-navy-950/50 p-3 text-center">Opfer: <b className="text-lg">{nameOf(players, s.victim)}</b></p>
        <Button size="lg" variant="secondary" onClick={() => act({ type: "infect", yes: true })}><MoonStar />Verwandeln – wird zum Werwolf</Button>
        <Button size="lg" variant="secondary" onClick={() => act({ type: "infect", yes: false })}>Nein, fressen</Button>
      </div>
    ) : <Button size="lg" variant="secondary" onClick={() => act({ type: "infect", yes: false })}>Kein Opfer – weiter</Button>;
  } else if (step === "grosserwolf" && !acted) {
    body = <Picker ids={alive.filter((id) => !wolfAt(s, id) && id !== s.victim && id !== s.infected)} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = wolf2Targets(s).length
      ? { label: pick.length ? `${nameOf(players, pick[0])} fressen` : "Zweites Opfer wählen", ok: pick.length === 1, run: () => act({ type: "wolf2", target: pick[0] }) }
      : { label: "Kein zweites Opfer möglich – weiter", ok: true, run: () => act({ type: "wolf2", target: null }) };
  } else if (step === "fuchs" && !acted) {
    body = <Picker ids={alive} players={players} selected={pick} onPick={(id) => toggle(id, 1)} />;
    confirm = { label: "Schnüffeln", ok: pick.length === 1, run: () => act({ type: "fox", target: pick[0] }) };
  } else if (step === "fuchs" && acted) {
    const r = s.fox.at(-1)!;
    body = <p className="text-center text-2xl font-bold" data-testid="fox-result"><Ico icon={Search} className="mr-2 size-6 text-ice" />{r.wolf ? `Wolf in der Nähe von ${nameOf(players, r.target)}!` : "Kein Wolf dort – der Fuchs verliert seinen Spürsinn."}</p>;
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
        <div className="text-3xl font-bold" data-testid="seer-result">{ROLES[r.role].name}</div>
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
export function AutoStep({ step, acted, options, act, panel, confirm, verdict }: {
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
export function Witch({ s, players, hold, onDone }: { s: WerwolfState; players: Player[]; hold: boolean; onDone: (heal: boolean, poison: string | null) => void }) {
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
