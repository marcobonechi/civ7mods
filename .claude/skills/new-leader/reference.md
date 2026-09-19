# Leader mod reference

Read from the installed game (the Ada Lovelace DLC, base modules, the 1.5 UI) and from building
Porsenna (`Etruscans/`) and Lorenzo (`Tuscany/`). Paths are relative to
`.../CivilizationVII.app/Contents/Resources/` unless stated. Tables shared with civilizations
(unlocks, syncretism, `LeaderCivilizationBias` and the rest) are described in
`.claude/skills/new-civilization/reference.md` §3.

## 1. Files and tables

Template: `DLC/ada-lovelace/modules` (a leader-only DLC) plus `DLC/ada-lovelace-shell`. Worked
example: Porsenna, whose rows sit inside the Etruscans mod.

| File | Scope | Tables |
|---|---|---|
| `data/leaders.xml` | game, always | `Types` (the leader, its ability trait), `Traits`, `Leaders` (`InheritFrom="LEADER_DEFAULT"`, `IsMajorLeader`), `LeaderTraits` (ability, attribute and victory traits), `TraitModifiers` (ability effects and the agenda), `TypeQuotes`, `AiListTypes` / `AiLists` / `AiFavoredItems` |
| `data/leaders-gameeffects.xml` | game, always | the modifiers the ability traits point at, with their `SubjectRequirements` |
| `data/loading-info.xml` | game, always | `LoadingInfo_Leaders` (intro text tag, loading painting) |
| `data/civilizations-shared.xml` | game, always | `LeaderCivPriorities` (the AI's civ pick for this leader) |
| `data/unlocks-*.xml` | game | `REQSET_LEADER_IS_<LEADER>` (`REQUIREMENT_PLAYER_LEADER_TYPE_MATCHES`) and the unlocks that use it |
| `data/unlocks-syncretism.xml` | game | `LeaderSyncretismUnlocks` |
| `data/icons/icons.xml` | game **and** shell | the nine leader rows (§2) |
| `config/config-leader.xml` | shell | `Leaders`, `LeaderItems` (the ability shown in setup), `LeaderTags` (attributes, gender), `LeaderQuotes`, `LeaderUnlocks` |
| `config/config.xml` | shell | `LeaderCivilizationBias`, `LeaderUnlocks` rows naming a civilization |
| `text/en_us/LeaderText.xml`, `LoadingText.xml`, `CivilopediaText.xml`, `UnlockText.xml` | game **and** shell | names, ability, quote, intro, pedia |
| `ui/<mod>-images.js` | game **and** shell `UIScripts` | the `leaders` entry in its `CONFIG`: portrait files and the borrowed model (§3) |

A leader can live in a civ's mod (Porsenna) or in its own mod folder (the Ada Lovelace layout). In
its own mod it still needs the shared `ui/<mod>-images.js` copied from `Etruscans/ui/`, with only
the `CONFIG` block changed.

## 2. Art

The shell asks for `lp_circ_<leader>_*`, `lp_hex_<leader>_*` and `lsl_<leader>` by name; see the
naming-convention bullet in the civilization reference §4 for how the UI script serves them.

- **A leader's icon rows are not one image.** Copy `DLC/ada-lovelace/modules/data/icons/
  leader-icons.xml`: nine rows per leader, the default rows and the `LEADER_HAPPY` /
  `LEADER_ANGRY` contexts pointing at a **hex** crop with an explicit `IconSize`, and
  `CIRCLE_MASK` / `PORTRAIT_MASK` pointing at a **circle** crop. Pointing all of them at one
  square PNG is what makes a modded leader show up square in Leader Select while every shipped
  leader is round with a frame.
- **The hex images (`lp_hex_<leader>_{256,128,64}`) are cut-out busts, not hex-shaped paintings.**
  The diplomacy ribbon (`base-standard/ui/diplo-ribbon/panel-diplo-ribbon.js`) draws the hex
  background and frame itself (`final_leader-hex`, `hud_diplo_hex-frame`) in a 5.83rem slot, then
  lays the default-context leader icon over it at 6.5rem, shifted up 26.5% of the slot, and
  mirrored for everyone but the local player. The same rows, at 128, are the `LEADER_HAPPY` /
  `LEADER_ANGRY` faces the ribbon switches to with the relationship. Shipped images are a bust on
  transparency whose head rises above the frame. A painting cropped to a hex covers the frame and
  looks twice the size of its neighbours; the frame is a pointy-top hex about 47% of the icon wide,
  centred at about (50%, 72%) (measured on a screenshot of the 1.5 ribbon).
  `tools/leader-hex.sh <painting> <icons dir> <leader>` builds all three sizes: macOS Vision
  (`tools/lift-subject.swift`, subject lifting plus face detection, macOS 14+) cuts the leader off
  the painting, the face box is scaled to 30% of the canvas and centred at (50%, 63%), and below
  the frame's upper edge the bust is trimmed to the hex so the shoulders stay inside it. Feed it
  the full-resolution source painting (`icons/src/leader_<leader>.raw.jpg`), not the 256 icon.
  Porsenna and Lorenzo are built this way. A painted leader that faces sideways still reads as
  modded next to the 3D-rendered shipped busts; that is fine.
- **The `PORTRAIT_MASK` image (`lp_circ_<leader>_140`) is not a full-bleed circle.** Since 1.5
  the leader-select grid (`core/ui-next/screens/create-game/leader-select-button.js`) stacks
  three layers the size of the button: the `leader_box` square, the `PORTRAIT_MASK` icon at
  full button size (`.leader-button-portrait`, 7.78rem), and the XP ring (`LeaderXpRing`), whose
  `leaderselect_xp_well` background is the dark frame and whose bubble shows the level. Shipped
  portraits leave a transparent margin for that ring: the face disc is roughly 71-74% of the
  canvas (measured off a screenshot; the shipped textures are Oodle-compressed and cannot be
  read). A disc cropped edge to edge draws about a third larger than its neighbours and covers
  the box.
  The ring only renders when `level > 0`, and `level` comes from
  `Online.Metaprogression.getLegendPathsData()` (`LEGEND_PATH_<LEADER>`, 2K's online
  progression), which a mod cannot add to. A modded leader therefore never gets the frame or the
  level bubble. Do not fake the legend data: the same call feeds the profile page, legends
  manager, main menu and victories screens. Bake the frame into the image instead. Recipe used
  for Porsenna and Lorenzo, starting from the full-bleed 256 circle crop:

  ```bash
  magick icons/lp_circ_<leader>_256.png -resize 100x100 \
    \( -size 100x100 xc:none -fill white -draw "circle 49.5,49.5 49.5,0" \) -compose DstIn -composite /tmp/disc.png
  magick -size 140x140 xc:none -fill "rgba(24,26,32,1)" -draw "circle 69.5,69.5 69.5,17" \
    -stroke "rgba(92,96,108,0.9)" -strokewidth 1 -fill none -draw "circle 69.5,69.5 69.5,17.5" \
    /tmp/disc.png -gravity center -compose over -composite -depth 8 PNG32:icons/lp_circ_<leader>_140.png
  ```

  Only the 140 file gets this; the 256/128/64 `CIRCLE_MASK` crops stay full-bleed (other screens
  use them, and nothing there has shown a problem). Compare the result in the grid next to a
  shipped leader such as Pachacuti.

## 3. The 3D model

- **A mod cannot ship a leader 3D model, and `Leaders.BasePersonaType` does not substitute for
  one.** `core/ui/shell/leader-select/leader-select-model-manager.js` asks the engine for
  `<LEADER_TYPE>_GAME_ASSET` and falls through to `LEADER_FALLBACK_GAME_ASSET` - a faceless
  figure - when it resolves to nothing; `BasePersonaType` is read by the alternate-persona
  system, not by that lookup. Borrow a shipped leader's model in the UI script instead: proxy
  `WorldUI.createModelGroup` and wrap `addModel` / `addModelAtPos` on the group it returns,
  rewriting the asset name on the way in, and wrap `setAssetName` on every model those return.
  Since 1.5 the create-game screens (`core/ui-next/components/scene-3d.js`) add the leader model
  once and rename it on each selection; an unswapped `<LEADER_TYPE>_GAME_ASSET` sent through
  `setAssetName` crashes the game. See `Etruscans/ui/etruscans-images.js`; the block is shared
  (installed once by whichever civ script loads first), so keep it identical in every civ mod.

**Leaders work, with one more wrapper since 1.5.** Proxying `WorldUI.createModelGroup` and
rewriting the asset name in `addModel` / `addModelAtPos` gets the borrowed model accepted, but the 1.5 create-game screens place the leader once and switch it with
`model.setAssetName(...)` (`core/ui-next/components/scene-3d.js`). Wrap `setAssetName` on every
model the group returns as well. With all three covered, Leader Select shows Augustus for Porsenna
and Machiavelli for Lorenzo (seen in game 2026-09-16, Civilization VII 1.5.0); without the
`setAssetName` wrapper the unknown `LEADER_<X>_GAME_ASSET` reaches the engine and the game crashes
(SIGBUS on a `MainWorker` thread, the fault address in the GPU carveout range) a moment after the
leader is picked. To check an asset name before borrowing it, the 28,000-name
`remap/world-ui-asset-names.js` shipped with the Custom Civ Art Fixes mod lists every valid one.


**The other way: a 2D full-body portrait (Modworks Core).** The Venice Pack (Workshop 3770602022)
shows Enrico Dandolo in Leader Select as a still, full-length painting instead of a borrowed body.
The work is done by a separate mod from the same author, Modworks Core (Workshop 3766502959,
`ui/modworks-core-2d-leaderselect.js`, shell scope; read 2026-09-18):

- It wraps `WorldUI.createModelGroup` and then `addModel`, `setAssetName` and `setAlpha` on every
  handle the groups return — the same entry points as the model borrow above.
- When a handle is switched to a leader with no 3D asset, the engine puts a black silhouette on it.
  The script holds that handle at `setAlpha(0)` and paints the portrait in a `<div>` it inserts in
  the Leader Select screen's root (the parent of `.leader-select-leaders-panel`), so it sits above
  the 3D scene and below the grid: right 5%, bottom 4%, 38% wide, 84% tall, `background-size:
  contain`, anchored at the bottom, with a short fade-in.
- "Has no 3D asset" is decided by name since 1.5 (its own leader-type prefixes, e.g. `LEADER_VP_`,
  plus anything given to `ModworksCore.register2DLeader(leaderType, url)`); an `addModelAtPos`
  probe that returns null for a missing asset is kept behind `window.ModworksCoreProbe3D`.
- If `addModel` itself returns null (a modded leader remembered as the last selection), it re-adds
  `LEADER_FALLBACK_GAME_ASSET`, as the pre-1.5 leader-select code did, so the screen keeps working.
- It skips `setState` and `updateSelectionScriptParams` while a model-less leader is shown: in 1.5
  those drive the idle and voice-line animations, and there is no model behind the handle. That is
  the likely mechanism of the Porsenna crash in §3 — `setAssetName` to a missing asset leaves a
  silhouette, and the next `setState` on it brings the game down. A borrowed model never hits it,
  because the handle always holds a real asset.
- The portrait is found at `fs://game/lsl_<leader>` then `fs://game/lsl_<leader>.png`. Venice ships
  `lsl_vp_enrico_dandolo` as an 800×1080 full-length cut-out on transparency, imported with no
  extension and no folder (and its icon rows use the same bare `fs://game/<name>` form).
- The game-scope companion, `modworks-core-2d-diplomacy.js`, does the same in the diplomacy scene:
  it keeps `LEADER_FALLBACK_GAME_ASSET` alive at scale 0.001 (the cutscenes wait on a model's
  triggers) and draws the portrait over it, with optional angry/happy/unhappy/smug variants.

Choosing: the borrow gives an animated, voiced body with the wrong face, and needs nothing else
installed; the 2D route gives the right face, still, and either depends on Modworks Core (register
the leader with it and drop the borrow) or needs the same overlay in our own UI script. A full-length
cut-out can be made from a full-length painting with `tools/lift-subject.swift`.

## 4. Gameplay

- **Every shipped leader has a diplomatic agenda** (`EFFECT_DIPLOMACY_AGENDA_TIMED_UPDATE`, one
  `TraitModifiers` row, no other table involved) and the AI reads it; a leader without one is
  diplomatically inert. Copy the argument set from `MACHIAVELLI_MOD_AGENDA_THE_SPIDER` and pick
  a `WeightType` from the `DIPLOMACY_AGENDA_COMPARE_*` list in `base-standard/data`. While you
  are there: the base game's median leader has five ability modifiers, not three.
- **An agenda needs three text rows, not two.** Besides the `Tooltip` tag (`..._DESC`), the 1.5
  agenda popup (`base-standard/ui-next/screens/diplo-message/diplo-message-popup.js`) shows the
  `Tooltip` tag with `_LIKES` appended when the relationship went up and `_DISLIKES` when it went
  down. Without those two rows it prints the raw `LOC_..._DESC_LIKES` id. 25 of the 26 shipped
  agendas define both; copy their wording: `DESC` states the rule ("Likes Leaders with ... Dislikes
  those ..."), `_LIKES` / `_DISLIKES` are one sentence each, starting with the leader's name.
- **`AWARD_HIGHER` / `AWARD_LOWER` compare against the agenda's owner**, `AWARD_HIGHEST` /
  `AWARD_LOWEST` against everyone. Hatshepsut (`HIGHER` with a negative amount, `LOWER` with a
  positive one) dislikes leaders with more Wonders than her and likes those with fewer. The sign of
  `AwardAmtType` (`..._AMT_...` or `..._NEG_AMT_...`) decides like or dislike, so write the text
  from the arguments, not from the intent.
- Some weight types take extra arguments; copy them from a shipped agenda with the same
  `WeightType`. `DIPLOMACY_AGENDA_COMPARE_DISTRICT_BUILDINGS` takes `Arg1` (the district type,
  e.g. `DISTRICT_URBAN`) and `Arg2` (the minimum number of buildings for a district to count;
  Lafayette's 2 means Quarters).
