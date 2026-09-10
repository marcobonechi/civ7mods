# 3D Art Pipeline for Civilization VII

This directory contains documentation, specifications, and pipeline guides for authoring and deploying custom 3D models for Civilization VII mods.

* **[.claude/skills/civ7-3d-model/](../.claude/skills/civ7-3d-model/)**: the skill that
  drives this pipeline - procedure in `SKILL.md`, specs, formats and traps in
  `reference.md`. Start there.
* **[plan.md](plan.md)**: The end-to-end technical plan, engine geometry specifications, texture compression formats, coordinate transforms, conversion steps (`civart` / `import_gltf.py`), manifest schema, and in-game deployment.

## Models

There are **two** Hagia Sophias here, built by opposite routes. The one that ships is
the second.

### A. Procedural, from scratch (`src/hagia_sophia.py`) - the alternative

The Justinianic church, modelled from nothing. Art direction follows the wonder icon
(`Byzantium/icons/src/wondericon_hagia_sophia.svg`), whose palette the materials sample
directly: terracotta brick, lead-grey ribbed dome, marble string courses, gold cross, and
no minarets.

It is a **generator script, not a hand-modelled `.blend`** — every dimension is a named
constant in game units, so the proportions can be retuned and the mesh rebuilt in a second.
`src/hagia_sophia.blend` is a build output of that script, and `src/export_glb.py` flattens
the baked materials to the single primitive the manifest requires.

**This route is not what ships.** `export/hagia_sophia.glb` now holds route B's mesh, so
re-export before measuring or building from route A. The generator still runs unchanged.

```bash
blender -b --factory-startup --python 3d_art/src/hagia_sophia.py
```

| | |
|---|---|
| Footprint | 24.3 × 20.0 units (inside a 12-14 unit hex radius) |
| Height | 25.8 units to the cross |
| Geometry | 5,020 verts, 4,064 triangles, 1 mesh / 1 primitive / 1 material |
| Grounded | lowest vertex at Z = 0, centred on the origin in XY |
| UVs | smart-projected into 0-1, as the stride-20 vertex layout requires |
| Manifest bounds | `[-12.13, -10.0, 0.0, 12.13, 10.0, 25.8]` |

Regenerate these from any `.glb` with
`3d_art/.venv/bin/python 3d_art/src/check_glb.py <file> --scale 10.0`. (Route A is modelled
in Blender metres, hence scale 10.)

Openings are cut with a boolean rather than painted on as dark panels, so every arch has
real depth and catches shadow at the angle the game camera uses. The dome's ribs come free:
alternate meridians of the sphere are pushed out by `DOME_FLUTE` and the mesh is shaded
smooth-by-angle, so the flutes crease while the rings stay round — no extra geometry.

### B. Morphed from the Blue Mosque (`src/create_alt_hagia_sophia.py`) - **shipping**

Firaxis' Ottoman Blue Mosque, surgically edited: geometry pulled straight out of the game's
`.blp` by `src/extract_blue_mosque_submeshes.py`, the six minarets and the terrain skirts
deleted by submesh name, domes recoloured Byzantine imperial red, a gold cross added, then
re-grounded and re-baked.

| | |
|---|---|
| Footprint | 18.8 × 27.6 units |
| Height | 18.5 units |
| Geometry | 111,118 verts, 46,750 triangles, 1 mesh / 1 primitive / 1 material |
| Manifest bounds | `[-9.39, -13.8, 0.0, 9.39, 13.8, 18.5]` |

```bash
3d_art/.venv/bin/python 3d_art/src/check_glb.py 3d_art/export/hagia_sophia.glb --scale 1.0
```

**`--scale 1.0`, not 10.** Extracted geometry comes out of a GPU buffer already in game
units; scaling it again gives a 276-unit wonder. `check_glb.py` prints a hint when it sees
a footprint that far out.

