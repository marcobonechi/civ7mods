// serializer.js
// Serializes an in-memory Civ VII GEO object back into formatted ES Module JavaScript.

(function(global) {
    function fmtNum(n) {
        if (typeof n !== 'number' || isNaN(n)) return '0';
        // round to 4 decimals max to remove floating-point artifacts while keeping precision
        const rounded = Math.round(n * 10000) / 10000;
        return String(rounded);
    }

    function fmtPoint(p) {
        return `[${fmtNum(p[0])}, ${fmtNum(p[1])}]`;
    }

    function fmtPointList(pts, indent = '                ') {
        if (!pts || !pts.length) return '[]';
        const lines = [];
        let curLine = indent;
        for (let i = 0; i < pts.length; i++) {
            const ptStr = fmtPoint(pts[i]) + (i < pts.length - 1 ? ', ' : '');
            if (curLine.length + ptStr.length > 115 && curLine.trim().length > 0) {
                lines.push(curLine.trimEnd());
                curLine = indent + ptStr;
            } else {
                curLine += ptStr;
            }
        }
        if (curLine.trim().length > 0) lines.push(curLine.trimEnd());
        return '[\n' + lines.join('\n') + '\n' + indent.substring(4) + ']';
    }

    function serializeGEO(geo, mapName = "Europe, Mediterranean & Sahel") {
        const out = [];
        out.push(`// ${mapName.toLowerCase().replace(/\s+/g, '-')}-geo.js`);
        out.push(`// Geography configuration for Civilization VII map mod`);
        out.push(`// Exported from Civ VII Visual Map Editor`);
        out.push(``);
        out.push(`export const GEO = {`);

        // Projection
        out.push(`    // ---- projection -------------------------------------------------`);
        out.push(`    lonCenter: ${fmtNum(geo.lonCenter || 19.0)},`);
        out.push(`    spanRef: ${fmtNum(geo.spanRef || 70)},`);
        if (geo.lonSqueeze) {
            out.push(`    lonSqueeze: { from: ${fmtNum(geo.lonSqueeze.from)}, k: ${fmtNum(geo.lonSqueeze.k)} },`);
        }
        out.push(`    latRef: ${fmtNum(geo.latRef || 47)},`);
        out.push(`    scaleExp: ${fmtNum(geo.scaleExp || 0.5)},`);
        out.push(`    latBottom: ${fmtNum(geo.latBottom || 10.0)},`);
        out.push(`    latTop: ${fmtNum(geo.latTop || 71.0)},`);

        if (geo.latControl && geo.latControl.length) {
            const ctrlStr = geo.latControl.map(p => `[${fmtNum(p[0])}, ${fmtNum(p[1])}]`).join(', ');
            out.push(`    latControl: [${ctrlStr}],`);
        }
        if (geo.rangeScale !== undefined) out.push(`    rangeScale: ${fmtNum(geo.rangeScale)},`);
        if (geo.blobScale !== undefined) out.push(`    blobScale: ${fmtNum(geo.blobScale)},`);
        if (geo.landmassSplitLon !== undefined) out.push(`    landmassSplitLon: ${fmtNum(geo.landmassSplitLon)},`);

        if (geo.southWarp) {
            out.push(`    southWarp: {`);
            out.push(`        latPivot: ${fmtNum(geo.southWarp.latPivot || 33.0)},`);
            if (geo.southWarp.zones && geo.southWarp.zones.length) {
                out.push(`        zones: [`);
                geo.southWarp.zones.forEach((z, idx) => {
                    const comma = idx < geo.southWarp.zones.length - 1 ? ',' : '';
                    const mapStr = (z.map || []).map(p => `[${fmtNum(p[0])}, ${fmtNum(p[1])}]`).join(', ');
                    out.push(`            { lonStart: ${fmtNum(z.lonStart)}, lonFullStart: ${fmtNum(z.lonFullStart)}, lonFullEnd: ${fmtNum(z.lonFullEnd)}, lonEnd: ${fmtNum(z.lonEnd)},`);
                    out.push(`              map: [${mapStr}] }${comma}`);
                });
                out.push(`        ]`);
            } else if (geo.southWarp.westMap) {
                const mapStr = geo.southWarp.westMap.map(p => `[${fmtNum(p[0])}, ${fmtNum(p[1])}]`).join(', ');
                out.push(`        lonWestEnd: ${fmtNum(geo.southWarp.lonWestEnd)}, lonEastStart: ${fmtNum(geo.southWarp.lonEastStart)},`);
                out.push(`        westMap: [${mapStr}]`);
            }
            out.push(`    },`);
        }

        if (geo.bottomWater) {
            out.push(`    bottomWater: { rows: ${fmtNum(geo.bottomWater.rows)}, untilLon: ${fmtNum(geo.bottomWater.untilLon)} },`);
        }
        if (geo.leftWater) {
            out.push(`    leftWater: { cols: ${fmtNum(geo.leftWater.cols)}, belowLat: ${fmtNum(geo.leftWater.belowLat)} },`);
        }

        // Biome Blobs
        if (geo.biomeBlobs && geo.biomeBlobs.length) {
            out.push(``);
            out.push(`    // Green patches / oases: [lon, lat, radius in tiles, biome, rainfall, name]`);
            out.push(`    biomeBlobs: [`);
            const blobStrs = geo.biomeBlobs.map(b => {
                const nameStr = b[5] ? `, "${b[5]}"` : '';
                return `        [${fmtNum(b[0])}, ${fmtNum(b[1])}, ${fmtNum(b[2])}, "${b[3]}", ${fmtNum(b[4])}${nameStr}]`;
            });
            out.push(blobStrs.join(',\n'));
            out.push(`    ],`);
        }

        // Rivers
        if (geo.rivers && geo.rivers.length) {
            out.push(``);
            out.push(`    // Hand-placed navigable rivers: [lon, lat] along the course`);
            out.push(`    rivers: [`);
            geo.rivers.forEach((r, idx) => {
                const comma = idx < geo.rivers.length - 1 ? ',' : '';
                const ptsStr = (r.pts || []).map(p => fmtPoint(p)).join(', ');
                out.push(`        { name: ${JSON.stringify(r.name || "River")}, pts: [${ptsStr}] }${comma}`);
            });
            out.push(`    ],`);
        }

        // Land Polygons
        if (geo.land && geo.land.length) {
            out.push(``);
            out.push(`    // ---- land polygons -----------------------------------------------`);
            out.push(`    land: [`);
            geo.land.forEach((item, idx) => {
                const comma = idx < geo.land.length - 1 ? ',' : '';
                out.push(`        {`);
                out.push(`            name: ${JSON.stringify(item.name || "Land")}, pts: ${fmtPointList(item.pts, '                ')}`);
                out.push(`        }${comma}`);
            });
            out.push(`    ],`);
        }

        // Land Blobs
        if (geo.landBlobs && geo.landBlobs.length) {
            out.push(``);
            out.push(`    // Small islands: [lon, lat, radius, name]`);
            out.push(`    landBlobs: [`);
            const strs = geo.landBlobs.map(b => `        [${fmtNum(b[0])}, ${fmtNum(b[1])}, ${fmtNum(b[2])}, ${JSON.stringify(b[3] || "")}]`);
            out.push(strs.join(',\n'));
            out.push(`    ],`);
        }

        // Land Blobs Late
        if (geo.landBlobsLate && geo.landBlobsLate.length) {
            out.push(``);
            out.push(`    // Islands painted after straits: [lon, lat, radius, name]`);
            out.push(`    landBlobsLate: [`);
            const strs = geo.landBlobsLate.map(b => `        [${fmtNum(b[0])}, ${fmtNum(b[1])}, ${fmtNum(b[2])}, ${JSON.stringify(b[3] || "")}]`);
            out.push(strs.join(',\n'));
            out.push(`    ],`);
        }

        // Water Polygons
        if (geo.water && geo.water.length) {
            out.push(``);
            out.push(`    // Inland seas / water bodies`);
            out.push(`    water: [`);
            geo.water.forEach((item, idx) => {
                const comma = idx < geo.water.length - 1 ? ',' : '';
                out.push(`        {`);
                out.push(`            name: ${JSON.stringify(item.name || "Water")}, pts: ${fmtPointList(item.pts, '                ')}`);
                out.push(`        }${comma}`);
            });
            out.push(`    ],`);
        }

        // Water Lines
        if (geo.waterLines && geo.waterLines.length) {
            out.push(``);
            out.push(`    // Straits (one-hex water lines kept open)`);
            out.push(`    waterLines: [`);
            geo.waterLines.forEach((item, idx) => {
                const comma = idx < geo.waterLines.length - 1 ? ',' : '';
                const ptsStr = (item.pts || []).map(p => fmtPoint(p)).join(', ');
                out.push(`        { name: ${JSON.stringify(item.name || "Strait")}, pts: [${ptsStr}] }${comma}`);
            });
            out.push(`    ],`);
        }

        // Lakes
        if (geo.lakes && geo.lakes.length) {
            out.push(``);
            out.push(`    // Lakes: [lon, lat, radius, name]`);
            out.push(`    lakes: [`);
            const strs = geo.lakes.map(l => `        [${fmtNum(l[0])}, ${fmtNum(l[1])}, ${fmtNum(l[2])}, ${JSON.stringify(l[3] || "")}]`);
            out.push(strs.join(',\n'));
            out.push(`    ],`);
        }

        // Shallow
        if (geo.shallow && geo.shallow.length) {
            out.push(``);
            out.push(`    // Shallow water areas (coast only)`);
            out.push(`    shallow: [`);
            geo.shallow.forEach((item, idx) => {
                const comma = idx < geo.shallow.length - 1 ? ',' : '';
                out.push(`        {`);
                out.push(`            name: ${JSON.stringify(item.name || "Shallow")}, pts: ${fmtPointList(item.pts, '                ')}`);
                out.push(`        }${comma}`);
            });
            out.push(`    ],`);
        }

        // Mountain Ranges
        if (geo.ranges && geo.ranges.length) {
            out.push(``);
            out.push(`    // Mountain ranges: polyline with core (mountain) and fringe (hill) radii`);
            out.push(`    ranges: [`);
            geo.ranges.forEach((item, idx) => {
                const comma = idx < geo.ranges.length - 1 ? ',' : '';
                const ptsStr = (item.pts || []).map(p => fmtPoint(p)).join(', ');
                out.push(`        { name: ${JSON.stringify(item.name || "Range")}, core: ${fmtNum(item.core)}, fringe: ${fmtNum(item.fringe)}, pts: [${ptsStr}] }${comma}`);
            });
            out.push(`    ],`);
        }

        // Biome Areas
        if (geo.biomeAreas && geo.biomeAreas.length) {
            out.push(``);
            out.push(`    // Biome overrides (applied in order)`);
            out.push(`    biomeAreas: [`);
            geo.biomeAreas.forEach((item, idx) => {
                const comma = idx < geo.biomeAreas.length - 1 ? ',' : '';
                const probStr = item.prob !== undefined ? `, prob: ${fmtNum(item.prob)}` : '';
                out.push(`        {`);
                out.push(`            name: ${JSON.stringify(item.name || "Biome")}, biome: "${item.biome}"${probStr},`);
                out.push(`            pts: ${fmtPointList(item.pts, '                ')}`);
                out.push(`        }${comma}`);
            });
            out.push(`    ],`);
        }

        // Rain Areas
        if (geo.rainAreas && geo.rainAreas.length) {
            out.push(``);
            out.push(`    // Rainfall overrides`);
            out.push(`    rainAreas: [`);
            geo.rainAreas.forEach((item, idx) => {
                const comma = idx < geo.rainAreas.length - 1 ? ',' : '';
                out.push(`        {`);
                out.push(`            name: ${JSON.stringify(item.name || "Rain")}, rain: ${fmtNum(item.rain)},`);
                out.push(`            pts: ${fmtPointList(item.pts, '                ')}`);
                out.push(`        }${comma}`);
            });
            out.push(`    ],`);
        }

        // Volcanoes
        if (geo.volcanoes && geo.volcanoes.length) {
            out.push(``);
            out.push(`    // Volcanoes: [lon, lat, name]`);
            out.push(`    volcanoes: [`);
            const strs = geo.volcanoes.map(v => `        [${fmtNum(v[0])}, ${fmtNum(v[1])}, ${JSON.stringify(v[2] || "")}]`);
            out.push(strs.join(',\n'));
            out.push(`    ],`);
        }

        // True Start Locations
        if (geo.tsl) {
            out.push(``);
            out.push(`    // True start location per civilization`);
            out.push(`    tsl: {`);
            const keys = Object.keys(geo.tsl);
            keys.forEach((civ, idx) => {
                const comma = idx < keys.length - 1 ? ',' : '';
                const pt = geo.tsl[civ];
                out.push(`        ${civ}: [${fmtNum(pt[0])}, ${fmtNum(pt[1])}]${comma}`);
            });
            out.push(`    },`);
        }

        // Fallback Start Sites
        if (geo.fallbackSites && geo.fallbackSites.length) {
            out.push(``);
            out.push(`    // Fallback start sites, ranked best first`);
            out.push(`    fallbackSites: [`);
            const strs = geo.fallbackSites.map(f => `        [${fmtNum(f[0])}, ${fmtNum(f[1])}, ${JSON.stringify(f[2] || "")}]`);
            out.push(strs.join(',\n'));
            out.push(`    ]`);
        }

        out.push(`};`);
        out.push(``);
        return out.join('\n');
    }

    const CivSerializer = { serializeGEO, fmtNum, fmtPoint };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CivSerializer;
    } else {
        global.CivSerializer = CivSerializer;
    }
})(typeof window !== 'undefined' ? window : globalThis);
