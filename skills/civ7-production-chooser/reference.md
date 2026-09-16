# Reference: production chooser entries and working dialogs

Worked example: `ChangeCapital`'s "Make Capital" project — a button that appears in any of the
player's non-capital cities' production/purchase screen, spends Diplomacy (Influence) points on
confirmation, and relocates the capital there. Full source:
`ChangeCapital/base-standard/ui/production-chooser/production-chooser-helpers.js`,
`ChangeCapital/change-capital.modinfo`, `ChangeCapital/data/icons.xml`. Design log:
`plans/change-capital.md`.

## §1. Same-path file override: mechanics and the compatibility trade-off

Firaxis's modinfo format has no `ReplaceUIScript`/`Override` action — only `<ImportFiles>` and
`<UIScripts>`, which register files additively. But the modding VFS resolves each *path* to
exactly one file, so shipping a file at the identical relative path as a stock (or another mod's)
file makes that mod's copy the one actually loaded — confirmed by an installed Workshop mod
("Move Building" / `MovableBuildings`) that does exactly this to add its own entries to this same
screen:

```xml
<ActionGroup id="windfly-game" scope="game" criteria="always">
  <Properties><LoadOrder>1666</LoadOrder></Properties>
  <Actions>
    <UpdateDatabase><Item>constructibles_movable.sql</Item></UpdateDatabase>
    <ImportFiles>
      <Item>base-standard/ui/production-chooser/production-chooser-helpers.js</Item>
    </ImportFiles>
  </Actions>
</ActionGroup>
```

**This is winner-takes-all per path, not a merge.** If two mods both ship a file at
`base-standard/ui/production-chooser/production-chooser-helpers.js`, the game loads exactly one
of them (higher `ActionGroup` `LoadOrder` wins) and the other mod's *entire* file — including any
changes unrelated to the conflict — silently never runs. There is no error, no log line calling
out the conflict; the losing mod's feature just doesn't exist for that session.

Two ways to reduce the blast radius, both used by `ChangeCapital`:

- **If another mod already overrides the same path, base your copy on its already-patched
  file**, not the pristine stock one, and set your own `LoadOrder` higher. This keeps both mods'
  features working together regardless of which one a player installs "on top". `ChangeCapital`
  copied `MovableBuildings`' modified `production-chooser-helpers.js` (not the stock file) before
  adding its own two small patches, and set `LoadOrder>1700` (above `MovableBuildings`' `1666`).
- **State the risk plainly in the mod's own in-game description** (`LOC_MODULE_..._DESCRIPTION`),
  not only in project docs — a player deciding whether to also install some *third* mod that
  touches this file needs to know before they hit a silently-broken feature, not after.

## §2. `AffectsSavedGames` — the silent "doesn't apply to existing saves" trap

A pure-UI mod (no `<UpdateDatabase>` the save format depends on) still needs
`<Properties><AffectsSavedGames>0</AffectsSavedGames></Properties>`. Without it, loading a save
that predates the mod's installation silently skips applying that mod's `ActionGroup`s entirely —
confirmed by comparing `Modding.log`'s "Applying mod components" listing (the block right before
`Game content needs to change to match target config.` / `Applying mod components.`) between a
working always-on utility mod (present, with its `ActionGroup` id listed as a sub-bullet) and a
mod missing this property (present in the mod list, but with *no* `ActionGroup` sub-bullet at
all, and its scripts never execute — no console output, no errors, nothing). Other installed
utility mods that hit this same requirement (`buy-all-walls`, `BuildingDemolisher`,
`MovableBuildings`) all declare it explicitly, with a comment explaining why:

```xml
<Package>Mod</Package>
<!-- v11: now a pure UI mod, so it no longer touches the save. -->
<AffectsSavedGames>0</AffectsSavedGames>
```

Fix: add the property, reinstall, relaunch, reload the same save. No other change needed — this
alone took a script from "loaded, silent, does nothing" to fully functional.

## §3. The item model: `GetProductionItems`, `getProjectItems`, `Construct`

`production-chooser-helpers.js` exports (among others) `GetProductionItems`, which assembles
every category (`buildings`, `wonders`, `units`, `projects`) for the currently-open city's
chooser, and `Construct(city, item, isPurchase)`, which every row's click ultimately calls.

A **project** item needs no backing database row (unlike a building/unit/tech, which must
resolve through `GameInfo.Types`/`GameInfo.Constructibles` etc.) — its shape is a plain object:

```js
items["projects"].push({
  name: myLoc("LOC_MY_PROJECT_NAME"),
  description: myLoc("LOC_MY_PROJECT_DESCRIPTION", someArg),
  type: MY_SENTINEL_TYPE,       // a string that does NOT exist in GameInfo.Types
  cost: 0,
  turns: 0,
  category: "projects",
  showTurns: false,             // this screen only knows how to show Production-turns or
  showCost: false,              // Gold cost badges; state a non-Gold/Production cost in the
                                 // description text instead (with the right [icon:...] tag if
                                 // your text goes through the native rich-text renderer)
  insufficientFunds: false,
  disabled: false,
});
```

Gate it to relevant cities inline where you push it — e.g. `ChangeCapital` only pushes its entry
when `city.owner === GameContext.localPlayerID && !city.isCapital`.

`Construct` dispatches by looking up `item.type` in `GameInfo.Types`; a synthetic sentinel type
is guaranteed not to be found there, so intercept before that lookup:

```js
const Construct = (city, item, isPurchase) => {
  if (item.type === MY_SENTINEL_TYPE) {
    myCustomHandler(city);
    return false;
  }
  const typeInfo = GameInfo.Types.lookup(item.type);
  // ...unchanged stock code below...
```

## §4. Icon for free

The row renderer (`base-standard/ui-next/components/production-chooser-item.js`) reads the
item's `type` and resolves its icon via `UI.getIconCSS(itemType(), props.context)` — no special
casing needed. Add an `IconDefinitions` row mapping the sentinel type to any icon the game already
ships (reuse one that fits thematically rather than authoring new art):

```xml
<!-- data/icons.xml -->
<Database>
  <IconDefinitions>
    <Row>
      <ID>MY_SENTINEL_TYPE</ID>
      <Path>blp:some_existing_icon</Path>
    </Row>
  </IconDefinitions>
</Database>
```

referenced from the modinfo with `<UpdateIcons><Item>data/icons.xml</Item></UpdateIcons>`. Find a
suitable existing icon name by grepping shipped `IconDefinitions`/`UIIconPath` rows for a keyword
(e.g. `grep -rhoE 'blp:[A-Za-z0-9_]*capital[A-Za-z0-9_]*' <game modules dir>`).

## §5. Building the dialog — what failed, and what worked

**First attempt (failed): nested wrapper.** One `overlay` div containing `title`, `body`,
`row` (holding two button divs), the whole subtree built while detached from the document and
attached in one `appendChild` at the end. Result: the overlay's background/border rendered
perfectly; every piece of text inside it was completely invisible, despite each element having an
explicit inline `color`/`fontSize`. Re-ordering to attach each element to its already-connected
parent *before* setting its `textContent` (instead of the whole subtree at once) made no
difference either.

**What actually rendered text reliably:** a standalone floating button (a single flat `div`,
`textContent` set, appended directly to `document.body`) worked from the very first attempt, as
did toast notifications built the same way. The fix for the dialog was to flatten it: instead of
one wrapper containing children, every piece — the panel background, the title, the body text,
each button — became its own **independent element, all direct children of `document.body`**,
positioned to visually overlap into what looks like one dialog:

```js
const panel = document.createElement("div");     // background only, no text
root.appendChild(panel);

const title = document.createElement("div");
root.appendChild(title);
title.textContent = myLoc("LOC_MY_DIALOG_TITLE");  // sibling of panel, not its child

const body = document.createElement("div");
root.appendChild(body);
body.textContent = myLoc("LOC_MY_DIALOG_BODY", ...args);

// each button likewise a flat sibling with its own position + click listener
```

**Second failure (visually fine, not clickable): `calc(50vw ...)`/`calc(50vh ...)`.** Positioning
the flat dialog with `position: fixed; left: calc(50vw - 200px); top: calc(50vh - 90px)` etc.
rendered it in the correct place on screen, but its buttons never received a single click —
moving the mouse over them showed the 3D map's own tile-hover highlighting *through* the dialog,
meaning pointer input was reaching the map layer underneath, not the dialog's DOM elements, even
though the dialog was clearly the topmost thing painted. Switching every one of those `calc()`
viewport-unit expressions to plain pixel values computed in JS fixed it completely, with no other
change:

```js
const cx = Math.round(window.innerWidth / 2);
const cy = Math.round(window.innerHeight / 2);
Object.assign(panel.style, { position: "fixed", left: (cx - 200) + "px", top: (cy - 90) + "px", ... });
```

The working, floating "Relocate Capital" button (built earlier, before this dialog existed) and
the native production-chooser rows it sits next to are both positioned with real pixel values
(`getBoundingClientRect()` output, or literal `px`) — never `vw`/`vh`. Treat that as the load-
bearing pattern: **plain pixels for anything that must receive pointer input**, `calc()` with
viewport units is not trustworthy in this engine's CSS implementation even though it paints
correctly. (`Etruscans/ui/etruscans-images.js` documents several other non-standard behaviours in
this same UI runtime — CSSOM accessors vs. `setProperty`, `MutationObserver` not seeing
programmatic style changes — so this is a pattern of the engine, not a one-off.)

**Unsolved: Escape-to-close.** A `document.addEventListener("keydown", handler, true)` with
`e.stopPropagation(); e.stopImmediatePropagation(); e.preventDefault();` never fired at all for
the Escape key, even though the equivalent capture-phase approach for mouse events was never
actually the fix that was needed (mouse events worked once positioning was pixel-based). The
codebase's own logs reference a distinct `engine-input` event name
(`Attempting to remove engine-input event listener from a target ...`) separate from standard DOM
keyboard events, which is the more promising lead if this is worth solving — not more variations
on a `keydown` listener.

## §6. Debugging workflow that actually found these

1. Add an unconditional `console.warn` at the very top of the suspect file/IIFE. Quit and
   relaunch the game (mods are read at startup only), reproduce, then
   `grep "your-prefix:" ~/Library/Application\ Support/Civilization\ VII/Logs/UI.log`.
2. If nothing appears at all, check
   `~/Library/Application\ Support/Civilization\ VII/Logs/Modding.log` for the "Applying mod
   components" section (right before `Game content needs to change to match target config.`) —
   compare your mod's `ActionGroup` id against a known-working always-on utility mod's. Present
   in the mod list but absent from this section, with no error anywhere, points at
   `AffectsSavedGames` (§2) or an `ActionCriteria`/`scope` mismatch, not a JS bug.
3. If the script runs but an operation silently fails, `JSON.stringify` the full result of the
   `canStart`-style call right before acting on it. Some operations
   (`PlayerOperationTypes.SELECT_CAPITAL` confirmed) report nothing beyond `{"Success":false}` —
   no `Requirements`, no `FailureReasons` — so the only way forward is finding the native code
   that calls the same operation successfully and diffing your `args` object against it field by
   field, including the exact *shape* of each value (a `ComponentID` object vs. its own numeric
   `.id` field is a real, easy-to-miss mismatch — see `plans/change-capital.md`'s note on
   `city.id.id`).
4. If something renders but doesn't behave (invisible text, unresponsive buttons), suspect the
   DOM structure and CSS feature choice before suspecting the game logic — §5 above is two
   separate examples of exactly this.
