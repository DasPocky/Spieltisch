import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, ListPlus, Shuffle, SkipForward, Video, X } from "lucide-react";
import { CAT_BY_ID, catName, CUSTOM, STYLE_BY_ID, wordText } from "@shared/games/stirnraten/cards";
import { choosable, deadlineOf, explainers, teamName, type StirnState } from "@shared/games/stirnraten/logic";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { nameOf, Panel } from "@/games/werwolf/parts";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useCountdown } from "@/platform/Countdown";
import { HandoffCover } from "@/platform/Handoff";
import { playSound } from "@/platform/sound";
import { readStr, writeStr } from "@/lib/storage";
import { cn, vibrate } from "@/lib/utils";
import { landscape, leaveLandscape, requestTilt, useLastVideo, useRoundVideo, useTilt, useWakeLock } from "./device";
import { Standings, StyleChip, TEAM_COLORS, TopRow, TurnBanner, roundOf, type P } from "./parts";

const DRAFT_KEY = "spieltisch:stirnEigene";

/** Klassisch und Teams: ein Handy an der Stirn, die anderen erklären */
export function ForeheadGame(props: P) {
  const { room, game: s, me, isHost, act } = props;
  const players = room.players;
  const local = me === null;
  const myTeam = s.teams.findIndex((t) => me !== null && t.includes(me));
  const steer = local || isHost || me === s.guesser || (s.variant === "teams" && s.team !== null && myTeam === s.team);
  const forehead = local || me === s.guesser;
  const { round, rounds } = roundOf(s);
  useTimeUp(s, act, local || me === s.guesser ? 300 : isHost ? 1500 : 3000);

  if (s.phase === "play") return forehead ? <PlayScreen {...props} /> : <ExplainView {...props} steer={steer} />;
  if (s.phase === "review") return <Review {...props} steer={steer} forehead={forehead} />;

  const head = <TopRow room={room}>Runde {round} von {rounds}{s.last ? ` · zuletzt ${nameOf(players, s.last.guesser)}: ${s.last.hits} erraten` : ""}</TopRow>;
  if (s.phase === "pick") {
    return (
      <>
        {head}
        <TurnBanner s={s} players={players}>{steer ? <span className="text-sm">Wähle eine Kategorie</span> : <span className="text-sm">wählt gerade eine Kategorie …</span>}</TurnBanner>
        {steer ? <CategoryPicker {...props} /> : <Panel title="Stand"><Standings s={s} players={players} /></Panel>}
      </>
    );
  }
  // Bereit
  return (
    <>
      {head}
      <TurnBanner s={s} players={players}><span className="text-sm">Kategorie: <b>{catName(s.cat)}</b></span></TurnBanner>
      {forehead ? <ReadyForehead {...props} /> : (
        <Panel title={`${nameOf(players, s.guesser)} hält gleich das Handy an die Stirn`}
          sub={<>Ihr erklärt{s.variant === "teams" && s.team !== null ? ` (${teamName(s.team)})` : ""} – ohne den Begriff oder Teile davon zu sagen.</>}>
          <Standings s={s} players={players} />
        </Panel>
      )}
      {!forehead && steer && <Button size="lg" variant="secondary" className="shrink-0" onClick={() => act({ type: "start" })}>Für {nameOf(players, s.guesser)} starten</Button>}
    </>
  );
}

/** Zeit um: das Stirn-Handy meldet sofort, andere etwas später (falls es weg ist) */
function useTimeUp(s: StirnState, act: P["act"], delay: number) {
  const deadline = deadlineOf(s);
  useEffect(() => {
    if (deadline === null) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      act({ type: "timeUp" });
      iv = setInterval(() => act({ type: "timeUp" }), 2500);
    }, Math.max(0, deadline - Date.now()) + delay);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [deadline, delay, act]);
}

/** Kategorien zum Antippen; eigene Begriffe über einen Bogen */
function CategoryPicker({ room, game: s, act }: P) {
  const list = choosable(room.options, s.custom);
  const [own, setOwn] = useState(false);
  return (
    <>
      <section className="glass flex min-h-0 flex-1 flex-col rounded-2xl px-2.5 pt-2 pb-2.5">
        <div className="no-scrollbar grid min-h-0 flex-1 auto-rows-max grid-cols-2 content-start gap-1.5 overflow-y-auto" role="group" aria-label="Kategorien" data-testid="categories">
          <CatButton emoji="🎲" name="Bunt gemischt" onClick={() => act({ type: "pick", cat: "mix" })} />
          {list.map((id) => (
            <CatButton key={id} emoji={id === CUSTOM ? "✍️" : CAT_BY_ID[id].emoji} name={id === CUSTOM ? `Eigene (${s.custom.length})` : CAT_BY_ID[id].name}
              style={id === CUSTOM ? undefined : CAT_BY_ID[id].style} onClick={() => act({ type: "pick", cat: id })} />
          ))}
        </div>
      </section>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <Button size="lg" variant="secondary" onClick={() => setOwn(true)}><ListPlus />Eigene</Button>
        <Button size="lg" onClick={() => { const c = list.filter((x) => x !== CUSTOM); act({ type: "pick", cat: c[Math.floor(Math.random() * c.length)] ?? "mix" }); }}><Shuffle />Zufall</Button>
      </div>
      <CustomSheet open={own} onOpenChange={setOwn} count={s.custom.length} onAdd={(words) => act({ type: "custom", words })} />
    </>
  );
}

