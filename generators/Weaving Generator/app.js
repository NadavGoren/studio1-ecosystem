/**
 * App.js - Main Application Controller
 * The Digital Loom - Generative Weaving Pattern Generator
 * 
 * Handles:
 * - State management
 * - Canvas rendering with ink simulation (multiply blend mode)
 * - UI event bindings
 * - Preset configurations
 * - Integration of weaver and SVG exporter modules
 */

import { generateWeave, A3_WIDTH, A3_HEIGHT, getWeaveStats } from './weaver.js';
import { exportSVG, downloadSVG, generateFilename, getSVGStats } from './svg-exporter.js';

// ============================================
// Application State
// ============================================

const state = {
    threads: { warp: [], weft: [] },
    config: {
        // Grid settings
        margins: 15,
        warpSpacing: 8,
        weftSpacing: 8,
        spacingVariance: 0,
        
        // Pattern Physics
        weftAngle: 0,
        grouping: 'none',
        modulationIntensity: 0,
        modulationFrequency: 3,
        
        // Organic/Jitter settings (separate for warp and weft)
        warpJitter: 2,
        weftJitter: 2,
        jitterFrequency: 0.1,
        segmentLength: 5,
        
        // Color settings
        pens: ['#00bcd4', '#e91e63', '#ffc107', '#212121'],
        warpPen: 0,
        weftPen: 1,
        
        // Pen settings
        strokeWidth: 0.3,
        
        // Random seed
        seed: Date.now()
    }
};

// ============================================
// Preset Configurations
// ============================================

const PRESETS = {
    plain: {
        name: 'Plain',
        config: {
            margins: 15,
            warpSpacing: 8,
            weftSpacing: 8,
            spacingVariance: 0,
            weftAngle: 0,
            grouping: 'none',
            modulationIntensity: 0,
            modulationFrequency: 3,
            warpJitter: 1.5,
            weftJitter: 1.5,
            jitterFrequency: 0.08,
            segmentLength: 5
        }
    },
    moire: {
        name: 'Moire',
        config: {
            margins: 10,
            warpSpacing: 4,
            weftSpacing: 4,
            spacingVariance: 0,
            weftAngle: 0.5,
            grouping: 'none',
            modulationIntensity: 0,
            modulationFrequency: 3,
            warpJitter: 0,
            weftJitter: 0,
            jitterFrequency: 0.1,
            segmentLength: 5
        }
    },
    ikat: {
        name: 'Ikat',
        config: {
            margins: 20,
            warpSpacing: 6,
            weftSpacing: 10,
            spacingVariance: 1,
            weftAngle: 0,
            grouping: 'none',
            modulationIntensity: 40,
            modulationFrequency: 5,
            warpJitter: 5,
            weftJitter: 1,
            jitterFrequency: 0.15,
            segmentLength: 4
        }
    },
    basket: {
        name: 'Basket',
        config: {
            margins: 15,
            warpSpacing: 5,
            weftSpacing: 5,
            spacingVariance: 0,
            weftAngle: 0,
            grouping: 'pairs',
            modulationIntensity: 0,
            modulationFrequency: 3,
            warpJitter: 0.5,
            weftJitter: 0.5,
            jitterFrequency: 0.05,
            segmentLength: 8
        }
    }
};

// ============================================
// Canvas Setup & Rendering
// ============================================

let canvas, ctx;
let scale = 1;  // Pixels per mm

/**
 * Initialize canvas with proper dimensions
 */
function initCanvas() {
    canvas = document.getElementById('preview-canvas');
    ctx = canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 100));
}

/**
 * Resize canvas to fit container while maintaining A3 ratio
 */
function resizeCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate scale to fit A3 in container
    const scaleX = containerWidth / A3_WIDTH;
    const scaleY = containerHeight / A3_HEIGHT;
    scale = Math.min(scaleX, scaleY);
    
    // Set canvas size in pixels (with device pixel ratio for sharpness)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = A3_WIDTH * scale * dpr;
    canvas.height = A3_HEIGHT * scale * dpr;
    
    // Scale context for device pixel ratio
    ctx.scale(dpr, dpr);
    
    // Set display size
    canvas.style.width = `${A3_WIDTH * scale}px`;
    canvas.style.height = `${A3_HEIGHT * scale}px`;
    
    // Re-render after resize
    render();
}

/**
 * Main render function - draws threads with ink simulation
 */
