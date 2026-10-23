import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, Lightbulb, Undo2 } from "lucide-react";
import { active, deadlineOf, kindAt, MAX_TEXT, pagesPer, slotOf, type KAction, type KState, type Page } from "@shared/games/kritzelpost/logic";
import { SAETZE } from "@shared/games/kritzelpost/saetze";
import { COLORS, WIDTHS } from "@shared/games/zeichnen/logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardProps } from "@/games/types";
import { EndActions } from "@/platform/ResultScreen";
import { speak } from "@/platform/speech";
import { cn, vibrate } from "@/lib/utils";
import { Paper } from "@/games/zeichnen/Canvas";

type P = BoardProps<KState, KAction>;
const nameIn = (s: KState, players: P["room"]["players"], id: string | null) => (id && (s.names[id] ?? players.find((p) => p.id === id)?.name)) || "?";

/** Was ein Spielleiter zum Schritt sagt */
export function stepLine(s: KState): string {
  const kind = kindAt(s);
  const clock = s.seconds > 0 ? ` Ihr habt ${s.seconds} Sekunden.` : "";
  if (s.round === 0) {
    return s.mode === "eisbrecher"
      ? `Willkommen bei Kritzelpost! Alle zeichnen jetzt denselben Satz – er steht auf eurem Handy.${clock}`
      : `Willkommen bei Kritzelpost! Jeder schreibt jetzt geheim einen Satz, den jemand anderes zeichnen soll.${clock}`;
  }
  return kind === "draw"
    ? `Weiter geht's! Jeder zeichnet jetzt den Satz, den er bekommen hat.${clock}`
    : `Weiter geht's! Jeder beschreibt jetzt die Zeichnung, die er bekommen hat.${clock}`;
}

/** Was ein Spielleiter zur aufgeschlagenen Albumseite sagt */
export function pageLine(s: KState, page: Page | undefined, name: (id: string | null) => string): string {
  const head = s.page === 0 ? `Die Kette von ${name(s.order[s.book])}. ` : "";
  if (!page) return head;
  if (page.by === null) return `${head}Der Startsatz: ${page.text}`;
  if (page.empty) return `${head}${page.gone ? `${name(page.by)} ist ausgestiegen` : `Von ${name(page.by)} kam leider nichts`}.`;
  return page.kind === "text" ? `${head}${name(page.by)} schrieb: ${page.text}` : `${head}${name(page.by)} hat das hier gezeichnet.`;
}

/** Vorlesen wie ein Spielleiter: lokal das Gerät, online nur das Handy des Hosts (sonst hallt es) */
function useNarration({ game: s, me, isHost, room }: P) {
  const on = room.options.narrate !== false && (me === null || isHost);
  const prev = useRef<KState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!on || before === s) return;
    const name = (id: string | null) => nameIn(s, room.players, id);
    const parts: string[] = [];
    if (s.phase === "play" && (before ? before.phase !== "play" || before.round !== s.round : s.round === 0 && !s.done.length)) parts.push(stepLine(s));
    if (s.phase === "album" && before) {
      if (before.phase !== "album") parts.push("Alle Ketten sind fertig. Jetzt kommt das Album!");
      if (before.phase !== "album" || before.book !== s.book || before.page !== s.page) parts.push(pageLine(s, s.books[s.book]?.[s.page], name));
    }
    if (s.phase === "over" && before && before.phase === "album") parts.push("Das war das ganze Album. Danke fürs Mitkritzeln!");
    if (parts.length) void speak(parts.join(" "));
  }, [on, s, room.players]);
}

/** Uhr bis zum Ende des Schritts */
function Clock({ s }: { s: KState }) {
  const end = deadlineOf(s);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  if (end === null) return null;
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  return <span className={cn("shrink-0 rounded-full bg-[#2b2118] px-3 py-1 text-lg font-bold text-white tabular-nums", left <= 10 && "bg-[#c2492e]")} role="timer" data-testid="clock">{left}</span>;
}

