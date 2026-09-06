# Byzantium: an Exploration Age civilization, playable in every age

Status (2026-09-05): phases 1 to 5 implemented in `Byzantium/`, version 1. Verified so far: the
checker is clean; the game loads the mod with no database errors at startup (shell scope, all
three age rows), and the setup log lists Byzantium in every player slot's civilization values.
First in-game test (2026-09-05): the shell showed no civ symbol or card, because image paths
must be flat `fs://game/<file>` names and the card/panel are found by naming convention (fixed:
flat paths, `bg-card-byzantium.png`, `bg-panel-byzantium.png`); the picker duplicated the two
units because the Antiquity variants were listed as items too (fixed); traditions felt thin
(now 7 Exploration + 2 Antiquity + 2 Modern + 2 self-syncretism).
Second test (2026-09-05, evening): symbol, card and icons show in the picker once the URLs use
`fs://game/byzantium/<file>`; the picker lists each unique once; the extra traditions, the Cultural
and Political tags and the reworked ability (+2 Influence, +2 Gold in every settlement) are
visible. The Constantinople start landed on cotton, so both map scripts now clear a resource
from a placed start tile.
Still to verify in play: the game-scope tables (units,
buildings, civic tree, traditions), the visual remaps, the placeholder icons, the true start on the
Europe maps, and Antiquity or Modern starts. Do that check next: New Game, Exploration Age,
Byzantium, Europe & Mediterranean map, then build a Cataphract and open the civics tree.

Plan written 2026-09-05 from the installed game files
(Bulgaria DLC as template, base age modules, schema SQL). Companion skill:
`.claude/skills/new-civilization/` (procedure + table reference).

## 1. What "playable in any era" means and how it is done

The game itself already supports this, in two halves.

- **Game side.** `base-standard/data/ages-post-process.sql` adds `TRAIT_ANACHRONISTIC_CIV` to every
  civilization whose `ApexAge` is not the active age, and each age module gives that trait the same
  baseline modifiers as its native civs (settlement cap, resource caps, embarkation...). So a civ
  declared with `ApexAge="AGE_EXPLORATION"` is mechanically complete in Antiquity and Modern games.
- **Shell side.** The civ picker for a start age lists the `Civilizations` config rows in that age's
  domain (`AntiquityAgeCivilizations`, `ExplorationAgeCivilizations`, `ModernAgeCivilizations`;
  primary key is Domain + CivilizationType). Bulgaria has one row (Exploration). Byzantium gets
  three, so it is pickable at any start age without the "Time-Tested Allowed" option.

What we must add ourselves per non-apex age: trait descriptions for the picker
(`CivilizationItems` per domain), a node in the shared Test of Time civic trees
(`TREE_CIVICS_AQ_TEST_OF_TIME`, `TREE_CIVICS_MO_TEST_OF_TIME`) with an age-appropriate tradition,
and unit variants whose `UnitReplaces` target exists in that age (Exploration units cannot be
loaded in an Antiquity game: foreign key). Unique buildings are declared `Age="AGE_EXPLORATION"`
and tagged `AGELESS`; whether an Antiquity start can build them once the Origins node unlocks
them is the one open question, settled by a test (fallback: Antiquity variants of the two
buildings).

## 2. Design sheet

