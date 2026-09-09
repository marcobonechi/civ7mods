# Etruscans and Tuscany — art prompts

Both mods currently ship generated placeholders (`tools/make-icons.py`, `tools/make-backgrounds.py`).
This is the brief for replacing them: what each slot is, what the game does to it, the prompt to
generate it, and the command to turn a generator's output into the file the game wants.

Sizes and style rules are from `.claude/skills/new-civilization/reference.md` §4 and
[byzantium-art.md](byzantium-art.md) §1–2, which were read out of the game's own UI code.

## 1. Slot inventory

Nothing here needs an XML change: `data/icons/icons.xml` already points at every filename below,
and the rows for the square icons carry no `IconSize`, so a 256² file drops straight in over a
128² one. Overwrite in place, run `./install.sh`, restart the game.

| File (in `<Mod>/icons/`) | Ships at | Should be | What the game does to it |
|---|---|---|---|
| `civ_sym_<civ>.png` | 256², both done | 256² | **White shape on transparency.** Recoloured through `filter: fxs-color-mask(...)`, so any colour in the file is thrown away. |
| `unitflag_*.png` | 256², all five done | 256² | **White silhouette on transparency**, drawn on the player's coloured flag. |
| `buildicon_*.png`, `wondericon_*.png` | 128², Cuniculus and Tumulus 256² | 256² | **Full colour on transparency.** Painting with a soft shadow, three-quarter view from above. |
| `leader_<name>.png` | 256², both done (interim) | 256² | Portrait. Firaxis ships a hex crop and a circle crop as separate files; ours points all three icon contexts at one PNG — see §5. |
| `lsbg_<civ>_1080.png` | 1920×1080, Etruscans done | same | Loading-screen painting. |
| `lsbg_<civ>_720.png` | 1280×720 | same | The same painting, downscaled. |
| `lsbg_<civ>_vert.png` | 1080×1920 | same | Tall card in the age-transition civ select. |
| `bg-card-<civ>.png` | 720×1080 | same | Civ detail panel. |
| `bg-panel-<civ>.png` | 1301×732, Etruscans done | same | Picker background and narrative panel. 16:9, drawn `background-size: cover`, so keep detail away from the edges — the crop moves with the window. |

Generator aspect ratios: **1:1** for every icon and the leader; **16:9** for the loading painting
and the panel; **9:16** for the vertical card, cropped to 2:3 for `bg-card`.

## 2. Style lines

Put the matching line at the end of every prompt in its group.

- **Silhouettes** (`civ_sym_*`, `unitflag_*`):
  *"Flat pure-white silhouette on solid black, one bold closed shape, no gradients, no outline,
  no shading, no text, centred with a generous margin."*
- **Icons** (`buildicon_*`, `wondericon_*`):
  *"Civilization VII building icon: single subject, three-quarter view from above, full colour,
  soft drop shadow, flat mid-grey #808080 background, no people, no text, no watermark."*
- **Paintings and portraits** (loading, card, panel, leader):
  *"Sid Meier's Civilization VII concept painting, loose oil brushwork, warm desaturated palette,
  soft rim light, no text, no watermark, no lettering."*

Silhouettes want a few **narrow black cut-lines** inside the shape (a rein, a visor gap, a mast)
rather than one solid blob — that is what makes them read at flag size.

The generator signs its work with a small sparkle in the bottom-right corner. It survives keying as
an opaque white blob, so it has to be painted out first; `tools/art-icon.py` does that by default.

## 3. Etruscans

Palette to keep asking for: terracotta red, bucchero black, tufa ochre, bronze, wine-dark purple.

### `civ_sym_etruscans` — 1:1, silhouette — **done 2026-09-09, but see below**

> The Chimera of Arezzo in strict side profile: a lion striding left, its mane in stiff
> flame-shaped locks, a goat's head and neck rising from the middle of its back, the tail a
> rearing snake that turns to face the goat. Narrow black cut-lines separate mane from body,
> goat from lion and snake from tail.

