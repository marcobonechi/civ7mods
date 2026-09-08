# Byzantium art plan

Status: the three requested pieces (Hagia Sophia, Dromon, Cataphract) are delivered as vector
art under `Byzantium/icons/src/` with 256² renders in `icons/`, `icons-mixed/` and
`icons-vector/` (the portrait PNGs are imported by the modinfo but not yet shown anywhere: see
the portrait item in §3). 3D decisions taken 2026-09-07: Hagia Sophia = Blue Mosque
(`WONDER_SULTANAHMET_CAMII`) when the Ottomans DLC is in use, Notre Dame otherwise; Cataphract =
Mongol Keshig line (Marco asked for the Scythia mod's amazon horse archer, which is itself a
Keshig remap, so the base unit is used directly and no Workshop dependency is added); Dromon =
Treasure Fleet hull (a civilian model; if attack animations are missing in game, fall back to
`UNIT_GALLEON`). The Blue Mosque override reuses the remap ID in `visual-remaps-ottomans.xml`
with `LoadOrder` 20; first in-game check confirms whether the later file wins. Remaining
**Decide** items: unit-panel portraits (§3) and civic glyphs (§5).

## 1. What a mod can actually ship (learned from the Workshop examples)

Eighteen subscribed mods were read. None ships a new 3D model, texture or animation: those live
in Firaxis `.blp` packages (`DLC/bulgaria/Platforms/Mac/BLPs/*.blp`) that only the official
tools can build. Community civs therefore use exactly three kinds of art:

| Kind | Mechanism | Example |
|---|---|---|
| Loose 2D PNGs | `ImportFiles` + `IconDefinitions` rows, addressed `fs://game/<modid>/<file>` | Austria-Hungary `icons/images.sql`, `assets/` |
| Borrowed 3D models | `VisualRemaps` (whole unit/building swap, what we do today) | Firaxis founder-edition scout/palace |
| Placed 3D props | `WorldUI.createModelGroup` from a UI script; the base asset stays underneath | Austria-Hungary `ui/polder_model.js`, Custom Civ Art Fixes `remap/` tables |

Two UI-side fixes are needed because the create-game screens build image names by convention
(`bg-panel-<civ>`, `bg_panel_<civ>.png`, `bg-card-<civ>`, `civ_sym_<civ>`) and feed them to
package lookups (`blp:`) or to `WorldUI.addBackgroundLayer`, which cannot take a PNG:

- Custom Civ Art Fixes (`custom-civ-art-fixes`) wraps `WorldUI.addBackgroundLayer` and
  `CSSStyleDeclaration.prototype.setProperty`, shows a DOM overlay div with the PNG, strips the
  `blp:` prefix from `blp:fs://...` values, and reads a config table `CivsWithoutBackgrounds`.
- Civilization Background Framework does the same with a `window.registerCustomCivBackground`
  API and also honours `CivsWithoutBackgrounds` when the table exists.

Our `ui/byzantium-images.js` only rewrites inline `background-image` after the fact, which is
why the panel, card and vertical images are still missing. It needs the same two hooks.

Reference sizes (Austria-Hungary, which displays correctly): civ symbol 256², unit and
building icons 256², `cult_<civ>` 256², `bg-card` 720×1080, `bg-panel` 1301×732, loading
1920×1080 and 1280×720.

## 2. Slot inventory

| Slot | Shown where | Size | Status |
|---|---|---|---|
| `civ_sym_byzantium` | picker, diplomacy, flags | 256² | done (mixed set) |
| Unit flags Cataphract / Dromon | flags, tech tree, picker items | 128² → **256²** | redone at 256 in this pass |
| Building icons Hippodrome / Great Palace | production list, picker | 128² | done; re-render at 256 recommended |
| Wonder icon Hagia Sophia | production list, civilopedia, wonder list | 128² → **256²** | redone, new painterly design |
| Loading painting 1080 / 720 | loading screen | done, not displayed | fix with hooks (§4) |
| Vertical card `bg-card` | civ detail panel | 720×1080 | file done, not displayed | 
| Panel `bg-panel` | picker background, age transition | 1301×732 | file done, not displayed |
| Civic tree icons `cult_*` | civic tree nodes | 256² white glyph | base glyphs reused; custom ones need a hook (§5) |
| Unit 3D model | map, unit panel portrait | – | borrowed via `VisualRemaps` (§3) |
| Wonder / building 3D | map, wonder-complete cinematic | – | Notre Dame / Pavilion / Guildhall (§3) |
| Wonder quote | wonder-complete placard | text | done (`TypeQuotes` row in `constructibles.xml`) |
| Unit portrait | unit panel, army panel | live 3D render of the borrowed model | optional 2D override (§3) |

