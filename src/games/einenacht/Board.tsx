import { useEffect, useRef, useState } from "react";
import { EndActions } from "@/platform/ResultScreen";
import { Check, Coffee, Eye, Handshake, Moon, PawPrint, Skull, Sun, VenetianMask, Volume2, VolumeX, type LucideIcon } from "lucide-react";
import { ON_ROLES, resolveNight, type ONAction, type ONRole, type ONState } from "@shared/games/einenacht/logic";
import type { Options, Player } from "@shared/platform/types";
import { Button } from "@/components/ui/button";
import type { BoardProps } from "@/games/types";
import { Ico, IconTitle, nameOf, Panel, Picker } from "@/games/werwolf/parts";
import { setSpeech, speak, speechSupported, useSpeak, useSpeechEnabled, useSpokenCountdown } from "@/games/werwolf/useSpeech";
import { cn } from "@/lib/utils";
import { CenterCards, Countdown, ONCard } from "./parts";
import { OwnNarrator, OwnPhone } from "./Own";
import { RoleIcon } from "./RoleIcon";
import { fullSay, ON_DAWN, ON_SCRIPT } from "./script";
import { AutoRunner, tempoOf, Timer, useCountdown } from "@/games/werwolf/Auto";
import { useAmbience } from "@/games/werwolf/ambience";

const ids = (s: ONState) => Object.keys(s.start);

/** Werwolf – Eine Nacht: lokal führt das Gerät in der Mitte, online spielt jeder am eigenen Handy. */
export function Board({ room, game: s, me, isHost, act, dispatch }: BoardProps<ONState, ONAction>) {
  const players = room.players;
  if (s.phase === "over") return <Result s={s} players={players} isHost={isHost} dispatch={dispatch} />;
  if (s.own) return me === null || isHost ? <OwnNarrator s={s} players={players} options={room.options} act={act} /> : <OwnPhone s={s} />;
  return me === null ? <Device s={s} players={players} act={act} options={room.options} /> : <Phone s={s} players={players} me={me} isHost={isHost} act={act} options={room.options} dispatch={dispatch} />;
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{children}</div>;
}

/* ───────────── Lokal: ein Gerät in der Mitte ───────────── */

function Device({ s, players, act, options }: { s: ONState; players: Player[]; act: (a: ONAction) => void; options: Options }) {
  const speech = useSpeechEnabled(true);
  // Automatik: das Handy liest vor, zählt herunter und macht selbst weiter
  const auto = options.auto !== false;
  const step = s.phase === "night" ? s.pending[0] : null;
  useAmbience(options.ambience === true, s.phase === "night");
  useSpeak(step && !auto ? fullSay(step) : s.phase === "day" ? ON_DAWN : "", speech && s.phase !== "reveal");
  return (
    <Wrap>
      {speechSupported() && s.phase !== "reveal" && (
        <button type="button" onClick={() => setSpeech(!speech)} className="flex shrink-0 items-center gap-2 self-end text-sm font-semibold text-muted-foreground">
          {speech ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}Vorlesen {speech ? "an" : "aus"}
        </button>
      )}
      {s.phase === "reveal" && <PassAround s={s} players={players} act={act} />}
      {s.phase === "night" && step && <DeviceStep key={`${step}-${s.pending.length}`} s={s} players={players} act={act} auto={auto} options={options} />}
      {s.phase === "day" && <DeviceDay s={s} players={players} act={act} />}
    </Wrap>
  );
}

