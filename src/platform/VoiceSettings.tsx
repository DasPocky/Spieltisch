import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chosenVoice, setSpeech, setVoice, setVoiceRate, speak, speechSupported, useSpeechEnabled, useVoices, voiceRate, type Rate } from "@/platform/speech";
import { cn } from "@/lib/utils";

const RATES: [Rate, string][] = [["calm", "Ruhig"], ["normal", "Normal"], ["quick", "Flott"]];

/** Stimme fürs Vorlesen: an/aus, welche deutsche Stimme des Handys, Tempo, Probe hören */
export function VoiceSettings() {
  const on = useSpeechEnabled(true);
  const voices = useVoices();
  const chosen = chosenVoice() ?? voices[0]?.voiceURI ?? "";
  const rate = voiceRate();
  if (!speechSupported()) return <p className="text-sm text-muted-foreground">Dieses Gerät kann nicht vorlesen.</p>;
  return (
    <div className="grid gap-2.5">
      <label className="flex items-center justify-between gap-3">
        <span className="font-semibold">Vorlesen</span>
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={on} onChange={(e) => setSpeech(e.target.checked)} aria-label="Vorlesen an" />
      </label>
      {voices.length > 0 ? (
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Stimme</span>
          <select value={chosen} onChange={(e) => setVoice(e.target.value || null)} aria-label="Stimme"
            className="h-11 rounded-xl bg-navy-950/50 px-3 text-base ring-1 ring-inset ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}{v.lang !== "de-DE" ? ` (${v.lang})` : ""}</option>)}
          </select>
        </label>
      ) : <p className="text-sm text-muted-foreground">Keine deutsche Stimme gefunden – das Handy nimmt seine Standardstimme.</p>}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-navy-950/50 p-1 ring-1 ring-inset ring-border" role="radiogroup" aria-label="Sprechtempo">
        {RATES.map(([r, label]) => (
          <button key={r} type="button" role="radio" aria-checked={rate === r} onClick={() => setVoiceRate(r)}
            className={cn("rounded-lg py-2 text-sm font-semibold", rate === r ? "bg-navy-600 shadow-sm" : "text-muted-foreground")}>{label}</button>
        ))}
      </div>
      <Button variant="secondary" onClick={() => void speak("Es wird Nacht in Düsterwald. Noch 30 Sekunden. 5, 4, 3, 2, 1.", { force: true })}><Volume2 />Probe hören</Button>
      <p className="text-xs leading-snug text-muted-foreground">
        Tipp: Bessere Stimmen lassen sich nachladen – iPhone: Einstellungen › Bedienungshilfen › Gesprochene Inhalte › Stimmen › Deutsch (z. B. „Anna (Premium)“).
        Android: Einstellungen › Sprachausgabe › Google-Sprachdienste › Deutsch installieren.
      </p>
    </div>
  );
}
