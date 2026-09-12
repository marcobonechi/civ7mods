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

### 2026-09-09 — Tarquinia regenerated larger

Marco regenerated the landscape at 1376×768 instead of 1024×572. Worth it: the upscale to
1920×1080 drops from 1.89× to 1.41×, and checking the temple side by side at matched scale, the
extra pixels are real detail — the column flutes and the antefixes along the ridge are crisper,
not just larger. Same composition, so nothing else changed.

The signature moved with the render, to 1237,622 (42×52), and this time the clone needed three
attempts. Straight up pulled a tomb doorway into the middle of the footpath; left pulled in a
headless copy of one of the walking figures; down re-cloned the mark's own top point back in.
Up-and-right landed on plain bank and is clean at 1:1 in the delivered file. A blur fill was tried
as an alternative and is worse — it cannot duplicate anything, but it leaves an obvious soft blob.

The lesson is in the brief: the clone source has to be chosen by eye, two or three runs, comparing
the before/after crop the tool writes each time. I started to add a `--candidates` mode that would
sweep the offsets automatically and backed it out — it made the tool convoluted for something that
is three commands and a look.

### 2026-09-09 — the contact sheet: nine assets in, five sent back

All sixteen remaining assets arrived on one 1376×768 sheet, about 175×160 per tile. That is a
sixth of the linear resolution of an individual generation, which turns out to decide what can be
taken from it:

- **The seven silhouettes are in** — both civ symbols and all five unit flags. They threshold to a
  mask, so the upscale to 256 costs nothing visible, and every one reads at 48 px, which is the
  size that matters. Checked tinted purple as well, since the game colour-masks the civ symbol.
- **Both leader portraits are in as interim.** They get cropped to a hex and a circle anyway, so
  the upscale shows less than it would elsewhere. Lorenzo's likeness is right — jaw, bob, red cap
  and cioppa — and only needs re-running at size. Porsenna needs re-designing as well: the cap came
  back soft and Venetian instead of the tall pointed tutulus.
- **The four colour icons stay out.** Two reasons, and the second is the real one: at 175 px there
  is no room for the detail that makes a building icon readable, and the sheet paints them as
  full-bleed rectangles rather than a subject on a flat field. There is nothing to key, so they
  would sit in the game as opaque boxes beside the Cuniculus and Tumulus, which are cut out.

Design notes sent back, recorded in the brief:

- The Etruscan symbol came back as a **plain striding lion**. No goat's head from the back, no
  snake tail — so it is not the Chimera, it is a lion, and a lion belongs to no one. Installed
  because it is a clean silhouette, but worth one more try.
- The **Fanum Voltumnae** has now come back as a Greek temple twice: fluted columns, shallow
  pediment, thin roof edge. The Tuscan order is the whole reason this icon exists, so the prompt
  now says what it is not.
- The **Bottega** came back as a church cloister with an altarpiece. The subject is a shop counter
  open to the street; the tell is the working clutter, not the building.
- Tuscany appeared twice on the sheet. The second block is the better one and is what went in: its
  giglio has the stamens, which makes it the Florentine *giglio bottonato* rather than a French
  fleur-de-lis, and its galley carries a cross on the sail.

Nine of twenty-four assets are now real art. Remaining: four colour icons, the two vertical
paintings, the Tuscany landscape, and eventual re-runs of the symbol and Porsenna.

### 2026-09-09 — four regenerations, and a hole in the Cuniculus

The Chimera, the Fanum Voltumnae, the Banco and the Bottega came back. Three went straight in and
the corrections all landed: the Chimera now has the goat's head rising from the lion's back and the
snake-headed tail turned back towards it, and reads at 48 px; the temple is finally Tuscan order —
deep overhanging eave, unfluted widely spaced columns, terracotta figures along the ridge, three
doorways, high podium with a frontal stair.

The Banco exposed a defect in `art-icon.py` that had been there all along: **background enclosed by
the subject**. The corner flood-fill cannot reach the inside of an arch, so it stayed as an opaque
grey blob — invisible against the dark panels the game uses, obvious against red. Fixed by finding
those pockets with connected-components on a background-colour mask and seeding a flood-fill in
each.