function PassAround({ s, players, act }: { s: ONState; players: Player[]; act: (a: ONAction) => void }) {
  const [peek, setPeek] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  if (peek) {
    return (
      <>
        <Panel title={`Nur ${nameOf(players, peek)} schaut!`} sub="Karte antippen, merken, verdecken, weitergeben.">
          <ONCard role={s.start[peek]} />
        </Panel>
        <Button size="lg" className="shrink-0" onClick={() => { setSeen((x) => [...x, peek]); setPeek(null); }}>Verdeckt – weitergeben</Button>
      </>
    );
  }
  return (
    <>
      <Panel title="Karten ansehen" sub="Reicht das Handy herum – jeder tippt auf seinen Namen.">
        <Picker ids={ids(s)} players={players} selected={[]} onPick={setPeek} marks={Object.fromEntries(seen.map((id) => [id, <Check aria-label="gesehen" className="size-4" />]))} />
      </Panel>
      <Button size="lg" className="shrink-0" onClick={() => act({ type: "startNight" })}><Moon />Nacht beginnen</Button>
    </>
  );
}

function DeviceStep({ s, players, act, auto, options }: { s: ONState; players: Player[]; act: (a: ONAction) => void; auto: boolean; options: Options }) {
  const step = s.pending[0];
  const [pick, setPick] = useState<string[]>([]);
  const [center, setCenter] = useState<number[]>([]);
  const holder = (r: ONRole) => ids(s).filter((id) => s.start[id] === r);
  const names = (list: string[]) => list.map((id) => nameOf(players, id)).join(", ") || "niemand (die Karte liegt in der Mitte)";
  const wolves = holder("werwolf");
  const shown = (i: number) => (s.wolfPeek === i || s.seer?.center?.includes(i) ? s.center[i] : "?");
  let body: React.ReactNode = null;

  if (step === "werwolf") {
    body = (
      <div className="grid gap-3">
        <p className="text-center text-xl font-bold"><Ico icon={PawPrint} className="mr-2 size-6 text-ice" />{names(wolves)}</p>
        {wolves.length === 1 && (
          <>
            <p className="text-sm text-muted-foreground">Einsamer Werwolf: eine Karte aus der Mitte ansehen?</p>
            <CenterCards cards={[0, 1, 2].map(shown)} pickable={s.wolfPeek === null} onPick={(i) => act({ type: "peek", i })} />
          </>
        )}
      </div>
    );
  } else if (step === "guenstling") {
    body = <p className="text-center text-xl font-bold">Die Werwölfe: {names(wolves)}</p>;
  } else if (step === "freimaurer") {
    body = <p className="text-center text-xl font-bold"><Ico icon={Handshake} className="mr-2 size-6 text-ice" />{names(holder("freimaurer"))}</p>;
  } else if (step === "seherin") {
    const me = holder("seherin")[0];
    body = s.seer ? (
      s.seer.player
        ? <p className="text-center text-xl font-bold">{nameOf(players, s.seer.player)} ist <RoleIcon role={s.start[s.seer.player]} className="mr-1 size-6 text-ice" />{ON_ROLES[s.start[s.seer.player]].name}</p>
        : <CenterCards cards={[0, 1, 2].map(shown)} />
    ) : (
      <div className="grid gap-3">
        <Picker ids={ids(s).filter((id) => id !== me)} players={players} selected={pick} onPick={(id) => act({ type: "see", player: id })} />
        <p className="text-sm text-muted-foreground">… oder zwei Karten aus der Mitte:</p>
        <CenterCards cards={["?", "?", "?"]} pickable selected={center} onPick={(i) => {
          const next = center.includes(i) ? center.filter((x) => x !== i) : [...center, i];
          if (next.length === 2) act({ type: "see", center: [next[0], next[1]] }); else setCenter(next);
        }} />
      </div>
    );
  } else if (step === "raeuber") {
    const me = holder("raeuber")[0];
    body = s.robber || s.robberSkip ? (
      <p className="text-center text-xl font-bold">{s.robber ? <>Neue Karte: <RoleIcon role={s.start[s.robber]} className="mr-1 size-6 text-ice" />{ON_ROLES[s.start[s.robber]].name}</> : "Nicht getauscht."}</p>
    ) : (
      <Picker ids={ids(s).filter((id) => id !== me)} players={players} selected={[]} onPick={(id) => act({ type: "rob", target: id })}
        extra={{ label: "Nicht tauschen", selected: false, onPick: () => act({ type: "rob", target: null }) }} />
    );
  } else if (step === "unruhestifter") {
    const me = holder("unruhestifter")[0];
    body = s.trouble || s.troubleSkip ? <p className="text-center text-xl font-bold">{s.trouble ? "Vertauscht." : "Nicht vertauscht."}</p> : (
      <>
        <Picker ids={ids(s).filter((id) => id !== me)} players={players} selected={pick}
          onPick={(id) => { const next = pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]; if (next.length === 2) act({ type: "trouble", a: next[0], b: next[1] }); else setPick(next); }}
          extra={{ label: "Nicht tauschen", selected: false, onPick: () => act({ type: "trouble", a: null }) }} />
      </>
    );
  } else if (step === "betrunkener") {
    body = s.drunk !== null ? <p className="text-center text-xl font-bold">Getauscht – ohne hinzusehen.</p>
      : <CenterCards cards={["?", "?", "?"]} pickable onPick={(i) => act({ type: "drunk", i })} />;
  } else if (step === "schlaflose") {
    const me = holder("schlaflose")[0];
    const final = resolveNight(s).cards;
    body = me ? <p className="text-center text-xl font-bold">Deine Karte jetzt: <RoleIcon role={final[me]} className="mr-1 size-6 text-ice" />{ON_ROLES[final[me]].name}</p>
      : <p className="text-center text-muted-foreground">(Die Karte liegt in der Mitte.)</p>;
  }

  const panel = <Panel title={<IconTitle icon={Moon}>{ON_SCRIPT[step].title}</IconTitle>} sub={<span className="italic">„{fullSay(step)}“</span>}>{body}</Panel>;
  if (auto) {
    // Wer hat schon gehandelt? Liegt die Rolle in der Mitte, läuft einfach die Zeit ab – so verrät der Ablauf nichts
    const acted = step === "werwolf" ? s.wolfPeek !== null : step === "seherin" ? !!s.seer : step === "raeuber" ? !!s.robber || s.robberSkip
      : step === "unruhestifter" ? !!s.trouble || s.troubleSkip : step === "betrunkener" ? s.drunk !== null : false;
    const t = tempoOf(options);
    const info = ["sleep", "guenstling", "freimaurer", "schlaflose"].includes(step);
    return (
      <AutoRunner say={ON_SCRIPT[step].say} after={ON_SCRIPT[step].after} total={step === "sleep" ? 2 : info ? t.info : step === "werwolf" ? t.wolves : t.role}
        required={step === "betrunkener" && holder("betrunkener").length > 0} acted={acted} result={["werwolf", "seherin", "raeuber"].includes(step)}
        onNext={() => act({ type: "next" })}>
        {panel}
      </AutoRunner>
    );
  }
  return (
    <>
      {panel}
      <Button size="lg" className="shrink-0" onClick={() => act({ type: "next" })}>Weiter</Button>
    </>
  );
}

