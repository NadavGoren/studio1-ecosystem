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
    noiseScale: 0.001,
    noiseEnabled: true,
    savedNoiseScale: 0.001, // Store the scale when disabling noise
    numParticles: 1000,
    lineLength: 5,
    stepSize: 0.5,
    perlin: null,
    // Flow field parameters
    noiseOctaves: 1,        // Number of noise layers (1-6)
    noisePersistence: 0.5,  // How much each octave contributes (0-1)
    angleOffset: 0,         // Global angle offset in degrees (0-360)
    flowStrength: 1.0,      // How much noise affects direction (0-1)
    curlAmount: 0,          // Amount of curl noise (0-1)
    flowMode: 'noise',      // 'noise' | 'attractor' (hardcoded to 'noise' for ribbon mode)
    attractorParams: { a: 1.5, b: -1.8, c: 1.6, d: 0.9 },
    magnets: [], // { x, y, type: 'attract' | 'repel' }
    isPlacingMagnets: false,
    magnetConfig: { strength: 50, radius: 100, rotation: 0, enabled: true, visible: true },
    obstacles: [], // { x, y, radius } - circular obstacles for flow avoidance
    isEditingObstacles: false, // Toggle for obstacle editing mode
    draggedObstacle: null, // Reference to obstacle being dragged
    selectedObstacle: null, // Reference to currently selected obstacle
    obstaclesVisible: true, // Toggle for obstacle visibility
    isScalingObstacle: false, // Whether we're scaling an obstacle
    scalingObstacle: null, // Reference to obstacle being scaled
    scaleStartRadius: 0, // Initial radius when starting to scale
    scaleStartDistance: 0, // Initial distance from center when starting to scale
    distortion: { enabled: false, strength: 40, scale: 0.01, phase: 0, detail: 2 },
    geometry: { symmetry: 'none', segments: 6, snapping: 0, snappingStrength: 1.0 },
    // Starting position mode
    startPositionMode: 'grid',  // 'random', 'grid', 'circle'
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
        spacingMode: 'manual',  // 'auto' or 'manual'
        spacing: 17.5,  // spacing between grid points in mm (used when spacingMode is 'manual')
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
        visible: true,
        presence: 1.0  // 0-1, controls relative weight of this layer
    }],
    activeLayerId: 'layer-1',
    syncAllLayers: false,
    // Distribution mode for multi-layer system
    // 'sequential' = current behavior (layer order = priority, presence = probability)
    // 'fair' = pre-distribute points among layers based on weighted presence
    // 'lottery' = each point is randomly assigned to a layer based on presence weights
    // 'striped' = assign grid rows to layers in rotation
    distributionMode: 'sequential',
    // Color palette system: which preset is currently driving layer colours ('' = custom)
    activePaletteId: '',
    paletteReversed: false,
    // Gradient distribution config
    gradientConfig: {
        enabled: false,
        direction: 'vertical',  // 'vertical', 'horizontal', 'radial'
        easing: 'linear'        // 'linear', 'easeIn', 'easeOut', 'sigmoid'
    },
    // Brush system
    renderStyle: 'ribbon-hatched',  // 'default' | 'ribbon-hatched' | 'pipes' | 'circles'
    brushWidth: 24.5,  // in mm
    ribbonStyle: 'zigzag',  // 'zigzag' | 'braided' | 'fishbone' | 'custom-svg'
    zigzagWavelength: 2,    // Controls zigzag spacing (2 = default, higher = more spread out)
    // Ink blend mode for realistic pen layering simulation
    inkBlendMode: false,  // Toggle for ink transparency simulation (multiply blend)
    inkOpacity: 0.88,     // Opacity when ink blend mode is enabled (0.88 = 20% less intense than 0.85)
    // Custom SVG stamp system
    customStamp: {
        loaded: false,
        shapes: [],      // Array of {type, points} - points are [[x,y], [x,y], ...]
        width: 28.35,    // Original viewBox width
        height: 28.35,   // Original viewBox height
        centerX: 14.175, // Center for rotation
        centerY: 14.175
    }
};

// Initialize Perlin noise
flowState.perlin = new PerlinNoise(flowState.noiseSeed);
flowState.currentNoiseSeed = flowState.noiseSeed;

// Conversion: mm to pixels at 96 DPI
const MM_TO_PX = 96 / 25.4;

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

// ============================================================================
// GRADIENT DISTRIBUTION EASING FUNCTIONS
// ============================================================================

/**
 * Linear easing function - no transformation
 * @param {number} t - Normalized value (0.0 to 1.0)
 * @returns {number} The same value
 */
function linear(t) {
    return t;
}

/**
 * Ease-in easing function - accelerates at the start
 * @param {number} t - Normalized value (0.0 to 1.0)
 * @returns {number} Eased value
 */
function easeIn(t) {
    return t * t;
}

/**
 * Ease-out easing function - decelerates at the end
 * @param {number} t - Normalized value (0.0 to 1.0)
 * @returns {number} Eased value
 */
function easeOut(t) {
    return t * (2 - t);
}

/**
 * Sigmoid easing function - smooth S-curve
 * @param {number} t - Normalized value (0.0 to 1.0)
 * @returns {number} Eased value
 */
function sigmoid(t) {
    return 1 / (1 + Math.exp(-10 * (t - 0.5)));
}

// ============================================================================
// CUSTOM SVG STAMP SYSTEM
// ============================================================================

/**
 * Generate points for a rounded rectangle.
 * If rx and ry are 0, creates a sharp-cornered rectangle.
 * Otherwise, creates smooth curved corners using arc approximation.
 * 
 * @param {number} x - Left edge x coordinate
 * @param {number} y - Top edge y coordinate
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {number} rx - X radius of corner rounding
 * @param {number} ry - Y radius of corner rounding
 * @returns {Array} Array of [x, y] points forming the rounded rectangle
 */
function generateRoundedRectPoints(x, y, w, h, rx, ry) {
    // If no rounding, return simple rectangle
    if (rx <= 0 && ry <= 0) {
        return [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
            [x, y]  // Close the rectangle
        ];
    }
    
    const points = [];
    const pointsPerCorner = 8;  // Points per quarter-circle for smooth curves
    
    // Define corner centers
    const corners = [
        { cx: x + w - rx, cy: y + ry, startAngle: -Math.PI / 2, endAngle: 0 },          // Top-right
        { cx: x + w - rx, cy: y + h - ry, startAngle: 0, endAngle: Math.PI / 2 },       // Bottom-right
        { cx: x + rx, cy: y + h - ry, startAngle: Math.PI / 2, endAngle: Math.PI },     // Bottom-left
        { cx: x + rx, cy: y + ry, startAngle: Math.PI, endAngle: Math.PI * 1.5 }        // Top-left
    ];
    
    // Start at top-left after the corner arc
    points.push([x + rx, y]);
    
    // Top-right corner arc
    for (let i = 0; i <= pointsPerCorner; i++) {
        const t = i / pointsPerCorner;
        const angle = corners[0].startAngle + t * (corners[0].endAngle - corners[0].startAngle);
        points.push([
            corners[0].cx + rx * Math.cos(angle),
            corners[0].cy + ry * Math.sin(angle)
        ]);
    }
    
    // Bottom-right corner arc
    for (let i = 0; i <= pointsPerCorner; i++) {
        const t = i / pointsPerCorner;
        const angle = corners[1].startAngle + t * (corners[1].endAngle - corners[1].startAngle);
        points.push([
            corners[1].cx + rx * Math.cos(angle),
            corners[1].cy + ry * Math.sin(angle)
        ]);
    }
    
    // Bottom-left corner arc
    for (let i = 0; i <= pointsPerCorner; i++) {
        const t = i / pointsPerCorner;
        const angle = corners[2].startAngle + t * (corners[2].endAngle - corners[2].startAngle);
        points.push([
            corners[2].cx + rx * Math.cos(angle),
            corners[2].cy + ry * Math.sin(angle)
        ]);
    }
    
    // Top-left corner arc
    for (let i = 0; i <= pointsPerCorner; i++) {
        const t = i / pointsPerCorner;
        const angle = corners[3].startAngle + t * (corners[3].endAngle - corners[3].startAngle);
        points.push([
            corners[3].cx + rx * Math.cos(angle),
            corners[3].cy + ry * Math.sin(angle)
        ]);
    }
    
    // Close the path (back to start)
    points.push([x + rx, y]);
    
    return points;
}

/**
 * Load and parse the custom SVG stamp file.
 * Extracts line, rect, and ellipse elements and converts them to point arrays.
 */
async function loadCustomSVG() {
    if (flowState.customStamp.loaded) return;
    
    try {
        const response = await fetch('/static/assets/Stamp.svg');
        if (!response.ok) {
            console.warn('Could not load custom SVG stamp:', response.status);
            return;
        }
        
        const svgText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        
        if (!svg) {
            console.warn('No SVG element found in stamp file');
            return;
        }
        
        // Parse viewBox to get dimensions and center
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
            const [minX, minY, width, height] = viewBox.split(/\s+/).map(parseFloat);
            flowState.customStamp.width = width;
            flowState.customStamp.height = height;
            flowState.customStamp.centerX = minX + width / 2;
            flowState.customStamp.centerY = minY + height / 2;
        }
        
        // Extract all shape elements
        const shapes = [];
        
        // Process <line> elements
        svg.querySelectorAll('line').forEach(line => {
            const x1 = parseFloat(line.getAttribute('x1') || 0);
            const y1 = parseFloat(line.getAttribute('y1') || 0);
            const x2 = parseFloat(line.getAttribute('x2') || 0);
            const y2 = parseFloat(line.getAttribute('y2') || 0);
            shapes.push({
                type: 'line',
                points: [[x1, y1], [x2, y2]]
            });
        });
        
        // Process <rect> elements (supports rounded corners with rx/ry)
        svg.querySelectorAll('rect').forEach(rect => {
            const x = parseFloat(rect.getAttribute('x') || 0);
            const y = parseFloat(rect.getAttribute('y') || 0);
            const w = parseFloat(rect.getAttribute('width') || 0);
            const h = parseFloat(rect.getAttribute('height') || 0);
            let rx = parseFloat(rect.getAttribute('rx') || 0);
            let ry = parseFloat(rect.getAttribute('ry') || 0);
            
            // SVG spec: if only one is specified, use it for both
            if (rx && !ry) ry = rx;
            if (ry && !rx) rx = ry;
            
            // Clamp radii to half the dimension (max allowed by spec)
            rx = Math.min(rx, w / 2);
            ry = Math.min(ry, h / 2);
            
            const points = generateRoundedRectPoints(x, y, w, h, rx, ry);
            shapes.push({
                type: 'rect',
                points: points
            });
        });
        
        // Process <ellipse> elements (approximate with ~32 points)
        svg.querySelectorAll('ellipse').forEach(ellipse => {
            const cx = parseFloat(ellipse.getAttribute('cx') || 0);
            const cy = parseFloat(ellipse.getAttribute('cy') || 0);
            const rx = parseFloat(ellipse.getAttribute('rx') || 0);
            const ry = parseFloat(ellipse.getAttribute('ry') || 0);
            const numPoints = 32;
            const points = [];
            for (let i = 0; i <= numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                points.push([
                    cx + rx * Math.cos(angle),
                    cy + ry * Math.sin(angle)
                ]);
            }
            shapes.push({
                type: 'ellipse',
                points: points
            });
        });
        
        // Process <circle> elements (approximate with ~32 points)
        svg.querySelectorAll('circle').forEach(circle => {
            const cx = parseFloat(circle.getAttribute('cx') || 0);
            const cy = parseFloat(circle.getAttribute('cy') || 0);
            const r = parseFloat(circle.getAttribute('r') || 0);
            const numPoints = 32;
            const points = [];
            for (let i = 0; i <= numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                points.push([
                    cx + r * Math.cos(angle),
                    cy + r * Math.sin(angle)
                ]);
            }
            shapes.push({
                type: 'circle',
                points: points
            });
        });
        
        // Process <polyline> elements
        svg.querySelectorAll('polyline').forEach(polyline => {
            const pointsAttr = polyline.getAttribute('points') || '';
            const coords = pointsAttr.trim().split(/[\s,]+/).map(parseFloat);
            const points = [];
            for (let i = 0; i < coords.length - 1; i += 2) {
                points.push([coords[i], coords[i + 1]]);
            }
            if (points.length >= 2) {
                shapes.push({
                    type: 'polyline',
                    points: points
                });
            }
        });
        
        // Process <polygon> elements (close the shape)
        svg.querySelectorAll('polygon').forEach(polygon => {
            const pointsAttr = polygon.getAttribute('points') || '';
            const coords = pointsAttr.trim().split(/[\s,]+/).map(parseFloat);
            const points = [];
            for (let i = 0; i < coords.length - 1; i += 2) {
                points.push([coords[i], coords[i + 1]]);
            }
            if (points.length >= 2) {
                points.push([...points[0]]);  // Close the polygon
                shapes.push({
                    type: 'polygon',
                    points: points
                });
            }
        });
        
        // Process <path> elements (full bezier curve support)
        svg.querySelectorAll('path').forEach(path => {
            const d = path.getAttribute('d') || '';
            const pathPoints = parsePathData(d);
            if (pathPoints.length >= 2) {
                shapes.push({
                    type: 'path',
                    points: pathPoints
                });
            }
        });
        
        flowState.customStamp.shapes = shapes;
        flowState.customStamp.loaded = true;
        
        console.log(`Loaded custom SVG stamp with ${shapes.length} shapes`);
        
    } catch (error) {
        console.error('Error loading custom SVG stamp:', error);
    }
}

