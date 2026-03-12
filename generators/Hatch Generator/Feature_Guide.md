# HatchStudio: Functional Specification & UX Guide

**Role:** This document serves as the "Source of Truth" for feature behavior.
**Purpose:** Use this to validate bug reports and implement fixes. If the code behaves differently than this document, the code is wrong.

---

## 1. Canvas & Navigation
**Goal:** Infinite, fluid workspace for A3/A4 plotting.

### 1.1. Viewport Controls
- **Panning:**
  - **Action:** Middle Mouse Button drag OR Spacebar + Left Click drag.
  - **Behavior:** The canvas moves 1:1 with the mouse cursor.
- **Zooming:**
  - **Action:** Mouse Wheel (scroll up to zoom in, down to zoom out).
  - **Action:** `Ctrl/Cmd + =` (zoom in) / `Ctrl/Cmd + -` (zoom out) or toolbar buttons.
  - **Behavior:** Zoom should focus on the mouse cursor position (or center screen if using keys).
  - **Constraint:** Zoom range clamped between 10% (0.1x) and 2000% (20x).
- **Fit to Screen:**
  - **Action:** Press `0` or click "Fit" icon.
  - **Behavior:** Centers the defined paper size within the viewport with a small padding.

### 1.2. Paper Settings
- **Presets:** A5, A4, A3 (Landscape/Portrait).
- **Custom Size:** User can input specific Width/Height in mm.
- **Margin:** Adjustable safe margin (0-50mm) displayed as a dashed line inside the paper edge.
- **Global Stroke Width:** Master stroke width setting (0.1-5mm) that applies to all shapes' outlines and hatches.
- **Visuals:** The "Paper" is a white rectangle with a drop shadow. The "Safe Margin" is a dashed line inside the paper edge.

---

## 2. Creation Tools
**Goal:** Precise geometric shape generation.

### 2.1. Standard Shapes
- **Rectangle (M):** Drag to create. Holds `Shift` to constrain to Square.
  - **Corner Radius:** Adjustable rounded corners (0-50mm) via Properties panel.
- **Ellipse (L):** Drag to create. Holds `Shift` to constrain to Circle. Drawn from corner to corner (bounding box).
- **Polygon (P):** Drag to create. Defines radius from center. Default 6 sides (adjustable 3-12 sides).
  - **Corner Radius:** Adjustable rounded corners (0-50mm) via Properties panel.
- **Line (\):** Drag start to end. Always shows outline regardless of hatch settings.

### 2.2. Selection Tools
- **Select Tool (V):**
  - **Click:** Selects the topmost shape under cursor.
  - **Shift+Click:** Toggles selection state of target shape (Add/Remove).
  - **Click Empty:** Deselects all.
  - **Ctrl+A / Cmd+A:** Selects all unlocked shapes.
- **Direct Select Tool (A):**
  - **Visuals:** Shows individual vertices (white circles) for selected Polylines/Polygons/Rectangles.
  - **Action:** Drag a single vertex to reshape the geometry without moving the whole shape.
  - **Shift+Drag:** Constrains vertex movement to horizontal or vertical axis (locks to the axis with larger initial movement).

### 2.3. Eyedropper (I)
- **Action:** Click a target shape to copy its properties.
- **Configuration:** Checkboxes determine if it copies **Color**, **Stroke**, and/or **Hatch Settings**.
- **Result:** Applies copied properties to the *currently selected* shapes immediately.

---

## 3. Manipulation & Transformation
**Goal:** Standard vector editing behavior.

### 3.1. Selection Overlay (The Bounding Box)
- **Appearance:** Blue dashed border around selected object(s). 
- **Handles:** 
  - 4 Corner handles (Resize).
  - 4 Edge handles (Stretch).
  - 1 Rotator handle (sticking out from top center, connected by dashed line).
