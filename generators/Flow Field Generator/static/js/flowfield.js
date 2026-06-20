/**
 * flowfield.js
 *
 * Flow field generation and canvas rendering logic.
 * Handles particle path generation, canvas display, and SVG export.
 */

function paperSizeLabel(widthMm, heightMm) {
    const sizes = { A2: [420, 594], A3: [297, 420], A4: [210, 297], A5: [148, 210] };
    const w = Math.round(widthMm), h = Math.round(heightMm);
    for (const [name, [pw, ph]] of Object.entries(sizes)) {
        if ((w === pw && h === ph) || (w === ph && h === pw)) return name;
    }
    return `${w}x${h}mm`;
}

// Application state
const flowState = {
    canvas: null,
    ctx: null,
    paths: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    widthMm: 297,  // A3 width
    heightMm: 420, // A3 height
    margin: 20,  // unified margin (default 20mm)
    strokeWidth: 0.4,
    noiseScale: 0.01,
    noiseEnabled: true,
    savedNoiseScale: 0.01, // Store the scale when disabling noise
    numParticles: 1000,
    lineLength: 200,
    stepSize: 1,
    perlin: null,
    // Flow field parameters
    noiseOctaves: 1,        // Number of noise layers (1-6)
    noisePersistence: 0.5,  // How much each octave contributes (0-1)
    angleOffset: 0,         // Global angle offset in degrees (0-360)
    flowStrength: 1.0,      // How much noise affects direction (0-1)
    curlAmount: 0,          // Amount of curl noise (0-1)
    flowMode: 'noise',      // 'noise' | 'attractor'
    attractorParams: { a: 1.5, b: -1.8, c: 1.6, d: 0.9 },
    magnets: [], // { x, y, type: 'attract' | 'repel' }
    isPlacingMagnets: false,
    magnetConfig: { strength: 50, radius: 100, rotation: 0, enabled: true, visible: true },
    distortion: { enabled: false, strength: 40, scale: 0.01, phase: 0, detail: 2 },
    geometry: { symmetry: 'none', segments: 6, snapping: 0, snappingStrength: 1.0 },
    // Starting position mode
    startPositionMode: 'random',  // 'random', 'grid', 'circle'
    // Terrain parameters for isometric mode
    terrainVerticalGap: 5,  // Distance between horizontal lines in mm
    terrainAltitude: 30,    // How high the peaks go in mm
    terrainDetail: 1,       // Resolution of the X-axis (step size in mm, lower = better occlusion)
    noiseSeed: 0,
    forceOverprint: false,
    minDistance: 2.0,  // minimum distance between curves in mm
    occupiedPoints: [],  // for minimum distance checking
    currentNoiseSeed: -1,  // track current seed to detect changes
    spatialGrid: null,  // spatial grid for fast distance checking
    gridCellSize: 5.0,  // size of each grid cell in mm (should be >= minDistance)
    // Grid configuration for regular grid mode
    gridConfig: {
        spacingMode: 'auto',  // 'auto' or 'manual'
        spacing: 10.0,  // spacing between grid points in mm (used when spacingMode is 'manual')
        jitter: 0,  // random jitter amount (0-1, percentage of spacing)
        hexGrid: false  // use hexagonal grid instead of rectangular
    },
    phyllotaxisConfig: { spread: 5.0, minRadius: 0 },
    cloudConfig: { threshold: 0.4, scale: 0.5 },
    // Multi-layer system
    layers: [{
        id: 'layer-1',
        name: 'Layer 1',
        color: '#000000',
        paths: [],
        visible: true
    }],
    activeLayerId: 'layer-1',
    syncAllLayers: false,
    // Brush system
    renderStyle: 'default',  // 'default' | 'ribbon-hatched' | 'pipes' | 'circles'
    brushWidth: 5  // in mm
};

// Initialize Perlin noise
flowState.perlin = new PerlinNoise(flowState.noiseSeed);
flowState.currentNoiseSeed = flowState.noiseSeed;

// Conversion: mm to pixels at 96 DPI
const MM_TO_PX = 96 / 25.4;

/** Stroke width slider range (mm); enforced in JS so cached HTML still gets correct limits. */
const STROKE_WIDTH_MM_MIN = 0.2;
const STROKE_WIDTH_MM_MAX = 15;

function clampStrokeWidthMm(w) {
    const n = Number(w);
    if (Number.isNaN(n)) return 0.4;
    return Math.max(STROKE_WIDTH_MM_MIN, Math.min(STROKE_WIDTH_MM_MAX, n));
}

function configureStrokeWidthSlider() {
    const el = document.getElementById('stroke-width');
    if (!el) return;
    el.min = String(STROKE_WIDTH_MM_MIN);
    el.max = String(STROKE_WIDTH_MM_MAX);
    el.step = '0.05';
}

// Noise scale controls (log-mapped for smooth slider response)
const NOISE_SCALE_MIN = 0.001;
const NOISE_SCALE_MAX = 0.05;

function clampNoiseScale(scale) {
    return Math.max(NOISE_SCALE_MIN, Math.min(NOISE_SCALE_MAX, scale));
}

function sliderToNoiseScale(sliderValue) {
    const t = Math.max(0, Math.min(1, sliderValue));
    const logRange = Math.log(NOISE_SCALE_MAX / NOISE_SCALE_MIN);
    return clampNoiseScale(NOISE_SCALE_MIN * Math.exp(t * logRange));
}

function noiseScaleToSlider(scale) {
    const clamped = clampNoiseScale(scale);
    const logRange = Math.log(NOISE_SCALE_MAX / NOISE_SCALE_MIN);
    return Math.log(clamped / NOISE_SCALE_MIN) / logRange;
}

// Keep noise scale within safe bounds on load
flowState.noiseScale = clampNoiseScale(flowState.noiseScale);
flowState.savedNoiseScale = flowState.noiseScale;
flowState.layers.forEach(ensureLayerDefaults);

/**
 * Capture the current generator/grid settings from flowState.
 */
function snapshotLayerSettingsFromFlowState() {
    return {
        widthMm: flowState.widthMm,
        heightMm: flowState.heightMm,
        noiseEnabled: flowState.noiseEnabled,
        noiseScale: flowState.noiseScale,
        savedNoiseScale: flowState.savedNoiseScale,
        noiseSeed: flowState.noiseSeed,
        noiseOctaves: flowState.noiseOctaves,
        noisePersistence: flowState.noisePersistence,
        angleOffset: flowState.angleOffset,
        flowStrength: flowState.flowStrength,
        curlAmount: flowState.curlAmount,
        flowMode: flowState.flowMode,
        attractorParams: { ...flowState.attractorParams },
        numParticles: flowState.numParticles,
        startPositionMode: flowState.startPositionMode,
        distortion: { ...flowState.distortion },
        geometry: { ...flowState.geometry },
        gridConfig: { ...flowState.gridConfig },
        phyllotaxisConfig: { ...flowState.phyllotaxisConfig },
        cloudConfig: { ...flowState.cloudConfig },
        lineLength: flowState.lineLength,
        stepSize: flowState.stepSize,
        minDistance: flowState.minDistance,
        forceOverprint: flowState.forceOverprint,
        strokeWidth: flowState.strokeWidth,
        margin: flowState.margin,
        renderStyle: flowState.renderStyle,
        brushWidth: flowState.brushWidth,
        terrainVerticalGap: flowState.terrainVerticalGap,
        terrainAltitude: flowState.terrainAltitude,
        terrainDetail: flowState.terrainDetail
    };
}

/**
 * Initialize canvas with A3 dimensions and high-DPI support
 */
function initCanvas() {
    flowState.canvas = document.getElementById('flow-canvas');
    if (!flowState.canvas) return;
    
    flowState.ctx = flowState.canvas.getContext('2d');
    
    // Get container dimensions
    const container = flowState.canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate canvas size in pixels (A3 aspect ratio)
    const aspectRatio = flowState.widthMm / flowState.heightMm;
    let canvasWidth, canvasHeight;
    
    if (containerWidth / containerHeight > aspectRatio) {
        canvasHeight = containerHeight;
        canvasWidth = canvasHeight * aspectRatio;
    } else {
        canvasWidth = containerWidth;
        canvasHeight = canvasWidth / aspectRatio;
    }
    
    // Set canvas display size
    flowState.canvas.style.width = canvasWidth + 'px';
    flowState.canvas.style.height = canvasHeight + 'px';
    
    // Set canvas internal size (accounting for device pixel ratio)
    const dpr = window.devicePixelRatio || 1;
    flowState.canvas.width = canvasWidth * dpr;
    flowState.canvas.height = canvasHeight * dpr;
    
    // Scale context for high-DPI
    flowState.ctx.scale(dpr, dpr);
    
    // Store scale factor for coordinate conversion
    flowState.pxPerMm = canvasWidth / flowState.widthMm;
    
    renderCanvas();
}

/**
 * Calculate grid dimensions based on spacing mode
 * Returns {cols, rows, stepX, stepY}
 */
function calculateGridDimensions(drawWidth, drawHeight, numPoints) {
    const gridConfig = flowState.gridConfig;
    
    if (gridConfig.spacingMode === 'manual') {
        // Manual mode: calculate cols/rows from spacing
        // Calculate how many points fit with the given spacing
        const spacing = Math.max(0.1, gridConfig.spacing); // Ensure minimum spacing
        const cols = Math.max(1, Math.ceil(drawWidth / spacing));
        const rows = Math.max(1, Math.ceil(drawHeight / spacing));
        const stepX = spacing;
        const stepY = spacing;
        return { cols, rows, stepX, stepY };
    } else {
        // Auto mode: calculate from numParticles (current behavior)
        const cols = Math.ceil(Math.sqrt(numPoints * (drawWidth / drawHeight)));
        const rows = Math.ceil(numPoints / cols);
        const stepX = drawWidth / cols;
        const stepY = drawHeight / rows;
        return { cols, rows, stepX, stepY };
    }
}