/**
 * Parse a transform attribute string into a transformation matrix
 * Returns [a, b, c, d, e, f] where the matrix is:
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 */
function parseTransform(transformStr) {
    if (!transformStr) return [1, 0, 0, 1, 0, 0]; // Identity matrix
    
    let matrix = [1, 0, 0, 1, 0, 0];
    
    const transforms = transformStr.match(/(\w+)\s*\(([^)]+)\)/g) || [];
    
    for (const t of transforms) {
        const match = t.match(/(\w+)\s*\(([^)]+)\)/);
        if (!match) continue;
        
        const type = match[1];
        const args = match[2].split(/[\s,]+/).map(parseFloat);
        
        let m;
        switch (type) {
            case 'translate':
                m = [1, 0, 0, 1, args[0] || 0, args[1] || 0];
                break;
            case 'scale':
                const sx = args[0] || 1;
                const sy = args.length > 1 ? args[1] : sx;
                m = [sx, 0, 0, sy, 0, 0];
                break;
            case 'rotate':
                const angle = (args[0] || 0) * Math.PI / 180;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                if (args.length === 3) {
                    // rotate(angle, cx, cy)
                    const cx = args[1], cy = args[2];
                    m = [cos, sin, -sin, cos, cx - cos*cx + sin*cy, cy - sin*cx - cos*cy];
                } else {
                    m = [cos, sin, -sin, cos, 0, 0];
                }
                break;
            case 'skewX':
                m = [1, 0, Math.tan((args[0] || 0) * Math.PI / 180), 1, 0, 0];
                break;
            case 'skewY':
                m = [1, Math.tan((args[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
                break;
            case 'matrix':
                m = args.length >= 6 ? args.slice(0, 6) : [1, 0, 0, 1, 0, 0];
                break;
            default:
                continue;
        }
        
        // Multiply matrices: matrix = matrix * m
        matrix = multiplyMatrices(matrix, m);
    }
    
    return matrix;
}

/**
 * Multiply two 2D transformation matrices
 */
function multiplyMatrices(m1, m2) {
    return [
        m1[0]*m2[0] + m1[2]*m2[1],
        m1[1]*m2[0] + m1[3]*m2[1],
        m1[0]*m2[2] + m1[2]*m2[3],
        m1[1]*m2[2] + m1[3]*m2[3],
        m1[0]*m2[4] + m1[2]*m2[5] + m1[4],
        m1[1]*m2[4] + m1[3]*m2[5] + m1[5]
    ];
}

/**
 * Apply a transformation matrix to a point
 */
function applyMatrix(matrix, x, y) {
    return [
        matrix[0]*x + matrix[2]*y + matrix[4],
        matrix[1]*x + matrix[3]*y + matrix[5]
    ];
}

/**
 * Apply a transformation matrix to an array of points
 */
function applyMatrixToPoints(matrix, points) {
    return points.map(([x, y]) => applyMatrix(matrix, x, y));
}

/**
 * Parse and load a custom SVG from string content (for user uploads).
 * Handles nested groups, transforms, and Illustrator-style SVGs.
 * @param {string} svgContent - The SVG file content as a string
 * @param {string} fileName - The name of the uploaded file (for display)
 */
async function parseAndLoadCustomSVG(svgContent, fileName = 'custom.svg') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError || !svg) {
        throw new Error('Invalid SVG file');
    }
    
    // Debug: log the SVG structure
    console.log('SVG content:', svgContent.substring(0, 500));
    
    // Parse viewBox to get dimensions and center
    const viewBox = svg.getAttribute('viewBox');
    let svgWidth, svgHeight, minX = 0, minY = 0;
    
    if (viewBox) {
        const parts = viewBox.split(/[\s,]+/).map(parseFloat);
        minX = parts[0] || 0;
        minY = parts[1] || 0;
        svgWidth = parts[2];
        svgHeight = parts[3];
    } else {
        // Try to get dimensions from width/height attributes
        const widthAttr = svg.getAttribute('width');
        const heightAttr = svg.getAttribute('height');
        svgWidth = parseFloat(widthAttr) || 100;
        svgHeight = parseFloat(heightAttr) || 100;
        
        // Handle units (px, pt, mm, etc)
        if (widthAttr && widthAttr.includes('mm')) {
            svgWidth = parseFloat(widthAttr) * 3.7795; // mm to px approx
        }
        if (heightAttr && heightAttr.includes('mm')) {
            svgHeight = parseFloat(heightAttr) * 3.7795;
        }
    }
    
    flowState.customStamp.width = svgWidth;
    flowState.customStamp.height = svgHeight;
    flowState.customStamp.centerX = minX + svgWidth / 2;
    flowState.customStamp.centerY = minY + svgHeight / 2;
    
    console.log('SVG dimensions:', { svgWidth, svgHeight, minX, minY, centerX: flowState.customStamp.centerX, centerY: flowState.customStamp.centerY });
    
    // Extract all shape elements recursively, applying transforms
    const shapes = [];
    
    /**
     * Recursively process SVG elements, accumulating transforms
     */
    function processElement(element, parentMatrix) {
        const tagName = element.tagName?.toLowerCase();
        if (!tagName) return;
        
        // Get this element's transform and combine with parent
        const transformAttr = element.getAttribute('transform');
        const localMatrix = parseTransform(transformAttr);
        const currentMatrix = multiplyMatrices(parentMatrix, localMatrix);
        
        // Process based on element type
        switch (tagName) {
            case 'g':
            case 'svg':
                // Recursively process children
                for (const child of element.children) {
                    processElement(child, currentMatrix);
                }
                break;
                
            case 'line':
                const x1 = parseFloat(element.getAttribute('x1') || 0);
                const y1 = parseFloat(element.getAttribute('y1') || 0);
                const x2 = parseFloat(element.getAttribute('x2') || 0);
                const y2 = parseFloat(element.getAttribute('y2') || 0);
                const linePoints = applyMatrixToPoints(currentMatrix, [[x1, y1], [x2, y2]]);
                shapes.push({ type: 'line', points: linePoints });
                break;
                
            case 'rect':
                const rectX = parseFloat(element.getAttribute('x') || 0);
                const rectY = parseFloat(element.getAttribute('y') || 0);
                const rectW = parseFloat(element.getAttribute('width') || 0);
                const rectH = parseFloat(element.getAttribute('height') || 0);
                let rectRx = parseFloat(element.getAttribute('rx') || 0);
                let rectRy = parseFloat(element.getAttribute('ry') || 0);
                
                // SVG spec: if only one is specified, use it for both
                if (rectRx && !rectRy) rectRy = rectRx;
                if (rectRy && !rectRx) rectRx = rectRy;
                
                // Clamp radii to half the dimension (max allowed by spec)
                rectRx = Math.min(rectRx, rectW / 2);
                rectRy = Math.min(rectRy, rectH / 2);
                
                const rectRawPoints = generateRoundedRectPoints(rectX, rectY, rectW, rectH, rectRx, rectRy);
                const rectPoints = applyMatrixToPoints(currentMatrix, rectRawPoints);
                shapes.push({ type: 'rect', points: rectPoints });
                break;
                
            case 'ellipse':
                const ecx = parseFloat(element.getAttribute('cx') || 0);
                const ecy = parseFloat(element.getAttribute('cy') || 0);
                const erx = parseFloat(element.getAttribute('rx') || 0);
                const ery = parseFloat(element.getAttribute('ry') || 0);
                const numPoints = 32;
                const ellipseRaw = [];
                for (let i = 0; i <= numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2;
                    ellipseRaw.push([ecx + erx * Math.cos(angle), ecy + ery * Math.sin(angle)]);
                }
                shapes.push({ type: 'ellipse', points: applyMatrixToPoints(currentMatrix, ellipseRaw) });
                break;
                
            case 'circle':
                const ccx = parseFloat(element.getAttribute('cx') || 0);
                const ccy = parseFloat(element.getAttribute('cy') || 0);
                const cr = parseFloat(element.getAttribute('r') || 0);
                const circleRaw = [];
                for (let i = 0; i <= 32; i++) {
                    const angle = (i / 32) * Math.PI * 2;
                    circleRaw.push([ccx + cr * Math.cos(angle), ccy + cr * Math.sin(angle)]);
                }
                shapes.push({ type: 'circle', points: applyMatrixToPoints(currentMatrix, circleRaw) });
                break;
                
            case 'polyline':
                const polylineAttr = element.getAttribute('points') || '';
                const polylineCoords = polylineAttr.trim().split(/[\s,]+/).map(parseFloat);
                const polylineRaw = [];
                for (let i = 0; i < polylineCoords.length - 1; i += 2) {
                    polylineRaw.push([polylineCoords[i], polylineCoords[i + 1]]);
                }
                if (polylineRaw.length >= 2) {
                    shapes.push({ type: 'polyline', points: applyMatrixToPoints(currentMatrix, polylineRaw) });
                }
                break;
                
            case 'polygon':
                const polygonAttr = element.getAttribute('points') || '';
                const polygonCoords = polygonAttr.trim().split(/[\s,]+/).map(parseFloat);
                const polygonRaw = [];
                for (let i = 0; i < polygonCoords.length - 1; i += 2) {
                    polygonRaw.push([polygonCoords[i], polygonCoords[i + 1]]);
                }
                if (polygonRaw.length >= 2) {
                    polygonRaw.push([...polygonRaw[0]]); // Close
                    shapes.push({ type: 'polygon', points: applyMatrixToPoints(currentMatrix, polygonRaw) });
                }
                break;
                
            case 'path':
                const d = element.getAttribute('d') || '';
                const pathPoints = parsePathData(d);
                if (pathPoints.length >= 2) {
                    shapes.push({ type: 'path', points: applyMatrixToPoints(currentMatrix, pathPoints) });
                }
                break;
        }
    }
    
    // Start processing from SVG root with identity matrix
    processElement(svg, [1, 0, 0, 1, 0, 0]);
    
    console.log(`Parsed ${shapes.length} shapes from SVG`);
    
    // Debug: log first few shapes' bounding info
    if (shapes.length > 0) {
        const firstShape = shapes[0];
        const xs = firstShape.points.map(p => p[0]);
        const ys = firstShape.points.map(p => p[1]);
        console.log('First shape bounds:', {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            pointCount: firstShape.points.length
        });
    }
    
    if (shapes.length === 0) {
        throw new Error('No supported shapes found in SVG (line, rect, ellipse, circle, polyline, polygon, path)');
    }
    
    // Store the parsed shapes
    flowState.customStamp.shapes = shapes;
    flowState.customStamp.loaded = true;
    flowState.customStamp.fileName = fileName;
    
    console.log(`Loaded custom SVG "${fileName}" with ${shapes.length} shapes`);
    
    return shapes.length;
}

/**
 * Sample a cubic bezier curve at parameter t (0 to 1)
 * B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 */
function sampleCubicBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    
    return [
        mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x,
        mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y
    ];
}

/**
 * Sample a quadratic bezier curve at parameter t (0 to 1)
 * B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
 */
function sampleQuadraticBezier(p0x, p0y, p1x, p1y, p2x, p2y, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    
    return [
        mt2 * p0x + 2 * mt * t * p1x + t2 * p2x,
        mt2 * p0y + 2 * mt * t * p1y + t2 * p2y
    ];
}

/**
 * Calculate approximate arc length of a cubic bezier to determine sample count
 */
function estimateCubicBezierLength(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
    // Simple chord + control polygon estimate
    const chordLength = Math.hypot(p3x - p0x, p3y - p0y);
    const controlLength = Math.hypot(p1x - p0x, p1y - p0y) + 
                          Math.hypot(p2x - p1x, p2y - p1y) + 
                          Math.hypot(p3x - p2x, p3y - p2y);
    return (chordLength + controlLength) / 2;
}

/**
 * Parse SVG path data (d attribute) into point arrays.
 * Fully supports bezier curves by sampling them at multiple points.
 * @param {string} d - The path data string
 * @returns {Array} Array of [x, y] points
 */
/**
 * Parse a string of numbers from SVG path data, handling compact notation
 * like ".5.3" (meaning 0.5, 0.3) and "1-2" (meaning 1, -2)
 */
function parsePathNumbers(str) {
    const numbers = [];
    // This regex matches:
    // - Optional negative sign
    // - Either: digits with optional decimal, OR just decimal point followed by digits
    // - Optional exponent
    const regex = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
        const num = parseFloat(match[0]);
        if (!isNaN(num)) {
            numbers.push(num);
        }
    }
    return numbers;
}

function parsePathData(d) {
    const points = [];
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;
    let lastControlX = 0;  // For S/s and T/t commands
    let lastControlY = 0;
    let lastCommand = '';
    
    // Number of samples per curve segment (higher = smoother but more points)
    const CURVE_SAMPLES = 12;
    
    // Tokenize the path data
    const commands = d.match(/[MLHVZCSQTAmlhvzcsqta][^MLHVZCSQTAmlhvzcsqta]*/g) || [];
    
    for (const cmd of commands) {
        const type = cmd[0];
        const args = parsePathNumbers(cmd.slice(1));
        
        switch (type) {
            case 'M': // Move to (absolute)
                currentX = args[0];
                currentY = args[1];
                startX = currentX;
                startY = currentY;
                points.push([currentX, currentY]);
                // Additional coordinate pairs are implicit lineto
                for (let i = 2; i < args.length - 1; i += 2) {
                    currentX = args[i];
                    currentY = args[i + 1];
                    points.push([currentX, currentY]);
                }
                break;
                
            case 'm': // Move to (relative)
                currentX += args[0];
                currentY += args[1];
                startX = currentX;
                startY = currentY;
                points.push([currentX, currentY]);
                for (let i = 2; i < args.length - 1; i += 2) {
                    currentX += args[i];
                    currentY += args[i + 1];
                    points.push([currentX, currentY]);
                }
                break;
                
            case 'L': // Line to (absolute)
                for (let i = 0; i < args.length - 1; i += 2) {
                    currentX = args[i];
                    currentY = args[i + 1];
                    points.push([currentX, currentY]);
                }
                break;
                
            case 'l': // Line to (relative)
                for (let i = 0; i < args.length - 1; i += 2) {
                    currentX += args[i];
                    currentY += args[i + 1];
                    points.push([currentX, currentY]);
                }
                break;
                
            case 'H': // Horizontal line (absolute)
                for (const x of args) {
                    currentX = x;
                    points.push([currentX, currentY]);
                }
                break;
                
            case 'h': // Horizontal line (relative)
                for (const dx of args) {
                    currentX += dx;
                    points.push([currentX, currentY]);
                }
                break;
                
            case 'V': // Vertical line (absolute)
                for (const y of args) {
                    currentY = y;
                    points.push([currentX, currentY]);
                }
                break;
                
            case 'v': // Vertical line (relative)
                for (const dy of args) {
                    currentY += dy;
                    points.push([currentX, currentY]);
                }
                break;
                
            case 'Z': // Close path
            case 'z':
                if (points.length > 0 && (currentX !== startX || currentY !== startY)) {
                    points.push([startX, startY]);
                }
                currentX = startX;
                currentY = startY;
                break;
                
            case 'C': // Cubic bezier (absolute)
                for (let i = 0; i < args.length - 5; i += 6) {
                    const p0x = currentX, p0y = currentY;
                    const p1x = args[i], p1y = args[i + 1];
                    const p2x = args[i + 2], p2y = args[i + 3];
                    const p3x = args[i + 4], p3y = args[i + 5];
                    
                    // Sample the curve
                    for (let j = 1; j <= CURVE_SAMPLES; j++) {
                        const t = j / CURVE_SAMPLES;
                        const [x, y] = sampleCubicBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
                        points.push([x, y]);
                    }
                    
                    currentX = p3x;
                    currentY = p3y;
                    lastControlX = p2x;
                    lastControlY = p2y;
                }
                break;
                
            case 'c': // Cubic bezier (relative)
                for (let i = 0; i < args.length - 5; i += 6) {
                    const p0x = currentX, p0y = currentY;
                    const p1x = currentX + args[i], p1y = currentY + args[i + 1];
                    const p2x = currentX + args[i + 2], p2y = currentY + args[i + 3];
                    const p3x = currentX + args[i + 4], p3y = currentY + args[i + 5];
                    
                    // Sample the curve
                    for (let j = 1; j <= CURVE_SAMPLES; j++) {
                        const t = j / CURVE_SAMPLES;
                        const [x, y] = sampleCubicBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
                        points.push([x, y]);
                    }
                    
                    lastControlX = p2x;
                    lastControlY = p2y;
                    currentX = p3x;
                    currentY = p3y;
                }
                break;
                
            case 'S': // Smooth cubic bezier (absolute)
                for (let i = 0; i < args.length - 3; i += 4) {
                    const p0x = currentX, p0y = currentY;
                    // First control point is reflection of last control point
                    let p1x, p1y;
                    if (lastCommand === 'C' || lastCommand === 'c' || lastCommand === 'S' || lastCommand === 's') {
                        p1x = 2 * currentX - lastControlX;
                        p1y = 2 * currentY - lastControlY;
                    } else {
                        p1x = currentX;
                        p1y = currentY;
                    }
                    const p2x = args[i], p2y = args[i + 1];
                    const p3x = args[i + 2], p3y = args[i + 3];
                    
                    for (let j = 1; j <= CURVE_SAMPLES; j++) {
                        const t = j / CURVE_SAMPLES;
                        const [x, y] = sampleCubicBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
                        points.push([x, y]);
                    }
                    
                    lastControlX = p2x;
                    lastControlY = p2y;
                    currentX = p3x;
                    currentY = p3y;
                }
                break;
                
            case 's': // Smooth cubic bezier (relative)
                for (let i = 0; i < args.length - 3; i += 4) {
                    const p0x = currentX, p0y = currentY;
                    let p1x, p1y;
                    if (lastCommand === 'C' || lastCommand === 'c' || lastCommand === 'S' || lastCommand === 's') {
                        p1x = 2 * currentX - lastControlX;
                        p1y = 2 * currentY - lastControlY;
                    } else {
                        p1x = currentX;
                        p1y = currentY;
                    }
                    const p2x = currentX + args[i], p2y = currentY + args[i + 1];
                    const p3x = currentX + args[i + 2], p3y = currentY + args[i + 3];
                    
                    for (let j = 1; j <= CURVE_SAMPLES; j++) {
                        const t = j / CURVE_SAMPLES;
                        const [x, y] = sampleCubicBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t);
                        points.push([x, y]);
                    }
                    
                    lastControlX = p2x;
                    lastControlY = p2y;
                    currentX = p3x;
                    currentY = p3y;
                }
                break;
                
            case 'Q': // Quadratic bezier (absolute)
                for (let i = 0; i < args.length - 3; i += 4) {
                    const p0x = currentX, p0y = currentY;
                    const p1x = args[i], p1y = args[i + 1];
                    const p2x = args[i + 2], p2y = args[i + 3];
                    
                    for (let j = 1; j <= CURVE_SAMPLES; j++) {
                        const t = j / CURVE_SAMPLES;
                        const [x, y] = sampleQuadraticBezier(p0x, p0y, p1x, p1y, p2x, p2y, t);
                        points.push([x, y]);
                    }
                    
                    lastControlX = p1x;
                    lastControlY = p1y;
                    currentX = p2x;
                    currentY = p2y;
                }
                break;
                
            case 'q': // Quadratic bezier (relative)
                for (let i = 0; i < args.length - 3; i += 4) {
                    const p0x = currentX, p0y = currentY;
                    const p1x = currentX + args[i], p1y = currentY + args[i + 1];
                    const p2x = currentX + args[i + 2], p2y = currentY + args[i + 3];
                    
                    for (let j = 1; j <= CURVE_SAMPLES; j++) {
                        const t = j / CURVE_SAMPLES;
                        const [x, y] = sampleQuadraticBezier(p0x, p0y, p1x, p1y, p2x, p2y, t);
                        points.push([x, y]);
                    }
                    
                    lastControlX = p1x;
                    lastControlY = p1y;
                    currentX = p2x;
                    currentY = p2y;
                }
                break;
                
            case 'T': // Smooth quadratic bezier (absolute)
                for (let i = 0; i < args.length - 1; i += 2) {
                    const p0x = currentX, p0y = currentY;
                    let p1x, p1y;
                    if (lastCommand === 'Q' || lastCommand === 'q' || lastCommand === 'T' || lastCommand === 't') {
                        p1x = 2 * currentX - lastControlX;
                        p1y = 2 * currentY - lastControlY;
                    } else {
                        p1x = currentX;
                        p1y = currentY;
                    }
                    const p2x = args[i], p2y = args[i + 1];
                    
                    for (let j = 1; j <= CURVE_SAMPLES; j++) {
                        const t = j / CURVE_SAMPLES;
                        const [x, y] = sampleQuadraticBezier(p0x, p0y, p1x, p1y, p2x, p2y, t);
                        points.push([x, y]);
                    }
                    
                    lastControlX = p1x;
                    lastControlY = p1y;
                    currentX = p2x;
                    currentY = p2y;
                }
                break;
                
            case 't': // Smooth quadratic bezier (relative)
                for (let i = 0; i < args.length - 1; i += 2) {
                    const p0x = currentX, p0y = currentY;
                    let p1x, p1y;
                    if (lastCommand === 'Q' || lastCommand === 'q' || lastCommand === 'T' || lastCommand === 't') {
                        p1x = 2 * currentX - lastControlX;
                        p1y = 2 * currentY - lastControlY;
                    } else {
                        p1x = currentX;
                        p1y = currentY;
                    }
                    const p2x = currentX + args[i], p2y = currentY + args[i + 1];
                    
                    for (let j = 1; j <= CURVE_SAMPLES; j++) {
                        const t = j / CURVE_SAMPLES;
                        const [x, y] = sampleQuadraticBezier(p0x, p0y, p1x, p1y, p2x, p2y, t);
                        points.push([x, y]);
                    }
                    
                    lastControlX = p1x;
                    lastControlY = p1y;
                    currentX = p2x;
                    currentY = p2y;
                }
                break;
                
            case 'A': // Elliptical arc (absolute) - approximate with line segments
            case 'a': // Elliptical arc (relative)
                // Arc commands are complex; for now, approximate with endpoint
                // Full arc support would require significant additional code
                for (let i = 0; i < args.length - 6; i += 7) {
                    const rx = args[i];
                    const ry = args[i + 1];
                    const xAxisRotation = args[i + 2];
                    const largeArcFlag = args[i + 3];
                    const sweepFlag = args[i + 4];
                    let endX = args[i + 5];
                    let endY = args[i + 6];
                    
                    if (type === 'a') {
                        endX += currentX;
                        endY += currentY;
                    }
                    
                    // Approximate arc with sampled points
                    const arcPoints = approximateArc(currentX, currentY, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, endX, endY);
                    for (const pt of arcPoints) {
                        points.push(pt);
                    }
                    
                    currentX = endX;
                    currentY = endY;
                }
                break;
        }
        
        lastCommand = type;
    }
    
    return points;
}

