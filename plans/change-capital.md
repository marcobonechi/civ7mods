# Change Capital

A small gameplay-mod, not a civilization: two ways to relocate your capital.

1. **Free reselection at every age transition.** The stock "pick your new capital" step
   (Dedications deck, age transition) restricts candidates to settlements connected to the old
   capital by a land trade route. This mod patches the native call the picker relies on
   (`Cities.getPotentialSwitchCapitalCityIds`) so every owned settlement is offered instead.
2. **Relocate any time, for a price.** A floating "Relocate Capital" button lets you make any
   other settlement your capital whenever you want, at a flat cost of 300 Diplomacy (Influence)
   points — tune the number in `ui/change-capital-relocate.js` (`RELOCATION_COST`).

## How it works

Both mechanics call the same native operation the age-transition screen itself uses,
`Game.PlayerOperations` with `PlayerOperationTypes.SELECT_CAPITAL`
(`base-standard/ui-next/screens/legacies/legacies-support.js:selectCapital`). Mechanic 1 widens
the candidate list that feeds that screen; mechanic 2 calls the same operation directly from a
standalone button, after checking and deducting Influence via
`player.DiplomacyTreasury.changeDiplomacyBalance(...)` — the same direct mutator base game code
uses in `base-standard/scripts/age-transition-post-load.js`.

Neither piece touches any stock file: this repo's mods only ever ship additive
`<ImportFiles>`/`<UIScripts>`, and `ui-next` is not a monolithic bundle a full-file replace could
safely target anyway. Mechanic 1 patches the global `Players.get` function (the same style of
reassignment `Etruscans/ui/etruscans-images.js` already does for `WorldUI.*`/`UI.*`). Mechanic 2
builds its own floating button and dialog, appended straight to `document.body`, rather than
hooking into a native panel's custom-element class.

## Known risk, needs in-game verification

It is unconfirmed whether `Game.PlayerOperations.canStart(..., SELECT_CAPITAL, ...)`
independently re-validates trade-route connectivity, or simply trusts the city ID it is given.
If it trusts the caller (the more likely case, since duplicating that computation inside
`canStart` would be redundant with `getPotentialSwitchCapitalCityIds()`), both mechanics work as
designed. If it doesn't, relocating to a disconnected settlement will silently fail (or revert)
even though the UI offered it — test this directly: try relocating to a settlement not connected
to the current capital by land trade route, both at an age transition and via the on-demand
button, and confirm the swap actually applies before relying on this mod.

## Verification checklist

- [ ] `tools/check-mod.py ChangeCapital` passes
- [ ] `./install.sh ChangeCapital`, then relaunch the game
- [ ] At an age transition, the capital picker lists a settlement not connected by land trade
      route to the old capital, and selecting it actually moves the capital
- [ ] Mid-game, the "Relocate Capital" button appears, lists other settlements, blocks with a
      clear message when Influence is insufficient, and on confirm both deducts the Influence
      and moves the capital
- [ ] `~/Library/Application Support/Civilization VII/Logs/Modding.log` and `Database.log` show
      no errors after loading this mod