## 3. Proposals for the three requested pieces

### Hagia Sophia (wonder)

- **Icon**: new 256² vector painting: the great dome on its drum of forty windows, two
  half-domes, buttress towers, warm terracotta walls and a lead-grey dome, gold cross, no
  minarets (the Justinianic church). Delivered as `icons/src/wondericon_hagia_sophia.svg`.
- **3D model** (Decide):
  1. Keep `WONDER_NOTRE_DAME` (base game, always available, but Gothic).
  2. **Recommended**: `WONDER_SULTANAHMET_CAMII` (the Blue Mosque, Ottomans DLC) inside the
     existing `ottomans-current` action group, Notre Dame as the fallback when the DLC is off.
     It is the closest silhouette in the game: central dome, cascading half-domes, same skyline.
     Needs one in-game check that a second `VisualRemaps` row for the same `From` overrides
     the first (otherwise the always-on row moves to a `not-ottomans` group).
  3. `WONDER_HOUSE_OF_WISDOM` (base, Abbasid domed hall) if a dome without minarets matters more
     than scale.
- **Wonder-complete cinematic**: the placard reads `TypeQuotes`; our row already exists, so
  the cinematic shows the borrowed model with the Hagia Sophia name and quote.
- **Painted version** for the civilopedia/loading art: prompt in §6.

### Dromon (naval unit)

- **Flag icon**: the existing silhouette (lateen sail, oars, ram, Greek-fire siphon) re-rendered
  at 256². Full-colour portrait (dusk over the Bosporus, Greek fire at the bow) delivered as
  `icons/src/portrait_dromon.svg` and `icons/portrait_dromon.png`.
- **3D model** (Decide): today `UNIT_COG`, a round-hulled sailing cog, wrong for an oared galley.
  1. **Recommended**: `UNIT_KALAM` (Chola oared warship, base game): oars, a low hull, a fighting
     platform; the closest galley in the Exploration age.
  2. `UNIT_CETBANG` (Majapahit gun-armed jong): bigger, cannons, less accurate.
  3. `UNIT_VIKINGR` (Iceland DLC longship): oars and a single square sail; would need a DLC group.
  Antiquity tier stays `UNIT_GALLEY`.

### Cataphract (heavy cavalry, three tiers)

- **Flag icon**: existing silhouette (armoured rider, chamfron, scalloped barding, lance) at 256².
  Full-colour portrait (lamellar klibanion, scale barding, purple Chi-Rho saddle cloth) delivered
  as `icons/src/portrait_cataphract.svg` and `icons/portrait_cataphract.png`.
- **3D model** (Decide): today Courser → Knight → Lancer (base European line; tier 1 is a light,
  unarmoured courser, which reads wrong for a cataphract).
  1. **Recommended**: `UNIT_MAMLUK`, `UNIT_MAMLUK_2`, `UNIT_MAMLUK_3` (Abbasid heavy cavalry:
     lamellar armour, armoured horse, lance) for all three tiers. Same movement class, so no
     animation mismatch.
  2. `UNIT_CHEVALER` line (Norman knight, mail and kite shield).
  3. Keep Knight for tier 2 and 3 and use Mamluk only for tier 1.
  Antiquity tier stays `UNIT_HORSEMAN`.

### Unit portraits (both units, Decide)