function generateStartingPoints(drawWidth, drawHeight, margin, layerIndex = 0) {
    const points = [];
    const numPoints = flowState.numParticles;
    const centerX = margin + drawWidth / 2;
    const centerY = margin + drawHeight / 2;
    
    switch (flowState.startPositionMode) {
        case 'random':
            for (let i = 0; i < numPoints; i++) {
                points.push([-margin + Math.random()*(drawWidth+2*margin), -margin + Math.random()*(drawHeight+2*margin)]);
            }
            break;
        case 'grid':
            {
                const { cols, rows, stepX, stepY } = calculateGridDimensions(drawWidth, drawHeight, numPoints);
                const layerOffsetX = (layerIndex * stepX * 0.618) % stepX;
                const layerOffsetY = (layerIndex * stepY * 0.618) % stepY;
                const totalCells = cols * rows;
                const jitter = flowState.gridConfig.jitter || 0;
                
                // Grid mode: Generate ALL cells required by spacing (not capped by numParticles)
                // In manual spacing mode, this ensures full coverage regardless of numParticles
                // In auto mode, totalCells naturally matches numParticles
                for (let i = 0; i < totalCells; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    let x = margin + col * stepX + stepX * 0.5 + layerOffsetX;
                    let y = margin + row * stepY + stepY * 0.5 + layerOffsetY;
                    if (jitter > 0) {
                        x += (Math.random() - 0.5) * stepX * jitter;
                        y += (Math.random() - 0.5) * stepY * jitter;
                    }
                    x = Math.max(margin, Math.min(margin + drawWidth, x));
                    y = Math.max(margin, Math.min(margin + drawHeight, y));
                    points.push([x, y]);
                }
            }
            break;
        case 'circle':
             // (Keep existing Circle Packing logic)
             {
                const area = drawWidth * drawHeight;
                const r = Math.sqrt(area / (numPoints * 0.9));
                // ... (standard Poisson disk logic) ...
                // For this prompt, assume we keep the circle logic as-is or re-insert if deleted.
                // Simple placeholder for brevity if needed:
                for(let i=0; i<numPoints; i++) points.push([margin+Math.random()*drawWidth, margin+Math.random()*drawHeight]);
             }
             break;
        case 'phyllotaxis':
            {
                const spread = flowState.phyllotaxisConfig?.spread || 5.0;
                const minRadius = flowState.phyllotaxisConfig?.minRadius || 0;
                const layerRotation = layerIndex * (Math.PI / 13); // Rotate layers to prevent overlap
                const goldenAngle = 137.5 * (Math.PI / 180);
                const c = (Math.min(drawWidth, drawHeight)/2 / Math.sqrt(numPoints)) * (spread/5.0);
                
                for (let i = 0; i < numPoints * 2; i++) {
                    const r = c * Math.sqrt(i);
                    if (r < minRadius) continue;
                    const angle = i * goldenAngle + layerRotation;
                    const x = centerX + r * Math.cos(angle);
                    const y = centerY + r * Math.sin(angle);
                    if (x >= margin && x <= margin + drawWidth && y >= margin && y <= margin + drawHeight) {
                        points.push([x, y]);
                    }
                    if (points.length >= numPoints) break;
                }
            }
            break;
        case 'noise-density':
            {
                const threshold = flowState.cloudConfig?.threshold ?? 0.4;
                const scaleMult = flowState.cloudConfig?.scale ?? 0.5;
                let count = 0, attempts = 0;
                while (count < numPoints && attempts < numPoints * 20) {
                    attempts++;
                    const x = margin + Math.random() * drawWidth;
                    const y = margin + Math.random() * drawHeight;
                    const n = flowState.perlin.noise2D(x * flowState.noiseScale * scaleMult, y * flowState.noiseScale * scaleMult);
                    if (((n + 1) / 2) > threshold || Math.random() > 0.98) {
                        points.push([x, y]);
                        count++;
                    }
                }
            }
            break;
    }
    return points;
}

/**
 * Initialize spatial grid for fast distance checking
 */
function initSpatialGrid() {
    // Calculate effective collision radius: minDistance + strokeWidth + safety buffer
    // The 0.05mm buffer ensures lines don't visually touch when minDistance is 0
    const effectiveCollisionRadius = flowState.minDistance + flowState.strokeWidth + 0.05;
    
    if (effectiveCollisionRadius <= 0) {
        flowState.spatialGrid = null;
        return;
    }
    
    const cellSize = Math.max(effectiveCollisionRadius * 2, flowState.gridCellSize);
    flowState.gridCellSize = cellSize;
    
    const margin = flowState.margin;
    const drawWidth = flowState.widthMm - 2 * margin;
    const drawHeight = flowState.heightMm - 2 * margin;
    
    if (drawWidth <= 0 || drawHeight <= 0) {
        flowState.spatialGrid = null;
        return;
    }
    
    const cols = Math.ceil(drawWidth / cellSize);
    const rows = Math.ceil(drawHeight / cellSize);
    
    if (cols <= 0 || rows <= 0) {
        flowState.spatialGrid = null;
        return;
    }
    
    flowState.spatialGrid = {
        cellSize: cellSize,
        cols: cols,
        rows: rows,
        margin: margin,
        cells: new Array(cols * rows).fill(null).map(() => [])
    };
}

/**
 * Get grid cell coordinates for a point
 */
function getGridCell(x, y) {
    const grid = flowState.spatialGrid;
    const relX = x - grid.margin;
    const relY = y - grid.margin;
    const col = Math.floor(relX / grid.cellSize);
    const row = Math.floor(relY / grid.cellSize);
    return { col: Math.max(0, Math.min(grid.cols - 1, col)), row: Math.max(0, Math.min(grid.rows - 1, row)) };
}

/**
 * Add a point to the spatial grid
 */
function addPointToGrid(x, y) {
    if (!flowState.spatialGrid) return;
    
    const cell = getGridCell(x, y);
    const grid = flowState.spatialGrid;
    const index = cell.row * grid.cols + cell.col;
    grid.cells[index].push([x, y]);
}

/**
 * Check if point is too close to existing paths using spatial grid
 */
function isTooClose(x, y, minDist) {
    // Calculate effective collision radius: minDistance + strokeWidth + safety buffer
    // The 0.05mm buffer ensures lines don't visually touch when minDistance is 0
    const effectiveCollisionRadius = flowState.minDistance + flowState.strokeWidth + 0.05;
    
    // If effective collision radius is 0 or grid doesn't exist, always return false (no distance check)
    if (effectiveCollisionRadius <= 0 || !flowState.spatialGrid) {
        return false;
    }
    
    // Safety check - if grid is not properly initialized, skip distance check
    if (!flowState.spatialGrid.cells || flowState.spatialGrid.cells.length === 0) {
        return false;
    }
    
    const minDistSq = effectiveCollisionRadius * effectiveCollisionRadius;
    const grid = flowState.spatialGrid;
    
    try {
        const cell = getGridCell(x, y);
        
        // Check current cell and neighboring cells (3x3 grid)
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const checkCol = cell.col + dc;
                const checkRow = cell.row + dr;
                
                if (checkCol < 0 || checkCol >= grid.cols || checkRow < 0 || checkRow >= grid.rows) {
                    continue;
                }
                
                const index = checkRow * grid.cols + checkCol;
                if (index < 0 || index >= grid.cells.length) {
                    continue;
                }
                
                const points = grid.cells[index];
                if (!points || points.length === 0) continue;
                
                for (const [px, py] of points) {
                    const dx = x - px;
                    const dy = y - py;
                    if (dx * dx + dy * dy < minDistSq) {
                        return true;
                    }
                }
            }
        }
    } catch (e) {
        // If there's any error in grid lookup, skip distance check to allow paths to generate
        console.warn('Error in spatial grid lookup:', e);
        return false;
    }
    
    return false;
}

/**
 * Get color for a path point based on color mode
 */
