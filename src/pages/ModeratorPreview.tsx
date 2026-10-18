import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigate } from "@/hooks/useRoute";
import { useAdminDevice } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { reducedMotion, useQuality, webglOk } from "@/lib/quality";
import { Segmented } from "@/platform/Segmented";
import { speak, speechSupported } from "@/platform/speech";
import { OrbHost } from "@/platform/moderator/figures";
import { LINES, MOMENTS, MOODS, type Mood, type Moment } from "@/platform/moderator/lines";
import type { FigureKind, ModeratorStage } from "@/platform/moderator/stage3d";

/** Figuren zur Auswahl – beide frei nutzbar (CC0), siehe public/models/moderator/LIZENZEN.txt */
const FIGURES: { kind: FigureKind; name: string; look: string; pitch: number }[] = [
  { kind: "mensch", name: "Lena", look: "Mensch", pitch: 1.1 },
  { kind: "roboter", name: "Robo", look: "Roboter", pitch: 1.35 },
];

/**
 * Moderator-Vorschau (nur Verwaltung): 3D-Figuren ansehen und anhören, Charakter wechseln, Ansagen mit Gesten abspielen.
 * Hier wird ausgesucht, wer später auf der Bühne steht. Ohne 3D (Grafik „Ohne 3D“, kein WebGL) erscheint die Leuchtkugel.
 */