| Item | Decision |
|---|---|
| Ids | `CIVILIZATION_BYZANTIUM`, `TRAIT_BYZANTIUM`, `TRAIT_BYZANTIUM_ABILITY`; mod id `byzantium`, folder `Byzantium/` |
| Names | Byzantium / Byzantine Empire / Byzantine; capital Constantinople |
| Apex age | Exploration (`TAG_APEX_AGE_EXPLORATION`) |
| Attributes | Cultural + Political (changed from Militaristic after the first test). Traits `TRAIT_ATTRIBUTE_CULTURAL`, `_CULTURAL_TOT_AQ`, `_CULTURAL_TOT_MO`, `TRAIT_ATTRIBUTE_POLITICAL`, `_POLITICAL_TOT_AQ_INFLUENCE`, `_POLITICAL_TOT_MO_INFLUENCE`; tags `TAG_TRAIT_CULTURAL`, `TAG_TRAIT_POLITICAL` |
| Ability | **Queen of Cities** (see 2.1) |
| Unique units | **Cataphract** (cavalry line, 3 tiers) and **Dromon** (naval, replaces Cog) (see 2.2) |
| Unique quarter | **Augustaion** = Hippodrome + Great Palace (see 2.3) |
| Associated wonder | **Hagia Sophia** (see 2.4) |
| Civics | Themata, Pentarchy, Porphyrogennetos (see 2.5) |
| Unlocked by | Rome (historical), Greece (geographic); leaders Augustus (historical), Catherine (strategic, "Third Rome"), Charlemagne, Xerxes (geographic); gameplay unlock: own Ancient Walls in 3 settlements (`BUILDING_ANCIENT_WALLS`, Theodosian Walls flavour) |
| Unlocks | Russia (Modern, historical); Ottomans (Modern, geographic) only when the Ottomans DLC is in use |
| Start bias | coast +150, navigable river +? (Bosporus), grassland biome; favoured wonder Hagia Sophia |
| Art cultures | buildings `BUILDING_CULTURE_MED`, `_MED_ANT`, `_MED_EXP`, `BUILDING_CULTURE_SAM_MOD`, `ANT_STONE`, `EXP_STONE`, `MOD_STONE`; units `Euro` |
| True start | Constantinople, Thracian shore: `[28.70, 41.30]` on all three geo files |
| Cities (30) | Constantinople, Thessalonica, Nicaea, Trebizond, Antioch, Adrianople, Ephesus, Smyrna, Nicomedia, Chalcedon, Ravenna, Dyrrachium, Mystras, Monemvasia, Sardis, Caesarea, Ancyra, Attaleia, Corinth, Thebes, Heraclea, Amorium, Philippopolis, Cherson, Sinope, Edessa, Bari, Syracuse, Naupactus, Larissa |
| Citizens | male: Basil, Justinian, Alexios, Constantine, Leo, Theodore, Nikephoros, Michael, Romanos, John; female: Theodora, Irene, Zoe, Anna, Eudokia, Helena, Maria, Sophia, Theophano, Pulcheria |

### 2.1 Ability: Queen of Cities

All three effects reuse modifier shapes that ship in Bulgaria or Spain (see reference.md, section 3).

1. +30% Production toward Hagia Sophia (`EFFECT_CITY_ADJUST_FAVORED_WONDER_PRODUCTION`), loaded in
   the persist group because it names the wonder. Exploration and Modern only.
2. +2 Influence and +2 Gold in every settlement (`EFFECT_CITY_ADJUST_YIELD` on
   `COLLECTION_PLAYER_CITIES`). All ages. Replaced the per-Great-Work version after the first
   test: Great Works are too slow to come by for a civ ability.
3. Theodosian Walls: units defending in a fortified district get +3 Combat Strength. Implement
   with whichever proven defensive modifier the base civs use (candidates in
   `age-exploration/data/civilizations-gameeffects.xml`, Norman and Ming); if none fits, swap for
   "+50% Production toward walls" which is a plain constructible production modifier. All ages.

### 2.2 Unique units

**Cataphract** (`UNIT_CATAPHRACT`, `_2`, `_3`), mirrors Bulgaria's Bolyar rows: Tier 1/2/3,
replaces Courser / Knight / Lancer, Combat 42 / 47 / 52 (+2 over base), cost 180 / 220 / 270,
moves 3, mounted. Ability `ABILITY_CATAPHRACT`: +3 Combat Strength against infantry
(`REQUIREMENT_OPPONENT_UNIT_TAG_MATCHES` or the closest existing requirement; fallback: +3 on
flat terrain, which is the proven `REQUIREMENT_PLOT_TERRAIN_TYPE_MATCHES` pattern). Tier 2 on
Heraldry, tier 3 on Metal Casting via `progression-trees-tech.xml` with `RequiredTraitType`.
Visuals: `VisualRemaps` rows to `UNIT_COURSER`, `UNIT_KNIGHT`, `UNIT_LANCER`.

