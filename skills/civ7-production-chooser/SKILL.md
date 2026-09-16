---
name: civ7-production-chooser
description: Add a synthetic entry (e.g. a custom "project") to a Civilization VII city's production/purchase chooser via a same-path file override, and build a UI dialog for it that actually renders text and receives clicks. Use when asked to add an action/button to the production or purchase screen, or when a hand-built Civ 7 UI dialog shows blank text or does not respond to clicks.
---

# Production chooser entries and working dialogs

Built and debugged live while shipping `ChangeCapital`'s "Make Capital" project row
(`ChangeCapital/base-standard/ui/production-chooser/production-chooser-helpers.js`,
`plans/change-capital.md`). Read `reference.md` in this folder for the full worked example and
every pitfall hit along the way; this file is the map of what to do and in what order.

## Ground truth to consult first

- Game UI source (macOS Steam):
  `~/Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources/Base/modules/base-standard/ui/production-chooser/`
  — `production-chooser-helpers.js` (item model: `GetProductionItems`, `getProjectItems`,
  `Construct`), `panel-production-chooser.js` (the panel), and
  `../../ui-next/components/production-chooser-item.js` (the actual row renderer — reads
  `data-type`/`data-name`/etc. attributes and derives the icon from `item.type` via
  `UI.getIconCSS`).
- Logs: `~/Library/Application Support/Civilization VII/Logs/` — `Modding.log` (did the
  ActionGroup that ships your file even get applied this session?), `UI.log` (script errors,
  and anything your own `console.warn` calls print).
- A real, already-installed example of this exact override technique:
  search `~/Library/Application Support/Steam/steamapps/workshop/content/1295660/` for a
  modinfo whose `<ImportFiles>` item is
  `base-standard/ui/production-chooser/production-chooser-helpers.js` — Workshop mods that add
  their own row to this screen (e.g. a "Move Building" mod) all use this technique, and diffing
  their copy against the stock file is the fastest way to see what a minimal patch looks like.

## Procedure

1. **Confirm the same-path override technique works before designing your feature.** This
   game's modding VFS lets a mod override a stock file outright by shipping one of its own at
   the exact identical path via `<ImportFiles>` — there is no `ReplaceUIScript`/`Override`
   element, just a plain `<Item>` at a path another mod (or the base game) also ships. Only one
   file wins per path (see reference.md §1 for the full compatibility implications).
2. **Check whether another mod already overrides this same file.** If so, base your copy on
   *that* mod's already-patched version, not the pristine stock file, and set your own
   `LoadOrder` higher — otherwise installing your mod silently deletes the other mod's feature
   (or vice versa). `grep -rl "production-chooser-helpers.js" <Mods and Workshop dirs>`.
3. **Add `<AffectsSavedGames>0</AffectsSavedGames>`** to `<Properties>` if the mod has no
   `<UpdateDatabase>` that a save would depend on. Without it, the game silently skips loading
   the mod into any save that predates its installation — no error anywhere, the file just never
   runs. This one is easy to burn an entire debugging session on (reference.md §2).
4. **Push a synthetic item into `GetProductionItems`'s `projects` array**, not a real
   Constructible/Unit — a "project" is the only item kind whose fields
   (`name`, `description`, `type`, `cost`, `turns`, `category`, `showTurns`, `showCost`,
   `insufficientFunds`, `disabled`) don't require a database row to already exist. Give it a
   `type` string that is a deliberate sentinel (not a real `GameInfo.Types` entry) — e.g.
   `"MY_MOD_CUSTOM_ACTION"`.
5. **Intercept `Construct(city, item, isPurchase)`** at its very first line: if
   `item.type === YOUR_SENTINEL`, run your own handler and `return false` before the stock
   code's `GameInfo.Types.lookup(item.type)` (which will find nothing for a sentinel and take
   the wrong branch otherwise).
6. **Give it a real icon for free**: add an `IconDefinitions` row (`<UpdateIcons>`) mapping your
   sentinel type string to an existing `blp:` icon already shipped by the game — the row-renderer
   resolves `item.type` through `UI.getIconCSS`, so no new art is needed.
7. **Build any dialog your handler needs following the rules in the next section** — this is
   where a first attempt usually goes wrong.

## Building a dialog that actually works

Two rules, both learned by having something *look* right and then not work:

- **Flat, independent sibling elements appended directly to `document.body`** — one element
  per piece of content (title, body text, each button) — not children nested inside one wrapper
  `div`. A nested-wrapper dialog rendered its background and border correctly but left every
  piece of text invisible, for reasons not worth chasing once the flat structure was confirmed
  to reliably show text (matching a simple standalone floating button and toast notifications,
  both of which are flat top-level elements and always rendered fine).
- **Position with plain pixel values, computed in JS** (`window.innerWidth`/`innerHeight`, or
  `someElement.getBoundingClientRect()`), **never CSS `calc(50vw ...)`/`calc(50vh ...)`.** A
  `calc()`-with-viewport-units dialog rendered in visually the right place but its buttons never
  received a single click — the pointer events went straight through to the 3D map underneath,
  while a plain-pixel `position: fixed; left: <n>px` element (built exactly the same way
  otherwise) receives clicks normally. This game's UI engine has other confirmed non-standard
  CSS behaviour (see `Etruscans/ui/etruscans-images.js`'s notes on `CSSStyleDeclaration` and
  `Image.src`), so treat any CSS feature beyond plain pixels/percent-of-parent as suspect until
  proven, rather than assuming standard CSS semantics.

Not yet solved: closing a hand-built dialog on the Escape key. A capture-phase
`document.addEventListener("keydown", ..., true)` with `stopPropagation`/`stopImmediatePropagation`
did not fire — keyboard input in this engine likely does not travel as a normal DOM `keydown`
event at all (the logs show a distinct `engine-input` event name elsewhere in the codebase). If
you need this, that custom event system is the next thing to try, not more DOM listeners.

## Debugging checklist when a new mod-shipped screen/dialog "does nothing"

1. `console.warn` an unconditional line at the very top of the file/IIFE, then check `UI.log`
   for it after relaunching. Nothing there means the file never loaded — check `Modding.log`'s
   "Applying mod components" section for your `ActionGroup` id; if it's missing entirely while
   a comparable always-on utility mod's is present, suspect `AffectsSavedGames` (§2 above) or an
   `ActionCriteria` mismatch before suspecting your JS.
2. If the file loads but nothing visible happens, log the exact arguments and the exact
   `canStart`/similar result object (`JSON.stringify`) right before the call that's supposed to
   do something — some operations (confirmed for `PlayerOperationTypes.SELECT_CAPITAL`) report
   only `{"Success":false}` with no `Requirements`/`FailureReasons` at all, so the only way to
   find a wrong argument is comparing your call, field by field, against the native call site
   that does the same thing successfully elsewhere in the game's own code.
3. If a value looks right but is rejected anyway, check whether it's the right *shape* — a
   `ComponentID` object (`{owner, id, type}`) versus its own `.id` numeric field is a common
   mismatch: the native age-transition capital-picker code does `City: cityID.id` where its own
   `cityID` parameter is *already* a `ComponentID`, i.e. the field it passes is
   `someCityObject.id.id`, one level deeper than it looks from the call site alone.