function DeviceDay({ s, players, act }: { s: ONState; players: Player[]; act: (a: ONAction) => void }) {
  const [pick, setPick] = useState<string[]>([]);
  const speech = useSpeechEnabled(true);
  return (
    <>
      <Countdown s={s} voice={speech} />
      <Panel title={<IconTitle icon={Sun}>Wer stirbt?</IconTitle>} sub="Zeigt alle gleichzeitig auf eine Person. Wer die meisten Finger hat, stirbt (bei Gleichstand alle). Hat niemand mehr als einen, stirbt niemand. Stirbt der Jäger, wählt auch aus, auf wen er gezeigt hat.">
        <Picker ids={ids(s)} players={players} selected={pick} onPick={(id) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} />
      </Panel>
      <Button size="lg" className="shrink-0" onClick={() => act({ type: "lynch", targets: pick })}>{pick.length ? `${pick.map((id) => nameOf(players, id)).join(" & ")} stirbt` : "Niemand stirbt"}</Button>
    </>
  );
}

/* ───────────── Online: jeder am eigenen Handy ───────────── */

function Phone({ s, players, me, isHost, act, options, dispatch }: { s: ONState; players: Player[]; me: string; isHost: boolean; act: (a: ONAction) => void; options: Options; dispatch: BoardProps["dispatch"] }) {
  const role = s.start[me];
  const [pick, setPick] = useState<string[]>([]);
  const [center, setCenter] = useState<number[]>([]);
  const others = ids(s).filter((id) => id !== me);
  const known = others.filter((id) => s.start[id] !== ("?" as ONRole));
  const doneMe = s.done.includes(me);

  if (s.phase === "reveal") {
    return (
      <Wrap>
        <Panel title="Deine Karte" sub="Merk sie dir – in der Nacht kann sie heimlich getauscht werden."><ONCard role={role} /></Panel>
        {s.ready.includes(me)
          ? <p className="glass shrink-0 rounded-xl py-4 text-center text-muted-foreground">Warte auf die anderen ({s.ready.length}/{ids(s).length}) …</p>
          : <Button size="lg" className="shrink-0" onClick={() => act({ type: "ready" })}>Gesehen – bereit</Button>}
        {isHost && <Button variant="secondary" className="shrink-0" onClick={() => act({ type: "startNight" })}>Nacht jetzt beginnen</Button>}
      </Wrap>
    );
  }

  if (s.phase === "night") {
    let body: React.ReactNode;
    let info: [LucideIcon, React.ReactNode] | null = null;
    if (role === "werwolf" || role === "guenstling") info = [PawPrint, `Werwölfe: ${[...known.filter((id) => s.start[id] === "werwolf"), ...(role === "werwolf" ? [me] : [])].map((id) => (id === me ? "du" : nameOf(players, id))).join(", ") || "keiner unter den Spielern"}`];
    if (role === "freimaurer") info = [Handshake, `Freimaurer: ${known.filter((id) => s.start[id] === "freimaurer").map((id) => nameOf(players, id)).join(", ") || "die andere Karte liegt in der Mitte"}`];
    const lone = role === "werwolf" && !known.some((id) => s.start[id] === "werwolf");

    if (doneMe) {
      body = <p className="text-center text-muted-foreground">Erledigt – warte, bis es Tag wird …</p>;
      if (role === "seherin" && s.seer?.player) info = [Eye, <>{nameOf(players, s.seer.player)} ist <RoleIcon role={s.start[s.seer.player]} className="mr-1" />{ON_ROLES[s.start[s.seer.player]].name}</>];
      if (role === "raeuber" && s.robber && s.final?.[me]) info = [VenetianMask, <>Deine neue Karte: <RoleIcon role={s.final[me]} className="mr-1" />{ON_ROLES[s.final[me]].name}</>];
      if ((role === "seherin" && s.seer?.center) || (lone && s.wolfPeek !== null)) body = <CenterCards cards={s.center} />;
    } else if (lone) {
      body = <><p className="mb-2 text-sm text-muted-foreground">Du bist der einzige Werwolf – willst du eine Karte aus der Mitte ansehen?</p><CenterCards cards={["?", "?", "?"]} pickable onPick={(i) => act({ type: "peek", i })} /></>;
    } else if (role === "seherin") {
      body = (
        <div className="grid gap-3">
          <Picker ids={others} players={players} selected={[]} onPick={(id) => act({ type: "see", player: id })} />
          <p className="text-sm text-muted-foreground">… oder zwei Karten aus der Mitte:</p>
          <CenterCards cards={["?", "?", "?"]} pickable selected={center} onPick={(i) => {
            const next = center.includes(i) ? center.filter((x) => x !== i) : [...center, i];
            if (next.length === 2) act({ type: "see", center: [next[0], next[1]] }); else setCenter(next);
          }} />
        </div>
      );
    } else if (role === "raeuber") {
      body = <Picker ids={others} players={players} selected={[]} onPick={(id) => act({ type: "rob", target: id })} extra={{ label: "Nicht tauschen", selected: false, onPick: () => act({ type: "rob", target: null }) }} />;
    } else if (role === "unruhestifter") {
      body = <Picker ids={others} players={players} selected={pick} extra={{ label: "Nicht tauschen", selected: false, onPick: () => act({ type: "trouble", a: null }) }}
        onPick={(id) => { const next = pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]; if (next.length === 2) act({ type: "trouble", a: next[0], b: next[1] }); else setPick(next); }} />;
    } else if (role === "betrunkener") {
      body = <><p className="mb-2 text-sm text-muted-foreground">Tausche mit einer Karte aus der Mitte – ohne hinzusehen.</p><CenterCards cards={["?", "?", "?"]} pickable onPick={(i) => act({ type: "drunk", i })} /></>;
    } else {
      body = <p className="text-center text-muted-foreground">{role === "schlaflose" ? "Am Morgen siehst du deine Karte noch einmal." : "Heute Nacht hast du nichts zu tun."}</p>;
    }
    const canFinish = !doneMe && role !== "betrunkener";
    return (
      <Wrap>
        <HostClock s={s} isHost={isHost} options={options} dispatch={dispatch} />
        <ONCard role={role} compact />
        {info && <p className="shrink-0 rounded-xl bg-navy-950/50 px-3 py-2 text-sm font-semibold"><Ico icon={info[0]} className="mr-1.5 text-ice" />{info[1]}</p>}
        <Panel title={<IconTitle icon={Moon}>Die Nacht</IconTitle>} sub={`${s.done.length}/${ids(s).length} sind fertig.`}>{body}</Panel>
        {canFinish && <Button size="lg" variant="secondary" className="shrink-0" onClick={() => act({ type: "nightDone" })}>Fertig</Button>}
      </Wrap>
    );
  }

  // Tag
  const mine = s.votes[me];
  const count = Object.keys(s.votes).length;
  return (
    <Wrap>
      <Countdown s={s} />
      <HostClock s={s} isHost={isHost} options={options} dispatch={dispatch} />
      <ONCard role={role} compact label="Deine Startkarte" />
      {role === "schlaflose" && s.final?.[me] && <p className="shrink-0 rounded-xl bg-navy-950/50 px-3 py-2 text-sm font-semibold"><Ico icon={Coffee} className="mr-1.5 text-ice" />Deine Karte jetzt: <RoleIcon role={s.final[me]} className="mr-1" />{ON_ROLES[s.final[me]].name}</p>}
      <Panel title={<IconTitle icon={Sun}>Wer ist ein Werwolf?</IconTitle>} sub={mine ? `Du hast abgestimmt. ${count}/${ids(s).length} Stimmen sind da.` : "Diskutiert und stimmt ab – jeder genau einmal, alle gleichzeitig."}>
        <Picker ids={others} players={players} selected={mine ? [mine] : []} onPick={(id) => act({ type: "vote", target: id })} />
      </Panel>
      {isHost && <Button variant="secondary" className="shrink-0" disabled={!count} onClick={() => act({ type: "closeVote" })}>Abstimmung beenden ({count}/{ids(s).length})</Button>}
    </Wrap>
  );
}

