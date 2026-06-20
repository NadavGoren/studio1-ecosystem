3D Isometric Cube Generator – Functional & Visual Requirements

This document defines the full specification for the 3D Isometric Cube Generator system.

All implementation tasks must follow these requirements.

⸻

📁 MODULAR ARCHITECTURE & FILE STRUCTURE

The application is organized into focused modules with clear responsibilities:

```
3D Cube Generator/
├── 3d-generator.js              ← Entry point & initialization
├── 3d-generator.html            ← UI structure
├── 3d-generator.css             ← Styling
└── src/
    ├── core/                    ← Core geometry & constants
    │   ├── constants.js         → Canvas presets, default values
    │   ├── geometry.js          → Cube vertices, face definitions
    │   ├── projection.js        → Isometric & perspective projection
    │   └── transformations.js   → 3D rotations & transformations
    ├── lighting/                ← Light calculations
    │   ├── lightCalculation.js  → Light direction, face shading
    │   └── gradientShading.js   → Advanced gradient shading system
    ├── rendering/               ← Main rendering engine
    │   ├── renderer.js          → Main draw() function, occlusion
    │   ├── clipping.js          → Line clipping algorithms
    │   └── grid.js              → Isometric grid rendering
    ├── shading/                 ← Shading effects
    │   ├── hatchLines.js        → Hatch line generation (basic & adaptive)
    │   └── shadow.js            → Shadow projection
    ├── ui/                      ← User interface modules
    │   ├── canvas.js            → Canvas presets, orientation
    │   ├── updates.js           → UI label updates, visibility
    │   └── controls.js          → All event listeners
    └── export/                  ← Export functionality
        ├── svgExporter.js       → SVG export with layers
        └── videoExporter.js     → Video export (turntable animation)
    └── utils/                   ← Utility modules
        └── jitter.js            → Line jitter/waviness generation
```

⸻

🗺️ FEATURE-TO-FILE MAPPING

This section maps each requirement to the specific file(s) responsible for implementation.

### Section 1: Canvas, Paper, Orientation & Margins
**Files:** `src/ui/canvas.js`, `src/ui/updates.js`, `src/ui/controls.js`, `src/core/constants.js`

- **Canvas Presets** → `src/core/constants.js` (CANVAS_PRESETS), `src/ui/canvas.js` (applyCanvasPreset)
- **Preset Dropdown** → `src/ui/controls.js` (setupCanvasPresetControl)
- **Dimension Inputs** → `src/ui/controls.js` (setupCanvasDimensionControls)
- **Orientation Toggle** → `src/ui/canvas.js` (updateOrientationLabel), `src/ui/controls.js` (setupOrientationToggle)
- **Margins** → `src/rendering/renderer.js` (margin handling in draw())

### Section 2: Pen & Stroke Parameters
**Files:** `src/rendering/renderer.js`, `src/ui/controls.js`, `src/utils/jitter.js`

- **Stroke Width Control** → `src/ui/controls.js` (slider event listener), `src/rendering/renderer.js` (applied to all lines)
- **Line Jitter Toggle** → `src/ui/controls.js` (setupLineJitterToggle)
- **Jitter Controls** → `src/ui/controls.js` (jitter intensity, frequency, randomness), `src/utils/jitter.js` (createWavyLine)

### Section 3: 3D Object Settings
**Files:** `src/ui/controls.js`, `src/core/geometry.js`, `src/core/transformations.js`, `src/rendering/renderer.js`

- **Cube Size** → `src/ui/controls.js` (setupCubeSizeControls with sticky snap), `src/core/geometry.js` (createCube)
- **Interactive Orbit** → `src/ui/controls.js` (setupMouseOrbitControls), `src/core/transformations.js` (rotatePoint)
- **Canvas Tools** → `src/ui/controls.js` (tool switching, keyboard shortcuts), `src/rendering/renderer.js` (position offsets)

### Section 4: Projection System
**Files:** `src/core/projection.js`, `src/ui/controls.js`

- **View Mode Toggle** → `src/ui/controls.js` (setupViewModeControl), `src/ui/updates.js` (updateViewModeUI)
- **Isometric Projection** → `src/core/projection.js` (project3DTo2D with mode='isometric')
- **Perspective Projection** → `src/core/projection.js` (project3DTo2D with mode='perspective')

### Section 5: Layers & Face Colors
**Files:** `src/ui/controls.js`, `src/rendering/renderer.js`, `src/export/svgExporter.js`

- **Color Mode Toggle** → `src/ui/controls.js` (setupColorControls)
- **Face Color Pickers** → `src/ui/controls.js` (setupColorControls), `src/rendering/renderer.js` (color application)
- **Layer Organization** → `src/export/svgExporter.js` (exportSVG with face grouping)

### Section 6: Lighting System
**Files:** `src/lighting/lightCalculation.js`, `src/ui/controls.js`

- **Light Angle** → `src/ui/controls.js` (slider), `src/lighting/lightCalculation.js` (calculateLightDirection)
- **Light Elevation** → `src/ui/controls.js` (slider), `src/lighting/lightCalculation.js` (calculateLightDirection)
- **Light Brightness** → `src/ui/controls.js` (slider), `src/lighting/lightCalculation.js` (calculateShading)
- **Ambient Light** → `src/ui/controls.js` (slider), `src/lighting/lightCalculation.js` (calculateShading)
- **Lighting Calculation** → `src/lighting/lightCalculation.js` (calculateShading function)

### Section 7: Shading & Hatch Lines
**Files:** `src/shading/hatchLines.js`, `src/lighting/gradientShading.js`, `src/shading/shadow.js`, `src/ui/controls.js`, `src/rendering/renderer.js`

- **Hatch Spacing** → `src/ui/controls.js` (slider), `src/shading/hatchLines.js` (generateHatchLines)
- **Minimum Spacing** → `src/ui/controls.js` (slider), `src/shading/hatchLines.js` (generateHatchLines)
- **Hatch Angle** → `src/ui/controls.js` (slider), `src/shading/hatchLines.js` (angle parameter)
- **Hatch Generation** → `src/shading/hatchLines.js` (generateHatchLines, generateAdaptiveHatchLines)
- **Shadow Projection** → `src/shading/shadow.js` (projectShadow)
- **Advanced Shading Toggle** → `src/ui/controls.js` (checkbox), `src/lighting/gradientShading.js` (all gradient functions)
- **Gradient Shading** → `src/lighting/gradientShading.js` (calculateFaceGradientShading, calculateShadowGradient)
- **Adaptive Density** → `src/shading/hatchLines.js` (generateAdaptiveHatchLines)
- **Cross-Hatch** → `src/ui/controls.js` (setupCrossHatchControls), `src/shading/hatchLines.js` (crossHatch parameter)
- **Shadow Falloff** → `src/ui/controls.js` (slider, visible when Advanced Shading enabled), `src/rendering/renderer.js` (shadow gradient calculation)
- **Shadow Soft Edges** → `src/ui/controls.js` (checkbox), `src/rendering/renderer.js` (soft edge geometry generation)

### Section 8: Display Options
**Files:** `src/rendering/renderer.js`, `src/rendering/grid.js`, `src/ui/controls.js`

