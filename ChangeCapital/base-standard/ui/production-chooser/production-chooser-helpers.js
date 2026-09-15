import { Audio } from '../../../core/ui/audio-base/audio-support.js';
import { InterfaceMode } from '../../../core/ui/interface-modes/interface-modes.js';
import { ComponentID } from '../../../core/ui/utilities/utilities-component-id.js';
import { Icon } from '../../../core/ui/utilities/utilities-image.js';
import { BuildingPlacementManager } from '../building-placement/building-placement-manager.js';
import CityDetails from '../city-details/model-city-details.js';
import { AdvisorUtilities } from '../tutorial/advisor-utilities.js';
import { ConstructibleHasTagType, getConstructibleTagsFromType } from '../utilities/utilities-tags.js';

var ProductionPanelCategory = /* @__PURE__ */ ((ProductionPanelCategory2) => {
  ProductionPanelCategory2["BUILDINGS"] = "buildings";
  ProductionPanelCategory2["UNITS"] = "units";
  ProductionPanelCategory2["PROJECTS"] = "projects";
  ProductionPanelCategory2["WONDERS"] = "wonders";
  return ProductionPanelCategory2;
})(ProductionPanelCategory || {});

// --- Change Capital ---------------------------------------------------------------------
// This file is based on the copy of production-chooser-helpers.js already shipped by the
// installed MovableBuildings mod (same technique: a mod can override a stock file outright by
// shipping one of its own at the exact same path) rather than the pristine stock file, so both
// mods' changes keep working together regardless of which one loads last - shipping our own
// patch on top of stock alone would silently drop MovableBuildings' edit, or vice versa,
// whichever loaded second. If other mods also ship this same path, only one file wins; there is
// no way around that for a same-path override, so this is a real compatibility caveat, not a bug.
//
// A "project" is the smallest real slot in this screen's item model that (a) does not need a
// database row most other item kinds require (buildings/units always resolve through
// GameInfo.Types) and (b) already reads naturally as "click it to do a one-off thing to this
// city" - showTurns/showCost:false and a plain description is exactly what the base game's own
// "upgrade to city" project row does. CHANGE_CAPITAL_PROJECT_TYPE is a sentinel that deliberately
// does not exist in GameInfo.Types, so Construct() below can special-case it before the stock
// code's own GameInfo.Types.lookup(item.type) - the sentinel never collides with a real type.
const CHANGE_CAPITAL_PROJECT_TYPE = "CHANGE_CAPITAL_RELOCATE_ACTION";
const CHANGE_CAPITAL_COST_BY_AGE = {
  AGE_ANTIQUITY: 100,
  AGE_EXPLORATION: 200,
  AGE_MODERN: 300,
};
const CHANGE_CAPITAL_DEFAULT_COST = 300;

// Recomputed on every use rather than cached, since the current age can change while the game
// is running (an age transition) and the cost should always reflect the age you are in right now.
function changeCapitalCurrentCost() {
  try {
    const ageType = GameInfo.Ages.lookup(Game.age)?.AgeType;
    return CHANGE_CAPITAL_COST_BY_AGE[ageType] ?? CHANGE_CAPITAL_DEFAULT_COST;
  } catch (e) {
    return CHANGE_CAPITAL_DEFAULT_COST;
  }
}

function changeCapitalLoc(tag, ...args) {
  try {
    return (typeof Locale !== "undefined" && Locale.compose) ? Locale.compose(tag, ...args) : tag;
  } catch (e) {
    return tag;
  }
}

