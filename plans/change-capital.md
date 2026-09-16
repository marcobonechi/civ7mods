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

Mechanic 2 is also **additive — it overrides no stock file** (`ui/change-capital-chooser.js`),
using two official extension points:

- **`Controls.decorate("panel-production-chooser", provider)`.** The engine stores decorator
  providers in a *list* per component (`core/ui/component-support.js`, `addDecorator`), so mods
  stack instead of clobbering. The Workshop mod *Purchase All Walls* decorates this very same
  panel, which is the proof two mods can do so side by side. The decorator:
  - wraps the panel's `items` accessor pair (found by walking the prototype chain — the accessor
    is on the prototype, not the instance) and pushes a synthetic "Make Capital" entry into the
    `projects` category for the player's own non-capital cities, production tab only;
  - wraps `doOrConfirmConstruction(category, type, cb)`, the click entry point every row goes
    through, and handles the sentinel type itself instead of delegating to the stock path.
- **The game's own dialog**, reached by dynamic `import("/core/ui/dialog-box/manager-dialog-box.js")`
  from a plain (non-module) UIScript: `DialogManager.createDialog_ConfirmCancel({title, body,
  callback})`, with the callback comparing against `DialogBoxAction.Confirm`. This inherits the
  game's styling, input routing, controller navigation and Escape-to-close — all of which the
  earlier hand-built DOM dialog had to fight for, and only partly won (Escape never worked).

The item's icon is a real, existing game asset: `data/icons.xml` maps the sentinel type
(`CHANGE_CAPITAL_RELOCATE_ACTION`, deliberately absent from `GameInfo.Types` so it can never
collide with a real type) to `blp:ntf_select_capital`, the icon the base game uses for its own
"select capital" notification — no new art needed.

**Superseded approach, kept in the history (the commit that first added this mod):** the first working
version shipped a whole modified copy of
`base-standard/ui/production-chooser/production-chooser-helpers.js` at the stock file's path
(the technique *Move Building* uses), patching `GetProductionItems` and `Construct` directly. It
worked, but a path is winner-takes-all — any third mod shipping that path would silently erase
this feature or have its own erased — and it forced a hand-built DOM dialog with two hard-won
rules (flat sibling elements, since a nested wrapper rendered backgrounds but invisible text; and
plain pixel positioning, since `calc(50vw …)` rendered correctly but never received clicks).
Both of those problems disappear with the native dialog.

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
