# Performance Optimization Plan - Multi-Mode Rendering

## Problem Statement

Current rendering with 6,000 triangles is extremely slow and nearly unusable, even on high-end hardware (M4 MacBook Pro). The full line rendering with hatching, gradient calculations, cross-hatching, and occlusion clipping creates thousands of lines and is too computationally expensive for real-time interaction.

## Solution Overview

Implement three render modes with smart auto-switching:
1. **Full Mode** - Current high-quality line art rendering (for final output)
2. **Solid Mode** - Fast grayscale filled faces based on lighting (for navigation)
3. **Wireframe Mode** - Edges only, no fills (ultra-fast for complex models)

Plus Level-of-Detail (LOD) system and optimized defaults for STL files.

---

## Implementation Steps

### 1. Add Render Mode UI Controls

**File:** `3d-generator.html`

Add new control section in Display section:

```html
<div class="control-group">
  <label>Render Mode
    <span id="renderModeLabel">Full Detail</span>
  </label>
  <select id="renderMode">
    <option value="full">Full Detail (Line Art)</option>
    <option value="solid">Solid Grayscale (Fast)</option>
    <option value="wireframe">Wireframe (Fastest)</option>
  </select>
</div>

<label class="inline-check">
  <input type="checkbox" id="autoSwitchMode" checked> Auto-Switch During Navigation
</label>

<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
  Auto-switch uses fast rendering while rotating, then returns to selected mode
</div>
```

### 2. Implement Solid Grayscale Rendering

**File:** `src/rendering/renderer.js`

Create new function `drawSolidFaces()`:

```javascript
/**
 * Draw faces as solid grayscale fills (fast preview mode)
 * @param {SVGElement} svg - SVG element
 * @param {Array} faceData - Array of face data with normals and projections
 * @param {Object} faceColors - Face colors (ignored in grayscale mode)
 */
function drawSolidFaces(svg, faceData, faceColors) {
  for (const faceInfo of faceData) {
    const { projectedFace, shading, face } = faceInfo;
    
    // Create polygon path
    const points = projectedFace.map(p => `${p.x},${p.y}`).join(' ');
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", points);
    
    // Calculate grayscale value from shading (0-1 range)
    // shading = 1 (bright), shading = 0 (dark)
    const brightness = Math.round(shading * 255);
    const fillColor = `rgb(${brightness}, ${brightness}, ${brightness})`;
    
    polygon.setAttribute("fill", fillColor);
    polygon.setAttribute("stroke", "#000000");
    polygon.setAttribute("stroke-width", 0.3);
    polygon.setAttribute("data-face", face.name);
    
    svg.appendChild(polygon);
  }
}
```

### 3. Implement Wireframe Rendering

**File:** `src/rendering/renderer.js`

Create new function `drawWireframe()`:

```javascript
/**
 * Draw faces as wireframe (edges only, ultra-fast)
 * @param {SVGElement} svg - SVG element
 * @param {Array} faceData - Array of face data
 * @param {number} strokeWidth - Line width
 */
function drawWireframe(svg, faceData, strokeWidth) {
  // Track drawn edges to avoid duplicates
  const drawnEdges = new Set();
  
  for (const faceInfo of faceData) {
    const { projectedFace } = faceInfo;
    
    // Draw each edge
    for (let i = 0; i < projectedFace.length; i++) {
      const p1 = projectedFace[i];
      const p2 = projectedFace[(i + 1) % projectedFace.length];
      
      // Create edge key (sorted to avoid duplicates)
      const edgeKey = [
        `${p1.x.toFixed(2)},${p1.y.toFixed(2)}`,
        `${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
      ].sort().join('|');
      
      if (drawnEdges.has(edgeKey)) continue;
      drawnEdges.add(edgeKey);
      
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", p1.x);
      line.setAttribute("y1", p1.y);
      line.setAttribute("x2", p2.x);
      line.setAttribute("y2", p2.y);
      line.setAttribute("stroke", "#000000");
      line.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(line);
    }
  }
}
```

### 4. Update Main draw() Function

**File:** `src/rendering/renderer.js`

Modify main rendering logic to support modes:

```javascript
// Get render mode setting
const renderMode = document.getElementById("renderMode")?.value || "full";

// ... existing code for face processing ...

// RENDER BASED ON MODE
if (renderMode === "solid") {
  // Solid grayscale mode - fast
  drawSolidFaces(svg, faceData, faceColors);
  
} else if (renderMode === "wireframe") {
  // Wireframe mode - ultra-fast
  drawWireframe(svg, faceData, strokeWidth);
  
} else {
  // Full mode - existing high-quality line rendering
  // ... existing hatch line rendering code ...
}
```

### 5. Auto-Switch During Navigation

**File:** `src/ui/controls.js`

Add interaction detection:

```javascript
// Track interaction state
let isInteracting = false;
let interactionTimeout = null;
let savedRenderMode = null;

/**
 * Start interaction - switch to fast render mode
 */