function changeCapitalToast(message) {
  let toast = document.getElementById("change-capital-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "change-capital-toast";
    Object.assign(toast.style, {
      position: "fixed", left: "50%", top: "18%", transform: "translateX(-50%)",
      background: "rgba(15,15,20,0.92)", color: "#f0e6c8", padding: "10px 18px",
      borderRadius: "6px", border: "1px solid #7a6a3a", fontSize: "15px",
      zIndex: "10000", pointerEvents: "none", maxWidth: "420px", textAlign: "center",
    });
    (document.body || document.documentElement).appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = "block";
  window.clearTimeout(toast.__changeCapitalTimer);
  toast.__changeCapitalTimer = window.setTimeout(() => { toast.style.display = "none"; }, 3500);
}

function changeCapitalDoRelocate(city) {
  const player = (typeof Players !== "undefined" && city) ? Players.get(city.owner) : null;
  const treasury = player && player.DiplomacyTreasury;
  const balance = treasury ? treasury.diplomacyBalance : 0;
  const cost = changeCapitalCurrentCost();

  if (!treasury || balance < cost) {
    changeCapitalToast(changeCapitalLoc("LOC_CHANGE_CAPITAL_INSUFFICIENT_FUNDS", cost, balance));
    return;
  }
  // City wants the plain numeric city id, not the ComponentID object city.id itself - the
  // native age-transition code (legacies-support.js:selectCapital) does `City: cityID.id`
  // where its own cityID parameter is already a ComponentID, i.e. one more ".id" than city.id.
  const args = { Player1: city.owner, City: city.id.id, Swap: false };
  const result = Game.PlayerOperations.canStart(city.owner, PlayerOperationTypes.SELECT_CAPITAL, args, false);
  if (!result || !result.Success) {
    changeCapitalToast(changeCapitalLoc("LOC_CHANGE_CAPITAL_CANNOT_RELOCATE", city.name));
    return;
  }
  treasury.changeDiplomacyBalance(-cost);
  Game.PlayerOperations.sendRequest(city.owner, PlayerOperationTypes.SELECT_CAPITAL, args);
  changeCapitalToast(changeCapitalLoc("LOC_CHANGE_CAPITAL_SUCCESS", city.name));
}

function changeCapitalCloseConfirm() {
  ["change-capital-confirm-panel", "change-capital-confirm-title", "change-capital-confirm-body",
   "change-capital-confirm-yes", "change-capital-confirm-no"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

// Every element here is a flat, independent sibling appended directly to document.body -
// exactly the structure that reliably shows text in this engine (this mod's original floating
// button, and its toast) - rather than nested children of one wrapper div, which rendered
// borders/backgrounds fine but left all text invisible for reasons that were not worth chasing
// further once this flat structure was confirmed to work instead.
function changeCapitalConfirmAndRelocate(city) {
  changeCapitalCloseConfirm();
  const player = (typeof Players !== "undefined" && city) ? Players.get(city.owner) : null;
  const treasury = player && player.DiplomacyTreasury;
  const balance = treasury ? treasury.diplomacyBalance : 0;
  const cost = changeCapitalCurrentCost();
  const root = document.body || document.documentElement;

  // Plain pixel values computed in JS, not calc(50vw/50vh - ...): the button and the project
  // rows, both positioned/read with real pixel numbers (getBoundingClientRect or literal px),
  // reliably receive clicks. This dialog's first version used CSS viewport-unit calc() for
  // position:fixed instead, and rendered visually correctly but never received clicks - mouse
  // input passed straight through to the map underneath. This engine has already shown other
  // non-standard CSS behaviour (see Etruscans/ui/etruscans-images.js), so avoid vw/vh entirely
  // rather than chase why.
  const cx = Math.round(window.innerWidth / 2);
  const cy = Math.round(window.innerHeight / 2);

  const panel = document.createElement("div");
  panel.id = "change-capital-confirm-panel";
  Object.assign(panel.style, {
    position: "fixed", left: (cx - 200) + "px", top: (cy - 90) + "px",
    width: "400px", height: "180px", background: "#1c1a14", border: "1px solid #7a6a3a",
    borderRadius: "8px", zIndex: "10500", boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
  });
  root.appendChild(panel);

  const title = document.createElement("div");
  title.id = "change-capital-confirm-title";
  Object.assign(title.style, {
    position: "fixed", left: (cx - 180) + "px", top: (cy - 76) + "px", width: "360px",
    zIndex: "10501", color: "#f0e6c8", fontSize: "16px", fontWeight: "bold",
  });
  root.appendChild(title);
  title.textContent = changeCapitalLoc("LOC_CHANGE_CAPITAL_CONFIRM_TITLE");

  const body = document.createElement("div");
  body.id = "change-capital-confirm-body";
  Object.assign(body.style, {
    position: "fixed", left: (cx - 180) + "px", top: (cy - 46) + "px", width: "360px",
    zIndex: "10501", color: "#f0e6c8", fontSize: "13px", lineHeight: "1.4",
  });
  root.appendChild(body);
  body.textContent = changeCapitalLoc("LOC_CHANGE_CAPITAL_CONFIRM_BODY", city.name, cost, balance);

  const makeButton = (id, left, label, primary, onClick) => {
    const btn = document.createElement("div");
    btn.id = id;
    Object.assign(btn.style, {
      position: "fixed", left: left + "px", top: (cy + 40) + "px", zIndex: "10501",
      padding: "8px 14px", borderRadius: "4px", cursor: "pointer", color: "#f0e6c8",
      border: "1px solid " + (primary ? "#c9a227" : "#5a5040"), fontSize: "13px",
      background: primary ? "rgba(201,162,39,0.18)" : "rgba(255,255,255,0.06)",
    });
    root.appendChild(btn);
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  };

  makeButton("change-capital-confirm-no", cx - 180, changeCapitalLoc("LOC_CHANGE_CAPITAL_CLOSE"), false, changeCapitalCloseConfirm);
  makeButton("change-capital-confirm-yes", cx + 20, changeCapitalLoc("LOC_CHANGE_CAPITAL_CONFIRM_YES"), true, () => {
    changeCapitalCloseConfirm();
    changeCapitalDoRelocate(city);
  });
}
// --- end Change Capital insertion; the rest of the file resumes stock code -----------------
window.addEventListener("hotkey-cycle-next-city", () => SelectNextCity());
window.addEventListener("hotkey-cycle-prev-city", () => SelectPrevCity());
const SelectNextCity = () => {
  const currentCity = UI.Player.getHeadSelectedCity();
  if (ComponentID.isValid(currentCity)) {
    const city = GetNextCityID(currentCity);
    if (ComponentID.isValid(city)) {
      UI.Player.selectCity(city);
    }
  }
};
const SelectPrevCity = () => {
  const currentCity = UI.Player.getHeadSelectedCity();
  if (ComponentID.isValid(currentCity)) {
    const city = GetPrevCityID(currentCity);
    if (ComponentID.isValid(city)) {
      UI.Player.selectCity(city);
    }
  }
};
const GetNextCityID = (cityID) => {
  const cities = Players.get(cityID.owner)?.Cities?.getCities();
  if (!cities?.length) return null;
  const currentIndex = cities.findIndex((city) => ComponentID.isMatch(cityID, city.id));
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % cities.length;
  return cities[nextIndex]?.id ?? null;
};
const GetPrevCityID = (cityID) => {
  const cities = Players.get(cityID.owner)?.Cities?.getCities();
  if (!cities?.length) return null;
  const currentIndex = cities.findIndex((city) => ComponentID.isMatch(cityID, city.id));
  const prevIndex = currentIndex <= 0 ? cities.length - 1 : currentIndex - 1;
  return cities[prevIndex]?.id ?? null;
};
const GetUnitStatsFromDefinition = (definition) => {
  const stats = [];
  if (definition.BaseMoves > 0) {
    stats.push({
      name: "LOC_UNIT_INFO_MOVES_REMAINING",
      icon: "Action_Move",
      value: definition.BaseMoves.toString()
    });
  }
  if (definition.BuildCharges > 0) {
    stats.push({
      name: "LOC_UNIT_INFO_BUILD_CHARGES",
      icon: "Action_Construct",
      value: definition.BuildCharges.toString()
    });
  }
  const statsDefinition = GameInfo.Unit_Stats.lookup(definition.UnitType);
  if (statsDefinition) {
    if (statsDefinition.Combat > 0) {
      stats.push({
        name: "LOC_UNIT_INFO_MELEE_STRENGTH",
        icon: "Action_Attack",
        value: statsDefinition.Combat.toString()
      });
    }
    if (statsDefinition.RangedCombat > 0) {
      stats.push({
        name: "LOC_UNIT_INFO_RANGED_STRENGTH",
        icon: "Action_Ranged",
        value: statsDefinition.RangedCombat.toString()
      });
    }
    if (statsDefinition.Bombard > 0) {
      stats.push({
        name: "LOC_UNIT_INFO_BOMBARD",
        icon: "action_bombard",
        value: statsDefinition.Bombard.toString()
      });
    }
    if (statsDefinition.RangedCombat > 0) {
      stats.push({
        name: "LOC_UNIT_INFO_RANGE",
        icon: "action_rangedattack",
        value: statsDefinition.Range.toString()
      });
    }
  }
  return stats;
};
const GetCurrentBestTotalYieldForConstructible = (city, constructibleType) => {
  const results = [];
  const constructibleDef = GameInfo.Constructibles.lookup(constructibleType);
  if (!constructibleDef) {
    console.error(
      `production-chooser-helper: GetCurrentBestTotalYieldForConstructible() failed to find constructible definition for type ${constructibleType}`
    );
    return results;
  }
  if (!BuildingPlacementManager.cityID || !ComponentID.isMatch(BuildingPlacementManager.cityID, city.id)) {
    BuildingPlacementManager.initializePlacementData(city.id);
  }
  const allPlacementData = BuildingPlacementManager.allPlacementData;
  if (!allPlacementData || !allPlacementData.buildings) {
    return results;
  }
  const constructiblePlacementData = allPlacementData.buildings.find(
    (b) => b.constructibleType == constructibleDef.$hash
  );
  if (!constructiblePlacementData) {
    return results;
  }
  let bestPlacement = null;
  let bestTotal = Number.MIN_SAFE_INTEGER;
  for (const placement of constructiblePlacementData.placements) {
    const totalChanges = BuildingPlacementManager.getTotalYieldChangesFromPlacementData(placement);
    let total = 0;
    for (const change of totalChanges) total += change.yieldChange;
    if (total > bestTotal) {
      bestTotal = total;
      bestPlacement = placement;
    }
  }
  if (!bestPlacement) {
    return results;
  }
  const yieldsCopy = [...bestPlacement.yieldChanges];
  let ignoreNaturalYields = true;
  if (constructibleDef.ConstructibleClass == "IMPROVEMENT") {
    const improvementDef = GameInfo.Improvements.lookup(constructibleDef.ConstructibleType);
    if (improvementDef) {
      ignoreNaturalYields = improvementDef.IgnoreNaturalYields;
    }
  }
  const plotCoord = GameplayMap.getLocationFromIndex(bestPlacement.plotID);
  const constructibles = MapConstructibles.getConstructibles(plotCoord.x, plotCoord.y);
  for (const constructible of constructibles) {
    const instance = Constructibles.getByComponentID(constructible);
    if (!instance) continue;
    const info = GameInfo.Constructibles.lookup(instance.type);
    if (info && info.ConstructibleClass == "IMPROVEMENT" && BuildingPlacementManager.cityID && ignoreNaturalYields) {
      const improvementYields = GameplayMap.getYieldsWithCity(
        bestPlacement.plotID,
        BuildingPlacementManager.cityID
      );
      for (const improvementYield of improvementYields) {
        const yieldDefinition = GameInfo.Yields.lookup(improvementYield[0]);
        if (yieldDefinition) {
          yieldsCopy[yieldDefinition.$index] -= improvementYield[1];
        }
      }
    }
  }
  const cityConstructibles = city.Constructibles;
  if (cityConstructibles) {
    if (bestPlacement.overbuiltConstructibleID != void 0 && bestPlacement.overbuiltConstructibleID != -1) {
      const previousConstructibleDefinition = GameInfo.Constructibles.find(
        (d) => d.$index == bestPlacement.overbuiltConstructibleID
      );
      if (previousConstructibleDefinition) {
        const prevMaint = cityConstructibles.getMaintenance(previousConstructibleDefinition.ConstructibleType);
        for (let i = 0; i < prevMaint.length; i++) yieldsCopy[i] += prevMaint[i];
      }
    }
    const newMaint = cityConstructibles.getMaintenance(constructibleDef.ConstructibleType);
    for (let i = 0; i < newMaint.length; i++) yieldsCopy[i] -= newMaint[i];
  }
  const nonZeroEntries = [];
  GameInfo.Yields.forEach((yieldDef, idx) => {
    const change = yieldsCopy[idx];
    if (change && change !== 0) {
      nonZeroEntries.push({ def: yieldDef, change });
    }
  });
  for (let i = 0; i < nonZeroEntries.length; i++) {
    const { def, change } = nonZeroEntries[i];
    const isLast = i === nonZeroEntries.length - 1;
    let valueText = Locale.compose(
      isLast ? "LOC_UI_CITY_DETAILS_YIELD_ONE_DECIMAL" : "LOC_UI_CITY_DETAILS_YIELD_ONE_DECIMAL_COMMA",
      change
    );
    if (change < 0) {
      valueText = `<span class="text-negative font-bold">${valueText}</span>`;
    }
    results.push({
      iconId: def.$index.toString(),
      icon: Icon.getYieldIcon(def.YieldType),
      value: valueText,
      name: def.Name,
      yieldType: def.YieldType
    });
  }
  return results;
};
const GetSecondaryDetailsHTML = (items) => {
  return items.reduce((acc, { icon, value, name }) => {
    return acc + `<div class="flex items-center ${items.length < 4 ? "mr-2" : "mr-px font-body-xs tracking-25"}"><img aria-label="${Locale.compose(name)}" src="${icon}" class="size-8" />${value}</div>`;
  }, "");
};
const GetConstructibleItemData = ({
  constructible,
  city,
  operationResult,
  hideIfUnavailable = false,
  infoDisplayType
}) => {
  const cityGold = city.Gold;
  if (!cityGold) {
    console.error("GetConstructibleItemData: getConstructibleItem: Failed to get cityGold!");
    return null;
  }
  const ageless = ConstructibleHasTagType(constructible.ConstructibleType, "AGELESS");
  let insufficientFunds = operationResult.InsufficientFunds ?? false;
  if (operationResult.Success || insufficientFunds || !hideIfUnavailable || operationResult.NeededUnlock != -1 && !hideIfUnavailable) {
    const baseYields = [];
    for (const yieldChange of GameInfo.Constructible_YieldChanges) {
      if (yieldChange.ConstructibleType == constructible.ConstructibleType) {
        baseYields.push({ yieldType: yieldChange.YieldType, value: yieldChange.YieldChange });
      }
    }
    const bestYields = GetCurrentBestTotalYieldForConstructible(city, constructible.ConstructibleType);
    const secondaryDetails = GetSecondaryDetailsHTML(bestYields);
    if (operationResult.Success || insufficientFunds || !hideIfUnavailable) {
      const possibleLocations = [];
      const pushPlots = (p) => {
        possibleLocations.push(p);
      };
      operationResult.Plots?.forEach(pushPlots);
      operationResult.ExpandUrbanPlots?.forEach(pushPlots);
      let turns = city.BuildQueue.getTurnsLeft(constructible.ConstructibleType);
      const isBuildingAlreadyQueued = (constructible.ConstructibleClass == "BUILDING" || constructible.ConstructibleClass == "IMPROVEMENT") && operationResult.InQueue;
      let category = getConstructibleClassPanelCategory(constructible.ConstructibleClass);
      if (possibleLocations.length > 0 && !isBuildingAlreadyQueued && !operationResult.InsufficientFunds) {
        let name = constructible.Name;
        let description = "";
		let iShouldDisable = false;
        if (operationResult.RepairDamaged && constructible.Repairable) {
          name = Locale.compose("LOC_UI_PRODUCTION_REPAIR_NAME", constructible.Name);
          description = "LOC_UI_PRODUCTION_REPAIR_DESCRIPTION";
        } else if (operationResult.MoveToNewLocation) {
          name = Locale.compose("LOC_UI_PRODUCTION_MOVE_NAME", constructible.Name);
		  category = "projects"; //把迁移移到项目去
		  const iPlayer = Players.get(city.owner);
		  const iIsHuman = iPlayer.isHuman;
		  if (!iIsHuman){
			turns = 999;
			insufficientFunds = true; 
		    iShouldDisable = true; //如果不是人类，那么该项目为无法使用，消耗为99999，且显示金额不足
		  }
        }
		const iDisable = (constructible.Cost < 0) || (iShouldDisable);
        const locations = Locale.compose(
          "LOC_UI_PRODUCTION_LOCATIONS",
          constructible.Cost,
          possibleLocations.length
        );
        const canGetWarehouseBonuses = ConstructibleHasTagType(constructible.ConstructibleType, "WAREHOUSE");
        const warehouseCount = BuildingPlacementManager.getNumberOfWarehouseBonuses(constructible.$hash);
        const canGetAdjacencyBonuses = BuildingPlacementManager.canGetAdjacencyBonuses(
          constructible.ConstructibleType
        );
        const highestAdjacency = BuildingPlacementManager.getHighestAdjacencyBonus(constructible.$hash);
        let cost = operationResult.Cost ?? cityGold.getBuildingPurchaseCost(YieldTypes.YIELD_GOLD, constructible.ConstructibleType);
		if (iShouldDisable){
		  cost = 99999;
		}
        const item = {
          name,
          description,
          type: constructible.ConstructibleType,
          cost,
          category,
          ageless,
          turns,
          showTurns: turns > -1,
          showCost: cost > 0,
          insufficientFunds,
          disabled: iDisable,
          locations,
          interfaceMode: "INTERFACEMODE_PLACE_BUILDING",
          secondaryDetails,
          repairDamaged: operationResult.RepairDamaged,
          tags: getConstructibleTagsFromType(constructible.ConstructibleType),
          baseYields,
          infoDisplayType,
          canGetWarehouseBonuses,
          warehouseCount,
          canGetAdjacencyBonuses,
          highestAdjacency
        };
        return item;
      } else {
        const isCityStateUniqueImprovement = ConstructibleHasTagType(
          constructible.ConstructibleType,
          "CITY_STATE_UNIQUE_IMPROVEMENT"
        );
        const isLocked = operationResult.Locked ?? false;
        if (isCityStateUniqueImprovement && isLocked) return null;
        if (!hideIfUnavailable || insufficientFunds && possibleLocations.length > 0) {
          let name = constructible.Name;
          let error = "";
          let nodeNeededError = "";
          if (operationResult.NeededUnlock != -1) {
            const nodeInfo = GameInfo.ProgressionTreeNodes.lookup(operationResult.NeededUnlock);
            if (nodeInfo) {
              nodeNeededError = Locale.compose("LOC_UI_PRODUCTION_REQUIRES", nodeInfo.Name);
            }
          }
          if (operationResult.RepairDamaged && constructible.Repairable) {
            name = Locale.compose("LOC_UI_PRODUCTION_REPAIR_NAME", constructible.Name);
            error = operationResult.InsufficientFunds ? "LOC_CITY_PURCHASE_INSUFFICIENT_FUNDS" : "LOC_UI_PRODUCTION_ALREADY_IN_QUEUE";
          } else {
            error = operationResult.AlreadyExists ? "LOC_UI_PRODUCTION_ALREADY_EXISTS" : operationResult.NeededUnlock && operationResult.NeededUnlock != -1 ? nodeNeededError : operationResult.InsufficientFunds ? "LOC_CITY_PURCHASE_INSUFFICIENT_FUNDS" : possibleLocations.length === 0 ? "LOC_UI_PRODUCTION_NO_SUITABLE_LOCATIONS" : operationResult.InQueue ? "LOC_UI_PRODUCTION_ALREADY_IN_QUEUE" : "";
          }
          const canGetWarehouseBonuses = BuildingPlacementManager.canGetWarehouseBonuses(
            constructible.ConstructibleType
          );
          const warehouseCount = BuildingPlacementManager.getNumberOfWarehouseBonuses(constructible.$hash);
          const canGetAdjacencyBonuses = BuildingPlacementManager.canGetAdjacencyBonuses(
            constructible.ConstructibleType
          );
          const highestAdjacency = BuildingPlacementManager.getHighestAdjacencyBonus(constructible.$hash);
          const cost = operationResult.Cost ?? cityGold.getBuildingPurchaseCost(YieldTypes.YIELD_GOLD, constructible.ConstructibleType);
          return {
            name,
            type: constructible.ConstructibleType,
            cost,
            turns,
            category,
            ageless,
            showTurns: turns > -1,
            showCost: cost > 0,
            insufficientFunds,
            disabled: true,
            error,
            secondaryDetails,
            tags: getConstructibleTagsFromType(constructible.ConstructibleType),
            baseYields,
            infoDisplayType,
            canGetWarehouseBonuses,
            warehouseCount,
            canGetAdjacencyBonuses,
            highestAdjacency
          };
        }
      }
    } else {
      const prereq = operationResult.NeededUnlock;
      const canUnlockNode = CanPlayerUnlockNode(prereq, city.owner);
      const canGetWarehouseBonuses = BuildingPlacementManager.canGetWarehouseBonuses(
        constructible.ConstructibleType
      );
      const warehouseCount = BuildingPlacementManager.getNumberOfWarehouseBonuses(constructible.$hash);
      const canGetAdjacencyBonuses = BuildingPlacementManager.canGetAdjacencyBonuses(
        constructible.ConstructibleType
      );
      const highestAdjacency = BuildingPlacementManager.getHighestAdjacencyBonus(constructible.$hash);
      if (canUnlockNode) {
        const item = {
          turns: -1,
          name: constructible.Name,
          type: constructible.ConstructibleType,
          showTurns: false,
          showCost: false,
          insufficientFunds: false,
          disabled: true,
          ageless,
          category: getConstructibleClassPanelCategory(constructible.ConstructibleClass),
          cost: -1,
          secondaryDetails,
          tags: getConstructibleTagsFromType(constructible.ConstructibleType),
          baseYields,
          infoDisplayType,
          canGetWarehouseBonuses,
          warehouseCount,
          canGetAdjacencyBonuses,
          highestAdjacency
        };
        const nodeInfo = GameInfo.ProgressionTreeNodes.lookup(prereq);
        if (nodeInfo) {
          item.error = Locale.compose("LOC_UI_PRODUCTION_REQUIRES", nodeInfo.Name);
        }
        return item;
      }
    }
  }
  return null;
};
const CanPlayerUnlockNode = (nodeType, playerId) => {
  if (!nodeType) return false;
  const nodeState = Game.ProgressionTrees.getNodeState(playerId, nodeType);
  return nodeState >= ProgressionTreeNodeState.NODE_STATE_OPEN;
};
const CreateProductionChooserItem = () => {
  const item = document.createElement("production-chooser-item");
  item.setAttribute("data-audio-group-ref", "city-actions");
  item.setAttribute("data-audio-focus-ref", "data-audio-city-production-focus");
  return item;
};
const getProjectItems = (city, isPurchase) => {
  const projects = [];
  if (!city) {
    console.error(`getProjectItems: received a null/undefined city!`);
    return projects;
  }
  GameInfo.Projects.forEach((project) => {
    if (project.CityOnly && city.isTown || !project.CanPurchase && isPurchase) {
      return;
    }
    const result = Game.CityOperations.canStart(
      city.id,
      CityOperationTypes.BUILD,
      { ProjectType: project.$index },
      false
    );
    if (result.Requirements && result.Requirements?.FullFailure != true) {
      if (result.Requirements.MeetsRequirements) {
        const turns = city.BuildQueue.getTurnsLeft(project.ProjectType);
        const cost = city.Production.getProjectProductionCost(project.ProjectType);
        const projectItem = {
          name: project.Name,
          description: project.Description,
          type: project.ProjectType,
          cost,
          turns,
          category: "projects" /* PROJECTS */,
          showTurns: project.UpgradeToCity && project.TownOnly,
          showCost: false,
          insufficientFunds: false,
          disabled: !result.Success
        };
        if (project.UpgradeToCity && project.TownOnly) {
          projects.unshift(projectItem);
        } else {
          projects.push(projectItem);
        }
      }
    }
  });
  return projects;
};
const GetUniqueQuartersForPlayer = (playerId) => {
  const uniqueQuarters = [];
  const playerConstructibles = Players.Constructibles.get(playerId);
  if (playerConstructibles) {
    const uniqueQuarterTypes = playerConstructibles.getUnlockedUniqueQuarters();
    for (const uniqueQuarterType of uniqueQuarterTypes) {
      let uniqueQuarterDef = GameInfo.UniqueQuarters.lookup(uniqueQuarterType);
      if (uniqueQuarterDef) {
        const buildingOneDef = GameInfo.Constructibles.lookup(uniqueQuarterDef.BuildingType1);
        const buildingTwoDef = GameInfo.Constructibles.lookup(uniqueQuarterDef.BuildingType2);
        const unlocksGreatPeople = [];
        const playerUnits = Players.Units.get(playerId);
        if (playerUnits) {
          GameInfo.GreatPersonClasses.forEach((greatPersonClass) => {
            if (greatPersonClass.UniqueQuarterType !== uniqueQuarterDef?.UniqueQuarterType) return;
            const greatPersonUnitDef = GameInfo.Units.lookup(greatPersonClass.UnitType);
            if (greatPersonUnitDef && playerUnits.canEverTrain(greatPersonClass.UnitType)) {
              const unitName = greatPersonUnitDef.Description ? `[TIP:${greatPersonUnitDef.Description}]{${greatPersonUnitDef.Name}}[/TIP]` : greatPersonUnitDef.Name;
              unlocksGreatPeople.push([greatPersonUnitDef.UnitType, unitName]);
            }
          });
        }
        if (unlocksGreatPeople.length > 0) {
          uniqueQuarterDef = { ...uniqueQuarterDef };
          uniqueQuarterDef.Description = `{${uniqueQuarterDef.Description}}`;
          for (const unitStrings of unlocksGreatPeople) {
            uniqueQuarterDef.Description += `[nn]` + Locale.compose("LOC_UI_PRODUCTION_ALLOWS_TRAINING", ...unitStrings);
          }
        }
        if (!buildingOneDef || !buildingTwoDef) {
          console.error(
            `GetUniqueQuartersForPlayer: Failed to get building definitions for UniqueQuarterDefinition: ${uniqueQuarterDef.Name}`
          );
        } else {
          uniqueQuarters.push({
            uniqueQuarterDef,
            buildingOneDef,
            buildingTwoDef
          });
        }
      }
    }
  }
  return uniqueQuarters;
};
const GetNumUniqueQuarterBuildingsCompleted = (city, uq) => {
  const buildingOneCompleted = !!city.Constructibles?.hasConstructible(uq.BuildingType1, false);
  const buildingTwoCompleted = !!city.Constructibles?.hasConstructible(uq.BuildingType2, false);
  return buildingOneCompleted && buildingTwoCompleted ? 2 : buildingOneCompleted || buildingTwoCompleted ? 1 : 0;
};
const ShouldShowUniqueQuarter = (...results) => {
  const allCompleted = results.every((result) => result.AlreadyExists);
  if (allCompleted) {
    return false;
  }
  return results.some((result) => {
    return result.Success || result.InQueue || result.InProgress || result.InsufficientFunds || result.AlreadyExists;
  });
};
const GetProductionItems = (city, recommendations, playerGoldBalance, isPurchase, viewHidden, uniqueQuarterInfos) => {
  const items = {
    ["buildings" /* BUILDINGS */]: [],
    ["wonders" /* WONDERS */]: [],
    ["units" /* UNITS */]: getUnits(city, playerGoldBalance, isPurchase, recommendations, viewHidden),
    ["projects" /* PROJECTS */]: getProjectItems(city, isPurchase)
  };
  if (!city) {
    console.error(`GetProductionItems: received a null/undefined city!`);
    return items;
  }
  // Change Capital: offer "Make Capital" as a project row on any of the player's own
  // non-capital settlements. showCost/showTurns are false because this screen only knows how
  // to render a Production-turns or a Gold cost, and this one is paid in Influence instead -
  // the amount is stated in the description text (with the right yield icon) rather than the
  // cost badge.
  if (typeof GameContext !== "undefined" && city.owner === GameContext.localPlayerID && !city.isCapital) {
    items["projects" /* PROJECTS */].push({
      name: changeCapitalLoc("LOC_CHANGE_CAPITAL_PROJECT_NAME"),
      description: changeCapitalLoc("LOC_CHANGE_CAPITAL_PROJECT_DESCRIPTION", changeCapitalCurrentCost()),
      type: CHANGE_CAPITAL_PROJECT_TYPE,
      cost: 0,
      turns: 0,
      category: "projects" /* PROJECTS */,
      showTurns: false,
      showCost: false,
      insufficientFunds: false,
      disabled: false
    });
  }
  let results;
  if (isPurchase) {
    results = Game.CityCommands.canStartQuery(city.id, CityCommandTypes.PURCHASE, CityQueryType.Constructible);
  } else {
    results = Game.CityOperations.canStartQuery(city.id, CityOperationTypes.BUILD, CityQueryType.Constructible);
  }
  const uniqueBuildingMap = /* @__PURE__ */ new Map();
  for (const uniqueQuarterInfo of uniqueQuarterInfos) {
    let uqBuildingOneResult = results.find(
      ({ index }) => index === uniqueQuarterInfo.buildingOneDef.$index
    )?.result;
    let uqBuildingTwoResult = results.find(
      ({ index }) => index === uniqueQuarterInfo.buildingTwoDef.$index
    )?.result;
    if (!uqBuildingOneResult) {
      uqBuildingOneResult = isPurchase ? Game.CityCommands.canStart(
        city.id,
        CityCommandTypes.PURCHASE,
        { ConstructibleType: uniqueQuarterInfo.buildingOneDef.$index },
        false
      ) : Game.CityOperations.canStart(
        city.id,
        CityOperationTypes.BUILD,
        { ConstructibleType: uniqueQuarterInfo.buildingOneDef.$index },
        false
      );
    }
    if (!uqBuildingTwoResult) {
      uqBuildingTwoResult = isPurchase ? Game.CityCommands.canStart(
        city.id,
        CityCommandTypes.PURCHASE,
        { ConstructibleType: uniqueQuarterInfo.buildingTwoDef.$index },
        false
      ) : Game.CityOperations.canStart(
        city.id,
        CityOperationTypes.BUILD,
        { ConstructibleType: uniqueQuarterInfo.buildingTwoDef.$index },
        false
      );
    }
    results.push({ index: uniqueQuarterInfo.buildingOneDef.$index, result: uqBuildingOneResult });
    results.push({ index: uniqueQuarterInfo.buildingTwoDef.$index, result: uqBuildingTwoResult });
    const shouldShow = viewHidden || !ShouldShowUniqueQuarter(uqBuildingOneResult, uqBuildingTwoResult);
    uniqueBuildingMap.set(uniqueQuarterInfo.buildingOneDef.ConstructibleType, {
      type: uniqueQuarterInfo.buildingOneDef.ConstructibleType,
      showBuilding: shouldShow
    });
    uniqueBuildingMap.set(uniqueQuarterInfo.buildingTwoDef.ConstructibleType, {
      type: uniqueQuarterInfo.buildingTwoDef.ConstructibleType,
      showBuilding: shouldShow
    });
  }
  results.sort((a, b) => {
    return a.index - b.index;
  });
  let repairableItemCount = 0;
  let repairableTotalCost = 0;
  let repairableTotalTurns = 0;
  const repairItems = [];
  const infoDisplayType = Configuration.getUser().productionPanelBuildingInfoType;
  for (const { index, result } of results) {
    const definition = GameInfo.Constructibles.lookup(index);
    if (!definition) {
      console.error(`GetProductionItems: Failed to find ConstructibleDefinition for ConstructibleType: ${index}`);
      continue;
    }
    const uniqueBuilding = uniqueBuildingMap.get(definition.ConstructibleType);
    const showIfAvailable = uniqueBuilding ? uniqueBuilding.showBuilding && viewHidden : viewHidden;
    const data = GetConstructibleItemData({
      constructible: definition,
      city,
      operationResult: result,
      hideIfUnavailable: !showIfAvailable,
      infoDisplayType
    });
    if (!data) {
      continue;
    }
	if (data.category == "projects" && isPurchase){
		continue; //如果是项目类（迁移）而且在购买界面，就隐藏条目，防止BUG
	}
    if (!repairItems.find((item) => item.type == data.type)) {
      if (result.RepairDamaged && result.Plots && result.Plots.length > 1) {
        const numberOfPlots = result.Plots.length;
        repairableItemCount += numberOfPlots;
        repairableTotalCost += data.cost * numberOfPlots;
        repairableTotalTurns += data.turns * numberOfPlots;
        repairItems.push(data);
      } else {
        if (data.repairDamaged) {
          repairableItemCount++;
          repairableTotalCost += data.cost;
          repairableTotalTurns += data.turns;
          repairItems.push(data);
        }
      }
      data.recommendations = AdvisorUtilities.getBuildRecommendationIcons(recommendations, data.type);
      items[data.category].push(data);
    }
  }
  if (repairableItemCount > 1) {
    const repairAllItem = createRepairAllProductionChooserItemData(
      repairableTotalCost,
      repairableTotalTurns,
      isPurchase
    );
    if (repairAllItem) {
      items.buildings.unshift(repairAllItem);
    }
  }
  return items;
};
const createRepairAllProductionChooserItemData = (cost, turns, isPurchase) => {
  const localPlayer = Players.get(GameContext.localPlayerID);
  if (!localPlayer) {
    console.error(
      `production-chooser-helper: Failed to retrieve PlayerLibrary for Player ${GameContext.localPlayerID}`
    );
    return null;
  }
  const isInsufficientFunds = isPurchase && cost > (localPlayer.Treasury?.goldBalance || 0);
  return {
    type: "IMPROVEMENT_REPAIR_ALL",
    category: "buildings" /* BUILDINGS */,
    name: "LOC_UI_PRODUCTION_REPAIR_ALL",
    description: "LOC_UI_PRODUCTION_REPAIR_ALL_DESCRIPTION",
    cost,
    turns,
    showTurns: turns > -1,
    showCost: cost > 0,
    insufficientFunds: isInsufficientFunds,
    error: isInsufficientFunds ? "LOC_CITY_PURCHASE_INSUFFICIENT_FUNDS" : void 0,
    disabled: isInsufficientFunds
  };
};
const getConstructibleClassPanelCategory = (constructibleClass) => {
  switch (constructibleClass) {
    case "IMPROVEMENT":
      return "buildings" /* BUILDINGS */;
    case "WONDER":
      return "wonders" /* WONDERS */;
    default:
      return "buildings" /* BUILDINGS */;
  }
};
const getUnits = (city, playerGoldBalance, isPurchase, recommendations, viewHidden) => {
  const units = [];
  if (!city?.Gold) {
    console.error(`getUnits: received a null/undefined city`);
    return units;
  }
  const cityGoldLibrary = city.Gold;
  let results;
  if (isPurchase) {
    results = Game.CityCommands.canStartQuery(city.id, CityCommandTypes.PURCHASE, CityQueryType.Unit);
  } else {
    results = Game.CityOperations.canStartQuery(city.id, CityOperationTypes.BUILD, CityQueryType.Unit);
  }
  for (const { index, result } of results) {
    if (!viewHidden && !result.Success && !(result.InsufficientFunds && result.FailureReasons?.length == 1)) {
      continue;
    }
    if (result.Requirements?.FullFailure || result.Requirements?.Obsolete) {
      continue;
    }
    const definition = GameInfo.Units.lookup(index);
    if (!definition) {
      console.error(`getUnits: Failed to find UnitDefinition for UnitType: ${index}`);
      continue;
    }
    const cost = cityGoldLibrary.getUnitPurchaseCost(YieldTypes.YIELD_GOLD, definition.UnitType);
    const secondaryDetails = GetSecondaryDetailsHTML(GetUnitStatsFromDefinition(definition));
    const turns = isPurchase ? -1 : city.BuildQueue.getTurnsLeft(definition.UnitType) ?? -1;
    const data = {
      name: definition.Name,
      type: definition.UnitType,
      ageless: false,
      cost,
      turns,
      showTurns: false,
      showCost: cost > 0,
      insufficientFunds: cost > playerGoldBalance,
      disabled: !result.Success,
      category: "units" /* UNITS */,
      secondaryDetails
    };
    if (result.Requirements?.MeetsRequirements) {
      data.recommendations = AdvisorUtilities.getBuildRecommendationIcons(recommendations, data.type);
    }
    if (result.Requirements?.NeededProgressionTreeNode) {
      const nodeInfo = GameInfo.ProgressionTreeNodes.lookup(result.Requirements.NeededProgressionTreeNode);
      if (nodeInfo) {
        data.error = Locale.compose("LOC_UI_PRODUCTION_REQUIRES", nodeInfo.Name);
      }
    }
    if (result.Requirements?.NeededPopulation) {
      data.error = Locale.compose("LOC_UI_PRODUCTION_REQUIRES_POPULATION", result.Requirements.NeededPopulation);
    }
    if (result.FailureReasons) {
      data.error = result.FailureReasons.join("\n");
    }
    units.push(data);
  }
  return units;
};
const Construct = (city, item, isPurchase) => {
  if (item.type === CHANGE_CAPITAL_PROJECT_TYPE) {
    changeCapitalConfirmAndRelocate(city);
    return false;
  }
  const typeInfo = GameInfo.Types.lookup(item.type);
  if (typeInfo) {
    let args;
    switch (typeInfo.Kind) {
      case "KIND_CONSTRUCTIBLE":
        args = {
          ConstructibleType: typeInfo.Hash
        };
        break;
      case "KIND_UNIT":
        args = {
          UnitType: typeInfo.Hash
        };
        break;
      case "KIND_PROJECT":
        args = {
          ProjectType: typeInfo.Hash
        };
        break;
      default:
        console.error(`Construct: Constructing unsupported kind ${typeInfo.Kind}.`);
        return false;
    }
    let result;
    if (isPurchase && typeInfo.Kind != "KIND_PROJECT") {
      result = Game.CityCommands.canStart(city.id, CityCommandTypes.PURCHASE, args, false);
    } else {
      result = Game.CityOperations.canStart(city.id, CityOperationTypes.BUILD, args, false);
    }
    if (result.Success) {
      if (item.interfaceMode && !result.InProgress) {
        InterfaceMode.switchTo(item.interfaceMode, {
          CityID: city.id,
          OperationArguments: args,
          IsPurchasing: isPurchase
        });
        return false;
      } else {
        if (result.InProgress && result.Plots) {
          const loc = GameplayMap.getLocationFromIndex(result.Plots[0]);
          args.X = loc.x;
          args.Y = loc.y;
        }
        if (isPurchase && typeInfo.Kind != "KIND_PROJECT") {
          Game.CityCommands.sendRequest(city.id, CityCommandTypes.PURCHASE, args);
        } else {
          if (typeInfo.Kind == "KIND_PROJECT" && city.isTown) {
            args.InsertMode = CityOperationsParametersValues.Exclusive;
          }
          Game.CityOperations.sendRequest(city.id, CityOperationTypes.BUILD, args);
        }
        return true;
      }
    }
  } else {
    if (InterfaceMode.isInInterfaceMode("INTERFACEMODE_PLACE_BUILDING")) {
      InterfaceMode.switchToDefault();
    }
    return false;
  }
  return false;
};
const RepairConstruct = (city, item, isPurchase) => {
  const typeInfo = GameInfo.Types.lookup(item.type);
  if (typeInfo) {
    let args;
    switch (typeInfo.Kind) {
      case "KIND_CONSTRUCTIBLE":
        args = {
          ConstructibleType: typeInfo.Hash
        };
        break;
      case "KIND_UNIT":
        args = {
          UnitType: typeInfo.Hash
        };
        break;
      case "KIND_PROJECT":
        args = {
          ProjectType: typeInfo.Hash
        };
        break;
      default:
        console.error(`Construct: Constructing unsupported kind ${typeInfo.Kind}.`);
        return;
    }
    let result;
    if (isPurchase) {
      result = Game.CityCommands.canStart(city.id, CityCommandTypes.PURCHASE, args, false);
    } else {
      result = Game.CityOperations.canStart(city.id, CityOperationTypes.BUILD, args, false);
    }
    if (result.Success) {
      if (result.Plots) {
        result.Plots.forEach((plot) => {
          const loc = GameplayMap.getLocationFromIndex(plot);
          args.X = loc.x;
          args.Y = loc.y;
          if (isPurchase) {
            Game.CityCommands.sendRequest(city.id, CityCommandTypes.PURCHASE, args);
          } else {
            Game.CityOperations.sendRequest(city.id, CityOperationTypes.BUILD, args);
          }
        });
      }
    }
  }
};
const GetCityBuildReccomendations = (city) => {
  if (!city) return [];
  const recommendationParams = {
    cityId: city.id,
    subject: AdvisorySubjectTypes.PRODUCTION,
    maxReturnedEntries: 0
  };
  return Players.Advisory.get(city.owner)?.getBuildRecommendations(recommendationParams) ?? [];
};
const GetTownFocusItems = (cityID) => {
  const projects = [];
  projects.push({
    name: "LOC_UI_FOOD_CHOOSER_FOCUS_GROWTH",
    description: "LOC_PROJECT_TOWN_FOOD_INCREASE_DESCRIPTION",
    growthType: GrowthTypes.EXPAND,
    projectType: ProjectTypes.NO_PROJECT,
    tooltipDescription: "LOC_PROJECT_TOWN_FOOD_INCREASE_TOOLTIP_DESCRIPTION"
  });
  const resultsTax = Game.CityCommands.canStart(
    cityID,
    CityCommandTypes.CHANGE_GROWTH_MODE,
    { Type: GrowthTypes.PROJECT },
    false
  );
  resultsTax.Projects?.forEach((ID) => {
    const projectInfo = GameInfo.Projects.lookup(ID);
    if (projectInfo) {
      projects.push({
        name: projectInfo.Name,
        description: projectInfo.Description,
        growthType: GrowthTypes.PROJECT,
        projectType: projectInfo.$hash,
        tooltipDescription: "LOC_PROJECT_DEFAULT_TOOLTIP_DESCRIPTION"
      });
    }
  });
  return projects;
};
const isSelectedFocusItem = (currentGrowthType, currentProjectType, item) => {
  return currentGrowthType === GrowthTypes.PROJECT ? currentProjectType === item.projectType : currentGrowthType === item.growthType;
};
const GetCurrentTownFocus = (cityID, currentGrowthType, currentProjectType) => {
  const focusProjects = GetTownFocusItems(cityID);
  const currentFocus = focusProjects.find((item) => isSelectedFocusItem(currentGrowthType, currentProjectType, item)) ?? null;
  return currentFocus;
};
const SetTownFocus = (cityID, sType, projectType) => {
  const args = {
    Type: parseInt(sType),
    ProjectType: parseInt(projectType),
    City: cityID.id
  };
  const result = Game.CityCommands.canStart(cityID, CityCommandTypes.CHANGE_GROWTH_MODE, args, false);
  if (result.Success) {
    Game.CityCommands.sendRequest(cityID, CityCommandTypes.CHANGE_GROWTH_MODE, args);
    Audio.playSound("data-audio-activate", projectType);
    return null;
  } else {
    return result;
  }
};
const GetTownFocusBlp = (growthType, projectType) => {
  growthType = typeof growthType === "string" ? parseInt(growthType) : growthType;
  projectType = typeof projectType === "string" ? parseInt(projectType) : projectType;
  let iconBlp = UI.getIconBLP("DEFAULT_PROJECT");
  if (growthType != null && growthType === GrowthTypes.EXPAND) {
    iconBlp = UI.getIconBLP("PROJECT_GROWTH");
  }
  if (projectType != null && projectType !== ProjectTypes.NO_PROJECT) {
    const projectTypeName = GameInfo.Projects.lookup(projectType)?.ProjectType;
    if (projectTypeName) {
      iconBlp = UI.getIconBLP(projectTypeName);
    }
  }
  return iconBlp;
};
const GetLastProductionData = (cityID) => {
  const city = Cities.get(cityID);
  if (!city) {
    console.error(`production-chooser-helper: GetLastProductionData failed to get city for ID ${cityID}`);
    return;
  }
  const buildQueue = city.BuildQueue;
  if (!buildQueue) {
    console.error(`production-chooser-helper: GetLastProductionData failed to get build queue for ID ${cityID}`);
    return;
  }
  const lastTypeHash = buildQueue.previousProductionTypeHash;
  if (lastTypeHash == 0) {
    return;
  }
  const constructibles = city.Constructibles;
  if (!constructibles) {
    console.error(`production-chooser-helper: GetLastProductionData failed to get constructible for ID ${cityID}`);
    return;
  }
  const ids = constructibles.getIdsOfType(lastTypeHash);
  if (ids.length > 0) {
    const lastCompletedID = ids[0];
    const lastCompleted = Constructibles.getByComponentID(lastCompletedID);
    if (lastCompleted) {
      const lastDefinition = GameInfo.Constructibles.lookup(lastCompleted.type);
      if (lastDefinition) {
        const yields = [];
        if (lastDefinition.ConstructibleClass == "BUILDING") {
          for (const district of CityDetails.buildings) {
            for (const building of district.constructibleData) {
              if (ComponentID.isMatch(building.id, lastCompletedID) && building.yieldMap) {
                for (const yieldData of building.yieldMap) {
                  yields.push({
                    icon: yieldData[0],
                    value: Locale.compose(
                      "LOC_UI_CITY_DETAILS_YIELD_ONE_DECIMAL",
                      yieldData[1].value
                    )
                  });
                }
                break;
              }
            }
          }
        } else if (lastDefinition.ConstructibleClass == "WONDER") {
          for (const wonder of CityDetails.wonders) {
            if (ComponentID.isMatch(wonder.id, lastCompletedID) && wonder.yieldMap) {
              for (const yieldData of wonder.yieldMap) {
                yields.push({
                  icon: yieldData[0],
                  value: Locale.compose("LOC_UI_CITY_DETAILS_YIELD_ONE_DECIMAL", yieldData[1].value)
                });
              }
              break;
            }
          }
        }
        const data = {
          typeHash: lastTypeHash,
          name: lastDefinition.Name,
          type: lastDefinition.ConstructibleType,
          isUnit: false,
          details: yields
        };
        return data;
      }
    }
  }
  const unitDefinition = GameInfo.Units.lookup(lastTypeHash);
  if (unitDefinition) {
    const data = {
      typeHash: lastTypeHash,
      name: unitDefinition.Name,
      type: unitDefinition.UnitType,
      isUnit: true,
      details: []
    };
    const unitStats = GetUnitStatsFromDefinition(unitDefinition);
    for (const stat of unitStats) {
      data.details.push({ icon: stat.icon, value: stat.value });
    }
    return data;
  }
  console.error(
    `production-chooser-helper: GetLastProductionData failed to return valid last production data for city ID ${cityID}`
  );
  return;
};

export { CanPlayerUnlockNode, Construct, CreateProductionChooserItem, GetCityBuildReccomendations, GetConstructibleItemData, GetCurrentBestTotalYieldForConstructible, GetCurrentTownFocus, GetLastProductionData, GetNextCityID, GetNumUniqueQuarterBuildingsCompleted, GetPrevCityID, GetProductionItems, GetSecondaryDetailsHTML, GetTownFocusBlp, GetTownFocusItems, GetUniqueQuartersForPlayer, GetUnitStatsFromDefinition, ProductionPanelCategory, RepairConstruct, SelectNextCity, SelectPrevCity, SetTownFocus, ShouldShowUniqueQuarter };
//# sourceMappingURL=production-chooser-helpers.js.map
