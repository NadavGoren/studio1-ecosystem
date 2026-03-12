/**
 * MIDI to SVG Web Application
 * Frontend rendering engine with live controls
 */

// ============================================================================
// State Management
// ============================================================================

const state = {
    midiData: null,
    filename: null,
    theme: 'dark',
    
    // Paper sizes in mm (width, height in landscape)
    paperSizes: {
        a4: [297, 210],
        a3: [420, 297],
        a2: [594, 420],
        letter: [279.4, 215.9],
        tabloid: [431.8, 279.4]
    }
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
    // File handling
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    dragOverlay: document.getElementById('dragOverlay'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    emptyState: document.getElementById('emptyState'),
    fileInfo: document.getElementById('fileInfo'),
    
    // SVG
    svgOutput: document.getElementById('svgOutput'),
    previewContainer: document.getElementById('previewContainer'),
    
    // Theme
    themeDark: document.getElementById('themeDark'),
    themeLight: document.getElementById('themeLight'),
    
    // Style
    vizStyle: document.getElementById('vizStyle'),
    
    // Visibility toggles
    showNotes: document.getElementById('showNotes'),
    showChords: document.getElementById('showChords'),
    showSustain: document.getElementById('showSustain'),
    showEnergy: document.getElementById('showEnergy'),
    showFrame: document.getElementById('showFrame'),
    showPianoKeys: document.getElementById('showPianoKeys'),
    showBeatGrid: document.getElementById('showBeatGrid'),
    showBarMarkers: document.getElementById('showBarMarkers'),
    showTimeLabels: document.getElementById('showTimeLabels'),
    
    // Colors
    noteColor: document.getElementById('noteColor'),
    chordColor: document.getElementById('chordColor'),
    sustainColor: document.getElementById('sustainColor'),
    energyColor: document.getElementById('energyColor'),
    frameColor: document.getElementById('frameColor'),
    bgColor: document.getElementById('bgColor'),
    randomizeBtn: document.getElementById('randomizeBtn'),
    monochromeBtn: document.getElementById('monochromeBtn'),
    blueprintBtn: document.getElementById('blueprintBtn'),
    lightPaperBtn: document.getElementById('lightPaperBtn'),
    
    // Stroke width (single unified stroke for pen plotter)
    strokeWidth: document.getElementById('strokeWidth'),
    
    // Layout
    paperSize: document.getElementById('paperSize'),
    portraitMode: document.getElementById('portraitMode'),
    margin: document.getElementById('margin'),
    
    // Musical details
    chordThreshold: document.getElementById('chordThreshold'),
    
    // Sustain
    sustainSpacing: document.getElementById('sustainSpacing'),
    sustainStyle: document.getElementById('sustainStyle'),
    
    // Energy
    energySmoothing: document.getElementById('energySmoothing'),
    showEnergyFill: document.getElementById('showEnergyFill'),
    
    // Export
    downloadSvg: document.getElementById('downloadSvg'),
    downloadPng: document.getElementById('downloadPng')
};

// ============================================================================
// File Handling
// ============================================================================

function setupFileHandling() {
    // Click to browse
    elements.dropZone.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
    
    // Drag and drop on entire window
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dragOverlay.classList.remove('hidden');
    });
    
    document.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null) {
            elements.dragOverlay.classList.add('hidden');
        }
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dragOverlay.classList.add('hidden');
        
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.match(/\.(mid|midi)$/i)) {
                handleFile(file);
            }
        }
    });
}

async function handleFile(file) {
    elements.loadingOverlay.classList.remove('hidden');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chord_threshold', elements.chordThreshold.value);
    
    try {
        const response = await fetch('/parse', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            state.midiData = result.data;
            state.filename = result.filename;
            
            // Update UI
            elements.fileInfo.querySelector('.file-name').textContent = result.filename;
            elements.emptyState.classList.add('hidden');
            elements.svgOutput.classList.remove('hidden');
            elements.downloadSvg.disabled = false;
            elements.downloadPng.disabled = false;
            
            // Render
            renderSVG();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (err) {
        alert('Failed to parse MIDI file: ' + err.message);
    } finally {
        elements.loadingOverlay.classList.add('hidden');
    }
}

// ============================================================================
// Theme Management
// ============================================================================

function setupTheme() {
    elements.themeDark.addEventListener('click', () => {
        setTheme('dark');
    });
    
    elements.themeLight.addEventListener('click', () => {
        setTheme('light');
    });
}

function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    
    elements.themeDark.classList.toggle('active', theme === 'dark');
    elements.themeLight.classList.toggle('active', theme === 'light');
    
    if (state.midiData) renderSVG();
}

// ============================================================================
// Color Generation
// ============================================================================

function generateRandomColors() {
    // Generate harmonious colors using HSL
    const baseHue = Math.random() * 360;
    const schemes = ['complementary', 'triadic', 'analogous', 'split'];
    const scheme = schemes[Math.floor(Math.random() * schemes.length)];
    
    let hues = [];
    switch (scheme) {
        case 'complementary':
            hues = [baseHue, (baseHue + 180) % 360, (baseHue + 30) % 360, (baseHue + 210) % 360];
            break;
        case 'triadic':
            hues = [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360, (baseHue + 60) % 360];
            break;
        case 'analogous':
            hues = [baseHue, (baseHue + 30) % 360, (baseHue + 60) % 360, (baseHue + 90) % 360];
            break;
        case 'split':
            hues = [baseHue, (baseHue + 150) % 360, (baseHue + 210) % 360, (baseHue + 330) % 360];
            break;
    }
    
    const hslToHex = (h, s, l) => {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    };
    
    const isDark = state.theme === 'dark';
    const baseLightness = isDark ? 60 : 45;
    const frameLightness = isDark ? 40 : 50;
    
    elements.noteColor.value = hslToHex(hues[0], 80, baseLightness);
    elements.chordColor.value = hslToHex(hues[1], 75, baseLightness);
    elements.sustainColor.value = hslToHex(hues[2], 60, baseLightness - 10);
    elements.energyColor.value = hslToHex(hues[3], 85, baseLightness + 10);
    elements.frameColor.value = hslToHex(hues[0], 20, frameLightness);
    
    if (state.midiData) renderSVG();
}

// ============================================================================
// Control Bindings
// ============================================================================

function setupControls() {
    // All toggles and inputs trigger re-render
    const rerenderElements = [
        elements.showNotes, elements.showChords, elements.showSustain,
        elements.showEnergy, elements.showFrame, elements.showPianoKeys,
        elements.showBeatGrid, elements.showBarMarkers, elements.showTimeLabels,
        elements.noteColor, elements.chordColor, elements.sustainColor,
        elements.energyColor, elements.frameColor, elements.bgColor,
        elements.strokeWidth, elements.paperSize, elements.portraitMode,
        elements.margin, elements.sustainSpacing, elements.sustainStyle,
        elements.energySmoothing, elements.showEnergyFill, elements.vizStyle
    ];
    
    rerenderElements.forEach(el => {
        el.addEventListener('input', () => {
            updateSliderLabels();
            if (state.midiData) renderSVG();
        });
        el.addEventListener('change', () => {
            updateSliderLabels();
            if (state.midiData) renderSVG();
        });
    });
    
    // Chord threshold needs re-parse
    elements.chordThreshold.addEventListener('change', async () => {
        updateSliderLabels();
        if (state.midiData && state.filename) {
            renderSVG();
        }
    });
    
    // Preset buttons
    elements.randomizeBtn.addEventListener('click', generateRandomColors);
    
    elements.monochromeBtn.addEventListener('click', () => {
        const isDark = state.theme === 'dark';
        elements.noteColor.value = isDark ? '#ffffff' : '#000000';
        elements.chordColor.value = isDark ? '#ffffff' : '#000000';
        elements.sustainColor.value = isDark ? '#666666' : '#888888';
        elements.energyColor.value = isDark ? '#ffffff' : '#000000';
        elements.frameColor.value = isDark ? '#888888' : '#333333';
        elements.bgColor.value = isDark ? '#000000' : '#ffffff';
        if (state.midiData) renderSVG();
    });
    
    elements.blueprintBtn.addEventListener('click', () => {
        elements.noteColor.value = '#00d4ff';
        elements.chordColor.value = '#ff6b9d';
        elements.sustainColor.value = '#7c5cbf';
        elements.energyColor.value = '#00ff88';
        elements.frameColor.value = '#4a5568';
        elements.bgColor.value = '#0d1117';
        setTheme('dark');
        if (state.midiData) renderSVG();
    });
    
    elements.lightPaperBtn.addEventListener('click', () => {
        elements.noteColor.value = '#1a365d';
        elements.chordColor.value = '#c53030';
        elements.sustainColor.value = '#718096';
        elements.energyColor.value = '#276749';
        elements.frameColor.value = '#2d3748';
        elements.bgColor.value = '#fffff8';
        setTheme('light');
        if (state.midiData) renderSVG();
    });
    
    // Export buttons
    elements.downloadSvg.addEventListener('click', downloadSVG);
    elements.downloadPng.addEventListener('click', downloadPNG);
    
    // Initial slider labels
    updateSliderLabels();
}

function updateSliderLabels() {
    document.querySelectorAll('.slider-value').forEach(label => {
        const inputId = label.dataset.for;
        const input = document.getElementById(inputId);
        if (input) {
            let value = input.value;
            if (inputId === 'margin') value += 'mm';
            else if (inputId === 'chordThreshold') value += ' ticks';
            else if (inputId === 'sustainSpacing') value += 'mm';
            else if (inputId === 'energySmoothing') value += ' beats';
            else if (inputId === 'strokeWidth') value += 'mm';
            label.textContent = value;
        }
    });
}

// ============================================================================
// SVG Rendering - Main Router
// ============================================================================

function getConfig() {
    const paperKey = elements.paperSize.value;
    let [width, height] = state.paperSizes[paperKey];
    
    if (elements.portraitMode.checked) {
        [width, height] = [height, width];
    }
    
    const margin = parseFloat(elements.margin.value);
    
    return {
        width,
        height,
        margin,
        contentWidth: width - 2 * margin,
        contentHeight: height - 2 * margin,
        noteAreaRatio: 0.75,
        energyAreaRatio: 0.15,
        gapRatio: 0.05,
        
        // Colors
        noteColor: elements.noteColor.value,
        chordColor: elements.chordColor.value,
        sustainColor: elements.sustainColor.value,
        energyColor: elements.energyColor.value,
        frameColor: elements.frameColor.value,
        bgColor: elements.bgColor.value,
        
        // Single unified stroke width for pen plotter
        strokeWidth: parseFloat(elements.strokeWidth.value),
        
        // Visibility
        showNotes: elements.showNotes.checked,
        showChords: elements.showChords.checked,
        showSustain: elements.showSustain.checked,
        showEnergy: elements.showEnergy.checked,
        showFrame: elements.showFrame.checked,
        showPianoKeys: elements.showPianoKeys.checked,
        showBeatGrid: elements.showBeatGrid.checked,
        showBarMarkers: elements.showBarMarkers.checked,
        showTimeLabels: elements.showTimeLabels.checked,
        showEnergyFill: elements.showEnergyFill.checked,
        
        // Sustain
        sustainSpacing: parseFloat(elements.sustainSpacing.value),
        sustainStyle: elements.sustainStyle.value,
        
        // Style
        vizStyle: elements.vizStyle.value
    };
}

function renderSVG() {
    const style = elements.vizStyle.value;
    
    switch (style) {
        case 'circular':
            renderCircular();
            break;
        case 'spiral':
            renderSpiral();
            break;
        case 'waterfall':
            renderWaterfall();
            break;
        case 'piano':
            renderPiano();
            break;
        case 'flow_field':
            renderFlowField();
            break;
        default:
            renderLinear();
    }
}

// ============================================================================
// Helper: Create SVG Element
// ============================================================================

function createSvgElement(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
    }
    return el;
}