/**
 * Online: Countdown für die Nacht auf allen Handys; das Host-Handy sagt an und beendet nach einer
 * kurzen Nachfrist Nacht bzw. Abstimmung selbst – so hängt nichts an einem Einzelnen.
 */
function HostClock({ s, isHost, options, dispatch }: { s: ONState; isHost: boolean; options: Options; dispatch: BoardProps["dispatch"] }) {
  const t = tempoOf(options);
  const deadline = s.phase === "night" && s.nightAt ? s.nightAt + (t.wolves + t.role) * 1000
    : s.phase === "day" && s.dayStartedAt ? s.dayStartedAt + s.minutes * 60_000 : null;
  const left = useCountdown(deadline, false);
  const speech = useSpeechEnabled(true);
  const said = useRef("");
  const grace = s.phase === "night" ? 15 : 30;
  useAmbience(isHost && options.ambience === true, s.phase === "night");
  useSpokenCountdown(left, isHost && speech, s.phase === "night" ? t.wolves + t.role : s.minutes * 60);
  useEffect(() => {
    if (!isHost || !speech || said.current === s.phase) return;
    said.current = s.phase;
    if (s.phase === "night") void speak("Es wird Nacht. Jeder schaut auf sein eigenes Handy und handelt geheim.");
    if (s.phase === "day") void speak(`${ON_DAWN} Ihr habt ${s.minutes} Minuten.`);
  }, [isHost, speech, s.phase, s.minutes]);
  useEffect(() => {
    if (!isHost || !speech || s.phase !== "day") return;
    if (left === 0) void speak("Die Zeit ist um. Stimmt jetzt ab.");
  }, [left, isHost, speech, s.phase]);
  useEffect(() => {
    if (!isHost || deadline === null) return;
    const k = setTimeout(() => dispatch({ type: "skip" }), Math.max(0, deadline + grace * 1000 - Date.now()));
    return () => clearTimeout(k);
  }, [isHost, deadline, grace, dispatch]);
  if (s.phase === "night") return <Timer deadline={deadline} label="Nacht – handelt jetzt" />;
  return left === 0 ? <p className="text-in shrink-0 text-center text-xs text-muted-foreground" data-testid="on-grace">Jetzt abstimmen – gleich wird ausgezählt.</p> : null;
}

