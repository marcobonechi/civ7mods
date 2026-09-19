---
name: new-leader
description: Add a new playable leader to the civ7mods repository for Civilization VII, either inside an existing civilization mod or as its own mod folder (leader data and ability, shell config, text, Leader Select and diplomacy-ribbon portraits, borrowed 3D model, unlocks). Use when asked to create, scaffold, or extend a Civ 7 leader.
---

# New leader

Builds a leader the way Firaxis ships one, modelled on the Ada Lovelace DLC (a leader-only
DLC). Read `reference.md` in this folder for the tables, the portrait slots and the model borrow,
and look at Porsenna (`Etruscans/`) for a worked example. A new civilization is a separate job:
`.claude/skills/new-civilization`. When a civ and its leader are made together, build the civ
first, then run this skill for the leader.

## Ground truth to consult first

- Game data (macOS Steam):
  `~/Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources/`
  - `DLC/ada-lovelace/modules` and `DLC/ada-lovelace-shell` the template for a leader
  - `Base/modules/base-standard/data/leaders*.xml` every shipped leader's ability and agenda
  - `Base/modules/base-standard/data/icons/leader-icons.xml` the icon rows
  - `Base/Assets/schema/gameplay/01_GameplaySchema.sql`, `Base/Assets/schema/frontend/schema-frontend-50-setup-data.sql`
- Logs: `~/Library/Application Support/Civilization VII/Logs/` (`Database.log`, `Modding.log`,
  `UI.log` for the model and portrait lines).

Never invent a table, column, effect, requirement or modifier id. Grep it in the base modules
first and copy a working row.

## Intake: ask before building

Do not start from guesses. Before any file is written, ask the user in **two rounds**, each one
message, and wait for the answers. Say which items you can draft ("leave blank and I will
propose") so they only fill what they care about. Anything still open after both rounds is
proposed in the design sheet (step 1) and confirmed there, not decided silently.

**Round 1 — names and the art to start from.** One plain message with a checklist to fill in
(not `AskUserQuestion`: these are free-text answers):

- Name and epithet, gender, a one-line quote for Leader Select, a short loading-screen intro.
- Which civilization they belong to (an existing mod here, or a shipped civ), and whether the
  leader goes into that civ's mod or into a mod folder of its own.
- How the leader stands in Leader Select: a borrowed shipped leader's 3D model (animated and
  voiced, the wrong face; offer two or three candidates that fit the era and dress, e.g. Augustus
  for Porsenna), or a still full-length 2D portrait the way the Venice Pack does it (the right
  face; needs a full-length painting, and Modworks Core or our own overlay — reference.md §3).
- Art they already have, as file paths. Say what each becomes, and that a missing one gets a
  generator prompt in the style of `plans/etruscans-tuscany-art.md` §2:
  - a square painting, ideally 1024² or larger, head and shoulders with space above the head,
    kept in `icons/src/leader_<leader>.raw.*` → `leader_<leader>` (256), the `lp_circ_*` circles
    for Leader Select, the `lp_hex_*` busts for the diplomacy ribbon (`tools/leader-hex.sh`) and,
    cropped to 2:3, `lsl_<leader>` (720×1080);
  - optionally a 16:9 painting for the loading screen (`LoadingInfo_Leaders.LeaderImage`); the
    civ's loading painting is used otherwise.

**Round 2 — what makes them special.** Ask for the gameplay in plain language; they do not need
to know effect ids:

- The ability: its name and what it does. The median shipped leader has five modifiers; three to five
  is right.
- Two attributes, from the six the game has: Cultural, Diplomatic (`TAG_TRAIT_POLITICAL`),
  Economic, Expansionist, Militaristic, Scientific. List all six in the message;
  `AskUserQuestion` offers at most four options, so it cannot carry them.
- The diplomatic agenda: what the leader likes and dislikes in other players (every shipped
  leader has one, reference.md §4).