Alternative, if the chimera reads as clutter at 32 px: *a pair of winged horses in profile, wings
raised and overlapping, after the terracotta relief from the Ara della Regina at Tarquinia.*

**What came back is a plain striding lion** — no goat's head rising from the back, no snake tail.
It is a clean silhouette and it is installed, but those two features are the whole point: without
them this is a lion, and a lion belongs to no one in particular. Worth one more generation
insisting on all three heads.

### `unitflag_biga` — 1:1, silhouette — **done 2026-09-09**

> An Etruscan two-horse war chariot from the side: two horses at full gallop, heads together,
> forelegs raised; behind them a light open chariot box on one spoked wheel; a driver leaning
> forward with the reins taut. Narrow black cut-lines for the reins, the wheel spokes and the gap
> between the two horses.

### `unitflag_tyrrhenian_galley` — 1:1, silhouette — **done 2026-09-09**

> An Etruscan war galley from the side: a long low hull, a heavy bronze ram at the waterline, a
> high curved sternpost, one bank of oars angled down into the water, a short mast with a small
> square sail. A round painted eye near the bow is left as a black cut-out.

### `buildicon_cuniculus` — 1:1, icon — **done 2026-09-09**

> The mouth of an Etruscan cuniculus: a narrow hand-cut drainage tunnel driven through golden
> volcanic tufa, chisel marks across the walls, a shallow channel of clear water running out over
> the rock; behind it a square vertical shaft drops a bar of sunlight into the tunnel; ferns and
> wet moss at the lip. Warm ochre stone against cool water-green.

The generation came back as a cutaway block rather than a tunnel mouth in a hillside, which reads
better at icon size than the prompt would have: the shaft of light and the water channel are both
legible at 64 px. Raw kept at `Etruscans/icons/src/buildicon_cuniculus.raw.png`.

### `buildicon_tumulus` — 1:1, icon — **done 2026-09-09**

> An Etruscan tumulus tomb at Cerveteri: a circular drum of squared tufa blocks cut down into the
> rock, a grassed earth mound heaped on top, a low doorway with a heavy lintel at the front
> opening into darkness, a stone bench running round the base. Warm ochre stone, dry grass, the
> shadow of a cypress falling across it.

Came back flatter and more cel-shaded than the Cuniculus, which is painterly — the two do not
quite belong to the same set. Worth deciding before the remaining icons are generated: either ask
for the painterly register explicitly, or re-do the Cuniculus flat. Raw at
`Etruscans/icons/src/buildicon_tumulus.raw.png`.

### `wondericon_fanum_voltumnae` — 1:1, icon — **rejected twice**

> An Etruscan temple in the Tuscan order: a high stone podium with one broad frontal stair, four
> widely spaced wooden columns with plain cushion capitals, a very deep overhanging gable roof of
> terracotta tiles, brightly painted terracotta antefixes and acroteria along the ridge, three
> doorways behind the porch for three cellae. Wide, low and heavy — nothing Greek or slender.
> Terracotta red, cream stucco, dark timber.

Both attempts came back as a Greek temple: slender fluted columns, a shallow pediment, a thin
roof edge. The Tuscan order is the entire point of this icon, so say what it is *not*: **not a
Parthenon**, no fluting, columns twice as far apart as a Greek temple's, the roof overhanging
**a third of the building's depth**, and painted terracotta figures standing along the ridge and
at the eave corners.

### `leader_porsenna` — 1:1, portrait — **interim 2026-09-09**

> Lars Porsenna, an Etruscan lucumo of Clusium about 500 BC: a man in his fifties, dark hair and a
> full spade-shaped beard in tight archaic curls, a strong straight nose, and the faint closed-lip
> archaic smile of Etruscan tomb sculpture. He wears a tall pointed felt cap, a heavy gold and
> amber pectoral, a large gold fibula at the shoulder, and a purple-bordered tebenna mantle over a
> linen tunic; he holds a short ivory sceptre. Head and shoulders, three-quarter view from the
> front left, looking at the viewer. Dark smoky background, warm light from the left.