/** Zeit um: das Handy gibt nach kurzer Zeit für alle ab (falls ein Handy weg ist, geht es trotzdem weiter) */
function useTimeUp(s: KState, act: P["act"], delay: number) {
  const deadline = deadlineOf(s);
  useEffect(() => {
    if (deadline === null) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => { act({ type: "timeUp" }); iv = setInterval(() => act({ type: "timeUp" }), 2500); }, Math.max(0, deadline - Date.now()) + delay);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [deadline, delay, act]);
}

/** Eigene Abgabe kurz vor Ablauf der Zeit (was bis dahin dasteht, zählt) */
function useOwnDeadline(s: KState, fire: () => void) {
  const deadline = deadlineOf(s);
  const cb = useRef(fire);
  cb.current = fire;
  useEffect(() => {
    if (deadline === null) return;
    const t = setTimeout(() => cb.current(), Math.max(0, deadline - Date.now() - 300));
    return () => clearTimeout(t);
  }, [deadline]);
}

export function Board(props: P) {
  const { game: s } = props;
  useNarration(props);
  useTimeUp(s, props.act, 3000);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {s.phase === "play" ? <Play {...props} /> : <Album {...props} />}
    </div>
  );
}

/** Ein Schritt: eigene Aufgabe – oder warten, bis alle fertig sind */
function Play(props: P) {
  const { room, game: s, me } = props;
  const local = me === null;
  const players = room.players;
  const still = active(s).filter((id) => !s.done.includes(id));
  // An einem Handy für alle: reihum, wer noch nicht fertig ist
  const cur = local ? still[0] ?? null : me;
  const [shownFor, setShownFor] = useState<string | null>(null);
  const status = `${s.done.length}/${active(s).length} fertig`;
  const canPlay = !!cur && s.order.includes(cur) && !s.left.includes(cur) && !s.done.includes(cur);

  if (!canPlay) {
    const mine = !local && cur ? s.mine : null;
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3" data-testid="kp-wait">
        <p className="text-center text-xl font-semibold">{s.order.includes(me ?? "") && !s.left.includes(me ?? "") ? "Fertig! Die anderen sind noch dran." : "Alle sind am Werk …"}</p>
        {mine && !mine.empty && mine.kind === "text" && <p className="glass rounded-2xl px-4 py-3 text-center text-lg">„{mine.text}“</p>}
        <p className="text-center text-muted-foreground" data-testid="kp-status">{status} · noch dran: {still.map((id) => nameIn(s, players, id)).join(", ") || "–"}</p>
        <div className="flex justify-center"><Clock s={s} /></div>
      </div>
    );
  }
  if (local && shownFor !== cur) {
    const name = nameIn(s, players, cur);
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="glass grid cursor-pointer gap-3 rounded-2xl p-4 text-center" onClick={() => setShownFor(cur)} data-testid="handoff">
          <p className="text-muted-foreground">Gib das Handy an <b className="text-foreground">{name}</b>.</p>
          <Button size="lg" onClick={(e) => { e.stopPropagation(); setShownFor(cur); }}>Ich bin {name} – Aufgabe zeigen</Button>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      </div>
    );
  }
  const task = local ? slotOf(s, cur!).task : s.task ?? null;
  const key = `${cur}-${s.round}`;
  return kindAt(s) === "text"
    ? <TextTask key={key} {...props} id={cur!} task={task} status={status} />
    : <DrawTask key={key} {...props} id={cur!} task={task} status={status} />;
}

function Head({ s, title, status }: { s: KState; title: string; status: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-1">
      <div className="min-w-0">
        <p className="text-lg leading-tight font-bold" data-testid="kp-title">{title}</p>
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
      <Clock s={s} />
    </div>
  );
}

const Missing = ({ what }: { what: string }) => (
  <p className="glass rounded-2xl px-4 py-3 text-center text-muted-foreground">Hier kam leider {what} an – denk dir selbst etwas aus.</p>
);