export function startInteraction() {
  const autoSwitch = document.getElementById("autoSwitchMode")?.checked ?? true;
  if (!autoSwitch) return;
  
  if (!isInteracting) {
    isInteracting = true;
    
    // Save current mode and switch to solid/wireframe
    const renderModeSelect = document.getElementById("renderMode");
    if (renderModeSelect && renderModeSelect.value === "full") {
      savedRenderMode = "full";
      
      // Switch to solid for STL, wireframe for very complex models
      const meshMode = getMeshMode();
      const geometry = getCurrentMesh();
      const faceCount = geometry?.faces?.length || 0;
      
      if (faceCount > 1000) {
        renderModeSelect.value = "wireframe";
      } else {
        renderModeSelect.value = "solid";
      }
    }
  }
  
  // Reset timeout
  if (interactionTimeout) {
    clearTimeout(interactionTimeout);
  }
}

/**
 * End interaction - schedule return to original mode
 */
export function endInteraction() {
  const autoSwitch = document.getElementById("autoSwitchMode")?.checked ?? true;
  if (!autoSwitch) return;
  
  // Debounce - wait 500ms after last interaction before switching back
  if (interactionTimeout) {
    clearTimeout(interactionTimeout);
  }
  
  interactionTimeout = setTimeout(() => {
    if (savedRenderMode) {
      const renderModeSelect = document.getElementById("renderMode");
      if (renderModeSelect) {
        renderModeSelect.value = savedRenderMode;
        savedRenderMode = null;
      }
      
      // Trigger redraw in full mode
      if (window.requestRedraw) {
        window.requestRedraw();
      }
    }
    isInteracting = false;
  }, 500); // 500ms debounce
}
```

Update mouse event handlers:

```javascript
// In setupControls() function, update canvas drag handlers:

canvas.addEventListener('mousedown', (e) => {
  // ... existing mousedown code ...
  startInteraction();
});

canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    startInteraction(); // Reset timeout on each move
    // ... existing mousemove code ...
  }
});

canvas.addEventListener('mouseup', () => {
  // ... existing mouseup code ...
  endInteraction();
});
```

### 6. LOD System - Aggressive Merging

**File:** `src/core/geometry.js`

Add LOD parameter to merging:

```javascript
/**
 * Merge coplanar faces with configurable tolerance (LOD support)
 * @param {Object} geometry - Geometry with faces
 * @param {string} lodLevel - 'high' (strict) or 'low' (aggressive)
 * @returns {Object} Merged geometry
 */
export function mergeCoplanarFaces(geometry, lodLevel = 'high') {
  // ... existing validation ...
  
  // Adjust tolerances based on LOD level
  let ANGLE_TOLERANCE, DIST_TOLERANCE;
  
  if (lodLevel === 'low') {
    // Aggressive merging for preview/navigation
    ANGLE_TOLERANCE = 10 * Math.PI / 180; // 10 degrees (vs 1 degree)
    DIST_TOLERANCE = 2.0; // 2mm (vs 0.1mm)
    console.log('Using aggressive LOD merging for preview');
  } else {
    // Strict merging for final output
    ANGLE_TOLERANCE = 1 * Math.PI / 180;
    DIST_TOLERANCE = 0.1;
  }
  
  // ... rest of merging logic ...
}
```

### 7. LOD Caching System

**File:** `src/loaders/stlLoader.js`

Cache multiple LOD versions:

```javascript
// Global cache for LOD versions
let geometryCache = {
  high: null,  // Strict merging (for final render)
  low: null    // Aggressive merging (for preview)
};

export function updateSTLSize() {
  // ... existing code ...
  
  // Clear cache when size changes
  geometryCache = { high: null, low: null };
  
  // ... trigger redraw ...
}