Installed from the contact sheet at 175 px, upscaled — good enough to stop looking like a
placeholder, not good enough to keep. The cap came back soft and Venetian rather than the tall
pointed tutulus, so the regeneration should press on that.

### `lsbg_etruscans_1080` / `_720` / `bg-panel-etruscans` — 16:9, painting — **done 2026-09-09**

> Tarquinia in southern Etruria at golden hour, seen from across the valley: a city of tufa walls
> and low tiled roofs along a flat-topped ridge, a painted Tuscan-order temple with a deep gabled
> roof standing on the highest point, its terracotta antefixes catching the sun. In the middle
> distance a field of round grassed tumulus tombs laid out along cut streets. In the foreground the
> mouth of a cuniculus spilling water into an irrigated field, and two figures in Etruscan mantles
> walking a track. Long shadows, dust in the air.

Came back almost exactly as written, including the tumulus field laid out along cut streets and
the cuniculus outfall.

Regenerated larger on the second pass: 1376×768 instead of 1024×572, which brings the upscale to
1920×1080 down from 1.89× to 1.41×, and the extra pixels are real — the temple's column flutes and
antefixes are crisper, not just bigger. **1920 wide or more is still the size to ask for**, so the
three outputs become downscales. Processed with:

```bash
python3 tools/art-background.py Etruscans/icons/src/lsbg_etruscans.raw.png \
  --civ etruscans --mod Etruscans --landscape --mark 1237,622,42,52 --from-dx 70 --from-dy -80
```

### `lsbg_etruscans_vert` / `bg-card-etruscans` — 9:16, painting

> Inside a painted Etruscan chamber tomb at Tarquinia: on the back wall a frescoed banquet, a
> married couple reclining together on a single couch, garlands hung above them, a flute player and
> a lyre player, dancers among stylised trees; red, ochre and black pigment on plaster, the plaster
> cracked and worn. An oil lamp on the floor lights the chamber from below; at the edge of the
> frame the doorway is a rectangle of pale daylight. Vertical composition, the couple in the upper
> two thirds.

## 4. Tuscany

Palette: terracotta roof tile, grey-green pietra serena, lime white, ultramarine, gold florin.

### `civ_sym_tuscany` — 1:1, silhouette — **done 2026-09-09**

> The Florentine giglio: a lily of three petals, the outer two curling outward and down, a slender
> stamen springing from each side of the central petal, a narrow band at the waist and two small
> leaves below. Strictly symmetrical. Narrow black cut-lines between the petals and the stamens.

### `unitflag_condottiero` — 1:1, silhouette — **done 2026-09-09**

> A fifteenth-century Italian mercenary captain, bust and shoulders in three-quarter armour: a
> sallet helmet with the visor raised, a bevor at the throat, fluted pauldrons, a broad sash across
> the breastplate, one gloved hand holding a short baton of command angled up across the body.
> Narrow black cut-lines for the visor gap, the edge of the sash and the baton.

### `unitflag_galea_santo_stefano` — 1:1, silhouette — **done 2026-09-09**

> A Mediterranean war galley from the side: a long low hull, a spur beak at the bow, one bank of
> oars angled down, a single raked mast carrying a big triangular lateen sail bellying forward, a
> stern lantern and a pennant aft. On the sail, a bold cross with forked ends is left as a black
> cut-out.

The cross came back plain rather than forked-ended. At flag size it makes no difference; only fix
it if the set is ever redone.

### `unitflag_maestro` — 1:1, silhouette — **done 2026-09-09**

> A Renaissance workshop master, bust and shoulders, three-quarter view: a soft flat cap, hair to
> the collar, a plain gown with a working apron over it, one hand raised holding a pair of
> dividers, a mahlstick and a rolled drawing under the other arm. Narrow black cut-lines for the
> dividers, the cap brim and the collar.