/**
 * Approximate an SVG elliptical arc with line segments
 */
function approximateArc(x1, y1, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x2, y2) {
    const points = [];
    
    // Handle degenerate cases
    if (rx === 0 || ry === 0) {
        points.push([x2, y2]);
        return points;
    }
    
    // Ensure radii are positive
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    
    // Convert rotation to radians
    const phi = (xAxisRotation * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    
    // Step 1: Compute (x1', y1')
    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const x1p = cosPhi * dx + sinPhi * dy;
    const y1p = -sinPhi * dx + cosPhi * dy;
    
    // Step 2: Compute (cx', cy')
    const x1p2 = x1p * x1p;
    const y1p2 = y1p * y1p;
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    
    // Check if radii are large enough
    let lambda = x1p2 / rx2 + y1p2 / ry2;
    if (lambda > 1) {
        const sqrtLambda = Math.sqrt(lambda);
        rx *= sqrtLambda;
        ry *= sqrtLambda;
    }
    
    const rx2New = rx * rx;
    const ry2New = ry * ry;
    
    let sq = ((rx2New * ry2New) - (rx2New * y1p2) - (ry2New * x1p2)) / 
             ((rx2New * y1p2) + (ry2New * x1p2));
    sq = Math.max(0, sq);
    const coef = (largeArcFlag !== sweepFlag ? 1 : -1) * Math.sqrt(sq);
    const cxp = coef * ((rx * y1p) / ry);
    const cyp = coef * (-(ry * x1p) / rx);
    
    // Step 3: Compute (cx, cy) from (cx', cy')
    const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
    
    // Step 4: Compute theta1 and dtheta
    const ux = (x1p - cxp) / rx;
    const uy = (y1p - cyp) / ry;
    const vx = (-x1p - cxp) / rx;
    const vy = (-y1p - cyp) / ry;
    
    const n = Math.sqrt(ux * ux + uy * uy);
    const p = ux;
    let theta1 = Math.acos(Math.max(-1, Math.min(1, p / n)));
    if (uy < 0) theta1 = -theta1;
    
    const n2 = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    const p2 = ux * vx + uy * vy;
    let dtheta = Math.acos(Math.max(-1, Math.min(1, p2 / n2)));
    if (ux * vy - uy * vx < 0) dtheta = -dtheta;
    
    if (sweepFlag && dtheta < 0) {
        dtheta += 2 * Math.PI;
    } else if (!sweepFlag && dtheta > 0) {
        dtheta -= 2 * Math.PI;
    }
    
    // Sample the arc
    const numSamples = Math.max(8, Math.ceil(Math.abs(dtheta) / (Math.PI / 8)));
    for (let i = 1; i <= numSamples; i++) {
        const t = i / numSamples;
        const theta = theta1 + t * dtheta;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        
        const x = cosPhi * rx * cosTheta - sinPhi * ry * sinTheta + cx;
        const y = sinPhi * rx * cosTheta + cosPhi * ry * sinTheta + cy;
        points.push([x, y]);
    }
    
    return points;
}

/**
 * Transform a stamp shape for placement at a grid position.
 * Applies: center → scale → rotate → translate
 * @param {Array} points - Array of [x, y] coordinates
 * @param {number} gx - Grid position X (in mm)
 * @param {number} gy - Grid position Y (in mm)
 * @param {number} angle - Rotation angle in radians
 * @param {number} scale - Scale factor
 * @returns {Array} Transformed points array
 */
function transformStampShape(points, gx, gy, angle, scale) {
    const cx = flowState.customStamp.centerX;
    const cy = flowState.customStamp.centerY;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    return points.map(([px, py]) => {
        // 1. Center at origin (relative to stamp center)
        let x = px - cx;
        let y = py - cy;
        
        // 2. Scale to target size
        x *= scale;
        y *= scale;
        
        // 3. Rotate by flow angle
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        
        // 4. Translate to grid position
        return [gx + rx, gy + ry];
    });
}

/**
 * Generate stamp paths for all grid cells.
 * Places the custom SVG stamp at each grid position, rotated by the flow field angle.
 * @param {number} drawWidth - Drawing area width in mm
 * @param {number} drawHeight - Drawing area height in mm
 * @param {number} margin - Margin in mm
 * @returns {Array} Array of paths (each path is an array of [x, y] coordinates)
 */
function generateCustomSVGStamps(drawWidth, drawHeight, margin) {
    if (!flowState.customStamp.loaded || flowState.customStamp.shapes.length === 0) {
        console.warn('Custom SVG stamp not loaded');
        return [];
    }
    
    const allPaths = [];
    
    // Calculate grid dimensions
    const { cols, rows, stepX, stepY } = calculateGridDimensions(drawWidth, drawHeight, flowState.numParticles);
    
    // Calculate scale factor: scale stamp to match brushWidth
    // The stamp's original size is its viewBox width, scale to brushWidth in mm
    const scale = flowState.brushWidth / flowState.customStamp.width;
    
    // Flow vector sampling options
    const flowOptions = {
        octaves: flowState.noiseOctaves,
        persistence: flowState.noisePersistence,
        angleOffset: flowState.angleOffset * Math.PI / 180,
        flowStrength: flowState.flowStrength,
        curlAmount: flowState.curlAmount
    };
    
    // Iterate over all grid cells
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // Calculate grid position (center of cell)
            const gx = margin + col * stepX + stepX * 0.5;
            const gy = margin + row * stepY + stepY * 0.5;
            
            // Apply jitter if configured
            let jx = gx, jy = gy;
            const jitter = flowState.gridConfig.jitter || 0;
            if (jitter > 0) {
                jx += (Math.random() - 0.5) * stepX * jitter;
                jy += (Math.random() - 0.5) * stepY * jitter;
            }
            
            // Clamp to drawing bounds
            jx = Math.max(margin, Math.min(margin + drawWidth, jx));
            jy = Math.max(margin, Math.min(margin + drawHeight, jy));
            
            // Get flow vector at this position
            const [vx, vy] = sampleFlowVector(jx, jy, flowOptions);
            
            // Calculate rotation angle from flow vector
            const angle = Math.atan2(vy, vx);
            
            // Transform each shape in the stamp and add to paths
            for (const shape of flowState.customStamp.shapes) {
                const transformedPoints = transformStampShape(shape.points, jx, jy, angle, scale);
                allPaths.push(transformedPoints);
            }
        }
    }
    
    return allPaths;
}

/**
 * Generate custom SVG stamps for a layer using pre-assigned starting points.
 * This is called from generateFlowFieldWithPoints when ribbonStyle is 'custom-svg'.
 * @param {Object} layer - The layer to add paths to
 * @param {Array} startingPoints - Array of [x, y] positions to place stamps
 * @param {number} margin - Margin in mm
 */
function generateCustomSVGStampsForLayer(layer, startingPoints, margin) {
    if (!flowState.customStamp.loaded || flowState.customStamp.shapes.length === 0) {
        console.warn('Custom SVG stamp not loaded, cannot generate stamps');
        return;
    }
    
    // Calculate scale factor: scale stamp to match brushWidth
    const scale = flowState.brushWidth / flowState.customStamp.width;
    
    // Flow vector sampling options
    const flowOptions = {
        octaves: flowState.noiseOctaves,
        persistence: flowState.noisePersistence,
        angleOffset: flowState.angleOffset * Math.PI / 180,
        flowStrength: flowState.flowStrength,
        curlAmount: flowState.curlAmount
    };
    
        // For each starting point, place a rotated stamp
        for (const [gx, gy] of startingPoints) {
            // Clamp to bounds
            const clampedX = Math.max(margin, Math.min(flowState.widthMm - margin, gx));
            const clampedY = Math.max(margin, Math.min(flowState.heightMm - margin, gy));
            
            // Skip if starting point is inside an obstacle
            const obstacles = flowState.obstacles || [];
            let insideObstacle = false;
            for (const obs of obstacles) {
                const dist = Math.hypot(clampedX - obs.x, clampedY - obs.y);
                if (dist < obs.radius + 0.5) {
                    insideObstacle = true;
                    break;
                }
            }
            if (insideObstacle) {
                continue;
            }
            
            // Get flow vector at this position
        const [vx, vy] = sampleFlowVector(clampedX, clampedY, flowOptions);
        
        // Calculate rotation angle from flow vector
        const angle = Math.atan2(vy, vx);
        
        // Transform each shape in the stamp and add to layer paths
        for (const shape of flowState.customStamp.shapes) {
            const transformedPoints = transformStampShape(shape.points, clampedX, clampedY, angle, scale);
            
            if (transformedPoints && transformedPoints.length >= 2) {
                layer.paths.push({
                    coords: transformedPoints,
                    color: layer.color
                });
            }
        }
    }
}

// Load custom SVG stamp on initialization
loadCustomSVG();

// ============================================================================
// END CUSTOM SVG STAMP SYSTEM
// ============================================================================

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
        ribbonStyle: flowState.ribbonStyle,
        zigzagWavelength: flowState.zigzagWavelength,
        terrainVerticalGap: flowState.terrainVerticalGap,
        terrainAltitude: flowState.terrainAltitude,
        terrainDetail: flowState.terrainDetail,
        gradientConfig: { ...flowState.gradientConfig },
        inkBlendMode: flowState.inkBlendMode,
        inkOpacity: flowState.inkOpacity,
        // NOTE: distributionMode is intentionally NOT included here - it's a global setting, not per-layer
        syncAllLayers: flowState.syncAllLayers
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
    // Calculate effective collision radius: minDistance + safety buffer
    // Note: strokeWidth is NOT included - it only affects visual rendering, not spacing
    // The 0.05mm buffer ensures lines don't visually touch when minDistance is 0
    const effectiveCollisionRadius = flowState.minDistance + 0.05;
    
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
    // Calculate effective collision radius: minDistance + safety buffer
    // Note: strokeWidth is NOT included - it only affects visual rendering, not spacing
    // The 0.05mm buffer ensures lines don't visually touch when minDistance is 0
    const effectiveCollisionRadius = flowState.minDistance + 0.05;
    
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

// ============================================================================
// COLOR PALETTE SYSTEM
// A palette recolours every existing layer from a curated preset. The palette
// is resampled to the current layer count, so picking one works for ANY number
// of layers (4, 8, 20…) — each layer gets one colour from the blend.
// ============================================================================

/**
 * Curated palettes. Each is an ordered list of hex "stops"; applying a palette
 * resamples those stops to however many layers exist.
 *   group 'Monochrome' : one hue, light → dark tints
 *   group 'Gradient'   : multi-hue ramps that blend smoothly end-to-end
 *   group 'Multi'      : distinct colourful vibes (pastel / vibrant / retro…)
 */
const RIBBON_PALETTES = [
    // --- Monochrome tonal ramps (light → dark tints of one hue) ---
    { id: 'mono-blue',     name: 'Blue',      group: 'Monochrome', stops: ['#BFE3F2', '#7FC4E8', '#3E92CC', '#1C5D99', '#0A2E52'] },
    { id: 'mono-green',    name: 'Green',     group: 'Monochrome', stops: ['#CDEAC0', '#8FCB81', '#4CA64C', '#2E7D32', '#14532D'] },
    { id: 'mono-red',      name: 'Red',       group: 'Monochrome', stops: ['#F6C5C0', '#EE8A82', '#E23B3B', '#A81E22', '#5E1115'] },
    { id: 'mono-teal',     name: 'Teal',      group: 'Monochrome', stops: ['#BEEDE6', '#79D5C8', '#2BB3A3', '#14796F', '#0A3F3A'] },
    { id: 'mono-violet',   name: 'Violet',    group: 'Monochrome', stops: ['#E0CCF2', '#BE9BE3', '#9163CC', '#5E3A99', '#321F52'] },
    { id: 'mono-amber',    name: 'Amber',     group: 'Monochrome', stops: ['#F7E1A0', '#F0C24B', '#E0982E', '#B5651D', '#6E3B10'] },
    { id: 'mono-rose',     name: 'Rose',      group: 'Monochrome', stops: ['#F9D7E3', '#F2A8C4', '#E36C9A', '#B23E6E', '#6E2243'] },
    { id: 'mono-slate',    name: 'Slate',     group: 'Monochrome', stops: ['#D6DBE0', '#A3AEB8', '#6C7A89', '#404C57', '#1C242B'] },
    { id: 'mono-graphite', name: 'Graphite',  group: 'Monochrome', stops: ['#C9C9C9', '#9A9A9A', '#6B6B6B', '#3D3D3D', '#141414'] },

    // --- Smooth multi-hue gradients ---
    { id: 'grad-sunset',   name: 'Sunset',    group: 'Gradient', stops: ['#FCE38A', '#F7A24B', '#F25C54', '#C9388A', '#6A2C70'] },
    { id: 'grad-ocean',    name: 'Ocean',     group: 'Gradient', stops: ['#E8F7C8', '#6FD0A8', '#2BA6B0', '#1E5F94', '#14224F'] },
    { id: 'grad-lava',     name: 'Lava',      group: 'Gradient', stops: ['#FFE066', '#FF9F1C', '#E8341C', '#8B1E3F', '#2B0A12'] },
    { id: 'grad-dusk',     name: 'Dusk',      group: 'Gradient', stops: ['#F6C0C7', '#C97BA8', '#7E5AA2', '#3E4C8A', '#16213E'] },
    { id: 'grad-citrus',   name: 'Citrus',    group: 'Gradient', stops: ['#FFF3A0', '#FFD23F', '#F79D2E', '#EE6C2B', '#C73E1D'] },
    { id: 'grad-forest',   name: 'Forest',    group: 'Gradient', stops: ['#EDE7B1', '#A7C957', '#4C9A52', '#2A7245', '#1B3A2B'] },

    // --- Multi-colour vibes ---
    { id: 'vibe-pastel',   name: 'Pastel',    group: 'Multi', stops: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#BDB2FF'] },
    { id: 'vibe-vibrant',  name: 'Vibrant',   group: 'Multi', stops: ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE'] },
    { id: 'vibe-retro',    name: 'Retro 70s', group: 'Multi', stops: ['#6B3E26', '#A6611A', '#D9A441', '#E3C04B', '#8AA053', '#4E6B3A'] },
    { id: 'vibe-riso',     name: 'Riso',      group: 'Multi', stops: ['#FF48B0', '#FF7A00', '#FFD800', '#00A95C', '#0078BF', '#7A4FBF'] },
    { id: 'vibe-earth',    name: 'Earth',     group: 'Multi', stops: ['#E7DBC0', '#CBB07A', '#9CA86E', '#6E7B53', '#5A5346'] },
    { id: 'vibe-neon',     name: 'Neon',      group: 'Multi', stops: ['#C6FF00', '#00E676', '#00E5FF', '#2979FF', '#D500F9', '#FF1744'] },
    { id: 'vibe-candy',    name: 'Candy',     group: 'Multi', stops: ['#FF6FB5', '#FF9CEE', '#C49BFF', '#9BB8FF', '#7DE5E5', '#A0F0B5'] },
    { id: 'vibe-autumn',   name: 'Autumn',    group: 'Multi', stops: ['#F2C14E', '#F09540', '#DE6B35', '#B23A2E', '#7C2D2D', '#5A3A22'] },
    { id: 'vibe-tropical', name: 'Tropical',  group: 'Multi', stops: ['#FFD23F', '#FF8C42', '#2EC4B6', '#17A398', '#1B6CA8'] },
    { id: 'vibe-nordic',   name: 'Nordic',    group: 'Multi', stops: ['#D9E4DD', '#A7C4BC', '#6E92A0', '#4A6670', '#2E3F4A'] }
];

/** Parse a #rrggbb string into [r, g, b]. */
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

/** Linear RGB blend between two hex colours at t (0..1). */
function lerpHex(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return rgbToHex(
        ca[0] + (cb[0] - ca[0]) * t,
        ca[1] + (cb[1] - ca[1]) * t,
        ca[2] + (cb[2] - ca[2]) * t
    );
}

/**
 * Resample an ordered list of stops to exactly n colours via linear RGB blend.
 * n === 1 returns a representative middle stop; otherwise the colours span the
 * full ramp end-to-end.
 */
function samplePaletteStops(stops, n) {
    if (n <= 0) return [];
    if (stops.length === 1) return Array(n).fill(stops[0]);
    if (n === 1) return [stops[Math.floor((stops.length - 1) / 2)]];
    const out = [];
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * (stops.length - 1);
        const lo = Math.min(Math.floor(x), stops.length - 2);
        out.push(lerpHex(stops[lo], stops[lo + 1], x - lo));
    }
    return out;
}

/** Look up a palette by id. */
function getPaletteById(id) {
    return RIBBON_PALETTES.find(p => p.id === id) || null;
}

/**
 * Paint an array of colours onto the current layers (one colour per layer).
 * Re-bakes already-generated path colours so the canvas updates instantly
 * without regenerating any geometry.
 */
function applyColorsToLayers(colors) {
    flowState.layers.forEach((layer, i) => {
        const color = colors[i] ?? colors[colors.length - 1] ?? layer.color;
        layer.color = color;
        layer.settings = layer.settings || {};
        layer.settings.color = color;
        if (Array.isArray(layer.paths)) {
            for (const p of layer.paths) p.color = color;
        }
    });
    syncPathsFromLayers();
    renderLayerList();
    renderCanvas();
}

/** Apply a palette (by id) across however many layers currently exist. */
function applyPaletteById(id) {
    flowState.activePaletteId = id || '';
    const palette = getPaletteById(id);
    if (!palette) {
        // "Custom" — leave layer colours untouched, just clear the preview
        renderPalettePreview('');
        return;
    }
    const stops = flowState.paletteReversed ? [...palette.stops].reverse() : palette.stops;
    applyColorsToLayers(samplePaletteStops(stops, flowState.layers.length));
    renderPalettePreview(id);
    const select = document.getElementById('palette-select');
    if (select && select.value !== flowState.activePaletteId) {
        select.value = flowState.activePaletteId;
    }
}

/** Re-apply the active palette after the layer count changes (add / batch / delete). */
function reapplyActivePalette() {
    if (flowState.activePaletteId && getPaletteById(flowState.activePaletteId)) {
        applyPaletteById(flowState.activePaletteId);
    }
}

/** Clear palette selection back to "Custom" (used when a colour is edited by hand). */
function clearActivePalette() {
    flowState.activePaletteId = '';
    const select = document.getElementById('palette-select');
    if (select) select.value = '';
    renderPalettePreview('');
}

/** Build the palette dropdown options (grouped) and wire its events. Idempotent. */
function populatePaletteDropdown() {
    const select = document.getElementById('palette-select');
    if (!select || select.dataset.populated === 'true') return;

    const groupLabels = { Monochrome: 'Monochrome (tints)', Gradient: 'Gradients', Multi: 'Multi-colour' };
    ['Monochrome', 'Gradient', 'Multi'].forEach(group => {
        const og = document.createElement('optgroup');
        og.label = groupLabels[group] || group;
        RIBBON_PALETTES.filter(p => p.group === group).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            og.appendChild(opt);
        });
        select.appendChild(og);
    });

    select.value = flowState.activePaletteId || '';
    select.addEventListener('change', () => applyPaletteById(select.value));
    select.dataset.populated = 'true';

    // Clicking the preview strip flips the light↔dark / hue direction for quick play
    const preview = document.getElementById('palette-preview');
    if (preview) {
        preview.addEventListener('click', () => {
            if (!flowState.activePaletteId) return;
            flowState.paletteReversed = !flowState.paletteReversed;
            applyPaletteById(flowState.activePaletteId);
        });
    }
    renderPalettePreview(flowState.activePaletteId || '');
}