/* ───────────── Auflösung ───────────── */

const WIN_TEXT = { dorf: "Das Dorf", werwolf: "Die Werwölfe", gerber: "Der Gerber" } as const;
const winLine = (w: ONState["winners"]) =>
  !w.length ? "Niemand gewinnt" : `${w.map((x) => WIN_TEXT[x]).join(" und ")} ${w.length > 1 || w[0] === "werwolf" ? "gewinnen" : "gewinnt"}`;

function Result({ s, players, isHost, dispatch }: { s: ONState; players: Player[]; isHost: boolean; dispatch: BoardProps["dispatch"] }) {
  const final = s.final ?? s.start;
  return (
    <section className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-[3vh] pb-6 text-center">
      <h2 className="bg-gradient-to-b from-foreground to-navy-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent" data-testid="winner">
        {winLine(s.winners)}
      </h2>
      {s.own ? (
        <p className="mt-1 text-muted-foreground" data-testid="own-winners">{s.ownWinners?.length ? `Gewonnen: ${s.ownWinners.map((id) => nameOf(players, id)).join(", ")}` : "Mit euren eigenen Karten gespielt."}</p>
      ) : <>
      <p className="mt-1 text-muted-foreground">{s.dead.length ? `Gestorben: ${s.dead.map((id) => nameOf(players, id)).join(", ")}` : "Niemand ist gestorben."}</p>
      <ul className="mt-5 grid gap-1.5 text-left">
        {Object.keys(final).map((id) => (
          <li key={id} className={cn("flex items-center justify-between rounded-xl px-4 py-2.5", s.dead.includes(id) ? "bg-destructive/15" : "glass")}>
            <span className="font-semibold">{nameOf(players, id)}{s.dead.includes(id) && <Ico icon={Skull} className="ml-1.5 text-destructive" />}</span>
            <span className="text-sm">
              {s.start[id] !== final[id] && <span className="text-muted-foreground"><RoleIcon role={s.start[id]} /> → </span>}
              <RoleIcon role={final[id]} className="mr-1" />{ON_ROLES[final[id]].name}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">Mitte: {(s.finalCenter ?? s.center).map((r, i) => <span key={i}>{i > 0 && " · "}<span className="whitespace-nowrap"><RoleIcon role={r} className="mr-1" />{ON_ROLES[r].name}</span></span>)}</p>
      </>}
      <div className="mt-6"><EndActions isHost={isHost} dispatch={dispatch} /></div>
    </section>
  );
}