### `buildicon_bottega` — 1:1, icon — **rejected once**

> A Florentine artist's bottega: a stone-arched shop front open to the street, its wooden shutter
> propped up as an awning; just inside, a painted panel on an easel catching the light; on the
> bench a grinding slab and pigment jars, brushes standing in a pot, a plaster cast on a shelf
> above; lime-washed wall over dressed sandstone. Warm ochre and lead white with one note of
> ultramarine.

The first attempt came back as a church cloister with an altarpiece in it — arcades, a religious
panel, no workshop. Push the prompt away from architecture: the subject is a **shop counter open
to the street**, and the tell is the working clutter, not the building.

### `buildicon_banco` — 1:1, icon

> A Florentine bank: a long banker's bench under a stone loggia arch, spread with a green cloth; on
> it an open leather-bound ledger, a pair of brass scales, a stack of gold florins and a leather
> purse; under the bench an iron-banded strongbox; rusticated stone and a wrought-iron torch
> bracket behind. Grey-green pietra serena, green cloth, gold.

### `wondericon_santa_maria_del_fiore` — 1:1, icon

> The cathedral of Florence: Brunelleschi's great octagonal dome in red terracotta tile with eight
> white marble ribs and a white marble lantern on top, the drum below it pierced with round
> windows, the nave running back, the flank in polychrome marble — white, dark green and rose — and
> Giotto's slender square campanile rising beside it. Warm terracotta against marble.

### `leader_lorenzo` — 1:1, portrait — **interim 2026-09-09**

> Lorenzo de' Medici in Florence about 1480: a man of thirty, clean-shaven, straight dark hair cut
> level at the jaw under a red flat cap, a long heavy jaw, a flattened broken-looking nose, a wide
> mouth, dark watchful eyes. He wears a crimson cioppa of heavy wool over a dark doublet and no
> jewellery at all. Head and shoulders, three-quarter view from the front left, looking at the
> viewer. Behind him a dark warm interior and the suggestion of a stone window frame; soft light
> from the left.

### `lsbg_tuscany_1080` / `_720` / `bg-panel-tuscany` — 16:9, painting

> Florence from the hills above San Miniato at golden hour: Brunelleschi's red-tiled dome and white
> lantern dominating the skyline, Giotto's pale campanile beside it, the crenellated tower of the
> Palazzo Vecchio further off, red roofs packed close between them, the Arno curving through with
> the shops of the Ponte Vecchio sitting on it. Cypresses and olive terraces in the foreground,
> blue hills fading behind. Haze and a low sun.

### `lsbg_tuscany_vert` / `bg-card-tuscany` — 9:16, painting

> The courtyard of a Florentine palazzo at midday, looking up: two storeys of grey pietra serena
> arches on slender columns, a bright square of sky above them, a bronze statue on a plinth in the
> middle of the flagstones, a marble bust and an open folio on a stone bench, an apprentice
> carrying a panel through an archway in shadow. Vertical composition, hard sunlight from above,
> deep shade in the loggia.

Alternative if a workshop reads better than architecture: *the interior of a Florentine bottega —
a half-finished panel on a great easel under a north window, cartoons pinned to the wall, a bronze
horse's head on a table, an apprentice grinding pigment in the foreground.*

## 5. Turning generator output into the files

All commands tested here with ImageMagick 7 (`magick`). Run them from the repo root.

**Silhouettes → white on transparency**, by hand if you want to see each step. Generate
white-on-black, then key the black out:

```bash
magick raw.png -colorspace gray -threshold 50% -alpha copy \
  -channel RGB -evaluate set 100% +channel -resize 256x256 Etruscans/icons/civ_sym_etruscans.png
```

Raise the threshold (`--threshold` on the tool) if the generator adds a grey halo, lower it if thin
parts drop out.