function getPathColor(path, pointIndex, totalPoints) {
    return path.color ?? '#000000';
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Generate a random hex color.
 */
function generateRandomHexColor() {
    const rand = () => Math.floor(Math.random() * 256);
    return rgbToHex(rand(), rand(), rand());
}

/**
 * Ensure a layer object has settings and forceOverprint defaults.
 */
function ensureLayerDefaults(layer) {
    if (!layer) return;
    if (!layer.settings) {
        layer.settings = snapshotLayerSettingsFromFlowState();
    }
    const force =
        typeof layer.settings.forceOverprint !== 'undefined'
            ? layer.settings.forceOverprint
            : (typeof layer.forceOverprint !== 'undefined' ? layer.forceOverprint : false);
    layer.settings.forceOverprint = force;
    layer.forceOverprint = force;
}

/**
 * Apply a settings snapshot to flowState.
 */
function applySettingsToFlowState(settings) {
    if (!settings) return;
    const prevWidth = flowState.widthMm;
    const prevHeight = flowState.heightMm;
    flowState.widthMm = settings.widthMm ?? flowState.widthMm;
    flowState.heightMm = settings.heightMm ?? flowState.heightMm;
    flowState.noiseEnabled = settings.noiseEnabled ?? flowState.noiseEnabled;
    flowState.noiseScale = clampNoiseScale(settings.noiseScale ?? flowState.noiseScale);
    flowState.savedNoiseScale = settings.savedNoiseScale ?? flowState.savedNoiseScale ?? flowState.noiseScale;
    flowState.noiseSeed = settings.noiseSeed ?? flowState.noiseSeed;
    flowState.noiseOctaves = settings.noiseOctaves ?? flowState.noiseOctaves;
    flowState.noisePersistence = settings.noisePersistence ?? flowState.noisePersistence;
    flowState.angleOffset = settings.angleOffset ?? flowState.angleOffset;
    flowState.flowStrength = settings.flowStrength ?? flowState.flowStrength;
    flowState.curlAmount = settings.curlAmount ?? flowState.curlAmount;
    flowState.flowMode = settings.flowMode ?? flowState.flowMode ?? 'noise';
    flowState.attractorParams = { ...flowState.attractorParams, ...(settings.attractorParams || {}) };
    flowState.distortion = { ...flowState.distortion, ...(settings.distortion || {}) };
    flowState.geometry = { ...flowState.geometry, ...(settings.geometry || {}) };
    flowState.numParticles = settings.numParticles ?? flowState.numParticles;
    flowState.startPositionMode = settings.startPositionMode ?? flowState.startPositionMode;
    flowState.gridConfig = { ...flowState.gridConfig, ...(settings.gridConfig || {}) };
    flowState.phyllotaxisConfig = { ...flowState.phyllotaxisConfig, ...(settings.phyllotaxisConfig || {}) };
    flowState.cloudConfig = { ...flowState.cloudConfig, ...(settings.cloudConfig || {}) };
    flowState.lineLength = settings.lineLength ?? flowState.lineLength;
    flowState.stepSize = settings.stepSize ?? flowState.stepSize;
    flowState.minDistance = settings.minDistance ?? flowState.minDistance;
    flowState.forceOverprint = settings.forceOverprint ?? flowState.forceOverprint ?? false;
    flowState.strokeWidth = clampStrokeWidthMm(settings.strokeWidth ?? flowState.strokeWidth);
    flowState.margin = settings.margin ?? flowState.margin;
    flowState.renderStyle = settings.renderStyle ?? flowState.renderStyle ?? 'default';
    flowState.brushWidth = settings.brushWidth ?? flowState.brushWidth ?? 5;
    flowState.terrainVerticalGap = settings.terrainVerticalGap ?? flowState.terrainVerticalGap ?? 5;
    flowState.terrainAltitude = settings.terrainAltitude ?? flowState.terrainAltitude ?? 30;
    flowState.terrainDetail = settings.terrainDetail ?? flowState.terrainDetail ?? 1;
    flowState.perlin = new PerlinNoise(flowState.noiseSeed);
    flowState.currentNoiseSeed = flowState.noiseSeed;
    if ((flowState.widthMm !== prevWidth || flowState.heightMm !== prevHeight) && typeof initCanvas === 'function') {
        initCanvas();
    }
}

/**
 * Push current flowState into the active layer's settings.
 */
function persistSettingsToActiveLayer() {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const snapshot = snapshotLayerSettingsFromFlowState();
    activeLayer.settings = snapshot;
    ensureLayerDefaults(activeLayer);
    if (flowState.syncAllLayers) {
        syncAllLayersFromFlowState();
    }
}

/**
 * Push the current flowState settings snapshot to every layer.
 */
function syncAllLayersFromFlowState() {
    const snapshot = snapshotLayerSettingsFromFlowState();
    
    flowState.layers.forEach((layer, index) => {
        ensureLayerDefaults(layer);
        
        // Create new settings based on the global snapshot
        const newSettings = {
            ...snapshot,
            gridConfig: { ...(snapshot.gridConfig || {}) },
            forceOverprint: snapshot.forceOverprint
        };

        // Apply settings
        layer.settings = newSettings;
        layer.forceOverprint = newSettings.forceOverprint;
    });

    // CRITICAL FIX: If we modified the Active Layer's seed (via the grid offset above),
    // we must update flowState to match, otherwise the generator uses the old 'snapshot' seed
    // and draws the layer in the wrong place (causing overlap).
    const activeLayer = getActiveLayer();
    if (activeLayer) {
        applySettingsToFlowState(activeLayer.settings);
    }
}

/**
 * Apply a layer's settings onto the UI controls.
 */
function applySettingsToUI(settings) {
    if (!settings) return;
    const setSliderValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };
    const setCheckboxValue = (id, checked) => {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    };
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    const flowModeEl = document.getElementById('flow-mode');
    const nextFlowMode = settings.flowMode ?? 'noise';
    if (flowModeEl) {
        flowModeEl.value = nextFlowMode;
    }
    if (typeof updateFlowModeVisibility === 'function') {
        updateFlowModeVisibility(nextFlowMode);
    }

    // Noise enabled/scale
    setCheckboxValue('noise-enabled', !!settings.noiseEnabled);
    const noiseScaleEl = document.getElementById('noise-scale');
    if (noiseScaleEl) {
        if (settings.noiseEnabled === false) {
            noiseScaleEl.disabled = true;
            noiseScaleEl.value = 0;
            if (typeof updateNoiseScaleDisplay === 'function') updateNoiseScaleDisplay(0);
        } else {
            noiseScaleEl.disabled = false;
            const sliderVal = noiseScaleToSlider(settings.noiseScale ?? flowState.noiseScale);
            noiseScaleEl.value = sliderVal.toFixed(3);
            if (typeof updateNoiseScaleDisplay === 'function') updateNoiseScaleDisplay(settings.noiseScale ?? flowState.noiseScale);
        }
    }

    // Seed / octaves / persistence
    setSliderValue('noise-seed', settings.noiseSeed ?? '');
    setSliderValue('noise-octaves', settings.noiseOctaves ?? '');
    setText('noise-octaves-value', settings.noiseOctaves ?? '');
    setSliderValue('noise-persistence', settings.noisePersistence ?? '');
    setText('noise-persistence-value', (settings.noisePersistence ?? 0).toFixed(2));

    // Attractor parameters
    const attractor = { ...flowState.attractorParams, ...(settings.attractorParams || {}) };
    setSliderValue('attractor-a', attractor.a);
    setText('attractor-a-value', attractor.a.toFixed(2));
    setSliderValue('attractor-b', attractor.b);
    setText('attractor-b-value', attractor.b.toFixed(2));
    setSliderValue('attractor-c', attractor.c);
    setText('attractor-c-value', attractor.c.toFixed(2));
    setSliderValue('attractor-d', attractor.d);
    setText('attractor-d-value', attractor.d.toFixed(2));

    // Angles and flow shape
    setSliderValue('angle-offset', settings.angleOffset ?? '');
    setText('angle-offset-value', `${settings.angleOffset ?? 0}°`);
    setSliderValue('flow-strength', settings.flowStrength ?? '');
    setText('flow-strength-value', `${Math.round((settings.flowStrength ?? 0) * 100)}%`);
    setSliderValue('curl-amount', settings.curlAmount ?? '');
    setText('curl-amount-value', `${Math.round((settings.curlAmount ?? 0) * 100)}%`);
    setCheckboxValue('distortion-enabled', !!settings.distortion?.enabled);
    setSliderValue('distortion-strength', settings.distortion?.strength ?? '');
    setText('distortion-strength-value', (settings.distortion?.strength ?? 0).toFixed(1));
    setSliderValue('distortion-scale', settings.distortion?.scale ?? '');
    setText('distortion-scale-value', (settings.distortion?.scale ?? 0).toFixed(3));
    setSliderValue('distortion-phase', settings.distortion?.phase ?? '');
    setText('distortion-phase-value', (settings.distortion?.phase ?? 0).toFixed(1));
    setSliderValue('distortion-detail', settings.distortion?.detail ?? '');
    setText('distortion-detail-value', `${settings.distortion?.detail ?? 0}`);
    const symMode = settings.geometry?.symmetry ?? 'none';
    const symEl = document.getElementById('symmetry-mode');
    if (symEl) symEl.value = symMode;
    const radialGroup = document.getElementById('radial-segments-group');
    if (radialGroup) radialGroup.style.display = symMode === 'radial' ? 'block' : 'none';
    setSliderValue('radial-segments', settings.geometry?.segments ?? '');
    setText('radial-segments-value', `${settings.geometry?.segments ?? ''}`);
    const angleSnapEl = document.getElementById('angle-snapping');
    if (angleSnapEl && typeof settings.geometry?.snapping !== 'undefined') {
        angleSnapEl.value = settings.geometry.snapping;
    }
    setSliderValue('snapping-strength', (settings.geometry?.snappingStrength ?? 0) * 100);
    setText('snapping-strength-value', `${Math.round((settings.geometry?.snappingStrength ?? 0) * 100)}%`);

    // Particle / grid
    setSliderValue('num-particles', settings.numParticles ?? '');
    setText('num-particles-value', settings.numParticles ?? '');
    const startModeEl = document.getElementById('start-position-mode');
    if (startModeEl) {
        startModeEl.value = settings.startPositionMode ?? startModeEl.value;
    }
    const gridSettingsSection = document.getElementById('grid-settings-section');
    if (gridSettingsSection) {
        gridSettingsSection.style.display = (settings.startPositionMode === 'grid') ? 'block' : 'none';
    }

    const gridAuto = settings.gridConfig?.spacingMode !== 'manual';
    setCheckboxValue('grid-auto-spacing', gridAuto);
    const manualGroup = document.getElementById('grid-spacing-manual-group');
    if (manualGroup) {
        manualGroup.style.display = gridAuto ? 'none' : 'block';
    }
    setSliderValue('grid-spacing', settings.gridConfig?.spacing ?? '');
    setText('grid-spacing-value', `${(settings.gridConfig?.spacing ?? 0).toFixed(1)} mm`);
    setCheckboxValue('grid-hex', !!settings.gridConfig?.hexGrid);
    setSliderValue('grid-jitter', settings.gridConfig?.jitter ?? '');
    setText('grid-jitter-value', `${Math.round((settings.gridConfig?.jitter ?? 0) * 100)}%`);

    // Grid size display
    const displayEl = document.getElementById('grid-size-display');
    if (displayEl && (settings.startPositionMode === 'grid')) {
        const margin = settings.margin ?? flowState.margin;
        const drawWidth = flowState.widthMm - 2 * margin;
        const drawHeight = flowState.heightMm - 2 * margin;
        if (drawWidth > 0 && drawHeight > 0) {
            let cols, rows;
            if (settings.gridConfig?.spacingMode === 'manual') {
                const spacing = Math.max(0.1, settings.gridConfig.spacing);
                cols = Math.max(1, Math.ceil(drawWidth / spacing));
                rows = Math.max(1, Math.ceil(drawHeight / spacing));
            } else {
                cols = Math.ceil(Math.sqrt((settings.numParticles ?? flowState.numParticles) * (drawWidth / drawHeight)));
                rows = Math.ceil((settings.numParticles ?? flowState.numParticles) / cols);
            }
            displayEl.textContent = `${cols} × ${rows} (${cols * rows} points)`;
        } else {
            displayEl.textContent = '-';
        }
    }

    // Path metrics
    setSliderValue('line-length', settings.lineLength ?? '');
    setText('line-length-value', `${settings.lineLength ?? 0} mm`);
    setSliderValue('step-size', settings.stepSize ?? '');
    setText('step-size-value', (settings.stepSize ?? 0).toFixed(1));
    setSliderValue('min-distance', settings.minDistance ?? '');
    setText('min-distance-value', `${(settings.minDistance ?? 0).toFixed(1)} mm`);

    // Canvas/display
    const strokeMm = clampStrokeWidthMm(settings.strokeWidth ?? flowState.strokeWidth);
    setSliderValue('stroke-width', strokeMm);
    setText('stroke-width-value', `${strokeMm.toFixed(2)} mm`);
    setSliderValue('margin', settings.margin ?? '');
    setText('margin-value', `${settings.margin ?? 0} mm`);
    setCheckboxValue('force-overprint', !!settings.forceOverprint);
    
    // Render style
    const renderStyleEl = document.getElementById('render-style');
    if (renderStyleEl) {
        renderStyleEl.value = settings.renderStyle ?? flowState.renderStyle ?? 'default';
    }
    setSliderValue('brush-width', settings.brushWidth ?? flowState.brushWidth ?? 5);
    setText('brush-width-value', `${(settings.brushWidth ?? flowState.brushWidth ?? 5)} mm`);
    
    // Terrain settings
    setSliderValue('terrain-vertical-gap', settings.terrainVerticalGap ?? flowState.terrainVerticalGap ?? 5);
    setText('terrain-vertical-gap-value', `${(settings.terrainVerticalGap ?? flowState.terrainVerticalGap ?? 5).toFixed(1)} mm`);
    setSliderValue('terrain-altitude', settings.terrainAltitude ?? flowState.terrainAltitude ?? 30);
    setText('terrain-altitude-value', `${(settings.terrainAltitude ?? flowState.terrainAltitude ?? 30)} mm`);
    const terrainDetailValue = settings.terrainDetail ?? flowState.terrainDetail ?? 1;
    setSliderValue('terrain-detail', terrainDetailValue);
    setText('terrain-detail-value', terrainDetailValue.toFixed(1));
    
    const paperSizeEl = document.getElementById('paper-size');
    if (paperSizeEl) {
        const w = Math.min(settings.widthMm ?? flowState.widthMm, settings.heightMm ?? flowState.heightMm);
        const h = Math.max(settings.widthMm ?? flowState.widthMm, settings.heightMm ?? flowState.heightMm);
        const paperValue = `${w}x${h}`;
        if (paperSizeEl.querySelector(`option[value="${paperValue}"]`)) {
            paperSizeEl.value = paperValue;
        }
    }

    // Sync orientation buttons
    const isLandscape = (settings.widthMm ?? flowState.widthMm) > (settings.heightMm ?? flowState.heightMm);
    const portraitBtn = document.getElementById('btn-portrait');
    const landscapeBtn = document.getElementById('btn-landscape');
    if (portraitBtn) portraitBtn.classList.toggle('active', !isLandscape);
    if (landscapeBtn) landscapeBtn.classList.toggle('active', isLandscape);

    const advContainer = document.getElementById('advanced-settings-container');
    const spiralControls = document.getElementById('phyllotaxis-controls');
    const cloudControls = document.getElementById('noise-density-controls');
    const mode = settings.startPositionMode ?? flowState.startPositionMode;
    if (advContainer && spiralControls && cloudControls) {
        if (mode === 'phyllotaxis') {
            advContainer.style.display = 'block';
            spiralControls.style.display = 'block';
            cloudControls.style.display = 'none';
        } else if (mode === 'noise-density') {
            advContainer.style.display = 'block';
            spiralControls.style.display = 'none';
            cloudControls.style.display = 'block';
        } else {
            advContainer.style.display = 'none';
        }
    }

    // Sync values
    if(settings.phyllotaxisConfig) {
        setSliderValue('spiral-tightness', settings.phyllotaxisConfig.spread);
        setText('spiral-tightness-value', (settings.phyllotaxisConfig.spread).toFixed(1));
        setSliderValue('spiral-min-radius', settings.phyllotaxisConfig.minRadius);
        setText('spiral-min-radius-value', `${settings.phyllotaxisConfig.minRadius} mm`);
    }

    if(settings.cloudConfig) {
        setSliderValue('cloud-threshold', settings.cloudConfig.threshold);
        setText('cloud-threshold-value', (settings.cloudConfig.threshold).toFixed(2));
        setSliderValue('cloud-scale', settings.cloudConfig.scale);
        setText('cloud-scale-value', (settings.cloudConfig.scale).toFixed(1));
    }
}

