import { useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { RoomAction } from "@shared/platform/room";
import type { Options, Player } from "@shared/platform/types";
import type { WerwolfState } from "@shared/games/werwolf/logic";
import { stepSeconds, tempoOf, Timer, useCountdown } from "./Auto";
import { SCRIPT } from "./script";
import { onlineSay } from "./narration";
import { useAmbience } from "./ambience";
import { setSpeech, speak, speechSupported, useSpeechEnabled, useSpokenCountdown } from "./useSpeech";

/** Wie lange eine Phase online dauert (Sekunden) – null: kein Countdown */
function phaseSeconds(s: WerwolfState, o: Options): number | null {
  const t = tempoOf(o);
  // Nacheinander: Zeit je Rolle, nicht für die ganze Nacht
  if (s.phase === "night" && s.seq) return s.awake ? stepSeconds(s.awake, o) : null;
  if (s.phase === "night") return s.mode === "app" ? t.wolves + t.role : null;
  if (s.phase === "day") return s.runoff ? t.vote : t.talk * 60;
  if (s.phase === "election") return t.vote;
  return null;
}

/**
 * Online, jeder am eigenen Handy: Countdown für Nacht, Diskussion und Wahl auf allen Handys.
 * Das Handy des Hosts sagt an (Nacht, Tag mit den Toten, „noch eine Minute“) und beendet nach einer
 * kurzen Nachfrist Nacht bzw. Abstimmung selbst – so hängt nichts an einem Einzelnen.
 */
export function OnlineClock({ s, players, isHost, options, dispatch }: { s: WerwolfState; players: Player[]; isHost: boolean; options: Options; dispatch: (a: RoomAction) => void }) {
  const secs = phaseSeconds(s, options);
  const start = s.phase === "night" && s.seq ? s.stepAt : s.phaseAt;
  const deadline = secs !== null && start ? start + secs * 1000 : null;
  const left = useCountdown(deadline, false);
  const leader = isHost && s.mode === "app";
  const speech = useSpeechEnabled(true);
  const talk = leader && speech;
  const grace = s.phase === "night" ? (s.seq ? 8 : 15) : 30;
  useSpokenCountdown(left, talk, secs ?? undefined);
  // Nachtgeräusche auf dem Host-Handy (es erzählt ja ohnehin)
  useAmbience(leader && options.ambience === true, s.phase === "night");

  // Ansagen wie ein Spielleiter (nur das Host-Handy, damit es nicht hallt)
  const prev = useRef<WerwolfState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = s;
    if (!talk || before === s) return;
    if (!before) {
      if (s.phase === "reveal") void speak("Willkommen in Düsterwald. Jeder schaut sich jetzt geheim seine Rolle an. Sind alle bereit, beginnt die erste Nacht.");
      return;
    }
    const parts = onlineSay(before, s, players, options);
    if (parts.length) void speak(parts.join(" "));
  }, [talk, s, players, options]);
  useEffect(() => {
    if (!talk) return;
    if (left === 0 && s.phase !== "night") void speak("Die Zeit ist um. Stimmt jetzt ab.");
  }, [left, talk, s.phase, s.runoff]);
  // Nach der Nachfrist beendet das Host-Handy die Phase
  useEffect(() => {
    if (!leader || deadline === null) return;
    const t = setTimeout(() => dispatch({ type: "skip" }), Math.max(0, deadline + grace * 1000 - Date.now()));
    return () => clearTimeout(t);
  }, [leader, deadline, grace, dispatch]);

  if (deadline === null) return null;
  const label = s.phase === "night" ? (s.seq ? `Wach: ${s.awake ? SCRIPT[s.awake].title : "…"}` : "Nacht – handelt jetzt") : s.phase === "election" ? "Zeit für die Wahl" : s.runoff ? "Zeit für die Stichwahl" : "Diskussion und Abstimmung";
  return (
    <div className="grid shrink-0 gap-1">
      <div className="flex items-center gap-2">
        <Timer deadline={deadline} label={label} className="min-w-0 flex-1" />
        {leader && speechSupported() && (
          <button type="button" onClick={() => setSpeech(!speech)} aria-label={speech ? "Ansagen aus" : "Ansagen an"} className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground ring-1 ring-inset ring-border">
            {speech ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        )}
      </div>
      {left === 0 && (
        <p className="text-in text-center text-xs text-muted-foreground" data-testid="ww-grace">
          {s.phase === "night" ? (s.seq ? "Gleich geht es ohne diese Rolle weiter." : "Wer noch nicht gehandelt hat: jetzt! Gleich wird es Tag.") : "Jetzt abstimmen – gleich wird ausgezählt."}
        </p>
      )}
    </div>
  );
}
