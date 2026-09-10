---
name: civ7-3d-model
description: Author a custom 3D model (wonder, building, improvement or prop) for a Civilization VII mod in this repository and ship it as a binary art package. Covers both routes - modelling procedurally in Blender, and extracting a shipped Firaxis asset from a .blp to edit or morph into something else - plus baked PBR atlas, DDS compression, Civ 7 GPU blobs, civart.json manifest, .blp/.dep build, deploy and verify. Use when asked to create, replace, retexture, rebuild, extract, morph or debug a Civ 7 3D model or art package.
---

# Custom 3D model for Civilization VII

Two worked examples in `3d_art/`, both for `WONDER_HAGIA_SOPHIA`, built by opposite
routes - read *Two ways to get geometry* below before choosing. `reference.md` in this
folder has the engine specs, texture formats and the traps that cost real time.

The one thing to understand before anything else: **the game loads binary `.blp` packages
from its own install's `DLC/`, never from `Mods/`.** The mod folder only holds the switch
(`<UpdateArt>`). Everything below exists to get geometry into a `.blp`.

## Ground truth to consult first

- `3d_art/plan.md` - engine geometry spec, vertex layout, texture formats, manifest schema.
- `tools/civ7-art-studio/` - the build toolchain, **vendored and tracked in this repo**
  (60 files). Its module docstrings are the best format documentation that exists; they
  were derived by surveying the shipped game packages. Read them before trusting anything
  else, including `plan.md`.
  - `civ7_art_studio/blp/import_gltf.py` - GLB to GPU vertex/index blob
  - `civ7_art_studio/blp/make_texture.py` - DDS to texture blob; its header comment lists
    the exact DXGI format each texture class uses across all 22,000 shipped model textures
  - `civ7_art_studio/blp/validate.py` - CIVBLP structural check
  - `civ7_art_studio/build.py` - `build(project, game_root)`, the supported build entry
- Game install (macOS Steam):
  `~/Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources/`
- Logs: `~/Library/Application Support/Civilization VII/Logs/` - `ArtDef.log` for packages.

`civart` itself is **only a web server** (`civart --host --port --no-browser`). There is no
`civart build` subcommand; `plan.md` used to claim one. Build through `build.build()` or the
per-package CLIs.

## Two ways to get geometry

**A. Build it from scratch** - `src/hagia_sophia.py`, a procedural generator. Total control,
tiny mesh (4,064 tris), and the proportions are named constants you can retune. But you are
hand-rolling the art style, and matching Firaxis by eye is hard.

**B. Edit a shipped asset** - `src/extract_blue_mosque_submeshes.py` +
`src/create_alt_hagia_sophia.py`. Pull real game geometry out of a `.blp`, delete what does
not belong, add what does, recolour, re-export. The Hagia Sophia now shipping took the
Ottoman Blue Mosque (`GB_WON_Sultan_Ahmet_Camii_HB_MB`), removed the six minarets and the
terrain skirts, recoloured the domes Byzantine imperial red and added a gold cross.

| | A: from scratch | B: edit a shipped asset |
|---|---|---|
| Art-style fit | you have to earn it | **free - it is Firaxis art** |
| Scale and grounding | you set them, and can get them wrong | already correct |
| Triangles | 4,064 | 46,750 - an order of magnitude more |
| Silhouette | whatever you want | the donor's plan, which may be the wrong building |
| Retuning | edit a constant, rebuild | re-do the surgery |

B is usually the better default for a wonder that has a close cousin in the game, and it is
what the base game's own modders reach for. Its honest cost is that the result still reads
as the donor: the shipped Hagia Sophia has the Blue Mosque's rectangular courtyard plan, not
Justinian's. Use A when nothing in the game resembles the subject, or when the triangle
budget matters.

### Extracting geometry from a shipped package

`import_gltf.py` goes one way; there is no supplied tool for the other. The reader in
`src/extract_blue_mosque_submeshes.py` is the reference implementation - see `reference.md`
§8 for the record layout it walks. In outline: open the donor `StandardAsset.blp` with
`civ7_art_studio.blp.blp.BLP`, find allocs of type `AssetPackage_Geometry_Mesh_Lod5`, keep
the submesh records whose GPU-buffer name matches, then cut vertices and indices out of the
matching `SHARED_DATA/GB_*_MB` blob.

Two things that will bite: submeshes come in **LOD pairs**, so take the higher
`prim_count` of each pair or you will export the low-detail mesh; and the blob has a
**16-byte header** before the payload.

Write each submesh as its own named OBJ group. That is what makes the surgery tractable -
deleting a minaret becomes deleting `submesh_46`, not a lasso selection in Blender.

## Scale, which is the thing everyone gets wrong

