// editor-app.js
// Main application controller for Civilization VII Visual Map Editor.

(function() {
    // Application State
    const state = {
        currentMapId: 'europe-large', // 'europe-large' | 'europe-std'
        geo: null,
        gridW: 112,
        gridH: 98,
        history: [],
        historyIndex: -1,
        maxHistory: 40,
        serverAvailable: false,
        activeTab: 'tree', // 'tree' | 'projection' | 'stats'
        searchTerm: ''
    };

    let canvasView = null;

    // Presets for grid sizes
    const GRID_PRESETS = {
        'europe-large': [
            { label: 'Large (112 x 98) - Standard', w: 112, h: 98 },
            { label: 'Large (128 x 112)', w: 128, h: 112 },
            { label: 'Large (144 x 126) - Huge', w: 144, h: 126 },
            { label: 'Standard (84 x 54)', w: 84, h: 54 }
        ],
        'europe-std': [
            { label: 'Standard (84 x 54) - Normal', w: 84, h: 54 },
            { label: 'Small (74 x 46)', w: 74, h: 46 },
            { label: 'Tiny (60 x 38)', w: 60, h: 38 },
            { label: 'Large (96 x 60)', w: 96, h: 60 },
            { label: 'Huge (106 x 66)', w: 106, h: 66 }
        ]
    };

    function init() {
        const canvas = document.getElementById('mapCanvas');
        canvasView = new CivCanvasView(canvas, {
            onFeatureSelect: handleFeatureSelect,
            onGeometryChange: handleGeometryChange,
            onCursorMove: handleCursorMove
        });

        window.addEventListener('resize', () => canvasView.resize());

        initUIEvents();
        checkServerStatus().then(() => {
            loadMap(state.currentMapId);
        });
    }

    async function checkServerStatus() {
        try {
            const resp = await fetch('/api/status', { method: 'GET' });
            if (resp.ok) {
                state.serverAvailable = true;
                setServerIndicator(true);
                return;
            }
        } catch (e) {
            // Standalone mode
        }
        state.serverAvailable = false;
        setServerIndicator(false);
    }

    function setServerIndicator(connected) {
        const el = document.getElementById('serverIndicator');
        if (!el) return;
        if (connected) {
            el.className = 'status-badge connected';
            el.innerHTML = '<span class="pulse-dot"></span> Local Server: 1-Click Save Active';
            document.getElementById('btnBuildPreview').style.display = 'inline-flex';
            document.getElementById('btnInstallMod').style.display = 'inline-flex';
        } else {
            el.className = 'status-badge standalone';
            el.innerHTML = '<span class="idle-dot"></span> Standalone Mode (Download to Save)';
            document.getElementById('btnBuildPreview').style.display = 'none';
            document.getElementById('btnInstallMod').style.display = 'none';
        }
    }

    function loadMap(mapId) {
        state.currentMapId = mapId;

        // Clone base data to prevent modifying default templates
        let sourceGeo = null;
        if (mapId === 'europe-large') {
            sourceGeo = JSON.parse(JSON.stringify(window.DEFAULT_EUROPE_LARGE_GEO));
            state.gridW = 112;
            state.gridH = 98;
        } else {
            sourceGeo = JSON.parse(JSON.stringify(window.DEFAULT_EUROPE_GEO));
            state.gridW = 84;
            state.gridH = 54;
        }

        state.geo = sourceGeo;
        state.history = [];
        state.historyIndex = -1;
        pushHistory('Load initial map');

        updateGridSizeSelector();
        canvasView.setMapData(state.geo, state.gridW, state.gridH);

        renderFeatureTree();
        renderProjectionKnobs();
        updateValidationAndStats();
        selectFeature(null);
    }

    function updateGridSizeSelector() {
        const select = document.getElementById('gridSizeSelect');
        select.innerHTML = '';
        const presets = GRID_PRESETS[state.currentMapId] || GRID_PRESETS['europe-large'];
        presets.forEach(p => {
            const opt = document.createElement('option');
            opt.value = `${p.w}x${p.h}`;
            opt.textContent = p.label;
            if (p.w === state.gridW && p.h === state.gridH) opt.selected = true;
            select.appendChild(opt);
        });
    }

    // History (Undo / Redo)
    function pushHistory(actionName = 'Edit') {
        // Truncate future if branched
        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }
        state.history.push({
            name: actionName,
            geo: JSON.parse(JSON.stringify(state.geo))
        });
        if (state.history.length > state.maxHistory) {
            state.history.shift();
        } else {
            state.historyIndex++;
        }
        updateUndoRedoButtons();
    }

    function undo() {
        if (state.historyIndex > 0) {
            state.historyIndex--;
            state.geo = JSON.parse(JSON.stringify(state.history[state.historyIndex].geo));
            canvasView.setMapData(state.geo, state.gridW, state.gridH);
            renderFeatureTree();
            renderProjectionKnobs();
            updateValidationAndStats();
            if (canvasView.selectedFeature) {
                renderInspector(canvasView.selectedFeature);
            }
            updateUndoRedoButtons();
            showToast(`Undo: ${state.history[state.historyIndex].name}`);
        }
    }

    function redo() {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            state.geo = JSON.parse(JSON.stringify(state.history[state.historyIndex].geo));
            canvasView.setMapData(state.geo, state.gridW, state.gridH);
            renderFeatureTree();
            renderProjectionKnobs();
            updateValidationAndStats();
            if (canvasView.selectedFeature) {
                renderInspector(canvasView.selectedFeature);
            }
            updateUndoRedoButtons();
            showToast(`Redo: ${state.history[state.historyIndex].name}`);
        }
    }

    function updateUndoRedoButtons() {
        const btnUndo = document.getElementById('btnUndo');
        const btnRedo = document.getElementById('btnRedo');
        if (btnUndo) btnUndo.disabled = (state.historyIndex <= 0);
        if (btnRedo) btnRedo.disabled = (state.historyIndex >= state.history.length - 1);
    }

    // Callbacks from canvasView
    function handleFeatureSelect(feat, vertexIndex) {
        renderInspector(feat, vertexIndex);
        highlightTreeItem(feat);
    }

    function handleGeometryChange(changeType, feat) {
        if (changeType === 'drag-end' || changeType === 'vertex-insert' || changeType === 'vertex-delete') {
            pushHistory(changeType);
            updateValidationAndStats();
        }
        renderInspector(feat, canvasView.selectedVertexIndex);
    }

    function handleCursorMove(info) {
        const coordEl = document.getElementById('cursorCoords');
        const tileEl = document.getElementById('cursorTile');
        if (coordEl) coordEl.textContent = `Lon: ${info.lon.toFixed(2)}°  Lat: ${info.lat.toFixed(2)}°`;

        if (tileEl && info.tile) {
            const t = info.tile;
            const tNames = ['Ocean', 'Coast', 'Flat Land', 'Hills', 'Mountain', 'Navigable River'];
            const bNames = { G: 'Grassland', P: 'Plains', D: 'Desert', T: 'Tundra', R: 'Tropical', M: 'Marine' };
            const terrainName = tNames[t.terrain] || 'Unknown';
            const biomeName = bNames[t.biome] || '';
            tileEl.textContent = `Tile (${t.x}, ${t.y}) • ${terrainName} • ${biomeName} • Rain ${t.rain}`;
        } else if (tileEl) {
            tileEl.textContent = `Tile: (${Math.round(info.xf)}, ${Math.round(info.yf)})`;
        }
    }

    // UI Event Wiring
    function initUIEvents() {
        // Map Switcher
        document.getElementById('mapSelect').addEventListener('change', (e) => {
            loadMap(e.target.value);
        });

        // Grid Size
        document.getElementById('gridSizeSelect').addEventListener('change', (e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            state.gridW = w;
            state.gridH = h;
            canvasView.setMapData(state.geo, w, h);
            updateValidationAndStats();
        });

        // Undo / Redo
        document.getElementById('btnUndo').addEventListener('click', () => undo());
        document.getElementById('btnRedo').addEventListener('click', () => redo());

        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo(); else undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveMap();
            }
        });

        // Zoom Controls
        document.getElementById('btnZoomIn').addEventListener('click', () => {
            canvasView.scale = Math.min(6.0, canvasView.scale * 1.25);
            canvasView.render();
        });
        document.getElementById('btnZoomOut').addEventListener('click', () => {
            canvasView.scale = Math.max(0.3, canvasView.scale / 1.25);
            canvasView.render();
        });
        document.getElementById('btnZoomFit').addEventListener('click', () => canvasView.fitToScreen());
        document.getElementById('btnZoomReset').addEventListener('click', () => canvasView.resetZoom());

        // Action Buttons
        document.getElementById('btnSave').addEventListener('click', () => saveMap());
        document.getElementById('btnExport').addEventListener('click', () => exportMapFile());
        document.getElementById('btnBuildPreview').addEventListener('click', () => runBuildPreview());
        document.getElementById('btnInstallMod').addEventListener('click', () => runInstallMod());
        document.getElementById('btnAsciiDump').addEventListener('click', () => showAsciiModal());

        // Sidebar Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const targetPane = document.getElementById(e.currentTarget.dataset.tab);
                if (targetPane) targetPane.classList.add('active');
            });
        });

        // Tree Search
        document.getElementById('treeSearch').addEventListener('input', (e) => {
            state.searchTerm = e.target.value.toLowerCase().trim();
            renderFeatureTree();
        });

        // Layer Toggles
        document.querySelectorAll('[data-layer]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const layer = e.target.dataset.layer;
                canvasView.layers[layer] = e.target.checked;
                canvasView.render();
            });
        });

        // Add Feature Dropdown / Modal
        document.getElementById('btnAddFeature').addEventListener('click', () => {
            showAddFeatureModal();
        });
    }

    // Feature Tree Rendering
    function renderFeatureTree() {
        const container = document.getElementById('featureTreeList');
        if (!container || !state.geo) return;
        container.innerHTML = '';

        const categories = [
            { id: 'land', label: 'Land & Islands', items: state.geo.land || [], icon: '🏝️' },
            { id: 'ranges', label: 'Mountain Ranges', items: state.geo.ranges || [], icon: '⛰️' },
            { id: 'rivers', label: 'Navigable Rivers', items: state.geo.rivers || [], icon: '🌊' },
            { id: 'waterLines', label: 'Straits', items: state.geo.waterLines || [], icon: '🚢' },
            { id: 'water', label: 'Inland Seas', items: state.geo.water || [], icon: '💧' },
            { id: 'lakes', label: 'Lakes', items: state.geo.lakes || [], icon: '🏊' },
            { id: 'landBlobs', label: 'Island Blobs', items: state.geo.landBlobs || [], icon: '🟢' },
            { id: 'biomeAreas', label: 'Biome Overrides', items: state.geo.biomeAreas || [], icon: '🌾' },
            { id: 'biomeBlobs', label: 'Oases & Patches', items: state.geo.biomeBlobs || [], icon: '🌴' },
            { id: 'volcanoes', label: 'Volcanoes', items: state.geo.volcanoes || [], icon: '🌋' },
            {
                id: 'tsl', label: 'True Start Locations',
                items: Object.keys(state.geo.tsl || {}).map(civ => ({ name: civ.replace('CIVILIZATION_', ''), civKey: civ })),
                icon: '👑'
            },
            {
                id: 'fallbackSites', label: 'Fallback Sites',
                items: (state.geo.fallbackSites || []).map((f, idx) => ({ name: `#${idx + 1} ${f[2]}`, index: idx })),
                icon: '📍'
            }
        ];

        categories.forEach(cat => {
            const filteredItems = cat.items.filter(item => {
                if (!state.searchTerm) return true;
                const name = (item.name || item[item.length - 1] || item.civKey || '').toLowerCase();
                return name.includes(state.searchTerm);
            });

            if (state.searchTerm && filteredItems.length === 0) return;

            const groupEl = document.createElement('div');
            groupEl.className = 'tree-group';

            const headerEl = document.createElement('div');
            headerEl.className = 'tree-group-header';
            headerEl.innerHTML = `
                <span class="group-toggle">▾</span>
                <span class="group-icon">${cat.icon}</span>
                <span class="group-title">${cat.label}</span>
                <span class="group-count">(${filteredItems.length})</span>
            `;

            const itemsEl = document.createElement('div');
            itemsEl.className = 'tree-group-items';

            headerEl.addEventListener('click', () => {
                const isCollapsed = itemsEl.classList.toggle('collapsed');
                headerEl.querySelector('.group-toggle').textContent = isCollapsed ? '▸' : '▾';
            });

            filteredItems.forEach((item, idx) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'tree-item';
                let itemName = '';
                let featRef = null;

                if (cat.id === 'tsl') {
                    itemName = item.name;
                    featRef = { type: 'tsl', key: item.civKey };
                } else if (cat.id === 'fallbackSites') {
                    itemName = item.name;
                    featRef = { type: 'fallbackSites', index: item.index };
                } else if (['lakes', 'landBlobs', 'biomeBlobs', 'volcanoes'].includes(cat.id)) {
                    itemName = item[item.length - 1] || `${cat.label} #${idx + 1}`;
                    featRef = { type: cat.id, index: idx };
                } else {
                    itemName = item.name || `${cat.label} #${idx + 1}`;
                    featRef = { type: cat.id, index: idx };
                }

                itemEl.textContent = itemName;
                itemEl.dataset.type = featRef.type;
                if (featRef.key) itemEl.dataset.key = featRef.key;
                if (featRef.index !== undefined) itemEl.dataset.index = featRef.index;

                itemEl.addEventListener('click', () => {
                    selectFeature(featRef);
                    zoomToFeature(featRef);
                });

                itemsEl.appendChild(itemEl);
            });

            groupEl.appendChild(headerEl);
            groupEl.appendChild(itemsEl);
            container.appendChild(groupEl);
        });
    }

    function selectFeature(feat) {
        canvasView.selectFeature(feat);
        renderInspector(feat);
        highlightTreeItem(feat);
    }

    function highlightTreeItem(feat) {
        document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
        if (!feat) return;
        const selector = feat.key
            ? `.tree-item[data-type="${feat.type}"][data-key="${feat.key}"]`
            : `.tree-item[data-type="${feat.type}"][data-index="${feat.index}"]`;
        const itemEl = document.querySelector(selector);
        if (itemEl) {
            itemEl.classList.add('selected');
            itemEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function zoomToFeature(feat) {
        const pts = canvasView.getFeaturePoints(feat);
        if (!pts || !pts.length) return;
        const midP = pts[Math.floor(pts.length / 2)];
        const [px, py] = canvasView.tileToPixel(...canvasView.grid.P.toTile(midP[0], midP[1]));
        const rect = canvasView.canvas.parentElement.getBoundingClientRect();

        canvasView.panX = rect.width / 2 - px * canvasView.scale;
        canvasView.panY = rect.height / 2 - py * canvasView.scale;
        canvasView.render();
    }

    // Property Inspector Rendering
    function renderInspector(feat, activeVertexIndex = -1) {
        const container = document.getElementById('inspectorContent');
        if (!container) return;

        if (!feat) {
            container.innerHTML = `
                <div class="empty-inspector">
                    <div class="empty-icon">🎯</div>
                    <div class="empty-text">No feature selected</div>
                    <div class="empty-subtext">Click on any feature on the map or select from the tree to inspect and edit.</div>
                </div>
            `;
            return;
        }

        const pts = canvasView.getFeaturePoints(feat);
        let title = '';
        let typeBadge = feat.type.toUpperCase();

        if (feat.type === 'tsl') {
            title = feat.key.replace('CIVILIZATION_', '');
        } else if (feat.type === 'fallbackSites') {
            title = state.geo.fallbackSites[feat.index][2] || `Fallback #${feat.index + 1}`;
        } else if (['lakes', 'landBlobs', 'biomeBlobs', 'volcanoes'].includes(feat.type)) {
            const arr = state.geo[feat.type][feat.index];
            title = arr[arr.length - 1] || `${feat.type} #${feat.index + 1}`;
        } else {
            const item = state.geo[feat.type][feat.index];
            title = item ? item.name : 'Feature';
        }

        let html = `
            <div class="inspector-card">
                <div class="card-header">
                    <span class="badge ${feat.type}">${typeBadge}</span>
                    <button id="btnDeleteFeature" class="btn-icon danger" title="Delete feature">🗑️</button>
                </div>
                <div class="form-group">
                    <label>Feature Name</label>
                    <input type="text" id="propName" class="form-input" value="${escapeHtml(title)}">
                </div>
        `;

        // Range specific: Core and Fringe sliders
        if (feat.type === 'ranges') {
            const r = state.geo.ranges[feat.index];
            html += `
                <div class="form-group">
                    <div class="slider-header">
                        <label>Core Radius (Mountain)</label>
                        <span id="valCore">${r.core}</span>
                    </div>
                    <input type="range" id="propCore" class="slider" min="0" max="4" step="0.1" value="${r.core}">
                </div>
                <div class="form-group">
                    <div class="slider-header">
                        <label>Fringe Radius (Hills)</label>
                        <span id="valFringe">${r.fringe}</span>
                    </div>
                    <input type="range" id="propFringe" class="slider" min="0.5" max="6" step="0.1" value="${r.fringe}">
                </div>
            `;
        }

        // Biome Area specific: Biome select and Prob slider
        if (feat.type === 'biomeAreas') {
            const b = state.geo.biomeAreas[feat.index];
            html += `
                <div class="form-group">
                    <label>Biome Type</label>
                    <select id="propBiome" class="form-select">
                        <option value="G" ${b.biome === 'G' ? 'selected' : ''}>Grassland (G)</option>
                        <option value="P" ${b.biome === 'P' ? 'selected' : ''}>Plains (P)</option>
                        <option value="D" ${b.biome === 'D' ? 'selected' : ''}>Desert (D)</option>
                        <option value="T" ${b.biome === 'T' ? 'selected' : ''}>Tundra (T)</option>
                        <option value="R" ${b.biome === 'R' ? 'selected' : ''}>Tropical (R)</option>
                    </select>
                </div>
                <div class="form-group">
                    <div class="slider-header">
                        <label>Probability (Optional)</label>
                        <span id="valProb">${b.prob !== undefined ? b.prob : '1.0 (Fixed)'}</span>
                    </div>
                    <input type="range" id="propProb" class="slider" min="0.1" max="1.0" step="0.05" value="${b.prob || 1.0}">
                </div>
            `;
        }

        // Blobs / Lakes radius
        if (['landBlobs', 'lakes', 'biomeBlobs'].includes(feat.type)) {
            const arr = state.geo[feat.type][feat.index];
            html += `
                <div class="form-group">
                    <div class="slider-header">
                        <label>Radius (Hexes)</label>
                        <span id="valRadius">${arr[2]}</span>
                    </div>
                    <input type="range" id="propRadius" class="slider" min="0.3" max="5" step="0.1" value="${arr[2]}">
                </div>
            `;
        }

        // Vertices Table
        if (pts && pts.length > 0) {
            html += `
                <div class="form-group">
                    <div class="table-header">
                        <label>Coordinates (${pts.length} vertices)</label>
                        <button id="btnAddVertex" class="btn-xs primary">+ Add Point</button>
                    </div>
                    <div class="table-scroll">
                        <table class="coords-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Longitude</th>
                                    <th>Latitude</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            pts.forEach((pt, i) => {
                const isActive = (i === canvasView.selectedVertexIndex);
                html += `
                    <tr class="vertex-row ${isActive ? 'active' : ''}" data-vertex="${i}">
                        <td>${i}</td>
                        <td><input type="number" step="0.1" class="coord-input" data-axis="0" data-vertex="${i}" value="${pt[0]}"></td>
                        <td><input type="number" step="0.1" class="coord-input" data-axis="1" data-vertex="${i}" value="${pt[1]}"></td>
                        <td>
                            ${pts.length > (canvasView.isFeatureClosed(feat) ? 3 : 2) ? `<button class="btn-del-vertex" data-vertex="${i}" title="Delete point">×</button>` : ''}
                        </td>
                    </tr>
                `;
            });
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;

        // Wire Inspector Events
        const propName = document.getElementById('propName');
        if (propName) {
            propName.addEventListener('change', (e) => {
                const val = e.target.value.trim();
                if (feat.type === 'fallbackSites') state.geo.fallbackSites[feat.index][2] = val;
                else if (feat.type === 'volcanoes') state.geo.volcanoes[feat.index][2] = val;
                else if (['lakes', 'landBlobs', 'biomeBlobs'].includes(feat.type)) {
                    state.geo[feat.type][feat.index][state.geo[feat.type][feat.index].length - 1] = val;
                } else if (state.geo[feat.type][feat.index]) {
                    state.geo[feat.type][feat.index].name = val;
                }
                pushHistory('Rename feature');
                renderFeatureTree();
                canvasView.render();
            });
        }

        const propCore = document.getElementById('propCore');
        if (propCore) {
            propCore.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                state.geo.ranges[feat.index].core = val;
                document.getElementById('valCore').textContent = val;
                canvasView.render();
            });
            propCore.addEventListener('change', () => {
                canvasView.rebuildGrid();
                pushHistory('Adjust mountain core');
                updateValidationAndStats();
            });
        }

        const propFringe = document.getElementById('propFringe');
        if (propFringe) {
            propFringe.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                state.geo.ranges[feat.index].fringe = val;
                document.getElementById('valFringe').textContent = val;
                canvasView.render();
            });
            propFringe.addEventListener('change', () => {
                canvasView.rebuildGrid();
                pushHistory('Adjust mountain fringe');
                updateValidationAndStats();
            });
        }

        const propRadius = document.getElementById('propRadius');
        if (propRadius) {
            propRadius.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                state.geo[feat.type][feat.index][2] = val;
                document.getElementById('valRadius').textContent = val;
                canvasView.render();
            });
            propRadius.addEventListener('change', () => {
                canvasView.rebuildGrid();
                pushHistory('Adjust radius');
                updateValidationAndStats();
            });
        }

        const propBiome = document.getElementById('propBiome');
        if (propBiome) {
            propBiome.addEventListener('change', (e) => {
                state.geo.biomeAreas[feat.index].biome = e.target.value;
                canvasView.rebuildGrid();
                pushHistory('Change biome');
                updateValidationAndStats();
            });
        }

        const propProb = document.getElementById('propProb');
        if (propProb) {
            propProb.addEventListener('change', (e) => {
                const val = parseFloat(e.target.value);
                if (val >= 0.99) delete state.geo.biomeAreas[feat.index].prob;
                else state.geo.biomeAreas[feat.index].prob = val;
                document.getElementById('valProb').textContent = val >= 0.99 ? '1.0 (Fixed)' : String(val);
                canvasView.rebuildGrid();
                pushHistory('Change biome probability');
            });
        }

        document.getElementById('btnDeleteFeature').addEventListener('click', () => {
            if (confirm(`Delete this feature (${title})?`)) {
                deleteFeature(feat);
            }
        });

        const btnAddVertex = document.getElementById('btnAddVertex');
        if (btnAddVertex) {
            btnAddVertex.addEventListener('click', () => {
                if (!pts || !pts.length) return;
                const last = pts[pts.length - 1];
                pts.push([Math.round((last[0] + 1) * 10) / 10, Math.round(last[1] * 10) / 10]);
                canvasView.selectedVertexIndex = pts.length - 1;
                canvasView.rebuildGrid();
                pushHistory('Add vertex');
                renderInspector(feat);
            });
        }

        // Numeric coordinate editing inputs
        document.querySelectorAll('.coord-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const vIdx = parseInt(e.target.dataset.vertex);
                const axis = parseInt(e.target.dataset.axis);
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && pts[vIdx]) {
                    pts[vIdx][axis] = Math.round(val * 100) / 100;
                    canvasView.rebuildGrid();
                    pushHistory('Edit coordinate');
                }
            });
        });

        // Delete vertex buttons
        document.querySelectorAll('.btn-del-vertex').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vIdx = parseInt(e.target.dataset.vertex);
                canvasView.selectedVertexIndex = vIdx;
                canvasView.deleteSelectedVertex();
            });
        });

        // Click row to select vertex on canvas
        document.querySelectorAll('.vertex-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                const vIdx = parseInt(row.dataset.vertex);
                canvasView.selectedVertexIndex = vIdx;
                canvasView.render();
                renderInspector(feat, vIdx);
            });
        });
    }

    function deleteFeature(feat) {
        if (!feat || !state.geo) return;
        if (feat.type === 'tsl') {
            delete state.geo.tsl[feat.key];
        } else if (state.geo[feat.type] && feat.index !== undefined) {
            state.geo[feat.type].splice(feat.index, 1);
        }
        selectFeature(null);
        canvasView.rebuildGrid();
        pushHistory('Delete feature');
        renderFeatureTree();
        updateValidationAndStats();
    }

    // Projection Knobs Panel
    function renderProjectionKnobs() {
        const container = document.getElementById('projectionContent');
        if (!container || !state.geo) return;

        const g = state.geo;
        container.innerHTML = `
            <div class="projection-card">
                <div class="form-group">
                    <label>Center Longitude (lonCenter)</label>
                    <input type="number" step="0.1" id="projLonCenter" class="form-input" value="${g.lonCenter || 19.0}">
                </div>
                <div class="form-group">
                    <label>Span Reference (spanRef degrees)</label>
                    <input type="number" step="1" id="projSpanRef" class="form-input" value="${g.spanRef || 70}">
                </div>
                <div class="form-group">
                    <label>Reference Parallel (latRef)</label>
                    <input type="number" step="0.5" id="projLatRef" class="form-input" value="${g.latRef || 47}">
                </div>
                <div class="form-group">
                    <label>Scale Exponent (scaleExp)</label>
                    <input type="number" step="0.05" id="projScaleExp" class="form-input" value="${g.scaleExp || 0.5}">
                </div>
                <div class="form-group">
                    <label>Mountain Range Scale (rangeScale)</label>
                    <input type="number" step="0.05" id="projRangeScale" class="form-input" value="${g.rangeScale || 1.0}">
                </div>
                <div class="form-group">
                    <label>Blob Scale (blobScale)</label>
                    <input type="number" step="0.05" id="projBlobScale" class="form-input" value="${g.blobScale || 1.0}">
                </div>
                <div class="form-group">
                    <label>Landmass Split Longitude</label>
                    <input type="number" step="0.5" id="projSplitLon" class="form-input" value="${g.landmassSplitLon || 19.5}">
                </div>
                <button id="btnApplyProjection" class="btn primary block">Apply Projection Changes</button>
            </div>
        `;

        document.getElementById('btnApplyProjection').addEventListener('click', () => {
            g.lonCenter = parseFloat(document.getElementById('projLonCenter').value);
            g.spanRef = parseFloat(document.getElementById('projSpanRef').value);
            g.latRef = parseFloat(document.getElementById('projLatRef').value);
            g.scaleExp = parseFloat(document.getElementById('projScaleExp').value);
            g.rangeScale = parseFloat(document.getElementById('projRangeScale').value);
            g.blobScale = parseFloat(document.getElementById('projBlobScale').value);
            g.landmassSplitLon = parseFloat(document.getElementById('projSplitLon').value);

            canvasView.rebuildGrid();
            pushHistory('Change projection knobs');
            updateValidationAndStats();
            showToast('Projection updated successfully');
        });
    }

    // Validation & Statistics
    function updateValidationAndStats() {
        if (!canvasView || !canvasView.grid) return;
        const g = canvasView.grid;
        const T = window.CivRasterizer.T;
        const B = window.CivRasterizer.B;
        const total = g.W * g.H;

        let land = 0, water = 0, mtn = 0, hill = 0, coast = 0, ocean = 0, river = 0;
        let counts = { G: 0, P: 0, D: 0, T: 0, R: 0 };

        for (let i = 0; i < total; i++) {
            const t = g.terrain[i];
            const b = g.biome[i];
            if (t === T.OCEAN) { ocean++; water++; }
            else if (t === T.COAST) { coast++; water++; }
            else if (t === T.RIVER) { river++; land++; }
            else {
                land++;
                if (counts[b] !== undefined) counts[b]++;
                if (t === T.HILL) hill++;
                if (t === T.MOUNTAIN) mtn++;
            }
        }

        // Validate True Start Locations
        const starts = [];
        const missingStarts = [];
        if (state.geo && state.geo.tsl) {
            for (const civ in state.geo.tsl) {
                const pt = state.geo.tsl[civ];
                const t = g.findLandTile(pt[0], pt[1], 3, false);
                const civName = civ.replace('CIVILIZATION_', '');
                if (!t) missingStarts.push(civName);
                starts.push({ civ: civName, found: !!t });
            }
        }

        // Update Top Bar Indicators
        const statLandEl = document.getElementById('statLandPct');
        if (statLandEl) statLandEl.textContent = `${(100 * land / total).toFixed(1)}%`;

        const statMtnEl = document.getElementById('statMtnCount');
        if (statMtnEl) statMtnEl.textContent = `${mtn}`;

        const statStartsEl = document.getElementById('statStartsStatus');
        if (statStartsEl) {
            if (missingStarts.length === 0) {
                statStartsEl.className = 'status-tag ok';
                statStartsEl.innerHTML = `✓ ${starts.length} Starts OK`;
            } else {
                statStartsEl.className = 'status-tag warning';
                statStartsEl.innerHTML = `⚠ ${missingStarts.length} Missing Starts (${missingStarts.slice(0, 2).join(', ')})`;
            }
        }

        // Render Stats Pane
        const statsPane = document.getElementById('statsContent');
        if (statsPane) {
            statsPane.innerHTML = `
                <div class="stats-card">
                    <h4>Map Overview (${g.W} × ${g.H} = ${total} tiles)</h4>
                    <div class="stat-bar-container">
                        <div class="stat-bar land" style="width: ${(100 * land / total).toFixed(1)}%"></div>
                        <div class="stat-bar water" style="width: ${(100 * water / total).toFixed(1)}%"></div>
                    </div>
                    <div class="stat-grid">
                        <div class="stat-item"><span class="stat-label">Land:</span> <strong>${land} (${(100*land/total).toFixed(1)}%)</strong></div>
                        <div class="stat-item"><span class="stat-label">Water:</span> <strong>${water} (${(100*water/total).toFixed(1)}%)</strong></div>
                        <div class="stat-item"><span class="stat-label">Mountains:</span> <strong>${mtn}</strong></div>
                        <div class="stat-item"><span class="stat-label">Hills:</span> <strong>${hill}</strong></div>
                        <div class="stat-item"><span class="stat-label">Rivers:</span> <strong>${river}</strong></div>
                        <div class="stat-item"><span class="stat-label">Coast:</span> <strong>${coast}</strong></div>
                    </div>

                    <h4 class="mt-4">Biome Breakdown</h4>
                    <div class="stat-grid">
                        <div class="stat-item"><span class="biome-dot G"></span> Grassland: <strong>${counts.G}</strong></div>
                        <div class="stat-item"><span class="biome-dot P"></span> Plains: <strong>${counts.P}</strong></div>
                        <div class="stat-item"><span class="biome-dot D"></span> Desert: <strong>${counts.D}</strong></div>
                        <div class="stat-item"><span class="biome-dot T"></span> Tundra: <strong>${counts.T}</strong></div>
                        <div class="stat-item"><span class="biome-dot R"></span> Tropical: <strong>${counts.R}</strong></div>
                    </div>

                    <h4 class="mt-4">True Start Locations (${starts.length - missingStarts.length}/${starts.length} placed)</h4>
                    <div class="tsl-list">
                        ${starts.map(s => `
                            <div class="tsl-item ${s.found ? 'ok' : 'missing'}">
                                ${s.found ? '✓' : '✗'} ${s.civ}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    // Add Feature Modal
    function showAddFeatureModal() {
        const modal = document.getElementById('addFeatureModal');
        modal.classList.add('active');

        document.getElementById('btnCloseAddModal').onclick = () => modal.classList.remove('active');
        document.getElementById('btnConfirmAdd').onclick = () => {
            const type = document.getElementById('newFeatureType').value;
            const name = document.getElementById('newFeatureName').value.trim() || 'New Feature';

            // Center of map
            const centerLon = state.geo.lonCenter || 19.0;
            const centerLat = state.geo.latRef || 47.0;

            if (type === 'land') {
                const pts = [
                    [centerLon - 1.5, centerLat - 1],
                    [centerLon + 1.5, centerLat - 1],
                    [centerLon + 1.5, centerLat + 1],
                    [centerLon - 1.5, centerLat + 1]
                ];
                state.geo.land.push({ name, pts });
                selectFeature({ type: 'land', index: state.geo.land.length - 1 });
            } else if (type === 'ranges') {
                const pts = [
                    [centerLon - 2, centerLat],
                    [centerLon + 2, centerLat]
                ];
                state.geo.ranges.push({ name, core: 0.6, fringe: 1.5, pts });
                selectFeature({ type: 'ranges', index: state.geo.ranges.length - 1 });
            } else if (type === 'rivers') {
                const pts = [
                    [centerLon - 1, centerLat + 1],
                    [centerLon, centerLat],
                    [centerLon + 1, centerLat - 1]
                ];
                state.geo.rivers.push({ name, pts });
                selectFeature({ type: 'rivers', index: state.geo.rivers.length - 1 });
            } else if (type === 'lakes') {
                state.geo.lakes.push([centerLon, centerLat, 1.2, name]);
                selectFeature({ type: 'lakes', index: state.geo.lakes.length - 1 });
            } else if (type === 'landBlobs') {
                state.geo.landBlobs.push([centerLon, centerLat, 1.0, name]);
                selectFeature({ type: 'landBlobs', index: state.geo.landBlobs.length - 1 });
            }

            modal.classList.remove('active');
            canvasView.rebuildGrid();
            pushHistory(`Add ${type}`);
            renderFeatureTree();
            updateValidationAndStats();
        };
    }

    // ASCII Dump Modal
    function showAsciiModal() {
        if (!canvasView || !canvasView.grid) return;
        const g = canvasView.grid;
        const T = window.CivRasterizer.T;
        const rows = [];

        for (let y = g.H - 1; y >= 0; y--) {
            let line = '';
            for (let x = 0; x < g.W; x++) {
                const i = g.idx(x, y);
                const t = g.terrain[i];
                const b = g.biome[i];
                let ch = '.';
                if (t === T.OCEAN) ch = '.';
                else if (t === T.COAST) ch = ',';
                else if (t === T.RIVER) ch = 'V';
                else {
                    ch = b ? b.toLowerCase() : 'g';
                    if (t === T.HILL) ch = b ? b.toUpperCase() : 'G';
                    if (t === T.MOUNTAIN) ch = '^';
                }
                line += ch;
            }
            rows.push(String(y).padStart(3, ' ') + ' ' + line);
        }

        const modal = document.getElementById('asciiModal');
        document.getElementById('asciiDumpText').textContent = rows.join('\n');
        modal.classList.add('active');

        document.getElementById('btnCloseAsciiModal').onclick = () => modal.classList.remove('active');
    }

    // Save & Export Actions
    async function saveMap() {
        const filename = state.currentMapId === 'europe-large' ? 'europe-large-geo.js' : 'europe-geo.js';
        const code = window.CivSerializer.serializeGEO(state.geo, state.currentMapId === 'europe-large' ? "Europe, Mediterranean & Sahel (Large)" : "Europe & Mediterranean");

        if (state.serverAvailable) {
            try {
                const resp = await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename, content: code })
                });
                if (resp.ok) {
                    showToast(`Saved ${filename} directly to mod folder!`);
                    return;
                }
            } catch (e) {
                console.error('Save failed:', e);
            }
        }

        // Fallback: download file
        downloadFile(filename, code);
        showToast(`Exported ${filename} to Downloads`);
    }

    function exportMapFile() {
        const filename = state.currentMapId === 'europe-large' ? 'europe-large-geo.js' : 'europe-geo.js';
        const code = window.CivSerializer.serializeGEO(state.geo, state.currentMapId === 'europe-large' ? "Europe, Mediterranean & Sahel (Large)" : "Europe & Mediterranean");
        downloadFile(filename, code);
    }

    async function runBuildPreview() {
        showToast('Running build-preview.ps1...');
        try {
            const resp = await fetch('/api/build-preview', { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                showToast('Preview rebuilt successfully!');
            } else {
                showToast('Preview rebuild error: ' + data.error, true);
            }
        } catch (e) {
            showToast('Failed to contact server: ' + e.message, true);
        }
    }

    async function runInstallMod() {
        if (!confirm('Install mod into Civilization VII mods directory?')) return;
        showToast('Installing mod into Civ VII...');
        try {
            const resp = await fetch('/api/install', { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                showToast('Mod installed successfully! Restart Civ VII to play.');
            } else {
                showToast('Install error: ' + data.error, true);
            }
        } catch (e) {
            showToast('Failed to contact server: ' + e.message, true);
        }
    }

    function downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showToast(msg, isError = false) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = 'toast show' + (isError ? ' error' : '');
        setTimeout(() => toast.className = 'toast', 3500);
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Boot
    window.addEventListener('DOMContentLoaded', init);
})();