/** Satz schreiben: am Anfang frei, sonst zur Zeichnung des Vorgängers */
function TextTask({ game: s, me, act, id, task, status }: P & { id: string; task: Page | null; status: string }) {
  const [text, setText] = useState("");
  const local = me === null;
  const send = (t: string) => { vibrate(10); act({ type: "write", text: t, ...(local ? { player: id } : {}) }); };
  const latest = useRef(text);
  latest.current = text;
  useOwnDeadline(s, () => send(latest.current));
  const first = !task;
  return (
    <>
      <Head s={s} title={first ? "Schreib einen Satz" : "Was ist das? Beschreib es"} status={status} />
      {first ? (
        <p className="glass shrink-0 rounded-2xl px-4 py-3 text-center">Jemand anderes zeichnet ihn gleich. Gern etwas Verrücktes!</p>
      ) : task.empty || !task.strokes?.length ? <Missing what="keine Zeichnung" /> : (
        <Paper strokes={task.strokes} className="min-h-0 flex-1" label="Zeichnung deines Vorgängers" />
      )}
      {first && <div className="min-h-0 flex-1" />}
      <form className="grid shrink-0 gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TEXT} placeholder={first ? "Ein Pinguin …" : "Ich sehe …"} aria-label="Dein Satz" autoComplete="off" className="h-12 text-lg" data-testid="kp-text" />
          {first && <Button type="button" variant="secondary" size="icon" className="size-12" aria-label="Idee" onClick={() => setText(SAETZE[Math.floor(Math.random() * SAETZE.length)])}><Lightbulb /></Button>}
        </div>
        <Button type="submit" size="lg" disabled={!text.trim()} data-testid="kp-done">Fertig</Button>
      </form>
    </>
  );
}

