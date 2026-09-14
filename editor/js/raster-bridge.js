// raster-bridge.js
// Exposes the mod's real rasterizer to the editor's classic scripts.
//
// The editor used to carry its own copy of the rasterizer, which drifted badly:
// by the time this was written it was missing narrowStraits, the connected-landmass
// region assignment, flatAreas, hillAreas, lowAreas, roughAreas, passes and
// shallowLines - so the canvas drew a map the game would never generate. Importing
// the live module means the editor can only ever be as wrong as the mod itself.

import * as R from '/maps/europe-raster.js';

window.CivRasterizer = R;
window.dispatchEvent(new Event('civ-raster-ready'));
