// Tuscany: make the shell find our loose PNGs where it looks for package textures.
//
// The problem. A mod can only ship loose files, reachable as fs://game/<modid>/<file>. The
// create-game and age-transition screens ask for a civilization's art by naming convention and
// hand the result to a package-texture lookup, which cannot open one of our files:
//
//   core/ui/shell/age-transition/age-transition-civ-card.js:163
//       this.background.style.backgroundImage = `url('fs://game/bg-card-<civ>.png')`
//   core/ui/shell/age-transition/age-transition-civ-select.js:487
//       this.detailsPanelBg.style.backgroundImage = `url('fs://game/bg-panel-<civ>.png')`
//   core/ui-next/screens/create-game/civ-select-model.js:218   -> `bg-panel-<civ>`, used as an
//       <img src> after "blp:" is prepended
//   core/ui-next/screens/create-game/create-game-hub.js:382    -> `blp:bg_panel_<civ>.png`
//   core/ui/shell/main-menu/main-menu-asset-preload.js:21      -> `blp:bg-panel-<civ>` on a
//       detached Image, and `blp:` prepended to the fs:// URL our BACKGROUND_VERT icon row
//       already returns
//
// Two things make the obvious fix fail, which is why the first version of this file did nothing:
//
//   1. A MutationObserver does not report programmatic style changes in this engine. Watching
//      the style attribute catches HTML that arrives with an inline style and nothing else.
//   2. `el.style.backgroundImage = x` goes through the CSSStyleDeclaration accessor, not through
//      setProperty, so hooking setProperty alone misses both age-transition screens - which is
//      where the card and the details panel live.
//
// So the hooks are on the prototypes, and the accessor is hooked as well as setProperty. The
// Image src accessor is hooked too, because ui-next feeds these names to <img> and because
// core/ui-next/utilities/image-cache.js compares `image.src` back against the URL it assigned
// and rejects when they differ - so the setter rewrites the load target while the getter keeps
// returning what the caller assigned.
//
// Several of our mods can be installed together, so the registry and the hooks are shared: the
// first script to load installs them, the rest only add their tokens.

