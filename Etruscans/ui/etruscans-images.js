// Etruscans: make the shell and game find our images where they look for package textures.
// Same trick as Byzantium/ui/byzantium-images.js: the create-game screens ask for a
// civilization's card and panel art by naming convention (bg_panel_<civ>, bg-panel-<civ>,
// bg-card-<civ>) or through UI.getIconBLP, which returns a bare package name, and a mod can
// only ship loose files reachable as fs://game/<modid>/<file>.
(function () {
    const MOD = "fs://game/etruscans/";
    const MAP = {
        "bg_panel_etruscans": MOD + "bg-panel-etruscans.png",
        "bg-panel-etruscans": MOD + "bg-panel-etruscans.png",
        "bg-card-etruscans": MOD + "bg-card-etruscans.png",
        "lsbg_etruscans_vert": MOD + "lsbg_etruscans_vert.png",
        "civ_sym_etruscans": MOD + "civ_sym_etruscans.png",
    };

    try {
        if (typeof UI !== "undefined" && typeof UI.getIconBLP === "function") {
            const original = UI.getIconBLP.bind(UI);
            UI.getIconBLP = function (id, context) {
                if (id === "CIVILIZATION_ETRUSCANS" && context === "BACKGROUND_VERT") {
                    return MOD + "lsbg_etruscans_vert.png";
                }
                return original(id, context);
            };
        }
    } catch (e) {
        console.log("etruscans-images: could not wrap UI.getIconBLP: " + e);
    }

    const fix = (el) => {
        const bi = el && el.style ? el.style.backgroundImage : "";
        if (!bi) return;
        for (const key in MAP) {
            if (bi.indexOf(key) >= 0 && bi.indexOf(MAP[key]) < 0) {
                el.style.backgroundImage = "url('" + MAP[key] + "')";
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
        console.log("etruscans-images: active");
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