- **Behavior:**
  - **Move:** Dragging inside the box moves all selected shapes.
    - **Alt/Option+Drag:** Duplicates the selection and immediately starts dragging the duplicates.
    - **Shift+Drag:** Constrains movement to horizontal or vertical axis (locks to the axis with larger initial movement).
    - **Snapping:** Shapes snap to centers and bounds of other shapes (configurable in Canvas Settings).
  - **Resize:** Dragging a handle scales the shape.
    - Scales relative to the *opposite* handle (anchor point), not the center.
    - **Shift:** Preserves aspect ratio.
    - **Alt:** Resizes from center (anchor becomes the center of the bounding box).
    - **Shift+Alt:** Preserves aspect ratio AND resizes from center.
    - **Snapping:** Handles snap to centers and bounds during resize.
  - **Rotate:** Dragging the rotator spins the shape around its geometric centroid (not just bounding box center).
    - For single shapes: Uses the shape's centroid.
    - For multiple shapes: Uses the average of each shape's centroid.

### 3.2. Nudging
- **Action:** Arrow Keys.
- **Behavior:** Moves selection by 1mm.
- **Modifier:** `Shift` + Arrow moves by 10mm.

### 3.3. Alignment & Distribution
- **Align (Top/Middle/Bottom/Left/Center/Right):** Aligns all selected objects to the *bounds of the selection group*.
  - Available via toolbar buttons or programmatically.
  - Aligns to the extreme edge/center of the selection's bounding box.
- **Distribute (Horizontal/Vertical):** Evenly spaces the *centers* of selected objects between the first and last object (requires 3+ items).
  - Available via toolbar buttons or programmatically.

---

## 4. Hatching Engine (Core Feature)
**Goal:** Convert vector shapes into plotter-friendly line paths.

### 4.1. General Logic
- **Non-Destructive:** Hatching is a property of the shape, not a permanent geometry change. The original outline remains editable.
- **Hole Awareness:** Hatches must respect "holes" created by Boolean operations (e.g., a donut shape should not have lines in the center hole).

### 4.2. Parameters
- **Enabled:** Toggle on/off.
- **Density:** Distance between lines in mm (0.5-20mm).
- **Angle:** Direction of lines (0-180°). Snap points at 45°, 90°, 180°.
- **Offset:** Shifts the starting position of the lines (0-50mm, useful for aligning hatches between shapes).
- **Space Mode:**
  - *Local:* Lines rotate with the shape (Angle 0 = always horizontal relative to shape). Default mode.
  - *World:* Lines stay fixed to canvas (Angle 0 = always horizontal on screen), acting like a "mask".
- **Render Outline:** Toggle to show/hide the original shape outline when hatching is enabled. Lines always show their outline.

### 4.3. Advanced Hatching
- **Cross-Hatch:** Adds a second pass of lines.
  - *Perpendicular:* Automatically 90° to the first pass (default).
  - *Custom Angle:* User defined angle for second pass (0-180°, snap points at 45°, 90°, 180°).
- **Zig-Zag:** Connects the ends of lines to form one continuous path (drastically reduces plot time/pen-up movements).
- **Gradient:** Varies the density (spacing) from one side of the bounding box to the other.
  - *Start Density:* Density at the start of the gradient (0.1-10mm).
  - *End Density:* Density at the end of the gradient (0.1-10mm).
  - *Gradient Angle:* Direction of the gradient (0-360°, snap points at 45°, 90°, 180°, 270°).

---

## 5. Boolean Operations (Pathfinder)
**Goal:** Construct complex geometry from simple shapes.

### 5.1. Operations
- **Union:** Combines shapes into one outline.
- **Subtract:** Removes the top shape's area from the bottom shape.
- **Intersect:** Keeps only the overlapping area.
- **Exclude:** Keeps everything *except* the overlapping area.

### 5.2. Technical Behavior
- **Input:** 2 or more overlapping shapes (selected in order).
- **Output:** A new single shape (or multiple shapes) of type `Polyline`.
- **Styling:** The result inherits the Color and Hatch settings of the *first selected* shape (the "Parent").
- **Corner Radius:** If the parent shape has corner radius, it is preserved in the result.
- **Topology:** Must correctly handle **Compound Paths** (shapes with holes). The system must render `fill-rule: evenodd` correctly in the SVG so holes appear transparent.
- **Hatch Settings:** Result inherits parent's hatch params, but `renderOutline` is automatically set to `false` (outline is typically not needed for boolean results).

