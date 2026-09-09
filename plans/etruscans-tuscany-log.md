# Etruscans and Tuscany — work log

A running record of what was built, in what order, and what is still open. Marco asked for this so
the history is readable and easy to adjust; each entry corresponds to one or more commits.

Design sheets: [etruscans.md](etruscans.md), [tuscany.md](tuscany.md).
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
