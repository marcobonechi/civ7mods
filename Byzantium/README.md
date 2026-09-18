# Byzantium — a civilization mod for Civilization VII

An Exploration Age civilization that can also be picked at an Antiquity or Modern start. Install
`Byzantium/` like the map mod (`./install.sh Byzantium`); with the map mod installed it starts at
Constantinople on all four Europe maps.

| Item | What it is |
|---|---|
| Ability: Queen of Cities | +1 Influence and +1 Gold per Great Work displayed in a settlement; +3 Combat Strength when defending your districts and +20 district health where a fortification stands; +30% Production toward Hagia Sophia |
| Cataphract | Cavalry line replacing Courser, Knight and Lancer (+2 Combat Strength, +3 against infantry); an Antiquity variant replaces the Horseman |
| Dromon | Replaces the Cog (Greek fire: +5 against naval units); an Antiquity variant replaces the Galley |
| Augustaion | Unique quarter of Hippodrome (Culture) and Great Palace (Influence): +2 Happiness per Great Work displayed in the city |
| Hagia Sophia | Associated wonder: +4 Culture, +2 Influence, 3 Great Work slots, a Relic on completion |
| Civics | Themata, Pentarchy, Porphyrogennetos, each with a tradition; Test of Time nodes for Antiquity and Modern |
| Unlocks | From Rome and Greece, or with Augustus, Catherine, Charlemagne, Xerxes; in Antiquity by holding Ancient Walls in three settlements. Leads to Russia (and the Ottomans when that DLC is present) |

Antiquity (Time-Tested) uniques: the Clibanarii (heavy cavalry on the Horseman, Iron Working), the Liburna (fast
galley on the Galley, Sailing), and the Cistern and Milion, which form the Mese quarter (Gold per settlement); the
Origins civic unlocks the buildings and the Themata I and Foederati traditions. Exploration uniques: Cataphract,
Dromon, Hippodrome and Great Palace (Augustaion), Hagia Sophia. Unique units and buildings borrow the models of the base units and buildings they replace
(`data/visual-remaps.xml`). Icons: the default set in `Byzantium/icons/` mixes the painted eagle
and building medallions (cut from a concept sheet, kept in `icons-alt/`) with vector unit
silhouettes (`icons-vector/`, sources in `icons/src/`); `tools/switch-icons.sh Byzantium alt|vector|mixed`
swaps between them; all icons are 256 px, and `portrait_*.png` are full-colour unit portraits awaiting the
unit-panel hook described in `plans/byzantium-art.md`. `Byzantium/dlc/ByzantiumArt/` is a binary art package
(a `.dep` plus `Platforms/<OS>/BLPs/StandardAsset.blp`, identical bytes for Mac and Windows) that gives Hagia
Sophia its own wonder art, copied from the Blue Mosque's attachment set, and renders the Hippodrome with the
Arena's model; it was built with Smayo's Civ Art
Tools from `Byzantium/dlc/civart.json`, and `install.sh` / `install.ps1` mirror it into the game install's
`DLC/` folder because the engine only looks for art packages there (set `CIV7_GAME_ROOT` if the Steam
library is elsewhere). The modinfo switches it on with `<UpdateArt><Item>ByzantiumArt</Item></UpdateArt>`
in both scopes. `Byzantium/loading/` holds the painted loading screen (1080 and 720 variants) and the
civilization-select card; the `source-*.png` files are the untouched generations. `lsbg_byzantium_emperor_1080.png` is an
alternate loading painting (emperor portrait); point `data/loading-info.xml` and the BACKGROUND rows in
`data/icons/icons.xml` at it to use it. Design notes and the verification record are in `plans/byzantium.md`; the recipe for the
next civilization is `.claude/skills/new-civilization/`.

Installing, game versions and releasing are shared by every mod in this repository and described in the [main README](../README.md).