- **Show Edges** → `src/ui/controls.js` (checkbox), `src/rendering/renderer.js` (edge rendering)
- **Show 3D Grid** → `src/ui/controls.js` (checkbox), `src/rendering/grid.js` (drawIsometricGrid)
- **Debug: Show Occlusion Polygons** → `src/ui/controls.js` (checkbox), `src/rendering/renderer.js` (occlusion visualization)
- **Preview-Only Elements** → `src/rendering/renderer.js`, `src/rendering/grid.js` (data-preview-only attribute)

### Section 9: Rendering & Geometry
**Files:** `src/rendering/renderer.js`, `src/core/geometry.js`, `src/rendering/clipping.js`, `src/core/transformations.js`

- **Cube Geometry** → `src/core/geometry.js` (createCube, face definitions)
- **Rotation** → `src/core/transformations.js` (rotatePoint)
- **Back-Face Culling** → `src/rendering/renderer.js` (visibility check in draw())
- **Depth Sorting** → `src/rendering/renderer.js` (face sorting in draw())
- **Occlusion Clipping** → `src/rendering/renderer.js` (occlusion logic), `src/rendering/clipping.js` (clipLineAgainstPolygon)
- **Shadow Occlusion** → `src/rendering/renderer.js` (shadow clipping logic)

### Section 10: Export & SVG Generation
**Files:** `src/export/svgExporter.js`, `src/rendering/renderer.js`

- **SVG Export** → `src/export/svgExporter.js` (exportSVG function)
- **Canvas Dimensions** → `src/export/svgExporter.js` (width/height attributes), `src/rendering/renderer.js` (getCanvasDimensions)
- **Element Filtering** → `src/export/svgExporter.js` (preview-only element removal)
- **Layer Organization** → `src/export/svgExporter.js` (face grouping logic)
- **Export Button** → `src/export/svgExporter.js` (setupExportButton)

### Section 11: Animation & Video Export
**Files:** `src/export/videoExporter.js`, `src/ui/controls.js`, `3d-generator.js`

- **Animation Controls** → `src/ui/controls.js` (animation parameter controls)
- **Play Preview** → `3d-generator.js` (preview animation playback)
- **Video Generation** → `src/export/videoExporter.js` (frame generation, FFmpeg encoding)
- **Progress Tracking** → `src/export/videoExporter.js` (progress bar, status updates)

### Section 11: Animation & Video Export
**Files:** `src/export/videoExporter.js`, `src/ui/controls.js`, `3d-generator.js`

- **Animation Controls** → `src/ui/controls.js` (animation parameter controls)
- **Play Preview** → `3d-generator.js` (preview animation playback)
- **Video Generation** → `src/export/videoExporter.js` (frame generation, FFmpeg encoding)
- **Progress Tracking** → `src/export/videoExporter.js` (progress bar, status updates)

### Section 12: Performance & Statistics
**Files:** `src/rendering/renderer.js`, `src/ui/controls.js`

- **Line Count Display** → `src/rendering/renderer.js` (line counting in draw())
- **Plot Time Calculation** → `src/rendering/renderer.js` (time estimation in draw())
- **requestAnimationFrame** → `src/ui/controls.js` (throttling in setupMouseOrbitControls)

### Section 13: Advanced Debug Settings
**Files:** `src/ui/controls.js`, `src/rendering/renderer.js`

- **Shadow Occlusion Expansion** → `src/ui/controls.js` (slider), `src/rendering/renderer.js` (occlusion expansion factor)
- **Shadow Line Inset** → `src/ui/controls.js` (slider), `src/rendering/renderer.js` (shadow line inset calculation)
- **Quick Test Angles** → `src/ui/controls.js` (test angle buttons), `src/ui/controls.js` (angle snapping)

### Section 13: Advanced Debug Settings
**Files:** `src/ui/controls.js`, `src/rendering/renderer.js`

- **Shadow Occlusion Expansion** → `src/ui/controls.js` (slider), `src/rendering/renderer.js` (occlusion expansion factor)
- **Shadow Line Inset** → `src/ui/controls.js` (slider), `src/rendering/renderer.js` (shadow line inset calculation)
- **Quick Test Angles** → `src/ui/controls.js` (test angle buttons), `src/ui/controls.js` (angle snapping)

### Section 14: UI/UX Design
**Files:** `3d-generator.css`, `3d-generator.html`, `src/ui/updates.js`, `src/ui/controls.js`

- **Layout** → `3d-generator.css` (grid layout, responsive)
- **Collapsible Sections** → `src/ui/updates.js` (setupCollapsibleSections), `3d-generator.css` (section styling)
- **Labels & Values** → `src/ui/updates.js` (updateLabels function)
- **Color Scheme** → `3d-generator.css` (CSS variables)

⸻

🔧 MODULE RESPONSIBILITIES

### Entry Point (`3d-generator.js`)
- Initialize all modules
- Setup UI components
- Trigger initial render
- Coordinate startup sequence

### Core Modules (`src/core/`)
**constants.js**
- Canvas size presets (A3, A4, A5, A6)
- Default parameter values
- Isometric angle constants

**geometry.js**
- Cube vertex generation
- Face definitions (vertices, normals)
- Polygon utility functions (convexHull, pointInPolygon)

**projection.js**
- Isometric projection formula
- Perspective projection with FOV
- 2D screen coordinate calculation

**transformations.js**
- 3D point rotation (Z-axis)
- Matrix transformations

### Lighting Modules (`src/lighting/`)
**lightCalculation.js**
- Light direction vector calculation
- Basic per-face shading (dot product)
- Shading value computation (0-1 range)

**gradientShading.js**
- Advanced gradient shading system
- Key point shading calculation
- Barycentric interpolation
- Face gradient calculation
- Shadow gradient calculation
- Unified gradient system

### Rendering Modules (`src/rendering/`)
**renderer.js** (Main rendering engine)
- Main draw() function
- Canvas dimension utilities
- Face visibility & depth sorting
- Hatch line rendering with occlusion
- Shadow rendering with occlusion
- Edge rendering
- Line count & plot time statistics
- SVG element management

**clipping.js**
- Line-to-bounds clipping
- Line-to-polygon clipping
- Intersection calculations
- Segment splitting

**grid.js**
- Isometric grid generation
- Axis lines (X, Y, Z) with labels
- Reference plane rendering
- Grid styling

### Shading Modules (`src/shading/`)
**hatchLines.js**
- Basic hatch line generation (uniform density)
- Adaptive hatch line generation (gradient-based density)
- Cross-hatch pattern generation
- Line intersection & clipping to polygon
- Density-based spacing calculation

**shadow.js**
- Shadow vertex projection to floor plane
- Light direction-based projection
- Shadow boundary calculation

### UI Modules (`src/ui/`)
**canvas.js**
- Canvas preset application (A3, A4, etc.)
- Preset synchronization with inputs
- Orientation label updates
- Portrait/landscape detection

**updates.js**
- View mode UI visibility (isometric/perspective)
- Label updates for all controls
- Full update coordination (sync + labels + redraw)
- Collapsible section setup

