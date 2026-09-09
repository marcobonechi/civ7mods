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
