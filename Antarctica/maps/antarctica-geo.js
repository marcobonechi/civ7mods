// antarctica-geo.js
// The Antarctica map's geography, and the rasterizer that turns it into a hex grid. Pure
// JavaScript with no engine calls, so tools/antarctica-preview.mjs (and antarctica-check.mjs) build
// exactly the grid the game does.
//
// Layout: the map is a south polar view. Antarctica sits in the middle in a true polar
// (azimuthal equidistant) projection, Greenwich up and 90E to the right, as on any Antarctic map.
// The four Distant Lands sit in the corners, each in its own local projection, turned so its
// north points away from the pole the way it does on a real polar map, and cut off where it runs
// into the top or bottom edge:
//   South America upper left (Cape Horn facing the Antarctic Peninsula across the Drake Passage)
//   Southern Africa upper right, Australia lower right (upside down, Tasmania towards the pole),
//   New Zealand lower left (enlarged, so it is worth sailing to).
//
// Coordinates: a "canvas" frame with the map centre at 0,0, y up (north on screen), and half the
// map height equal to 1. One hex is 1 / halfH canvas units wide.

export const T = { OCEAN: 0, COAST: 1, FLAT: 2, HILL: 3, MOUNTAIN: 4, LAKE: 5 };
export const B = { MARINE: 0, GRASSLAND: 1, PLAINS: 2, DESERT: 3, TUNDRA: 4, TROPICAL: 5 };
export const REGION = { NONE: 0, HOME: 1, DISTANT: 2 };

// The coastal band of Antarctica that is free of ice, in hexes from the sea. Every start is in it.
export const BAND_DEPTH = 4;

// Grid per map size, all with the same aspect (width / height in hex units about 1.56).
export const SIZES = {
    MAPSIZE_ANTARCTICA_STD: [108, 80],
    MAPSIZE_ANTARCTICA_LRG: [124, 92],
    MAPSIZE_ANTARCTICA_HUGE: [138, 102],
};

const D2R = Math.PI / 180;
const SQ3 = Math.sqrt(3) / 2;

// ---- hex helpers (rows count upwards, odd rows sit half a hex to the east) -------------------

export function hexNeighbors(x, y) {
    if (y & 1) return [[x + 1, y], [x - 1, y], [x + 1, y + 1], [x, y + 1], [x + 1, y - 1], [x, y - 1]];
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x - 1, y + 1], [x, y - 1], [x - 1, y - 1]];
}