That fix then broke the Cuniculus, which had been fine. At the keying fuzz the test took the pale
water on the tunnel floor for a pocket and punched a hole straight through it. Two guards now: the
pocket test runs at a much tighter fuzz than the key (3% against 8–10%), because a real pocket *is*
the background colour and anything merely near it is paint; and a candidate has to be both large
and reasonably solid, since the near-grey scatter in painted stonework has a big bounding box and
almost no area. Cuniculus and Tumulus reprocess identically to before, so the fix costs nothing
where it was not needed. Caught only because I re-ran the two finished icons through the changed
tool and compared — worth continuing to do.

The Bottega is the one that did not go in cleanly. The content is exactly right this time, and then
it is composed as a flat framed panel filling the frame edge to edge, with its own drop shadow — so
there is no background to key and it lands as a rectangle among four cut-out objects. Keying the
cream wall as well does nothing; the wall is the picture. Installed as interim, with a corrected
prompt in the brief asking for the same content as a **cutaway block**, which is the device that
makes the Cuniculus read.

Seventeen of twenty-four assets are real art now.

### 2026-09-09 — Etruria finished

Four more in: the tomb interior, the cathedral, and both leaders at size. All four landed first
time, and Porsenna's correction is complete — the tall conical tutulus, the gold and amber
pectoral, the purple-bordered tebenna, the ivory sceptre.

**Every one of the Etruscans' fourteen files is now real art.** Checked by colour count rather than
by eye: the flat generated placeholders quantise to 64 colours at 64×64, real art to thousands, so
the whole set can be audited in one pass. Tuscany has five placeholders left, all of them
backgrounds — the two paintings that have not been generated.

The tomb interior arrived at 768×1376, a 1.41× upscale to fill 1080×1920, same as the second
Tarquinia. It feeds the tall civ-select card and the civ detail card, and the 2:3 centre crop keeps
the whole chamber with the lamp.

One pattern noticed while processing: **the PNG exports carry the sparkle, the JPG exports do
not.** Every PNG so far has had a 48×48 mark at 880,880 on a 1024 square; none of the JPGs has had
one. It costs nothing on an icon, where the tool finds and removes it automatically, but on a
full-bleed painting it has to be cloned out by hand — so asking for JPG saves that step. Recorded
in the brief.

Remaining: three generations, five files, all Tuscan — the Bottega as a cutaway block, the Florence
landscape, and the palazzo courtyard.

### 2026-09-09 — both mods on real art

The palazzo courtyard and the Florence landscape came in, and with them **every file in both mods
is real art**. Audited by colour count again: nothing in either `icons/` folder quantises to the
64 colours a generated placeholder does. The game loads both, the shell database validates, and
`UI.log` records no failed lookup for either civ or either leader.

The signature on these two took the most work of any so far, and taught two things now in the brief:

- **Read the box off a ruled crop.** My first courtyard box was about 25 px off and left a visible
  ghost of the star. Numeric detection failed repeatedly — the mark is translucent, so on pale
  flagstones or bright water it is neither much brighter nor much less saturated than its
  surroundings, and every threshold I tried caught the floor or the river instead. A grid of thin
  lines every 20 px over a 4× crop, heavier every 100, makes the numbers countable in one look.
- **Cropping the mark off is often better than covering it.** On the Florence landscape it sat on
  the Arno 70 px from the right edge, straddling the weir. Every clone source dragged something
  into the river — cypresses, a green bank, an entire building — and the blur fill I added for
  smooth surfaces smudged the weir away. Cutting 146 px off the right lost a strip of rooftops,
  kept the Duomo, the campanile, the Palazzo Vecchio, the Ponte Vecchio and the foreground
  cypresses, and left no artefact at all. `--crop` and `--blur-fill` are both new options.

Remaining: one asset, the Bottega, whose content is right but which is composed as a flat framed
panel rather than a cut-out object. Interim version installed; the corrected prompt is in the brief.