The unit panel calls `WorldUI.requestPortrait(unitType)` and shows `live:/UNIT_CATAPHRACT`; the
engine renders the remapped model, so a Mamluk or Kalam will appear. If a Byzantine look is
wanted there, a ten-line UI script can wrap `requestPortrait` and set the panel's background to
our painted portrait instead (this is what `ml-unit-portrait-fix` does with a whole-panel
replacement; wrapping is lighter and has no dependency). The portrait SVGs delivered here are
drawn for that slot (square, dark vignette, unit facing right).

## 4. Backgrounds that still do not show (loading, card, panel)

Rewrite `ui/byzantium-images.js` along the lines of the two frameworks, dependency-free:

1. Wrap `WorldUI.addBackgroundLayer(texture, params)`: when `texture` is `bg-panel-byzantium`,
   show a fixed, `z-index:-1`, `background-size:cover` overlay div with our PNG (honouring
   `params.offset`, `params.size`, `params.alpha`) and do not call the original; wrap
   `WorldUI.clearBackground` to hide it.
2. Wrap `CSSStyleDeclaration.prototype.setProperty` for `background-image`/`background`: turn
   `blp:fs://…` into `fs://…`, and `blp:bg_panel_byzantium(.png)`, `blp:bg-card-byzantium`,
   `blp:civ_sym_byzantium`, `blp:lsbg_byzantium_vert` into our URLs. Keep the mutation
   observer for nodes that arrive with inline styles, plus `<img src>`.
3. Keep the `BACKGROUND_VERT` icon row as an `fs://` path (hook 2 strips the `blp:` the UI
   prepends).
4. Ship `data/civ-art-fixes.sql` in shell and game scope with `LoadOrder` 10:
   `CREATE TABLE IF NOT EXISTS CivsWithoutBackgrounds(...)` plus our row, so both Workshop
   frameworks recognise Byzantium when a player has them, and nothing breaks when they do not.

Gate: picker shows the square panel behind the civ list, the vertical card on the detail
panel, the painting on the loading screen; `UI.log` has no `blp:bg-panel-byzantium` misses.

## 5. Civic tree glyphs (Decide)

The three unique civics reuse base glyphs (`cult_authority`, `cult_theology`,
`cult_sovereignty`) because the tree only resolves `IconString` under
`base-standard/ui/icons/culture_icons/`. Custom glyphs (a themata shield, a five-domed
pentarchy, a purple-born cradle) need a 256² white PNG each plus a wrapper on
`Icon.getCultureIconFromProgressionTreeNodeDefinition` returning `UI.getIconURL("cult_byzantium_<x>")`,
the technique Custom Civ Art Fixes uses for the shared anachronistic node. Half a day; optional.

## 6. Prompts for painted versions (Marco's image generator)

Style line for all: *"Sid Meier's Civilization VII concept painting, loose oil brushwork,
warm desaturated palette, soft rim light, no text, no watermark."*

- Hagia Sophia (wonder illustration, 16:9): "The Hagia Sophia in sixth-century Constantinople
  seen from the Sea of Marmara at golden hour: a vast shallow lead dome over a ring of forty
  windows, two great half-domes stepping down, brick and marble walls with buttress towers, a
  gilded cross on top, no minarets, terraced gardens and the Hippodrome behind, dromons in the
  water below."
- Cataphract (unit portrait, square): "A Byzantine cataphract of the tenth century, rider and
  horse fully armoured in lamellar and mail, iron chamfron on the horse, kontos lance held
  upright, purple and gold saddle cloth with a Chi-Rho, three-quarter view from the front left,
  dark smoky background, dramatic side light."
- Dromon (unit portrait, square): "A Byzantine dromon war galley under a lateen sail, two banks
  of oars, bronze siphon at the bow spouting Greek fire, a raised fighting castle, Imperial
  eagle banner, cutting through dark green Bosporus water, low sun behind the sail."
- Civic glyphs: "Flat white icon on black, single bold silhouette, no gradients, Civilization
  VII civic icon style" + shield of a theme soldier / five domes in a ring / a crowned cradle.

## 7. Work order

1. Plan review (this document).
2. Icons: render the new 256² set (`tools/icon-render`), update `icons-vector`/`icons`,
   `icons.xml` gets the portrait rows if §3 portraits are adopted.