function createGroup(id) {
    return createSvgElement('g', { id });
}

// ============================================================================
// Helper: Color Legend
// ============================================================================

function createColorLegend() {
    const legendContainer = document.getElementById('colorLegend');
    if (!legendContainer) return;
    
    const pitchNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Clear existing content
    legendContainer.innerHTML = '';
    
    // Create a grid layout
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    grid.style.gap = '8px';
    grid.style.fontSize = '11px';
    
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
        const color = PITCH_CLASS_COLORS[pitchClass];
        const name = pitchNames[pitchClass];
        
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '6px';
        
        const colorBox = document.createElement('div');
        colorBox.style.width = '20px';
        colorBox.style.height = '20px';
        colorBox.style.backgroundColor = color;
        colorBox.style.border = '1px solid rgba(255,255,255,0.2)';
        colorBox.style.borderRadius = '3px';
        
        const label = document.createElement('span');
        label.textContent = `${name} (${pitchClass})`;
        label.style.color = 'var(--text-primary)';
        
        item.appendChild(colorBox);
        item.appendChild(label);
        grid.appendChild(item);
    }
    
    legendContainer.appendChild(grid);
}

// ============================================================================
// Helper: Piano Key Labels
// ============================================================================

// Pitch Class (0-11) to Color Mapping (Synesthesia) - matches Python
const PITCH_CLASS_COLORS = {
    0: '#FFD700',   // C - Yellow
    1: '#FF8C00',   // C# - DarkOrange
    2: '#32CD32',   // D - LimeGreen
    3: '#00FA9A',   // D# - MediumSpringGreen
    4: '#0000FF',   // E - Blue
    5: '#8A2BE2',   // F - BlueViolet
    6: '#FF00FF',   // F# - Magenta
    7: '#FF0000',   // G - Red
    8: '#FF1493',   // G# - DeepPink
    9: '#00CED1',   // A - DarkTurquoise
    10: '#8B4513',  // A# - SaddleBrown
    11: '#808080',  // B - Gray
};

function getPitchClassColor(pitch) {
    const pitchClass = pitch % 12;
    return PITCH_CLASS_COLORS[pitchClass];
}

function getPitchName(pitch) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(pitch / 12) - 1;
    const name = names[pitch % 12];
    return { name, octave, isC: pitch % 12 === 0 };
}

function drawPianoKeys(group, config, pitchMin, pitchMax, pitchToY, xPosition, rightEdge) {
    const labelX = xPosition - 2;
    // Use rightEdge if provided, otherwise calculate it to stay within frame
    const lineEndX = rightEdge !== undefined ? rightEdge : config.margin + config.contentWidth;
    
    for (let pitch = pitchMin; pitch <= pitchMax; pitch++) {
        const { name, octave, isC } = getPitchName(pitch);
        const y = pitchToY(pitch);
        
        // Draw horizontal guide line for C notes
        if (isC) {
            const guideLine = createSvgElement('line', {
                x1: xPosition,
                y1: y,
                x2: lineEndX,
                y2: y,
                stroke: config.frameColor,
                'stroke-width': config.strokeWidth,
                'stroke-opacity': 0.3
            });
            group.appendChild(guideLine);
        }
        
        // Draw label
        const text = createSvgElement('text', {
            x: labelX,
            y: y + 1,
            fill: isC ? config.frameColor : config.frameColor,
            'font-size': isC ? 2.5 : 1.8,
            'font-family': 'JetBrains Mono, monospace',
            'text-anchor': 'end',
            'font-weight': isC ? '600' : '400',
            opacity: isC ? 1 : 0.5
        });
        text.textContent = isC ? `C${octave}` : name;
        group.appendChild(text);
    }
}

// ============================================================================
// Render: Linear (Default)
// ============================================================================

