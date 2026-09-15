# -*- coding: utf-8 -*-
import os, sys, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cities import CITY, MOD_CIVS
from prose import PROSE

URL = "https://marcobonechi.github.io/civ7mods/europe-mediterranean/"
nom = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'civ-names.json')))

# (civ, english site name) per age, in the order the English description uses
PAIRS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pairs.json')))

def civ_name(lang, c):
    if c in MOD_CIVS.get(lang, {}): return MOD_CIVS[lang][c]
    v = nom.get(lang, {}).get(c)
    if v: return v
    raise KeyError(f"{lang}: no name for {c}")

def city_name(lang, s):
    return CITY.get(lang, {}).get(s, s)

# Japanese and Chinese separate list items with a full-width comma and use
# full-width parentheses; Korean follows western punctuation.
SEP = {"ja_JP": "\u3001", "zh_Hans_CN": "\u3001", "zh_Hant_HK": "\u3001"}
PAREN = {"ja_JP": ("\uff08", "\uff09"), "zh_Hans_CN": ("\uff08", "\uff09"), "zh_Hant_HK": ("\uff08", "\uff09")}

def listing(lang, age):
    o, c_ = PAREN.get(lang, (" (", ")"))
    sep = SEP.get(lang, ", ")
    return sep.join(f"{civ_name(lang,c)}{o}{city_name(lang,s)}{c_}" for c, s in PAIRS[age])

out = {}
for lang in PROSE:
    out[lang] = PROSE[lang].format(
        ant=listing(lang, "Antiquity"),
        exp=listing(lang, "Exploration"),
        mod=listing(lang, "Modern"),
        url=URL,
    )
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out.json'),'w'), ensure_ascii=False)
for lang, t in out.items():
    print(f"{lang}: {len(t)} chars")