**Colour icons → transparent background.** `tools/art-icon.py` does the whole job: paints out the
generator's sparkle watermark, keys the background from all four corners, trims to the subject and
re-centres it square. The generator does not centre its subject and does not give you exactly the
grey you asked for, so both steps matter.

```bash
python3 tools/art-icon.py raw.png Etruscans/icons/buildicon_cuniculus.png
```

It samples the background from the top-left pixel and picks the fuzz itself, by sweeping and
stopping before the key starts eating the subject — dry grass and pale stone sit close enough to a
mid grey that a fixed 18 took a bite out of the Tumulus mound. Pass `--bg '#808080'` to force a
colour, `--fuzz 12` to force a value, `--margin` for breathing room, and `--keep` to leave the
intermediate steps beside the output when something looks wrong. If the subject shares a tone with
the background, generate on chroma green (`#00b140`) and pass `--bg '#00b140'`.

The watermark is removed after the key rather than before: it survives as a small opaque island
separate from the subject, so the tool labels the islands, keeps the largest and drops the rest.
That also sweeps up the speckle a key always leaves. Trying to find the mark *before* keying does
not work — the subject often reaches into the same corner and there is no way to tell them apart.

A faint grey fringe survives at the silhouette edge, which is the generation's own drop shadow.
Against the dark panels the game draws these on it reads as the soft shadow the style asks for;
it only looks like an outline on a bright test background.

**Silhouettes** go through the same tool with `--silhouette`, which thresholds instead of keying:

```bash
python3 tools/art-icon.py raw.png Etruscans/icons/civ_sym_etruscans.png --silhouette
```

**Backgrounds** go through `tools/art-background.py`, which writes every size from one painting
and patches out the signature on the way:

```bash
python3 tools/art-background.py raw16x9.png --civ etruscans --mod Etruscans --landscape --mark X,Y,W,H
python3 tools/art-background.py raw9x16.png --civ etruscans --mod Etruscans --portrait  --mark X,Y,W,H
```

`--landscape` writes the two loading sizes and the panel; `--portrait` writes the vertical card and
the detail card.

The signature cannot be found automatically here the way it can on an icon. An icon is keyed, so
the mark is left over as a small opaque island apart from the subject and the tool just drops it. A
painting has no transparency to key, and colour is no help: the mark is a pale translucent star and
sunlit dirt reads identically — a saturation test on the Tarquinia painting flagged five thousand
pixels of footpath along with it. So read the box off a magnified crop:

```bash
python3 tools/art-background.py raw.png --inspect     # writes 3x crops of all four corners
```

It is patched by cloning a feathered ellipse of nearby ground over it, and **the clone source has
to be chosen by eye**. On the Tarquinia painting the first three offsets all failed differently:
straight up pulled a tomb doorway into the middle of a footpath, left pulled in a headless copy of
one of the walking figures, and down re-cloned the top point of the mark itself. Up-and-right
landed on plain bank and was clean.

So: run it two or three times with different `--from-dx` / `--from-dy`, look at the
`.mark-check.png` it writes beside the source each time, and keep the one that works. Filling with
a blur instead of a clone was tried and is worse — it cannot duplicate anything, but it leaves an
obvious soft blob where the ground had texture.

**Leader portrait.** Ours points the plain, `CIRCLE_MASK` and `PORTRAIT_MASK` rows at one file, so a
square bust will do to start with:

```bash
magick raw.png -resize 256x256^ -gravity center -extent 256x256 Etruscans/icons/leader_porsenna.png
```

Firaxis ships pre-cropped hex and circle files (`lp_hex_*`, `lp_circ_*`), so if the square version
shows with corners in game, cut the two shapes and give each its own file and `IconDefinitions` row:

```bash
magick raw.png -resize 256x256^ -gravity center -extent 256x256 \
  \( -size 256x256 xc:none -fill white -draw "circle 128,128 128,4" \) \
  -alpha set -compose DstIn -composite leader_porsenna_circ.png
magick raw.png -resize 256x256^ -gravity center -extent 256x256 \
  \( -size 256x256 xc:none -fill white -draw "polygon 64,4 192,4 256,128 192,252 64,252 0,128" \) \
  -alpha set -compose DstIn -composite leader_porsenna_hex.png
```