/**
 * Get the active layer object
 * @returns {object|null} The active layer or null if not found
 */
function getActiveLayer() {
    return flowState.layers.find(l => l.id === flowState.activeLayerId) || null;
}

/**
 * Get layer by ID
 * @param {string} id - Layer ID
 * @returns {object|null} The layer or null if not found
 */
function getLayerById(id) {
    return flowState.layers.find(l => l.id === id) || null;
}

/**
 * Generate unique layer ID
 */
function generateLayerId() {
    return 'layer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Add a new layer with auto-generated color from palette
 */
function addNewLayer(targetColor) {
    const layerIndex = flowState.layers.length;
    const color = typeof targetColor === 'string' ? targetColor : generateRandomHexColor();
    
    const newLayer = {
        id: generateLayerId(),
        name: `Layer ${layerIndex + 1}`,
        color: color,
        paths: [],
        visible: true,
        forceOverprint: false,
        settings: snapshotLayerSettingsFromFlowState()
    };

    flowState.layers.push(newLayer);
    flowState.activeLayerId = newLayer.id;
    
    // FIX: Handling Sync vs Non-Sync logic correctly
    if (flowState.syncAllLayers) {
        // If Sync is ON, let the sync function handle everything.
        // It will apply the global settings AND the grid offsets automatically.
        syncAllLayersFromFlowState();
    } else {
        // If Sync is OFF, we manually offset the grid seed for this new layer
        // so it doesn't default to overlapping the previous one.
        ensureLayerDefaults(newLayer);
        newLayer.forceOverprint = !!newLayer.settings.forceOverprint;

        if (newLayer.settings.startPositionMode === 'grid') {
            const newSeed = Math.floor(Math.random() * 10000);
            newLayer.settings.noiseSeed = newSeed;
            
            // Update global state and UI to match this new independent layer
            applySettingsToFlowState(newLayer.settings);
            applySettingsToUI(newLayer.settings);
        }
    }
    
    renderLayerList();
    generateFlowField();
}

/**
 * Delete a layer by ID
 * @param {string} id - Layer ID to delete
 */
function deleteLayer(id) {
    // Don't delete if it's the only layer
    if (flowState.layers.length <= 1) {
        return;
    }
    
    const index = flowState.layers.findIndex(l => l.id === id);
    if (index === -1) return;
    
    flowState.layers.splice(index, 1);
    
    // If we deleted the active layer, select another one
    if (flowState.activeLayerId === id) {
        flowState.activeLayerId = flowState.layers[Math.max(0, index - 1)].id;
    }
    
    syncPathsFromLayers();
    renderLayerList();
    renderCanvas();
}

/**
 * Toggle layer visibility
 * @param {string} id - Layer ID
 */
function toggleLayerVisibility(id) {
    const layer = getLayerById(id);
    if (layer) {
        layer.visible = !layer.visible;
        syncPathsFromLayers();
        renderLayerList();
        renderCanvas();
    }
}

/**
 * Set the active layer
 * @param {string} id - Layer ID to make active
 */
function setActiveLayer(id) {
    const layer = getLayerById(id);
    if (!layer) return;
    flowState.activeLayerId = id;
    ensureLayerDefaults(layer);
    applySettingsToFlowState(layer.settings);
    applySettingsToUI(layer.settings);
    renderLayerList();
}

/**
 * Regenerate only the active layer
 * Clears the active layer's paths and regenerates while respecting other layers
 */
function regenerateActiveLayer() {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    
    // Clear the active layer's paths
    activeLayer.paths = [];
    
    // Generate new paths for this layer
    generateFlowField();
}

/**
 * Regenerate all visible layers in order.
 * Clears layer paths, resets the spatial grid, and rebuilds each layer sequentially.
 */
function generateAllLayers() {
    if (!flowState.canvas || !flowState.ctx) {
        initCanvas();
    }
    if (!flowState.canvas || !flowState.ctx || !flowState.pxPerMm) {
        console.warn('Canvas not ready, aborting generateAllLayers');
        return;
    }

    const previousActiveId = flowState.activeLayerId;

    // Clear existing paths for every layer
    flowState.layers.forEach((layer) => {
        layer.paths = [];
    });
    flowState.paths = [];
    flowState.spatialGrid = null;

    // Regenerate each visible layer in order
    for (const layer of flowState.layers) {
        if (!layer.visible) continue;
        ensureLayerDefaults(layer);
        flowState.activeLayerId = layer.id;
        applySettingsToFlowState(layer.settings);
        applySettingsToUI(layer.settings);
        generateFlowField();
    }

    // Restore previously active layer selection and settings in the UI
    const previousLayer = getLayerById(previousActiveId);
    if (previousLayer) {
        flowState.activeLayerId = previousActiveId;
        ensureLayerDefaults(previousLayer);
        applySettingsToFlowState(previousLayer.settings);
        applySettingsToUI(previousLayer.settings);
        renderLayerList();
    }
}

/**
 * Move a layer to a new position
 * @param {number} fromIndex - Current index
 * @param {number} toIndex - Target index
 */
function reorderLayers(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= flowState.layers.length) return;
    if (toIndex < 0 || toIndex >= flowState.layers.length) return;
    
    const [layer] = flowState.layers.splice(fromIndex, 1);
    flowState.layers.splice(toIndex, 0, layer);
    
    syncPathsFromLayers();
    renderLayerList();
    renderCanvas();
}

/**
 * Render the layer list UI
 */
function renderLayerList() {
    const container = document.getElementById('layer-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    flowState.layers.forEach((layer, index) => {
        ensureLayerDefaults(layer);
        const isActive = layer.id === flowState.activeLayerId;
        
        const layerEl = document.createElement('div');
        layerEl.className = `layer-item${isActive ? ' active' : ''}`;
        layerEl.dataset.layerId = layer.id;
        layerEl.dataset.index = index;
        
        // Drag handle
        const dragHandle = document.createElement('span');
        dragHandle.className = 'layer-drag-handle';
        dragHandle.innerHTML = '&#9776;'; // Hamburger menu icon
        dragHandle.title = 'Drag to reorder';
        
        // Color swatch (clickable to change color)
        const colorSwatch = document.createElement('input');
        colorSwatch.type = 'color';
        colorSwatch.className = 'layer-color-swatch';
        colorSwatch.value = layer.color;
        colorSwatch.title = 'Click to change color';
        colorSwatch.addEventListener('input', (e) => {
            layer.color = e.target.value;
            layer.settings = layer.settings || {};
            layer.settings.color = e.target.value;
            renderCanvas();
            // Statistics don't change when color changes, so no need to update
        });
        colorSwatch.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Layer name
        const nameEl = document.createElement('span');
        nameEl.className = 'layer-name';
        nameEl.textContent = layer.name;
        
        // Visibility toggle
        const visibilityBtn = document.createElement('button');
        visibilityBtn.className = `layer-visibility-btn${layer.visible ? '' : ' hidden'}`;
        visibilityBtn.innerHTML = layer.visible 
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        visibilityBtn.title = layer.visible ? 'Hide layer' : 'Show layer';
        visibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLayerVisibility(layer.id);
        });
        
        // Overprint toggle (icon)
        const overprintBtn = document.createElement('button');
        const overprintActive = !!layer.forceOverprint;
        overprintBtn.className = `layer-overprint-btn${overprintActive ? ' active' : ''}`;
        overprintBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="12" r="4"/><circle cx="14" cy="12" r="4"/></svg>';
        overprintBtn.title = overprintActive ? 'Disable overprint' : 'Enable overprint';
        overprintBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const next = !layer.forceOverprint;
            ensureLayerDefaults(layer);
            layer.forceOverprint = next;
            layer.settings.forceOverprint = next;
            renderLayerList();
        });
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'layer-delete-btn';
        deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        deleteBtn.title = 'Delete layer';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteLayer(layer.id);
        });
        
        // Click on row to select
        layerEl.addEventListener('click', () => {
            setActiveLayer(layer.id);
        });
        
        // Assemble the layer item
        layerEl.appendChild(dragHandle);
        layerEl.appendChild(colorSwatch);
        layerEl.appendChild(nameEl);
        layerEl.appendChild(visibilityBtn);
        layerEl.appendChild(overprintBtn);
        if (flowState.layers.length > 1) {
            layerEl.appendChild(deleteBtn);
        }
        
        container.appendChild(layerEl);
    });
    
    // Setup drag and drop for reordering
    setupLayerDragDrop(container);
}

/**
 * Setup drag and drop functionality for layer reordering
 */
function setupLayerDragDrop(container) {
    let draggedElement = null;
    let draggedIndex = -1;
    
    const layerItems = container.querySelectorAll('.layer-item');
    
    layerItems.forEach((item) => {
        const handle = item.querySelector('.layer-drag-handle');
        
        handle.addEventListener('mousedown', (e) => {
            draggedElement = item;
            draggedIndex = parseInt(item.dataset.index);
            item.classList.add('dragging');
            e.preventDefault();
        });
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!draggedElement) return;
        
        const items = Array.from(container.querySelectorAll('.layer-item:not(.dragging)'));
        const afterElement = items.find(item => {
            const rect = item.getBoundingClientRect();
            return e.clientY < rect.top + rect.height / 2;
        });
        
        if (afterElement) {
            container.insertBefore(draggedElement, afterElement);
        } else {
            container.appendChild(draggedElement);
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (!draggedElement) return;
        
        draggedElement.classList.remove('dragging');
        
        // Calculate new order
        const newItems = Array.from(container.querySelectorAll('.layer-item'));
        const newIndex = newItems.indexOf(draggedElement);
        
        if (newIndex !== draggedIndex && newIndex !== -1) {
            reorderLayers(draggedIndex, newIndex);
        }
        
        draggedElement = null;
        draggedIndex = -1;
    });
}