function CatButton({ emoji, name, style, onClick }: { emoji: string; name: string; style?: keyof typeof STYLE_BY_ID; onClick: () => void }) {
  return (
    <button type="button" onClick={() => { vibrate(10); onClick(); }}
      className="flex min-w-0 items-center gap-2 rounded-xl bg-secondary/70 px-2.5 py-2 text-left text-sm font-semibold ring-1 ring-inset ring-border outline-none transition active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring">
      <span className="text-xl" aria-hidden="true">{emoji}</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {style && <span className="text-xs" title={STYLE_BY_ID[style].name} aria-hidden="true">{STYLE_BY_ID[style].emoji}</span>}
    </button>
  );
}

/** Eigene Begriffe eintippen (einer pro Zeile oder mit Komma) – der Entwurf bleibt auf dem Gerät */
function CustomSheet({ open, onOpenChange, count, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; count: number; onAdd: (words: string[]) => void }) {
  const [text, setText] = useState(() => readStr(DRAFT_KEY) ?? "");
  const words = text.split(/[\n,;]+/).map((w) => w.trim()).filter(Boolean);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Eigene Begriffe</SheetTitle>
          <SheetDescription>Einer pro Zeile oder mit Komma getrennt. {count ? `Schon dabei: ${count}.` : ""} Wer gleich rät, schaut weg!</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <textarea value={text} onChange={(e) => { setText(e.target.value); writeStr(DRAFT_KEY, e.target.value); }} rows={7} aria-label="Eigene Begriffe"
            className="w-full rounded-xl bg-secondary px-3 py-2 text-base ring-1 ring-inset ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={"Opas Schnurrbart\nUnser Urlaub in Italien\nDer Hund vom Nachbarn"} />
          <Button size="lg" disabled={!words.length} onClick={() => { onAdd(words); onOpenChange(false); }}>{words.length ? `${words.length} Begriffe übernehmen` : "Begriffe eintippen"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Am Stirn-Handy vor dem Zug: Sensor freigeben, dann 3 – 2 – 1 */
function ReadyForehead({ room, game: s, me, act }: P) {
  const players = room.players;
  const [count, setCount] = useState<number | null>(null);
  const [handed, setHanded] = useState(me !== null);
  useEffect(() => {
    if (count === null) return;
    if (count === 0) { act({ type: "start" }); return; }
    vibrate(20);
    const t = setTimeout(() => setCount(count - 1), 900);
    return () => clearTimeout(t);
  }, [count, act]);
  if (!handed && players.length > 1) {
    return <div className="flex min-h-0 flex-1 flex-col justify-center"><HandoffCover name={nameOf(players, s.guesser)} onReveal={() => setHanded(true)} /></div>;
  }
  if (count !== null) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background" data-testid="countdown">
        <span key={count} className="text-in text-[40vmin] font-black tabular-nums">{count || "Los!"}</span>
      </div>
    );
  }
  const styles = [...new Set([...(s.cat && CAT_BY_ID[s.cat]?.style ? [CAT_BY_ID[s.cat].style!] : [])])];
  return (
    <>
      <Panel title={`${nameOf(players, s.guesser)}, Handy an die Stirn!`}
        sub="Bildschirm nach außen, die anderen erklären. Nicken (nach vorn kippen): erraten. Nach hinten kippen: weiter. Ohne Sensor: rechts tippen = erraten, links = weiter.">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="text-6xl" aria-hidden="true">📱🙆</span>
          <p className="text-sm text-muted-foreground">{s.seconds} Sekunden · {explainers(s).length} erklären{styles.length ? " · " : ""}{styles.map((st) => <StyleChip key={st} style={st} />)}</p>
        </div>
      </Panel>
      <Button size="lg" className="shrink-0" data-testid="go" onClick={async () => { await requestTilt(); void landscape(); setCount(3); }}>Los geht's</Button>
    </>
  );
}

