# Reference: Civ 7 custom 3D art

Specs, formats and the traps. `3d_art/plan.md` holds the longer prose version; this is what
you need at the keyboard. Where the two disagree, believe the module docstrings in
`tools/civ7-art-studio/` - they were derived by surveying shipped game packages, and
`plan.md` has been wrong at least twice (see *Corrections* at the end).

## 1. Where files have to live

The engine does **not** load `.blp` / `.dep` / `SHARED_DATA` from the user's `Mods/` folder.
They must sit in the game install:

```
<GAME_ROOT>/DLC/<ArtGroup>/<ArtGroup>.dep
<GAME_ROOT>/DLC/<ArtGroup>/Platforms/<Windows|Mac>/BLPs/*.blp
<GAME_ROOT>/DLC/<ArtGroup>/Platforms/<Windows|Mac>/BLPs/SHARED_DATA/
```

`./install.sh <Mod>` mirrors `<Mod>/dlc/<Group>/` there. Build **both** platform trees; the
studio's `Project` only knows about `Platforms/Windows`, so the Mac tree needs mirroring.

The mod itself just switches the group on, in both scopes:

```xml
<ActionGroup id="game-art" scope="game"><Actions>
    <UpdateArt><Item>ByzantiumArt</Item></UpdateArt>
</Actions></ActionGroup>
<ActionGroup id="shell-art" scope="shell"><Actions>
    <UpdateArt><Item>ByzantiumArt</Item></UpdateArt>
</Actions></ActionGroup>
```

Without the `shell` scope the group will not load on the front-end screens.

## 2. Geometry

| | |
|---|---|
| Coordinates | Z-up, right-handed. glTF is Y-up, so `import_gltf.py` maps `(x, y, z) -> (x, -z, y)` |
| Scale | 1 unit = 0.1 m; model in Blender metres and convert with `--scale 10.0` |
| Hex | outer radius ~12-14 units, so ~24-28 across |
| Human unit | 18-19 units **tall** - taller than a hex is wide |
| Origin | centred in XY, lowest vertex exactly Z = 0 |
| Vertex layout | stride 20, `eVertexComponents 0x0009`, `eCompression 1`: `float16[3]` position + 2 pad, `uint8[4]` packed normal, `float16[2]` UV, `float16[2]` UV2 |
| Indices | `uint32`, stride 4 |

Not supported: custom rigged skeletons and bone animation (they need vertex components
`0x2`, stride 28, not yet decoded). Static geometry, material clones, custom textures and
unit member swaps are.

**Positions are `float16`.** Above ~2048 the spacing exceeds 1 unit, and precision is
already coarse at wonder scale - another reason not to model at real-world size.

## 3. Textures

One mesh gets exactly one `material`, so every Blender material must bake into a single
atlas, and the GLB must export as one mesh / one primitive / one material.

| Map | DXGI | Name | Channels |
|---|---|---|---|
| BaseColor | **72** | `BC1_UNORM_SRGB` | RGB albedo |
| Normal | **83** | `BC5_UNORM` | R=X, G=Y, Z reconstructed |
| ORM | **71** | `BC1_UNORM` | R=AO, G=Roughness, B=Metallic |
| Tint / mask | **80** | `BC4_UNORM` | single channel |

Those are near-uniform across the ~22,000 shipped model textures (`make_texture.py`
header). Encoding a normal or mask as BC7 is wrong.

### The sRGB trap

`make_texture.py` copies the payload through byte for byte and takes the format **from the
DDS header**. A legacy FourCC header can only express the non-sRGB variants:

```
DXT1 -> 71 (BC1_UNORM)      ATI2 -> 83 (BC5_UNORM)      ATI1/BC4U -> 80
```

So a BaseColor written with a plain `DXT1` FourCC ships as **71, not 72**, the shader skips
the sRGB decode, and the albedo renders with wrong gamma. To get 72 the DDS must carry a
**DX10 extended header** with `dxgiFormat = 72`. Nothing warns you. Check with
`3d_art/src/check_dds.py`.

Mip chains: give every map a full chain (2048² is 12 levels). A single-mip texture aliases
and shimmers at the distance the game draws a wonder.

Texture flags: `0x82` = raw payload (what we ship), `0x10` bit = Oodle-compressed (shipped
Firaxis assets). No Oodle compressor is needed because we write raw.

