// europe-alt-distant-map.js
// Map script: Eurasia Compressed (Distant Lands).
//
// The same geography as Eurasia Compressed (maps/europe-alt-geo.js, read unchanged), with its
// Distant Lands anchors in force: East Asia, Scandinavia with Finland, and Iceland lie across the
// water as Distant Lands, reached in the Exploration Age; Africa and the rest are home lands. One
// geography file serves both maps, so an edit there reaches both.

import { GEO } from '/europe-mediterranean-map/maps/europe-alt-geo.js';
import { initEuropeLargeMap } from '/europe-mediterranean-map/maps/europe-large-core.js';

console.log("Loading europe-alt-distant-map.js (Eurasia Compressed, distant lands)");
initEuropeLargeMap(GEO, "eurasia-compressed-distant-lands");
