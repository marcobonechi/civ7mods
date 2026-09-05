// default-maps.js
// Preloaded map data for standalone and fallback use

// europe-large-geo.js
// Geography for the "Europe, Mediterranean & Sahel" map (large variant).
// Same conventions as europe-geo.js: [lon, lat] degrees, widths/radii in hex tiles.
// Differences: extends south to 10N (Sahel, Ethiopia, Arabia), compresses the far north and the
// Sahara vertically, less Atlantic on the left, harsher Russia, larger grids.

window.DEFAULT_EUROPE_LARGE_GEO = {
    // ---- projection -------------------------------------------------
    lonCenter: 19.2,     // right edge about 59E at 47N after the eastern squeeze: the Urals close the map
    spanRef: 70,
    // East of 35E each screen degree covers 1.25 geographic degrees: Russia, the Caucasus and the
    // Middle East take fewer columns, Europe gains them.
    lonSqueeze: { from: 35.0, k: 1.35 },
    latRef: 47,
    scaleExp: 0.5,
    latBottom: 10.0,
    latTop: 71.0,
    // piecewise latitude -> row fraction: Sahara and the Arctic are squashed, Europe gets most rows
    // Africa (below 27N tile latitude) holds 13% of the rows; the freed 5% went half to the
    // Mediterranean band (27-46N) and half to continental Europe (46-60N).
    latControl: [[10.0, 0.0], [27.0, 0.13], [46.0, 0.556], [60.0, 0.876], [71.0, 1.0]],
    rangeScale: 1.45,    // mountain range widths are authored for the 78-wide grid
    blobScale: 1.35,
    // Distant Lands: one anchor per landmass that should sit across the sea. [20, 10] is the
    // Sahel, i.e. the African landmass, which the Mediterranean and the Suez channel separate
    // from Eurasia. Leave the list empty to put every landmass in one region.
    distantLandsAnchors: [
        [20, 10],            // the Sahel, i.e. the whole African landmass
        [-12.0, 47.0],       // Ile de l'Ouest  - Atlantic outposts, reachable only by sea
        [-12.6, 44.6],       // Ile du Sud,
        [18.1, 59.3],        // Scandinavia and Finland, cut off by the Karelian passage above
        [-21.9, 64.1],       // Iceland,
        [-6.9, 62.0],        // Faroe   - stepping stones, so the Norse north is one region and
        [1.48, 58.93],       // Shetland  Iceland can island-hop to Norway in the Antiquity age.
                             // Orkney is deliberately left out: it belongs to Britain's landmass
                             // and anchoring it would pull all of Britain into the distant lands.
    ],
    // Vertical remap of West/Central Africa south of 33N (west of 5E, fading to none at 28E so
    // Egypt and Ethiopia keep their rows). westMap pairs are [geographic lat, tile lat]:
    // Gulf of Guinea coast just above the sea lane, a tall Sahel, a three-row Sahara.
    // On the 112x98 grid this lifts Gao (Songhai) by about 12 rows.
    // East zone (33E onwards): 4-18N stretched so Ethiopia gets about six rows, the Nubian desert
    // squeezed, Egypt above Aswan (24N) untouched. Axum lands around row 8 on the 112x98 grid.
    southWarp: {
        latPivot: 33.0,
        zones: [
            { lonStart: -1000, lonFullStart: -999, lonFullEnd: 5.0, lonEnd: 28.0,
              map: [[0.0, 10.0], [4.5, 11.9], [12.5, 19.7], [17.5, 29.7], [30.0, 31.2], [33.0, 33.0]] },
            { lonStart: 28.0, lonFullStart: 33.0, lonFullEnd: 999, lonEnd: 1000,
              map: [[4.0, 10.0], [10.0, 13.0], [14.0, 17.5], [18.0, 21.0], [22.0, 22.5], [24.0, 24.0], [33.0, 33.0]] }
        ]
    },
    // West of 6W and south of 33N the columns are squeezed (3.3 geographic degrees per screen degree at
    // full strength below 30N) so the West African bulge from Senegal round to Ghana fits on the map.
    lonSqueezeWest: { segments: [[-2.0, 2.2]], latFull: 30.0, latNone: 33.0 },

    // Green patches: [lon, lat, radius in tiles, biome, rainfall]. Egypt's oases and the Fayyum.
    biomeBlobs: [
        [25.5, 29.2, 1.9, "G", 110, "Siwa"], [28.9, 28.3, 0.6, "G", 60, "Bahariya"], [27.9, 27.1, 0.6, "G", 60, "Farafra"],
        [28.9, 25.5, 0.6, "G", 60, "Dakhla"], [30.5, 25.4, 0.6, "G", 60, "Kharga"], [30.6, 29.3, 0.8, "G", 60, "Fayyum"],
        // Saharan oases
        [9.5, 30.1, 0.5, "G", 60, "Ghadames"], [10.2, 24.9, 0.5, "G", 60, "Ghat"], [2.5, 27.2, 0.5, "G", 60, "In Salah"], [-4.0, 22.7, 0.5, "G", 60, "Taoudenni"],
        [12.9, 18.7, 0.5, "G", 60, "Bilma"], [23.3, 24.2, 0.5, "G", 60, "Kufra"], [0.2, 29.2, 0.5, "G", 60, "Timimoun"], [19.1, 18.0, 0.5, "G", 60, "Faya"],
        // Three oases west of the Nile, grown large enough to hold a town each and spaced at
        // least ten hexes apart (the map squeezes the Sahara vertically, so the historical
        // oasis cluster of Bahariya/Farafra/Dakhla/Kharga sits only 3-6 hexes across and cannot
        // support separate cities). All three are real stops on the desert caravan routes.
        [29.4, 22.0, 1.9, "G", 110, "Selima"], [24.5, 17.6, 1.9, "G", 110, "Ounianga"],

        // One hex of plains around every river corridor, as a transition from the green
        // floodplain out to bare desert. Listed before the grassland blobs below, which are
        // narrower and therefore overwrite the middle of this band.
        // Nile skirt
        [31.0, 31.2, 3.0, "P", 60, "Nile skirt"], [31.2, 30.0, 3.0, "P", 60, "Nile skirt"], [31.2, 29.07, 3.0, "P", 60, "Nile skirt"],
        [31.2, 28.13, 3.0, "P", 60, "Nile skirt"], [31.2, 27.2, 3.0, "P", 60, "Nile skirt"], [31.9, 26.45, 3.0, "P", 60, "Nile skirt"],
        [32.6, 25.7, 3.0, "P", 60, "Nile skirt"], [32.9, 24.1, 3.0, "P", 60, "Nile skirt"], [32.2, 22.95, 3.0, "P", 60, "Nile skirt"],
        [31.5, 21.8, 3.0, "P", 60, "Nile skirt"], [31.15, 20.6, 3.0, "P", 60, "Nile skirt"], [30.8, 19.4, 3.0, "P", 60, "Nile skirt"],
        [31.4, 18.5, 3.0, "P", 60, "Nile skirt"], [32.0, 17.6, 3.0, "P", 60, "Nile skirt"], [32.25, 16.6, 3.0, "P", 60, "Nile skirt"],
        [32.5, 15.6, 3.0, "P", 60, "Nile skirt"],
        // White Nile skirt
        [31.75, 15.1, 3.0, "P", 60, "White Nile skirt"], [31.0, 14.6, 3.0, "P", 60, "White Nile skirt"], [30.15, 14.3, 3.0, "P", 60, "White Nile skirt"],
        [29.3, 14.0, 3.0, "P", 60, "White Nile skirt"], [28.4, 13.9, 3.0, "P", 60, "White Nile skirt"], [27.5, 13.8, 3.0, "P", 60, "White Nile skirt"],
        [26.5, 13.2, 3.0, "P", 60, "White Nile skirt"], [25.5, 12.8, 3.0, "P", 60, "White Nile skirt"],
        // Blue Nile skirt
        [33.25, 14.9, 3.0, "P", 60, "Blue Nile skirt"], [34.0, 14.2, 3.0, "P", 60, "Blue Nile skirt"], [34.8, 13.6, 3.0, "P", 60, "Blue Nile skirt"],
        [35.6, 13.0, 3.0, "P", 60, "Blue Nile skirt"], [36.45, 12.55, 3.0, "P", 60, "Blue Nile skirt"], [37.3, 12.1, 3.0, "P", 60, "Blue Nile skirt"],
        // Euphrates skirt
        [38.0, 37.0, 3.0, "P", 60, "Euphrates skirt"], [39.0, 35.95, 3.0, "P", 60, "Euphrates skirt"], [40.1, 35.3, 3.0, "P", 60, "Euphrates skirt"],
        [41.05, 34.9, 3.0, "P", 60, "Euphrates skirt"], [42.0, 34.5, 3.0, "P", 60, "Euphrates skirt"], [43.0, 33.95, 3.0, "P", 60, "Euphrates skirt"],
        [44.0, 33.4, 3.0, "P", 60, "Euphrates skirt"], [44.75, 32.7, 3.0, "P", 60, "Euphrates skirt"], [45.5, 32.0, 3.0, "P", 60, "Euphrates skirt"],
        [46.25, 31.5, 3.0, "P", 60, "Euphrates skirt"], [47.0, 31.0, 3.0, "P", 60, "Euphrates skirt"], [48.0, 30.2, 3.0, "P", 60, "Euphrates skirt"],
        // Tigris skirt
        [43.1, 36.3, 3.0, "P", 60, "Tigris skirt"], [43.4, 35.45, 3.0, "P", 60, "Tigris skirt"], [43.7, 34.6, 3.0, "P", 60, "Tigris skirt"],

        // Great-river floodplains. Blobs, not polygons: they are generated straight from the
        // river courses in `rivers`, so the green ribbon cannot drift off the water the way a
        // hand-drawn corridor did. Radius 1.7 hexes with rainfall 90 - a deliberate game-balance
        // choice, since flat desert yields no food and these regions fed the first great cities.
        // // Nile
        [31.0, 31.2, 1.7, "G", 90, "Nile valley"], [31.2, 30.0, 1.7, "G", 90, "Nile valley"], [31.2, 29.3, 1.7, "G", 90, "Nile valley"],
        [31.2, 28.6, 1.7, "G", 90, "Nile valley"], [31.2, 27.9, 1.7, "G", 90, "Nile valley"], [31.2, 27.2, 1.7, "G", 90, "Nile valley"],
        [31.9, 26.45, 1.7, "G", 90, "Nile valley"], [32.6, 25.7, 1.7, "G", 90, "Nile valley"], [32.75, 24.9, 1.7, "G", 90, "Nile valley"],
        [32.9, 24.1, 1.7, "G", 90, "Nile valley"], [32.43, 23.33, 1.7, "G", 90, "Nile valley"], [31.97, 22.57, 1.7, "G", 90, "Nile valley"],
        [31.5, 21.8, 1.7, "G", 90, "Nile valley"], [31.27, 21.0, 1.7, "G", 90, "Nile valley"], [31.03, 20.2, 1.7, "G", 90, "Nile valley"],
        [30.8, 19.4, 1.7, "G", 90, "Nile valley"], [31.2, 18.8, 1.7, "G", 90, "Nile valley"], [31.6, 18.2, 1.7, "G", 90, "Nile valley"],
        [32.0, 17.6, 1.7, "G", 90, "Nile valley"], [32.25, 16.6, 1.7, "G", 90, "Nile valley"], [32.5, 15.6, 1.7, "G", 90, "Nile valley"],
        // White Nile
        [31.75, 15.1, 1.7, "G", 90, "White Nile valley"], [31.0, 14.6, 1.7, "G", 90, "White Nile valley"], [30.15, 14.3, 1.7, "G", 90, "White Nile valley"],
        [29.3, 14.0, 1.7, "G", 90, "White Nile valley"], [28.4, 13.9, 1.7, "G", 90, "White Nile valley"], [27.5, 13.8, 1.7, "G", 90, "White Nile valley"],
        [26.5, 13.2, 1.7, "G", 90, "White Nile valley"], [25.5, 12.8, 1.7, "G", 90, "White Nile valley"],
        // Blue Nile
        [33.25, 14.9, 1.7, "G", 90, "Blue Nile valley"], [34.0, 14.2, 1.7, "G", 90, "Blue Nile valley"], [34.8, 13.6, 1.7, "G", 90, "Blue Nile valley"],
        [35.6, 13.0, 1.7, "G", 90, "Blue Nile valley"], [36.45, 12.55, 1.7, "G", 90, "Blue Nile valley"], [37.3, 12.1, 1.7, "G", 90, "Blue Nile valley"],
        // Euphrates
        [38.0, 37.0, 1.7, "G", 90, "Euphrates valley"], [38.5, 36.48, 1.7, "G", 90, "Euphrates valley"], [39.0, 35.95, 1.7, "G", 90, "Euphrates valley"],
        [40.1, 35.3, 1.7, "G", 90, "Euphrates valley"], [41.05, 34.9, 1.7, "G", 90, "Euphrates valley"], [42.0, 34.5, 1.7, "G", 90, "Euphrates valley"],
        [42.67, 34.13, 1.7, "G", 90, "Euphrates valley"], [43.33, 33.77, 1.7, "G", 90, "Euphrates valley"], [44.0, 33.4, 1.7, "G", 90, "Euphrates valley"],
        [44.75, 32.7, 1.7, "G", 90, "Euphrates valley"], [45.5, 32.0, 1.7, "G", 90, "Euphrates valley"], [46.25, 31.5, 1.7, "G", 90, "Euphrates valley"],
        [47.0, 31.0, 1.7, "G", 90, "Euphrates valley"], [48.0, 30.2, 1.7, "G", 90, "Euphrates valley"],
        // Tigris
        [43.1, 36.3, 1.7, "G", 90, "Tigris valley"], [43.4, 35.45, 1.7, "G", 90, "Tigris valley"], [43.7, 34.6, 1.7, "G", 90, "Tigris valley"],
        [44.05, 33.95, 1.7, "G", 90, "Tigris valley"],

        // The delta last of all, so the plains skirt above does not cut into it: this is the
        // richest farmland on the map by design.
        [30.3, 31.2, 2.0, "G", 120, "Delta west"], [31.0, 31.3, 2.2, "G", 120, "Delta centre"],
        [31.7, 31.2, 2.0, "G", 120, "Delta east"], [30.9, 30.5, 2.2, "G", 110, "Delta south"],
    ],

    // Mountains turned into hills: central and southern Italy (Tuscany and the Alps keep theirs;
    // volcanoes are stamped afterwards so Vesuvius and Etna survive)
    hillAreas: [
        { name: "Central and southern Italy", prob: 1.0, pts: [[11.8, 36.5], [19.0, 36.5], [19.0, 42.6], [14.6, 43.5], [12.6, 43.3], [11.8, 42.2]] },
        { name: "Persia (Zagros and Alborz)", prob: 0.5, pts: [[44.0, 27.0], [58.0, 27.0], [58.0, 38.0], [44.0, 38.0]] },
        { name: "Eastern Alps", prob: 0.3, pts: [[10.0, 45.5], [16.5, 45.5], [16.5, 48.0], [10.0, 48.0]] },
        { name: "Around Axum", prob: 0.5, pts: [[36.0, 12.0], [41.0, 12.0], [41.0, 16.5], [36.0, 16.5]] },
        // Anatolia at 33%, except the central massifs around Erciyes (33-37.5E, 37.5-40N) which keep theirs
        { name: "Anatolia (west)", prob: 0.33, pts: [[26.0, 36.0], [33.0, 36.0], [33.0, 42.2], [26.0, 42.2]] },
        { name: "Anatolia (Taurus south)", prob: 0.33, pts: [[33.0, 36.0], [44.0, 36.0], [44.0, 37.5], [33.0, 37.5]] },
        { name: "Anatolia (Pontic north)", prob: 0.33, pts: [[33.0, 40.0], [44.0, 40.0], [44.0, 42.2], [33.0, 42.2]] },
        { name: "Anatolia (east)", prob: 0.33, pts: [[37.5, 37.5], [44.0, 37.5], [44.0, 40.0], [37.5, 40.0]] },
        { name: "Eastern Anatolia (extra)", prob: 0.5, pts: [[37.0, 36.5], [44.5, 36.5], [44.5, 41.5], [37.0, 41.5]] },
        { name: "Southern Greece", prob: 0.5, pts: [[20.0, 35.8], [25.0, 35.8], [25.0, 39.2], [20.0, 39.2]] },
        { name: "Balkans", prob: 0.33, pts: [[13.5, 39.2], [29.5, 39.2], [29.5, 47.5], [13.5, 47.5]] }
    ],
    // Mountain passes: mountains within the radius (tiles) of these lines become hills
    passes: [
        { name: "Riviera coast (Genoa-Nice)", radius: 0.7, pts: [[6.9, 43.65], [8.2, 44.0]] },
        { name: "Mont Cenis (Turin-Lyon)", radius: 0.6, pts: [[6.6, 45.1], [7.4, 45.2]] },
        { name: "Simplon-Gotthard (Milan-Switzerland)", radius: 0.6, pts: [[8.2, 46.0], [8.6, 46.55]] },
        { name: "Brenner (Verona-Innsbruck)", radius: 0.6, pts: [[11.3, 46.6], [11.5, 47.2]] },
        { name: "Trieste-Postojna gate (Italy-Croatia)", radius: 0.7, pts: [[13.6, 45.75], [14.5, 45.5]] },
        { name: "Atlantic gate (Irun-Bayonne)", radius: 0.8, pts: [[-2.2, 43.1], [-1.4, 43.5]] },
        { name: "Roncesvalles", radius: 0.6, pts: [[-1.4, 42.9], [-1.2, 43.3]] },
        { name: "Mediterranean gate (Le Perthus)", radius: 0.8, pts: [[2.6, 42.3], [3.1, 42.7]] },
        { name: "Cilician Gates (Tarsus-Kayseri-Sivas)", radius: 0.45, pts: [[34.9, 37.2], [35.1, 37.9], [35.3, 38.4], [35.0, 39.0]] },
        { name: "Royal Road (Ankara-Sivas)", radius: 0.45, pts: [[33.0, 39.5], [34.6, 39.7], [36.0, 39.6], [37.5, 39.7]] },
        { name: "Konya-Malatya corridor", radius: 0.45, pts: [[32.5, 37.9], [34.0, 37.7], [35.6, 37.7], [37.0, 38.0]] },
        { name: "Isthmus of Corinth", radius: 0.6, pts: [[22.75, 37.85], [23.15, 38.02]] }
    ],

    // Flat land turned into hills with a probability: rolling country in France, Germany, Poland, Hungary, Britain
    // Random hills everywhere away from the ranges: one flat hex in seven
    baseHillProb: 0.143,
    roughAreas: [
        { name: "African jungle (rough grassland)", prob: 0.15, biome: "G", pts: [[-18, -5], [44, -5], [44, 12.5], [-18, 12.5]] },
        { name: "France", prob: 0.12, pts: [[-5.0, 42.6], [8.0, 42.6], [8.0, 51.2], [-5.0, 51.2]] },
        { name: "Germany and Poland", prob: 0.12, pts: [[6.0, 47.3], [24.0, 47.3], [24.0, 55.3], [6.0, 55.3]] },
        { name: "Hungary", prob: 0.12, pts: [[16.0, 45.5], [23.0, 45.5], [23.0, 48.8], [16.0, 48.8]] },
        { name: "Britain", prob: 0.08, pts: [[-6.2, 49.4], [5.0, 49.4], [5.0, 59.5], [-6.2, 59.5]] }
    ],

    // Hills turned into flat land with a probability (mountains stay): gentler Greece and Anatolia
    flatAreas: [
        // Italy: the Apennine mountains become hills (see hillAreas), which left the whole
        // peninsula hilly and short of food. These are the real lowlands, flattened back.
        { name: "Po valley", prob: 1.0, pts: [[7.6, 44.9], [7.7, 45.6], [9.2, 46.0], [11.2, 46.05],
            [12.5, 45.85], [12.6, 45.2], [12.35, 44.75], [11.2, 44.62], [9.6, 44.68], [8.2, 44.72]] },
        { name: "Latium and the Tuscan Maremma", prob: 0.75, pts: [[10.4, 41.2], [13.3, 41.2], [13.3, 43.4], [10.4, 43.4]] },
        { name: "Campania and the Tavoliere", prob: 0.7, pts: [[13.8, 40.2], [17.6, 40.2], [17.6, 41.9], [13.8, 41.9]] },
        { name: "Maghreb (Tell Atlas coast)", prob: 0.45, pts: [
            [-9.8, 33.2], [-5.5, 34.6], [-1.0, 35.2], [3.5, 36.0], [8.0, 36.3], [11.5, 33.5], [11.5, 38.0], [-9.8, 38.0]] },
        { name: "Greece", prob: 0.65, pts: [[19.3, 35.5], [27.5, 35.5], [27.5, 41.8], [19.3, 41.8]] },
        { name: "Anatolia", prob: 0.6, pts: [[26.0, 36.0], [44.5, 36.0], [44.5, 42.2], [26.0, 42.2]] }
    ],

    // Shallow-sea corridors: ocean within the radius (tiles) of these lines becomes coast, so
    // Antiquity ships can island-hop Iceland - Faroe - Shetland/Orkney - Norway.
    shallowLines: [
        // Widened from 1.1 to 1.6 and carried west onto Iceland's own coast: at 1.1 the corridor
        // had gaps, so Iceland -> Faroe -> Shetland was not sailable on coast alone and an Iceland
        // start had nowhere to go in the Antiquity age.
        { name: "Iceland-Faroe-Shetland", radius: 2.0, pts: [[-21.0, 64.2], [-17.0, 63.8], [-12.0, 63.0], [-6.9, 62.0], [-2.5, 60.5], [1.48, 58.93]] },
        { name: "Faroe-Orkney", radius: 2.0, pts: [[-6.9, 62.0], [-3.5, 59.8], [-0.57, 57.95]] },
        { name: "Shetland-Norway", radius: 2.0, pts: [[1.48, 58.93], [3.4, 59.7], [5.3, 60.4]] },
        // A second, more northerly crossing straight from the Faroes to the Norwegian coast, so the
        // Iceland route does not depend on the single narrow hop past Shetland.
        { name: "Faroe-Norway (northern crossing)", radius: 1.8, pts: [[-6.9, 62.0], [-2.0, 61.9], [2.0, 61.7], [5.2, 61.2]] }
    ],

    // Historically placed resources: polygon, resource types (missing ones for the age are skipped),
    // density = land/coast hexes per resource. The engine's own random pass keeps a 20% share.
    resourceAreas: [
        // Iron added: Laconia and Euboea worked it, Greece's unique Hoplite is infantry (iron gives
        // an infantry combat bonus), and three improved iron is what unlocks the Normans.
        // --- Coastal seas -------------------------------------------------------------
        // Listed first so they claim the shoreline before the broad "waters" areas below, which stay
        // as a thin fallback for everything else. The boxes are pulled in to about 80% of their
        // extent so roughly three quarters of each sea's coast gets the dense treatment and the
        // rest stays ordinary. Water takes fish, crabs, turtles, whales, pearls, cowrie and dyes -
        // there is no gem resource valid on water in this ruleset.
        { name: "Italian and Adriatic waters", density: 10, resources: ["RESOURCE_FISH", "RESOURCE_CRABS", "RESOURCE_TURTLES", "RESOURCE_PEARLS", "RESOURCE_DYES"], pts: [[9.1, 36.95], [17.9, 36.95], [17.9, 44.55], [9.1, 44.55]] },
        { name: "Sicilian and Ionian waters", density: 10, resources: ["RESOURCE_FISH", "RESOURCE_CRABS", "RESOURCE_TURTLES", "RESOURCE_PEARLS", "RESOURCE_DYES"], pts: [[11.65, 35.4], [16.85, 35.4], [16.85, 38.6], [11.65, 38.6]] },
        { name: "Aegean and Greek waters", density: 10, resources: ["RESOURCE_FISH", "RESOURCE_CRABS", "RESOURCE_TURTLES", "RESOURCE_PEARLS", "RESOURCE_DYES"], pts: [[19.85, 34.75], [26.65, 34.75], [26.65, 40.75], [19.85, 40.75]] },
        { name: "Anatolian coastal waters", density: 10, resources: ["RESOURCE_FISH", "RESOURCE_CRABS", "RESOURCE_TURTLES", "RESOURCE_PEARLS", "RESOURCE_DYES"], pts: [[27.6, 35.75], [40.4, 35.75], [40.4, 41.75], [27.6, 41.75]] },
        { name: "Black Sea", density: 10, resources: ["RESOURCE_FISH", "RESOURCE_CRABS", "RESOURCE_TURTLES", "RESOURCE_PEARLS", "RESOURCE_DYES"], pts: [[28.1, 40.85], [40.9, 40.85], [40.9, 47.65], [28.1, 47.65]] },
        { name: "Cantabrian coast", density: 10, resources: ["RESOURCE_FISH", "RESOURCE_WHALES", "RESOURCE_CRABS", "RESOURCE_PEARLS", "RESOURCE_COWRIE"], pts: [[-8.95, 42.55], [-0.55, 42.55], [-0.55, 46.95], [-8.95, 46.95]] },
        { name: "English Channel and North Sea", density: 10, resources: ["RESOURCE_FISH", "RESOURCE_WHALES", "RESOURCE_CRABS", "RESOURCE_PEARLS", "RESOURCE_COWRIE"], pts: [[-4.8, 48.55], [4.8, 48.55], [4.8, 52.95], [-4.8, 52.95]] },
        { name: "Baltic Sea", density: 10, resources: ["RESOURCE_FISH", "RESOURCE_WHALES", "RESOURCE_CRABS", "RESOURCE_PEARLS", "RESOURCE_COWRIE"], pts: [[11.15, 54.3], [28.35, 54.3], [28.35, 64.7], [11.15, 64.7]] },

        { name: "Greece and Aegean", density: 8, resources: ["RESOURCE_MARBLE", "RESOURCE_WINE", "RESOURCE_SILVER", "RESOURCE_IRON", "RESOURCE_FISH", "RESOURCE_CITRUS", "RESOURCE_WOOL"], pts: [[19.3, 34.5], [26.9, 34.5], [26.9, 40.2], [25.5, 41.2], [22.8, 41.3], [20.5, 40.5], [19.3, 39.8]] },
        { name: "Italy", density: 8, resources: ["RESOURCE_WINE", "RESOURCE_MARBLE", "RESOURCE_TRUFFLES", "RESOURCE_WOOL", "RESOURCE_IRON", "RESOURCE_SALT", "RESOURCE_FISH", "RESOURCE_CITRUS", "RESOURCE_CLAY"], pts: [[7.0, 44.2], [7.5, 45.1], [8.6, 46.2], [10.5, 46.7], [12.5, 46.8], [13.8, 46.5], [13.8, 45.5],
            [12.5, 45.0], [13.6, 44.0], [15.4, 42.0], [16.5, 41.9], [18.6, 40.3], [17.3, 39.2], [16.2, 37.9],
            [15.7, 36.6], [12.3, 37.3], [11.8, 38.6], [8.1, 38.8], [8.0, 41.4], [9.9, 41.6], [9.2, 43.1], [7.4, 43.7]] },
        { name: "Ethiopia", density: 8, resources: ["RESOURCE_IVORY", "RESOURCE_INCENSE", "RESOURCE_GOLD", "RESOURCE_COFFEE", "RESOURCE_SALT", "RESOURCE_SPICES"], pts: [[34.5, 4.0], [43.5, 4.0], [43.5, 17.0], [34.5, 17.0]] },
        { name: "Egypt and Nile", density: 8, resources: ["RESOURCE_LIMESTONE", "RESOURCE_DATES", "RESOURCE_FLAX", "RESOURCE_COTTON", "RESOURCE_GOLD", "RESOURCE_FISH", "RESOURCE_SALT", "RESOURCE_GYPSUM"], pts: [[29.0, 21.5], [35.0, 21.5], [35.0, 32.0], [29.0, 32.0]] },
        { name: "Levant and Phoenicia", density: 8, resources: ["RESOURCE_DYES", "RESOURCE_HARDWOOD", "RESOURCE_WINE", "RESOURCE_CITRUS", "RESOURCE_INCENSE", "RESOURCE_FISH"], pts: [[34.0, 30.5], [37.5, 30.5], [37.5, 37.2], [34.0, 37.2]] },
        { name: "Mesopotamia", density: 8, resources: ["RESOURCE_DATES", "RESOURCE_CLAY", "RESOURCE_PITCH", "RESOURCE_GYPSUM", "RESOURCE_WOOL", "RESOURCE_HORSES", "RESOURCE_CAMELS"], pts: [[38.0, 29.5], [47.2, 29.5], [47.2, 37.5], [38.0, 37.5]] },
        // Gold added here rather than in Ethiopia: that area is only ~90 land hexes and a quarter of
        // them are mountain, so it has little room. Arabia gives Aksum gold within reach across the sea.
        { name: "Arabia", density: 11, resources: ["RESOURCE_INCENSE", "RESOURCE_CAMELS", "RESOURCE_DATES", "RESOURCE_PEARLS", "RESOURCE_SALT", "RESOURCE_GOLD", "RESOURCE_RUBIES", "RESOURCE_OIL"], pts: [[36.0, 12.0], [56.0, 12.0], [56.0, 30.0], [36.0, 30.0]] },
        { name: "Persia", density: 9, resources: ["RESOURCE_HORSES", "RESOURCE_LAPIS_LAZULI", "RESOURCE_SILK", "RESOURCE_GOLD", "RESOURCE_CAMELS", "RESOURCE_SALT", "RESOURCE_OIL", "RESOURCE_RUBIES"], pts: [[46.0, 26.0], [60.0, 26.0], [60.0, 40.0], [46.0, 40.0]] },
        { name: "Anatolia", density: 9, resources: ["RESOURCE_IRON", "RESOURCE_SILVER", "RESOURCE_MARBLE", "RESOURCE_WOOL", "RESOURCE_HORSES", "RESOURCE_TIN", "RESOURCE_COAL", "RESOURCE_FISH"], pts: [[26.0, 36.0], [44.0, 36.0], [44.0, 42.2], [26.0, 42.2]] },
        { name: "Caucasus and Colchis", density: 9, resources: ["RESOURCE_GOLD", "RESOURCE_WINE", "RESOURCE_IRON", "RESOURCE_HORSES", "RESOURCE_OIL"], pts: [[38.0, 39.0], [50.0, 39.0], [50.0, 45.5], [38.0, 45.5]] },
        { name: "Pontic steppe", density: 11, resources: ["RESOURCE_HORSES", "RESOURCE_HIDES", "RESOURCE_FURS", "RESOURCE_SALT", "RESOURCE_IRON", "RESOURCE_COAL"], pts: [[26.0, 44.5], [50.0, 44.5], [50.0, 52.0], [26.0, 52.0]] },
        { name: "Northern Russia", density: 13, resources: ["RESOURCE_FURS", "RESOURCE_HARDWOOD", "RESOURCE_HIDES", "RESOURCE_WILD_GAME", "RESOURCE_IRON", "RESOURCE_NICKEL", "RESOURCE_GOLD"], pts: [[28.0, 52.0], [64.0, 52.0], [64.0, 72.0], [28.0, 72.0]] },
        // Silver (Sala) and nickel alongside the iron: the north pays in metal what it cannot pay in food.
        { name: "Scandinavia", density: 11, resources: ["RESOURCE_FURS", "RESOURCE_FISH", "RESOURCE_WHALES", "RESOURCE_IRON", "RESOURCE_SILVER", "RESOURCE_NICKEL", "RESOURCE_HARDWOOD", "RESOURCE_WILD_GAME"], pts: [[4.0, 55.0], [13.0, 55.0], [13.0, 56.5], [19.0, 58.5], [24.0, 59.5], [31.0, 62.0], [31.0, 72.0], [4.0, 72.0]] },
        { name: "Iceland and the Faroes", density: 11, resources: ["RESOURCE_FISH", "RESOURCE_WHALES", "RESOURCE_WOOL"], pts: [[-26.0, 61.0], [-5.0, 61.0], [-5.0, 70.0], [-26.0, 70.0]] },
        { name: "Britain", density: 9, resources: ["RESOURCE_TIN", "RESOURCE_WOOL", "RESOURCE_COAL", "RESOURCE_IRON", "RESOURCE_FISH", "RESOURCE_HIDES"], pts: [[-6.5, 49.8], [2.0, 50.5], [2.0, 59.6], [-6.5, 59.6]] },
        { name: "Ireland", density: 11, resources: ["RESOURCE_WOOL", "RESOURCE_HIDES", "RESOURCE_FISH", "RESOURCE_HARDWOOD"], pts: [[-11.5, 51.0], [-5.0, 51.0], [-5.0, 56.0], [-11.5, 56.0]] },
        { name: "Iberia", density: 9, resources: ["RESOURCE_SILVER", "RESOURCE_WOOL", "RESOURCE_WINE", "RESOURCE_HORSES", "RESOURCE_GOLD", "RESOURCE_CITRUS", "RESOURCE_SALT", "RESOURCE_IRON", "RESOURCE_TIN", "RESOURCE_FISH"], pts: [[-10.0, 35.9], [3.5, 35.9], [3.5, 43.9], [-10.0, 43.9]] },
        { name: "France", density: 9, resources: ["RESOURCE_WINE", "RESOURCE_HARDWOOD", "RESOURCE_HORSES", "RESOURCE_WOOL", "RESOURCE_SALT", "RESOURCE_TRUFFLES", "RESOURCE_IRON", "RESOURCE_COAL", "RESOURCE_FISH"], pts: [[-5.0, 42.4], [8.0, 42.4], [8.0, 51.2], [-5.0, 51.2]] },
        { name: "Germany and Central Europe", density: 9, resources: ["RESOURCE_IRON", "RESOURCE_COAL", "RESOURCE_SALT", "RESOURCE_HARDWOOD", "RESOURCE_HIDES", "RESOURCE_SILVER", "RESOURCE_WOOL", "RESOURCE_WILD_GAME", "RESOURCE_NITER"], pts: [[6.0, 46.5], [19.0, 46.5], [19.0, 55.0], [6.0, 55.0]] },
        { name: "Poland and the Baltics", density: 11, resources: ["RESOURCE_HARDWOOD", "RESOURCE_FURS", "RESOURCE_HIDES", "RESOURCE_SALT", "RESOURCE_FLAX", "RESOURCE_WILD_GAME", "RESOURCE_IRON"], pts: [[14.0, 49.0], [31.0, 49.0], [31.0, 60.0], [14.0, 60.0]] },
        { name: "Balkans and Hungary", density: 9, resources: ["RESOURCE_HORSES", "RESOURCE_GOLD", "RESOURCE_SILVER", "RESOURCE_WINE", "RESOURCE_HARDWOOD", "RESOURCE_IRON", "RESOURCE_COAL"], pts: [[13.5, 40.5], [29.5, 40.5], [29.5, 49.0], [13.5, 49.0]] },
        { name: "Maghreb", density: 9, resources: ["RESOURCE_HORSES", "RESOURCE_WOOL", "RESOURCE_SALT", "RESOURCE_IRON", "RESOURCE_DATES", "RESOURCE_CITRUS", "RESOURCE_IVORY", "RESOURCE_FISH"], pts: [[-13.0, 29.0], [12.0, 29.0], [12.0, 37.6], [-13.0, 37.6]] },
        { name: "Libya and Cyrenaica", density: 12, resources: ["RESOURCE_DATES", "RESOURCE_SALT", "RESOURCE_HORSES", "RESOURCE_OIL", "RESOURCE_FISH"], pts: [[12.0, 26.0], [26.0, 26.0], [26.0, 33.5], [12.0, 33.5]] },
        // Gold cannot spawn on desert biome (grassland/plains/tropical only), so the Sahara now carries
        // the metals and minerals that can: silver and rubies are desert-valid, as are incense, ivory,
        // limestone and clay. Density raised from 18 so the desert is not empty between the oases.
        { name: "Sahara", density: 12, resources: ["RESOURCE_SALT", "RESOURCE_CAMELS", "RESOURCE_DATES", "RESOURCE_INCENSE", "RESOURCE_SILVER", "RESOURCE_RUBIES", "RESOURCE_IVORY", "RESOURCE_LIMESTONE", "RESOURCE_CLAY", "RESOURCE_OIL"], pts: [[-18.0, 17.5], [36.0, 17.5], [36.0, 29.0], [-18.0, 29.0]] },
        { name: "Sahel and Niger bend", density: 9, resources: ["RESOURCE_GOLD", "RESOURCE_IVORY", "RESOURCE_SALT", "RESOURCE_HIDES", "RESOURCE_HORSES", "RESOURCE_KAOLIN", "RESOURCE_COTTON"], pts: [[-18.0, 11.5], [34.5, 11.5], [34.5, 17.5], [-18.0, 17.5]] },
        { name: "Guinea coast and jungle", density: 8, resources: ["RESOURCE_IVORY", "RESOURCE_HARDWOOD", "RESOURCE_GOLD", "RESOURCE_COCOA", "RESOURCE_RUBBER", "RESOURCE_COWRIE", "RESOURCE_FISH", "RESOURCE_SPICES"], pts: [[-18.0, -5.0], [34.5, -5.0], [34.5, 11.5], [-18.0, 11.5]] },
        { name: "Persian Gulf and Red Sea", density: 11, resources: ["RESOURCE_PEARLS", "RESOURCE_FISH", "RESOURCE_TURTLES"], pts: [[32.0, 10.0], [60.0, 10.0], [60.0, 31.0], [32.0, 31.0]] },
        { name: "Mediterranean waters", density: 18, resources: ["RESOURCE_FISH", "RESOURCE_CRABS", "RESOURCE_TURTLES"], pts: [[-7, 30], [37, 30], [37, 46], [-7, 46]] },
        { name: "Atlantic and northern waters", density: 18, resources: ["RESOURCE_FISH", "RESOURCE_WHALES", "RESOURCE_CRABS"], pts: [[-30, 35], [35, 35], [35, 72], [-30, 72]] }
    ],

    // Hand-placed navigable rivers (chains of navigable-river terrain), [lon, lat] along the course
    rivers: [
        // Niger head sits five hexes east of the left sea lane; the Senegal springs one hex further
        // west and runs north-west into that lane, so one hex separates the two river heads.
        { name: "Niger", pts: [[-7.4, 12.2], [-6.3, 13.4], [-4.2, 14.5], [-3.0, 16.8], [-0.05, 16.3], [2.1, 13.5], [4.5, 12.0], [6.7, 7.8], [6.2, 5.6], [6.0, 4.3]] },
        { name: "Senegal", pts: [[-7.4, 12.2], [-8.8, 12.6], [-10.5, 13.5], [-12.5, 14.5], [-14.5, 16.0], [-16.5, 16.0]] },
        // Two mouths, as a delta should have: the main channel reaches the coast at Damietta and
        // the Rosetta branch below splits off above Memphis. The widened delta had pushed the
        // shoreline north of the old course end, leaving the river landlocked.
        { name: "Nile", pts: [[31.27, 32.24], [31.0, 31.2], [31.2, 30.0], [31.2, 27.2], [32.6, 25.7], [32.9, 24.1], [31.5, 21.8], [30.8, 19.4], [32.0, 17.6], [32.5, 15.6]] },
        { name: "Nile (Rosetta branch)", pts: [[30.70, 32.24], [30.20, 31.70], [30.30, 31.00], [30.90, 30.35]] },
        { name: "White Nile", pts: [[32.5, 15.6], [32.2, 12.5], [32.5, 10.0], [33.5, 8.0], [34.3, 6.7]] },
        { name: "Bahr el Ghazal", pts: [[32.2, 12.5], [29.3, 14.0], [27.5, 13.8], [26.5, 13.2], [25.5, 12.8]] },
        { name: "Blue Nile", pts: [[32.5, 15.6], [34.0, 14.2], [35.6, 13.0], [37.3, 12.1]] },
        // Varangian route: Daugava from Riga up to Vitebsk, Dnieper from the Black Sea up to Orsha;
        // the two river heads end about two hexes apart (a portage).
        { name: "Daugava", pts: [[23.6, 57.4], [24.1, 57.0], [25.5, 56.6], [27.0, 56.0], [28.8, 55.5], [30.2, 55.5]] },
        { name: "Dnieper", pts: [[32.0, 46.5], [33.5, 47.5], [35.1, 47.8], [35.0, 48.5], [34.0, 49.5], [30.5, 50.4], [30.9, 51.6], [30.9, 52.5], [30.3, 53.5], [30.4, 54.15]] },
        // Europe
        { name: "Tiber", strength: 0.2, pts: [[12.3, 41.75], [12.5, 41.9], [12.8, 42.3]] },
        { name: "Po", pts: [[12.4, 44.95], [11.6, 45.0], [10.6, 45.05], [9.2, 45.1], [7.9, 45.0]] },
        { name: "Seine", pts: [[0.2, 49.45], [1.1, 49.4], [2.35, 48.85], [3.5, 48.4]] },
        { name: "Thames", pts: [[1.5, 51.4], [0.91, 51.41], [0.0, 51.5], [-0.7, 51.7]] },
        { name: "Rhine", pts: [[4.34, 52.35], [4.5, 51.9], [6.0, 51.8], [6.95, 50.95], [8.3, 50.0], [7.8, 48.6], [7.6, 47.6], [8.6, 47.6]] },
        // Rises in the Black Forest massif below: the first hexes of the old course are now
        // mountains, so the water starts on their eastern flank and runs downhill from there.
        { name: "Danube", pts: [[11.3, 48.75], [12.1, 49.0], [13.5, 48.6], [14.3, 48.3], [16.4, 48.2], [19.0, 47.5], [19.0, 46.0], [20.5, 44.8], [22.5, 44.6], [24.0, 43.8], [26.0, 43.9], [28.0, 44.2], [29.5, 45.2]] },
        { name: "Rhone", pts: [[4.7, 43.4], [4.8, 43.9], [4.8, 45.0], [4.8, 45.8]] },
        // Garonne: Gironde estuary at Bordeaux up to Toulouse (south-west France)
        { name: "Garonne", strength: 0.35, pts: [[-1.1, 45.6], [-0.6, 44.85], [0.3, 44.4], [1.4, 43.6]] },
        { name: "Vistula", pts: [[18.7, 54.35], [18.6, 53.0], [19.8, 52.4], [21.0, 52.2], [21.0, 51.2], [19.9, 50.1]] },
        { name: "Oder", pts: [[14.5, 53.4], [14.5, 52.5], [15.5, 51.8], [17.0, 51.1]] },
        // Iberia
        { name: "Ebro", pts: [[0.85, 40.7], [0.0, 41.3], [-0.9, 41.65]] },
        { name: "Tagus", pts: [[-9.1, 38.7], [-8.0, 39.3], [-6.5, 39.6], [-4.0, 39.85]] },
        { name: "Guadalquivir", pts: [[-6.4, 36.8], [-6.0, 37.4], [-4.8, 37.9]] },
        // Mesopotamia, Russia
        { name: "Euphrates", pts: [[38.0, 37.0], [39.0, 35.95], [40.1, 35.3], [42.0, 34.5], [44.0, 33.4], [45.5, 32.0], [47.0, 31.0], [48.0, 30.2]] },
        { name: "Tigris", pts: [[43.1, 36.3], [43.7, 34.6], [44.4, 33.3], [45.5, 32.2], [46.5, 31.2]] },
        { name: "Volga", pts: [[35.9, 56.9], [39.9, 57.6], [44.0, 56.3], [49.1, 55.8], [50.1, 53.2], [46.0, 51.5], [44.5, 48.7], [48.0, 46.3]] },
        // Don halved (18 -> 8 tiles) and weakened further, so it reads as a minor river rather than a
        // broad navigable one. The hexes it gave up went to the Dniester below.
        { name: "Don", strength: 0.25, pts: [[41.6, 49.7], [42.0, 49.0], [41.0, 48.0], [39.7, 47.2], [38.6, 46.9], [38.0, 46.6]] },
        // Carried up to the Carpathian foothills so its headwater has a peak beside it to run down from.
        { name: "Dniester", pts: [[30.2, 46.4], [29.5, 47.0], [28.5, 47.6], [27.0, 48.2], [25.5, 48.5], [24.2, 48.5]] },
        // Africa
        { name: "Volta", pts: [[0.1, 5.6], [-0.5, 7.0], [-1.0, 8.0], [-1.5, 10.5]] },
        { name: "Benue", pts: [[6.7, 7.8], [8.5, 8.4], [9.7, 8.9], [12.5, 9.3]] },
        { name: "Sebou", pts: [[-6.7, 34.3], [-5.9, 34.2], [-5.0, 34.0]] }
    ],


    // ---- land polygons -----------------------------------------------
    land: [
        {
            name: "Mainland", pts: [
                // North-west Africa, Atlantic coast (south to north)
                [-13.5, 26.5], [-13.0, 27.9], [-11.5, 28.8], [-9.6, 30.4], [-9.8, 31.5], [-9.3, 32.3], [-8.5, 33.2],
                [-7.6, 33.6], [-6.8, 34.0], [-6.3, 35.0], [-5.9, 35.75],
                // Maghreb Mediterranean coast (west to east)
                [-5.3, 35.85], [-4.5, 35.2], [-3.0, 35.3], [-1.5, 35.45], [-0.65, 35.7], [0.1, 35.9], [1.5, 36.4],
                [3.05, 36.75], [3.9, 36.9], [5.07, 36.75], [5.8, 36.8], [6.9, 36.9], [7.75, 36.9], [8.75, 36.95],
                [9.85, 37.3], [11.05, 37.05], [10.6, 36.4], [10.6, 35.8], [11.05, 35.5], [10.75, 34.75], [10.1, 33.9],
                [11.1, 33.5], [12.0, 33.1], [13.2, 32.9], [14.3, 32.65], [15.1, 32.4], [15.7, 31.6], [16.6, 31.2],
                [18.3, 30.5], [19.9, 30.6], [20.05, 31.4], [20.05, 32.1], [20.9, 32.7], [21.9, 32.9], [22.6, 32.75],
                [23.95, 32.1], [25.15, 31.55], [25.9, 31.6], [27.2, 31.35], [28.9, 30.85], [29.9, 31.2], [30.4, 31.45],
                [31.8, 31.5], [32.3, 31.25], [33.0, 31.1], [33.8, 31.15], [34.25, 31.3], [34.45, 31.5], [34.65, 31.8],
                // Levant (south to north)
                [34.75, 32.1], [34.95, 32.8], [35.07, 32.93], [35.2, 33.27], [35.37, 33.56], [35.5, 33.9], [35.83, 34.43],
                [35.87, 34.9], [35.78, 35.52], [35.95, 36.1], [36.17, 36.6], [36.2, 36.85], [35.8, 36.77], [35.4, 36.55],
                // Southern Anatolia (east to west)
                [34.63, 36.8], [33.9, 36.35], [32.83, 36.05], [32.3, 36.27], [32.0, 36.55], [31.4, 36.77], [30.7, 36.88],
                [30.55, 36.6], [30.15, 36.3], [29.64, 36.2], [29.1, 36.65], [28.8, 36.7], [28.27, 36.85], [27.7, 36.75],
                // Aegean coast of Anatolia (south to north)
                [27.43, 37.03], [27.27, 37.38], [27.26, 37.86], [26.7, 38.1], [26.3, 38.32], [26.75, 38.67], [26.97, 38.8],
                [26.69, 39.32], [27.0, 39.6], [26.07, 39.48], [26.35, 40.05],
                // Marmara, Asian shore (west to east), then Bosporus
                [26.7, 40.35], [27.97, 40.35], [28.9, 40.37], [29.27, 40.65], [29.9, 40.75], [29.4, 40.8], [29.05, 41.0],
                [29.15, 41.2],
                // Black Sea, Anatolian shore (west to east)
                [29.6, 41.18], [30.2, 41.2], [31.4, 41.28], [31.8, 41.45], [32.4, 41.75], [33.0, 41.9], [33.77, 41.98],
                [35.15, 42.03], [35.9, 41.6], [36.33, 41.3], [37.3, 41.13], [37.88, 40.98], [38.4, 40.92], [39.73, 40.6],
                [40.5, 40.6], [41.4, 40.85], [43.0, 41.3],
                // Caucasus Black Sea shore (south to north)
                [43.1, 42.2], [42.4, 43.0], [41.6, 43.35], [40.9, 43.7], [40.0, 44.2], [38.4, 44.75], [37.6, 44.95],
                [36.72, 45.2],
                // Sea of Azov (clockwise around, via Don mouth)
                [37.4, 45.3], [38.17, 46.05], [38.27, 46.7], [39.4, 47.15], [38.9, 47.2], [37.55, 47.1], [36.8, 46.75],
                [35.6, 46.5], [34.8, 46.17],
                // Crimea
                [35.2, 45.8], [35.5, 45.4], [36.5, 45.35], [36.4, 45.1], [35.38, 45.03], [34.97, 44.85], [34.4, 44.67],
                [34.17, 44.5], [33.7, 44.4], [33.52, 44.6], [33.37, 45.2], [32.55, 45.35], [32.7, 45.5], [33.2, 45.9],
                [33.6, 46.05],
                // Northern Black Sea (east to west)
                [32.9, 46.1], [32.0, 46.5], [31.55, 46.6], [30.73, 46.48], [30.35, 46.2], [29.75, 45.35], [29.65, 45.15],
                [28.65, 44.17], [28.58, 43.8], [27.92, 43.2], [27.73, 42.65], [27.47, 42.5], [27.85, 42.17], [28.1, 41.63],
                [29.0, 41.25],
                // Marmara, European shore (east to west) and Thrace
                [28.95, 41.02], [28.25, 41.07], [27.5, 40.98], [27.1, 40.62], [26.67, 40.42], [26.2, 40.05], [26.4, 40.55],
                [26.08, 40.72], [25.87, 40.85], [24.4, 40.93], [24.0, 40.4], [24.3, 40.15], [23.6, 40.0], [23.4, 39.95],
                [23.3, 40.3], [22.95, 40.63], [22.6, 40.25], [22.6, 39.9],
                // Thessaly, Euboea, Attica
                [22.95, 39.35], [23.4, 39.0], [24.1, 38.6], [24.55, 38.0], [24.05, 37.65], [23.6, 37.93], [23.4, 38.0],
                [22.95, 37.92],
                // Peloponnese
                [23.39, 37.71], [23.00, 37.58], [23.06, 37.06], [23.26, 36.48], [23.45, 36.15], [23.06, 36.28], [22.61, 36.54],
                [22.54, 36.08], [22.29, 36.48], [22.03, 36.93], [21.83, 36.60], [21.50, 36.63], [21.50, 36.80], [21.44, 37.19],
                [21.05, 37.71], [21.11, 38.36], [21.57, 38.49], [21.76, 38.55],
                // Western Greece, Albania, Adriatic east coast (south to north)
                [21.85, 38.35], [21.4, 38.35], [21.1, 38.5], [20.75, 38.95], [20.4, 39.28], [20.25, 39.5], [20.0, 39.85],
                [19.5, 40.45], [19.45, 41.32], [19.4, 41.9], [19.1, 42.1], [18.7, 42.45], [18.1, 42.65], [17.4, 43.0],
                [16.45, 43.5], [15.9, 43.73], [15.23, 44.12], [14.9, 45.0], [14.45, 45.33], [13.85, 44.87], [13.65, 45.08],
                [13.77, 45.65], [13.5, 45.8],
                // Italy, Adriatic coast (north to south)
                [12.35, 45.43], [12.5, 44.95], [12.3, 44.42], [12.57, 44.06], [13.5, 43.62], [13.9, 42.95], [14.22, 42.47],
                [15.0, 42.0], [16.18, 41.88], [15.9, 41.62], [16.28, 41.32], [16.87, 41.12], [17.3, 40.95], [17.94, 40.64],
                [18.5, 40.15], [18.36, 39.8], [17.97, 40.05], [17.23, 40.47], [16.8, 40.38], [16.5, 39.75], [17.13, 39.08],
                [16.6, 38.75], [16.1, 37.93], [15.65, 38.1],
                // Italy, Tyrrhenian coast (south to north)
                [15.63, 38.3], [15.65, 38.68], [16.05, 39.35], [15.78, 39.9], [15.63, 40.07], [15.28, 40.03], [14.75, 40.68],
                [14.37, 40.63], [14.25, 40.85], [14.1, 40.8], [13.57, 41.22], [12.62, 41.45], [12.28, 41.73], [11.8, 42.1],
                [11.2, 42.45], [10.5, 42.93], [10.3, 43.55], [9.85, 44.1], [8.93, 44.4], [8.48, 44.3], [8.03, 43.88],
                // Riviera, Provence, Languedoc, Catalonia
                [7.27, 43.7], [5.93, 43.1], [5.37, 43.3], [4.7, 43.4], [3.7, 43.4], [3.1, 43.1], [3.05, 42.7], [3.3, 42.3],
                [3.15, 42.25], [2.17, 41.38], [1.25, 41.1], [0.85, 40.7], [0.05, 39.95], [-0.35, 39.45], [0.2, 38.75],
                [-0.5, 38.35], [-1.0, 37.6], [-2.2, 36.72], [-2.45, 36.85], [-3.5, 36.72], [-4.4, 36.7], [-4.9, 36.5],
                [-5.35, 36.13], [-5.6, 36.02], [-6.3, 36.5], [-6.4, 36.8], [-6.95, 37.2], [-7.95, 37.0], [-8.98, 37.0],
                // Portugal and Atlantic Spain (south to north)
                [-8.85, 37.95], [-8.9, 38.5], [-9.2, 38.7], [-9.5, 38.78], [-9.4, 39.35], [-8.85, 40.15], [-8.75, 40.65],
                [-8.65, 41.15], [-8.85, 41.7], [-8.8, 42.25], [-9.28, 42.9], [-8.4, 43.37], [-7.85, 43.77], [-7.05, 43.55],
                [-5.65, 43.55], [-3.8, 43.47], [-2.95, 43.35], [-1.98, 43.32],
                // France, Atlantic coast (south to north)
                [-1.55, 43.48], [-1.25, 44.65], [-1.1, 45.6], [-1.15, 46.15], [-1.8, 46.5], [-2.2, 47.25], [-2.9, 47.55],
                [-3.4, 47.7], [-4.4, 47.8], [-4.75, 48.35], [-4.8, 48.5], [-3.95, 48.72], [-2.75, 48.55], [-2.0, 48.65],
                [-1.5, 48.65], [-1.6, 48.85], [-1.62, 49.65], [-1.25, 49.7], [-0.35, 49.3], [0.1, 49.5], [1.1, 49.93],
                [1.6, 50.73], [1.85, 50.95], [2.37, 51.05],
                // Low Countries, German Bight, Jutland west coast
                [2.90, 51.23], [3.60, 51.45], [4.10, 51.95], [4.75, 52.95], [5.50, 53.35], [6.50, 53.45], [7.20, 53.50],
                [8.10, 53.60], [8.70, 53.90], [8.60, 54.30], [8.56, 55.09], [8.56, 55.61], [8.31, 56.12], [8.39, 56.62], [8.73, 56.97],
                [10.44, 57.52],
                // Jutland east coast, German Baltic coast, Poland, Baltic states
                [10.39, 57.26], [10.69, 56.37], [10.09, 56.16], [9.71, 55.65], [9.42, 55.22], [9.46, 55.01], [10.15, 53.90],
                [10.70, 53.35], [11.45, 53.30], [12.10, 53.45], [12.50, 53.70], [13.40, 53.90], [13.60, 53.50], [14.20, 53.30],
                [15.60, 53.50], [16.85, 53.90], [17.55, 54.05], [18.35, 54.10], [18.80, 53.90], [18.65, 53.60], [19.50, 53.70],
                [20.00, 54.20], [21.00, 54.70], [21.10, 55.10], [21.00, 56.50], [21.55, 57.40], [22.60, 57.75], [23.10, 57.30],
                [24.10, 57.00], [24.50, 58.40], [23.50, 58.60], [23.55, 58.95], [24.75, 59.45], [28.00, 59.45], [30.30, 59.95],
                // Finland
                [28.75, 60.7], [26.9, 60.45], [24.95, 60.15], [23.0, 59.83], [22.25, 60.45], [21.4, 60.8], [21.5, 61.5],
                [21.6, 63.1], [23.1, 63.85], [25.45, 65.0], [24.55, 65.75], [24.15, 65.85],
                // Sweden, Bothnian and Baltic coast (north to south)
                [21.59, 65.60], [20.55, 64.75], [19.92, 63.80], [18.48, 63.30], [17.80, 62.63], [17.22, 62.40], [17.04, 61.75],
                [17.08, 60.70], [18.25, 60.35], [17.94, 59.35], [17.80, 58.90], [16.50, 58.60], [16.63, 57.75], [16.37, 56.65],
                [15.69, 56.15], [14.07, 55.40], [13.35, 55.60], [13.08, 56.05], [13.21, 56.65], [12.40, 57.70], [11.69, 58.95],
                // Norway (south, then up the west coast)
                [10.95, 59.2], [10.75, 59.9], [10.2, 59.75], [10.0, 59.05], [8.0, 58.15], [7.05, 57.98], [6.0, 58.45],
                [5.7, 58.97], [5.27, 59.4], [5.3, 60.4], [4.9, 61.05], [5.0, 61.6], [5.1, 62.2], [6.15, 62.47], [7.7, 63.1],
                [9.6, 63.7], [11.2, 64.85], [12.2, 65.5], [12.6, 66.0], [14.4, 67.3], [13.0, 68.15], [14.6, 68.25],
                [16.5, 68.8], [16.1, 69.3], [18.95, 69.65], [21.5, 70.2], [23.7, 70.65], [25.8, 71.15], [27.9, 71.1],
                [31.1, 70.35],
                // Kola, White Sea, Arctic Russia
                [30.0, 69.7], [31.2, 69.7], [34.0, 69.3], [40.0, 68.15], [41.1, 67.0], [38.5, 66.2], [36.0, 66.4],
                [33.5, 66.8], [32.4, 67.15], [33.3, 66.3], [34.6, 65.0], [34.8, 64.5], [36.5, 64.2], [38.1, 63.9],
                [40.5, 64.55], [41.5, 65.4], [44.2, 65.9], [43.3, 68.65], [46.5, 67.0], [49.0, 67.7], [52.0, 68.5],
                [54.5, 68.4], [57.5, 68.6], [59.0, 69.8], [60.5, 69.5], [64.0, 68.9], [66.0, 68.0],
                // Closing edge east (outside the window), then Arabia's south coast and the Horn of Africa
                [72.0, 68.0], [72.0, 24.0], [56.0, 24.0], [52.8, 22.4], [52.3, 19.0], [51.0, 16.5], [49.1, 14.5],
                [45.0, 12.8], [43.3, 12.7], [43.1, 11.6], [43.6, 9.5], [44.0, 7.0],
                // Bottom edge (below the map), then the Gulf of Guinea coast (east to west)
                [44.0, -4.0], [10.0, -4.0], [9.5, 1.0], [9.7, 4.0], [8.3, 4.9], [6.0, 4.3], [3.4, 6.45], [1.2, 6.1],
                [-0.2, 5.55], [-4.0, 5.3], [-7.7, 4.4], [-10.8, 6.3], [-13.2, 8.5],
                // West African Atlantic coast (south to north)
                [-13.7, 9.5], [-15.6, 11.9], [-17.5, 14.7], [-16.0, 18.1], [-17.0, 20.9], [-15.9, 23.7]
            ]
        },
        {
            name: "Great Britain", pts: [
                [-5.29, 49.73], [-4.87, 49.61], [-3.98, 50.06], [-3.42, 50.18], [-2.37, 50.30], [-1.05, 50.36], [-0.47, 50.53],
                [0.74, 50.53], [2.00, 50.98], [2.21, 51.27], [1.42, 51.47], [2.04, 51.76], [2.67, 52.10], [2.98, 52.48],
                [2.62, 52.93], [1.50, 52.85], [1.60, 53.15], [1.46, 53.57], [1.43, 54.12], [1.14, 54.28], [0.98, 54.49],
                [0.40, 54.65], [0.26, 54.90], [0.24, 55.00], [-0.36, 55.69], [-0.48, 55.78], [-0.80, 55.85], [-1.59, 55.88],
                [-0.83, 56.05], [-1.09, 56.16], [-0.77, 56.23], [-0.12, 56.66], [0.26, 56.90], [0.11, 57.04], [-0.39, 57.03],
                [-1.18, 57.05], [-2.19, 56.90], [-1.89, 57.04], [-1.84, 57.16], [-1.43, 57.33], [-0.80, 57.57], [-0.65, 57.70],
                [-1.17, 57.67], [-2.66, 57.69], [-2.75, 57.57], [-2.99, 57.18], [-3.58, 57.06], [-3.69, 56.75], [-3.91, 56.55],
                [-4.33, 56.35], [-3.70, 56.13], [-4.09, 55.60], [-3.88, 55.30], [-3.72, 55.50], [-2.84, 55.45], [-3.08, 55.25],
                [-3.38, 54.90], [-3.39, 54.63], [-2.56, 54.80], [-1.89, 54.90], [-2.19, 54.65], [-2.29, 54.50], [-2.08, 54.10],
                [-2.06, 53.80], [-2.18, 53.45], [-2.35, 53.35], [-2.61, 53.32], [-3.48, 53.40], [-3.64, 53.30], [-3.37, 53.10],
                [-3.86, 52.80], [-3.30, 52.70], [-3.45, 52.40], [-4.06, 52.10], [-4.65, 51.86], [-4.49, 51.59], [-3.62, 51.53],
                [-3.05, 51.35], [-2.35, 51.53], [-2.92, 51.24], [-3.40, 51.06], [-3.91, 51.06], [-4.32, 50.83], [-4.32, 50.59],
                [-4.66, 50.30], [-4.79, 50.14], [-5.12, 49.89]
            ]
        },
        {
            name: "Ireland", pts: [
                [-7.52, 54.98], [-6.52, 54.86], [-6.32, 54.36], [-6.00, 54.12], [-6.64, 53.88], [-6.52, 53.36], [-6.40, 53.06],
                [-6.68, 52.44], [-7.16, 52.40], [-8.24, 52.12], [-9.44, 51.84], [-9.92, 52.36], [-9.52, 52.76], [-8.84, 53.30],
                [-9.68, 53.40], [-9.76, 53.88], [-9.60, 54.12], [-8.40, 54.12], [-8.24, 54.36], [-8.24, 54.80]
            ]
        },
        {
            name: "Iceland", pts: [
                [-20.35, 63.69], [-20.08, 63.25], [-19.00, 62.26], [-18.55, 62.49], [-17.88, 63.15], [-17.29, 64.15], [-16.75, 65.14],
                [-16.57, 66.02], [-16.66, 67.13], [-16.98, 68.89], [-17.65, 69.12], [-18.55, 68.35], [-19.45, 68.23], [-20.13, 67.35],
                [-21.03, 68.67], [-21.43, 66.91], [-20.58, 65.80], [-21.25, 65.46], [-20.58, 64.92]
            ]
        },
        {
            name: "Sicily", pts: [
                [15.65, 38.3], [13.35, 38.2], [12.45, 38.05], [12.35, 37.8], [12.55, 37.6], [13.1, 37.45], [13.6, 37.2],
                [14.25, 37.0], [14.85, 36.65], [15.2, 36.6], [15.35, 37.05], [15.15, 37.5], [15.35, 37.85]
            ]
        },
        {
            name: "Sardinia", pts: [
                [9.2, 41.25], [9.6, 41.0], [9.55, 40.9], [9.7, 40.4], [9.65, 39.5], [9.1, 39.2], [8.5, 38.9], [8.4, 39.5],
                [8.5, 39.9], [8.3, 40.55], [8.2, 40.9], [8.4, 41.1]
            ]
        },
        {
            name: "Corsica", pts: [
                [9.45, 43.0], [9.45, 42.7], [9.55, 42.1], [9.2, 41.4], [8.7, 41.9], [8.6, 42.4], [9.3, 42.95]
            ]
        },
        {
            name: "Crete", pts: [
                [23.5, 35.3], [24.5, 35.5], [25.7, 35.35], [26.3, 35.2], [26.1, 35.0], [25.0, 34.95], [24.0, 35.0]
            ]
        },
        {
            name: "Cyprus", pts: [
                [32.3, 35.0], [32.9, 35.4], [34.05, 35.5], [34.6, 35.7], [34.0, 35.0], [33.0, 34.6]
            ]
        },
        {
            name: "Mallorca", pts: [
                [2.35, 39.55], [3.1, 39.95], [3.5, 39.7], [3.1, 39.3], [2.5, 39.45]
            ]
        },
        {
            name: "Gotland", pts: [
                [18.1, 57.25], [18.6, 57.9], [19.1, 57.9], [18.8, 57.05]
            ]
        },
        {
            name: "Oland", pts: [
                [16.35, 56.2], [16.9, 57.1], [17.15, 57.35], [16.55, 56.2]
            ]
        },
        {
            name: "Saaremaa", pts: [
                [21.9, 58.2], [22.0, 58.9], [22.5, 59.05], [23.0, 58.85], [23.3, 58.5], [23.0, 58.1]
            ]
        },
        {
            name: "Novaya Zemlya", pts: [
                [51.8, 70.7], [53.5, 71.4], [56.5, 72.5], [55.0, 71.0], [53.0, 70.6]
            ]
        }
    ],

    landBlobs: [
        [4.1, 39.9, 0.5, "Menorca"], [1.4, 38.95, 0.5, "Ibiza"], [14.9, 55.1, 0.5, "Bornholm"], [20.0, 60.2, 0.5, "Aland"],
        [28.0, 36.3, 0.5, "Rhodes"], [26.3, 39.2, 0.5, "Lesbos"], [26.0, 38.4, 0.5, "Chios"], [25.4, 37.1, 0.5, "Naxos"],
         [23.75, 38.05, 0.7, "Attica"], [23.45, 38.45, 0.8, "Boeotia"], [19.85, 39.65, 0.5, "Corfu"], [20.55, 38.2, 0.5, "Kefalonia"], [25.2, 39.9, 0.5, "Lemnos"],
        [14.45, 35.9, 0.6, "Malta"],
        // Aeolian islands north of Sicily: Stromboli and Vulcano sit on these hexes.
        [15.00, 39.20, 0.1, "Aeolian Islands"],
        // Two islets far out in the Bay of Biscay, near the western edge of the map.
        [-12.0, 47.0, 0.5, "Ile de l'Ouest"], [-12.6, 44.6, 0.7, "Ile du Sud"], [-6.9, 62.0, 0.5, "Faroe"], [1.48, 58.93, 0.5, "Shetland"], [-0.57, 57.95, 0.5, "Orkney"],
        [-4.49, 57.32, 0.6, "Lewis"], [-4.16, 56.83, 0.5, "Skye"], [-3.15, 54.20, 0.5, "Man"], [49.0, 69.1, 0.6, "Kolguyev"],
        [54.0, 12.5, 0.5, "Socotra"], [23.7, 37.1, 0.5, "Kythira-Milos"], [27.2, 37.7, 0.5, "Samos"]
    ],

    landBlobsLate: [
        // Funen and the Great Belt: the land bridge joining Zealand (Copenhagen) to Jutland, so
        // Denmark is one country by land and stays in the home lands. Four overlapping blobs at
        // radius 0.8 rather than single-tile points: a point blob lands on whatever hex the
        // projection puts under it, which differs per grid size, and the old version only bridged
        // at 112x98 - at 128x112 and 144x126 Zealand attached itself to Sweden instead and took
        // Denmark into the Distant Lands. The Oresund east of Zealand stays water.
        [9.80, 55.45, 0.8, "Funen"], [10.50, 55.50, 0.8, "Great Belt"],
        [11.20, 55.55, 0.8, "Zealand link"], [11.90, 55.60, 0.8, "Zealand west"],
        // Bosporus chokepoint: the Asian shore is carried west so the only water gate between the
        // Sea of Marmara and the Black Sea is the single hex beside Constantinople. Painted late,
        // after the strait water lines, so it narrows the channel instead of being erased by it.
        [29.632, 41.433, 0.1, "Bosporus east shore 1"],
        [30.228, 41.433, 0.1, "Bosporus east shore 2"],
        [30.824, 41.433, 0.1, "Bosporus east shore 3"],
        // The Nile delta is silt the river built out into the sea, and it carried Alexandria and
        // the densest farmland of the ancient world. Pushed a couple of hexes further north than
        // the modern coastline for the food it gives.
        [30.2, 31.45, 1.0, "Alexandria delta"], [30.9, 31.55, 1.1, "Nile delta (north)"],
        [31.6, 31.45, 1.0, "Damietta delta"], [31.25, 31.2, 1.1, "Nile delta (centre)"],
        [11.9, 55.45, 0.5, "Zealand"]
    ],

    water: [
        {
            name: "Caspian Sea", pts: [
                [48.0, 46.2], [51.5, 46.8], [53.0, 46.6], [52.7, 45.3], [51.2, 44.6], [51.0, 43.2], [52.8, 41.9], [53.0, 40.6],
                [53.0, 40.0], [53.9, 38.9], [53.9, 37.6], [53.9, 37.0], [52.0, 36.7], [51.0, 36.75], [49.5, 37.5],
                [48.9, 38.4], [48.85, 38.8], [50.3, 40.3], [49.8, 40.7], [49.5, 41.5], [48.3, 42.0], [47.5, 43.0],
                [47.5, 44.0], [47.0, 45.0], [47.3, 46.0]
            ]
        },
        {
            name: "Persian Gulf", pts: [
                [48.0, 30.05], [47.7, 29.4], [48.4, 28.8], [49.3, 27.4], [49.7, 27.0], [50.2, 26.4], [50.6, 25.5], [51.5, 25.3],
                [51.6, 24.6], [52.9, 22.5], [53.2, 19.5], [62.0, 17.0], [62.0, 26.9], [57.0, 26.8],
                [56.3, 27.2], [54.9, 26.55], [53.0, 27.4], [52.0, 27.85], [51.0, 28.9], [50.8, 28.95], [50.0, 29.9], [49.0, 30.4]
            ]
        },
        {
            name: "Red Sea", pts: [
                [32.55, 29.95], [32.35, 29.3], [32.8, 28.4], [33.4, 27.6], [33.8, 27.2], [34.3, 26.1], [35.5, 23.9],
                [36.5, 22.0], [37.2, 19.6], [37.3, 19.1], [38.5, 17.8], [39.5, 15.6], [41.0, 14.6], [42.7, 13.0],
                [43.2, 12.6], [43.4, 13.0], [43.2, 13.3], [42.9, 14.8], [42.5, 16.9], [41.5, 18.8], [40.5, 20.0],
                [39.2, 21.5], [38.0, 24.1], [36.5, 26.2], [35.7, 27.35], [35.2, 27.8], [34.95, 28.4], [35.0, 29.55],
                [34.7, 29.55], [34.45, 28.6], [34.25, 27.75], [33.5, 28.3], [32.9, 29.2], [32.6, 29.9]
            ]
        },
        {
            name: "Marmara", pts: [
                [26.7, 40.35], [28.0, 40.4], [29.0, 40.4], [29.3, 40.7], [29.0, 41.0], [28.0, 41.0], [27.0, 40.6]
            ]
        }
    ],

    waterLines: [
        { name: "Gibraltar", pts: [[-6.3, 35.95], [-4.8, 36.1]] },
        { name: "Dardanelles-Marmara-Bosporus", pts: [[25.9, 39.95], [26.5, 40.3], [27.5, 40.7], [28.6, 40.75], [29.05, 41.05], [29.2, 41.4]] },
        // Karelian passage: a one-hex channel from the Gulf of Finland through Ladoga and Onega to
        // the White Sea, following the line of the real Belomorsk canal. It cuts Finland from
        // Russia, which is what makes Scandinavia a landmass of its own and so Distant Lands.
        { name: "Karelian passage", pts: [[29.5, 60.0], [31.3, 60.9], [35.4, 61.9], [36.5, 64.0], [36.5, 66.5]] },
        { name: "Kerch", pts: [[36.5, 45.15], [36.9, 45.5]] },
        { name: "Sea of Azov", pts: [[36.9, 45.5], [37.4, 46.0], [37.9, 46.5], [38.5, 46.9]] },
        { name: "Messina", pts: [[15.5, 38.4], [15.7, 38.05], [15.9, 37.8]] },
        { name: "Otranto", pts: [[18.9, 40.1], [19.3, 40.45]] },
        { name: "English Channel and Flemish coast", pts: [[-5.2, 49.4], [-3.0, 49.75], [-1.0, 50.15], [0.5, 50.45], [1.4, 50.95], [2.2, 51.45], [2.9, 51.8], [3.5, 52.2], [4.0, 52.7]] },
        { name: "Oresund", pts: [[12.4, 56.25], [12.7, 55.75], [12.75, 55.3]] },
        { name: "Great Belt", pts: [[10.8, 55.95], [10.9, 55.45], [11.0, 54.9]] },
        { name: "Fehmarn Belt", pts: [[11.05, 54.55], [11.6, 54.4]] },
        { name: "Bonifacio", pts: [[8.9, 41.3], [9.6, 41.35]] },
        { name: "North Channel", pts: [[-6.1, 54.9], [-5.6, 55.4], [-5.5, 55.85]] },
        { name: "Gulf of Corinth", pts: [[21.9, 38.4], [22.3, 38.35]] },
        { name: "Gulf of Laconia", pts: [[23.05, 36.25], [23.05, 36.5]] },
        { name: "Gulf of Messenia", pts: [[22.2, 36.35], [22.2, 36.6]] },
        { name: "Saronic Gulf", pts: [[23.3, 37.45], [23.6, 37.7], [23.95, 37.4], [24.2, 37.2]] },
        { name: "White Sea mouth", pts: [[40.5, 66.8], [39.0, 66.1], [37.0, 65.3]] },
        { name: "Gulf of Finland", pts: [[24.0, 59.9], [27.0, 59.85], [29.5, 60.0]] },
        { name: "Gulf of Riga", pts: [[22.8, 57.6], [23.6, 57.6]] },
        { name: "Irbe Strait (Gulf of Riga mouth)", pts: [[21.3, 57.95], [22.3, 57.85], [23.0, 57.7]] },
        { name: "Bristol Channel", pts: [[-5.0, 51.35], [-3.5, 51.4]] },
        { name: "Skagerrak", pts: [[8.5, 57.5], [10.6, 57.9]] },
        { name: "Euripus", pts: [[23.2, 38.85], [23.6, 38.55]] },
        { name: "Gulf of Suez", pts: [[32.55, 29.9], [33.0, 28.7], [33.7, 27.6], [34.4, 26.6]] },
        { name: "Gulf of Aqaba", pts: [[35.0, 29.5], [34.7, 28.6], [34.4, 27.8]] },
        // Suez Canal: a one-hex sea channel from the Mediterranean near Gaza through the Dead Sea to the Gulf of Aqaba
        { name: "Suez Canal", pts: [[34.3, 31.55], [34.9, 31.5], [35.5, 31.5], [35.3, 30.6], [35.0, 29.6]] },
        { name: "Bab el Mandeb", pts: [[42.9, 12.3], [43.3, 12.7], [43.4, 13.1]] },
        { name: "Hormuz", pts: [[56.0, 26.2], [56.6, 26.6], [57.2, 26.4]] }
    ],

    lakes: [
        [31.3, 60.85, 1.3, "Ladoga"], [35.4, 61.9, 1.0, "Onega"], [13.2, 58.9, 0.9, "Vanern"], [14.5, 58.3, 0.5, "Vattern"],
        [28.4, 61.6, 0.6, "Saimaa"], [27.5, 58.6, 0.6, "Peipus"], [31.3, 58.3, 0.5, "Ilmen"], [17.8, 46.85, 0.5, "Balaton"],
        [6.5, 46.4, 0.5, "Geneva"], [9.4, 47.6, 0.5, "Constance"], [43.0, 38.6, 0.6, "Van"], [33.4, 38.75, 0.5, "Tuz"],
        [45.5, 37.6, 0.6, "Urmia"], [45.3, 40.4, 0.5, "Sevan"], [35.5, 31.5, 0.5, "Dead Sea"], [27.8, 69.0, 0.5, "Inari"],
        [37.6, 60.2, 0.5, "Beloye"], [-6.72, 54.36, 0.5, "Neagh"], [16.9, 59.45, 0.5, "Malaren"], [10.65, 45.65, 0.5, "Garda"],
        [20.7, 41.05, 0.5, "Ohrid"], [19.3, 42.2, 0.5, "Skadar"], [31.4, 37.75, 0.5, "Egirdir"], [5.3, 52.7, 0.5, "IJsselmeer"],
        [24.9, 68.0, 0.5, "Enontekio"], [32.9, 67.8, 0.5, "Imandra"], [8.3, 33.75, 0.6, "Chott el Djerid"],
        [14.3, 13.3, 0.9, "Chad"], [37.3, 12.0, 0.6, "Tana"]
    ],

    shallow: [
        { name: "Mediterranean", coastDist: 2, pts: [[-7, 35], [-7, 37], [0, 40], [3, 44], [9, 45], [14, 46], [19, 43], [23, 41.5], [26.5, 41], [27, 40.5], [26.5, 39], [28, 37], [30, 37.5], [35, 37.5], [37, 36], [36, 32], [34, 31], [30, 31], [20, 30], [10, 33], [5, 35], [-2, 35]] },
        { name: "Black Sea", coastDist: 2, pts: [[27, 41], [27.5, 47.5], [40, 47.5], [42, 41], [30, 40.5]] },
        { name: "Baltic", pts: [[7.0, 56.5], [7.0, 59.2], [10.5, 59.5], [16.5, 61.0], [19.0, 64.0], [21.0, 66.2], [25.5, 66.2], [26.0, 64.0], [23.0, 62.0], [31.0, 60.5], [31.0, 59.0], [22.0, 56.5], [21.0, 54.0], [10.0, 53.5], [9.5, 55.0]] },
        { name: "North Sea", coastDist: 2, pts: [[-6.0, 48.5], [-11.0, 51.5], [-11.0, 55.5], [-8.0, 56.0], [-6.5, 58.0], [-4.0, 58.8], [-1.0, 59.0], [2.0, 58.5], [5.0, 58.5], [8.0, 57.8], [9.0, 55.0], [8.0, 53.5], [3.0, 51.0], [1.5, 50.5], [-4.0, 48.5]] },
        { name: "Caspian", coastDist: 2, pts: [[46, 36], [55, 36], [55, 48], [46, 48]] },
        { name: "Persian Gulf and Arabian Sea", pts: [[43, -5], [62, -5], [62, 31], [47, 31], [47, 16], [43, 14]] },
        { name: "Red Sea", pts: [[32, 12], [44, 12], [44, 30.5], [32, 30.5]] },
        { name: "White Sea", pts: [[32, 63.5], [42, 63.5], [42, 67.2], [32, 67.2]] }
    ],

    ranges: [
        { name: "Black Forest and Swabian Alb", core: 0.62, fringe: 1.0, pts: [[9.65, 48.25], [10.65, 48.72]] },
        // Single peaks just upstream of the Seine and Thames headwaters. They sit beside the
        // course, not on it (markRiver would overwrite a mountain), so the engine's river model
        // gets a real downhill gradient to follow out of these two short catchments.
        { name: "Plateau de Langres", core: 0.5, fringe: 0.9, pts: [[4.01, 48.29], [4.01, 48.29]] },
        // East African highlands: the White Nile's headwater massif. No lake - the water comes
        // off the mountains, and with no water at either end the rainfall steering treats the
        // whole course uniformly instead of mistaking a source lake for a sea mouth.
        { name: "Rwenzori", core: 0.75, fringe: 1.2, pts: [[32.4, 6.9], [33.9, 6.6]] },
        { name: "Kenya highlands", core: 0.6, fringe: 1.0, pts: [[34.9, 6.7], [35.5, 6.7]] },
        // Guinea highlands: the Niger's headwater massif.
        { name: "Guinea Highlands", core: 0.65, fringe: 1.15, pts: [[-8.7, 11.1], [-7.9, 11.8]] },
        // Purpose-built home for Kilimanjaro in the middle-bottom of Africa. The wonder needs three
        // mutually-adjacent mountain hexes on plains biome, which nothing on the map offered, so
        // this raises a compact massif and the plains area below recolours it.
        { name: "Kilimanjaro massif", core: 0.9, fringe: 1.3, pts: [[17.0, 8.5], [17.9, 9.0]] },
        // The Russian plain had no relief at all, so the Volga, Dnieper, Daugava and Don all began
        // 15-17 hexes from the nearest peak and had nothing to flow down. These are the uplands
        // they really rise from - drawn as mountains rather than hills because elevation is the
        // lever the engine's river model actually reads.
        { name: "Valdai Hills", core: 0.6, fringe: 1.1, pts: [[30.5, 55.2], [33.0, 56.6], [35.5, 57.4]] },
        { name: "Central Russian Upland", core: 0.6, fringe: 1.1, pts: [[38.0, 52.2], [40.0, 53.4]] },
        // The Tigris rose 4 hexes from the nearest peak; this is the Hakkari edge it really drains.
        { name: "Hakkari", core: 0.6, fringe: 1.1, pts: [[42.8, 37.0], [43.8, 36.8]] },
        { name: "Cotswolds", core: 0.5, fringe: 0.9, pts: [[-1.17, 51.89], [-1.17, 51.89]] },
        { name: "Alps", core: 1.05, fringe: 1.9, pts: [[6.0, 44.1], [6.9, 45.1], [7.5, 45.9], [8.5, 46.4], [9.8, 46.5], [11.2, 46.8], [12.7, 47.0], [13.9, 47.1], [15.0, 47.3]] },
        { name: "Pyrenees", core: 0.8, fringe: 1.5, pts: [[-1.9, 43.2], [-0.5, 42.85], [1.0, 42.65], [2.6, 42.5]] },
        { name: "Cantabrian", core: 0.55, fringe: 1.3, pts: [[-7.0, 43.1], [-5.5, 43.05], [-4.0, 43.1]] },
        { name: "Central System", core: 0.3, fringe: 1.2, pts: [[-6.0, 40.3], [-4.0, 40.7], [-2.0, 41.5]] },
        { name: "Sierra Nevada", core: 0.5, fringe: 1.0, pts: [[-3.7, 37.05], [-2.8, 37.15]] },
        { name: "Sierra Morena", core: 0.0, fringe: 1.0, pts: [[-6.5, 38.1], [-4.0, 38.3]] },
        { name: "Massif Central", core: 0.3, fringe: 1.4, pts: [[2.0, 44.5], [3.0, 45.3], [4.0, 45.5]] },
        { name: "Vosges-Jura-Black Forest", core: 0.2, fringe: 1.1, pts: [[6.3, 46.7], [7.0, 48.2], [8.0, 48.5], [9.5, 48.5]] },
        { name: "Ardennes", core: 0.0, fringe: 0.9, pts: [[4.5, 50.0], [6.0, 50.2]] },
        { name: "Apennines", core: 0.55, fringe: 1.05, pts: [[8.3, 44.35], [9.5, 44.45], [10.5, 44.2], [11.5, 43.8], [12.6, 43.2], [13.3, 42.6], [13.8, 42.2], [14.3, 41.7], [15.0, 41.1], [15.8, 40.5], [16.1, 39.9], [16.3, 39.3], [16.0, 38.6]] },
        { name: "Dinaric Alps", core: 0.7, fringe: 1.5, pts: [[14.0, 45.8], [15.3, 45.0], [16.5, 44.2], [17.5, 43.6], [18.6, 43.0], [19.5, 42.5], [20.2, 42.0]] },
        { name: "Pindus", core: 0.6, fringe: 1.3, pts: [[20.4, 41.5], [20.8, 40.5], [21.2, 39.8], [21.6, 39.0], [22.2, 38.6]] },
        { name: "Peloponnese", core: 0.0, fringe: 1.0, pts: [[22.2, 37.6], [22.5, 37.2]] },
        { name: "Balkan Mountains", core: 0.5, fringe: 1.2, pts: [[22.5, 43.0], [24.0, 42.75], [25.5, 42.75], [27.0, 42.9]] },
        { name: "Rhodope", core: 0.6, fringe: 1.2, pts: [[23.0, 42.1], [24.5, 41.7], [25.8, 41.6]] },
        { name: "Carpathians", core: 0.55, fringe: 1.4, pts: [[17.0, 49.4], [19.0, 49.4], [20.5, 49.2], [22.0, 49.0], [23.5, 48.4], [24.5, 47.7], [25.5, 47.0], [26.0, 46.2], [25.8, 45.5], [24.8, 45.4], [23.5, 45.4], [22.5, 45.4]] },
        { name: "Tatra", core: 0.85, fringe: 1.5, pts: [[19.5, 49.2], [20.3, 49.2]] },
        { name: "Sudetes", core: 0.2, fringe: 1.1, pts: [[12.5, 50.4], [13.5, 50.5], [15.0, 50.7], [16.5, 50.4]] },
        { name: "Bohemian Forest", core: 0.0, fringe: 1.0, pts: [[12.8, 49.0], [13.8, 48.8]] },
        { name: "Harz-Thuringia", core: 0.0, fringe: 0.8, pts: [[10.6, 51.7], [10.8, 50.6]] },
        { name: "Scandinavian Mountains", core: 0.6, fringe: 1.4, pts: [[6.0, 58.8], [7.5, 60.0], [8.0, 61.3], [8.5, 62.3], [10.5, 63.0], [12.5, 64.0], [14.0, 65.0], [15.5, 66.2], [17.0, 67.3], [18.5, 68.2], [20.5, 69.0], [22.5, 69.7]] },
        { name: "Jotunheimen", core: 1.0, fringe: 1.6, pts: [[7.5, 61.3], [8.6, 61.7]] },
        { name: "Scottish Highlands", core: 0.4, fringe: 1.3, pts: [[-3.68, 56.20], [-2.56, 56.55], [-1.46, 56.83]] },
        { name: "Pennines", core: 0.0, fringe: 0.9, pts: [[-0.92, 55.30], [-0.70, 54.30], [-0.75, 53.50]] },
        { name: "Wales", core: 0.3, fringe: 1.0, pts: [[-3.10, 52.90], [-3.07, 52.00]] },
        { name: "Lake District", core: 0.0, fringe: 0.7, pts: [[-1.78, 54.50], [-1.78, 54.50]] },
        { name: "Wicklow", core: 0.0, fringe: 0.7, pts: [[-6.72, 53.08], [-6.72, 53.08]] },
        { name: "Kerry", core: 0.3, fringe: 0.9, pts: [[-9.36, 52.28], [-9.36, 52.28]] },
        { name: "Donegal", core: 0.0, fringe: 0.8, pts: [[-8.00, 54.60], [-8.00, 54.60]] },
        { name: "Iceland Highlands", core: 0.7, fringe: 1.4, pts: [[-19.23, 64.25], [-18.33, 65.36], [-17.88, 64.70]] },
        { name: "Urals", core: 0.5, fringe: 1.3, pts: [[58.0, 51.5], [59.5, 54.0], [59.0, 56.5], [58.5, 58.5], [59.5, 60.5], [60.5, 62.5], [61.0, 64.5], [62.0, 66.0], [64.5, 67.5]] },
        { name: "Caucasus", core: 0.7, fringe: 1.3, pts: [[39.8, 44.3], [41.3, 43.7], [43.0, 43.2], [44.5, 42.9], [46.0, 42.5], [47.3, 42.2], [48.0, 41.7]] },
        { name: "Lesser Caucasus", core: 0.5, fringe: 1.2, pts: [[43.3, 41.2], [44.3, 40.8], [45.3, 40.3], [46.2, 39.9], [46.8, 39.5]] },
        { name: "Pontic", core: 0.5, fringe: 1.2, pts: [[32.0, 41.0], [35.0, 41.2], [37.5, 40.7], [39.5, 40.6], [41.5, 40.9]] },
        { name: "Taurus", core: 0.7, fringe: 1.4, pts: [[29.5, 37.2], [31.0, 37.2], [32.5, 37.0], [34.0, 37.2], [35.5, 37.6], [36.8, 38.0], [38.5, 38.3], [40.0, 38.2], [41.5, 38.0]] },
        { name: "Eastern Anatolia", core: 0.9, fringe: 1.6, pts: [[39.0, 39.3], [41.0, 39.5], [43.0, 39.2], [44.5, 39.0]] },
        { name: "Zagros", core: 0.9, fringe: 1.6, pts: [[45.5, 35.5], [46.5, 34.3], [47.5, 33.3], [48.5, 32.3], [50.0, 31.0], [51.5, 30.0], [53.0, 28.8], [55.0, 27.5]] },
        { name: "Alborz", core: 0.8, fringe: 1.4, pts: [[49.0, 36.8], [51.0, 36.2], [53.0, 36.3], [55.0, 36.8]] },
        { name: "Kurdistan", core: 0.3, fringe: 1.1, pts: [[43.5, 37.0], [44.5, 36.5]] },
        { name: "Lebanon", core: 0.4, fringe: 0.9, pts: [[35.8, 34.6], [36.2, 33.7]] },
        { name: "Judea", core: 0.0, fringe: 0.8, pts: [[35.2, 32.2], [35.2, 31.6]] },
        { name: "Jordan Highlands", core: 0.0, fringe: 0.8, pts: [[35.8, 31.0], [35.9, 32.2]] },
        { name: "Sinai", core: 0.5, fringe: 1.0, pts: [[33.9, 28.9], [34.1, 28.4]] },
        { name: "Red Sea Hills", core: 0.2, fringe: 1.1, pts: [[33.0, 27.5], [34.5, 24.0], [36.0, 21.0], [37.3, 18.5]] },
        // Hejaz-Asir and the Yemen Highlands pulled ~1.5 degrees inland: the escarpment used to sit
        // on the shoreline, walling Arabia off from its own coast. The Tihamah strip below is the
        // coastal plain they leave behind.
        { name: "Hejaz-Asir", core: 0.3, fringe: 1.1, pts: [[38.0, 28.0], [40.0, 26.0], [42.0, 22.0], [43.3, 19.5], [44.3, 17.5]] },
        { name: "Yemen Highlands", core: 0.6, fringe: 1.3, pts: [[44.2, 16.6], [44.9, 15.0], [45.9, 13.8]] },
        { name: "Ethiopian Highlands", core: 0.5, fringe: 2.6, pts: [[36.5, 15.5], [37.8, 13.5], [39.0, 12.0], [39.5, 10.0], [38.0, 7.5], [36.5, 6.0]] },
        { name: "Tigray-Simien", core: 0.35, fringe: 1.6, pts: [[38.0, 15.8], [39.3, 14.6], [39.5, 13.2]] },
        { name: "Eastern Ethiopian Highlands", core: 0.3, fringe: 1.6, pts: [[40.0, 9.5], [41.5, 9.0], [43.0, 9.5]] },
        { name: "Hajar", core: 0.5, fringe: 1.2, pts: [[56.5, 24.2], [58.3, 23.2]] },
        { name: "Tibesti", core: 0.8, fringe: 1.6, pts: [[17.0, 21.5], [18.5, 20.5]] },
        { name: "Ahaggar", core: 0.8, fringe: 1.6, pts: [[5.0, 24.0], [6.0, 23.0]] },
        { name: "Air", core: 0.4, fringe: 1.2, pts: [[8.5, 19.0], [9.0, 17.8]] },
        { name: "Adrar des Ifoghas", core: 0.0, fringe: 1.0, pts: [[1.5, 19.5], [1.5, 19.5]] },
        { name: "Ennedi", core: 0.0, fringe: 0.9, pts: [[22.0, 17.0], [22.0, 17.0]] },
        { name: "Jebel Marra", core: 0.5, fringe: 1.2, pts: [[24.3, 13.2], [24.3, 13.2]] },
        { name: "Nuba", core: 0.0, fringe: 0.9, pts: [[30.5, 11.5], [30.5, 11.5]] },
        { name: "Fouta Djallon", core: 0.4, fringe: 1.5, pts: [[-12.5, 11.0], [-11.5, 10.0], [-9.5, 9.5]] },
        { name: "Jos Plateau", core: 0.2, fringe: 1.3, pts: [[8.5, 10.0], [9.5, 9.5]] },
        { name: "Bandiagara", core: 0.0, fringe: 1.2, pts: [[-3.8, 14.3], [-2.8, 14.8]] },
        { name: "Somali Highlands", core: 0.0, fringe: 1.0, pts: [[45.5, 10.5], [48.5, 10.0]] },
        { name: "High Atlas", core: 0.8, fringe: 1.5, pts: [[-8.5, 30.5], [-7.5, 31.3], [-6.0, 31.8], [-4.5, 32.3], [-3.0, 32.8], [-1.5, 33.5]] },
        { name: "Anti-Atlas", core: 0.2, fringe: 1.0, pts: [[-9.5, 29.5], [-7.5, 30.2]] },
        { name: "Rif", core: 0.4, fringe: 1.0, pts: [[-5.5, 35.1], [-4.0, 34.9], [-2.5, 34.8]] },
        { name: "Tell Atlas", core: 0.4, fringe: 1.1, pts: [[-1.0, 35.2], [1.0, 35.7], [3.0, 36.2], [5.0, 36.3], [7.0, 36.2], [8.5, 36.2]] },
        { name: "Saharan Atlas", core: 0.5, fringe: 1.2, pts: [[-1.5, 33.7], [0.5, 33.9], [2.5, 34.3], [4.5, 34.8], [6.5, 35.2]] },
        { name: "Tunisian Dorsal", core: 0.0, fringe: 0.9, pts: [[8.5, 35.7], [9.5, 36.2]] },
        { name: "Jebel Akhdar", core: 0.0, fringe: 0.9, pts: [[20.8, 32.5], [22.5, 32.6]] },
        { name: "Crimean Mountains", core: 0.3, fringe: 0.8, pts: [[33.8, 44.55], [34.5, 44.7]] },
        { name: "Corsica", core: 0.3, fringe: 1.0, pts: [[9.0, 42.5], [9.1, 42.0]] },
        { name: "Sardinia", core: 0.3, fringe: 1.0, pts: [[9.3, 40.3], [9.3, 39.8]] },
        { name: "Sicily", core: 0.3, fringe: 1.0, pts: [[13.5, 37.9], [14.5, 37.9]] },
        { name: "Crete", core: 0.2, fringe: 1.0, pts: [[23.9, 35.3], [24.7, 35.25], [25.5, 35.2]] },
        { name: "Troodos", core: 0.2, fringe: 0.9, pts: [[32.9, 34.9], [32.9, 34.9]] },
        { name: "Valdai", core: 0.0, fringe: 1.0, pts: [[32.5, 57.5], [34.0, 57.0]] },
        { name: "Volga Upland", core: 0.0, fringe: 1.0, pts: [[47.5, 54.0], [48.5, 53.0]] },
        { name: "Donets Ridge", core: 0.0, fringe: 0.8, pts: [[37.8, 48.4], [39.0, 48.2]] },
        { name: "Khibiny", core: 0.4, fringe: 0.9, pts: [[33.7, 67.7], [33.7, 67.7]] },
        { name: "Timan Ridge", core: 0.0, fringe: 1.0, pts: [[51.0, 64.0], [53.0, 66.0]] },
        { name: "Anatolian Plateau Hills", core: 0.0, fringe: 1.2, pts: [[32.0, 39.5], [34.5, 39.0]] },
        // central Anatolian massifs around Erciyes
        { name: "Erciyes massif", core: 0.9, fringe: 1.6, pts: [[34.6, 38.8], [35.45, 38.53], [36.2, 38.3]] },
        { name: "Hasan Dagi and Cappadocia", core: 0.7, fringe: 1.4, pts: [[33.6, 38.0], [34.2, 38.1], [34.8, 38.3]] },
        { name: "Tahtali-Binboga", core: 0.7, fringe: 1.4, pts: [[36.4, 38.9], [36.8, 38.4], [37.2, 37.9]] },
        { name: "Kizildag", core: 0.6, fringe: 1.3, pts: [[34.0, 39.4], [35.2, 39.6], [36.2, 39.3]] },
        { name: "Armenian Highlands", core: 0.5, fringe: 1.3, pts: [[44.0, 40.0], [45.5, 39.0]] },
        { name: "Aures", core: 0.5, fringe: 1.0, pts: [[6.0, 35.3], [7.0, 35.4]] },
        { name: "Middle Atlas", core: 0.4, fringe: 1.1, pts: [[-5.5, 33.5], [-4.0, 34.0]] },
        { name: "Cyrenaica", core: 0.0, fringe: 0.7, pts: [[21.5, 32.4], [21.5, 32.4]] },
        { name: "Apuseni", core: 0.3, fringe: 1.0, pts: [[22.7, 46.4], [23.2, 46.2]] },
        { name: "Serbian Highlands", core: 0.0, fringe: 1.1, pts: [[20.5, 43.5], [21.5, 43.0]] },
        { name: "Macedonian Highlands", core: 0.2, fringe: 1.0, pts: [[21.3, 41.8], [22.3, 41.2]] }
    ],

    // Biome overrides, applied in order after the latitude default
    biomeAreas: [
        { name: "Tropical belt", biome: "R", pts: [[-18, -5], [52, -5], [52, 12.5], [43.5, 11.3], [40, 12.5], [-18, 12.5]] },
        { name: "Sahel", biome: "P", pts: [[-18, 12.5], [40, 12.5], [43.5, 11.3], [43.5, 12.2], [40, 17.5], [-18, 17.5]] },
        // seven-band gradient from jungle to sand across the Sahel (random mixing in each band)
        { name: "Sahel band 1", biome: "R", prob: 0.7, pts: [[-18, 12.5], [40, 12.5], [40, 13.2], [-18, 13.2]] },
        { name: "Sahel band 2", biome: "R", prob: 0.4, pts: [[-18, 13.2], [40, 13.2], [40, 13.9], [-18, 13.9]] },
        { name: "Sahel band 3", biome: "R", prob: 0.15, pts: [[-18, 13.9], [40, 13.9], [40, 14.6], [-18, 14.6]] },
        { name: "Sahel band 5", biome: "D", prob: 0.25, pts: [[-18, 15.3], [40, 15.3], [40, 16.0], [-18, 16.0]] },
        { name: "Sahel band 6", biome: "D", prob: 0.5, pts: [[-18, 16.0], [40, 16.0], [40, 16.7], [-18, 16.7]] },
        { name: "Sahel band 7", biome: "D", prob: 0.75, pts: [[-18, 16.7], [40, 16.7], [40, 17.5], [-18, 17.5]] },
        { name: "Ethiopian Highlands", biome: "G", pts: [[35.0, 5.0], [41.5, 5.0], [42.5, 10.0], [41.0, 15.5], [37.0, 16.5], [34.5, 12.5]] },
        { name: "Somali plains", biome: "P", pts: [[42.0, 7.0], [52.0, 7.0], [52.0, 12.5], [45.0, 11.3], [43.5, 11.0]] },
        { name: "Yemen Highlands", biome: "P", pts: [[43.0, 13.0], [45.8, 13.0], [45.8, 17.0], [43.0, 17.5]] },
        { name: "Arabian interior (Nejd)", biome: "P", pts: [[41.5, 18.5], [47.5, 17.5], [50.5, 22.0], [47.0, 26.5], [42.0, 25.0]] },
        { name: "Nile Valley", biome: "G", pts: [[32.1, 15.3], [33.0, 15.3], [34.4, 17.6], [33.7, 19.6], [31.9, 21.6], [33.7, 24.0], [33.6, 25.8], [32.1, 27.2], [32.4, 29.6], [32.5, 30.2], [32.5, 31.3], [30.0, 31.4], [30.2, 30.3], [30.3, 27.0], [31.8, 25.6], [32.1, 24.2], [30.5, 21.6], [32.9, 19.4], [33.6, 17.7], [32.1, 16.2]] },
        { name: "Blue Nile", biome: "G", pts: [[32.5, 15.3], [33.5, 15.3], [37.3, 12.6], [36.7, 11.6]] },
        { name: "Sinai coast", biome: "G", pts: [[32.3, 30.6], [34.6, 30.8], [34.6, 31.5], [32.3, 31.7]] },
        { name: "Levant", biome: "P", pts: [[34.2, 31.2], [36.0, 31.2], [36.6, 33.0], [36.8, 36.0], [35.9, 37.0], [34.5, 36.5], [34.2, 32.5]] },
        { name: "Mesopotamia", biome: "P", pts: [[42.5, 34.5], [44.5, 36.5], [46.5, 36.5], [48.5, 33.0], [48.0, 30.0], [46.0, 30.5], [44.0, 32.0]] },
        { name: "Libyan Coast", biome: "P", pts: [[8.5, 33.5], [10.5, 32.5], [14.0, 32.3], [16.5, 31.0], [19.0, 30.4], [20.5, 31.5], [22.0, 32.3], [25.0, 31.4], [24.0, 32.5], [20.0, 33.0], [12.0, 33.5], [10.0, 35.0], [8.8, 35.0]] },
        { name: "Cyrenaica", biome: "G", pts: [[20.5, 32.2], [23.0, 32.3], [23.0, 33.0], [20.5, 33.0]] },
        { name: "Syrian Desert", biome: "D", pts: [[36.9, 32.8], [41.5, 32.8], [43.5, 34.0], [41.0, 35.5], [38.0, 35.3]] },
        { name: "Iranian Plateau", biome: "D", pts: [[52.0, 30.0], [60.0, 30.0], [60.0, 37.0], [55.5, 36.2], [52.5, 33.0]] },
        { name: "Hyrcania", biome: "G", pts: [[48.6, 36.2], [54.2, 36.2], [54.2, 37.9], [49.2, 37.9]] },
        { name: "Anatolian Black Sea Coast", biome: "G", pts: [[29.0, 40.6], [41.5, 40.4], [42.5, 42.0], [29.5, 41.8]] },
        { name: "Colchis", biome: "G", pts: [[40.0, 41.5], [46.0, 41.0], [47.0, 43.0], [41.0, 43.5]] },
        { name: "Steppe", biome: "P", pts: [[26.5, 45.2], [28.5, 47.0], [32.0, 49.3], [37.0, 50.6], [42.0, 51.2], [48.0, 52.2], [55.0, 53.0], [64.0, 52.5], [64.0, 44.5], [55.0, 44.5], [52.0, 45.5], [49.0, 46.8], [47.3, 46.5], [46.5, 44.5], [44.0, 44.8], [40.0, 45.5], [36.0, 45.0], [33.5, 46.2], [30.0, 46.4], [28.0, 45.0]] },
        { name: "Caspian Desert", biome: "D", pts: [[47.5, 43.2], [64.0, 42.0], [64.0, 48.5], [56.0, 49.0], [51.5, 48.2], [49.0, 47.0], [47.6, 45.5]] },
        { name: "Russian Taiga", biome: "T", pts: [[28.5, 57.0], [64.0, 56.5], [64.0, 72.0], [28.5, 72.0]] },
        { name: "Russian Mixed Forest", biome: "T", prob: 0.45, pts: [[30.0, 52.5], [64.0, 53.0], [64.0, 56.5], [28.5, 57.0]] },
        { name: "Green Spain", biome: "G", pts: [[-9.5, 42.5], [-1.0, 42.8], [-1.0, 43.9], [-9.5, 43.9]] },
        { name: "Po Valley", biome: "G", pts: [[7.0, 44.6], [12.5, 44.4], [12.5, 46.0], [7.0, 46.0]] },
        { name: "Norwegian Coast", biome: "G", pts: [[4.5, 58.0], [14.0, 63.0], [13.0, 66.0], [11.5, 66.0], [9.0, 63.5], [4.5, 62.5]] },
        { name: "Iceland", biome: "T", pts: [[-26, 62], [-11, 62], [-11, 69], [-26, 69]] },
        { name: "Southern Morocco", biome: "P", pts: [[-10.0, 29.8], [-6.5, 30.5], [-5.0, 32.5], [-8.0, 33.5], [-10.0, 32.0]] },
        { name: "Cyprus", biome: "P", pts: [[32, 34], [35, 34], [35, 36], [32, 36]] },
        // Random green patches in fertile Mediterranean and Near Eastern country (probabilistic)
        { name: "Jazira and SE Anatolia", biome: "G", prob: 0.5, pts: [[36.0, 35.8], [44.5, 35.4], [46.0, 38.0], [42.0, 40.0], [36.5, 38.5]] },
        { name: "Balkans", biome: "G", prob: 0.4, pts: [[19.0, 40.5], [28.5, 40.5], [28.5, 45.0], [19.0, 45.5]] },
        { name: "Greece", biome: "G", prob: 0.5, pts: [[20.0, 36.3], [26.5, 36.3], [26.5, 40.5], [20.0, 40.5]] },
        { name: "Italy and Sicily", biome: "G", prob: 0.4, pts: [[7.5, 36.5], [18.5, 36.5], [18.5, 44.5], [7.5, 44.5]] },
        { name: "Spain and Portugal", biome: "G", prob: 0.35, pts: [[-9.8, 36.0], [3.5, 36.0], [3.5, 43.0], [-9.8, 43.0]] },
        { name: "Atlas country", biome: "G", prob: 0.4, pts: [[-10.0, 30.0], [-5.0, 32.0], [0.0, 33.6], [9.0, 34.6], [11.2, 37.5], [-6.0, 36.2]] },
        { name: "Ukraine and the steppe east (green)", biome: "G", prob: 0.3, pts: [[26.0, 44.0], [56.0, 44.0], [56.0, 52.5], [26.0, 52.5]] },
        { name: "Persia (green)", biome: "G", prob: 0.3, pts: [[44.0, 27.0], [60.0, 27.0], [60.0, 40.0], [44.0, 40.0]] },
        { name: "Yemen and Oman coast (green)", biome: "G", prob: 0.3, pts: [[42.0, 12.5], [56.0, 12.5], [56.0, 19.5], [42.0, 19.5]] },
        { name: "Anatolia", biome: "G", prob: 0.35, pts: [[26.5, 36.5], [42.0, 36.5], [42.0, 41.5], [26.5, 41.5]] },
        // less green: a quarter of the temperate heartland is plains instead of grassland
        { name: "France (plains)", biome: "P", prob: 0.3, pts: [[-5.0, 42.6], [8.0, 42.6], [8.0, 51.2], [-5.0, 51.2]] },
        { name: "Germany and Poland (plains)", biome: "P", prob: 0.3, pts: [[6.0, 47.3], [24.0, 47.3], [24.0, 55.3], [6.0, 55.3]] },
        { name: "Hungary (plains)", biome: "P", prob: 0.3, pts: [[16.0, 45.5], [23.0, 45.5], [23.0, 48.8], [16.0, 48.8]] },
        { name: "Britain (plains)", biome: "P", prob: 0.3, pts: [[-6.2, 49.4], [5.0, 49.4], [5.0, 59.5], [-6.2, 59.5]] },

        // --- Cradles of civilization -------------------------------------------------
        // Flat desert yields no food, which left Egypt, the Levant and Mesopotamia the poorest
        // ground on the map - backwards for the regions that fed the first great cities. These
        // corridors are irrigated floodplain rather than strict geography: narrow green ribbons
        // along the rivers and the fertile coasts, with the deserts around them untouched.
        // Listed last, so they win over the Sahara and Arabian bands above.
        { name: "Nile valley", biome: "G", pts: [
            [31.7, 31.4], [31.9, 30.0], [31.9, 27.2], [33.3, 25.7], [33.6, 24.1], [32.2, 21.8],
            [31.5, 19.4], [32.7, 17.6], [33.2, 15.4],
            [31.8, 15.4], [31.3, 17.6], [30.1, 19.4], [30.8, 21.8], [31.9, 24.1], [31.9, 25.7],
            [30.5, 27.2], [30.5, 30.0], [30.3, 31.4]] },
        { name: "Nile delta", biome: "G", pts: [[29.4, 29.9], [32.5, 29.9], [32.5, 32.3], [29.4, 32.3]] },
        { name: "Mesopotamia (Tigris-Euphrates)", biome: "G", pts: [
            [37.5, 37.4], [44.5, 37.4], [49.0, 30.2], [47.2, 29.6], [43.0, 33.8], [39.5, 35.8], [37.2, 36.8]] },
        { name: "Levant coast and Jordan", biome: "G", pts: [[34.2, 30.8], [36.8, 30.8], [37.2, 37.0], [35.0, 37.0]] },
        { name: "Maghreb (Tell Atlas coast)", biome: "G", pts: [
            [-9.8, 33.2], [-5.5, 34.6], [-1.0, 35.2], [3.5, 36.0], [8.0, 36.3], [11.5, 33.5], [11.5, 38.0], [-9.8, 38.0]] },
        { name: "Cyrenaica (Jebel Akhdar)", biome: "G", pts: [[20.0, 31.8], [23.5, 31.8], [23.5, 33.2], [20.0, 33.2]] },
        // Tihamah: the Red Sea coastal plain of Arabia, one to two hexes wide - enough for
        // harbour cities without turning the Hejaz shore into a green belt.
        // Kilimanjaro needs mountain + plains; the East African massif is tropical by default.
        { name: "East African massif (plains)", biome: "P", pts: [[31.5, 4.0], [34.4, 4.0], [34.4, 8.0], [31.5, 8.0]] },
        { name: "Kilimanjaro massif (plains)", biome: "P", pts: [[15.5, 7.0], [19.5, 7.0], [19.5, 10.5], [15.5, 10.5]] },
        { name: "Tihamah (Red Sea coast)", biome: "G", pts: [[35.0, 28.8], [37.6, 28.8], [39.6, 25.0], [41.6, 20.5],
            [43.6, 17.0], [44.2, 12.8], [42.7, 12.8], [42.1, 17.0],
            [40.1, 20.5], [38.1, 25.0], [36.1, 28.8], [33.5, 28.8]] },

        // Southern Scandinavia: Denmark, Skane and the Swedish lowlands were farmed in antiquity,
        // so they are grassland rather than tundra. North of this the tundra stays, where the base
        // game's taiga gives it 1 food / 1 production / 1 culture per tile.
        { name: "Southern Scandinavia", biome: "G", prob: 0.7, pts: [[4.5, 55.0], [21.0, 55.0], [21.0, 61.0], [4.5, 61.0]] },
        { name: "Scandinavian coast (milder)", biome: "G", prob: 0.4, pts: [[4.5, 61.0], [16.0, 61.0], [16.0, 64.0], [4.5, 64.0]] }
    ],

    rainAreas: [
        { name: "Sahara", rain: 10, pts: [[-18, 17.5], [44, 17.5], [44, 27], [-18, 27]] },
        // rainfall for the cradle corridors is appended at the end of this list, so it wins
        { name: "Sahel", rain: 40, pts: [[-18, 12.5], [44, 12.5], [44, 17.5], [-18, 17.5]] },
        { name: "Western Sahel (wetter, more rivers)", rain: 95, pts: [[-18, 12.5], [20, 12.5], [20, 17.5], [-18, 17.5]] },
        { name: "Tropical belt", rain: 150, pts: [[-18, -5], [43, -5], [43, 12.5], [-18, 12.5]] },
        { name: "Guinea Coast rainforest", rain: 190, pts: [[-16, -5], [14, -5], [14, 8.5], [-16, 8.5]] },
        { name: "Ethiopian Highlands", rain: 140, pts: [[35.0, 5.0], [41.5, 5.0], [42.5, 10.0], [41.0, 15.5], [37.0, 16.5], [34.5, 12.5]] },
        { name: "Yemen Highlands", rain: 90, pts: [[43.0, 13.0], [45.8, 13.0], [45.8, 17.0], [43.0, 17.5]] },
        { name: "Arabian interior (Nejd)", rain: 40, pts: [[41.5, 18.5], [47.5, 17.5], [50.5, 22.0], [47.0, 26.5], [42.0, 25.0]] },
        { name: "Sinai coast", rain: 60, pts: [[32.3, 30.6], [34.6, 30.8], [34.6, 31.5], [32.3, 31.7]] },
        { name: "Nile Valley", rain: 60, pts: [[32.1, 15.3], [33.0, 15.3], [34.4, 17.6], [33.7, 19.6], [31.9, 21.6], [33.7, 24.0], [33.6, 25.8], [32.1, 27.2], [32.4, 29.6], [32.5, 30.2], [32.5, 31.3], [30.0, 31.4], [30.2, 30.3], [30.3, 27.0], [31.8, 25.6], [32.1, 24.2], [30.5, 21.6], [32.9, 19.4], [33.6, 17.7], [32.1, 16.2]] },
        { name: "Atlantic Europe", rain: 150, pts: [[-11.0, 47.5], [-11.0, 59.0], [-4.0, 62.5], [6.0, 66.0], [9.0, 63.0], [6.0, 58.0], [3.0, 51.0], [-1.0, 47.0]] },
        { name: "Alpine-Dinaric", rain: 140, pts: [[5.5, 44.0], [15.5, 47.5], [20.5, 42.0], [19.0, 40.5], [14.0, 44.5], [6.0, 43.6]] },
        { name: "Iberian Meseta", rain: 45, pts: [[-8.0, 37.5], [-1.0, 38.0], [-1.0, 42.0], [-8.0, 42.0]] },
        { name: "Steppe", rain: 50, pts: [[26.5, 45.2], [28.5, 47.0], [32.0, 49.3], [37.0, 50.6], [42.0, 51.2], [48.0, 52.2], [55.0, 53.0], [64.0, 52.5], [64.0, 44.5], [55.0, 44.5], [52.0, 45.5], [49.0, 46.8], [47.3, 46.5], [46.5, 44.5], [44.0, 44.8], [40.0, 45.5], [36.0, 45.0], [33.5, 46.2], [30.0, 46.4], [28.0, 45.0]] },
        { name: "Russian plain", rain: 70, pts: [[30.0, 50.0], [64.0, 50.0], [64.0, 57.0], [28.5, 57.0]] },
        { name: "Russian Taiga", rain: 80, pts: [[28.5, 57.0], [64.0, 56.5], [64.0, 72.0], [28.5, 72.0]] },
        { name: "Caspian Desert", rain: 15, pts: [[47.5, 43.2], [64.0, 42.0], [64.0, 48.5], [56.0, 49.0], [51.5, 48.2], [49.0, 47.0], [47.6, 45.5]] },
        { name: "Anatolian Plateau", rain: 100, pts: [[30.5, 37.8], [40.0, 37.8], [40.0, 40.3], [30.5, 40.3]] },
        { name: "Greece", rain: 110, pts: [[19.3, 35.5], [27.5, 35.5], [27.5, 41.8], [19.3, 41.8]] },
        { name: "Black Sea Coast", rain: 150, pts: [[29.0, 40.6], [41.5, 40.4], [42.5, 42.0], [29.5, 41.8]] },
        { name: "Colchis", rain: 160, pts: [[40.0, 41.5], [46.0, 41.0], [47.0, 43.0], [41.0, 43.5]] },
        { name: "Syrian Desert", rain: 10, pts: [[36.9, 32.8], [41.5, 32.8], [43.5, 34.0], [41.0, 35.5], [38.0, 35.3]] },
        { name: "Jazira and SE Anatolia", rain: 90, pts: [[36.0, 35.8], [44.5, 35.4], [46.0, 38.0], [42.0, 40.0], [36.5, 38.5]] },
        { name: "Iranian Plateau", rain: 10, pts: [[52.0, 30.0], [60.0, 30.0], [60.0, 37.0], [55.5, 36.2], [52.5, 33.0]] },
        { name: "Hyrcania", rain: 170, pts: [[48.6, 36.2], [54.2, 36.2], [54.2, 37.9], [49.2, 37.9]] },
        { name: "Ukraine and the steppe east (vegetated)", rain: 100, pts: [[26.0, 44.0], [56.0, 44.0], [56.0, 52.5], [26.0, 52.5]] },
        { name: "Persia (vegetated)", rain: 100, pts: [[44.0, 27.0], [60.0, 27.0], [60.0, 40.0], [44.0, 40.0]] },
        { name: "Yemen and Oman coast (vegetated)", rain: 100, pts: [[42.0, 12.5], [56.0, 12.5], [56.0, 19.5], [42.0, 19.5]] },
        // Cradles of civilization: enough rain for features on the irrigated corridors above.
        { name: "Nile valley (irrigated)", rain: 90, pts: [
            [31.7, 31.4], [31.9, 30.0], [31.9, 27.2], [33.3, 25.7], [33.6, 24.1], [32.2, 21.8],
            [31.5, 19.4], [32.7, 17.6], [33.2, 15.4],
            [31.8, 15.4], [31.3, 17.6], [30.1, 19.4], [30.8, 21.8], [31.9, 24.1], [31.9, 25.7],
            [30.5, 27.2], [30.5, 30.0], [30.3, 31.4]] },
        { name: "Nile delta (irrigated)", rain: 120, pts: [[29.4, 29.9], [32.5, 29.9], [32.5, 32.3], [29.4, 32.3]] },
        { name: "Mesopotamia (irrigated)", rain: 90, pts: [
            [37.5, 37.4], [44.5, 37.4], [49.0, 30.2], [47.2, 29.6], [43.0, 33.8], [39.5, 35.8], [37.2, 36.8]] },
        { name: "Levant coast and Jordan", rain: 95, pts: [[34.2, 30.8], [36.8, 30.8], [37.2, 37.0], [35.0, 37.0]] },
        { name: "Maghreb (Tell Atlas coast)", rain: 100, pts: [
            [-9.8, 33.2], [-5.5, 34.6], [-1.0, 35.2], [3.5, 36.0], [8.0, 36.3], [11.5, 33.5], [11.5, 38.0], [-9.8, 38.0]] },
        { name: "Cyrenaica (Jebel Akhdar)", rain: 95, pts: [[20.0, 31.8], [23.5, 31.8], [23.5, 33.2], [20.0, 33.2]] },
        { name: "Tihamah (Red Sea coast)", rain: 95, pts: [[35.0, 28.8], [37.6, 28.8], [39.6, 25.0], [41.6, 20.5],
            [43.6, 17.0], [44.2, 12.8], [42.7, 12.8], [42.1, 17.0],
            [40.1, 20.5], [38.1, 25.0], [36.1, 28.8], [33.5, 28.8]] }
    ],

    // Natural wonders.
    // `wonders` are attempted at an exact hex first; the engine validates the whole footprint
    // (Thera needs four coastal tiles, Kilimanjaro three adjacent mountains) and a placement that
    // does not fit is skipped with a log line rather than forced.
    // `requestedWonders` are handed to the base generator, which moves them to the front of its
    // shuffled list and forces their placement chance to 100%, so they are the ones that appear.
    wonders: [
        { feature: "FEATURE_THERA", lon: 25.4, lat: 36.4 },
        { feature: "FEATURE_KILIMANJARO", lon: 17.11, lat: 7.89 }
    ],
    requestedWonders: [
        "FEATURE_THERA", "FEATURE_VIHREN", "FEATURE_GULLFOSS", "FEATURE_KILIMANJARO",
        "FEATURE_GRAND_CANYON", "FEATURE_REDWOOD_FOREST", "FEATURE_MOUNT_EVEREST",
        "FEATURE_VALLEY_OF_FLOWERS", "FEATURE_ZHANGJIAJIE", "FEATURE_MACHAPUCHARE",
        "FEATURE_ULURU", "FEATURE_TORRES_DEL_PAINE", "FEATURE_IGUAZU_FALLS",
        "FEATURE_GREAT_BLUE_HOLE", "FEATURE_BARRIER_REEF"
    ],

    volcanoes: [
        // Etna removed: Sicily is only a few hexes wide here and an impassable volcano cost it too
        // much workable land. A single decorative cone on a one-hex Aeolian islet carries the fire.
        [15.10, 39.13, "Vulcano"], [14.43, 40.82, "Vesuvius"], [-19.31, 63.59, "Hekla"], 
        [44.3, 39.7, "Ararat"], [42.45, 43.35, "Elbrus"], [35.45, 38.53, "Erciyes"], [52.1, 35.95, "Damavand"],
        [40.7, 13.6, "Erta Ale"]
    ],

    tsl: {
        CIVILIZATION_ROME: [12.5, 41.9],
        CIVILIZATION_BYZANTIUM: [28.70, 41.30],   // Constantinople, Thracian shore of the Bosporus (Byzantium mod)
        CIVILIZATION_GREECE: [22.79, 39.28],   // Thermaic Gulf coast, north of Athens
        // America starts in Ireland. It is a Modern-age civilization, so the start only applies in
        // games where it is in play; the Dublin fallback site is left for when it is not.
        CIVILIZATION_AMERICA: [-6.64, 53.32],
        CIVILIZATION_EGYPT: [31.2, 30.0],
        CIVILIZATION_PERSIA: [48.5, 33.0],
        CIVILIZATION_CARTHAGE: [10.3, 36.8],
        CIVILIZATION_ASSYRIA: [43.1, 36.3],
        CIVILIZATION_AKSUM: [38.7, 14.1],
        CIVILIZATION_BULGARIA: [27.1, 43.4],
        CIVILIZATION_SPAIN: [-3.7, 40.4],
        CIVILIZATION_NORMAN: [1.1, 49.4],
        CIVILIZATION_ABBASID: [44.4, 33.3],
        CIVILIZATION_OTTOMANS: [32.9, 39.9],   // Ankara, central Anatolia - leaves Constantinople free to be settled
        CIVILIZATION_ICELAND: [-20.30, 63.81],
        CIVILIZATION_QAJAR: [51.4, 35.7],
        CIVILIZATION_MONGOLIA: [47.0, 48.0],
        CIVILIZATION_SONGHAI: [-0.05, 16.3],
        CIVILIZATION_PIRATE_REPUBLIC: [3.05, 36.75],
        CIVILIZATION_FRENCH_EMPIRE: [2.35, 48.85],
        CIVILIZATION_PRUSSIA: [13.4, 52.5],
        CIVILIZATION_RUSSIA: [37.6, 55.75],
        CIVILIZATION_GREAT_BRITAIN: [0.48, 51.41]
    },

    // Fallback start sites, best first: Morocco and Scandinavia are ranked high on this map
    fallbackSites: [
        [30.5, 50.4, "Kyiv"], [17.6, 59.9, "Uppsala"], [-5.0, 34.0, "Fez"], [19.9, 50.1, "Krakow"],
        [10.4, 63.4, "Trondheim"], [12.6, 55.7, "Copenhagen"], [-8.0, 31.6, "Marrakesh"], [19.0, 47.5, "Budapest"],
        [-6.64, 53.32, "Dublin"], [0.48, 51.41, "London"], [-9.1, 38.7, "Lisbon"], [-6.0, 37.4, "Seville"],
        [36.3, 33.5, "Damascus"], [20.5, 44.8, "Belgrade"], [44.8, 41.7, "Tbilisi"],
        [39.8, 21.4, "Mecca"], [44.2, 15.4, "Sanaa"], [33.7, 16.9, "Meroe"], [-3.0, 16.8, "Timbuktu"],
        [10.75, 59.9, "Oslo"], [-1.51, 55.82, "Edinburgh"], [49.1, 55.8, "Kazan"], [39.7, 47.2, "Rostov"],
        [4.8, 45.8, "Lyon"], [9.2, 45.5, "Milan"], [16.4, 48.2, "Vienna"], [31.3, 58.5, "Novgorod"],
        [24.1, 57.0, "Riga"], [15.3, 37.1, "Syracuse"], [21.9, 32.8, "Cyrene"], [13.2, 32.9, "Tripoli"],
        [8.5, 12.0, "Kano"], [1.4, 43.6, "Toulouse"], [14.25, 40.85, "Naples"], [21.0, 52.2, "Warsaw"],
        [26.1, 44.4, "Bucharest"], [30.3, 59.95, "Petersburg"], [25.0, 60.2, "Helsinki"], [-0.98, 53.50, "Manchester"],
        [42.0, 36.5, "Mosul"], [14.4, 50.1, "Prague"], [2.35, 48.85, "Paris"], [13.4, 52.5, "Berlin"],
        [37.6, 55.75, "Moscow"], [12.5, 41.9, "Rome"], [23.7, 38.0, "Athens"], [31.2, 30.0, "Memphis"],
        [10.3, 36.8, "Carthage"], [29.1, 40.2, "Bursa"], [-3.7, 40.4, "Toledo"], [44.4, 33.3, "Baghdad"],
        [43.1, 36.3, "Nineveh"], [27.1, 43.4, "Pliska"], [3.05, 36.75, "Algiers"], [47.0, 48.0, "Sarai"],
        [48.5, 33.0, "Susa"], [51.4, 35.7, "Tehran"], [1.1, 49.4, "Rouen"], [-20.30, 63.81, "Reykjavik"],
        [38.7, 14.1, "Axum"], [-0.05, 16.3, "Gao"],
        // --- Sahel and West Africa (Songhai, Mali, Kanem-Bornu heartland) ---
        [-8.00, 12.65, "Bamako"], [-4.55, 13.91, "Djenne"], [-1.53, 12.37, "Ouagadougou"],
        [2.11, 13.51, "Niamey"], [8.99, 13.80, "Zinder"], [13.00, 12.90, "Ngazargamu"],
        [29.84, 31.78, "Alexandria"],
        // Thracian (European) shore. 28.98/41.01 fell through to the Asian side on the 128x112 grid.
        [28.70, 41.30, "Constantinople"],
        // Mediterranean ports and a fuller Germany / western France
        [2.17, 41.39, "Barcelona"], [5.37, 43.30, "Marseille"], [13.10, 45.55, "Venice"],
        [9.99, 53.55, "Hamburg"], [6.96, 50.94, "Cologne"], [-1.55, 47.22, "Nantes"],
        [25.5, 29.2, "Siwa"], [29.4, 22.0, "Selima"], [24.5, 17.6, "Ounianga"],
        [-11.44, 14.45, "Kayes"], [5.27, 14.89, "Tahoua"],
        // --- Horn of Africa and the Red Sea ---
        [37.47, 12.60, "Gondar"], [39.47, 15.61, "Massawa"], [42.13, 9.31, "Harar"],
        [43.47, 11.36, "Zeila"],
        // --- Ukraine, the Pontic steppe and the western Rus ---
        [24.03, 49.84, "Lviv"], [28.86, 47.01, "Chisinau"], [30.73, 46.48, "Odesa"],
        [35.14, 47.84, "Zaporizhzhia"], [36.23, 49.99, "Kharkiv"], [31.29, 51.49, "Chernihiv"],
        [32.05, 54.78, "Smolensk"]
    ]
};


