#!/usr/bin/env python3
"""Foreign keys in a mod that cannot resolve in every age the file is loaded in.

The game validates foreign keys per file and drops the whole file when one fails, so a row whose
target is only declared in an age the file also loads outside of breaks that file in the other
ages - silently, since a dropped file leaves no error, just a civ missing half its data.

Two things make this less obvious than it looks:

  * All three age modules are loaded in every game. Only the action groups behind an AgeInUse or
    AgeAtOrBefore criteria are age-scoped; whatever an age module loads under 'always'
    (civilizations-shared.xml with the TRAIT_<AGE>_CIV traits, traditions.xml, unlocks-shared.xml
    with REQSET_CIV_IS_ROME) is available whatever the start age. This script models that split.
  * Most capitalised names in a mod are not foreign keys at all - effects, collections and
    requirement types live in no table. So the columns to check are read out of the gameplay
    schema's own FOREIGN KEY declarations rather than guessed.

Usage: tools/check-ages.py <ModFolder> [<OtherModFolder> ...]
       (extra folders are companion mods whose types this one may reference)

Complements tools/check-mod.py, which checks that identifiers and text tags exist at all.
"""
import os, re, sys, xml.etree.ElementTree as ET

GAME = os.path.expanduser("~/Library/Application Support/Steam/steamapps/common/"
                          "Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources")
SCHEMA = os.path.join(GAME, "Base/Assets/schema/gameplay/01_GameplaySchema.sql")

# (table, column) pairs that carry a foreign key, from the schema itself.
fk = set()
table = None
for line in open(SCHEMA, encoding="utf-8", errors="ignore"):
    m = re.match(r"CREATE TABLE '([A-Za-z_]+)'", line)
    if m:
        table = m.group(1)
    m = re.search(r'FOREIGN KEY \("([A-Za-z_]+)"\)', line)
    if m and table:
        fk.add((table, m.group(1)))

DECL = [re.compile(r'<(?:Row|InsertOrIgnore)[^>]*\sType="([A-Z][A-Z0-9_]+)"'),
        re.compile(r'<(?:Row|InsertOrIgnore)[^>]*\sTraitType="([A-Z][A-Z0-9_]+)"[^>]*\sInternalOnly'),
        re.compile(r'<(?:Row|InsertOrIgnore)[^>]*\sTag="([A-Z][A-Z0-9_]+)"\s+Category='),
        re.compile(r'<(?:Row|InsertOrIgnore)[^>]*\sRequirementId="([A-Z][A-Z0-9_]+)"\s+RequirementType='),
        re.compile(r'<(?:Row|InsertOrIgnore)[^>]*\sRequirementSetId="([A-Z][A-Z0-9_]+)"\s+RequirementSetType='),
        re.compile(r'<Modifier[^>]*\sid="([A-Z][A-Z0-9_]+)"'),
        re.compile(r'<(?:Row|InsertOrIgnore)[^>]*\sCivilizationLevelType="([A-Z][A-Z0-9_]+)"'),
        re.compile(r'<(?:Row|InsertOrIgnore)[^>]*\sCategory="([A-Z][A-Z0-9_]+)"\s*/>')]

def declared(dirs):
    out = set()
    for d in dirs:
        for dp, _, fns in os.walk(d):
            for fn in fns:
                if not fn.endswith(".xml"):
                    continue
                text = open(os.path.join(dp, fn), encoding="utf-8", errors="ignore").read()
                for rx in DECL:
                    out.update(rx.findall(text))
    return out

def declared_files(paths):
    out = set()
    for p in paths:
        if not (p.endswith(".xml") and os.path.exists(p)):
            continue
        text = open(p, encoding="utf-8", errors="ignore").read()
        for rx in DECL:
            out.update(rx.findall(text))
    return out


