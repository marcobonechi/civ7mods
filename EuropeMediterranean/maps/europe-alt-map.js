// europe-alt-map.js
// Map script: Europe & Mediterranean (Variant).
//
// Reads its own geography from europe-alt-geo.js, so edits there change only this map. It shares
// the generator with the two Large maps (europe-large-core.js); a change to that file affects all
// three. To fork the generator too, copy it and point initEuropeLargeMap here at the copy.

import { GEO } from '/europe-mediterranean-map/maps/europe-alt-geo.js';
import { initEuropeLargeMap } from '/europe-mediterranean-map/maps/europe-large-core.js';

console.log("Loading europe-alt-map.js (variant)");
initEuropeLargeMap(GEO, "variant");