function render() {
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    // Clear and set paper background
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f5f5f0';  // Paper white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    
    // Set up ink simulation with multiply blend mode
    ctx.globalCompositeOperation = 'multiply';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Calculate stroke width in pixels
    const strokeWidthPx = state.config.strokeWidth * scale;
    ctx.lineWidth = Math.max(0.5, strokeWidthPx);
    
    // Draw warp threads (vertical)
    const warpColor = state.config.pens[state.config.warpPen];
    ctx.strokeStyle = warpColor;
    
    state.threads.warp.forEach(thread => {
        drawPolyline(thread.points);
    });
    
    // Draw weft threads (horizontal)
    const weftColor = state.config.pens[state.config.weftPen];
    ctx.strokeStyle = weftColor;
    
    state.threads.weft.forEach(thread => {
        drawPolyline(thread.points);
    });
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
}

/**
 * Draw a polyline on the canvas
 * @param {Array<{x: number, y: number}>} points - Points in mm
 */
function drawPolyline(points) {
    if (points.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x * scale, points[0].y * scale);
    
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * scale, points[i].y * scale);
    }
    
    ctx.stroke();
}

// ============================================
// Pattern Generation
// ============================================

/**
 * Generate new weave pattern with current settings
 */
function generate() {
    // Generate new seed for variety
    state.config.seed = Date.now();
    
    // Generate the weave
    state.threads = generateWeave({
        margins: state.config.margins,
        warpSpacing: state.config.warpSpacing,
        weftSpacing: state.config.weftSpacing,
        spacingVariance: state.config.spacingVariance,
        warpJitter: state.config.warpJitter,
        weftJitter: state.config.weftJitter,
        jitterFrequency: state.config.jitterFrequency,
        segmentLength: state.config.segmentLength,
        weftAngle: state.config.weftAngle,
        grouping: state.config.grouping,
        modulationIntensity: state.config.modulationIntensity,
        modulationFrequency: state.config.modulationFrequency,
        seed: state.config.seed
    });
    
    // Render to canvas
    render();
    
    // Log stats
    const stats = getWeaveStats(state.threads);
    console.log('Weave generated:', stats);
}

/**
 * Regenerate pattern (called when settings change)
 * Debounced to prevent excessive updates
 */
const regenerate = debounce(() => {
    generate();
}, 150);

// ============================================
// SVG Export
// ============================================

/**
 * Export and download SVG file
 */
function downloadPattern() {
    const svg = exportSVG(state.threads, {
        pens: state.config.pens,
        warpPen: state.config.warpPen,
        weftPen: state.config.weftPen,
        strokeWidth: state.config.strokeWidth
    });
    
    const filename = generateFilename();
    downloadSVG(svg, filename);
    
    // Log stats
    const stats = getSVGStats(svg);
    console.log('SVG exported:', stats);
}

// ============================================
// Preset Application
// ============================================

/**
 * Apply a preset configuration
 * @param {string} presetId - Preset identifier
 */
function applyPreset(presetId) {
    const preset = PRESETS[presetId];
    if (!preset) {
        console.warn(`Unknown preset: ${presetId}`);
        return;
    }

    // Merge preset config into state
    Object.assign(state.config, preset.config);
    
    // Update all UI elements to reflect new values
    updateUIFromState();
    
    // Regenerate pattern
    generate();
    
    console.log(`Applied preset: ${preset.name}`);
}

/**
 * Update all UI elements to reflect current state
 */
function updateUIFromState() {
    // Grid controls
    setInputValue('margins', state.config.margins);
    setInputValue('warp-spacing', state.config.warpSpacing);
    setInputValue('weft-spacing', state.config.weftSpacing);
    setInputValue('spacing-variance', state.config.spacingVariance);
    
    // Pattern Physics
    setInputValue('weft-angle', state.config.weftAngle);
    setSelectValue('grouping', state.config.grouping);
    setInputValue('modulation-intensity', state.config.modulationIntensity);
    setInputValue('modulation-frequency', state.config.modulationFrequency);
    
    // Organic controls
    setInputValue('warp-jitter', state.config.warpJitter);
    setInputValue('weft-jitter', state.config.weftJitter);
    setInputValue('jitter-frequency', state.config.jitterFrequency);
    setInputValue('segment-length', state.config.segmentLength);
    
    // Stroke width
    setInputValue('stroke-width', state.config.strokeWidth);
}

/**
 * Set input value and update display
 */
function setInputValue(id, value) {
    const input = document.getElementById(id);
    const display = document.getElementById(`${id}-value`);
    
    if (input) {
        input.value = value;
    }
    if (display) {
        display.textContent = value;
    }
}

/**
 * Set select value
 */
function setSelectValue(id, value) {
    const select = document.getElementById(id);
    if (select) {
        select.value = value;
    }
}

// ============================================
// UI Bindings
// ============================================

/**
 * Set up all UI event listeners
 */
