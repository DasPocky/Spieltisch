import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigate } from "@/hooks/useRoute";
import { useAdminDevice } from "@/lib/admin";
import { reducedMotion } from "@/lib/quality";
import { Segmented } from "@/platform/Segmented";
import { speak, speechSupported } from "@/platform/speech";
import { OrbHost } from "@/platform/moderator/figures";
import { lineFor, MOMENTS, MOODS, type Mood, type Moment } from "@/platform/moderator/lines";

/**
 * Moderator-Vorschau (nur Verwaltung): die Leuchtkugel ansehen und anhören, Charakter wechseln, Ansagen abspielen.
 * Der Mund läuft nach geschätzter Sprechdauer – auch ohne Gerätestimme.
 */
export function ModeratorPreview() {
  const admin = useAdminDevice();
  const [mood, setMood] = useState<Mood>("charmant");
  const [line, setLine] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [mouth, setMouth] = useState(0);
  const [blink, setBlink] = useState(false);
  const run = useRef(0);

  // Mund wippt beim Sprechen
  useEffect(() => {
    if (!speaking) { setMouth(0); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => { const s = (now - t0) / 1000; setMouth(reducedMotion() ? 0.5 : 0.35 + 0.3 * Math.sin(s * 17)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  // Blinzeln alle paar Sekunden
  useEffect(() => {
    let t = 0, u = 0;
    const next = () => { t = window.setTimeout(() => { setBlink(true); u = window.setTimeout(() => { setBlink(false); next(); }, 140); }, 2500 + Math.random() * 3000); };
    next();
    return () => { clearTimeout(t); clearTimeout(u); };
  }, []);

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
    const text = lineFor(mood, moment, ["Anna", "Ben", "Clara"][Math.floor(Math.random() * 3)]);
    const id = ++run.current;
    setLine(text);
    setSpeaking(true);
    // Mindestens so lange „sprechen“ wie geschätzt – auch wenn das Gerät keine Stimme hat
    await Promise.all([speak(text, { force: true }), new Promise((r) => setTimeout(r, 400 + text.length * 62))]);
    if (run.current === id) setSpeaking(false);
  };
  const stop = () => { run.current++; try { speechSynthesis.cancel(); } catch { /* egal */ } setSpeaking(false); };

  return (
    <main className="mx-auto flex h-dvh-safe max-w-5xl flex-col gap-3 overflow-hidden px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" data-testid="moderator-preview">
      <header className="flex h-14 shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="-ml-2" aria-label="Zurück" onClick={() => navigate("/admin")}><ChevronLeft /></Button>
        <div className="leading-tight">
          <div className="text-lg font-bold tracking-tight">Moderator-Vorschau</div>
          <div className="text-xs text-muted-foreground">Charakter und Stimme ausprobieren</div>
        </div>
      </header>

      <section className="table-room relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-3xl p-6" data-testid="moderator-stage">
        <OrbHost mouth={mouth} blink={blink} mood={mood} className="size-full max-h-96" />
      </section>

      <Segmented label="Charakter" value={mood} options={MOODS} onChange={setMood} small />

      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        {MOMENTS.map((m) => (
          <Button key={m.value} variant="secondary" onClick={() => void play(m.value)} data-testid={`say-${m.value}`}><Volume2 />{m.label}</Button>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate" data-testid="moderator-line">{line || (speechSupported() ? "Tippe eine Ansage an." : "Dieses Gerät hat keine Sprachausgabe – der Mund läuft trotzdem.")}</span>
        {speaking && <Button variant="ghost" size="sm" onClick={stop}><Square />Stopp</Button>}
      </div>
    </main>
  );
}