export function hexDistance(x1, y1, x2, y2) {
    const q1 = x1 - (y1 - (y1 & 1)) / 2, q2 = x2 - (y2 - (y2 & 1)) / 2;
    const dq = q1 - q2, dr = y1 - y2, ds = (-q1 - y1) - (-q2 - y2);
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

// The engine's DirectionTypes name for the neighbour `to` of (x, y).
export function directionName(x, y, to) {
    const [tx, ty] = to;
    const eastShift = (y & 1) ? 1 : 0;
    if (ty === y) return tx > x ? "DIRECTION_EAST" : "DIRECTION_WEST";
    const east = tx - x === eastShift;
    if (ty === y + 1) return east ? "DIRECTION_NORTHEAST" : "DIRECTION_NORTHWEST";
    return east ? "DIRECTION_SOUTHEAST" : "DIRECTION_SOUTHWEST";
}

// ---- projections ----------------------------------------------------------------------------

// Antarctica: azimuthal equidistant around the South Pole. k = canvas units per degree of arc.
const POLAR = { k: 0.031, rot: 0 };

function polarFrame() {
    return {
        toCanvas(lon, lat) {
            const r = 90 + lat, b = (lon + POLAR.rot) * D2R;
            return [POLAR.k * r * Math.sin(b), POLAR.k * r * Math.cos(b)];
        },
        fromCanvas(X, Y) {
            let lon = Math.atan2(X, Y) / D2R - POLAR.rot;
            if (lon > 180) lon -= 360;
            if (lon < -180) lon += 360;
            return [lon, Math.hypot(X, Y) / POLAR.k - 90];
        },
    };
}

// A Distant Land: a local equirectangular projection around (lon0, lat0), scaled by k, turned
// by rot degrees (counter-clockwise) and centred at canvas point `at`.
function localFrame(lon0, lat0, at, k, rotDeg) {
    const cl = Math.cos(lat0 * D2R), c = Math.cos(rotDeg * D2R), s = Math.sin(rotDeg * D2R);
    return {
        toCanvas(lon, lat) {
            const x = (lon - lon0) * cl, y = lat - lat0;
            return [at[0] + k * (x * c - y * s), at[1] + k * (x * s + y * c)];
        },
        fromCanvas(X, Y) {
            const u = (X - at[0]) / k, v = (Y - at[1]) / k;
            const x = u * c + v * s, y = -u * s + v * c;
            return [lon0 + x / cl, lat0 + y];
        },
    };
}

// ---- the geography --------------------------------------------------------------------------
// Outlines are [lon, lat] rings. Ranges are polylines (w = half width in hexes; m = chance of a
// mountain inside it, h = chance of a hill). Rivers run from source to mouth (nav = how many hexes
// above the mouth are navigable). Lakes are [lon, lat] points with a size in hexes.

const ANTARCTICA = {
    id: "antarctica",
    frame: polarFrame(),
    region: REGION.HOME,
    polys: [[
        [-10, -71.2], [0, -70.2], [8, -70.0], [15, -69.9], [22, -70.2], [30, -69.6], [34, -68.8],
        [39, -69.4], [40, -68.3], [45, -67.8], [50, -66.6], [53, -65.9], [58, -67.2], [63, -67.5],
        [67, -67.7], [69, -68.5], [70.5, -69.9], [72.5, -70.1], [74, -69.2], [77, -69.4], [80, -68.0],
        [85, -66.8], [90, -66.5], [95, -66.2], [100, -65.3], [103, -65.6], [108, -66.4], [112, -66.0],
        [117, -66.8], [122, -66.4], [128, -66.1], [134, -66.3], [140, -66.7], [145, -67.2],
        [150, -68.3], [155, -69.0], [160, -69.8], [164, -70.6], [170, -71.3], [170.5, -72.5],
        [169, -73.8], [166, -74.5], [164.5, -75.5], [163, -76.6], [164, -77.2], [167, -77.3],
        // Ross Ice Shelf front
        [169.5, -77.6], [175, -78.0], [180, -78.2], [-175, -78.4], [-170, -78.5], [-165, -78.3],
        [-160, -77.9], [-157, -77.2], [-152, -76.8], [-148, -76.0], [-142, -75.3], [-136, -74.6],
        [-130, -74.2], [-124, -73.8], [-118, -74.0], [-112, -74.6], [-106, -74.8], [-101, -74.2],
        [-98, -73.2], [-94, -72.6], [-89, -72.6], [-84, -73.2], [-79, -73.1], [-75, -72.8],
        // the Antarctic Peninsula, up its west coast and down its east coast
        [-72, -71.8], [-70.5, -69.5], [-68.3, -67.8], [-66.5, -66.3], [-64.5, -65.0], [-62, -64.0],
        [-59.5, -63.4], [-57, -63.2], [-56.5, -63.7], [-58.2, -64.5], [-60.2, -65.5], [-61.5, -67.2],
        [-61.8, -69.5], [-61.5, -71.5], [-61.0, -73.5], [-60.0, -74.8],
        // Ronne and Filchner Ice Shelf fronts, Coats Land
        [-55, -76.0], [-50, -77.2], [-47, -77.8], [-42, -77.9], [-37, -77.8], [-34, -77.2],
        [-30, -76.5], [-26, -75.3], [-22, -74.2], [-17, -73.2], [-13, -72.1],
    ]],
    ranges: [
        // Transantarctic Mountains: Cape Adare, Victoria Land, the Beardmore, across the pole,
        // the Horlick and Pensacola ranges, the Shackleton Range, ending at Coats Land
        { name: "Transantarctic", w: 1.2, m: 0.55, h: 0.9, pts: [[170, -71.8], [166, -73.5], [162, -75.5], [160, -78], [163, -81], [168, -83.5], [180, -85], [-150, -86.3], [-115, -86], [-90, -84.8], [-65, -83.3], [-40, -81], [-28, -80]] },
        { name: "Ellsworth", w: 1.0, m: 0.75, h: 0.9, pts: [[-88, -80.5], [-86, -79], [-84.5, -77.5]] },
        { name: "Peninsula spine", w: 0.8, m: 0.5, h: 0.9, pts: [[-66, -72.5], [-65, -69.5], [-63, -67], [-60.5, -65], [-58, -63.6]] },
        { name: "Queen Maud Land", w: 0.9, m: 0.45, h: 0.8, pts: [[-5, -72.5], [5, -72], [15, -72], [25, -72.2], [35, -72.3]] },
        { name: "Prince Charles", w: 0.8, m: 0.6, h: 0.9, pts: [[62, -74], [64, -72.5], [67, -71]] },
        { name: "Gamburtsev", w: 1.4, m: 0.1, h: 0.75, pts: [[65, -79.5], [75, -80.2], [88, -79.5]] },
        { name: "Marie Byrd Land", w: 1.0, m: 0.3, h: 0.8, pts: [[-140, -76], [-132, -76.3], [-124, -76.5], [-116, -76.2]] },
        { name: "Dronning Maud plateau", w: 1.5, m: 0.0, h: 0.5, pts: [[0, -76], [30, -77], [50, -75]] },
    ],
    volcanoes: [
        { name: "Mount Erebus", lon: 166.9, lat: -77.3 },
        { name: "Mount Sidley", lon: -126.4, lat: -77.0 },
    ],
    // Rivers under and on the ice. The Onyx is the one real surface river (it runs inland, into
    // Lake Vanda in the Dry Valleys); the others follow the subglacial drainage the radar surveys
    // found: the Lambert Glacier into Prydz Bay, the 460 km river under the Institute Ice Stream
    // into the Weddell Sea, Recovery Glacier, the Adventure Trench flood through the Byrd Glacier,
    // the Siple Coast lakes under the Whillans Ice Stream, and the old river valleys under the
    // Totten and Denman glaciers and Pine Island Bay.
    rivers: [
        { name: "Lambert", nav: 5, pts: [[76, -79.5], [72, -76.5], [69.5, -73.8], [70.8, -71.8], [71.5, -69.5]] },
        { name: "Institute", nav: 5, pts: [[-110, -84.6], [-92, -83.2], [-80, -82], [-68, -80.2], [-60, -78.3], [-54, -76.2]] },
        { name: "Recovery", nav: 0, pts: [[15, -82], [-5, -81.5], [-20, -80.8], [-30, -79.5], [-38, -77.8]] },
        { name: "Byrd", nav: 0, pts: [[135, -77], [146, -79], [156, -80.4], [165, -80.2], [174, -78.6], [178, -77.9]] },
        { name: "Whillans", nav: 0, pts: [[-132, -85.8], [-150, -84.5], [-162, -81.5], [-170, -78.4]] },
        { name: "Totten", nav: 0, pts: [[112, -75.5], [114, -71], [116, -67.5], [116.5, -66.5]] },
        { name: "Denman", nav: 0, pts: [[104, -73.5], [100, -69.5], [99.5, -65.8]] },
        { name: "Pine Island", nav: 0, pts: [[-92, -78.3], [-97, -76.2], [-101, -74.0]] },
        { name: "Onyx", nav: 0, toLake: "Vanda", pts: [[163.8, -76.9], [159, -77.4], [154.5, -77.8]] },
    ],
    lakes: [
        { name: "Vanda", lon: 152.5, lat: -77.9, size: 1 },
        { name: "Vostok", lon: 106, lat: -77.3, size: 3 },
    ],
};

const SOUTH_AMERICA = {
    id: "south-america",
    frame: localFrame(-64, -40, [-1.14, 0.7], 0.030, 20),
    region: REGION.DISTANT,
    polys: [
        [
            [-81.2, -5], [-79, -8], [-76.5, -13.5], [-72, -17], [-70.3, -18.5], [-70.5, -23],
            [-71.5, -30], [-73.5, -37], [-73.8, -41.5], [-74.5, -47], [-75.3, -50.5], [-74, -53],
            [-71, -54.5], [-68, -55.5], [-67.3, -55.9], [-65.5, -55], [-68.5, -53], [-69, -51.5],
            [-67.8, -49.5], [-65.8, -47.8], [-67.5, -46], [-65, -45], [-64.5, -42.5], [-62.3, -40.7],
            [-62, -39], [-57.5, -38.2], [-56.7, -36.4], [-57.4, -35.3], [-58.4, -34.5], [-57.8, -34.4],
            [-56.2, -34.9], [-54.9, -34.9], [-53.4, -33.7], [-51, -31], [-48.6, -28], [-48.5, -26],
            [-46.5, -24], [-43.5, -23], [-41, -22], [-40, -19.5], [-39, -17], [-39, -13], [-37, -10.5],
            [-35, -8], [-35.2, -5.5], [-40, -2.9], [-50, 0], [-80, 0],
        ],
        // Falkland Islands
        [[-61.3, -51.3], [-58.2, -51.2], [-57.7, -51.7], [-58.9, -52.3], [-60.8, -52.1]],
    ],
    ranges: [
        { name: "Andes", w: 1.4, m: 0.6, h: 0.9, pts: [[-69, -12], [-69.5, -18], [-68.5, -24], [-69.8, -30], [-70.2, -34], [-71, -38], [-72, -42], [-72.8, -46], [-73.3, -50], [-72.5, -52.5], [-70, -54.6]] },
        { name: "Sierras de Cordoba", w: 0.8, m: 0.1, h: 0.7, pts: [[-64.6, -30], [-64.6, -33]] },
        { name: "Brazilian Highlands", w: 1.6, m: 0.05, h: 0.6, pts: [[-50, -27], [-46, -22], [-43, -19]] },
        { name: "Chilean Coast Range", w: 0.6, m: 0.0, h: 0.6, pts: [[-71.5, -30], [-72.5, -36], [-73.3, -40]] },
    ],
    volcanoes: [{ name: "Villarrica", lon: -71.9, lat: -39.4 }],
    rivers: [
        { name: "Parana", nav: 8, pts: [[-54, -23], [-55.5, -26.5], [-58.5, -27.4], [-60.7, -31.6], [-60.4, -33.3], [-58.8, -34.0], [-58.1, -34.4]] },
        { name: "Uruguay", nav: 0, pts: [[-52, -27.5], [-55, -28.7], [-56.8, -30.6], [-58.1, -33.1], [-58.4, -33.9]] },
        { name: "Salado", nav: 0, pts: [[-65, -24.5], [-62.5, -28], [-60.9, -31.4]] },
        { name: "Colorado", nav: 0, pts: [[-69.8, -36.5], [-66, -38.5], [-62.2, -39.8]] },
        { name: "Negro", nav: 3, pts: [[-70.5, -39.8], [-67.5, -39.3], [-64.8, -40.4], [-62.8, -41.0]] },
        { name: "Chubut", nav: 0, pts: [[-71, -42.5], [-68, -43.6], [-65.1, -43.3]] },
        { name: "Santa Cruz", nav: 0, pts: [[-72.3, -50.2], [-70, -50.1], [-68.4, -50.1]] },
        { name: "Biobio", nav: 0, pts: [[-71.3, -38.3], [-72.5, -37.4], [-73.2, -36.8]] },
    ],
    lakes: [],
    biome(lon, lat, n) {
        const andes = lat > -33 ? -69.6 : lat > -40 ? -70.2 - (lat + 33) * -0.13 : lat > -48 ? -71.5 - (-40 - lat) * 0.18 : -72.8;
        if (lat < -53) return n < 0.55 ? B.TUNDRA : B.PLAINS;
        if (lon < andes - 0.6) {                          // Pacific side of the Andes
            if (lat < -39) return B.GRASSLAND;            // temperate rainforest
            if (lat < -31) return n < 0.6 ? B.PLAINS : B.GRASSLAND;
            return B.DESERT;                              // Atacama
        }
        if (lat < -46) return n < 0.5 ? B.DESERT : (n < 0.8 ? B.PLAINS : B.TUNDRA);   // Patagonian steppe
        if (lat < -38) return n < 0.45 ? B.DESERT : B.PLAINS;
        if (lon < -66 && lat < -26) return n < 0.6 ? B.DESERT : B.PLAINS;           // Monte
        if (lat < -30) return n < 0.65 ? B.GRASSLAND : B.PLAINS;                      // Pampas
        if (lon < -58) return n < 0.6 ? B.PLAINS : B.TROPICAL;                        // Chaco
        if (lat > -24) return n < 0.7 ? B.TROPICAL : B.GRASSLAND;
        return n < 0.55 ? B.GRASSLAND : B.TROPICAL;                                    // Parana forest
    },
};

const AFRICA = {
    id: "africa",
    frame: localFrame(25, -26, [1.13, 0.62], 0.030, -18),
    region: REGION.DISTANT,
    polys: [
        [
            [9, 0], [12, -5], [12.2, -6], [13.3, -9], [13.8, -11.5], [12.5, -13.5], [11.8, -16],
            [11.7, -17.5], [13, -20], [14.5, -22.5], [14.9, -26], [15.3, -27.5], [16.5, -28.6],
            [17.5, -31], [18.3, -33], [18.4, -34.2], [19.9, -34.8], [22, -34], [25, -34], [26.5, -33.8],
            [28, -33], [30, -31.2], [31, -29.5], [32.5, -28], [32.8, -26], [35, -24.5], [35.5, -22],
            [35, -20], [36.5, -18.8], [39, -17], [40.5, -15], [40.5, -11], [39.5, -8], [39.3, -6],
            [39.5, -4.5], [41, -2], [43, 0],
        ],
        // Madagascar
        [[49.3, -12], [50.3, -15.5], [49.5, -17], [48, -21], [47, -25], [45, -25.5], [43.7, -23.5],
         [43.3, -21.5], [44.4, -19.5], [44, -17], [46, -15.8], [48, -13.5]],
    ],
    ranges: [
        { name: "Drakensberg", w: 1.0, m: 0.55, h: 0.9, pts: [[27.5, -31.5], [29, -30], [30, -28.5], [30.8, -26.5], [31, -24]] },
        { name: "Cape Fold", w: 0.8, m: 0.2, h: 0.8, pts: [[18.8, -32.5], [19.5, -33.6], [23, -33.6], [26, -33.4]] },
        { name: "Great Escarpment", w: 1.0, m: 0.0, h: 0.6, pts: [[20, -31.5], [24, -31.8], [27, -31.5]] },
        { name: "Namibian Highlands", w: 1.2, m: 0.05, h: 0.6, pts: [[16.5, -27], [17, -23], [16.5, -19]] },
        { name: "Madagascar Highlands", w: 1.0, m: 0.35, h: 0.9, pts: [[48.8, -13.5], [47.5, -17], [47, -20], [46.6, -23.5]] },
        { name: "Eastern Highlands", w: 1.0, m: 0.15, h: 0.7, pts: [[32.8, -21], [33, -18], [35, -14]] },
    ],
    volcanoes: [],
    rivers: [
        { name: "Zambezi", nav: 6, pts: [[23, -14.5], [25.8, -17.9], [28.8, -16.7], [30.5, -15.6], [33.5, -16.3], [35.6, -17.6], [36.4, -18.9]] },
        { name: "Orange", nav: 0, pts: [[29, -29.3], [26, -30.1], [24.5, -29.7], [21, -28.6], [18, -28.7], [16.4, -28.6]] },
        { name: "Vaal", nav: 0, pts: [[29.5, -26.8], [27, -26.9], [24.8, -28.4], [24, -29.2]] },
        { name: "Limpopo", nav: 3, pts: [[27.5, -25], [29.5, -22.2], [31.5, -22.4], [33.6, -25.2]] },
    ],
    lakes: [],
    biome(lon, lat, n) {
        if (lon > 42) return lon > 46.5 || lat > -14 ? (n < 0.75 ? B.TROPICAL : B.GRASSLAND) : (n < 0.6 ? B.PLAINS : B.DESERT);
        if (lat < -32.5) return lon < 22 ? (n < 0.5 ? B.PLAINS : B.GRASSLAND) : (n < 0.6 ? B.GRASSLAND : B.PLAINS);
        if (lon < 16.5) return B.DESERT;                                      // Namib
        if (lon < 25 && lat > -30) return n < 0.65 ? B.DESERT : B.PLAINS;     // Kalahari
        if (lat < -29 && lon < 26.5) return n < 0.55 ? B.PLAINS : B.DESERT;   // Karoo
        if (lon > 30.5 && lat < -24) return n < 0.7 ? B.GRASSLAND : B.TROPICAL;
        if (lat < -23) return n < 0.7 ? B.GRASSLAND : B.PLAINS;               // Highveld
        if (lon > 33) return n < 0.65 ? B.TROPICAL : B.PLAINS;
        return n < 0.6 ? B.PLAINS : (n < 0.85 ? B.TROPICAL : B.GRASSLAND);   // miombo savanna
    },
};

const AUSTRALIA = {
    id: "australia",
    frame: localFrame(134, -27, [1.27, -0.72], 0.027, 200),
    region: REGION.DISTANT,
    polys: [
        [
            [114, -22], [113.5, -24.5], [114.5, -28], [115, -30.5], [115.7, -32.5], [115, -34.2],
            [117, -35], [118.5, -34.8], [121.5, -33.9], [124, -33], [126, -32.3], [129, -31.6],
            [131.5, -31.5], [134, -32.8], [135.8, -34.8], [136.8, -33.5], [137.8, -33.2], [138.5, -35.5],
            [139.7, -37.2], [141, -38.3], [143.5, -38.8], [145, -38.4], [146.3, -39.1], [148, -37.8],
            [150, -37.3], [150.5, -35.5], [151.3, -33.8], [152.5, -32.3], [153.6, -28.5], [153.2, -25.5],
            [151.5, -24], [150.3, -22.5], [149, -20.5], [146.3, -18.8], [145.5, -16], [145.3, -14.8],
            [143.6, -14], [143, -11], [142.5, -10.7], [141.6, -12.5], [141.5, -16], [140.5, -17.5],
            [139, -17], [137, -15.8], [135.5, -14.8], [136.8, -12.2], [135, -12], [132.5, -11.5],
            [131, -12.2], [130, -13], [129.5, -15], [127.5, -14.2], [126, -14], [124.2, -16.3],
            [122.3, -17.5], [121, -19.5], [118.5, -20.3], [116.5, -20.7],
        ],
        // Tasmania
        [[144.7, -40.7], [148.3, -40.9], [148, -43], [146.9, -43.6], [145.5, -42.5]],
    ],
    ranges: [
        { name: "Great Dividing Range", w: 1.2, m: 0.12, h: 0.75, pts: [[145, -15], [146.5, -20], [148.5, -24], [150.5, -27], [151.2, -30], [150.2, -33.5], [148.8, -36], [146.5, -37.5]] },
        { name: "Snowy Mountains", w: 0.8, m: 0.6, h: 0.9, pts: [[148.2, -35.8], [148.4, -36.8]] },
        { name: "Flinders Ranges", w: 0.8, m: 0.1, h: 0.8, pts: [[138.3, -33], [138.8, -31]] },
        { name: "MacDonnell Ranges", w: 0.8, m: 0.1, h: 0.8, pts: [[132, -23.6], [135, -23.6]] },
        { name: "Hamersley Range", w: 0.9, m: 0.1, h: 0.8, pts: [[116.5, -22.5], [119.5, -22.8]] },
        { name: "Tasmanian Highlands", w: 0.7, m: 0.2, h: 0.8, pts: [[145.8, -41.5], [146.5, -42.5]] },
    ],
    volcanoes: [],
    rivers: [
        { name: "Murray", nav: 6, pts: [[148.2, -36.6], [146.5, -35.9], [144.5, -35.6], [142.2, -34.2], [140.7, -34.1], [139.6, -35.1], [139.1, -35.6]] },
        { name: "Darling", nav: 0, pts: [[151, -28.5], [148, -29.8], [145.5, -30.4], [143.5, -32], [141.9, -34.1]] },
        { name: "Burdekin", nav: 0, pts: [[145.3, -19.8], [146.8, -20.5], [147.6, -19.5]] },
        { name: "Fitzroy", nav: 0, pts: [[148.3, -24.2], [150.3, -23.4], [150.9, -23.5]] },
        { name: "Kimberley Fitzroy", nav: 0, pts: [[126.5, -18.2], [124.5, -17.9], [123.5, -17.4]] },
    ],
    lakes: [],
    biome(lon, lat, n) {
        if (lat < -40) return B.GRASSLAND;                                    // Tasmania
        if (lat > -19) return lon > 141 || lat > -15 ? (n < 0.7 ? B.TROPICAL : B.PLAINS) : (n < 0.6 ? B.PLAINS : B.TROPICAL);
        if (lon > 150 || (lon > 147 && lat < -33)) return lat > -24 ? (n < 0.55 ? B.TROPICAL : B.GRASSLAND) : B.GRASSLAND;
        if (lon < 119.5 && lat < -30) return n < 0.55 ? B.PLAINS : B.GRASSLAND;
        if (lon > 140 && lat < -34) return n < 0.6 ? B.GRASSLAND : B.PLAINS;
        if (lon > 141.5 && lat < -27) return n < 0.7 ? B.PLAINS : B.GRASSLAND; // Murray-Darling
        if (lon > 145) return n < 0.6 ? B.PLAINS : B.GRASSLAND;
        if (lat < -31 && lon < 136) return n < 0.6 ? B.PLAINS : B.DESERT;     // Nullarbor
        return n < 0.8 ? B.DESERT : B.PLAINS;                                   // the Outback
    },
};

const NEW_ZEALAND = {
    id: "new-zealand",
    frame: localFrame(172.5, -41, [-0.98, -0.86], 0.068, 165),
    region: REGION.DISTANT,
    polys: [
        // North Island
        [[172.7, -34.4], [174.3, -35.5], [175, -36.8], [175.9, -37.5], [178.5, -37.7], [177.9, -39.2],
         [176.8, -40], [175.3, -41.6], [174.6, -41.3], [174.6, -39.8], [173.8, -39.2], [174.6, -38],
         [174.5, -36.8], [173.6, -35.8]],
        // South Island
        [[172.7, -40.5], [174.2, -41.2], [174.2, -41.8], [173.3, -43], [173.1, -43.8], [171.3, -44.4],
         [170.8, -45.8], [169.8, -46.6], [168.3, -46.6], [166.5, -46], [166.8, -45.2], [168.3, -44],
         [170.5, -43], [171.5, -41.8], [172.1, -40.9]],
        // Stewart Island
        [[167.5, -46.7], [168.3, -46.7], [168.2, -47.3], [167.5, -47.2]],
    ],
    ranges: [
        { name: "Southern Alps", w: 1.0, m: 0.6, h: 0.9, pts: [[167.3, -45.7], [168.8, -44.4], [170.5, -43.4], [172, -42.5], [173.4, -41.8]] },
        { name: "Kaimanawa and Ruahine", w: 0.8, m: 0.15, h: 0.8, pts: [[175.9, -40.3], [176.3, -39.3], [177.5, -38.3]] },
    ],
    volcanoes: [{ name: "Ruapehu", lon: 175.6, lat: -39.3 }],
    rivers: [
        { name: "Waikato", nav: 0, pts: [[175.9, -38.6], [175.6, -38], [175.1, -37.6], [174.7, -37.35]] },
        { name: "Clutha", nav: 0, pts: [[169.1, -44.6], [169.4, -45.4], [169.8, -46.1], [169.8, -46.4]] },
        { name: "Waitaki", nav: 0, pts: [[170, -44.2], [171, -44.6], [171.3, -44.9]] },
    ],
    lakes: [{ name: "Taupo", lon: 175.9, lat: -38.8, size: 1 }],
    biome(lon, lat, n) {
        if (lat < -43 && lon > 170.5) return n < 0.6 ? B.PLAINS : B.GRASSLAND;   // Canterbury, Otago
        if (lat > -36) return n < 0.5 ? B.TROPICAL : B.GRASSLAND;                  // Northland
        return n < 0.8 ? B.GRASSLAND : B.PLAINS;
    },
};

// Sub-Antarctic islands, placed on the polar projection: small Distant Lands between the big ones.
const ISLANDS = [
    { name: "South Georgia", lon: -36.5, lat: -54.3, r: 1.2 },
    { name: "Kerguelen", lon: 69.5, lat: -49.3, r: 1.6 },
    { name: "Heard", lon: 73.5, lat: -53.1, r: 0.6 },
    { name: "Bouvet", lon: 3.4, lat: -54.4, r: 0.6 },
    { name: "Macquarie", lon: 158.9, lat: -54.6, r: 0.6 },
    { name: "South Orkney", lon: -45, lat: -60.6, r: 0.7 },
];

export const LANDS = [ANTARCTICA, SOUTH_AMERICA, AFRICA, AUSTRALIA, NEW_ZEALAND];

// Named natural wonders at their real sites (the engine checks each footprint and falls back to
// nearby hexes, then to the random pass).
export const WONDERS = [
    { feature: "FEATURE_TORRES_DEL_PAINE", land: "south-america", lon: -72.9, lat: -50.9 },
    { feature: "FEATURE_IGUAZU_FALLS", land: "south-america", lon: -54.4, lat: -25.7 },
    { feature: "FEATURE_HOERIKWAGGO", land: "africa", lon: 18.5, lat: -33.9 },
    { feature: "FEATURE_ULURU", land: "australia", lon: 131.0, lat: -25.3 },
    { feature: "FEATURE_BARRIER_REEF", land: "australia", lon: 147.5, lat: -18.0 },
];

// ---- noise ----------------------------------------------------------------------------------

function makeNoise(rnd) {
    const perm = [];
    for (let i = 0; i < 256; i++) perm.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    const vals = [];
    for (let i = 0; i < 256; i++) vals.push(rnd());
    const h = (i, j) => vals[perm[(perm[i & 255] + j) & 255]];
    const sm = (t) => t * t * (3 - 2 * t);
    const one = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
        const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y, oct = 3) => {
        let s = 0, amp = 1, f = 1, tot = 0;
        for (let k = 0; k < oct; k++) { s += amp * one(x * f + k * 17.31, y * f + k * 31.77); tot += amp; amp *= 0.5; f *= 2; }
        return s / tot;
    };
}