1 game unit = 0.1 m. A hex is only ~24-28 units across, but a human unit is 18-19 units
**tall**. So a wonder cannot be modelled to real proportions - the real Hagia Sophia is 82 m
long, which would be 820 units. Compress the elevation to roughly square, match the wonder
icon's silhouette, and make it taller than a unit so it reads as monumental. Model in
Blender metres (`UNIT = 0.1`) and let `--scale 10` convert back.

**The conversion scale depends on where the geometry came from, and getting it wrong is a
silent factor-of-ten error:**

| Provenance | `import_gltf.py --scale` | `check_glb.py --scale` |
|---|---|---|
| Modelled in Blender metres (route A) | `10.0` | `10.0` (the default) |
| Extracted from a shipped `.blp` (route B) | **`1.0`** | **`1.0`** |

Extracted geometry is already in game units - it came out of a GPU buffer - so scaling it
again by 10 gives a wonder 187 units across. Check the numbers against the hex, not against
the exit status.

Hard requirements: centred on the origin in XY, lowest vertex exactly at Z = 0, footprint
inside a 12-14 unit hex radius, UVs present (the stride-20 vertex layout has UV and UV2).

## Procedure

1. **Art direction.** If the mod already has a wonder icon, it *is* the brief - sample its
   palette and match its silhouette. `Byzantium/icons/src/wondericon_hagia_sophia.svg` set
   the terracotta/lead/marble/gold palette for the model.
2. **Get the geometry** by route A or B above, as a script either way, so it is repeatable:
   `blender -b --factory-startup --python 3d_art/src/<name>.py`.
   - *Route A*: every dimension a named constant in game units. Cut openings with a boolean
     so arches have real depth; a dark panel laid on the wall is invisible, because the wall
     face draws over it.
   - *Route B*: extract to per-submesh OBJ groups, then delete, add and recolour by group
     name. Check the donor for terrain skirts - they are separate submeshes and will show as
     stray flanges if left in.
3. **Look at it.** Render a three-quarter view and a flat elevation, and also render at
   ~150 px - that is roughly the size the game draws a wonder, and it is the only honest
   readability test. Iterate here; it is far cheaper than iterating after the bake.
4. **Bake one PBR atlas** (`3d_art/src/bake_textures.py`): BaseColor, Normal, ORM at 2048².
   The manifest gives a mesh exactly one `material`, so many Blender materials must become
   one atlas and the GLB must export as **one mesh, one primitive, one material**.
5. **Compress to DDS** with the right DXGI format per map - see `reference.md`. Getting
   BaseColor's sRGB variant wrong is silent and costs you correct gamma.
6. **Export GLB** (`3d_art/src/export_glb.py`): `+Y Up` on, normals and UVs on, Draco off,
   tangents off.
7. **Convert to blobs**, into both platforms' `SHARED_DATA/`:
   ```bash
   python3 tools/civ7-art-studio/civ7_art_studio/blp/import_gltf.py \
       3d_art/export/<name>.glb GB_<NAME>_MB -o <out>/SHARED_DATA --scale 10.0
   python3 tools/civ7-art-studio/civ7_art_studio/blp/make_texture.py \
       3d_art/dds/<name>_B.dds <NAME>_B -o <out>/SHARED_DATA
   ```
   `import_gltf.py` prints the manifest snippet - vertex counts, `index_start`, `bounds`.
   Paste it, do not retype it.
8. **Wire `<Mod>/dlc/civart.json`**: a `meshes` entry, a `materials` entry naming the three
   texture blobs, and a `wonders`/`buildings` entry attaching the mesh (`"main"`).
9. **Build** `StandardAsset.blp`, `Material.blp` and the `.dep`. All three must be rebuilt
   **together** - the `.dep` carries a `LibraryHash` per library and a mismatch makes the
   game skip the package silently. Never hand-edit the `.dep`, however readable its XML is.
10. **Deploy and verify** (below), then build the wonder in a real game and look at it.

## Checks

```bash
# manifest is well formed (read-only, no build)
python3 -c "import sys,json; sys.path.insert(0,'tools/civ7-art-studio'); \
from civ7_art_studio import guards; \
print(guards.check_project(json.load(open('Byzantium/dlc/civart.json'))) or 'clean')"

# packages are structurally sound
python3 tools/civ7-art-studio/civ7_art_studio/blp/validate.py \
    Byzantium/dlc/ByzantiumArt/Platforms/*/BLPs/*.blp

# geometry still meets the engine contract (bounds, grounding, single primitive, UVs)
3d_art/.venv/bin/python 3d_art/src/check_glb.py 3d_art/export/hagia_sophia.glb

./install.sh Byzantium && open -a "Sid Meier's Civilization VII"
tools/check-art.py Byzantium          # then read ArtDef.log for the mount
```

**A mount is not a render.** Civ 7 logs *packages*, never individual art assets - no log
line anywhere will name your mesh. Once `check-art.py` reports the package mounted, the only
remaining test is visual: build the thing in game and check grounding, hex footprint, normal
direction and specular response.