**Dromon** (`UNIT_DROMON`): replaces Cog, upgrades to Carrack. Combat 30, Ranged 35, Bombard 30,
Range 2, cost 130. Ability Greek Fire: +5 Combat Strength against naval units
(`EFFECT_ADJUST_UNIT_STRENGTH_MODIFIER` + `REQUIREMENT_OPPONENT_UNIT_DOMAIN_MATCHES` DOMAIN_SEA,
the shape Bulgaria's Stratagems use). Visual remap to `UNIT_COG`.

Antiquity variants (phase 4): `UNIT_CATAPHRACT_AQ` replaces Horseman (Combat 37, cost 130,
remap to `UNIT_HORSEMAN`), `UNIT_DROMON_AQ` replaces Galley (remap to `UNIT_GALLEY`).
Modern: no unique units in v1 (Bulgaria has none either); optional later: Cataphract replacing
Cuirassier.

Alternative kept in reserve: a Varangian Guard army commander mirroring Bulgaria's Tarkhan.

### 2.3 Unique quarter: Augustaion

Two buildings, both `Age="AGE_EXPLORATION"`, cost 290, population 1, valid in city centre and
urban districts, maintenance 3 gold + 3 happiness (Firaxis standard), tags UNIQUE + AGELESS,
unlocked by the first civic node.

- **Hippodrome**: +6 Culture, +1 Culture per adjacent quarter (copy `CasaConsistorialUrbanCulture`),
  +1 Culture per adjacent wonder (`WonderCulture`), tag CULTURE.
- **Great Palace**: +6 Influence (YIELD_DIPLOMACY, as the Guildhall does), +1 Influence per adjacent
  wonder, tag DIPLOMACY; plunder type gold.
- **Quarter effect**: +2 Happiness in the city per displayed Great Work
  (`EFFECT_CITY_ADJUST_YIELD_PER_GREAT_WORK` guarded by `REQUIREMENT_CITY_HAS_UNIQUE_QUARTER`).

Building visuals: `VisualRemaps` Kind BUILDING to `BUILDING_PAVILION` and `BUILDING_GUILDHALL`.

### 2.4 Wonder: Hagia Sophia

`WONDER_HAGIA_SOPHIA`: cost 750, +4 Culture, +2 Influence, 3 Great Work slots (any), Ageless,
one per world, `RequiresUnlock`; gain a Relic when completed (Rila pattern, once). Quote:
Procopius on the dome ("suspended from heaven by a golden chain"). Unlocked at depth 1 by the
second civic node and at depth 2 by `NODE_TECH_EX_ARCHITECTURE` for everyone else (the Rila
pattern). Visual remap to `WONDER_NOTRE_DAME` (Kind BUILDING); if the remap does not take, the
wonder still works but shows no model, and the favoured-wonder effect is then pointed at an
existing wonder instead.

### 2.5 Civic tree `TREE_CIVICS_EX_BYZANTIUM`

| Node | Cost | Unlocks |
|---|---|---|
| Themata | 800 | Hippodrome, Great Palace, tradition **Themata** (+3 Combat Strength for land units inside your territory; fallback: +25% Production toward cavalry), `MOD_EX_SETTLEMENT_CAP_INCREASE` |
| Pentarchy (requires Themata) | 1200 | Hagia Sophia, tradition **Pentarchy** (+1 Happiness and +1 Influence per displayed Great Work: proven), `MOD_EX_RELIC` |
| Porphyrogennetos (requires Themata) | 2000 | tradition **Porphyrogennetos** (+2 Culture on Hippodromes and Great Palaces: `EFFECT_CITY_ADJUST_CONSTRUCTIBLE_YIELD`, proven), `MOD_TOT_TRADITION_SLOT` |

Test of Time nodes: `NODE_CIVIC_AQ_BYZANTIUM_ORIGINS` unlocks **Themata I** (Antiquity version)
+ `MOD_TOT_TRADITION_SLOT` + `MOD_AQ_SETTLEMENT_CAP_INCREASE`; `NODE_CIVIC_MO_BYZANTIUM_MODERNIZATION`
unlocks **Pentarchy II** (obsoletes Pentarchy) + slot + `MOD_MO_SETTLEMENT_CAP_INCREASE`.
Self-syncretism traditions (Romanitas I in Antiquity, Romanitas II in Modern) follow Bulgaria's
Uporitost pattern: `CivSelfSyncretismUnlocks` rows name the unlock modifiers, the traditions carry
`IgnoreInitializeUnlock` and `AllowInitializeAdvancedStart`, and the shell gets copies.

## 3. Files to create

```
Byzantium/
  byzantium.modinfo
  config/config.xml, config-traditions.xml, config-ottomans.xml
  data/
    civilizations-legacy.xml, civilizations-shared.xml, civilizations-shared-gameeffects.xml
    civilizations-antiquity.xml, civilizations-exploration.xml, civilizations-modern.xml
    civilizations-gameeffects.xml
    units.xml, units-gameeffects.xml, units-antiquity.xml, units-antiquity-gameeffects.xml
    constructibles.xml, constructibles-gameeffects.xml, greatworks.xml
    traditions.xml, traditions-gameeffects.xml, traditions-persist.xml, traditions-gameeffects-persist.xml
    progression-trees-culture-unique.xml, -aq.xml, -mo.xml, progression-trees-tech.xml
    unlocks-base-standard.xml, unlocks-antiquity.xml, unlocks-exploration.xml,
    unlocks-syncretism.xml, unlocks-ottomans.xml
    citizen-names.xml, loading-info-exploration.xml, visual-remaps.xml, icons/icons.xml
  icons/ civ_sym_byzantium.png (256), unitflag_cataphract.png, unitflag_dromon.png,
         buildicon_hippodrome.png, buildicon_greatpalace.png, wondericon_hagiasophia.png (128)
  text/en_us/ CivilizationText, CivilizationLegacyText, CityNamesText, CitizenNamesText,
         UnitText, ConstructibleText, CultureText, UnlockText, LoadingText, ModuleText, CivilopediaText
```
Icons start as generated placeholders (a small Python script writes flat-colour PNGs with a
simple symbol; the game only needs a valid file) and can be replaced by real art any time.

Repository changes outside the mod:
- `install.sh` / `install.ps1`: mirror every top-level folder that contains a `.modinfo`
  (today they hard-code `EuropeMediterranean`). `release.sh`: take the mod folder as an argument.
- `EuropeMediterranean/maps/europe-geo.js`, `europe-large-geo.js`, `europe-alt-geo.js`: add
  `CIVILIZATION_BYZANTIUM: [28.70, 41.30]` to `tsl`. On the standard map the Ottoman true start
  is Bursa `[29.1, 40.2]`, inside the 5-hex spacing of Constantinople; move it to Ankara as the
  large maps already did. (Uncommitted edits already sitting in the working copy move Greece to the
  Thermaic Gulf, add an America start and a Constantinople fallback site; they are kept.)
- `tools/check-mod.py`: LOC-tag and type-reference checker used by the skill.
- `README.md`: a "Byzantium" section (what it adds, how to install alongside the map) and a line
  pointing at the skill for further civs. No new READMEs elsewhere.

## 4. Phases and verification gates

Each phase ends with `xmllint`, the checker, `./install.sh`, a game launch, and a look at
`Database.log` / `Modding.log`. Screenshots or console lines are the evidence.

1. **Tooling**: multi-mod install/release scripts, checker script. Gate: the map mod still
   installs and loads unchanged.
2. **Identity**: modinfo, legacy/shared civ rows, shell rows for all three domains, text,
   icons, TSL. Gate: Byzantium appears in setup for Antiquity, Exploration and Modern starts;
   an Exploration game on the Europe map starts at Constantinople; no database errors.
3. **Units**: Cataphract line, Dromon, tech unlocks, visual remaps. Gate: buildable, correct
   stats, a model shows on the map (this is where `VisualRemaps` gets its first real test).
4. **Buildings, quarter, wonder, civics, traditions**. Gate: civic tree visible and researchable,
   both buildings placeable, quarter bonus fires, wonder buildable with Notre Dame's model, three
   traditions slot.
5. **Other ages**: Test of Time nodes, Antiquity unit variants, Modern tradition; unlock chain
   Rome/Greece → Byzantium → Russia (Ottomans with DLC). Gate: Antiquity start as Byzantium works
   and transitions into Exploration keeping Byzantium; Modern start works; the open question on
   Exploration buildings in Antiquity is answered and fixed if needed.
6. **Polish and release**: civilopedia paragraphs, loading text, AI biases, README, version 1,
   commit and push with jj, GitHub release tag.

Out of scope (needs Firaxis tooling or assets we cannot make here): a new leader, voice-over,
age-transition movies, loading-screen painting, narrative event chains, metaprogression
challenges. All are listed so the skill knows what a full DLC has and what we deliberately skip.
