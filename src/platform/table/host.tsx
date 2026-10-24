import type { VoiceMood } from "@shared/platform/voice";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Smile } from "lucide-react";
import { eveningRanking, planStatus, roomGame, type RoomState } from "@shared/platform/room";
import { getGame } from "@shared/games";
import type { PlayerResult } from "@shared/platform/types";
import { setPref, usePrefs } from "@/lib/prefs";
import { readStr, writeStr } from "@/lib/storage";
import { reducedMotion } from "@/lib/quality";
import { cn } from "@/lib/utils";
import { speak } from "@/platform/speech";
import { OrbHost } from "@/platform/moderator/figures";
import { lineFor, MOODS, type Mood, type Moment } from "@/platform/moderator/lines";
import type { TableModel } from "./model";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import type { HostMoment } from "@shared/platform/hostline";

/** Spiele mit eigenem Spielleiter bzw. geheimen Rollen: der Moderator hält sich raus */
const OWN_LEADER = new Set(["werwolf", "einenacht"]);
const MOOD_KEY = "spieltisch:host-mood";
/** Nächster Charakter des Moderators (wird gemerkt) */
export function nextMood(mood: Mood): Mood {
  const i = MOODS.findIndex((m) => m.value === mood);
  const m = MOODS[(i + 1) % MOODS.length].value;
  writeStr(MOOD_KEY, m);
  return m;
}
export const readMood = (): Mood => { const m = readStr(MOOD_KEY); return m === "frech" || m === "boese" ? m : "charmant"; };

/** Echte Stimme: Charakter des Moderators → Stimmung */
const MOOD_VOICE: Record<Mood, VoiceMood> = { charmant: "froh", frech: "ueberrascht", boese: "wuetend" };

interface Say { text: string; moment: Moment; at: number; ms: number }

/**
 * Moderator am großen Tisch: beobachtet die Partie und sagt an – Beginn, wer dran ist, Kartenzar, Rundenpunkt, Sieg.
 * Reine Darstellung: ändert nichts am Spiel. Der erste Stand nach dem Laden bleibt still (kein Nachholen alter Ereignisse).
 */