### 2026-09-09 — Etruria moved to Populonia

Marco asked to move Etruria away from Rome, leaving Rome where it is. Measured properly this time,
against the map's own projection rather than in degrees: I imported `makeProjection` and
`hexDistance` from `europe-raster.js` and ran eight candidate Etruscan cities against Rome on all
six grid sizes.

Two things came out of that which guessing had hidden:

- **The large maps demand far more spacing than I had written down.** `MIN_SPACING` is 5 on the
  standard grids but `round(W/14)` on the large ones — eight, nine and ten hexes. Earlier notes,
  including the comment in the geo files, said five everywhere.
- **No Etruscan city clears it on any grid.** Italy is barely three hexes wide at the smaller
  sizes; the best any candidate manages is Populonia at 2 (Tiny) to 6 (144x126). So moving improves
  the odds without ever removing the fallback when Rome is in play.

Populonia is the pick: furthest from Rome on five grids of six, and unlike Volaterrae — which ties
it — it stays three hexes from Florence rather than one, so it does not collide with Tuscany too.
It also fits the civ better than the mechanics required, being the one Etruscan city on the sea and
the port for Elban iron, which is what the Metalla tradition is about; the coastal start bias and
the Tyrrhenian Galley were already pointing that way.

The city list was reordered so Populonia is first and therefore the capital — the capital name is
whatever `LOC_CITY_NAME_ETRUSCANS1` says, and founding a city called Tarquinii on Populonia's
headland would have been sloppy. Tarquinii takes the old slot at eleven, and the tomb art and the
civilopedia still refer to it, which remains correct: it is a city of the league either way.
Populonia added to the fallback list beside Tarquinia and Florence.

### 2026-09-09 — leader wiring audited

Marco thought Machiavelli had never been connected to Tuscany. He had been, in all five places a
base-game leader can be: `LeaderUnlocks` and `LeaderCivilizationBias` in the shell config,
`LeaderCivPriorities` for the AI, a `REQSET_LEADER_IS_MACHIAVELLI` unlock requirement, and
`LeaderSyncretismUnlocks` — plus he is one of the ten Maestri.

Auditing to check that turned up three real gaps on the Etruscan side, all now fixed:

- **Porsenna did not unlock his own civilization.** Tuscany defines `REQSET_LEADER_IS_LORENZO`
  because the base game only ships a requirement set for its own leaders; the Etruscans never got
  the equivalent, so Augustus unlocked Etruria and Porsenna did not. `REQSET_LEADER_IS_PORSENNA`
  now exists and is on the unlock.
- **`Etruscans/config/config.xml` had no `LeaderUnlocks` block at all.** It carried the bias rows
  but never told the shell which leaders lead to Etruria, so the pairing was invisible in the
  picker. Porsenna, Augustus and Machiavelli now have rows.
- **Machiavelli had a bias toward Etruria but no unlock and no syncretism row**, where Augustus had
  both. Now symmetric.

Also checked and *not* a problem, having wondered: `LEADER_MACHIAVELLI` is defined in
`base-standard`, not a DLC, so the rows need no `ModInUse` guard. And an Antiquity civ carrying
`UnlockRequirements` on its own unlock is normal, not a lock-out — Rome, Greece, Egypt, Persia,
Maurya and Aksum all do the same.

### 2026-09-09 — the leader select screen

Marco pointed at three things in the Leader Select screen, all of them true.

**The portraits were square.** Every leader row in both `data/icons/icons.xml` files pointed at
the same `leader_<name>.png`, a plain square crop. Firaxis does not do that. Ada Lovelace's
`leader-icons.xml` has nine rows: the default rows take a *hex* crop at 256/128/64, the
`LEADER_HAPPY` and `LEADER_ANGRY` contexts take the hex at 128, and `CIRCLE_MASK` and
`PORTRAIT_MASK` take a *circle* crop — that is where the round frame comes from. Generated
`lp_hex_<leader>_{256,128,64}` and `lp_circ_<leader>_{256,140,128,64}` for both leaders with
ImageMagick polygon and circle `DstIn` masks, rewrote both icons.xml files to those nine rows,
and added the new files to both `ImportFiles` blocks in each modinfo.

