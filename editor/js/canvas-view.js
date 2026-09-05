// canvas-view.js
// High-performance canvas renderer for Civ VII hex grid and interactive vector geometry.

(function(global) {
    const DEG = Math.PI / 180;
    const SQRT3 = Math.sqrt(3);

    // Modern Civ VII themed color palette
    const PALETTE = {
        bg: '#0a0f16',
        gridLine: 'rgba(255, 255, 255, 0.05)',
        ocean: '#0d2238',
        coast: '#2a6496',
        river: '#4da6e0',
        volcano: '#ff4d2e',
        biome: {
            G: '#458532', // Grassland
            P: '#a3944d', // Plains
            D: '#d4bf79', // Desert
            T: '#98a7ae', // Tundra
            R: '#246b33'  // Tropical
        },
        mountain: '#40332a',
        mountainPeak: '#6e5849',
        hill: 'rgba(0, 0, 0, 0.32)',
        selection: '#00e5ff',
        selectionFill: 'rgba(0, 229, 255, 0.12)',
        hover: '#ffea00',
        vertex: '#ffffff',
        vertexActive: '#00e5ff',
        vertexHover: '#ffd600',
        rangeCore: 'rgba(180, 70, 40, 0.35)',
        rangeFringe: 'rgba(210, 140, 50, 0.18)',
        strait: '#00ffff',
        lake: '#21739c'
    };

    class CivCanvasView {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.options = options;

            // Geometry & Grid state
            this.geo = null;
            this.grid = null;
            this.W = 112;
            this.H = 98;

            // Viewport transforms (pan & zoom)
            this.scale = 1.0;
            this.panX = 30;
            this.panY = 30;
            this.baseTileS = 8; // base hex radius in pixels

            // Layer visibility flags
            this.layers = {
                hexRaster: true,
                hexGrid: true,
                landPolys: true,
                mountainRanges: true,
                rivers: true,
                straits: true,
                lakesBlobs: true,
                biomeAreas: true,
                startsVolcanoes: true,
                handles: true,
                labels: true
            };

            // Selection & Interaction state
            this.selectedFeature = null; // { type: 'land'|'ranges'|..., index: 0, subIndex?: null }
            this.selectedVertexIndex = -1;
            this.hoveredFeature = null;
            this.hoveredVertexIndex = -1;
            this.hoveredEdge = null; // { p1: index, p2: index, insertLonLat: [lon, lat] }
            this.isDragging = false;
            this.isPanning = false;
            this.lastMouse = { x: 0, y: 0 };
            this.dragStartPoint = null;
            this.activeTool = 'select'; // 'select' | 'add-point' | 'draw-poly' | 'draw-line' | 'place-point'
            this.drawBuffer = []; // points currently being drawn

            // Callbacks
            this.onFeatureSelect = options.onFeatureSelect || (() => {});
            this.onGeometryChange = options.onGeometryChange || (() => {});
            this.onCursorMove = options.onCursorMove || (() => {});

            this.initEvents();
            this.resize();
        }

        resize() {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.canvas.style.width = `${rect.width}px`;
            this.canvas.style.height = `${rect.height}px`;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.render();
        }

        setMapData(geo, W, H) {
            this.geo = geo;
            this.W = W || this.W;
            this.H = H || this.H;
            this.rebuildGrid();
            this.fitToScreen();
        }

        rebuildGrid() {
            if (!this.geo) return;
            let seed = 12345;
            const rnd = () => {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                return seed / 0x7fffffff;
            };
            this.grid = window.CivRasterizer.buildEuropeGrid(this.W, this.H, this.geo, rnd);
            this.render();
        }

        // Coordinate Conversions
        // tile coords [xf, yf] -> local map pixel coords
        tileToPixel(xf, yf) {
            const s = this.baseTileS;
            const w = SQRT3 * s;
            const hh = 2 * s;
            const px = xf * w + w / 2 + 2;
            const py = (this.H - 1 - yf) * 0.75 * hh + hh / 2 + 2;
            return [px, py];
        }

        // local map pixel coords -> tile coords [xf, yf]
        pixelToTile(px, py) {
            const s = this.baseTileS;
            const w = SQRT3 * s;
            const hh = 2 * s;
            const xf = (px - 2 - w / 2) / w;
            const yf = (this.H - 1) - (py - 2 - hh / 2) / (0.75 * hh);
            return [xf, yf];
        }

        // Geographic [lon, lat] -> screen canvas pixel coords (with current pan & zoom)
        geoToScreen(lon, lat) {
            if (!this.grid || !this.grid.P) return [0, 0];
            const [xf, yf] = this.grid.P.toTile(lon, lat);
            const [mx, my] = this.tileToPixel(xf, yf);
            return [mx * this.scale + this.panX, my * this.scale + this.panY];
        }

        // Screen canvas pixel coords -> Geographic [lon, lat]
        screenToGeo(sx, sy) {
            if (!this.grid || !this.grid.P) return [0, 0];
            const mx = (sx - this.panX) / this.scale;
            const my = (sy - this.panY) / this.scale;
            const [xf, yf] = this.pixelToTile(mx, my);
            return this.grid.P.toGeo(xf, yf);
        }

        screenToTile(sx, sy) {
            const mx = (sx - this.panX) / this.scale;
            const my = (sy - this.panY) / this.scale;
            return this.pixelToTile(mx, my);
        }

        fitToScreen() {
            if (!this.canvas.parentElement) return;
            const rect = this.canvas.parentElement.getBoundingClientRect();
            const s = this.baseTileS;
            const w = SQRT3 * s;
            const hh = 2 * s;
            const mapW = (this.W + 1) * w + 20;
            const mapH = (this.H + 1) * 0.75 * hh + hh + 20;

            const scaleX = (rect.width - 60) / mapW;
            const scaleY = (rect.height - 60) / mapH;
            this.scale = Math.max(0.4, Math.min(scaleX, scaleY, 2.5));
            this.panX = (rect.width - mapW * this.scale) / 2;
            this.panY = (rect.height - mapH * this.scale) / 2;
            this.render();
        }

        resetZoom() {
            this.scale = 1.0;
            this.fitToScreen();
        }

        // Event Handling
        initEvents() {
            const cv = this.canvas;

            cv.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = cv.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
                const newScale = Math.max(0.3, Math.min(6.0, this.scale * zoomFactor));

                // Zoom centered on cursor
                this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
                this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
                this.scale = newScale;

                this.render();
            }, { passive: false });

            cv.addEventListener('mousedown', (e) => {
                const rect = cv.getBoundingClientRect();
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;
                this.lastMouse = { x: sx, y: sy };

                if (e.button === 1 || e.button === 2 || e.shiftKey || e.spaceKey) {
                    // Pan with middle click, right click, or Shift/Space + left click
                    this.isPanning = true;
                    cv.style.cursor = 'grabbing';
                    return;
                }

                if (e.button === 0) {
                    this.handleLeftMouseDown(sx, sy);
                }
            });

            window.addEventListener('mousemove', (e) => {
                const rect = cv.getBoundingClientRect();
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;

                if (this.isPanning) {
                    this.panX += sx - this.lastMouse.x;
                    this.panY += sy - this.lastMouse.y;
                    this.lastMouse = { x: sx, y: sy };
                    this.render();
                    return;
                }

                if (this.isDragging && this.selectedFeature && this.selectedVertexIndex >= 0) {
                    const [lon, lat] = this.screenToGeo(sx, sy);
                    this.updateSelectedVertexPosition(lon, lat);
                    this.lastMouse = { x: sx, y: sy };
                    this.render();
                    return;
                }

                // Normal hover updates
                this.lastMouse = { x: sx, y: sy };
                this.handleMouseMove(sx, sy);
            });

            window.addEventListener('mouseup', (e) => {
                if (this.isPanning) {
                    this.isPanning = false;
                    cv.style.cursor = 'crosshair';
                }
                if (this.isDragging) {
                    this.isDragging = false;
                    this.rebuildGrid();
                    this.onGeometryChange('drag-end', this.selectedFeature);
                }
            });

            // Prevent default context menu so right-drag works seamlessly
            cv.addEventListener('contextmenu', (e) => e.preventDefault());

            window.addEventListener('keydown', (e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    // Only if not focused in an input
                    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
                    if (this.selectedFeature && this.selectedVertexIndex >= 0) {
                        e.preventDefault();
                        this.deleteSelectedVertex();
                    }
                }
            });
        }

        handleLeftMouseDown(sx, sy) {
            // Check if user clicked on a vertex handle of the selected feature first
            if (this.selectedFeature) {
                const pts = this.getFeaturePoints(this.selectedFeature);
                if (pts) {
                    for (let i = 0; i < pts.length; i++) {
                        const [vx, vy] = this.geoToScreen(pts[i][0], pts[i][1]);
                        const dist = Math.hypot(sx - vx, sy - vy);
                        if (dist <= 10) {
                            this.selectedVertexIndex = i;
                            this.isDragging = true;
                            this.render();
                            return;
                        }
                    }
                }
            }

            // Check if clicking on an edge of selected polygon/line to insert a vertex
            if (this.hoveredEdge && this.selectedFeature) {
                const { p1, p2, insertLonLat } = this.hoveredEdge;
                this.insertVertexAt(this.selectedFeature, p2, insertLonLat);
                this.selectedVertexIndex = p2;
                this.isDragging = true;
                this.rebuildGrid();
                return;
            }

            // Hit test other features to select them
            const hit = this.hitTestFeatures(sx, sy);
            if (hit) {
                this.selectFeature(hit.feature, hit.vertexIndex);
                if (hit.vertexIndex >= 0) {
                    this.isDragging = true;
                }
            } else {
                // Clicked empty space
                this.selectFeature(null);
            }
            this.render();
        }

        handleMouseMove(sx, sy) {
            const [lon, lat] = this.screenToGeo(sx, sy);
            const [xf, yf] = this.screenToTile(sx, sy);
            const tx = Math.round(xf - 0.5 * (Math.round(yf) & 1));
            const ty = Math.round(yf);

            // Cursor info callback
            let tileInfo = null;
            if (this.grid && this.grid.inBounds(tx, ty)) {
                const idx = this.grid.idx(tx, ty);
                tileInfo = {
                    x: tx, y: ty,
                    terrain: this.grid.terrain[idx],
                    biome: this.grid.biome[idx],
                    rain: this.grid.rain[idx],
                    isLand: this.grid.isLand[idx],
                    lon: this.grid.lonC[idx],
                    lat: this.grid.latC[idx]
                };
            }

            this.onCursorMove({ lon, lat, xf, yf, tile: tileInfo });

            // Check hover over vertices
            let hoveredV = -1;
            if (this.selectedFeature) {
                const pts = this.getFeaturePoints(this.selectedFeature);
                if (pts) {
                    for (let i = 0; i < pts.length; i++) {
                        const [vx, vy] = this.geoToScreen(pts[i][0], pts[i][1]);
                        if (Math.hypot(sx - vx, sy - vy) <= 9) {
                            hoveredV = i;
                            break;
                        }
                    }
                }
            }

            this.hoveredVertexIndex = hoveredV;

            // Check hover over edges for insertion
            this.hoveredEdge = null;
            if (hoveredV === -1 && this.selectedFeature) {
                this.checkEdgeHover(sx, sy);
            }

            // Feature hover
            if (hoveredV === -1 && !this.hoveredEdge) {
                const hit = this.hitTestFeatures(sx, sy);
                this.hoveredFeature = hit ? hit.feature : null;
            } else {
                this.hoveredFeature = null;
            }

            this.render();
        }

        checkEdgeHover(sx, sy) {
            const pts = this.getFeaturePoints(this.selectedFeature);
            if (!pts || pts.length < 2) return;
            const isClosed = this.isFeatureClosed(this.selectedFeature);
            const numSegments = isClosed ? pts.length : pts.length - 1;

            for (let i = 0; i < numSegments; i++) {
                const j = (i + 1) % pts.length;
                const [ax, ay] = this.geoToScreen(pts[i][0], pts[i][1]);
                const [bx, by] = this.geoToScreen(pts[j][0], pts[j][1]);

                // Distance from (sx, sy) to segment (ax, ay)-(bx, by)
                const dx = bx - ax, dy = by - ay;
                const len2 = dx * dx + dy * dy;
                if (len2 === 0) continue;
                let t = ((sx - ax) * dx + (sy - ay) * dy) / len2;
                if (t >= 0.08 && t <= 0.92) {
                    const px = ax + t * dx, py = ay + t * dy;
                    if (Math.hypot(sx - px, sy - py) <= 7) {
                        const [lon, lat] = this.screenToGeo(px, py);
                        this.hoveredEdge = { p1: i, p2: j, insertLonLat: [lon, lat], screenPos: [px, py] };
                        return;
                    }
                }
            }
        }

        hitTestFeatures(sx, sy) {
            if (!this.geo) return null;

            // Check Start Locations (TSL)
            if (this.layers.startsVolcanoes && this.geo.tsl) {
                for (const civ in this.geo.tsl) {
                    const pt = this.geo.tsl[civ];
                    const [px, py] = this.geoToScreen(pt[0], pt[1]);
                    if (Math.hypot(sx - px, sy - py) <= 12) {
                        return { feature: { type: 'tsl', key: civ }, vertexIndex: 0 };
                    }
                }
            }

            // Check Fallback Sites
            if (this.layers.startsVolcanoes && this.geo.fallbackSites) {
                for (let i = 0; i < this.geo.fallbackSites.length; i++) {
                    const f = this.geo.fallbackSites[i];
                    const [px, py] = this.geoToScreen(f[0], f[1]);
                    if (Math.hypot(sx - px, sy - py) <= 10) {
                        return { feature: { type: 'fallbackSites', index: i }, vertexIndex: 0 };
                    }
                }
            }

            // Check Volcanoes
            if (this.layers.startsVolcanoes && this.geo.volcanoes) {
                for (let i = 0; i < this.geo.volcanoes.length; i++) {
                    const v = this.geo.volcanoes[i];
                    const [px, py] = this.geoToScreen(v[0], v[1]);
                    if (Math.hypot(sx - px, sy - py) <= 10) {
                        return { feature: { type: 'volcanoes', index: i }, vertexIndex: 0 };
                    }
                }
            }

            // Check Blobs / Lakes
            if (this.layers.lakesBlobs) {
                const blobLists = [
                    { type: 'landBlobs', list: this.geo.landBlobs },
                    { type: 'landBlobsLate', list: this.geo.landBlobsLate },
                    { type: 'lakes', list: this.geo.lakes },
                    { type: 'biomeBlobs', list: this.geo.biomeBlobs }
                ];
                for (const g of blobLists) {
                    if (!g.list) continue;
                    for (let i = 0; i < g.list.length; i++) {
                        const b = g.list[i];
                        const [px, py] = this.geoToScreen(b[0], b[1]);
                        if (Math.hypot(sx - px, sy - py) <= 12) {
                            return { feature: { type: g.type, index: i }, vertexIndex: 0 };
                        }
                    }
                }
            }

            // Check Mountain Ranges
            if (this.layers.mountainRanges && this.geo.ranges) {
                for (let i = 0; i < this.geo.ranges.length; i++) {
                    const r = this.geo.ranges[i];
                    for (let p = 0; p < r.pts.length; p++) {
                        const [px, py] = this.geoToScreen(r.pts[p][0], r.pts[p][1]);
                        if (Math.hypot(sx - px, sy - py) <= 8) {
                            return { feature: { type: 'ranges', index: i }, vertexIndex: p };
                        }
                    }
                }
            }

            // Check Rivers
            if (this.layers.rivers && this.geo.rivers) {
                for (let i = 0; i < this.geo.rivers.length; i++) {
                    const r = this.geo.rivers[i];
                    for (let p = 0; p < r.pts.length; p++) {
                        const [px, py] = this.geoToScreen(r.pts[p][0], r.pts[p][1]);
                        if (Math.hypot(sx - px, sy - py) <= 8) {
                            return { feature: { type: 'rivers', index: i }, vertexIndex: p };
                        }
                    }
                }
            }

            // Check Straits
            if (this.layers.straits && this.geo.waterLines) {
                for (let i = 0; i < this.geo.waterLines.length; i++) {
                    const r = this.geo.waterLines[i];
                    for (let p = 0; p < r.pts.length; p++) {
                        const [px, py] = this.geoToScreen(r.pts[p][0], r.pts[p][1]);
                        if (Math.hypot(sx - px, sy - py) <= 8) {
                            return { feature: { type: 'waterLines', index: i }, vertexIndex: p };
                        }
                    }
                }
            }

            // Check Land Polygons (Mainland & Islands)
            if (this.layers.landPolys && this.geo.land) {
                for (let i = 0; i < this.geo.land.length; i++) {
                    const item = this.geo.land[i];
                    for (let p = 0; p < item.pts.length; p++) {
                        const [px, py] = this.geoToScreen(item.pts[p][0], item.pts[p][1]);
                        if (Math.hypot(sx - px, sy - py) <= 8) {
                            return { feature: { type: 'land', index: i }, vertexIndex: p };
                        }
                    }
                }
            }

            // Check Biome Areas
            if (this.layers.biomeAreas && this.geo.biomeAreas) {
                for (let i = 0; i < this.geo.biomeAreas.length; i++) {
                    const item = this.geo.biomeAreas[i];
                    for (let p = 0; p < item.pts.length; p++) {
                        const [px, py] = this.geoToScreen(item.pts[p][0], item.pts[p][1]);
                        if (Math.hypot(sx - px, sy - py) <= 8) {
                            return { feature: { type: 'biomeAreas', index: i }, vertexIndex: p };
                        }
                    }
                }
            }

            return null;
        }

        getFeaturePoints(feat) {
            if (!feat || !this.geo) return null;
            const { type, index, key } = feat;
            if (type === 'tsl') return [this.geo.tsl[key]];
            if (type === 'fallbackSites') return [this.geo.fallbackSites[index]];
            if (type === 'volcanoes') return [this.geo.volcanoes[index]];
            if (['landBlobs', 'landBlobsLate', 'lakes', 'biomeBlobs'].includes(type)) {
                const b = this.geo[type][index];
                return [[b[0], b[1]]];
            }
            if (['land', 'water', 'shallow', 'ranges', 'rivers', 'waterLines', 'biomeAreas', 'rainAreas'].includes(type)) {
                return this.geo[type][index] ? this.geo[type][index].pts : null;
            }
            return null;
        }

        isFeatureClosed(feat) {
            if (!feat) return false;
            return ['land', 'water', 'shallow', 'biomeAreas', 'rainAreas'].includes(feat.type);
        }

        selectFeature(feat, vertexIndex = -1) {
            this.selectedFeature = feat;
            this.selectedVertexIndex = vertexIndex;
            this.onFeatureSelect(feat, vertexIndex);
            this.render();
        }

        updateSelectedVertexPosition(lon, lat) {
            if (!this.selectedFeature || this.selectedVertexIndex < 0) return;
            const { type, index, key } = this.selectedFeature;
            const rLon = Math.round(lon * 100) / 100;
            const rLat = Math.round(lat * 100) / 100;

            if (type === 'tsl') {
                this.geo.tsl[key] = [rLon, rLat];
            } else if (type === 'fallbackSites') {
                this.geo.fallbackSites[index][0] = rLon;
                this.geo.fallbackSites[index][1] = rLat;
            } else if (type === 'volcanoes') {
                this.geo.volcanoes[index][0] = rLon;
                this.geo.volcanoes[index][1] = rLat;
            } else if (['landBlobs', 'landBlobsLate', 'lakes', 'biomeBlobs'].includes(type)) {
                this.geo[type][index][0] = rLon;
                this.geo[type][index][1] = rLat;
            } else {
                const item = this.geo[type][index];
                if (item && item.pts && item.pts[this.selectedVertexIndex]) {
                    item.pts[this.selectedVertexIndex] = [rLon, rLat];
                }
            }
            this.onGeometryChange('vertex-move', this.selectedFeature);
        }

        insertVertexAt(feat, atIndex, lonLat) {
            const pts = this.getFeaturePoints(feat);
            if (!pts) return;
            const rPt = [Math.round(lonLat[0] * 100) / 100, Math.round(lonLat[1] * 100) / 100];
            pts.splice(atIndex, 0, rPt);
            this.onGeometryChange('vertex-insert', feat);
        }

        deleteSelectedVertex() {
            if (!this.selectedFeature || this.selectedVertexIndex < 0) return;
            const pts = this.getFeaturePoints(this.selectedFeature);
            if (!pts) return;
            const isClosed = this.isFeatureClosed(this.selectedFeature);
            const minPoints = isClosed ? 3 : 2;

            if (pts.length <= minPoints) {
                alert(`Cannot delete vertex: minimum ${minPoints} points required for this feature.`);
                return;
            }

            pts.splice(this.selectedVertexIndex, 1);
            this.selectedVertexIndex = Math.max(0, this.selectedVertexIndex - 1);
            this.rebuildGrid();
            this.onGeometryChange('vertex-delete', this.selectedFeature);
            this.render();
        }

        // ---- RENDER ENGINE --------------------------------------------------
        render() {
            const ctx = this.ctx;
            const dpr = window.devicePixelRatio || 1;
            const w = this.canvas.width / dpr;
            const h = this.canvas.height / dpr;

            ctx.save();
            ctx.clearRect(0, 0, w, h);

            // Fill viewport background
            ctx.fillStyle = PALETTE.bg;
            ctx.fillRect(0, 0, w, h);

            if (!this.geo || !this.grid) {
                ctx.restore();
                return;
            }

            // Apply camera transform
            ctx.translate(this.panX, this.panY);
            ctx.scale(this.scale, this.scale);

            // 1. Hex Raster Layer
            if (this.layers.hexRaster) {
                this.renderHexGrid(ctx);
            }

            // 2. Vector Layers
            if (this.layers.biomeAreas && this.geo.biomeAreas) {
                this.renderPolygonLayer(ctx, this.geo.biomeAreas, 'biomeAreas');
            }

            if (this.layers.waterPolys && this.geo.water) {
                this.renderPolygonLayer(ctx, this.geo.water, 'water');
            }

            if (this.layers.landPolys && this.geo.land) {
                this.renderPolygonLayer(ctx, this.geo.land, 'land');
            }

            if (this.layers.mountainRanges && this.geo.ranges) {
                this.renderMountainRanges(ctx);
            }

            if (this.layers.straits && this.geo.waterLines) {
                this.renderPolylineLayer(ctx, this.geo.waterLines, 'waterLines', PALETTE.strait, 2, [4, 4]);
            }

            if (this.layers.rivers && this.geo.rivers) {
                this.renderPolylineLayer(ctx, this.geo.rivers, 'rivers', PALETTE.river, 2.5);
            }

            if (this.layers.lakesBlobs) {
                this.renderBlobs(ctx);
            }

            if (this.layers.startsVolcanoes) {
                this.renderStartsAndVolcanoes(ctx);
            }

            // 3. Control Handles & Edge Insertion preview
            if (this.layers.handles && this.selectedFeature) {
                this.renderSelectedHandles(ctx);
            }

            if (this.hoveredEdge) {
                this.renderEdgeInsertionIndicator(ctx);
            }

            ctx.restore();
        }

        renderHexGrid(ctx) {
            const g = this.grid;
            const s = this.baseTileS;
            const w = SQRT3 * s;
            const hh = 2 * s;
            const T = window.CivRasterizer.T;

            // Pre-calculate hex vertex angles
            const hexAngles = [];
            for (let k = 0; k < 6; k++) hexAngles.push((60 * k - 30) * DEG);

            for (let y = this.H - 1; y >= 0; y--) {
                for (let x = 0; x < this.W; x++) {
                    const i = g.idx(x, y);
                    const t = g.terrain[i];
                    const b = g.biome[i];

                    let fill = PALETTE.ocean;
                    if (t === T.OCEAN) fill = PALETTE.ocean;
                    else if (t === T.COAST) fill = PALETTE.coast;
                    else if (t === T.RIVER) fill = PALETTE.river;
                    else fill = PALETTE.biome[b] || '#4f9a3a';

                    const [cx, cy] = this.tileToPixel(x + 0.5 * (y & 1), y);

                    // Draw Hexagon
                    ctx.beginPath();
                    for (let k = 0; k < 6; k++) {
                        const a = hexAngles[k];
                        const px = cx + s * Math.cos(a);
                        const py = cy + s * Math.sin(a);
                        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fillStyle = fill;
                    ctx.fill();

                    if (this.layers.hexGrid) {
                        ctx.strokeStyle = PALETTE.gridLine;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }

                    // Hills overlay
                    if (t === T.HILL) {
                        ctx.fillStyle = PALETTE.hill;
                        ctx.beginPath();
                        ctx.arc(cx, cy, s * 0.36, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // Mountains overlay
                    if (t === T.MOUNTAIN) {
                        ctx.fillStyle = PALETTE.mountain;
                        ctx.beginPath();
                        ctx.moveTo(cx - s * 0.65, cy + s * 0.5);
                        ctx.lineTo(cx, cy - s * 0.65);
                        ctx.lineTo(cx + s * 0.65, cy + s * 0.5);
                        ctx.closePath();
                        ctx.fill();

                        ctx.fillStyle = PALETTE.mountainPeak;
                        ctx.beginPath();
                        ctx.moveTo(cx - s * 0.25, cy - s * 0.15);
                        ctx.lineTo(cx, cy - s * 0.65);
                        ctx.lineTo(cx + s * 0.25, cy - s * 0.15);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }
        }

        renderPolygonLayer(ctx, list, type) {
            const isSelectedType = this.selectedFeature && this.selectedFeature.type === type;

            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                if (!item.pts || item.pts.length < 3) continue;

                const isSelected = isSelectedType && this.selectedFeature.index === i;
                const isHovered = this.hoveredFeature && this.hoveredFeature.type === type && this.hoveredFeature.index === i;

                ctx.beginPath();
                for (let p = 0; p < item.pts.length; p++) {
                    const [px, py] = this.tileToPixel(...this.grid.P.toTile(item.pts[p][0], item.pts[p][1]));
                    if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();

                if (type === 'land') {
                    ctx.strokeStyle = isSelected ? PALETTE.selection : (isHovered ? PALETTE.hover : (i === 0 ? '#ffcc00' : '#ffa500'));
                    ctx.lineWidth = isSelected ? 2.5 : (isHovered ? 2 : 1.2);
                    ctx.fillStyle = isSelected ? PALETTE.selectionFill : 'rgba(255, 204, 0, 0.03)';
                } else if (type === 'biomeAreas') {
                    const bColor = PALETTE.biome[item.biome] || '#458532';
                    ctx.strokeStyle = isSelected ? PALETTE.selection : bColor;
                    ctx.lineWidth = isSelected ? 2 : 1;
                    ctx.fillStyle = isSelected ? PALETTE.selectionFill : 'rgba(255, 255, 255, 0.06)';
                } else if (type === 'water') {
                    ctx.strokeStyle = isSelected ? PALETTE.selection : '#00b4d8';
                    ctx.lineWidth = isSelected ? 2 : 1;
                    ctx.fillStyle = 'rgba(0, 180, 216, 0.08)';
                }

                ctx.fill();
                ctx.stroke();

                // Name label
                if (this.layers.labels && item.name && (isSelected || isHovered || this.scale > 1.2)) {
                    const [lx, ly] = this.tileToPixel(...this.grid.P.toTile(item.pts[0][0], item.pts[0][1]));
                    this.drawLabel(ctx, item.name, lx, ly - 6, isSelected ? PALETTE.selection : '#ffffff');
                }
            }
        }

        renderPolylineLayer(ctx, list, type, color, width = 2, dash = []) {
            const isSelectedType = this.selectedFeature && this.selectedFeature.type === type;

            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                if (!item.pts || item.pts.length < 2) continue;

                const isSelected = isSelectedType && this.selectedFeature.index === i;
                const isHovered = this.hoveredFeature && this.hoveredFeature.type === type && this.hoveredFeature.index === i;

                ctx.beginPath();
                ctx.setLineDash(dash);
                for (let p = 0; p < item.pts.length; p++) {
                    const [px, py] = this.tileToPixel(...this.grid.P.toTile(item.pts[p][0], item.pts[p][1]));
                    if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }

                ctx.strokeStyle = isSelected ? PALETTE.selection : (isHovered ? PALETTE.hover : color);
                ctx.lineWidth = isSelected ? width + 1.5 : (isHovered ? width + 0.8 : width);
                ctx.stroke();
                ctx.setLineDash([]);

                if (this.layers.labels && item.name && (isSelected || isHovered || this.scale > 1.2)) {
                    const midP = item.pts[Math.floor(item.pts.length / 2)];
                    const [lx, ly] = this.tileToPixel(...this.grid.P.toTile(midP[0], midP[1]));
                    this.drawLabel(ctx, item.name, lx, ly - 6, isSelected ? PALETTE.selection : color);
                }
            }
        }

        renderMountainRanges(ctx) {
            const isSelectedType = this.selectedFeature && this.selectedFeature.type === 'ranges';
            const s = this.baseTileS;
            const w = SQRT3 * s;

            for (let i = 0; i < this.geo.ranges.length; i++) {
                const r = this.geo.ranges[i];
                if (!r.pts || !r.pts.length) continue;

                const isSelected = isSelectedType && this.selectedFeature.index === i;
                const isHovered = this.hoveredFeature && this.hoveredFeature.type === 'ranges' && this.hoveredFeature.index === i;

                // Draw Core & Fringe buffers along spine
                const rScale = this.geo.rangeScale || 1;
                const corePx = r.core * rScale * w;
                const fringePx = r.fringe * rScale * w;

                // Fringe buffer ribbon
                if (fringePx > 0 && r.pts.length > 1) {
                    ctx.beginPath();
                    for (let p = 0; p < r.pts.length; p++) {
                        const [px, py] = this.tileToPixel(...this.grid.P.toTile(r.pts[p][0], r.pts[p][1]));
                        if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = PALETTE.rangeFringe;
                    ctx.lineWidth = fringePx * 2;
                    ctx.stroke();
                }

                // Core buffer ribbon
                if (corePx > 0 && r.pts.length > 1) {
                    ctx.beginPath();
                    for (let p = 0; p < r.pts.length; p++) {
                        const [px, py] = this.tileToPixel(...this.grid.P.toTile(r.pts[p][0], r.pts[p][1]));
                        if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = PALETTE.rangeCore;
                    ctx.lineWidth = corePx * 2;
                    ctx.stroke();
                }

                // Mountain Range Central Spine
                ctx.beginPath();
                for (let p = 0; p < r.pts.length; p++) {
                    const [px, py] = this.tileToPixel(...this.grid.P.toTile(r.pts[p][0], r.pts[p][1]));
                    if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = isSelected ? PALETTE.selection : (isHovered ? PALETTE.hover : '#ff7b54');
                ctx.lineWidth = isSelected ? 3 : 1.8;
                ctx.stroke();

                if (this.layers.labels && r.name && (isSelected || isHovered || this.scale > 1.2)) {
                    const midP = r.pts[Math.floor(r.pts.length / 2)];
                    const [lx, ly] = this.tileToPixel(...this.grid.P.toTile(midP[0], midP[1]));
                    this.drawLabel(ctx, r.name, lx, ly - 8, isSelected ? PALETTE.selection : '#ff7b54');
                }
            }
        }

        renderBlobs(ctx) {
            const s = this.baseTileS;
            const w = SQRT3 * s;
            const bScale = this.geo.blobScale || 1;

            const groups = [
                { type: 'landBlobs', list: this.geo.landBlobs, color: '#ffaa00' },
                { type: 'landBlobsLate', list: this.geo.landBlobsLate, color: '#ff8800' },
                { type: 'lakes', list: this.geo.lakes, color: PALETTE.lake },
                { type: 'biomeBlobs', list: this.geo.biomeBlobs, color: '#55c57a' }
            ];

            for (const g of groups) {
                if (!g.list) continue;
                const isSelectedType = this.selectedFeature && this.selectedFeature.type === g.type;

                for (let i = 0; i < g.list.length; i++) {
                    const item = g.list[i];
                    const isSelected = isSelectedType && this.selectedFeature.index === i;
                    const isHovered = this.hoveredFeature && this.hoveredFeature.type === g.type && this.hoveredFeature.index === i;

                    const [px, py] = this.tileToPixel(...this.grid.P.toTile(item[0], item[1]));
                    const radius = (item[2] || 1) * bScale * (w * 0.5);

                    ctx.beginPath();
                    ctx.arc(px, py, Math.max(3, radius), 0, Math.PI * 2);
                    ctx.fillStyle = isSelected ? PALETTE.selectionFill : 'rgba(255, 255, 255, 0.1)';
                    ctx.fill();
                    ctx.strokeStyle = isSelected ? PALETTE.selection : (isHovered ? PALETTE.hover : g.color);
                    ctx.lineWidth = isSelected ? 2.5 : 1.5;
                    ctx.stroke();

                    const name = item[item.length - 1];
                    if (this.layers.labels && name && typeof name === 'string' && (isSelected || isHovered || this.scale > 1.3)) {
                        this.drawLabel(ctx, name, px, py - radius - 5, isSelected ? PALETTE.selection : g.color);
                    }
                }
            }
        }

        renderStartsAndVolcanoes(ctx) {
            // Volcanoes
            if (this.geo.volcanoes) {
                const isSelectedType = this.selectedFeature && this.selectedFeature.type === 'volcanoes';
                for (let i = 0; i < this.geo.volcanoes.length; i++) {
                    const v = this.geo.volcanoes[i];
                    const isSelected = isSelectedType && this.selectedFeature.index === i;
                    const isHovered = this.hoveredFeature && this.hoveredFeature.type === 'volcanoes' && this.hoveredFeature.index === i;

                    const [px, py] = this.tileToPixel(...this.grid.P.toTile(v[0], v[1]));

                    // Draw Volcano symbol
                    ctx.fillStyle = PALETTE.volcano;
                    ctx.beginPath();
                    ctx.moveTo(px - 5, py + 5);
                    ctx.lineTo(px, py - 6);
                    ctx.lineTo(px + 5, py + 5);
                    ctx.closePath();
                    ctx.fill();

                    // Caldera crater
                    ctx.fillStyle = '#ffea00';
                    ctx.beginPath();
                    ctx.arc(px, py - 4, 1.8, 0, Math.PI * 2);
                    ctx.fill();

                    if (isSelected || isHovered) {
                        ctx.strokeStyle = isSelected ? PALETTE.selection : PALETTE.hover;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(px - 7, py - 8, 14, 15);
                    }

                    if (this.layers.labels && v[2] && (isSelected || isHovered || this.scale > 1.1)) {
                        this.drawLabel(ctx, v[2], px, py - 10, '#ff4d2e');
                    }
                }
            }

            // True Start Locations (TSL)
            if (this.geo.tsl) {
                const isSelectedType = this.selectedFeature && this.selectedFeature.type === 'tsl';
                for (const civ in this.geo.tsl) {
                    const pt = this.geo.tsl[civ];
                    const isSelected = isSelectedType && this.selectedFeature.key === civ;
                    const isHovered = this.hoveredFeature && this.hoveredFeature.type === 'tsl' && this.hoveredFeature.key === civ;

                    const [px, py] = this.tileToPixel(...this.grid.P.toTile(pt[0], pt[1]));
                    const shortName = civ.replace('CIVILIZATION_', '');

                    // Badge circle
                    ctx.beginPath();
                    ctx.arc(px, py, 6, 0, Math.PI * 2);
                    ctx.fillStyle = isSelected ? PALETTE.selection : (isHovered ? PALETTE.hover : '#ffffff');
                    ctx.fill();
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Inner star / dot
                    ctx.beginPath();
                    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#111111';
                    ctx.fill();

                    if (this.layers.labels && (isSelected || isHovered || this.scale > 0.8)) {
                        this.drawLabel(ctx, shortName, px, py + 12, isSelected ? PALETTE.selection : '#ffffff');
                    }
                }
            }

            // Fallback sites
            if (this.geo.fallbackSites) {
                const isSelectedType = this.selectedFeature && this.selectedFeature.type === 'fallbackSites';
                for (let i = 0; i < this.geo.fallbackSites.length; i++) {
                    const f = this.geo.fallbackSites[i];
                    const isSelected = isSelectedType && this.selectedFeature.index === i;
                    const isHovered = this.hoveredFeature && this.hoveredFeature.type === 'fallbackSites' && this.hoveredFeature.index === i;

                    const [px, py] = this.tileToPixel(...this.grid.P.toTile(f[0], f[1]));

                    ctx.beginPath();
                    ctx.arc(px, py, 4, 0, Math.PI * 2);
                    ctx.fillStyle = isSelected ? PALETTE.selection : (isHovered ? PALETTE.hover : 'rgba(255, 255, 255, 0.45)');
                    ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    if (this.layers.labels && f[2] && (isSelected || isHovered || this.scale > 1.3)) {
                        this.drawLabel(ctx, `#${i+1} ${f[2]}`, px, py + 10, isSelected ? PALETTE.selection : '#bbbbbb');
                    }
                }
            }
        }

        renderSelectedHandles(ctx) {
            const pts = this.getFeaturePoints(this.selectedFeature);
            if (!pts) return;

            for (let i = 0; i < pts.length; i++) {
                const [px, py] = this.tileToPixel(...this.grid.P.toTile(pts[i][0], pts[i][1]));
                const isActive = (i === this.selectedVertexIndex);
                const isHovered = (i === this.hoveredVertexIndex);

                // Handle glow
                if (isActive || isHovered) {
                    ctx.beginPath();
                    ctx.arc(px, py, 8, 0, Math.PI * 2);
                    ctx.fillStyle = isActive ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255, 234, 0, 0.35)';
                    ctx.fill();
                }

                // Handle point
                ctx.beginPath();
                ctx.arc(px, py, isActive ? 5 : 4, 0, Math.PI * 2);
                ctx.fillStyle = isActive ? PALETTE.vertexActive : (isHovered ? PALETTE.vertexHover : PALETTE.vertex);
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Vertex index tooltip when active
                if (isActive) {
                    const coordStr = `[${pts[i][0].toFixed(1)}, ${pts[i][1].toFixed(1)}]`;
                    this.drawLabel(ctx, `#${i} ${coordStr}`, px, py - 11, PALETTE.selection);
                }
            }
        }

        renderEdgeInsertionIndicator(ctx) {
            if (!this.hoveredEdge) return;
            const [px, py] = this.tileToPixel(...this.grid.P.toTile(this.hoveredEdge.insertLonLat[0], this.hoveredEdge.insertLonLat[1]));

            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#00e5ff';
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Plus symbol
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px - 3, py);
            ctx.lineTo(px + 3, py);
            ctx.moveTo(px, py - 3);
            ctx.lineTo(px, py + 3);
            ctx.stroke();

            this.drawLabel(ctx, '+ Add Point', px, py - 10, '#00e5ff');
        }

        drawLabel(ctx, text, x, y, color = '#ffffff') {
            ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const metrics = ctx.measureText(text);
            const padX = 4, padY = 2;
            const bgW = metrics.width + padX * 2;
            const bgH = 14;

            ctx.fillStyle = 'rgba(10, 15, 22, 0.82)';
            ctx.fillRect(x - bgW / 2, y - bgH / 2, bgW, bgH);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(x - bgW / 2, y - bgH / 2, bgW, bgH);

            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CivCanvasView;
    } else {
        global.CivCanvasView = CivCanvasView;
    }
})(typeof window !== 'undefined' ? window : globalThis);