def split_age_module(age):
    """An age module's own files, split into the ones it loads under 'always' (present in every
    game, whatever the start age) and the ones behind an AgeInUse criteria."""
    root_dir = os.path.join(GAME, "Base/modules/age-" + age.lower())
    mi = os.path.join(root_dir, "age-%s.modinfo" % age.lower())
    r = ET.parse(mi).getroot()
    t = lambda e: e.tag.split("}")[-1]
    gated = set()
    for c in r.iter():
        if t(c) == "Criteria" and any(t(x) in ("AgeInUse", "AgeAtOrBefore") for x in c):
            gated.add(c.get("id"))
    always, scoped = [], []
    for g in r.iter():
        if t(g) != "ActionGroup" or g.get("scope") != "game":
            continue
        target = scoped if g.get("criteria") in gated else always
        for item in g.iter():
            if t(item) == "Item" and item.text:
                target.append(os.path.join(root_dir, item.text.strip()))
    return declared_files(always), declared_files(scoped)

base = declared([os.path.join(GAME, "Base/modules/base-standard"),
                 os.path.join(GAME, "Base/modules/core"),
                 os.path.join(GAME, "DLC")])
scoped_by_age = {}
for a in ("ANTIQUITY", "EXPLORATION", "MODERN"):
    always_decls, scoped_decls = split_age_module(a)
    base |= always_decls          # every age module is loaded in every game
    scoped_by_age[a] = scoped_decls
ages = {a: base | scoped_by_age[a] for a in scoped_by_age}

mod, companions = sys.argv[1], sys.argv[2:]
comp = declared(companions) if companions else set()
modinfo = os.path.join(mod, [f for f in os.listdir(mod) if f.endswith(".modinfo")][0])
root = ET.parse(modinfo).getroot()
tag = lambda e: e.tag.split("}")[-1]

crit = {}
for c in root.iter():
    if tag(c) == "Criteria":
        inuse = [x.text.replace("AGE_", "") for x in c if tag(x) == "AgeInUse"]
        crit[c.get("id")] = set(inuse) if inuse else set(ages)

file_ages = {}
for g in root.iter():
    if tag(g) == "ActionGroup" and g.get("scope") == "game":
        a = crit.get(g.get("criteria"), set(ages))
        for item in g.iter():
            if tag(item) == "Item" and item.text:
                file_ages.setdefault(item.text.strip(), set()).update(a)

defines = {}
for f in file_ages:
    p = os.path.join(mod, f)
    if p.endswith(".xml") and os.path.exists(p):
        text = open(p, encoding="utf-8", errors="ignore").read()
        s = set()
        for rx in DECL:
            s.update(rx.findall(text))
        defines[f] = s

problems = 0
for f in sorted(file_ages):
    p = os.path.join(mod, f)
    if not (p.endswith(".xml") and os.path.exists(p)):
        continue
    try:
        r = ET.parse(p).getroot()
    except ET.ParseError:
        continue
    refs = []                                   # (table, column, value)
    for tbl in r:
        t = tag(tbl)
        for row in tbl:
            for attr, val in row.attrib.items():
                if (t, attr) in fk and re.fullmatch(r"[A-Z][A-Z0-9_]+", val):
                    refs.append((t, attr, val))
    for age in sorted(file_ages[f]):
        known = ages[age] | comp
        for g, ga in file_ages.items():
            if age in ga and g in defines:
                known |= defines[g]
        bad = sorted({(t, c, v) for t, c, v in refs if v not in known})
        FAMILIES = ("TRAIT_","CIVILIZATION_","UNIT_","BUILDING_","WONDER_","QUARTER_",
                    "TRADITION_","NODE_","TREE_","IMPROVEMENT_","LEADER_","GREAT_PERSON_",
                    "REQSET_","REQ_","MOD_","UNLOCK_")
        bad = [x for x in bad if x[2].startswith(FAMILIES)
               and not x[2].startswith(("UNIT_MOVEMENT_CLASS_","UNIT_CLASS_","TRAIT_ATTRIBUTE_"))]
        for t, c, v in bad:
            problems += 1
            print(f"{f}: {t}.{c} = {v} does not exist in {age}")
print("no unresolvable foreign keys" if not problems else f"{problems} problem(s)")
