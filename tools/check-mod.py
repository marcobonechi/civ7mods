#!/usr/bin/env python3
"""Static checks for a Civilization VII data mod folder.

Reports, without touching the game:
  1. XML files that do not parse.
  2. Files listed in the .modinfo that do not exist (and data/text files never listed).
  3. LOC_ text tags referenced in data/config but defined neither in the mod's text files
     nor in the game's own text.
  4. Type-like identifiers (CIVILIZATION_*, UNIT_*, MOD_*, REQSET_* ...) referenced in the
     mod that are neither introduced by the mod nor known to the game.
  5. Identifiers declared in <Types> that no concrete table (Units, Traditions ...) defines.
  6. <IconDefinitions> rows with a Context the game does not define. Context is a foreign key
     to IconContexts; an unknown one fails the row, and the icons file is then dropped whole -
     which strips the civ of its symbol and makes it vanish from the setup and age-transition
     screens, because those skip any civ whose icon will not resolve.
  7. LOC_ text tags this mod defines that a --with companion also defines. Two mods that
     define the same tag is a duplicate key in the localization database: the second file to
     load fails, the game rolls the whole database back, and *every* installed mod disappears
     from the game. It cost a launch to find out.

Usage: tools/check-mod.py <ModFolder> [--with <OtherModFolder>] [--game <Resources dir>] [--refresh]

The game's identifiers and text tags are scanned once and cached under ~/.cache/civ7mods;
--refresh rebuilds the cache (do that after a game update).
"""
import argparse
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET

# Every Context the shipped IconDefinitions actually use, plus the implicit default. Context is
# a foreign key (IconDefinitions -> Icons -> IconContexts), so anything else fails the row.
# Notably there is no "LEADER" context: core/ui/utilities/utilities-image.js asks for one and
# always falls through to the default row.
ICON_CONTEXTS = {"DEFAULT", "CIRCLE_MASK", "PORTRAIT_MASK", "LEADER_HAPPY", "LEADER_ANGRY",
                 "BACKGROUND", "BACKGROUND_VERT", "BACKGROUND_HORIZ", "BUBBLE", "PLAYER",
                 "BADGE", "OUTLINE", "FOW", "FONTICON"}

DEFAULT_GAME = os.path.expanduser(
    "~/Library/Application Support/Steam/steamapps/common/"
    "Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources")
CACHE = os.path.expanduser("~/.cache/civ7mods/game-symbols.json")

# Identifier prefixes that name database types or effect ids. Anything else in caps is
# ignored (yield names, booleans, column-like words) to keep the noise down.
PREFIXES = (
    "CIVILIZATION_", "TRAIT_", "UNIT_", "BUILDING_", "WONDER_", "IMPROVEMENT_", "QUARTER_",
    "TRADITION_", "NODE_", "TREE_", "ABILITY_", "MOD_", "REQSET_", "REQ_", "UNLOCK_", "TAG_",
    "LEADER_", "AGE_", "YIELD_", "TERRAIN_", "BIOME_", "RESOURCE_", "DISTRICT_", "EFFECT_",
    "REQUIREMENT_", "COLLECTION_", "GREAT_PERSON_", "GREATWORKSLOT_", "PLUNDER_", "DOMAIN_",
    "FORMATION_CLASS_", "CORE_CLASS_", "PROMOTION_CLASS_", "ADVISORY_CLASS_", "MOVIE_",
    "INDEPENDENT_", "LEGACY_PATH_", "GOVERNMENT_", "PSEUDOYIELD_", "FEATURE_", "RIVER_",
    "VOLCANO_", "DEFEAT_", "KIND_", "COST_PROGRESSION_", "SYSTEM_", "CIVILIZATION_LEVEL_",
    "UNIT_MOVEMENT_CLASS_", "MAPSIZE_", "CHALLENGE_", "START_POSITION_", "ICON_",
)
IDENT = re.compile(r'\b(' + "|".join(re.escape(p) for p in PREFIXES) + r')[A-Z0-9_]+\b')
LOC = re.compile(r'\bLOC_[A-Z0-9_]+\b')
TAGDEF = re.compile(r'Tag="(LOC_[A-Z0-9_]+)"')

