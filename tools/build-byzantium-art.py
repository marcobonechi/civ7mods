#!/usr/bin/env python3
"""Build ByzantiumArt DLC packages (StandardAsset.blp, Material.blp, ByzantiumArt.dep)."""

import os
import sys
import json
import shutil

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "tools", "civ7-art-studio"))

from civ7_art_studio import build
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


def main():
    pinned = os.environ.get("CIV7_GAME_ROOT")
    roots = [pinned] if pinned else DEFAULT_GAMES
    game_root = next((r for r in roots if os.path.isdir(os.path.join(r, "DLC"))), None)
    if not game_root:
        sys.exit("Game root not found (set CIV7_GAME_ROOT), tried:\n  " + "\n  ".join(roots))

    manifest_path = os.path.join(REPO, "Byzantium", "dlc", "civart.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    project_obj = Project(os.path.join(REPO, "Byzantium", "dlc"), manifest)
    built_packages = []

    # 1. StandardAsset donor and build
    donor_sa = build._pick_donor(game_root, manifest, "StandardAsset", print)
    print(f"Building StandardAsset.blp from donor {donor_sa}...")
    sa_data, sa_b = build_blp.build_package(manifest, donor_sa, game_root, log=print)
    built_packages.append("StandardAsset")

    # 2. Material donor and build
    donor_mat = build._pick_donor(game_root, manifest, "Material", print)
    print(f"Building Material.blp from donor {donor_mat}...")
    mat_data = build._build_materials(manifest, donor_mat, print)
    built_packages.append("Material")

    # 3. Write BLP files to both Mac and Windows platforms
    for plat in ("Mac", "Windows"):
        blp_dir = os.path.join(REPO, "Byzantium", "dlc", "ByzantiumArt", "Platforms", plat, "BLPs")
        os.makedirs(blp_dir, exist_ok=True)
        
        sa_path = os.path.join(blp_dir, "StandardAsset.blp")
        with open(sa_path, "wb") as f:
            f.write(sa_data)
        print(f"Wrote {sa_path} ({len(sa_data)} bytes)")

        mat_path = os.path.join(blp_dir, "Material.blp")
        with open(mat_path, "wb") as f:
            f.write(mat_data)
        print(f"Wrote {mat_path} ({len(mat_data)} bytes)")

    # 4. Write ByzantiumArt.dep
    dep_path = os.path.join(REPO, "Byzantium", "dlc", "ByzantiumArt", "ByzantiumArt.dep")
    dep_xml = project_obj.dep_xml(built_packages)
    with open(dep_path, "w", encoding="utf-8") as f:
        f.write(dep_xml)
    print(f"Wrote {dep_path} declaring: {', '.join(built_packages)}")

    print("\nByzantiumArt package build completed successfully!")


if __name__ == "__main__":
    main()
