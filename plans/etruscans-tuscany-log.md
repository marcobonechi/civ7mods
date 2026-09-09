# Etruscans and Tuscany — work log

A running record of what was built, in what order, and what is still open. Marco asked for this so
the history is readable and easy to adjust; each entry corresponds to one or more commits.

Design sheets: [etruscans.md](etruscans.md), [tuscany.md](tuscany.md).
Art brief and prompts: [etruscans-tuscany-art.md](etruscans-tuscany-art.md).
Recipe: `.claude/skills/new-civilization/` (`SKILL.md` + `reference.md`). Worked precedent:
[byzantium.md](byzantium.md) and the `Byzantium/` folder, which both mods copy structurally.

## Plan of work

1. Design sheets (this and the two above). ✅
2. `Etruscans/` identity: modinfo, `civilizations-legacy`, `civilizations-shared`, `config/config.xml`,
   text, icons, visual remaps.
3. `Etruscans/` content: units, quarter + wonder, civic tree, traditions, unlocks, Test of Time.
4. `LEADER_PORSENNA` inside the Etruscans mod.
5. `Tuscany/` identity, then content, then the Maestro Great Person class.
6. `LEADER_LORENZO` inside the Tuscany mod.
7. True starts on the three Europe geo files; README; checks; install.

## Decisions worth knowing

- **One mod per civ, leader included.** `Etruscans/` ships Porsenna, `Tuscany/` ships Lorenzo.
  Firaxis splits leaders into their own DLC, but a leader that only makes sense beside its civ is
  easier to install and version as one folder. Both are picked up by `install.sh` automatically
  (it mirrors every top-level folder holding a `.modinfo`).
- **Both civs are playable in every age**, the way Byzantium is: one shell `Civilizations` row per
  age domain, the non-apex ones labelled "(Time-Tested)", plus a node in the shared Test of Time
  civic tree for each other age. Only the apex age gets unique units, because `UnitReplaces` is a
  foreign key to units that exist in one age only.
