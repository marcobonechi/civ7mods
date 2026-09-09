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
| `civ_sym_<civ>.png` | 256² | 256² | **White shape on transparency.** Recoloured through `filter: fxs-color-mask(...)`, so any colour in the file is thrown away. |
| `unitflag_*.png` | 128² | 256² | **White silhouette on transparency**, drawn on the player's coloured flag. |
| `buildicon_*.png`, `wondericon_*.png` | 128², Cuniculus 256² | 256² | **Full colour on transparency.** Painting with a soft shadow, three-quarter view from above. |
| `leader_<name>.png` | 256² | 256² | Portrait. Firaxis ships a hex crop and a circle crop as separate files; ours points all three icon contexts at one PNG — see §5. |
| `lsbg_<civ>_1080.png` | 1920×1080 | same | Loading-screen painting. |
| `lsbg_<civ>_720.png` | 1280×720 | same | The same painting, downscaled. |
| `lsbg_<civ>_vert.png` | 1080×1920 | same | Tall card in the age-transition civ select. |
| `bg-card-<civ>.png` | 720×1080 | same | Civ detail panel. |
| `bg-panel-<civ>.png` | 1301×732 | same | Picker background and narrative panel. 16:9, drawn `background-size: cover`, so keep detail away from the edges — the crop moves with the window. |

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

### `civ_sym_etruscans` — 1:1, silhouette

> The Chimera of Arezzo in strict side profile: a lion striding left, its mane in stiff
> flame-shaped locks, a goat's head and neck rising from the middle of its back, the tail a
> rearing snake that turns to face the goat. Narrow black cut-lines separate mane from body,
> goat from lion and snake from tail.

Alternative, if the chimera reads as clutter at 32 px: *a pair of winged horses in profile, wings
raised and overlapping, after the terracotta relief from the Ara della Regina at Tarquinia.*

### `unitflag_biga` — 1:1, silhouette

> An Etruscan two-horse war chariot from the side: two horses at full gallop, heads together,
> forelegs raised; behind them a light open chariot box on one spoked wheel; a driver leaning
> forward with the reins taut. Narrow black cut-lines for the reins, the wheel spokes and the gap
> between the two horses.

### `unitflag_tyrrhenian_galley` — 1:1, silhouette

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

### `buildicon_tumulus` — 1:1, icon

> An Etruscan tumulus tomb at Cerveteri: a circular drum of squared tufa blocks cut down into the
> rock, a grassed earth mound heaped on top, a low doorway with a heavy lintel at the front
> opening into darkness, a stone bench running round the base. Warm ochre stone, dry grass, the
> shadow of a cypress falling across it.

### `wondericon_fanum_voltumnae` — 1:1, icon

> An Etruscan temple in the Tuscan order: a high stone podium with one broad frontal stair, four
> widely spaced wooden columns with plain cushion capitals, a very deep overhanging gable roof of
> terracotta tiles, brightly painted terracotta antefixes and acroteria along the ridge, three
> doorways behind the porch for three cellae. Wide, low and heavy — nothing Greek or slender.
> Terracotta red, cream stucco, dark timber.

### `leader_porsenna` — 1:1, portrait

> Lars Porsenna, an Etruscan lucumo of Clusium about 500 BC: a man in his fifties, dark hair and a
> full spade-shaped beard in tight archaic curls, a strong straight nose, and the faint closed-lip
> archaic smile of Etruscan tomb sculpture. He wears a tall pointed felt cap, a heavy gold and
> amber pectoral, a large gold fibula at the shoulder, and a purple-bordered tebenna mantle over a
> linen tunic; he holds a short ivory sceptre. Head and shoulders, three-quarter view from the
> front left, looking at the viewer. Dark smoky background, warm light from the left.

### `lsbg_etruscans_1080` / `_720` / `bg-panel-etruscans` — 16:9, painting

> Tarquinia in southern Etruria at golden hour, seen from across the valley: a city of tufa walls
> and low tiled roofs along a flat-topped ridge, a painted Tuscan-order temple with a deep gabled
> roof standing on the highest point, its terracotta antefixes catching the sun. In the middle
> distance a field of round grassed tumulus tombs laid out along cut streets. In the foreground the
> mouth of a cuniculus spilling water into an irrigated field, and two figures in Etruscan mantles
> walking a track. Long shadows, dust in the air.

