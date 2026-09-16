# Reference: Civ 7 UI extension points

Worked example: `ChangeCapital`'s "Make Capital" project — a row in any non-capital city's
production chooser that spends Diplomacy (Influence) points and relocates the capital there.
Source: `ChangeCapital/ui/change-capital-chooser.js`, `ChangeCapital/change-capital.modinfo`,
`ChangeCapital/data/icons.xml`. Design log: `plans/change-capital.md`. The superseded
file-override implementation is in the history, in the commit that first added that mod, and the
techniques it used are kept in the appendices below.

## §1. Mod plumbing that must be right first

A pure-UI mod ships only `<UIScripts>` (plus text/icons), in a `scope="game"` ActionGroup:

```xml
<Properties>
    <Package>Mod</Package>
    <!-- Without this, the game silently skips this mod for any save that predates its
         installation: no error, the scripts simply never run. -->
    <AffectsSavedGames>0</AffectsSavedGames>
</Properties>
...
<ActionGroup id="my-mod-main" scope="game" criteria="always">
    <Actions>
        <UIScripts><Item>ui/my-script.js</Item></UIScripts>
        <UpdateText><Item>text/en_us/MyText.xml</Item></UpdateText>
        <UpdateIcons><Item>data/icons.xml</Item></UpdateIcons>
    </Actions>
</ActionGroup>
```

The `AffectsSavedGames` trap is worth spelling out because it looks exactly like a broken script:
the mod appears in the mod list, but `Modding.log`'s applied-components listing (the block ending
at `Applying mod components.`) has **no sub-bullet for your ActionGroup id**, while comparable
always-on utility mods do. Every shipped utility mod that hits this declares the property
explicitly. Adding it, reinstalling and reloading the same save is the whole fix.

A `<UIScripts>` file is a classic script, not an ES module: no top-level `import`, and it runs in
the same global scope as the rest of the in-game UI.

## §2. `Controls.decorate` — changing what an existing panel shows and does

`Controls.decorate(name, provider)` appends to a per-component list of providers
(`core/ui/component-support.js`: `decorate()` → `ComponentData.addDecorator`), and every
registered provider is constructed for each instance of that component. **Decorators from
different mods stack.** A decorator is a plain class given the component instance, and must
expose the four no-op lifecycle methods:

```js
class MyDecorator {
    constructor(component) { /* wrap things here */ }
    beforeAttach() { }
    afterAttach() { }
    beforeDetach() { }
    afterDetach() { }
}
Controls.decorate("panel-production-chooser", (component) => new MyDecorator(component));
```

**Wrapping an accessor.** The getter/setter usually lives on the component's prototype, not the
instance, so walk the chain for its descriptor, then redefine the property on the instance:

```js
function findDescriptor(object, property) {
    let cursor = object;
    while (cursor) {
        const descriptor = Object.getOwnPropertyDescriptor(cursor, property);
        if (descriptor) return descriptor;
        cursor = Object.getPrototypeOf(cursor);
    }
    return null;
}

const descriptor = findDescriptor(component, "items");
if (descriptor?.get && descriptor?.set) {
    Object.defineProperty(component, "items", {
        configurable: true,
        get: () => descriptor.get.call(component),
        set: (value) => { mutate(component, value); descriptor.set.call(component, value); },
    });
}
```

**Wrapping a method** is the ordinary bind-and-delegate:

```js
const original = component.doOrConfirmConstruction.bind(component);
component.doOrConfirmConstruction = function (category, type, animationConfirmCallback) {
    if (type === MY_SENTINEL_TYPE) {
        myHandler(this.city);
        animationConfirmCallback?.();
        return;                       // do not call through for our own synthetic row
    }
    return original(category, type, animationConfirmCallback);
};
```

Useful hooks on `panel-production-chooser` specifically: `items` (accessor pair; the object has
`buildings`/`wonders`/`units`/`projects` arrays), `city`, `cityID`, `isPurchase`,
`playerGoldBalance`, and `doOrConfirmConstruction(category, type, cb)` as the click entry point.

**Adding a row.** A "project" is the only item kind that needs no backing database row:

