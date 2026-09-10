# Civilization VII 3D Model Creation Pipeline & Plan

This document details the architecture, constraints, toolchain, and end-to-end workflow for creating and integrating custom 3D models (wonders, buildings, tile improvements, static props, and attachments) into **Sid Meier's Civilization VII**.

---

## 1. Engine Constraints & Architecture

### What the Engine Can and Cannot Load
* **The DLC Folder Rule**: Civ 7's engine does **not** load binary art packages (`.blp`, `.dep`, `SHARED_DATA`) from the user's `Mods/` directory. All custom binary packages must be deployed to the game install's `DLC/` directory:
  ```
  <CIV7_GAME_ROOT>/DLC/<ArtGroupName>/Platforms/<Windows|Mac>/BLPs/*.blp
  <CIV7_GAME_ROOT>/DLC/<ArtGroupName>/Platforms/<Windows|Mac>/BLPs/SHARED_DATA/
  <CIV7_GAME_ROOT>/DLC/<ArtGroupName>/<ArtGroupName>.dep
  ```
* **The Modinfo Trigger**: The mod in `Mods/<ModName>/` only acts as the switch that turns the art group on:
  ```xml
  <ActionGroup id="game-art" scope="game">
      <Actions>
          <UpdateArt><Item>ByzantiumArt</Item></UpdateArt>
      </Actions>
  </ActionGroup>
  <ActionGroup id="shell-art" scope="shell">
      <Actions>
          <UpdateArt><Item>ByzantiumArt</Item></UpdateArt>
      </Actions>
  </ActionGroup>
  ```