3. `VisualRemaps` changes per the decisions in §3, `TypeQuotes` row, in-game check of the
   Ottomans override.
4. Background hooks (§4) and the `CivsWithoutBackgrounds` SQL; in-game check.
5. Optional: portrait override script, civic glyphs and hook, painted images from §6 dropped
   into `Byzantium/loading/` and `Byzantium/icons/`.
6. Update `.claude/skills/new-civilization/reference.md` with §1 and §4 so the next civ starts
   from a working art pipeline.

## 8. Civ Art Tools (Smayo, CivFanatics resource 32918, v1.0 of 2026-08-21)

Investigated 2026-09-07 from the source in `civ7-art-studio.zip` (Python 3.11+, MIT,
starlette + uvicorn web app on 127.0.0.1:8765, plus a Windows-only PyInstaller exe).
What it is: a manifest-driven builder for the game's own binary art packages
(`CIVBLP` files). It copies a donor package's type registry from a shipped DLC and emits
new entries: building bin modifiers, improvement and wonder region assets with attachment
sets copied from a shipped asset, unit metadata assets whose members point at another
unit's members, material clones of shipped models, UI textures, static glTF meshes, and
Wwise sound banks. Output is `built/DLC/<name>/` (`.dep` + `Platforms/<OS>/BLPs/*.blp`
+ `SHARED_DATA/` blobs) and `built/Mods/<name>/` (a modinfo with `<UpdateArt>` in both
scopes). The DLC half must be copied into the game install's `DLC/` folder by hand; the
engine never looks for art packages in the user Mods folder, so Workshop distribution
is impossible and the Mods half is only the switch that turns the art group on.

What it would give Byzantium beyond `VisualRemaps`: Hagia Sophia as a real wonder asset
(attachments copied from the Blue Mosque, terrain flattening, placement sound) under our
own type, so no Ottomans-DLC condition; Hippodrome and Great Palace bound to any shipped
building art with correct pillage and construction states; a Byzantine-coloured copy of
a shipped unit or banner model (clone + new material); UI textures such as the panel and
card images shipped as package textures, which would make the naming-convention lookups
resolve without any UI script. Custom rigged units are not possible (meshes only, no
armatures or animations); audio needs Wwise 2022.1 on Windows.

Mac status: the package format is platform-independent (its parser reads
`DLC/bulgaria/Platforms/Mac/BLPs/StandardAsset.blp` correctly), but the code hard-codes
`Platforms/Windows` in about twelve places for both donor discovery and output. A
one-line constant swap to `Mac` is needed and untested; BC7 DDS input needs an encoder
that exists on macOS (Compressonator CLI or `bc7enc`), and the shipped exe is Windows.
Done 2026-09-08: the tool runs on the Mac with seven `Platforms/Windows` → `Platforms/Mac`
edits (`gameinfo.py`, `project.py`, `blp/donors.py`, `blp/sync_blobs.py`,
`blp/build_material_blp.py`, `blp/build_blp.py`, `importers.py`), started with
`CIV7_GAME_ROOT=<Resources folder> civart --no-browser --port 8770`. The asset index built in
two seconds. Project `ByzantiumArt`, one wonder entry: asset `WONDER_Byzantium_Hagia_Sophia`,
type `WONDER_HAGIA_SOPHIA`, the seven attachments of `WONDER_Sultan_Ahmet_Camii`
(`BIN_WON_Sultan_Ahmet_Camii` plus six road decals), base layer `TER_EDIT_Flatten_Hex`. Donor
`DLC/asia-wonders` StandardAsset. Output committed as `Byzantium/dlc/ByzantiumArt/` (91 KB
package, both platform folder names) with the manifest in `Byzantium/dlc/civart.json`; the
wonder `VisualRemaps` rows and the Ottomans override file are gone, `<UpdateArt>` is in both
modinfo scopes, the install scripts mirror `dlc/*` into the game's `DLC/`. The bin lives in the
Ottomans DLC package, so the wonder renders only while that DLC is enabled. In-game check
pending. Pitfall met: `POST /api/manifest` wants `{"project": <manifest>}`; posting the bare
manifest replaces it with its own metadata block.