- **Etruscans lead to Tuscany.** Rome and Greece also lead to Tuscany; Etruscans also lead to
  Norman. Tuscany leads to America (Amerigo Vespucci gave the hemisphere its name) and to the
  French Empire (Napoleon's Kingdom of Italy).
- **No art packages.** Byzantium needed one for the Hagia Sophia; these two use `VisualRemaps`
  only, so they install by copying a folder and need nothing inside the game bundle.
- **Leader 3D is borrowed, not shipped.** The shell asks the engine for
  `<LEADER_TYPE>_GAME_ASSET`; a mod cannot add one. `Leaders.BasePersonaType` is Firaxis's own
  mechanism for alternate personas and is the closest thing to a fallback; failing that the engine
  uses `LEADER_FALLBACK_GAME_ASSET`. Everything 2D is a PNG we ship. Open question, to be answered
  in game.

## Log

### 2026-09-09 — design sheets

Read the skill and `reference.md`, read every file in `Byzantium/` as the template, and read the
game's own data for the pieces the skill does not cover:

- `DLC/ada-lovelace/` — the shape of a leader: `Leaders`, `LeaderTraits`, `TraitModifiers`,
  `AiLists`, and the shell's `Leaders` / `LeaderItems` / `LeaderTags` / `LeaderQuotes` /
  `LeaderCivilizationBias` / `LeaderUnlocks`.
- `DLC/*-alt/data/leaders.xml` — `BasePersonaType`, how an alternate persona borrows a leader.
- `core/ui/shell/leader-select/leader-select-model-manager.js` — leader models are looked up as
  `<LEADER_TYPE>_GAME_ASSET`, fallback `LEADER_FALLBACK_GAME_ASSET`.
- `age-antiquity/data/greatpeople.xml` (Logios) and `age-exploration/data/greatpeople.xml` (Alim)
  — the Great Person class + named individuals pattern that the Maestro copies.
- Base unit lines, wonder lists, civic node costs, attribute and victory trait names, so nothing
  below is invented.

Wrote `plans/etruscans.md` and `plans/tuscany.md`.

### 2026-09-09 — both mods built

`Etruscans/` and `Tuscany/` complete: 48 and 50 XML files, following the Byzantium layout file for
file, plus `data/leaders.xml` / `data/leaders-gameeffects.xml` in each and
`data/greatpeople.xml` / `data/greatpeople-gameeffects.xml` in Tuscany for the Maestri. True
starts on all three geo files, README sections, placeholder icons and backgrounds.

Verified so far:

- `xmllint` clean on every file in both mods.
- `tools/check-mod.py Etruscans --with Tuscany` and the reverse: clean. The `--with` flag is new;
  without it each mod reports the other's types as unknown, because the cross-mod unlocks sit
  behind `ModInUse` / `ModIsEnabled` criteria.
- `tools/check-ages.py`: clean on all three mods. Also new — see below.
- The game loads both mods and the **shell database passes foreign-key validation** with no
  errors in `Database.log` and nothing in `Modding.log`.

Still to check in game (the game-scope tables are only built when a game is created, so a clean
main menu says nothing about them):

1. New Game → Antiquity → Etruscans, Europe & Mediterranean map. Confirm the civ symbol and card,
   the picker items, a start at or near Tarquinii, then build a Biga and open the civics tree.
2. New Game → Exploration → Tuscany. Same, then build a Bottega and a Banco in one district to
   form the Piazza, and confirm a Maestro can be trained and retired.
3. Whether `BasePersonaType` gives Porsenna and Lorenzo a 3D leader, or whether they fall back to
   the generic model.
4. Whether the wonder and building visual remaps take (Fanum Voltumnae on the Oracle, Santa Maria
   del Fiore on Notre-Dame). Byzantium ended up building an art package for its wonder; if the
   remap is enough, these two need none.

### 2026-09-09 — a correction, and a new checker

Partway through I "fixed" a bug in Byzantium that was not one. The reasoning was that
`TRAIT_EXPLORATION_CIV` is declared by the age-exploration module, so a `CivilizationTraits` row
naming it in an always-loaded file would fail its foreign key in Antiquity and Modern games and
take the whole file down with it. Wrong: **all three age modules load in every game**, and each
loads its `civilizations-shared.xml` (where its `TRAIT_<AGE>_CIV` is declared) under an `always`
criteria. Only the groups behind an `AgeInUse` / `AgeAtOrBefore` criteria are age-scoped —
`units.xml`, `progression-trees-tech.xml`, `constructibles.xml`, the per-age
`civilizations-<age>.xml`. That is the real reason `UnitReplaces` cannot name an out-of-age unit.

Byzantium is back the way it was, and the Etruscans and Tuscany rows moved back into
`civilizations-shared.xml` to match. The rule is now written down in the skill's `reference.md`.

Out of that came `tools/check-ages.py`, which does the check properly: it reads the FOREIGN KEY
declarations out of the game's gameplay schema, works out which ages each of a mod's files is
loaded in from the modinfo criteria, models the always/age-gated split inside the base age modules,
and reports only genuine unresolvable keys. All three mods are clean under it.

### 2026-09-09 — art brief

`plans/etruscans-tuscany-art.md`: the slot inventory for both mods (what each PNG is, what size it
should be, and what the game does to it), a prompt per asset, and tested ImageMagick recipes for
turning generator output into the files the game wants — white-on-black keyed to a white mask for
the symbol and unit flags, a flood-fill for the colour icons, and the crops for the four
background sizes. Nothing in the XML has to change when the real art lands: the icon rows already
name every file and carry no size, so a 256 square drops in over the 128 placeholder.

### 2026-09-09 — the background wall, solved

The card, panel and vertical-card art had never shown for any of our civs. Diagnosed and fixed.

The shell asks for civilization and leader art **by naming convention**, not through
`IconDefinitions`, and hands the names to a package-texture lookup that cannot open a mod's loose
PNG: `bg-panel-<civ>`, `bg_panel_<civ>`, `bg-card-<civ>`, `civ_sym_<civ>`, and for leaders
`lp_circ_<leader>_256`, `lp_hex_<leader>_256`, `lsl_<leader>`. Two screens build the flat form
`fs://game/bg-card-<civ>.png`, which is a package lookup too, and some callers prepend `blp:` to
an `fs://` URL they were handed, which then fails as `blp:fs://…`.

Why the first attempt did nothing — both found by reading the shipped UI, one of them corroborated
by a comment from the Custom Civ Art Fixes author:

1. **A MutationObserver does not report programmatic style changes in this engine.** Watching the
   style attribute catches HTML that arrives with an inline style, and nothing else. The old
   `byzantium-images.js` was an observer plus a `UI.getIconBLP` wrap, so it never fired.
2. **`el.style.backgroundImage = x` goes through the CSSStyleDeclaration accessor, not
   `setProperty`.** Both Workshop frameworks hook only `setProperty`, so they miss
   `age-transition-civ-card.js:163` and `age-transition-civ-select.js:487` — which is exactly
   where the card and the details panel are set. That part appears not to have worked for anyone.

The rewritten script hooks `setProperty`, the `backgroundImage` accessor,
`Element.prototype.setAttribute` for `src`, and the `HTMLImageElement` `src` accessor — the last
with its getter preserved, because `ui-next/utilities/image-cache.js` compares `image.src` back
against the URL it assigned and rejects when they differ. `WorldUI.addBackgroundLayer` gets the
overlay-div treatment, since it takes a bare texture name and never touches the DOM. The registry
and the hooks live on `window`, so the three civ mods coexist and only the first to load installs
them. Identical file in all three, differing only in the CONFIG block at the top.

**How it was verified without navigating the UI.** The main-menu preloader
(`main-menu-asset-preload.js`) requests every one of these names for every owned civ and leader,
and `Logs/UI.log` records `Failed loading resource: blp:<name>` for each miss. Baseline: three
lines per civ of ours, plus three per leader. After the fix: **none**, while other people's mod
civs in the same load order still produce theirs — a control group that came free. Stripping
`blp:` from `blp:fs://…` turned out to fix the vertical-card lookup for every mod civ in the load
order, not only ours.

Also added, since the log named them: `lp_circ_<leader>_256`, `lp_hex_<leader>_256` and
`lsl_<leader>` files for Porsenna and Lorenzo, cropped from the placeholder portraits with the
commands in the art brief, and listed in both `ImportFiles` blocks.

Still to see with human eyes: the card and details panel on the age-transition screen and the
picker background, which need an actual game to reach. The token mapping and the image path are
proven; the CSS accessor hook is installed the same way but is only exercised on those screens.

Deliberately **not** done: registering in `CivsWithoutBackgrounds`. Our own hook covers the same
ground, and registering would make the two Workshop frameworks draw a second overlay over ours.

### 2026-09-09 — the icons were never committed

Caught while committing the background fix: `.gitignore` ignores `*.png` (for screenshots) and
un-ignored it again with an allow-list that named only `Byzantium/`. So every PNG in `Etruscans/`
and `Tuscany/` — the whole placeholder set from the first commit — was silently untracked, and
anyone cloning the repo would have got two mods with no art at all. `install.sh` copies the
working tree, so it never showed up locally.

The allow-list is now a pattern (`!*/icons/*.png`, `!*/icons-*/*.png`, `!*/loading/*.png`), so the
next civilization does not have to remember this.

### 2026-09-09 — first real icon: the Cuniculus

Marco generated the Cuniculus from the brief and it went straight in. The generation read the
prompt as a cutaway block of tufa rather than a tunnel mouth in a hillside, which is the better
icon: the shaft of light down the vertical well and the water channel running out are both legible
at 64 px, which is the size that matters.

Processing it turned up two things the brief had not accounted for, so it now does:

- The generator signs its work with a small sparkle in the bottom-right corner. It is not the
  background colour, so keying leaves it behind as an opaque white blob; it has to be painted out
  first.
- The subject is not centred in the frame and the background is not the grey the prompt asked for
  (this one came back at #7e7e7e). So the pipeline has to sample the background, key from all four
  corners, trim to the subject and re-centre — not just flood-fill and resize.

`tools/art-icon.py` now does all four steps in one command, with `--silhouette` for the
white-mask assets. The raw generation is kept at `Etruscans/icons/src/buildicon_cuniculus.raw.png`
so the icon can be re-cropped later; `.gitignore` un-ignores `*/icons/src/*.png` for that.

23 assets to go.

### 2026-09-09 — the Tumulus, and two corrections to the tool

The Tumulus came in and broke `art-icon.py` twice, both worth having found now rather than on the
twentieth asset.

- **The fixed fuzz was too aggressive.** At 18 the key ran out of the background and into the dry
  grass of the mound, leaving a hole across the top right that only showed on a bright test
  background. Sweeping the fuzz shows a clear plateau — coverage sits at ~56% from 4 to 15 and
  falls to 48% at 18 — so the tool now sweeps and takes the largest value before the cliff. Both
  Etruscan icons land on 10.
- **The watermark box was guesswork, and wrong.** I had it inset 4% with a side of 7.5%, which on
  a 1024 image is 908..984; the sparkle is actually at 880..927. So it was being half-missed —
  including in the Cuniculus I committed an hour ago, which shipped with the mark still in it.
  Fixed properly: the mark is removed *after* the key, where it survives as a small opaque island
  separate from the subject. The tool labels the islands with ImageMagick's connected-components,
  keeps the largest and drops the rest, which also sweeps up the speckle. Detecting it before the
  key cannot work — the subject often reaches into the same corner.

Both icons re-processed and re-installed. Verified on a red background, which is the only way the
transparency holes and the leftover sparkle were visible at all; on the dark panels the game uses,
both defects were invisible.

One thing for Marco to decide: the Tumulus came back flat and cel-shaded, the Cuniculus painterly.
They do not quite belong to the same set. Better to settle the register before generating the
other twenty-two.

### 2026-09-09 — the Tarquinia painting

The 16:9 landscape came back almost exactly as the brief described it: the ridge city with the
Tuscan-order temple on the high point, the tumulus field laid out along cut streets, the cuniculus
spilling into an irrigated field in the foreground, two figures on the track. It feeds three files
— the two loading sizes and the picker panel — all installed.

The signature needed a different approach here. On an icon it is found automatically, because
after keying it survives as a small opaque island apart from the subject. A painting has nothing
to key, and colour will not separate it: it is a pale translucent star, and warm sunlit dirt reads
exactly the same — a relative-saturation test flagged 5,224 pixels of footpath along with it. So
`tools/art-background.py` takes the box explicitly (`--inspect` writes magnified corner crops to
read it off) and clones a feathered ellipse of nearby ground over it.

The clone source matters more than expected. The first automatic offset reached far enough above
the mark to pull a tomb doorway down into the middle of the footpath — an obvious ghost. Shortened
the default and the tool now always writes a before/after crop, because whether the clone lands on
plain ground or on a building is luck.

One thing to change on the generator side: this arrived at 1024×572 and had to be upscaled 1.89×
to fill 1920×1080. The brushwork hides it and it holds up at 1:1, but that is the limit. Ask for
1920 wide or more; the smaller outputs are then downscales, which is always better.