The shell also builds some of these names by hand rather than going through `IconDefinitions`, so
the UI scripts' registry now generates every size token instead of only the 256s it had.

**There was no human on the pedestal.** This one is engine-level.
`core/ui/shell/leader-select/leader-select-model-manager.js:151-162`:

```js
this.leader3DModel = this.leaderSelectModelGroup.addModel(
  this.getLeaderAssetName(this.currentLeaderAssetName), ...);   // "<LEADER_TYPE>_GAME_ASSET"
if (this.leader3DModel == null) {
  this.leader3DModel = this.leaderSelectModelGroup.addModel(
    this.getFallbackAssetName(), ...);                          // the faceless figure
}
```

A mod cannot ship a model, so `LEADER_PORSENNA_GAME_ASSET` does not resolve and the fallback
takes over. `BasePersonaType` does *not* help here, which is worth writing down because it looks
like it should: it is read by the alternate-persona system, not by this lookup.

The fix is the same trick as the background wall — hook the call, not the data. The UI scripts now
proxy `WorldUI.createModelGroup` and wrap `addModel` / `addModelAtPos` on whatever group comes
back, rewriting the asset name on the way in. Porsenna borrows **Augustus** (the toga the Romans
took from the Etruscans is the closest thing the game has to a lucumo) and Lorenzo borrows
**Machiavelli** (the other Florentine, dressed for the right century). Because the scripts load in
both `shell` and `game` scope, any other screen that builds its models the same way is covered too.
`BasePersonaType` was moved to match the borrowed model in each case, for coherence rather than
effect.

Not verified. It only shows itself once the screen is on the pedestal, and computer-use access to
the game was declined earlier, so this is the one change here that Marco has to look at.

**Both leaders were thin.** Three modifiers each. The base game's median is five (Ashoka and Jose
Rizal have eight; Confucius and Hatshepsut have three, but theirs are large). More to the point,
*every* shipped leader has an `EFFECT_DIPLOMACY_AGENDA_TIMED_UPDATE` agenda and neither of ours
did, which leaves them diplomatically inert — the AI has nothing to read.

Lorenzo, ten modifiers, following Marco's direction (wonders, a bigger banking empire including
trade money, a *smaller* science bonus):

| | |
|---|---|
| +3 Gold per Great Work | was 2 |
| +1 Happiness per Great Work | |
| +1 Culture in all Settlements | |
| **+20% Production toward Wonders** | above the 15% at the top of the base range; it is his headline |
| **+50% trade income** | `EFFECT_CITY_ADJUST_TRADE_YIELD` |
| **+3 Gold per trade route** | |
| **+1 trade capacity** | |
| **15% off building purchases** | the bank has to buy something |
| **+1 Science** | deliberately the smallest number on the sheet |
| **Patron of Workshops** agenda | weighs `DIPLOMACY_AGENDA_COMPARE_NUM_GREAT_WORKS` |

Porsenna, eight, keeping the engineer/besieger identity and widening it:

| | |
|---|---|
| +3 Production in Cities | was 2 |
| **15% off building purchases** | |
| **+2 Science** | he is the scientific attribute |
| **+2 Happiness** | the drains and the aqueduct earned their keep in how people lived |
| +30 Health on fortified Districts | was 20 |
| +4 Combat defending a District | was 3 |
| **+5 Combat attacking a District** | `REQUIREMENT_OPPONENT_IS_DISTRICT`; he is the one man in the tradition who actually took the city |
| **The Labyrinth** agenda | weighs `DIPLOMACY_AGENDA_COMPARE_DISTRICT_BUILDINGS` |

Ability descriptions rewritten to match, agenda name and description text added to both
`LeaderText.xml`, and the AI yield/pseudoyield biases extended so the AI actually plays the new
bonuses (`PSEUDOYIELD_WONDER`, `PSEUDOYIELD_GREAT_WORK_SLOT`, `PSEUDOYIELD_RESOURCE_IMPORT` for
Lorenzo; `PSEUDOYIELD_CITY_DEFENSES`, `YIELD_HAPPINESS` for Porsenna).

