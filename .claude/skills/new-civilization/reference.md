# Civilization mod reference

Everything below was read from the installed game (Bulgaria DLC, base age modules, schema SQL)
on 2026-09-05. Paths are relative to
`.../CivilizationVII.app/Contents/Resources/` unless stated.

## 1. How the pieces fit

| Layer | Where it lives | What it does |
|---|---|---|
| Shell (game setup) | `config/*.xml`, `scope="shell"` | Makes the civ selectable, shows its items, leader suggestions, unlock tooltips. Tables from `schema-frontend-50-setup-data.sql` + `core/config/config-schema.sql`. |
| Game database | `data/*.xml`, `scope="game"` | The civ, traits, units, buildings, traditions, civic tree, unlocks. Tables from `01_GameplaySchema.sql`. |
| Game effects | `data/*-gameeffects.xml` (`<GameEffects xmlns="GameEffects">`) | Modifiers: `<Modifier id collection effect>` with `<Argument>`, `<SubjectRequirements>`, `<OwnerRequirements>`, `<String context="Preview|Description">`. |
| Text | `text/en_us/*.xml` (`<Database><EnglishText><Row Tag>`) | Loaded in both scopes via `UpdateText`. |
| Icons | `data/icons/icons.xml` (`<IconDefinitions><Row><ID/><Path/>`), `UpdateIcons` | ID = the type name. Path `blp:name` for shipped art, `fs://game/<modid>/<path>.png` for files brought in with `ImportFiles`. |
| Visuals | `data/visual-remaps.xml`, `UpdateVisualRemaps` (game and shell) | `<VisualRemaps><Row><ID/><DisplayName/><Kind>UNIT|BUILDING|ART_BIN</Kind><From/><To/>` — `From` is your type, `To` the existing type whose model is used. Firaxis uses it for the Founder-edition scout/palace. Community tooling (izica/civ7-modding-tools `visualRemap`) uses it for custom units. Not verified in this repo yet: confirm in game the first time. |
| Age gating | `<ActionCriteria>` in the modinfo | `AgeInUse`, `ModInUse`, `ModIsEnabled`, `AlwaysMet`; a criteria with `any="true"` ORs its children. |
| Map | `EuropeMediterranean/maps/*-geo.js` `tsl` | True start per `CIVILIZATION_*`; keyed by the game-side type via `GameInfo.Civilizations.lookup`. |

Age domains in the shell: `Ages.PlayerCivilizationDomain` is `AntiquityAgeCivilizations`,
`ExplorationAgeCivilizations` or `ModernAgeCivilizations`. The civ list for a start age is the
`Civilizations` config rows in that domain (primary key is Domain + CivilizationType, so one civ
may sit in all three). The "Time-Tested Allowed" game option only widens *random* picks.

Game side, any civ whose `ApexAge` is not the active age receives `TRAIT_ANACHRONISTIC_CIV`
(`base-standard/data/ages-post-process.sql`), which carries the same baseline modifiers as
`TRAIT_ANTIQUITY_CIV` / `TRAIT_EXPLORATION_CIV` / `TRAIT_MODERN_CIV`. So an Exploration civ is
mechanically fine in any age; only its unique content needs per-age variants.

## 2. Modinfo skeleton (from `DLC/bulgaria/modules/bulgaria.modinfo`)