# Attributes whose value *introduces* an identifier (as opposed to referencing one).
DEFINING_ATTRS = {
    "Type", "UnitType", "ConstructibleType", "TraditionType", "ModifierId", "RequirementSetId",
    "RequirementId", "UnlockType", "ProgressionTreeNodeType", "ProgressionTreeType",
    "UnitAbilityType", "Tag", "ID", "CivilizationType", "UniqueQuarterType", "TraitType",
    "MapSizeType", "ListType", "NamedRiverType", "NamedVolcanoType", "MovieType",
    "LeaderType", "GreatPersonClassType", "GreatPersonIndividualType",
    "ChallengeType", "CivUniqueUnitType", "UnitClassType", "id",
}
# Tables (element names) in which the defining attribute really defines a new row.
DEFINING_TABLES = {
    "Types", "Units", "Constructibles", "Traditions", "RequirementSets", "Requirements",
    "Unlocks", "ProgressionTreeNodes", "ProgressionTrees", "UnitAbilities", "Tags",
    "IconDefinitions", "Adjacency_YieldChanges", "Civilizations", "LegacyCivilizations",
    "UniqueQuarters", "Traits", "Maps", "MapSizes", "AiListTypes", "NamedRivers",
    "Leaders", "GreatPersonClasses", "GreatPersonIndividuals",
    "NamedVolcanoes", "Movies", "Challenges", "UnitReplaces", "VisualRemaps", "Modifier",
    "Requirement",
}


# Translation folders / files other than English: de_DE, zh_Hans_CN, fr_FR_Text.xml ...
LOCALE_DIR = re.compile(r"^(?!en_)[a-z]{2}_[A-Za-z]{2,7}$")
LOCALE_FILE = re.compile(r"^(?!en_)[a-z]{2}_[A-Za-z_]+_Text\.xml$")


def iter_xml(root, skip_locales=True):
    """Every .xml under root; with skip_locales the per-language translation files are
    left out (the tags they define also exist in the English files)."""
    for dirpath, dirnames, filenames in os.walk(root):
        if skip_locales:
            dirnames[:] = [d for d in dirnames if not LOCALE_DIR.match(d)]
        for f in filenames:
            if f.lower().endswith(".xml") and not (skip_locales and LOCALE_FILE.match(f)):
                yield os.path.join(dirpath, f)


def scan_game(game, refresh):
    modules = [os.path.join(game, "Base", "modules"), os.path.join(game, "DLC")]
    stamp = max(os.path.getmtime(m) for m in modules if os.path.isdir(m))
    if not refresh and os.path.exists(CACHE):
        try:
            with open(CACHE) as fh:
                data = json.load(fh)
            if data.get("game") == game and data.get("stamp") == stamp:
                return set(data["idents"]), set(data["tags"])
        except (OSError, ValueError, KeyError):
            pass
    print("scanning game data (cached afterwards)...", file=sys.stderr)
    idents, tags = set(), set()
    t0 = time.time()
    for m in modules:
        if not os.path.isdir(m):
            continue
        for path in iter_xml(m):
            try:
                with open(path, encoding="utf-8", errors="ignore") as fh:
                    text = fh.read()
            except OSError:
                continue
            idents.update(mm.group(0) for mm in IDENT.finditer(text))
            tags.update(TAGDEF.findall(text))
            # LOC tags also appear as LocalizedText Tag= in other schemas; keep any definition.
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, "w") as fh:
        json.dump({"game": game, "stamp": stamp, "idents": sorted(idents), "tags": sorted(tags)}, fh)
    print(f"  {len(idents)} identifiers, {len(tags)} text tags in {time.time() - t0:.1f}s", file=sys.stderr)
    return idents, tags


