---
name: civ7-ui-extension
description: Extend Civilization VII's in-game UI from a mod - add rows/buttons to the production chooser, city panel or other panels, and show a real game dialog - using the engine's official additive extension points (Controls.decorate, ModdingRegistry mod slots, DialogBoxManager) instead of overwriting stock files. Use when asked to add an action/button/entry to a Civ 7 screen, to show a confirmation dialog from a mod, or when a mod's UI change conflicts with another mod.
---

# Civ 7 UI extension points

Built while shipping `ChangeCapital`'s "Make Capital" project row (`ChangeCapital/ui/change-capital-chooser.js`,
`plans/change-capital.md`). Read `reference.md` in this folder for the worked example, the exact
API shapes, and the pitfalls — including a whole superseded approach and why it was abandoned.

**Default to additive extension points. Never overwrite a stock file unless nothing else works** —
a shipped file path is winner-takes-all, so a same-path override silently deletes any other mod
that touches the same file (and can be silently deleted by one).

## Ground truth to consult first

- Game UI source (macOS Steam):
  `~/Library/Application Support/Steam/steamapps/common/Sid Meier's Civilization VII/CivilizationVII.app/Contents/Resources/Base/modules/`
  — `core/ui/component-support.js` (`Controls.define`/`Controls.decorate`),
  `core/ui/modding-registry-handler/modding-registry-handler.js` (`ModdingRegistry`),
  `core/ui/dialog-box/manager-dialog-box.js` (dialogs), and the panel you want to extend under
  `base-standard/ui/<panel>/`.
- Logs: `~/Library/Application Support/Civilization VII/Logs/` — `UI.log` (your `console.warn`
  output and script errors), `Modding.log` (was your ActionGroup applied at all?).
- Working examples already installed under
  `~/Library/Application Support/Steam/steamapps/workshop/content/1295660/`: grep for
  `Controls.decorate` to find pure-`<UIScripts>` mods that modify native panels without
  overriding anything. "Purchase All Walls" decorating `panel-production-chooser` is the
  reference implementation.

Never invent an API. Grep it in the base modules first and copy a working call.

## The three additive extension points, in order of preference

1. **`ModdingRegistry` mod slots** — Firaxis's explicitly sanctioned "put your component here"
   API. `ModdingRegistry.add({ parentID, modSlot, componentTag, attributes })`, and the panel
   instantiates your registered custom element into its own frame. Only panels that call
   `attachModElements`/`attachModElementsTo` support it — exactly seven do:

   | `parentID` | Where it lands |
   |---|---|
   | `root-game` | the in-game UI root |
   | `panel-production-chooser` | the production/purchase chooser frame |
   | `panel-city-details` | the city details panel |
   | `panel-sub-system-dock` | the sidebar dock of screen buttons |
   | `panel-yield-banner` | the top yields bar |
   | `panel-diplo-ribbon` | the leader ribbon |
   | `mini-map__lens-panel` | the lens panel |

   Best when you want *your own* element (a button, a badge) placed in a supported panel.

2. **`Controls.decorate(name, provider)`** — works on any of the ~285 components registered with
   `Controls.define`, far beyond the seven mod slots. The engine keeps a **list** of providers per
   component (`addDecorator`), so every mod's decorator is constructed: mods stack, they do not
   clobber. Best when you need to change what an existing panel *shows or does* — wrap its
   property accessors and methods on the instance you are handed. See reference.md §2 for the
   accessor/method-wrapping recipe (the accessor usually lives on the prototype, so walk the
   prototype chain to find its descriptor).

3. **Dynamic `import()` of stock modules** — a plain (non-module) `<UIScripts>` file can still
   reach engine singletons: `import("/core/ui/dialog-box/manager-dialog-box.js")`,
   `import("/core/ui/interface-modes/interface-modes.js")`, etc., by absolute path. This is how a
   classic script gets at things that are ES module exports rather than globals. Resolve it once
   at load and cache the result.

Genuine globals (`Game`, `GameContext`, `Players`, `Cities`, `GameInfo`, `Locale`, `UI`,
`WorldUI`, `Controls`, `engine`) need no import at all, and can be monkey-patched directly from a
`<UIScripts>` file — that is how `ChangeCapital` widens the age-transition capital picker
(wrapping `Players.get` so the `Cities` object it returns reports every settlement as a
switch-capital candidate) without touching a file.

## Use the game's own dialog, not hand-built DOM

```js
DialogManager.createDialog_ConfirmCancel({
  title: "LOC_MY_TITLE",
  body: Locale.compose("LOC_MY_BODY", ...args),
  canClose: true,
  callback: (action) => { if (action === DialogBoxAction.Confirm) doTheThing(); },
});
```

Variants: `createDialog_Confirm` (OK only), `createDialog_Cancel`, `createDialog_MultiOption`,
`createDialog_CustomOptions`. A native dialog gets correct styling, input routing, controller
navigation and Escape-to-close for free. A hand-built DOM dialog gets none of them, and in this
engine it takes two non-obvious rules just to make it render and receive clicks at all
(reference.md §4) — with Escape still unsolved. Only hand-build when the native dialogs genuinely
cannot express what you need.

## Procedure

1. Pick the extension point: a mod slot if one covers your panel and you want your own element;
   otherwise a decorator; file override only as a documented last resort.
2. Ship a plain `<UIScripts>` item in a `scope="game"` ActionGroup. Add
   `<AffectsSavedGames>0</AffectsSavedGames>` to `<Properties>` or the mod silently will not load
   into saves that predate its installation (reference.md §1 — this costs an entire debugging
   session if missed).
3. Give any synthetic item/type a sentinel string that deliberately does not exist in
   `GameInfo.Types`, so stock lookups can never mistake it for a real type, and map that same
   string to an existing `blp:` icon via `<UpdateIcons>` for a free icon.
4. Verify before installing, then relaunch (mods load at startup only):

```bash
node --check <Mod>/ui/<script>.js
python3 tools/check-mod.py <Mod>
./install.sh <Mod>
grep -n "<your-log-prefix>" ~/Library/Application\ Support/Civilization\ VII/Logs/UI.log
```

## When a mod-shipped UI change does nothing

Work outward in this order — each step rules out a whole class of cause (detail in reference.md §5):

1. Unconditional `console.warn` at the top of the script → absent from `UI.log` means the file
   never loaded; check `Modding.log`'s applied-components list for your ActionGroup id, and
   suspect `AffectsSavedGames` or an `ActionCriteria`/`scope` mismatch before suspecting your JS.
2. Loaded but inert → `JSON.stringify` the full result of the `canStart`-style call. Some
   operations report only `{"Success":false}` with no reason, so compare your `args` field by
   field against the native call site that does the same thing successfully.
3. Right value, still rejected → check the *shape*. A `ComponentID` (`{owner, id, type}`) versus
   its own numeric `.id` is a standing trap: the native capital-picker passes `City: cityID.id`
   where `cityID` is already a ComponentID, i.e. `someCity.id.id`.
4. Renders but misbehaves → suspect your DOM structure and CSS feature choice, not game logic.