```xml
<Mod id="byzantium" version="1" xmlns="ModInfo">
  <Properties>
    <Name>LOC_MODULE_BYZANTIUM_NAME</Name>
    <Description>LOC_MODULE_BYZANTIUM_DESCRIPTION</Description>
    <Authors>Marco</Authors>
    <Package>Mod</Package>
    <Version>1</Version>
  </Properties>
  <Dependencies><Mod id="base-standard" title="LOC_MODULE_BASE_STANDARD_NAME"/></Dependencies>
  <References><Mod id="age-exploration" title="LOC_MODULE_AGE_EXPLORATION_NAME"/></References>
  <ActionCriteria>
    <Criteria id="always"><AlwaysMet/></Criteria>
    <Criteria id="antiquity-age-current"><AgeInUse>AGE_ANTIQUITY</AgeInUse></Criteria>
    <Criteria id="exploration-age-current"><AgeInUse>AGE_EXPLORATION</AgeInUse></Criteria>
    <Criteria id="modern-age-current"><AgeInUse>AGE_MODERN</AgeInUse></Criteria>
    <Criteria id="exploration-age-persist" any="true">
      <AgeInUse>AGE_EXPLORATION</AgeInUse><AgeInUse>AGE_MODERN</AgeInUse>
    </Criteria>
    <Criteria id="ottomans-current"><ModInUse>ottomans</ModInUse></Criteria>
    <Criteria id="ottomans-shell"><ModIsEnabled>ottomans</ModIsEnabled></Criteria>
  </ActionCriteria>
  <ActionGroups>
    <!-- game, always: ImportFiles (icons), UpdateIcons, UpdateVisualRemaps, UpdateText (all text),
         UpdateDatabase: civilizations-legacy, civilizations-shared(+gameeffects), traditions(+gameeffects),
         unlocks-*, citizen-names, named-places, loading-info -->
    <!-- game, antiquity-age-current: civilizations-antiquity, progression-trees-culture-unique-aq, units-antiquity(+gameeffects) -->
    <!-- game, exploration-age-current: civilizations-exploration(+gameeffects), units(+gameeffects),
         progression-trees-culture-unique, progression-trees-tech -->
    <!-- game, modern-age-current: civilizations-modern, progression-trees-culture-unique-mo -->
    <!-- game, exploration-age-persist: constructibles(+gameeffects), greatworks, traditions-persist(+gameeffects) -->
    <!-- game, ottomans-current: unlocks-ottomans -->
    <!-- shell, always: ImportFiles, UpdateIcons, UpdateVisualRemaps, UpdateDatabase: config/config.xml,
         config/config-traditions.xml, data/unlocks-syncretism.xml; UpdateText: the same text files -->
    <!-- shell, ottomans-shell: config/config-ottomans.xml -->
  </ActionGroups>
  <LocalizedText><File>text/en_us/ModuleText.xml</File></LocalizedText>
</Mod>
```

Rules of thumb Firaxis follows:
- A row that references a type only present in one age must be loaded under that age's
  criteria (Bulgaria moved `MOD_CIV_WONDER_PRODUCTION_BULGARIA` into the persist group because it
  names the wonder). A file with one unresolved foreign key is dropped entirely.
- `Types` rows come first in every file that introduces new type names.
- Use `<InsertOrIgnore>` for unlock rows that several files may define.

## 3. Tables per file (Bulgaria layout)

### `data/civilizations-legacy.xml` (always)
`Types` (`TRAIT_X` KIND_TRAIT, `CIVILIZATION_X` KIND_CIVILIZATION), `LegacyCivilizations`
(CivilizationType, Name, FullName, Adjective, Age), `LegacyCivilizationTraits`, `Traits`
(`TRAIT_X` InternalOnly).

### `data/civilizations-shared.xml` (always)
- `Types`: `TRAIT_X_ABILITY` KIND_TRAIT, any KIND_ABILITY used in all ages.
- `Civilizations`: CivilizationType, Name, FullName, Description, Adjective,
  StartingCivilizationLevelType=`CIVILIZATION_LEVEL_FULL_CIV`, ApexAge, CapitalName,
  RandomCityNameDepth (10), optional AITargetCityPercentage.
- `CivilizationFavoredWonders` (FavoredWonderType, FavoredWonderName).
- `Traits` (`TRAIT_X_ABILITY`, Name, Description, InternalOnly="true").
- `CivilizationTraits`: `TRAIT_<AGE>_CIV`, `TRAIT_X`, `TRAIT_X_ABILITY`, two attribute traits
  each with `_TOT_AQ` and `_TOT_MO` variants (`TRAIT_ATTRIBUTE_{CULTURAL,ECONOMIC,EXPANSIONIST,MILITARISTIC,POLITICAL,SCIENTIFIC}`;
  EXPANSIONIST also `_WIDE`/`_TALL`; POLITICAL TOT variants end `_HAPPINESS` or `_INFLUENCE`).
- `LeaderCivPriorities` (AI pairing), `CityNames` (30 rows), `StartBiasTerrains` /
  `StartBiasBiomes` / `StartBiasRivers` / `StartBiasAdjacentToCoasts` / `StartBiasResources`
  (CivilizationType, [TerrainType|BiomeType|ResourceType], Score).