The trade: route B inherits Civ 7's art style for free, because it *is* Civ 7 art, and its
scale and grounding are correct by construction. It costs an order of magnitude more
triangles than route A (46,750 vs 4,064), and the result still reads as the Blue Mosque -
the rectangular courtyard plan is the donor's, not Justinian's.

Full method, record layouts and traps: **[the civ7-3d-model skill](../.claude/skills/civ7-3d-model/)**,
`SKILL.md` §*Two ways to get geometry* and `reference.md` §8.

Scale is worth restating, because it is not intuitive. A Civ 7 hex is only ~24-28 units
across while a human unit is 18-19 units tall, so a wonder cannot be modelled to real
proportions: the true building is 82 m long and 55 m to the dome, which would be 820 units.
This model is compressed to roughly a square elevation, matching the icon, and made taller
than a unit so it reads as monumental.

### Both routes: what is deployed

`Byzantium/dlc/civart.json` attaches `MESH_Hagia_Sophia` (currently route B's geometry) to
`WONDER_Byzantium_Hagia_Sophia`, replacing the borrowed `BIN_WON_Sultan_Ahmet_Camii` remap.
Textures are a unified 2048² atlas (`_B`, `_N`, `_ORM`) compressed to DDS and wrapped as
`TEXTURE_HAGIA_SOPHIA_*` blobs; geometry is `GB_HAGIA_SOPHIA_MB`. `StandardAsset.blp`,
`Material.blp` and `ByzantiumArt.dep` are built, validated, and mirrored into the game
install by `./install.sh Byzantium`.

Verified: manifest guards clean, both packages pass `validate.py`, `tools/check-art.py`
confirms the package **mounts**.

**Not yet confirmed: that the wonder renders.** Civ 7 logs packages, never individual
assets, so a mount is as far as the logs reach — see *Testing* below. One texture defect is
also outstanding: the normal map has a single mip where BaseColor and ORM have 12, so expect
shimmering at distance. `src/check_dds.py` reproduces it.

## Testing whether the game loads a model

Four stages, and they fail in different places. All four have now been run for the Hagia
Sophia; the toolchain that used to be missing is vendored at `tools/civ7-art-studio/`.

**1. Geometry conformance — no game needed.** Read the exported GLB back and apply the
transform `import_gltf.py` will apply (`(x, y, z) -> (x, -z, y)`, `--scale 10`), then check
the result is grounded at Z = 0, centred in XY, inside the hex, and carries normals and UVs.
The Hagia Sophia numbers in the table above came from exactly this check.

**2. Package build.** `import_gltf.py` writes the vertex/index blob into `SHARED_DATA/` and
prints a manifest snippet; that snippet goes into `civart.json` under `meshes`, and the
build regenerates `StandardAsset.blp`, `Material.blp` and the `.dep`. Unavoidable: **the
game only loads `.blp`.**

Note that `civart` is only a web server - there is no `civart build` subcommand, whatever
step 6 of `plan.md` says. Build via `civ7_art_studio.build.build()` or the per-package CLIs
under `civ7_art_studio/blp/`. Check the manifest first, and the packages after:

```bash
python3 -c "import sys,json; sys.path.insert(0,'tools/civ7-art-studio'); \
from civ7_art_studio import guards; \
print(guards.check_project(json.load(open('Byzantium/dlc/civart.json'))) or 'clean')"
python3 tools/civ7-art-studio/civ7_art_studio/blp/validate.py \
    Byzantium/dlc/ByzantiumArt/Platforms/*/BLPs/*.blp
```

The `.dep` is plain XML and looks temptingly hand-editable. It is not — it carries a
`LibraryHash` per library, and a mismatch makes the game skip the package with
`not loading since it was not found in the package info` in `ArtDef.log`. Always rebuild
both together.

**3. Deploy.** `./install.sh Byzantium` mirrors the mod into `Mods/` and every
`dlc/<Group>/` into the game install's `DLC/`. Restart the game — it reads mods only at
startup.

**4. Confirm the mount, then look at it.**

```bash
tools/check-art.py Byzantium
```

That checks the `.modinfo` actually switches the group on with `<UpdateArt>` (in both
`game` and `shell` scope), that the `.dep` parses and the `.blp`s and `SHARED_DATA/` exist,
that what is deployed matches the repo, and then reads `ArtDef.log` to see whether the
package mounted on the last run. What it looks for:

| Log line in `ArtDef.log` | Means |
|---|---|
| `Loading Package: .../ByzantiumArt/.../StandardAsset.blp` | mounted, this is the success case |
| `Queue Package` but no `Loading Package` | queued and rejected — the package is broken |
| `not found in the package info` / `Failed to find library hash` | `.blp` and `.dep` disagree; rebuild |
| no mention of the group at all | `<UpdateArt>` never fired, or the game was not restarted |
| `Branch/Local override package directory ... does not exist` | harmless; every package logs it |

`UI.log`'s `Failed loading resource: blp:<name>` is a *different* layer — 2D UI textures,
not meshes.

**A mount is not a render, and no log can close that gap.** Civ 7 logs packages and never
individual art assets: grepping every file in `Logs/` for our own asset names returns
nothing, across 1171 package lines. (`check-art.py --asset` will search anyway, and says so.)
The last step is therefore visual: build the wonder in a game and check grounding (no sinking
or floating), the hex footprint, normal direction and the specular response on the dome.

## Toolchain setup

Installed on this machine (macOS, Apple Silicon) on 2026-09-09.

| Piece | Where | Notes |
|---|---|---|
| Blender 5.2.1 LTS | `/Applications/Blender.app`, `blender` on PATH | Bundles Python 3.13 with `numpy`, `requests`, `certifi` |
| MCP for Blender addon | `~/Library/Application Support/Blender/5.2/scripts/addons/blender_mcp.py` | Enabled and saved in preferences, so it is on at every launch |
| `blender-mcp` server | `~/.local/bin/blender-mcp` (uv tool) | Registered with Claude Code at **user** scope |
| Pipeline venv | `3d_art/.venv` | Python 3.13 with `numpy`, `pygltflib`, `Pillow` |

Reinstall from scratch:

```bash
brew install --cask blender
uv tool install blender-mcp
blender-mcp install-addon
claude mcp add --scope user blender -- "$HOME/.local/bin/blender-mcp"
uv venv --python 3.13 3d_art/.venv
uv pip install --python 3d_art/.venv/bin/python numpy pygltflib Pillow
```

### Driving Blender from Claude

The MCP server talks to the addon over a TCP socket on `localhost:9876`, and the addon
drains commands on Blender's main thread via `bpy.app.timers`. Two consequences:

* **Blender must be running with a window.** In `blender -b` background mode the timers
  never tick, so commands queue forever. Headless work belongs in `--python` scripts, not
  over MCP.
* **The socket server has to be started.** In the GUI: `View3D → Sidebar (N) → MCP for
  Blender → Start MCP Server`. To skip the click:

  ```bash
  blender --python-expr "import bpy; bpy.app.timers.register(lambda: bpy.ops.blendermcp.start_server() and None, first_interval=3)"
  ```

Telemetry in the addon is opt-in and left **off**; with consent it would upload prompts,
generated code and screenshots. It lives in `Preferences → Add-ons → MCP for Blender`.

### Toolchain notes

`civ7-art-studio` is **vendored and tracked** at `tools/civ7-art-studio/` (60 files), so a
fresh clone has it. It is not pip-installed; call it by path, or add it to `sys.path`. Its
module docstrings are the most accurate format documentation available - they were derived
by surveying the shipped game packages, and they contradict `plan.md` in places. Believe the
docstrings.

`texconv` (plan.md step 2) is Windows-only and was never used here; the DDS maps were written
by hand-rolled encoders in `src/`. That works, but it is what produced the two texture defects
noted above, so check the output:

```bash
3d_art/.venv/bin/python 3d_art/src/check_dds.py 3d_art/dds/*.dds
```