function pointInPoly(X, Y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > Y) !== (yj > Y) && X < xi + (Y - yi) * (xj - xi) / (yj - yi)) inside = !inside;
    }
    return inside;
}

function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// ---- the rasterizer -------------------------------------------------------------------------

export function buildAntarcticaGrid(W, H, rnd, log = () => {}) {
    const N = W * H;
    const idx = (x, y) => y * W + x;
    const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const halfH = (H - 1) * SQ3 / 2;
    const cx0 = (W - 0.5) / 2;
    const toCanvas = (x, y) => [(x + 0.5 * (y & 1) - cx0) / halfH, (y * SQ3 - halfH) / halfH];
    const nearestHex = (X, Y) => {
        const py = Y * halfH + halfH, y0 = Math.round(py / SQ3);
        let best = null, bd = Infinity;
        for (let y = y0 - 1; y <= y0 + 1; y++) {
            const x0 = Math.round(X * halfH + cx0 - 0.5 * (y & 1));
            for (let x = x0 - 1; x <= x0 + 1; x++) {
                if (!inBounds(x, y)) continue;
                const [a, b] = toCanvas(x, y);
                const d = Math.hypot(a - X, b - Y);
                if (d < bd) { bd = d; best = [x, y]; }
            }
        }
        return best;
    };
    const noise = makeNoise(rnd);
    const warpA = makeNoise(rnd), warpB = makeNoise(rnd);

    const terrain = new Array(N).fill(T.OCEAN);
    const biome = new Array(N).fill(B.MARINE);
    const owner = new Array(N).fill(-1);          // index into LANDS, or -2 for a sub-Antarctic island
    const region = new Array(N).fill(REGION.NONE);
    const lon = new Array(N).fill(0), lat = new Array(N).fill(0);
    const plat = new Array(N).fill(0);            // latitude on the polar projection, for every hex
    const rain = new Array(N).fill(0);
    const canvasX = new Array(N), canvasY = new Array(N);

    // --- land ---
    const landPolys = LANDS.map((L) => L.polys.map((p) => p.map(([lo, la]) => L.frame.toCanvas(lo, la))));
    const WARP = 1.3 / halfH;   // coastline jitter, in canvas units (about a hex)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        const [X, Y] = toCanvas(x, y);
        canvasX[i] = X; canvasY[i] = Y;
        plat[i] = POLAR.k ? Math.hypot(X, Y) / POLAR.k - 90 : 0;
        const px = X * halfH, py = Y * halfH;
        const Xw = X + WARP * (warpA(px / 5, py / 5) - 0.5) * 2;
        const Yw = Y + WARP * (warpB(px / 5, py / 5) - 0.5) * 2;
        for (let l = 0; l < LANDS.length && owner[i] < 0; l++) {
            for (const poly of landPolys[l]) {
                if (pointInPoly(Xw, Yw, poly)) { owner[i] = l; break; }
            }
        }
    }
    // every small polygon (Falklands, Stewart Island) gets at least its central hex
    LANDS.forEach((L, l) => landPolys[l].forEach((poly) => {
        let sx = 0, sy = 0;
        for (const [a, b] of poly) { sx += a; sy += b; }
        const t = nearestHex(sx / poly.length, sy / poly.length);
        if (t && owner[idx(t[0], t[1])] < 0) owner[idx(t[0], t[1])] = l;
    }));
    const polar = ANTARCTICA.frame;
    for (const isl of ISLANDS) {
        const [X, Y] = polar.toCanvas(isl.lon, isl.lat);
        const c = nearestHex(X, Y);
        if (!c) continue;
        for (let y = c[1] - 3; y <= c[1] + 3; y++) for (let x = c[0] - 3; x <= c[0] + 3; x++) {
            if (!inBounds(x, y) || owner[idx(x, y)] >= 0) continue;
            const d = hexDistance(c[0], c[1], x, y);
            if (d === 0 || d < isl.r + (rnd() - 0.5) * 0.8) owner[idx(x, y)] = -2;
        }
    }
    // keep a clear sea on the map edges' first column so nothing touches the left and right sides
    for (let y = 0; y < H; y++) { owner[idx(0, y)] = -1; owner[idx(W - 1, y)] = -1; }

    for (let i = 0; i < N; i++) {
        if (owner[i] === -1) continue;
        terrain[i] = T.FLAT;
        const L = owner[i] >= 0 ? LANDS[owner[i]] : ANTARCTICA;
        const [lo, la] = L.frame.fromCanvas(canvasX[i], canvasY[i]);
        lon[i] = lo; lat[i] = la;
        region[i] = owner[i] >= 0 ? L.region : REGION.DISTANT;
    }

    // --- lakes (inland, so never on a coast) ---
    const lakeTiles = new Map();   // lake name -> [[x,y]...]
    LANDS.forEach((L, l) => (L.lakes || []).forEach((lk) => {
        const [X, Y] = L.frame.toCanvas(lk.lon, lk.lat);
        const c = nearestHex(X, Y);
        if (!c || owner[idx(c[0], c[1])] !== l) { log("lake " + lk.name + " is not on land"); return; }
        const tiles = [c];
        const seen = new Set([c.join(",")]);
        while (tiles.length < lk.size) {
            const cands = [];
            for (const t of tiles) for (const [a, b] of hexNeighbors(t[0], t[1])) {
                if (!inBounds(a, b) || seen.has(a + "," + b) || owner[idx(a, b)] !== l) continue;
                cands.push([a, b]);
            }
            if (!cands.length) break;
            const pick = cands[Math.floor(rnd() * cands.length)];
            seen.add(pick.join(",")); tiles.push(pick);
        }
        for (const [a, b] of tiles) terrain[idx(a, b)] = T.LAKE;
        lakeTiles.set(lk.name, tiles);
    }));

    // --- water depth: coast next to land, ocean further out ---
    // Distances to the homeland (Antarctica) and to the Distant Lands are kept apart: shallow water
    // two or three hexes out only grows where the other side is far away, so no chain of coast
    // tiles ever links Antarctica to a Distant Land and they stay out of reach until the ships of
    // the Exploration Age.
    const isLand = (i) => terrain[i] !== T.OCEAN && terrain[i] !== T.COAST && terrain[i] !== T.LAKE;
    const distFrom = (isSource) => {
        const d = new Array(N).fill(Infinity), q = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isSource(idx(x, y))) { d[idx(x, y)] = 0; q.push([x, y]); }
        for (let k = 0; k < q.length; k++) {
            const [x, y] = q[k], dd = d[idx(x, y)];
            for (const [a, b] of hexNeighbors(x, y)) {
                if (!inBounds(a, b) || d[idx(a, b)] <= dd + 1) continue;
                d[idx(a, b)] = dd + 1; q.push([a, b]);
            }
        }
        return d;
    };
    const dHome = distFrom((i) => isLand(i) && region[i] === REGION.HOME);
    const dFar = distFrom((i) => isLand(i) && region[i] !== REGION.HOME);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (terrain[i] !== T.OCEAN) continue;
        const d = Math.min(dHome[i], dFar[i]);
        const other = Math.max(dHome[i], dFar[i]);
        const n = noise(x / 4 + 40, y / 4 + 40);
        if (d === 1 || (other > 4 && ((d === 2 && n > 0.45) || (d === 3 && n > 0.72)))) terrain[i] = T.COAST;
    }

    // --- Antarctica's ice-free band: land within BAND_DEPTH hexes of the sea (lakes do not count) ---
    const band = new Array(N).fill(0);     // 1..BAND_DEPTH in the band, 0 elsewhere
    const coastDist = new Array(N).fill(Infinity);
    {
        const q = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = idx(x, y);
            if (!isLand(i)) continue;
            if (hexNeighbors(x, y).some(([a, b]) => inBounds(a, b) && (terrain[idx(a, b)] === T.OCEAN || terrain[idx(a, b)] === T.COAST))) {
                coastDist[i] = 1; q.push([x, y]);
            }
        }
        for (let k = 0; k < q.length; k++) {
            const [x, y] = q[k], d = coastDist[idx(x, y)];
            for (const [a, b] of hexNeighbors(x, y)) {
                if (!inBounds(a, b)) continue;
                const j = idx(a, b);
                if (!isLand(j) || coastDist[j] <= d + 1) continue;
                coastDist[j] = d + 1; q.push([a, b]);
            }
        }
    }
    for (let i = 0; i < N; i++) if (owner[i] === 0 && coastDist[i] <= BAND_DEPTH) band[i] = coastDist[i];

    // --- relief: ranges, then rolling hills ---
    const hexDistToRange = (i, L, rg) => {
        let best = Infinity;
        const pts = rg._c || (rg._c = rg.pts.map(([lo, la]) => L.frame.toCanvas(lo, la)));
        for (let k = 0; k + 1 < pts.length; k++) {
            best = Math.min(best, segDist(canvasX[i], canvasY[i], pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]));
        }
        return best * halfH;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (!isLand(i)) continue;
        const L = owner[i] >= 0 ? LANDS[owner[i]] : null;
        let t = T.FLAT;
        if (L) {
            for (const rg of L.ranges) {
                const d = hexDistToRange(i, L, rg);
                if (d <= rg.w) {
                    const r = rnd();
                    if (r < rg.m) t = T.MOUNTAIN; else if (r < rg.h && t !== T.MOUNTAIN) t = T.HILL;
                } else if (d <= rg.w + 1 && t === T.FLAT && rnd() < rg.h * 0.45) t = T.HILL;
                if (t === T.MOUNTAIN) break;
            }
        }
        if (t === T.FLAT) {
            const n = noise(x / 3.5 + 7, y / 3.5 + 11);
            const hillCut = owner[i] === 0 ? (band[i] ? 0.66 : 0.63) : 0.68;
            if (n > hillCut && rnd() < 0.8) t = T.HILL;
        }
        // the band stays open: fewer peaks, and never a wall of them on the shore
        if (t === T.MOUNTAIN && band[i] && (band[i] === 1 || rnd() < 0.4)) t = T.HILL;
        terrain[i] = t;
    }
    // no mountain on a one-hex island or a sliver of coast with nothing else
    for (let i = 0; i < N; i++) if (terrain[i] === T.MOUNTAIN && owner[i] < 0) terrain[i] = T.HILL;

    // --- rivers ---
    const riverTiles = new Map();   // "x,y" -> { x, y, to: [x, y], nav, river }
    const riverList = [];
    const key = (x, y) => x + "," + y;
    const isWaterT = (x, y) => !isLand(idx(x, y));
    LANDS.forEach((L, l) => (L.rivers || []).forEach((rv) => {
        // sample the course densely and collect the hexes it passes through
        const pts = rv.pts.map(([lo, la]) => L.frame.toCanvas(lo, la));
        const seq = [];
        const step = 0.2 / halfH;
        for (let k = 0; k + 1 < pts.length; k++) {
            const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
            const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
            for (let s = 0; s <= n; s++) {
                const h = nearestHex(ax + (bx - ax) * s / n, ay + (by - ay) * s / n);
                if (!h) continue;
                const last = seq[seq.length - 1];
                if (last && last[0] === h[0] && last[1] === h[1]) continue;
                if (last && hexDistance(last[0], last[1], h[0], h[1]) > 1) {
                    // bridge a jump with the neighbour closest to the target
                    let cur = last;
                    while (hexDistance(cur[0], cur[1], h[0], h[1]) > 1) {
                        cur = hexNeighbors(cur[0], cur[1]).filter(([a, b]) => inBounds(a, b))
                            .sort((p, q) => hexDistance(p[0], p[1], h[0], h[1]) - hexDistance(q[0], q[1], h[0], h[1]))[0];
                        seq.push(cur);
                    }
                }
                seq.push(h);
            }
        }
        // cut loops
        const path = [];
        const onPath = new Set();
        for (const h of seq) {
            const k = key(h[0], h[1]);
            if (onPath.has(k)) {
                while (key(...path[path.length - 1]) !== k) onPath.delete(key(...path.pop()));
                continue;
            }
            onPath.add(k); path.push(h);
        }
        // start on land of this landmass
        let s = 0;
        while (s < path.length && (isWaterT(path[s][0], path[s][1]) || owner[idx(path[s][0], path[s][1])] !== l)) s++;
        const course = [];
        let mouth = null;
        for (let k = s; k < path.length; k++) {
            const [x, y] = path[k];
            if (isWaterT(x, y) || riverTiles.has(key(x, y))) { mouth = [x, y]; break; }
            course.push([x, y]);
        }
        if (!course.length) { log("river " + rv.name + " has no land course"); return; }
        if (!mouth) {
            // the drawn course stops short of the water: walk on to the nearest water or river
            const [ex, ey] = course[course.length - 1];
            const prev = new Map([[key(ex, ey), null]]);
            const q = [[ex, ey]];
            const wantLake = rv.toLake ? new Set((lakeTiles.get(rv.toLake) || []).map((t) => key(t[0], t[1]))) : null;
            for (let k = 0; k < q.length && !mouth; k++) {
                for (const [a, b] of hexNeighbors(q[k][0], q[k][1])) {
                    if (!inBounds(a, b) || prev.has(key(a, b))) continue;
                    prev.set(key(a, b), q[k]);
                    const done = wantLake ? wantLake.has(key(a, b)) : (isWaterT(a, b) || riverTiles.has(key(a, b)));
                    if (done) { mouth = [a, b]; break; }
                    if (isWaterT(a, b) || course.some((c) => c[0] === a && c[1] === b)) continue;
                    if (hexDistance(ex, ey, a, b) <= 8) q.push([a, b]);
                }
            }
            if (!mouth) { log("river " + rv.name + " found no mouth"); return; }
            const ext = [];
            for (let c = prev.get(key(mouth[0], mouth[1])); c && !(c[0] === ex && c[1] === ey); c = prev.get(key(c[0], c[1]))) ext.unshift(c);
            course.push(...ext);
        }
        const toOcean = terrain[idx(mouth[0], mouth[1])] === T.OCEAN || terrain[idx(mouth[0], mouth[1])] === T.COAST;
        const tiles = [];
        for (let k = 0; k < course.length; k++) {
            const [x, y] = course[k];
            const to = k + 1 < course.length ? course[k + 1] : mouth;
            const nav = toOcean && rv.nav > 0 && course.length - k <= rv.nav;
            const i = idx(x, y);
            if (terrain[i] === T.MOUNTAIN) terrain[i] = T.HILL;
            riverTiles.set(key(x, y), { x, y, to, nav, river: rv.name });
            tiles.push([x, y]);
        }
        riverList.push({ name: rv.name, land: L.id, tiles, mouth, toOcean });
    }));
    // --- volcanoes (after the rivers, on a hex no river runs through) ---
    const volcanoes = [];
    LANDS.forEach((L, l) => (L.volcanoes || []).forEach((v) => {
        // the nearest hex of this land to the peak (a coastal volcano can fall just offshore)
        const p = nearestHex(...L.frame.toCanvas(v.lon, v.lat));
        let c = null;
        for (let r = 0; r <= 2 && !c && p; r++) {
            for (let y = p[1] - r; y <= p[1] + r && !c; y++) for (let x = p[0] - r; x <= p[0] + r && !c; x++) {
                if (inBounds(x, y) && hexDistance(p[0], p[1], x, y) === r && owner[idx(x, y)] === l && isLand(idx(x, y)) && !riverTiles.has(key(x, y))) c = [x, y];
            }
        }
        if (!c) { log("volcano " + v.name + " is not on land"); return; }
        terrain[idx(c[0], c[1])] = T.MOUNTAIN;
        volcanoes.push({ name: v.name, x: c[0], y: c[1] });
    }));


    // --- biomes and rainfall ---
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (!isLand(i)) continue;
        const n = noise(x / 5 + 101, y / 5 + 57);
        let b;
        if (owner[i] === 0) {
            if (!band[i]) b = B.TUNDRA;
            else {
                // the Peninsula and the shore are the mildest; the inner band is mostly tundra
                const mild = (lon[i] < -55 && lon[i] > -75 && lat[i] > -71) ? 0.2 : 0;
                const shore = band[i] <= 2 ? 0.15 : 0;
                const g = n + mild + shore;
                b = g > 0.78 ? B.GRASSLAND : g > 0.5 ? B.PLAINS : B.TUNDRA;
            }
        } else if (owner[i] === -2) {
            b = n < 0.6 ? B.TUNDRA : B.GRASSLAND;
        } else {
            b = LANDS[owner[i]].biome(lon[i], lat[i], n);
        }
        biome[i] = b;
        rain[i] = { [B.DESERT]: 20, [B.PLAINS]: 70, [B.GRASSLAND]: 110, [B.TROPICAL]: 160, [B.TUNDRA]: 60 }[b] || 80;
        if (owner[i] === 0 && !band[i]) rain[i] = 10;
    }

    // --- wonders ---
    const wonders = WONDERS.map((w) => {
        const L = LANDS.find((z) => z.id === w.land);
        const c = nearestHex(...L.frame.toCanvas(w.lon, w.lat));
        return c ? { feature: w.feature, x: c[0], y: c[1] } : null;
    }).filter(Boolean);

    // --- the Antarctic centre and the band's hexes, for start regions ---
    const centre = nearestHex(0, 0);
    const bandTiles = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (band[idx(x, y)]) bandTiles.push([x, y]);

    const count = (f) => { let c = 0; for (let i = 0; i < N; i++) if (f(i)) c++; return c; };
    log("land: antarctica " + count((i) => owner[i] === 0 && isLand(i)) + " (band " + bandTiles.length + "), " +
        LANDS.slice(1).map((L, k) => L.id + " " + count((i) => owner[i] === k + 1 && isLand(i))).join(", ") +
        ", islands " + count((i) => owner[i] === -2));

    return {
        W, H, idx, inBounds, toCanvas, nearestHex, halfH,
        terrain, biome, owner, region, lon, lat, plat, rain, band, coastDist, canvasX, canvasY,
        riverTiles, riverList, volcanoes, wonders, lakeTiles, centre, bandTiles,
        isLand: (x, y) => isLand(idx(x, y)),
    };
}
