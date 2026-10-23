import { useEffect, useState } from "react";
import { Check, Crown, Smartphone, Crosshair, Moon, Volume2, VolumeX } from "lucide-react";
import { aliveIds, holders, participants, ROLES, type Role, type WerwolfAction, type WerwolfState } from "@shared/games/werwolf/logic";
import type { Options, Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import { RulesSheet } from "@/platform/RulesSheet";
import { AliveStrip, Ico, IconTitle, nameOf, News, Panel, Picker, RoleCard, RolePicker } from "./parts";
import { RoleIcon } from "./RoleIcon";
import { SCRIPT } from "./script";
import { setSpeech, speak, speechSupported, useSpeak, useSpeechEnabled } from "./useSpeech";
import { useAmbience } from "./ambience";
import { useCountdown } from "./Auto";
import { NightStep } from "./Night";
import { Day } from "./Day";

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
  // Nachtgeräusche nur auf dem Handy in der Mitte, wenn die App erzählt
  useAmbience(!online && s.mode === "app" && options.ambience === true, s.phase === "night");

  return (
    <>
      <AliveStrip s={s} players={players} me={null} showAll={showRoles} />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {speechSupported() && s.phase !== "reveal" && (
          <Button variant="outline" size="sm" onClick={() => setSpeech(!speech)} aria-pressed={speech} className="self-end text-muted-foreground">
            {speech ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}Vorlesen {speech ? "an" : "aus"}
          </Button>
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

/** Engel im Spiel: Die Partie beginnt mit einem Tag samt Abstimmung */
export const dayFirst = (s: WerwolfState) => participants(s).some((id) => s.roles[id] === "engel");

/**
 * Automatik: Das Handy geht der Reihe nach herum („Gib das Handy an …“). Hat jeder seine Rolle gesehen,
 * kommt das Handy in die Mitte und die Nacht beginnt von selbst.
 */
export function GuidedReveal({ s, players, act }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void }) {
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
      <Panel title="Alle kennen ihre Rolle" sub={`Legt das Handy in die Mitte – gleich beginnt ${dayFirst(s) ? "der erste Tag (der Engel spielt mit)" : "die Nacht"}.`}>
        <div className="grid flex-1 place-content-center justify-items-center gap-2">
          <Moon className="size-12 text-ice" />
          <span className="text-5xl font-bold tabular-nums">{left ?? 6}</span>
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
            <span className="text-4xl font-bold" data-testid="reveal-next">{nameOf(players, who)}</span>
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

export function Reveal({ s, players, act, online }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; online: boolean }) {
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
        <Button size="lg" className="shrink-0" onClick={() => act({ type: "startNight" })}><Moon />{dayFirst(s) ? "Ersten Tag beginnen" : "Nacht beginnen"}</Button>
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
        <Moon />{`${all ? "Alle kennen ihre Rolle – " : ""}${dayFirst(s) ? "Ersten Tag beginnen" : "Nacht beginnen"}`}
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
      <Panel title={<IconTitle icon={Crosshair}>Der Jäger schießt</IconTitle>} sub={`${nameOf(players, hunter)} war Jäger und nimmt jemanden mit in den Tod.`}>
        <Picker ids={aliveIds(s)} players={players} selected={pick ? [pick] : []} onPick={setPick} />
      </Panel>
      <Button size="lg" className="shrink-0" disabled={!pick} onClick={() => pick && act({ type: "shoot", target: pick })}>Schießen</Button>
    </>
  );
}

/** Eigene Karten: Spielleiter bzw. Gerät tippt, wer welche Karte gezogen hat */
export function Assign({ s, players, act, enabled }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void; enabled: Role[] }) {
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

export function Election({ s, players, act }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void }) {
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

export function Successor({ s, players, act }: { s: WerwolfState; players: Player[]; act: (a: WerwolfAction) => void }) {
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