Same commands for Tuscany with `Tuscany/icons/` and the `tuscany` filenames.

## 6. What a contact sheet is and is not good for

Marco sent all sixteen remaining assets on one 1376×768 sheet, about 175×160 per tile. That is a
sixth of the linear resolution of an individual 1024² generation, and it settles what each kind of
asset can take:

- **Silhouettes survive it.** They are thresholded to a mask, the shapes are simple, and 175 px up
  to 256 costs nothing visible — all seven read cleanly at 48 px. Installed from the sheet.
- **Leader portraits survive it, just.** They are cropped to a hex and a circle anyway, so the
  upscale shows less than it would on a flat icon. Installed as interim.
- **Colour building and wonder icons do not.** At 175 px the generator has no room for the detail
  that makes them readable, and worse, the sheet paints them as full-bleed rectangles rather than
  a subject on a flat field — so there is nothing to key, and they would sit in the game as opaque
  boxes next to the Cuniculus and Tumulus, which are cut out. Those stay to be generated one at a
  time.

So: sheets for reviewing designs, individual generations for anything that ends up cut out.

## 7. The regeneration set

Nine assets are in. These nine are what is left, written as finished prompts to paste one at a
time. Three are corrections to something that came back wrong, two are re-runs at size, and four
have never been generated.

**Ask for 1024×1024 for every icon and portrait, and at least 1920 wide for the landscapes.** The
contact sheet's 175 px tiles were the limit of what a mask can take and below the limit for
anything cut out.

**Rendering register.** Neither icon prompt said how to render, and the generator chose
differently each time: the Cuniculus came back painterly, the Tumulus flat and cel-shaded. Every
prompt below now says painterly. That reverses what I suggested when the Tumulus arrived — I
argued for the flat register because it held up at 96 px, but both do, and the deciding argument
is the other one: the game's own building icons are soft-edged paintings (reference.md §4, read
off the shipped art), and both landscape paintings are painterly too. So the Tumulus is the odd
one out and is the one to re-run if the set ever needs to match exactly.

### Shared icon line

Append to each of the five icon prompts:

> Civilization VII building icon: one subject centred with a clear margin, three-quarter view from
> slightly above, full colour, painterly oil rendering with soft edges and a soft drop shadow,
> warm desaturated palette, flat mid-grey #808080 background with nothing else on it, no border,
> no frame, no text, no watermark. Square, 1024×1024.

The flat field matters as much as the subject: it is what lets the background be keyed away. The
contact-sheet versions were painted full-bleed to the tile edge, which is why none of them could
be used.

### 1. `civ_sym_etruscans` — **done 2026-09-09** (all three creatures read; survives to 48 px)

> Flat pure-white silhouette on solid black: the Chimera of Arezzo in strict side profile facing
> left. It has to read as three creatures in one — a lion's body striding forward, its mane in
> stiff flame-shaped locks; a second head, a horned goat's, rising on a long neck from the middle
> of the lion's back and turned to face backwards; and a tail that ends in a snake's head reared
> up and turned back towards the goat. Narrow black cut-lines separate mane from body, the goat's
> neck from the mane, and the snake from the tail. One bold closed shape, no gradients, no
> outline, no shading, no text, centred with a generous margin. Square, 1024×1024. **Not a plain
> lion** — the goat's head and the snake-headed tail are the whole point of the emblem.

### 2. `wondericon_fanum_voltumnae` — **done 2026-09-09** (the Tuscan order arrived: deep eave, unfluted columns, acroteria along the ridge)