- `VisArt_CivilizationBuildingCultures` (`BUILDING_CULTURE_MED`, `_MED_ANT`, `_MED_EXP`,
  `BUILDING_CULTURE_SAM_MOD`, `ANT_STONE`, `EXP_STONE`, `MOD_STONE` for a Mediterranean civ),
  `VisArt_CivilizationUnitCultures` (`Euro`, `MidE`, `Asian`, ...).
- `AiListTypes`, `AiLists` (LeaderType=`TRAIT_X`, System=UnitBiases | GovernmentBiases |
  PseudoYieldBiases | ConstructibleBiases | SettlementPlotEvaluations), `AiFavoredItems`.
- Optional `EndGameMovies`, `Independents` renames.

### `data/civilizations-{antiquity,exploration,modern}.xml` (per age)
`TraitModifiers` (TraitType=`TRAIT_X_ABILITY`, ModifierId) listing which ability modifiers
apply in that age; exploration also `RequirementSets`/`Requirements`/`RequirementArguments`
for `REQSET_PLAYER_IS_X` (`REQUIREMENT_PLAYER_HAS_CIVILIZATION_OR_LEADER_TRAIT`, TraitType).

### `data/civilizations-gameeffects.xml` (exploration)
`MOD_REVEAL_CIV_CULTURE_TREE_X`: collection COLLECTION_OWNER, effect
EFFECT_PLAYER_REVEAL_CULTURE_TREE, Argument ProgressionTreeType=`TREE_CIVICS_EX_X`, subject
requirement player has trait `TRAIT_X`.

Proven ability effects (copy the whole modifier):
- `EFFECT_CITY_ADJUST_FAVORED_WONDER_PRODUCTION` (Percent) on COLLECTION_PLAYER_CITIES.
- `EFFECT_CITY_ADJUST_YIELD_PER_GREAT_WORK` (YieldType, Amount, Tooltip) on COLLECTION_PLAYER_CITIES.
- `EFFECT_ADJUST_UNIT_STRENGTH_MODIFIER` (Amount) on COLLECTION_PLAYER_COMBAT / COLLECTION_UNIT_COMBAT
  with `REQUIREMENT_OPPONENT_IS_DISTRICT`, `REQUIREMENT_OPPONENT_UNIT_DOMAIN_MATCHES`,
  `REQUIREMENT_PLOT_TERRAIN_TYPE_MATCHES`.
- `EFFECT_ADJUST_UNIT_IMPROVEMENT_PILLAGE_YIELD_MODIFIER`, `EFFECT_ADJUST_UNIT_PERCENT_PILLAGE_*_MODIFIER`.
- `EFFECT_CITY_ADJUST_YIELD_PER_NUM_CITIES` (Amount, YieldType, DistantLands) with
  `REQUIREMENT_CITY_HAS_UNIQUE_QUARTER`.
- `EFFECT_CITY_ADJUST_CONSTRUCTIBLE_YIELD` (ConstructibleType, YieldType, Amount).
- `EFFECT_UNIT_ADJUST_ABILITY` (AbilityType) to hand a unit ability to a class.
- `EFFECT_ADJUST_PLAYER_RELIC_FOR_BUILDING_WONDER`, `EFFECT_GRANT_GREAT_WORK`,
  `EFFECT_PLAYER_ADJUST_SETTLEMENT_CAP`, `EFFECT_PLAYER_GRANT_TRADITION_SLOTS`.
For anything else grep `Base/modules/*/data/*gameeffects.xml` for `effect="` and copy the
requirement shape that already surrounds it.