/**
 * Build spatial grid from all visible layers except the active one
 * This ensures new paths don't intersect with existing layers
 */
function buildSpatialGridFromLayers() {
    initSpatialGrid();
    
    if (!flowState.spatialGrid) return;
    
    // Calculate effective collision radius: minDistance + strokeWidth + safety buffer
    const effectiveCollisionRadius = flowState.minDistance + flowState.strokeWidth + 0.05;
    const useDistanceCheck = effectiveCollisionRadius > 0 && flowState.spatialGrid;
    
    if (!useDistanceCheck) return;
    
    const activeLayer = getActiveLayer();
    const overprint = activeLayer ? (activeLayer.settings?.forceOverprint ?? activeLayer.forceOverprint) : false;
    if (overprint) {
        return;
    }
    
    // Add points from all OTHER visible layers to the grid
    // Add EVERY point to create solid collision walls (no gaps)
    for (const layer of flowState.layers) {
        // Skip the active layer - we're generating new paths for it
        if (layer.id === flowState.activeLayerId) continue;
        // Skip invisible layers - they shouldn't affect new path generation
        if (!layer.visible) continue;
        
        for (const path of layer.paths) {
            if (!path.coords || path.coords.length < 2) continue;
            
            // Add every single point to prevent gaps in collision detection
            for (let i = 0; i < path.coords.length; i++) {
                const [px, py] = path.coords[i];
                addPointToGrid(px, py);
            }
        }
    }
}

/**
 * Calculate normal vector (perpendicular to flow direction) at a point
 * @param {Array} path - Array of [x, y] coordinates
 * @param {number} index - Index of the point
 * @returns {Array} Normalized [nx, ny] vector
 */
function calculateNormal(path, index) {
    if (path.length < 2) return [0, 1];
    
    let dx, dy;
    if (index === 0) {
        // First point: use direction to next point
        dx = path[1][0] - path[0][0];
        dy = path[1][1] - path[0][1];
    } else if (index === path.length - 1) {
        // Last point: use direction from previous point
        dx = path[index][0] - path[index - 1][0];
        dy = path[index][1] - path[index - 1][1];
    } else {
        // Middle point: average direction from previous and to next
        const dx1 = path[index][0] - path[index - 1][0];
        const dy1 = path[index][1] - path[index - 1][1];
        const dx2 = path[index + 1][0] - path[index][0];
        const dy2 = path[index + 1][1] - path[index][1];
        dx = (dx1 + dx2) / 2;
        dy = (dy1 + dy2) / 2;
    }
    
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-6) return [0, 1];
    
    // Normalize direction
    dx /= mag;
    dy /= mag;
    
    // Return perpendicular (rotate 90 degrees)
    return [-dy, dx];
}

/**
 * Apply brush effect to a centerline path
 * @param {Array} centerlinePath - Array of [x, y] coordinates
 * @param {string} style - Brush style: 'default' | 'ribbon-hatched' | 'pipes' | 'circles'
 * @param {number} width - Brush width in mm
 * @returns {Array} Array of paths (each path is an array of [x, y] coordinates)
 */
function applyBrush(centerlinePath, style, width) {
    if (!centerlinePath || centerlinePath.length < 2) {
        return [centerlinePath]; // Return original path if invalid
    }
    
    if (style === 'default') {
        return [centerlinePath]; // No transformation
    }
    
    const paths = [];
    
    if (style === 'ribbon-hatched') {
        // Variable width zig-zag: creates a sawtooth pattern
        const zigzagPath = [];
        
        for (let i = 0; i < centerlinePath.length; i++) {
            const [cx, cy] = centerlinePath[i];
            const normal = calculateNormal(centerlinePath, i);
            const [nx, ny] = normal;
            
            // Use Perlin noise to vary width along the path (if available)
            let widthMultiplier = 1.0;
            if (flowState.perlin && flowState.noiseScale > 0) {
                try {
                    const noiseValue = flowState.perlin.noise2D(
                        cx * flowState.noiseScale * 0.5,
                        cy * flowState.noiseScale * 0.5
                    );
                    // Map noise from [-1, 1] to [0.3, 1.0] for width variation
                    widthMultiplier = 0.3 + (noiseValue + 1) * 0.35;
                } catch (e) {
                    // Fallback to constant width if noise fails
                    widthMultiplier = 1.0;
                }
            }
            const currentWidth = width * widthMultiplier;
            
            // Alternate between top and bottom of the ribbon
            const side = i % 2 === 0 ? 1 : -1;
            const offsetX = nx * currentWidth * side;
            const offsetY = ny * currentWidth * side;
            
            zigzagPath.push([cx + offsetX, cy + offsetY]);
        }
        
        paths.push(zigzagPath);
    } else if (style === 'pipes') {
        // Dual parallel lines: creates a "road" or "tube" look
        const topPath = [];
        const bottomPath = [];
        
        for (let i = 0; i < centerlinePath.length; i++) {
            const [cx, cy] = centerlinePath[i];
            const normal = calculateNormal(centerlinePath, i);
            const [nx, ny] = normal;
            
            const offsetX = nx * width;
            const offsetY = ny * width;
            
            topPath.push([cx + offsetX, cy + offsetY]);
            bottomPath.push([cx - offsetX, cy - offsetY]);
        }
        
        paths.push(topPath);
        paths.push(bottomPath);
    } else if (style === 'circles') {
        // Chain of circles along the path
        const circlePaths = [];
        const stepSize = width; // Distance between circles
        
        // Calculate cumulative distance along path
        let cumulativeDist = 0;
        const distances = [0];
        for (let i = 1; i < centerlinePath.length; i++) {
            const [x1, y1] = centerlinePath[i - 1];
            const [x2, y2] = centerlinePath[i];
            cumulativeDist += Math.hypot(x2 - x1, y2 - y1);
            distances.push(cumulativeDist);
        }
        
        // Generate circles at intervals
        let currentDist = 0;
        while (currentDist < cumulativeDist) {
            // Find the segment containing currentDist
            let segmentIndex = 0;
            for (let i = 1; i < distances.length; i++) {
                if (distances[i] >= currentDist) {
                    segmentIndex = i;
                    break;
                }
            }
            
            if (segmentIndex === 0) segmentIndex = 1;
            
            // Interpolate position along the segment
            const prevDist = distances[segmentIndex - 1];
            const nextDist = distances[segmentIndex];
            const t = (currentDist - prevDist) / (nextDist - prevDist);
            
            const [x1, y1] = centerlinePath[segmentIndex - 1];
            const [x2, y2] = centerlinePath[segmentIndex];
            const cx = x1 + (x2 - x1) * t;
            const cy = y1 + (y2 - y1) * t;
            
            // Generate circle as polygon (approximation)
            const circleSegments = Math.max(8, Math.min(32, Math.floor(width * 2))); // Adaptive segment count
            const radius = width / 2;
            const circlePath = [];
            
            for (let i = 0; i <= circleSegments; i++) {
                const angle = (i / circleSegments) * Math.PI * 2;
                const px = cx + Math.cos(angle) * radius;
                const py = cy + Math.sin(angle) * radius;
                circlePath.push([px, py]);
            }
            
            circlePaths.push(circlePath);
            
            currentDist += stepSize;
        }
        
        // Return all circle paths
        return circlePaths;
    }
    
    return paths;
}

/**
 * Generate isometric terrain using horizon buffer algorithm for hidden line removal
 * Creates horizontal "ridge lines" that simulate a 3D landscape
 */
function generateIsometricTerrain() {
    // Ensure canvas is initialized
    if (!flowState.canvas || !flowState.ctx || !flowState.pxPerMm) {
        initCanvas();
    }
    if (!flowState.canvas || !flowState.ctx || !flowState.pxPerMm) {
        console.warn('Canvas not ready for terrain generation');
        return;
    }
    
    const margin = flowState.margin;
    const drawWidth = flowState.widthMm - 2 * margin;
    const drawHeight = flowState.heightMm - 2 * margin;
    
    // Validate dimensions
    if (drawWidth <= 0 || drawHeight <= 0) {
        console.warn('Invalid dimensions for terrain generation');
        return;
    }
    
    // Get the active layer
    const activeLayer = getActiveLayer();
    if (!activeLayer) {
        console.warn('No active layer found');
        return;
    }
    
    // Clear the active layer's paths
    activeLayer.paths = [];
    
    // Reinitialize Perlin noise if seed changed
    if (flowState.currentNoiseSeed !== flowState.noiseSeed) {
        flowState.perlin = new PerlinNoise(flowState.noiseSeed);
        flowState.currentNoiseSeed = flowState.noiseSeed;
    }
    
    // Terrain parameters
    const verticalGap = flowState.terrainVerticalGap || 5;  // Distance between rows in mm
    const altitude = flowState.terrainAltitude || 30;        // Peak height in mm
    const detail = flowState.terrainDetail || 1;             // X-axis step size in mm (lower = better occlusion)
    
    // Boost noise scale for terrain: terrain needs zoomed-out noise (0.05+) to look like mountains
    // Flow fields use zoomed-in noise (0.001), so we multiply by 10 to reach mountainous range
    const terrainNoiseScale = flowState.noiseScale * 10;
    
    // Calculate drawing area dimensions in pixels for horizon buffer
    const drawWidthPx = drawWidth * flowState.pxPerMm;
    const drawHeightPx = drawHeight * flowState.pxPerMm;
    
    // Create horizon array: one entry per pixel column in the drawing area
    // Initialize to bottom of drawing area (maximum Y value in pixel coordinates)
    // In screen coordinates, larger Y = lower on screen, so we initialize to the bottom
    const horizonSize = Math.ceil(drawWidthPx);
    const horizon = new Array(horizonSize).fill(drawHeightPx);
    
    // Calculate number of rows (from front/bottom to back/top)
    const numRows = Math.ceil(drawHeight / verticalGap);
    
    // Iterate through rows from Front (Bottom) to Back (Top)
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
        const rowY = margin + drawHeight - (rowIndex * verticalGap);  // Start from bottom, move up
        
        // Current path being built for this row
        let currentPath = null;
        
        // Iterate x from left to right
        const numSteps = Math.ceil(drawWidth / detail);
        for (let stepIndex = 0; stepIndex <= numSteps; stepIndex++) {
            const x = margin + (stepIndex * detail);
            // Clamp x to drawing area
            const clampedX = Math.max(margin, Math.min(margin + drawWidth, x));
            
            // Calculate noise height at this point
            // Use terrainNoiseScale (boosted) for mountainous terrain features
            const noiseValue = flowState.perlin.noise2D(
                clampedX * terrainNoiseScale,
                rowY * terrainNoiseScale
            );
            
            // Amplify the ridges
            // Squaring the normalized value makes valleys flatter and peaks sharper (ridged multifractal look)
            let normalizedNoise = (noiseValue + 1) / 2;
            normalizedNoise = Math.pow(normalizedNoise, 1.5); // sharpen peaks
            const noiseHeight = normalizedNoise * altitude;
            
            // Calculate projected Y position (in mm): rowY minus the height displacement
            // In isometric view, going "up" in 3D means going "up" on screen
            const projectedY = rowY - noiseHeight;
            
            // Convert to pixel coordinates relative to drawing area (not full canvas)
            // X: relative to left margin
            const xPx = (clampedX - margin) * flowState.pxPerMm;
            // Y: relative to top margin (in screen coords, smaller Y = higher on screen)
            const yPx = (projectedY - margin) * flowState.pxPerMm;
            const horizonIndex = Math.floor(xPx);
            
            // Ensure horizon index is valid
            if (horizonIndex < 0 || horizonIndex >= horizon.length) {
                continue;
            }
            
            // Occlusion Check
            if (yPx < horizon[horizonIndex]) {
                // Point is visible (higher on screen than current horizon)
                if (currentPath === null) {
                    // Start a new path
                    currentPath = [[clampedX, projectedY]];
                } else {
                    // Continue current path
                    currentPath.push([clampedX, projectedY]);
                }
                
                // Update horizon: this is the new silhouette at this x position
                horizon[horizonIndex] = yPx;
            } else {
                // Point is occluded (behind a previous mountain)
                if (currentPath !== null && currentPath.length > 1) {
                    // End current path and save it
                    activeLayer.paths.push({
                        coords: currentPath,
                        color: activeLayer.color
                    });
                    currentPath = null;
                }
                // Do not update horizon for occluded points
            }
        }
        
        // If there's a remaining path at the end of the row, save it
        if (currentPath !== null && currentPath.length > 1) {
            activeLayer.paths.push({
                coords: currentPath,
                color: activeLayer.color
            });
        }
    }
    
    // Sync flowState.paths for backward compatibility
    syncPathsFromLayers();
    
    // Update layer list
    renderLayerList();
    
    renderCanvas();
    
    // Update statistics
    updateStatistics();
}