Every effect, requirement, weight type and pseudoyield above was grepped out of the base modules
first — `PSEUDOYIELD_TRADE_ROUTE`, which would have been the obvious one for Lorenzo, does not
exist, and `PSEUDOYIELD_RESOURCE_IMPORT` stands in for it.

Both static checkers clean, XML valid, installed.

### 2026-09-09 — Etruscans made stronger, and Italy unsealed

**Disciplina Etrusca rebuilt.** Marco: the Etruscans are known for their cities and their good life
— food, banquets, freedom for women — and the ability did not show it. It was three modifiers. Now
nine; see `plans/etruscans.md` §1.1 for the list and the sources. Base-game civ abilities run from
three (Persia) to thirteen (Greece), so nine is comfortably inside the range.

**The maps: Italy was a sealed box.** Marco asked for the Etruscans not to be locked in by Rome and
to be able to move north over land. Measuring it first turned up something larger than a start
position.

`TERRAIN_MOUNTAIN` is `Impassable="true"` in `base-standard/data/terrain.xml`, so a mountain range
with no gap in it is a wall, not slow ground. In `europe-geo.js` the Apennines ran down the spine of
Italy with an unbroken core and the Alps closed the top. Flood-filling the walkable tiles from
Populonia:

| grid | before | after |
|---|---|---|
| 56x50 | **4** | 972 |
| 66x60 | **9** | 1409 |
| 78x70 | **7** | 1977 |
| 90x80 | **37** | 3778 |
| 102x92 | **15** | 4973 |

And it was not an Etruscan problem. On 78x70, before: Rome 7 tiles, Florence 24, Etruria 7 — one
pocket, no land route out — while Greece, Spain, France, Bulgaria and Byzantium all shared a
1926-tile continent. Whoever drew Italy was playing a different game on an island.

The fix is the treatment the two Large maps have carried since they were written and this map never
got: `hillAreas` (central and southern Apennine mountains become hills), `passes` (mountains within
a radius of a named line become hills) and `flatAreas` (the Po valley, Latium and the Maremma
flattened back, so the peninsula is not all hill country and short of food). Ported the Italian
subset, plus the Atlantic and Mediterranean gates through the Pyrenees and the Isthmus of Corinth,
which the same list carries.

One pass is new in all three geo files: **Northern Apennines (Futa and Porretta)**, the crossings
the Etruscans actually used to settle the Po valley from Tuscany. That single line is what fixed the
Variant map, which was also sealed at four of its five sizes (1 to 30 tiles) despite already having
the rest of the pass list.

Two things deliberately *not* done. The Large maps also soften the eastern Alps (`hillAreas`, prob
0.3); `europe-geo.js` does not get that — the named passes are enough, and the Alps stay a wall
between them. And the Etruscan true start did not move: Populonia was chosen carefully (§1.7) and
the lock was the mountains, not the neighbour.

New tool: **`tools/land-reach.mjs`** — flood-fills walkable land from a lon/lat on any of the three
geo files at any grid size, offline. Verified across every grid size and four seeds for all three
maps; every one now reaches the map's northern edge.

### 2026-09-11 — Etruria led nowhere: the age-transition unlocks

Marco finished Antiquity as Etruria (with Lorenzo) and the Exploration screen would not let him
take Tuscany or Byzantium. `GameCore.log` shows what he took instead — Norman — and that is the
useful half of the evidence: the Etruscans→Norman unlock *did* fire, so the requirement machinery
(`REQSET_CIV_IS_ETRUSCANS`, `UnlockRequirements`, the config `CivilizationUnlocks` row) works.
Two separate gaps, then, not one broken mechanism.