#### 5.2.1. Corner Radius Implementation (Critical for Unioned Shapes)
**Problem:** When applying radius corners to unioned shapes (results from boolean operations), the hatching must exactly match the outline. The arc center calculation must account for:
1. **Polygon winding order:** Unioned shapes may have reversed winding (clockwise vs counterclockwise)
2. **Corner types:** Both convex (external) and concave (internal) corners need correct arc center placement

**Solution (Implemented in `generateRoundedPolylinePoints`):**
- **Winding Detection:** Calculate signed area using shoelace formula to determine if polygon is clockwise or counterclockwise
- **Arc Center Calculation:** Use perpendicular bisector method (chord-based) to match SVG arc behavior exactly
  - Calculate chord from arc start point to arc end point
  - Find perpendicular bisector of the chord
  - Place arc center at distance `sqrt(r² - (chord/2)²)` from chord midpoint along perpendicular
- **Sign Selection for Arc Center:**
  - **Convex (external) corners:** Use `sign = 1` (center on one side of chord)
  - **Concave (internal) corners:** Use `sign = -1` (center on opposite side)
  - **Concave Detection:** For counterclockwise polygons: `cross < 0` indicates concave corner. For clockwise polygons: `cross > 0` indicates concave corner

**Key Principle:** The hatching path must use the EXACT same arc center calculation as the SVG outline (`ptsToStrRounded`). Any mismatch causes hatching to bulge outward or create incorrect curves at corners.

**Files:** `src/lib/geometry.ts` - `generateRoundedPolylinePoints()` function

---

## 6. Properties & Styling
**Goal:** Precise control over shape appearance and transformation.

### 6.1. Transform Properties
- **Position:** X and Y coordinates in mm (center point for most shapes).
- **Size:** Width and Height in mm (for rectangles and groups).
  - For ellipses: Width/Height control radiusX/radiusY.
- **Rotation:** 0-360° with snap points at 45°, 90°, 180°, 270°.
- **Corner Radius:** For rectangles and polygons (0-50mm).

### 6.2. Appearance Properties
- **Stroke Color:** Color picker and hex input.
- **Show Outline:** Toggle to show/hide shape outline when hatching is enabled (lines always show outline).

### 6.3. Shape-Specific Properties
- **Polygon Sides:** Number of sides (3-12) for polygon shapes.
- **Group Properties:** When a group is selected, color changes apply to all children.

---

## 7. Layer Management
**Goal:** Photoshop/Illustrator-style organization.

### 7.1. Layer Tree
- **Structure:** Stacked list of shapes. Top of list = Top of canvas (z-index).
- **Reordering:** Drag and drop rows to change Z-order (before/after/inside).
- **Grouping:** 
  - Dragging a shape *onto* another group places it inside.
  - Selecting multiple shapes -> `Ctrl+G` / `Cmd+G` creates a Group.
  - Groups can contain other groups (nested groups).
  - Group properties (like color) can be applied to all children.
- **Renaming:** Double-click text to rename shapes and groups.
- **Selection:** Click layer item to select shape. Shift+Click to toggle.

### 7.2. Visibility & Locking
- **Eye Icon:** Toggles rendering on Canvas and SVG Export. Invisible shapes are ignored by the plotter.
- **Lock Icon:** Prevents selection via canvas click. Shape can still be selected via Layer list.

---

## 8. Project & Data
**Goal:** Persist work and export for hardware.

### 8.1. Project Management
- **Save Project:** Projects are saved to browser local storage with:
  - Project name (user-defined)
  - Thumbnail (auto-generated)
  - Timestamp
  - Complete state: Shapes, Paper Settings, Hatch Params, View Transform, Snapping settings
- **Load Project:** Load any saved project (with confirmation if unsaved changes exist).
- **Delete Project:** Remove saved projects from storage.
- **Projects Tab:** Accessible via left panel, shows all saved projects with thumbnails and metadata.

