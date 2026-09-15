// Change Capital: a standalone "Relocate Capital" button, usable any time (not just at an age
// transition), that spends a flat amount of Diplomacy (Influence) points to make any of the
// player's own settlements the new capital.
//
// Implemented entirely as a self-built floating button + dialog (own DOM, appended to
// document.body), the same low-risk technique Etruscans/ui/etruscans-images.js uses for its
// background overlay - rather than trying to inject into a native panel/custom-element class,
// which is a much larger, more fragile surface to hook from an additive script.
//
// The actual relocation reuses the same native operation the age-transition capital picker
// uses (base-standard/ui-next/screens/legacies/legacies-support.js:selectCapital):
//   Game.PlayerOperations.canStart/sendRequest(playerId, PlayerOperationTypes.SELECT_CAPITAL, ...)
// The engine has no cost argument for that operation, so the Diplomacy charge is applied
// ourselves via the same direct treasury mutator base game code itself uses for age-transition
// bookkeeping (base-standard/scripts/age-transition-post-load.js):
//   player.DiplomacyTreasury.changeDiplomacyBalance(delta)
(function () {
    console.warn("change-capital: relocate script loaded, document.readyState=" + document.readyState);
    if (window.__changeCapitalRelocateLoaded) return;
    window.__changeCapitalRelocateLoaded = true;

    // Flat cost in Diplomacy (Influence) points. Change this one number to retune it.
    const RELOCATION_COST = 300;

    const isSameCity = (a, b) => !!a && !!b && a.owner === b.owner && a.id === b.id;

    function localPlayer() {
        if (typeof GameContext === "undefined" || GameContext.localPlayerID == null) return null;
        return (typeof Players !== "undefined" && Players.get) ? Players.get(GameContext.localPlayerID) : null;
    }

    let lastDiagnostics = null;
    function inActiveGame() {
        const hasGameContext = typeof GameContext !== "undefined";
        const hasPlayerID = hasGameContext && GameContext.localPlayerID != null;
        const hasCities = typeof Cities !== "undefined";
        const hasGame = typeof Game !== "undefined";
        const hasPlayerOperations = hasGame && !!Game.PlayerOperations;
        const signature = hasGameContext + "|" + hasPlayerID + "|" + hasCities + "|" + hasGame + "|" + hasPlayerOperations;
        if (signature !== lastDiagnostics) {
            lastDiagnostics = signature;
            console.warn("change-capital: diagnostics GameContext=" + hasGameContext
                + " localPlayerID=" + hasPlayerID + " Cities=" + hasCities
                + " Game=" + hasGame + " PlayerOperations=" + hasPlayerOperations);
        }
        return hasPlayerID && hasCities && hasGame && hasPlayerOperations;
    }

    function loc(tag, ...args) {
        try {
            return (typeof Locale !== "undefined" && Locale.compose) ? Locale.compose(tag, ...args) : tag;
        } catch (e) {
            return tag;
        }
    }

    // ------------------------------------------------------------------ minimal floating UI

    let root = null;
    let toastTimer = 0;

    function ensureRoot() {
        if (root && root.isConnected) return root;
        root = document.createElement("div");
        root.id = "change-capital-root";
        (document.body || document.documentElement).appendChild(root);
        return root;
    }

    function showToast(message) {
        const container = ensureRoot();
        let toast = container.querySelector("#change-capital-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "change-capital-toast";
            Object.assign(toast.style, {
                position: "fixed", left: "50%", top: "18%", transform: "translateX(-50%)",
                background: "rgba(15,15,20,0.92)", color: "#f0e6c8", padding: "10px 18px",
                borderRadius: "6px", border: "1px solid #7a6a3a", fontSize: "15px",
                zIndex: "10000", pointerEvents: "none", maxWidth: "420px", textAlign: "center",
            });
            container.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.display = "block";
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => { toast.style.display = "none"; }, 3500);
    }

    function closeDialog() {
        const container = ensureRoot();
        const dialog = container.querySelector("#change-capital-dialog");
        if (dialog) dialog.remove();
    }

    function rowButton(label, onClick) {
        const btn = document.createElement("div");
        btn.textContent = label;
        Object.assign(btn.style, {
            padding: "8px 12px", margin: "4px 0", background: "rgba(255,255,255,0.06)",
            border: "1px solid #5a5040", borderRadius: "4px", cursor: "pointer", color: "#f0e6c8",
        });
        btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(255,255,255,0.16)"; });
        btn.addEventListener("mouseleave", () => { btn.style.background = "rgba(255,255,255,0.06)"; });
        btn.addEventListener("click", onClick);
        return btn;
    }

    function attemptRelocate(player, city) {
        const treasury = player.DiplomacyTreasury;
        const balance = treasury ? treasury.diplomacyBalance : 0;
        if (balance < RELOCATION_COST) {
            showToast(loc("LOC_CHANGE_CAPITAL_INSUFFICIENT_FUNDS", RELOCATION_COST, balance));
            return;
        }
        const args = { Player1: GameContext.localPlayerID, City: city.id, Swap: false };
        const result = Game.PlayerOperations.canStart(GameContext.localPlayerID, PlayerOperationTypes.SELECT_CAPITAL, args, false);
        if (!result || !result.Success) {
            showToast(loc("LOC_CHANGE_CAPITAL_CANNOT_RELOCATE", city.name));
            return;
        }
        treasury.changeDiplomacyBalance(-RELOCATION_COST);
        Game.PlayerOperations.sendRequest(GameContext.localPlayerID, PlayerOperationTypes.SELECT_CAPITAL, args);
        showToast(loc("LOC_CHANGE_CAPITAL_SUCCESS", city.name));
        closeDialog();
    }

    function openDialog() {
        closeDialog();
        const player = localPlayer();
        const cities = player && player.Cities;
        if (!cities || typeof cities.getCityIds !== "function") return;

        const capital = typeof cities.getCapital === "function" ? cities.getCapital() : null;
        const capitalId = capital && capital.id;
        const candidates = cities.getCityIds()
            .map((id) => Cities.get(id))
            .filter((city) => city && !isSameCity(city.id, capitalId));

        const container = ensureRoot();
        const overlay = document.createElement("div");
        overlay.id = "change-capital-dialog";
        Object.assign(overlay.style, {
            position: "fixed", left: "0", top: "0", right: "0", bottom: "0",
            background: "rgba(0,0,0,0.55)", zIndex: "9999",
            display: "flex", alignItems: "center", justifyContent: "center",
        });
        overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDialog(); });

        const panel = document.createElement("div");
        Object.assign(panel.style, {
            background: "#1c1a14", border: "1px solid #7a6a3a", borderRadius: "8px",
            padding: "16px 20px", minWidth: "320px", maxWidth: "480px", maxHeight: "70vh",
            overflowY: "auto", color: "#f0e6c8", fontFamily: "inherit",
        });
        overlay.appendChild(panel);

        const title = document.createElement("div");
        title.textContent = loc("LOC_CHANGE_CAPITAL_DIALOG_TITLE");
        Object.assign(title.style, { fontSize: "18px", fontWeight: "bold", marginBottom: "4px" });
        panel.appendChild(title);

        const balance = player.DiplomacyTreasury ? player.DiplomacyTreasury.diplomacyBalance : 0;
        const subtitle = document.createElement("div");
        subtitle.textContent = loc("LOC_CHANGE_CAPITAL_DIALOG_SUBTITLE", RELOCATION_COST, balance);
        Object.assign(subtitle.style, { fontSize: "13px", opacity: "0.85", marginBottom: "12px" });
        panel.appendChild(subtitle);

        if (candidates.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = loc("LOC_CHANGE_CAPITAL_NO_OTHER_CITIES");
            panel.appendChild(empty);
        } else {
            for (const city of candidates) {
                panel.appendChild(rowButton(city.name, () => attemptRelocate(player, city)));
            }
        }

        panel.appendChild(rowButton(loc("LOC_CHANGE_CAPITAL_CLOSE"), closeDialog));

        container.appendChild(overlay);
    }

    function ensureButton() {
        if (!inActiveGame()) {
            const container = root;
            const btn = container && container.querySelector("#change-capital-button");
            if (btn) btn.style.display = "none";
            return;
        }
        const container = ensureRoot();
        let btn = container.querySelector("#change-capital-button");
        if (!btn) {
            console.warn("change-capital: creating the Relocate Capital button now");
            btn = document.createElement("div");
            btn.id = "change-capital-button";
            btn.title = loc("LOC_CHANGE_CAPITAL_BUTTON_TOOLTIP");
            Object.assign(btn.style, {
                position: "fixed", right: "16px", bottom: "120px", zIndex: "9000",
                background: "rgba(15,15,20,0.85)", color: "#f0e6c8", padding: "8px 14px",
                borderRadius: "6px", border: "1px solid #7a6a3a", cursor: "pointer",
                fontSize: "13px", pointerEvents: "auto",
            });
            btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(40,36,20,0.95)"; });
            btn.addEventListener("mouseleave", () => { btn.style.background = "rgba(15,15,20,0.85)"; });
            btn.addEventListener("click", openDialog);
            container.appendChild(btn);
        }
        btn.textContent = loc("LOC_CHANGE_CAPITAL_BUTTON");
        btn.style.display = "block";
    }

    // No reliable single "entered game" event to hook from a classic script loaded at module
    // scope, and polling is cheap: just check every couple of seconds whether we should be
    // showing the button (covers loading into a game, leaving to the shell, and starting a
    // new game without a full UI reload).
    window.setInterval(ensureButton, 2000);
    ensureButton();
})();