/** Schriftgröße nach dem längsten Wort: kurze Begriffe riesig, lange passen noch in die Breite */
function fitSize(text: string) {
  const longest = Math.max(4, ...text.split(/\s+/).map((w) => w.length));
  const lines = Math.ceil(text.length / Math.max(longest, 12));
  return `min(${Math.min(30, 165 / longest).toFixed(1)}vw, ${Math.min(30, 60 / lines).toFixed(1)}vh)`;
}

/** Das Stirn-Handy während des Zugs: Begriff riesig, Kippen oder Tippen wertet */
function PlayScreen({ room, game: s, act }: P) {
  const deadline = deadlineOf(s);
  const left = useCountdown(deadline, false);
  const i = s.cards.length - 1;
  const cur = s.cards[i];
  const [flash, setFlash] = useState<"hit" | "pass" | null>(null);
  const busy = useRef(false);
  const config = useSiteConfig();
  const video = room.options.video !== false && config?.features.recording !== false;
  const { recording } = useRoundVideo(video, s.turn);
  useWakeLock(true);
  useEffect(() => () => leaveLandscape(), []);

  const mark = useCallback((r: "hit" | "pass") => {
    if (busy.current || !cur) return;
    busy.current = true;
    setFlash(r);
    playSound(r === "hit" ? "turn" : "draw");
    vibrate(r === "hit" ? [40] : [15, 40, 15]);
    act({ type: "mark", i, r });
    setTimeout(() => { setFlash(null); busy.current = false; }, 650);
  }, [act, cur, i]);
  const { live } = useTilt(true, mark);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") mark("hit");
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") mark("pass");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mark]);
  useEffect(() => { if (left !== null && left <= 5 && left > 0) { vibrate(25); playSound("place"); } if (left === 0) playSound("error"); }, [left]);

  const hits = s.cards.filter((c) => c.r === "hit").length;
  const warn = left !== null && left <= 10;
  const shown = flash === "hit" ? "Richtig!" : flash === "pass" ? "Weiter" : wordText(cur?.w, s.custom);
  return (
    <div className={cn("fixed inset-0 z-50 flex flex-col select-none transition-colors duration-200",
      flash === "hit" ? "bg-emerald-600 text-white" : flash === "pass" ? "bg-amber-500 text-navy-950" : "bg-paper text-paper-ink")} data-testid="forehead">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <b className={cn("text-3xl tabular-nums", warn && !flash && "text-red-600")} data-testid="forehead-time">{left ?? ""}</b>
        <span className="flex min-w-0 items-center gap-2">
          {recording && <span className="flex items-center gap-1 text-xs font-bold text-red-600"><span className="size-2 animate-pulse rounded-full bg-red-600" />Aufnahme</span>}
          {cur && <StyleChip style={cur.style} />}
          {cur?.open && <span className="rounded-full bg-navy-950 px-2.5 py-0.5 text-sm font-semibold text-white">Alle raten</span>}
        </span>
        <b className="text-3xl tabular-nums" aria-label={`${hits} erraten`}>✓{hits}</b>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        <p className="text-center leading-[1.05] font-black tracking-tight break-words hyphens-auto" lang="de" data-testid="forehead-word" style={{ fontSize: fitSize(shown) }}>
          {shown}
        </p>
        {/* Tippen als Ersatz für den Sensor: links weiter, rechts richtig */}
        <button type="button" aria-label="Weiter" className="absolute inset-y-0 left-0 w-1/2 outline-none" onClick={() => mark("pass")} />
        <button type="button" aria-label="Richtig" className="absolute inset-y-0 right-0 w-1/2 outline-none" onClick={() => mark("hit")} />
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm font-semibold opacity-70">
        <span>{live ? "↺ nach hinten: weiter" : "◀ tippen: weiter"}</span>
        <Button variant="outline" size="sm" className="rounded-full ring-current/50" onClick={() => act({ type: "stop" })}>Zug beenden</Button>
        <span>{live ? "nicken: richtig ↻" : "tippen: richtig ▶"}</span>
      </div>
    </div>
  );
}