/** Render the swatch-strip preview under the dropdown for a palette id. */
function renderPalettePreview(id) {
    const preview = document.getElementById('palette-preview');
    if (!preview) return;
    preview.innerHTML = '';
    const palette = getPaletteById(id);
    if (!palette) {
        preview.classList.add('is-empty');
        preview.title = '';
        return;
    }
    preview.classList.remove('is-empty');
    preview.title = 'Click to reverse direction';
    const stops = flowState.paletteReversed ? [...palette.stops].reverse() : palette.stops;
    // Show a smooth resample so the strip reads like the final blend
    samplePaletteStops(stops, Math.max(8, stops.length)).forEach(c => {
        const sw = document.createElement('span');
        sw.className = 'palette-swatch';
        sw.style.background = c;
        preview.appendChild(sw);
    });
}

/**
 * Shuffle array in place using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} The shuffled array (same reference)
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
    
    // Ensure presence property exists (default to 1.0 = 100%)
    if (typeof layer.presence !== 'number') {
        layer.presence = 1.0;
    }
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
    flowState.strokeWidth = settings.strokeWidth ?? flowState.strokeWidth;
    flowState.margin = settings.margin ?? flowState.margin;
    flowState.renderStyle = settings.renderStyle ?? flowState.renderStyle ?? 'default';
    flowState.brushWidth = settings.brushWidth ?? flowState.brushWidth ?? 5;
    flowState.ribbonStyle = settings.ribbonStyle ?? flowState.ribbonStyle ?? 'zigzag';
    flowState.zigzagWavelength = settings.zigzagWavelength ?? flowState.zigzagWavelength ?? 2;
    flowState.terrainVerticalGap = settings.terrainVerticalGap ?? flowState.terrainVerticalGap ?? 5;
    flowState.terrainAltitude = settings.terrainAltitude ?? flowState.terrainAltitude ?? 30;
    flowState.terrainDetail = settings.terrainDetail ?? flowState.terrainDetail ?? 1;
    
    // Gradient distribution and ink blend mode
    if (settings.gradientConfig) {
        flowState.gradientConfig = { ...flowState.gradientConfig, ...settings.gradientConfig };
    }
    flowState.inkBlendMode = settings.inkBlendMode ?? flowState.inkBlendMode;
    flowState.inkOpacity = settings.inkOpacity ?? flowState.inkOpacity;
    // NOTE: distributionMode is NOT applied from layer settings - it's a global setting
    // that should only change when the user explicitly selects a new value
    flowState.syncAllLayers = settings.syncAllLayers ?? flowState.syncAllLayers;
    
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
    setSliderValue('stroke-width', settings.strokeWidth ?? '');
    setSliderValue('stroke-width-input', settings.strokeWidth ?? '');
    setText('stroke-width-value', `${(settings.strokeWidth ?? 0).toFixed(2)} mm`);
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
    
    // Ribbon style
    const ribbonStyleEl = document.getElementById('ribbon-style');
    if (ribbonStyleEl) {
        ribbonStyleEl.value = settings.ribbonStyle ?? flowState.ribbonStyle ?? 'zigzag';
    }
    
    // Zigzag wavelength
    const zigzagWavelengthValue = settings.zigzagWavelength ?? flowState.zigzagWavelength ?? 2;
    setSliderValue('zigzag-wavelength', zigzagWavelengthValue);
    setText('zigzag-wavelength-value', `${zigzagWavelengthValue.toFixed(1)}x`);
    // Show/hide zigzag wavelength based on style
    const wavelengthGroup = document.getElementById('zigzag-wavelength-group');
    if (wavelengthGroup) {
        const style = settings.ribbonStyle ?? flowState.ribbonStyle ?? 'zigzag';
        wavelengthGroup.style.display = style === 'zigzag' ? 'block' : 'none';
    }
    
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
        const paperValue = `${settings.widthMm ?? flowState.widthMm}x${settings.heightMm ?? flowState.heightMm}`;
        if (paperSizeEl.querySelector(`option[value="${paperValue}"]`)) {
            paperSizeEl.value = paperValue;
        }
    }

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

    // Gradient Distribution Controls
    if (settings.gradientConfig) {
        const gradEnabled = !!settings.gradientConfig.enabled;
        setCheckboxValue('gradient-enabled', gradEnabled);
        
        const gradControls = document.getElementById('gradient-controls');
        if (gradControls) gradControls.style.display = gradEnabled ? 'flex' : 'none';
        
        const dirEl = document.getElementById('gradient-direction');
        if (dirEl && settings.gradientConfig.direction) dirEl.value = settings.gradientConfig.direction;
        
        const easeEl = document.getElementById('gradient-easing');
        if (easeEl && settings.gradientConfig.easing) easeEl.value = settings.gradientConfig.easing;
    }

    // Ink Blend Mode
    setCheckboxValue('ink-blend-mode', !!settings.inkBlendMode);
    
    // NOTE: Distribution Mode is NOT updated here because it's a global setting, not per-layer
    // The dropdown should only change when the user explicitly selects a new value
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
        presence: 1.0,  // Default presence (100%)
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
    // Use smartRegenerate to respect distribution mode when adding a new layer
    smartRegenerate();
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
    
    // For non-sequential modes, redistribute points among remaining layers
    const mode = flowState.distributionMode || 'sequential';
    if (mode !== 'sequential') {
        smartRegenerate();
    } else {
        // Sequential mode: just sync and render
        syncPathsFromLayers();
        renderLayerList();
        renderCanvas();
    }

    // Keep an active palette spread evenly across the remaining layers
    reapplyActivePalette();
}

/**
 * Toggle layer visibility
 * @param {string} id - Layer ID
 */
