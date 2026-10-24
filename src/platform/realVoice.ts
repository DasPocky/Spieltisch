/**
 * Echte Stimme am Gerät: Satz in Bausteine zerlegen (Namen der Mitspieler, Zahlen, feste Teile), die Bausteine
 * aus R2 laden und lückenlos hintereinander abspielen. Fehlt einer, meldet das Gerät ihn und es spricht die
 * Gerätestimme – beim nächsten Mal (nach dem Lauf der GitHub-Aktion) ist er da.
 */
import { useEffect } from "react";
import { assetUrl } from "@shared/platform/files";
import { MAX_PIECE, pieceKey, pieces, sentences, VOICE_INDEX, type Piece, type VoiceMood } from "@shared/platform/voice";
import { voiceOut } from "./sound";

const MODE_KEY = "spieltisch:voiceMode";
export type VoiceMode = "echt" | "geraet";
export function voiceMode(): VoiceMode { try { return localStorage.getItem(MODE_KEY) === "geraet" ? "geraet" : "echt"; } catch { return "echt"; } }
export function setVoiceMode(m: VoiceMode) { try { localStorage.setItem(MODE_KEY, m); } catch { /* egal */ } }

/** Namen der Mitspieler – sie werden als eigene Bausteine gesprochen */
let names: string[] = [];
export function useVoiceNames(players: { name: string }[]) {
  const key = players.map((p) => p.name).join("\u0001");
  useEffect(() => { names = key ? key.split("\u0001") : []; }, [key]);
}

/**
 * Verzeichnis der vorhandenen Bausteine (alle 10 Minuten neu). Scheitert der Abruf, ist es unbekannt (null,
 * kein leeres Verzeichnis): dann nichts als fehlend melden und nach einer Minute neu fragen.
 */
let index: { at: number; ttl: number; keys: Promise<Set<string> | null> } | null = null;
function known(): Promise<Set<string> | null> {
  if (index && Date.now() - index.at < index.ttl) return index.keys;
  const entry: NonNullable<typeof index> = { at: Date.now(), ttl: 10 * 60_000, keys: Promise.resolve(null) };
  entry.keys = fetch(assetUrl(VOICE_INDEX), { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { keys?: unknown }) => new Set(Array.isArray(j.keys) ? j.keys.filter((k): k is string => typeof k === "string") : []))
    .catch(() => { entry.ttl = 60_000; return null; });
  index = entry;
  return entry.keys;
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();
function load(ctx: AudioContext, key: string): Promise<AudioBuffer | null> {
  let p = buffers.get(key);
  if (!p) {
    p = fetch(assetUrl(`stimme/${key}.mp3`)).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? ctx.decodeAudioData(b) : null)).catch(() => null);
    buffers.set(key, p);
    // Fehlschläge nicht merken – nach dem Hochladen soll der Baustein ohne Neuladen der Seite kommen
    void p.then((b) => { if (!b && buffers.get(key) === p) buffers.delete(key); });
    // Nicht endlos wachsen
    if (buffers.size > 400) buffers.delete(buffers.keys().next().value!);
  }
  return p;
}

