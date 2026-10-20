"""
Echte Stimme erzeugen und nach R2 laden (GitHub-Aktion „Stimme“).

Bausteine: feste Satzteile (saetze.json aus saetze.ts), Vornamen (namen.txt), Zahlen 0–300 und alles,
was Geräte als fehlend gemeldet haben (/api/release/voice). Schon vorhandene (laut index.json) werden
übersprungen. Jeder Baustein: assets/stimme/<schlüssel>.mp3, danach das Verzeichnis index.json.

Schlüssel wie am Gerät (shared/platform/voice.ts): sha256("<fassung>|<stimmung>|<text>")[:16].
Stimme: Thorsten (frei nutzbar, CC0) über sherpa-onnx – neutral mit dem Modell „high“ (klingt am besten),
Stimmungen mit dem Modell „emotional“.

Umgebung: SITE_URL (Standard: workers.dev), RELEASE_SECRET, MODEL_DIR (Modell „high“), EMO_DIR (Modell „emotional“),
SAETZE (Pfad zu saetze.json), PITCH (Tonhöhe, 1.0 = unverändert).
"""
import hashlib
import json
import os
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
PITCH = float(os.environ.get("PITCH", "1.0"))
# Muss zu VOICE_VERSION in shared/platform/voice.ts passen
VERSION = 2
HERE = os.path.dirname(os.path.abspath(__file__))
# Höchstens so viele neue Bausteine je Lauf (der nächste Lauf macht weiter)
LIMIT = int(os.environ.get("LIMIT", "2500"))

SPEAKER = {"neutral": 4, "froh": 0, "wuetend": 1, "ueberrascht": 6, "fluester": 7, "beschwipst": 3, "muede": 5}


def norm(text: str) -> str:
    return " ".join(text.split())


def key(mood: str, text: str) -> str:
    return hashlib.sha256(f"{VERSION}|{mood}|{norm(text)}".encode("utf-8")).hexdigest()[:16]


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
    print(f"Vorhanden: {len(have)}")

    # Was gebraucht wird
    todo: dict[str, tuple[str, str]] = {}

    def want(mood: str, text: str):
        t = norm(text)
        if t and mood in SPEAKER:
            todo.setdefault(key(mood, t), (mood, t))

    status, raw = request("GET", "/api/release/voice")
    if status == 403:
        print("::error::Der Worker kennt diesen RELEASE_SECRET nicht (403). Werte in GitHub und Cloudflare angleichen.")
        return 1
    queued = json.loads(raw).get("items", []) if status == 200 else []
    for it in queued:
        want(it.get("mood", ""), it.get("text", ""))
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

    missing = [(k, m, t) for k, (m, t) in todo.items() if k not in have][:LIMIT]
    print(f"Zu erzeugen: {len(missing)}")

    done: list[str] = []
    if missing:
        def load(d: str, name: str):
            return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=os.path.join(d, name), tokens=os.path.join(d, "tokens.txt"),
                                                            data_dir=os.path.join(d, "espeak-ng-data")),
                num_threads=4)))
        high = load(MODEL, "de_DE-thorsten-high.onnx")
        emo = load(EMO, "de_DE-thorsten_emotional-medium.onnx") if any(m != "neutral" for _, m, _ in missing) else None
        pitch = f"asetrate={{sr}}*{PITCH},aresample={{sr}},atempo={1 / PITCH:.5f}," if PITCH != 1.0 else ""
        with tempfile.TemporaryDirectory() as tmp:
            wav, mp3 = os.path.join(tmp, "a.wav"), os.path.join(tmp, "a.mp3")
            for i, (k, mood, text) in enumerate(missing):
                audio = high.generate(text, sid=0, speed=1.0) if mood == "neutral" else emo.generate(text, sid=SPEAKER[mood], speed=1.0)
                if not len(audio.samples):
                    continue
                sf.write(wav, audio.samples, audio.sample_rate)
                # Stille an den Rändern weg, Spitze auf -1 dB, sonst unverändert; Mono-MP3 (läuft überall)
                sr = audio.sample_rate
                peak = max(1e-6, float(max(abs(min(audio.samples)), abs(max(audio.samples)))))
                trim = "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse"
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav,
                                "-af", f"{pitch.format(sr=sr)}{trim},volume={0.89 / peak:.4f}",
                                "-ac", "1", "-ar", str(sr), "-c:a", "libmp3lame", "-b:a", "64k", mp3], check=True)
                status, raw = request("PUT", f"/api/release/files/stimme/{k}.mp3", open(mp3, "rb").read(), "audio/mpeg")
                if status != 200:
                    print(f"::warning::{k} ({text}): {status} {raw[:200]!r}")
                    continue
                have.add(k)
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
    gone = [it["key"] for it in queued if it.get("key") in have]
    if gone:
        request("POST", "/api/release/voice/done", json.dumps({"keys": gone}).encode("utf-8"))
    print(f"Neu: {len(done)} · erledigt gemeldet: {len(gone)} · gesamt: {len(have)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