### `data/units.xml` (age of the unit)
`Types` (KIND_UNIT, KIND_ABILITY), `Units` (UnitType, Name, Description, Tier, Maintenance,
BaseSightRange, BaseMoves, UnitMovementClass, Domain, CoreClass, FormationClass,
ZoneOfControl, TraitType), `Unit_Stats` (Combat; naval also RangedCombat, Bombard, Range),
`Unit_Costs` (YieldType, Cost), `UnitUpgrades` (Unit, UpgradeUnit), `UnitReplaces`
(CivUniqueUnitType, ReplacesUnitType), `Tags` (`UNIT_CLASS_X` Category UNIT_CLASS),
`TypeTags` (copy the base unit's tags, add `UNIT_CLASS_UNIQUE` and `UNIT_CLASS_X`),
`UnitClass_Abilities`, `UnitAbilities`, `UnitAbilityModifiers`, `Unit_Advisories`.
Tier 2 and 3 are unlocked in `progression-trees-tech.xml` with `RequiredTraitType`.

Base lines to replace (Exploration): cavalry Courser 40 / Knight 45 / Lancer 50 (costs
170/210/260, Heraldry, Metal Casting); infantry Swordsman / Man-at-Arms / Pikeman; ranged Heavy
Archer / Crossbowman / Arquebusier; naval Cog 30/35/30 r2 / Carrack / Galleon (130/170/220,
Shipbuilding, Gunpowder). Antiquity: Horseman (T3, 35, 120), Galley (T2), Quadrireme (T3).
Modern: Cuirassier (T1, 55, 350), Frigate, Ironclad.

### `data/constructibles.xml` (exploration-age-persist)
`Types` (KIND_CONSTRUCTIBLE), `TypeQuotes` (wonders), `Constructibles` (ConstructibleType,
Name, Description, Tooltip, ConstructibleClass BUILDING|IMPROVEMENT|WONDER, Cost, Population,
Age, CostProgressionModel `COST_PROGRESSION_PREVIOUS_BUILDINGS_CITY`, optional AdjacentTerrain,
RequiresHomeland, RequiresUnlock, ImmuneDamage), `Buildings` (Movable="false", TraitType),
`Wonders` (MaxWorldInstances, BuildOnFrontier), `Improvements`, `Constructible_ValidDistricts`
(DISTRICT_CITY_CENTER + DISTRICT_URBAN for buildings, DISTRICT_WONDER, DISTRICT_RURAL),
`Constructible_YieldChanges`, `Constructible_Maintenances` (YieldType, Amount: Firaxis uniques pay
3 gold + 3 happiness), `Constructible_Adjacencies` + `Adjacency_YieldChanges`
(ID, YieldType, YieldChange, TilesRequired, AdjacentQuarter | AdjacentNavigableRiver |
AdjacentResource | AdjacentTerrain | AdjacentConstructible), `Constructible_Plunders`,
`Constructible_ProductionBoosts`? (the `Percent="5"` rows), `TypeTags` (yield tag, UNIQUE,
AGELESS, GREATWORK, FORTIFICATION), `UniqueQuarters` (UniqueQuarterType, BuildingType1,
BuildingType2, Name, Description, Tooltip, TraitType), `UniqueQuarterModifiers`,
`ConstructibleModifiers`, `Constructible_Advisories`. Great work slots in `greatworks.xml`
(`Constructible_GreatWorks`: GreatWorkSlotType GREATWORKSLOT_ANY, NumSlots).

### `data/traditions.xml` (always) and `config/config-traditions.xml` (shell copy)
`Types` (KIND_TRADITION), `Traditions` (TraditionType, Name, Description, TraitType, AgeType,
CultureSlotType=TRADITION_CULTURE_SLOT, optional ObsoletesTraditionType), `TraditionModifiers`.
The shell needs a copy of the `Traditions` rows and of the civic `ProgressionTreeNodes` /
`ProgressionTreeNodeUnlocks` (Bulgaria's comment: "These are copies").

### `data/progression-trees-culture-unique.xml` (exploration)
`Types` (KIND_TREE, KIND_TREE_NODE), `TypeQuotes`, `ProgressionTrees` (ProgressionTreeType,
AgeType, SystemType SYSTEM_CULTURE, Name), `ProgressionTreeNodes` (Cost 800 / 1200 / 2000,
IconString `cult_<civ>` — falls back if no icon), `ProgressionTreeNodeUnlocks` (TargetKind
KIND_CONSTRUCTIBLE | KIND_TRADITION | KIND_MODIFIER, UnlockDepth 1 or 2; shared modifiers
`MOD_EX_SETTLEMENT_CAP_INCREASE`, `MOD_EX_RELIC`, `MOD_TOT_TRADITION_SLOT`),
`ProgressionTreePrereqs`, `ProgressionTree_Advisories`.
Test of Time nodes: `-aq.xml` adds `NODE_CIVIC_AQ_X_ORIGINS` to `TREE_CIVICS_AQ_TEST_OF_TIME`
(Cost 150, CanSteal false, `ProgressionTreeNodeTraits` RequiredTraitType `TRAIT_X`, prereq of
`NODE_CIVIC_AQ_FOUNDATION` and `NODE_CIVIC_AQ_SYNCRETISM_CHOICE`); `-mo.xml` adds
`NODE_CIVIC_MO_X_MODERNIZATION` (Cost 2000, prereq of `NODE_CIVIC_MO_ADMINISTRATION` and
`NODE_CIVIC_MO_SYNCRETISM_CHOICE`), each unlocking a tradition + `MOD_TOT_TRADITION_SLOT` +
the age's settlement-cap modifier.

### `data/unlocks-*.xml` (always)
`Types`/`Unlocks`/`UnlockRewards`/`UnlockConfigurationValues` for `UNLOCK_CIVILIZATION_X`
(InsertOrIgnore), `UnlockRequirements` rows: `REQSET_CIV_IS_X` (define in unlocks-exploration
with `REQUIREMENT_PLAYER_CIVILIZATION_TYPE_MATCHES`), `REQSET_CIV_IS_ROME` etc. and
`REQSET_LEADER_IS_<LEADER>` (exist in base), plus one gameplay unlock
(`REQUIREMENT_PLAYER_HAS_AT_LEAST_NUM_BUILDINGS` BuildingType + Amount, GameplayUnlock="True",
NarrativeText). The Modern civ the new civ unlocks gets an `UnlockRequirements` row on
`UNLOCK_CIVILIZATION_<MODERN>` with `REQSET_CIV_IS_X`. `unlocks-syncretism.xml`:
`LeaderSyncretismUnlocks`, `CivilizationSyncretismUnlocks`, optional `CivSelfSyncretismUnlocks`.

### `config/config.xml` (shell)
- `Civilizations` (Domain, CivilizationType, CivilizationName, CivilizationFullName,
  CivilizationDescription, CivilizationIcon, CivilizationIntroText) — one row per age domain
  the civ should be pickable in.
- `CivilizationItems` (CivilizationDomain, AgeType for traits, CivilizationType, Type, Kind
  KIND_TRAIT | KIND_UNIT | KIND_BUILDING | KIND_QUARTER | KIND_IMPROVEMENT, Name, Description, Icon).
- `CivilizationTags` (`TAG_TRAIT_*`, `TAG_APEX_AGE_EXPLORATION`).
- `CivilizationUnlocks` (which civ unlocks which in which age), `LeaderUnlocks`,
  `LeaderCivilizationBias` (Bias, ReasonType tooltip tag, ChoiceType
  `LOC_CREATE_GAME_{HISTORICAL,GEOGRAPHIC,STRATEGIC}_CHOICE`), `OwnershipConditions`.

### Text
`CivilizationText` (trait name, descriptions per age `_AQ_`/`_MO_`, preview strings),
`CivilizationLegacyText` (NAME, FULLNAME, ADJECTIVE), `CityNamesText`, `CitizenNamesText`,
`UnitText`, `ConstructibleText` (incl. `LOC_QUOTE_WONDER_*`), `CultureText` (tree, nodes,
quotes, traditions), `UnlockText`, `LoadingText` (`LOC_LOADING_CIV_INTRO_TEXT_X`,
`LOC_LOADING_INTRO_X`, `LOC_LOADING_CIV_TIPS_TEXT_X`), `ModuleText`, `CivilopediaText`
(`LOC_PEDIA_PAGE_CIVILIZATION_X_CHAPTER_HISTORY_PARA_n`, same for units/buildings/nodes).
Markup: `[icon:YIELD_CULTURE]`, `[TIP:LOC_PEDIA_CONCEPTS_..._TOOLTIP]text[/TIP]`, `[B]`, `[BLIST][LI]`, `[n]`.

## 4. Icons and art

- Ship PNGs under `icons/` and list them in `<ImportFiles>` in both the game and the shell
  groups; reference them as `fs://game/<modid>/icons/<file>.png` in `IconDefinitions`
  (`ID` = type name; loading backgrounds use `Context` BACKGROUND with `IconSize` 1080/720 and
  BACKGROUND_VERT). Sizes used by community tooling: civ symbol 256, unit flag 128, building 128.
- Some shell code builds `blp:civ_sym_<civ>` names directly (`utilities-image.js`), so a few
  UI spots may show a blank for a mod civ. Live with it or check after the first run.
- 3D: `VisualRemaps` (section 1). No art package (`.dep`, `Platforms/`) is needed for a
  data-only mod; the map mod proves that.
- Style, read from the game's UI code: the civ symbol goes through `filter: fxs-color-mask(...)`,
  so it must be a **white shape on transparency** (the game recolours it); unit flags are plain
  **white silhouettes on transparency** drawn on the coloured flag; building and wonder icons are
  **full-colour** paintings with a soft shadow, three-quarter view, warm palette. Silhouettes read
  better with a few masked-out cut lines (saddle, hem, gunwale) than as one blob.
- Workflow used for Byzantium: author SVGs in `<Mod>/icons/src/`, render them with
  `tools/icon-render/server.py` plus the in-app browser (ImageMagick here has no librsvg and
  headless Chrome hangs), review on a dark contact sheet, commit both SVG and PNG.
  `tools/make-icons.py` only makes flat placeholders. A second, painted set can live in
  `<Mod>/icons-alt/` (Byzantium's came from an AI concept sheet: medallions cropped, eagle
  thresholded to a white mask, units kept as painted vignettes because a dark horse cannot be
  keyed off a purple background); `tools/switch-icons.sh <Mod> alt|vector` swaps sets and
  reinstalls, and `icons-vector/` keeps the rendered set safe.

## 5. Map integration

`tsl` in `europe-geo.js`, `europe-large-geo.js`, `europe-alt-geo.js`: `[lon, lat]`. The map
script checks `MIN_SPACING` (5 hexes on the standard map, grid width / 14 on the large ones)
against already placed starts, in player order; a blocked true start falls back to the
curated list. Keep neighbouring true starts apart or move one.

## 6. Pitfalls seen in Firaxis data

- Shell and game are separate databases: text and icons must be added to both scopes.
- `Traditions` and civic nodes must exist in the shell too (`config-traditions.xml`) or the
  civ-select item list and tooltips break.
- Unique buildings need `Constructible_ValidDistricts` for both `DISTRICT_CITY_CENTER` and
  `DISTRICT_URBAN`, and `Buildings.Movable="false"`.
- Every tier of a unit line needs its own `Types`, `Units`, `Unit_Stats`, `Unit_Costs`,
  `TypeTags`, `UnitReplaces` rows and its own icon row.
- `UnitReplaces` is a foreign key to `Units`: a replacement of an Exploration unit cannot be
  loaded in an Antiquity game.
- Version bump lives in two places in the modinfo (`version=""` and `<Version>`).
- macOS quarantine flag makes the game ignore a mod folder silently (`install.sh` clears it).
- The shell database has no `Types` table: a file loaded in `scope="shell"` may only carry the
  shared tables (config tables, `Traditions`, civic nodes, the syncretism tables). Keep shell-safe
  rows in their own file; the Bulgaria split `unlocks-syncretism.xml` vs `unlocks-*.xml` is that.
- `Constructible_Advisories` takes `ADVISORY_CLASS_DIPLOMACY` (not DIPLOMATIC); the valid classes
  are CITY_EXPANSION, CULTURE, DEFENSE, DIPLOMACY, ECONOMIC, EMPIRE_EXPANSION, FOOD, HAPPINESS,
  INFRASTRUCTURE, LAND, MILITARY, NARRATIVE, OFFENSE, RELIGION, SCIENCE, SEA, TRADE.
- `AiFavoredItems` settlement hints use `Item="Specific Terrain"` + `StringVal` with
  `LOC_SETTLEMENT_RECOMMENDATION_TERRAIN`; there is no coastal item.
- Startup only builds the shell database. Game-scope files (`scope="game"` under an age criteria)
  are first parsed when a game is created, so a clean `Database.log` at the main menu says nothing
  about units or buildings. Start a game to test those.
- The game ignores AppleScript quit and background (unfocused) mouse input; restart it with
  `kill <pid>` then `open -a`, and test in the foreground.

## 7. Reference checks

```bash
# all LOC tags referenced by data/config must be defined in text/
grep -rhoE 'LOC_[A-Z0-9_]+' Byzantium/data Byzantium/config | sort -u > /tmp/ref.txt
grep -rhoE 'Tag="LOC_[A-Z0-9_]+"' Byzantium/text | grep -oE 'LOC_[A-Z0-9_]+' | sort -u > /tmp/def.txt
comm -23 /tmp/ref.txt /tmp/def.txt      # tags used but never defined (base-game tags will show too)
```
`tools/check-mod.py` (planned) automates this and also checks every `*_X` type referenced
against the mod's `Types` rows plus the base modules.
