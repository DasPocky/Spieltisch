"""
Echte Stimme erzeugen und nach R2 laden (GitHub-Aktion „Stimme“).

Bausteine: feste Satzteile (saetze.json aus saetze.ts), Vornamen (namen.txt), Zahlen 0–300 und alles,
was Geräte als fehlend gemeldet haben (/api/release/voice). Schon vorhandene (laut index.json) werden
übersprungen. Jeder Baustein: assets/stimme/<schlüssel>.mp3, danach das Verzeichnis index.json.

Schlüssel wie am Gerät (shared/platform/voice.ts): sha256("<fassung>|<stimmung>|<text>")[:16].
Stimme: Thorsten (frei nutzbar, CC0) über sherpa-onnx – neutral mit dem Modell „high“ (klingt am besten),
Stimmungen mit dem Modell „emotional“. Etwas schneller und höher als das Modell von sich aus, damit es munter klingt.
Aussprache: aussprache.txt ersetzt vor dem Sprechen ganze Wörter (Englisches, Abkürzungen, Vornamen). Was mit welcher
Sprechweise erzeugt wurde, steht in stimme/quelle.json – ändert sich die Sprechweise, wird der Baustein neu erzeugt.

Umgebung: SITE_URL (Standard: workers.dev), RELEASE_SECRET, MODEL_DIR (Modell „high“), EMO_DIR (Modell „emotional“),
SAETZE (Pfad zu saetze.json).
"""
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

import sherpa_onnx
import soundfile as sf

SITE = os.environ.get("SITE_URL", "https://spieltisch.bjoern-ef9.workers.dev").rstrip("/")
SECRET = os.environ.get("RELEASE_SECRET", "")
MODEL = os.environ.get("MODEL_DIR", "vits-piper-de_DE-thorsten-high")
EMO = os.environ.get("EMO_DIR", "vits-piper-de_DE-thorsten_emotional-medium")
# Muss zu VOICE_VERSION in shared/platform/voice.ts passen
VERSION = 3
# Klang (Hörprobe Oktober 2026, Varianten 2 und 3 – zügig, aber nicht gehetzt): Tempo und Tonhöhe je Modell
STYLE = {"neutral": (1.08, 1.08), "emotional": (1.06, 1.05)}
# Mehr Lebendigkeit in Betonung und Rhythmus (Standard 0.667 / 0.8)
NOISE, NOISE_W = 0.8, 1.0
HERE = os.path.dirname(os.path.abspath(__file__))
# Höchstens so viele neue Bausteine je Lauf (der nächste Lauf macht weiter)
LIMIT = int(os.environ.get("LIMIT", "2500"))

SPEAKER = {"neutral": 4, "froh": 0, "wuetend": 1, "ueberrascht": 6, "fluester": 7, "beschwipst": 3, "muede": 5}


def norm(text: str) -> str:
    return " ".join(text.split())


def key(mood: str, text: str) -> str:
    return hashlib.sha256(f"{VERSION}|{mood}|{norm(text)}".encode("utf-8")).hexdigest()[:16]


def load_rules() -> list[tuple[re.Pattern, str]]:
    rules = []
    for line in open(os.path.join(HERE, "aussprache.txt"), encoding="utf-8"):
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        a, b = (x.strip() for x in line.split("=", 1))
        if a and b:
            rules.append((re.compile(rf"(?<!\w){re.escape(a)}(?!\w)"), b))
    # längere zuerst (z. B. „Partyabend“ vor „Party“)
    return sorted(rules, key=lambda r: -len(r[0].pattern))


RULES = load_rules()


def spoken(text: str) -> str:
    for pat, say in RULES:
        text = pat.sub(say, text)
    return text


def sig(mood: str, text: str) -> str:
    """Kurzer Fingerabdruck der Sprechweise (Text nach Aussprache-Liste und Klang)"""
    return hashlib.sha256(f"{STYLE}|{NOISE}|{NOISE_W}|{mood}|{spoken(text)}".encode("utf-8")).hexdigest()[:8]


def request(method: str, path: str, body: bytes | None = None, ctype: str = "application/json", secret: bool = True):
    req = urllib.request.Request(SITE + path, data=body, method=method)
    if body is not None:
        req.add_header("content-type", ctype)
    if secret:
        req.add_header("x-release-key", SECRET)
    req.add_header("user-agent", "spieltisch-stimme")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404, 400):
                return e.code, e.read()
            err = e
        except Exception as e:  # Netz: kurz warten, nochmal
            err = e
        time.sleep(2 ** attempt)
    raise RuntimeError(f"{method} {path}: {err}")