**Byzantium was never connected to Etruria at all.** Its unlock list is Rome, Greece, Augustus,
Catherine, Charlemagne, Xerxes and three Ancient Walls — no Etruscan entry anywhere, in gameplay
or in the shell config. It was locked because it was supposed to be. Now wired, in the shape
Byzantium already uses for the Ottomans DLC: a `ModInUse etruscans` game group loading
`data/unlocks-etruscans.xml`, a `ModIsEnabled etruscans` shell group loading
`config/config-etruscans.xml`, and two new tooltips. Etruria and Porsenna both lead to Byzantium —
Etruscan ships worked the same sea as the Greek east, and the Exarchate later ruled the Tuscan
coast from Ravenna.

**Tuscany was missing its own leader from the shell `LeaderUnlocks` table.** `Tuscany/config/
config.xml` listed Machiavelli, Isabella and Ibn Battuta — three borrowed leaders — and not
Lorenzo, who is Tuscany's own. The age-transition screen reads that table (`age-civ-select-model.js`
queries `LeaderUnlocks` and `CivilizationUnlocks` from the config database) to decide who has
unlocked what, so a Lorenzo game arrived in the Exploration Age with Tuscany still locked even
though the gameplay-side `REQSET_LEADER_IS_LORENZO` row was correct. Added.

Worth remembering, because it cost an hour: **an unlock has to be written twice** — once in the
gameplay database (`Unlocks` + `UnlockRequirements` + `UnlockConfigurationValues`, evaluated by
requirement sets) and once in the shell config database (`CivilizationUnlocks` / `LeaderUnlocks`,
which is what the transition UI actually reads and renders as the tick-list on the civ card). Get
one and miss the other and the civ shows up on the screen with a padlock and no explanation.

### 2026-09-11 (later) — the leader portraits, and what UI.log had been saying all along

Marco: the new leaders' faces do not appear on the map next to city names. `UI.log` had the
answer written in it, twice per game load:

```
Failed to open file - .../Mods/Tuscany/lp_hex_lorenzo_256.png.png
```

Two `.png`. From `core/ui/utilities/utilities-image.js`:

```js
const iconName = UI.getIconURL(leader.LeaderType, "LEADER") + sizeSuffix + relationshipSuffix + ".png";
```

`getLeaderPortraitIcon()` glues `.png` onto whatever the icon row returns. Neither we nor Firaxis
define a `LEADER` context row, so the lookup falls back to the default row — and for a shipped
leader that is `blp:lp_hex_ada_lovelace_256`, a package name with **no extension**, so the glued
`.png` lands on a real texture. Ours is a loose file and the row already ends in `.png`, so every
caller of `getLeaderPortraitIcon` — city banners, the diplomacy ribbon — asked for a file that
cannot exist and drew an empty circle.

Fixed twice over, because the two halves fail independently:

- **`icons.xml`** now carries a `Context=LEADER` row per leader whose `Path` deliberately omits the
  extension, so the engine's own concatenation produces a valid URL with no JavaScript involved.
- **The UI scripts** now strip *repeated* `.png` in `lookup()` rather than one, and fall back past
  a trailing `_h` / `_a` mood suffix. That covers the other two readers of the `LEADER` context,
  `panel-victory-points.js` and `panel-unit-combat-preview.js`, which use the value verbatim and so
  need the extension put back.

Worth keeping in mind: `blp:` package names and `fs://` loose files are not interchangeable at the
end of a path. Anywhere the engine builds a URL by concatenation, a loose file's extension is one
too many.

While reading `UI.log` for this, a red herring worth naming: hundreds of lines attributed to
`byzantium-images.js:125` and `:145`. Those are engine warnings from unrelated UI code —
"Trying to set height to invalid value: undefined", HTML parser errors — attributed to our hook
only because `Element.prototype.setAttribute` is the innermost named frame on the stack. Our
prototype hooks sit in the path of every attribute write in the game, so they will collect
attribution for everyone else's warnings forever. Not a bug, but do not go hunting it again.

### 2026-09-11 (later still) — one duplicate tag unloaded every mod

Marco launched a new game and *no* mods were visible. `Modding.log`:

