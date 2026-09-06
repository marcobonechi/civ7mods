// Byzantium: make the shell and game find our images where they look for package textures.
//
// The create-game screens ask for a civilization's card and panel art by naming convention
// (bg_panel_<civ>, bg-panel-<civ>, bg-card-<civ>) or through UI.getIconBLP, which returns a bare
// package name. A mod can only ship loose files, reachable as fs://game/<modid>/<file>. This
// script (loaded in both scopes through UIScripts) does two things:
//   1. wraps UI.getIconBLP so the vertical card returns a real URL for Byzantium;
//   2. watches inline background-image styles and swaps the convention names for our URLs.
(function () {
    const MOD = "fs://game/byzantium/";
    const MAP = {
        "bg_panel_byzantium": MOD + "bg-panel-byzantium.png",
        "bg-panel-byzantium": MOD + "bg-panel-byzantium.png",
        "bg-card-byzantium": MOD + "bg-card-byzantium.png",
        "lsbg_byzantium_vert": MOD + "lsbg_byzantium_vert.png",
        "civ_sym_byzantium": MOD + "civ_sym_byzantium.png",
    };

    try {
        if (typeof UI !== "undefined" && typeof UI.getIconBLP === "function") {
            const original = UI.getIconBLP.bind(UI);
            UI.getIconBLP = function (id, context) {
                if (id === "CIVILIZATION_BYZANTIUM" && context === "BACKGROUND_VERT") {
                    return MOD + "lsbg_byzantium_vert.png";
                }
                return original(id, context);
            };
        }
    } catch (e) {
        console.log("byzantium-images: could not wrap UI.getIconBLP: " + e);
    }

    const fix = (el) => {
        const bi = el && el.style ? el.style.backgroundImage : "";
        if (!bi) return;
        if (bi.indexOf("lsbg_byzantium_1080") >= 0 || bi.indexOf("lsbg_byzantium_720") >= 0) {
            console.log("byzantium-images: loading background is " + bi);
        }
        for (const key in MAP) {
            if (bi.indexOf(key) >= 0 && bi.indexOf(MAP[key]) < 0) {
                el.style.backgroundImage = "url('" + MAP[key] + "')";
                console.log("byzantium-images: replaced " + bi);
                return;
            }
        }
    };
    const scan = (root) => {
        fix(root);
        if (root && root.querySelectorAll) root.querySelectorAll("[style]").forEach(fix);
    };
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.type === "attributes") fix(m.target);
            else m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); });
        }
    });
    const start = () => {
        observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
        scan(document.documentElement);
        console.log("byzantium-images: active");
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