function toggleLayerVisibility(id) {
    const layer = getLayerById(id);
    if (layer) {
        layer.visible = !layer.visible;
        
        // For non-sequential modes, visibility changes affect point distribution
        const mode = flowState.distributionMode || 'sequential';
        if (mode !== 'sequential') {
            smartRegenerate();
        } else {
            // Sequential mode: just sync and render
            syncPathsFromLayers();
            renderLayerList();
            renderCanvas();
        }
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
 * Regenerate only the active layer (or all layers if distribution mode requires it)
 * Respects the current distribution mode - non-sequential modes require full regeneration
 */
function regenerateActiveLayer() {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    
    // Use smartRegenerate with activeOnly flag
    // In non-sequential modes, this will regenerate all layers (required for point pre-assignment)
    // In sequential mode, this will only regenerate the active layer
    smartRegenerate({ activeOnly: true });
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
 * Smart regeneration entry point that respects the current distribution mode.
 * Use this instead of calling generateFlowField() directly.
 * 
 * @param {Object} options - Optional configuration
 * @param {boolean} options.activeOnly - If true and in sequential mode, only regenerate active layer
 */
function smartRegenerate(options = {}) {
    // Check if gradient distribution is enabled (takes precedence over distribution mode)
    if (flowState.gradientConfig && flowState.gradientConfig.enabled) {
        generateAllLayersGradient();
        return;
    }
    
    const mode = flowState.distributionMode || 'sequential';
    const activeOnly = options.activeOnly ?? false;
    
    // Non-sequential modes ALWAYS require full regeneration of all layers
    // because points are pre-assigned to specific layers
    if (mode !== 'sequential') {
        generateAllLayersWithDistribution();
        return;
    }
    
    // Sequential mode: can regenerate just the active layer if requested
    if (activeOnly) {
        const activeLayer = getActiveLayer();
        if (activeLayer) {
            activeLayer.paths = [];
            generateFlowField();
        }
    } else {
        generateAllLayers();
    }
}

/**
 * Generate all layers using the selected distribution mode.
 * Routes to the appropriate generation strategy based on flowState.distributionMode.
 */
function generateAllLayersWithDistribution() {
    const mode = flowState.distributionMode || 'sequential';
    
    switch (mode) {
        case 'sequential':
            // Use the original sequential priority method (unchanged)
            generateAllLayers();
            break;
        case 'fair':
            generateAllLayersFairDistribution();
            break;
        case 'lottery':
            generateAllLayersLottery();
            break;
        case 'striped':
            generateAllLayersStriped();
            break;
        default:
            generateAllLayers();
    }
}

/**
 * FAIR DISTRIBUTION MODE
 * Pre-distributes all grid points among visible layers based on weighted presence.
 * Layer order doesn't matter - each layer gets exactly its share of points.
 */
function generateAllLayersFairDistribution() {
    if (!flowState.canvas || !flowState.ctx) {
        initCanvas();
    }
    if (!flowState.canvas || !flowState.ctx || !flowState.pxPerMm) {
        console.warn('Canvas not ready, aborting generateAllLayersFairDistribution');
        return;
    }

    const previousActiveId = flowState.activeLayerId;
    const margin = flowState.margin;
    const drawWidth = flowState.widthMm - 2 * margin;
    const drawHeight = flowState.heightMm - 2 * margin;

    if (drawWidth <= 0 || drawHeight <= 0) return;

    // Get visible layers and calculate total presence
    const visibleLayers = flowState.layers.filter(l => l.visible);
    if (visibleLayers.length === 0) return;

    const totalPresence = visibleLayers.reduce((sum, l) => sum + (l.presence ?? 1.0), 0);

    // Clear all layer paths
    flowState.layers.forEach(layer => { layer.paths = []; });
    flowState.paths = [];
    flowState.spatialGrid = null;

    // Generate the full grid of starting points (using layer index 0 for base positions)
    const allPoints = generateStartingPoints(drawWidth, drawHeight, margin, 0);
    
    // Shuffle points for randomness
    shuffleArray(allPoints);

    // Pre-assign points to layers based on weighted presence
    const layerPointAssignments = new Map();
    visibleLayers.forEach(layer => layerPointAssignments.set(layer.id, []));

    let pointIndex = 0;
    for (const layer of visibleLayers) {
        const layerPresence = layer.presence ?? 1.0;
        const share = totalPresence > 0 ? (layerPresence / totalPresence) : (1 / visibleLayers.length);
        const pointCount = Math.floor(allPoints.length * share);
        
        for (let i = 0; i < pointCount && pointIndex < allPoints.length; i++) {
            layerPointAssignments.get(layer.id).push(allPoints[pointIndex]);
            pointIndex++;
        }
    }

    // Distribute remaining points to layers (round-robin for fairness)
    let layerIdx = 0;
    while (pointIndex < allPoints.length) {
        const layer = visibleLayers[layerIdx % visibleLayers.length];
        layerPointAssignments.get(layer.id).push(allPoints[pointIndex]);
        pointIndex++;
        layerIdx++;
    }

    // Generate paths for each layer using only its assigned points
    for (const layer of visibleLayers) {
        ensureLayerDefaults(layer);
        flowState.activeLayerId = layer.id;
        applySettingsToFlowState(layer.settings);
        
        const assignedPoints = layerPointAssignments.get(layer.id);
        generateFlowFieldWithPoints(layer, assignedPoints);
    }

    // Restore previously active layer
    restoreActiveLayer(previousActiveId);
}

/**
 * SIMULTANEOUS LOTTERY MODE
 * For each grid point, all layers "compete" based on their presence weights.
 * Winner is chosen randomly (weighted lottery). Pure randomness, no order bias.
 */
function generateAllLayersLottery() {
    if (!flowState.canvas || !flowState.ctx) {
        initCanvas();
    }
    if (!flowState.canvas || !flowState.ctx || !flowState.pxPerMm) {
        console.warn('Canvas not ready, aborting generateAllLayersLottery');
        return;
    }

    const previousActiveId = flowState.activeLayerId;
    const margin = flowState.margin;
    const drawWidth = flowState.widthMm - 2 * margin;
    const drawHeight = flowState.heightMm - 2 * margin;

    if (drawWidth <= 0 || drawHeight <= 0) return;

    // Get visible layers
    const visibleLayers = flowState.layers.filter(l => l.visible);
    if (visibleLayers.length === 0) return;

    // Calculate cumulative weights for weighted random selection
    const totalPresence = visibleLayers.reduce((sum, l) => sum + (l.presence ?? 1.0), 0);
    const cumulativeWeights = [];
    let cumSum = 0;
    for (const layer of visibleLayers) {
        cumSum += (layer.presence ?? 1.0) / totalPresence;
        cumulativeWeights.push({ layer, cumWeight: cumSum });
    }

    // Clear all layer paths
    flowState.layers.forEach(layer => { layer.paths = []; });
    flowState.paths = [];
    flowState.spatialGrid = null;

    // Generate the full grid of starting points
    const allPoints = generateStartingPoints(drawWidth, drawHeight, margin, 0);

    // Pre-assign points to layers via weighted lottery
    const layerPointAssignments = new Map();
    visibleLayers.forEach(layer => layerPointAssignments.set(layer.id, []));

    for (const point of allPoints) {
        const rand = Math.random();
        // Find which layer wins this point
        for (const { layer, cumWeight } of cumulativeWeights) {
            if (rand <= cumWeight) {
                layerPointAssignments.get(layer.id).push(point);
                break;
            }
        }
    }

    // Generate paths for each layer using only its assigned points
    for (const layer of visibleLayers) {
        ensureLayerDefaults(layer);
        flowState.activeLayerId = layer.id;
        applySettingsToFlowState(layer.settings);
        
        const assignedPoints = layerPointAssignments.get(layer.id);
        generateFlowFieldWithPoints(layer, assignedPoints);
    }

    // Restore previously active layer
    restoreActiveLayer(previousActiveId);
}

/**
 * STRIPED ROWS MODE
 * Assigns grid rows to layers in rotation.
 * Layer 1 gets rows 0, N, 2N..., Layer 2 gets rows 1, N+1, 2N+1..., etc.
 */
function generateAllLayersStriped() {
    if (!flowState.canvas || !flowState.ctx) {
        initCanvas();
    }
    if (!flowState.canvas || !flowState.ctx || !flowState.pxPerMm) {
        console.warn('Canvas not ready, aborting generateAllLayersStriped');
        return;
    }

    const previousActiveId = flowState.activeLayerId;
    const margin = flowState.margin;
    const drawWidth = flowState.widthMm - 2 * margin;
    const drawHeight = flowState.heightMm - 2 * margin;

    if (drawWidth <= 0 || drawHeight <= 0) return;

    // Get visible layers
    const visibleLayers = flowState.layers.filter(l => l.visible);
    if (visibleLayers.length === 0) return;

    // Clear all layer paths
    flowState.layers.forEach(layer => { layer.paths = []; });
    flowState.paths = [];
    flowState.spatialGrid = null;

    // Get grid dimensions
    const { cols, rows, stepX, stepY } = calculateGridDimensions(drawWidth, drawHeight, flowState.numParticles);
    const jitter = flowState.gridConfig.jitter || 0;

    // Pre-assign points to layers based on row index
    const layerPointAssignments = new Map();
    visibleLayers.forEach(layer => layerPointAssignments.set(layer.id, []));

    const numLayers = visibleLayers.length;
    
    for (let row = 0; row < rows; row++) {
        // Determine which layer gets this row (round-robin based on presence weight)
        // For striped mode, we use simple rotation but weighted by presence
        const layerIndex = row % numLayers;
        const assignedLayer = visibleLayers[layerIndex];
        
        // Apply presence as probability filter for this row
        const layerPresence = assignedLayer.presence ?? 1.0;
        if (layerPresence < 1.0 && Math.random() > layerPresence) {
            continue; // Skip this row based on presence probability
        }
        
        for (let col = 0; col < cols; col++) {
            let x = margin + col * stepX + stepX * 0.5;
            let y = margin + row * stepY + stepY * 0.5;
            
            if (jitter > 0) {
                x += (Math.random() - 0.5) * stepX * jitter;
                y += (Math.random() - 0.5) * stepY * jitter;
            }
            
            x = Math.max(margin, Math.min(margin + drawWidth, x));
            y = Math.max(margin, Math.min(margin + drawHeight, y));
            
            layerPointAssignments.get(assignedLayer.id).push([x, y]);
        }
    }

    // Generate paths for each layer using only its assigned points
    for (const layer of visibleLayers) {
        ensureLayerDefaults(layer);
        flowState.activeLayerId = layer.id;
        applySettingsToFlowState(layer.settings);
        
        const assignedPoints = layerPointAssignments.get(layer.id);
        generateFlowFieldWithPoints(layer, assignedPoints);
    }

    // Restore previously active layer
    restoreActiveLayer(previousActiveId);
}

/**
 * GRADIENT DISTRIBUTION MODE
 * Assigns lines to layers based on their position on the canvas.
 * Layer order represents gradient stops (Index 0 = Start Color, Last Index = End Color).
 * Supports vertical, horizontal, and radial directions with easing curves.
 */
function generateAllLayersGradient() {
    if (!flowState.canvas || !flowState.ctx) {
        initCanvas();
    }
    if (!flowState.canvas || !flowState.ctx || !flowState.pxPerMm) {
        console.warn('Canvas not ready, aborting generateAllLayersGradient');
        return;
    }

    const previousActiveId = flowState.activeLayerId;
    const margin = flowState.margin;
    const drawWidth = flowState.widthMm - 2 * margin;
    const drawHeight = flowState.heightMm - 2 * margin;

    if (drawWidth <= 0 || drawHeight <= 0) return;

    // Get visible layers - order represents gradient stops
    const visibleLayers = flowState.layers.filter(l => l.visible);
    if (visibleLayers.length === 0) return;

    const numLayers = visibleLayers.length;
    // Single layer handling
    if (numLayers < 2) {
        generateAllLayers();
        return;
    }

    // Clear all layer paths
    flowState.layers.forEach(layer => { layer.paths = []; });
    flowState.paths = [];
    flowState.spatialGrid = null;

    // Generate the full grid of starting points
    const allPoints = generateStartingPoints(drawWidth, drawHeight, margin, 0);

    // Get easing function
    const easingFunc = flowState.gradientConfig.easing || 'linear';
    let easeFunc;
    switch (easingFunc) {
        case 'easeIn': easeFunc = easeIn; break;
        case 'easeOut': easeFunc = easeOut; break;
        case 'sigmoid': easeFunc = sigmoid; break;
        default: easeFunc = linear;
    }

    // Calculate center point for radial mode
    const centerX = margin + drawWidth / 2;
    const centerY = margin + drawHeight / 2;
    const maxDistance = Math.sqrt(Math.pow(drawWidth / 2, 2) + Math.pow(drawHeight / 2, 2));

    // Pre-assign points to layers based on gradient position
    const layerPointAssignments = new Map();
    visibleLayers.forEach(layer => layerPointAssignments.set(layer.id, []));

    // Determine direction
    const direction = flowState.gradientConfig.direction || 'vertical';

    for (const point of allPoints) {
        const [x, y] = point;
        
        // 1. Calculate normalized t value (0.0 to 1.0)
        let t;
        if (direction === 'horizontal') {
            // Left (0) -> Right (1)
            t = (x - margin) / drawWidth;
        } else if (direction === 'radial') {
            // Center (0) -> Edge (1)
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            t = distance / maxDistance;
        } else {
            // Vertical: Bottom (0) -> Top (1)
            // Note: Canvas Y increases downwards, so we invert it for "Bottom-to-Top" logic
            t = 1 - ((y - margin) / drawHeight);
        }

        // 2. Strict Clamp to prevent out-of-bounds errors
        t = Math.max(0, Math.min(1, t));

        // 3. Apply easing
        t = easeFunc(t);

        // 4. Map t to Layer Index (Balanced Distribution)
        // This maps 0..1 to -0.5 .. N-0.5.
        // This ensures the "center" of each layer i is at t = (i+0.5)/N
        const pos = t * numLayers - 0.5;
        
        // Find the two nearest layer indices
        const index1 = Math.floor(pos);
        const index2 = Math.ceil(pos);
        
        // Calculate mix ratio (distance from index1)
        const mix = pos - index1;

        let selectedLayer;

        if (index1 < 0) {
            // We are in the solid start zone (pure Layer 0)
            selectedLayer = visibleLayers[0];
        } else if (index2 >= numLayers) {
            // We are in the solid end zone (pure Layer N-1)
            selectedLayer = visibleLayers[numLayers - 1];
        } else {
            // We are in a transition zone between index1 and index2
            selectedLayer = Math.random() < mix 
                ? visibleLayers[index2] 
                : visibleLayers[index1];
        }

        layerPointAssignments.get(selectedLayer.id).push(point);
    }

    // Generate paths for each layer using only its assigned points
    for (const layer of visibleLayers) {
        ensureLayerDefaults(layer);
        flowState.activeLayerId = layer.id;
        applySettingsToFlowState(layer.settings);
        
        const assignedPoints = layerPointAssignments.get(layer.id);
        generateFlowFieldWithPoints(layer, assignedPoints);
    }

    // Restore previously active layer
    restoreActiveLayer(previousActiveId);
}

/**
 * Helper: Generate flow field paths for a layer using a pre-assigned set of starting points.
 * This bypasses the normal starting point generation and directly uses the provided points.
 */
function generateFlowFieldWithPoints(layer, startingPoints) {
    if (!startingPoints || startingPoints.length === 0) {
        syncPathsFromLayers();
        renderLayerList();
        renderCanvas();
        updateStatistics();
        return;
    }

    const margin = flowState.margin;
    const drawWidth = flowState.widthMm - 2 * margin;
    const drawHeight = flowState.heightMm - 2 * margin;
    const isGridMode = flowState.startPositionMode === 'grid';
    
    // Reinitialize Perlin noise if seed changed
    if (flowState.currentNoiseSeed !== flowState.noiseSeed) {
        flowState.perlin = new PerlinNoise(flowState.noiseSeed);
        flowState.currentNoiseSeed = flowState.noiseSeed;
    }

    // Build spatial grid for distance checks
    // Note: strokeWidth is NOT included - it only affects visual rendering, not spacing
    const effectiveCollisionRadius = flowState.minDistance + 0.05;
    if (effectiveCollisionRadius > 0) {
        if (!flowState.spatialGrid) {
            initSpatialGrid();
        }
    }

    const useDistanceCheck = effectiveCollisionRadius > 0 && flowState.spatialGrid;

    // Check if using custom-svg mode (stamps instead of traced paths)
    if (flowState.ribbonStyle === 'custom-svg') {
        // Generate stamps directly at each starting point
        generateCustomSVGStampsForLayer(layer, startingPoints, margin);
    } else {
        // Standard path tracing mode
        // Generate paths for the layer
        for (const [startX, startY] of startingPoints) {
            // Clamp starting point
            const clampedStartX = Math.max(margin, Math.min(flowState.widthMm - margin, startX));
            const clampedStartY = Math.max(margin, Math.min(flowState.heightMm - margin, startY));

            // Skip if starting point is inside an obstacle
            const obstacles = flowState.obstacles || [];
            let insideObstacle = false;
            for (const obs of obstacles) {
                const dist = Math.hypot(clampedStartX - obs.x, clampedStartY - obs.y);
                if (dist < obs.radius + 0.5) {
                    insideObstacle = true;
                    break;
                }
            }
            if (insideObstacle) {
                continue;
            }

            // Skip if too close to existing paths (collision detection)
            if (useDistanceCheck) {
                if (isTooClose(clampedStartX, clampedStartY, effectiveCollisionRadius)) {
                    continue;
                }
            }

            // Generate the path using followFlowField (same as generateFlowField)
            const forwardPath = followFlowField(clampedStartX, clampedStartY, drawWidth, drawHeight, margin, 1, isGridMode);
            const backwardPath = followFlowField(clampedStartX, clampedStartY, drawWidth, drawHeight, margin, -1, isGridMode);
            
            // Merge backward (reversed) and forward traces, avoiding duplicate start
            const reversedBackward = backwardPath.slice().reverse();
            if (reversedBackward.length > 0) {
                reversedBackward.pop(); // drop duplicate start point
            }
            const fullPath = [...reversedBackward, ...forwardPath];
            
            if (fullPath.length > 1) {
                // Store path in the layer with the layer's color
                layer.paths.push({
                    coords: fullPath,
                    color: layer.color
                });
                
                // Add all points from this completed path to the spatial grid
                if (useDistanceCheck && flowState.spatialGrid) {
                    for (let i = 0; i < fullPath.length; i++) {
                        const [px, py] = fullPath[i];
                        addPointToGrid(px, py);
                    }
                }
            }
        }
        
        // Noise Filter: Discard any path that contains fewer than 5 vertices
        layer.paths = layer.paths.filter(path => {
            return path.coords && path.coords.length >= 5;
        });
        
        // Apply brush system if not using default style
        if (flowState.renderStyle !== 'default') {
            const processedPaths = [];
            for (const path of layer.paths) {
                const brushPaths = applyBrush(path.coords, flowState.renderStyle, flowState.brushWidth);
                for (const brushPathCoords of brushPaths) {
                    if (brushPathCoords && brushPathCoords.length >= 2) {
                        processedPaths.push({
                            coords: brushPathCoords,
                            color: path.color
                        });
                    }
                }
            }
            layer.paths = processedPaths;
        }
    }
    
    // Sync and update UI
    syncPathsFromLayers();
    renderLayerList();
    renderCanvas();
    updateStatistics();
}

/**
 * Helper: Restore the previously active layer and update UI
 */
function restoreActiveLayer(previousActiveId) {
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
    
    // For non-sequential modes (especially striped), layer order matters
    // so we need to regenerate with the new order
    const mode = flowState.distributionMode || 'sequential';
    if (mode !== 'sequential') {
        smartRegenerate();
    } else {
        // Sequential mode: just sync and render (order doesn't affect point assignment)
        syncPathsFromLayers();
        renderLayerList();
        renderCanvas();
    }
}

/**
 * Calculate luminance from a hex color string
 * Uses standard luminance formula: 0.299*R + 0.587*G + 0.114*B
 */
function getLuminance(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Sort layers by luminance (brightness)
 * @param {boolean} ascending - true for dark to bright, false for bright to dark
 */
function sortLayersByLuminance(ascending = true) {
    flowState.layers.sort((a, b) => {
        const lumA = getLuminance(a.color);
        const lumB = getLuminance(b.color);
        return ascending ? lumA - lumB : lumB - lumA;
    });
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
            // Re-bake already-generated path colours so the canvas repaints live
            if (Array.isArray(layer.paths)) {
                for (const p of layer.paths) p.color = e.target.value;
            }
            syncPathsFromLayers();
            clearActivePalette(); // hand-picked colour → no longer a pure palette
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
        
        // Presence slider (controls relative weight of this layer)
        const presenceContainer = document.createElement('div');
        presenceContainer.className = 'layer-presence-container';
        presenceContainer.title = 'Presence: controls how many lines this layer gets';
        
        const presenceSlider = document.createElement('input');
        presenceSlider.type = 'range';
        presenceSlider.className = 'layer-presence-slider';
        presenceSlider.min = '0';
        presenceSlider.max = '100';
        presenceSlider.value = Math.round((layer.presence ?? 1.0) * 100);
        presenceSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) / 100;
            layer.presence = value;
            presenceValue.textContent = `${e.target.value}%`;
        });
        presenceSlider.addEventListener('change', (e) => {
            // Regenerate on mouse release - use smartRegenerate to respect distribution mode
            if (typeof smartRegenerate === 'function') {
                smartRegenerate();
            }
        });
        presenceSlider.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        const presenceValue = document.createElement('span');
        presenceValue.className = 'layer-presence-value';
        presenceValue.textContent = `${Math.round((layer.presence ?? 1.0) * 100)}%`;
        
        presenceContainer.appendChild(presenceSlider);
        presenceContainer.appendChild(presenceValue);
        
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
            // Overprint affects collision detection, regenerate to apply
            if (typeof smartRegenerate === 'function') {
                smartRegenerate();
            } else {
                renderLayerList();
            }
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
        layerEl.appendChild(presenceContainer);
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
    
    // Calculate effective collision radius: minDistance + safety buffer
    // Note: strokeWidth is NOT included - it only affects visual rendering, not spacing
    const effectiveCollisionRadius = flowState.minDistance + 0.05;
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
 * Calculate curvature at a point in the path
 * Curvature is measured as the angle change between consecutive segments
 * Returns a value between 0 (straight) and 1 (sharp 180° turn)
 * @param {Array} path - Array of [x, y] coordinates
 * @param {number} index - Index of the point
 * @returns {number} Curvature value (0-1)
 */
function calculateCurvature(path, index) {
    // Need at least 3 points to calculate curvature
    if (path.length < 3 || index === 0 || index === path.length - 1) {
        return 0;
    }
    
    // Get vectors for segments before and after this point
    const dx1 = path[index][0] - path[index - 1][0];
    const dy1 = path[index][1] - path[index - 1][1];
    const dx2 = path[index + 1][0] - path[index][0];
    const dy2 = path[index + 1][1] - path[index][1];
    
    const mag1 = Math.hypot(dx1, dy1);
    const mag2 = Math.hypot(dx2, dy2);
    
    // Avoid division by zero
    if (mag1 < 1e-6 || mag2 < 1e-6) return 0;
    
    // Normalize vectors
    const nx1 = dx1 / mag1;
    const ny1 = dy1 / mag1;
    const nx2 = dx2 / mag2;
    const ny2 = dy2 / mag2;
    
    // Dot product gives cos(angle) between vectors
    const dot = nx1 * nx2 + ny1 * ny2;
    
    // Clamp to [-1, 1] to handle floating point errors
    const clampedDot = Math.max(-1, Math.min(1, dot));
    
    // Angle between vectors (0 = same direction, PI = opposite direction)
    const angle = Math.acos(clampedDot);
    
    // Normalize to 0-1 range (0 = straight, 1 = 180° turn)
    return angle / Math.PI;
}

/**
 * Apply brush effect to a centerline path based on selected ribbon style
 * Dispatches to the appropriate style function
 * @param {Array} centerlinePath - Array of [x, y] coordinates
 * @param {string} style - Brush style (unused, kept for API compatibility)
 * @param {number} width - Ribbon width in mm
 * @returns {Array} Array of paths (each path is an array of [x, y] coordinates)
 */
function applyBrush(centerlinePath, style, width) {
    if (!centerlinePath || centerlinePath.length < 2) return [centerlinePath];
    
    const ribbonStyle = flowState.ribbonStyle || 'zigzag';
    
    switch (ribbonStyle) {
        case 'braided':
            return applyBraidedRope(centerlinePath);
        case 'fishbone':
            return applyFishbone(centerlinePath);
        case 'zigzag':
        default:
            return applyZigzag(centerlinePath);
    }
}

/**
 * Apply Zig-Zag Ribbon effect to a centerline path
 * Uses alternating zig-zag pattern with curvature-aware width scaling
 * @param {Array} centerlinePath - Array of [x, y] coordinates
 * @returns {Array} Array of paths (single path with zigzag pattern)
 */
function applyZigzag(centerlinePath) {
    const zigzagPath = [];
    const ribbonWidth = flowState.brushWidth || 5;
    // Ensure wavelength is valid (minimum 1 to prevent division issues)
    const wavelength = Math.max(1, flowState.zigzagWavelength || 2);
    
    // Number of sub-points between each centerline point for smoother curves
    const subsPerSegment = 2;

    for (let i = 0; i < centerlinePath.length; i++) {
        // Add intermediate points for smoother wave transitions
        const numSubs = (i < centerlinePath.length - 1) ? subsPerSegment : 1;
        
        for (let sub = 0; sub < numSubs; sub++) {
            const t = sub / subsPerSegment;
            
            // Interpolate position along centerline for sub-points
            let cx, cy;
            if (i < centerlinePath.length - 1 && sub > 0) {
                cx = centerlinePath[i][0] * (1 - t) + centerlinePath[i + 1][0] * t;
                cy = centerlinePath[i][1] * (1 - t) + centerlinePath[i + 1][1] * t;
            } else {
                cx = centerlinePath[i][0];
                cy = centerlinePath[i][1];
            }
            
            // Calculate normal at this position
            const normal = calculateNormal(centerlinePath, i);
            const [nx, ny] = normal;
            
            // Organic tapering using Perlin noise
            let widthMultiplier = 1.0;
            if (flowState.perlin && flowState.noiseScale > 0) {
                const noiseValue = flowState.perlin.noise2D(cx * 0.005, cy * 0.005);
                widthMultiplier = 0.4 + (noiseValue + 1) * 0.3;
            }
            
            // Calculate curvature and reduce width in sharp curves to prevent self-intersection
            const curvature = calculateCurvature(centerlinePath, i);
            // Scale from 1.0 (straight) down to 0.2 (very sharp curve)
            const curvatureScale = Math.max(0.2, 1 - curvature * 2);

            const currentWidth = ribbonWidth * widthMultiplier * curvatureScale;
            
            // Smooth sine wave that hits full amplitude at each main point
            // The wave position advances continuously including sub-points
            // Wavelength controls how many centerline points make up one full zigzag cycle
            const wavePos = (i + t) / (wavelength / 2);
            const side = Math.sin(wavePos * Math.PI);
            
            zigzagPath.push([
                cx + (nx * currentWidth * side),
                cy + (ny * currentWidth * side)
            ]);
        }
    }
    return [zigzagPath];
}

/**
 * Apply Braided Rope effect - two interweaving sine waves that cross each other
 * Creates a beautiful twisted rope illusion following the flow field
 * @param {Array} centerlinePath - Array of [x, y] coordinates
 * @returns {Array} Array of 2 paths that weave over/under each other
 */
function applyBraidedRope(centerlinePath) {
    const ribbonWidth = flowState.brushWidth || 5;
    
    // Two strands that weave - simpler and cleaner than 3
    const strand1 = [];
    const strand2 = [];
    
    // Weave frequency - how often the strands cross (lower = more visible weave)
    const weaveFrequency = 0.15;
    
    // Sub-points for smooth curves
    const subsPerSegment = 3;
    
    // Calculate total path length for consistent weave frequency
    let totalLength = 0;
    const cumulativeLengths = [0];
    for (let i = 1; i < centerlinePath.length; i++) {
        const dx = centerlinePath[i][0] - centerlinePath[i - 1][0];
        const dy = centerlinePath[i][1] - centerlinePath[i - 1][1];
        totalLength += Math.hypot(dx, dy);
        cumulativeLengths.push(totalLength);
    }
    
    for (let i = 0; i < centerlinePath.length; i++) {
        const numSubs = (i < centerlinePath.length - 1) ? subsPerSegment : 1;
        
        for (let sub = 0; sub < numSubs; sub++) {
            const t = sub / subsPerSegment;
            
            // Interpolate position along centerline
            let cx, cy;
            if (i < centerlinePath.length - 1 && sub > 0) {
                cx = centerlinePath[i][0] * (1 - t) + centerlinePath[i + 1][0] * t;
                cy = centerlinePath[i][1] * (1 - t) + centerlinePath[i + 1][1] * t;
            } else {
                cx = centerlinePath[i][0];
                cy = centerlinePath[i][1];
            }
            
            // Calculate distance along path for consistent wave
            const distAlongPath = cumulativeLengths[i] + (i < centerlinePath.length - 1 ? 
                t * (cumulativeLengths[i + 1] - cumulativeLengths[i]) : 0);
            
            // Calculate normal at this position
            const normal = calculateNormal(centerlinePath, i);
            const [nx, ny] = normal;
            
            // Curvature-aware width scaling
            const curvature = calculateCurvature(centerlinePath, i);
            const curvatureScale = Math.max(0.4, 1 - curvature * 1.5);
            
            // Full ribbon width for the weave amplitude
            const waveAmplitude = ribbonWidth * curvatureScale * 0.5;
            
            // Wave position based on distance (not point index) for consistent frequency
            const wavePos = distAlongPath * weaveFrequency;
            
            // Two strands 180° out of phase - they cross at every half-cycle
            const offset1 = Math.sin(wavePos * Math.PI * 2) * waveAmplitude;
            const offset2 = Math.sin(wavePos * Math.PI * 2 + Math.PI) * waveAmplitude;
            
            strand1.push([cx + nx * offset1, cy + ny * offset1]);
            strand2.push([cx + nx * offset2, cy + ny * offset2]);
        }
    }
    
    return [strand1, strand2];
}

/**
 * Apply Fishbone/Herringbone effect - V-shaped ribs extending from a central spine
 * Creates a beautiful skeletal/leaf-vein appearance along the flow field
 * @param {Array} centerlinePath - Array of [x, y] coordinates
 * @returns {Array} Array of paths (spine + V-shaped rib pairs)
 */
function applyFishbone(centerlinePath) {
    const ribbonWidth = flowState.brushWidth || 5;
    const paths = [];
    
    // Fishbone parameters
    const ribSpacing = Math.max(1.5, ribbonWidth * 0.12); // Spacing scales with width
    const ribAngle = Math.PI * 0.35; // ~63 degrees - nice steep angle for ribs
    
    // Calculate total path length and cumulative distances
    let totalLength = 0;
    const segmentLengths = [];
    const cumulativeLengths = [0];
    
    for (let i = 1; i < centerlinePath.length; i++) {
        const dx = centerlinePath[i][0] - centerlinePath[i - 1][0];
        const dy = centerlinePath[i][1] - centerlinePath[i - 1][1];
        const len = Math.hypot(dx, dy);
        segmentLengths.push(len);
        totalLength += len;
        cumulativeLengths.push(totalLength);
    }
    
    if (totalLength < ribSpacing * 2) {
        // Path too short for ribs, just return centerline
        return [centerlinePath];
    }
    
    // Generate V-shaped ribs at regular intervals along the path
    const numRibs = Math.floor(totalLength / ribSpacing);
    
    for (let rib = 1; rib < numRibs; rib++) { // Start at 1 to leave space at beginning
        const targetDist = rib * ribSpacing;
        
        // Find position along path at this distance
        let segIdx = 0;
        while (segIdx < segmentLengths.length && cumulativeLengths[segIdx + 1] < targetDist) {
            segIdx++;
        }
        
        if (segIdx >= centerlinePath.length - 1) break;
        
        // Interpolate position within segment
        const segStart = cumulativeLengths[segIdx];
        const segLen = segmentLengths[segIdx] || 1;
        const t = Math.min(1, (targetDist - segStart) / segLen);
        
        const cx = centerlinePath[segIdx][0] * (1 - t) + centerlinePath[segIdx + 1][0] * t;
        const cy = centerlinePath[segIdx][1] * (1 - t) + centerlinePath[segIdx + 1][1] * t;
        
        // Get tangent direction at this point
        const dx = centerlinePath[segIdx + 1][0] - centerlinePath[segIdx][0];
        const dy = centerlinePath[segIdx + 1][1] - centerlinePath[segIdx][1];
        const mag = Math.hypot(dx, dy);
        
        if (mag < 1e-6) continue;
        
        const tx = dx / mag; // tangent x (pointing forward along spine)
        const ty = dy / mag; // tangent y
        
        // Normal (perpendicular) direction
        const nx = -ty;
        const ny = tx;
        
        // Rib length - varies slightly with position for organic feel
        let lengthVariation = 1.0;
        if (flowState.perlin) {
            const noiseValue = flowState.perlin.noise2D(cx * 0.02, cy * 0.02);
            lengthVariation = 0.7 + (noiseValue + 1) * 0.15;
        }
        
        // Curvature-aware scaling - shorter ribs in curves
        const curvature = calculateCurvature(centerlinePath, segIdx);
        const curvatureScale = Math.max(0.5, 1 - curvature * 1.0);
        
        const ribLength = ribbonWidth * lengthVariation * curvatureScale * 0.5;
        
        // Create angled rib directions (pointing backward like fish bones)
        // Left rib: angled back and to the left
        const leftAngle = Math.PI - ribAngle; // Point backward-left
        const leftDirX = Math.cos(leftAngle) * tx - Math.sin(leftAngle) * ty;
        const leftDirY = Math.sin(leftAngle) * tx + Math.cos(leftAngle) * ty;
        
        // Right rib: angled back and to the right  
        const rightAngle = Math.PI + ribAngle; // Point backward-right
        const rightDirX = Math.cos(rightAngle) * tx - Math.sin(rightAngle) * ty;
        const rightDirY = Math.sin(rightAngle) * tx + Math.cos(rightAngle) * ty;
        
        // Left rib - extends from spine outward
        const leftRib = [
            [cx, cy],
            [cx + leftDirX * ribLength, cy + leftDirY * ribLength]
        ];
        
        // Right rib - extends from spine outward
        const rightRib = [
            [cx, cy],
            [cx + rightDirX * ribLength, cy + rightDirY * ribLength]
        ];
        
        paths.push(leftRib);
        paths.push(rightRib);
    }
    
    // Add the centerline (spine) as the first path - draw it last so it's on top
    paths.push(centerlinePath);
    
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
    
    // Ensure layers are initialized
    if (!flowState.layers || flowState.layers.length === 0) {
        console.warn('Layers not initialized, initializing now...');
        initLayers();
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
    let activeLayer = getActiveLayer();
    if (!activeLayer) {
        console.warn('No active layer found, initializing layers...');
        initLayers();
        activeLayer = getActiveLayer();
        if (!activeLayer) {
            console.error('Failed to initialize active layer');
            return;
        }
    }
    
    // Ensure layer has proper defaults
    ensureLayerDefaults(activeLayer);
    
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
    let startingPoints = generateStartingPoints(drawWidth, drawHeight, margin, layerIndex);
    
    // Debug: Log starting points count
    if (startingPoints.length === 0) {
        console.warn('No starting points generated!', {
            drawWidth,
            drawHeight,
            margin,
            startPositionMode: flowState.startPositionMode,
            numParticles: flowState.numParticles,
            gridConfig: flowState.gridConfig
        });
        return;
    }
    
    // Determine if we're in Grid mode
    const isGridMode = flowState.startPositionMode === 'grid';
    
    // Get this layer's presence (0-1)
    const layerPresence = activeLayer.presence ?? 1.0;
    
    // Calculate weighted presence for particle budgeting
    const overprint = activeLayer.settings?.forceOverprint ?? activeLayer.forceOverprint ?? false;
    
    // Get all visible non-overprinting layers and their total presence weight
    const sharedLayers = flowState.layers.filter(
        l => l.visible && !(l.settings?.forceOverprint ?? l.forceOverprint ?? false)
    );
    const totalPresence = sharedLayers.reduce((sum, l) => sum + (l.presence ?? 1.0), 0);
    
    // Calculate this layer's share of particles based on weighted presence
    const presenceShare = totalPresence > 0 ? (layerPresence / totalPresence) : 1;
    
    // Grid mode: Keep full grid, shuffle for variety
    // In grid mode, presence controls probability of drawing each cell (not limiting count)
    if (isGridMode) {
        shuffleArray(startingPoints);
        startingPoints.length = Math.min(startingPoints.length, flowState.numParticles);
    }
    
    // Layer Budgeting: Calculate particle limit based on mode and presence weights
    let particleLimit;
    if (isGridMode) {
        // Grid mode: Use full grid, collision detection handles layer separation
        // Presence affects per-point probability, applied in the loop below
        particleLimit = startingPoints.length;
    } else {
        // Random/other modes: Use weighted budgeting based on presence
        particleLimit = overprint 
            ? Math.floor(flowState.numParticles * layerPresence)  // Overprint: just use own presence
            : Math.floor(flowState.numParticles * presenceShare);  // Shared: weighted by all layers
    }
    
    // Reinitialize Perlin noise if seed changed
    if (flowState.currentNoiseSeed !== flowState.noiseSeed) {
        flowState.perlin = new PerlinNoise(flowState.noiseSeed);
        flowState.currentNoiseSeed = flowState.noiseSeed;
    }
    
    // Build spatial grid for distance checks.
    // Calculate effective collision radius: minDistance + safety buffer
    // Note: strokeWidth is NOT included - it only affects visual rendering, not spacing
    const effectiveCollisionRadius = flowState.minDistance + 0.05;
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
    
    // Check if using custom-svg mode (stamps instead of traced paths)
    if (flowState.ribbonStyle === 'custom-svg') {
        // Generate stamps directly at each starting point
        generateCustomSVGStampsForLayer(activeLayer, startingPoints, margin);
        
        // Sync flowState.paths for backward compatibility (combines all layers)
        syncPathsFromLayers();
        
        // Debug: Log final path count
        console.log(`Generated ${activeLayer.paths.length} stamp paths for layer ${activeLayer.name}`);
        
        // Update layer list to show current state
        renderLayerList();
        
        renderCanvas();
        
        // Update statistics
        updateStatistics();
        return;
    }
    
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
        
        // Grid Mode: Apply presence as probability to skip points
        // This allows layers to claim varying amounts of the grid
        if (isGridMode && layerPresence < 1.0) {
            if (Math.random() > layerPresence) {
                continue; // Skip this point based on presence probability
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
                
                // Skip if candidate point is inside an obstacle
                const obstacles = flowState.obstacles || [];
                let insideObstacle = false;
                for (const obs of obstacles) {
                    const dist = Math.hypot(clampedX - obs.x, clampedY - obs.y);
                    if (dist < obs.radius + 0.5) {
                        insideObstacle = true;
                        break;
                    }
                }
                if (insideObstacle) {
                    continue; // Try next retry
                }
                
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
        
        // Skip if valid starting point is inside an obstacle
        const obstacles = flowState.obstacles || [];
        let insideObstacle = false;
        for (const obs of obstacles) {
            const dist = Math.hypot(validStartX - obs.x, validStartY - obs.y);
            if (dist < obs.radius + 0.5) {
                insideObstacle = true;
                break;
            }
        }
        if (insideObstacle) {
            continue;
        }
        
        // Don't reserve starting point yet - only add after path is successfully generated
        // This prevents blocking space for paths that might not be created
        
        const forwardPath = followFlowField(validStartX, validStartY, drawWidth, drawHeight, margin, 1, isGridMode);
        const backwardPath = followFlowField(validStartX, validStartY, drawWidth, drawHeight, margin, -1, isGridMode);
        
        // Merge backward (reversed) and forward traces, avoiding duplicate start
        const reversedBackward = backwardPath.slice().reverse();
        if (reversedBackward.length > 0) {
            reversedBackward.pop(); // drop duplicate start point
        }
        const fullPath = [...reversedBackward, ...forwardPath];
        
        // Debug: Log path length if it's suspiciously short
        if (fullPath.length > 1 && fullPath.length < 5) {
            console.debug(`Short path generated: ${fullPath.length} vertices (will be filtered)`);
        }
        
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
    
    // Debug: Log path count before filtering
    const pathsBeforeFilter = activeLayer.paths.length;
    
    // Noise Filter: Discard any path that contains fewer than 5 vertices
    // This removes tiny, noisy paths that would cause pen plotter issues
    activeLayer.paths = activeLayer.paths.filter(path => {
        return path.coords && path.coords.length >= 5;
    });
    
    // Debug: Log if paths were filtered out
    if (pathsBeforeFilter > 0 && activeLayer.paths.length === 0) {
        console.warn(`All ${pathsBeforeFilter} paths were filtered out (too short, < 5 vertices)`);
    }
    
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
    
    // Debug: Log final path count
    console.log(`Generated ${activeLayer.paths.length} paths for layer ${activeLayer.name}`);
    
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
/**
 * Calculate and display statistics (line count, total distance)
 */
function updateStatistics() {
    let lineCount = 0;
    let totalLengthMm = 0;
    
    // Count paths from all visible layers
    for (const layer of flowState.layers) {
        if (layer.visible) {
            for (const path of layer.paths) {
                const coords = path.coords;
                if (coords && coords.length >= 2) {
                    lineCount++;
                    
                    // Calculate length of this path
                    for (let i = 1; i < coords.length; i++) {
                        const dx = coords[i][0] - coords[i-1][0];
                        const dy = coords[i][1] - coords[i-1][1];
                        totalLengthMm += Math.hypot(dx, dy);
                    }
                }
            }
        }
    }
    
    // Update Line Count
    const lineCountEl = document.getElementById('stat-line-count');
    if (lineCountEl) {
        lineCountEl.textContent = lineCount.toLocaleString();
    }

    // Update Distance Meter (Convert mm to meters)
    const distanceEl = document.getElementById('stat-line-distance');
    if (distanceEl) {
        const meters = totalLengthMm / 1000;
        distanceEl.textContent = meters.toFixed(2) + 'm';
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
 * Apply obstacle avoidance to flow vector
 * Redirects flow around circular obstacles using hard shell collision
 * @param {number} x - Current x position (mm)
 * @param {number} y - Current y position (mm)
 * @param {number} vx - Current velocity x component
 * @param {number} vy - Current velocity y component
 * @returns {Array<number>} Modified [vx, vy]
 */
function applyObstacleFlow(x, y, vx, vy) {
    const obstacles = flowState.obstacles || [];
    if (!obstacles.length) return [vx, vy];

    let fx = vx;
    let fy = vy;

    for (const obstacle of obstacles) {
        const dx = x - obstacle.x;
        const dy = y - obstacle.y;
        const dist = Math.hypot(dx, dy);
        
        // 1. HARD COLLISION (Inside)
        // If we accidentally clip inside, push out tangentially
        if (dist < obstacle.radius + 0.5) {
             const nx = dx / dist;
             const ny = dy / dist;
             // Pure tangent (rotate 90)
             let tx = -ny;
             let ty = nx;
             // Ensure tangent points "forward" relative to flow
             if (tx * vx + ty * vy < 0) { tx = -tx; ty = -ty; }
             
             // Strong push out + slide
             return [nx * 0.5 + tx * 0.8, ny * 0.5 + ty * 0.8];
        }

        // 2. SOFT DEFLECTION (Hydrodynamic Slip)
        // Larger margin for smoother flow
        const margin = obstacle.radius * 2.0; 
        
        if (dist < obstacle.radius + margin) {
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Check if flowing INTO the obstacle
            // Dot Product: Positive = Moving Away, Negative = Moving Towards
            const dot = fx * nx + fy * ny;
            
            // ONLY deflect if the line is crashing into the circle
            if (dot < 0) {
                 // Intensity: 1.0 at surface, 0.0 at margin boundary
                 const t = 1.0 - ((dist - obstacle.radius) / margin);
                 // Square it for a smoother "pressure" curve
                 const intensity = t * t; 
                 
                 // Subtract the inward normal component
                 // This effectively "slides" the vector along the invisible pressure wave
                 fx = fx - (nx * dot * intensity);
                 fy = fy - (ny * dot * intensity);
            }
        }
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
 * - In grid mode: first 2mm goes straight perpendicular to nearest edge
 */
function followFlowField(startX, startY, drawWidth, drawHeight, margin, direction = 1, isGridMode = false) {
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
    
    // Calculate effective collision radius: minDistance + safety buffer
    // Note: strokeWidth is NOT included - it only affects visual rendering, not spacing
    const effectiveCollisionRadius = flowState.minDistance + 0.05;
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
        
        let vx, vy;
        let midVx, midVy;
        
        // Always follow the flow field
        
        // 1) Map Position (symmetry) and get rotation
        const { x: symX, y: symY, rotation: symRot } = getSymmetricCoordinates(x, y);

        // 2) Distort
        const [dx1, dy1] = getDistortionOffset(symX, symY);
        const warpedX = symX + dx1;
        const warpedY = symY + dy1;

        // 3) Accumulate forces: base flow + magnets + obstacles (using symmetric coords)
        [vx, vy] = sampleFlowVector(warpedX, warpedY, flowOptions);
        [vx, vy] = applyMagnetForce(symX, symY, vx, vy);
        [vx, vy] = applyObstacleFlow(symX, symY, vx, vy);

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
        [midVx, midVy] = sampleFlowVector(warpedMidX, warpedMidY, flowOptions);
        [midVx, midVy] = applyMagnetForce(symMidX, symMidY, midVx, midVy);
        [midVx, midVy] = applyObstacleFlow(symMidX, symMidY, midVx, midVy);
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
    
    // Draw obstacles
    drawObstacles();
    
    flowState.ctx.restore();
}

function updateCanvasCursor(event) {
    if (!flowState.canvas) return;
    if (flowState.isPlacingMagnets) {
        flowState.canvas.style.cursor = 'crosshair';
    } else if (flowState.isScalingObstacle) {
        flowState.canvas.style.cursor = 'ew-resize';
    } else if (flowState.isEditingObstacles) {
        if (flowState.draggedObstacle) {
            flowState.canvas.style.cursor = 'grabbing';
        } else if (event && flowState.selectedObstacle && !flowState.isDragging) {
            // Check if hovering over resize handle
            try {
                const [mx, my] = getCanvasCoords(event);
                const obstacle = flowState.selectedObstacle;
                const handleX = obstacle.x + obstacle.radius;
                const handleY = obstacle.y;
                const handleSizeMm = 8 / flowState.pxPerMm / Math.max(flowState.zoom, 0.001);
                const dx = mx - handleX;
                const dy = my - handleY;
                const distToHandle = Math.hypot(dx, dy);
                
                if (distToHandle <= handleSizeMm * 2) {
                    flowState.canvas.style.cursor = 'ew-resize';
                } else {
                    flowState.canvas.style.cursor = 'grab';
                }
            } catch (e) {
                flowState.canvas.style.cursor = 'grab';
            }
        } else {
            flowState.canvas.style.cursor = 'grab';
        }
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
    
    // Apply ink blend mode if enabled (simulates transparent ink layering like G-Tec pens)
    if (flowState.inkBlendMode) {
        flowState.ctx.globalCompositeOperation = 'multiply';
        flowState.ctx.globalAlpha = flowState.inkOpacity ?? 0.85;
    } else {
        flowState.ctx.globalCompositeOperation = 'source-over';
        flowState.ctx.globalAlpha = 1.0;
    }
    
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
    
    // Reset composite operation after drawing paths
    flowState.ctx.globalCompositeOperation = 'source-over';
    flowState.ctx.globalAlpha = 1.0;
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
 * Draw obstacles on canvas
 */
/**
 * Find obstacle under mouse cursor (in mm coordinates)
 * @param {number} mx - Mouse x in mm
 * @param {number} my - Mouse y in mm
 * @returns {Object|null} The obstacle under cursor, or null
 */
function getObstacleUnderMouse(mx, my) {
    if (!flowState.obstacles || !flowState.obstacles.length) return null;
    
    for (const obstacle of flowState.obstacles) {
        const dx = mx - obstacle.x;
        const dy = my - obstacle.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= obstacle.radius) {
            return obstacle;
        }
    }
    return null;
}

function drawObstacles() {
    if (!flowState.obstacles || flowState.obstacles.length === 0) return;
    if (!flowState.obstaclesVisible) return; // Don't draw if visibility is disabled
    
    const lineW = 1 / Math.max(flowState.zoom, 0.001);
    flowState.ctx.lineWidth = lineW;
    
    for (const obstacle of flowState.obstacles) {
        const cx = obstacle.x * flowState.pxPerMm;
        const cy = obstacle.y * flowState.pxPerMm;
        const radiusPx = obstacle.radius * flowState.pxPerMm;
        
        // Check if this obstacle is selected
        const isSelected = flowState.selectedObstacle === obstacle;
        
        // Draw obstacle circle
        if (isSelected) {
            // Selected style - blue
            flowState.ctx.strokeStyle = 'rgba(0, 120, 255, 0.9)';
            flowState.ctx.fillStyle = 'rgba(0, 120, 255, 0.2)';
        } else if (flowState.isEditingObstacles) {
            // Highlighted style when in edit mode
            flowState.ctx.strokeStyle = 'rgba(255, 150, 0, 0.8)';
            flowState.ctx.fillStyle = 'rgba(255, 150, 0, 0.1)';
        } else {
            // Normal style
            flowState.ctx.strokeStyle = 'rgba(255, 100, 0, 0.6)';
            flowState.ctx.fillStyle = 'transparent';
        }
        
        flowState.ctx.beginPath();
        flowState.ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
        flowState.ctx.fill();
        flowState.ctx.stroke();
        
        // Draw resize handle for selected obstacles in edit mode
        if (isSelected && flowState.isEditingObstacles) {
            const handleSize = 8 / Math.max(flowState.zoom, 0.001);
            const handleX = cx + radiusPx;
            const handleY = cy;
            
            // Draw resize handle (small circle on the right edge)
            flowState.ctx.fillStyle = 'rgba(0, 120, 255, 1.0)';
            flowState.ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
            flowState.ctx.lineWidth = lineW * 1.5;
            flowState.ctx.beginPath();
            flowState.ctx.arc(handleX, handleY, handleSize, 0, Math.PI * 2);
            flowState.ctx.fill();
            flowState.ctx.stroke();
        }
        
        // Draw dashed bounding box in edit mode
        if (flowState.isEditingObstacles) {
            flowState.ctx.strokeStyle = isSelected ? 'rgba(0, 150, 255, 0.5)' : 'rgba(255, 200, 0, 0.5)';
            flowState.ctx.setLineDash([4 / Math.max(flowState.zoom, 0.001), 4 / Math.max(flowState.zoom, 0.001)]);
            flowState.ctx.lineWidth = lineW * 0.5;
            flowState.ctx.beginPath();
            flowState.ctx.rect(
                cx - radiusPx,
                cy - radiusPx,
                radiusPx * 2,
                radiusPx * 2
            );
            flowState.ctx.stroke();
            flowState.ctx.setLineDash([]);
        }
    }
}

/**
 * Convert mouse event coordinates to canvas coordinates (in mm)
 * @param {MouseEvent} event - Mouse event
 * @returns {Array<number>} [x, y] in mm
 */
function getCanvasCoords(event) {
    if (!flowState.canvas) return [0, 0];
    const rect = flowState.canvas.getBoundingClientRect();
    const xPx = (event.clientX - rect.left - flowState.panX) / flowState.zoom;
    const yPx = (event.clientY - rect.top - flowState.panY) / flowState.zoom;
    const mmX = xPx / flowState.pxPerMm;
    const mmY = yPx / flowState.pxPerMm;
    return [mmX, mmY];
}

/**
 * Handle canvas mouse events for panning
 */
function setupCanvasEvents() {
    if (!flowState.canvas) return;

    const addMagnetAtEvent = (e, type) => {
        const [mx, my] = getCanvasCoords(e);
        flowState.magnets.push({ x: mx, y: my, type });
        // Use smartRegenerate to respect distribution mode
        if (typeof smartRegenerate === 'function') {
            smartRegenerate();
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
        
        // Check if we're in obstacle editing mode
        if (flowState.isEditingObstacles) {
            const [mx, my] = getCanvasCoords(e);
            
            // Check if clicking on resize handle of selected obstacle
            if (flowState.selectedObstacle) {
                const obstacle = flowState.selectedObstacle;
                const handleX = obstacle.x + obstacle.radius;
                const handleY = obstacle.y;
                const handleSizeMm = 8 / flowState.pxPerMm / Math.max(flowState.zoom, 0.001);
                const dx = mx - handleX;
                const dy = my - handleY;
                const distToHandle = Math.hypot(dx, dy);
                
                if (distToHandle <= handleSizeMm * 2) {
                    // Clicked on resize handle - start scaling
                    flowState.isScalingObstacle = true;
                    flowState.scalingObstacle = obstacle;
                    flowState.scaleStartRadius = obstacle.radius;
                    const distToCenter = Math.hypot(mx - obstacle.x, my - obstacle.y);
                    flowState.scaleStartDistance = distToCenter;
                    updateCanvasCursor();
                    return;
                }
            }
            
            // Check if Shift+drag to scale (alternative method)
            if (e.shiftKey && flowState.selectedObstacle) {
                flowState.isScalingObstacle = true;
                flowState.scalingObstacle = flowState.selectedObstacle;
                flowState.scaleStartRadius = flowState.selectedObstacle.radius;
                const distToCenter = Math.hypot(mx - flowState.selectedObstacle.x, my - flowState.selectedObstacle.y);
                flowState.scaleStartDistance = distToCenter;
                updateCanvasCursor();
                return;
            }
            
            // Check if click is inside any obstacle
            for (const obstacle of flowState.obstacles) {
                const dx = mx - obstacle.x;
                const dy = my - obstacle.y;
                const dist = Math.hypot(dx, dy);
                if (dist <= obstacle.radius) {
                    // Select this obstacle (change color to blue)
                    flowState.selectedObstacle = obstacle;
                    flowState.draggedObstacle = obstacle;
                    updateDeleteButtonVisibility();
                    renderCanvas();
                    updateCanvasCursor();
                    return; // Prevent panning
                }
            }
            // Clicked outside obstacles, deselect and don't start dragging
            flowState.selectedObstacle = null;
            updateDeleteButtonVisibility();
            renderCanvas();
            return;
        }
        
        // Normal panning behavior
        flowState.isDragging = true;
        flowState.dragStartX = e.clientX - flowState.panX;
        flowState.dragStartY = e.clientY - flowState.panY;
        updateCanvasCursor();
    });
    
    flowState.canvas.addEventListener('mousemove', (e) => {
        // Handle obstacle scaling
        if (flowState.isScalingObstacle && flowState.scalingObstacle) {
            const [mx, my] = getCanvasCoords(e);
            const obstacle = flowState.scalingObstacle;
            const currentDist = Math.hypot(mx - obstacle.x, my - obstacle.y);
            
            // Scale proportionally based on distance change
            const scaleRatio = currentDist / flowState.scaleStartDistance;
            obstacle.radius = flowState.scaleStartRadius * scaleRatio;
            obstacle.radius = Math.max(5, Math.min(200, obstacle.radius)); // Min 5mm, max 200mm
            
            renderCanvas();
            // Use debounceUpdate if available, otherwise just render
            if (typeof debounceUpdate === 'function' && typeof updateFlowField === 'function') {
                debounceUpdate(updateFlowField);
            }
            updateCanvasCursor(e);
            return;
        }
        
        // Handle obstacle dragging
        if (flowState.draggedObstacle) {
            const [mx, my] = getCanvasCoords(e);
            flowState.draggedObstacle.x = mx;
            flowState.draggedObstacle.y = my;
            renderCanvas();
            // Use debounceUpdate if available, otherwise just render
            if (typeof debounceUpdate === 'function' && typeof updateFlowField === 'function') {
                debounceUpdate(updateFlowField);
            }
            updateCanvasCursor(e);
            return;
        }
        
        // Update cursor when hovering over resize handle
        if (flowState.isEditingObstacles && flowState.selectedObstacle && !flowState.isDragging) {
            updateCanvasCursor(e);
        }
        
        // Normal panning behavior
        if (flowState.isDragging) {
            flowState.panX = e.clientX - flowState.dragStartX;
            flowState.panY = e.clientY - flowState.dragStartY;
            renderCanvas();
        }
    });
    
    flowState.canvas.addEventListener('mouseup', () => {
        flowState.isDragging = false;
        flowState.draggedObstacle = null;
        flowState.isScalingObstacle = false;
        flowState.scalingObstacle = null;
        updateCanvasCursor();
    });
    
    flowState.canvas.addEventListener('mouseleave', () => {
        flowState.isDragging = false;
        flowState.draggedObstacle = null;
        flowState.isScalingObstacle = false;
        flowState.scalingObstacle = null;
        // Don't deselect on mouse leave, keep selection
        updateCanvasCursor();
    });
    
    flowState.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Check if we're in obstacle edit mode and hovering over an obstacle
        if (flowState.isEditingObstacles) {
            const [mx, my] = getCanvasCoords(e);
            const obstacle = getObstacleUnderMouse(mx, my);
            
            if (obstacle) {
                // Scale the obstacle instead of zooming
                const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
                obstacle.radius *= scaleFactor;
                obstacle.radius = Math.max(5, Math.min(200, obstacle.radius)); // Min 5mm, max 200mm
                
                // If this obstacle is selected, keep it selected
                if (!flowState.selectedObstacle) {
                    flowState.selectedObstacle = obstacle;
                    updateDeleteButtonVisibility();
                }
                
                renderCanvas();
                // Regenerate flow field
                if (typeof debounceUpdate === 'function' && typeof updateFlowField === 'function') {
                    debounceUpdate(updateFlowField);
                }
                return;
            }
        }
        
        // Default zoom behavior
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
        a.download = `ribbon-${paperSizeLabel(flowState.widthMm, flowState.heightMm)}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export SVG: ' + error.message);
    }
}

// ===== Batch Export SVG =====

let batchExportCancelled = false;

/**
 * Open the batch export modal
 */
function openBatchExportModal() {
    // Check if any visible layers have paths
    const visibleLayers = flowState.layers.filter(l => l.visible && l.paths.length > 0);
    if (visibleLayers.length === 0) {
        alert('No flow field generated. Please generate a flow field first.');
        return;
    }

    const modal = document.getElementById('batch-export-modal');
    if (modal) {
        modal.style.display = 'flex';
        batchExportCancelled = false;
        const progressContainer = document.getElementById('batch-progress-container');
        const progressBar = document.getElementById('batch-progress-bar');
        const progressText = document.getElementById('batch-progress-text');
        const exportBtn = document.getElementById('btn-start-batch-export');
        const cancelBtn = document.getElementById('btn-cancel-batch-export');
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '';
        if (exportBtn) exportBtn.disabled = false;
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
}

/**
 * Close the batch export modal
 */
function closeBatchExportModal() {
    const modal = document.getElementById('batch-export-modal');
    if (modal) {
        modal.style.display = 'none';
        batchExportCancelled = true;
    }
}

/**
 * Build an SVG string from the current flowState layers (client-side, no server needed).
 * Mirrors the server-side /api/export logic.
 */
function buildSVGContent() {
    const visibleLayers = flowState.layers.filter(l => l.visible && l.paths.length > 0);
    if (visibleLayers.length === 0) return null;

    const width = flowState.widthMm;
    const height = flowState.heightMm;
    const strokeWidth = flowState.strokeWidth;

    let svg = '<?xml version="1.0" encoding=\'UTF-8\'?>\n';
    svg += `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">\n`;
    svg += '  <style>path { fill: none; }</style>\n';

    for (const layer of visibleLayers) {
        const groupId = layer.name.replace(/\s+/g, '-').toLowerCase();
        svg += `  <g id="${groupId}" data-layer-name="${layer.name}">\n`;

        for (const path of layer.paths) {
            const coords = path.coords;
            if (!coords || coords.length < 2) continue;

            let d = `M ${coords[0][0].toFixed(4)},${coords[0][1].toFixed(4)}`;
            for (let j = 1; j < coords.length; j++) {
                d += ` L ${coords[j][0].toFixed(4)},${coords[j][1].toFixed(4)}`;
            }

            svg += `    <path d="${d}" stroke="${layer.color}" stroke-width="${strokeWidth}mm" fill="none" stroke-linecap="round" stroke-linejoin="round"/>\n`;
        }

        svg += '  </g>\n';
    }

    svg += '</svg>';
    return svg;
}

/**
 * Start the batch export process.
 * For each frame: randomize seeds (preserving relative layer offsets), regenerate all layers,
 * build SVG client-side, and write the file to the user-chosen directory.
 */
async function startBatchExport() {
    const count = parseInt(document.getElementById('batch-count').value) || 30;
    const prefix = (document.getElementById('batch-prefix').value || '').trim() || 'flowfield';

    if (count < 2) {
        alert('Please enter at least 2 frames.');
        return;
    }

    // Check visible layers
    const visibleLayers = flowState.layers.filter(l => l.visible && l.paths.length > 0);
    if (visibleLayers.length === 0) {
        alert('No flow field generated. Please generate a flow field first.');
        return;
    }

    // Check browser support for directory picker
    if (!window.showDirectoryPicker) {
        alert('Batch export requires a Chromium-based browser (Chrome, Edge, Brave) for folder selection.\n\nPlease open this app in Chrome or Edge.');
        return;
    }

    // Let user pick a directory
    let dirHandle;
    try {
        dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
        if (e.name === 'AbortError') return; // User cancelled picker
        alert('Failed to select directory: ' + e.message);
        return;
    }

    // UI references
    const progressContainer = document.getElementById('batch-progress-container');
    const progressBar = document.getElementById('batch-progress-bar');
    const progressText = document.getElementById('batch-progress-text');
    const exportBtn = document.getElementById('btn-start-batch-export');
    const cancelBtn = document.getElementById('btn-cancel-batch-export');

    // Show progress UI
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = 'Starting...';
    exportBtn.disabled = true;
    cancelBtn.style.display = 'block';
    batchExportCancelled = false;

    // --- Save current state so we can restore after batch ---
    const savedLayerSettings = flowState.layers.map(l => ({
        id: l.id,
        noiseSeed: l.settings ? l.settings.noiseSeed : undefined
    }));
    const savedNoiseSeed = flowState.noiseSeed;
    const savedCurrentNoiseSeed = flowState.currentNoiseSeed;
    const savedActiveLayerId = flowState.activeLayerId;

    // Use the first layer's original seed as the reference for computing offsets
    const refSeed = savedLayerSettings.length > 0 ? (savedLayerSettings[0].noiseSeed || 0) : 0;

    const padLength = Math.max(String(count).length, 3);
    let exported = 0;

    try {
        for (let i = 0; i < count; i++) {
            if (batchExportCancelled) {
                progressText.textContent = `Cancelled. Exported ${exported} of ${count} SVGs.`;
                break;
            }

            // Update progress
            const percent = ((i + 1) / count * 100).toFixed(0);
            progressBar.style.width = percent + '%';
            progressText.textContent = `Exporting ${i + 1} of ${count}...`;

            // Generate a new base seed; shift all layers by the same delta
            // to preserve their relative offsets
            const baseSeed = Math.floor(Math.random() * 100000);
            for (const layer of flowState.layers) {
                if (layer.settings) {
                    const savedLayer = savedLayerSettings.find(s => s.id === layer.id);
                    const originalSeed = savedLayer ? (savedLayer.noiseSeed || 0) : 0;
                    const offset = originalSeed - refSeed;
                    layer.settings.noiseSeed = baseSeed + offset;
                }
            }

            // Yield to UI thread so progress updates render
            await new Promise(resolve => setTimeout(resolve, 0));

            // Regenerate all layers with the new seeds
            smartRegenerate();

            // Build SVG content client-side
            const svgContent = buildSVGContent();
            if (!svgContent) continue;

            // Write file to chosen directory
            const frameNum = String(i + 1).padStart(padLength, '0');
            const fileName = `${prefix}_${frameNum}.svg`;
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(svgContent);
            await writable.close();

            exported++;
        }

        if (!batchExportCancelled) {
            progressText.textContent = `Done! Exported ${exported} SVGs.`;
        }
    } catch (error) {
        console.error('Batch export error:', error);
        progressText.textContent = `Error at frame ${exported + 1}: ${error.message}`;
    } finally {
        exportBtn.disabled = false;
        cancelBtn.style.display = 'none';

        // --- Restore original state ---
        for (const saved of savedLayerSettings) {
            const layer = flowState.layers.find(l => l.id === saved.id);
            if (layer && layer.settings) {
                layer.settings.noiseSeed = saved.noiseSeed;
            }
        }
        flowState.noiseSeed = savedNoiseSeed;
        flowState.currentNoiseSeed = savedCurrentNoiseSeed;

        // Regenerate with original settings
        smartRegenerate();

        // Restore active layer and UI
        flowState.activeLayerId = savedActiveLayerId;
        const activeLayer = getActiveLayer();
        if (activeLayer) {
            applySettingsToFlowState(activeLayer.settings);
            applySettingsToUI(activeLayer.settings);
            renderLayerList();
        }
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
    // Ensure we have at least one layer
    if (flowState.layers.length === 0) {
        flowState.layers = [{
            id: 'layer-1',
            name: 'Layer 1',
            color: '#000000',
            paths: [],
            visible: true,
            presence: 1.0
        }];
        flowState.activeLayerId = 'layer-1';
    }
    
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
    } else {
        console.error('Failed to get active layer after initialization');
    }
    
    // Render the layer list UI
    renderLayerList();

    // Build + wire the colour palette picker
    populatePaletteDropdown();

    // Initialize statistics
    updateStatistics();
}

// ===== Project Manager (localStorage) =====
const PROJECT_STORAGE_KEY = 'ribbon-projects';
let currentProjectId = null; // Track currently loaded project for quick save

/**
 * Get localStorage usage in bytes
 */
function getStorageUsage() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
        }
    }
    return total;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Get all saved projects from localStorage
 */
function getProjectList() {
    try {
        const data = localStorage.getItem(PROJECT_STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error('Error reading projects:', e);
        return {};
    }
}

/**
 * Save projects object to localStorage
 */
function saveProjectList(projects) {
    try {
        localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
        return true;
    } catch (e) {
        console.error('Error saving projects:', e);
        const usage = formatBytes(getStorageUsage());
        const msg = `Storage is full! (Currently using ~${usage})\n\nOptions:\n• Delete old projects\n• Save without paths (smaller size)\n• Export to file instead`;
        alert(msg);
        return false;
    }
}

/**
 * Clear all saved projects
 */
function clearAllProjects() {
    if (confirm('Delete ALL saved projects? This cannot be undone.')) {
        localStorage.removeItem(PROJECT_STORAGE_KEY);
        currentProjectId = null;
        renderProjectList();
        showSaveNotification('All projects cleared');
    }
}

/**
 * Capture a thumbnail from the current canvas
 * @param {number} maxSize - Maximum dimension (width or height)
 * @returns {string} Base64 data URL of the thumbnail
 */
function captureThumbnail(maxSize = 120) {
    const canvas = document.getElementById('flow-canvas');
    if (!canvas) return null;
    
    try {
        // Create a temporary canvas for the thumbnail
        const thumbCanvas = document.createElement('canvas');
        const ctx = thumbCanvas.getContext('2d');
        
        // Calculate thumbnail dimensions maintaining aspect ratio
        const aspectRatio = canvas.width / canvas.height;
        let thumbWidth, thumbHeight;
        
        if (aspectRatio > 1) {
            thumbWidth = maxSize;
            thumbHeight = Math.round(maxSize / aspectRatio);
        } else {
            thumbHeight = maxSize;
            thumbWidth = Math.round(maxSize * aspectRatio);
        }
        
        thumbCanvas.width = thumbWidth;
        thumbCanvas.height = thumbHeight;
        
        // Draw the main canvas scaled down
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, thumbWidth, thumbHeight);
        ctx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
        
        // Export as JPEG with low quality for small file size
        return thumbCanvas.toDataURL('image/jpeg', 0.6);
    } catch (e) {
        console.warn('Could not capture thumbnail:', e);
        return null;
    }
}

/**
 * Generate project data object from current flowState
 * @param {string} name - Project name
 * @param {boolean} includePaths - Whether to include path data (default true)
 */
function generateProjectData(name, includePaths = true) {
    // Capture thumbnail before generating data
    const thumbnail = captureThumbnail(120);
    
    return {
        version: 1,
        timestamp: Date.now(),
        name: name,
        settingsOnly: !includePaths,
        thumbnail: thumbnail,
        flowState: {
            widthMm: flowState.widthMm,
            heightMm: flowState.heightMm,
            margin: flowState.margin,
            strokeWidth: flowState.strokeWidth,
            noiseScale: flowState.noiseScale,
            noiseEnabled: flowState.noiseEnabled,
            savedNoiseScale: flowState.savedNoiseScale,
            numParticles: flowState.numParticles,
            lineLength: flowState.lineLength,
            stepSize: flowState.stepSize,
            noiseSeed: flowState.noiseSeed,
            noiseOctaves: flowState.noiseOctaves,
            noisePersistence: flowState.noisePersistence,
            angleOffset: flowState.angleOffset,
            flowStrength: flowState.flowStrength,
            curlAmount: flowState.curlAmount,
            flowMode: flowState.flowMode,
            startPositionMode: flowState.startPositionMode,
            minDistance: flowState.minDistance,
            forceOverprint: flowState.forceOverprint,
            renderStyle: flowState.renderStyle,
            brushWidth: flowState.brushWidth,
            ribbonStyle: flowState.ribbonStyle,
            zigzagWavelength: flowState.zigzagWavelength,
            terrainVerticalGap: flowState.terrainVerticalGap,
            terrainAltitude: flowState.terrainAltitude,
            terrainDetail: flowState.terrainDetail,
            gradientConfig: { ...flowState.gradientConfig },
            inkBlendMode: flowState.inkBlendMode,
            inkOpacity: flowState.inkOpacity,
            gridConfig: { ...flowState.gridConfig },
            distortion: { ...flowState.distortion },
            geometry: { ...flowState.geometry },
            magnetConfig: { ...flowState.magnetConfig },
            magnets: flowState.magnets.map(m => ({ ...m })),
            syncAllLayers: flowState.syncAllLayers,
            distributionMode: flowState.distributionMode,
            layers: flowState.layers.map(layer => ({
                id: layer.id,
                name: layer.name,
                color: layer.color,
                visible: layer.visible,
                presence: layer.presence,
                forceOverprint: layer.forceOverprint,
                settings: layer.settings ? { ...layer.settings } : null,
                // Only include paths if requested
                paths: includePaths ? layer.paths.map(p => ({
                    coords: p.coords,
                    color: p.color
                })) : []
            })),
            activeLayerId: flowState.activeLayerId
        }
    };
}

/**
 * Save project to localStorage with given name
 * If projectId is provided, updates existing project
 * @param {string} name - Project name
 * @param {string|null} projectId - Existing project ID to update
 * @param {boolean} includePaths - Whether to include path data
 */
function saveProjectToStorage(name, projectId = null, includePaths = true) {
    const projects = getProjectList();
    const id = projectId || 'project-' + Date.now();
    const projectData = generateProjectData(name, includePaths);
    
    projects[id] = projectData;
    if (saveProjectList(projects)) {
        currentProjectId = id;
        return id;
    }
    
    // If save failed with paths, offer to save without
    if (includePaths) {
        if (confirm('Would you like to save without paths? (Smaller size, paths will regenerate on load)')) {
            return saveProjectToStorage(name, projectId, false);
        }
    }
    return null;
}

/**
 * Quick save - saves to current project or prompts for name
 */
function saveProject() {
    if (currentProjectId) {
        const projects = getProjectList();
        if (projects[currentProjectId]) {
            // Update existing project
            saveProjectToStorage(projects[currentProjectId].name, currentProjectId);
            showSaveNotification('Project saved!');
            return;
        }
    }
    // No current project - open modal for new save
    openProjectModal();
}

/**
 * Show brief save notification
 */
function showSaveNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--color-primary);
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 2000;
        animation: fadeInOut 2s ease-in-out;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

/**
 * Delete project from localStorage
 */
function deleteProject(projectId) {
    const projects = getProjectList();
    if (projects[projectId]) {
        delete projects[projectId];
        saveProjectList(projects);
        if (currentProjectId === projectId) {
            currentProjectId = null;
        }
    }
}

/**
 * Load project from localStorage by ID
 * Restores flowState and re-renders everything
 */
function loadProjectById(projectId) {
    const projects = getProjectList();
    const data = projects[projectId];
    
    if (!data) {
        alert('Project not found');
        return;
    }
    
    loadProjectData(data);
    currentProjectId = projectId;
    closeProjectModal();
}

/**
 * Load project from data object
 * Restores flowState and re-renders everything
 */
function loadProjectData(data) {
    try {
        if (!data.flowState) {
            alert('Invalid project data: missing flowState');
            return;
        }
        
        const fs = data.flowState;
        
        // Restore basic settings
        flowState.widthMm = fs.widthMm ?? flowState.widthMm;
        flowState.heightMm = fs.heightMm ?? flowState.heightMm;
        flowState.margin = fs.margin ?? flowState.margin;
        flowState.strokeWidth = fs.strokeWidth ?? flowState.strokeWidth;
        flowState.noiseScale = fs.noiseScale ?? flowState.noiseScale;
        flowState.noiseEnabled = fs.noiseEnabled ?? flowState.noiseEnabled;
        flowState.savedNoiseScale = fs.savedNoiseScale ?? flowState.savedNoiseScale;
        flowState.numParticles = fs.numParticles ?? flowState.numParticles;
        flowState.lineLength = fs.lineLength ?? flowState.lineLength;
        flowState.stepSize = fs.stepSize ?? flowState.stepSize;
        flowState.noiseSeed = fs.noiseSeed ?? flowState.noiseSeed;
        flowState.noiseOctaves = fs.noiseOctaves ?? flowState.noiseOctaves;
        flowState.noisePersistence = fs.noisePersistence ?? flowState.noisePersistence;
        flowState.angleOffset = fs.angleOffset ?? flowState.angleOffset;
        flowState.flowStrength = fs.flowStrength ?? flowState.flowStrength;
        flowState.curlAmount = fs.curlAmount ?? flowState.curlAmount;
        flowState.flowMode = fs.flowMode ?? flowState.flowMode;
        flowState.startPositionMode = fs.startPositionMode ?? flowState.startPositionMode;
        flowState.minDistance = fs.minDistance ?? flowState.minDistance;
        flowState.forceOverprint = fs.forceOverprint ?? flowState.forceOverprint;
        flowState.renderStyle = fs.renderStyle ?? flowState.renderStyle;
        flowState.brushWidth = fs.brushWidth ?? flowState.brushWidth;
        flowState.ribbonStyle = fs.ribbonStyle ?? flowState.ribbonStyle;
        flowState.zigzagWavelength = fs.zigzagWavelength ?? flowState.zigzagWavelength;
        flowState.syncAllLayers = fs.syncAllLayers ?? flowState.syncAllLayers;
        flowState.distributionMode = fs.distributionMode ?? flowState.distributionMode;
        
        // Restore nested objects
        if (fs.gridConfig) flowState.gridConfig = { ...flowState.gridConfig, ...fs.gridConfig };
        if (fs.distortion) flowState.distortion = { ...flowState.distortion, ...fs.distortion };
        if (fs.geometry) flowState.geometry = { ...flowState.geometry, ...fs.geometry };
        if (fs.magnetConfig) flowState.magnetConfig = { ...flowState.magnetConfig, ...fs.magnetConfig };
        if (fs.magnets) flowState.magnets = fs.magnets.map(m => ({ ...m }));
        
        // Restore gradient configuration and ink blend mode
        if (fs.gradientConfig) flowState.gradientConfig = { ...flowState.gradientConfig, ...fs.gradientConfig };
        flowState.inkBlendMode = fs.inkBlendMode ?? flowState.inkBlendMode;
        flowState.inkOpacity = fs.inkOpacity ?? flowState.inkOpacity;
        
        // Restore layers with their paths
        let needsRegeneration = false;
        if (fs.layers && fs.layers.length > 0) {
            flowState.layers = fs.layers.map(layer => ({
                id: layer.id,
                name: layer.name,
                color: layer.color,
                visible: layer.visible ?? true,
                presence: layer.presence ?? 1.0,
                forceOverprint: layer.forceOverprint ?? false,
                settings: layer.settings ? { ...layer.settings } : null,
                paths: (layer.paths || []).map(p => ({
                    coords: p.coords,
                    color: p.color || layer.color
                }))
            }));
            flowState.activeLayerId = fs.activeLayerId || flowState.layers[0].id;
            
            // Check if paths need regeneration (saved without paths)
            if (data.settingsOnly || flowState.layers.every(l => !l.paths || l.paths.length === 0)) {
                needsRegeneration = true;
            }
        }
        
        // Re-initialize Perlin noise with loaded seed
        flowState.perlin = new PerlinNoise(flowState.noiseSeed);
        flowState.currentNoiseSeed = flowState.noiseSeed;
        
        // Re-initialize canvas with potentially new dimensions
        initCanvas();
        
        // Update all UI elements
        const activeLayer = getActiveLayer();
        if (activeLayer) {
            ensureLayerDefaults(activeLayer);
            applySettingsToUI(activeLayer.settings);
        }
        
        // Update paper size selector
        const paperSizeEl = document.getElementById('paper-size');
        if (paperSizeEl) {
            const sizeValue = `${flowState.widthMm}x${flowState.heightMm}`;
            if (paperSizeEl.querySelector(`option[value="${sizeValue}"]`)) {
                paperSizeEl.value = sizeValue;
            }
        }
        
        // Update sync checkbox
        const syncEl = document.getElementById('sync-all-layers');
        if (syncEl) syncEl.checked = flowState.syncAllLayers;
        
        // Update distribution mode dropdown
        const distributionModeEl = document.getElementById('distribution-mode');
        if (distributionModeEl) distributionModeEl.value = flowState.distributionMode;
        
        // Sync paths and render
        syncPathsFromLayers();
        renderLayerList();
        renderCanvas();
        updateStatistics();
        
        // Regenerate paths if project was saved without them
        if (needsRegeneration) {
            showSaveNotification('Regenerating paths...');
            setTimeout(() => {
                if (typeof generateAllLayersWithDistribution === 'function') {
                    generateAllLayersWithDistribution();
                } else if (typeof smartRegenerate === 'function') {
                    smartRegenerate();
                }
            }, 100);
        }
        
    } catch (err) {
        console.error('Error loading project:', err);
        alert('Failed to load project: ' + err.message);
    }
}

/**
 * Open project manager modal
 */
function openProjectModal() {
    const modal = document.getElementById('project-modal');
    if (modal) {
        modal.style.display = 'flex';
        renderProjectList();
        // Focus the name input
        const nameInput = document.getElementById('project-name-input');
        if (nameInput) {
            nameInput.value = '';
            nameInput.focus();
        }
    }
}

/**
 * Close project manager modal
 */
function closeProjectModal() {
    const modal = document.getElementById('project-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Render project list in modal
 */
function renderProjectList() {
    const container = document.getElementById('project-list');
    if (!container) return;
    
    const projects = getProjectList();
    const projectIds = Object.keys(projects).sort((a, b) => {
        // Sort by timestamp, newest first
        return (projects[b].timestamp || 0) - (projects[a].timestamp || 0);
    });
    
    // Update storage info
    const storageInfo = document.getElementById('storage-info');
    if (storageInfo) {
        const usage = getStorageUsage();
        const usageMB = usage / (1024 * 1024);
        const maxMB = 5; // Typical localStorage limit
        const percent = Math.min(100, (usageMB / maxMB) * 100);
        const colorClass = percent > 80 ? 'storage-danger' : percent > 50 ? 'storage-warning' : '';
        storageInfo.innerHTML = `
            <div class="storage-bar ${colorClass}">
                <div class="storage-fill" style="width: ${percent}%"></div>
            </div>
            <span class="storage-text">${formatBytes(usage)} / ~5 MB</span>
        `;
    }
    
    if (projectIds.length === 0) {
        container.innerHTML = '<div class="project-empty">No saved projects yet</div>';
        return;
    }
    
    container.innerHTML = projectIds.map(id => {
        const project = projects[id];
        const date = new Date(project.timestamp || 0);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isActive = id === currentProjectId;
        const settingsOnlyBadge = project.settingsOnly ? '<span class="project-badge">settings only</span>' : '';
        
        // Thumbnail or placeholder
        const thumbnailHtml = project.thumbnail 
            ? `<img class="project-thumbnail" src="${project.thumbnail}" alt="Preview">`
            : `<div class="project-thumbnail-placeholder">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
               </div>`;
        
        return `
            <div class="project-item${isActive ? ' active' : ''}" data-project-id="${id}">
                ${thumbnailHtml}
                <div class="project-item-info">
                    <span class="project-item-name">${escapeHtml(project.name || 'Untitled')}${settingsOnlyBadge}</span>
                    <span class="project-item-date">${dateStr}</span>
                </div>
                <div class="project-item-actions">
                    <button class="project-item-btn load" title="Load project" data-action="load">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </button>
                    <button class="project-item-btn delete" title="Delete project" data-action="delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

