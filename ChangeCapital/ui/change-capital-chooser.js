// Change Capital: adds a "Make Capital" project row to a city's production chooser, and
// relocates the capital there (for Diplomacy/Influence points) once the player confirms.
//
// This replaces an earlier implementation that shipped a whole modified copy of
// base-standard/ui/production-chooser/production-chooser-helpers.js at the same path as the
// stock file. That worked, but a same-path file is winner-takes-all: any other mod shipping
// that path would have silently erased this feature, or had its own erased by ours.
//
// Nothing here overrides a stock file. Two official, additive extension points do the work:
//
//   1. Controls.decorate(name, provider) - the engine keeps a LIST of decorator providers per
//      component (core/ui/component-support.js: addDecorator), so every mod that decorates
//      panel-production-chooser gets its decorator constructed. Mods stack instead of clobber.
//      The decorator wraps the panel's own `items` accessor pair and its click entry point
//      doOrConfirmConstruction(), which is the technique the Workshop mod "Purchase All Walls"
//      uses on this very same panel - proof two mods can decorate it side by side.
//   2. Dynamic import() of stock modules by absolute path, so a plain (non-module) UIScript can
//      reach engine singletons - here the native dialog box manager, which gives a real game
//      dialog: correct styling, input routing, controller navigation and Escape-to-close, none
//      of which a hand-built DOM dialog gets for free.
(function () {
    // A sentinel that deliberately does not exist in GameInfo.Types, so it can never collide
    // with a real constructible/unit/project, and so stock code paths that look types up will
    // simply not find it. data/icons.xml maps this same string to an existing game icon.
    const CHANGE_CAPITAL_PROJECT_TYPE = "CHANGE_CAPITAL_RELOCATE_ACTION";
    const CHANGE_CAPITAL_COST_BY_AGE = {
        AGE_ANTIQUITY: 100,
        AGE_EXPLORATION: 200,
        AGE_MODERN: 300,
    };
    const CHANGE_CAPITAL_DEFAULT_COST = 300;

    let DialogManagerApi = null;
    let DialogBoxActionApi = null;

    // Recomputed per use: the current age can change while the game is running, and the cost
    // should always reflect the age you are in right now.
    function currentCost() {
        try {
            const ageType = GameInfo.Ages.lookup(Game.age)?.AgeType;
            return CHANGE_CAPITAL_COST_BY_AGE[ageType] ?? CHANGE_CAPITAL_DEFAULT_COST;
        } catch (e) {
            return CHANGE_CAPITAL_DEFAULT_COST;
        }
    }

    function loc(tag, ...args) {
        try {
            return (typeof Locale !== "undefined" && Locale.compose) ? Locale.compose(tag, ...args) : tag;
        } catch (e) {
            return tag;
        }
    }

    // --------------------------------------------------------------------- the relocation

    // Everything needed is captured as plain values at click time, so the dialog callback never
    // has to re-resolve a City object that may have gone stale while the dialog was open.
    // City wants the plain numeric id: the native age-transition code
    // (ui-next/screens/legacies/legacies-support.js) does `City: cityID.id` where its own
    // cityID parameter is already a ComponentID, i.e. one level deeper than a City's `.id`.
    function captureTarget(city) {
        return { owner: city.owner, cityId: city.id.id, name: city.name };
    }

    function relocateTo(target) {
        const treasury = Players.get(target.owner)?.DiplomacyTreasury;
        const balance = treasury ? treasury.diplomacyBalance : 0;
        const cost = currentCost();
        if (!treasury || balance < cost) {
            notify(loc("LOC_CHANGE_CAPITAL_INSUFFICIENT_FUNDS", cost, balance));
            return;
        }
        const args = { Player1: target.owner, City: target.cityId, Swap: false };
        const result = Game.PlayerOperations.canStart(
            target.owner, PlayerOperationTypes.SELECT_CAPITAL, args, false);
        if (!result || !result.Success) {
            notify(loc("LOC_CHANGE_CAPITAL_CANNOT_RELOCATE", target.name));
            return;
        }
        treasury.changeDiplomacyBalance(-cost);
        Game.PlayerOperations.sendRequest(target.owner, PlayerOperationTypes.SELECT_CAPITAL, args);
    }

    function confirmAndRelocate(target) {
        const cost = currentCost();
        const balance = Players.get(target.owner)?.DiplomacyTreasury?.diplomacyBalance ?? 0;
        if (!DialogManagerApi || !DialogBoxActionApi) {
            // Never relocate without a confirmation the player actually saw.
            console.error("change-capital: dialog manager unavailable, ignoring the click");
            return;
        }
        DialogManagerApi.createDialog_ConfirmCancel({
            title: "LOC_CHANGE_CAPITAL_CONFIRM_TITLE",
            body: loc("LOC_CHANGE_CAPITAL_CONFIRM_BODY", target.name, cost, balance),
            canClose: true,
            // The queue the game's own general-purpose dialogs use, jumped to the front because
            // this one is the direct answer to a click the player just made. Without a queue the
            // dialog still appears, but it is sluggish to respond - it is not the presentation
            // the rest of the game's dialogs get.
            displayQueue: "SystemMessage",
            addToFront: true,
            callback: (action) => {
                if (action === DialogBoxActionApi.Confirm) {
                    relocateTo(target);
                }
            },
        });
    }

    function notify(message) {
        if (DialogManagerApi) {
            DialogManagerApi.createDialog_Confirm({
                title: "LOC_CHANGE_CAPITAL_CONFIRM_TITLE",
                body: message,
            });
        } else {
            console.warn("change-capital: " + message);
        }
    }

    // ------------------------------------------------------------------- the chooser row

    function makeCapitalItem() {
        // showTurns/showCost are false because this screen only knows how to render a
        // Production-turns or a Gold cost badge, and this one is paid in Influence - the amount
        // is stated in the description instead.
        return {
            name: loc("LOC_CHANGE_CAPITAL_PROJECT_NAME"),
            description: loc("LOC_CHANGE_CAPITAL_PROJECT_DESCRIPTION", currentCost()),
            type: CHANGE_CAPITAL_PROJECT_TYPE,
            cost: 0,
            turns: 0,
            category: "projects",
            showTurns: false,
            showCost: false,
            insufficientFunds: false,
            disabled: false,
        };
    }

    function injectMakeCapital(component, items) {
        const city = component?.city;
        if (!city || !items) return;
        // The AI never runs UI scripts, so this is already human-only; the explicit owner check
        // also covers looking at another player's city.
        if (city.owner !== GameContext.localPlayerID) return;
        if (city.isCapital) return;
        // Production tab only: the purchase tab prices everything in Gold, which this is not.
        if (component.isPurchase) return;

        const projects = items.projects ?? (items.projects = []);
        if (projects.some((item) => item.type === CHANGE_CAPITAL_PROJECT_TYPE)) return;
        projects.push(makeCapitalItem());
    }

    // The accessor lives on the component's prototype, not the instance.
    function findDescriptor(object, property) {
        let cursor = object;
        while (cursor) {
            const descriptor = Object.getOwnPropertyDescriptor(cursor, property);
            if (descriptor) return descriptor;
            cursor = Object.getPrototypeOf(cursor);
        }
        return null;
    }

    class ChangeCapitalDecorator {
        constructor(component) {
            this.component = component;

            const descriptor = findDescriptor(component, "items");
            if (descriptor?.get && descriptor?.set) {
                Object.defineProperty(component, "items", {
                    configurable: true,
                    get: () => descriptor.get.call(component),
                    set: (value) => {
                        try {
                            injectMakeCapital(component, value);
                        } catch (e) {
                            console.error("change-capital: failed to add the Make Capital row", e);
                        }
                        descriptor.set.call(component, value);
                    },
                });
            } else {
                console.error("change-capital: panel-production-chooser has no items accessor");
            }

            const original = component.doOrConfirmConstruction.bind(component);
            component.doOrConfirmConstruction = function (category, type, animationConfirmCallback) {
                if (type === CHANGE_CAPITAL_PROJECT_TYPE) {
                    // Capture before closing: closing deselects the city, so this.city goes away.
                    const target = captureTarget(this.city);
                    animationConfirmCallback?.();
                    // Close the chooser first, which is what picking any real item does here
                    // (the stock path deselects the city and returns to the default interface
                    // mode). Leaving it open means an open panel and the dialog both want input,
                    // which makes the dialog feel unresponsive.
                    try {
                        this.requestClose?.();
                    } catch (e) {
                        console.error("change-capital: could not close the production chooser", e);
                    }
                    // One turn of the event loop so the panel finishes closing before the dialog
                    // is pushed, rather than the two overlapping.
                    window.setTimeout(() => confirmAndRelocate(target), 0);
                    return;
                }
                return original(category, type, animationConfirmCallback);
            };
        }

        beforeAttach() { }
        afterAttach() { }
        beforeDetach() { }
        afterDetach() { }
    }

    Controls.decorate("panel-production-chooser", (component) => new ChangeCapitalDecorator(component));

    import("/core/ui/dialog-box/manager-dialog-box.js").then((module) => {
        DialogManagerApi = module.default;
        DialogBoxActionApi = module.DialogBoxAction;
    }).catch((error) => {
        console.error("change-capital: could not load the dialog box manager", error);
    });
})();