### `lsbg_etruscans_vert` / `bg-card-etruscans` — 9:16, painting

> Inside a painted Etruscan chamber tomb at Tarquinia: on the back wall a frescoed banquet, a
> married couple reclining together on a single couch, garlands hung above them, a flute player and
> a lyre player, dancers among stylised trees; red, ochre and black pigment on plaster, the plaster
> cracked and worn. An oil lamp on the floor lights the chamber from below; at the edge of the
> frame the doorway is a rectangle of pale daylight. Vertical composition, the couple in the upper
> two thirds.

## 4. Tuscany

Palette: terracotta roof tile, grey-green pietra serena, lime white, ultramarine, gold florin.

### `civ_sym_tuscany` — 1:1, silhouette

> The Florentine giglio: a lily of three petals, the outer two curling outward and down, a slender
> stamen springing from each side of the central petal, a narrow band at the waist and two small
> leaves below. Strictly symmetrical. Narrow black cut-lines between the petals and the stamens.

### `unitflag_condottiero` — 1:1, silhouette

> A fifteenth-century Italian mercenary captain, bust and shoulders in three-quarter armour: a
> sallet helmet with the visor raised, a bevor at the throat, fluted pauldrons, a broad sash across
> the breastplate, one gloved hand holding a short baton of command angled up across the body.
> Narrow black cut-lines for the visor gap, the edge of the sash and the baton.

### `unitflag_galea_santo_stefano` — 1:1, silhouette

> A Mediterranean war galley from the side: a long low hull, a spur beak at the bow, one bank of
> oars angled down, a single raked mast carrying a big triangular lateen sail bellying forward, a
> stern lantern and a pennant aft. On the sail, a bold cross with forked ends is left as a black
> cut-out.

### `unitflag_maestro` — 1:1, silhouette

> A Renaissance workshop master, bust and shoulders, three-quarter view: a soft flat cap, hair to
> the collar, a plain gown with a working apron over it, one hand raised holding a pair of
> dividers, a mahlstick and a rolled drawing under the other arm. Narrow black cut-lines for the
> dividers, the cap brim and the collar.

### `buildicon_bottega` — 1:1, icon

> A Florentine artist's bottega: a stone-arched shop front open to the street, its wooden shutter
> propped up as an awning; just inside, a painted panel on an easel catching the light; on the
> bench a grinding slab and pigment jars, brushes standing in a pot, a plaster cast on a shelf
> above; lime-washed wall over dressed sandstone. Warm ochre and lead white with one note of
> ultramarine.

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

### `leader_lorenzo` — 1:1, portrait

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

It samples the background from the top-left pixel; pass `--bg '#808080'` to force one, `--fuzz` to
change how much of the soft drop shadow goes with it (18 by default, which took the shadow off the
Cuniculus cleanly), `--margin` for breathing room, and `--keep` to leave the intermediate steps
beside the output when something looks wrong. If the subject shares a tone with the background,
generate on chroma green (`#00b140`) and pass `--bg '#00b140'`.

**Silhouettes** go through the same tool with `--silhouette`, which thresholds instead of keying:

```bash
python3 tools/art-icon.py raw.png Etruscans/icons/civ_sym_etruscans.png --silhouette
```

**Loading screens and the panel** come from one 16:9 painting:

```bash
magick raw16x9.png -resize 1920x1080^ -gravity center -extent 1920x1080 Etruscans/icons/lsbg_etruscans_1080.png
magick Etruscans/icons/lsbg_etruscans_1080.png -resize 1280x720 Etruscans/icons/lsbg_etruscans_720.png
magick Etruscans/icons/lsbg_etruscans_1080.png -resize 1301x732 Etruscans/icons/bg-panel-etruscans.png
```

**Card and vertical card** come from one 9:16 painting, the card being a centre crop:

```bash
magick raw9x16.png -resize 1080x1920^ -gravity center -extent 1080x1920 Etruscans/icons/lsbg_etruscans_vert.png
magick Etruscans/icons/lsbg_etruscans_vert.png -resize 720x1280^ -gravity center -extent 720x1080 Etruscans/icons/bg-card-etruscans.png
```

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

## 6. After dropping them in

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
