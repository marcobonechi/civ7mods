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

## 7. Known issues in the shipped Hagia Sophia

Found by audit on 2026-09-09, **not yet fixed** - they need a re-encode plus a package
rebuild and redeploy:

1. **BaseColor ships as `BC1_UNORM` (71), not `BC1_UNORM_SRGB` (72)** - the sRGB trap above.
   Expect the albedo to read too bright/washed. Fix: re-encode `hagia_sophia_B.dds` with a
   DX10 header declaring 72, re-run `make_texture.py`, rebuild, redeploy.
2. **The normal map has 1 mip; BaseColor and ORM have 12.** `make_normal_dds.py` writes only
   the base level. Expect shimmering at distance.
3. **The wonder has never been confirmed to render.** The package mounts, but nothing has
   requested the asset yet, and mounting is not rendering.

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