(function () {
    const CONFIG = {
        modId: "tuscany",
        civ: "tuscany",                        // the <civ> the shell builds its names from
        civType: "CIVILIZATION_TUSCANY",
        panel: "bg-panel-tuscany.png",
        card: "bg-card-tuscany.png",
        symbol: "civ_sym_tuscany.png",
        vert: "lsbg_tuscany_vert.png",
        // The leader preloader asks for lp_circ_<leader>_<n>, lp_hex_<leader>_<n> and
        // lsl_<leader> by name, never through IconDefinitions.
        // model: the shipped leader whose 3D asset Lorenzo borrows. Machiavelli is the other
        // Florentine in the game and dresses for the same century.
        // Portraits. The selected-unit panel and the army panel do not draw the unit *icon*:
        // they call WorldUI.requestPortrait(unitType, unitType, ...) and read the result back as
        // url("live:/<unitType>"), i.e. the engine renders the unit's 3D asset into a live
        // texture. A modded unit has no asset of its own, and the VisualRemaps that give it one
        // in the world do not reach that call - so the portrait comes back an empty black box.
        // These pairs mirror data/visual-remaps.xml (Kind=UNIT), plus the ten named Maestri,
        // which have no remap row of their own because each one would add a checkbox to the
        // Options screen; they borrow the Alim's model here for the portrait only.
        unitPortraits: {
            UNIT_CONDOTTIERO: "UNIT_SWORDSMAN",
            UNIT_CONDOTTIERO_2: "UNIT_MAN_AT_ARMS",
            UNIT_CONDOTTIERO_3: "UNIT_PIKEMAN",
            UNIT_GALEA_SANTO_STEFANO: "UNIT_COG",
            UNIT_MAESTRO: "UNIT_ALIM",
            UNIT_MAESTRO_LEONARDO: "UNIT_ALIM",
            UNIT_MAESTRO_RAFFAELLO: "UNIT_ALIM",
            UNIT_MAESTRO_MICHELANGELO: "UNIT_ALIM",
            UNIT_MAESTRO_BOTTICELLI: "UNIT_ALIM",
            UNIT_MAESTRO_DONATELLO: "UNIT_ALIM",
            UNIT_MAESTRO_BRUNELLESCHI: "UNIT_ALIM",
            UNIT_MAESTRO_DANTE: "UNIT_ALIM",
            UNIT_MAESTRO_MACHIAVELLI: "UNIT_ALIM",
            UNIT_MAESTRO_GALILEO: "UNIT_ALIM",
            UNIT_MAESTRO_VESPUCCI: "UNIT_ALIM",
        },
        leaders: [{ id: "lorenzo", type: "LEADER_LORENZO", model: "LEADER_MACHIAVELLI",
                    portrait: "lsl_lorenzo.png" }],
    };

    const KEY = "__civ7modsCivArt";
    const shared = window[KEY] || (window[KEY] = { textures: new Map(), panels: new Map(), hooked: false });
    if (!shared.leaderAssets) shared.leaderAssets = new Map();
    if (!shared.unitAssets) shared.unitAssets = new Map();

    const url = (file) => "fs://game/" + CONFIG.modId + "/" + file;

    // Every spelling the shell might hand us, normalised to a bare lower-case basename.
    const register = (token, file) => shared.textures.set(token.toLowerCase(), url(file));
    register("bg-panel-" + CONFIG.civ, CONFIG.panel);
    register("bg_panel_" + CONFIG.civ, CONFIG.panel);
    register("bg-card-" + CONFIG.civ, CONFIG.card);
    register("bg_card_" + CONFIG.civ, CONFIG.card);
    register("civ_sym_" + CONFIG.civ, CONFIG.symbol);
    register("lsbg_" + CONFIG.civ + "_vert", CONFIG.vert);
    for (const k in CONFIG.unitPortraits || {}) shared.unitAssets.set(k, CONFIG.unitPortraits[k]);
    // addBackgroundLayer is given the bare texture name, never a URL.
    shared.panels.set("bg-panel-" + CONFIG.civ, url(CONFIG.panel));
    shared.panels.set("bg_panel_" + CONFIG.civ, url(CONFIG.panel));
    // The shell asks for a portrait at whatever size the widget it is filling wants, and each
    // size is a separate texture name; icons.xml covers the ones that go through IconDefinitions,
    // this covers the ones the preloader builds by hand.
    for (const leader of CONFIG.leaders || []) {
        for (const n of [256, 140, 128, 64]) {
            register("lp_circ_" + leader.id + "_" + n, "lp_circ_" + leader.id + "_" + n + ".png");
        }
        for (const n of [256, 128, 64]) {
            register("lp_hex_" + leader.id + "_" + n, "lp_hex_" + leader.id + "_" + n + ".png");
        }
        register("lsl_" + leader.id, leader.portrait);
        if (leader.model) shared.leaderAssets.set(leader.type + "_GAME_ASSET", leader.model + "_GAME_ASSET");
    }

    // ---------------------------------------------------------------- shared, install once

    if (!shared.hooked) {
        shared.hooked = true;

        // "url('blp:bg-panel-x.png')" / "fs://game/bg-card-x.png" / "blp:civ_sym_x" -> our URL,
        // or null when this is not one of ours.
        const lookup = (value) => {
            if (!value || typeof value !== "string") return null;
            let s = value.trim();
            const m = s.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
            if (m) s = m[1];
            s = s.trim().replace(/^blp:/, "");
            s = s.replace(/^fs:\/\/game\//, "");
            s = s.replace(/^TEXTURE_/, "");
            s = s.substring(s.lastIndexOf("/") + 1);     // flat and per-mod forms both end here
            // Strip *repeated* .png, not one. core/ui/utilities/utilities-image.js:
            //   getLeaderPortraitIcon() = UI.getIconURL(leader, "LEADER") + size + mood + ".png"
            // For a shipped leader the icon row is a package name with no extension, so that
            // lands on a real texture. Ours is a loose file and already ends in .png, so the
            // city banners and the diplomacy ribbon asked for lp_hex_<leader>_256.png.png and
            // got a blank circle. The mood suffix (_h friendly, _a hostile) is dropped too:
            // we ship one portrait, not three.
            s = s.replace(/(\.png)+$/i, "").toLowerCase();
            return shared.textures.get(s) || shared.textures.get(s.replace(/_(h|a)$/, "")) || null;
        };

        // Anything that might carry an asset path. Cheap guard so the hooks below can look at
        // every property without running a regex over every style write in the game.
        const MAYBE_URL = /url\(|fs:\/\/|blp:/i;

        // Rewrite a CSS value, keeping the url(...) wrapper if it had one.
        const fixCss = (value) => {
            if (!value || typeof value !== "string") return value;
            // The UI sometimes prepends blp: to a path it was given as fs://; that never opens.
            let out = value.indexOf("blp:fs://") >= 0 ? value.replace(/blp:(fs:\/\/)/g, "$1") : value;
            // An unquoted url() holding an fs:// path does not parse here. The base game only ever
            // writes url(<x>) unquoted where x is a blp: package name - no "//" in it - and always
            // quotes an fs:// path; compare Icon.getCivSymbolCSSFromCivilizationType, which returns
            // url('<x>'), with Icon.getUnitIconFromDefinition, which returns a bare URL that its
            // callers wrap unquoted. So a mod's loose PNG survives the first and is dropped by the
            // second: city banners show our unit icons, the army panel and the unit flags do not.
            // Quoting is the whole fix, and it is worth doing for every mod's files, not just ours.
            out = out.replace(/url\(\s*(fs:\/\/[^'\")\s]+)\s*\)/gi, "url('$1')");
            // live:/<UnitType> is the texture WorldUI.requestPortrait renders into. Our units have
            // no 3D asset, so the panel is pointed at the stand-in's texture instead - see the
            // requestPortrait hook, which is what renders it.
            out = out.replace(/live:\/(\w+)/g, function (m, t) { return "live:/" + (shared.unitAssets.get(t) || t); });
            const hit = lookup(out);
            if (!hit) return out;
            return /url\(/.test(out) ? "url('" + hit + "')" : hit;
        };

        const wrapAccessor = (proto, prop, transform) => {
            const d = Object.getOwnPropertyDescriptor(proto, prop);
            if (!d || !d.set || !d.configurable) return false;
            Object.defineProperty(proto, prop, {
                configurable: true,
                enumerable: d.enumerable,
                get: d.get,
                set: function (v) { d.set.call(this, transform(v)); },
            });
            return true;
        };

        // 1. setProperty(...) for any property whose value looks like it carries an asset. Not
        //    just background-image: the army panel puts the unit icon in a custom property,
        //    `button.style.setProperty("--button-icon", `url(${iconName})`)`, and the CSS then
        //    reads it back with background-image: var(--button-icon). Watching only
        //    background-image misses it, which is why a Condottiero inside a commander had no
        //    icon while the same civ's symbol, set through a quoted url(), was fine.
        try {
            const original = CSSStyleDeclaration.prototype.setProperty;
            CSSStyleDeclaration.prototype.setProperty = function (prop, value, priority) {
                if (typeof value === "string" && MAYBE_URL.test(value)) value = fixCss(value);
                return original.call(this, prop, value, priority);
            };
        } catch (e) { /* leave the engine alone if it will not take the hook */ }

        // 2. el.style.backgroundImage = ... (the age-transition card and details panel)
        try {
            wrapAccessor(CSSStyleDeclaration.prototype, "backgroundImage", fixCss);
            wrapAccessor(CSSStyleDeclaration.prototype, "background", fixCss);
        } catch (e) { /* ignore */ }

        // 3. <img src>, both setAttribute and the accessor. The accessor keeps its own record of
        //    what was assigned so image-cache.js's `image.src != url` check still passes.
        const SRC = "__civ7modsAssignedSrc";
        try {
            const original = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function (name, value) {
                if (name === "src") {
                    const fixed = fixCss(value);
                    if (fixed !== value) { this[SRC] = value; return original.call(this, name, fixed); }
                }
                return original.call(this, name, value);
            };
        } catch (e) { /* ignore */ }
        try {
            const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
            if (d && d.set && d.configurable) {
                Object.defineProperty(HTMLImageElement.prototype, "src", {
                    configurable: true,
                    enumerable: d.enumerable,
                    get: function () { return SRC in this ? this[SRC] : d.get.call(this); },
                    set: function (v) {
                        const fixed = fixCss(v);
                        if (fixed !== v) this[SRC] = v; else delete this[SRC];
                        d.set.call(this, fixed);
                    },
                });
            }
        } catch (e) { /* ignore */ }

        // 4. WorldUI.addBackgroundLayer takes a bare texture name and never touches the DOM, so
        //    there is nothing to rewrite: show the PNG on an overlay div instead, the way the
        //    two Workshop frameworks do.
        let overlay = null;
        const getOverlay = () => {
            if (overlay && overlay.isConnected) return overlay;
            overlay = document.createElement("div");
            overlay.id = "civ7mods-civ-art-overlay";
            const s = overlay.style;
            s.setProperty("position", "fixed");
            s.setProperty("background-size", "cover");
            s.setProperty("background-position", "center center");
            s.setProperty("background-repeat", "no-repeat");
            s.setProperty("pointer-events", "none");
            s.setProperty("z-index", "-1");
            s.setProperty("display", "none");
            (document.body || document.documentElement).appendChild(overlay);
            return overlay;
        };
        const showOverlay = (fsUrl, params) => {
            const el = getOverlay();
            const offset = (params && params.offset) || { x: 0, y: 0 };
            const size = params && params.size;
            el.style.setProperty("top", (offset.y || 0) + "px");
            el.style.setProperty("left", (offset.x || 0) + "px");
            if (size) {
                el.style.setProperty("width", size.x + "px");
                el.style.setProperty("height", size.y + "px");
                el.style.removeProperty("right");
                el.style.removeProperty("bottom");
            } else {
                el.style.removeProperty("width");
                el.style.removeProperty("height");
                el.style.setProperty("right", "0");
                el.style.setProperty("bottom", "0");
            }
            el.style.setProperty("opacity", String((params && params.alpha) != null ? params.alpha : 1));
            el.style.setProperty("background-image", "url('" + fsUrl + "')");
            el.style.removeProperty("display");
        };
        const hideOverlay = () => { if (overlay) overlay.style.setProperty("display", "none"); };
        shared.hideOverlay = hideOverlay;

        try {
            if (window.WorldUI && WorldUI.addBackgroundLayer) {
                const original = WorldUI.addBackgroundLayer.bind(WorldUI);
                WorldUI.addBackgroundLayer = function (texture, params, pass) {
                    const hit = typeof texture === "string" ? shared.panels.get(texture.toLowerCase()) : null;
                    if (hit) { showOverlay(hit, params); return; }
                    if (typeof texture === "string" && texture.indexOf("bg-panel-") === 0) hideOverlay();
                    return original(texture, params, pass);
                };
            }
            if (window.WorldUI && WorldUI.clearBackground) {
                const original = WorldUI.clearBackground.bind(WorldUI);
                WorldUI.clearBackground = function () { hideOverlay(); return original(); };
            }
        } catch (e) { /* ignore */ }

        // 5. Unit portraits. WorldUI.requestPortrait(name, unitType, background) renders a unit's
        //    3D asset into the live texture the panel then shows as url("live:/<name>"). Leave the
        //    first argument alone - it is the texture key the CSS is about to ask for - and swap
        //    only the second, which is the asset to render.
        //    Both swaps say so once per subject in Logs/UI.log. Neither of them can be checked
        //    from outside the game - a portrait that fails renders an empty box and a leader
        //    that fails falls back to a generic figure, and in both cases nothing is requested,
        //    so no "failed to open file" line ever appears. One line each turns "does it look
        //    right?" into something readable.
        const announced = new Set();
        const announce = (what, from, to) => {
            if (announced.has(what + from)) return;
            announced.add(what + from);
            console.warn("civ7mods: " + what + " " + from + " -> " + to);
        };
        shared.announce = announce;

        try {
            if (window.WorldUI && WorldUI.requestPortrait) {
                const original = WorldUI.requestPortrait.bind(WorldUI);
                WorldUI.requestPortrait = function (name, unitType, background) {
                    const stand = typeof unitType === "string" ? shared.unitAssets.get(unitType) : null;
                    if (!stand) return original(name, unitType, background);
                    announce("portrait", unitType, stand);
                    // Ask for the stand-in exactly the way the base game asks for its own units -
                    // both arguments the same - instead of swapping one of them. The two are
                    // interchangeable in every shipped call, so which is the texture key and
                    // which is the asset cannot be read off the code, and guessing it wrong
                    // renders nothing while still looking like the hook ran. fixCss then points
                    // the panel's url("live:/<ours>") at the texture we know exists.
                    return original(stand, stand, background);
                };
            }
        } catch (e) { /* ignore */ }

        // 6. Leader models. A mod cannot ship one: leader-select asks the engine for
        //    `<LEADER_TYPE>_GAME_ASSET`, gets null back, and falls through to the faceless
        //    LEADER_FALLBACK_GAME_ASSET -
        //    core/ui/shell/leader-select/leader-select-model-manager.js:151-162. Leaders'
        //    BasePersonaType does not help; that is read by the alternate-persona system, not
        //    by this lookup. So borrow a shipped leader's model by rewriting the asset name on
        //    its way into the model group, which covers leader select and every other screen
        //    that builds its models the same way.
        try {
            if (window.WorldUI && WorldUI.createModelGroup) {
                const original = WorldUI.createModelGroup.bind(WorldUI);
                const swap = (name) => (typeof name === "string"
                    && shared.leaderAssets.get(name.toUpperCase())) || name;
                const wrapMethod = (group, method) => {
                    if (!group || typeof group[method] !== "function" || group[method].__civ7mods) return;
                    const inner = group[method].bind(group);
                    const wrapped = function (asset) {
                        const swapped = swap(asset);
                        const model = inner.apply(null, [swapped].concat([].slice.call(arguments, 1)));
                        // Report whether the engine actually took the asset. leader-select falls
                        // back to LEADER_FALLBACK_GAME_ASSET when addModel returns null, so a
                        // borrowed model that fails looks exactly like one that was never tried.
                        if (swapped !== asset) {
                            announce("leader model", asset, swapped + (model ? " (accepted)" : " (REFUSED - engine returned null)"));
                        }
                        return model;
                    };
                    wrapped.__civ7mods = true;
                    group[method] = wrapped;
                };
                WorldUI.createModelGroup = function () {
                    const group = original.apply(null, arguments);
                    wrapMethod(group, "addModel");
                    wrapMethod(group, "addModelAtPos");
                    return group;
                };
            }
        } catch (e) { /* ignore */ }

        // 7. Last net: HTML that arrives with an inline style or src already set. This does not
        //    catch programmatic changes (see the note at the top) - the prototype hooks do.
        try {
            const fixElement = (el) => {
                if (!el || el.nodeType !== 1) return;
                const bg = el.style && el.style.backgroundImage;
                if (bg) { const f = fixCss(bg); if (f !== bg) el.style.backgroundImage = f; }
                if (el.tagName === "IMG") {
                    const src = el.getAttribute("src");
                    if (src) { const f = fixCss(src); if (f !== src) el.setAttribute("src", f); }
                }
            };
            const scan = (root) => {
                fixElement(root);
                if (root && root.querySelectorAll) root.querySelectorAll("*").forEach(fixElement);
            };
            new MutationObserver((records) => {
                for (const r of records) {
                    if (r.type === "attributes") fixElement(r.target);
                    else r.addedNodes.forEach(scan);
                }
            }).observe(document.documentElement, {
                subtree: true, childList: true, attributes: true, attributeFilter: ["style", "src"],
            });
            scan(document.documentElement);
        } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------- per-mod, after the shared hooks

    // UI.getIconBLP returns the BACKGROUND_VERT row verbatim; some callers then prepend "blp:".
    // Returning our URL here keeps the tall civ-select card pointed at a real file, and the
    // blp: prefix another caller adds is stripped by fixCss above.
    try {
        if (window.UI && typeof UI.getIconBLP === "function" && !UI.getIconBLP.__civ7mods) {
            const original = UI.getIconBLP.bind(UI);
            const wrapped = function (id, context) {
                const civ = window[KEY].verts && window[KEY].verts.get(String(id));
                if (civ && context === "BACKGROUND_VERT") return civ;
                return original(id, context);
            };
            wrapped.__civ7mods = true;
            UI.getIconBLP = wrapped;
        }
        (shared.verts || (shared.verts = new Map())).set(CONFIG.civType, url(CONFIG.vert));
    } catch (e) { /* ignore */ }
})();
