import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { roomGame, type RoomState } from "@shared/platform/room";
import { setPref, usePrefs } from "@/lib/prefs";
import { Volumes } from "@/platform/Volumes";
import { audioRunning, playCrowd, playSound, startMusic, stopMusic, unlockAudio } from "@/platform/sound";
import type { TableModel } from "./model";

/** Spiele mit geheimen Rollen: am Tisch keine Töne, die etwas verraten könnten – nur Musik */
const QUIET_GAMES = new Set(["werwolf", "einenacht"]);

/**
 * Ton am großen Tisch: Musik (Lobby lebhafter, in der Partie ruhig), Effekte zu dem, was auf dem Tisch passiert
 * (Karte gelegt, gezogen), Publikum bei Punkten und am Ende. Die Handys bleiben dabei leise wie bisher.
 */
export function useTableSound(room: RoomState, model: TableModel | null) {
  const playing = room.phase === "playing" && room.game !== null;
  const over = playing && (() => { try { return roomGame(room).isOver(room.game); } catch { return false; } })();
  const quiet = QUIET_GAMES.has(room.gameId);

  useEffect(() => { startMusic(playing && !over ? "play" : "lobby"); }, [playing, over]);
  useEffect(() => () => stopMusic(), []);

  // Karten: neue oberste Ablage → legen, mehr Karten auf den Händen → ziehen
  const last = useRef<{ top?: string; total: number; n: number } | null>(null);
  useEffect(() => {
    if (!model || quiet) { last.current = null; return; }
    const now = { top: model.discard.at(-1), total: Object.values(model.counts).reduce((a, b) => a + b, 0), n: model.n };
    const prev = last.current;
    last.current = now;
    if (!prev || now.n === prev.n) return;
    if (now.top !== prev.top) playSound("place");
    else if (now.total > prev.total) playSound("draw");
  }, [model, quiet]);

  // Lückensatz: Antwort gewählt → Lachen und Applaus
  const pick = model?.words?.pick ?? null;
  const lastPick = useRef(pick);
  useEffect(() => {
    if (pick !== null && lastPick.current === null) { playCrowd("laugh"); setTimeout(() => playCrowd("applause"), 900); }
    lastPick.current = pick;
  }, [pick]);

  // Ende der Partie: Jubel (erster Stand nach dem Laden bleibt still)
  const lastOver = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastOver.current === false && over) playCrowd("cheer");
    lastOver.current = playing ? over : null;
  }, [over, playing]);
}

/**
 * Ton-Regler am Tisch: an/aus und drei Lautstärken. Fernseher-Browser spielen erst nach einem Klick –
 * solange zeigt der Knopf „Ton einschalten“.
 */
export function SoundPanel() {
  const p = usePrefs();
  const [running, setRunning] = useState(audioRunning);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (running) return;
    const t = setInterval(() => setRunning(audioRunning()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const on = p.sound;

  if (on && !running) {
    return (
      <button type="button" onClick={() => { unlockAudio(); setTimeout(() => setRunning(audioRunning()), 200); }} data-testid="sound-unlock"
        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold text-[#f7ecd6] outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#f7ecd6]">
        <Volume2 className="size-4" />Ton einschalten
      </button>
    );
  }
  return (
    <div className="grid gap-2" data-testid="sound-panel">
      <div className="flex gap-2">
        <button type="button" role="switch" aria-checked={on} onClick={() => setPref("sound", !on)} data-testid="sound-toggle"
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold text-[#f7ecd6] outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#f7ecd6]">
          {on ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}{on ? "Ton an" : "Ton aus"}
        </button>
        {on && (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="sound-more"
            className="h-10 rounded-xl px-3 text-sm font-semibold text-[#f7ecd6]/80 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#f7ecd6]">
            Lautstärke
          </button>
        )}
      </div>
      {on && open && <Volumes className="text-[#f7ecd6]" />}
    </div>
  );
}