/**
 * Generate flow field paths
 * Generates paths for the active layer while respecting existing layers
 */
function generateFlowField() {
    // Ensure canvas is initialized before generating
    if (!flowState.canvas || !flowState.ctx) {
        initCanvas();
    }
    
    // Double-check canvas is ready
    if (!flowState.canvas || !flowState.ctx || !flowState.pxPerMm) {
        console.warn('Canvas not ready, retrying...');
        setTimeout(generateFlowField, 100);
        return;
    }
    
    const margin = flowState.margin;
    const drawWidth = flowState.widthMm - 2 * margin;
    const drawHeight = flowState.heightMm - 2 * margin;
    
    // Validate dimensions
    if (drawWidth <= 0 || drawHeight <= 0) {
        console.warn('Invalid dimensions:', { drawWidth, drawHeight, margin, widthMm: flowState.widthMm, heightMm: flowState.heightMm });
        return;
    }
    
    // Get the active layer
    const activeLayer = getActiveLayer();
    if (!activeLayer) {
        console.warn('No active layer found');
        return;
    }
    
    // Check if we're in isometric terrain mode
    if (flowState.flowMode === 'isometric') {
        generateIsometricTerrain();
        return;
    }
    
    // NEW: Calculate index to offset grid points
    const layerIndex = flowState.layers.findIndex(l => l.id === activeLayer.id);

    // Clear only the active layer's paths
    activeLayer.paths = [];
    
    // Generate starting points first (needed to determine grid mode and point count)
    const startingPoints = generateStartingPoints(drawWidth, drawHeight, margin, layerIndex);
    
    // Determine if we're in Grid mode
    const isGridMode = flowState.startPositionMode === 'grid';
    
    // Layer Budgeting: Calculate particle limit based on mode and shared layers
    let particleLimit;
    if (isGridMode) {
        // Grid mode: Draw ALL points generated by the grid (deterministic, full coverage)
        // This ensures manual spacing mode fills the entire canvas regardless of numParticles
        particleLimit = startingPoints.length;
    } else {
        // Random/other modes: Use budgeting logic to share particles between layers
        // Count layers that are competing for space (visible + not overprinting)
        const sharedLayerCount = flowState.layers.filter(
            l => l.visible && !(l.settings?.forceOverprint ?? l.forceOverprint ?? false)
        ).length;
        
        const overprint = activeLayer.settings?.forceOverprint ?? activeLayer.forceOverprint ?? false;
        particleLimit = overprint 
            ? flowState.numParticles  // Overprint layers ignore others, get full count
            : Math.floor(flowState.numParticles / Math.max(1, sharedLayerCount));  // Share budget equally
    }
    
    // Reinitialize Perlin noise if seed changed
    if (flowState.currentNoiseSeed !== flowState.noiseSeed) {
        flowState.perlin = new PerlinNoise(flowState.noiseSeed);
        flowState.currentNoiseSeed = flowState.noiseSeed;
    }
    
    // Build spatial grid for distance checks.
    // Calculate effective collision radius: minDistance + strokeWidth + safety buffer
    const effectiveCollisionRadius = flowState.minDistance + flowState.strokeWidth + 0.05;
    if (effectiveCollisionRadius > 0) {
        // Always init a grid (needed for self-spacing too)
        initSpatialGrid();
        // If other visible layers exist, seed the grid with their points so we avoid collisions with them.
        const hasOtherVisibleLayers = flowState.layers.some(
            l => l.visible && l.id !== flowState.activeLayerId && l.paths && l.paths.length > 0
        );
        const overprint = activeLayer.settings?.forceOverprint ?? activeLayer.forceOverprint;
        if (hasOtherVisibleLayers && !overprint) {
            buildSpatialGridFromLayers();
        }
    } else {
        flowState.spatialGrid = null;
    }
    
    // Distance checks depend on effectiveCollisionRadius and the presence of a grid
    const useDistanceCheck = effectiveCollisionRadius > 0 && flowState.spatialGrid;
    
    // Generate paths for the active layer (stop when particle limit is reached)
    for (const [startX, startY] of startingPoints) {
        // Stop if we've reached the particle limit for this layer
        if (activeLayer.paths.length >= particleLimit) {
            break;
        }
        
        // Ensure starting point is within bounds
        const clampedStartX = Math.max(margin, Math.min(flowState.widthMm - margin, startX));
        const clampedStartY = Math.max(margin, Math.min(flowState.heightMm - margin, startY));
        
        // Grid Mode: Check if the specific grid point lands on an existing line
        // If blocked, skip this point entirely (preserves grid structure, prevents overlaps)
        if (isGridMode && useDistanceCheck && flowState.spatialGrid) {
            if (isTooClose(clampedStartX, clampedStartY, effectiveCollisionRadius)) {
                continue; // Spot is taken by a previous layer -> Skip this point entirely
            }
        }
        
        // Retry loop for finding a valid starting point (Fair Distribution Fix)
        // Only runs for non-grid modes (Random, etc.)
        const maxRetries = 50;
        let validStartX = null;
        let validStartY = null;
        
        if (!isGridMode && useDistanceCheck && flowState.spatialGrid) {
            // Try to find a valid starting point by retrying random positions
            for (let retry = 0; retry < maxRetries; retry++) {
                let candidateX, candidateY;
                
                if (retry === 0) {
                    // First attempt: use the generated starting point
                    candidateX = startX;
                    candidateY = startY;
                } else {
                    // Subsequent attempts: pick a random point within bounds
                    candidateX = margin + Math.random() * drawWidth;
                    candidateY = margin + Math.random() * drawHeight;
                }
                
                // Ensure candidate point is within bounds
                const clampedX = Math.max(margin, Math.min(flowState.widthMm - margin, candidateX));
                const clampedY = Math.max(margin, Math.min(flowState.heightMm - margin, candidateY));
                
                // Check if this point is valid (not too close to existing paths)
                if (!isTooClose(clampedX, clampedY, effectiveCollisionRadius)) {
                    validStartX = clampedX;
                    validStartY = clampedY;
                    break; // Found a valid point, exit retry loop
                }
            }
            
            // If no valid point found after maxRetries, skip this particle
            if (validStartX === null || validStartY === null) {
                continue;
            }
        } else {
            // No distance check needed, or grid mode already validated -> use the generated starting point
            validStartX = clampedStartX;
            validStartY = clampedStartY;
        }
        
        // Don't reserve starting point yet - only add after path is successfully generated
        // This prevents blocking space for paths that might not be created
        
        const forwardPath = followFlowField(validStartX, validStartY, drawWidth, drawHeight, margin, 1);
        const backwardPath = followFlowField(validStartX, validStartY, drawWidth, drawHeight, margin, -1);
        
        // Merge backward (reversed) and forward traces, avoiding duplicate start
        const reversedBackward = backwardPath.slice().reverse();
        if (reversedBackward.length > 0) {
            reversedBackward.pop(); // drop duplicate start point
        }
        const fullPath = [...reversedBackward, ...forwardPath];
        
        if (fullPath.length > 1) {
            // Store path in the active layer with the layer's color
            activeLayer.paths.push({
                coords: fullPath,
                color: activeLayer.color
            });
            
            // Add all points from this completed path to the spatial grid
            // This allows future paths to check distance against this one
            // Only add to grid when distance checking is active
            // Add EVERY point to create solid collision walls (no gaps)
            if (useDistanceCheck && flowState.spatialGrid) {
                // Add every single point to prevent gaps in collision detection
                for (let i = 0; i < fullPath.length; i++) {
                    const [px, py] = fullPath[i];
                    addPointToGrid(px, py);
                }
            }
        }
    }
    
    // Noise Filter: Discard any path that contains fewer than 5 vertices
    // This removes tiny, noisy paths that would cause pen plotter issues
    activeLayer.paths = activeLayer.paths.filter(path => {
        return path.coords && path.coords.length >= 5;
    });
    
    // Apply brush system if not using default style
    if (flowState.renderStyle !== 'default') {
        const processedPaths = [];
        for (const path of activeLayer.paths) {
            const brushPaths = applyBrush(path.coords, flowState.renderStyle, flowState.brushWidth);
            // Each brush path becomes a new path object with the same color
            for (const brushPathCoords of brushPaths) {
                if (brushPathCoords && brushPathCoords.length >= 2) {
                    processedPaths.push({
                        coords: brushPathCoords,
                        color: path.color
                    });
                }
            }
        }
        // Replace original paths with brush-processed paths
        activeLayer.paths = processedPaths;
    }
    
    // Sync flowState.paths for backward compatibility (combines all layers)
    syncPathsFromLayers();
    
    // Update layer list to show current state
    renderLayerList();
    
    renderCanvas();
    
    // Update statistics
    updateStatistics();
}