- Unlocks: which civilizations this leader unlocks in each age, and any syncretism pairings. The
  AI's preferred civ.

Then map every answer onto an effect the game already has: grep `base-standard/data/leaders*.xml`
and the DLC leaders for a working row. Report back any part of the ability with no existing
effect, with the nearest thing that does exist, before building it.

## Procedure

1. **Design sheet**, from the intake answers: `LEADER_X`, `TRAIT_LEADER_X_ABILITY`, the ability's
   modifiers (each with the base row it copies), attributes, agenda, victory traits, unlocks, the
   borrowed model, the art slots. Write it into the civ's `plans/<civ>.md` (a "Leader" section,
   as `plans/etruscans.md` §3) or `plans/<leader>.md` for a standalone mod.
2. **Data** (reference.md §1): `data/leaders.xml`, `data/leaders-gameeffects.xml`,
   `data/loading-info.xml`, `LeaderCivPriorities`, and the text files. A standalone mod copies the
   Ada Lovelace modinfo layout and drops the movie, dialog, memento, narrative and
   metaprogression groups.
3. **Shell** (`config/config-leader.xml`, `LeaderCivilizationBias` in `config/config.xml`), and the
   text and icon files in the shell scope too. Install, launch: the leader appears in Leader
   Select with the right ability text and attributes.
4. **Portraits** (reference.md §2). Nine `IconDefinitions` rows (hex crops for the default,
   `LEADER_HAPPY` and `LEADER_ANGRY` rows, circle crops for `CIRCLE_MASK` and `PORTRAIT_MASK`), in
   both scopes.
   - `lp_circ_<leader>_{256,128,64}`: full-bleed circle crops of the painting.
   - `lp_circ_<leader>_140`: padded, with a baked frame (recipe in reference.md §2). A modded
     leader never gets the level ring that frames the shipped ones.
   - `lp_hex_<leader>_{256,128,64}`: cut-out busts for the diplomacy ribbon,
     `tools/leader-hex.sh icons/src/leader_<leader>.raw.jpg <Mod>/icons <leader>`.
   - `lsl_<leader>` (720×1080) and `leader_<leader>` (256).
5. **Model** (reference.md §3). Add the leader to the `leaders` list in `ui/<mod>-images.js`
   (`{ id, type, model, portrait }`). The shared hook block must stay identical in every civ mod's
   copy, and must rewrite the asset name in `addModel`, `addModelAtPos` **and** `setAssetName`;
   missing the last one crashes the 1.5 Leader Select.
6. **Unlocks**: `REQSET_LEADER_IS_<LEADER>`, the civ unlocks in each age, `LeaderUnlocks` in the
   shell, `LeaderSyncretismUnlocks`. Guard DLC-only rows with `ModInUse` criteria.
7. **Verify in game.**
   - Leader Select: the portrait sits in the grid like its neighbours, and picking the leader
     shows the borrowed model without a crash. `UI.log` has
     `civ7mods: leader model LEADER_X_GAME_ASSET -> ... (accepted)`.
   - Start a game with the leader, and another where the AI has them: the ribbon shows the bust
     with the head above the frame, and the ability works (check the modifiers in the pedia and
     in play).
8. **Polish**: civilopedia text, AI favoured items, README section, version bump, commit with jj.

## Checks before every install

```bash
find <Mod> -name '*.xml' -exec xmllint --noout {} +
python3 tools/check-mod.py <Mod>      # LOC tags and type references
python3 tools/check-ages.py <Mod>     # foreign keys that break in one of the ages the file loads in
./install.sh <Mod> && open -a "Sid Meier's Civilization VII"
grep -n -i "error\|failed\|constraint" ~/Library/Application\ Support/Civilization\ VII/Logs/Database.log
```

A leader in its own mod that names a modded civ checks with the civ as a companion
(`tools/check-mod.py <Mod> --with <Civ>`).