* **Current Asset Support in Community Tools (`civart` / `civ7-art-studio`)**:
  * **Supported**: Static geometry meshes (`AssetPackage_Geometry_Mesh2`), material clones, custom PBR textures, wonder region assets with attachments, building bin modifiers (`BIN_Hero_Building_Footprint`), improvement placements, terrain decals, road attachments, and flattening hex modifiers (`TER_EDIT_Flatten_Hex`).
  * **Supported for Units**: Unit member swaps (replacing weapons, shields, banners, or swapping to another unit's rigged member).
  * **Not Supported**: Custom rigged skeletons and bone animations (skinned characters). Custom armatures require vertex components `0x2` and stride 28, which are not yet fully decoded.

---

## 2. Geometry Specifications

### Coordinates & Scale
* **Coordinate System**: The engine is **Z-up, right-handed**.
  * Blender is natively Z-up. When exporting to standard glTF (`.glb`), glTF is Y-up. The conversion script (`import_gltf.py`) maps `(x, y, z) -> (x, -z, y)`.
* **Scale Ratio**:
  * $1\text{ game unit} \approx 0.1\text{ meter}$ ($10\text{ cm}$).
  * A standard human character in Civ 7 is $\sim 18\text{--}19\text{ units}$ tall ($\sim 1.8\text{--}1.9\text{ m}$).
  * An $8\text{-unit}$ cube is knee-height.
  * When modeling in Blender (working in meters), export with a scale factor of **10.0** (or apply scale 10 during conversion).
* **Tile Footprint & Grounding**:
  * A hex tile has an outer radius of $\sim 12\text{--}14\text{ units}$.
  * The model must be horizontally centered on the origin ($X=0, Y=0$).
  * The lowest vertices of the base must sit exactly on the ground plane ($Z = 0.0$). Models centered on origin in Blender need grounding so they do not sink underground.

### Vertex & Buffer Layout
The game GPU vertex buffer layout uses stride 20 (`eVertexComponents = 0x0009`, `eCompression = 1`):
* `+0`: `float16` $\times 3$ position $(x, y, z) + 2\text{ bytes pad}$ ($8\text{ bytes}$)
* `+8`: `uint8` $\times 4$ packed normal (normalized $(n \times 0.5 + 0.5) \times 255$) ($4\text{ bytes}$)
* `+12`: `float16` $\times 2$ UV coordinates ($4\text{ bytes}$)
* `+16`: `float16` $\times 2$ UV2 coordinates ($4\text{ bytes}$, mirrors UV1)
* **Indices**: 32-bit unsigned integers (`uint32`, stride 4 bytes) for triangle indices.

---

## 3. Materials & Texture Specifications

Civ 7 uses a PBR workflow packaged as DirectDraw Surface (DDS) textures wrapped in `CIVBIG` blobs (`type = 1`):

| Map Type | Texture Format | DXGI Format | Channels / Usage |
|---|---|---|---|
| **Base Color / Albedo** | `BC1_UNORM_SRGB` or `BC7_UNORM_SRGB` | Format 72 / 98 | RGB Diffuse / Albedo color |
| **Normal Map** | `BC5_UNORM` | Format 83 | 2-channel Tangent Normal (R=X, G=Y; Z reconstructed in shader) |
| **ORM** | `BC1_UNORM` | Format 71 | R = Ambient Occlusion, G = Roughness, B = Metallic |
| **Tint / Mask** | `BC4_UNORM` | Format 80 | Single-channel grayscale mask for player/civ colors or opacity |

Texture blobs are stored in `Platforms/<OS>/BLPs/SHARED_DATA/` with names matching `TEXTURE_<NAME>`. Uncompressed payload flags are `0x82` (no proprietary Oodle compressor required).

---

## 4. End-to-End Workflow

### Step 1: Modeling in Blender
1. Set scene units to **Metric** (Length: Meters).
2. Model the geometry (wonder, building, or improvement).
3. Ensure horizontal center is at $(0, 0)$ and lowest base point is at $Z = 0.0$.
4. Check normals (face orientation pointing outwards).
5. Apply all transforms (`Ctrl + A` $\to$ All Transforms).
6. Unwrap UVs into the $0\text{--}1$ space.

### Step 2: Texture Baking & Compression
1. Bake or paint Albedo, Normal (DirectX Tangent), and ORM maps.
2. Compress images to DDS using `texconv` (DirectXTex) or AMD Compressonator.
   **`texconv` is Windows-only**; on macOS this repo used hand-rolled encoders in
   `3d_art/src/`. Whatever writes them, verify the result with
   `3d_art/src/check_dds.py` - a BaseColor written with a legacy `DXT1` FourCC ships as
   `BC1_UNORM` (71) rather than `BC1_UNORM_SRGB` (72) and renders with the wrong gamma,
   silently. Getting 72 needs a DX10 extended header.
   ```bash
   # BaseColor
   texconv -f BC1_UNORM_SRGB -m 10 -y -o dds/ basecolor.png
   # Normal map (two-channel BC5)
   texconv -f BC5_UNORM -m 10 -y -o dds/ normal.png
   # ORM (Occlusion, Roughness, Metallic)
   texconv -f BC1_UNORM -m 10 -y -o dds/ orm.png
   ```

### Step 3: Export to glTF (.glb)
In Blender: **File $\to$ Export $\to$ glTF 2.0 (.glb)**:
* **Format**: `glTF Binary (.glb)`
* **Include**: Selected Objects
* **Transform**: `+Y Up` checked
* **Geometry**:
  * Normals: **ON**
  * UVs: **ON**
  * Compression: **OFF** (no Draco)
  * Tangents: OFF

### Step 4: Convert to Civ 7 GPU Geometry & Texture Blobs
Using the conversion utilities in `civ7-art-studio`:
1. **Convert Geometry**:
   ```bash
   python3 civ7_art_studio/blp/import_gltf.py \
       my_wonder.glb \
       GB_MY_WONDER_MB \
       -o output/SHARED_DATA \
       --scale 10.0
   ```
   This outputs the vertex/index buffer payload to `output/SHARED_DATA/GB_MY_WONDER_MB` and prints the geometry manifest snippet:
   ```python
   dict(asset='MY_WONDER',
        buffer='GB_MY_WONDER_MB',
        buffer_size=105200,
        vertex_offset=0, vertex_count=3520,
        index_start=17600, primitive_count=4200,
        min_index=0, max_index=3519,
        bounds=(-12.5, -12.5, 0.0, 12.5, 12.5, 24.0),
        wrapper_scale=1.0)
   ```

2. **Convert Textures**:
   ```bash
   python3 civ7_art_studio/blp/make_texture.py dds/basecolor.dds MY_WONDER_B -o output/SHARED_DATA
   python3 civ7_art_studio/blp/make_texture.py dds/normal.dds MY_WONDER_N -o output/SHARED_DATA
   python3 civ7_art_studio/blp/make_texture.py dds/orm.dds MY_WONDER_ORM -o output/SHARED_DATA
   ```

### Step 5: Configure `civart.json`
Define the asset in the project manifest (e.g., `<Mod>/dlc/civart.json`):
```json
{
  "project": {
    "name": "MyModArt",
    "guid": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
    "displayName": "My Mod Art",
    "author": "marcob",
    "version": "1"
  },
  "meshes": [
    {
      "asset": "MESH_My_Wonder",
      "buffer": "GB_MY_WONDER_MB",
      "buffer_size": 105200,
      "vertex_offset": 0,
      "vertex_count": 3520,
      "index_start": 17600,
      "primitive_count": 4200,
      "min_index": 0,
      "max_index": 3519,
      "bounds": [-12.5, -12.5, 0.0, 12.5, 12.5, 24.0],
      "wrapper_scale": 1.0,
      "material": "MY_WONDER_MATERIAL"
    }
  ],
  "wonders": [
    {
      "asset": "WONDER_My_Wonder",
      "type": "WONDER_MY_WONDER",
      "attachments": [
        [ "main", "MESH_My_Wonder", 0.0 ],
        [ "Road_CP_E", "BIN_TER_Decal_Road_CP_Straight_Short_A", 0.0 ],
        [ "Road_CP_W", "BIN_TER_Decal_Road_CP_Straight_Short_A", -3.141592 ]
      ],
      "hexes": {},
      "baseLayer": "TER_EDIT_Flatten_Hex"
    }
  ],
  "buildings": [
    {
      "target": "BIN_My_Building_Scaled",
      "expression": "[BUILDING:BUILDING_MY_BUILDING]",
      "priority": 1,
      "weight": 1.0
    }
  ]
}
```

### Step 6: Build Package with `civart`

> **Correction (2026-09-09).** There is no `civart build` subcommand. `civart` only starts
> the web UI (`civart [--host H] [--port N] [--no-browser]`). Build programmatically with
> `civ7_art_studio.build.build(project, game_root)`, or with the per-package CLIs under
> `tools/civ7-art-studio/civ7_art_studio/blp/` (`build_blp.py`, `validate.py`). Note that
> `build()` writes to `<project>/built/DLC/<name>/Platforms/Windows/BLPs`, which is not the
> repo's `<Mod>/dlc/<Group>/Platforms/{Mac,Windows}/` layout - both platform trees have to
> be populated afterwards.

The build compiles `StandardAsset.blp`, `Material.blp`, `.dep`, and places the GPU buffers into `SHARED_DATA/` under `<Mod>/dlc/MyModArt/Platforms/Mac/` and `Platforms/Windows/`.

### Step 7: Deployment & In-Game Test
1. Mirror DLC assets to the game root:
   ```bash
   ./install.sh <ModName>
   ```
2. Verify logs in `~/Library/Application Support/Sid Meier's Civilization VII/Logs/`:
   * `UI.log`: check for any `Failed loading resource: blp:...`
   * `Art.log` / `Graphics.log`: verify package mount and asset resolution.
3. In-game check:
   * Inspect wonder/building placement on the map.
   * Verify lighting response, normal direction, specular reflections, and hex footprint boundaries.

---

## 5. Summary Reference Table

| Step | Input | Tool / Command | Output | Target Location |
|---|---|---|---|---|
| **1. Model** | Reference art / blueprints | Blender (Z-up, scale 10) | `.blend` | `3d_art/src/` |
| **2. Textures** | PBR textures (PNG/TGA) | `texconv` / Compressonator | `.dds` (BC1, BC5, BC4) | `3d_art/dds/` |
| **3. Export** | Blender mesh | glTF 2.0 Binary exporter | `.glb` | `3d_art/export/` |
| **4. Geometry** | `.glb` | `python3 import_gltf.py` | `GB_*_MB` buffer blob | `<Mod>/dlc/<Art>/Platforms/*/BLPs/SHARED_DATA/` |
| **5. Textures Blob** | `.dds` | `python3 make_texture.py` | `TEXTURE_*` blob | `<Mod>/dlc/<Art>/Platforms/*/BLPs/SHARED_DATA/` |
| **6. Build Package**| `civart.json` | `civart build` | `.blp` & `.dep` | `<Mod>/dlc/<Art>/` |
| **7. Install** | Built DLC & Mod | `./install.sh <Mod>` | Mirrored files | `<CIV7_GAME_ROOT>/DLC/` & `Mods/` |