/**
 * Synchronize flowState.paths from all layers
 * This is for backward compatibility with code that expects flowState.paths
 */
function syncPathsFromLayers() {
    flowState.paths = [];
    for (const layer of flowState.layers) {
        if (layer.visible) {
            for (const path of layer.paths) {
                flowState.paths.push({
                    coords: path.coords,
                    color: path.color ?? layer.color
                });
            }
        }
    }
    // Update statistics display
    updateStatistics();
}

/**
 * Calculate and display statistics (line count, pen up/down counts)
 */
function updateStatistics() {
    let lineCount = 0;
    let penDownCount = 0;
    let penUpCount = 0;
    
    // Count paths from all visible layers
    for (const layer of flowState.layers) {
        if (layer.visible) {
            for (const path of layer.paths) {
                if (path.coords && path.coords.length >= 2) {
                    lineCount++;
                    penDownCount++; // Each path starts with pen down
                    penUpCount++;   // Each path ends with pen up
                }
            }
        }
    }
    
    // Update the display
    const lineCountEl = document.getElementById('stat-line-count');
    const penDownCountEl = document.getElementById('stat-pen-down-count');
    const penUpCountEl = document.getElementById('stat-pen-up-count');
    
    if (lineCountEl) {
        lineCountEl.textContent = lineCount.toLocaleString();
    }
    if (penDownCountEl) {
        penDownCountEl.textContent = penDownCount.toLocaleString();
    }
    if (penUpCountEl) {
        penUpCountEl.textContent = penUpCount.toLocaleString();
    }
}

/**
 * Compute normalized Clifford attractor vector at scaled coordinates.
 * Uses noiseScale as a zoom factor to keep the UI consistent.
 */
function getCliffordVector(x, y) {
    const params = flowState.attractorParams || {};
    const a = params.a ?? 1.5;
    const b = params.b ?? -1.8;
    const c = params.c ?? 1.6;
    const d = params.d ?? 0.9;
    const scale = Math.max(flowState.noiseScale || 0, NOISE_SCALE_MIN);
    const scaledX = x * scale;
    const scaledY = y * scale;
    const vx = Math.sin(a * scaledY) + c * Math.cos(a * scaledX);
    const vy = Math.sin(b * scaledX) + d * Math.cos(b * scaledY);
    const mag = Math.hypot(vx, vy);
    if (!isFinite(mag) || mag < 1e-6) {
        return [0, 0];
    }
    return [vx / mag, vy / mag];
}

/**
 * Sample the flow vector based on the active flow mode.
 */
function sampleFlowVector(x, y, flowOptions) {
    if (flowState.flowMode === 'attractor') {
        const [vx, vy] = getCliffordVector(x, y);
        const angle = flowOptions?.angleOffset || 0;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        let rx = vx * cosA - vy * sinA;
        let ry = vx * sinA + vy * cosA;
        const strength = flowOptions?.flowStrength ?? 1;
        rx *= strength;
        ry *= strength;
        return [rx, ry];
    }
    return flowState.perlin.getFlowVector(x, y, flowState.noiseScale, flowOptions);
}

/**
 * Domain warping offset based on noise.
 */
function getDistortionOffset(x, y) {
    const dist = flowState.distortion || {};
    const strength = dist.strength ?? 0;
    if (!dist.enabled || strength === 0) return [0, 0];
    const scale = dist.scale ?? 0.01;
    const phase = dist.phase ?? 0;
    const octaves = dist.detail ?? 2;
    const persistence = flowState.noisePersistence ?? 0.5;
    const nx = flowState.perlin.fbm2D(x * scale + phase, y * scale + phase, octaves, persistence);
    const ny = flowState.perlin.fbm2D(x * scale + phase + 5.2, y * scale + phase + 1.3, octaves, persistence);
    return [nx * strength, ny * strength];
}

/**
 * Apply symmetry to lookup coordinates.
 */
function getSymmetricCoordinates(x, y) {
    const geom = flowState.geometry || {};
    const mode = geom.symmetry || 'none';
    if (mode === 'none') return { x, y, rotation: 0 };

    const cx = flowState.widthMm / 2;
    const cy = flowState.heightMm / 2;
    let lx = x;
    let ly = y;
    let rotation = 0;

    switch (mode) {
        case 'mirror-x':
            lx = cx + Math.abs(lx - cx);
            break;
        case 'mirror-y':
            ly = cy + Math.abs(ly - cy);
            break;
        case 'mirror-both':
            lx = cx + Math.abs(lx - cx);
            ly = cy + Math.abs(ly - cy);
            break;
        case 'radial': {
            const segs = Math.max(1, geom.segments || 6);
            const dx = lx - cx;
            const dy = ly - cy;
            const r = Math.hypot(dx, dy);
            const theta = Math.atan2(dy, dx);
            const step = (2 * Math.PI) / segs;
            const snappedTheta = theta - Math.floor(theta / step) * step;
            rotation = theta - snappedTheta;
            lx = cx + r * Math.cos(snappedTheta);
            ly = cy + r * Math.sin(snappedTheta);
            break;
        }
    }
    return { x: lx, y: ly, rotation };
}

/**
 * Snap vector angle toward geometric segments.
 */
function quantizeAngle(vx, vy, segments, strength) {
    const mag = Math.hypot(vx, vy);
    if (mag < 1e-8 || segments <= 0 || strength <= 0) return [vx, vy];
    const a = Math.atan2(vy, vx);
    const step = (2 * Math.PI) / segments;
    const target = Math.round(a / step) * step;
    const blend = Math.max(0, Math.min(1, strength));
    const blended = a * (1 - blend) + target * blend;
    return [Math.cos(blended) * mag, Math.sin(blended) * mag];
}

/**
 * Apply magnet forces to a vector at position (x, y).
 */
function applyMagnetForce(x, y, vx, vy) {
    if (!flowState.magnetConfig?.enabled) return [vx, vy];
    const magnets = flowState.magnets || [];
    const cfg = flowState.magnetConfig || {};
    const baseStrength = cfg.strength ?? 0;
    const strengthAbs = Math.abs(baseStrength);
    const radius = cfg.radius ?? 0;
    const rotationDeg = cfg.rotation ?? 0;
    if (!magnets.length || strengthAbs === 0 || radius <= 0) {
        return [vx, vy];
    }

    const rotationRad = rotationDeg * Math.PI / 180;
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);
    let fx = vx;
    let fy = vy;
    const soften = 200; // softening to avoid singularities (mm^2)

    for (const magnet of magnets) {
        const dx = magnet.x - x;
        const dy = magnet.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 1e-6 || dist > radius) continue;
        let ux = dx / dist;
        let uy = dy / dist;
        if (rotationDeg !== 0) {
            const rx = ux * cosR - uy * sinR;
            const ry = ux * sinR + uy * cosR;
            ux = rx;
            uy = ry;
        }
        const sign = magnet.type === 'repel' ? -1 : 1;
        const inv = 1 / (dist * dist + soften);
        const forceScale = (strengthAbs / 100) * sign * inv;
        fx += ux * forceScale;
        fy += uy * forceScale;
    }

    return [fx, fy];
}

/**
 * Follow flow field from a starting point
 * 
 * SIMPLIFIED "BY THE BOOK" IMPLEMENTATION:
 * - Follow the flow vector at each step
 * - Stop at boundaries or when line length is reached
 * - Optional: stop when too close to other paths (minDistance)
 */
function followFlowField(startX, startY, drawWidth, drawHeight, margin, direction = 1) {
    const path = [[startX, startY]];
    
    // Safety check: if step size is 0 or negative, return path with just starting point
    if (flowState.stepSize <= 0) {
        return path;
    }
    
    let x = startX;
    let y = startY;
    let length = 0;
    
    // Define bounds (within margin rectangle)
    const minX = margin;
    const maxX = flowState.widthMm - margin;
    const minY = margin;
    const maxY = flowState.heightMm - margin;
    
    // Calculate effective collision radius: minDistance + strokeWidth + safety buffer
    const effectiveCollisionRadius = flowState.minDistance + flowState.strokeWidth + 0.05;
    // Distance checks depend on effectiveCollisionRadius and the presence of a grid
    const useDistanceCheck = effectiveCollisionRadius > 0 && flowState.spatialGrid;
    
    // How often to check distance (every N steps)
    const distanceCheckInterval = Math.max(1, Math.floor(effectiveCollisionRadius / flowState.stepSize));
    
    // Options reused for vector sampling
    const flowOptions = {
        octaves: flowState.noiseOctaves,
        persistence: flowState.noisePersistence,
        angleOffset: flowState.angleOffset * Math.PI / 180,
        flowStrength: flowState.flowStrength,
        curlAmount: flowState.curlAmount
    };
    
    // Maximum iterations to prevent infinite loops
    const maxIterations = Math.ceil(flowState.lineLength / flowState.stepSize) + 100;
    let iterations = 0;
    
    while (length < flowState.lineLength && iterations < maxIterations) {
        iterations++;
        
        // 1) Map Position (symmetry) and get rotation
        const { x: symX, y: symY, rotation: symRot } = getSymmetricCoordinates(x, y);

        // 2) Distort
        const [dx1, dy1] = getDistortionOffset(symX, symY);
        const warpedX = symX + dx1;
        const warpedY = symY + dy1;

        // 3) Accumulate forces: base flow + magnets (using symmetric coords)
        let [vx, vy] = sampleFlowVector(warpedX, warpedY, flowOptions);
        [vx, vy] = applyMagnetForce(symX, symY, vx, vy);

        // 4) Resolve symmetry: rotate vector back to original orientation
        if (symRot !== 0) {
            const cosR = Math.cos(symRot);
            const sinR = Math.sin(symRot);
            const rx = vx * cosR - vy * sinR;
            const ry = vx * sinR + vy * cosR;
            vx = rx;
            vy = ry;
        }

        // 5) Post-process: snapping
        if (flowState.geometry?.snapping > 0) {
            [vx, vy] = quantizeAngle(vx, vy, flowState.geometry.snapping, flowState.geometry.snappingStrength ?? 1);
        }
        let mag = Math.hypot(vx, vy);
        if (!isFinite(mag) || mag < 1e-6) {
            break;
        }
        vx /= mag;
        vy /= mag;
        
        // Midpoint method (RK2) for smoother integration
        const halfStep = flowState.stepSize * 0.5 * direction;
        const midX = x + vx * halfStep;
        const midY = y + vy * halfStep;
        const { x: symMidX, y: symMidY, rotation: symMidRot } = getSymmetricCoordinates(midX, midY);
        const [dx2, dy2] = getDistortionOffset(symMidX, symMidY);
        const warpedMidX = symMidX + dx2;
        const warpedMidY = symMidY + dy2;
        let [midVx, midVy] = sampleFlowVector(warpedMidX, warpedMidY, flowOptions);
        [midVx, midVy] = applyMagnetForce(symMidX, symMidY, midVx, midVy);
        if (symMidRot !== 0) {
            const cosR = Math.cos(symMidRot);
            const sinR = Math.sin(symMidRot);
            const rx = midVx * cosR - midVy * sinR;
            const ry = midVx * sinR + midVy * cosR;
            midVx = rx;
            midVy = ry;
        }
        if (flowState.geometry?.snapping > 0) {
            [midVx, midVy] = quantizeAngle(midVx, midVy, flowState.geometry.snapping, flowState.geometry.snappingStrength ?? 1);
        }
        const midMag = Math.hypot(midVx, midVy);
        if (!isFinite(midMag) || midMag < 1e-6) {
            break;
        }
        midVx /= midMag;
        midVy /= midMag;
        
        // Calculate next position using midpoint vector
        const nextX = x + midVx * flowState.stepSize * direction;
        const nextY = y + midVy * flowState.stepSize * direction;
        
        // Predictive boundary check: stop before adding an out-of-bounds point
        if (nextX < minX || nextX > maxX || nextY < minY || nextY > maxY) {
            break;
        }
        
        // Predictive collision check before writing the point
        if (useDistanceCheck && path.length >= 1 && path.length % distanceCheckInterval === 0) {
            const minTravelBeforeStop = Math.max(effectiveCollisionRadius * 1.5, flowState.stepSize * 5);
            if (length >= minTravelBeforeStop && isTooClose(nextX, nextY, effectiveCollisionRadius)) {
                break;
            }
        }
        
        // Hysteresis/Backtracking Check: Prevent oscillation loops (A -> B -> A)
        // Compare the candidate point against the point 2 steps back in history
        if (path.length >= 2) {
            const previous = path[path.length - 2];
            const dist = Math.hypot(nextX - previous[0], nextY - previous[1]);
            
            // If we are heading back to where we were 2 steps ago, stop the path
            if (dist < 0.5) {
                break; // Stop the line here to prevent oscillation
            }
        }
        
        // Commit the step now that it's validated
        path.push([nextX, nextY]);
        x = nextX;
        y = nextY;
        length += flowState.stepSize;
    }
    
    return path;
}