def main() -> int:
    if not SECRET:
        print("::error::RELEASE_SECRET fehlt – als GitHub-Secret anlegen (gleicher Wert wie das Worker-Secret).")
        return 1

    # Vorhandene Bausteine
    status, raw = request("GET", "/api/asset/stimme/index.json", secret=False)
    have: set[str] = set(json.loads(raw).get("keys", [])) if status == 200 else set()
    # Woraus jeder Baustein entstand (Stimmung, Text, Sprechweise)
    status, raw = request("GET", "/api/asset/stimme/quelle.json", secret=False)
    source: dict[str, list[str]] = json.loads(raw).get("items", {}) if status == 200 else {}
    print(f"Vorhanden: {len(have)}")

    # Was gebraucht wird
    todo: dict[str, tuple[str, str]] = {}

    # Fest erwartet (Namen, Zahlen, Sätze) – der Bericht am Ende prüft genau diese
    expected: dict[str, tuple[str, str]] = {}

    def want(mood: str, text: str, fixed: bool = True):
        t = norm(text)
        if t and mood in SPEAKER:
            todo.setdefault(key(mood, t), (mood, t))
            if fixed:
                expected[key(mood, t)] = (mood, t)

    status, raw = request("GET", "/api/release/voice")
    if status == 403:
        print("::error::Der Worker kennt diesen RELEASE_SECRET nicht (403). Werte in GitHub und Cloudflare angleichen.")
        return 1
    queued = json.loads(raw).get("items", []) if status == 200 else []
    for it in queued:
        want(it.get("mood", ""), it.get("text", ""), fixed=False)
    print(f"Gemeldet: {len(queued)}")
    for line in open(os.path.join(HERE, "namen.txt"), encoding="utf-8"):
        if line.strip() and not line.startswith("#"):
            want("neutral", line.strip())
    for n in range(0, 301):
        want("neutral", str(n))
    saetze = os.environ.get("SAETZE")
    if saetze and os.path.exists(saetze):
        for it in json.load(open(saetze, encoding="utf-8")):
            want(it["mood"], it["text"])

    # Schon erzeugte, deren Aussprache sich geändert hat, kommen wieder dran
    for k, (m, t, _) in source.items():
        if k in have:
            todo.setdefault(k, (m, t))
    stale = lambda k, m, t: k not in have or (k in source and source[k][2] != sig(m, t))
    missing = [(k, m, t) for k, (m, t) in todo.items() if stale(k, m, t)]
    limited = len(missing) > LIMIT
    missing = missing[:LIMIT]
    print(f"Zu erzeugen: {len(missing)}")

    done: list[str] = []
    if missing:
        def load(d: str, name: str):
            return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=os.path.join(d, name), tokens=os.path.join(d, "tokens.txt"),
                                                            data_dir=os.path.join(d, "espeak-ng-data"),
                                                            noise_scale=NOISE, noise_scale_w=NOISE_W),
                num_threads=4)))
        high = load(MODEL, "de_DE-thorsten-high.onnx")
        emo = load(EMO, "de_DE-thorsten_emotional-medium.onnx") if any(m != "neutral" for _, m, _ in missing) else None
        with tempfile.TemporaryDirectory() as tmp:
            wav, mp3 = os.path.join(tmp, "a.wav"), os.path.join(tmp, "a.mp3")
            for i, (k, mood, text) in enumerate(missing):
                speed, pitch = STYLE["neutral" if mood == "neutral" else "emotional"]
                say = spoken(text)
                audio = high.generate(say, sid=0, speed=speed) if mood == "neutral" else emo.generate(say, sid=SPEAKER[mood], speed=speed)
                if not len(audio.samples):
                    continue
                sf.write(wav, audio.samples, audio.sample_rate)
                # Etwas höher (ohne schneller zu werden), Stille an den Rändern weg, Spitze auf -1 dB; Mono-MP3 (läuft überall)
                sr = audio.sample_rate
                shift = f"asetrate={sr}*{pitch},aresample={sr},atempo={1 / pitch:.5f},"
                peak = max(1e-6, float(max(abs(min(audio.samples)), abs(max(audio.samples)))))
                trim = "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse"
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav,
                                "-af", f"{shift}{trim},volume={0.89 / peak:.4f}",
                                "-ac", "1", "-ar", str(sr), "-c:a", "libmp3lame", "-b:a", "64k", mp3], check=True)
                status, raw = request("PUT", f"/api/release/files/stimme/{k}.mp3", open(mp3, "rb").read(), "audio/mpeg")
                if status != 200:
                    print(f"::warning::{k} ({text}): {status} {raw[:200]!r}")
                    continue
                have.add(k)
                source[k] = [mood, text, sig(mood, text)]
                done.append(k)
                if (i + 1) % 100 == 0:
                    print(f"  {i + 1}/{len(missing)}")

    # Verzeichnis aktualisieren, Warteliste leeren (auch schon vorhandene Meldungen)
    if done:
        index = json.dumps({"v": 1, "keys": sorted(have)}, separators=(",", ":")).encode("utf-8")
        status, raw = request("PUT", "/api/release/files/stimme/index.json", index)
        if status != 200:
            print(f"::error::Verzeichnis nicht gespeichert: {status} {raw[:200]!r}")
            return 1
        body = json.dumps({"v": 1, "items": source}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        status, raw = request("PUT", "/api/release/files/stimme/quelle.json", body)
        if status != 200:
            print(f"::warning::Quelle nicht gespeichert: {status} {raw[:200]!r}")
    gone = [it["key"] for it in queued if it.get("key") in have]
    if gone:
        request("POST", "/api/release/voice/done", json.dumps({"keys": gone}).encode("utf-8"))
    print(f"Neu: {len(done)} · erledigt gemeldet: {len(gone)} · gesamt: {len(have)}")
    return audit(expected, have, limited)


def mp3_ok(data: bytes) -> bool:
    """Sieht nach MP3 aus: ID3-Kopf oder Rahmen-Sync, nicht winzig"""
    return len(data) > 400 and (data[:3] == b"ID3" or (data[0] == 0xFF and data[1] & 0xE0 == 0xE0))


def audit(expected: dict[str, tuple[str, str]], have: set[str], limited: bool) -> int:
    """
    Bericht (Audit P1-11): erwartete feste Bausteine gegen das Verzeichnis, je Stimmung; Stichprobe echter Dateien.
    Rot, wenn eine Datei kaputt oder nicht ladbar ist; fehlende Bausteine stehen als Warnung im Bericht.
    """
    gaps = {k: v for k, v in expected.items() if k not in have}
    lines = ["## Stimme: Bestand", "", "| Stimmung | erwartet | vorhanden | fehlt |", "| --- | ---: | ---: | ---: |"]
    for mood in sorted({m for m, _ in expected.values()}):
        exp = [k for k, (m, _) in expected.items() if m == mood]
        miss = [k for k in exp if k in gaps]
        lines.append(f"| {mood} | {len(exp)} | {len(exp) - len(miss)} | {len(miss)} |")
    extra = len(have - set(expected))
    lines += ["", f"Weitere im Verzeichnis (gemeldete Lücken, ältere Sätze): {extra}"]
    if gaps:
        lines += ["", "Fehlt (Auszug):", *[f"- {m}: {t}" for m, t in list(gaps.values())[:30]]]
    # Stichprobe: Dateien wirklich laden und den Kopf prüfen
    sample = random.sample(sorted(have), min(12, len(have)))
    broken = []
    for k in sample:
        status, raw = request("GET", f"/api/asset/stimme/{k}.mp3", secret=False)
        if status != 200 or not mp3_ok(raw):
            broken.append(f"{k} ({status}, {len(raw)} Bytes)")
    lines += ["", f"Stichprobe: {len(sample) - len(broken)} von {len(sample)} Dateien in Ordnung"]
    lines += [f"- kaputt: {b}" for b in broken]
    report = "\n".join(lines) + "\n"
    print(report)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(report)
    if broken:
        print(f"::error::{len(broken)} Stimmdateien kaputt oder nicht ladbar")
        return 1
    # Fehlende feste Bausteine vorerst als Warnung: der Lauf ist stündlich, einzelne nicht sprechbare Namen sollen ihn nicht dauerhaft rot machen
    if gaps:
        why = f"der nächste Lauf macht weiter (Limit {LIMIT})" if limited else "nach diesem Lauf noch nicht erzeugt"
        print(f"::warning::{len(gaps)} feste Bausteine fehlen – {why}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
