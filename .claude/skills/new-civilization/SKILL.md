---
name: new-civilization
description: Add a new playable civilization to the civ7mods repository as its own Civilization VII mod folder (data XML, shell config, text, icons, visual remaps, true start on the Europe maps). Use when asked to create, scaffold, or extend a Civ 7 civilization mod.
---

# New civilization mod

Builds a civilization the way Firaxis ships one: a self-contained mod folder next to
`EuropeMediterranean/`, modelled on the Bulgaria DLC (Exploration Age, small, no bespoke
art). Read `reference.md` in this folder for the table-by-table details and pitfalls, and
`plans/byzantium.md` for a worked example.

## Ground truth to consult first

- Game data (macOS Steam):
  `~/Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources/`
  - `Base/modules/{core,base-standard,age-antiquity,age-exploration,age-modern}` base game
  - `DLC/bulgaria/modules` best template for an Exploration civ (`config/`, `data/`, `text/`)
  - `Base/Assets/schema/gameplay/01_GameplaySchema.sql` gameplay tables and columns
  - `Base/Assets/schema/frontend/schema-frontend-50-setup-data.sql` shell (game setup) tables
  - `Base/modules/core/config/config-schema.sql` extra shell tables (CivilizationItems, Traditions ...)
- Logs: `~/Library/Application Support/Civilization VII/Logs/` (`Database.log`, `Modding.log`).
- Mods folder: `~/Library/Application Support/Civilization VII/Mods/<ModFolder>/<id>.modinfo`.
  The game reads mods at startup only.

Never invent a table, column, effect, requirement or modifier id. Grep it in the base
modules first and copy a working row.

## Procedure

1. **Design sheet.** Decide: id (`CIVILIZATION_X`, `TRAIT_X`, `TRAIT_X_ABILITY`), apex age,
   two attribute tags, ability (2 or 3 effects), unique units (a 3-tier line replacing a base
   line, plus optionally a second unit or commander), unique quarter (two buildings), associated
   wonder, three civic nodes with three traditions, city list (30), citizen names (10+10),
   unlocks (which Antiquity civs and leaders unlock it; which Modern civ it unlocks), true start
   coordinates for the Europe maps. Write it into `plans/<civ>.md` before touching XML.
2. **Scaffold the folder** `<Civ>/` with `<civ>.modinfo`, `config/`, `data/`, `text/en_us/`,
   `icons/`. Copy the Bulgaria modinfo action-group layout (see reference.md, section 2) and
   drop the movie, l10n and metaprogression groups.
3. **Identity first** (`civilizations-legacy.xml`, `civilizations-shared.xml`, `config/config.xml`,
   `CivilizationText`, `CivilizationLegacyText`, `CityNamesText`, `ModuleText`, `icons.xml`,
   a civ symbol PNG). Install, launch, confirm: no errors in `Database.log`, civ visible in
   game setup for its age, game starts, start position correct on the Europe map
   (`Europe map: start for player N (CIVILIZATION_X) ... TSL` in the game console log).
4. **Units** (`units.xml`, `units-gameeffects.xml`, `progression-trees-tech.xml`,
   `data/visual-remaps.xml`). Every custom unit needs a `VisualRemaps` row pointing at an
   existing unit's art or it renders without a model. Verify in game.
5. **Buildings, quarter, wonder** under the `exploration-age-persist` group so they survive
   into the next age. Then the civic tree and traditions (shell copies of traditions and civic
   nodes go in `config/config-traditions.xml`).
6. **Other ages.** Add `Civilizations` rows for the other two domains in `config/config.xml`
   if the civ must be pickable at an Antiquity or Modern start; add a node to
   `TREE_CIVICS_AQ_TEST_OF_TIME` / `TREE_CIVICS_MO_TEST_OF_TIME`; add per-age unit variants
   if wanted. The engine adds `TRAIT_ANACHRONISTIC_CIV` automatically (base-standard
   `ages-post-process.sql`), so baseline age modifiers are handled.
7. **Unlocks** (`unlocks-*.xml`): the civ's own unlock, the leader and civ requirement sets,
   and the Modern civ it unlocks. Guard DLC-only rows with `ModInUse` criteria.
8. **True start.** Add `CIVILIZATION_X: [lon, lat]` to `tsl` in every geo file under
   `EuropeMediterranean/maps/` and check spacing against neighbours.
9. **Polish**: civilopedia history text, loading screen text, citizen names, favoured wonder,
   AI biases. Then README section, version bump, commit with jj, push, tag.

## Checks before every install

```bash
find <Civ> -name '*.xml' -exec xmllint --noout {} +
python3 tools/check-mod.py <Civ>      # LOC tags and type references (see reference.md)
./install.sh && open -a "Sid Meier's Civilization VII"
grep -n -i "error\|failed\|constraint" ~/Library/Application\ Support/Civilization\ VII/Logs/Database.log
```

A file with one bad foreign key is rejected as a whole; the log names the file.
