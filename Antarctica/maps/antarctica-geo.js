// antarctica-geo.js
// The Antarctica map's geography, as plain data. antarctica-raster.js turns it into a hex grid;
// the editor (./run-editor.sh antarctica) edits and saves this file, so keep it data only: no
// functions, no comments inside GEO (use the `note` fields). Everything above `export const GEO`
// is kept on every save.
//
// Layout: a south polar view. Antarctica sits in the middle in a true polar (azimuthal equidistant)
// projection, Greenwich up and 90E to the right. The four Distant Lands sit in the corners, each in
// its own local projection, turned so its north points away from the pole, and cut off where it
// runs into the top or bottom edge.
//
// frame.type "polar": k = canvas units per degree of arc from the pole, rot = degrees of turn.
// frame.type "local": the land is drawn around (lon0, lat0), scaled by k, turned rot degrees
//   counter-clockwise and centred at canvas point `at`. Canvas: map centre 0,0, y up, half the map
//   height = 1.
// polys: outlines as [lon, lat] rings. ranges: polylines, w = half width in hexes, m = chance of a
//   mountain inside, h = chance of a hill. rivers: source to mouth, nav = navigable hexes above the
//   mouth, toLake = the lake it ends in. lakes: centre and size in hexes. islands: on the polar
//   projection, r = radius in hexes. bandDepth: Antarctica's ice-free coastal band, in hexes.

