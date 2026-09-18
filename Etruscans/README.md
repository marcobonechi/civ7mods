# Etruscans — an Antiquity Age civilization

Twelve peoples between the Tiber and the Arno: engineering and the good life. Install `Etruscans/`
like the other mods (`./install.sh Etruscans`); with the map mod installed it starts at Populonia
on all four Europe maps. Pickable at an Exploration or Modern start too, listed there as
"Etruscans (Time-Tested)".

| Item | What it is |
|---|---|
| Ability: Disciplina Etrusca | +1 Production and +2 Happiness in every Settlement; +15% Production toward Buildings; +45% toward the Fanum Voltumnae |
| Biga | Replaces the Chariot: faster, stronger, +4 Combat Strength on flat ground |
| Tyrrhenian Galley | Replaces the Galley: +1 Movement, +1 Sight, +5 Combat Strength against ships |
| Spura | Unique quarter of Cuniculus (Food, Production) and Tumulus (Culture, Happiness): +1 Production, Culture and Happiness in this Settlement for every Settlement you own |
| Fanum Voltumnae | Associated wonder, the League's federal sanctuary: Culture, Influence per Settlement, a Relic on completion, 2 Great Work slots |
| Civics | Cuniculi, Dodecapolis, Haruspicina; six traditions, plus Test of Time nodes for Exploration and Modern |
| Leader: Porsenna | Militaristic + Scientific. Lars of Clusium: +2 Production in Cities, +20 Health on Districts with a Fortification, +3 Combat Strength defending one of your Districts |
| Unlocks | Leaders Porsenna and Augustus, or holding a Bath in three Settlements. Leads to the Normans, and to Tuscany when that mod is installed |

## Notes on the Etruscans and Tuscany

- **They know about each other, but neither needs the other.** The Etruscans-to-Tuscany link lives
  behind `ModInUse` / `ModIsEnabled` criteria in both modinfos, so either folder installs alone.
- **Central Italy is crowded.** The map script keeps starts apart — five hexes on the standard
  grids, eight to ten on the large ones — and no Etruscan city is that far from Rome; Italy is
  barely three hexes wide at the smaller sizes. Etruria starts at Populonia, which is the furthest
  any of its cities gets (two hexes from Rome on Tiny, six on the largest grid) without landing on
  top of Florence the way Volaterrae would. When Rome is also in play one of the two still takes a
  fallback site; Populonia, Tarquinia and Florence are all in the fallback list, so a displaced
  player stays in Italy. Etruria and Tuscany are meant to be played one after the other rather
  than side by side.
- **True starts on the base game's Earth map too** (Civilization VII 1.5, Antiquity starts only):
  Byzantium at Constantinople (58,46, the tile the game gives the Ottomans), the Etruscans at
  Populonia (50,45) and Tuscany at Florence (50,46), with Rome at (51,44). The game hard-codes those
  starts in its map script and reads no table, so each of the three civ mods (Byzantium included)
  ships the same patched copy of `base-standard/maps/EarthMaps/Earth_Huge.js`, a same-path override.
  Another mod replacing that file wins or loses as a whole, and a game patch that changes the stock
  script needs `python3 tools/earth-tsl.py` rerun (`--check` reports a stale copy). The map's own
  spacing check moves anyone within 3 hexes of another start to a random site, so Rome, Etruria and
  Tuscany in one game means only one of them stays in Italy — the same trade the game already makes
  for Babylon and Assyria.
- **Art is placeholder.** Icons and loading screens are flat generated PNGs
  (`tools/make-icons.py`, `tools/make-backgrounds.py`); units and wonders borrow the models of what
  they replace through `data/visual-remaps.xml`. Buildings cannot: a `VisualRemap`'s `To` has to
  name something in the art data, and unit and wonder assets are named after their type while a
  building's model is chosen by a rule in `BIN_Hero_Building_Footprint` keyed on
  `[BUILDING:<type>]`. So each mod ships a small binary art package
  (`Tuscany/dlc/TuscanyArt/`, `Etruscans/dlc/EtruscansArt/`, ~40 KB, no geometry of its own) that
  adds those rules: the Bottega renders as the Guildhall and the Banco as the Bank, the Cuniculus
  as the Bath and the Tumulus as the Mastaba. Rebuild either with
  `python3 tools/build-art.py Tuscany Etruscans`, and check a deployed one with
  `tools/check-art.py <Mod>`. Because it is an art package it installs into the game's `DLC/`
  folder rather than `Mods/` — the install scripts do that, and `uninstall.ps1` removes it.
- **The shell finds that art through a UI script.** `ui/<mod>-images.js` rewrites the
  naming-convention lookups the shell uses for civ and leader art (`bg-panel-<civ>`,
  `bg-card-<civ>`, `civ_sym_<civ>`, `lp_circ_<leader>_256` and the rest) to the
  `fs://game/<modid>/<file>` URLs a mod can actually serve. It hooks the CSSOM and Image
  prototypes rather than watching the DOM, because a MutationObserver does not see programmatic
  style changes here and the age-transition screens assign `style.backgroundImage` directly. The
  same file, with a different CONFIG block, is in all three civ mods and they share one set of
  hooks. `plans/byzantium-art.md` §4 has the detail.
- **The leaders borrow a model.** A mod cannot add a leader model: the shell asks the engine for
  `<LEADER_TYPE>_GAME_ASSET`, and `Leaders.BasePersonaType` does not change that lookup. The UI
  script rewrites the name instead, so Porsenna is shown with Augustus's model and Lorenzo with
  Machiavelli's. Since Civilization VII 1.5 leader select switches models with `setAssetName`,
  which the script also rewrites; without that, picking either leader crashed the game.
- **Leader-select portraits carry their own frame.** Shipped leaders get a dark frame and a level
  badge from 2K's online legend progression, which a mod cannot add to. `lp_circ_<leader>_140.png`
  is therefore drawn smaller than the button with the frame painted in, so it lines up with its
  neighbours.
- Design sheets, the running work log, and the art brief with a generation prompt for every PNG:
  [`plans/etruscans.md`](../plans/etruscans.md), [`plans/tuscany.md`](../plans/tuscany.md),
  [`plans/etruscans-tuscany-log.md`](../plans/etruscans-tuscany-log.md),
  [`plans/etruscans-tuscany-art.md`](../plans/etruscans-tuscany-art.md).

Installing, game versions and releasing are shared by every mod in this repository and described in the [main README](../README.md).