def scan_companion(mod):
    """Identifiers and text tags a sibling mod introduces. Two mods that reference each other
    (Etruscans and Tuscany, each adding the other as a predecessor behind a ModInUse criteria)
    would otherwise report the other's types as unknown."""
    idents, tags = set(), set()
    for path in iter_xml(mod):
        with open(path, encoding="utf-8", errors="ignore") as fh:
            text = fh.read()
        idents.update(m.group(0) for m in IDENT.finditer(text))
        tags.update(TAGDEF.findall(text))
    return idents, tags


def check(mod, game_idents, game_tags, companion_tags=None):
    problems = 0
    mod = os.path.abspath(mod)
    modinfos = [f for f in os.listdir(mod) if f.endswith(".modinfo")]
    if len(modinfos) != 1:
        print(f"ERROR: expected one .modinfo in {mod}, found {modinfos}")
        return 1
    modinfo = os.path.join(mod, modinfos[0])

    # 1. Well-formedness (modinfo included).
    xml_files = [modinfo] + sorted(iter_xml(mod))
    parsed = {}
    for path in xml_files:
        try:
            parsed[path] = ET.parse(path).getroot()
        except ET.ParseError as e:
            print(f"ERROR: {os.path.relpath(path, mod)}: {e}")
            problems += 1

    # 2. Modinfo items vs files on disk.
    listed = set()
    for action in parsed.get(modinfo, ET.Element("x")).iter():
        tag = action.tag.split("}")[-1]
        if tag == "UpdateArt":
            continue                      # items are art package names, not files
        for item in action:
            itag = item.tag.split("}")[-1]
            if itag in ("Item", "File") and item.text and item.text.strip():
                rel = item.text.strip()
                listed.add(rel)
                if not os.path.exists(os.path.join(mod, rel)):
                    print(f"ERROR: modinfo lists missing file {rel}")
                    problems += 1
    for path in xml_files:
        rel = os.path.relpath(path, mod)
        if path != modinfo and rel not in listed:
            print(f"WARN: {rel} is not referenced by the modinfo")

    # 3 + 4. Symbol tables.
    defined_idents, referenced_idents = set(), {}
    defined_tags, referenced_tags = set(), {}
    types_declared, concrete_defined = {}, set()
    for path, root in parsed.items():
        rel = os.path.relpath(path, mod)
        text = open(path, encoding="utf-8", errors="ignore").read()
        defined_tags.update(TAGDEF.findall(text))
        if rel.startswith("text") or path == modinfo:
            # Text files reference nothing; the modinfo references its own LOC names.
            if path == modinfo:
                # Only the mod's own Name/Description matter; dependency titles are labels
                # Firaxis never defines either.
                for elem in root.iter():
                    etag = elem.tag.split("}")[-1]
                    if etag in ("Name", "Description") and elem.text:
                        for m in LOC.finditer(elem.text):
                            referenced_tags.setdefault(m.group(0), rel)
            continue
        for table in root:
            ttag = table.tag.split("}")[-1]          # drop the GameEffects namespace
            for row in table.iter():
                rtag = row.tag.split("}")[-1]
                for attr, value in row.attrib.items():
                    for m in IDENT.finditer(value):
                        ident = m.group(0)
                        if attr in DEFINING_ATTRS and (ttag in DEFINING_TABLES or rtag in DEFINING_TABLES):
                            defined_idents.add(ident)
                            # A <Types> row only declares a name; the concrete table
                            # (Traditions, Units, Constructibles ...) must define it too.
                            if ttag == "Types":
                                types_declared.setdefault(ident, rel)
                            else:
                                concrete_defined.add(ident)
                        else:
                            referenced_idents.setdefault(ident, rel)
                    for m in LOC.finditer(value):
                        referenced_tags.setdefault(m.group(0), rel)
                if row.text and row.text.strip():
                    for m in IDENT.finditer(row.text):
                        ident = m.group(0)
                        if ttag in DEFINING_TABLES and rtag in ("ID", "From"):
                            defined_idents.add(ident)
                        elif rtag in ("Argument", "Path", "To", "Item", "Text"):
                            referenced_idents.setdefault(ident, rel)
                        elif ttag in DEFINING_TABLES:
                            defined_idents.add(ident)
                        else:
                            referenced_idents.setdefault(ident, rel)
                    for m in LOC.finditer(row.text):
                        referenced_tags.setdefault(m.group(0), rel)

    # 6. An unknown icon Context fails the row and drops the whole icons file.
    for path, root in parsed.items():
        rel = os.path.relpath(path, mod)
        for table in root:
            if table.tag.split("}")[-1] != "IconDefinitions":
                continue
            for row in table:
                for child in row:
                    if child.tag.split("}")[-1] == "Context" and child.text:
                        ctx = child.text.strip()
                        if ctx not in ICON_CONTEXTS:
                            ident = next((c.text.strip() for c in row
                                          if c.tag.split("}")[-1] == "ID" and c.text), "?")
                            print(f"ERROR: {rel}: icon Context {ctx} (on {ident}) is not one the "
                                  f"game defines; the row fails and the whole icons file is dropped")
                            problems += 1

    # 7. A tag two mods both define takes the whole database down (see the header).
    clashes = sorted((t, who) for t, who in (companion_tags or {}).items() if t in defined_tags)
    for t, who in clashes:
        print(f"ERROR: text tag {t} is defined by this mod and also by {who}; "
              f"a duplicate tag fails the localization database and unloads every mod")
    problems += len(clashes)

    missing_tags = sorted(t for t in referenced_tags if t not in defined_tags and t not in game_tags)
    for t in missing_tags:
        print(f"ERROR: text tag {t} (first used in {referenced_tags[t]}) is defined nowhere")
    problems += len(missing_tags)

    unknown = sorted(i for i in referenced_idents if i not in defined_idents and i not in game_idents)
    for i in unknown:
        print(f"ERROR: {i} (first used in {referenced_idents[i]}) is neither defined by the mod nor known to the game")
    problems += len(unknown)

    # 5. Declared in <Types> but no row in a concrete table: the game's foreign-key
    #    validation fails on the first table that points at it (seen with a tradition whose
    #    Traditions row was lost while its TraditionModifiers rows stayed).
    declared_only = sorted(i for i in types_declared if i not in concrete_defined and i not in game_idents)
    for i in declared_only:
        print(f"ERROR: {i} is declared in <Types> ({types_declared[i]}) but no table defines it")
    problems += len(declared_only)

    mod_only = sorted(i for i in defined_idents if i not in game_idents)
    print(f"{os.path.basename(mod)}: {len(xml_files)} xml files, {len(defined_idents)} identifiers defined "
          f"({len(mod_only)} new), {len(referenced_idents)} referenced, {len(defined_tags)} text tags defined")
    print("OK" if problems == 0 else f"{problems} problem(s)")
    return 1 if problems else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mod", help="mod folder (holds the .modinfo)")
    ap.add_argument("--game", default=os.environ.get("CIV7_RESOURCES", DEFAULT_GAME),
                    help="game Resources directory (or set CIV7_RESOURCES)")
    ap.add_argument("--refresh", action="store_true", help="rebuild the cached game symbol table")
    ap.add_argument("--with", dest="companions", action="append", default=[], metavar="MOD",
                    help="another mod folder whose types this one may reference (repeatable)")
    args = ap.parse_args()
    if not os.path.isdir(os.path.join(args.game, "Base")):
        print(f"game data not found at {args.game}; pass --game", file=sys.stderr)
        return 2
    idents, tags = scan_game(args.game, args.refresh)
    companion_tags = {}
    for companion in args.companions:
        if not os.path.isdir(companion):
            print(f"companion mod folder not found: {companion}", file=sys.stderr)
            return 2
        ci, ct = scan_companion(companion)
        idents |= ci
        tags |= ct
        for t in ct:
            companion_tags.setdefault(t, os.path.basename(os.path.normpath(companion)))
    return check(args.mod, idents, tags, companion_tags)


if __name__ == "__main__":
    sys.exit(main())
