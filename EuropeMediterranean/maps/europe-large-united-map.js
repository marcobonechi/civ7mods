// europe-large-united-map.js
// Map script: Europe, Mediterranean & Sahel (Large) - One Landmass.
//
// Same geography as europe-large-map.js, read from the same europe-large-geo.js, with no Distant
// Lands: oneLandmassGeo (europe-raster.js) puts every landmass in one region and leaves out the
// channels that exist only to separate them - the Karelian passage, so Finland joins Russia, and
// the Palestine channel, so Egypt joins the Levant over Sinai. No civilization is gated behind the
// Exploration Age and a land route exists to everyone reachable on foot. The trade-off is that the
// Exploration Age Economic (treasure fleet) and Military legacy paths cannot score, since both
// require distant lands.

import { GEO } from '/europe-mediterranean-map/maps/europe-large-geo.js';
import { oneLandmassGeo } from '/europe-mediterranean-map/maps/europe-raster.js';
import { initEuropeLargeMap } from '/europe-mediterranean-map/maps/europe-large-core.js';

console.log("Loading europe-large-united-map.js (one landmass)");
initEuropeLargeMap(oneLandmassGeo(GEO), "one-landmass");