**controls.js**
- All event listeners for sliders, inputs, toggles
- Cube size controls (with 5mm snap)
- Canvas dimension controls
- Orientation toggle handler
- View mode control
- Canvas preset dropdown
- Checkbox controls (edges, shadow, grid, advanced shading)
- Cross-hatch controls
- Color controls (single color & per-face colors)
- Mouse orbit controls (drag to rotate)
- Orbit state management (orbitHorizontal)

### Export Module (`src/export/`)
**svgExporter.js**
- SVG export function (clone & process SVG)
- Preview element removal (grid, labels, boundaries)
- Face layer grouping (when face colors enabled)
- Inkscape-compatible layer naming
- SVG namespace management
- Download button setup

⸻

📋 DETAILED FUNCTIONAL REQUIREMENTS

1. Canvas, Paper, Orientation & Margins

1.1 Canvas Presets

	•	Provide a canvas preset dropdown with standard paper sizes:
		•	A3: 420 × 297 mm (default)
		•	A4: 297 × 210 mm
		•	A5: 210 × 148 mm
		•	A6: 148 × 105 mm
		•	Custom: user-defined dimensions
	•	When a preset is selected, automatically populate width and height fields.
	•	When width/height are manually modified, automatically detect matching preset (including swapped orientations) or set to "Custom".
	•	The preset dropdown label must display the currently selected preset name (e.g., "A3", "A4", "Custom").

1.2 Canvas Dimensions

	•	Provide separate width and height input fields (in millimeters).
	•	Range: 20 mm → 1000 mm for both dimensions.
	•	Dimensions must update in real-time and maintain aspect ratio independently.
	•	Canvas dimensions define the total drawing area.

1.3 Orientation Toggle

	•	Provide a single UI toggle (checkbox-style) to switch between portrait and landscape.
	•	The toggle must swap canvas width and height values.
	•	Preset selection must be preserved across orientation changes (A3 remains A3 in both orientations).
	•	Orientation label must dynamically display current orientation ("Portrait" or "Landscape").
	•	Toggle visual state must indicate current orientation (Portrait = checked, Landscape = unchecked).
	•	No automatic stretching, resizing, or repositioning of the 3D cube due to orientation changes.
	•	The cube must be centered and scaled appropriately within the new canvas bounds.

1.4 Margins

	•	Provide a margin slider located in the Canvas section, after orientation controls.
	•	Default value: 10 mm.
	•	Range: 0 mm → 60 mm.
	•	Step: 1 mm.
	•	The margin defines the active drawing boundary within the canvas.
	•	No element (cube, grid, shadow) may cross or overlap the margin boundary.
	•	Adjusting the margin must update layout constraints and recenter the cube without distorting geometry.

⸻

2. Pen & Stroke Parameters

2.1 Stroke Width Control

	•	Provide a global stroke-width slider.
	•	Range: 0.1 mm → 4.0 mm.
	•	Step: 0.1 mm.
	•	Default value: 0.4 mm.
	•	The stroke width must update in real-time.
	•	All drawn elements (cube faces, hatch lines, edges, shadow, grid) must consistently adopt the selected width.

2.2 Line Jitter Controls

	•	Provide a checkbox: "Line Jitter" to enable/disable wavy line effects.
	•	Default: unchecked (disabled).
	•	When enabled, show three additional controls:
		•	Jitter Intensity (%): Range 0 → 100, Step 1, Default 50.
			•	Controls the amplitude of waviness (0 = none, 100 = maximum subtle waviness ~0.52mm).
		•	Wave Frequency: Range 0 → 100, Step 1, Default 50.
			•	Controls how many waves appear along each line (0 = low frequency, 100 = high frequency).
			•	Maps to frequency multiplier 0.3x to 2.5x.
		•	Randomness: Range 0 → 100, Step 1, Default 50.
			•	Controls randomness factor in wave generation (0 = smooth waves, 100 = more random variation).
			•	Maps to randomness factor 0.05 to 0.5.
	•	Jitter applies to all lines: hatch lines, edges, shadow lines, and grid lines.
	•	Each line gets unique random parameters based on its coordinates (deterministic but varied).
	•	Waviness is perpendicular to line direction, creating subtle hand-drawn appearance.
	•	Maximum waviness amplitude: 0.52mm at 100% intensity (very subtle for plotter compatibility).

⸻

3. 3D Object Settings

3.1 Cube Size

	•	Provide a dual-input control for cube size:
		•	Range slider: 20 mm → 200 mm.
		•	Number input: 20 mm → 200 mm.
		•	Step: 0.5 mm for both controls.
	•	Default value: 50 mm.
	•	Both inputs must be synchronized in real-time.
	•	The slider must have "sticky" behavior at 5mm increments (snap to nearest 5mm when within 0.25mm).
	•	Cube size represents the edge length of the cube.
	•	Cube must be centered at the origin (0, 0, 0) with bottom face at floor level (z = 0).

3.2 Interactive Orbit Controls

	•	Enable mouse drag interaction on the SVG preview area.
	•	Dragging horizontally rotates the cube around the Z-axis (vertical axis).
	•	Cube spins on the floor like a top (no pitch or roll, only yaw).
	•	Mouse cursor must change to "grab" on hover and "grabbing" while dragging.
	•	Rotation sensitivity: 0.5° per pixel of horizontal mouse movement.
	•	Rotation angle must wrap to 0-360° range.
	•	Rotation must be smooth and responsive with throttled redraws using requestAnimationFrame.
	•	Visual feedback: "Drag the preview to orbit the view" hint in the 3D Object section.

3.3 Canvas Tools

	•	Provide tool selector UI above the canvas preview with two tool buttons:
		•	Rotate Tool (default): Drag to rotate cube around Z-axis.
		•	Move Tool: Drag to reposition entire artwork on canvas.
	•	Tool buttons must show visual active state (dark blue background when active).
	•	Keyboard shortcuts:
		•	R: Switch to Rotate tool.
		•	V: Switch to Move tool.
		•	Shortcuts work when not typing in input fields.
	•	Rotate Tool behavior:
		•	Horizontal drag rotates cube (same as Section 3.2).
		•	Cursor: "grab" on hover, "grabbing" while dragging.
		•	Sensitivity: 0.5° per pixel.
	•	Move Tool behavior:
		•	Drag in any direction to reposition artwork.
		•	Cursor: "move" (4-way arrows) on hover and while dragging.
		•	Sensitivity: 0.5mm per pixel.
		•	Position range: ±200mm in both X and Y (clamped automatically).
		•	Everything moves together: cube, shadows, grid, all hatch lines.
	•	Position offsets must be preserved in SVG export.
	•	Default state: Rotate tool active, position at (0, 0).
	•	Tool hint text must update to explain current tool behavior.

⸻

4. Projection System

4.1 View Mode

	•	Provide a dropdown to select projection mode:
		•	Isometric: Standard isometric projection (30° angles).
		•	Perspective: Perspective projection with adjustable strength.
	•	Default: Isometric.
	•	View mode label must update to reflect current selection.

4.2 Isometric Projection

	•	Standard isometric projection formula:
		•	isoX = (x - y) × cos(30°)
		•	isoY = -(z + (x + y) × sin(30°))
	•	No perspective distortion (parallel lines remain parallel).
	•	All cube faces maintain consistent relative sizes.

