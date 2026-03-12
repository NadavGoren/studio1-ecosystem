# 3D Cube Generator - UI, Controls & Features Reference

## Overview

This document describes all UI features, controls, interactions, and non-rendering functionality in the 3D Cube Generator. This complements the rendering reference document.

## Table of Contents

1. [Canvas Management](#1-canvas-management)
2. [Positioning & Tools](#2-positioning--tools)
3. [Color System](#3-color-system)
4. [UI Organization](#4-ui-organization)
5. [Control Interactions](#5-control-interactions)
6. [Statistics & Performance](#6-statistics--performance)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [State Management](#8-state-management)

---

## 1. Canvas Management

### Canvas Presets

**Available Presets:**
- **A3**: 420 × 297 mm (default)
- **A4**: 297 × 210 mm
- **A5**: 210 × 148 mm
- **A6**: 148 × 105 mm
- **Custom**: User-defined dimensions

**Implementation:**
```javascript
const CANVAS_PRESETS = {
  A3: { width: 420, height: 297 },
  A4: { width: 297, height: 210 },
  A5: { width: 210, height: 148 },
  A6: { width: 148, height: 105 }
};
```

**Features:**
- Dropdown selector for quick preset selection
- Auto-sync: When dimensions are manually changed, preset dropdown updates to "Custom" if no match
- Bidirectional sync: Changing preset updates dimensions; changing dimensions updates preset
- Orientation-aware: Preset detection works for both landscape and portrait orientations

### Canvas Dimensions

**Controls:**
- Width input (number, 20-1000 mm)
- Height input (number, 20-1000 mm)
- Real-time value display labels

**Behavior:**
- Immediate update on input change
- Validates range (20-1000 mm)
- Updates preset dropdown if dimensions match a preset
- Triggers full redraw on change

### Orientation Toggle

**Visual Toggle:**
- Switch between Landscape and Portrait
- Visual indicator shows current orientation
- Labels change color based on active orientation

**Functionality:**
- Swaps width and height values
- Preserves preset (A3 stays A3, just rotated)
- Updates orientation label automatically
- Recalculates when dimensions change

**Implementation:**
```javascript
function toggleOrientation() {
  const currentWidth = parseFloat(widthEl.value);
  const currentHeight = parseFloat(heightEl.value);
  
  widthEl.value = currentHeight;
  heightEl.value = currentWidth;
  
  // Preset stays the same (A3 is A3 in any orientation)
  // Update labels and redraw
}
```

### Margins

**Control:**
- Range slider: 0-60 mm
- Default: 10 mm
- Real-time value display

**Purpose:**
- Defines drawing boundary within canvas
- Creates safe area for plotter printing
- Visual frame shown in preview (preview-only element)

**Usage:**
- Drawing area = canvas size - (2 × margin)
- All artwork is clipped to margin boundaries

### Stroke Width

**Control:**
- Range slider: 0.1-4.0 mm
- Default: 0.4 mm
- Step: 0.1 mm
- Real-time value display

**Application:**
- Applied to all line elements (hatch lines, edges, shadows)
- Critical for plotter pen size matching
- Exported to SVG as `stroke-width` attribute

---

## 2. Positioning & Tools

### Tool System

**Two Tools Available:**

1. **Rotate Tool** (default)
   - Cursor: `grab` / `grabbing`
   - Action: Rotates cube around Z-axis
   - Keyboard shortcut: `R`

2. **Move Tool**
   - Cursor: `move` / `grabbing`
   - Action: Moves artwork position on canvas
   - Keyboard shortcut: `V`

**Tool Switching:**
- Button click in UI
- Keyboard shortcuts (R/V)
- Active tool highlighted with visual indicator
- Tool hint text updates dynamically

### Interactive Rotation (Orbit)

**Mouse Interaction:**
- Click and drag horizontally on preview area
- Rotates cube around Z-axis (vertical axis)
- Smooth, real-time rotation
- Uses `requestAnimationFrame` for performance

**State Management:**
```javascript
let orbitHorizontal = 0; // Rotation angle (0-360°)

// On mouse drag:
const deltaX = e.clientX - lastMouseX;
orbitHorizontal += deltaX * 0.5; // Sensitivity factor
orbitHorizontal = orbitHorizontal % 360; // Wrap around
```

**Features:**
- Continuous rotation (wraps at 360°)
- Smooth interpolation
- Throttled updates for performance
- Works with both tools (but only affects rotation)

### Interactive Positioning (Move Tool)

**Mouse Interaction:**
- Click and drag in any direction on preview area
- Moves artwork position offset
- Real-time position update

**State Management:**
```javascript
let positionX = 0; // Horizontal offset in mm
let positionY = 0; // Vertical offset in mm

// On mouse drag (Move tool):
const deltaX = (e.clientX - lastMouseX) * scaleFactor;
const deltaY = (e.clientY - lastMouseY) * scaleFactor;
positionX += deltaX;
positionY += deltaY;
```

**Features:**
- Independent X/Y movement
- Scale factor converts screen pixels to mm
- Position offset applied during rendering
- Resets when tool switches (optional behavior)

### Canvas Tools Integration

**Rendering Integration:**
```javascript
// In renderer.js:
const positionOffsets = getPositionOffsets();
const canvasCenterX = (x0 + x1) / 2 + positionOffsets.x;
const canvasCenterY = (y0 + y1) / 2 + positionOffsets.y;

// All geometry centered with offset applied
```

**Cursor Feedback:**
- Visual cursor changes based on tool
- `grab` → `grabbing` during drag
- `move` → `grabbing` during drag

---

## 3. Color System

### Color Modes

**Two Modes:**

1. **Single Color Mode**
   - One color for all faces
   - Simple monochromatic output
   - Single color picker

2. **Per-Face Color Mode** (default)
   - Different color for each face
   - 6 face colors: Top, Front, Back, Left, Right, Bottom
   - Creates separate SVG layers per face

**Toggle:**
- Checkbox: "Use Different Colors per Face"
- UI dynamically shows/hides relevant color pickers
- Immediate visual update

### Face Colors

**Default Palette:**
- Top: `#FF6B6B` (Red)
- Front: `#4ECDC4` (Teal)
- Back: `#45B7D1` (Blue)
- Left: `#96CEB4` (Green)
- Right: `#FFEAA7` (Yellow)
- Bottom: `#DDA15E` (Orange)

**Controls:**
- Color picker for each face
- Real-time hex value display
- Updates immediately on change

### SVG Layer Organization

**When Using Face Colors:**
- Each face gets its own SVG `<g>` (group) element
- Layers organized by rendering order (back to front)
- Inkscape-compatible layer labels

**Layer Order:**
```xml
<g id="layer-shadow" inkscape:label="Shadow">...</g>
<g id="layer-bottom" inkscape:label="Bottom">...</g>
<g id="layer-back" inkscape:label="Back">...</g>
<g id="layer-left" inkscape:label="Left">...</g>
<g id="layer-right" inkscape:label="Right">...</g>
<g id="layer-front" inkscape:label="Front">...</g>
<g id="layer-top" inkscape:label="Top">...</g>
```

**When Using Single Color:**
- All lines in single layer (no grouping)
- Simpler SVG structure
- Faster export

---

## 4. UI Organization

### Collapsible Sections

**Always Open Sections:**
- Canvas
- 3D Object
- Projection
- Display

**Collapsible Sections** (collapsed by default):
- Layers
- Lighting
- Shading
- Advanced Debug

**Implementation:**
```javascript
function setupCollapsibleSections() {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.collapsible-section');
      section.classList.toggle('collapsed');
    });
  });
}
```

**Visual Indicators:**
- Collapse icon (▼) rotates when expanded
- Smooth CSS transitions
- State preserved during session

### Control Groups

**Structure:**
- Label with value display
- Input control (slider, number, select, checkbox, color)
- Optional helper text or scale indicators

**Value Display Pattern:**
```html
<label>
  Control Name
  <span id="controlValue">Current Value</span>
</label>
<input type="range" id="control" ...>
```

**Real-Time Updates:**
- All value displays update on input change
- Synchronized with control state
- Formatted appropriately (decimals, units, etc.)

### Conditional UI Visibility

**Examples:**

1. **Line Jitter Controls**
   - Hidden by default
   - Shown when "Line Jitter" checkbox enabled
   - Controls: Intensity, Frequency, Randomness

2. **Perspective Controls**
   - Hidden in isometric mode
   - Shown in perspective mode
   - Control: Perspective Strength

3. **Cross-Hatch Density**
   - Hidden when cross-hatch disabled
   - Shown when cross-hatch enabled
   - Control: Density percentage

4. **Shadow Falloff**
   - Hidden when advanced shading disabled
   - Shown when advanced shading enabled
   - Control: Falloff strength

**Implementation Pattern:**
```javascript
function toggleControlVisibility(checkboxId, controlGroupId) {
  const checkbox = document.getElementById(checkboxId);
  const group = document.getElementById(controlGroupId);
  
  checkbox.addEventListener('change', () => {
    group.style.display = checkbox.checked ? 'block' : 'none';
  });
}
```

---

## 5. Control Interactions

### Slider Controls

**Standard Sliders:**
- Margin (0-60 mm)
- Stroke Width (0.1-4.0 mm)
- Light Angle (0-360°)
- Light Elevation (0-90°)
- Light Brightness (0-2.0)
- Ambient Light (0-1.0)
- Hatch Spacing (0.5-10 mm)
- Min Spacing (0.1-5 mm)
- Hatch Angle (0-180°)
- Line Jitter (0-100%)
- Jitter Frequency (0-100)
- Jitter Randomness (0-100)
- Perspective Strength (0-4)
- Shadow Falloff (0.1-10)

**Behavior:**
- Real-time value display
- Immediate redraw on change
- Smooth interaction
- Step values for precision

### Number Inputs

**Number Inputs:**
- Canvas Width/Height
- Cube Size (with slider sync)

**Cube Size Special Behavior:**
- Dual control: slider + number input
- Synchronized bidirectionally
- Sticky snap to 5mm increments (within 0.25mm tolerance)
- Range: 20-200 mm

**Sticky Snap Implementation:**
```javascript
cubeSizeEl.addEventListener("input", (e) => {
  let value = parseFloat(e.target.value);
  
  // Check if close to 5mm increment
  const nearest5 = Math.round(value / 5) * 5;
  if (Math.abs(value - nearest5) < 0.25) {
    value = nearest5; // Snap to increment
    e.target.value = value;
  }
  
  // Sync with number input
  cubeSizeInputEl.value = value;
});
```

### Select Dropdowns

**Dropdowns:**
- Canvas Preset (A3, A4, A5, A6, Custom)
- View Mode (Isometric, Perspective)

**Behavior:**
- Immediate effect on change
- Updates related UI elements
- May show/hide conditional controls

### Checkboxes

**Checkboxes:**
- Line Jitter Enabled
- Use Face Colors
- Show Edges
- Show Shadow
- Show Grid
- Debug Occlusion
- Advanced Shading
- Shadow Soft Edges
- Cross-Hatch

**Behavior:**
- Immediate toggle effect
- May show/hide related controls
- Visual state indicators
- Triggers full redraw

### Color Pickers

**Color Pickers:**
- Single Color (when not using face colors)
- 6 Face Colors (Top, Front, Back, Left, Right, Bottom)

**Behavior:**
- Real-time hex value display
- Immediate visual update
- Color format: `#RRGGBB`

---

## 6. Statistics & Performance

### Line Count

**Display:**
- Real-time count of all line segments
- Includes: hatch lines, edges, shadow lines
- Updates on every redraw

**Calculation:**
```javascript
let totalLines = 0;

// Count hatch lines
totalLines += occludedLines.length;

// Count edges (if enabled)
if (showEdges) {
  totalLines += face.edges.length;
}

// Count shadow lines
totalLines += shadowLines.length;

// Update UI
lineCountEl.textContent = totalLines;
```

### Plotting Time Estimation

**Calculation Factors:**
- Drawing velocity: 40 mm/s
- Travel velocity: 120 mm/s
- Pen up time: 0.15 s per operation
- Pen down time: 0.15 s per operation
- Acceleration overhead: 0.1 s per line
- Calibration factor: 0.8 (20% reduction)

**Formula:**
```javascript
const drawingTime = totalLength / DRAWING_VELOCITY;
const travelTime = totalTravel / TRAVEL_VELOCITY;
const penOperationsTime = totalLines * (PEN_UP_TIME + PEN_DOWN_TIME);
const accelerationTime = totalLines * ACCELERATION_OVERHEAD;

const totalSeconds = (drawingTime + travelTime + penOperationsTime + accelerationTime) * 0.8;
```

**Display Format:**
- Hours:Minutes:Seconds (if > 1 hour)
- Minutes:Seconds (if < 1 hour)
- Updates in real-time

### Performance Optimizations

**Rendering:**
- `requestAnimationFrame` for smooth updates
- Throttled mouse drag updates
- Early exit in occlusion checks
- Bounding box culling before detailed clipping

**UI Updates:**
- Debounced label updates
- Batch DOM updates
- Conditional rendering

---

## 7. Keyboard Shortcuts

**Tool Switching:**
- `R` - Switch to Rotate tool
- `V` - Switch to Move tool

**Behavior:**
- Only active when not typing in input fields
- Immediate tool switch
- Updates UI state
- Changes cursor

**Implementation:**
```javascript
document.addEventListener('keydown', (e) => {
  // Ignore if typing in input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  
  if (e.key === 'r' || e.key === 'R') {
    rotateToolBtn.click();
  } else if (e.key === 'v' || e.key === 'V') {
    moveToolBtn.click();
  }
});
```

---

## 8. State Management

### Global State Variables

**Orbit State:**
```javascript
let orbitHorizontal = 0; // Cube rotation angle (0-360°)
```

**Position State:**
```javascript
let positionX = 0; // Horizontal offset (mm)
let positionY = 0; // Vertical offset (mm)
```

**Tool State:**
```javascript
let activeTool = 'rotate'; // 'rotate' or 'move'
```

**Mouse Drag State:**
```javascript
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let animationFrameId = null;
```

### State Access Functions

**Getters:**
```javascript
export function getOrbitHorizontal() {
  return orbitHorizontal;
}

export function getPositionOffsets() {
  return { x: positionX, y: positionY };
}

export function getActiveTool() {
  return activeTool;
}
```

**Setters:**
```javascript
export function setOrbitHorizontal(angle) {
  orbitHorizontal = angle;
}

export function setPositionOffsets(x, y) {
  positionX = x;
  positionY = y;
}
```

### State Persistence

**Current Implementation:**
- State is session-based (not persisted)
- Resets on page reload
- All state in memory

**Potential Enhancements:**
- LocalStorage for settings
- URL parameters for sharing
- Export/import configurations

---

## 10. UI Update System

### Label Updates

**Function: `updateLabels()`**
- Updates all value display labels
- Reads from control elements
- Formats appropriately
- Called on every control change

**Labels Updated:**
- Canvas dimensions
- Margin
- Stroke width
- Cube size
- Light parameters
- Hatch parameters
- Color values

### Full Update Cycle

**Function: `fullUpdate(orbitHorizontal)`**
```javascript
export function fullUpdate(orbitHorizontal) {
  syncCanvasPresetFromInputs();  // Sync preset dropdown
  updateViewModeUI();            // Show/hide perspective controls
  updateLabels();                // Update all value displays
  draw(orbitHorizontal);         // Redraw canvas
}
```

**Called On:**
- Any control change
- Tool switch
- Mouse interaction end
- Initial load

### View Mode UI Updates

**Function: `updateViewModeUI()`**
- Shows/hides perspective controls
- Updates view mode label
- Called when view mode changes

---

## 11. Advanced Features

### Debug Mode

**Debug Occlusion:**
- Checkbox: "Debug: Show Occlusion Polygons"
- Visualizes occlusion polygons
- Color-coded by type:
  - Red: Safety zone
  - Magenta: Cube footprint
  - Cyan: Shadow polygon
  - Yellow: Cube bottom face
  - Green/Blue/Orange: Face occlusion polygons

**Purpose:**
- Troubleshooting shadow leaks
- Understanding occlusion behavior
- Fine-tuning expansion factors

### Advanced Debug Controls

**Shadow Expansion:**
- Slider: 0-5% (default: 0.2%)
- Controls occlusion polygon expansion
- Prevents shadow line leaks
- Fine-tunable for edge cases

**Shadow Inset:**
- Slider: 0-0.5 mm (default: 0.05 mm)
- Pulls shadow line endpoints inward
- Extra safety margin
- Prevents visual artifacts

**Test Angle Buttons:**
- Quick buttons for common angles (0°, 45°, 90°, 135°, 180°)
- Useful for testing shadow behavior
- Snaps cube to specific rotation

### Grid Display

**3D Isometric Grid:**
- Checkbox: "Show 3D Grid"
- Displays isometric reference grid on floor
- Preview-only (not exported)
- Helps with positioning and alignment

**Implementation:**
- Rendered on floor plane (z=0)
- Isometric projection
- Optional line jitter support
- Styled as preview element

---

## 12. Export Features

### SVG Export

**Function: `exportSVG()`**

**Process:**
1. Clone SVG DOM
2. Remove preview-only elements
3. Organize by layers (if face colors enabled)
4. Set proper dimensions and viewBox
5. Add namespaces (SVG, Inkscape)
6. Serialize to XML
7. Create downloadable blob
8. Trigger download

**Preview-Only Elements Removed:**
- Grid lines
- Canvas boundary
- Margin frame
- Debug polygons
- Any element with `data-preview-only="true"`

**Output:**
- Filename: `3d_isometric_cube.svg`
- Format: SVG 1.1
- Units: Millimeters (mm)
- Plotter-ready: Clean line segments only


---

## 13. Control Synchronization

### Bidirectional Sync Patterns

**Canvas Preset ↔ Dimensions:**
- Changing preset → updates dimensions
- Changing dimensions → updates preset dropdown
- Orientation-aware matching

**Cube Size Slider ↔ Number Input:**
- Slider change → updates number input
- Number input change → updates slider
- Sticky snap behavior on slider

**Orientation ↔ Dimensions:**
- Toggle orientation → swaps width/height
- Dimension change → updates orientation label
- Preserves preset identity

### Conditional Control Visibility

**Pattern:**
1. Master control (checkbox/select)
2. Dependent controls (shown/hidden)
3. State synchronization

**Examples:**
- Line Jitter checkbox → Jitter controls
- Advanced Shading checkbox → Shadow Falloff
- Cross-Hatch checkbox → Cross-Hatch Density
- View Mode select → Perspective Controls
- Use Face Colors checkbox → Color pickers

---

## 14. User Experience Features

### Real-Time Feedback

**Visual Updates:**
- Immediate preview updates
- Value displays update instantly
- Smooth transitions
- No lag on control changes

### Tool Hints

**Dynamic Hints:**
- Text updates based on active tool
- "Drag to rotate the cube around its axis" (Rotate tool)
- "Drag to move the artwork on the canvas" (Move tool)
- Contextual help

### Cursor Feedback

**Tool-Based Cursors:**
- Rotate tool: `grab` → `grabbing`
- Move tool: `move` → `grabbing`
- Updates on tool switch
- Visual feedback during drag

### Collapsible Sections

**Organization:**
- Less-used sections collapsed by default
- Reduces visual clutter
- Quick access to common controls
- State preserved during session

---

## 15. Implementation Architecture

### Module Structure

**UI Modules:**
```
src/ui/
├── controls.js      # All event listeners
├── updates.js       # Label updates, UI state
└── canvas.js        # Canvas preset management
```

**Control Flow:**
1. User interaction → `controls.js`
2. State update → State variables
3. UI update → `updates.js`
4. Render → `renderer.js`

### Event Handling Pattern

**Standard Pattern:**
```javascript
const control = document.getElementById("controlId");
control.addEventListener("input", () => {
  updateLabels();        // Update value display
  triggerFullUpdate();    // Redraw
});
```

**Checkbox Pattern:**
```javascript
const checkbox = document.getElementById("checkboxId");
checkbox.addEventListener("change", () => {
  toggleRelatedControls(); // Show/hide dependent controls
  triggerFullUpdate();      // Redraw
});
```

### State Management Pattern

**Centralized State:**
- State variables in `controls.js`
- Exported getter/setter functions
- Used by renderer for positioning/orbit

**State Flow:**
```
User Input → State Update → UI Update → Render
```

---

## Summary

The 3D Cube Generator includes comprehensive UI features:

### Core Features:
- ✅ Canvas management (presets, dimensions, orientation, margins)
- ✅ Interactive tools (rotate, move)
- ✅ Color system (single/per-face)
- ✅ Real-time preview
- ✅ SVG export with layer organization

### Advanced Features:
- ✅ Statistics (line count, plot time)
- ✅ Debug visualization
- ✅ Collapsible UI sections

### User Experience:
- ✅ Keyboard shortcuts
- ✅ Tool hints
- ✅ Cursor feedback
- ✅ Real-time value displays
- ✅ Smooth interactions

### Technical:
- ✅ State management
- ✅ Bidirectional control sync
- ✅ Conditional UI visibility
- ✅ Performance optimizations
- ✅ Modular architecture

This comprehensive UI system provides a professional, user-friendly interface for creating plotter-ready 3D line art.