```js
items.projects.push({
    name: Locale.compose("LOC_MY_NAME"),
    description: Locale.compose("LOC_MY_DESCRIPTION", cost),
    type: MY_SENTINEL_TYPE,       // deliberately NOT in GameInfo.Types
    cost: 0, turns: 0,
    category: "projects",
    showTurns: false,             // this screen renders only Production-turns or Gold cost
    showCost: false,              // badges; state any other currency in the description
    insufficientFunds: false,
    disabled: false,
});
```

Guard it: `city.owner === GameContext.localPlayerID`, skip when not applicable (`city.isCapital`),
pick a tab (`component.isPurchase` is the purchase view, which prices everything in Gold), and
bail if your row is already present — the setter can run repeatedly for the same panel.

**Icon for free.** The row renderer (`ui-next/components/production-chooser-item.js`) resolves the
icon from the item's own `type` via `UI.getIconCSS`, so mapping the sentinel to a stock icon is
enough:

```xml
<Database><IconDefinitions>
    <Row><ID>MY_SENTINEL_TYPE</ID><Path>blp:some_existing_icon</Path></Row>
</IconDefinitions></Database>
```

Find a fitting existing icon by grepping shipped rows, e.g.
`grep -rhoE 'blp:[A-Za-z0-9_]*capital[A-Za-z0-9_]*' <game modules dir>`.

## §3. `ModdingRegistry` — the officially sanctioned mod slots

`core/ui/modding-registry-handler/modding-registry-handler.js` exposes a singleton with
`add(modElementData)`, where the data is `{ parentID, modSlot, componentTag, attributes }`. A
panel that opts in calls `ModdingRegistry.attachModElements(parentID)` (looks up `#modSlot` in the
document) or `attachModElementsTo(parentID, element)` (attaches into an element it passes). Your
`componentTag` is created with `document.createElement` and appended, so pair it with your own
`Controls.define("my-tag", …)` component.

Only these seven call it (grep `attachModElements` to re-check after a game update):
`root-game`, `panel-production-chooser` (into its `frame`), `panel-city-details`,
`panel-sub-system-dock`, `panel-yield-banner`, `panel-diplo-ribbon`, `mini-map__lens-panel`.

Use this when you want to place *your own* element; use a decorator when you need to alter what
the panel itself renders or does.

## §4. Dialogs

Prefer the native manager, reached from a classic script by dynamic import:

```js
let DialogManagerApi = null, DialogBoxActionApi = null;
import("/core/ui/dialog-box/manager-dialog-box.js").then((module) => {
    DialogManagerApi = module.default;          // default export is the manager
    DialogBoxActionApi = module.DialogBoxAction; // named export: Confirm / Cancel ...
});
```

then

```js
DialogManagerApi.createDialog_ConfirmCancel({
    title: "LOC_MY_TITLE",
    body: Locale.compose("LOC_MY_BODY", ...args),
    canClose: true,
    callback: (action) => { if (action === DialogBoxActionApi.Confirm) act(); },
});
```

Other variants: `createDialog_Confirm`, `createDialog_Cancel`, `createDialog_MultiOption`,
`createDialog_CustomOptions` (the last takes an `options: [...]` array, plus `displayQueue`,
`name`, `custom`, `styles`). Because the import resolves asynchronously, cache the result at load
and refuse to act if it is somehow unavailable — never fall back to performing a destructive
action without the confirmation the player was supposed to see.

**Always name a `displayQueue`.** Every native caller does (`"SystemMessage"` for general use,
`"DiplomacyDialog"`, `"TutorialManager"`); pass `addToFront: true` when the dialog is the direct
answer to a click the player just made. A dialog created without a queue still appears, but it is
noticeably sluggish to respond rather than behaving like the game's own dialogs.

**Get the panel underneath out of the way first.** If you open a dialog from inside a panel's
click handler, close that panel before showing the dialog (`component.requestClose?.()` on the
production chooser), and push the dialog one event-loop turn later (`setTimeout(…, 0)`) so the
close finishes first. The stock path does the same thing — picking a real item deselects the city
and returns to the default interface mode. Leaving the panel open means an open panel and a dialog
both want input, and the dialog feels unresponsive.

For the "works, but not the way to do it" techniques — hand-built DOM dialogs and same-path file
overrides — see the appendices.

