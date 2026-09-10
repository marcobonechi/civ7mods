# Civ7 Art Studio

A local web app for authoring Civilization VII binary art packages — building skins,
improvements, wonders, units, audio, meshes, textures, materials and civ banners —
without editing Python.

```sh
pip install -e .
civart                      # http://127.0.0.1:8765, opens a browser
```

It needs a Civilization VII install to read from: donor packages, borrowed art, and the
asset index all come from it. Nothing is written there — the build produces two folders
you copy into place yourself.

## Why it exists

The pipeline underneath this was reverse-engineered from the shipped binaries and works,
but every authoring surface was a Python literal in `build_blp.py`. This turns those
into a manifest and puts a UI on it.

The more useful half is the guardrails. Almost nothing in this format fails loudly: a
building with no footprint entry renders as empty air, an unregistered improvement
renders nothing, a texture named `icon.png` never resolves, a PCM sound bank loads and
returns a real play id and then plays silence. Each of those cost a debugging session to
find, and each is now a check that fires while you are still looking at the field that
caused it.

## Project layout

```
~/Documents/CivVIIArt/MyCivMod/
    civart.json                 the manifest — everything the UI edits
    project/                    raw inputs you import
        textures/  meshes/  audio/  materials/
    built/
        DLC/MyCivMod/           >>> copy into <game install>/DLC/
        Mods/MyCivMod/          >>> copy into <userdata>/Mods/
```

The two output folders are named for where they go because that is the mistake that
costs people the most time. Art packages are only ever found under the game install's
`DLC/`; the user Mods folder is not searched for them, and getting it wrong produces no
error — just `No Packages found for project` buried in `ArtDef.log`.

## What the sections do

| Section | |
|---|---|
| Projects | game path, project creation, switching |
| Buildings | bind a `ConstructibleType` to art, or skin an existing building |
| Improvements / Wonders | region patterns, attachment sets copied from a shipped asset |
| Units | reskin by pointing a unit's members at another unit's |
| Audio | import Wwise `.wem`, with the conversion settings inline |
| 3D assets | glTF import, sized against the ~18-unit human reference |
| UI textures | import BC7 DDS; the payload ships exactly as your encoder made it |
| Materials | texture slots, tint mode, aniso vs standard |
| Civ banners | deep-clone a shipped banner with your own material |
| Asset browser | search everything the game ships, and see what an asset pulls in |
| Build & deploy | donor selection, blob sync, validation, `.dep` and `.modinfo` |

The asset browser is load-bearing rather than a convenience: every other section asks you
to name a shipped asset, and those names exist only inside binary packages.

## Donors

Every package copies a type registry verbatim from a shipped one, and a donor that does
not declare a type you emit is a hard failure. The right donor therefore depends on what
your manifest contains and changes as you add features — so it is measured, not
remembered. The first build records its choice in the manifest so later rebuilds
reproduce the same bytes.

## Releasing

The tools that read and write the binary formats live in the custom-art mod's `tools/`
directory, which is where they were written and where their fixtures are. A wheel has no
checkout to point at, so vendor them in first — the checkout stays the source of truth
and `--check` catches drift:

```sh
python3 vendor_tools.py            # copy tools/ into civ7_art_studio/blp/
python3 vendor_tools.py --check    # verify the copy is current
python3 -m build                   # or: pip wheel . --no-deps
```

The wheel is ~140 KB and self-contained. Verify it the way a user would get it — install
into a clean environment and run from a directory with no checkout:

```sh
pip install dist/civ7_art_studio-*.whl
cd /tmp && civart
```

`skins.py` is deliberately **not** vendored. It is generated from whichever game is
installed, so it is regenerated per machine; the package treats it as absent rather than
failing to import without it.

### Getting it to modders

Most Civ VII modders do not have Python, which rules out `pip install` as the headline
instruction even though it works.

| | |
|---|---|
| **Standalone `.exe`** — PyInstaller onefile. Nothing to install, one download. Must be built on Windows, and the web assets need bundling explicitly. Best reach. |
| **Wheel on a GitHub release** — one command for anyone who has Python, and the right thing to publish alongside an exe. |
| **PyPI** — `pip install civ7-art-studio`. Least friction to update, same Python requirement. |

For the executable, the two things that catch people out are the package data and the
hidden uvicorn imports:

```sh
python3 vendor_tools.py
pyinstaller --onefile --name civart ^
  --add-data "civ7_art_studio/web;civ7_art_studio/web" ^
  --add-data "civ7_art_studio/blp;civ7_art_studio/blp" ^
  --collect-submodules uvicorn ^
  civart.py
```

Three things catch people out here.

**Point it at `civart.py`, not at `civ7_art_studio/__main__.py`.** PyInstaller runs its
entry script as `__main__` with no package context, so the first relative import inside
the package fails outright:

    from .server import serve
    ImportError: attempted relative import with no known parent package

`civart.py` exists only to import the package by name, which gives the module a parent
and lets its relative imports resolve. A `pip install` does not need it — the console
script entry point imports the module properly — but a frozen build does.

**`web/index.html` and the vendored `blp/` modules are data, not imports.** PyInstaller
finds modules by tracing imports, and these are read from disk at runtime, so without
`--add-data` the build succeeds and the app fails on its first request. `blp/` is loaded
by path too, so it has to be copied rather than collected.

**The vendored tools' own dependencies are invisible too.** Because `blp/` ships as
data, nothing traces what those modules import, so a third-party import in there is
silently left out and only fails when a user reaches that code path. The tools now have
none — dropping the unused BC7 encoder took numpy with it, and roughly 150 MB off a
frozen build. `test_vendored_tools_declare_their_dependencies` enumerates their imports
so a new one fails in the test suite rather than in somebody's exe.

`--collect-submodules uvicorn` covers uvicorn's runtime-selected protocol and logging
modules, which are likewise invisible to import tracing.

## Development

```sh
python3 -m pytest tests -q                          # this package
python3 -m pytest ../mod/custom-art/tools/test_build.py -q   # the emitters
```

`CIV7_GAME_ROOT` points at the install; tests needing it skip without it, as do the ones
measuring against the custom-art mod.

The binary-format tools are vendored into `civ7_art_studio/blp/` and that copy is what
both the tests and an installed wheel use, so what runs in development is what ships.
`vendor_tools.py --check` is a test, so the copy cannot drift from the checkout
unnoticed. `CIV7_ART_TOOLS` overrides the location if you want to point at a checkout
directly.

The strongest test is that building the custom-art manifest reproduces the packages
already installed and confirmed working in-game, byte for byte.