4.3 Perspective Projection

	•	When Perspective mode is selected, show "Perspective Strength" slider.
	•	Range: 0 → 4.
		•	0 = minimal perspective (almost isometric).
		•	2 = medium perspective (default).
		•	4 = maximum perspective (strong vanishing point).
	•	Step: 0.5.
	•	Perspective strength maps to:
		•	FOV: 150 + (strength × 25) [range: 150-250]
		•	Camera distance: 400 - (strength × 50) [range: 400-200]
	•	Points further from camera must appear smaller (depth-based scaling).
	•	Visual indicator: Labels "Light", "Medium", "Strong" below the slider.

⸻

5. Layers & Face Colors

5.1 Color Mode Toggle

	•	Provide a checkbox: "Use Different Colors per Face".
	•	Default: checked (enabled).
	•	When checked: Show individual color pickers for each face.
	•	When unchecked: Show single color picker for monochromatic rendering.

5.2 Face Color Controls

	•	When "Use Different Colors per Face" is enabled, provide color pickers for:
		•	Top Face (default: #FF6B6B - Red)
		•	Front Face (default: #4ECDC4 - Turquoise)
		•	Back Face (default: #45B7D1 - Blue)
		•	Left Face (default: #96CEB4 - Green)
		•	Right Face (default: #FFEAA7 - Yellow)
		•	Bottom Face (default: #DDA15E - Orange)
	•	Each color picker must display the current color value (hex uppercase) in the label.
	•	Colors must update in real-time on the preview.
	•	Bottom face is hidden by default (floor contact), but color is used if visible in rotation.

5.3 Single Color Mode

	•	When "Use Different Colors per Face" is disabled:
		•	Show single color picker.
		•	Default color: #000000 (Black).
		•	All cube faces must use this single color.
		•	Shadow must use black (#000000) regardless of mode.

5.4 Collapsible Section

	•	"Layers" section must be collapsible.
	•	Default state: Collapsed.
	•	Toggle icon (▼) must rotate 90° when collapsed.

⸻

6. Lighting System

6.1 Light Angle (Azimuth)

	•	Provide a slider for light direction angle around Z-axis (vertical axis).
	•	Range: 0° → 360°.
	•	Step: 1°.
	•	Default value: 110°.
	•	Light angle controls the horizontal rotation of the light source around the scene.
	•	0° = light from positive X direction, 90° = light from positive Y direction, etc.

6.2 Light Elevation

	•	Provide a slider for light elevation angle from horizontal.
	•	Range: 0° → 90°.
	•	Step: 1°.
	•	Default value: 64°.
	•	0° = horizontal light (sunrise/sunset).
	•	90° = straight down (noon sun).
	•	Elevation affects shadow projection direction and length.

6.3 Light Brightness

	•	Provide a slider for directional light intensity.
	•	Range: 0 → 2.
		•	0 = no directional light (ambient only).
		•	1 = standard brightness (default).
		•	2 = double brightness (brighter highlights).
	•	Step: 0.1.
	•	Brightness scales the diffuse lighting contribution.

6.4 Ambient Light

	•	Provide a slider for ambient (omnidirectional) light level.
	•	Range: 0 → 1.
		•	0 = no ambient light (pure shadows).
		•	1 = full ambient (no shading variation).
	•	Default value: 0.15.
	•	Step: 0.05.
	•	Ambient light ensures faces never become completely black.

6.5 Lighting Calculation

	•	Light direction must be calculated from angle and elevation.
	•	Shading must use dot product between face normal and light direction.
	•	Final shading = ambient + (1 - ambient) × max(0, diffuse × brightness).
	•	Shading range: 0 (fully dark) → 1 (fully lit).
	•	Shading must update hatch line density in real-time.

6.6 Collapsible Section

	•	"Lighting" section must be collapsible.
	•	Default state: Collapsed.
	•	Toggle icon (▼) must rotate 90° when collapsed.

⸻

7. Shading & Hatch Lines

7.1 Hatch Spacing

	•	Provide a slider for maximum hatch line spacing.
	•	Range: 0.5 mm → 10 mm.
	•	Step: 0.1 mm.
	•	Default value: 2.0 mm.
	•	Hatch spacing defines the maximum distance between hatch lines (fully lit areas).

7.2 Minimum Spacing

	•	Provide a slider for minimum hatch line spacing (darkest areas).
	•	Range: 0.1 mm → 5 mm.
	•	Step: 0.1 mm.
	•	Default value: 0.5 mm.
	•	Minimum spacing must be less than or equal to hatch spacing.
	•	Dark areas use tighter spacing to create visual density.

7.3 Hatch Angle

	•	Provide a slider for base hatch line angle.
	•	Range: 0° → 180°.
	•	Step: 1°.
	•	Default value: 45°.
	•	Each face can have an angle offset:
		•	Back: 0°
		•	Front: 60°
		•	Bottom: 30°
		•	Top: 90°
		•	Left: 120°
		•	Right: 150°
	•	Final hatch angle = (base angle + face offset) mod 180°.

7.4 Density Calculation

	•	Hatch line density must vary based on face shading.
	•	Density formula: density = 1 - shading (0 = fully lit, 1 = fully dark).
	•	Local spacing = minSpacing + (hatchSpacing - minSpacing) × (1 - density).
	•	Darker faces must have more dense hatch lines (closer spacing).
	•	Lighter faces must have sparse hatch lines (wider spacing).

7.5 Hatch Line Generation

	•	Hatch lines must be generated within each face polygon boundary.
	•	Lines must be clipped precisely to polygon edges.
	•	Lines must not extend beyond face boundaries (no extension for occlusion).
	•	Occlusion clipping handles visibility separately.
	•	Minimum line length: 0.01 mm (filter tiny segments).
	•	Duplicate intersection points must be removed (tolerance: 0.001 mm).

7.6 Show Floor Shadow

	•	Provide a checkbox: "Show Floor Shadow".
	•	Default: checked (enabled).
	•	When enabled, project cube shadow onto floor plane (z = 0).
	•	Shadow must use light direction for projection.
	•	Shadow must be rendered behind the cube (first in z-order).

7.7 Shadow Layers

	•	Shadow must use multi-layer system:
		•	Contact shadow: 100% scale, 85% darkness, cross-hatch.
		•	Blend layer: 25% scale, 75% darkness, cross-hatch.
		•	Projected layers: 50%, 75%, 100% scale with decreasing darkness.
	•	Cross-hatch uses primary angle (light angle + 90°) and secondary angle (60° offset).
	•	Shadow lines must be occluded by cube silhouette and all visible faces.
	•	Shadow must respect canvas bounds with generous margin for edge cases.

7.8 Shadow Falloff Control

	•	Provide a "Shadow Falloff" slider (visible only when Advanced Shading is enabled).
		•	Range: 0.1 → 10.0.
		•	Step: 0.1.
		•	Default value: 6.2.
	•	Controls the softness/sharpness of shadow edges:
		•	Lower values (0.1-2.0): Sharp, defined shadow edges.
		•	Medium values (2.0-6.0): Moderate falloff.
		•	Higher values (6.0-10.0): Very soft, feathered shadow edges.
	•	Affects shadow gradient calculation and soft edge geometry generation.
	•	When "Shadow Soft Edges" is enabled, falloff controls the intensity of directional blur layers.
	•	Visual indicators: "Sharp", "Medium", "Soft" labels below slider.

7.9 Shadow Soft Edges

	•	Provide a checkbox: "Shadow Soft Edges (Falloff Geometry)".
		•	Default: unchecked (disabled).
	•	When enabled with Advanced Shading:
		•	Generates directional soft edge blur layers based on shadow falloff value.
		•	Applies corner rounding to shadow polygon based on falloff intensity.
		•	Creates more realistic shadow appearance with gradual edge transitions.
	•	Only active when Advanced Shading is enabled and shadow falloff > 1.0.

7.10 Collapsible Section

	•	"Shading" section must be collapsible.
	•	Default state: Collapsed.
	•	Toggle icon (▼) must rotate 90° when collapsed.

7.11 Advanced Shading Mode

7.11.1 Advanced Shading Toggle

	•	Provide a checkbox: "Advanced Shading" in the Shading section.
	•	Default: unchecked (disabled) - uses basic uniform per-face shading.
	•	When enabled, activates gradient-based shading calculation across faces and shadow.
	•	Toggle must be placed at the top of the Shading section, before other shading controls.
	•	When enabled, all shading calculations switch to per-region gradient mode.

7.11.2 Gradient Shading Calculation (Cube Faces)

	•	When Advanced Shading is enabled, shading must be calculated per-region within each face, not as a single uniform value.
	•	Shading must vary smoothly across each face polygon based on local lighting conditions.
	•	Implementation: Key Point System with Barycentric Interpolation
		•	Calculate shading at key points: 4 corner vertices + 1 center point (total 5 key points).
		•	For each key point, calculate base shading using face normal and light direction:
			•	Base shading = ambient + (1 - ambient) × max(0, dot(faceNormal, lightDir) × brightness).
		•	Add gradient adjustment based on 3D position:
			•	Calculate vector from face center to key point in 3D space.
			•	Project light direction onto face plane.
			•	Dot product between point vector and normalized light direction.
			•	Gradient adjustment = dot × 0.08 (gentle gradient coefficient).
			•	Points in light direction get brighter, points away get darker.
			•	Final shading = base shading + gradient adjustment (clamped to 0-1).
		•	For any arbitrary point on the face, use barycentric interpolation:
			•	Find 3 closest key points.
			•	Calculate inverse-distance weights: w = 1 / (distance + 0.1).
			•	Interpolated shading = weighted average of key point shadings.
		•	This creates smooth, continuous gradients across the entire face.
	•	Shading values form a smooth gradient (0 = fully dark → 1 = fully lit).
	•	Regions closer to light direction (facing light) have higher shading values (lighter).
	•	Regions further from light direction (facing away) have lower shading values (darker).
	•	Shading gradient accounts for face rotation and light direction interaction.

7.11.3 Adaptive Hatch Line Density (Cube Faces)

	•	When Advanced Shading is enabled, hatch line density must vary within each face based on local shading.
	•	Implementation: Adaptive Hatch Line Generation Algorithm
		•	Generate candidate hatch lines at fine resolution (0.3mm or minSpacing × 0.3, whichever is smaller).
		•	For each candidate line:
			•	Find representative sample point (midpoint of line intersections with polygon edges).
			•	Calculate local shading at sample point using unified gradient system.
			•	Calculate required spacing: spacing = minSpacing + (hatchSpacing - minSpacing) × shading.
			•	Check distance from last accepted line: if distance ≥ required spacing, accept this line.
			•	Skip lines that are too close (adaptive filtering).
		•	This creates variable-density hatch lines that smoothly adapt to shading gradients.
	•	Hatch line spacing adapts to shading value at each position:
		•	Darker regions (lower shading, e.g., 0-0.3): Use minimum spacing (densest lines).
		•	Medium regions (mid shading, e.g., 0.3-0.7): Use interpolated spacing.
		•	Lighter regions (higher shading, e.g., 0.7-1.0): Use maximum spacing (sparsest lines).
	•	Local spacing formula: spacing = minSpacing + (hatchSpacing - minSpacing) × shading.
		•	Where shading is the local shading value at the hatch line position (0-1).
		•	Shading = 0 (dark) → spacing = minSpacing (densest).
		•	Shading = 1 (light) → spacing = hatchSpacing (sparsest).
	•	Hatch lines sample local shading at their representative midpoint position.
	•	Spacing transitions smoothly along hatch lines when crossing gradient boundaries.
	•	Minimum line segment length: 0.3 mm (to prevent excessive fragmentation).

7.11.4 Hatch Line Generation with Gradient

	•	Implementation: Unified Adaptive Hatch Line System
		•	Use `generateAdaptiveHatchLines()` function for both faces and shadow.
		•	Function signature: `generateAdaptiveHatchLines(polygon, baseSpacing, minSpacing, angle, bounds, calculateShading, crossHatch, crossHatchDensity)`.
		•	Algorithm:
			•	Generate candidate lines at fine resolution (0.3mm spacing).
			•	For each candidate, sample shading at representative point.
			•	Calculate required spacing based on local shading.
			•	Filter candidates: only accept if distance from last line ≥ required spacing.
			•	Result: Variable-density hatch lines that smoothly adapt to gradients.
		•	Hatch lines maintain precise clipping to face boundaries (no extension beyond edges).
		•	Gradient-based density works with occlusion clipping (density variation preserved after occlusion).
		•	All hatch lines are clipped against polygon boundaries with 0.001mm edge tolerance.
		•	Lines are generated strictly within polygon boundaries (no padding or extension).

7.11.5 Gradient Shading Calculation (Floor Shadow)

	•	When Advanced Shading is enabled, shadow on floor must also use gradient shading.
	•	Implementation: Unified Gradient System for Shadow
		•	Use same key point system as faces: 4 corners + 1 center point.
		•	Calculate base shading using key point interpolation (same as faces).
		•	Add distance-based shadow gradient:
			•	Find contact point: center of cube bottom face (2D projection).
			•	For each point in shadow, calculate distance from contact point.
			•	Calculate maximum distance from contact to shadow edge.
			•	Normalize distance: normalizedDist = distance / maxDistance (clamped to 0-1).
			•	Apply smoothstep function for smooth falloff: smoothstep(t) = t² × (3 - 2t).
			•	Shadow shading gradient: 0.3 (contact, dark) to 0.8 (edges, light).
			•	Final shadow shading = base shading × 0.4 + shadow gradient × 0.6 (blended).
		•	This creates realistic shadow falloff: darker at contact, lighter at edges.
	•	Shadow gradient characteristics:
		•	Contact areas (where cube touches floor): Highest darkness (shading ≈ 0.0-0.3, very dark).
		•	Near-contact areas (close to cube): High darkness (shading ≈ 0.3-0.5).
		•	Mid-shadow areas (middle of projection): Medium darkness (shading ≈ 0.5-0.7).
		•	Shadow edges (far from cube): Lower darkness (shading ≈ 0.7-0.8, lighter).
		•	Shadow fringes (outermost edges): Lowest darkness (shading ≈ 0.8-1.0, very light/feathered).
	•	Light direction affects gradient:
		•	Steeper elevation (higher angle) → sharper, more defined shadow gradient.
		•	Lower elevation (more horizontal) → softer, more spread-out gradient.
	•	Shadow gradient is calculated in 2D screen space (after projection).

7.11.6 Adaptive Hatch Line Density (Floor Shadow)

	•	Shadow hatch lines must vary in density based on local shadow shading.
	•	Implementation: Same adaptive algorithm as faces
		•	Use `generateAdaptiveHatchLines()` with shadow-specific shading function.
		•	Shading function: `calculateShadowGradient(point2D, cubeBottomFace2D, shadowPolygon, lightElevation, lightAngle, lightBrightness, ambientLight)`.
		•	Shadow uses tighter minimum spacing: minSpacing × 0.3 (for very detailed shadow rendering).
		•	Same adaptive filtering: candidate lines at fine resolution, filtered by local shading.
	•	Density mapping:
		•	Darkest shadow regions (contact areas): Maximum density (minSpacing × 0.3 for very tight spacing).
		•	Medium shadow regions: Medium density (interpolated between min and max spacing).
		•	Lightest shadow regions (edges): Minimum density (hatchSpacing, sparsest).
	•	Shadow spacing formula: spacing = minSpacing × 0.3 + (hatchSpacing - minSpacing × 0.3) × shadowShading.
		•	Where shadowShading is the local shadow shading value (0 = darkest, 1 = lightest).
		•	Shadows can be denser than cube faces at darkest points due to tighter min spacing.
	•	Shadow hatch lines respect the same smooth transition requirements as face hatch lines.
	•	Cross-hatch shadow patterns maintain gradient-based density in both directions (primary and perpendicular).

7.11.7 Shadow Gradient Regions

	•	Shadow must be divided into gradient regions for accurate shading calculation:
		•	Contact shadow region: Small area at cube-floor contact (darkest, ~10% of shadow area).
		•	Core shadow region: Main body of shadow projection (medium-dark, ~50% of shadow area).
		•	Penumbra region: Outer edges of shadow (light, ~30% of shadow area).
		•	Fringe region: Outermost shadow edges (very light/feathered, ~10% of shadow area).
	•	Each region must have distinct shading values and corresponding hatch line densities.
	•	Regions must blend smoothly at boundaries (no abrupt transitions).
	•	Gradient calculation must work with multi-layer shadow system (contact, blend, projected layers).

7.11.8 Performance Considerations

	•	Advanced Shading mode may require more computation than basic mode.
	•	Optimization strategies:
		•	Cache shading calculations per face per rotation angle.
		•	Use adaptive subdivision (finer in high-gradient areas, coarser in flat areas).
		•	Limit maximum subdivision depth to prevent excessive computation.
		•	Throttle real-time updates during parameter changes if needed.
	•	Rendering performance must remain acceptable (target: update within 200ms for smooth interaction).
	•	When Advanced Shading is disabled, revert to fast uniform per-face shading.

7.11.9 Visual Quality Requirements

	•	Gradient shading must create smooth, realistic lighting transitions.
	•	No visible banding or discrete steps in shading gradients.
	•	Hatch line density transitions must be smooth (no abrupt spacing changes).
	•	Shadow gradient must create realistic depth perception (darker at contact, lighter at edges).
	•	Overall effect must enhance 3D perception compared to uniform shading mode.
	•	Gradient calculations must account for all lighting parameters (angle, elevation, brightness, ambient).

7.11.10 Integration with Existing Features

	•	Advanced Shading must work with all existing shading controls:
		•	Hatch spacing and min spacing still control overall density range.
		•	Hatch angle still applies (gradient affects density, not direction).
		•	Light parameters (angle, elevation, brightness, ambient) affect gradient calculation.
	•	Advanced Shading must work with:
		•	Face color modes (per-face colors or single color).
		•	Occlusion clipping (gradient preserved after clipping).
		•	Depth sorting (no change to rendering order).
		•	Show Edges option (edges unaffected by shading mode).
	•	When Advanced Shading is enabled, "Show Floor Shadow" must automatically enable gradient shadow (if shadow is enabled).

7.11.11 Cross-Hatch Support

	•	Provide a checkbox: "Cross-Hatch (Perpendicular Lines)" in the Shading section.
		•	Default: unchecked (disabled).
		•	When enabled, generates perpendicular hatch lines (90° offset from primary angle).
	•	Cross-Hatch Density Control:
		•	Provide a slider: "Cross-Hatch Density (%)" (visible only when cross-hatch is enabled).
		•	Range: 0% → 100%.
		•	Step: 5%.
		•	Default: 100%.
		•	Density of 100% = same spacing as primary hatch lines.
		•	Density of 50% = twice the spacing (half the density).
		•	Formula: crossBaseSpacing = baseSpacing / (density / 100).
	•	Implementation:
		•	When cross-hatch is enabled, generate primary hatch lines at base angle.
		•	Generate secondary hatch lines at perpendicular angle (angle + 90° mod 180°).
		•	Secondary lines use same adaptive algorithm with adjusted spacing based on density.
		•	Both primary and cross-hatch lines use gradient-based adaptive spacing.
		•	Cross-hatch works in both basic and advanced shading modes.
	•	Cross-hatch applies to:
		•	Cube faces: Perpendicular lines at 90° offset from face hatch angle.
		•	Floor shadow: Perpendicular lines at 90° offset from shadow primary angle (light angle + 90°).
	•	Cross-hatch density varies with local shading in advanced mode (same adaptive behavior).

7.11.12 Rendering Principles & Implementation Details

	•	Unified Gradient System:
		•	Single function `calculateUnifiedGradient()` handles both faces and shadow.
		•	Uses key point system (corners + center) for consistent gradient calculation.
		•	Barycentric interpolation ensures smooth, continuous gradients.
	•	Key Point Calculation:
		•	For faces: Use 4 corner vertices + 1 center point (5 key points total).
		•	For shadow: Use 4 corner vertices of shadow polygon + 1 center point.
		•	Each key point gets base shading from face normal + light direction.
		•	Add gradient adjustment based on 3D position relative to light direction.
		•	Gradient coefficient: 0.08 (gentle, smooth transitions).
	•	Barycentric Interpolation:
		•	For any point, find 3 closest key points.
		•	Calculate inverse-distance weights: w = 1 / (distance + 0.1).
		•	Interpolated shading = weighted average: Σ(shading_i × w_i) / Σ(w_i).
		•	Clamp result to [0, 1] range.
	•	Adaptive Hatch Line Algorithm:
		•	Fine resolution: 0.3mm or minSpacing × 0.3 (whichever is smaller).
		•	Generate candidate lines at fine resolution across polygon.
		•	For each candidate: sample shading, calculate required spacing, filter by distance.
		•	Result: Variable-density lines that smoothly adapt to shading gradients.
	•	Shadow Gradient Calculation:
		•	Contact point: center of cube bottom face (2D projection).
		•	Distance-based gradient with smoothstep falloff.
		•	Shadow shading range: 0.3 (contact) to 0.8 (edges).
		•	Blended with key point shading: 40% base + 60% distance gradient.
	•	Precision & Tolerances:
		•	Edge tolerance: 0.001mm (fixed, not dynamic).
		•	Duplicate point threshold: 0.01mm.
		•	Minimum segment length: 0.3mm.
		•	All geometric operations use consistent precision thresholds.
	•	Performance Optimizations:
		•	Key point system reduces computation (5 points vs. per-pixel).
		•	Adaptive filtering skips unnecessary candidate lines.
		•	Barycentric interpolation is fast (O(1) for fixed key points).
		•	Fine resolution limited to prevent excessive candidates.

⸻

8. Display Options

8.1 Show Edges

	•	Provide a checkbox: "Show Edges".
	•	Default: unchecked (disabled).
	•	When enabled, draw outline edges of all visible faces.
	•	Edge stroke width: 1.5× the global stroke width.
	•	Edges must use face-specific colors (or single color in monochromatic mode).
	•	Edges must be drawn after hatch lines (topmost layer).

8.2 Show 3D Grid

	•	Provide a checkbox: "Show 3D Grid".
	•	Default: unchecked (disabled).
	•	When enabled, draw an isometric grid on the floor plane (z = 0).
	•	Grid must scale proportionally with canvas size.
	•	Grid must include:
		•	Minor grid lines (opacity: 0.4, stroke width: 0.4× global).
		•	Major grid lines (opacity: 0.6, stroke width: 0.7× global).
		•	Axis lines: X (red), Y (green), Z (blue) with labels.
		•	Reference plane above floor (dashed, light blue).
	•	Grid must be rendered behind the cube (first in z-order).
	•	Grid elements must be marked with "data-preview-only" attribute for export filtering.

8.3 Debug: Show Occlusion Polygons

	•	Provide a checkbox: "Debug: Show Occlusion Polygons".
	•	Default: unchecked (disabled).
	•	When enabled, visualize occlusion polygons used for line clipping.
	•	Useful for debugging shadow leaks and occlusion issues.
	•	Debug visualization must be marked "data-preview-only" for export filtering.

8.4 Preview-Only Elements

	•	Canvas boundary outline (dim red dashed) must be marked "data-preview-only".
	•	Margin frame (black outline) must be marked "data-preview-only".
	•	Grid elements must be marked "data-preview-only".
	•	All preview-only elements must be excluded from SVG export.

⸻

9. Rendering & Geometry

9.1 Cube Geometry

	•	Cube must be defined with 8 vertices forming a perfect cube.
	•	Bottom face must be at z = 0 (floor level).
	•	Top face must be at z = cubeSize.
	•	Cube must be centered at origin (0, 0, 0).
	•	Six faces: back, front, bottom, top, left, right.
	•	Face normals must point outward from cube center.

9.2 Rotation

	•	Cube rotation must be limited to Z-axis rotation (yaw only).
	•	Rotation angle: orbitHorizontal (0-360°).
	•	No X-axis (pitch) or Y-axis (roll) rotation.
	•	Face normals must be rotated to match cube rotation for lighting calculations.

9.3 Back-Face Culling

	•	Faces pointing away from camera must be hidden (back-face culling).
	•	Visibility determined by dot product between rotated face normal and view direction.
	•	Negative dot product = facing camera = visible.
	•	Positive dot product = facing away = hidden.
	•	Threshold: 0.01 (lenient to show faces at grazing angles).
	•	Bottom face must always be hidden (z < -0.8).
	•	Top face must always be visible when looking from above.

9.4 Depth Sorting

	•	Visible faces must be sorted by depth for correct z-order rendering.
	•	Depth calculation: negative average screen Y coordinate (-avgScreenY).
		•	Higher on screen (smaller Y) = closer = drawn last (front).
		•	Lower on screen (larger Y) = farther = drawn first (back).
	•	Faces must be rendered back-to-front (ascending depth order).
	•	Depth sorting must update in real-time during rotation.

9.5 Occlusion Clipping

	•	Hatch lines must be clipped against faces that are in front (closer to camera).
	•	Only check occlusion against faces with depth > current face (drawn after).
	•	Occlusion uses expanded polygons (1.005× = 0.5% expansion) to prevent z-fighting.
	•	Line clipping must handle:
		•	Both endpoints inside occluding face (fully occluded = null).
		•	One endpoint inside (clip at intersection).
		•	Both endpoints outside with pass-through (split into segments).
	•	Minimum segment length after clipping: 0.3 mm.
	•	Occlusion must be precise and avoid visible gaps during rotation.

9.6 Shadow Occlusion

	•	Shadow lines must be clipped against cube silhouette (convex hull of visible vertices).
	•	Shadow lines must also be clipped against all visible cube faces.
	•	Shadow must never appear inside or through the cube body.
	•	Expansion factor: 1.005× for tight occlusion.
	•	Bounds checking: shadow lines must respect canvas bounds with 50mm safety margin.

⸻

10. Export & SVG Generation

10.1 SVG Export

	•	Provide a "Download SVG" button at the bottom of the controls panel.
	•	Button must trigger SVG file download with filename: "3d_isometric_cube.svg".
	•	SVG must include proper XML namespace declarations.

10.2 Canvas Dimensions in SVG

	•	Exported SVG must have explicit width and height attributes in millimeters.
	•	Example: width="420mm" height="297mm".
	•	ViewBox must match canvas dimensions: viewBox="0 0 {width} {height}".

10.3 Element Filtering

	•	All preview-only elements (marked with "data-preview-only") must be removed from export.
	•	Canvas boundary outline must be excluded.
	•	Margin frame must be excluded.
	•	Grid elements must be excluded.
	•	Only cube geometry (hatch lines, edges, shadow) must be exported.

10.4 Layer Organization (Face Colors Mode)

	•	When "Use Different Colors per Face" is enabled:
		•	Group all lines by face into separate SVG groups (<g> elements).
		•	Each group must have:
			•	id attribute: "layer-{faceName}" (e.g., "layer-top", "layer-front").
			•	inkscape:label attribute: "{FaceName}" (e.g., "Top", "Front") for Inkscape compatibility.
			•	data-face attribute: "{faceName}" (lowercase).
		•	Groups must be ordered back-to-front: bottom, back, left, right, front, top.
		•	Shadow lines must not be grouped (remain as individual lines).

10.5 Single Color Mode Export

	•	When "Use Different Colors per Face" is disabled:
		•	All lines remain in root SVG (no grouping).
		•	Single layer structure for simpler export.

10.6 SVG Namespace

	•	SVG must include xmlns="http://www.w3.org/2000/svg".
	•	Optional: xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" for Inkscape compatibility.

⸻

11. Animation & Video Export

11.1 Animation Controls

	•	Provide an "Animation" collapsible section in the controls panel.
	•	Default state: Collapsed.
	•	Animation parameters:
		•	Start Angle (°): Range 0 → 360, Step 1, Default 0.
		•	End Angle (°): Range 0 → 360, Step 1, Default 360.
		•	Number of Frames: Range 12 → 360, Step 1, Default 120.
		•	Frames Per Second (FPS): Dropdown with options 12, 24, 30 (default), 60.
		•	Duration: Auto-calculated display (Frames ÷ FPS), format as "X.Xs".

11.2 Play Preview

	•	Provide a "Play Preview" button in the Animation section.
	•	Button must show play icon (▶) when stopped, pause icon when playing.
	•	When clicked, animates the cube rotation from Start Angle to End Angle.
		•	Preview plays at specified FPS rate.
		•	Animation must be smooth and loop continuously.
		•	Button state must toggle between play and pause.
	•	Preview must stop if video generation starts (cannot run simultaneously).
	•	When stopped, cube returns to Start Angle position.

11.3 Video Generation

	•	Provide a "Generate Video" button in the Animation section.
	•	When clicked:
		•	Show progress modal with progress bar and status messages.
		•	Load FFmpeg.wasm library (first time only, ~30MB download).
		•	Generate each frame sequentially:
			•	Calculate rotation angle for each frame (interpolated between Start and End).
			•	Render frame at that angle.
			•	Convert SVG to image data.
		•	Encode frames into MP4 video using FFmpeg.
		•	Download video file automatically.
	•	Video specifications:
		•	Format: MP4 (H.264 codec).
		•	Resolution: Based on canvas size at 96 DPI.
		•	Quality: CRF 23 (high quality).
		•	Filename: `cube_turntable_YYYY-MM-DD_HH-MM-SS.mp4`.
	•	Progress tracking:
		•	Progress bar showing percentage complete.
		•	Status messages: "Loading FFmpeg library...", "Generating frame X/Y...", "Encoding video...", "Video downloaded successfully!".
	•	Cancel button must be available during generation.

11.4 Performance Considerations

	•	Video generation is CPU-intensive and may take several minutes for high frame counts.
	•	Recommended configurations:
		•	Quick test: 24 frames @ 12 FPS (~30 seconds generation).
		•	Standard quality: 120 frames @ 30 FPS (~2-3 minutes generation).
		•	High quality: 180 frames @ 60 FPS (~3-4 minutes generation).
	•	First use downloads FFmpeg.wasm (~30MB) from CDN.
	•	Subsequent uses use cached library (much faster).
	•	Generation must be single-threaded for reliability across all setups.

11.5 Collapsible Section

	•	"Animation" section must be collapsible.
	•	Default state: Collapsed.
	•	Toggle icon (▼) must rotate 90° when collapsed.

⸻

12. Performance & Statistics

11.1 Line Count Display

	•	Display total line count in preview header.
	•	Count must include all hatch lines, edges (if enabled), and shadow lines.
	•	Format: Integer (e.g., "1247").
	•	Update in real-time with each parameter change.

11.2 Estimated Plot Time

	•	Display estimated plotting time in preview header.
	•	Time calculation must account for:
		•	Drawing velocity: 40 mm/s.
		•	Travel velocity: 120 mm/s.
		•	Pen up time: 0.15 s per line.
		•	Pen down time: 0.15 s per line.
		•	Acceleration overhead: 0.1 s per line.
		•	Calibration reduction: 20% (multiply by 0.8).
	•	Time format:
		•	If < 1 hour: MM:SS (e.g., "5:23").
		•	If ≥ 1 hour: H:MM:SS (e.g., "1:05:23").
	•	Update in real-time with each parameter change.

12.3 Rendering Performance

	•	Mouse drag rotation must use requestAnimationFrame throttling.
	•	Redraw must be smooth (60 FPS target during interaction).
	•	Final redraw must execute after mouse release to ensure accuracy.

⸻

13. Advanced Debug Settings

13.1 Shadow Occlusion Expansion

	•	Provide a slider: "Shadow Occlusion Expansion (%)" in Advanced Debug section.
		•	Range: 0.05% → 5.0%.
		•	Step: 0.05%.
		•	Default value: 0.2%.
	•	Controls the expansion factor for shadow occlusion polygons.
		•	Minimal gap (0.1-0.3%) prevents shadow leaks.
		•	Higher values may be needed if leaks occur.
	•	Affects precision of shadow clipping against cube silhouette.
	•	Help text: "Minimal gap (0.1-0.3%) prevents leaks. Higher values if leaks occur."

13.2 Shadow Line Inset

	•	Provide a slider: "Shadow Line Inset (mm)" in Advanced Debug section.
		•	Range: 0.0 mm → 0.5 mm.
		•	Step: 0.01 mm.
		•	Default value: 0.05 mm.
	•	Pulls shadow lines inward from cube edge for extra safety.
	•	Prevents shadow lines from appearing at exact cube boundary.
	•	Help text: "Pulls shadow lines inward from cube edge for extra safety."

13.3 Quick Test Angles

	•	Provide a grid of test angle buttons in Advanced Debug section.
	•	Buttons for angles: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°.
	•	When clicked, snap cube rotation to that exact angle.
	•	Useful for shadow leak verification at specific angles.
	•	Help text: "Click to snap to test angles for shadow leak verification."

13.4 Collapsible Section

	•	"Advanced Debug" section must be collapsible.
	•	Default state: Collapsed.
	•	Toggle icon (▼) must rotate 90° when collapsed.
	•	This section is for debugging and fine-tuning, not regular use.

⸻

14. UI/UX Design

12.1 Layout

	•	Two-column layout: Controls sidebar (left) + Preview panel (right).
	•	Sidebar width: 300-380px (responsive, min 300px).
	•	Preview panel: Flexible width, sticky positioning.
	•	Preview height: clamp(600px, 85vh, 900px), max 90vh.

12.2 Collapsible Sections

	•	Sections: Layers, Lighting, Shading must be collapsible.
	•	Default state: Collapsed.
	•	Toggle header must show section name + collapse icon (▼).
	•	Icon must rotate -90° when collapsed.
	•	Sections: Canvas, 3D Object, Projection, Display must always be open.

12.3 Color Scheme

	•	Background: #f5f6fa (light gray).
	•	Panels: #ffffff (white) with border #e2e6f2.
	•	Accent: #111d4a (dark blue).
	•	Text: #141824 (dark) / #6c7285 (muted).
	•	Shadows: Subtle box shadows for depth.

12.4 Responsive Design

	•	Mobile (< 1024px): Single column layout (sidebar above preview).
	•	Small screens (< 640px): Adjusted padding and font sizes.
	•	Preview header: Stack vertically on small screens.

12.5 Labels & Values

	•	All controls must display current value in the label.
	•	Values must update in real-time as controls change.
	•	Color values must display as uppercase hex (e.g., "#FF6B6B").
	•	Angle values must display with degree symbol (°).
	•	Dimensions must display with unit (mm).

⸻

13. General Design Philosophy

	•	Maintain professional technical drawing aesthetic with precise line art.
	•	Real-time preview must be responsive and accurate.
	•	All parameters must have reasonable defaults for immediate use.
	•	Interactive orbit controls must provide intuitive 3D manipulation.
	•	Export must produce clean, plotter-ready SVG files.
	•	System must generate visually coherent, occlusion-correct 3D renderings with proper depth sorting.
	•	Hatch shading must create clear visual depth cues through density variation.
	•	Shadow rendering must enhance 3D perception with realistic floor projection.

⸻

END OF REQUIREMENTS