## §5. Debugging workflow

1. Unconditional `console.warn("myprefix: loaded")` at the top of the script. Quit and relaunch
   (mods are read at startup only), reproduce, then
   `grep "myprefix:" ~/Library/Application\ Support/Civilization\ VII/Logs/UI.log`.
2. Nothing logged → the file never loaded. Check `Modding.log` for your ActionGroup id in the
   applied-components block; suspect `AffectsSavedGames` (§1) or an `ActionCriteria`/`scope`
   mismatch, not your JS.
3. Script runs, operation silently fails → `JSON.stringify` the `canStart`-style result.
   `PlayerOperationTypes.SELECT_CAPITAL` returns bare `{"Success":false}` with no `Requirements`
   or `FailureReasons`, so the only route is diffing your `args` against the native call site,
   field by field.
4. Value right, still rejected → check the shape. `City` wants the plain numeric id: the native
   code does `City: cityID.id` where its own `cityID` is already a `ComponentID`, i.e.
   `someCity.id.id` — one level deeper than it looks. Passing the `ComponentID` object itself also
   produces `lookup requires key to be of type 'number' or 'string'` from `Cities.get`.
5. Renders but misbehaves → §4's two rules before anything else.

## Appendix A: hand-built DOM dialogs (works, but not the main way)

Use the native dialog manager (§4). This appendix exists because an earlier `ChangeCapital`
iteration shipped a hand-built dialog, it did eventually work, and the two rules below are real
engine behaviour worth keeping — but a hand-built dialog gets none of the styling, input routing,
controller navigation or Escape handling the native one gets for free, and it took two separate
bugs to get there. Reach for this only when the native dialogs genuinely cannot express what you
need.

Two rules, both learned the hard way; both had the thing *look* right while being broken:

- **Flat, independent sibling elements appended directly to `document.body`** — one element per
  piece of content — not children nested inside a wrapper `div`. A nested-wrapper dialog rendered
  its background and border correctly but left every piece of text invisible, even with explicit
  inline `color`/`fontSize` on each child, and even when attaching each element before setting its
  text. Flat top-level elements (a floating button, a toast) always rendered fine.
- **Position with plain pixel values computed in JS** (`window.innerWidth/innerHeight`, or
  `element.getBoundingClientRect()`), **never `calc(50vw …)`/`calc(50vh …)`**. A viewport-unit
  dialog painted in the right place but never received a single click — pointer input passed
  through to the 3D map, visible as tile-hover highlighting *through* the dialog. Switching only
  those expressions to pixels fixed it entirely.
- Escape-to-close was never solved for hand-built dialogs: a capture-phase `keydown` listener on
  `document` with `stopImmediatePropagation` never fired. Keyboard input in this engine travels as
  a custom `engine-input` event (visible in `UI.log` as
  `Attempting to remove engine-input event listener …`), not as a DOM `keydown` — that is where to
  look if it ever matters. The native dialog makes the question moot.

This engine has more non-standard UI behaviour of the same flavour — see
`Etruscans/ui/etruscans-images.js` on CSSOM accessors vs. `setProperty` and `MutationObserver` not
seeing programmatic style changes. Treat any CSS or DOM feature beyond the plainest as suspect
until proven in game.

## Appendix B: same-path file override (works, but not the main way)

The modding VFS resolves each path to exactly one file, so shipping a file at a stock file's own
path replaces it:

```xml
<ImportFiles>
    <Item>base-standard/ui/production-chooser/production-chooser-helpers.js</Item>
</ImportFiles>
```

It works (the Workshop mod *Move Building* ships exactly this), and before the decorator route was
found, `ChangeCapital` used it too — copying *Move Building's* already-patched file rather than the
pristine one, so the two would coexist, and setting `LoadOrder` above theirs.

**Why it is still the wrong default:** winner-takes-all. Highest `LoadOrder` wins and the loser's
*entire file* silently never runs — no error, no log line naming the conflict. It cannot scale past
two cooperating mods, it hard-codes a copy of a ~1000-line stock file that drifts with every game
patch, and it forces you to own code you did not write. Reach for it only when no decorator or mod
slot can express the change, and say so plainly in the mod's own in-game description so players can
judge the risk.
