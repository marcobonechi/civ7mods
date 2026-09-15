// Change Capital: let the age-transition "pick your new capital" step (the Dedications deck
// screen) offer every one of the player's settlements, not just ones connected to the old
// capital by a land trade route.
//
// The picker's candidate list comes from a native engine call, not from anything in the
// screen's own JS:
//   base-standard/ui-next/screens/legacies/dedications-model.js
//     const capitalIDs = playerCities.getPotentialSwitchCapitalCityIds();
// where playerCities is Players.get(id).Cities. That native call is presumably where the
// trade-route restriction actually lives, so patching the screen's rendering code would only
// change what is *displayed*, not what a swap is allowed to target. Instead this wraps the
// global Players.get(...) - a plain function property on a native namespace object, the same
// kind of thing base game code itself reassigns (see WorldUI.addBackgroundLayer and friends in
// Etruscans/ui/etruscans-images.js for a proven example of this technique in this engine) - so
// that every Cities object it hands back answers getPotentialSwitchCapitalCityIds() with the
// full list of owned settlements instead of the restricted one.
(function () {
    console.warn("change-capital: transition script loaded, Players=" + (typeof Players !== "undefined"));
    if (typeof Players === "undefined" || typeof Players.get !== "function" || Players.get.__changeCapitalPatched) {
        return;
    }

    const isSameCity = (a, b) => !!a && !!b && a.owner === b.owner && a.id === b.id;

    const originalGet = Players.get.bind(Players);
    const patched = function (playerId) {
        const player = originalGet(playerId);
        const cities = player && player.Cities;
        if (cities && typeof cities.getCityIds === "function"
            && typeof cities.getPotentialSwitchCapitalCityIds === "function"
            && !cities.getPotentialSwitchCapitalCityIds.__changeCapitalPatched) {
            const originalPotential = cities.getPotentialSwitchCapitalCityIds.bind(cities);
            const allCandidates = function () {
                try {
                    const capital = typeof cities.getCapital === "function" ? cities.getCapital() : null;
                    const capitalId = capital && capital.id;
                    return cities.getCityIds().filter((id) => !isSameCity(id, capitalId));
                } catch (e) {
                    console.warn("change-capital: falling back to the restricted capital list", e);
                    return originalPotential();
                }
            };
            allCandidates.__changeCapitalPatched = true;
            cities.getPotentialSwitchCapitalCityIds = allCandidates;
        }
        return player;
    };
    patched.__changeCapitalPatched = true;
    Players.get = patched;
})();