> An Etruscan temple of the Tuscan order. **Not a Greek temple**: the columns are smooth and
> unfluted, wooden on low stone bases, and spaced roughly twice as far apart as a Greek temple's;
> the roof is low-pitched and overhangs so far that the eave projects about a third of the
> building's depth, throwing the whole porch into shadow; the gable is open woodwork, not carved
> marble. It stands on a high stone podium reached by one broad flight of steps at the front only.
> Painted terracotta figures stand along the roof ridge and at the corners of the eaves, and
> painted terracotta plaques sheathe the projecting beam ends. Behind the deep porch are three
> doorways for three cellae. The silhouette is wide, low, heavy and top-heavy with roof.
> Terracotta red, cream stucco, dark timber.

### 3. `buildicon_bottega` — content right, composition wrong

The second attempt fixed the subject completely — shop counter, propped shutter, panel on the
easel, pigment slab, ultramarine jar, plaster hand — and then composed it as **a flat framed panel
that fills the frame edge to edge**, with its own drop shadow, so there is no background to key and
it comes out as a rectangle among four cut-out objects. Keying the cream wall as well was tried;
it does nothing, because the wall *is* the picture.

Installed as interim. The fix is to ask for the same content as a **cutaway block**, which is the
device that makes the Cuniculus work:

> A Florentine artist's workshop, drawn as a single free-standing cutaway block of building seen in
> three-quarter view from slightly above — a corner of masonry wall with the shop front cut out of
> it, the block ending in irregular broken edges on every side and floating with nothing behind it.
> **Not a flat panel, not a framed picture, nothing reaching the edges of the frame.** In the wall,
> a wide stone-arched opening at ground level with its heavy wooden shutter propped up horizontally
> as an awning, and the counter beneath it crowded with work: a half-finished painted panel on a
> small easel, a stone slab with pigment being ground, open jars of ochre and one of ultramarine,
> brushes in a pot, a mahlstick, a plaster cast of a hand and a small terracotta model on the shelf
> above. Plain lime-washed wall and dressed sandstone.

> A Florentine artist's workshop seen from the street. **The subject is the shop counter, not the
> building.** A wide stone-arched opening at ground level with its heavy wooden shutter propped up
> horizontally as an awning, and the counter beneath it crowded with work: a half-finished painted
> panel propped on a small easel and catching the light, a stone slab with pigment being ground on
> it, open jars of ochre and one of ultramarine, brushes standing in a pot, a mahlstick, a plaster
> cast of a hand and a small terracotta model on the shelf above. Plain lime-washed wall and
> dressed sandstone around the opening. **No church, no altarpiece, no cloister, no arcade** — a
> working shop, and the working clutter is what identifies it.

### 4. `buildicon_banco` — **done 2026-09-09**

> A Florentine bank: a long banker's bench under a single stone loggia arch, spread with a green
> cloth. On the cloth an open leather-bound ledger showing two columns of figures, a pair of brass
> scales, a stack of gold florins and a spilled leather purse; beneath the bench an iron-banded
> strongbox with three locks. Grey-green pietra serena, green cloth, gold. One group of objects,
> not a room interior.

### 5. `wondericon_santa_maria_del_fiore` — re-run at size

> The cathedral of Florence: Brunelleschi's octagonal dome in red terracotta tile with eight white
> marble ribs and a white marble lantern on top, the drum beneath it pierced with round oculi; the
> nave running back from the dome, its flank faced in polychrome marble — white, dark green and
> rose — and Giotto's slender square campanile rising beside it in the same marble. Angle it so the
> dome dominates and the campanile reads clearly against the sky rather than against the nave.

### 6. `leader_porsenna` — correction and re-run at size