export const GEO = {
    bandDepth: 4,
    lands: [
        {
            id: "antarctica", name: "Antarctica", region: "home",
            frame: { type: "polar", k: 0.031, rot: 0 },
            polys: [
                {
                    name: "mainland",
                    pts: [
                        [-10, -71.2], [0, -70.2], [8, -70], [15, -69.9], [22, -70.2], [30, -69.6],
                        [34, -68.8], [39, -69.4], [40, -68.3], [45, -67.8], [50, -66.6],
                        [53, -65.9], [58, -67.2], [63, -67.5], [67, -67.7], [69, -68.5],
                        [70.5, -69.9], [72.5, -70.1], [74, -69.2], [77, -69.4], [80, -68],
                        [85, -66.8], [90, -66.5], [95, -66.2], [100, -65.3], [103, -65.6],
                        [108, -66.4], [112, -66], [117, -66.8], [122, -66.4], [128, -66.1],
                        [134, -66.3], [140, -66.7], [145, -67.2], [150, -68.3], [155, -69],
                        [160, -69.8], [164, -70.6], [170, -71.3], [170.5, -72.5], [169, -73.8],
                        [166, -74.5], [164.5, -75.5], [163, -76.6], [164, -77.2], [167, -77.3],
                        [169.5, -77.6], [175, -78], [180, -78.2], [-175, -78.4], [-170, -78.5],
                        [-165, -78.3], [-160, -77.9], [-157, -77.2], [-152, -76.8], [-148, -76],
                        [-142, -75.3], [-136, -74.6], [-130, -74.2], [-124, -73.8], [-118, -74],
                        [-112, -74.6], [-106, -74.8], [-101, -74.2], [-98, -73.2], [-94, -72.6],
                        [-89, -72.6], [-84, -73.2], [-79, -73.1], [-75, -72.8], [-72, -71.8],
                        [-70.5, -69.5], [-68.3, -67.8], [-66.5, -66.3], [-64.5, -65], [-62, -64],
                        [-59.5, -63.4], [-57, -63.2], [-56.5, -63.7], [-58.2, -64.5],
                        [-60.2, -65.5], [-61.5, -67.2], [-61.8, -69.5], [-61.5, -71.5],
                        [-61, -73.5], [-60, -74.8], [-55, -76], [-50, -77.2], [-47, -77.8],
                        [-42, -77.9], [-37, -77.8], [-34, -77.2], [-30, -76.5], [-26, -75.3],
                        [-22, -74.2], [-17, -73.2], [-13, -72.1],
                    ],
                },
            ],
            ranges: [
                {
                    name: "Transantarctic", w: 1.2, m: 0.55, h: 0.9,
                    pts: [
                        [170, -71.8], [166, -73.5], [162, -75.5], [160, -78], [163, -81],
                        [168, -83.5], [180, -85], [-150, -86.3], [-115, -86], [-90, -84.8],
                        [-65, -83.3], [-40, -81], [-28, -80],
                    ],
                },
                {
                    name: "Ellsworth", w: 1, m: 0.75, h: 0.9,
                    pts: [[-88, -80.5], [-86, -79], [-84.5, -77.5]],
                },
                {
                    name: "Peninsula spine", w: 0.8, m: 0.5, h: 0.9,
                    pts: [[-66, -72.5], [-65, -69.5], [-63, -67], [-60.5, -65], [-58, -63.6]],
                },
                {
                    name: "Queen Maud Land", w: 0.9, m: 0.45, h: 0.8,
                    pts: [[-5, -72.5], [5, -72], [15, -72], [25, -72.2], [35, -72.3]],
                },
                {
                    name: "Prince Charles", w: 0.8, m: 0.6, h: 0.9,
                    pts: [[62, -74], [64, -72.5], [67, -71]],
                },
                {
                    name: "Gamburtsev", w: 1.4, m: 0.1, h: 0.75,
                    pts: [[65, -79.5], [75, -80.2], [88, -79.5]],
                },
                {
                    name: "Marie Byrd Land", w: 1, m: 0.3, h: 0.8,
                    pts: [[-140, -76], [-132, -76.3], [-124, -76.5], [-116, -76.2]],
                },
                {
                    name: "Dronning Maud plateau", w: 1.5, m: 0, h: 0.5,
                    pts: [[0, -76], [30, -77], [50, -75]],
                },
            ],
            volcanoes: [
                { name: "Mount Erebus", lon: 166.9, lat: -77.3 },
                { name: "Mount Sidley", lon: -126.4, lat: -77 },
            ],
            rivers: [
                {
                    name: "Lambert", nav: 5, note: "the Lambert Glacier drainage into Prydz Bay",
                    pts: [[76, -79.5], [72, -76.5], [69.5, -73.8], [70.8, -71.8], [71.5, -69.5]],
                },
                {
                    name: "Institute", nav: 5,
                    note: "the 460 km river found under the Institute Ice Stream, into the Weddell Sea",
                    pts: [
                        [-110, -84.6], [-92, -83.2], [-80, -82], [-68, -80.2], [-60, -78.3],
                        [-54, -76.2],
                    ],
                },
                {
                    name: "Recovery", nav: 0, note: "Recovery Glacier and its subglacial lakes",
                    pts: [[15, -82], [-5, -81.5], [-20, -80.8], [-30, -79.5], [-38, -77.8]],
                },
                {
                    name: "Byrd", nav: 0,
                    note: "the Adventure Trench flood of 2006, out through the Byrd Glacier",
                    pts: [[135, -77], [146, -79], [156, -80.4], [165, -80.2], [174, -78.6], [178, -77.9]],
                },
                {
                    name: "Whillans", nav: 0,
                    note: "the Siple Coast lakes under the Whillans Ice Stream",
                    pts: [[-132, -85.8], [-150, -84.5], [-162, -81.5], [-170, -78.4]],
                },
                {
                    name: "Totten", nav: 0,
                    note: "old river valleys under the Totten Glacier (Aurora Basin)",
                    pts: [[112, -75.5], [114, -71], [116, -67.5], [116.5, -66.5]],
                },
                {
                    name: "Denman", nav: 0, note: "old river valleys under the Denman Glacier",
                    pts: [[104, -73.5], [100, -69.5], [99.5, -65.8]],
                },
                {
                    name: "Pine Island", nav: 0, note: "the old river valley under Pine Island Bay",
                    pts: [[-92, -78.3], [-97, -76.2], [-101, -74]],
                },
                {
                    name: "Onyx", nav: 0, toLake: "Vanda",
                    note: "the one real surface river: it runs inland, into Lake Vanda in the Dry Valleys",
                    pts: [[163.8, -76.9], [159, -77.4], [154.5, -77.8]],
                },
            ],
            lakes: [
                { name: "Vanda", lon: 152.5, lat: -77.9, size: 1 },
                { name: "Vostok", lon: 106, lat: -77.3, size: 3 },
            ],
        },
        {
            id: "south-america", name: "South America", region: "distant",
            frame: { type: "local", lon0: -64, lat0: -40, at: [-1.14, 0.7], k: 0.03, rot: 20 },
            polys: [
                {
                    name: "mainland",
                    pts: [
                        [-81.2, -5], [-79, -8], [-76.5, -13.5], [-72, -17], [-70.3, -18.5],
                        [-70.5, -23], [-71.5, -30], [-73.5, -37], [-73.8, -41.5], [-74.5, -47],
                        [-75.3, -50.5], [-74, -53], [-71, -54.5], [-68, -55.5], [-67.3, -55.9],
                        [-65.5, -55], [-68.5, -53], [-69, -51.5], [-67.8, -49.5], [-65.8, -47.8],
                        [-67.5, -46], [-65, -45], [-64.5, -42.5], [-62.3, -40.7], [-62, -39],
                        [-57.5, -38.2], [-56.7, -36.4], [-57.4, -35.3], [-58.4, -34.5],
                        [-57.8, -34.4], [-56.2, -34.9], [-54.9, -34.9], [-53.4, -33.7], [-51, -31],
                        [-48.6, -28], [-48.5, -26], [-46.5, -24], [-43.5, -23], [-41, -22],
                        [-40, -19.5], [-39, -17], [-39, -13], [-37, -10.5], [-35, -8],
                        [-35.2, -5.5], [-40, -2.9], [-50, 0], [-80, 0],
                    ],
                },
                {
                    name: "Falkland Islands",
                    pts: [[-61.3, -51.3], [-58.2, -51.2], [-57.7, -51.7], [-58.9, -52.3], [-60.8, -52.1]],
                },
            ],
            ranges: [
                {
                    name: "Andes", w: 1.4, m: 0.6, h: 0.9,
                    pts: [
                        [-69, -12], [-69.5, -18], [-68.5, -24], [-69.8, -30], [-70.2, -34],
                        [-71, -38], [-72, -42], [-72.8, -46], [-73.3, -50], [-72.5, -52.5],
                        [-70, -54.6],
                    ],
                },
                {
                    name: "Sierras de Cordoba", w: 0.8, m: 0.1, h: 0.7,
                    pts: [[-64.6, -30], [-64.6, -33]],
                },
                {
                    name: "Brazilian Highlands", w: 1.6, m: 0.05, h: 0.6,
                    pts: [[-50, -27], [-46, -22], [-43, -19]],
                },
                {
                    name: "Chilean Coast Range", w: 0.6, m: 0, h: 0.6,
                    pts: [[-71.5, -30], [-72.5, -36], [-73.3, -40]],
                },
            ],
            volcanoes: [{ name: "Villarrica", lon: -71.9, lat: -39.4 }],
            rivers: [
                {
                    name: "Parana", nav: 8,
                    pts: [
                        [-54, -23], [-55.5, -26.5], [-58.5, -27.4], [-60.7, -31.6], [-60.4, -33.3],
                        [-58.8, -34], [-58.1, -34.4],
                    ],
                },
                {
                    name: "Uruguay", nav: 0,
                    pts: [[-52, -27.5], [-55, -28.7], [-56.8, -30.6], [-58.1, -33.1], [-58.4, -33.9]],
                },
                { name: "Salado", nav: 0, pts: [[-65, -24.5], [-62.5, -28], [-60.9, -31.4]] },
                { name: "Colorado", nav: 0, pts: [[-69.8, -36.5], [-66, -38.5], [-62.2, -39.8]] },
                {
                    name: "Negro", nav: 3,
                    pts: [[-70.5, -39.8], [-67.5, -39.3], [-64.8, -40.4], [-62.8, -41]],
                },
                { name: "Chubut", nav: 0, pts: [[-71, -42.5], [-68, -43.6], [-65.1, -43.3]] },
                { name: "Santa Cruz", nav: 0, pts: [[-72.3, -50.2], [-70, -50.1], [-68.4, -50.1]] },
                { name: "Biobio", nav: 0, pts: [[-71.3, -38.3], [-72.5, -37.4], [-73.2, -36.8]] },
            ],
            lakes: [],
        },
        {
            id: "africa", name: "Southern Africa", region: "distant",
            frame: { type: "local", lon0: 25, lat0: -26, at: [1.13, 0.62], k: 0.03, rot: -18 },
            polys: [
                {
                    name: "mainland",
                    pts: [
                        [9, 0], [12, -5], [12.2, -6], [13.3, -9], [13.8, -11.5], [12.5, -13.5],
                        [11.8, -16], [11.7, -17.5], [13, -20], [14.5, -22.5], [14.9, -26],
                        [15.3, -27.5], [16.5, -28.6], [17.5, -31], [18.3, -33], [18.4, -34.2],
                        [19.9, -34.8], [22, -34], [25, -34], [26.5, -33.8], [28, -33], [30, -31.2],
                        [31, -29.5], [32.5, -28], [32.8, -26], [35, -24.5], [35.5, -22], [35, -20],
                        [36.5, -18.8], [39, -17], [40.5, -15], [40.5, -11], [39.5, -8], [39.3, -6],
                        [39.5, -4.5], [41, -2], [43, 0],
                    ],
                },
                {
                    name: "Madagascar",
                    pts: [
                        [49.3, -12], [50.3, -15.5], [49.5, -17], [48, -21], [47, -25], [45, -25.5],
                        [43.7, -23.5], [43.3, -21.5], [44.4, -19.5], [44, -17], [46, -15.8],
                        [48, -13.5],
                    ],
                },
            ],
            ranges: [
                {
                    name: "Drakensberg", w: 1, m: 0.55, h: 0.9,
                    pts: [[27.5, -31.5], [29, -30], [30, -28.5], [30.8, -26.5], [31, -24]],
                },
                {
                    name: "Cape Fold", w: 0.8, m: 0.2, h: 0.8,
                    pts: [[18.8, -32.5], [19.5, -33.6], [23, -33.6], [26, -33.4]],
                },
                {
                    name: "Great Escarpment", w: 1, m: 0, h: 0.6,
                    pts: [[20, -31.5], [24, -31.8], [27, -31.5]],
                },
                {
                    name: "Namibian Highlands", w: 1.2, m: 0.05, h: 0.6,
                    pts: [[16.5, -27], [17, -23], [16.5, -19]],
                },
                {
                    name: "Madagascar Highlands", w: 1, m: 0.35, h: 0.9,
                    pts: [[48.8, -13.5], [47.5, -17], [47, -20], [46.6, -23.5]],
                },
                {
                    name: "Eastern Highlands", w: 1, m: 0.15, h: 0.7,
                    pts: [[32.8, -21], [33, -18], [35, -14]],
                },
            ],
            volcanoes: [],
            rivers: [
                {
                    name: "Zambezi", nav: 6,
                    pts: [
                        [23, -14.5], [25.8, -17.9], [28.8, -16.7], [30.5, -15.6], [33.5, -16.3],
                        [35.6, -17.6], [36.4, -18.9],
                    ],
                },
                {
                    name: "Orange", nav: 0,
                    pts: [
                        [29, -29.3], [26, -30.1], [24.5, -29.7], [21, -28.6], [18, -28.7],
                        [16.4, -28.6],
                    ],
                },
                {
                    name: "Vaal", nav: 0,
                    pts: [[29.5, -26.8], [27, -26.9], [24.8, -28.4], [24, -29.2]],
                },
                {
                    name: "Limpopo", nav: 3,
                    pts: [[27.5, -25], [29.5, -22.2], [31.5, -22.4], [33.6, -25.2]],
                },
            ],
            lakes: [],
        },
        {
            id: "australia", name: "Australia", region: "distant",
            frame: { type: "local", lon0: 134, lat0: -27, at: [1.27, -0.72], k: 0.027, rot: 200 },
            polys: [
                {
                    name: "mainland",
                    pts: [
                        [114, -22], [113.5, -24.5], [114.5, -28], [115, -30.5], [115.7, -32.5],
                        [115, -34.2], [117, -35], [118.5, -34.8], [121.5, -33.9], [124, -33],
                        [126, -32.3], [129, -31.6], [131.5, -31.5], [134, -32.8], [135.8, -34.8],
                        [136.8, -33.5], [137.8, -33.2], [138.5, -35.5], [139.7, -37.2],
                        [141, -38.3], [143.5, -38.8], [145, -38.4], [146.3, -39.1], [148, -37.8],
                        [150, -37.3], [150.5, -35.5], [151.3, -33.8], [152.5, -32.3],
                        [153.6, -28.5], [153.2, -25.5], [151.5, -24], [150.3, -22.5], [149, -20.5],
                        [146.3, -18.8], [145.5, -16], [145.3, -14.8], [143.6, -14], [143, -11],
                        [142.5, -10.7], [141.6, -12.5], [141.5, -16], [140.5, -17.5], [139, -17],
                        [137, -15.8], [135.5, -14.8], [136.8, -12.2], [135, -12], [132.5, -11.5],
                        [131, -12.2], [130, -13], [129.5, -15], [127.5, -14.2], [126, -14],
                        [124.2, -16.3], [122.3, -17.5], [121, -19.5], [118.5, -20.3],
                        [116.5, -20.7],
                    ],
                },
                {
                    name: "Tasmania",
                    pts: [[144.7, -40.7], [148.3, -40.9], [148, -43], [146.9, -43.6], [145.5, -42.5]],
                },
            ],
            ranges: [
                {
                    name: "Great Dividing Range", w: 1.2, m: 0.12, h: 0.75,
                    pts: [
                        [145, -15], [146.5, -20], [148.5, -24], [150.5, -27], [151.2, -30],
                        [150.2, -33.5], [148.8, -36], [146.5, -37.5],
                    ],
                },
                {
                    name: "Snowy Mountains", w: 0.8, m: 0.6, h: 0.9,
                    pts: [[148.2, -35.8], [148.4, -36.8]],
                },
                {
                    name: "Flinders Ranges", w: 0.8, m: 0.1, h: 0.8,
                    pts: [[138.3, -33], [138.8, -31]],
                },
                {
                    name: "MacDonnell Ranges", w: 0.8, m: 0.1, h: 0.8,
                    pts: [[132, -23.6], [135, -23.6]],
                },
                {
                    name: "Hamersley Range", w: 0.9, m: 0.1, h: 0.8,
                    pts: [[116.5, -22.5], [119.5, -22.8]],
                },
                {
                    name: "Tasmanian Highlands", w: 0.7, m: 0.2, h: 0.8,
                    pts: [[145.8, -41.5], [146.5, -42.5]],
                },
            ],
            volcanoes: [],
            rivers: [
                {
                    name: "Murray", nav: 6,
                    pts: [
                        [148.2, -36.6], [146.5, -35.9], [144.5, -35.6], [142.2, -34.2],
                        [140.7, -34.1], [139.6, -35.1], [139.1, -35.6],
                    ],
                },
                {
                    name: "Darling", nav: 0,
                    pts: [[151, -28.5], [148, -29.8], [145.5, -30.4], [143.5, -32], [141.9, -34.1]],
                },
                { name: "Burdekin", nav: 0, pts: [[145.3, -19.8], [146.8, -20.5], [147.6, -19.5]] },
                { name: "Fitzroy", nav: 0, pts: [[148.3, -24.2], [150.3, -23.4], [150.9, -23.5]] },
                {
                    name: "Kimberley Fitzroy", nav: 0,
                    pts: [[126.5, -18.2], [124.5, -17.9], [123.5, -17.4]],
                },
            ],
            lakes: [],
        },
        {
            id: "new-zealand", name: "New Zealand", region: "distant",
            frame: { type: "local", lon0: 172.5, lat0: -41, at: [-0.98, -0.86], k: 0.068, rot: 165 },
            polys: [
                {
                    name: "North Island",
                    pts: [
                        [172.7, -34.4], [174.3, -35.5], [175, -36.8], [175.9, -37.5],
                        [178.5, -37.7], [177.9, -39.2], [176.8, -40], [175.3, -41.6],
                        [174.6, -41.3], [174.6, -39.8], [173.8, -39.2], [174.6, -38],
                        [174.5, -36.8], [173.6, -35.8],
                    ],
                },
                {
                    name: "South Island",
                    pts: [
                        [172.7, -40.5], [174.2, -41.2], [174.2, -41.8], [173.3, -43],
                        [173.1, -43.8], [171.3, -44.4], [170.8, -45.8], [169.8, -46.6],
                        [168.3, -46.6], [166.5, -46], [166.8, -45.2], [168.3, -44], [170.5, -43],
                        [171.5, -41.8], [172.1, -40.9],
                    ],
                },
                {
                    name: "Stewart Island",
                    pts: [[167.5, -46.7], [168.3, -46.7], [168.2, -47.3], [167.5, -47.2]],
                },
            ],
            ranges: [
                {
                    name: "Southern Alps", w: 1, m: 0.6, h: 0.9,
                    pts: [[167.3, -45.7], [168.8, -44.4], [170.5, -43.4], [172, -42.5], [173.4, -41.8]],
                },
                {
                    name: "Kaimanawa and Ruahine", w: 0.8, m: 0.15, h: 0.8,
                    pts: [[175.9, -40.3], [176.3, -39.3], [177.5, -38.3]],
                },
            ],
            volcanoes: [{ name: "Ruapehu", lon: 175.6, lat: -39.3 }],
            rivers: [
                {
                    name: "Waikato", nav: 0,
                    pts: [[175.9, -38.6], [175.6, -38], [175.1, -37.6], [174.7, -37.35]],
                },
                {
                    name: "Clutha", nav: 0,
                    pts: [[169.1, -44.6], [169.4, -45.4], [169.8, -46.1], [169.8, -46.4]],
                },
                { name: "Waitaki", nav: 0, pts: [[170, -44.2], [171, -44.6], [171.3, -44.9]] },
            ],
            lakes: [{ name: "Taupo", lon: 175.9, lat: -38.8, size: 1 }],
        },
    ],
    islands: [
        { name: "South Georgia", lon: -36.5, lat: -54.3, r: 1.2 },
        { name: "Kerguelen", lon: 69.5, lat: -49.3, r: 1.6 },
        { name: "Heard", lon: 73.5, lat: -53.1, r: 0.6 },
        { name: "Bouvet", lon: 3.4, lat: -54.4, r: 0.6 },
        { name: "Macquarie", lon: 158.9, lat: -54.6, r: 0.6 },
        { name: "South Orkney", lon: -45, lat: -60.6, r: 0.7 },
    ],
    wonders: [
        { feature: "FEATURE_TORRES_DEL_PAINE", land: "south-america", lon: -72.9, lat: -50.9 },
        { feature: "FEATURE_IGUAZU_FALLS", land: "south-america", lon: -54.4, lat: -25.7 },
        { feature: "FEATURE_HOERIKWAGGO", land: "africa", lon: 18.5, lat: -33.9 },
        { feature: "FEATURE_ULURU", land: "australia", lon: 131, lat: -25.3 },
        { feature: "FEATURE_BARRIER_REEF", land: "australia", lon: 147.5, lat: -18 },
    ],
};
