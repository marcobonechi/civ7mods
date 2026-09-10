#!/usr/bin/env python3
"""Did the game load a mod's binary art package?

Civ 7 will not load art packages from Mods/. They have to be mirrored into the game
install's DLC/ (install.sh does that), and the mod's .modinfo has to switch the group on
with <UpdateArt>. This checks all of it, then reads the game's own log to see whether the
packages actually mounted on the last run.

Usage: tools/check-art.py <ModFolder> [--asset NAME] [--game <Resources dir>]

  --asset NAME   search every log for NAME. Note up front: Civ 7 logs *packages*, not
                 individual art assets, so silence here proves nothing - it is a
                 courtesy search, never a pass/fail gate.

Exit status is 1 if anything is wrong, so it can gate a release script.
"""
import argparse
import os
import re
import sys
import xml.etree.ElementTree as ET

HOME = os.path.expanduser("~")
LOGS = os.path.join(HOME, "Library/Application Support/Civilization VII/Logs")
DEFAULT_GAME = os.path.join(
    HOME, "Library/Application Support/Steam/steamapps/common",
    "Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources")
ARTDEF = "ArtDef.log"

# "not loading since it was not found in the package info" is the library-hash mismatch you
# get from a hand-edited .dep or a .blp rebuilt without it.
HASH_FAIL = "not found in the package info"


def fail(msg):
    print("  FAIL %s" % msg)
    return False


def ok(msg):
    print("  ok   %s" % msg)
    return True


def groups_in(mod):
    """Art groups the mod ships: dlc/<Group>/<Group>.dep."""
    out = []
    dlc = os.path.join(mod, "dlc")
    if not os.path.isdir(dlc):
        return out
    for name in sorted(os.listdir(dlc)):
        d = os.path.join(dlc, name)
        if os.path.isdir(d) and os.path.isfile(os.path.join(d, name + ".dep")):
            out.append(name)
    return out


def declared_in_modinfo(mod):
    """Group names the .modinfo turns on with <UpdateArt>, and the scopes it does it in."""
    found = {}
    for f in os.listdir(mod):
        if not f.endswith(".modinfo"):
            continue
        try:
            root = ET.parse(os.path.join(mod, f)).getroot()
        except ET.ParseError as e:
            print("  FAIL %s does not parse: %s" % (f, e))
            continue
        for ag in root.iter():
            if not ag.tag.endswith("ActionGroup"):
                continue
            scope = ag.get("scope", "?")
            for item in ag.iter():
                if item.tag.endswith("UpdateArt"):
                    for el in item:
                        if el.text:
                            found.setdefault(el.text.strip(), set()).add(scope)
    return found


def check_package(mod, group, game):
    print("\nart group %s" % group)
    good = True
    src = os.path.join(mod, "dlc", group)
    dep = os.path.join(src, group + ".dep")

    try:
        ET.parse(dep)
        libs = re.findall(r'<LibraryName text="([^"]+)"/>', open(dep).read())
        good &= ok("%s.dep parses, declares: %s" % (group, ", ".join(libs) or "nothing"))
    except ET.ParseError as e:
        good &= fail("%s.dep does not parse: %s" % (group, e))
        libs = []

    for plat in ("Mac", "Windows"):
        d = os.path.join(src, "Platforms", plat, "BLPs")
        blps = sorted(f for f in os.listdir(d) if f.endswith(".blp")) if os.path.isdir(d) else []
        if blps:
            good &= ok("Platforms/%s/BLPs: %s" % (plat, ", ".join(blps)))
        else:
            good &= fail("Platforms/%s/BLPs has no .blp" % plat)
        shared = os.path.join(d, "SHARED_DATA")
        if os.path.isdir(shared):
            n = len(os.listdir(shared))
            ok("Platforms/%s/BLPs/SHARED_DATA: %d blob(s)" % (plat, n))
        elif any(l in libs for l in ("Geometry", "Material")):
            good &= fail("Platforms/%s: declares geometry/material but has no SHARED_DATA" % plat)

    # Deployed into the game install?
    if not game or not os.path.isdir(os.path.join(game, "DLC")):
        good &= fail("game DLC folder not found (pass --game, or set CIV7_GAME_ROOT and run install.sh)")
        return good, None
    dst = os.path.join(game, "DLC", group)
    if not os.path.isdir(dst):
        good &= fail("not deployed to %s - run ./install.sh %s" % (dst, os.path.basename(mod)))
        return good, dst
    if not os.path.isfile(os.path.join(dst, group + ".dep")):
        good &= fail("deployed folder has no %s.dep" % group)
    else:
        same = open(dep, "rb").read() == open(os.path.join(dst, group + ".dep"), "rb").read()
        good &= ok("deployed to game DLC/") if same else fail(
            "deployed .dep differs from the repo's - re-run ./install.sh")
    return good, dst