> Lars Porsenna, an Etruscan king of Clusium about 500 BC. Head and shoulders, three-quarter view
> from the front left, looking at the viewer. A man in his fifties, dark hair and a full
> spade-shaped beard in tight archaic curls, a strong straight nose, and the faint closed-lip
> archaic smile of Etruscan tomb sculpture. He wears **a tall stiff conical felt cap rising to a
> blunt point — the Etruscan tutulus, not a soft beret and not a Renaissance cap** — a heavy gold
> and amber pectoral across the chest, a large gold disc fibula at the shoulder, and a
> purple-bordered tebenna mantle over a linen tunic. He holds a short ivory sceptre with an eagle
> finial. Dark smoky background, warm light from the left. Sid Meier's Civilization VII leader
> portrait, loose oil brushwork, warm desaturated palette, no text, no watermark. Square,
> 1024×1024.

### 7. `leader_lorenzo` — re-run at size, design unchanged

> Lorenzo de' Medici in Florence about 1480: a man of thirty, clean-shaven, straight dark hair cut
> level at the jaw under a red flat cap, a long heavy jaw, a flattened broken-looking nose, a wide
> mouth, dark watchful eyes. He wears a crimson cioppa of heavy wool over a dark doublet and no
> jewellery at all. Head and shoulders, three-quarter view from the front left, looking at the
> viewer. Behind him a dark warm interior and the suggestion of a stone window frame; soft light
> from the left. Sid Meier's Civilization VII leader portrait, loose oil brushwork, warm
> desaturated palette, no text, no watermark. Square, 1024×1024.

### 8. `lsbg_etruscans_vert` / `bg-card-etruscans` — 9:16, at least 1080 wide

> Inside a painted Etruscan chamber tomb at Tarquinia. On the back wall a frescoed banquet: a
> married couple reclining together on a single couch, garlands hung above them, a flute player
> and a lyre player, dancers among stylised trees; red, ochre and black pigment on plaster, the
> plaster cracked and worn away in patches. The chamber is cut from rock and carved to imitate a
> house, with a beamed ceiling and a low bench along the wall. An oil lamp standing on the floor
> lights it from below, and at the edge of the frame the doorway is a rectangle of pale daylight.
> Vertical composition, the couple in the upper two thirds. Sid Meier's Civilization VII concept
> painting, loose oil brushwork, warm desaturated palette, soft rim light, no text, no watermark.

### 9. `lsbg_tuscany_1080` / `_720` / `bg-panel-tuscany` — 16:9, at least 1920 wide

> Florence from the hills above San Miniato at golden hour: Brunelleschi's red-tiled dome and white
> lantern dominating the skyline, Giotto's pale campanile beside it, the crenellated tower of the
> Palazzo Vecchio further off, red roofs packed close between them, the Arno curving through with
> the shops of the Ponte Vecchio sitting on it. Cypresses and olive terraces on the slope in the
> foreground, blue hills fading behind. Haze and a low sun. Sid Meier's Civilization VII concept
> painting, loose oil brushwork, warm desaturated palette, soft rim light, no text, no watermark.

### 10. `lsbg_tuscany_vert` / `bg-card-tuscany` — 9:16, at least 1080 wide

> The courtyard of a Florentine palazzo at midday, looking up: two storeys of grey pietra serena
> arches on slender columns around a small square of flagstones, a bright square of sky above, a
> bronze statue on a plinth in the middle, a marble bust and an open folio on a stone bench, and an
> apprentice carrying a wooden panel through an archway in deep shade. Vertical composition, hard
> sunlight from directly above, the loggia in shadow. Sid Meier's Civilization VII concept
> painting, loose oil brushwork, warm desaturated palette, no text, no watermark.

## 8. After dropping them in

```bash
find Etruscans Tuscany -name '*.xml' -exec xmllint --noout {} +
python3 tools/check-mod.py Etruscans --with Tuscany
./install.sh && open -a "Sid Meier's Civilization VII"
```

Then check in the picker: the symbol should appear tinted in the player's colour (if it appears
white or black, the file was not a white-on-transparency mask); the unit flags should read as
silhouettes on the coloured flag; the card, panel and loading art should show — if they do not,
that is the UI-hook problem described in [byzantium-art.md](byzantium-art.md) §4, not the art.
Bump `<Version>` in both places in the modinfo when the real set lands.