function renderLinear() {
    const data = state.midiData;
    const config = getConfig();
    
    const svg = elements.svgOutput;
    svg.innerHTML = '';
    
    // Set SVG attributes
    svg.setAttribute('viewBox', `0 0 ${config.width} ${config.height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.backgroundColor = config.bgColor;
    
    // Calculate transforms
    const pitchMin = Math.max(0, data.pitch_range.min - 2);
    const pitchMax = Math.min(127, data.pitch_range.max + 2);
    const pitchRange = pitchMax - pitchMin;
    
    const noteAreaHeight = config.contentHeight * config.noteAreaRatio;
    const energyAreaHeight = config.contentHeight * config.energyAreaRatio;
    const gapHeight = config.contentHeight * config.gapRatio;
    
    // Reserve space for piano keys on the left
    const pianoKeySpace = config.showPianoKeys ? 12 : 0;
    const effectiveContentWidth = config.contentWidth - pianoKeySpace;
    
    const timeScale = data.total_ticks > 0 ? effectiveContentWidth / data.total_ticks : 1;
    const pitchScale = pitchRange > 0 ? noteAreaHeight / pitchRange : 1;
    
    const tickToX = (tick) => config.margin + pianoKeySpace + tick * timeScale;
    const pitchToY = (pitch) => config.margin + (pitchMax - pitch) * pitchScale;
    
    // Create groups - organized by color for multi-pen plotting
    const sustainGroup = createGroup('sustain');
    const gridGroup = createGroup('grid');
    const energyGroup = createGroup('energy');
    const frameGroup = createGroup('frame');
    const labelsGroup = createGroup('labels');
    const pianoKeysGroup = createGroup('piano-keys');
    
    // Create color-based groups for notes (one group per pitch class color)
    const colorGroups = {};
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
        const color = PITCH_CLASS_COLORS[pitchClass];
        colorGroups[color] = createGroup(`layer_pitch_class_${pitchClass}`);
    }
    
    // Draw piano keys
    if (config.showPianoKeys) {
        // Pass the right edge boundary to prevent lines from exceeding the frame
        const rightEdge = config.margin + config.contentWidth;
        drawPianoKeys(pianoKeysGroup, config, pitchMin, pitchMax, pitchToY, config.margin + pianoKeySpace, rightEdge);
    }
    
    // Draw beat grid - ensure lines stay within frame
    if (config.showBeatGrid || config.showBarMarkers) {
        const ticksPerBeat = data.ticks_per_beat;
        const rightBoundary = config.margin + config.contentWidth;
        
        for (let tick = 0; tick <= data.total_ticks; tick += ticksPerBeat) {
            const x = tickToX(tick);
            
            // Skip lines that would exceed the frame boundary
            if (x > rightBoundary) continue;
            
            const beatNum = tick / ticksPerBeat;
            const isBarLine = beatNum % 4 === 0;
            
            if ((config.showBarMarkers && isBarLine) || (config.showBeatGrid && !isBarLine)) {
                const line = createSvgElement('line', {
                    x1: x,
                    y1: config.margin,
                    x2: x,
                    y2: config.margin + noteAreaHeight,
                    stroke: config.frameColor,
                    'stroke-width': config.strokeWidth,
                    'stroke-opacity': isBarLine ? 0.5 : 0.2
                });
                gridGroup.appendChild(line);
            }
        }
    }
    
    // Draw time labels - adaptive interval to avoid density issues
    if (config.showTimeLabels) {
        const secondsPerTick = (data.tempo_us / 1000000) / data.ticks_per_beat;
        
        // Calculate adaptive label interval based on available width and duration
        // Target roughly 6-10 labels maximum for readability
        const targetLabelCount = config.portraitMode ? 5 : 8;
        const rawInterval = data.duration_seconds / targetLabelCount;
        // Round to nice values: 10, 15, 20, 30, 45, 60, 90, 120, etc.
        const niceIntervals = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300];
        let labelInterval = niceIntervals.find(i => i >= rawInterval) || Math.ceil(rawInterval / 60) * 60;
        // Ensure minimum 20 seconds in portrait mode for better spacing
        if (elements.portraitMode.checked) {
            labelInterval = Math.max(labelInterval, 20);
        }
        
        const labelY = config.margin + noteAreaHeight + gapHeight / 2;
        const minX = config.margin + pianoKeySpace + 5; // Minimum X to stay inside
        const maxX = config.margin + config.contentWidth - 5; // Maximum X
        
        for (let sec = 0; sec <= data.duration_seconds; sec += labelInterval) {
            const tick = sec / secondsPerTick;
            let x = tickToX(tick);
            
            // Skip labels that would be too close to edges or outside bounds
            if (x < minX - 2 || x > maxX + 2) continue;
            
            // Clamp X to stay inside frame
            x = Math.max(minX, Math.min(maxX, x));
            
            // Adjust text anchor for edge labels
            let anchor = 'middle';
            if (sec === 0) anchor = 'start';
            else if (sec >= data.duration_seconds - labelInterval / 2) anchor = 'end';
            
            const text = createSvgElement('text', {
                x: x,
                y: labelY,
                fill: config.frameColor,
                'font-size': 3,
                'font-family': 'JetBrains Mono, monospace',
                'text-anchor': anchor
            });
            text.textContent = `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
            labelsGroup.appendChild(text);
        }
    }
    
    // Draw sustain segments - clamp to frame boundaries
    if (config.showSustain) {
        const yTop = pitchToY(pitchMax);
        const yBottom = pitchToY(pitchMin);
        const rightBoundary = config.margin + config.contentWidth;
        const leftBoundary = config.margin + pianoKeySpace;
        
        const dashArrays = {
            dashed: '2,3',
            solid: 'none',
            dotted: '0.5,1.5'
        };
        
        data.sustain_segments.forEach(segment => {
            let xStart = tickToX(segment.start_tick);
            let xEnd = tickToX(segment.end_tick);
            
            // Clamp to boundaries
            xStart = Math.max(leftBoundary, Math.min(rightBoundary, xStart));
            xEnd = Math.max(leftBoundary, Math.min(rightBoundary, xEnd));
            
            // Hatch lines
            for (let x = xStart; x <= xEnd; x += config.sustainSpacing) {
                if (x > rightBoundary) break;
                
                const line = createSvgElement('line', {
                    x1: x,
                    y1: yTop,
                    x2: x,
                    y2: yBottom,
                    stroke: config.sustainColor,
                    'stroke-width': config.strokeWidth
                });
                if (dashArrays[config.sustainStyle] !== 'none') {
                    line.setAttribute('stroke-dasharray', dashArrays[config.sustainStyle]);
                }
                sustainGroup.appendChild(line);
            }
            
            // Boundary lines using multiple parallel lines for "thick" effect
            // (maintains consistent pen stroke width for plotter)
            const thickLineSpacing = 0.3; // mm spacing between parallel lines
            [xStart, xEnd].forEach(x => {
                if (x < leftBoundary || x > rightBoundary) return;
                
                // Draw 2 parallel lines to create thicker boundary effect
                [-thickLineSpacing / 2, thickLineSpacing / 2].forEach(offset => {
                    const line = createSvgElement('line', {
                        x1: x + offset,
                        y1: yTop,
                        x2: x + offset,
                        y2: yBottom,
                        stroke: config.sustainColor,
                        'stroke-width': config.strokeWidth
                    });
                    sustainGroup.appendChild(line);
                });
            });
        });
    }
    
    // Helper function to draw hatched rectangle
    function drawHatchedRect(group, x, y, width, height, velocity, color) {
        // First, draw the rectangle outline
        const rect = createSvgElement('rect', {
            x: x,
            y: y,
            width: width,
            height: height,
            fill: 'none',
            stroke: color,
            'stroke-width': config.strokeWidth
        });
        group.appendChild(rect);
        
        // Determine hatching spacing based on velocity
        let hatchSpacing;
        if (velocity < 60) {
            // Quiet: wide spacing
            hatchSpacing = 2.0; // mm
        } else if (velocity > 100) {
            // Loud: tight spacing
            hatchSpacing = 0.5; // mm
        } else {
            // Medium: interpolate between wide and tight
            const ratio = (velocity - 60) / 40.0; // 0.0 to 1.0 for velocities 60-100
            hatchSpacing = 2.0 - (ratio * 1.5); // 2.0 to 0.5
        }
        
        // Diagonal line spacing (perpendicular to 45° line)
        const spacingPerp = hatchSpacing * Math.sqrt(2);
        
        // Calculate range of intercepts for diagonal lines (45°: y = x + c)
        const minC = y - (x + width);
        const maxC = (y + height) - x;
        
        // Draw diagonal lines (45 degrees: y = x + c)
        for (let c = minC; c <= maxC + spacingPerp; c += spacingPerp) {
            const intersections = [];
            
            // Intersection with left edge (x = x): y = x + c
            const yLeft = x + c;
            if (y <= yLeft && yLeft <= y + height) {
                intersections.push([x, yLeft]);
            }
            
            // Intersection with right edge (x = x + width): y = x + width + c
            const yRight = x + width + c;
            if (y <= yRight && yRight <= y + height) {
                intersections.push([x + width, yRight]);
            }
            
            // Intersection with top edge (y = y): x = y - c
            const xTop = y - c;
            if (x <= xTop && xTop <= x + width) {
                intersections.push([xTop, y]);
            }
            
            // Intersection with bottom edge (y = y + height): x = y + height - c
            const xBottom = y + height - c;
            if (x <= xBottom && xBottom <= x + width) {
                intersections.push([xBottom, y + height]);
            }
            
            // Draw line if we have exactly 2 distinct intersection points
            if (intersections.length >= 2) {
                // Remove duplicates by rounding coordinates
                const seen = new Set();
                const uniquePoints = [];
                for (const pt of intersections) {
                    const key = `${Math.round(pt[0] * 1000)},${Math.round(pt[1] * 1000)}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniquePoints.push(pt);
                    }
                }
                
                if (uniquePoints.length >= 2) {
                    // Sort by x coordinate (left to right)
                    uniquePoints.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
                    const start = uniquePoints[0];
                    const end = uniquePoints[uniquePoints.length - 1];
                    
                    // Only draw if start and end are different
                    if (start[0] !== end[0] || start[1] !== end[1]) {
                        const line = createSvgElement('line', {
                            x1: start[0],
                            y1: start[1],
                            x2: end[0],
                            y2: end[1],
                            stroke: color,
                            'stroke-width': config.strokeWidth
                        });
                        group.appendChild(line);
                    }
                }
            }
        }
        
        // For loud notes (velocity > 100), add cross-hatching (lines in opposite direction)
        if (velocity > 100) {
            // Draw hatching in opposite direction (-45°: y = -x + c)
            const minCCross = y + x;
            const maxCCross = (y + height) + (x + width);
            
            for (let c = minCCross; c <= maxCCross + spacingPerp; c += spacingPerp) {
                const intersections = [];
                
                // Intersection with left edge (x = x): y = -x + c
                const yLeft = -x + c;
                if (y <= yLeft && yLeft <= y + height) {
                    intersections.push([x, yLeft]);
                }
                
                // Intersection with right edge (x = x + width): y = -(x + width) + c
                const yRight = -(x + width) + c;
                if (y <= yRight && yRight <= y + height) {
                    intersections.push([x + width, yRight]);
                }
                
                // Intersection with top edge (y = y): x = -y + c
                const xTop = -y + c;
                if (x <= xTop && xTop <= x + width) {
                    intersections.push([xTop, y]);
                }
                
                // Intersection with bottom edge (y = y + height): x = -(y + height) + c
                const xBottom = -(y + height) + c;
                if (x <= xBottom && xBottom <= x + width) {
                    intersections.push([xBottom, y + height]);
                }
                
                if (intersections.length >= 2) {
                    const seen = new Set();
                    const uniquePoints = [];
                    for (const pt of intersections) {
                        const key = `${Math.round(pt[0] * 1000)},${Math.round(pt[1] * 1000)}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            uniquePoints.push(pt);
                        }
                    }
                    
                    if (uniquePoints.length >= 2) {
                        uniquePoints.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
                        const start = uniquePoints[0];
                        const end = uniquePoints[uniquePoints.length - 1];
                        
                        if (start[0] !== end[0] || start[1] !== end[1]) {
                            const line = createSvgElement('line', {
                                x1: start[0],
                                y1: start[1],
                                x2: end[0],
                                y2: end[1],
                                stroke: color,
                                'stroke-width': config.strokeWidth
                            });
                            group.appendChild(line);
                        }
                    }
                }
            }
        }
    }
    
    // Draw notes - hatched rectangles grouped by color
    if (config.showNotes) {
        const rightBoundary = config.margin + config.contentWidth;
        const leftBoundary = config.margin + pianoKeySpace;
        
        // Fixed row height to ensure notes don't overlap
        const rowHeight = 3.0; // mm
        
        data.notes.forEach(note => {
            let xStart = tickToX(note.start_tick);
            let xEnd = tickToX(note.end_tick);
            
            // Clamp to boundaries
            xStart = Math.max(leftBoundary, Math.min(rightBoundary, xStart));
            xEnd = Math.max(leftBoundary, Math.min(rightBoundary, xEnd));
            
            // Skip if note is entirely outside visible area
            if (xStart >= rightBoundary || xEnd <= leftBoundary) return;
            
            const width = Math.max(xEnd - xStart, 0.5); // Minimum width
            
            // Get Y position (center of note row)
            const yCenter = pitchToY(note.pitch);
            const y = yCenter - rowHeight / 2;
            const height = rowHeight;
            
            // Get color based on pitch class
            const color = getPitchClassColor(note.pitch);
            
            // Get the appropriate color group
            const group = colorGroups[color];
            if (!group) return;
            
            // Draw hatched rectangle
            drawHatchedRect(group, xStart, y, width, height, note.velocity, color);
        });
    }
    
    // Note: Chords are not part of the Architectural Sequencer concept
    // All notes are rendered as hatched rectangles grouped by color (pitch class)
    
    // Draw energy curve - clamp to frame boundaries
    if (config.showEnergy && data.energy_curve.length > 0) {
        const energyYBase = config.margin + noteAreaHeight + gapHeight;
        const rightBoundary = config.margin + config.contentWidth;
        const leftBoundary = config.margin + pianoKeySpace;
        
        // Build points, clamping x values
        const points = data.energy_curve
            .filter(point => {
                const x = tickToX(point.tick);
                return x >= leftBoundary && x <= rightBoundary;
            })
            .map(point => {
                const x = Math.max(leftBoundary, Math.min(rightBoundary, tickToX(point.tick)));
                const y = energyYBase + energyAreaHeight - (point.energy * energyAreaHeight * 0.9);
                return `${x},${y}`;
            });
        
        // Main curve
        if (points.length >= 2) {
            const polyline = createSvgElement('polyline', {
                points: points.join(' '),
                fill: 'none',
                stroke: config.energyColor,
                'stroke-width': config.strokeWidth,
                'stroke-linejoin': 'round',
                'stroke-linecap': 'round'
            });
            energyGroup.appendChild(polyline);
        }
        
        // Baseline - clamp to boundaries
        const xStart = Math.max(leftBoundary, tickToX(0));
        const xEnd = Math.min(rightBoundary, tickToX(data.energy_curve[data.energy_curve.length - 1].tick));
        const baselineY = energyYBase + energyAreaHeight;
        
        const baseline = createSvgElement('line', {
            x1: xStart,
            y1: baselineY,
            x2: xEnd,
            y2: baselineY,
            stroke: config.energyColor,
            'stroke-width': config.strokeWidth
        });
        energyGroup.appendChild(baseline);
        
        // Fill lines
        if (config.showEnergyFill) {
            const step = Math.max(1, Math.floor(data.energy_curve.length / 100));
            for (let i = 0; i < data.energy_curve.length; i += step) {
                const point = data.energy_curve[i];
                const x = tickToX(point.tick);
                
                // Skip if outside boundaries
                if (x < leftBoundary || x > rightBoundary) continue;
                
                const y = energyYBase + energyAreaHeight - (point.energy * energyAreaHeight * 0.9);
                
                if (y < baselineY - 1) {
                    const line = createSvgElement('line', {
                        x1: x,
                        y1: y,
                        x2: x,
                        y2: baselineY,
                        stroke: config.energyColor,
                        'stroke-width': config.strokeWidth,
                        'stroke-dasharray': '1,2'
                    });
                    energyGroup.appendChild(line);
                }
            }
        }
    }
    
    // Draw frame
    if (config.showFrame) {
        // Outer frame
        const rect = createSvgElement('rect', {
            x: config.margin,
            y: config.margin,
            width: config.contentWidth,
            height: config.contentHeight,
            fill: 'none',
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth
        });
        frameGroup.appendChild(rect);
        
        // Separator line
        const separatorY = config.margin + noteAreaHeight + gapHeight * 0.5;
        const separator = createSvgElement('line', {
            x1: config.margin,
            y1: separatorY,
            x2: config.margin + config.contentWidth,
            y2: separatorY,
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth
        });
        frameGroup.appendChild(separator);
    }
    
    // Append groups in order
    svg.appendChild(sustainGroup);
    svg.appendChild(gridGroup);
    svg.appendChild(pianoKeysGroup);
    // Add color groups (in pitch class order for consistency)
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
        const color = PITCH_CLASS_COLORS[pitchClass];
        if (colorGroups[color]) {
            svg.appendChild(colorGroups[color]);
        }
    }
    svg.appendChild(energyGroup);
    svg.appendChild(labelsGroup);
    svg.appendChild(frameGroup);
}

