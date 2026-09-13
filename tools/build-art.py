#!/usr/bin/env python3
"""Build a mod's binary art package from <Mod>/dlc/civart.json.

    python3 tools/build-art.py Tuscany [Etruscans ...]
    python3 tools/build-art.py --all

Output lands in <Mod>/dlc/<ProjectName>/ (the .dep plus Platforms/{Mac,Windows}/BLPs),
which is what install.sh / install.ps1 mirror into the game install's DLC/ folder. Only
the packages the manifest actually needs are built: StandardAsset always, Material only
when the manifest declares materials. SHARED_DATA blobs are not touched - they are
written by import_gltf.py / make_texture.py and committed alongside the package.
"""

import os
import sys
import json

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "tools", "civ7-art-studio"))

from civ7_art_studio import build, guards
from civ7_art_studio.blp import build_blp
from civ7_art_studio.project import Project

MAC_GAME = os.path.join(
    os.path.expanduser("~"),
    "Library/Application Support/Steam/steamapps/common",
    "Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources"
)
LINUX_GAME = os.path.join(
    os.path.expanduser("~"),
    ".steam/steam/steamapps/common/Sid Meier's Civilization VII"
)
WINDOWS_GAMES = [
    os.path.join(lib, "steamapps/common/Sid Meier's Civilization VII")
    for lib in (os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)") + r"\Steam",
                os.environ.get("ProgramFiles", r"C:\Program Files") + r"\Steam",
                r"C:\SteamLibrary", r"D:\SteamLibrary", r"D:\Steam")
]

# The folder holding Base/ and DLC/. On macOS that is inside the app bundle; on Windows it is the
# Steam library folder, which is not always the default one.
DEFAULT_GAMES = {"darwin": [MAC_GAME], "win32": WINDOWS_GAMES}.get(sys.platform, [LINUX_GAME])

# Both platform folders are written from the same bytes: the package format is
# platform-independent, and shipping both means one clone installs on either OS.
PLATFORMS = ("Mac", "Windows")


def find_game_root():
    pinned = os.environ.get("CIV7_GAME_ROOT")
    roots = [pinned] if pinned else DEFAULT_GAMES
    root = next((r for r in roots if os.path.isdir(os.path.join(r, "DLC"))), None)
    if not root:
        sys.exit("Game root not found (set CIV7_GAME_ROOT), tried:\n  " + "\n  ".join(roots))
    return root


def mods_with_art():
    return sorted(
        name for name in os.listdir(REPO)
        if os.path.isfile(os.path.join(REPO, name, "dlc", "civart.json"))
    )


def build_mod(mod, game_root):
    dlc = os.path.join(REPO, mod, "dlc")
    manifest_path = os.path.join(dlc, "civart.json")
    if not os.path.isfile(manifest_path):
        sys.exit(f"{mod}: no dlc/civart.json")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    name = manifest["project"]["name"]
    print(f"\n=== {mod} -> {name} ===")

    # Guard findings are judgement calls (a seat mismatch is a warning, not a fault), so
    # they are printed and the build continues - the same contract build.build() uses.
    for finding in guards.check_project(manifest):
        print(f"  {finding}")

    project_obj = Project(dlc, manifest)
    built = []

    donor_sa = build._pick_donor(game_root, manifest, "StandardAsset", print)
    sa_data, _ = build_blp.build_package(manifest, donor_sa, game_root, log=print)
    built.append("StandardAsset")

    mat_data = None
    if manifest.get("materials"):
        donor_mat = build._pick_donor(game_root, manifest, "Material", print)
        mat_data = build._build_materials(manifest, donor_mat, print)
        built.append("Material")

    for plat in PLATFORMS:
        blp_dir = os.path.join(dlc, name, "Platforms", plat, "BLPs")
        os.makedirs(blp_dir, exist_ok=True)
        with open(os.path.join(blp_dir, "StandardAsset.blp"), "wb") as f:
            f.write(sa_data)
        print(f"  wrote Platforms/{plat}/BLPs/StandardAsset.blp ({len(sa_data)} bytes)")
        if mat_data is not None:
            with open(os.path.join(blp_dir, "Material.blp"), "wb") as f:
                f.write(mat_data)
            print(f"  wrote Platforms/{plat}/BLPs/Material.blp ({len(mat_data)} bytes)")

    # All packages and the .dep must be written together: the .dep carries a LibraryHash
    # per library and a mismatch makes the game skip the package without saying so.
    dep_path = os.path.join(dlc, name, f"{name}.dep")
    with open(dep_path, "w", encoding="utf-8") as f:
        f.write(project_obj.dep_xml(built))
    print(f"  wrote {name}.dep declaring: {', '.join(built)}")

    # The donor pin is what makes a rebuild reproduce these bytes on another machine or
    # after a game patch; _pick_donor fills it in on the first build.
    pins = manifest.setdefault("donors", {})
    rel = os.path.relpath(donor_sa, game_root)
    if pins.get("StandardAsset") != rel:
        pins["StandardAsset"] = rel
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
            f.write("\n")
        print(f"  pinned StandardAsset donor: {rel}")


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    mods = mods_with_art() if args == ["--all"] else args
    game_root = find_game_root()
    for mod in mods:
        build_mod(mod, game_root)
    print("\nDone.")


if __name__ == "__main__":
    main()