export function useTableHost(room: RoomState, model: TableModel | null, mood: Mood, game = ""): { on: boolean; say: Say | null } {
  const p = usePrefs();
  const ai = useSiteConfig()?.features.ai === true;
  const [say, setSay] = useState<Say | null>(null);
  const on = p.host && !OWN_LEADER.has(room.gameId);
  const voice = p.hostVoice && p.sound;
  const playing = room.phase === "playing" && room.game !== null;
  const name = (id: string | null | undefined) => room.players.find((x) => x.id === id)?.name ?? "";

  const show = (moment: Moment, text: string) => {
    const ms = 600 + text.length * 62;
    setSay({ text, moment, at: Date.now(), ms });
    if (voice) void speak(text, { force: true, pitch: 1.1, mood: MOOD_VOICE[mood] });
  };
  // Jede Ansage zählt hoch; eine späte KI-Antwort gilt nur, wenn seither nichts Neues kam,
  // der Moderator noch an ist und dasselbe Spiel läuft (sonst verwerfen – nie in die nächste Partie sprechen)
  const turnNo = useRef(0);
  const live = useRef({ on, gameId: room.gameId });
  live.current = { on, gameId: room.gameId };
  useEffect(() => () => { turnNo.current++; }, []);
  useEffect(() => { if (!on) turnNo.current++; }, [on]);
  const announce = (moment: Moment, who = "") => {
    if (!on) return;
    const n = ++turnNo.current;
    // Seltene Momente mit frischem KI-Spruch (falls eingeschaltet) – sonst und bei jedem Problem die festen Texte
    if (ai && moment !== "dran" && moment !== "pech") {
      const gameId = room.gameId;
      void aiLine({ moment: moment as HostMoment, mood, name: who, game }).then((t) => {
        if (n !== turnNo.current || !live.current.on || live.current.gameId !== gameId) return;
        show(moment, t ?? lineFor(mood, moment, who));
      });
      return;
    }
    show(moment, lineFor(mood, moment, who));
  };

  // Ereignisse vergleichen mit dem zuletzt gesehenen Stand
  const over = playing && (() => { try { return roomGame(room).isOver(room.game); } catch { return false; } })();
  const sham = room.gameId === "schamlos";
  const turn = playing && !over ? model?.turn ?? null : null;
  const pickBy = model?.words?.pickBy ?? null;
  const partyDone = planStatus(room.evening)?.done ?? false;
  const last = useRef<{ playing: boolean; over: boolean; turn: string | null; pickBy: string | null; partyDone: boolean } | null>(null);

  useEffect(() => {
    const now = { playing, over, turn, pickBy, partyDone };
    const prev = last.current;
    last.current = now;
    if (!prev) return;
    // Partyabend durch: zurück am Tisch wird der Sieger des Abends geehrt
    if (now.partyDone && !now.playing && (!prev.partyDone || prev.playing)) {
      const r = eveningRanking(room.evening);
      const best = r[0]?.wins ?? 0;
      const who = r.filter((x) => x.wins === best && best > 0).map((x) => x.name);
      if (who.length) { announce("sieg", who.join(" und ")); return; }
    }
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
  }, [playing, over, turn, pickBy, partyDone]);

  // Abstimmung: Vorschläge ansagen, danach das Ergebnis (wie ein Spielleiter am Tisch)
  const vote = room.vote && !room.vote.winner ? room.vote : null;
  const lastVote = useRef(vote);
  useEffect(() => {
    const prev = lastVote.current;
    lastVote.current = vote;
    if (!on || vote?.endsAt === prev?.endsAt) return;
    if (vote) {
      const names = vote.games.map((g) => getGame(g).info.name);
      show("hallo", `Abstimmung! Zur Wahl stehen ${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}. Stimmt am Handy ab – ihr habt ${Math.max(0, Math.round((vote.endsAt - Date.now()) / 1000))} Sekunden.`);
    } else if (prev && playing && prev.games.includes(room.gameId)) show("hallo", `Entschieden: Als Nächstes spielen wir ${getGame(room.gameId).info.name}!`);
  }, [vote?.endsAt, on]);

  // Sprechblase nach der Sprechdauer ausblenden
  useEffect(() => {
    if (!say) return;
    const t = setTimeout(() => setSay((s) => (s === say ? null : s)), say.ms + 2500);
    return () => clearTimeout(t);
  }, [say]);

  return { on, say: on ? say : null };
}

/** KI-Spruch vom Server holen – null bei Fehler, Zeitüberschreitung oder „kein Spruch“ (204) */
async function aiLine(body: { moment: HostMoment; mood: Mood; name: string; game: string }): Promise<string | null> {
  try {
    const res = await fetch("/api/host/line", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) });
    if (res.status !== 200) return null;
    const data = (await res.json()) as { text?: unknown };
    return typeof data.text === "string" && data.text ? data.text : null;
  } catch { return null; }
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
    // Sprechblase über der Kugel (rechts außen) – so verdeckt sie nie den Platz unten in der Mitte
    <div className="pointer-events-none absolute right-6 bottom-5 flex w-[min(24rem,32%)] flex-col items-end gap-2" data-testid="table-host">
      {say && (
        <p className={cn("text-in rounded-2xl rounded-br-sm bg-[#f7ecd6] px-4 py-3 text-lg leading-snug font-semibold text-[#2b2118] shadow-xl", talking && "ring-2 ring-white/60")}
          data-testid="table-host-line" aria-live="polite">{say.text}</p>
      )}
      <OrbHost mouth={mouth} blink={blink} mood={mood} className="size-36 shrink-0" />
    </div>
  );
}

/** Einstellungen am Tisch: Moderator an/aus, Charakter, Vorlesen */
export function HostPanel({ mood, onMood }: { mood: Mood; onMood: (m: Mood) => void }) {
  const p = usePrefs();
  const next = () => onMood(nextMood(mood));
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