```
Warning: Failed to load .../Mods/Etruscans/text/en_us/UnlockText.xml
ERROR: There were errors loading 'text/en_us/UnlockText.xml' that require a rollback.
ERROR: Failed to apply enabled components.
ERROR: Rolling back database to a good state.
```

My fault, from the Byzantium unlock work an hour earlier. Wiring Etruria to Byzantium needed two
tooltips, and I wrote four tags into `Byzantium/text/en_us/UnlockText.xml` — the two tooltips plus
`LOC_UNLOCK_PLAY_AS_ETRUSCANS_DESCRIPTION` and `LOC_UNLOCK_PLAY_AS_PORSENNA_DESCRIPTION`, which the
Etruscans mod already defines. The localization database keys on the tag. Byzantium loaded first,
Etruscans' file hit the duplicate and failed, and the game rolled the **whole** database back —
taking all twenty-odd of Marco's mods down with it, not just ours.

The two descriptions were never needed here: the rows that use them live in
`data/unlocks-etruscans.xml`, which only loads when the Etruscans mod is present, so that mod's own
text is always there. Removed, leaving only the two `..._BYZANTIUM_TOOLTIP` tags.

`tools/check-mod.py` now has check 6: any tag this mod defines that a `--with` companion also
defines is an error, with the consequence spelled out. Verified it catches the exact bug. The rule
is also in the skill reference now: **a text tag belongs to exactly one mod**, and a cross-mod file
behind a `ModInUse` criteria can rely on the other mod's tags being present.

### 2026-09-11 (again) — the invented icon context, and what it really explains

Marco launched again: no errors in `Modding.log` this time, but the mod civilizations were gone
from the setup screen. `Database.log` had it:

```
[IconManager] ERROR: FOREIGN KEY constraint failed
While executing - insert into IconDefinitions('ID','Path','Context')
  values ('LEADER_PORSENNA','fs://game/etruscans/lp_hex_porsenna_256','LEADER');
[IconManager]: .../Mods/Etruscans/data/icons/icons.xml
```

The `Context=LEADER` row I added an hour ago for the city-banner portraits is invalid.
`IconDefinitions.Context` is a foreign key — `IconDefinitions` → `Icons` → `IconContexts` — and the
only contexts the game defines are `DEFAULT`, `CIRCLE_MASK`, `PORTRAIT_MASK`, `LEADER_HAPPY`,
`LEADER_ANGRY`, `BACKGROUND`, `BACKGROUND_VERT`, `BACKGROUND_HORIZ`, `BUBBLE`, `PLAYER`, `BADGE`,
`OUTLINE`, `FOW`, `FONTICON`. There is **no `LEADER` context**, even though `utilities-image.js`
asks for one — that call simply always falls through to the default row, which is exactly why
Firaxis's extensionless `blp:` default path works for their leaders and our `.png` one does not.
The bad row failed, and with it the whole `icons.xml` for both mods. Reverted; the portrait fix now
rests entirely on the JavaScript side, which is where it belonged.

And this is very probably **the answer to bug 1 as well**. `age-civ-select-model.js`:

```js
const image = GameSetup.resolveString(civData.icon);
if (!image) { console.error(...); continue; }   // <- the civ is not added to the list at all
```

A civ whose icon will not resolve is *skipped*, not shown locked. That is precisely "Tuscany was
not even shown as locked at transition" — a dropped icons file makes a civ vanish rather than
appear greyed out. Whether Tuscany's file was already being dropped for some other reason on the
earlier run, I cannot now tell: `Database.log` had rolled over by the time I looked. But the
mechanism is confirmed, and `[IconManager]` in `Database.log` is where it is written down.

`tools/check-mod.py` gains check 6: any `<Context>` in `<IconDefinitions>` outside that list is an
error, with the consequence spelled out. Verified against the exact row. Both rules — this one and
yesterday's duplicate-tag rule — are in the skill reference now.

Two lessons from one afternoon, both the same shape: **a single bad row does not fail alone.** A
bad icon Context drops every icon in the mod; a duplicate text tag drops every mod in the game.
`Database.log` and `Modding.log` name the file each time, and they are the first place to look —
before any theorising about the UI.
