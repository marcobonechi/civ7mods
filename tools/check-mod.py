#!/usr/bin/env python3
"""Static checks for a Civilization VII data mod folder.

Reports, without touching the game:
  1. XML files that do not parse.
  2. Files listed in the .modinfo that do not exist (and data/text files never listed).
  3. LOC_ text tags referenced in data/config but defined neither in the mod's text files
     nor in the game's own text.
  4. Type-like identifiers (CIVILIZATION_*, UNIT_*, MOD_*, REQSET_* ...) referenced in the
     mod that are neither introduced by the mod nor known to the game.

Usage: tools/check-mod.py <ModFolder> [--game <Resources dir>] [--refresh]

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
    "ChallengeType", "CivUniqueUnitType", "UnitClassType", "id",
}
# Tables (element names) in which the defining attribute really defines a new row.
DEFINING_TABLES = {
    "Types", "Units", "Constructibles", "Traditions", "RequirementSets", "Requirements",
    "Unlocks", "ProgressionTreeNodes", "ProgressionTrees", "UnitAbilities", "Tags",
    "IconDefinitions", "Adjacency_YieldChanges", "Civilizations", "LegacyCivilizations",
    "UniqueQuarters", "Traits", "Maps", "MapSizes", "AiListTypes", "NamedRivers",
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


def check(mod, game_idents, game_tags):
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
            for row in table.iter():
                for attr, value in row.attrib.items():
                    for m in IDENT.finditer(value):
                        ident = m.group(0)
                        if attr in DEFINING_ATTRS and (table.tag in DEFINING_TABLES or row.tag in DEFINING_TABLES):
                            defined_idents.add(ident)
                        else:
                            referenced_idents.setdefault(ident, rel)
                    for m in LOC.finditer(value):
                        referenced_tags.setdefault(m.group(0), rel)
                if row.text and row.text.strip():
                    for m in IDENT.finditer(row.text):
                        ident = m.group(0)
                        if table.tag in DEFINING_TABLES and row.tag in ("ID", "From"):
                            defined_idents.add(ident)
                        elif row.tag in ("Argument", "Path", "To", "Item", "Text"):
                            referenced_idents.setdefault(ident, rel)
                        elif table.tag in DEFINING_TABLES:
                            defined_idents.add(ident)
                        else:
                            referenced_idents.setdefault(ident, rel)
                    for m in LOC.finditer(row.text):
                        referenced_tags.setdefault(m.group(0), rel)

    missing_tags = sorted(t for t in referenced_tags if t not in defined_tags and t not in game_tags)
    for t in missing_tags:
        print(f"ERROR: text tag {t} (first used in {referenced_tags[t]}) is defined nowhere")
    problems += len(missing_tags)

    unknown = sorted(i for i in referenced_idents if i not in defined_idents and i not in game_idents)
    for i in unknown:
        print(f"ERROR: {i} (first used in {referenced_idents[i]}) is neither defined by the mod nor known to the game")
    problems += len(unknown)

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
    args = ap.parse_args()
    if not os.path.isdir(os.path.join(args.game, "Base")):
        print(f"game data not found at {args.game}; pass --game", file=sys.stderr)
        return 2
    idents, tags = scan_game(args.game, args.refresh)
    return check(args.mod, idents, tags)


if __name__ == "__main__":
    sys.exit(main())