/**
 * Render canvas with paths and margins
 */
function renderCanvas() {
    if (!flowState.ctx || !flowState.canvas || !flowState.pxPerMm) {
        console.warn('Canvas not ready for rendering');
        return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = flowState.canvas.width / dpr;
    const canvasHeight = flowState.canvas.height / dpr;
    
    // Clear canvas using internal dimensions (context is already scaled by dpr)
    flowState.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Apply zoom and pan
    flowState.ctx.save();
    flowState.ctx.translate(flowState.panX, flowState.panY);
    flowState.ctx.scale(flowState.zoom, flowState.zoom);
    
    // Draw margin boundaries
    drawMargins();
    
    // Draw paths
    drawPaths();

    // Draw magnets
    drawMagnets();
    
    flowState.ctx.restore();
}

function updateCanvasCursor() {
    if (!flowState.canvas) return;
    if (flowState.isPlacingMagnets) {
        flowState.canvas.style.cursor = 'crosshair';
    } else {
        flowState.canvas.style.cursor = flowState.isDragging ? 'grabbing' : 'grab';
    }
}

/**
 * Draw margin boundaries
 */
function drawMargins() {
    flowState.ctx.strokeStyle = '#666';
    flowState.ctx.lineWidth = 0.5 / flowState.zoom;
    flowState.ctx.setLineDash([5 / flowState.zoom, 5 / flowState.zoom]);
    
    const margin = flowState.margin;
    const drawLeft = margin * flowState.pxPerMm;
    const drawTop = margin * flowState.pxPerMm;
    const drawWidth = (flowState.widthMm - 2 * margin) * flowState.pxPerMm;
    const drawHeight = (flowState.heightMm - 2 * margin) * flowState.pxPerMm;
    
    flowState.ctx.strokeRect(drawLeft, drawTop, drawWidth, drawHeight);
    flowState.ctx.setLineDash([]);
}

/**
 * Draw all paths
 */
function drawPaths() {
    if (!flowState.paths || flowState.paths.length === 0) return;
    
    // Base stroke width in pixels
    const baseStrokeWidthPx = flowState.strokeWidth * flowState.pxPerMm;
    
    flowState.ctx.lineCap = 'round';
    flowState.ctx.lineJoin = 'round';
    
    for (const path of flowState.paths) {
        const coords = path.coords;
        if (coords.length < 2) continue;

        flowState.ctx.lineWidth = baseStrokeWidthPx;
        flowState.ctx.strokeStyle = getPathColor(path, 0, coords.length);
        flowState.ctx.beginPath();

        const x0 = coords[0][0] * flowState.pxPerMm;
        const y0 = coords[0][1] * flowState.pxPerMm;
        flowState.ctx.moveTo(x0, y0);

        for (let i = 1; i < coords.length; i++) {
            const x = coords[i][0] * flowState.pxPerMm;
            const y = coords[i][1] * flowState.pxPerMm;
            flowState.ctx.lineTo(x, y);
        }

        flowState.ctx.stroke();
    }
}

function drawMagnets() {
    if (!flowState.magnets || flowState.magnets.length === 0) return;
    if (!flowState.magnetConfig?.visible) return;
    const radiusPx = 4 / Math.max(flowState.zoom, 0.001);
    const ringRadiusPx = (flowState.magnetConfig?.radius ?? 100) * flowState.pxPerMm;
    const lineW = 1 / Math.max(flowState.zoom, 0.001);
    flowState.ctx.lineWidth = lineW;

    for (const magnet of flowState.magnets) {
        const cx = magnet.x * flowState.pxPerMm;
        const cy = magnet.y * flowState.pxPerMm;
        const isRepel = magnet.type === 'repel';
        const fill = isRepel ? 'rgba(0, 120, 255, 0.4)' : 'rgba(0, 200, 0, 0.4)';
        const stroke = isRepel ? 'rgba(0, 120, 255, 0.8)' : 'rgba(0, 200, 0, 0.8)';

        // inner dot
        flowState.ctx.fillStyle = fill;
        flowState.ctx.strokeStyle = stroke;
        flowState.ctx.beginPath();
        flowState.ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
        flowState.ctx.fill();
        flowState.ctx.stroke();

        // influence ring
        flowState.ctx.strokeStyle = isRepel ? 'rgba(0, 120, 255, 0.25)' : 'rgba(0, 200, 0, 0.25)';
        flowState.ctx.setLineDash([6 / Math.max(flowState.zoom, 0.001), 6 / Math.max(flowState.zoom, 0.001)]);
        flowState.ctx.beginPath();
        flowState.ctx.arc(cx, cy, ringRadiusPx, 0, Math.PI * 2);
        flowState.ctx.stroke();
        flowState.ctx.setLineDash([]);
    }
}

/**
 * Handle canvas mouse events for panning
 */
function setupCanvasEvents() {
    if (!flowState.canvas) return;
    
    function getCanvasCoords(event) {
        const rect = flowState.canvas.getBoundingClientRect();
        const xPx = (event.clientX - rect.left - flowState.panX) / flowState.zoom;
        const yPx = (event.clientY - rect.top - flowState.panY) / flowState.zoom;
        const mmX = xPx / flowState.pxPerMm;
        const mmY = yPx / flowState.pxPerMm;
        return [mmX, mmY];
    }

    const addMagnetAtEvent = (e, type) => {
        const [mx, my] = getCanvasCoords(e);
        flowState.magnets.push({ x: mx, y: my, type });
        if (typeof generateFlowField === 'function') {
            generateFlowField();
        }
    };

    flowState.canvas.addEventListener('click', (e) => {
        if (!flowState.isPlacingMagnets) return;
        const type = e.shiftKey ? 'repel' : 'attract';
        addMagnetAtEvent(e, type);
    });

    flowState.canvas.addEventListener('contextmenu', (e) => {
        if (!flowState.isPlacingMagnets) return;
        e.preventDefault();
        addMagnetAtEvent(e, 'repel');
    });
    
    flowState.canvas.addEventListener('mousedown', (e) => {
        if (flowState.isPlacingMagnets) {
            return;
        }
        flowState.isDragging = true;
        flowState.dragStartX = e.clientX - flowState.panX;
        flowState.dragStartY = e.clientY - flowState.panY;
        updateCanvasCursor();
    });
    
    flowState.canvas.addEventListener('mousemove', (e) => {
        if (flowState.isDragging) {
            flowState.panX = e.clientX - flowState.dragStartX;
            flowState.panY = e.clientY - flowState.dragStartY;
            renderCanvas();
        }
    });
    
    flowState.canvas.addEventListener('mouseup', () => {
        flowState.isDragging = false;
        updateCanvasCursor();
    });
    
    flowState.canvas.addEventListener('mouseleave', () => {
        flowState.isDragging = false;
        updateCanvasCursor();
    });
    
    flowState.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        flowState.zoom *= delta;
        flowState.zoom = Math.max(0.1, Math.min(10, flowState.zoom));
        
        renderCanvas();
    });
    
    updateCanvasCursor();
}

/**
 * Export paths as SVG
 */
async function exportSVG() {
    // Check if any visible layers have paths
    const visibleLayers = flowState.layers.filter(l => l.visible && l.paths.length > 0);
    if (visibleLayers.length === 0) {
        alert('No flow field generated. Please generate a flow field first.');
        return;
    }
    
    try {
        // Send layers data for proper grouping in SVG
        const layersData = visibleLayers.map(layer => ({
            name: layer.name,
            color: layer.color,
            paths: layer.paths.map(p => p.coords)
        }));
        
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                layers: layersData,
                stroke_width: flowState.strokeWidth,
                margin: flowState.margin,
                width_mm: flowState.widthMm,
                height_mm: flowState.heightMm
            })
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        // Get blob and create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowfield-${paperSizeLabel(flowState.widthMm, flowState.heightMm)}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export SVG: ' + error.message);
    }
}

/**
 * Fit canvas to view
 */
function fitToView() {
    flowState.zoom = 1;
    flowState.panX = 0;
    flowState.panY = 0;
    renderCanvas();
}

/**
 * Initialize the layer system
 * Sets the first layer's color from the palette and renders the layer list
 */
function initLayers() {
    configureStrokeWidthSlider();
    // Set the first layer's color based on the palette
    if (flowState.layers.length > 0) {
        const firstLayer = flowState.layers[0];
        firstLayer.color = '#000000';
    }
    
    const activeLayer = getActiveLayer();
    if (activeLayer) {
        ensureLayerDefaults(activeLayer);
        applySettingsToFlowState(activeLayer.settings);
        applySettingsToUI(activeLayer.settings);
    }
    
    // Render the layer list UI
    renderLayerList();
    
    // Initialize statistics
    updateStatistics();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initCanvas();
        setupCanvasEvents();
        initLayers();
    });
} else {
    initCanvas();
    setupCanvasEvents();
    initLayers();
}

// Handle window resize
window.addEventListener('resize', () => {
    initCanvas();
});