// ============================================================================
// Render: Circular (Clock)
// ============================================================================

function renderCircular() {
    const data = state.midiData;
    const config = getConfig();
    
    const svg = elements.svgOutput;
    svg.innerHTML = '';
    
    // For circular, use square aspect ratio
    const size = Math.min(config.width, config.height);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.backgroundColor = config.bgColor;
    
    const cx = size / 2;
    const cy = size / 2;
    const outerRadius = (size / 2) - config.margin;
    const innerRadius = outerRadius * 0.2;
    
    // Pitch mapping: low = inner, high = outer
    const pitchMin = Math.max(0, data.pitch_range.min - 2);
    const pitchMax = Math.min(127, data.pitch_range.max + 2);
    const pitchRange = pitchMax - pitchMin;
    
    const pitchToRadius = (pitch) => {
        const normalized = (pitch - pitchMin) / pitchRange;
        return innerRadius + normalized * (outerRadius - innerRadius);
    };
    
    // Time mapping: 0 = 12 o'clock, clockwise
    const tickToAngle = (tick) => {
        const normalized = tick / data.total_ticks;
        return -Math.PI / 2 + normalized * 2 * Math.PI;
    };
    
    const polarToCart = (r, angle) => ({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
    });
    
    // Create groups
    const gridGroup = createGroup('grid');
    const sustainGroup = createGroup('sustain');
    const notesGroup = createGroup('notes');
    const chordsGroup = createGroup('chords');
    const energyGroup = createGroup('energy');
    const frameGroup = createGroup('frame');
    const labelsGroup = createGroup('labels');
    
    // Draw beat grid / bar markers as radial lines
    if (config.showBeatGrid || config.showBarMarkers) {
        const ticksPerBeat = data.ticks_per_beat;
        for (let tick = 0; tick <= data.total_ticks; tick += ticksPerBeat) {
            const beatNum = tick / ticksPerBeat;
            const isBarLine = beatNum % 4 === 0;
            
            if ((config.showBarMarkers && isBarLine) || (config.showBeatGrid && !isBarLine)) {
                const angle = tickToAngle(tick);
                const start = polarToCart(innerRadius, angle);
                const end = polarToCart(outerRadius, angle);
                
                const line = createSvgElement('line', {
                    x1: start.x, y1: start.y,
                    x2: end.x, y2: end.y,
                    stroke: config.frameColor,
                    'stroke-width': config.strokeWidth,
                    'stroke-opacity': isBarLine ? 0.4 : 0.15
                });
                gridGroup.appendChild(line);
            }
        }
    }
    
    // Draw piano key guide circles (C notes)
    if (config.showPianoKeys) {
        for (let pitch = pitchMin; pitch <= pitchMax; pitch++) {
            const { isC, octave } = getPitchName(pitch);
            if (isC) {
                const r = pitchToRadius(pitch);
                const circle = createSvgElement('circle', {
                    cx, cy, r,
                    fill: 'none',
                    stroke: config.frameColor,
                    'stroke-width': config.strokeWidth,
                    'stroke-opacity': 0.3
                });
                gridGroup.appendChild(circle);
                
                // Add label
                const labelPos = polarToCart(r, -Math.PI / 2 - 0.1);
                const text = createSvgElement('text', {
                    x: labelPos.x + 2,
                    y: labelPos.y,
                    fill: config.frameColor,
                    'font-size': 3,
                    'font-family': 'JetBrains Mono, monospace'
                });
                text.textContent = `C${octave}`;
                labelsGroup.appendChild(text);
            }
        }
    }
    
    // Draw time labels
    if (config.showTimeLabels) {
        const secondsPerTick = (data.tempo_us / 1000000) / data.ticks_per_beat;
        const labelInterval = Math.max(10, Math.ceil(data.duration_seconds / 12 / 10) * 10);
        
        for (let sec = 0; sec < data.duration_seconds; sec += labelInterval) {
            const tick = sec / secondsPerTick;
            const angle = tickToAngle(tick);
            const pos = polarToCart(outerRadius + 5, angle);
            
            const text = createSvgElement('text', {
                x: pos.x,
                y: pos.y,
                fill: config.frameColor,
                'font-size': 2.5,
                'font-family': 'JetBrains Mono, monospace',
                'text-anchor': 'middle',
                'dominant-baseline': 'middle'
            });
            text.textContent = `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
            labelsGroup.appendChild(text);
        }
    }
    
    // Draw frame circles
    if (config.showFrame) {
        const outerCircle = createSvgElement('circle', {
            cx, cy,
            r: outerRadius,
            fill: 'none',
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth
        });
        frameGroup.appendChild(outerCircle);
        
        const innerCircle = createSvgElement('circle', {
            cx, cy,
            r: innerRadius,
            fill: 'none',
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth
        });
        frameGroup.appendChild(innerCircle);
        
        // Hour markers (12 divisions)
        for (let i = 0; i < 12; i++) {
            const angle = -Math.PI / 2 + (i / 12) * 2 * Math.PI;
            const start = polarToCart(outerRadius - 3, angle);
            const end = polarToCart(outerRadius, angle);
            const marker = createSvgElement('line', {
                x1: start.x, y1: start.y,
                x2: end.x, y2: end.y,
                stroke: config.frameColor,
                'stroke-width': config.strokeWidth
            });
            frameGroup.appendChild(marker);
        }
    }
    
    // Draw sustain as arc segments
    if (config.showSustain) {
        data.sustain_segments.forEach(segment => {
            const startAngle = tickToAngle(segment.start_tick);
            const endAngle = tickToAngle(segment.end_tick);
            
            // Draw arc at outer edge
            const path = createSvgElement('path', {
                d: describeArc(cx, cy, outerRadius - 2, startAngle, endAngle),
                fill: 'none',
                stroke: config.sustainColor,
                'stroke-width': config.strokeWidth,
                opacity: 0.6
            });
            sustainGroup.appendChild(path);
        });
    }
    
    // Draw notes as arcs
    if (config.showNotes) {
        data.notes.forEach(note => {
            const startAngle = tickToAngle(note.start_tick);
            const endAngle = tickToAngle(note.end_tick);
            const r = pitchToRadius(note.pitch);
            
            const path = createSvgElement('path', {
                d: describeArc(cx, cy, r, startAngle, endAngle),
                fill: 'none',
                stroke: config.noteColor,
                'stroke-width': config.strokeWidth,
                'stroke-linecap': 'round'
            });
            notesGroup.appendChild(path);
        });
    }
    
    // Draw chords as radial lines
    if (config.showChords) {
        data.chords.forEach(chord => {
            const angle = tickToAngle(chord.start_tick);
            const rMin = pitchToRadius(chord.min_pitch);
            const rMax = pitchToRadius(chord.max_pitch);
            
            const start = polarToCart(rMin, angle);
            const end = polarToCart(rMax, angle);
            
            const line = createSvgElement('line', {
                x1: start.x, y1: start.y,
                x2: end.x, y2: end.y,
                stroke: config.chordColor,
                'stroke-width': config.strokeWidth,
                'stroke-linecap': 'round'
            });
            chordsGroup.appendChild(line);
            
            // Tick marks at each note
            chord.note_pitches.forEach(pitch => {
                const r = pitchToRadius(pitch);
                const tickStart = polarToCart(r - 1, angle);
                const tickEnd = polarToCart(r + 1, angle);
                const tick = createSvgElement('line', {
                    x1: tickStart.x, y1: tickStart.y,
                    x2: tickEnd.x, y2: tickEnd.y,
                    stroke: config.chordColor,
                    'stroke-width': config.strokeWidth
                });
                chordsGroup.appendChild(tick);
            });
        });
    }
    
    // Draw energy curve as a radial plot in the center
    if (config.showEnergy && data.energy_curve.length > 0) {
        const energyRadius = innerRadius * 0.8;
        const points = data.energy_curve.map(point => {
            const angle = tickToAngle(point.tick);
            const r = energyRadius * 0.2 + point.energy * energyRadius * 0.8;
            const pos = polarToCart(r, angle);
            return `${pos.x},${pos.y}`;
        });
        
        if (points.length >= 2) {
            // Draw as polyline (outline only for plotter)
            const polyline = createSvgElement('polyline', {
                points: points.join(' '),
                fill: 'none',
                stroke: config.energyColor,
                'stroke-width': config.strokeWidth,
                'stroke-linejoin': 'round'
            });
            energyGroup.appendChild(polyline);
            
            // Close the shape
            const firstPoint = data.energy_curve[0];
            const lastPoint = data.energy_curve[data.energy_curve.length - 1];
            const firstAngle = tickToAngle(firstPoint.tick);
            const lastAngle = tickToAngle(lastPoint.tick);
            const firstR = energyRadius * 0.2 + firstPoint.energy * energyRadius * 0.8;
            const lastR = energyRadius * 0.2 + lastPoint.energy * energyRadius * 0.8;
            const firstPos = polarToCart(firstR, firstAngle);
            const lastPos = polarToCart(lastR, lastAngle);
            
            const closeLine = createSvgElement('line', {
                x1: lastPos.x, y1: lastPos.y,
                x2: firstPos.x, y2: firstPos.y,
                stroke: config.energyColor,
                'stroke-width': config.strokeWidth
            });
            energyGroup.appendChild(closeLine);
        }
    }
    
    // Append groups
    svg.appendChild(gridGroup);
    svg.appendChild(sustainGroup);
    svg.appendChild(notesGroup);
    svg.appendChild(chordsGroup);
    svg.appendChild(energyGroup);
    svg.appendChild(labelsGroup);
    svg.appendChild(frameGroup);
}

// Helper for arc paths
function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
    const end = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// ============================================================================
// Render: Spiral
// ============================================================================

function renderSpiral() {
    const data = state.midiData;
    const config = getConfig();
    
    const svg = elements.svgOutput;
    svg.innerHTML = '';
    
    const size = Math.min(config.width, config.height);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.backgroundColor = config.bgColor;
    
    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = (size / 2) - config.margin;
    const minRadius = 10;
    
    // How many rotations for the full piece
    const rotations = Math.max(3, Math.ceil(data.duration_seconds / 60)); // 1 rotation per minute
    
    const pitchMin = Math.max(0, data.pitch_range.min - 2);
    const pitchMax = Math.min(127, data.pitch_range.max + 2);
    const pitchRange = pitchMax - pitchMin;
    
    // Time to spiral position
    const tickToSpiral = (tick) => {
        const t = tick / data.total_ticks;
        const angle = t * rotations * 2 * Math.PI - Math.PI / 2;
        const r = minRadius + t * (maxRadius - minRadius);
        return { angle, r };
    };
    
    const pitchToOffset = (pitch) => {
        return ((pitch - pitchMin) / pitchRange - 0.5) * 8; // +/- 4 units offset
    };
    
    const spiralToCart = (tick, pitch) => {
        const { angle, r } = tickToSpiral(tick);
        const offset = pitch !== undefined ? pitchToOffset(pitch) : 0;
        const finalR = r + offset;
        return {
            x: cx + finalR * Math.cos(angle),
            y: cy + finalR * Math.sin(angle)
        };
    };
    
    // Create groups
    const gridGroup = createGroup('grid');
    const spiralGuideGroup = createGroup('spiral-guide');
    const sustainGroup = createGroup('sustain');
    const notesGroup = createGroup('notes');
    const chordsGroup = createGroup('chords');
    const energyGroup = createGroup('energy');
    const frameGroup = createGroup('frame');
    const labelsGroup = createGroup('labels');
    
    // Draw spiral guide
    if (config.showFrame) {
        const guidePoints = [];
        for (let t = 0; t <= 1; t += 0.005) {
            const tick = t * data.total_ticks;
            const { angle, r } = tickToSpiral(tick);
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            guidePoints.push(`${x},${y}`);
        }
        
        const guide = createSvgElement('polyline', {
            points: guidePoints.join(' '),
            fill: 'none',
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth,
            opacity: 0.3
        });
        spiralGuideGroup.appendChild(guide);
    }
    
    // Draw beat/bar markers along the spiral
    if (config.showBeatGrid || config.showBarMarkers) {
        const ticksPerBeat = data.ticks_per_beat;
        for (let tick = 0; tick <= data.total_ticks; tick += ticksPerBeat) {
            const beatNum = tick / ticksPerBeat;
            const isBarLine = beatNum % 4 === 0;
            
            if ((config.showBarMarkers && isBarLine) || (config.showBeatGrid && !isBarLine)) {
                const { angle, r } = tickToSpiral(tick);
                const innerPos = { x: cx + (r - 3) * Math.cos(angle), y: cy + (r - 3) * Math.sin(angle) };
                const outerPos = { x: cx + (r + 3) * Math.cos(angle), y: cy + (r + 3) * Math.sin(angle) };
                
                const line = createSvgElement('line', {
                    x1: innerPos.x, y1: innerPos.y,
                    x2: outerPos.x, y2: outerPos.y,
                    stroke: config.frameColor,
                    'stroke-width': config.strokeWidth,
                    'stroke-opacity': isBarLine ? 0.5 : 0.2
                });
                gridGroup.appendChild(line);
            }
        }
    }
    
    // Draw time labels along spiral
    if (config.showTimeLabels) {
        const secondsPerTick = (data.tempo_us / 1000000) / data.ticks_per_beat;
        const labelInterval = Math.max(10, Math.ceil(data.duration_seconds / 10 / 10) * 10);
        
        for (let sec = 0; sec <= data.duration_seconds; sec += labelInterval) {
            const tick = sec / secondsPerTick;
            const { angle, r } = tickToSpiral(tick);
            const pos = { x: cx + (r + 6) * Math.cos(angle), y: cy + (r + 6) * Math.sin(angle) };
            
            const text = createSvgElement('text', {
                x: pos.x,
                y: pos.y,
                fill: config.frameColor,
                'font-size': 2.5,
                'font-family': 'JetBrains Mono, monospace',
                'text-anchor': 'middle',
                'dominant-baseline': 'middle'
            });
            text.textContent = `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
            labelsGroup.appendChild(text);
        }
    }
    
    // Draw sustain as thickened spiral sections
    if (config.showSustain) {
        data.sustain_segments.forEach(segment => {
            const points = [];
            const startT = segment.start_tick / data.total_ticks;
            const endT = segment.end_tick / data.total_ticks;
            
            for (let t = startT; t <= endT; t += 0.005) {
                const tick = t * data.total_ticks;
                const { angle, r } = tickToSpiral(tick);
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);
                points.push(`${x},${y}`);
            }
            
            if (points.length > 1) {
                const path = createSvgElement('polyline', {
                    points: points.join(' '),
                    fill: 'none',
                    stroke: config.sustainColor,
                    'stroke-width': config.strokeWidth,
                    opacity: 0.6
                });
                sustainGroup.appendChild(path);
            }
        });
    }
    
    // Draw notes as lines along spiral
    if (config.showNotes) {
        data.notes.forEach(note => {
            const start = spiralToCart(note.start_tick, note.pitch);
            const end = spiralToCart(note.end_tick, note.pitch);
            
            const line = createSvgElement('line', {
                x1: start.x, y1: start.y,
                x2: end.x, y2: end.y,
                stroke: config.noteColor,
                'stroke-width': config.strokeWidth,
                'stroke-linecap': 'round'
            });
            notesGroup.appendChild(line);
        });
    }
    
    // Draw chords as small crosses
    if (config.showChords) {
        data.chords.forEach(chord => {
            const baseTick = chord.start_tick;
            
            // Draw vertical line connecting all chord notes
            if (chord.note_pitches.length > 1) {
                const minPos = spiralToCart(baseTick, chord.min_pitch);
                const maxPos = spiralToCart(baseTick, chord.max_pitch);
                
                const line = createSvgElement('line', {
                    x1: minPos.x, y1: minPos.y,
                    x2: maxPos.x, y2: maxPos.y,
                    stroke: config.chordColor,
                    'stroke-width': config.strokeWidth
                });
                chordsGroup.appendChild(line);
            }
            
            // Draw tick at each pitch
            chord.note_pitches.forEach(pitch => {
                const pos = spiralToCart(baseTick, pitch);
                const { angle } = tickToSpiral(baseTick);
                
                // Perpendicular tick mark
                const tickLen = 1.5;
                const perpAngle = angle + Math.PI / 2;
                const tick = createSvgElement('line', {
                    x1: pos.x - tickLen * Math.cos(perpAngle),
                    y1: pos.y - tickLen * Math.sin(perpAngle),
                    x2: pos.x + tickLen * Math.cos(perpAngle),
                    y2: pos.y + tickLen * Math.sin(perpAngle),
                    stroke: config.chordColor,
                    'stroke-width': config.strokeWidth
                });
                chordsGroup.appendChild(tick);
            });
        });
    }
    
    // Draw energy as varying radius along the spiral center
    if (config.showEnergy && data.energy_curve.length > 0) {
        const energyPoints = [];
        
        data.energy_curve.forEach(point => {
            const { angle, r } = tickToSpiral(point.tick);
            const energyOffset = point.energy * 5 - 2.5; // +/- 2.5 units based on energy
            const pos = { x: cx + (r + energyOffset) * Math.cos(angle), y: cy + (r + energyOffset) * Math.sin(angle) };
            energyPoints.push(`${pos.x},${pos.y}`);
        });
        
        if (energyPoints.length > 1) {
            const polyline = createSvgElement('polyline', {
                points: energyPoints.join(' '),
                fill: 'none',
                stroke: config.energyColor,
                'stroke-width': config.strokeWidth,
                'stroke-linejoin': 'round'
            });
            energyGroup.appendChild(polyline);
        }
    }
    
    // Draw outer frame
    if (config.showFrame) {
        const outerCircle = createSvgElement('circle', {
            cx, cy,
            r: maxRadius,
            fill: 'none',
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth
        });
        frameGroup.appendChild(outerCircle);
    }
    
    // Append groups
    svg.appendChild(gridGroup);
    svg.appendChild(spiralGuideGroup);
    svg.appendChild(sustainGroup);
    svg.appendChild(notesGroup);
    svg.appendChild(chordsGroup);
    svg.appendChild(energyGroup);
    svg.appendChild(labelsGroup);
    svg.appendChild(frameGroup);
}

