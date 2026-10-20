import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chosenVoice, setSpeech, setVoice, setVoiceRate, speak, speechSupported, useSpeechEnabled, useVoices, voiceRate, type Rate } from "@/platform/speech";
import { Segmented } from "./Segmented";
import { setVoiceMode, voiceMode, type VoiceMode } from "./realVoice";
import { useState } from "react";

const RATES: [Rate, string][] = [["calm", "Ruhig"], ["normal", "Normal"], ["quick", "Flott"]];

/** Stimme fürs Vorlesen: an/aus, welche deutsche Stimme des Handys, Tempo, Probe hören */
export function VoiceSettings() {
  const on = useSpeechEnabled(true);
  const voices = useVoices();
  const chosen = chosenVoice() ?? voices[0]?.voiceURI ?? "";
  const rate = voiceRate();
  const [mode, setMode] = useState<VoiceMode>(voiceMode);
  return (
    <div className="grid gap-2.5">
      <label className="flex items-center justify-between gap-3">
        <span className="font-semibold">Vorlesen</span>
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={on} onChange={(e) => setSpeech(e.target.checked)} aria-label="Vorlesen an" />
      </label>
      <Segmented ariaLabel="Welche Stimme" value={mode} small
        options={[{ value: "echt", label: "Echte Stimme" }, { value: "geraet", label: "Stimme des Geräts" }]}
        onChange={(m: VoiceMode) => { setVoiceMode(m); setMode(m); }} />
      {mode === "echt" && <p className="text-xs leading-snug text-muted-foreground">Ein Sprecher mit echter Betonung – Namen, die er noch nicht kennt, lernt er binnen einer Stunde. Bis dahin spricht das Gerät.</p>}
      {mode === "geraet" && !speechSupported() && <p className="text-sm text-muted-foreground">Dieses Gerät kann nicht selbst vorlesen.</p>}
      {mode === "geraet" && speechSupported() && voices.length > 0 ? (
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Stimme</span>
          <select value={chosen} onChange={(e) => setVoice(e.target.value || null)} aria-label="Stimme"
            className="h-11 rounded-xl bg-navy-950/50 px-3 text-base ring-1 ring-inset ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}{v.lang !== "de-DE" ? ` (${v.lang})` : ""}</option>)}
          </select>
        </label>
      ) : mode === "geraet" && speechSupported() ? <p className="text-sm text-muted-foreground">Keine deutsche Stimme gefunden – das Handy nimmt seine Standardstimme.</p> : null}
      {mode === "geraet" && <Segmented ariaLabel="Sprechtempo" value={rate} small options={RATES.map(([r, label]) => ({ value: r, label }))} onChange={setVoiceRate} />}
      <Button variant="secondary" onClick={() => void speak("Es wird Nacht in Düsterwald. Noch 30 Sekunden. 5, 4, 3, 2, 1.", { force: true })}><Volume2 />Probe hören</Button>
      {mode === "geraet" && <p className="text-xs leading-snug text-muted-foreground">
        Tipp: Bessere Stimmen lassen sich nachladen – iPhone: Einstellungen › Bedienungshilfen › Gesprochene Inhalte › Stimmen › Deutsch (z. B. „Anna (Premium)“).
        Android: Einstellungen › Sprachausgabe › Google-Sprachdienste › Deutsch installieren.
      </p>}
    </div>
  );
}