// europe-geo.js
// Geography for the "Europe & Mediterranean" map, expressed in longitude/latitude.
// Everything here is pure data; europe-raster.js turns it into a hex grid.
//
// Coordinates are [lon, lat] in degrees (east/north positive).
// Widths/radii are expressed in hex tiles.

window.DEFAULT_EUROPE_GEO = {
    // ---- projection -------------------------------------------------
    lonCenter: 19.0,     // longitude of the middle column
    spanRef: 82,         // degrees of longitude covered by one row at latRef
    latRef: 47,          // reference parallel (no horizontal stretch here)
    scaleExp: 0.5,       // 0 = plain equirectangular, 1 = area-true per row
    latBottom: 27.5,     // latitude of the bottom row
    latTop: 71.0,        // latitude of the top row
    // No Distant Lands on this map: north of 27.5N Europe, North Africa and the Near East are
    // one connected landmass, so any split would cut through walkable ground.
    distantLandsAnchors: [],

    // ---- land polygons -----------------------------------------------
    land: [
        {
            name: "Mainland", pts: [
                // North-west Africa, Atlantic coast (south to north)
                [-13.5, 26.5], [-13.0, 27.9], [-11.5, 28.8], [-9.6, 30.4], [-9.8, 31.5], [-9.3, 32.3], [-8.5, 33.2],
                [-7.6, 33.6], [-6.8, 34.0], [-6.3, 35.0], [-5.9, 35.75],
                // Maghreb Mediterranean coast (west to east)
                [-5.3, 35.85], [-4.5, 35.2], [-3.0, 35.3], [-1.5, 35.45], [-0.65, 35.7], [0.1, 35.9], [1.5, 36.4],
                [3.05, 36.75], [3.9, 36.9], [5.07, 36.75], [5.8, 36.8], [6.9, 36.9], [7.75, 36.9], [8.75, 36.95],
                [9.85, 37.3], [11.05, 37.05], [10.6, 36.4], [10.6, 35.8], [11.05, 35.5], [10.75, 34.75], [10.1, 33.9],
                [11.1, 33.5], [12.0, 33.1], [13.2, 32.9], [14.3, 32.65], [15.1, 32.4], [15.7, 31.6], [16.6, 31.2],
                [18.3, 30.5], [19.9, 30.6], [20.05, 31.4], [20.05, 32.1], [20.9, 32.7], [21.9, 32.9], [22.6, 32.75],
                [23.95, 32.1], [25.15, 31.55], [25.9, 31.6], [27.2, 31.35], [28.9, 30.85], [29.9, 31.2], [30.4, 31.45],
                [31.8, 31.5], [32.3, 31.25], [33.0, 31.1], [33.8, 31.15], [34.25, 31.3], [34.45, 31.5], [34.65, 31.8],
                // Levant (south to north)
                [34.75, 32.1], [34.95, 32.8], [35.07, 32.93], [35.2, 33.27], [35.37, 33.56], [35.5, 33.9], [35.83, 34.43],
                [35.87, 34.9], [35.78, 35.52], [35.95, 36.1], [36.17, 36.6], [36.2, 36.85], [35.8, 36.77], [35.4, 36.55],
                // Southern Anatolia (east to west)
                [34.63, 36.8], [33.9, 36.35], [32.83, 36.05], [32.3, 36.27], [32.0, 36.55], [31.4, 36.77], [30.7, 36.88],
                [30.55, 36.6], [30.15, 36.3], [29.64, 36.2], [29.1, 36.65], [28.8, 36.7], [28.27, 36.85], [27.7, 36.75],
                // Aegean coast of Anatolia (south to north)
                [27.43, 37.03], [27.27, 37.38], [27.26, 37.86], [26.7, 38.1], [26.3, 38.32], [26.75, 38.67], [26.97, 38.8],
                [26.69, 39.32], [27.0, 39.6], [26.07, 39.48], [26.35, 40.05],
                // Marmara, Asian shore (west to east), then Bosporus
                [26.7, 40.35], [27.97, 40.35], [28.9, 40.37], [29.27, 40.65], [29.9, 40.75], [29.4, 40.8], [29.05, 41.0],
                [29.15, 41.2],
                // Black Sea, Anatolian shore (west to east)
                [29.6, 41.18], [30.2, 41.2], [31.4, 41.28], [31.8, 41.45], [32.4, 41.75], [33.0, 41.9], [33.77, 41.98],
                [35.15, 42.03], [35.9, 41.6], [36.33, 41.3], [37.3, 41.13], [37.88, 40.98], [38.4, 40.92], [39.73, 41.0],
                [40.5, 41.03], [41.4, 41.4], [41.63, 41.65],
                // Caucasus Black Sea shore (south to north)
                [41.67, 42.15], [41.0, 43.0], [40.27, 43.28], [39.72, 43.58], [39.07, 44.1], [37.77, 44.72], [37.32, 44.9],
                [36.72, 45.2],
                // Sea of Azov (clockwise around, via Don mouth)
                [37.4, 45.3], [38.17, 46.05], [38.27, 46.7], [39.4, 47.15], [38.9, 47.2], [37.55, 47.1], [36.8, 46.75],
                [35.6, 46.5], [34.8, 46.17],
                // Crimea
                [35.2, 45.8], [35.5, 45.4], [36.5, 45.35], [36.4, 45.1], [35.38, 45.03], [34.97, 44.85], [34.4, 44.67],
                [34.17, 44.5], [33.7, 44.4], [33.52, 44.6], [33.37, 45.2], [32.55, 45.35], [32.7, 45.5], [33.2, 45.9],
                [33.6, 46.05],
                // Northern Black Sea (east to west)
                [32.9, 46.1], [32.0, 46.5], [31.55, 46.6], [30.73, 46.48], [30.35, 46.2], [29.75, 45.35], [29.65, 45.15],
                [28.65, 44.17], [28.58, 43.8], [27.92, 43.2], [27.73, 42.65], [27.47, 42.5], [27.85, 42.17], [28.1, 41.63],
                [29.0, 41.25],
                // Marmara, European shore (east to west) and Thrace
                [28.95, 41.02], [28.25, 41.07], [27.5, 40.98], [27.1, 40.62], [26.67, 40.42], [26.2, 40.05], [26.4, 40.55],
                [26.08, 40.72], [25.87, 40.85], [24.4, 40.93], [24.0, 40.4], [24.3, 40.15], [23.6, 40.0], [23.4, 39.95],
                [23.3, 40.3], [22.95, 40.63], [22.6, 40.25], [22.6, 39.9],
                // Thessaly, Euboea, Attica
                [22.95, 39.35], [23.4, 39.0], [24.1, 38.6], [24.55, 38.0], [24.05, 37.65], [23.6, 37.93], [23.4, 38.0],
                [22.95, 37.92],
                // Peloponnese
                [23.15, 37.65], [22.85, 37.55], [22.9, 37.15], [23.05, 36.7], [23.2, 36.45], [22.9, 36.55], [22.55, 36.75],
                [22.5, 36.4], [22.3, 36.7], [22.1, 37.05], [21.95, 36.8], [21.7, 36.82], [21.7, 36.95], [21.65, 37.25],
                [21.35, 37.65], [21.4, 38.15], [21.75, 38.25], [21.9, 38.3],
                // Western Greece, Albania, Adriatic east coast (south to north)
                [21.85, 38.35], [21.4, 38.35], [21.1, 38.5], [20.75, 38.95], [20.4, 39.28], [20.25, 39.5], [20.0, 39.85],
                [19.5, 40.45], [19.45, 41.32], [19.4, 41.9], [19.1, 42.1], [18.7, 42.45], [18.1, 42.65], [17.4, 43.0],
                [16.45, 43.5], [15.9, 43.73], [15.23, 44.12], [14.9, 45.0], [14.45, 45.33], [13.85, 44.87], [13.65, 45.08],
                [13.77, 45.65], [13.5, 45.8],
                // Italy, Adriatic coast (north to south)
                [12.35, 45.43], [12.5, 44.95], [12.3, 44.42], [12.57, 44.06], [13.5, 43.62], [13.9, 42.95], [14.22, 42.47],
                [15.0, 42.0], [16.18, 41.88], [15.9, 41.62], [16.28, 41.32], [16.87, 41.12], [17.3, 40.95], [17.94, 40.64],
                [18.5, 40.15], [18.36, 39.8], [17.97, 40.05], [17.23, 40.47], [16.8, 40.38], [16.5, 39.75], [17.13, 39.08],
                [16.6, 38.75], [16.1, 37.93], [15.65, 38.1],
                // Italy, Tyrrhenian coast (south to north)
                [15.63, 38.3], [15.65, 38.68], [16.05, 39.35], [15.78, 39.9], [15.63, 40.07], [15.28, 40.03], [14.75, 40.68],
                [14.37, 40.63], [14.25, 40.85], [14.1, 40.8], [13.57, 41.22], [12.62, 41.45], [12.28, 41.73], [11.8, 42.1],
                [11.2, 42.45], [10.5, 42.93], [10.3, 43.55], [9.85, 44.1], [8.93, 44.4], [8.48, 44.3], [8.03, 43.88],
                // Riviera, Provence, Languedoc, Catalonia
                [7.27, 43.7], [5.93, 43.1], [5.37, 43.3], [4.7, 43.4], [3.7, 43.4], [3.1, 43.1], [3.05, 42.7], [3.3, 42.3],
                [3.15, 42.25], [2.17, 41.38], [1.25, 41.1], [0.85, 40.7], [0.05, 39.95], [-0.35, 39.45], [0.2, 38.75],
                [-0.5, 38.35], [-1.0, 37.6], [-2.2, 36.72], [-2.45, 36.85], [-3.5, 36.72], [-4.4, 36.7], [-4.9, 36.5],
                [-5.35, 36.13], [-5.6, 36.02], [-6.3, 36.5], [-6.4, 36.8], [-6.95, 37.2], [-7.95, 37.0], [-8.98, 37.0],
                // Portugal and Atlantic Spain (south to north)
                [-8.85, 37.95], [-8.9, 38.5], [-9.2, 38.7], [-9.5, 38.78], [-9.4, 39.35], [-8.85, 40.15], [-8.75, 40.65],
                [-8.65, 41.15], [-8.85, 41.7], [-8.8, 42.25], [-9.28, 42.9], [-8.4, 43.37], [-7.85, 43.77], [-7.05, 43.55],
                [-5.65, 43.55], [-3.8, 43.47], [-2.95, 43.35], [-1.98, 43.32],
                // France, Atlantic coast (south to north)
                [-1.55, 43.48], [-1.25, 44.65], [-1.1, 45.6], [-1.15, 46.15], [-1.8, 46.5], [-2.2, 47.25], [-2.9, 47.55],
                [-3.4, 47.7], [-4.4, 47.8], [-4.75, 48.35], [-4.8, 48.5], [-3.95, 48.72], [-2.75, 48.55], [-2.0, 48.65],
                [-1.5, 48.65], [-1.6, 48.85], [-1.62, 49.65], [-1.25, 49.7], [-0.35, 49.3], [0.1, 49.5], [1.1, 49.93],
                [1.6, 50.73], [1.85, 50.95], [2.37, 51.05],
                // Low Countries, German Bight, Jutland west coast
                [2.9, 51.23], [3.6, 51.45], [4.1, 51.95], [4.75, 52.95], [5.5, 53.35], [6.5, 53.45], [7.2, 53.5],
                [8.1, 53.6], [8.7, 53.9], [8.6, 54.3], [8.4, 54.9], [8.4, 55.5], [8.1, 56.1], [8.2, 56.7], [8.6, 57.1],
                [10.6, 57.75],
                // Jutland east coast, German Baltic coast, Poland, Baltic states
                [10.55, 57.45], [10.9, 56.4], [10.2, 56.15], [9.75, 55.55], [9.4, 55.05], [9.45, 54.8], [10.15, 54.35],
                [10.7, 53.87], [11.45, 53.9], [12.1, 54.1], [12.5, 54.45], [13.4, 54.65], [13.4, 54.1], [14.2, 53.9],
                [15.6, 54.18], [16.85, 54.58], [17.55, 54.77], [18.35, 54.83], [18.8, 54.6], [18.65, 54.4], [19.5, 54.4],
                [20.0, 54.95], [21.0, 55.4], [21.1, 55.7], [21.0, 56.5], [21.55, 57.4], [22.6, 57.75], [23.1, 57.3],
                [24.1, 57.0], [24.5, 58.4], [23.5, 58.6], [23.55, 58.95], [24.75, 59.45], [28.0, 59.45], [30.3, 59.95],
                // Finland
                [28.75, 60.7], [26.9, 60.45], [24.95, 60.15], [23.0, 59.83], [22.25, 60.45], [21.4, 60.8], [21.5, 61.5],
                [21.6, 63.1], [23.1, 63.85], [25.45, 65.0], [24.55, 65.75], [24.15, 65.85],
                // Sweden, Bothnian and Baltic coast (north to south)
                [22.15, 65.6], [21.0, 64.75], [20.3, 63.8], [18.7, 63.3], [17.95, 62.63], [17.3, 62.4], [17.1, 61.75],
                [17.15, 60.7], [18.45, 60.35], [18.1, 59.35], [17.95, 58.9], [16.5, 58.6], [16.65, 57.75], [16.35, 56.65],
                [15.6, 56.15], [13.8, 55.4], [13.0, 55.6], [12.7, 56.05], [12.85, 56.65], [11.95, 57.7], [11.15, 58.95],
                // Norway (south, then up the west coast)
                [10.95, 59.2], [10.75, 59.9], [10.2, 59.75], [10.0, 59.05], [8.0, 58.15], [7.05, 57.98], [6.0, 58.45],
                [5.7, 58.97], [5.27, 59.4], [5.3, 60.4], [4.9, 61.05], [5.0, 61.6], [5.1, 62.2], [6.15, 62.47], [7.7, 63.1],
                [9.6, 63.7], [11.2, 64.85], [12.2, 65.5], [12.6, 66.0], [14.4, 67.3], [13.0, 68.15], [14.6, 68.25],
                [16.5, 68.8], [16.1, 69.3], [18.95, 69.65], [21.5, 70.2], [23.7, 70.65], [25.8, 71.15], [27.9, 71.1],
                [31.1, 70.35],
                // Kola, White Sea, Arctic Russia
                [30.0, 69.7], [31.2, 69.7], [34.0, 69.3], [40.0, 68.15], [41.1, 67.0], [38.5, 66.2], [36.0, 66.4],
                [33.5, 66.8], [32.4, 67.15], [33.3, 66.3], [34.6, 65.0], [34.8, 64.5], [36.5, 64.2], [38.1, 63.9],
                [40.5, 64.55], [41.5, 65.4], [44.2, 65.9], [43.3, 68.65], [46.5, 67.0], [49.0, 67.7], [52.0, 68.5],
                [54.5, 68.4], [57.5, 68.6], [59.0, 69.8], [60.5, 69.5], [64.0, 68.9], [66.0, 68.0],
                // Closing edge (outside the map window)
                [70.0, 68.0], [70.0, 26.0], [-14.0, 26.0]
            ]
        },
        {
            name: "Great Britain", pts: [
                [-5.7, 50.07], [-5.2, 49.97], [-4.15, 50.35], [-3.5, 50.45], [-2.45, 50.55], [-1.3, 50.6], [-0.8, 50.75],
                [0.25, 50.75], [1.35, 51.13], [1.45, 51.38], [0.7, 51.55], [1.15, 51.8], [1.6, 52.1], [1.75, 52.48],
                [1.3, 52.93], [0.35, 52.85], [0.35, 53.15], [0.1, 53.57], [-0.1, 54.12], [-0.4, 54.28], [-0.6, 54.49],
                [-1.15, 54.65], [-1.35, 54.9], [-1.4, 55.0], [-2.0, 55.77], [-2.15, 55.9], [-2.5, 56.0], [-3.3, 56.05],
                [-2.6, 56.28], [-2.9, 56.45], [-2.6, 56.55], [-2.1, 57.15], [-1.8, 57.5], [-2.0, 57.7], [-2.5, 57.68],
                [-3.3, 57.72], [-4.25, 57.5], [-4.0, 57.7], [-4.0, 57.87], [-3.65, 58.12], [-3.1, 58.45], [-3.0, 58.65],
                [-3.5, 58.6], [-5.0, 58.63], [-5.05, 58.45], [-5.15, 57.9], [-5.7, 57.73], [-5.7, 57.28], [-5.85, 57.0],
                [-6.2, 56.72], [-5.5, 56.4], [-5.7, 55.65], [-5.8, 55.3], [-5.3, 55.5], [-4.65, 55.45], [-4.85, 55.25],
                [-5.05, 54.9], [-4.95, 54.63], [-4.05, 54.8], [-3.3, 54.9], [-3.55, 54.65], [-3.6, 54.5], [-3.2, 54.1],
                [-3.05, 53.8], [-3.05, 53.45], [-3.2, 53.35], [-3.5, 53.32], [-4.55, 53.4], [-4.7, 53.3], [-4.3, 53.1],
                [-4.75, 52.8], [-4.05, 52.7], [-4.1, 52.4], [-4.7, 52.1], [-5.3, 51.88], [-5.0, 51.65], [-3.95, 51.6],
                [-3.2, 51.45], [-2.6, 51.6], [-3.0, 51.35], [-3.5, 51.2], [-4.1, 51.2], [-4.55, 51.0], [-4.55, 50.8],
                [-4.95, 50.55], [-5.1, 50.42], [-5.5, 50.2]
            ]
        },
        {
            name: "Ireland", pts: [
                [-7.4, 55.38], [-6.15, 55.22], [-5.9, 54.6], [-5.5, 54.3], [-6.3, 54.0], [-6.15, 53.35], [-6.0, 52.98],
                [-6.35, 52.2], [-6.95, 52.15], [-8.3, 51.8], [-9.8, 51.45], [-10.4, 52.1], [-9.9, 52.6], [-9.05, 53.27],
                [-10.1, 53.4], [-10.2, 54.0], [-10.0, 54.3], [-8.5, 54.3], [-8.3, 54.6], [-8.3, 55.15]
            ]
        },
        {
            name: "Iceland", pts: [
                [-22.0, 64.05], [-21.4, 63.85], [-19.0, 63.4], [-18.0, 63.5], [-16.5, 63.8], [-15.2, 64.25], [-14.0, 64.7],
                [-13.6, 65.1], [-13.8, 65.6], [-14.5, 66.4], [-16.0, 66.5], [-18.0, 66.15], [-20.0, 66.1], [-21.5, 65.7],
                [-23.5, 66.3], [-24.4, 65.5], [-22.5, 65.0], [-24.0, 64.85], [-22.5, 64.6]
            ]
        },
        {
            name: "Sicily", pts: [
                [15.6, 38.25], [13.35, 38.15], [12.5, 38.0], [12.45, 37.8], [12.6, 37.65], [13.1, 37.5], [13.6, 37.28],
                [14.25, 37.05], [14.85, 36.7], [15.15, 36.68], [15.3, 37.07], [15.1, 37.5], [15.3, 37.85]
            ]
        },
        {
            name: "Sardinia", pts: [
                [9.2, 41.25], [9.6, 41.0], [9.55, 40.9], [9.7, 40.4], [9.65, 39.5], [9.1, 39.2], [8.5, 38.9], [8.4, 39.5],
                [8.5, 39.9], [8.3, 40.55], [8.2, 40.9], [8.4, 41.1]
            ]
        },
        {
            name: "Corsica", pts: [
                [9.45, 43.0], [9.45, 42.7], [9.55, 42.1], [9.2, 41.4], [8.7, 41.9], [8.6, 42.4], [9.3, 42.95]
            ]
        },
        {
            name: "Crete", pts: [
                [23.5, 35.3], [24.5, 35.5], [25.7, 35.35], [26.3, 35.2], [26.1, 35.0], [25.0, 34.95], [24.0, 35.0]
            ]
        },
        {
            name: "Cyprus", pts: [
                [32.3, 35.0], [32.9, 35.4], [34.05, 35.5], [34.6, 35.7], [34.0, 35.0], [33.0, 34.6]
            ]
        },
        {
            name: "Mallorca", pts: [
                [2.35, 39.55], [3.1, 39.95], [3.5, 39.7], [3.1, 39.3], [2.5, 39.45]
            ]
        },
        {
            name: "Gotland", pts: [
                [18.1, 57.25], [18.6, 57.9], [19.1, 57.9], [18.8, 57.05]
            ]
        },
        {
            name: "Oland", pts: [
                [16.35, 56.2], [16.9, 57.1], [17.15, 57.35], [16.55, 56.2]
            ]
        },
        {
            name: "Saaremaa", pts: [
                [21.9, 58.2], [22.0, 58.9], [22.5, 59.05], [23.0, 58.85], [23.3, 58.5], [23.0, 58.1]
            ]
        },
        {
            name: "Novaya Zemlya", pts: [
                [51.8, 70.7], [53.5, 71.4], [56.5, 72.5], [55.0, 71.0], [53.0, 70.6]
            ]
        }
    ],

    // Small islands: [lon, lat, radius in tiles]
    landBlobs: [
        [4.1, 39.9, 0.5, "Menorca"], [1.4, 38.95, 0.5, "Ibiza"], [14.9, 55.1, 0.5, "Bornholm"], [20.0, 60.2, 0.5, "Aland"],
        [28.0, 36.3, 0.5, "Rhodes"], [26.3, 39.2, 0.5, "Lesbos"], [26.0, 38.4, 0.5, "Chios"], [25.4, 37.1, 0.5, "Naxos"],
        [25.4, 36.4, 0.5, "Santorini"], [19.85, 39.65, 0.5, "Corfu"], [20.55, 38.2, 0.5, "Kefalonia"], [25.2, 39.9, 0.5, "Lemnos"],
        [14.45, 35.9, 0.5, "Malta"], [-6.9, 62.0, 0.5, "Faroe"], [-1.3, 60.4, 0.5, "Shetland"], [-3.0, 59.0, 0.5, "Orkney"],
        [-6.7, 58.1, 0.6, "Lewis"], [-6.2, 57.4, 0.5, "Skye"], [-4.5, 54.2, 0.5, "Man"], [49.0, 69.1, 0.6, "Kolguyev"]
    ],

    // Islands painted after the strait lines, so one-tile islands between straits survive
    landBlobsLate: [
        [11.9, 55.45, 0.6, "Zealand"]
    ],

    // Water polygons painted on top of land (inland seas)
    water: [
        {
            name: "Caspian Sea", pts: [
                [48.0, 46.2], [51.5, 46.8], [53.0, 46.6], [52.7, 45.3], [51.2, 44.6], [51.0, 43.2], [52.8, 41.9], [53.0, 40.6],
                [53.0, 40.0], [53.9, 38.9], [53.9, 37.6], [53.9, 37.0], [52.0, 36.7], [51.0, 36.75], [49.5, 37.5],
                [48.9, 38.4], [48.85, 38.8], [50.3, 40.3], [49.8, 40.7], [49.5, 41.5], [48.3, 42.0], [47.5, 43.0],
                [47.5, 44.0], [47.0, 45.0], [47.3, 46.0]
            ]
        },
        {
            name: "Aral Sea", pts: [
                [58.2, 46.2], [59.5, 46.9], [61.7, 46.3], [61.3, 44.0], [58.5, 43.7]
            ]
        },
        {
            name: "Persian Gulf", pts: [
                [48.0, 30.05], [47.7, 29.4], [48.4, 28.8], [49.3, 27.4], [50.3, 26.2], [50.5, 25.5], [57.0, 25.5], [56.5, 27.0],
                [55.5, 26.8], [54.5, 26.7], [53.0, 27.4], [52.0, 27.9], [51.0, 28.9], [50.0, 29.9], [49.0, 30.4]
            ]
        },
        {
            name: "Red Sea", pts: [
                [32.55, 29.95], [32.35, 29.3], [32.8, 28.4], [33.4, 27.6], [33.9, 26.8], [34.5, 25.5], [36.0, 25.5], [35.7, 26.8],
                [35.2, 27.8], [34.95, 28.4], [35.0, 29.55], [34.7, 29.55], [34.45, 28.6], [34.25, 27.75], [33.5, 28.3],
                [32.9, 29.2], [32.6, 29.9]
            ]
        },
        {
            name: "Marmara", pts: [
                [26.7, 40.35], [28.0, 40.4], [29.0, 40.4], [29.3, 40.7], [29.0, 41.0], [28.0, 41.0], [27.0, 40.6]
            ]
        }
    ],

    // Straits and channels: one-tile-wide water lines that must stay open
    waterLines: [
        { name: "Gibraltar", pts: [[-6.3, 35.95], [-4.8, 36.1]] },
        { name: "Dardanelles-Marmara-Bosporus", pts: [[25.9, 39.95], [26.5, 40.3], [27.5, 40.7], [28.6, 40.75], [29.05, 41.05], [29.2, 41.4]] },
        { name: "Kerch", pts: [[36.5, 45.15], [36.9, 45.5]] },
        { name: "Messina", pts: [[15.5, 38.4], [15.7, 38.05], [15.9, 37.8]] },
        { name: "Otranto", pts: [[18.9, 40.1], [19.3, 40.45]] },
        { name: "English Channel", pts: [[-5.2, 49.4], [-3.0, 49.75], [-1.0, 50.15], [0.5, 50.45], [1.4, 50.95], [2.2, 51.45]] },
        { name: "Oresund", pts: [[12.4, 56.25], [12.7, 55.75], [12.75, 55.3]] },
        { name: "Great Belt", pts: [[10.8, 55.95], [10.9, 55.45], [11.0, 54.9]] },
        { name: "Fehmarn Belt", pts: [[11.05, 54.55], [11.6, 54.4]] },
        { name: "Bonifacio", pts: [[8.9, 41.3], [9.6, 41.35]] },
        { name: "North Channel", pts: [[-6.1, 54.9], [-5.6, 55.4], [-5.5, 55.85]] },
        { name: "Gulf of Corinth", pts: [[21.8, 38.3], [22.4, 38.25], [22.75, 38.18]] },
        { name: "White Sea mouth", pts: [[40.5, 66.8], [39.0, 66.1], [37.0, 65.3]] },
        { name: "Gulf of Finland", pts: [[24.0, 59.9], [27.0, 59.85], [29.5, 60.0]] },
        { name: "Gulf of Riga", pts: [[22.8, 57.6], [23.6, 57.6]] },
        { name: "Bristol Channel", pts: [[-5.0, 51.35], [-3.5, 51.4]] },
        { name: "Skagerrak", pts: [[8.5, 57.5], [10.6, 57.9]] },
        { name: "Euripus", pts: [[23.2, 38.85], [23.6, 38.55]] },
        { name: "Gulf of Suez", pts: [[32.55, 29.9], [33.0, 28.7], [33.7, 27.6], [34.4, 26.6]] },
        { name: "Gulf of Aqaba", pts: [[35.0, 29.5], [34.7, 28.6], [34.4, 27.8]] }
    ],

    // Lakes: [lon, lat, radius in tiles, name]
    lakes: [
        [31.3, 60.85, 1.3, "Ladoga"], [35.4, 61.9, 1.0, "Onega"], [13.2, 58.9, 0.9, "Vanern"], [14.5, 58.3, 0.5, "Vattern"],
        [28.4, 61.6, 0.6, "Saimaa"], [27.5, 58.6, 0.6, "Peipus"], [31.3, 58.3, 0.5, "Ilmen"], [17.8, 46.85, 0.5, "Balaton"],
        [6.5, 46.4, 0.5, "Geneva"], [9.4, 47.6, 0.5, "Constance"], [43.0, 38.6, 0.6, "Van"], [33.4, 38.75, 0.5, "Tuz"],
        [45.5, 37.6, 0.6, "Urmia"], [45.3, 40.4, 0.5, "Sevan"], [35.5, 31.5, 0.5, "Dead Sea"], [27.8, 69.0, 0.5, "Inari"],
        [37.6, 60.2, 0.5, "Beloye"], [-6.4, 54.6, 0.5, "Neagh"], [16.9, 59.45, 0.5, "Malaren"], [10.65, 45.65, 0.5, "Garda"],
        [20.7, 41.05, 0.5, "Ohrid"], [19.3, 42.2, 0.5, "Skadar"], [31.4, 37.75, 0.5, "Egirdir"], [5.3, 52.7, 0.5, "IJsselmeer"],
        [24.9, 68.0, 0.5, "Enontekio"], [32.9, 67.8, 0.5, "Imandra"], [8.3, 33.75, 0.6, "Chott el Djerid"]
    ],

    // Seas where every water tile is shallow coast (fully navigable in Antiquity)
    shallow: [
        { name: "Mediterranean", pts: [[-7, 35], [-7, 37], [0, 40], [3, 44], [9, 45], [14, 46], [19, 43], [23, 41.5], [26.5, 41], [27, 40.5], [26.5, 39], [28, 37], [30, 37.5], [35, 37.5], [37, 36], [36, 32], [34, 31], [30, 31], [20, 30], [10, 33], [5, 35], [-2, 35]] },
        { name: "Black Sea", pts: [[27, 41], [27.5, 47.5], [40, 47.5], [42, 41], [30, 40.5]] },
        { name: "Baltic", pts: [[7.0, 56.5], [7.0, 59.2], [10.5, 59.5], [16.5, 61.0], [19.0, 64.0], [21.0, 66.2], [25.5, 66.2], [26.0, 64.0], [23.0, 62.0], [31.0, 60.5], [31.0, 59.0], [22.0, 56.5], [21.0, 54.0], [10.0, 53.5], [9.5, 55.0]] },
        { name: "North Sea", pts: [[-6.0, 48.5], [-11.0, 51.5], [-11.0, 55.5], [-8.0, 56.0], [-6.5, 58.0], [-4.0, 58.8], [-1.0, 59.0], [2.0, 58.5], [5.0, 58.5], [8.0, 57.8], [9.0, 55.0], [8.0, 53.5], [3.0, 51.0], [1.5, 50.5], [-4.0, 48.5]] },
        { name: "Caspian", pts: [[46, 36], [55, 36], [55, 48], [46, 48]] },
        { name: "Aral", pts: [[57, 43], [63, 43], [63, 48], [57, 48]] },
        { name: "Persian Gulf", pts: [[47, 25], [58, 25], [58, 31], [47, 31]] },
        { name: "Red Sea", pts: [[32, 25], [37, 25], [37, 30.5], [32, 30.5]] },
        { name: "White Sea", pts: [[32, 63.5], [42, 63.5], [42, 67.2], [32, 67.2]] }
    ],

    // Mountain ranges: polyline, core radius (mountains), fringe radius (hills), in tiles
    ranges: [
        { name: "Alps", core: 1.05, fringe: 1.9, pts: [[6.0, 44.1], [6.9, 45.1], [7.5, 45.9], [8.5, 46.4], [9.8, 46.5], [11.2, 46.8], [12.7, 47.0], [13.9, 47.1], [15.0, 47.3]] },
        { name: "Pyrenees", core: 0.8, fringe: 1.5, pts: [[-1.9, 43.2], [-0.5, 42.85], [1.0, 42.65], [2.6, 42.5]] },
        { name: "Cantabrian", core: 0.55, fringe: 1.3, pts: [[-7.0, 43.1], [-5.5, 43.05], [-4.0, 43.1]] },
        { name: "Central System", core: 0.3, fringe: 1.2, pts: [[-6.0, 40.3], [-4.0, 40.7], [-2.0, 41.5]] },
        { name: "Sierra Nevada", core: 0.5, fringe: 1.0, pts: [[-3.7, 37.05], [-2.8, 37.15]] },
        { name: "Sierra Morena", core: 0.0, fringe: 1.0, pts: [[-6.5, 38.1], [-4.0, 38.3]] },
        { name: "Massif Central", core: 0.3, fringe: 1.4, pts: [[2.0, 44.5], [3.0, 45.3], [4.0, 45.5]] },
        { name: "Vosges-Jura-Black Forest", core: 0.2, fringe: 1.1, pts: [[6.3, 46.7], [7.0, 48.2], [8.0, 48.5], [9.5, 48.5]] },
        { name: "Ardennes", core: 0.0, fringe: 0.9, pts: [[4.5, 50.0], [6.0, 50.2]] },
        { name: "Apennines", core: 0.55, fringe: 1.3, pts: [[8.3, 44.35], [9.5, 44.45], [10.5, 44.2], [11.5, 43.8], [12.6, 43.2], [13.3, 42.6], [13.8, 42.2], [14.3, 41.7], [15.0, 41.1], [15.8, 40.5], [16.1, 39.9], [16.3, 39.3], [16.0, 38.6]] },
        { name: "Dinaric Alps", core: 0.7, fringe: 1.5, pts: [[14.0, 45.8], [15.3, 45.0], [16.5, 44.2], [17.5, 43.6], [18.6, 43.0], [19.5, 42.5], [20.2, 42.0]] },
        { name: "Pindus", core: 0.6, fringe: 1.3, pts: [[20.4, 41.5], [20.8, 40.5], [21.2, 39.8], [21.6, 39.0], [22.2, 38.6]] },
        { name: "Peloponnese", core: 0.0, fringe: 1.0, pts: [[22.2, 37.6], [22.5, 37.2]] },
        { name: "Balkan Mountains", core: 0.5, fringe: 1.2, pts: [[22.5, 43.0], [24.0, 42.75], [25.5, 42.75], [27.0, 42.9]] },
        { name: "Rhodope", core: 0.6, fringe: 1.2, pts: [[23.0, 42.1], [24.5, 41.7], [25.8, 41.6]] },
        { name: "Carpathians", core: 0.55, fringe: 1.4, pts: [[17.0, 49.4], [19.0, 49.4], [20.5, 49.2], [22.0, 49.0], [23.5, 48.4], [24.5, 47.7], [25.5, 47.0], [26.0, 46.2], [25.8, 45.5], [24.8, 45.4], [23.5, 45.4], [22.5, 45.4]] },
        { name: "Tatra", core: 0.85, fringe: 1.5, pts: [[19.5, 49.2], [20.3, 49.2]] },
        { name: "Sudetes", core: 0.2, fringe: 1.1, pts: [[12.5, 50.4], [13.5, 50.5], [15.0, 50.7], [16.5, 50.4]] },
        { name: "Bohemian Forest", core: 0.0, fringe: 1.0, pts: [[12.8, 49.0], [13.8, 48.8]] },
        { name: "Harz-Thuringia", core: 0.0, fringe: 0.8, pts: [[10.6, 51.7], [10.8, 50.6]] },
        { name: "Scandinavian Mountains", core: 0.6, fringe: 1.4, pts: [[6.0, 58.8], [7.5, 60.0], [8.0, 61.3], [8.5, 62.3], [10.5, 63.0], [12.5, 64.0], [14.0, 65.0], [15.5, 66.2], [17.0, 67.3], [18.5, 68.2], [20.5, 69.0], [22.5, 69.7]] },
        { name: "Jotunheimen", core: 1.0, fringe: 1.6, pts: [[7.5, 61.3], [8.6, 61.7]] },
        { name: "Scottish Highlands", core: 0.4, fringe: 1.3, pts: [[-5.5, 56.5], [-4.5, 57.0], [-3.5, 57.4]] },
        { name: "Pennines", core: 0.0, fringe: 0.9, pts: [[-2.5, 55.3], [-2.0, 54.3], [-1.8, 53.5]] },
        { name: "Wales", core: 0.3, fringe: 1.0, pts: [[-3.9, 52.9], [-3.5, 52.0]] },
        { name: "Lake District", core: 0.0, fringe: 0.7, pts: [[-3.0, 54.5], [-3.0, 54.5]] },
        { name: "Wicklow", core: 0.0, fringe: 0.7, pts: [[-6.4, 53.0], [-6.4, 53.0]] },
        { name: "Kerry", core: 0.3, fringe: 0.9, pts: [[-9.7, 52.0], [-9.7, 52.0]] },
        { name: "Donegal", core: 0.0, fringe: 0.8, pts: [[-8.0, 54.9], [-8.0, 54.9]] },
        { name: "Iceland Highlands", core: 0.7, fringe: 1.4, pts: [[-19.5, 64.3], [-17.5, 64.8], [-16.5, 64.5]] },
        { name: "Urals", core: 0.5, fringe: 1.3, pts: [[58.0, 51.5], [59.5, 54.0], [59.0, 56.5], [58.5, 58.5], [59.5, 60.5], [60.5, 62.5], [61.0, 64.5], [62.0, 66.0], [64.5, 67.5]] },
        { name: "Caucasus", core: 0.9, fringe: 1.6, pts: [[37.5, 44.4], [39.5, 43.7], [41.5, 43.2], [43.5, 42.9], [45.5, 42.5], [47.0, 42.2], [48.0, 41.7]] },
        { name: "Lesser Caucasus", core: 0.7, fringe: 1.5, pts: [[41.5, 41.5], [43.0, 41.0], [44.5, 40.5], [45.5, 40.0], [46.5, 39.5]] },
        { name: "Pontic", core: 0.5, fringe: 1.2, pts: [[32.0, 41.0], [35.0, 41.2], [37.5, 40.7], [39.5, 40.6], [41.5, 40.9]] },
        { name: "Taurus", core: 0.7, fringe: 1.4, pts: [[29.5, 37.2], [31.0, 37.2], [32.5, 37.0], [34.0, 37.2], [35.5, 37.6], [36.8, 38.0], [38.5, 38.3], [40.0, 38.2], [41.5, 38.0]] },
        { name: "Eastern Anatolia", core: 0.9, fringe: 1.6, pts: [[39.0, 39.3], [41.0, 39.5], [43.0, 39.2], [44.5, 39.0]] },
        { name: "Zagros", core: 0.9, fringe: 1.6, pts: [[45.5, 35.5], [46.5, 34.3], [47.5, 33.3], [48.5, 32.3], [50.0, 31.0], [51.5, 30.0], [53.0, 28.8]] },
        { name: "Alborz", core: 0.8, fringe: 1.4, pts: [[49.0, 36.8], [51.0, 36.2], [53.0, 36.3], [55.0, 36.8]] },
        { name: "Kurdistan", core: 0.3, fringe: 1.1, pts: [[43.5, 37.0], [44.5, 36.5]] },
        { name: "Lebanon", core: 0.4, fringe: 0.9, pts: [[35.8, 34.6], [36.2, 33.7]] },
        { name: "Judea", core: 0.0, fringe: 0.8, pts: [[35.2, 32.2], [35.2, 31.6]] },
        { name: "Jordan Highlands", core: 0.0, fringe: 0.8, pts: [[35.8, 31.0], [35.9, 32.2]] },
        { name: "Sinai", core: 0.5, fringe: 1.0, pts: [[33.9, 28.9], [34.1, 28.4]] },
        { name: "Red Sea Hills", core: 0.0, fringe: 1.0, pts: [[33.0, 27.5], [33.5, 26.5]] },
        { name: "Hejaz", core: 0.0, fringe: 1.0, pts: [[36.5, 28.0], [38.5, 26.5]] },
        { name: "High Atlas", core: 0.8, fringe: 1.5, pts: [[-8.5, 30.5], [-7.5, 31.3], [-6.0, 31.8], [-4.5, 32.3], [-3.0, 32.8], [-1.5, 33.5]] },
        { name: "Rif", core: 0.4, fringe: 1.0, pts: [[-5.5, 35.1], [-4.0, 34.9], [-2.5, 34.8]] },
        { name: "Tell Atlas", core: 0.4, fringe: 1.1, pts: [[-1.0, 35.2], [1.0, 35.7], [3.0, 36.2], [5.0, 36.3], [7.0, 36.2], [8.5, 36.2]] },
        { name: "Saharan Atlas", core: 0.5, fringe: 1.2, pts: [[-1.5, 33.7], [0.5, 33.9], [2.5, 34.3], [4.5, 34.8], [6.5, 35.2]] },
        { name: "Tunisian Dorsal", core: 0.0, fringe: 0.9, pts: [[8.5, 35.7], [9.5, 36.2]] },
        { name: "Jebel Akhdar", core: 0.0, fringe: 0.9, pts: [[20.8, 32.5], [22.5, 32.6]] },
        { name: "Crimean Mountains", core: 0.3, fringe: 0.8, pts: [[33.8, 44.55], [34.5, 44.7]] },
        { name: "Corsica", core: 0.0, fringe: 1.0, pts: [[9.0, 42.5], [9.1, 42.0]] },
        { name: "Sardinia", core: 0.3, fringe: 1.0, pts: [[9.3, 40.3], [9.3, 39.8]] },
        { name: "Sicily", core: 0.0, fringe: 1.0, pts: [[13.5, 37.9], [14.5, 37.9]] },
        { name: "Crete", core: 0.0, fringe: 1.0, pts: [[23.9, 35.3], [24.7, 35.25], [25.5, 35.2]] },
        { name: "Troodos", core: 0.0, fringe: 0.9, pts: [[32.9, 34.9], [32.9, 34.9]] },
        { name: "Valdai", core: 0.0, fringe: 1.0, pts: [[32.5, 57.5], [34.0, 57.0]] },
        { name: "Volga Upland", core: 0.0, fringe: 1.0, pts: [[47.5, 54.0], [48.5, 53.0]] },
        { name: "Donets Ridge", core: 0.0, fringe: 0.8, pts: [[37.8, 48.4], [39.0, 48.2]] },
        { name: "Khibiny", core: 0.4, fringe: 0.9, pts: [[33.7, 67.7], [33.7, 67.7]] },
        { name: "Timan Ridge", core: 0.0, fringe: 1.0, pts: [[51.0, 64.0], [53.0, 66.0]] },
        { name: "Anatolian Plateau Hills", core: 0.0, fringe: 1.2, pts: [[32.0, 39.5], [34.5, 39.0]] },
        { name: "Armenian Highlands", core: 0.5, fringe: 1.3, pts: [[44.0, 40.0], [45.5, 39.0]] },
        { name: "Aures", core: 0.5, fringe: 1.0, pts: [[6.0, 35.3], [7.0, 35.4]] },
        { name: "Middle Atlas", core: 0.4, fringe: 1.1, pts: [[-5.5, 33.5], [-4.0, 34.0]] },
        { name: "Cyrenaica", core: 0.0, fringe: 0.7, pts: [[21.5, 32.4], [21.5, 32.4]] },
        { name: "Apuseni", core: 0.3, fringe: 1.0, pts: [[22.7, 46.4], [23.2, 46.2]] },
        { name: "Serbian Highlands", core: 0.0, fringe: 1.1, pts: [[20.5, 43.5], [21.5, 43.0]] },
        { name: "Macedonian Highlands", core: 0.2, fringe: 1.0, pts: [[21.3, 41.8], [22.3, 41.2]] }
    ],

    // Biome overrides (applied in order after the latitude default)
    biomeAreas: [
        { name: "Nile Valley", biome: "G", pts: [[30.6, 27.0], [31.2, 27.0], [31.9, 29.6], [32.2, 30.2], [32.3, 31.3], [30.2, 31.4], [30.6, 30.3], [30.9, 29.5]] },
        { name: "Levant", biome: "P", pts: [[34.2, 31.2], [36.0, 31.2], [36.6, 33.0], [36.8, 36.0], [35.9, 37.0], [34.5, 36.5], [34.2, 32.5]] },
        { name: "Mesopotamia", biome: "P", pts: [[42.5, 34.5], [44.5, 36.5], [46.5, 36.5], [48.5, 33.0], [48.0, 30.0], [46.0, 30.5], [44.0, 32.0]] },
        { name: "Libyan Coast", biome: "P", pts: [[8.5, 33.5], [10.5, 32.5], [14.0, 32.3], [16.5, 31.0], [19.0, 30.4], [20.5, 31.5], [22.0, 32.3], [25.0, 31.4], [24.0, 32.5], [20.0, 33.0], [12.0, 33.5], [10.0, 35.0], [8.8, 35.0]] },
        { name: "Cyrenaica", biome: "G", pts: [[20.5, 32.2], [23.0, 32.3], [23.0, 33.0], [20.5, 33.0]] },
        { name: "Syrian Desert", biome: "D", pts: [[36.9, 32.8], [41.5, 32.8], [43.5, 34.0], [41.0, 36.5], [38.0, 36.0]] },
        { name: "Iranian Plateau", biome: "D", pts: [[52.0, 30.0], [60.0, 30.0], [60.0, 37.0], [55.5, 36.2], [52.5, 33.0]] },
        { name: "Hyrcania", biome: "G", pts: [[48.6, 36.2], [54.2, 36.2], [54.2, 37.9], [49.2, 37.9]] },
        { name: "Anatolian Black Sea Coast", biome: "G", pts: [[29.0, 40.6], [41.5, 40.4], [42.5, 42.0], [29.5, 41.8]] },
        { name: "Colchis", biome: "G", pts: [[40.0, 41.5], [46.0, 41.0], [47.0, 43.0], [41.0, 43.5]] },
        { name: "Steppe", biome: "P", pts: [[26.5, 45.2], [28.5, 47.0], [32.0, 49.3], [37.0, 50.6], [42.0, 51.2], [48.0, 52.2], [55.0, 53.0], [64.0, 52.5], [64.0, 44.5], [55.0, 44.5], [52.0, 45.5], [49.0, 46.8], [47.3, 46.5], [46.5, 44.5], [44.0, 44.8], [40.0, 45.5], [36.0, 45.0], [33.5, 46.2], [30.0, 46.4], [28.0, 45.0]] },
        { name: "Caspian Desert", biome: "D", pts: [[47.5, 43.2], [64.0, 42.0], [64.0, 48.5], [56.0, 49.0], [51.5, 48.2], [49.0, 47.0], [47.6, 45.5]] },
        { name: "Green Spain", biome: "G", pts: [[-9.5, 42.5], [-1.0, 42.8], [-1.0, 43.9], [-9.5, 43.9]] },
        { name: "Po Valley", biome: "G", pts: [[7.0, 44.6], [12.5, 44.4], [12.5, 46.0], [7.0, 46.0]] },
        { name: "Norwegian Coast", biome: "G", pts: [[4.5, 58.0], [14.0, 63.0], [13.0, 66.0], [11.5, 66.0], [9.0, 63.5], [4.5, 62.5]] },
        { name: "Iceland", biome: "T", pts: [[-25, 63], [-12, 63], [-12, 67], [-25, 67]] },
        { name: "Southern Morocco", biome: "P", pts: [[-10.0, 29.8], [-6.5, 30.5], [-5.0, 32.5], [-8.0, 33.5], [-10.0, 32.0]] },
        { name: "Cyprus", biome: "P", pts: [[32, 34], [35, 34], [35, 36], [32, 36]] }
    ],

    // Rainfall overrides (applied in order after the latitude default)
    rainAreas: [
        { name: "Atlantic Europe", rain: 150, pts: [[-11.0, 47.5], [-11.0, 59.0], [-4.0, 62.5], [6.0, 66.0], [9.0, 63.0], [6.0, 58.0], [3.0, 51.0], [-1.0, 47.0]] },
        { name: "Alpine-Dinaric", rain: 140, pts: [[5.5, 44.0], [15.5, 47.5], [20.5, 42.0], [19.0, 40.5], [14.0, 44.5], [6.0, 43.6]] },
        { name: "Iberian Meseta", rain: 45, pts: [[-8.0, 37.5], [-1.0, 38.0], [-1.0, 42.0], [-8.0, 42.0]] },
        { name: "Steppe", rain: 55, pts: [[26.5, 45.2], [28.5, 47.0], [32.0, 49.3], [37.0, 50.6], [42.0, 51.2], [48.0, 52.2], [55.0, 53.0], [64.0, 52.5], [64.0, 44.5], [55.0, 44.5], [52.0, 45.5], [49.0, 46.8], [47.3, 46.5], [46.5, 44.5], [44.0, 44.8], [40.0, 45.5], [36.0, 45.0], [33.5, 46.2], [30.0, 46.4], [28.0, 45.0]] },
        { name: "Caspian Desert", rain: 15, pts: [[47.5, 43.2], [64.0, 42.0], [64.0, 48.5], [56.0, 49.0], [51.5, 48.2], [49.0, 47.0], [47.6, 45.5]] },
        { name: "Anatolian Plateau", rain: 45, pts: [[30.5, 37.8], [40.0, 37.8], [40.0, 40.3], [30.5, 40.3]] },
        { name: "Black Sea Coast", rain: 150, pts: [[29.0, 40.6], [41.5, 40.4], [42.5, 42.0], [29.5, 41.8]] },
        { name: "Colchis", rain: 160, pts: [[40.0, 41.5], [46.0, 41.0], [47.0, 43.0], [41.0, 43.5]] },
        { name: "Syrian Desert", rain: 10, pts: [[36.9, 32.8], [41.5, 32.8], [43.5, 34.0], [41.0, 36.5], [38.0, 36.0]] },
        { name: "Iranian Plateau", rain: 10, pts: [[52.0, 30.0], [60.0, 30.0], [60.0, 37.0], [55.5, 36.2], [52.5, 33.0]] },
        { name: "Hyrcania", rain: 170, pts: [[48.6, 36.2], [54.2, 36.2], [54.2, 37.9], [49.2, 37.9]] },
        { name: "Nile Valley", rain: 40, pts: [[30.6, 27.0], [31.2, 27.0], [31.9, 29.6], [32.2, 30.2], [32.3, 31.3], [30.2, 31.4], [30.6, 30.3], [30.9, 29.5]] }
    ],

    // Volcanoes: [lon, lat, name]
    volcanoes: [
        [15.0, 37.75, "Etna"], [14.43, 40.82, "Vesuvius"], [-19.7, 64.0, "Hekla"], [25.4, 36.4, "Santorini"],
        [44.3, 39.7, "Ararat"], [42.45, 43.35, "Elbrus"], [35.45, 38.53, "Erciyes"], [52.1, 35.95, "Damavand"]
    ],

    // True start locations by civilization: [lon, lat]
    tsl: {
        CIVILIZATION_ROME: [12.5, 41.9],
        CIVILIZATION_BYZANTIUM: [28.70, 41.30],   // Constantinople, Thracian shore of the Bosporus (Byzantium mod)
        CIVILIZATION_GREECE: [22.79, 39.28],   // Thermaic Gulf coast, north of Athens
        // America starts in Ireland. It is a Modern-age civilization, so the start only applies in
        // games where it is in play; the Dublin fallback site is left for when it is not.
        CIVILIZATION_AMERICA: [-6.64, 53.32],
        CIVILIZATION_EGYPT: [31.2, 30.0],
        CIVILIZATION_PERSIA: [48.5, 33.0],
        CIVILIZATION_CARTHAGE: [10.3, 36.8],
        CIVILIZATION_ASSYRIA: [43.1, 36.3],
        CIVILIZATION_BULGARIA: [27.1, 43.4],
        CIVILIZATION_SPAIN: [-3.7, 40.4],
        CIVILIZATION_NORMAN: [1.1, 49.4],
        CIVILIZATION_ABBASID: [44.4, 33.3],
        CIVILIZATION_OTTOMANS: [32.9, 39.9],   // Ankara, central Anatolia - leaves Constantinople free for Byzantium
        CIVILIZATION_ICELAND: [-21.9, 64.1],
        CIVILIZATION_QAJAR: [51.4, 35.7],
        CIVILIZATION_MONGOLIA: [47.0, 48.0],
        CIVILIZATION_PIRATE_REPUBLIC: [3.05, 36.75],
        CIVILIZATION_FRENCH_EMPIRE: [2.35, 48.85],
        CIVILIZATION_PRUSSIA: [13.4, 52.5],
        CIVILIZATION_RUSSIA: [37.6, 55.75],
        CIVILIZATION_GREAT_BRITAIN: [-0.1, 51.5]
    },

    // Fallback start sites for civilizations without a true start location, best first
    fallbackSites: [
        // Thracian (European) shore of the Bosporus - this map had no Constantinople site at all.
        [28.70, 41.30, "Constantinople"],
        // Mediterranean ports and a fuller Germany / western France
        [2.17, 41.39, "Barcelona"], [5.37, 43.30, "Marseille"], [13.10, 45.55, "Venice"],
        [9.99, 53.55, "Hamburg"], [6.96, 50.94, "Cologne"], [-1.55, 47.22, "Nantes"],
        [30.5, 50.4, "Kyiv"], [19.9, 50.1, "Krakow"], [19.0, 47.5, "Budapest"], [-0.1, 51.5, "London"],
        [17.6, 59.9, "Uppsala"], [-6.3, 53.3, "Dublin"], [-9.1, 38.7, "Lisbon"], [-6.0, 37.4, "Seville"],
        [32.9, 39.9, "Ankara"], [36.3, 33.5, "Damascus"], [20.5, 44.8, "Belgrade"], [-5.0, 34.0, "Fez"],
        [12.6, 55.7, "Copenhagen"], [44.8, 41.7, "Tbilisi"], [49.1, 55.8, "Kazan"], [39.7, 47.2, "Rostov"],
        [4.8, 45.8, "Lyon"], [9.2, 45.5, "Milan"], [16.4, 48.2, "Vienna"], [31.3, 58.5, "Novgorod"],
        [24.1, 57.0, "Riga"], [10.4, 63.4, "Trondheim"], [15.3, 37.1, "Syracuse"], [21.9, 32.8, "Cyrene"],
        [2.35, 48.85, "Paris"], [13.4, 52.5, "Berlin"], [37.6, 55.75, "Moscow"], [12.5, 41.9, "Rome"],
        [23.7, 38.0, "Athens"], [31.2, 30.0, "Memphis"], [10.3, 36.8, "Carthage"], [29.1, 40.2, "Bursa"],
        [-3.7, 40.4, "Toledo"], [44.4, 33.3, "Baghdad"], [43.1, 36.3, "Nineveh"], [27.1, 43.4, "Pliska"],
        [3.05, 36.75, "Algiers"], [47.0, 48.0, "Sarai"], [48.5, 33.0, "Susa"], [51.4, 35.7, "Tehran"],
        [1.1, 49.4, "Rouen"], [-21.9, 64.1, "Reykjavik"], [26.1, 44.4, "Bucharest"], [30.3, 59.95, "Petersburg"],
        [25.0, 60.2, "Helsinki"], [-2.0, 53.5, "Manchester"], [42.0, 36.5, "Mosul"], [14.4, 50.1, "Prague"]
    ]
};