// ============================================================================
// Render: Waterfall
// ============================================================================

function renderWaterfall() {
    const data = state.midiData;
    const config = getConfig();
    
    const svg = elements.svgOutput;
    svg.innerHTML = '';
    
    svg.setAttribute('viewBox', `0 0 ${config.width} ${config.height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.backgroundColor = config.bgColor;
    
    // Divide time into bars (vertical slices)
    const numBars = Math.min(200, Math.max(50, Math.floor(data.duration_seconds * 2)));
    const barWidth = config.contentWidth / numBars;
    const barMaxHeight = config.contentHeight * 0.85;
    const sustainAreaHeight = config.contentHeight * 0.05;
    
    const ticksPerBar = data.total_ticks / numBars;
    
    // Create groups
    const gridGroup = createGroup('grid');
    const sustainGroup = createGroup('sustain');
    const barsGroup = createGroup('bars');
    const chordsGroup = createGroup('chords');
    const energyGroup = createGroup('energy');
    const frameGroup = createGroup('frame');
    const labelsGroup = createGroup('labels');
    
    // Calculate activity per bar
    const barData = [];
    for (let i = 0; i < numBars; i++) {
        const startTick = i * ticksPerBar;
        const endTick = (i + 1) * ticksPerBar;
        
        // Count notes and sum velocities in this bar
        let noteCount = 0;
        let velocitySum = 0;
        let minPitch = 127;
        let maxPitch = 0;
        let chordCount = 0;
        
        data.notes.forEach(note => {
            if (note.start_tick >= startTick && note.start_tick < endTick) {
                noteCount++;
                velocitySum += note.velocity;
                minPitch = Math.min(minPitch, note.pitch);
                maxPitch = Math.max(maxPitch, note.pitch);
            }
        });
        
        data.chords.forEach(chord => {
            if (chord.start_tick >= startTick && chord.start_tick < endTick) {
                chordCount++;
            }
        });
        
        barData.push({
            noteCount,
            chordCount,
            avgVelocity: noteCount > 0 ? velocitySum / noteCount : 0,
            minPitch: noteCount > 0 ? minPitch : 60,
            maxPitch: noteCount > 0 ? maxPitch : 60,
            hasSustain: data.sustain_segments.some(s => 
                s.start_tick <= endTick && s.end_tick >= startTick
            )
        });
    }
    
    const maxNotes = Math.max(1, ...barData.map(b => b.noteCount));
    
    // Draw beat grid / bar markers
    if (config.showBeatGrid || config.showBarMarkers) {
        const ticksPerBeat = data.ticks_per_beat;
        for (let tick = 0; tick <= data.total_ticks; tick += ticksPerBeat) {
            const x = config.margin + (tick / data.total_ticks) * config.contentWidth;
            const beatNum = tick / ticksPerBeat;
            const isBarLine = beatNum % 4 === 0;
            
            if ((config.showBarMarkers && isBarLine) || (config.showBeatGrid && !isBarLine)) {
                const line = createSvgElement('line', {
                    x1: x,
                    y1: config.margin,
                    x2: x,
                    y2: config.margin + barMaxHeight,
                    stroke: config.frameColor,
                    'stroke-width': config.strokeWidth,
                    'stroke-opacity': isBarLine ? 0.4 : 0.15
                });
                gridGroup.appendChild(line);
            }
        }
    }
    
    // Draw time labels - adaptive interval for readability
    if (config.showTimeLabels) {
        const secondsPerTick = (data.tempo_us / 1000000) / data.ticks_per_beat;
        
        // Calculate adaptive label interval
        const targetLabelCount = elements.portraitMode.checked ? 5 : 8;
        const rawInterval = data.duration_seconds / targetLabelCount;
        const niceIntervals = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300];
        let labelInterval = niceIntervals.find(i => i >= rawInterval) || Math.ceil(rawInterval / 60) * 60;
        if (elements.portraitMode.checked) {
            labelInterval = Math.max(labelInterval, 20);
        }
        
        const labelY = config.margin + config.contentHeight + 5;
        const minX = config.margin + 5;
        const maxX = config.margin + config.contentWidth - 5;
        
        for (let sec = 0; sec <= data.duration_seconds; sec += labelInterval) {
            const tick = sec / secondsPerTick;
            let x = config.margin + (tick / data.total_ticks) * config.contentWidth;
            
            // Skip labels outside valid range
            if (x < minX - 2 || x > maxX + 2) continue;
            
            x = Math.max(minX, Math.min(maxX, x));
            
            // Adjust text anchor for edge labels
            let anchor = 'middle';
            if (sec === 0) anchor = 'start';
            else if (sec >= data.duration_seconds - labelInterval / 2) anchor = 'end';
            
            const text = createSvgElement('text', {
                x: x,
                y: labelY,
                fill: config.frameColor,
                'font-size': 3,
                'font-family': 'JetBrains Mono, monospace',
                'text-anchor': anchor
            });
            text.textContent = `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
            labelsGroup.appendChild(text);
        }
    }
    
    // Draw sustain as bottom indicators
    if (config.showSustain) {
        const sustainY = config.margin + barMaxHeight + 2;
        
        data.sustain_segments.forEach(segment => {
            const xStart = config.margin + (segment.start_tick / data.total_ticks) * config.contentWidth;
            const xEnd = config.margin + (segment.end_tick / data.total_ticks) * config.contentWidth;
            
            const line = createSvgElement('line', {
                x1: xStart,
                y1: sustainY,
                x2: xEnd,
                y2: sustainY,
                stroke: config.sustainColor,
                'stroke-width': config.strokeWidth
            });
            sustainGroup.appendChild(line);
            
            // Boundary ticks
            [xStart, xEnd].forEach(x => {
                const tick = createSvgElement('line', {
                    x1: x,
                    y1: sustainY - 1,
                    x2: x,
                    y2: sustainY + 1,
                    stroke: config.sustainColor,
                    'stroke-width': config.strokeWidth
                });
                sustainGroup.appendChild(tick);
            });
        });
    }
    
    // Draw bars (notes)
    if (config.showNotes) {
        barData.forEach((bar, i) => {
            const x = config.margin + i * barWidth;
            const normalizedCount = bar.noteCount / maxNotes;
            const barHeight = normalizedCount * barMaxHeight;
            const y = config.margin + barMaxHeight - barHeight;
            
            if (bar.noteCount > 0) {
                // Main bar outline
                const rect = createSvgElement('rect', {
                    x: x,
                    y: y,
                    width: barWidth - 0.5,
                    height: barHeight,
                    fill: 'none',
                    stroke: config.noteColor,
                    'stroke-width': config.strokeWidth
                });
                barsGroup.appendChild(rect);
                
                // Fill lines
                const fillDensity = Math.ceil(bar.avgVelocity / 25);
                const lineSpacing = barHeight / (fillDensity + 1);
                
                for (let j = 1; j <= fillDensity; j++) {
                    const lineY = y + j * lineSpacing;
                    const line = createSvgElement('line', {
                        x1: x,
                        y1: lineY,
                        x2: x + barWidth - 0.5,
                        y2: lineY,
                        stroke: config.noteColor,
                        'stroke-width': config.strokeWidth
                    });
                    barsGroup.appendChild(line);
                }
            }
        });
    }
    
    // Draw chord indicators
    if (config.showChords) {
        barData.forEach((bar, i) => {
            if (bar.chordCount > 0) {
                const x = config.margin + i * barWidth + barWidth / 2;
                const normalizedCount = bar.noteCount / maxNotes;
                const barHeight = normalizedCount * barMaxHeight;
                const y = config.margin + barMaxHeight - barHeight;
                
                // Draw a small triangle at top of bar for chords
                const triSize = 2;
                const triangle = createSvgElement('path', {
                    d: `M ${x - triSize} ${y - triSize} L ${x + triSize} ${y - triSize} L ${x} ${y - triSize * 2} Z`,
                    fill: 'none',
                    stroke: config.chordColor,
                    'stroke-width': config.strokeWidth
                });
                chordsGroup.appendChild(triangle);
            }
        });
    }
    
    // Draw energy curve overlay
    if (config.showEnergy && data.energy_curve.length > 0) {
        const energyPoints = data.energy_curve.map(point => {
            const x = config.margin + (point.tick / data.total_ticks) * config.contentWidth;
            const y = config.margin + barMaxHeight - (point.energy * barMaxHeight);
            return `${x},${y}`;
        });
        
        const energyLine = createSvgElement('polyline', {
            points: energyPoints.join(' '),
            fill: 'none',
            stroke: config.energyColor,
            'stroke-width': config.strokeWidth,
            'stroke-linejoin': 'round'
        });
        energyGroup.appendChild(energyLine);
        
        // Baseline
        const baseline = createSvgElement('line', {
            x1: config.margin,
            y1: config.margin + barMaxHeight,
            x2: config.margin + config.contentWidth,
            y2: config.margin + barMaxHeight,
            stroke: config.energyColor,
            'stroke-width': config.strokeWidth,
            'stroke-opacity': 0.3
        });
        energyGroup.appendChild(baseline);
    }
    
    // Draw frame
    if (config.showFrame) {
        const rect = createSvgElement('rect', {
            x: config.margin,
            y: config.margin,
            width: config.contentWidth,
            height: config.contentHeight,
            fill: 'none',
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth
        });
        frameGroup.appendChild(rect);
    }
    
    // Append groups
    svg.appendChild(gridGroup);
    svg.appendChild(sustainGroup);
    svg.appendChild(barsGroup);
    svg.appendChild(chordsGroup);
    svg.appendChild(energyGroup);
    svg.appendChild(labelsGroup);
    svg.appendChild(frameGroup);
}

