# Change Capital

A small gameplay-mod, not a civilization: two ways to relocate your capital.

1. **Free reselection at every age transition.** The stock "pick your new capital" step
   (Dedications deck, age transition) restricts candidates to settlements connected to the old
   capital by a land trade route. This mod patches the native call the picker relies on
   (`Cities.getPotentialSwitchCapitalCityIds`) so every owned settlement is offered instead.
2. **Relocate any time, for a price.** A "Make Capital" entry appears as a project row in the
   production/purchase chooser of any of your own non-capital cities. Clicking it opens a
   confirmation dialog; confirming spends Diplomacy (Influence) points and makes that city your
   capital. Cost scales with the current age — tune `CHANGE_CAPITAL_COST_BY_AGE` in
   `base-standard/ui/production-chooser/production-chooser-helpers.js`:
   - Antiquity: 100
   - Exploration: 200
   - Modern: 300
   - Any other/future age: falls back to `CHANGE_CAPITAL_DEFAULT_COST` (300)

**Verified in-game (2026-09-15):** mechanic 2 works end to end — cost check, Influence
deduction, and the actual capital relocation, confirmed both by the toast/dialog and by checking
`Players.get(...).Cities.getCapital()` and the city banner's capital star after the fact.
Mechanic 1 (the age-transition picker) has not yet been separately confirmed in-game.

## How it works

Both mechanics call the same native operation the age-transition screen itself uses,
`Game.PlayerOperations` with `PlayerOperationTypes.SELECT_CAPITAL`
(`base-standard/ui-next/screens/legacies/legacies-support.js:selectCapital`). Mechanic 1 widens
the candidate list that feeds that screen; mechanic 2 calls the same operation directly, after
checking and deducting Influence via `player.DiplomacyTreasury.changeDiplomacyBalance(...)` — the
same direct mutator base game code uses in `base-standard/scripts/age-transition-post-load.js`.

One easy-to-miss detail cost real debugging time: the operation's `City` argument wants the
**plain numeric city id**, not the `ComponentID` object a `City`'s own `.id` property holds. The
native code does `City: cityID.id` where its own `cityID` parameter is already a `ComponentID` -
i.e. it needs `city.id.id`, one level deeper than it looks. Passing the bare `ComponentID` made
`canStart` return `{"Success":false}` with no further detail (unlike `BUILD`/`PURCHASE`, this
operation reports no `Requirements`/`FailureReasons` on failure), so this needed comparing our
call against the native one line by line rather than reading an error message.

Mechanic 1 is an **additive** script: it patches the global `Players.get` function (the same
style of reassignment `Etruscans/ui/etruscans-images.js` already does for `WorldUI.*`/`UI.*`),
loaded via `<UIScripts>`. No stock file is touched.

Mechanic 2 is a **same-path file override**: the Workshop mod `MovableBuildings` (already
installed) proves this game's modding VFS lets a mod override a stock file outright, by shipping
one of its own at the exact same path via `<ImportFiles>`. `ChangeCapital` ships its own copy of
`base-standard/ui/production-chooser/production-chooser-helpers.js` — based on the copy
`MovableBuildings` already ships (not the pristine stock file), so both mods' changes keep
working together regardless of load order — with:
- `GetProductionItems` pushes a synthetic "Make Capital" entry into the `projects` category for
  any of the player's own non-capital cities. The item's icon is a real, existing game asset
  (`data/icons.xml` maps the sentinel type to `blp:ntf_select_capital`, the same icon the base
  game uses for its own "select capital" notification) — no new art needed.
- `Construct` (the click handler every item in this screen goes through) special-cases that
  entry's sentinel type (`CHANGE_CAPITAL_RELOCATE_ACTION`, which deliberately doesn't exist in
  `GameInfo.Types`) before the stock code's own type lookup, and shows a confirmation dialog
  instead of dispatching a real production/purchase operation.
- The confirmation dialog is built from **flat, independent sibling elements appended directly
  to `document.body`** (title, body text, and each button as separate top-level elements), not
  nested inside one wrapper `div`. An earlier nested-wrapper version rendered its border/
  background correctly but left every piece of text invisible in this engine, for reasons not
  worth chasing once the flat structure was confirmed to reliably show text (matching this mod's
  original floating button and its toast notifications, which are likewise flat single elements).

**Compatibility caveat, inherent to same-path overrides, not a bug:** the game's modding
filesystem serves exactly one file per path. If any *other* mod also ships a file at
`base-standard/ui/production-chooser/production-chooser-helpers.js` with a higher `LoadOrder`
than this mod's (currently `1700`, above `MovableBuildings`' `1666`), that mod's file wins
outright and this mod's entire "Make Capital" feature silently stops loading — no error, it just
never runs (and vice versa: a mod with an even higher `LoadOrder` would silently drop this mod's
changes). There is no way to "merge" three or more mods that all touch this same file short of
manually combining their changes into one shipped copy. This is stated plainly in the mod's own
in-game description (`LOC_MODULE_CHANGE_CAPITAL_DESCRIPTION`), not just here.

## Localization

Text ships for the same 12 languages as `EuropeMediterranean` (English plus 11), following the
same file layout:
- `text/en_us/ModuleText.xml` / `text/en_us/ChangeCapitalText.xml` — English base.
- `l10n/ModuleText.xml` — the mod's name/description in the 11 other languages, each as a
  `<Replace Tag="..." Language="xx_XX">` row; loaded under **both** the shell (so the mod browser
  shows a localized name/description before a game exists) and game scopes, matching how
  Byzantium loads its own `ModuleText.xml`.
- `l10n/<lang>_Text.xml` — the gameplay strings (project name/description, confirmation dialog,
  toast messages) per language, loaded only when that locale is active
  (`<Item locale="xx_XX">...</Item>`).

Gameplay strings deliberately avoid `[icon:...]` rich-text markup (e.g. `[icon:YIELD_DIPLOMACY]`)
even though the base game's own text uses it freely — the confirmation dialog and toasts are
built from plain `textContent`, not the native rich-text renderer, so that markup would show up
as literal bracket text instead of an icon glyph.

## Verification checklist

- [x] `tools/check-mod.py ChangeCapital` passes
- [x] `./install.sh ChangeCapital`, then relaunch the game
- [ ] At an age transition, the capital picker lists a settlement not connected by land trade
      route to the old capital, and selecting it actually moves the capital
- [x] "Make Capital" appears as a project row in a non-capital city's production/purchase
      chooser, at the cost matching the current age, with a real icon
- [x] Clicking it shows a readable confirmation dialog (title, body, Cancel/Confirm buttons)
- [ ] Confirming with insufficient Influence shows a clear message and does not relocate or
      deduct anything
- [x] Confirming with sufficient Influence deducts it and actually moves the capital to that city
- [x] `~/Library/Application Support/Civilization VII/Logs/Modding.log` and `UI.log` show no
      errors after loading this mod (once `<AffectsSavedGames>0</AffectsSavedGames>` was added —
      without it, the game silently skipped loading this mod into a save that predated its
      installation)
