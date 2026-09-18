# -*- coding: utf-8 -*-
# Regenerates the mod description in every language and writes it into the four places the
# game reads it from. Run after any change to GEO.tsl, GEO.fallbackSites or the text:
#
#     python3 tools/module-description/build.py           # check, then write
#     python3 tools/module-description/build.py --check   # check only, write nothing
#     python3 tools/module-description/build.py --print en_US
#
# Before writing anything it checks starts.py against the map itself (europe-large-geo.js,
# read through node) and against the age rosters in tools/check-map-sizes.mjs: every
# civilization of every age listed exactly once, each at the city its start really is.
import os, sys, json, re, subprocess, tempfile, shutil
from math import hypot

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
MOD = os.path.join(ROOT, "EuropeMediterranean")
sys.path.insert(0, HERE)
from cities import CITY, MOD_CIVS, EN_CIVS, WORKSHOP_CIVS
from prose import LANG, REASONS
from starts import STARTS, WORKSHOP, CITY_LL, FALLBACK_NAMED

URL = "https://marcobonechi.github.io/civ7mods/europe-mediterranean/"
NAMES = json.load(open(os.path.join(HERE, "civ-names.json"), encoding="utf-8"))
AGES = ["Antiquity", "Exploration", "Modern"]


def load_geo():
    tmp = tempfile.mkdtemp()
    try:
        shutil.copy(os.path.join(MOD, "maps", "europe-large-geo.js"), os.path.join(tmp, "g.mjs"))
        js = "import('file://%s/g.mjs').then(m => console.log(JSON.stringify({tsl: m.GEO.tsl, sites: m.GEO.fallbackSites})))" % tmp
        return json.loads(subprocess.check_output(["node", "-e", js], text=True))
    finally:
        shutil.rmtree(tmp)


def rosters():
    src = open(os.path.join(ROOT, "tools", "check-map-sizes.mjs"), encoding="utf-8").read()
    block = re.search(r"const AGE_CIVS = \{(.*?)\};", src, re.S).group(1)
    return {age: re.findall(r"'([A-Z_]+)'", body)
            for age, body in re.findall(r"(\w+): \[(.*?)\]", block, re.S)}


def check(geo):
    errors = []
    where = {name: (lon, lat) for lon, lat, name in geo["sites"]}
    where.update(CITY_LL)
    tsl = {k.replace("CIVILIZATION_", ""): v for k, v in geo["tsl"].items()}

    def at(civ, key, city):
        if key not in tsl:
            errors.append(f"{civ}: no CIVILIZATION_{key} in GEO.tsl"); return
        if city not in where:
            errors.append(f"{civ}: no coordinates for city '{city}' (add it to CITY_LL)"); return
        (a, b), (c, d) = tsl[key], where[city]
        if hypot(a - c, b - d) > 0.35:
            errors.append(f"{civ}: listed at {city} {c},{d} but GEO.tsl has {a},{b}")

    for age, roster in rosters().items():
        listed = [c for part in STARTS[age].values() for c, _, _ in part]
        for c in roster:
            if listed.count(c) != 1:
                errors.append(f"{age}: {c} is listed {listed.count(c)} times")
        for c in listed:
            if c not in roster:
                errors.append(f"{age}: {c} is listed but is not in that age's roster")
        for part in STARTS[age].values():
            for c, city, reason in part:
                at(c, c, city)
                for lang in LANG:
                    if reason and reason not in REASONS[lang]:
                        errors.append(f"{lang}: no reason '{reason}'")
    for key, civ, city in WORKSHOP:
        at(civ, key, city)

    names = [n for _, _, n in geo["sites"]]
    if names[:len(FALLBACK_NAMED)] != FALLBACK_NAMED:
        errors.append(f"the description names {FALLBACK_NAMED} as the first fallback sites, "
                      f"but GEO.fallbackSites starts {names[:len(FALLBACK_NAMED)]}")
    return errors, len(names) - len(FALLBACK_NAMED)


def civ_name(lang, c):
    if lang == "en_US":
        return EN_CIVS[c]
    return MOD_CIVS.get(lang, {}).get(c) or NAMES[lang][c]


def render(lang, more):
    L, R = LANG[lang], REASONS[lang]
    o, c_ = L["paren"]
    city = lambda s: CITY.get(lang, {}).get(s, s)

    def line(civ, site, reason):
        s = f"{L['bullet']}{civ_name(lang, civ)}{o}{city(site)}{c_}"
        return s + (f"{L['colon']}{R[reason]}" if reason else "")

    out = [L["intro"], "",
           L["maps_head"], *[L["bullet"] + m for m in L["maps"]], L["sizes"], "",
           L["starts_head"], *L["starts"], ""]
    for age in AGES:
        out += [L["age"][age],
                L["home"], *[line(*e) for e in STARTS[age]["home"]],
                L["standin"], *[line(*e) for e in STARTS[age]["standin"]], ""]
    wk = L["sep"].join(f"{WORKSHOP_CIVS[lang][civ]}{o}{city(site)}{c_}" for _, civ, site in WORKSHOP)
    out += [L["workshop_head"], L["workshop"].format(list=wk), "",
            L["others_head"], L["others"].format(more=more), "",
            L["link"].format(url=URL)]
    return "\n".join(out)


def xml(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def sub_once(text, pattern, repl, what):
    new, n = re.subn(pattern, lambda m: m.group(1) + repl + m.group(2), text, flags=re.S)
    if n != 1:
        sys.exit(f"{what}: expected one match, found {n}")
    return new


def write(texts):
    tag = "LOC_MODULE_EUROPE_MED_DESCRIPTION"

    p = os.path.join(MOD, "europe-mediterranean.modinfo")
    s = open(p, encoding="utf-8").read()
    s = sub_once(s, r"(<Description>).*?(</Description>)", xml(texts["en_US"]), "modinfo <Description>")
    block = re.search(r'<Text id="%s">.*?</Text>' % tag, s, re.S)
    b = block.group(0)
    for lang, t in texts.items():
        b = sub_once(b, r"(<%s>).*?(</%s>)" % (lang, lang), xml(t), f"modinfo {lang}")
    s = s[:block.start()] + b + s[block.end():]
    open(p, "w", encoding="utf-8").write(s)

    p = os.path.join(MOD, "text", "en_us", "ModuleText.xml")
    s = open(p, encoding="utf-8").read()
    s = sub_once(s, r'(<Row Tag="%s">\s*<Text>).*?(</Text>)' % tag, xml(texts["en_US"]), "en_us ModuleText")
    open(p, "w", encoding="utf-8").write(s)

    p = os.path.join(MOD, "l10n", "ModuleText.xml")
    s = open(p, encoding="utf-8").read()
    for lang, t in texts.items():
        if lang == "en_US":
            continue
        s = sub_once(s, r'(<Replace Tag="%s" Language="%s">\s*<Text>).*?(</Text>)' % (tag, lang), xml(t), f"l10n {lang}")
    open(p, "w", encoding="utf-8").write(s)


if __name__ == "__main__":
    errors, more = check(load_geo())
    if errors:
        print("description does not match the map:")
        for e in errors:
            print("  " + e)
        sys.exit(1)
    texts = {lang: render(lang, more) for lang in LANG}
    if "--print" in sys.argv:
        print(texts[sys.argv[sys.argv.index("--print") + 1]])
    elif "--check" in sys.argv:
        print(f"ok: {len(texts)} languages match the map ({more} unnamed fallback sites)")
    else:
        write(texts)
        for lang, t in texts.items():
            print(f"{lang}: {len(t)} chars, {t.count(chr(10)) + 1} lines")
