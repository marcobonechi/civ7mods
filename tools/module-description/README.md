# Module description generator

Regenerates the mod's description in every language it ships.

The description lists all 53 true starts, so retyping it by hand across twelve
languages is how it went stale before: it still named Pliska for Bulgaria and
Madrid for Spain long after both had moved, and claimed Aksum and Songhai were
on the large maps only.

- `build.py` assembles each language from `prose.py` (the hand-written body text)
  and the civilization and city tables in `cities.py`, filling the per-age lists
  from `pairs.json`.
- `pairs.json` is generated from `GEO.tsl`, so the lists cannot drift from the map.
- Civilization names come from the game's own localisation files, so they read
  exactly as they do in the interface. Ukrainian is not shipped by the game and
  the three civilizations from this repo are not in it either, so those names are
  supplied by hand in `cities.py`.

Regenerate after changing `GEO.tsl`:

    node -e '...'                      # rebuild pairs.json, see the git history
    python3 tools/module-description/build.py

then paste into `europe-mediterranean.modinfo`, `text/en_us/ModuleText.xml` and
`l10n/ModuleText.xml`.