def check_log(group):
    path = os.path.join(LOGS, ARTDEF)
    print("\n%s" % ARTDEF)
    if not os.path.isfile(path):
        return fail("no %s - launch the game once" % path)
    text = open(path, errors="ignore").read()
    lines = text.splitlines()

    loaded = [l for l in lines if "Loading Package" in l and group in l]
    queued = [l for l in lines if "Queue Package" in l and group in l]
    failed = [l for l in lines if HASH_FAIL in l and group in l]

    good = True
    if failed:
        good &= fail("library-hash rejection (%d line(s)); rebuild with civart, do not hand-edit the .dep" % len(failed))
        print("       %s" % failed[0].strip()[:160])
    if loaded:
        good &= ok("mounted: %d 'Loading Package' line(s), latest:" % len(loaded))
        print("       %s" % loaded[-1].strip()[:160])
    elif queued:
        good &= fail("queued but never loaded (%d 'Queue Package' line(s)) - package is broken" % len(queued))
    else:
        good &= fail("never mentioned - <UpdateArt> did not fire, or the game was not restarted")

    return good


def search_asset(asset):
    """Search every log for an asset name.

    Deliberately not a pass/fail check. Civ 7's logs name packages and never individual
    meshes, materials or textures - grepping the whole Logs/ folder for a shipped asset
    name returns nothing even when the model is on screen. So absence is not evidence,
    and reporting it as a failure (which this tool used to do) is just wrong.
    """
    print("\nasset %s" % asset)
    if not os.path.isdir(LOGS):
        print("  note no log folder at %s" % LOGS)
        return
    hits = []
    for name in sorted(os.listdir(LOGS)):
        path = os.path.join(LOGS, name)
        if not os.path.isfile(path):
            continue
        try:
            for line in open(path, errors="ignore"):
                if asset.lower() in line.lower():
                    hits.append((name, line.strip()))
                    break
        except OSError:
            continue
    if hits:
        print("  found in %d log(s):" % len(hits))
        for name, line in hits[:4]:
            print("       %-24s %s" % (name, line[:120]))
    else:
        print("  note not mentioned in any log - expected. Civ 7 does not log art asset")
        print("       resolution, so this cannot confirm or deny that the model rendered.")
        print("       Build it in game and look at it.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mod")
    ap.add_argument("--asset")
    ap.add_argument("--game", default=os.environ.get("CIV7_GAME_ROOT") or DEFAULT_GAME)
    a = ap.parse_args()

    mod = a.mod.rstrip("/")
    if not os.path.isdir(mod):
        sys.exit("not a folder: %s" % mod)

    groups = groups_in(mod)
    if not groups:
        sys.exit("%s ships no art package (expected dlc/<Group>/<Group>.dep)" % mod)

    print("mod %s" % mod)
    declared = declared_in_modinfo(mod)
    good = True
    for g in groups:
        if g in declared:
            good &= ok("<UpdateArt>%s</UpdateArt> in scope(s): %s"
                       % (g, ", ".join(sorted(declared[g]))))
            if "shell" not in declared[g]:
                print("       note: no shell scope - the group will not load on the "
                      "front-end screens")
        else:
            good &= fail("dlc/%s exists but no <UpdateArt> names it in the .modinfo" % g)
    for g in sorted(set(declared) - set(groups)):
        good &= fail("<UpdateArt> names %s but there is no dlc/%s/%s.dep" % (g, g, g))

    for g in groups:
        pkg_ok, _ = check_package(mod, g, a.game)
        good &= pkg_ok
        good &= check_log(g)

    if a.asset:
        search_asset(a.asset)

    print("\n%s" % ("all checks passed" if good else "problems above"))
    sys.exit(0 if good else 1)


if __name__ == "__main__":
    main()
