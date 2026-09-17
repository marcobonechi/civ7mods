#!/usr/bin/env python3
"""True starts for Byzantium, Tuscany and the Etruscans on the base game's Earth map.

Civilization VII 1.5 ships a real-world map, Earth (Huge), whose start positions are a
hard-coded `switch (player.civilizationName)` inside
`{base-standard}maps/EarthMaps/Earth_Huge.js`. The engine runs that file as the sibling
script of `Earth_Huge.Civ7Map`, it reads no table (`MapStartPositions` is ignored), and
nothing a mod can load runs inside map generation, so the only way in is a same-path
override: each of the three civ mods imports a copy of the stock script at
`base-standard/maps/EarthMaps/Earth_Huge.js` with our cases added before `default:`.

All three copies are byte-identical and carry all three civs, so whichever mod wins the
path, every enabled civ still gets its start. The cost is the usual one for an override:
another mod that replaces the same file wins or loses as a whole, and the copy goes stale
when a game patch changes the stock script. After a patch, run this again:

    python3 tools/earth-tsl.py          # regenerate the three copies from the installed game
    python3 tools/earth-tsl.py --check  # exit 1 if a copy is stale or differs
"""
import pathlib
import sys

GAME = pathlib.Path.home() / (
    "Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/"
    "CivilizationVII.app/Contents/Resources"
)
STOCK = GAME / "Base/modules/base-standard/maps/EarthMaps/Earth_Huge.js"
REL = "base-standard/maps/EarthMaps/Earth_Huge.js"
REPO = pathlib.Path(__file__).resolve().parent.parent
MODS = ["Byzantium", "Tuscany", "Etruscans"]

# Earth_Huge is 106x66, y grows northward, odd rows sit half a hex to the right.
# Reference tiles from the stock script: Rome (51,44) on the Tiber, Greece (56,43),
# Bulgaria (56,47), Ottomans (58,46). The config shell names each civ with its
# *_TIME_TESTED_NAME outside its home age, so both keys are matched.
STARTS = [
    # Constantinople: the stock map's own tile for the city (the Ottomans' start), a hill
    # on the European shore of the straits.
    ("Byzantium", ["LOC_CIVILIZATION_BYZANTIUM_NAME", "LOC_CIVILIZATION_BYZANTIUM_TIME_TESTED_NAME"], 58, 46),
    # Florence, on the Arno: flat ground one row above Populonia, a hex in from the Ligurian coast.
    ("Tuscany", ["LOC_CIVILIZATION_TUSCANY_NAME"], 50, 46),
    # Populonia, the one Etruscan city on the sea: the coastal hill north-west of Rome.
    ("Etruscans", ["LOC_CIVILIZATION_ETRUSCANS_NAME", "LOC_CIVILIZATION_ETRUSCANS_TIME_TESTED_NAME"], 50, 45),
]


def patched(stock: str) -> str:
    fn = stock.index("function assignStartPositionsEarthHuge()")
    anchor = "        default:\n"
    at = stock.index(anchor, fn)
    lines = ["        //civ7mods (github.com/marcobonechi/civ7mods), added by tools/earth-tsl.py\n"]
    for _, names, x, y in STARTS:
        lines += [f'        case "{n}":\n' for n in names]
        lines += [f"          plotIndex = GameplayMap.getIndexFromXY({x}, {y});\n", "          break;\n"]
    return stock[:at] + "".join(lines) + stock[at:]


def main() -> int:
    want = patched(STOCK.read_text())
    stale = []
    for mod in MODS:
        out = REPO / mod / REL
        if "--check" in sys.argv:
            if not out.exists() or out.read_text() != want:
                stale.append(str(out.relative_to(REPO)))
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(want)
        print("wrote", out.relative_to(REPO))
    if stale:
        print("stale, rerun tools/earth-tsl.py:", *stale, sep="\n  ")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