/** Gemeldete Bausteine (Schlüssel → Zeitpunkt): erst nach einer Stunde erneut melden, gescheiterte Meldung bald wieder */
const reported = new Map<string, number>();
const REPORT_AGAIN_MS = 60 * 60_000;
const REPORT_RETRY_MS = 60_000;
function report(items: { mood: VoiceMood; text: string; key: string }[]) {
  const now = Date.now();
  const fresh = items.filter((i) => now - (reported.get(i.key) ?? -Infinity) >= REPORT_AGAIN_MS);
  if (!fresh.length) return;
  for (const i of fresh) { reported.delete(i.key); reported.set(i.key, now); }
  if (reported.size > 1000) for (const k of [...reported.keys()].slice(0, 200)) reported.delete(k);
  // Nicht angekommen (offline, gebremst, Serverfehler): in einer Minute nochmal versuchen
  const retry = () => { for (const i of fresh) if (reported.get(i.key) === now) reported.set(i.key, now - REPORT_AGAIN_MS + REPORT_RETRY_MS); };
  void fetch("/api/voice/missing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: fresh.map(({ mood, text }) => ({ mood, text })) }), keepalive: true })
    .then((r) => { if (!r.ok) retry(); }, retry);
}

let playing: AudioBufferSourceNode[] = [];
/** Zählt jedes Abbrechen – eine Ansage, die noch lädt, spielt nur, wenn seither nichts Neues kam */
let generation = 0;
const stopSources = () => {
  for (const s of playing) try { s.stop(); } catch { /* schon zu Ende */ }
  playing = [];
};
/** Laufende Ansage abbrechen (neue Ansage oder Vorlesen aus) – auch eine, die gerade noch lädt */
export function stopReal() {
  generation++;
  stopSources();
}

/**
 * Spielt `text` mit der echten Stimme. true, wenn gespielt (Promise endet nach dem letzten Baustein),
 * false, wenn es nicht geht (Einstellung, kein WebAudio, Baustein fehlt) – dann spricht das Gerät.
 */
export async function speakReal(text: string, opts: { mood?: VoiceMood; onWord?: () => void } = {}): Promise<boolean> {
  if (voiceMode() !== "echt") return false;
  const out = voiceOut();
  if (!out) return false;
  const mood = opts.mood ?? "neutral";
  const mine = generation;
  const have = await known();
  // Verzeichnis unbekannt (Netz weg): Gerätestimme, nichts melden
  if (!have) return false;
  // Je Satz: am Stück, wenn es ihn gibt – sonst aus Bausteinen (Namen, Zahlen, feste Teile)
  const keyed: (Piece & { key: string })[] = [];
  const missing: { mood: VoiceMood; text: string; key: string }[] = [];
  let complete = true;
  for (const s of sentences(text)) {
    const whole = s.length <= MAX_PIECE ? { kind: "text" as const, text: s, mood, end: true, key: await pieceKey(mood, s) } : null;
    if (whole && have.has(whole.key)) { keyed.push(whole); continue; }
    const parts = await Promise.all(pieces(s, names, mood).map(async (p) => ({ ...p, key: await pieceKey(p.mood, p.text) })));
    const gaps = parts.filter((p) => !have.has(p.key));
    // Den ganzen Satz wünschen (klingt besser) – dazu fehlende Namen, die auch in anderen Sätzen helfen
    if (whole) missing.push(whole);
    missing.push(...gaps.filter((p) => p.kind === "name" || !whole));
    if (gaps.length || !parts.length) complete = false;
    else keyed.push(...parts);
  }
  if (missing.length) report(missing);
  // Fehlt ein Satz ganz: lieber alles mit einer Stimme (Gerät)
  if (!complete || !keyed.length) return false;
  const bufs = await Promise.all(keyed.map((p) => load(out.ctx, p.key)));
  // Während des Ladens kam eine neuere Ansage oder das Vorlesen wurde ausgeschaltet: diese verwerfen,
  // ohne die neuere zu stoppen – und ohne Gerätestimme nachzusprechen
  if (mine !== generation) return true;
  if (bufs.some((b) => !b)) return false;
  stopSources();
  const { ctx } = out;
  let t = ctx.currentTime + 0.05;
  const sources: AudioBufferSourceNode[] = [];
  keyed.forEach((p, i) => {
    const src = ctx.createBufferSource();
    src.buffer = bufs[i]!;
    src.connect(out.out);
    src.start(t);
    sources.push(src);
    // Kurze Atempause zwischen Bausteinen, längere nach Satzende
    t += bufs[i]!.duration + (p.end || /[.!?…]$/.test(p.text) ? 0.28 : 0.06);
  });
  playing = sources;
  const total = (t - ctx.currentTime) * 1000;
  const mouth = opts.onWord ? setInterval(opts.onWord, 280) : null;
  await new Promise<void>((resolve) => {
    let done = false;
    const end = () => { if (!done) { done = true; if (mouth) clearInterval(mouth); resolve(); } };
    sources[sources.length - 1].onended = end;
    setTimeout(end, total + 500);
  });
  return true;
}