## 4. Manifest (`<Mod>/dlc/civart.json`)

```json
"meshes":    [{"asset": "MESH_X", "buffer": "GB_X_MB", "buffer_size": 149168,
               "vertex_offset": 0, "vertex_count": 5020, "index_start": 25100,
               "primitive_count": 4064, "min_index": 0, "max_index": 5019,
               "bounds": [-12.13, -10.0, 0.0, 12.13, 10.0, 25.8],
               "wrapper_scale": 1.0, "material": "X_MATERIAL"}],
"materials": [{"name": "X_MATERIAL", "kind": "aniso",
               "slots": {"base_color": "TEXTURE_X_B", "normal": "TEXTURE_X_N",
                         "orm": "TEXTURE_X_ORM"}}],
"wonders":   [{"asset": "WONDER_X", "type": "WONDER_X",
               "attachments": [["main", "MESH_X", 0.0], ...],
               "hexes": {}, "baseLayer": "TER_EDIT_Flatten_Hex"}],
"donors":    {"StandardAsset": "DLC/joseon/Platforms/Mac/BLPs/StandardAsset.blp"}
```

`import_gltf.py` prints this block - paste it rather than retyping. `buffer_size` must equal
`vertex_count * 20 + primitive_count * 3 * 4`, and `index_start` is that vertex block in
4-byte words (`vertex_count * 20 / 4`). The `donors` entry matters: the type registry is
copied verbatim from a shipped package, and declaring too few types is fatal.

Validate the manifest without building:

```bash
python3 -c "import sys,json; sys.path.insert(0,'tools/civ7-art-studio'); \
from civ7_art_studio import guards; \
print(guards.check_project(json.load(open('<Mod>/dlc/civart.json'))) or 'clean')"
```

## 5. Building

`civart` is **only a web server** - `civart [--host H] [--port N] [--no-browser]`. There is
no `civart build` subcommand. Build through `civ7_art_studio.build.build(project, game_root)`,
or the per-package CLIs:

```
python3 blp/build_blp.py <donor.blp> <out.blp> [--project civart.json]
python3 blp/validate.py <file.blp> ...
```

`build.build()` writes into `<project>/built/DLC/<name>/Platforms/Windows/BLPs`, which is
*not* the repo's `<Mod>/dlc/<Group>/Platforms/{Mac,Windows}/` layout - the outputs have to be
placed into both platform trees afterwards.

**`StandardAsset.blp`, `Material.blp` and the `.dep` must be rebuilt together.** The `.dep`
is readable XML carrying a `LibraryHash` per library; if it disagrees with the `.blp` the
game skips the package and logs `not found in the package info`. Never hand-edit it.

## 6. Verifying

```bash
tools/check-art.py <Mod>
```

Checks `<UpdateArt>` fires in both scopes, the `.dep` parses, the `.blp`s and `SHARED_DATA/`
exist, the deployed copy matches the repo, and reads `ArtDef.log` for the mount.

| `ArtDef.log` line | Means |
|---|---|
| `Loading Package: .../<Group>/.../StandardAsset.blp` | mounted - success |
| `Queue Package` with no `Loading Package` | queued and rejected; package is broken |
| `not found in the package info` | `.blp` and `.dep` disagree; rebuild both |
| no mention of the group | `<UpdateArt>` never fired, or the game was not restarted |
| `Branch/Local override package directory ... does not exist` | harmless, every package logs it |

**Civ 7 logs packages, not assets.** No log line anywhere names a mesh, material or texture
asset - verified by grepping every log in `Logs/` for our own asset names: zero hits, across
1171 package lines. A mount therefore proves the package loaded and nothing more. The model
itself can only be confirmed by building it in game and looking: grounding (no sinking or
floating), hex footprint, normal direction, specular on curved surfaces.

`UI.log`'s `Failed loading resource: blp:<name>` is a different layer - 2D UI textures.

## 7. State of the shipped Hagia Sophia

What ships now is the **route B** asset - Blue Mosque geometry, minarets removed, domes
recoloured imperial red, gold cross added (`src/create_alt_hagia_sophia.py`). The route A
procedural model (`src/hagia_sophia.py`) is kept as the alternative; its generator still
runs, but `export/hagia_sophia.glb` now holds the route B mesh.

