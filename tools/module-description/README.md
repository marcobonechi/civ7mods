# Module description generator

Regenerates the mod's description in every language it ships and writes it into the four
places the game reads it from:

- `europe-mediterranean.modinfo` - the `<Description>` (English) and the inline
  `LOC_MODULE_EUROPE_MED_DESCRIPTION` text for all twelve languages
- `text/en_us/ModuleText.xml` - English
- `l10n/ModuleText.xml` - the other eleven languages

    python3 tools/module-description/build.py              # check against the map, then write
    python3 tools/module-description/build.py --check      # check only
    python3 tools/module-description/build.py --print it_IT

Run it after any change to `GEO.tsl` or `GEO.fallbackSites` in `europe-large-geo.js`.

## Layout

The game shows the description as plain text - no markup, and leading spaces are not
guaranteed to survive - so the layout is carried by newlines alone: a blank line between
sections, capitals for headings, and one civilization per line starting with `- ` (`・` in
Japanese), written as `Civilization (City): why it starts there`.

## Files

- `starts.py` - every true start in the order the description lists it, split into historical
  homes and stand-ins, with a reason key for each. Also the Workshop civilizations and the
  fallback sites the text names.
- `prose.py` - the hand-written text per language (`LANG`) and the reasons (`REASONS`).
- `cities.py` - city names per language (anything missing falls back to English), English
  civilization names, and names for civilizations the game's files do not carry (this repo's
  own, the Workshop ones, and all of Ukrainian).
- `civ-names.json` - civilization names taken from the game's own localisation files, so they
  read exactly as they do in the interface.

## Why it checks first

The description lists 57 starts in twelve languages, and retyped by hand it went stale: it
named Pliska for Bulgaria and Madrid for Spain long after both had moved, and the old
`pairs.json` still put Gaul in Paris after it moved to Lausanne. So `build.py` reads `GEO.tsl`
through node and the age rosters from `tools/check-map-sizes.mjs`, and refuses to write unless
every civilization of every age is listed exactly once, at the city its start really is
(within 0.35 degrees), and the fallback sites it names are the first ones in the list.
