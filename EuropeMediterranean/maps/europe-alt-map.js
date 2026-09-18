// europe-alt-map.js
// Map script: Eurasia Compressed (the map picker name; the files keep their europe-alt names).
//
// Europe, the Mediterranean and Africa with Russia and the Caspian turned into an Eastern Ocean and
// China, Korea, Mongolia and Japan beyond it (maps/europe-alt-geo.js). No Distant Lands: the
// geography goes through oneLandmassGeo, so every landmass is one region, and East Asia is simply
// across the sea. Its twin, europe-alt-distant-map.js, reads the same file with East Asia,
// Scandinavia and Iceland as Distant Lands.

import { GEO } from '/europe-mediterranean-map/maps/europe-alt-geo.js';
import { oneLandmassGeo } from '/europe-mediterranean-map/maps/europe-raster.js';
import { initEuropeLargeMap } from '/europe-mediterranean-map/maps/europe-large-core.js';

console.log("Loading europe-alt-map.js (Eurasia Compressed)");
initEuropeLargeMap(oneLandmassGeo(GEO), "eurasia-compressed");