/** Zeichnen: den Satz des Vorgängers, mit Farben, Stärke, Rückgängig, Löschen */
function DrawTask({ game: s, me, act, id, task, status }: P & { id: string; task: Page | null; status: string }) {
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const local = me === null;
  const who = local ? { player: id } : {};
  const strokes = s.drafts[id] ?? [];
  const done = () => { vibrate(10); act({ type: "done", ...who }); };
  useOwnDeadline(s, done);
  return (
    <>
      <Head s={s} title="Zeichne diesen Satz" status={status} />
      {task && !task.empty && task.text
        ? <p className="glass shrink-0 rounded-2xl px-4 py-2.5 text-center text-lg font-semibold" data-testid="kp-task">„{task.text}“</p>
        : <Missing what="kein Satz" />}
      <Paper strokes={strokes} onStroke={(k) => act({ type: "stroke", ...k, ...who })} color={color} width={width} className="min-h-0 flex-1" label="Dein Blatt" />
      <div className="flex shrink-0 items-center justify-center gap-1.5" role="group" aria-label="Farbe">
        {COLORS.map((c, i) => (
          <button key={c} type="button" aria-label={`Farbe ${i + 1}`} aria-pressed={color === i} onClick={() => setColor(i)}
            className={cn("size-8 rounded-full ring-1 ring-black/20 outline-none transition", color === i && "ring-[3px] ring-ice scale-110")} style={{ background: c }} />
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2">
        <div className="flex shrink-0 gap-1" role="group" aria-label="Stärke">
          {WIDTHS.map((w, i) => (
            <button key={w} type="button" aria-label={`Stärke ${i + 1}`} aria-pressed={width === i} onClick={() => setWidth(i)}
              className={cn("grid size-9 place-items-center rounded-lg bg-secondary ring-1 ring-inset ring-border outline-none", width === i && "ring-[3px] ring-ice")}>
              <span className="rounded-full bg-foreground" style={{ width: Math.max(3, w * 0.9), height: Math.max(3, w * 0.9) }} />
            </button>
          ))}
        </div>
        <Button variant="secondary" size="icon" aria-label="Rückgängig" disabled={!strokes.length} onClick={() => act({ type: "undo", ...who })}><Undo2 /></Button>
        <Button variant="secondary" size="icon" aria-label="Alles löschen" disabled={!strokes.length} onClick={() => act({ type: "clear", ...who })}><Eraser /></Button>
      </div>
      <Button size="lg" className="shrink-0" onClick={done} data-testid="kp-done">Fertig</Button>
    </>
  );
}

/** Eine Albumseite groß */
function PageView({ s, page, name }: { s: KState; page: Page | undefined; name: (id: string | null) => string }) {
  if (!page) return <div className="min-h-0 flex-1" />;
  const who = page.by === null ? "Startsatz" : name(page.by);
  if (page.kind === "draw" && !page.empty) {
    return (
      <>
        <p className="shrink-0 text-center text-muted-foreground"><b className="text-foreground">{who}</b> zeichnete:</p>
        <Paper strokes={page.strokes ?? []} className="min-h-0 flex-1" label={`Zeichnung von ${who}`} />
      </>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
      <p className="text-center text-muted-foreground">{page.by === null ? "Der Startsatz:" : page.empty ? <><b className="text-foreground">{who}</b>:</> : <><b className="text-foreground">{who}</b> schrieb:</>}</p>
      <p className="glass rounded-2xl px-4 py-6 text-center text-2xl font-bold" data-testid="kp-page-text">
        {page.empty ? <span className="font-normal text-muted-foreground">{page.gone ? "– ausgestiegen –" : page.kind === "draw" ? "– keine Zeichnung –" : "– kein Satz –"}</span> : `„${page.text}“`}
      </p>
      {s.mode === "eisbrecher" && page.by === null && <p className="text-center text-sm text-muted-foreground">Alle Ketten beginnen mit diesem Satz.</p>}
    </div>
  );
}

/** Album: Kette für Kette, Seite für Seite – der Host blättert, nach dem Ende darf jeder selbst zurückblättern */
function Album({ room, game: s, me, isHost, act, dispatch }: P) {
  const local = me === null;
  const over = s.phase === "over";
  const [pos, setPos] = useState({ book: s.book, page: s.page });
  const per = pagesPer(s);
  const at = over ? pos : { book: s.book, page: s.page };
  const name = (id: string | null) => nameIn(s, room.players, id);
  const page = s.books[at.book]?.[at.page];
  const steer = isHost || local;
  const lastPage = at.page + 1 >= per;
  const lastBook = at.book + 1 >= s.books.length;
  const move = (dir: 1 | -1) => {
    vibrate(8);
    if (!over) { act({ type: "page", dir }); return; }
    setPos((p) => {
      if (dir === 1) return p.page + 1 < per ? { ...p, page: p.page + 1 } : p.book + 1 < s.books.length ? { book: p.book + 1, page: 0 } : p;
      return p.page > 0 ? { ...p, page: p.page - 1 } : p.book > 0 ? { book: p.book - 1, page: per - 1 } : p;
    });
  };
  const atStart = at.book === 0 && at.page === 0;
  const atEnd = lastPage && lastBook;
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 px-1" data-testid="kp-album">
        <p className="text-lg font-bold">Kette von {name(s.order[at.book])}</p>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ring-border">Seite {at.page + 1}/{per}</span>
      </div>
      <PageView s={s} page={page} name={name} />
      {(steer || over) ? (
        <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" size="lg" aria-label="Zurückblättern" disabled={atStart} onClick={() => move(-1)}><ChevronLeft /></Button>
          <Button size="lg" variant={over ? "secondary" : "default"} onClick={() => move(1)} disabled={over && atEnd} data-testid="kp-next">
            {over ? "Weiter" : atEnd ? "Album beenden" : lastPage ? "Nächste Kette" : "Weiterblättern"}<ChevronRight />
          </Button>
        </div>
      ) : (
        <p className="glass shrink-0 rounded-xl py-3 text-center text-muted-foreground">Der Host blättert – schaut gemeinsam!</p>
      )}
      {over && <div className="shrink-0"><EndActions isHost={isHost || local} dispatch={dispatch} /></div>}
    </>
  );
}
