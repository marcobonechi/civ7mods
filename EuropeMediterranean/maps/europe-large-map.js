// europe-large-map.js
// Map script: Europe, Mediterranean & Sahel (Large) - Distant Lands variant.
//
// Africa is a separate landmass region, so it counts as Distant Lands: the Mediterranean and the
// Suez channel separate it from Eurasia, Egypt/Carthage/Aksum/Songhai start there, and the
// Exploration Age treasure-fleet and distant-lands mechanics work as the base game intends.
// For a version where every civilization is reachable overland see europe-large-united-map.js.

import { GEO } from '/europe-mediterranean-map/maps/europe-large-geo.js';
import { initEuropeLargeMap } from '/europe-mediterranean-map/maps/europe-large-core.js';

console.log("Loading europe-large-map.js (distant lands)");
initEuropeLargeMap(GEO, "distant-lands");