export function clearSTL() {
  // ... existing code ...
  
  // Clear cache
  geometryCache = { high: null, low: null };
}
```

**File:** `src/rendering/renderer.js`

Use cached geometry:

```javascript
// In draw() function, when loading STL:
if (meshMode === 'stl') {
  const stlMesh = getCurrentMesh();
  if (stlMesh) {
    // Determine LOD level based on render mode
    const lodLevel = (renderMode === 'full') ? 'high' : 'low';
    
    // Check cache first
    if (!geometryCache[lodLevel]) {
      // Not cached - convert and merge with appropriate LOD
      const baseGeometry = {
        vertices: stlMesh.vertices,
        faces: stlMesh.faces.map(/* ... */),
        isSTL: true
      };
      geometryCache[lodLevel] = mergeCoplanarFaces(baseGeometry, lodLevel);
    }
    
    geometry = geometryCache[lodLevel];
  }
}
```

### 8. Optimize Default Hatch Spacing for STL

**File:** `3d-generator.html`

Update default hatch spacing dynamically:

```javascript
// In stlLoader.js, when STL is loaded:
function loadSTLFile(file) {
  // ... existing loading code ...
  
  // Adjust default hatch spacing for STL (reduce line density)
  const hatchSpacingInput = document.getElementById('hatchSpacing');
  if (hatchSpacingInput && hatchSpacingInput.value < 3.0) {
    hatchSpacingInput.value = 3.0; // Increase from 2.0 to 3.0 for STL
    document.getElementById('hatchSpacingValue').textContent = '3.0';
  }
  
  // ... rest of loading ...
}
```

---

## Performance Impact Estimates

### Current Performance (6K triangles)
- Face processing: ~200ms
- Hatch line generation: ~500ms
- Occlusion clipping: ~1000ms
- Rendering: ~300ms
- **Total: ~2000ms per frame** ❌

### With Optimizations

**LOD System (low quality merge):**
- 6000 triangles → ~1000 faces (vs ~3000 with strict)
- Processing time: ~50ms (10x faster)

**Solid Mode:**
- No hatch generation: 0ms (vs 500ms)
- No occlusion: 0ms (vs 1000ms)
- Rendering: ~50ms (vs 300ms)
- **Total: ~100ms per frame** ✅ (20x faster)

**Wireframe Mode:**
- Edge deduplication: ~20ms
- Rendering: ~30ms
- **Total: ~50ms per frame** ✅ (40x faster)

**With Auto-Switch:**
- Navigation: 50-100ms per frame (smooth 10-20 FPS)
- Final render: 2000ms (only when stopped)
- User experience: **Feels instant** ✅

---

## Implementation Priority

### Phase 1 (Critical - Do First)
1. ✅ Add render mode UI controls
2. ✅ Implement solid grayscale rendering
3. ✅ Implement wireframe rendering
4. ✅ Update main draw() to support modes

**Result:** User can manually switch modes

### Phase 2 (High Priority)
5. ✅ Add auto-switch detection
6. ✅ Implement debounced mode switching
7. ✅ Update mouse handlers

**Result:** Auto-switches during navigation

### Phase 3 (Optimization)
8. ✅ Implement LOD system
9. ✅ Add geometry caching
10. ✅ Optimize hatch spacing defaults

**Result:** Even faster with better defaults

---

## Testing Checklist

### Manual Mode Switching
- [ ] Can switch between Full/Solid/Wireframe modes
- [ ] Solid mode shows correct grayscale shading
- [ ] Wireframe shows only edges (no duplicates)
- [ ] Mode persists across rotations

### Auto-Switch Behavior
- [ ] Starts in Full mode
- [ ] Switches to Solid/Wireframe when dragging
- [ ] Returns to Full mode 500ms after drag stops
- [ ] Checkbox toggles auto-switch on/off

### Performance
- [ ] Solid mode renders 10x+ faster than Full
- [ ] Wireframe mode renders 20x+ faster than Full
- [ ] 6K triangle model rotates smoothly in Solid mode
- [ ] No lag or stuttering during navigation

### LOD System
- [ ] Low LOD merges more aggressively
- [ ] Cache prevents re-merging on each frame
- [ ] Correct LOD used for each mode
- [ ] Cache clears when model changes

### Visual Quality
- [ ] Solid mode shading matches lighting direction
- [ ] Wireframe shows clean edge structure
- [ ] Full mode unchanged (backward compatible)
- [ ] No visual artifacts in any mode

---

## User Workflow

### Scenario: Orienting a Complex Model

**Before (unusable):**
1. Load 6K triangle STL
2. Try to rotate view
3. Wait 2+ seconds per frame
4. Give up in frustration ❌

**After (smooth):**
1. Load 6K triangle STL (auto-switches to Solid mode)
2. Drag to rotate - smooth 15+ FPS in Solid mode ✅
3. Stop dragging - auto-switches to Full mode after 500ms
4. Adjust view - smooth navigation
5. Export final render in Full mode ✅

**Manual override:**
- Want even faster? Switch to Wireframe (40x speedup)
- Working on a clean cube? Stay in Full mode
- Checking lighting only? Use Solid mode

---

## Code Locations Summary

### New Files
None - all changes integrated into existing files

### Modified Files
1. **`3d-generator.html`** - Add render mode UI controls
2. **`src/rendering/renderer.js`** - Add render mode logic, solid/wireframe functions
3. **`src/ui/controls.js`** - Add auto-switch detection and handlers
4. **`src/core/geometry.js`** - Add LOD parameter to merging
5. **`src/loaders/stlLoader.js`** - Add LOD caching, adjust defaults

### Key Functions Added
- `drawSolidFaces()` - Fast grayscale rendering
- `drawWireframe()` - Ultra-fast edge-only rendering
- `startInteraction()` - Begin navigation (switch to fast mode)
- `endInteraction()` - End navigation (return to full mode)
- Updated `mergeCoplanarFaces()` - Support LOD levels

---

## Success Criteria

✅ **Performance:**
- 6K triangle model navigates smoothly (10+ FPS)
- Auto-switch feels instant and natural
- No noticeable lag during rotation

✅ **Usability:**
- Three render modes available
- Auto-switch enabled by default
- Manual mode selection works
- Keyboard shortcut (optional bonus)

✅ **Quality:**
- Full mode unchanged (backward compatible)
- Solid mode lighting accurate
- Wireframe clean and clear
- No regressions in existing features

✅ **Maintainability:**
- Clean code separation
- Well-documented functions
- Easy to add more modes later







