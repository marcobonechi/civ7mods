// Tuscany: make the shell and game find our images where they look for package textures.
// Same trick as Byzantium/ui/byzantium-images.js: the create-game screens ask for a
// civilization's card and panel art by naming convention (bg_panel_<civ>, bg-panel-<civ>,
// bg-card-<civ>) or through UI.getIconBLP, which returns a bare package name, and a mod can
// only ship loose files reachable as fs://game/<modid>/<file>.
(function () {
    const MOD = "fs://game/tuscany/";
    const MAP = {
        "bg_panel_tuscany": MOD + "bg-panel-tuscany.png",
        "bg-panel-tuscany": MOD + "bg-panel-tuscany.png",
        "bg-card-tuscany": MOD + "bg-card-tuscany.png",
        "lsbg_tuscany_vert": MOD + "lsbg_tuscany_vert.png",
        "civ_sym_tuscany": MOD + "civ_sym_tuscany.png",
    };

    try {
        if (typeof UI !== "undefined" && typeof UI.getIconBLP === "function") {
            const original = UI.getIconBLP.bind(UI);
            UI.getIconBLP = function (id, context) {
                if (id === "CIVILIZATION_TUSCANY" && context === "BACKGROUND_VERT") {
                    return MOD + "lsbg_tuscany_vert.png";
                }
                return original(id, context);
            };
        }
    } catch (e) {
        console.log("tuscany-images: could not wrap UI.getIconBLP: " + e);
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
        console.log("tuscany-images: active");
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
