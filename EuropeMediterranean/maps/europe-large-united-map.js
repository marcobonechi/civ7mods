// europe-large-united-map.js
// Map script: Europe, Mediterranean & Sahel (Large) - One Landmass variant.
//
// Same geography as europe-large-map.js, but with no Distant Lands: every landmass shares one
// region, so no civilization is gated behind the Exploration Age and a land route exists to
// everyone reachable on foot. The trade-off is that the Exploration Age Economic (treasure
// fleet) and Military legacy paths cannot score, since both require distant lands.

import { GEO as BASE } from '/europe-mediterranean-map/maps/europe-large-geo.js';
import { initEuropeLargeMap } from '/europe-mediterranean-map/maps/europe-large-core.js';

console.log("Loading europe-large-united-map.js (one landmass)");
initEuropeLargeMap({ ...BASE, distantLandsAnchors: [] }, "one-landmass");