### 8.2. Export (SVG)
- **Format:** Standard SVG 1.1.
- **Units:** Explicit `mm` units in width/height attributes.
- **Structure:**
  - Outline Paths (`stroke`)
  - Hatch Paths (separate `path` elements)
  - **NO Fills:** Plotters cannot do fills. All geometry must be strokes.
- **Optimization:** Zero-length paths should be culled.
- **Visibility:** Only visible shapes are exported (respects eye icon toggle).

---

## 9. UX Interactions & Feedback

### 9.1. Visual Feedback
- **Hover:** Hovering a shape outline (or layer item) should highlight it (e.g., thin blue line).
- **Selection Highlight:** Selected shapes show a blue outline overlay.
- **Snap Guides:** Pink dashed lines appear when shapes snap to other shapes' centers or bounds.
- **Cursor:**
  - Default: Pointer.
  - Over Shape (Select tool): Grab cursor.
  - Over Handle: Resize arrows (NSEW, NE-SW, etc.).
  - Spacebar held: Grab hand.
  - Direct Select tool: Move cursor over vertices.

### 9.2. Snapping
- **Snap to Centers:** When enabled, shapes snap to the center points of other shapes.
- **Snap to Bounds:** When enabled, shapes snap to edges and corners of other shapes.
- **Threshold:** 5mm snap distance.
- **Visual Feedback:** Pink dashed guide lines show active snap points.
- **Configuration:** Toggleable in Canvas Settings panel (when no selection).

### 9.3. Undo/Redo
- **Undo:** `Ctrl+Z` / `Cmd+Z`
- **Redo:** `Ctrl+Shift+Z` / `Cmd+Shift+Z` or `Ctrl+Y` / `Cmd+Y`
- **History Tracking:** Must track *all* state changes:
  - Shape creation, deletion, modification
  - Property changes (position, size, rotation, color, etc.)
  - Hatch parameter changes
  - Grouping/ungrouping
  - Boolean operations
  - View transform changes
- **State Commits:** Operations are batched (e.g., drag operations commit on mouse up).

---

## 10. Keyboard Shortcuts Reference

### 10.1. Tools
| Key | Action |
| :--- | :--- |
| **V** | Select Tool |
| **A** | Direct Select Tool |
| **M** | Rectangle Tool |
| **L** | Ellipse Tool |
| **P** | Polygon Tool |
| **\\** | Line Tool |
| **I** | Eyedropper |

### 10.2. Navigation
| Key | Action |
| :--- | :--- |
| **Space (Hold)** | Pan Canvas |
| **0 (Zero)** | Zoom to Fit |
| **Ctrl/Cmd + =** | Zoom In |
| **Ctrl/Cmd + -** | Zoom Out |

### 10.3. Selection & Manipulation
| Key | Action |
| :--- | :--- |
| **Delete / Backspace** | Delete Selection |
| **Arrows** | Nudge (1mm) |
| **Shift + Arrows** | Nudge (10mm) |
| **Ctrl/Cmd + A** | Select All (unlocked shapes) |
| **Shift + Click** | Toggle selection |

### 10.4. Transformation
| Key | Action |
| :--- | :--- |
| **Alt/Option + Drag** | Duplicate and drag |
| **Shift + Drag** | Constrain to axis (horizontal/vertical) |
| **Shift + Resize** | Preserve aspect ratio |
| **Alt + Resize** | Resize from center |
| **Shift + Alt + Resize** | Preserve aspect ratio from center |

### 10.5. Grouping & Operations
| Key | Action |
| :--- | :--- |
| **Ctrl/Cmd + G** | Group |
| **Ctrl/Cmd + Shift + G** | Ungroup |
| **Ctrl/Cmd + C** | Copy |
| **Ctrl/Cmd + V** | Paste |
| **Ctrl/Cmd + D** | Duplicate |

### 10.6. History
| Key | Action |
| :--- | :--- |
| **Ctrl/Cmd + Z** | Undo |
| **Ctrl/Cmd + Shift + Z** | Redo |
| **Ctrl/Cmd + Y** | Redo (alternative) |