Verified 2026-09-09 against the deployed package:

| | |
|---|---|
| Geometry | 111,118 verts, 46,750 tris, 1 mesh / 1 primitive / 1 material |
| Bounds | `[-9.39, -13.8, 0.0, 9.39, 13.8, 18.5]` - footprint 18.8 × 27.6, height 18.5 |
| Contract | passes `check_glb.py --scale 1.0` on every hard check |
| Manifest | guards clean; `StandardAsset.blp` and `Material.blp` both validate |
| In game | package **mounts**; the model has never been confirmed to render |

Open items:

1. **The normal map has 1 mip; BaseColor and ORM have 12.** `make_normal_dds.py` writes only
   the base level, so expect shimmering at distance. (The earlier BaseColor sRGB defect -
   shipping as `BC1_UNORM` 71 instead of `BC1_UNORM_SRGB` 72 - **is fixed**; it now reports
   72. `check_dds.py` guards both.)
2. **46,750 triangles is heavy** for something drawn at ~150 px on a hex - about 11× the
   procedural version. Fine if it performs; worth measuring before adding more wonders this
   way.
3. **It still reads as the Blue Mosque.** The rectangular courtyard plan is the donor's, not
   Justinian's. That is the standing trade-off of route B, not a bug.

## 8. Reading geometry back out of a shipped package

The reverse of `import_gltf.py`, with no supplied tool. Reference implementation:
`3d_art/src/extract_blue_mosque_submeshes.py`.

Open the donor `StandardAsset.blp` with `civ7_art_studio.blp.blp.BLP` and walk its allocs
for typename `AssetPackage_Geometry_Mesh_Lod5`. Each alloc's raw bytes are an array of
**56-byte submesh records**:

| Offset | Type | Field |
|---|---|---|
| +0 | `uint64` | pointer to the GPU-buffer alloc; its name is a string at +8 in that alloc |
| +16 | `uint32` | material name hash |
| +20 | `uint32` | vertex byte offset into the buffer |
| +24 | `uint16` | vertex stride (20 for static meshes) |
| +28 | `uint32` | primitive (triangle) count |
| +32 | `uint32` | min index |
| +36 | `uint32` | max index |
| +40 | `uint32` | index start, **in 4-byte words** - multiply by 4 for the byte offset |

Keep the records whose GPU-buffer name matches the asset you want, then read
`SHARED_DATA/GB_<NAME>_MB`. **The blob has a 16-byte header**; the payload starts at 16.

Per vertex, at `v_off + i * v_stride`: position is `<3e` (three `float16`) at +0, UV is
`<2e` at +12 - the stride-20 layout from §2. Indices are `uint32` at `idx_start * 4`,
`prim_count * 3` of them.

**Submeshes come in LOD pairs.** Consecutive records sharing a vertex offset are the same
surface at two detail levels; take the one with the higher `prim_count` or you export the
low-poly LOD. Some pairs are exact duplicates - dedupe on `(v_off, prim_count, idx_start)`.

Write each submesh as its own named OBJ group (`o submesh_07_mat_0x...`). Deleting a minaret
then means deleting a named object, not a lasso selection. Watch for terrain skirts - they
are ordinary submeshes and leave stray flanges if kept.

Licence: this reads Firaxis art out of the user's own game install. Fine for a local mod
that requires the DLC; do not redistribute the extracted geometry.

## Corrections

Things this repo's own docs got wrong, so the mistake is not repeated:

- `plan.md` step 6 documented `civart build --project X --no-browser`. **No such command
  exists**; `civart` only serves the web UI.
- `plan.md` step 2 recommends `texconv`, which is Windows-only. The DDS here were written
  by hand-rolled encoders in `3d_art/src/`; that path works but is what produced issues 1
  and 2 above.
- `tools/check-art.py --asset NAME` originally grepped `ArtDef.log`, which never contains
  asset names, so it always reported failure. It now searches every log and reports honestly
  that absence proves nothing.
- `check_glb.py` defaults to `--scale 10.0`, which is right only for geometry modelled in
  Blender metres. Extracted geometry is already in game units and needs `--scale 1.0`;
  running the default on it reports a 187-unit footprint and a spurious failure.