function initUI() {
    // Preset selector
    bindSelect('preset', value => {
        applyPreset(value);
    });
    
    // Grid controls
    bindRange('margins', value => {
        state.config.margins = value;
        regenerate();
    });
    
    bindRange('warp-spacing', value => {
        state.config.warpSpacing = value;
        regenerate();
    });
    
    bindRange('weft-spacing', value => {
        state.config.weftSpacing = value;
        regenerate();
    });
    
    bindRange('spacing-variance', value => {
        state.config.spacingVariance = value;
        regenerate();
    });
    
    // Pattern Physics controls
    bindRange('weft-angle', value => {
        state.config.weftAngle = value;
        regenerate();
    });
    
    bindSelect('grouping', value => {
        state.config.grouping = value;
        regenerate();
    });
    
    bindRange('modulation-intensity', value => {
        state.config.modulationIntensity = value;
        regenerate();
    });
    
    bindRange('modulation-frequency', value => {
        state.config.modulationFrequency = value;
        regenerate();
    });
    
    // Organic controls
    bindRange('warp-jitter', value => {
        state.config.warpJitter = value;
        regenerate();
    });
    
    bindRange('weft-jitter', value => {
        state.config.weftJitter = value;
        regenerate();
    });
    
    bindRange('jitter-frequency', value => {
        state.config.jitterFrequency = value;
        regenerate();
    });
    
    bindRange('segment-length', value => {
        state.config.segmentLength = value;
        regenerate();
    });
    
    // Color pickers
    bindColor('pen1', 0);
    bindColor('pen2', 1);
    bindColor('pen3', 2);
    bindColor('pen4', 3);
    
    // Pen assignments
    bindSelect('warp-pen', value => {
        state.config.warpPen = parseInt(value);
        render();  // No need to regenerate, just re-render with new colors
    });
    
    bindSelect('weft-pen', value => {
        state.config.weftPen = parseInt(value);
        render();
    });
    
    // Stroke width
    bindRange('stroke-width', value => {
        state.config.strokeWidth = value;
        render();
    });
    
    // Action buttons
    document.getElementById('generate-btn').addEventListener('click', () => {
        generate();
    });
    
    document.getElementById('download-btn').addEventListener('click', () => {
        downloadPattern();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        // Ctrl/Cmd + G = Generate
        if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
            e.preventDefault();
            generate();
        }
        // Ctrl/Cmd + S = Download SVG
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            downloadPattern();
        }
        // Space = Generate (when not in input)
        if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
            generate();
        }
    });
}

/**
 * Bind a range input to a state value
 * @param {string} id - Input element ID
 * @param {Function} callback - Callback with parsed value
 */
function bindRange(id, callback) {
    const input = document.getElementById(id);
    const display = document.getElementById(`${id}-value`);
    
    if (!input) {
        console.warn(`Range input not found: ${id}`);
        return;
    }
    
    const update = () => {
        const value = parseFloat(input.value);
        if (display) {
            display.textContent = value;
        }
        callback(value);
    };
    
    input.addEventListener('input', update);
    
    // Initialize display
    if (display) {
        display.textContent = input.value;
    }
}

/**
 * Bind a select input
 * @param {string} id - Select element ID
 * @param {Function} callback - Callback with value
 */
function bindSelect(id, callback) {
    const select = document.getElementById(id);
    
    if (!select) {
        console.warn(`Select not found: ${id}`);
        return;
    }
    
    select.addEventListener('change', () => {
        callback(select.value);
    });
}

/**
 * Bind a color picker to a pen slot
 * @param {string} id - Input element ID
 * @param {number} penIndex - Pen array index
 */
function bindColor(id, penIndex) {
    const input = document.getElementById(id);
    
    if (!input) {
        console.warn(`Color input not found: ${id}`);
        return;
    }
    
    input.addEventListener('input', () => {
        state.config.pens[penIndex] = input.value;
        updatePenLabels();
        render();
    });
}

/**
 * Update pen select labels with current colors
 */
function updatePenLabels() {
    const warpSelect = document.getElementById('warp-pen');
    const weftSelect = document.getElementById('weft-pen');
    
    const labels = ['Cyan', 'Magenta', 'Yellow', 'Black'];
    
    [warpSelect, weftSelect].forEach(select => {
        if (select) {
            Array.from(select.options).forEach((option, i) => {
                option.textContent = `Pen ${i + 1} (${labels[i]})`;
            });
        }
    });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Debounce function to limit call frequency
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize the application
 */
function init() {
    console.log('The Digital Loom - Initializing...');
    
    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
}

/**
 * Bootstrap the app after DOM is ready
 */
function bootstrap() {
    initCanvas();
    initUI();
    
    // Generate initial pattern
    generate();
    
    console.log('The Digital Loom - Ready!');
    console.log('Keyboard shortcuts: Ctrl+G = Generate, Ctrl+S = Download SVG, Space = Generate');
}

// Start the app
init();