/** Die Erklärenden sehen den Begriff am eigenen Handy (online) */
function ExplainView({ room, game: s, me, act, steer }: P & { steer: boolean }) {
  const players = room.players;
  const left = useCountdown(deadlineOf(s), false);
  const i = s.cards.length - 1;
  const cur = s.cards[i];
  // Teams: nur das eigene Team sieht den Begriff (bei offenen Karten raten die anderen mit)
  const mine = s.variant !== "teams" || s.team === null || (me !== null && (s.teams[s.team] ?? []).includes(me));
  const hits = s.cards.filter((c) => c.r === "hit").length;
  return (
    <>
      <div className={cn("flex shrink-0 items-center justify-between rounded-xl px-3 py-1.5 ring-1 ring-inset", left !== null && left <= 10 ? "bg-destructive/15 text-destructive ring-destructive/40" : "bg-navy-950/40 ring-border")} data-testid="clock">
        <span className="text-sm">{nameOf(players, s.guesser)} rät · ✓ {hits}</span>
        <b className="text-xl tabular-nums">{left ?? ""}</b>
      </div>
      <Panel title={mine || cur?.open ? (cur?.open && !mine ? "Alle raten – ihr dürft mitraten!" : "Erklärt diesen Begriff") : "Das andere Team ist dran"}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          {cur && <StyleChip style={cur.style} big />}
          {cur && (mine ? <p className="text-4xl font-black tracking-tight break-words" data-testid="explain-word">{wordText(cur.w, s.custom) || "…"}</p> : <p className="text-muted-foreground">Psst – nicht vorsagen.</p>)}
          {cur && <p className="text-sm text-muted-foreground">{STYLE_BY_ID[cur.style].hint}</p>}
        </div>
      </Panel>
      {steer && (
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <Button size="lg" variant="secondary" onClick={() => act({ type: "mark", i, r: "pass" })}><SkipForward />Weiter</Button>
          <Button size="lg" onClick={() => act({ type: "mark", i, r: "hit" })}><Check />Richtig</Button>
        </div>
      )}
    </>
  );
}

/** Nach dem Zug: alle Karten, korrigierbar; offene Karten einem anderen Team zuschreiben; Video ansehen */
function Review({ room, game: s, act, steer, forehead }: P & { steer: boolean; forehead: boolean }) {
  const players = room.players;
  const video = useLastVideo(s.turn);
  const [watch, setWatch] = useState(false);
  const hits = s.cards.filter((c) => c.r === "hit").length;
  return (
    <>
      <TopRow room={room}>Zug von {nameOf(players, s.guesser)}{s.team !== null ? ` · ${teamName(s.team)}` : ""}</TopRow>
      <Panel title={<span data-testid="review-title">{hits} erraten</span>} sub={steer ? "Tippe an, um zu korrigieren." : undefined}>
        <ul className="grid gap-1" data-testid="review">
          {s.cards.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <button type="button" disabled={!steer} onClick={() => act({ type: "fix", i, r: c.r === "hit" ? "pass" : "hit" })}
                className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-1.5 text-left ring-1 ring-inset outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                  c.r === "hit" ? "bg-emerald-500/15 ring-emerald-500/40" : "bg-secondary/60 text-muted-foreground ring-border")}>
                {c.r === "hit" ? <Check className="size-4 shrink-0 text-emerald-500" /> : <X className="size-4 shrink-0" />}
                <span className="min-w-0 flex-1 truncate font-semibold">{wordText(c.w, s.custom)}</span>
                <span aria-hidden="true">{STYLE_BY_ID[c.style].emoji}</span>
              </button>
              {c.open && s.variant === "teams" && (
                <select aria-label="Wer hat es erraten?" disabled={!steer} value={c.team ?? s.team ?? 0}
                  onChange={(e) => act({ type: "fix", i, team: Number(e.target.value) })}
                  className="w-24 shrink-0 rounded-xl bg-secondary px-2 py-1.5 text-sm ring-1 ring-inset ring-border">
                  {s.teams.map((_, t) => <option key={t} value={t} style={{ color: TEAM_COLORS[t] }}>{teamName(t).replace("Team ", "")}</option>)}
                </select>
              )}
            </li>
          ))}
          {!s.cards.length && <li className="text-muted-foreground">Keine Karte gewertet.</li>}
        </ul>
      </Panel>
      {forehead && video && (
        <>
          <Button size="lg" variant="secondary" className="shrink-0" onClick={() => setWatch(true)}><Video />Video der Runde</Button>
          <Sheet open={watch} onOpenChange={setWatch}>
            <SheetContent>
              <SheetHeader><SheetTitle>Video der Runde</SheetTitle><SheetDescription>Nur auf diesem Gerät – nichts wird hochgeladen.</SheetDescription></SheetHeader>
              <div className="grid gap-3 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <video src={video.url} controls playsInline className="max-h-[55vh] w-full rounded-xl bg-black" />
                <a href={video.url} download={`stirnraten-${s.turn + 1}.${video.type.includes("mp4") ? "mp4" : "webm"}`} className={buttonVariants({ variant: "secondary" })}><Download />Video speichern</a>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      {steer ? <Button size="lg" className="shrink-0" data-testid="confirm" onClick={() => act({ type: "confirm" })}>{s.turn + 1 >= s.turns ? "Zum Ergebnis" : "Weiter – nächster Zug"}</Button>
        : <p className="glass shrink-0 rounded-xl py-3 text-center text-muted-foreground">Warte, bis {nameOf(players, s.guesser)} bestätigt …</p>}
    </>
  );
}
