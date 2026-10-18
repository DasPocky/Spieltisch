import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Smile } from "lucide-react";
import { roomGame, type RoomState } from "@shared/platform/room";
import type { PlayerResult } from "@shared/platform/types";
import { setPref, usePrefs } from "@/lib/prefs";
import { readStr, writeStr } from "@/lib/storage";
import { reducedMotion } from "@/lib/quality";
import { cn } from "@/lib/utils";
import { speak } from "@/platform/speech";
import { OrbHost } from "@/platform/moderator/figures";
import { lineFor, MOODS, type Mood, type Moment } from "@/platform/moderator/lines";
import type { TableModel } from "./model";

/** Spiele mit eigenem Spielleiter bzw. geheimen Rollen: der Moderator hält sich raus */
const OWN_LEADER = new Set(["werwolf", "einenacht"]);
const MOOD_KEY = "spieltisch:host-mood";
export const readMood = (): Mood => { const m = readStr(MOOD_KEY); return m === "frech" || m === "boese" ? m : "charmant"; };

interface Say { text: string; moment: Moment; at: number; ms: number }

/**
 * Moderator am großen Tisch: beobachtet die Partie und sagt an – Beginn, wer dran ist, Kartenzar, Rundenpunkt, Sieg.
 * Reine Darstellung: ändert nichts am Spiel. Der erste Stand nach dem Laden bleibt still (kein Nachholen alter Ereignisse).
 */
export function useTableHost(room: RoomState, model: TableModel | null, mood: Mood): { on: boolean; say: Say | null } {
  const p = usePrefs();
  const [say, setSay] = useState<Say | null>(null);
  const on = p.host && !OWN_LEADER.has(room.gameId);
  const voice = p.hostVoice && p.sound;
  const playing = room.phase === "playing" && room.game !== null;
  const name = (id: string | null | undefined) => room.players.find((x) => x.id === id)?.name ?? "";

  const announce = (moment: Moment, who = "") => {
    if (!on) return;
    const text = lineFor(mood, moment, who);
    const ms = 600 + text.length * 62;
    setSay({ text, moment, at: Date.now(), ms });
    if (voice) void speak(text, { force: true, pitch: 1.1 });
  };

  // Ereignisse vergleichen mit dem zuletzt gesehenen Stand
  const over = playing && (() => { try { return roomGame(room).isOver(room.game); } catch { return false; } })();
  const sham = room.gameId === "schamlos";
  const turn = playing && !over ? model?.turn ?? null : null;
  const pickBy = model?.words?.pickBy ?? null;
  const last = useRef<{ playing: boolean; over: boolean; turn: string | null; pickBy: string | null } | null>(null);

  useEffect(() => {
    const now = { playing, over, turn, pickBy };
    const prev = last.current;
    last.current = now;
    if (!prev) return;
    if (now.playing && !prev.playing) { announce("hallo"); return; }
    if (now.over && !prev.over) {
      let winners: PlayerResult[] = [];
      try {
        winners = (roomGame(room).results?.(room.game, { players: room.players, hostId: room.hostId, actorId: null, options: room.options, now: Date.now() }) ?? []).filter((r) => r.won);
      } catch { /* ohne Ergebnis */ }
      // Ohne Ergebnis-Liste: wer die meisten Punkte hat
      if (!winners.length && model?.scores) {
        const best = Math.max(...Object.values(model.scores));
        winners = Object.entries(model.scores).filter(([, v]) => v === best).map(([id]) => ({ id, won: true }));
      }
      const who = winners.map((w) => name(w.id)).filter(Boolean);
      if (who.length) announce("sieg", who.join(" und "));
      return;
    }
    if (now.pickBy && now.pickBy !== prev.pickBy) { announce("punkt", name(now.pickBy)); return; }
    if (now.turn && now.turn !== prev.turn) announce(sham ? "zar" : "dran", name(now.turn));
  }, [playing, over, turn, pickBy]);

  // Sprechblase nach der Sprechdauer ausblenden
  useEffect(() => {
    if (!say) return;
    const t = setTimeout(() => setSay((s) => (s === say ? null : s)), say.ms + 2500);
    return () => clearTimeout(t);
  }, [say]);

  return { on, say: on ? say : null };
}

/** Der Smiley unten rechts am Tisch mit Sprechblase */
export function HostCorner({ say, mood }: { say: Say | null; mood: Mood }) {
  const [mouth, setMouth] = useState(0);
  const [blink, setBlink] = useState(false);
  const talking = !!say && Date.now() - say.at < say.ms;

  useEffect(() => {
    if (!say) return;
    let raf = 0;
    const tick = () => {
      const t = Date.now() - say.at;
      if (t > say.ms) { setMouth(0); return; }
      setMouth(reducedMotion() ? 0.5 : 0.35 + 0.3 * Math.sin(t / 60));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [say]);

  useEffect(() => {
    let a = 0, b = 0;
    const next = () => { a = window.setTimeout(() => { setBlink(true); b = window.setTimeout(() => { setBlink(false); next(); }, 140); }, 2500 + Math.random() * 3000); };
    next();
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  return (
    <div className="pointer-events-none absolute right-6 bottom-5 flex max-w-[min(34rem,60%)] items-end justify-end gap-2" data-testid="table-host">
      {say && (
        <p className={cn("text-in mb-6 rounded-2xl rounded-br-sm bg-[#f7ecd6] px-4 py-3 text-lg leading-snug font-semibold text-[#2b2118] shadow-xl", talking && "ring-2 ring-white/60")}
          data-testid="table-host-line" aria-live="polite">{say.text}</p>
      )}
      <OrbHost mouth={mouth} blink={blink} mood={mood} className="size-36 shrink-0" />
    </div>
  );
}

/** Einstellungen am Tisch: Moderator an/aus, Charakter, Vorlesen */
export function HostPanel({ mood, onMood }: { mood: Mood; onMood: (m: Mood) => void }) {
  const p = usePrefs();
  const next = () => { const i = MOODS.findIndex((m) => m.value === mood); const m = MOODS[(i + 1) % MOODS.length].value; writeStr(MOOD_KEY, m); onMood(m); };
  const btn = "flex h-10 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold text-[#f7ecd6] outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#f7ecd6]";
  return (
    <div className="flex gap-2" data-testid="host-panel">
      <button type="button" className={cn(btn, "flex-1", !p.host && "opacity-50 line-through")} onClick={() => setPref("host", !p.host)} aria-pressed={p.host} data-testid="host-toggle">
        <Smile className="size-4" />Moderator
      </button>
      {p.host && <button type="button" className={btn} onClick={next} data-testid="host-mood">{MOODS.find((m) => m.value === mood)?.label}</button>}
      {p.host && (
        <button type="button" className={btn} onClick={() => setPref("hostVoice", !p.hostVoice)} aria-pressed={p.hostVoice} aria-label={p.hostVoice ? "Vorlesen aus" : "Vorlesen an"} data-testid="host-voice">
          {p.hostVoice ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </button>
      )}
    </div>
  );
}

