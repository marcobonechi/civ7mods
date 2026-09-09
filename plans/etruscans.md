# Etruscans: an Antiquity Age civilization

Design sheet written 2026-09-09 following `.claude/skills/new-civilization/` and modelled on
`Byzantium/` (which is itself modelled on the Bulgaria DLC). Companion plans:
[tuscany.md](tuscany.md) — the Exploration Age successor — and
[etruscans-tuscany-log.md](etruscans-tuscany-log.md), the running work log.

Theme, as Marco set it: **engineering and the good life**. Everything the Etruscans get should be
either a piece of civil engineering (drainage tunnels, arches, city grids, harbours, bronze) or a
piece of the banquet-and-tomb culture the Greeks and Romans found so striking (frescoed tombs,
reclining couples, music, wine).

## 1. Design sheet

| Item | Decision |
|---|---|
| Ids | `CIVILIZATION_ETRUSCANS`, `TRAIT_ETRUSCANS`, `TRAIT_ETRUSCANS_ABILITY`; mod id `etruscans`, folder `Etruscans/` |
| Names | Etruria / The Etruscan League / Etruscan; capital Populonia |
| Apex age | Antiquity (`TAG_APEX_AGE_ANTIQUITY`) |
| Attributes | Scientific + Economic. Traits `TRAIT_ATTRIBUTE_SCIENTIFIC` (+`_TOT_EX`, `_TOT_MO`), `TRAIT_ATTRIBUTE_ECONOMIC` (+`_TOT_EX`, `_TOT_MO`); tags `TAG_TRAIT_SCIENTIFIC`, `TAG_TRAIT_ECONOMIC` |
| Ability | **Disciplina Etrusca** (see 1.1) |
| Unique units | **Biga** (chariot, replaces Chariot) and **Tyrrhenian Galley** (replaces Galley) |
| Unique quarter | **Spura** = Cuniculus + Tumulus (see 1.3) |
| Associated wonder | **Fanum Voltumnae**, the federal sanctuary of the Twelve Peoples |
| Civics | Cuniculi, Dodecapolis, Haruspicina (see 1.5) |
| Unlocked by | An Antiquity civ: pickable from the start. Leaders Porsenna (historical) and Augustus (historical, Rome's Etruscan kings); gameplay unlock: own 3 Bath-style water buildings — see 1.6 |
| Unlocks | Tuscany (Exploration, historical) and Norman (Exploration, geographic — the Normans in Italy) |
| Start bias | coast +100, navigable river +10, grassland/plains biome; favoured wonder Fanum Voltumnae |
| Art cultures | buildings `BUILDING_CULTURE_MED`, `_MED_ANT`, `_MED_EXP`, `BUILDING_CULTURE_SAM_MOD`, `ANT_STONE`, `EXP_STONE`, `MOD_STONE`; units `Euro` |
| True start | Populonia, on the Tuscan coast: `[10.50, 42.99]` on all three geo files (moved 2026-09-09 — see below) |
| Leader | **Porsenna** — see 3 |

Cities (30): Populonia, Veii, Caere, Vulci, Clusium, Volsinii, Perusia, Arretium, Cortona,
Volaterrae, Tarquinii, Rusellae, Vetulonia, Faesulae, Pisae, Falerii, Capena, Statonia, Saturnia,
Cosa, Graviscae, Pyrgi, Marzabotto, Felsina, Spina, Adria, Capua, Nola, Pontecagnano, Salpinum.

Citizens — male: Arnth, Larth, Vel, Aule, Tarchon, Thefarie, Velthur, Sethre, Laris, Avle;
female: Ramtha, Thanchvil, Larthia, Velia, Hastia, Fasti, Culni, Ravnthu, Seianti, Thana.

### 1.1 Ability: Disciplina Etrusca

Named for the body of Etruscan lore — haruspicy, augury, and the *libri rituales* that laid out how
to found a city, drain a valley and orient a temple. Rome learned all three from them.

1. +1 Production and +2 Happiness in every Settlement (`EFFECT_CITY_ADJUST_YIELD` on
   `COLLECTION_PLAYER_CITIES`, the shape Byzantium's Queen of Cities uses). All ages.
2. +30% Production toward the Fanum Voltumnae
   (`EFFECT_CITY_ADJUST_FAVORED_WONDER_PRODUCTION`), loaded in the persist group because it names
   the wonder.
3. Reveal the Etruscan civic tree (`EFFECT_PLAYER_REVEAL_CULTURE_TREE`), Antiquity only.

### 1.2 Unique units

**Biga** (`UNIT_BIGA`) — the two-horse war chariot of the Monteleone bronze, replacing
`UNIT_CHARIOT`. Tier 2, Combat 33 (+3), cost 80, moves 4 (+1 over the Chariot), wheeled.
Ability *Monteleone*: +4 Combat Strength on flat terrain
(`REQUIREMENT_PLOT_TERRAIN_TYPE_MATCHES` TERRAIN_FLAT — the proven shape). Visual remap to
`UNIT_CHARIOT`.

**Tyrrhenian Galley** (`UNIT_TYRRHENIAN_GALLEY`) — the ships that made the Greeks call the whole
sea Tyrrhenian and the Etruscans pirates. Replaces `UNIT_GALLEY`. Tier 2, Combat 27, Ranged 22,
Bombard 15, Range 1, moves 4, sight 3. Ability *Thalassocracy*: +5 Combat Strength against naval
units. Visual remap to `UNIT_GALLEY`.

### 1.3 Unique quarter: Spura

*Spura* is the Etruscan word for the city as a community. Two buildings, `Age="AGE_ANTIQUITY"`,
valid in city centre and urban districts, tags UNIQUE + AGELESS.

- **Cuniculus** (cost 60): the rock-cut drainage tunnel that let the Etruscans farm a volcanic
  plateau and that Rome copied as the Cloaca Maxima. +2 Food, +2 Production, +1 Happiness;
  +1 Food per adjacent Navigable River or Coast tile. Tag FOOD.
- **Tumulus** (cost 95): the drum-shaped painted chamber tomb — banqueters, dancers, musicians.
  +4 Culture, +2 Happiness, +1 Gold; +1 Culture per adjacent Wonder (reuses the base
  `WonderCulture` adjacency). Tag CULTURE.
- **Quarter effect** (Mese pattern, per-settlement): +1 Production, +1 Culture and +1 Happiness in
  every Settlement.

### 1.4 Wonder: Fanum Voltumnae

`WONDER_FANUM_VOLTUMNAE`, the sanctuary near Volsinii where the twelve peoples met each spring.
Cost 400 (Antiquity scale), +3 Culture, +3 Influence, +2 Happiness, 2 Great Work slots, Ageless,
one per world, `RequiresUnlock`. Unlocked at depth 1 by the Dodecapolis civic and at depth 2 by
`NODE_TECH_AQ_MASONRY` for everyone else. Visual remap to `WONDER_ORACLE`.

### 1.5 Civic tree `TREE_CIVICS_AQ_ETRUSCANS`

Antiquity node costs follow Rome's tree (150 / 250 / 400).

| Node | Cost | Unlocks |
|---|---|---|
| Cuniculi | 150 | Cuniculus, Tumulus, traditions **Cuniculi** and **Bucchero**, `MOD_AQ_SETTLEMENT_CAP_INCREASE` |
| Dodecapolis (req. Cuniculi) | 250 | Fanum Voltumnae, traditions **Dodecapolis** and **Convivium** |
| Haruspicina (req. Cuniculi) | 400 | traditions **Haruspicina** and **Metalla**, `MOD_TOT_TRADITION_SLOT` |

Traditions (Antiquity unless noted):
- **Cuniculi** — +2 Production in Settlements with a Cuniculus (constructible yield).
- **Bucchero** — +1 Gold on buildings tagged CULTURE.
- **Dodecapolis** — +2 Influence per Settlement beyond the first three (settlement-scaled Influence).
- **Convivium** — +1 Happiness and +1 Culture in every Settlement.
- **Haruspicina** — +1 Science in every Settlement.
- **Metalla** — +15% Production toward buildings.
- Test of Time: **Cuniculi II** (Exploration, obsoletes Cuniculi), **Convivium II** (Modern,
  obsoletes Convivium); self-syncretism **Rasna I** (Exploration) and **Rasna II** (Modern).

Test of Time nodes: `NODE_CIVIC_EX_ETRUSCANS_SURVIVAL` in `TREE_CIVICS_EX_TEST_OF_TIME`
(cost 800, prereq of `NODE_CIVIC_EX_HIERARCHY` and `NODE_CIVIC_EX_SYNCRETISM_CHOICE`) and
`NODE_CIVIC_MO_ETRUSCANS_REVIVAL` in `TREE_CIVICS_MO_TEST_OF_TIME` (cost 2000, prereq of
`NODE_CIVIC_MO_ADMINISTRATION` and `NODE_CIVIC_MO_SYNCRETISM_CHOICE`).

### 1.6 Unlocks

`UNLOCK_CIVILIZATION_ETRUSCANS` exists so leaders and the gameplay unlock can point at it, the way
Bulgaria and Byzantium do. Gameplay unlock: own `BUILDING_BATH` in 3 Settlements — the closest base
building to Etruscan waterworks. Etruscans then appear as a predecessor of Tuscany and Norman in
`CivilizationUnlocks`, and in `CivilizationSyncretismUnlocks`.

### 1.7 Why the start is Populonia and not Tarquinii

Measured against the map's own projection rather than in degrees, hexes from Rome `[12.5, 41.9]`:

| | Tiny 60x38 | Small 74x46 | Huge 106x66 | Lg 112x98 | Lg 128x112 | Lg 144x126 |
|---|---|---|---|---|---|---|
| minimum spacing the script enforces | 5 | 5 | 5 | 8 | 9 | 10 |
| Tarquinii | 2 | 1 | 1 | 2 | 2 | 2 |
| Clusium | 1 | 1 | 1 | 2 | 2 | 3 |
| Arretium | 2 | 2 | 2 | 3 | 3 | 4 |
| Vetulonia | 2 | 2 | 3 | 4 | 4 | 5 |
| Volaterrae | 3 | 2 | 3 | 4 | 5 | 5 |
| **Populonia** | 2 | 2 | 3 | 4 | 5 | 6 |

**No Etruscan city clears the requirement on any grid**, so when Rome is in play one of the two
still falls back — Italy is barely three hexes wide on the standard sizes and the large maps ask
for eight to ten. Populonia is simply the best available: furthest from Rome on five grids out of
six, and unlike Volaterrae (which ties it) it stays three hexes from Florence instead of one, so it
does not collide with Tuscany as well.

It also suits the civ better than the mechanics required: Populonia was the one Etruscan city built
on the sea, the port through which the iron of Elba was shipped and smelted — which is what the
Metalla tradition is about — and the civ already carries a coastal start bias and a naval unique.
The city list was reordered so Populonia is first and therefore the capital; Tarquinii takes its
old slot at eleven.

## 2. Playable in every age

Byzantium's pattern, kept: shell `Civilizations` rows in all three domains, the two non-apex ones
labelled "Etruscans (Time-Tested)"; the civ ability's per-settlement modifiers apply in every age;
Test of Time civic nodes carry an age-appropriate tradition, a tradition slot and the age's
settlement-cap modifier; self-syncretism traditions for Exploration and Modern.

No out-of-age unique units in v1: the Biga and the Tyrrhenian Galley replace Antiquity units, and
`UnitReplaces` is a foreign key, so those files load under `antiquity-age-current` only. The two
quarter buildings are `AGELESS` and are re-unlocked by the Test of Time nodes.

## 3. Leader: Porsenna

`LEADER_PORSENNA`, Lars Porsena of Clusium — the king who took Rome, and whose labyrinth tomb Pliny
described. Attributes **Militaristic + Scientific** (tags `TAG_TRAIT_MILITARISTIC`,
`TAG_TRAIT_SCIENTIFIC`, `TAG_GENDER_MALE`).

Ability **Lars of Clusium** (`TRAIT_LEADER_PORSENNA_ABILITY`):
1. +1 Production in every Settlement that is a City (`EFFECT_CITY_ADJUST_YIELD` with
   `REQUIREMENT_CITY_IS_CITY`).
2. Districts holding a fortification get +20 health (`EFFECT_DISTRICT_ADJUST_TOTAL_HEALTH`, the
   Norman/Byzantine shape).
3. +3 Combat Strength when the defender is one of your districts
   (`EFFECT_ADJUST_UNIT_STRENGTH_MODIFIER` with `REQUIREMENT_DEFENDER_IS_PLAYER_OWNED_DISTRICT`).

Victory traits: `TRAIT_AQ_SCIENCE_VICTORY`, `TRAIT_EX_ECONOMIC_VICTORY`, `TRAIT_MO_SCIENCE_VICTORY`.
Leader unlocks: Etruscans in Antiquity, Tuscany in Exploration.

**Art.** A mod cannot ship a leader model: the shell asks the engine for
`<LEADER_TYPE>_GAME_ASSET` and falls back to `LEADER_FALLBACK_GAME_ASSET` when it is missing
(`core/ui/shell/leader-select/leader-select-model-manager.js`). `Leaders.BasePersonaType` is what
Firaxis's alternate personas use to point at an existing leader; we set it to `LEADER_XERXES`
(an Antiquity king) and see what the shell does with it. Everything 2D — the hex portrait, the
circle mask, the loading screen — is a PNG we ship, exactly like the civ symbol.

## 4. Files

Mirrors `Byzantium/` one for one, plus the leader:

```
Etruscans/
  etruscans.modinfo
  config/config.xml, config-traditions.xml, config-leader.xml
  data/
    civilizations-legacy.xml, civilizations-shared.xml, civilizations-shared-gameeffects.xml
    civilizations-antiquity.xml, civilizations-exploration.xml, civilizations-modern.xml
    civilizations-gameeffects.xml
    leaders.xml, leaders-gameeffects.xml
    units.xml, units-gameeffects.xml
    constructibles.xml, constructibles-gameeffects.xml, greatworks.xml
    traditions.xml, traditions-gameeffects.xml, traditions-persist.xml,
    traditions-gameeffects-persist.xml
    progression-trees-culture-unique.xml, -ex.xml, -mo.xml, progression-trees-tech.xml
    unlocks-base-standard.xml, unlocks-antiquity.xml, unlocks-syncretism.xml
    citizen-names.xml, loading-info.xml, narrative-display.xml, visual-remaps.xml, icons/icons.xml
  icons/  civ_sym_etruscans.png, unitflag_biga.png, unitflag_tyrrhenian_galley.png,
          buildicon_cuniculus.png, buildicon_tumulus.png, wondericon_fanum_voltumnae.png,
          leader_porsenna.png
  text/en_us/  CivilizationText, CivilizationLegacyText, CityNamesText, CitizenNamesText,
          UnitText, ConstructibleText, CultureText, UnlockText, LoadingText, LeaderText,
          ModuleText, CivilopediaText
```

Naming note carried over from Byzantium: imported PNG basenames must be unique per mod and are
addressed as `fs://game/etruscans/<basename>`.