export function ModeratorPreview() {
  const admin = useAdminDevice();
  const [pick, setPick] = useState(0);
  const [mood, setMood] = useState<Mood>("charmant");
  const [line, setLine] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [mouth, setMouth] = useState(0);
  const stage = useRef<ModeratorStage | null>(null);
  const run = useRef(0);
  const fig = FIGURES[pick];
  const onStage = useCallback((st: ModeratorStage | null) => { stage.current = st; }, []);

  // Leuchtkugel: Mund wippt beim Sprechen
  useEffect(() => {
    if (!speaking) { setMouth(0); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => { const s = (now - t0) / 1000; setMouth(reducedMotion() ? 0.5 : 0.35 + 0.3 * Math.sin(s * 17)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  if (!admin) {
    return (
      <main className="mx-auto grid min-h-dvh-safe max-w-md content-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-bold">Nur für die Verwaltung</h1>
        <p className="text-muted-foreground">Die Moderator-Vorschau ist nur auf Geräten der Verwaltung sichtbar.</p>
        <Button onClick={() => navigate("/")}>Zur Startseite</Button>
      </main>
    );
  }

  const play = async (moment: Moment) => {
    const lines = LINES[mood][moment];
    const text = lines[Math.floor(Math.random() * lines.length)];
    const id = ++run.current;
    setLine(text);
    setSpeaking(true);
    stage.current?.gesture(moment);
    stage.current?.speak(text, 400 + text.length * 62);
    await speak(text, { force: true, pitch: fig.pitch, onWord: () => stage.current?.word() });
    if (run.current === id) { setSpeaking(false); stage.current?.stopSpeaking(); }
  };
  const stop = () => { run.current++; try { speechSynthesis.cancel(); } catch { /* egal */ } setSpeaking(false); stage.current?.stopSpeaking(); };

  return (
    <main className="mx-auto flex h-dvh-safe max-w-5xl flex-col gap-3 overflow-hidden px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" data-testid="moderator-preview">
      <header className="flex h-14 shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="-ml-2" aria-label="Zurück" onClick={() => navigate("/admin")}><ChevronLeft /></Button>
        <div className="leading-tight">
          <div className="text-lg font-bold tracking-tight">Moderator-Vorschau</div>
          <div className="text-xs text-muted-foreground">Figur, Charakter und Stimme ausprobieren</div>
        </div>
      </header>

      <section className="table-room relative min-h-0 flex-1 overflow-hidden rounded-3xl" data-testid="moderator-stage">
        <Moderator3D key={fig.kind} kind={fig.kind} mood={mood} onStage={onStage}
          fallback={<OrbHost mouth={mouth} blink={false} mood={mood} className="size-full" />} />
        <span className="plate absolute bottom-3 left-1/2 -translate-x-1/2">{fig.name} · {fig.look}</span>
      </section>

      <div className="grid shrink-0 grid-cols-2 gap-1.5" role="radiogroup" aria-label="Figur">
        {FIGURES.map((f, i) => (
          <button key={f.kind} type="button" role="radio" aria-checked={pick === i} onClick={() => { stop(); setPick(i); }} data-testid={`figure-${f.kind}`}
            className={cn("h-10 rounded-xl text-sm font-semibold ring-1 ring-inset outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring",
              pick === i ? "bg-primary/14 text-primary ring-primary/35" : "text-muted-foreground ring-border")}>
            {f.name} <span className="font-normal opacity-75">· {f.look}</span>
          </button>
        ))}
      </div>

      <Segmented label="Charakter" value={mood} options={MOODS} onChange={(m) => { setMood(m); stage.current?.setMood(m); }} small />

      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        {MOMENTS.map((m) => (
          <Button key={m.value} variant="secondary" onClick={() => void play(m.value)} data-testid={`say-${m.value}`}><Volume2 />{m.label}</Button>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate" data-testid="moderator-line">{line || (speechSupported() ? "Tippe eine Ansage an." : "Dieses Gerät hat keine Sprachausgabe – Mund und Gesten laufen trotzdem.")}</span>
        {speaking && <Button variant="ghost" size="sm" onClick={stop}><Square />Stopp</Button>}
      </div>
    </main>
  );
}

/** 3D-Bühne (three.js erst bei Bedarf); ohne 3D oder bei Fehlern der Ersatz */
function Moderator3D({ kind, mood, onStage, fallback }: { kind: FigureKind; mood: Mood; onStage: (s: ModeratorStage | null) => void; fallback: React.ReactNode }) {
  const holder = useRef<HTMLDivElement>(null);
  const quality = useQuality();
  const flat = quality === "flach" || !webglOk();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const moodRef = useRef(mood);
  moodRef.current = mood;

  useEffect(() => {
    if (flat || !holder.current) return;
    const box = holder.current;
    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 size-full";
    canvas.dataset.testid = "moderator-3d";
    box.replaceChildren(canvas);
    let s: ModeratorStage | null = null, gone = false;
    let ro: ResizeObserver | null = null;
    setState("loading");
    void import("@/platform/moderator/stage3d")
      .then((m) => m.createModeratorStage(canvas, kind, quality, moodRef.current))
      .then((stage) => {
        if (gone) { stage.dispose(); return; }
        s = stage;
        ro = new ResizeObserver(() => stage.resize(canvas.clientWidth, canvas.clientHeight));
        ro.observe(canvas);
        stage.resize(canvas.clientWidth, canvas.clientHeight);
        onStage(stage);
        setState("ready");
      })
      .catch(() => { if (!gone) setState("failed"); });
    return () => { gone = true; ro?.disconnect(); s?.dispose(); onStage(null); };
  }, [kind, quality, flat, onStage]);

  if (flat || state === "failed") {
    return (
      <div className="absolute inset-0 grid place-items-center p-6">
        {fallback}
        {state === "failed" && !flat && (
          <p className="absolute top-3 right-3 left-3 rounded-xl bg-black/55 px-3 py-2 text-center text-sm text-[#f7ecd6]" data-testid="figure-missing">
            Figur nicht gefunden – in der Verwaltung unter Einstellungen → Dateien → Moderator-Figuren „{kind}.glb“ hochladen.
          </p>
        )}
      </div>
    );
  }
  return (
    <>
      <div ref={holder} className="absolute inset-0" />
      {state === "loading" && <div className="absolute inset-0 grid place-items-center"><Loader2 className="size-8 animate-spin text-[#f7ecd6]" /></div>}
    </>
  );
}
