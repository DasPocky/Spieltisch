import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigate } from "@/hooks/useRoute";
import { useAdminDevice } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { reducedMotion } from "@/lib/quality";
import { Segmented } from "@/platform/Segmented";
import { speak, speechSupported } from "@/platform/speech";
import { FIGURES } from "@/platform/moderator/figures";
import { LINES, MOMENTS, MOODS, type Mood, type Moment } from "@/platform/moderator/lines";

/**
 * Moderator-Vorschau (nur Verwaltung): Figuren ansehen und anhören, Charakter wechseln, Ansagen abspielen.
 * Hier wird ausgesucht, welche Figur später auf der Bühne steht. Gesprochen wird mit der Stimme des Geräts.
 */
export function ModeratorPreview() {
  const admin = useAdminDevice();
  const [pick, setPick] = useState(0);
  const [mood, setMood] = useState<Mood>("charmant");
  const talk = useTalk();
  const fig = FIGURES[pick];

  if (!admin) {
    return (
      <main className="mx-auto grid min-h-dvh-safe max-w-md content-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-bold">Nur für die Verwaltung</h1>
        <p className="text-muted-foreground">Die Moderator-Vorschau ist nur auf Geräten der Verwaltung sichtbar.</p>
        <Button onClick={() => navigate("/")}>Zur Startseite</Button>
      </main>
    );
  }

  const play = (moment: Moment) => {
    const lines = LINES[mood][moment];
    void talk.say(lines[Math.floor(Math.random() * lines.length)], fig.pitch);
  };

  return (
    <main className="mx-auto flex h-dvh-safe max-w-5xl flex-col gap-3 overflow-hidden px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" data-testid="moderator-preview">
      <header className="flex h-14 shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="-ml-2" aria-label="Zurück" onClick={() => navigate("/admin")}><ChevronLeft /></Button>
        <div className="leading-tight">
          <div className="text-lg font-bold tracking-tight">Moderator-Vorschau</div>
          <div className="text-xs text-muted-foreground">Figur, Charakter und Stimme ausprobieren</div>
        </div>
      </header>

      {/* Bühne: am Handy eine Figur groß, am Rechner alle nebeneinander */}
      <section className="glass grid min-h-0 flex-1 place-items-center rounded-3xl p-3 lg:grid-cols-4 lg:gap-3">
        {FIGURES.map((f, i) => (
          <button key={f.id} type="button" onClick={() => setPick(i)} data-testid={`figure-${f.id}`} aria-pressed={pick === i}
            className={cn("relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 rounded-2xl outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
              pick === i ? "lg:bg-primary/10 lg:ring-2 lg:ring-primary/40" : "hidden lg:flex lg:opacity-70")}>
            <f.Figure mouth={pick === i ? talk.mouth : 0} blink={talk.blink} mood={mood} className="min-h-0 w-full max-w-72 flex-1" />
            <span className="text-sm font-bold">{f.name} <span className="font-normal text-muted-foreground">· {f.look}</span></span>
          </button>
        ))}
      </section>

      {/* Figur wählen (am Handy) */}
      <div className="grid shrink-0 grid-cols-4 gap-1.5 lg:hidden" role="radiogroup" aria-label="Figur">
        {FIGURES.map((f, i) => (
          <button key={f.id} type="button" role="radio" aria-checked={pick === i} onClick={() => setPick(i)}
            className={cn("h-10 rounded-xl text-sm font-semibold ring-1 ring-inset outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
              pick === i ? "bg-primary/14 text-primary ring-primary/35" : "text-muted-foreground ring-border")}>
            {f.name}
          </button>
        ))}
      </div>

      <Segmented label="Charakter" value={mood} options={MOODS} onChange={setMood} small />

      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        {MOMENTS.map((m) => (
          <Button key={m.value} variant="secondary" onClick={() => play(m.value)} data-testid={`say-${m.value}`}><Volume2 />{m.label}</Button>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate" data-testid="moderator-line">{talk.line || (speechSupported() ? "Tippe eine Ansage an." : "Dieses Gerät hat keine Sprachausgabe – der Mund bewegt sich trotzdem.")}</span>
        {talk.speaking && <Button variant="ghost" size="sm" onClick={talk.stop}><Square />Stopp</Button>}
      </div>
    </main>
  );
}

/**
 * Sprechen mit Mundbewegung: der Mund wippt, solange gesprochen wird, und öffnet sich bei jedem Wort etwas weiter.
 * Ohne Wort-Signale (manche Stimmen) wippt er einfach gleichmäßig. Blinzeln alle paar Sekunden.
 */
function useTalk() {
  const [mouth, setMouth] = useState(0);
  const [blink, setBlink] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [line, setLine] = useState("");
  const pulse = useRef(0);
  const run = useRef(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const next = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); next(); }, 2500 + Math.random() * 2500); };
    next();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!speaking) { setMouth(0); return; }
    const calm = reducedMotion();
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const s = (now - start) / 1000;
      pulse.current *= 0.9;
      setMouth(calm ? 0.5 : Math.max(0, Math.min(1, 0.3 + 0.28 * Math.sin(s * 17) + 0.18 * Math.sin(s * 7.3) + pulse.current)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  const say = async (text: string, pitch: number) => {
    const id = ++run.current;
    setLine(text);
    setSpeaking(true);
    await speak(text, { force: true, pitch, onWord: () => { pulse.current = 0.45; } });
    if (run.current === id) setSpeaking(false);
  };
  const stop = () => { run.current++; try { speechSynthesis.cancel(); } catch { /* egal */ } setSpeaking(false); };
  return { mouth, blink, speaking, line, say, stop };
}