// ============================================================================
// Render: Flow Field (Generative Art - Backend Rendered)
// ============================================================================

async function renderFlowField() {
    const data = state.midiData;
    if (!data) return;
    
    const config = getConfig();
    
    // Show loading state
    elements.loadingOverlay.classList.remove('hidden');
    
    const svg = elements.svgOutput;
    svg.innerHTML = '';
    
    try {
        // Request SVG from backend
        const response = await fetch('/render', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: data,
                style: 'flow_field',
                config: {
                    width: config.width,
                    height: config.height,
                    margin: config.margin,
                    stroke_width: config.strokeWidth,
                    note_color: config.noteColor,
                    frame_color: config.frameColor
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Parse and display the SVG
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(result.svg, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;
            
            // Set viewBox and styling
            svg.setAttribute('viewBox', `0 0 ${config.width} ${config.height}`);
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.backgroundColor = config.bgColor;
            
            // Clear existing content and copy all children from the rendered SVG
            svg.innerHTML = '';
            Array.from(svgElement.children).forEach(child => {
                svg.appendChild(child.cloneNode(true));
            });
        } else {
            alert('Error rendering flow field: ' + result.error);
        }
    } catch (err) {
        alert('Failed to render flow field: ' + err.message);
        console.error(err);
    } finally {
        elements.loadingOverlay.classList.add('hidden');
    }
}

// ============================================================================
// Render: Piano Keys
// ============================================================================

function renderPiano() {
    const data = state.midiData;
    const config = getConfig();
    
    const svg = elements.svgOutput;
    svg.innerHTML = '';
    
    svg.setAttribute('viewBox', `0 0 ${config.width} ${config.height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.backgroundColor = config.bgColor;
    
    // Piano key layout constants
    const whiteKeyWidth = 14;  // mm
    const blackKeyWidth = 9;   // mm
    const blackKeyHeightRatio = 0.6;  // black keys are 60% of white key height
    
    // Determine pitch range - expand to full octaves for cleaner look
    let pitchMin = Math.max(0, data.pitch_range.min - 2);
    let pitchMax = Math.min(127, data.pitch_range.max + 2);
    
    // Expand to complete octaves for proper piano appearance
    pitchMin = Math.floor(pitchMin / 12) * 12;  // Start at C
    pitchMax = Math.ceil((pitchMax + 1) / 12) * 12 - 1;  // End at B
    
    // Count white keys in range
    const countWhiteKeys = (minPitch, maxPitch) => {
        let count = 0;
        for (let p = minPitch; p <= maxPitch; p++) {
            if (!isBlackKey(p)) count++;
        }
        return count;
    };
    
    const numWhiteKeys = countWhiteKeys(pitchMin, pitchMax);
    
    // Calculate dimensions
    const pianoWidth = 35;  // Fixed width for piano keyboard area
    const noteAreaWidth = config.contentWidth - pianoWidth;
    const keyboardHeight = config.contentHeight * 0.85;  // Leave room for energy
    const energyHeight = config.contentHeight * 0.12;
    const gapHeight = config.contentHeight * 0.03;
    
    // Dynamic white key height based on range
    const calculatedWhiteKeyHeight = keyboardHeight / numWhiteKeys;
    
    // Time mapping
    const timeScale = data.total_ticks > 0 ? noteAreaWidth / data.total_ticks : 1;
    const tickToX = (tick) => config.margin + pianoWidth + tick * timeScale;
    
    // Create a map of pitch to Y position
    const pitchPositions = new Map();
    let currentY = config.margin;
    
    // Build position map (top to bottom = high to low pitch)
    for (let pitch = pitchMax; pitch >= pitchMin; pitch--) {
        if (!isBlackKey(pitch)) {
            pitchPositions.set(pitch, {
                y: currentY,
                height: calculatedWhiteKeyHeight,
                isBlack: false
            });
            currentY += calculatedWhiteKeyHeight;
        }
    }
    
    // Position black keys relative to their white key neighbors
    for (let pitch = pitchMax; pitch >= pitchMin; pitch--) {
        if (isBlackKey(pitch)) {
            // Black key sits between two white keys
            const whiteKeyBelow = pitchPositions.get(pitch - 1);
            const whiteKeyAbove = pitchPositions.get(pitch + 1);
            
            if (whiteKeyBelow && whiteKeyAbove) {
                const centerY = (whiteKeyBelow.y + whiteKeyAbove.y + whiteKeyAbove.height) / 2;
                const blackHeight = calculatedWhiteKeyHeight * 0.7;
                pitchPositions.set(pitch, {
                    y: centerY - blackHeight / 2,
                    height: blackHeight,
                    isBlack: true
                });
            }
        }
    }
    
    // Helper to get Y position for a pitch
    const getPitchY = (pitch) => {
        const pos = pitchPositions.get(pitch);
        return pos ? pos.y + pos.height / 2 : config.margin + keyboardHeight / 2;
    };
    
    const getPitchHeight = (pitch) => {
        const pos = pitchPositions.get(pitch);
        return pos ? pos.height * 0.85 : calculatedWhiteKeyHeight * 0.5;
    };
    
    // Create groups
    const gridGroup = createGroup('grid');
    const pianoGroup = createGroup('piano');
    const sustainGroup = createGroup('sustain');
    const notesGroup = createGroup('notes');
    const chordsGroup = createGroup('chords');
    const energyGroup = createGroup('energy');
    const frameGroup = createGroup('frame');
    const labelsGroup = createGroup('labels');
    
    // Draw beat grid / bar markers
    if (config.showBeatGrid || config.showBarMarkers) {
        const ticksPerBeat = data.ticks_per_beat;
        for (let tick = 0; tick <= data.total_ticks; tick += ticksPerBeat) {
            const x = tickToX(tick);
            const beatNum = tick / ticksPerBeat;
            const isBarLine = beatNum % 4 === 0;
            
            if ((config.showBarMarkers && isBarLine) || (config.showBeatGrid && !isBarLine)) {
                const line = createSvgElement('line', {
                    x1: x,
                    y1: config.margin,
                    x2: x,
                    y2: config.margin + keyboardHeight,
                    stroke: config.frameColor,
                    'stroke-width': config.strokeWidth,
                    'stroke-opacity': isBarLine ? 0.4 : 0.15
                });
                gridGroup.appendChild(line);
            }
        }
    }
    
    // Draw time labels - adaptive interval for readability
    if (config.showTimeLabels) {
        const secondsPerTick = (data.tempo_us / 1000000) / data.ticks_per_beat;
        
        // Calculate adaptive label interval based on available width and duration
        const targetLabelCount = elements.portraitMode.checked ? 5 : 8;
        const rawInterval = data.duration_seconds / targetLabelCount;
        const niceIntervals = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300];
        let labelInterval = niceIntervals.find(i => i >= rawInterval) || Math.ceil(rawInterval / 60) * 60;
        // Ensure minimum 20 seconds in portrait mode
        if (elements.portraitMode.checked) {
            labelInterval = Math.max(labelInterval, 20);
        }
        
        const labelY = config.margin + keyboardHeight + gapHeight / 2;
        const minX = config.margin + pianoWidth + 5;
        const maxX = config.margin + config.contentWidth - 5;
        
        for (let sec = 0; sec <= data.duration_seconds; sec += labelInterval) {
            const tick = sec / secondsPerTick;
            const x = tickToX(tick);
            
            // Skip labels outside the valid range
            if (x < minX - 2 || x > maxX + 2) continue;
            
            const clampedX = Math.max(minX, Math.min(maxX, x));
            
            // Adjust text anchor for edge labels
            let anchor = 'middle';
            if (sec === 0) anchor = 'start';
            else if (sec >= data.duration_seconds - labelInterval / 2) anchor = 'end';
            
            const text = createSvgElement('text', {
                x: clampedX,
                y: labelY,
                fill: config.frameColor,
                'font-size': 3,
                'font-family': 'JetBrains Mono, monospace',
                'text-anchor': anchor
            });
            text.textContent = `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
            labelsGroup.appendChild(text);
        }
    }
    
    // Draw pitch lanes with C note labels (piano keys visualization)
    if (config.showPianoKeys) {
        for (let pitch = pitchMin; pitch <= pitchMax; pitch++) {
            const pos = pitchPositions.get(pitch);
            if (pos) {
                // Lane separator line
                const separator = createSvgElement('line', {
                    x1: config.margin + pianoWidth,
                    y1: pos.y + pos.height,
                    x2: config.margin + pianoWidth + noteAreaWidth,
                    y2: pos.y + pos.height,
                    stroke: config.frameColor,
                    'stroke-width': config.strokeWidth,
                    'stroke-opacity': 0.15
                });
                gridGroup.appendChild(separator);
            }
        }
    }
    
    // Draw piano keys (stroke only for plotter)
    if (config.showPianoKeys) {
        // Draw white keys first
        for (let pitch = pitchMin; pitch <= pitchMax; pitch++) {
            if (!isBlackKey(pitch)) {
                const pos = pitchPositions.get(pitch);
                if (pos) {
                    const keyRect = createSvgElement('rect', {
                        x: config.margin + 1,
                        y: pos.y + 0.5,
                        width: pianoWidth - 2,
                        height: pos.height - 1,
                        fill: 'none',
                        stroke: config.frameColor,
                        'stroke-width': config.strokeWidth,
                        rx: 1
                    });
                    pianoGroup.appendChild(keyRect);
                    
                    // Add C note labels
                    const { octave, isC } = getPitchName(pitch);
                    if (isC) {
                        const label = createSvgElement('text', {
                            x: config.margin + pianoWidth - 4,
                            y: pos.y + pos.height / 2 + 1.5,
                            fill: config.frameColor,
                            'font-size': 3,
                            'font-family': 'JetBrains Mono, monospace',
                            'text-anchor': 'end',
                            'font-weight': '600'
                        });
                        label.textContent = `C${octave}`;
                        labelsGroup.appendChild(label);
                    }
                }
            }
        }
        
        // Draw black keys (filled rectangles to distinguish)
        for (let pitch = pitchMin; pitch <= pitchMax; pitch++) {
            if (isBlackKey(pitch)) {
                const pos = pitchPositions.get(pitch);
                if (pos) {
                    const keyRect = createSvgElement('rect', {
                        x: config.margin + 1,
                        y: pos.y,
                        width: pianoWidth * 0.65,
                        height: pos.height,
                        fill: 'none',
                        stroke: config.frameColor,
                        'stroke-width': config.strokeWidth,
                        rx: 0.5
                    });
                    pianoGroup.appendChild(keyRect);
                    
                    // Cross-hatch to indicate black key
                    const hatchLine = createSvgElement('line', {
                        x1: config.margin + 2,
                        y1: pos.y + pos.height / 2,
                        x2: config.margin + pianoWidth * 0.6,
                        y2: pos.y + pos.height / 2,
                        stroke: config.frameColor,
                        'stroke-width': config.strokeWidth
                    });
                    pianoGroup.appendChild(hatchLine);
                }
            }
        }
    }
    
    // Draw sustain indicators in the note area
    if (config.showSustain) {
        data.sustain_segments.forEach(segment => {
            const xStart = tickToX(segment.start_tick);
            const xEnd = tickToX(segment.end_tick);
            
            const sustainRect = createSvgElement('rect', {
                x: xStart,
                y: config.margin,
                width: xEnd - xStart,
                height: keyboardHeight,
                fill: config.sustainColor,
                opacity: 0.08
            });
            sustainGroup.appendChild(sustainRect);
            
            // Sustain boundary lines using multiple parallel lines for "thick" effect
            const thickLineSpacing = 0.3;
            [xStart, xEnd].forEach(x => {
                [-thickLineSpacing / 2, thickLineSpacing / 2].forEach(offset => {
                    const line = createSvgElement('line', {
                        x1: x + offset,
                        y1: config.margin,
                        x2: x + offset,
                        y2: config.margin + keyboardHeight,
                        stroke: config.sustainColor,
                        'stroke-width': config.strokeWidth,
                        opacity: 0.4
                    });
                    sustainGroup.appendChild(line);
                });
            });
        });
    }
    
    // Draw notes as rectangles
    if (config.showNotes) {
        data.notes.forEach(note => {
            const pos = pitchPositions.get(note.pitch);
            if (!pos) return;
            
            const xStart = tickToX(note.start_tick);
            const xEnd = tickToX(note.end_tick);
            const noteHeight = pos.height * 0.75;
            const y = pos.y + (pos.height - noteHeight) / 2;
            
            // Main note rectangle (stroke only for plotter)
            const noteRect = createSvgElement('rect', {
                x: xStart,
                y: y,
                width: Math.max(xEnd - xStart, 1),
                height: noteHeight,
                fill: 'none',
                stroke: config.noteColor,
                'stroke-width': config.strokeWidth,
                rx: 1
            });
            notesGroup.appendChild(noteRect);
            
            // Attack tick mark at note start
            const tickLen = noteHeight * 0.3;
            const tick = createSvgElement('line', {
                x1: xStart,
                y1: y + noteHeight / 2 - tickLen,
                x2: xStart,
                y2: y + noteHeight / 2 + tickLen,
                stroke: config.noteColor,
                'stroke-width': config.strokeWidth
            });
            notesGroup.appendChild(tick);
        });
    }
    
    // Draw chord indicators
    if (config.showChords) {
        data.chords.forEach(chord => {
            const x = tickToX(chord.start_tick);
            
            // Draw a vertical connector between chord notes
            const minPos = pitchPositions.get(chord.min_pitch);
            const maxPos = pitchPositions.get(chord.max_pitch);
            
            if (minPos && maxPos) {
                const yTop = maxPos.y + maxPos.height / 2;
                const yBottom = minPos.y + minPos.height / 2;
                
                const chordLine = createSvgElement('line', {
                    x1: x,
                    y1: yTop,
                    x2: x,
                    y2: yBottom,
                    stroke: config.chordColor,
                    'stroke-width': config.strokeWidth,
                    'stroke-linecap': 'round'
                });
                notesGroup.appendChild(chordLine);
            }
        });
    }
    
    // Draw energy curve at the bottom
    if (config.showEnergy && data.energy_curve.length > 0) {
        const energyYBase = config.margin + keyboardHeight + gapHeight;
        
        const points = data.energy_curve.map(point => {
            const x = tickToX(point.tick);
            const y = energyYBase + energyHeight - (point.energy * energyHeight * 0.9);
            return `${x},${y}`;
        });
        
        if (points.length >= 2) {
            // Fill area
            const areaPoints = [
                `${tickToX(0)},${energyYBase + energyHeight}`,
                ...points,
                `${tickToX(data.energy_curve[data.energy_curve.length - 1].tick)},${energyYBase + energyHeight}`
            ];
            
            const area = createSvgElement('polygon', {
                points: areaPoints.join(' '),
                fill: config.energyColor,
                opacity: 0.15
            });
            energyGroup.appendChild(area);
            
            // Line
            const polyline = createSvgElement('polyline', {
                points: points.join(' '),
                fill: 'none',
                stroke: config.energyColor,
                'stroke-width': config.strokeWidth,
                'stroke-linejoin': 'round',
                'stroke-linecap': 'round'
            });
            energyGroup.appendChild(polyline);
        }
        
        // Baseline
        const baseline = createSvgElement('line', {
            x1: config.margin + pianoWidth,
            y1: energyYBase + energyHeight,
            x2: config.margin + config.contentWidth,
            y2: energyYBase + energyHeight,
            stroke: config.energyColor,
            'stroke-width': config.strokeWidth,
            opacity: 0.5
        });
        energyGroup.appendChild(baseline);
    }
    
    // Draw frame
    if (config.showFrame) {
        // Main frame
        const frame = createSvgElement('rect', {
            x: config.margin,
            y: config.margin,
            width: config.contentWidth,
            height: config.contentHeight,
            fill: 'none',
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth,
            rx: 2
        });
        frameGroup.appendChild(frame);
        
        // Piano separator
        const pianoSep = createSvgElement('line', {
            x1: config.margin + pianoWidth,
            y1: config.margin,
            x2: config.margin + pianoWidth,
            y2: config.margin + keyboardHeight,
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth
        });
        frameGroup.appendChild(pianoSep);
        
        // Energy separator
        const energySep = createSvgElement('line', {
            x1: config.margin,
            y1: config.margin + keyboardHeight + gapHeight / 2,
            x2: config.margin + config.contentWidth,
            y2: config.margin + keyboardHeight + gapHeight / 2,
            stroke: config.frameColor,
            'stroke-width': config.strokeWidth
        });
        frameGroup.appendChild(energySep);
    }
    
    // Append groups in order
    svg.appendChild(gridGroup);
    svg.appendChild(sustainGroup);
    svg.appendChild(pianoGroup);
    svg.appendChild(notesGroup);
    svg.appendChild(chordsGroup);
    svg.appendChild(energyGroup);
    svg.appendChild(labelsGroup);
    svg.appendChild(frameGroup);
}

// Helper: Check if a pitch is a black key
function isBlackKey(pitch) {
    const note = pitch % 12;
    return [1, 3, 6, 8, 10].includes(note);  // C#, D#, F#, G#, A#
}

// ============================================================================
// Export Functions
// ============================================================================

function downloadSVG() {
    const svg = elements.svgOutput;
    const config = getConfig();
    
    // Clone and add proper SVG namespace/sizing
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', `${config.width}mm`);
    clone.setAttribute('height', `${config.height}mm`);
    
    // Add background rect
    const bgRect = createSvgElement('rect', {
        x: 0,
        y: 0,
        width: config.width,
        height: config.height,
        fill: config.bgColor
    });
    clone.insertBefore(bgRect, clone.firstChild);
    
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = state.filename.replace(/\.(mid|midi)$/i, `.${config.vizStyle}.svg`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadPNG() {
    const svg = elements.svgOutput;
    const config = getConfig();
    
    // Create canvas with high DPI
    const scale = 4;
    const canvas = document.createElement('canvas');
    canvas.width = config.width * scale;
    canvas.height = config.height * scale;
    const ctx = canvas.getContext('2d');
    
    // Clone SVG
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', config.width * scale);
    clone.setAttribute('height', config.height * scale);
    
    // Add background
    const bgRect = createSvgElement('rect', {
        x: 0,
        y: 0,
        width: config.width,
        height: config.height,
        fill: config.bgColor
    });
    clone.insertBefore(bgRect, clone.firstChild);
    
    const svgData = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = state.filename.replace(/\.(mid|midi)$/i, `.${config.vizStyle}.png`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    setupFileHandling();
    setupControls();
    setupTheme();
    createColorLegend();
});
