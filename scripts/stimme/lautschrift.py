"""
Lautschrift wie sie die Stimme bekommt (espeak-ng, Deutsch) – zum Prüfen der Aussprache ohne Hören.
  pip install phonemizer espeakng-loader
  python3 scripts/stimme/lautschrift.py Kevin Kevvin "Team Blau"
Mit --liste: alle Einträge aus aussprache.txt (links → rechts) nebeneinander.
"""
import os
import sys

import espeakng_loader
from phonemizer.backend.espeak.wrapper import EspeakWrapper

EspeakWrapper.set_library(espeakng_loader.get_library_path())
EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
from phonemizer import phonemize  # noqa: E402

words = sys.argv[1:]
if words == ["--liste"]:
    here = os.path.dirname(os.path.abspath(__file__))
    pairs = [tuple(x.strip() for x in l.split("=", 1)) for l in open(os.path.join(here, "aussprache.txt"), encoding="utf-8") if "=" in l and not l.lstrip().startswith("#")]
    out = phonemize([w for p in pairs for w in p], language="de", backend="espeak", with_stress=True)
    for i, (a, b) in enumerate(pairs):
        print(f"{a:14} {out[2 * i]:22} → {b:14} {out[2 * i + 1]}")
else:
    for w, p in zip(words, phonemize(words, language="de", backend="espeak", with_stress=True)):
        print(f"{w:14} {p}")
